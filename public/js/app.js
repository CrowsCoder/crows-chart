import {
  createChart, CandlestickSeries, LineSeries, HistogramSeries,
  PriceScaleMode, LineStyle, LineType, CrosshairMode,
} from '/vendor/lightweight-charts.js';
import { GROUPS, ITEMS, ITEM_BY_ID, UNAVAILABLE, dataUrl, compareInstances } from './catalog.js';
import { resampleCandles, resampleSeries, compareStats, addDays, isDay } from './calc.js';
import { DateMapper, OverlayPrimitive } from './overlay-primitive.js';

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ch.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ch.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

const S = {
  tf: store.get('tf', 'D'),
  log: store.get('log', true),
  windowDays: store.get('windowDays', 180),
  active: store.get('active', []),
  compareId: store.get('compareId', null),
};

const DATA = {};
const BUILT = {};
const RENDER = {};
let bars = [];       // daily candles
let viewBars = [];   // candles at current timeframe
let barTimes = new Set();

// ───────── formatting
function fmtPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  const a = Math.abs(p);
  if (a >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return p.toPrecision(3);
}
function fmtNum(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(3);
}
const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const pctCls = (v) => (v == null ? '' : v >= 0 ? 'pos' : 'neg');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ───────── chart
const chartEl = $('#chart');
const chart = createChart(chartEl, {
  autoSize: true,
  layout: { background: { color: '#131722' }, textColor: '#b2b5be', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', panes: { separatorColor: '#2a2e39', separatorHoverColor: '#f7931a', enableResize: true } },
  grid: { vertLines: { color: '#1e2230' }, horzLines: { color: '#1e2230' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#2a2e39', mode: S.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
  timeScale: { borderColor: '#2a2e39', rightOffset: 12, minBarSpacing: 0.02, timeVisible: false },
  localization: { priceFormatter: fmtPrice },
});
const candles = chart.addSeries(CandlestickSeries, {
  upColor: '#26a69a', downColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350', borderVisible: false,
  priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.00001 },
});
const mapper = new DateMapper();
const overlay = new OverlayPrimitive(mapper);
candles.attachPrimitive(overlay);
window.__chartHelper = { chart, mapper, overlay, S, RENDER, activate: (id) => activate(id), deactivate: (id) => deactivate(id), setTimeframe: (tf) => setTimeframe(tf) }; // for debugging in the console

function candleData() {
  return viewBars.map((b) => (b.s
    ? { time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, color: '#5d6170', wickColor: '#5d6170' }
    : { time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
}

function setTimeframe(tf, keepRange = true) {
  const range = keepRange ? visibleDates() : null;
  S.tf = tf; store.set('tf', tf);
  document.querySelectorAll('.tf button').forEach((b) => b.classList.toggle('on', b.dataset.tf === tf));
  viewBars = resampleCandles(bars, tf);
  mapper.setBars(viewBars.map((b) => b.t), tf);
  barTimes = new Set(mapper.times);
  for (const id of Object.keys(RENDER)) unrender(id);
  candles.setData(candleData());
  for (const id of S.active) if (BUILT[id]) render(id);
  if (range) setRange(range.from, range.to); else chart.timeScale().fitContent();
  renderDrawer(); updateLegend(); pushState();
}

function setLog(on) {
  S.log = on; store.set('log', on);
  $('#logBtn').classList.toggle('on', on);
  chart.priceScale('right').applyOptions({ mode: on ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });
  pushState();
}

let pendingRange = null; // a hidden tab applies zoom only on its next paint; report what was asked for
function setRange(from, to) {
  const a = mapper.logical(from, 0), b = mapper.logical(to, 1);
  if (a == null || b == null) return;
  pendingRange = { from, to };
  chart.timeScale().setVisibleLogicalRange({ from: Math.floor(a), to: Math.ceil(b) });
}

function visibleDates() {
  const r = chart.timeScale().getVisibleLogicalRange();
  if (!r || !viewBars.length) return null;
  const at = (l) => Math.max(0, Math.min(viewBars.length - 1, Math.round(l)));
  const lastDay = bars[bars.length - 1].t;
  const endOf = (i) => (i + 1 < viewBars.length ? addDays(viewBars[i + 1].t, -1) : lastDay);
  // Past the last bar (right offset) = keep showing the newest day.
  return { from: viewBars[at(r.from)].t, to: r.to >= viewBars.length - 1 ? lastDay : endOf(at(r.to)) };
}

// ───────── items
async function loadNeeds(item) {
  await Promise.all(item.needs.filter((k) => !DATA[k]).map(async (k) => {
    const res = await fetch(dataUrl(k));
    if (!res.ok) throw new Error(`Data ${k} missing (${res.status}). Click "Refresh data".`);
    DATA[k] = await res.json();
  }));
}
const ctx = { get: (k) => DATA[k], get bars() { return bars; } };

async function activate(id, { quiet } = {}) {
  const item = ITEM_BY_ID[id];
  if (!item) return false;
  if (!S.active.includes(id)) S.active.push(id);
  const el = document.querySelector(`.item[data-id="${id}"]`);
  el?.classList.add('loading', 'on');
  try {
    if (!bars.length) throw new Error('Chart data still loading. Try again in a second.');
    await loadNeeds(item);
    if (!S.active.includes(id)) return false; // turned off while loading
    BUILT[id] ??= item.build(ctx);
    if (RENDER[id]) unrender(id);
    render(id);
    if (compareInstances(BUILT[id]).length) { S.compareId = id; store.set('compareId', id); }
  } catch (err) {
    console.error(err);
    S.active = S.active.filter((x) => x !== id);
    el?.classList.remove('on');
    if (!quiet) showNote('Could not load ' + item.name, err.message);
  } finally {
    el?.classList.remove('loading');
  }
  afterChange();
  return true;
}

function deactivate(id) {
  S.active = S.active.filter((x) => x !== id);
  unrender(id);
  document.querySelector(`.item[data-id="${id}"]`)?.classList.remove('on');
  afterChange();
}

function afterChange() {
  store.set('active', S.active);
  $('#activeCount').textContent = `${S.active.length} on`;
  document.querySelectorAll('.group').forEach((g) => {
    const n = [...g.querySelectorAll('.item.on')].length;
    g.querySelector('.count').textContent = n ? `${n} on` : '';
  });
  overlay.update(); renderDrawer(); updateLegend(); pushState();
}

function render(id) {
  const item = ITEM_BY_ID[id], b = BUILT[id];
  const R = { series: [], layer: null };
  RENDER[id] = R; // set first so a failure part-way can still be cleaned up
  if (b.events?.length || b.zones?.length) {
    R.layer = { id, color: item.color, events: b.events || [], zones: b.zones || [], windowDays: b.events?.length ? S.windowDays : 0 };
    overlay.layers.push(R.layer);
  }
  let paneIndex = null;
  for (const [i, line] of (b.lines || []).entries()) {
    const color = line.color || item.color;
    const common = { color, priceLineVisible: false, lastValueVisible: true, title: line.name, crosshairMarkerVisible: line.type !== 'histogram' };
    const fmt = line.format === 'usd' || line.target === 'price' ? fmtPrice : line.format === 'pct' ? (v) => v.toFixed(2) + '%' : fmtNum;
    const opts = { ...common, priceFormat: { type: 'custom', formatter: fmt, minMove: 0.000001 } };
    if (line.type !== 'histogram') Object.assign(opts, { lineWidth: line.width || (line.target === 'pane' ? 1.5 : 1.5), lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid, lineType: line.type === 'step' ? LineType.WithSteps : LineType.Simple });
    let pIdx = 0;
    if (line.target === 'overlay') opts.priceScaleId = 'ov-' + id;
    if (line.target === 'pane') pIdx = paneIndex ?? chart.panes().length;
    const def = line.type === 'histogram' ? HistogramSeries : LineSeries;
    const s = chart.addSeries(def, opts, pIdx);
    // Only keep points that land on a BTC bar: extra times would shift every bar index.
    s.setData(resampleSeries(line.points, S.tf, line.agg).filter((pt) => barTimes.has(pt.time)));
    if (line.target === 'overlay') s.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 }, mode: line.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });
    if (line.target === 'pane') {
      if (paneIndex == null) { paneIndex = s.getPane().paneIndex(); s.getPane().setStretchFactor(1); chart.panes()[0].setStretchFactor(3); }
      s.priceScale().applyOptions({ mode: line.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal, scaleMargins: { top: 0.1, bottom: 0.08 } });
    }
    if (i === 0) for (const lv of line.levels || []) s.createPriceLine({ price: lv, color: '#5d6170', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
    R.series.push({ s, line, color });
  }
}

function unrender(id) {
  const R = RENDER[id]; if (!R) return;
  for (const { s } of R.series) chart.removeSeries(s);
  if (R.layer) overlay.layers = overlay.layers.filter((l) => l !== R.layer);
  delete RENDER[id];
  overlay.update();
}

function setWindow(days) {
  S.windowDays = days; store.set('windowDays', days);
  $('#winSlider').value = days; $('#winVal').textContent = days + 'd';
  for (const L of overlay.layers) if (L.events.length) L.windowDays = days;
  overlay.update(); renderDrawer(); pushState();
}

// ───────── left panel
function buildPanel() {
  const open = store.get('openGroups', ['cycle', 'rates', 'politics', 'wars']);
  const html = GROUPS.map((g) => {
    const items = ITEMS.filter((i) => i.group === g.id).map((i) => `
      <div class="item${S.active.includes(i.id) ? ' on' : ''}" data-id="${i.id}" style="--c:${i.color}" title="${esc(i.desc)}">
        <span class="dot"></span><span class="txt"><span class="name">${esc(i.name)}</span><span class="desc">${esc(i.desc)}</span></span>
        <span class="grade ${i.grade}" title="Evidence grade">${i.grade}</span>
      </div>`).join('');
    const na = UNAVAILABLE.filter((u) => u.group === g.id).map((u) => `
      <div class="item na" title="${esc(u.why)}"><span class="dot" style="--c:#50535e"></span><span class="txt"><span class="name">${esc(u.name)}</span><span class="desc">${esc(u.why)}</span></span><span class="grade">paid</span></div>`).join('');
    return `<details class="group" data-g="${g.id}" ${open.includes(g.id) ? 'open' : ''}><summary>${esc(g.name)}<span class="count"></span></summary>${items}${na}</details>`;
  }).join('');
  $('#groups').innerHTML = html;
  $('#groups').addEventListener('click', (e) => {
    const el = e.target.closest('.item[data-id]'); if (!el) return;
    const id = el.dataset.id;
    S.active.includes(id) ? deactivate(id) : activate(id);
  });
  $('#groups').addEventListener('toggle', () => {
    store.set('openGroups', [...document.querySelectorAll('.group[open]')].map((g) => g.dataset.g));
  }, true);
  $('#search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.group').forEach((g) => {
      let any = false;
      g.querySelectorAll('.item').forEach((it) => { const hit = !q || it.textContent.toLowerCase().includes(q); it.hidden = !hit; any ||= hit; });
      g.hidden = !any; if (q) g.open = true;
    });
  });
  $('#clearAll').addEventListener('click', () => { [...S.active].forEach(deactivate); });
}

// ───────── legend + tooltip
const legend = $('#legend'), tooltip = $('#tooltip');
function updateLegend(param) {
  const d = param?.seriesData?.get(candles) || (viewBars.length && (() => { const b = viewBars[viewBars.length - 1]; return { open: b.o, high: b.h, low: b.l, close: b.c }; })());
  const t = param?.time || viewBars[viewBars.length - 1]?.t;
  const bar = viewBars.find((b) => b.t === t);
  const ch = d ? (d.close / d.open - 1) * 100 : null;
  let html = `<div class="row"><span class="sym">BTC/USD · ${S.tf === 'D' ? '1D' : S.tf === 'W' ? '1W' : '1M'}</span>` +
    (d ? `<span class="lv">${t || ''}</span> O <b>${fmtPrice(d.open)}</b> H <b>${fmtPrice(d.high)}</b> L <b>${fmtPrice(d.low)}</b> C <b>${fmtPrice(d.close)}</b> <span class="${pctCls(ch)}">${fmtPct(ch)}</span>` : '') +
    (bar?.s ? ' <span class="muted">(daily price only, no real candle)</span>' : '') + '</div>';
  for (const id of S.active) {
    const R = RENDER[id]; if (!R?.series.length) continue;
    const vals = R.series.map(({ s, line, color }) => {
      const v = param?.seriesData?.get(s)?.value;
      return `<span class="lv" style="color:${color}">${esc(line.name)} ${v == null ? '' : esc(s.options().priceFormat.formatter(v))}</span>`;
    }).join('');
    html += `<div class="row">${vals}</div>`;
  }
  legend.innerHTML = html;
}

chart.subscribeCrosshairMove((param) => {
  updateLegend(param);
  if (!param.point || param.paneIndex > 0) { tooltip.hidden = true; return; }
  const hits = overlay.hitTest(param.point.x);
  if (!hits.length) { tooltip.hidden = true; return; }
  const rows = hits.slice(0, 8).map((h) => {
    const it = ITEM_BY_ID[h.item.id];
    if (h.e) return `<div class="t-row" style="--c:${it.color}"><b>${esc(h.e.label)}</b> · ${h.e.d}${h.e.note ? `<div class="t-note">${esc(h.e.note)}</div>` : ''}</div>`;
    return `<div class="t-row" style="--c:${it.color}"><b>${esc(h.z.label)}</b> · ${h.z.from} → ${h.z.to || 'today'}${h.z.note ? `<div class="t-note">${esc(h.z.note)}</div>` : ''}</div>`;
  }).join('') + (hits.length > 8 ? `<div class="t-note">+${hits.length - 8} more</div>` : '');
  tooltip.innerHTML = rows; tooltip.hidden = false;
  const w = chartEl.clientWidth;
  tooltip.style.left = Math.min(param.point.x + 16, w - 350) + 'px';
  tooltip.style.top = Math.max(param.point.y + 16, 40) + 'px';
});
chart.timeScale().subscribeVisibleLogicalRangeChange(() => { pendingRange = null; pushState(); });

// ───────── compare drawer
function renderDrawer() {
  if (!bars.length) return;
  const ids = S.active.filter((id) => BUILT[id] && compareInstances(BUILT[id]).length);
  if (!ids.includes(S.compareId)) S.compareId = ids[ids.length - 1] || null;
  $('#drawerTabs').innerHTML = ids.map((id) => `<button data-id="${id}" class="${id === S.compareId ? 'on' : ''}">${esc(ITEM_BY_ID[id].name)}</button>`).join('');
  const body = $('#drawerBody');
  if (!S.compareId) { body.innerHTML = '<p class="muted">Turn on an event or period overlay to see BTC\'s % move before, during and after each one.</p>'; return; }
  const W = S.windowDays || 90;
  const inst = compareInstances(BUILT[S.compareId]);
  const st = compareStats(bars, inst, W);
  const hasDuring = st.rows.some((r) => r.during != null);
  const row = (r) => `<tr data-from="${r.start}" data-to="${r.end}"><td>${esc(r.label)}</td><td>${r.start}${r.end !== r.start ? ' → ' + r.end : ''}</td><td>${r.future ? 'future' : '$' + fmtPrice(r.price)}</td>` +
    `<td class="${pctCls(r.before)}">${fmtPct(r.before)}</td>${hasDuring ? `<td class="${pctCls(r.during)}">${fmtPct(r.during)}${r.ongoing ? ' <span class="muted">so far</span>' : ''}</td>` : ''}<td class="${pctCls(r.after)}">${fmtPct(r.after)}</td></tr>`;
  body.innerHTML = `<p class="cmp-info">BTC % change ${W} days before → start${hasDuring ? ', start → end' : ''}, and end → ${W} days after. Change the window with the Before/after slider. Click a row to zoom.</p>
    <p class="cmp-info">Future and still-running rows are not in the average or median.</p>
    <table class="cmp"><thead><tr><th>${esc(ITEM_BY_ID[S.compareId].name)}</th><th>Date</th><th>BTC</th><th>${W}d before</th>${hasDuring ? '<th>During</th>' : ''}<th>${W}d after</th></tr></thead>
    <tbody>${st.rows.map(row).join('')}</tbody>
    <tfoot><tr><td>Average</td><td></td><td></td><td class="${pctCls(st.avg.before)}">${fmtPct(st.avg.before)}</td>${hasDuring ? `<td class="${pctCls(st.avg.during)}">${fmtPct(st.avg.during)}</td>` : ''}<td class="${pctCls(st.avg.after)}">${fmtPct(st.avg.after)}</td></tr>
    <tr><td>Median</td><td></td><td></td><td class="${pctCls(st.med.before)}">${fmtPct(st.med.before)}</td>${hasDuring ? `<td class="${pctCls(st.med.during)}">${fmtPct(st.med.during)}</td>` : ''}<td class="${pctCls(st.med.after)}">${fmtPct(st.med.after)}</td></tr></tfoot></table>`;
}
$('#drawerTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  S.compareId = b.dataset.id; store.set('compareId', S.compareId); renderDrawer();
});
$('#drawerBody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-from]'); if (!tr) return;
  const pad = Math.max(30, Math.round((S.windowDays || 90) * 1.3));
  setRange(addDays(tr.dataset.from, -pad), addDays(tr.dataset.to, pad));
});
$('#drawerToggle').addEventListener('click', () => {
  const d = $('#drawer'); d.classList.toggle('collapsed');
  $('#drawerToggle').textContent = d.classList.contains('collapsed') ? 'Show' : 'Hide';
  store.set('drawerCollapsed', d.classList.contains('collapsed'));
});

