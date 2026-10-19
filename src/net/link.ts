import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import type { Side } from '../game/types';

// Online play is browser-to-browser over WebRTC; there is no game server. The free PeerJS cloud
// broker only introduces the two peers, and Google's public STUN servers let each browser find its
// public address. Networks that rewrite ports per destination (symmetric NAT, e.g. Zscaler on work
// laptops) can't connect directly; set VITE_TURN_URLS (comma-separated) with VITE_TURN_USERNAME and
// VITE_TURN_CREDENTIAL to add a relay for them.
// Set VITE_PEER_HOST (and optionally VITE_PEER_PORT / VITE_PEER_PATH) to use a self-hosted broker.
const env = import.meta.env;
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }];
if (env.VITE_TURN_URLS) {
  ICE_SERVERS.push({ urls: env.VITE_TURN_URLS.split(','), username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
}
const PEER_OPTIONS: PeerOptions = {
  config: { iceServers: ICE_SERVERS },
  ...(env.VITE_PEER_HOST && { host: env.VITE_PEER_HOST, port: Number(env.VITE_PEER_PORT ?? 443), path: env.VITE_PEER_PATH ?? '/', secure: true }),
};

const ID_PREFIX = 'savanna-shield-v1-';
// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
const CONNECT_TIMEOUT_MS = 15_000;
const PING_MS = 2_000;
const SILENCE_MS = 10_000;

/** Host → guest: start/round/lock/reveal/end/hello. Guest → host: pick/ready. Both: ping. `bye` is local-only. */
export type Msg =
  | { t: 'hello'; side: Side }
  | { t: 'start'; scenario: string }
  | { t: 'round'; index: number; order: Record<Side, number[]> }
  | { t: 'pick'; round: number; index: number }
  | { t: 'lock' }
  | { t: 'reveal'; picks: Record<Side, number | null> }
  | { t: 'end' }
  | { t: 'ready' }
  | { t: 'ping' }
  | { t: 'bye' };

export class Disconnected extends Error {
  constructor() {
    super('Your opponent disconnected.');
  }
}

export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const DIRECT_FAILED =
  "Found the game but couldn't link the two devices. Work networks and VPNs (like Zscaler) often block this: try both players on mobile data or home Wi-Fi.";

function friendlyError(err: unknown): Error {
  const type = (err as { type?: string }).type;
  if (type === 'peer-unavailable') return new Error('No game found with that code. Check it and try again.');
  if (type === 'browser-incompatible') return new Error("This browser doesn't support online play.");
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed')
    return new Error("Couldn't reach the matchmaking service. Check your internet connection.");
  return err instanceof Error ? err : new Error('Connection failed.');
}

function abortError(): Error {
  return new DOMException('Cancelled', 'AbortError');
}

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

function openPeer(id: string | undefined, signal: AbortSignal): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, PEER_OPTIONS) : new Peer(PEER_OPTIONS);
    const onAbort = () => {
      peer.destroy();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    peer.once('open', () => {
      signal.removeEventListener('abort', onAbort);
      resolve(peer);
    });
    peer.once('error', (err) => {
      signal.removeEventListener('abort', onAbort);
      peer.destroy();
      reject(err);
    });
  });
}

