import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';

// Team Battle relay. The big screen runs the game; this only passes messages between it and the
// phones, so no game rules live here. Wire format (JSON):
//   first message from any socket: { role: 'screen' | 'phone' }
//   phone → hub → screen:           { from: id, msg }   (hub wraps whatever the phone sent)
//   screen → hub → phone:           { to: id, msg }     (hub unwraps and sends msg)
//   hub → screen:                   { joined: id } | { left: id }
const PING_MS = 5_000;
const MAX_BYTES = 4_096;

type Alive = WebSocket & { alive?: boolean };

export function attachHub(server: Server): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BYTES });
  // Only claim /ws so other upgrade handlers (Vite's HMR socket in dev) keep working.
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  let screen: WebSocket | undefined;
  const phones = new Map<number, WebSocket>();
  let nextId = 1;

  const send = (ws: WebSocket | undefined, payload: unknown) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  };
  const toScreen = (payload: unknown) => send(screen, payload);

  wss.on('connection', (ws: Alive) => {
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    let role: 'screen' | 'phone' | undefined;
    let id = 0;

    ws.on('message', (raw) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!data || typeof data !== 'object') return;
      if (!role) {
        if (data.role === 'screen') {
          role = 'screen';
          // A refreshed big screen replaces the old one.
          screen?.close();
          screen = ws;
          for (const phoneId of phones.keys()) toScreen({ joined: phoneId });
        } else if (data.role === 'phone') {
          role = 'phone';
          id = nextId++;
          phones.set(id, ws);
          toScreen({ joined: id });
        }
        return;
      }
      if (role === 'phone') toScreen({ from: id, msg: data });
      else if (ws === screen && typeof data.to === 'number') send(phones.get(data.to), data.msg);
    });

    ws.on('close', () => {
      if (role === 'phone') {
        phones.delete(id);
        toScreen({ left: id });
      } else if (ws === screen) screen = undefined;
    });
  });

  // Locked phones don't always close their socket, so drop anything that stops answering pings.
  const timer = setInterval(() => {
    for (const ws of wss.clients as Set<Alive>) {
      if (!ws.alive) ws.terminate();
      else {
        ws.alive = false;
        ws.ping();
      }
    }
  }, PING_MS);
  wss.on('close', () => clearInterval(timer));
}

/** The address phones on the same Wi-Fi should use to reach this machine. */
export function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

/** Answers GET /api/info with the phone join URL. Returns false for any other request. */
export function handleInfo(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url !== '/api/info') return false;
  const port = new URL(`http://${req.headers.host ?? 'localhost'}`).port || '80';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ playUrl: `http://${lanAddress()}:${port}/play` }));
  return true;
}
