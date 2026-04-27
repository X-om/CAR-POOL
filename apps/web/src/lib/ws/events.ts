export type WsEvent = {
  type?: "BOOKING" | "RIDE" | "TRIP" | "SYSTEM" | string;
  title?: string;
  message?: string;
  topic?: string;
  eventType?: string;
  aggregateId?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
};

export function parseWsEvent(raw: string): WsEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as WsEvent;
  } catch {
    return null;
  }
}
