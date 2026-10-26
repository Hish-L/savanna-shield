import type { Server } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { attachHub, handleInfo } from './server/hub.ts';

// Runs the Team Battle relay inside `npm run dev` too, so phones on the same Wi-Fi can join.
const hub = (): Plugin => ({
  name: 'team-battle-hub',
  configureServer(server) {
    if (server.httpServer) attachHub(server.httpServer as Server);
    server.middlewares.use((req, res, next) => {
      if (req.url === '/play' || req.url === '/play/') req.url = '/play.html';
      if (!handleInfo(req, res)) next();
    });
  },
});

export default defineConfig({
  base: '/savanna-shield/',
  plugins: [hub()],
  server: { host: true },
  build: { rollupOptions: { input: { main: 'index.html', play: 'play.html' } } },
});
