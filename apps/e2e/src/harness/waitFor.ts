import net from 'node:net';

export async function waitForTcpPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        const onError = (err: unknown) => {
          socket.destroy();
          reject(err);
        };
        socket.setTimeout(1000);
        socket.once('error', onError);
        socket.once('timeout', () => onError(new Error('timeout')));
        socket.connect(port, host, () => {
          socket.end();
          resolve();
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  throw new Error(`Timed out waiting for TCP ${host}:${port}`);
}
