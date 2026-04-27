import fs from 'node:fs';

export function applyEnvFileFallback(varName: string): void {
  if (typeof process.env[varName] === 'string' && process.env[varName]!.length > 0) return;

  const fileVar = `${varName}_FILE`;
  const filePath = process.env[fileVar];
  if (typeof filePath !== 'string' || filePath.length === 0) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  // common pattern: secret file ends with newline
  process.env[varName] = raw.trimEnd();
}

export function applyEnvFileFallbacks(varNames: string[]): void {
  for (const n of varNames) applyEnvFileFallback(n);
}
