# Crows Chart

Local BTC chart (TradingView Lightweight Charts v5) with ~87 clickable overlays:
cycles, QE/QT, rates, elections, wars, crypto news, on-chain, price models.
Free data only. Answer users in plain words, short.

## Run
- `npm start` (or double-click `Start Crows Chart.command`) → http://127.0.0.1:5178
- Data downloads to `data/` on first start and refreshes when older than 12h.
- `npm run fetch` forces a refresh.

## Answering chart questions — SHOW, don't just tell
The server relays commands to the user's open tab. Use `node bin/chart.mjs`:
1. `list [word]` → find overlay ids. `state` → what he is looking at now.
2. Get numbers first: `stats <id> [days]` (BTC % before/during/after each instance; works without the browser).
3. Show it: `only <ids...>`, `range <from> <to>`, `tf D|W|M`, `window <days>`, `compare <id>`.
4. Point at things: `mark <date> "<label>"`, `box <from> <to> "<label>" [color] [top] [bottom]`.
5. Explain on the chart: `note "<title>" "<2–5 short lines>"`. Then `snap` and Read
   `screenshots/latest.png` to check it looks right before answering.
6. `clear-notes` before a new question.
Always state sample size (e.g. "only 4 midterms") and that correlation is not cause.

## Code map
- `public/js/catalog.js` — every panel item (id, group, grade, build()). Add items here.
- `public/js/events-data.js` — hand-curated dates. Fact-checked 2026-10-25.
- After changing catalog/events: `npm run docs` (README table + docs/OVERLAYS.md).
- `public/js/calc.js` — pure math (shared with the CLI).
- `public/js/overlay-primitive.js` — draws event lines/zones. LWC `logicalToCoordinate`
  only takes whole indexes → we interpolate. Never add series points that are not on a
  BTC bar time (shifts every index) — app.js filters them.
- `server/server.mjs` — static + SSE bridge (`/api/command`, `/api/state`, `/api/snapshot`).
- `server/fetch-data.mjs` — Bitstamp candles (2011+), CoinMetrics community (price 2010+,
  MVRV, supply, hash), FRED CSV, blockchain.com difficulty, alternative.me F&G, DefiLlama.
- Binance/Bybit are geo-blocked from the US (451/403): no funding/OI history.
