import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { attachHub, handleInfo, lanAddress } from './hub.ts';

// Booth server for Team Battle: serves the built game (dist/) and relays messages between the big
// screen and the phones. Run with `npm run booth`; everything stays on the local network.
const PORT = Number(process.env.PORT ?? 8080);
const ROOT = resolve(import.meta.dirname, '../dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('No build found in dist/. Run `npm run booth` (it builds first).');
  process.exit(1);
}

const server = createServer((req, res) => {
  if (handleInfo(req, res)) return;
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path === '/play' || path === '/play/' ? join(ROOT, 'play.html') : join(ROOT, normalize(path));
  // Anything outside dist/ or missing falls back to the big-screen page.
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});
attachHub(server);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nSavannah Shield booth is running.`);
  console.log(`  Big screen: http://localhost:${PORT}  (press 5 for Team Battle)`);
  console.log(`  Phones:     http://${lanAddress()}:${PORT}/play  (or scan the QR code)\n`);
});
