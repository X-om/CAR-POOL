export function unixToDate(unix: number | string | bigint): Date {
  const n = typeof unix === 'bigint' ? Number(unix) : typeof unix === 'string' ? Number(unix) : unix;
  if (!Number.isFinite(n) || n <= 0) return new Date(0);
  // Heuristic: seconds vs milliseconds
  return n > 1_000_000_000_000 ? new Date(n) : new Date(n * 1000);
}

export function dateToUnixMillis(d: Date): number {
  return d.getTime();
}
