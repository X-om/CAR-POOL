import { startStack, stopStack } from './harness/stack.js';

export default async function globalSetup() {
  // When running against an already-started Docker Compose stack (e.g. `pnpm docker:up`),
  // don't try to start/stop local processes or bring Docker up/down.
  if (process.env.E2E_EXTERNAL_STACK === '1') {
    return async () => {
      // no-op
    };
  }

  await startStack();

  return async () => {
    await stopStack();
  };
}
