import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { GameService } from './service.js';

export function createGameServer({ service = new GameService({publicMatchmaking:process.env.PUBLIC_MATCHMAKING === 'true'}), root = fileURLToPath(new URL('../public/', import.meta.url)), ticker = true, clientConfig = null } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true })); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : `window.GAME_CONFIG = ${JSON.stringify({backendUrl:null,platform:'local',...clientConfig,publicMatchmaking:service.publicMatchmaking})};`); return;
    }
    let relative; try { relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); } catch { res.writeHead(400); res.end(); return; }
    const file = path.resolve(root, `.${relative}`);
    if (!file.startsWith(path.resolve(root) + path.sep) || relative.includes('\\')) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(file);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' }[path.extname(file)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/play') { socket.destroy(); return; }
    // Local browser origin by default. Deployment can provide explicit allowed origins.
    const origin = req.headers.origin;
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? [`http://${req.headers.host}`, `https://${req.headers.host}`];
    if (origin && !allowed.includes(origin)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const connection = { send: text => { if (ws.readyState === 1) ws.send(text); }, close: (code, reason) => ws.close(code, reason) };
    service.connect(connection);
    ws.on('message', data => {
      let message; try { message = JSON.parse(data.toString()); } catch { ws.close(1008, 'Invalid request'); return; }
      try { service.handle(connection, message); } catch { ws.close(1011, 'Please reconnect'); }
    });
    ws.on('close', () => service.disconnect(connection)); ws.on('error', () => {});
  });
  const timer = ticker ? setInterval(() => service.tick(), 250) : null;
  const close = () => new Promise(resolve => { if (timer) clearInterval(timer); for (const client of wss.clients) client.terminate(); wss.close(); server.close(resolve); });
  return { server, service, close };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = createGameServer(); const port = Number(process.env.PORT ?? 3000);
  game.server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Use the running game server.` : error.message);
    process.exit(1);
  });
  game.server.listen(port, process.env.HOST ?? '0.0.0.0', () => {
    console.log(`Local: http://localhost:${game.server.address().port}`);
    console.log('Phone and computer players share this server. Use the computer network address on your phone.');
  });
  process.on('SIGINT', async () => { await game.close(); process.exit(0); });
}
