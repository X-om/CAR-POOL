import { afterAll, describe, expect, test } from 'vitest';
import { WebSocket } from 'ws';
import { Kafka } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import { EMAIL_JOBS_TOPIC } from '@repo/mailer';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

type ApiResponse<T> = { success: boolean; data: T; error: unknown };

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const WS_URL = process.env.E2E_WS_URL ?? 'ws://127.0.0.1:3001';
// When running against the Docker Compose Redpanda setup, the host-accessible listener is 19092.
// The 9092 listener is advertised as `redpanda:9092` for in-network containers.
const KAFKA_BROKERS = process.env.E2E_KAFKA_BROKERS ?? '127.0.0.1:19092';
const HTTP_TIMEOUT_MS = Number(process.env.E2E_HTTP_TIMEOUT_MS ?? '20000');
const HTTP_READY_TIMEOUT_MS = Number(process.env.E2E_HTTP_READY_TIMEOUT_MS ?? '30000');
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://carpool:carpool@127.0.0.1:5432/carpool';

async function waitForHttpReady(timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${BASE_URL}/`, { method: 'GET', signal: controller.signal });
      // Any HTTP response means the server is up (404 is fine).
      void res.arrayBuffer().catch(() => undefined);
      return;
    } catch {
      // ignore and retry
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for API gateway at ${BASE_URL}`);
}

async function forceUsersFullyVerified(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `
      UPDATE users
      SET
        is_phone_verified = TRUE,
        is_email_verified = TRUE,
        is_verified = TRUE,
        updated_at = NOW()
      WHERE id = ANY($1::uuid[])
      `,
      [userIds],
    );
  } finally {
    await client.end();
  }
}

type ReportEntry = {
  name: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  error?: string;
  durationMs: number;
};

function normalizeHeaders(headers: RequestInit['headers']): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    for (const [k, v] of headers.entries()) out[k] = v;
    return out;
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const [k, v] of headers) out[k] = v;
    return out;
  }
  return { ...(headers as Record<string, string>) };
}

function redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'authorization') {
      out[k] = 'Bearer <redacted>';
      continue;
    }
    out[k] = v;
  }
  return out;
}

function redactTokenInObject(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactTokenInObject);

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase() === 'token' && typeof v === 'string') {
      out[k] = '<redacted>';
    } else {
      out[k] = redactTokenInObject(v);
    }
  }
  return out;
}

function safeJsonParse(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return text;
  }
}

function formatCodeBlock(lang: string, content: string): string {
  const trimmed = content.endsWith('\n') ? content : `${content}\n`;
  return `\n\n\`\`\`${lang}\n${trimmed}\`\`\`\n`;
}

