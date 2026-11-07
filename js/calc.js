// Pure math helpers. No DOM, so the CLI (bin/chart.mjs) can import this file too.

export const DAY_MS = 86400000;
export const toMs = (d) => Date.parse(d + 'T00:00:00Z');
export const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(toMs(d));
export const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d, n) => toDay(toMs(d) + n * DAY_MS);
export const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

// Bucket start for a daily date. W = Monday-start week, M = first of month.
export function bucketOf(d, tf) {
  if (tf === 'D') return d;
  if (tf === 'M') return d.slice(0, 8) + '01';
  const ms = toMs(d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return toDay(ms - dow * DAY_MS);
}

export function resampleCandles(bars, tf) {
  if (tf === 'D') return bars;
  const out = [];
  let cur = null;
  for (const b of bars) {
    const k = bucketOf(b.t, tf);
    if (!cur || cur.t !== k) {
      cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, s: b.s };
      out.push(cur);
    } else {
      cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v;
      if (!b.s) cur.s = 0;
    }
  }
  return out;
}

// Series = array of { time: 'YYYY-MM-DD', value }. Keeps the last value per bucket.
export function resampleSeries(points, tf, agg = 'last') {
  if (tf === 'D') return points;
  const map = new Map();
  for (const p of points) {
    const k = bucketOf(p.time, tf);
    map.set(k, agg === 'sum' ? (map.get(k) || 0) + p.value : p.value);
  }
  return [...map].map(([time, value]) => ({ time, value }));
}

// { t:[], v:[] } columnar -> points
export const cols = (c, key = 'v') => c.t.map((t, i) => ({ time: t, value: c[key][i] })).filter((p) => p.value != null && Number.isFinite(p.value));

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null) { sum += v; count++; }
    if (i >= n) { const old = values[i - n]; if (old != null) { sum -= old; count--; } }
    if (i >= n - 1 && count === n) out[i] = sum / n;
  }
  return out;
}

export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null, seed = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed.push(v);
      if (seed.length === n) { prev = seed.reduce((a, b) => a + b, 0) / n; out[i] = prev; }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= n) { gain += g / n; loss += l / n; if (i === n) out[i] = 100 - 100 / (1 + gain / (loss || 1e-12)); continue; }
    gain = (gain * (n - 1) + g) / n; loss = (loss * (n - 1) + l) / n;
    out[i] = 100 - 100 / (1 + gain / (loss || 1e-12));
  }
  return out;
}

export const zip = (times, values) => times.map((time, i) => ({ time, value: values[i] })).filter((p) => p.value != null && Number.isFinite(p.value));

// Weekly closes computed from daily bars, indicator calculated on weeks, then each
// day shows its week's final value (same as reading it off the weekly chart; the
// current week moves until it closes).
export function weeklyIndicator(bars, fn) {
  const weeks = resampleCandles(bars, 'W');
  const vals = fn(weeks.map((w) => w.c));
  const byWeek = new Map(weeks.map((w, i) => [w.t, vals[i]]));
  return bars.map((b) => ({ time: b.t, value: byWeek.get(bucketOf(b.t, 'W')) })).filter((p) => p.value != null);
}

// Value of a sparse series at a date (last known value on or before it).
export function valueAt(points, d) {
  let lo = 0, hi = points.length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].time <= d) { ans = points[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

// Close of BTC on or before a date. bars = daily candles.
export function closeAt(bars, d) {
  let lo = 0, hi = bars.length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t <= d) { ans = bars[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export const pct = (a, b) => (a && b ? (b / a - 1) * 100 : null);

export function median(xs) {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// BTC % move before / during / after each event or zone. Used by the
// Compare table in the app and by `node bin/chart.mjs stats`.
// Rows that are future or still running are shown but left out of average/median.
export function compareStats(bars, instances, windowDays) {
  const empty = { rows: [], avg: {}, med: {} };
  if (!bars.length) return empty;
  const first = bars[0].t, last = bars[bars.length - 1].t;
  const rows = instances.map((x) => {
    const start = x.from || x.d;
    const end = x.to || x.d;
    const startIn = start >= first && start <= last;
    const endIn = end >= first && end <= last;
    const pStart = startIn ? closeAt(bars, start)?.c : null;
    const pEnd = endIn ? closeAt(bars, end)?.c : null;
    const beforeDay = addDays(start, -windowDays), afterDay = addDays(end, windowDays);
    const pBefore = startIn && beforeDay >= first ? closeAt(bars, beforeDay)?.c : null;
    const pAfter = endIn && afterDay <= last ? closeAt(bars, afterDay)?.c : null;
    const ongoing = !!x.to && startIn && end > last;
    return {
      label: x.label, start, end,
      price: pStart,
      before: pct(pBefore, pStart),
      during: x.to && startIn ? pct(pStart, ongoing ? bars[bars.length - 1].c : pEnd) : null,
      after: pct(pEnd, pAfter),
      future: start > last,
      ongoing,
    };
  });
  const use = rows.filter((r) => !r.future && !r.ongoing);
  const avg = (k) => { const xs = use.map((r) => r[k]).filter((v) => v != null); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const med = (k) => median(use.map((r) => r[k]));
  return { rows, avg: { before: avg('before'), during: avg('during'), after: avg('after') }, med: { before: med('before'), during: med('during'), after: med('after') } };
}

// Least-squares fit of log10(price) = a + b*log10(days since genesis).
export function powerLawFit(bars) {
  const g = toMs('2009-01-03');
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  const pts = [];
  for (const bar of bars) {
    const d = (toMs(bar.t) - g) / DAY_MS;
    if (d <= 0 || bar.c <= 0) continue;
    const x = Math.log10(d), y = Math.log10(bar.c);
    pts.push([bar.t, x, y]);
    n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const a = (sy - b * sx) / n;
  const resid = pts.map(([, x, y]) => y - (a + b * x)).sort((p, q) => p - q);
  const q = (p) => resid[Math.floor(p * (resid.length - 1))];
  return { a, b, lo: q(0.01), hi: q(0.99), at: (t) => { const d = (toMs(t) - g) / DAY_MS; return d > 0 ? a + b * Math.log10(d) : null; } };
}

// Approx. moon phases from a known new moon (2000-01-06 18:14 UTC). Accurate to about ±1 day.
export function moonDates(fromDay, toDayStr, phase /* 0 = new, 0.5 = full */) {
  const SYN = 29.530588853 * DAY_MS;
  const epoch = Date.UTC(2000, 0, 6, 18, 14) + phase * SYN;
  const out = [];
  let k = Math.ceil((toMs(fromDay) - epoch) / SYN);
  for (let ms = epoch + k * SYN; ms <= toMs(toDayStr); ms += SYN) out.push(toDay(ms));
  return out;
}

// Last Friday of a month (Deribit monthly/quarterly expiry day).
export function lastFriday(year, month /* 1-12 */) {
  const d = new Date(Date.UTC(year, month, 0));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
  return toDay(d.getTime());
}
