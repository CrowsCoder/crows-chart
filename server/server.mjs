// Local server: serves the app + data, and relays commands from Claude
// (bin/chart.mjs) to the open browser tab over Server-Sent Events.
import http from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchAll, dataAgeHours } from './fetch-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5178);
const HOST = '127.0.0.1';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const clients = new Set();
let lastState = null;
let fetching = null;

function broadcast(msg) {
  const line = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(line);
  return clients.size;
}

function refreshData() {
  if (!fetching) {
    fetching = fetchAll((l) => console.log(l)).then((report) => { broadcast({ cmd: 'data-updated' }); return report; }).finally(() => { fetching = null; });
  }
  return fetching;
}

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function serveFile(res, file) {
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const p = decodeURIComponent(url.pathname);
  // Only this app may talk to the API: blocks other websites and DNS rebinding.
  const okHost = req.headers.host === `${HOST}:${PORT}` || req.headers.host === `localhost:${PORT}`;
  const origin = req.headers.origin;
  const okOrigin = !origin || origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`;
  if (p.startsWith('/api/') && (!okHost || !okOrigin)) return send(res, 403, { error: 'Forbidden' });
  if (req.method === 'POST' && p !== '/api/refresh' && !String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'JSON only' });
  try {
    if (p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clients.delete(res); clearInterval(ping); });
      return;
    }
    if (p === '/api/command' && req.method === 'POST') {
      const msg = await body(req);
      const n = broadcast(msg);
      return send(res, n ? 200 : 409, { delivered: n, ...(n ? {} : { error: 'No chart tab open. Open http://127.0.0.1:' + PORT }) });
    }
    if (p === '/api/state' && req.method === 'POST') { lastState = { ...(await body(req)), at: new Date().toISOString() }; return send(res, 200, { ok: true }); }
    if (p === '/api/state') return send(res, 200, lastState || { error: 'No state yet. Is the chart tab open?' });
    if (p === '/api/snapshot' && req.method === 'POST') {
      const { png } = await body(req);
      const b64 = String(png || '').replace(/^data:image\/png;base64,/, '');
      await mkdir(path.join(ROOT, 'screenshots'), { recursive: true });
      await writeFile(path.join(ROOT, 'screenshots/latest.png'), Buffer.from(b64, 'base64'));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/refresh' && req.method === 'POST') { const report = await refreshData(); return send(res, 200, report); }

    if (p === '/vendor/lightweight-charts.js') return serveFile(res, path.join(ROOT, 'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs'));
    if (p.startsWith('/data/')) return serveFile(res, path.join(ROOT, 'data', path.normalize(p.slice(6)).replace(/^(\.\.[/\\])+/, '')));
    const rel = p === '/' ? 'index.html' : path.normalize(p).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '');
    return serveFile(res, path.join(ROOT, 'public', rel));
  } catch (err) {
    send(res, 500, { error: err.message });
  }
});

const age = await dataAgeHours();
if (age === Infinity) {
  console.log('No data yet. Downloading first (about 15 seconds)...');
  await refreshData();
} else if (age > 12) {
  console.log(`Data is ${age.toFixed(0)}h old. Refreshing in the background.`);
  refreshData();
}

server.listen(PORT, HOST, () => console.log(`Crows Chart running: http://${HOST}:${PORT}`));