// ───────── resizers (panel width, drawer height)
function dragResize(handle, onMove, key) {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault(); handle.classList.add('drag'); handle.setPointerCapture(e.pointerId);
    const move = (ev) => onMove(ev);
    const up = () => { handle.classList.remove('drag'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); store.set(key, key === 'panelW' ? $('#panel').offsetWidth : $('#drawer').offsetHeight); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  });
}
dragResize($('#panelResizer'), (ev) => { $('#panel').style.width = Math.max(200, Math.min(640, ev.clientX)) + 'px'; }, 'panelW');
dragResize($('#drawerResizer'), (ev) => {
  const col = document.querySelector('.chart-col').getBoundingClientRect();
  $('#drawer').classList.remove('collapsed'); $('#drawerToggle').textContent = 'Hide';
  $('#drawer').style.height = Math.max(34, Math.min(col.height - 160, col.bottom - ev.clientY)) + 'px';
}, 'drawerH');

// ───────── Claude link (Server-Sent Events from bin/chart.mjs)
const note = $('#note');
function showNote(title, text) {
  $('#noteTitle').textContent = title || 'Claude';
  $('#noteBody').textContent = text || '';
  note.hidden = false;
}
$('#noteClose').addEventListener('click', () => { note.hidden = true; });

let stateTimer = null;
function pushState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    const visible = pendingRange || visibleDates();
    store.set('range', visible);
    const body = { tf: S.tf, log: S.log, windowDays: S.windowDays, active: S.active, compareId: S.compareId, visible, lastBar: bars[bars.length - 1]?.t, annotations: overlay.notes };
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  }, 300);
}