/** Opens a room and resolves once a guest connects. `onCode` fires as soon as the code is shareable. */
export async function hostRoom(onCode: (code: string) => void, signal: AbortSignal): Promise<Link> {
  let peer: Peer | undefined;
  let code = '';
  for (let attempt = 0; !peer; attempt++) {
    code = newCode();
    try {
      peer = await openPeer(ID_PREFIX + code, signal);
    } catch (err) {
      if ((err as { type?: string }).type !== 'unavailable-id' || attempt >= 5) throw isAbort(err) ? err : friendlyError(err);
    }
  }
  const host = peer;
  onCode(code);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      host.destroy();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    host.on('error', (err) => {
      // Lost contact with the broker before anyone joined: the code no longer works.
      if (!signal.aborted) {
        signal.removeEventListener('abort', onAbort);
        host.destroy();
        reject(friendlyError(err));
      }
    });
    let pending: DataConnection | undefined;
    host.on('connection', (conn) => {
      if (pending) {
        // Room is full: a third person with the code gets turned away.
        conn.on('open', () => conn.close());
        return;
      }
      pending = conn;
      // If this guest's network can't complete the link, reopen the room so they can retry.
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearTimeout(timer);
        if (pending === conn) pending = undefined;
        conn.close();
      };
      const timer = setTimeout(release, CONNECT_TIMEOUT_MS);
      conn.on('close', release);
      conn.on('error', release);
      conn.on('open', () => {
        clearTimeout(timer);
        conn.off('close', release);
        conn.off('error', release);
        signal.removeEventListener('abort', onAbort);
        host.removeAllListeners('error');
        resolve(new Link(host, conn));
      });
    });
  });
}

export async function joinRoom(code: string, signal: AbortSignal): Promise<Link> {
  let peer: Peer;
  try {
    peer = await openPeer(undefined, signal);
  } catch (err) {
    throw isAbort(err) ? err : friendlyError(err);
  }
  return new Promise((resolve, reject) => {
    const conn = peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
    const fail = (err: unknown) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      peer.destroy();
      reject(err);
    };
    const onAbort = () => fail(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => fail(new Error(DIRECT_FAILED)), CONNECT_TIMEOUT_MS);
    peer.once('error', (err) => fail(friendlyError(err)));
    conn.once('open', () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      peer.removeAllListeners('error');
      resolve(new Link(peer, conn));
    });
  });
}

/** An open connection to the other player. Messages are buffered until someone reads them. */
export class Link {
  private buffer: Msg[] = [];
  private listener?: (m: Msg) => void;
  closed = false;
  private lastHeard = performance.now();
  private readonly heartbeat: number;

  constructor(
    private readonly peer: Peer,
    private readonly conn: DataConnection,
  ) {
    conn.on('data', (data) => {
      this.lastHeard = performance.now();
      const m = data as Msg;
      if (m.t !== 'ping') this.push(m);
    });
    conn.on('close', () => this.close());
    conn.on('error', () => this.close());
    // Phones that lock or lose signal don't always close the channel cleanly, so watch for silence.
    this.heartbeat = window.setInterval(() => {
      if (performance.now() - this.lastHeard > SILENCE_MS) this.close();
      else this.send({ t: 'ping' });
    }, PING_MS);
    window.addEventListener('pagehide', this.close);
  }

  send(m: Msg): void {
    if (!this.closed && this.conn.open) this.conn.send(m);
  }

  /** Receives every message (including a final `bye`) until the returned function is called. */
  listen(fn: (m: Msg) => void): () => void {
    this.listener = fn;
    this.flush();
    return () => {
      if (this.listener === fn) this.listener = undefined;
    };
  }

  /** Waits for the next message of one of the given types, skipping stale ones. Throws on disconnect. */
  async next<T extends Msg['t']>(...types: T[]): Promise<Extract<Msg, { t: T }>> {
    for (;;) {
      const m = await new Promise<Msg>((resolve) => {
        const off = this.listen((msg) => {
          off();
          resolve(msg);
        });
      });
      if (m.t === 'bye') throw new Disconnected();
      if ((types as string[]).includes(m.t)) return m as Extract<Msg, { t: T }>;
    }
  }

  close = (): void => {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    window.removeEventListener('pagehide', this.close);
    this.conn.close();
    this.peer.destroy();
    this.push({ t: 'bye' });
  };

  private push(m: Msg): void {
    this.buffer.push(m);
    this.flush();
  }

  private flush(): void {
    while (this.listener && this.buffer.length) {
      const m = this.buffer[0];
      // `bye` stays queued so every later reader also learns the link is gone.
      if (m.t !== 'bye') this.buffer.shift();
      this.listener(m);
      if (m.t === 'bye') return;
    }
  }
}
