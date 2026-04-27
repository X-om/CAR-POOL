import admin from 'firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

let initialized = false;

function normalizeServiceAccount(input: any): any {
  if (!input || typeof input !== 'object') return input;
  if (typeof input.private_key === 'string') {
    // When provided via env vars, private keys commonly contain literal "\n" sequences.
    input.private_key = input.private_key.replace(/\\n/g, '\n');
  }
  return input;
}

function initFirebaseAdmin(): void {
  if (initialized) return;
  if (admin.apps.length > 0) {
    initialized = true;
    return;
  }

  // Prefer explicit service-account JSON if present. Otherwise, fall back to ADC
  // (e.g. GOOGLE_APPLICATION_CREDENTIALS or workload identity in cloud).
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawJson && rawJson.trim().length) {
    const parsed = normalizeServiceAccount(JSON.parse(rawJson));
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  initialized = true;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  initFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken, true);
}