async function handleCommand(m) {
  const ids = (m.ids || []).filter((id) => ITEM_BY_ID[id]);
  const badDate = ['d', 'from', 'to'].find((k) => m[k] != null && !isDay(m[k]));
  if (badDate) { console.warn('Bad date in command', m); return; }
  switch (m.cmd) {
    case 'on': for (const id of ids) if (!S.active.includes(id)) await activate(id); break;
    case 'off': ids.forEach(deactivate); break;
    case 'only': for (const id of [...S.active]) if (!ids.includes(id)) deactivate(id); for (const id of ids) if (!S.active.includes(id)) await activate(id); break;
    case 'clear': [...S.active].forEach(deactivate); break;
    case 'range': setRange(m.from, m.to || bars[bars.length - 1].t); break;
    case 'fit': pendingRange = null; chart.timeScale().fitContent(); break;
    case 'tf': if (['D', 'W', 'M'].includes(m.tf)) setTimeframe(m.tf); break;
    case 'log': setLog(!!m.on); break;
    case 'window': setWindow(Math.max(0, Math.min(730, Number(m.days) || 0))); break;
    case 'compare': if (ids[0]) { if (!S.active.includes(ids[0])) await activate(ids[0]); S.compareId = ids[0]; renderDrawer(); } break;
    case 'note': showNote(m.title, m.text); break;
    case 'mark': overlay.notes.marks.push({ d: m.d, label: m.label, color: m.color }); overlay.update(); break;
    case 'box': overlay.notes.boxes.push({ from: m.from, to: m.to, label: m.label, color: m.color, top: m.top, bottom: m.bottom }); overlay.update(); break;
    case 'clear-annotations': overlay.notes = { marks: [], boxes: [] }; note.hidden = true; overlay.update(); break;
    case 'snap': {
      const canvas = chart.takeScreenshot(true);
      await fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ png: canvas.toDataURL('image/png') }) });
      break;
    }
    case 'data-updated': location.reload(); return;
    default: console.warn('Unknown command', m);
  }
  pushState();
}