function formatMaybeJson(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderReportMarkdown(entries: ReportEntry[]): string {
  const startedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# API Responses`);
  lines.push('');
  lines.push(`Generated: ${startedAt}`);
  lines.push('');
  lines.push(`Total calls recorded: ${entries.length}`);

  for (const [idx, e] of entries.entries()) {
    lines.push('');
    lines.push(`## ${idx + 1}. ${e.name}`);
    lines.push('');
    lines.push(`- Method: \`${e.method}\``);
    lines.push(`- URL: \`${e.url}\``);
    lines.push(`- Duration: \`${e.durationMs}ms\``);
    if (typeof e.responseStatus === 'number') {
      lines.push(`- Status: \`${e.responseStatus}\``);
    }
    if (e.error) {
      lines.push(`- Error: \`${e.error}\``);
    }

    lines.push('');
    lines.push('### Request');
    lines.push(formatCodeBlock('json', formatMaybeJson(e.requestHeaders)));
    if (e.requestBody !== null && e.requestBody !== undefined && e.requestBody !== '') {
      lines.push(formatCodeBlock('json', formatMaybeJson(e.requestBody)));
    }

    lines.push('');
    lines.push('### Response');
    if (e.responseHeaders) {
      lines.push(formatCodeBlock('json', formatMaybeJson(e.responseHeaders)));
    }
    if (e.responseBody !== null && e.responseBody !== undefined && e.responseBody !== '') {
      const asJson = typeof e.responseBody === 'string' ? safeJsonParse(e.responseBody) : e.responseBody;
      lines.push(formatCodeBlock('json', formatMaybeJson(redactTokenInObject(asJson))));
    }
  }

  lines.push('');
  return lines.join('\n');
}

const reportEntries: ReportEntry[] = [];
const REPORT_PATH = process.env.E2E_API_REPORT_PATH ?? resolve(process.cwd(), '../../API_RESPONSES.md');

function record(entry: ReportEntry) {
  reportEntries.push(entry);
}

async function httpJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const method = init?.method ?? 'GET';
  const url = `${BASE_URL}${path}`;
  const requestHeaders = redactSensitiveHeaders({
    'content-type': 'application/json',
    ...normalizeHeaders(init?.headers),
  });
  const requestBody = typeof init?.body === 'string' ? safeJsonParse(init.body) : init?.body ?? null;

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    const responseText = await res.text();
    const responseBody = safeJsonParse(responseText) as ApiResponse<T>;

    const responseHeaders: Record<string, string> = {};
    for (const [k, v] of res.headers.entries()) responseHeaders[k] = v;

    record({
      name: `${method} ${path}`,
      method,
      url,
      requestHeaders,
      requestBody,
      responseStatus: res.status,
      responseHeaders,
      responseBody,
      durationMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${path}: ${JSON.stringify(responseBody)}`);
    }
    return responseBody;
  } catch (err) {
    record({
      name: `${method} ${path}`,
      method,
      url,
      requestHeaders,
      requestBody,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForMessage(ws: WebSocket, timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out waiting for websocket message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(t);
      resolve(data.toString());
    });
    ws.once('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function createEmailJobsConsumer() {
  const kafka = new Kafka({
    clientId: `e2e-email-jobs-${randomUUID()}`,
    brokers: KAFKA_BROKERS.split(',').map((b) => b.trim()).filter(Boolean),
  });
  const consumer = kafka.consumer({ groupId: `e2e-email-jobs-${randomUUID()}` });

  const seen: unknown[] = [];

  async function start() {
    await consumer.connect();
    // In practice, Kafka consumer group join can take a moment; when using
    // `fromBeginning: false` we can miss messages published right after start.
    // Since the test run uses unique emails, reading from the beginning is safe.
    await consumer.subscribe({ topic: EMAIL_JOBS_TOPIC, fromBeginning: true });
    // Start consuming in the background. Kafkajs may take a moment to join the
    // consumer group; if we publish immediately, we can miss messages when
    // subscribing with `fromBeginning: false`.
    void consumer.run({
      autoCommit: true,
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const raw = message.value.toString('utf8');
          const parsed = JSON.parse(raw);
          seen.push(parsed);
        } catch {
          // ignore
        }
      },
    });

    await new Promise((r) => setTimeout(r, 1500));
  }

  function findOtpForEmail(email: string): string | null {
    for (const item of seen) {
      const v = item as any;
      if (
        v &&
        v.templateId === 'auth-otp' &&
        v.to === email &&
        v.templateVariables &&
        typeof v.templateVariables.otp === 'string'
      ) {
        return v.templateVariables.otp;
      }
    }
    return null;
  }

  async function waitForOtp(email: string, timeoutMs: number): Promise<string> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const otp = findOtpForEmail(email);
      if (otp) return otp;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timed out waiting for OTP for ${email}`);
  }

  async function stop() {
    await consumer.stop().catch(() => undefined);
    await consumer.disconnect().catch(() => undefined);
  }

  return { start, stop, waitForOtp };
}

