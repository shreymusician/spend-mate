import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyAccessToken } from '../middleware/auth.js';

/**
 * Live updates. The server only ever sends a tiny "something changed" nudge; the app then fetches the real data
 * through the normal, permission-checked API. So no private data can leak through this channel.
 *
 * One server process keeps the list of open connections in memory. If the API is ever run as several copies,
 * this is the one place to swap for a shared message bus (for example Redis).
 */
export interface LiveEvent {
  type: 'update';
  /** What changed: 'transactions', 'family' (links, photos) or 'comments'. */
  topics: string[];
  txId?: string;
}

interface Live extends WebSocket { isAlive?: boolean; userId?: string }

export const REALTIME_PATH = '/api/realtime';
const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 25_000;
const MAX_PER_USER = 6; // phone + laptop + a few tabs; more than that is a leak or abuse

const sockets = new Map<string, Set<Live>>();

function add(userId: string, ws: Live) {
  const set = sockets.get(userId) ?? new Set<Live>();
  sockets.set(userId, set);
  set.add(ws);
  // Drop the oldest ones beyond the limit.
  while (set.size > MAX_PER_USER) { const oldest = set.values().next().value as Live; set.delete(oldest); oldest.close(4002, 'Too many connections'); }
}

function remove(ws: Live) {
  if (!ws.userId) return;
  const set = sockets.get(ws.userId);
  set?.delete(ws);
  if (set?.size === 0) sockets.delete(ws.userId);
}

/** Tell every open connection of these people. Never throws: a failed nudge must not break the request that caused it. */
export function publish(userIds: Iterable<string>, event: LiveEvent) {
  const data = JSON.stringify(event);
  for (const id of new Set(userIds)) {
    for (const ws of sockets.get(String(id)) ?? []) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data, (err) => { if (err) ws.terminate(); });
    }
  }
}

/** Closes every connection of one person, e.g. after their sessions were revoked. */
export function disconnectUser(userId: string) {
  for (const ws of [...(sockets.get(userId) ?? [])]) ws.close(4001, 'Signed out');
}

export function connectionCount(userId?: string) {
  return userId ? sockets.get(userId)?.size ?? 0 : [...sockets.values()].reduce((n, s) => n + s.size, 0);
}

export function attachRealtime(server: Server) {
  // Small payload cap: clients only ever send their token and pings.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== REALTIME_PATH) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (raw: WebSocket) => {
    const ws = raw as Live;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // The token travels in the first message, not in the address, so it never ends up in logs or history.
    const timer = setTimeout(() => ws.close(4001, 'Authentication timed out'), AUTH_TIMEOUT_MS);

    ws.on('message', (buf) => {
      if (ws.userId) return; // already signed in; nothing else is accepted
      try {
        const msg = JSON.parse(buf.toString()) as { type?: string; token?: string };
        if (msg.type !== 'auth' || typeof msg.token !== 'string') throw new Error('expected auth');
        ws.userId = verifyAccessToken(msg.token).sub;
        clearTimeout(timer);
        add(ws.userId, ws);
        ws.send(JSON.stringify({ type: 'ready' }));
      } catch {
        ws.close(4001, 'Not signed in');
      }
    });

    ws.on('close', () => { clearTimeout(timer); remove(ws); });
    ws.on('error', () => ws.terminate());
  });

  // Phones vanish without saying goodbye (lift, tunnel, battery saver). Ping, and drop anyone who does not answer.
  const beat = setInterval(() => {
    for (const raw of wss.clients) {
      const ws = raw as Live;
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  beat.unref();

  return {
    close() {
      clearInterval(beat);
      for (const ws of wss.clients) ws.terminate();
      sockets.clear();
      wss.close();
    },
  };
}
