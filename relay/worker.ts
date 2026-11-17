// Team Battle relay on Cloudflare (Worker + one Durable Object per room). Same wire format as
// server/hub.ts, so the game and phones don't care which one they talk to:
//   first message from any socket: { role: 'screen' | 'phone' }
//   phone → relay → screen:         { from: id, msg }
//   screen → relay → phone:         { to: id, msg }
//   relay → screen:                 { joined: id } | { left: id }
// Uses the WebSocket Hibernation API, so a room only costs anything while it handles a message.
// ponytail: no ping frames (the runtime can't send them); relies on close events plus the phones
// resending hello when they wake. Add an app-level ping + alarm if dead phones linger.
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Comma-separated origins allowed to connect (the GitHub Pages site). localhost is always allowed. */
  ALLOWED_ORIGINS: string;
}

type Tag = { role?: 'screen' | 'phone'; id?: number };

const MAX_BYTES = 4_096;
const ROOM = /^[A-Z0-9]{4}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') return new Response('Savannah Shield relay', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const origin = req.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    if (!allowed.includes(origin) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return new Response('Forbidden', { status: 403 });
    const room = url.searchParams.get('room') ?? '';
    if (!ROOM.test(room)) return new Response('Bad room', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
  },
};

export class Room extends DurableObject<Env> {
  async fetch(): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({} satisfies Tag);
    return new Response(null, { status: 101, webSocket: client });
  }

  private tag(ws: WebSocket): Tag {
    return (ws.deserializeAttachment() as Tag | null) ?? {};
  }

  private screen(): WebSocket | undefined {
    return this.ctx.getWebSockets().find((ws) => this.tag(ws).role === 'screen');
  }

  private phones(): [number, WebSocket][] {
    return this.ctx
      .getWebSockets()
      .map((ws) => [this.tag(ws), ws] as const)
      .filter(([t]) => t.role === 'phone')
      .map(([t, ws]) => [t.id!, ws]);
  }

  private send(ws: WebSocket | undefined, payload: unknown): void {
    try {
      ws?.send(JSON.stringify(payload));
    } catch {
      // Socket already closing.
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;
    const tag = this.tag(ws);
    if (!tag.role) {
      if (data.role === 'screen') {
        // A refreshed big screen replaces the old one.
        const old = this.screen();
        if (old && old !== ws) old.close(1000, 'replaced');
        ws.serializeAttachment({ role: 'screen' } satisfies Tag);
        for (const [id] of this.phones()) this.send(ws, { joined: id });
      } else if (data.role === 'phone') {
        const id = ((await this.ctx.storage.get<number>('nextId')) ?? 1);
        await this.ctx.storage.put('nextId', id + 1);
        ws.serializeAttachment({ role: 'phone', id } satisfies Tag);
        this.send(this.screen(), { joined: id });
      }
      return;
    }
    if (tag.role === 'phone') this.send(this.screen(), { from: tag.id, msg: data });
    else if (typeof data.to === 'number') this.send(this.phones().find(([id]) => id === data.to)?.[1], data.msg);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const tag = this.tag(ws);
    if (tag.role === 'phone') this.send(this.screen(), { left: tag.id });
    // Empty room: forget the id counter so storage doesn't grow.
    if (this.ctx.getWebSockets().every((s) => s === ws)) await this.ctx.storage.deleteAll();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}
