import type { HubEvent, PhoneView } from './teams-protocol';

const CONNECT_TIMEOUT_MS = 3_000;
const RETRY_MS = 1_000;

export const NO_HUB =
  "Team Battle needs the booth server. Start the game with `npm run booth` (or `npm run dev`) and open it from that address.";

/** The big screen's connection to the Team Battle relay (server/hub.ts). Reconnects if the socket drops. */
export class HubClient {
  onEvent: (e: HubEvent) => void = () => {};
  /** The relay restarted, so every phone connection id from before is gone. */
  onReconnect: () => void = () => {};
  private ws!: WebSocket;
  private closed = false;
  private connected = false;
  private retry = 0;

  private constructor() {}

  /** Resolves once connected; rejects with NO_HUB if the relay isn't there. */
  static async connect(): Promise<HubClient> {
    const hub = new HubClient();
    await hub.open();
    return hub;
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
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
      ws.onclose = () => {
        clearTimeout(timer);
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