function connectBridge() {
  const es = new EventSource('/api/stream');
  const dot = $('#bridge');
  es.onopen = () => { dot.classList.add('live'); dot.title = 'Claude link: connected'; pushState(); };
  es.onerror = () => { dot.classList.remove('live'); dot.title = 'Claude link: reconnecting…'; };
  let queue = Promise.resolve();
  es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } queue = queue.then(() => handleCommand(m)).catch((err) => console.error(err)); };
}

// ───────── top bar
document.querySelectorAll('.tf button').forEach((b) => b.addEventListener('click', () => setTimeframe(b.dataset.tf)));
$('#logBtn').addEventListener('click', () => setLog(!S.log));
$('#fitBtn').addEventListener('click', () => chart.timeScale().fitContent());
$('#winSlider').addEventListener('input', (e) => setWindow(Number(e.target.value)));
$('#refreshBtn').addEventListener('click', async () => {
  const btn = $('#refreshBtn'); btn.disabled = true; btn.textContent = 'Refreshing…';
  try { await fetch('/api/refresh', { method: 'POST' }); } finally { btn.disabled = false; btn.textContent = 'Refresh data'; }
});

// ───────── boot
async function boot() {
  const pw = store.get('panelW', null); if (pw) $('#panel').style.width = pw + 'px';
  const dh = store.get('drawerH', null); if (dh) $('#drawer').style.height = dh + 'px';
  if (store.get('drawerCollapsed', false)) { $('#drawer').classList.add('collapsed'); $('#drawerToggle').textContent = 'Show'; }
  $('#logBtn').classList.toggle('on', S.log);
  $('#winSlider').value = S.windowDays; $('#winVal').textContent = S.windowDays + 'd';
  buildPanel();
  const [btc, meta] = await Promise.all([fetch('/data/btc.json').then((r) => r.json()), fetch('/data/meta.json').then((r) => r.json()).catch(() => null)]);
  bars = btc;
  if (meta) $('#dataInfo').textContent = `Data: ${new Date(meta.fetchedAt).toLocaleString()}`;
  const saved = [...S.active]; S.active = [];
  const savedCompare = S.compareId;
  const savedRange = store.get('range', null);
  setTimeframe(S.tf, false);
  updateLegend();
  for (const id of saved) await activate(id, { quiet: true });
  if (savedCompare && S.active.includes(savedCompare)) { S.compareId = savedCompare; renderDrawer(); }
  // Short wait so autoSize has the real width before fitting. (Not rAF: it never fires in a hidden tab.)
  await new Promise((r) => setTimeout(r, 60));
  if (savedRange) setRange(savedRange.from, savedRange.to); else chart.timeScale().fitContent();
  connectBridge();
}
boot().catch((err) => { console.error(err); showNote('Startup error', err.message); });
