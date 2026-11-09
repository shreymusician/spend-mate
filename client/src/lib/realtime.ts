import { getAccessToken, refreshSession } from '@/lib/api';

export interface LiveUpdate { topics: string[]; txId?: string }

interface Options {
  onUpdate: (u: LiveUpdate) => void;
  /** Called with true when the live connection is up, false when it drops. */
  onStatus: (live: boolean) => void;
  /** Called after a reconnect, because updates may have been missed while offline. */
  onCatchUp: () => void;
}

const MAX_DELAY = 30_000;

/**
 * Keeps one live connection to the server open. It signs in with the access token (sent as the first message,
 * not in the address), reconnects by itself with growing pauses, and says "catch up" after any gap, since a phone
 * can lose the connection when the screen sleeps. Returns a function that stops it.
 */
export function startRealtime({ onUpdate, onStatus, onCatchUp }: Options): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let timer: number | undefined;
  let everConnected = false;
  let lastCode = 0;

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/realtime`;

  async function connect() {
    if (stopped || (ws && ws.readyState <= WebSocket.OPEN)) return;
    // The server closes with 4001 when our token is no longer good: get a fresh one first.
    if (lastCode === 4001) { await refreshSession(); lastCode = 0; }
    const token = getAccessToken();
    if (!token || stopped) return;

    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: 'auth', token }));
    sock.onmessage = (e) => {
      let m: { type?: string; topics?: string[]; txId?: string };
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.type === 'ready') {
        attempt = 0;
        onStatus(true);
        if (everConnected) onCatchUp();
        everConnected = true;
      } else if (m.type === 'update' && Array.isArray(m.topics)) {
        onUpdate({ topics: m.topics, txId: m.txId });
      }
    };
    sock.onclose = (e) => {
      if (ws === sock) ws = null;
      lastCode = e.code;
      onStatus(false);
      if (!stopped) schedule();
    };
    sock.onerror = () => sock.close();
  }

  function schedule() {
    window.clearTimeout(timer);
    // 1s, 2s, 4s … up to 30s, with a little randomness so many phones don't reconnect at the same instant.
    const delay = Math.min(MAX_DELAY, 1000 * 2 ** attempt++) * (0.75 + Math.random() * 0.5);
    timer = window.setTimeout(connect, delay);
  }

  // Coming back to the app, or the network returning, is the best moment to reconnect right away.
  const wake = () => { if (document.visibilityState === 'visible') { window.clearTimeout(timer); void connect(); } };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);

  void connect();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    ws?.close();
    onStatus(false);
  };
}
