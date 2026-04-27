import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { createRedisClient } from '@repo/redis';
import { verifyAccessToken } from '@repo/auth';
import { JWT_SECRET, REDIS_URL, WS_PORT } from './env';

function getTokenFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, `http://localhost:${WS_PORT}`);
    return u.searchParams.get('token');
  } catch {
    return null;
  }
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const token = getTokenFromUrl(req.url) || (typeof req.headers.authorization === 'string'
    ? req.headers.authorization.replace(/^Bearer\s+/i, '')
    : null);

  if (!token) {
    ws.close(1008, 'Missing token');
    return;
  }

  let userId: string;
  try {
    const verified = verifyAccessToken(token, JWT_SECRET);
    userId = verified.claims.sub;
  } catch {
    ws.close(1008, 'Invalid token');
    return;
  }

  const redisSub = createRedisClient(REDIS_URL);
  const channel = `notifications:user:${userId}`;

  const cleanup = async () => {
    try {
      await redisSub.unsubscribe(channel);
    } catch {
      // ignore
    }
    redisSub.disconnect();
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  await redisSub.subscribe(channel);
  redisSub.on('message', (ch, message) => {
    if (ch !== channel) return;
    if (ws.readyState !== ws.OPEN) return;
    ws.send(message);
  });
});

server.listen(WS_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`webSocket-gateway listening on :${WS_PORT}`);
});