describe('API Gateway E2E', () => {
  const emailJobs = createEmailJobsConsumer();

  afterAll(async () => {
    await emailJobs.stop();

    if (reportEntries.length > 0) {
      const md = renderReportMarkdown(reportEntries);
      await writeFile(REPORT_PATH, md, 'utf8');
    }
  });

  test('happy-path covers every endpoint', async () => {
    const suffix = Date.now();
    const driver = { email: `driver.${suffix}@e2e.local`, phoneNumber: `+1000000${suffix}` };
    const passengerA = { email: `passengerA.${suffix}@e2e.local`, phoneNumber: `+2000000${suffix}` };
    const passengerB = { email: `passengerB.${suffix}@e2e.local`, phoneNumber: `+3000000${suffix}` };

    await emailJobs.start();

    await waitForHttpReady(HTTP_READY_TIMEOUT_MS);

    // Auth: register + verify (3 users)
    await httpJson('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(driver) });
    await httpJson('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(passengerA) });
    await httpJson('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(passengerB) });

    const driverOtp = await emailJobs.waitForOtp(driver.email, 15_000);
    const passengerAOtp = await emailJobs.waitForOtp(passengerA.email, 15_000);
    const passengerBOtp = await emailJobs.waitForOtp(passengerB.email, 15_000);

    // Done with Kafka; stop early to avoid hanging handles.
    await emailJobs.stop();

    const driverVerify = await httpJson<{ userId: string; token: string }>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: driver.phoneNumber, otp: driverOtp }),
    });
    const passengerAVerify = await httpJson<{ userId: string; token: string }>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: passengerA.phoneNumber, otp: passengerAOtp }),
    });
    const passengerBVerify = await httpJson<{ userId: string; token: string }>('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: passengerB.phoneNumber, otp: passengerBOtp }),
    });

    expect(driverVerify.success).toBe(true);
    expect(passengerAVerify.success).toBe(true);
    expect(passengerBVerify.success).toBe(true);

    const driverToken = driverVerify.data.token;
    const passengerAToken = passengerAVerify.data.token;
    const passengerBToken = passengerBVerify.data.token;

    await forceUsersFullyVerified([
      driverVerify.data.userId,
      passengerAVerify.data.userId,
      passengerBVerify.data.userId,
    ]);

    const authz = (token: string) => ({ Authorization: `Bearer ${token}` });

    // Users: get/profile/update/rating/increment/update rating
    const driverUser = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(driverUser.success).toBe(true);

    const driverProfile1 = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/profile`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(driverProfile1.success).toBe(true);

    const driverProfileUpdate = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/profile`, {
      method: 'PUT',
      headers: authz(driverToken),
      body: JSON.stringify({
        firstName: 'E2E',
        lastName: 'Driver',
        profilePictureUrl: 'https://example.com/avatar.png',
        bio: 'Test profile',
        city: 'CityA',
      }),
    });
    expect(driverProfileUpdate.success).toBe(true);

    const driverProfile2 = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/profile`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(driverProfile2.success).toBe(true);

    const driverRating1 = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/rating`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(driverRating1.success).toBe(true);

    const driverRideCount = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/ride-count/increment`, {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({}),
    });
    expect(driverRideCount.success).toBe(true);

    const updateDriverRating = await httpJson<any>(`/api/v1/users/${driverVerify.data.userId}/rating`, {
      method: 'POST',
      headers: authz(passengerAToken),
      body: JSON.stringify({ newRating: 4.5 }),
    });
    expect(updateDriverRating.success).toBe(true);

    // Vehicles: add/list/get/update/delete (delete a spare vehicle)
    const v1 = await httpJson<{ vehicleId: string }>('/api/v1/vehicles', {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        color: 'Blue',
        licensePlate: `E2E-${suffix}-1`,
        seatCapacity: 4,
      }),
    });
    const vehicleId1 = v1.data.vehicleId;

    const vehicleVerifyOwner = await httpJson<any>(`/api/v1/vehicles/${vehicleId1}/verify-ownership`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(vehicleVerifyOwner.success).toBe(true);

    const v2 = await httpJson<{ vehicleId: string }>('/api/v1/vehicles', {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        color: 'Grey',
        licensePlate: `E2E-${suffix}-2`,
        seatCapacity: 4,
      }),
    });
    const vehicleId2 = v2.data.vehicleId;

    const vehiclesList = await httpJson<{ vehicles: any[] }>('/api/v1/vehicles', {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(vehiclesList.data.vehicles.length).toBeGreaterThanOrEqual(2);

    const vehicleGet = await httpJson<any>(`/api/v1/vehicles/${vehicleId1}`, { method: 'GET', headers: authz(driverToken) });
    expect(vehicleGet.data.vehicleId).toBe(vehicleId1);

    const vehicleUpdate = await httpJson<{ success: boolean }>(`/api/v1/vehicles/${vehicleId1}`, {
      method: 'PUT',
      headers: authz(driverToken),
      body: JSON.stringify({
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        color: 'Red',
        licensePlate: `E2E-${suffix}-1U`,
        seatCapacity: 4,
      }),
    });
    expect(vehicleUpdate.success).toBe(true);

    const vehicleDelete = await httpJson<{ success: boolean }>(`/api/v1/vehicles/${vehicleId2}`, {
      method: 'DELETE',
      headers: authz(driverToken),
    });
    expect(vehicleDelete.success).toBe(true);

    // Rides: create/update/get/list/cancel (cancel a second ride)
    const departureTime = Date.now() + 60 * 60 * 1000;
    // Use 3 stops to validate along-route matching and leg-based seat accounting.
    const PUNE = { stopOrder: 0, cityName: 'Pune', latitude: 18.5204, longitude: 73.8567 };
    const SANGAMNER = { stopOrder: 1, cityName: 'Sangamner', latitude: 19.5678, longitude: 74.214 };
    const NASHIK = { stopOrder: 2, cityName: 'Nashik', latitude: 20.0059, longitude: 73.7897 };
    const stops = [PUNE, SANGAMNER, NASHIK];

    const rideCreate = await httpJson<{ rideId: string }>('/api/v1/rides', {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({
        vehicleId: vehicleId1,
        sourceCity: PUNE.cityName,
        destinationCity: NASHIK.cityName,
        departureTime,
        pricePerSeat: 10,
        stops,
        approvalMode: 'MANUAL',
      }),
    });
    const rideId = rideCreate.data.rideId;

    // Search: list rides (along-route) + ride detail (public endpoints)
    // This should match pickup/dropoff stops (Pune->Sangamner) on a longer route (Pune->Nashik).
    const searchRides = await httpJson<{ rides: any[] }>(
      '/api/v1/search/rides?sourceLat=' +
      PUNE.latitude +
      '&sourceLng=' +
      PUNE.longitude +
      '&destLat=' +
      SANGAMNER.latitude +
      '&destLng=' +
      SANGAMNER.longitude +
      '&departureTime=' +
      departureTime +
      '&requiredSeats=1',
      {
        method: 'GET',
      },
    );
    expect(searchRides.success).toBe(true);
    expect(searchRides.data.rides.length).toBeGreaterThanOrEqual(1);

    const searchHit = (searchRides.data.rides as any[]).find((r) => r.rideId === rideId) ?? searchRides.data.rides[0];
    expect(searchHit.rideId).toBe(rideId);
    expect(searchHit.pickupStopOrder).toBe(0);
    expect(searchHit.dropoffStopOrder).toBe(1);
    expect(Array.isArray(searchHit.routeStops)).toBe(true);
    expect(searchHit.routeStops.length).toBe(3);
    expect(typeof searchHit.driverPricePerSeat).toBe('number');
    expect(typeof searchHit.estimatedPricePerSeat).toBe('number');
    expect(searchHit.estimatedPricePerSeat).toBeGreaterThan(0);
    expect(searchHit.estimatedPricePerSeat).toBeLessThanOrEqual(searchHit.driverPricePerSeat);
    expect(typeof searchHit.availableSeats).toBe('number');
    expect(searchHit.availableSeats).toBeGreaterThanOrEqual(1);

    const seatsAvailability = await httpJson<any>(
      `/api/v1/rides/${rideId}/seats/availability?requestedSeats=1&pickupStopOrder=${searchHit.pickupStopOrder}&dropoffStopOrder=${searchHit.dropoffStopOrder}`,
      {
        method: 'GET',
        headers: authz(passengerAToken),
      },
    );
    expect(seatsAvailability.success).toBe(true);

    const seatsReserve = await httpJson<any>(`/api/v1/rides/${rideId}/seats/reserve`, {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({ seatCount: 1, pickupStopOrder: searchHit.pickupStopOrder, dropoffStopOrder: searchHit.dropoffStopOrder }),
    });
    expect(seatsReserve.success).toBe(true);

    const seatsRelease = await httpJson<any>(`/api/v1/rides/${rideId}/seats/release`, {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({ seatCount: 1, pickupStopOrder: searchHit.pickupStopOrder, dropoffStopOrder: searchHit.dropoffStopOrder }),
    });
    expect(seatsRelease.success).toBe(true);

    const rideUpdate = await httpJson<{ success: boolean }>(`/api/v1/rides/${rideId}`, {
      method: 'PUT',
      headers: authz(driverToken),
      body: JSON.stringify({
        vehicleId: vehicleId1,
        sourceCity: PUNE.cityName,
        destinationCity: NASHIK.cityName,
        departureTime,
        pricePerSeat: 12,
        stops,
        approvalMode: 'MANUAL',
      }),
    });
    expect(rideUpdate.success).toBe(true);

    const rideGet = await httpJson<any>(`/api/v1/rides/${rideId}`, { method: 'GET', headers: authz(driverToken) });
    expect(rideGet.data.rideId).toBe(rideId);

    const rideList = await httpJson<{ rides: any[] }>('/api/v1/rides', { method: 'GET', headers: authz(driverToken) });
    expect(rideList.data.rides.length).toBeGreaterThanOrEqual(1);

    const ride2 = await httpJson<{ rideId: string }>('/api/v1/rides', {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({
        vehicleId: vehicleId1,
        sourceCity: PUNE.cityName,
        destinationCity: NASHIK.cityName,
        departureTime: departureTime + 15 * 60 * 1000,
        pricePerSeat: 9,
        stops,
        approvalMode: 'AUTO',
      }),
    });
    const rideCancel = await httpJson<{ success: boolean }>(`/api/v1/rides/${ride2.data.rideId}/cancel`, {
      method: 'POST',
      headers: authz(driverToken),
    });
    expect(rideCancel.success).toBe(true);

    const searchRide = await httpJson<any>(`/api/v1/search/rides/${rideId}`, { method: 'GET' });
    expect(searchRide.success).toBe(true);

    // WebSocket realtime: listen as passengerA for approval notification
    const wsUrlRecorded = `${WS_URL}?token=<redacted>`;
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(passengerAToken)}`);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timed out opening websocket')), 10_000);
      ws.once('open', () => {
        clearTimeout(t);
        record({
          name: 'WS connect',
          method: 'WS',
          url: wsUrlRecorded,
          requestHeaders: {},
          requestBody: null,
          responseStatus: 101,
          responseBody: { connected: true },
          durationMs: 0,
        });
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(t);
        record({
          name: 'WS connect',
          method: 'WS',
          url: wsUrlRecorded,
          requestHeaders: {},
          requestBody: null,
          error: err instanceof Error ? err.message : String(err),
          durationMs: 0,
        });
        reject(err);
      });
    });

    // Bookings: create/approve/cancel/recreate/approve/reject/get/list
    const bookingA1 = await httpJson<{ bookingId: string; status: number }>('/api/v1/bookings', {
      method: 'POST',
      headers: authz(passengerAToken),
      body: JSON.stringify({ rideId, seatCount: 1, pickupStopOrder: searchHit.pickupStopOrder, dropoffStopOrder: searchHit.dropoffStopOrder }),
    });

    // Segment seat accounting check: a booking on leg 0->1 should not reduce availability for leg 1->2.
    const afterBookingLeg01 = await httpJson<{ rides: any[] }>(
      '/api/v1/search/rides?sourceLat=' +
      PUNE.latitude +
      '&sourceLng=' +
      PUNE.longitude +
      '&destLat=' +
      SANGAMNER.latitude +
      '&destLng=' +
      SANGAMNER.longitude +
      '&departureTime=' +
      departureTime +
      '&requiredSeats=1',
      {
        method: 'GET',
      },
    );
    const hitLeg01After = (afterBookingLeg01.data.rides as any[]).find((r) => r.rideId === rideId) ?? afterBookingLeg01.data.rides[0];
    expect(hitLeg01After.availableSeats).toBe(searchHit.availableSeats - 1);

    const afterBookingLeg12 = await httpJson<{ rides: any[] }>(
      '/api/v1/search/rides?sourceLat=' +
      SANGAMNER.latitude +
      '&sourceLng=' +
      SANGAMNER.longitude +
      '&destLat=' +
      NASHIK.latitude +
      '&destLng=' +
      NASHIK.longitude +
      '&departureTime=' +
      departureTime +
      '&requiredSeats=1',
      {
        method: 'GET',
      },
    );
    const hitLeg12After = (afterBookingLeg12.data.rides as any[]).find((r) => r.rideId === rideId) ?? afterBookingLeg12.data.rides[0];
    expect(hitLeg12After.availableSeats).toBe(searchHit.availableSeats);

    const approveA1 = await httpJson<{ status: number }>(`/api/v1/bookings/${bookingA1.data.bookingId}/approve`, {
      method: 'POST',
      headers: authz(driverToken),
    });
    expect(approveA1.success).toBe(true);

    const cancelA1 = await httpJson<{ success: boolean }>(`/api/v1/bookings/${bookingA1.data.bookingId}/cancel`, {
      method: 'POST',
      headers: authz(passengerAToken),
    });
    expect(cancelA1.success).toBe(true);

    const bookingA2 = await httpJson<{ bookingId: string; status: number }>('/api/v1/bookings', {
      method: 'POST',
      headers: authz(passengerAToken),
      body: JSON.stringify({ rideId, seatCount: 1 }),
    });

    const approveA2 = await httpJson<{ status: number }>(`/api/v1/bookings/${bookingA2.data.bookingId}/approve`, {
      method: 'POST',
      headers: authz(driverToken),
    });
    expect(approveA2.success).toBe(true);

    // PassengerB booking rejected
    const bookingB = await httpJson<{ bookingId: string; status: number }>('/api/v1/bookings', {
      method: 'POST',
      headers: authz(passengerBToken),
      body: JSON.stringify({ rideId, seatCount: 1 }),
    });

    const rejectB = await httpJson<{ status: number }>(`/api/v1/bookings/${bookingB.data.bookingId}/reject`, {
      method: 'POST',
      headers: authz(driverToken),
    });
    expect(rejectB.success).toBe(true);

    const getBooking = await httpJson<any>(`/api/v1/bookings/${bookingA2.data.bookingId}`, {
      method: 'GET',
      headers: authz(passengerAToken),
    });
    expect(getBooking.success).toBe(true);

    const listBookings = await httpJson<{ bookings: any[] }>('/api/v1/bookings', {
      method: 'GET',
      headers: authz(passengerAToken),
    });
    expect(listBookings.success).toBe(true);

    // Wait for realtime notification from Redis→WS (approval event)
    const realtime = await waitForMessage(ws, 45_000);
    expect(realtime.length).toBeGreaterThan(0);

    record({
      name: 'WS message',
      method: 'WS',
      url: wsUrlRecorded,
      requestHeaders: {},
      requestBody: null,
      responseBody: safeJsonParse(realtime),
      durationMs: 0,
    });
    ws.close();

    // Trips: start/pickup/complete/get/list
    const tripStart = await httpJson<{ tripId: string; status: number }>('/api/v1/trips/start', {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({ rideId }),
    });

    const tripPickup = await httpJson<{ success: boolean }>(`/api/v1/trips/${tripStart.data.tripId}/pickup`, {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({ passengerId: passengerAVerify.data.userId }),
    });
    expect(tripPickup.success).toBe(true);

    const tripComplete = await httpJson<{ success: boolean }>(`/api/v1/trips/${tripStart.data.tripId}/complete`, {
      method: 'POST',
      headers: authz(driverToken),
      body: JSON.stringify({}),
    });
    expect(tripComplete.success).toBe(true);

    const tripGet = await httpJson<any>(`/api/v1/trips/${tripStart.data.tripId}`, {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(tripGet.success).toBe(true);

    const tripList = await httpJson<{ trips: any[] }>('/api/v1/trips', {
      method: 'GET',
      headers: authz(driverToken),
    });
    expect(tripList.success).toBe(true);

    // Notifications: list + mark read
    const notifList = await httpJson<{ notifications: any[] }>('/api/v1/notifications', {
      method: 'GET',
      headers: authz(passengerAToken),
    });
    expect(notifList.success).toBe(true);
    expect(notifList.data.notifications.length).toBeGreaterThan(0);

    const firstNotifId = (notifList.data.notifications[0] as any).id ?? (notifList.data.notifications[0] as any).notificationId;
    expect(typeof firstNotifId).toBe('string');

    const notifRead = await httpJson<{ success: boolean }>(`/api/v1/notifications/${firstNotifId}/read`, {
      method: 'POST',
      headers: authz(passengerAToken),
    });
    expect(notifRead.success).toBe(true);
  });
});
