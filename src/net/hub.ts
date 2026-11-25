import type { HubEvent, PhoneView } from './teams-protocol';

const CONNECT_TIMEOUT_MS = 3_000;
const RETRY_MS = 1_000;

export const NO_HUB =
  "Couldn't reach the game relay. Check your internet connection, or run the booth server (`npm run booth`) and open the game from that address.";

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(CODE_LENGTH)), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** The Cloudflare relay (relay/worker.ts). Its address only changes if the Worker or the account's workers.dev subdomain is renamed. */
const CLOUD_RELAY = 'wss://savanna-relay.hishamlegha.workers.dev';
/**
 * GitHub Pages uses the Cloudflare relay; the booth and dev servers use their own /ws (server/hub.ts) so they work offline.
 * VITE_RELAY_URL overrides it, e.g. to try the Cloudflare relay from `npm run dev`.
 */
export const RELAY: string | undefined =
  (import.meta.env.VITE_RELAY_URL as string | undefined) || (location.hostname.endsWith('.github.io') ? CLOUD_RELAY : undefined);
export const relayUrl = (room: string) =>
  `${RELAY ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`}/ws?room=${room}`;

/** The big screen's connection to the Team Battle relay (server/hub.ts). Reconnects if the socket drops. */
export class HubClient {
  onEvent: (e: HubEvent) => void = () => {};
  /** The relay restarted, so every phone connection id from before is gone. */
  onReconnect: () => void = () => {};
  private ws!: WebSocket;
  private closed = false;
  private connected = false;
  private retry = 0;

  private constructor(readonly room: string) {}

  /** Resolves once connected; rejects with NO_HUB if the relay isn't there. */
  static async connect(room: string): Promise<HubClient> {
    const hub = new HubClient(room);
    await hub.open();
    return hub;
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(relayUrl(this.room));
      const timer = setTimeout(() => ws.close(), CONNECT_TIMEOUT_MS);
      let opened = false;
      ws.onopen = () => {
        const reconnect = this.connected;
        opened = this.connected = true;
        clearTimeout(timer);
        if (reconnect) this.onReconnect();
        ws.send(JSON.stringify({ role: 'screen' }));
        resolve();
      };
      ws.onmessage = (e) => {
        let event: HubEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          return;
        }
        this.onEvent(event);
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        // Another big screen took over the room; reconnecting would just kick it off in turn, forever.
        if (e.reason === 'replaced') this.closed = true;
        if (!opened) reject(new Error(NO_HUB));
        // After the first connection, keep retrying (e.g. the booth server restarted). Phones keep their seats.
        if (this.connected && !this.closed) this.retry = window.setTimeout(() => this.open().catch(() => {}), RETRY_MS);
      };
      this.ws = ws;
    });
  }

  send(conn: number, view: PhoneView): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ to: conn, msg: view }));
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.retry);
    this.ws.close();
  }
}
