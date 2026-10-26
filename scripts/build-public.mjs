// Builds the static public site into ./dist (no Node server needed).
//   npm run fetch && npm run build:public
// scripts/public-policy.json decides which overlays (and their data files) are left
// out of the public site for data-licence reasons, and the credits shown in "About".
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const { ITEMS, dataUrl } = await import(path.join(ROOT, 'public/js/catalog.js'));
const policy = JSON.parse(await readFile(path.join(ROOT, 'scripts/public-policy.json'), 'utf8'));

const fail = (msg) => { console.error(`build-public: ${msg}`); process.exit(1); };

// Never publish a broken chart: core data must be present and fresh.
const meta = JSON.parse(await readFile(path.join(ROOT, 'data/meta.json'), 'utf8').catch(() => fail('no data/meta.json — run npm run fetch')));
const btc = JSON.parse(await readFile(path.join(ROOT, 'data/btc.json'), 'utf8').catch(() => fail('no data/btc.json')));
if (btc.length < 5000) fail(`btc.json has only ${btc.length} bars`);
const ageDays = (Date.now() - Date.parse(btc[btc.length - 1].t)) / 864e5;
if (ageDays > 3) fail(`newest BTC bar is ${ageDays.toFixed(1)} days old`);

const hidden = new Set(policy.hideItems || []);
for (const id of hidden) if (!ITEMS.some((i) => i.id === id)) fail(`public-policy hides unknown item "${id}"`);
const visible = ITEMS.filter((i) => !hidden.has(i.id));
const neededUrls = new Set(['/data/btc.json', '/data/meta.json', ...visible.flatMap((i) => i.needs.map(dataUrl))]);

await rm(DIST, { recursive: true, force: true });
await cp(path.join(ROOT, 'public'), DIST, { recursive: true });
await mkdir(path.join(DIST, 'vendor'), { recursive: true });
await cp(path.join(ROOT, 'node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs'), path.join(DIST, 'vendor/lightweight-charts.js'));
// Apache-2.0: ship the library's LICENSE and NOTICE with the bundled copy.
await cp(path.join(ROOT, 'node_modules/lightweight-charts/LICENSE'), path.join(DIST, 'vendor/lightweight-charts-LICENSE.txt'));
// NOTICE is not in the npm package; copied from the GitHub repo at v5.2.1.
await cp(path.join(ROOT, 'scripts/lightweight-charts-NOTICE.txt'), path.join(DIST, 'vendor/lightweight-charts-NOTICE.txt'));

// Copy only data files a visible overlay needs.
let copied = 0, skipped = [];
async function copyData(dir) {
  for (const ent of await readdir(path.join(ROOT, 'data', dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, ent.name);
    if (ent.isDirectory()) { await copyData(rel); continue; }
    const url = '/data/' + rel;
    if (!ent.name.endsWith('.json')) continue;
    if (!neededUrls.has(url)) { skipped.push(rel); continue; }
    await mkdir(path.join(DIST, 'data', dir), { recursive: true });
    await cp(path.join(ROOT, 'data', rel), path.join(DIST, 'data', rel));
    copied++;
  }
}
await copyData('');
// The public meta keeps only the timestamp, not the fetch report.
await writeFile(path.join(DIST, 'data/meta.json'), JSON.stringify({ fetchedAt: meta.fetchedAt }));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const head = [
  '<meta name="crows-mode" content="public">',
  `<meta name="crows-hide" content="${esc([...hidden].join(','))}">`,
  `<meta name="crows-sources" content="${esc(policy.sourcesHtml)}">`,
  '<meta name="description" content="Crows Chart by Crypto Crow: Bitcoin from 2010 to today with clickable overlays for halvings, QE/QT, rate moves, elections, wars and on-chain data.">',
  '<meta property="og:title" content="Crows Chart — Bitcoin cycles, macro and news overlays">',
  '<meta property="og:description" content="Turn on halvings, QE/QT, rate hikes, elections, wars and more, and see what BTC did before, during and after each one.">',
  '<meta property="og:url" content="https://chart.cryptocrow.io/">',
  '<link rel="canonical" href="https://chart.cryptocrow.io/">',
].join('\n  ');
const indexPath = path.join(DIST, 'index.html');
await writeFile(indexPath, (await readFile(indexPath, 'utf8')).replace('</head>', `  ${head}\n</head>`));

// Cloudflare Pages headers: data changes daily, code changes on deploy.
await writeFile(path.join(DIST, '_headers'), `/data/*
  Cache-Control: public, max-age=3600
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);

console.log(`dist/ built: ${visible.length} overlays public, ${hidden.size} hidden, ${copied} data files${skipped.length ? `, left out: ${skipped.join(', ')}` : ''}.`);
