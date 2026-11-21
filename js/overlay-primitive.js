// Draws event lines, shaded zones, before/after windows and Claude's
// annotations on the price pane. Dates are mapped to "logical" bar
// positions ourselves, so dates between bars, before the data and in the
// future (next halving) still land in the right place.
import { bucketOf, daysBetween, toMs, DAY_MS, isDay } from './calc.js';

function hexA(hex, a) {
  if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || '')) hex = '#f7931a';
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class DateMapper {
  constructor() { this.times = []; this.tf = 'D'; }
  setBars(times, tf) { this.times = times; this.tf = tf; }
  bucketDays(bucket) {
    if (this.tf === 'D') return 1;
    if (this.tf === 'W') return 7;
    const d = new Date(toMs(bucket)); const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    return Math.round((next - d.getTime()) / DAY_MS);
  }
  index(bucket) {
    let lo = 0, hi = this.times.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.times[m] === bucket) return m; if (this.times[m] < bucket) lo = m + 1; else hi = m - 1; }
    return -1;
  }
  // Left edge of a day (edge = 0) or right edge (edge = 1), as a logical position.
  logical(d, edge = 0.5) {
    const t = this.times; if (!t.length || !isDay(d)) return null;
    const avg = this.tf === 'D' ? 1 : this.tf === 'W' ? 7 : 30.44;
    if (d < t[0]) return -0.5 + (daysBetween(t[0], d) + edge) / avg;
    const b = bucketOf(d, this.tf);
    let i = this.index(b);
    if (i === -1) {
      if (b > t[t.length - 1]) return t.length - 1 + 0.5 + (daysBetween(bucketOf(t[t.length - 1], this.tf), d) - this.bucketDays(t[t.length - 1]) + edge) / avg;
      // Gap in data (rare): use the nearest earlier bar.
      let lo = 0, hi = t.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (t[m] <= b) lo = m; else hi = m - 1; } i = lo;
      return i + 0.5;
    }
    return i - 0.5 + (daysBetween(b, d) + edge) / this.bucketDays(b);
  }
}

export class OverlayPrimitive {
  constructor(mapper) {
    this.mapper = mapper;
    this.layers = [];      // [{ id, color, events, zones, windowDays }]
    this.notes = { marks: [], boxes: [] };
    this.view = { zOrder: () => 'bottom', renderer: () => ({ draw: () => {}, drawBackground: (target) => this.drawBg(target) }) };
    this.topView = { zOrder: () => 'top', renderer: () => ({ draw: (target) => this.drawTop(target) }) };
    this.hits = [];        // filled on draw, used for hover
  }
  attached({ chart, series, requestUpdate }) { this.chart = chart; this.series = series; this.requestUpdate = requestUpdate; }
  detached() { this.chart = null; }
  paneViews() { return [this.view, this.topView]; }
  update() { this.requestUpdate?.(); }

  x(d, edge) {
    const l = this.mapper.logical(d, edge);
    if (l == null) return null;
    // logicalToCoordinate() only works on whole bar indexes, so interpolate between two.
    const ts = this.chart.timeScale();
    const i = Math.floor(l);
    const x0 = ts.logicalToCoordinate(i), x1 = ts.logicalToCoordinate(i + 1);
    return x0 == null || x1 == null ? null : x0 + (l - i) * (x1 - x0);
  }

  drawBg(target) {
    if (!this.chart) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const H = mediaSize.height, W = mediaSize.width;
      const today = new Date().toISOString().slice(0, 10);
      for (const L of this.layers) {
        for (const z of L.zones) {
          const x1 = this.x(z.from, 0), x2 = this.x(z.to || today, 1);
          if (x1 == null || x2 == null || x2 < 0 || x1 > W) continue;
          ctx.fillStyle = hexA(L.color, z.alt ? 0.06 : 0.11);
          ctx.fillRect(x1, 0, Math.max(1, x2 - x1), H);
          ctx.fillStyle = hexA(L.color, 0.6);
          ctx.fillRect(x1, 0, Math.max(1, x2 - x1), 2);
        }
        if (L.windowDays > 0 && L.events.length <= 80) {
          for (const e of L.events) {
            const xb = this.x(addDaysStr(e.d, -L.windowDays), 0), xe = this.x(e.d, 0.5), xa = this.x(addDaysStr(e.d, L.windowDays), 1);
            if (xb == null || xa == null || xa < 0 || xb > W) continue;
            ctx.fillStyle = hexA(L.color, 0.035); ctx.fillRect(xb, 0, xe - xb, H);
            ctx.fillStyle = hexA(L.color, 0.07); ctx.fillRect(xe, 0, xa - xe, H);
          }
        }
      }
      for (const b of this.notes.boxes) {
        const x1 = this.x(b.from, 0), x2 = this.x(b.to, 1);
        if (x1 == null || x2 == null) continue;
        const y1 = b.top != null ? this.series.priceToCoordinate(b.top) : 0;
        const y2 = b.bottom != null ? this.series.priceToCoordinate(b.bottom) : H;
        ctx.fillStyle = hexA(b.color || '#f7931a', 0.14);
        ctx.fillRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
        ctx.strokeStyle = hexA(b.color || '#f7931a', 0.9); ctx.setLineDash([5, 4]); ctx.lineWidth = 1;
        ctx.strokeRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1)); ctx.setLineDash([]);
      }
    });
  }

  drawTop(target) {
    if (!this.chart) return;
    this.hits = [];
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const H = mediaSize.height, W = mediaSize.width;
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      let row = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (const L of this.layers) {
        // Label rows stack up from the bottom so they never cover the price legend.
        const y = H - 12 - (row++ % 6) * 17;
        // zone labels
        for (const z of L.zones) {
          const x1 = this.x(z.from, 0), x2 = this.x(z.to || today, 1);
          if (x1 == null || x2 == null || x2 < 0 || x1 > W) continue;
          this.hits.push({ x1, x2, item: L, z });
          const w = ctx.measureText(z.label).width;
          if (x2 - x1 > w + 10 && L.zones.length < 60) pill(ctx, Math.max(x1 + 4, 4), y, z.label, L.color, w, true);
        }
        // event lines
        let lastLabelX = -1e9;
        const dense = L.events.length > 120;
        for (const e of L.events) {
          const x = this.x(e.d, 0.5);
          if (x == null || x < -50 || x > W + 50) continue;
          this.hits.push({ x1: x - 4, x2: x + 4, item: L, e, x });
          ctx.strokeStyle = hexA(L.color, dense ? 0.35 : 0.85);
          ctx.lineWidth = 1;
          ctx.setLineDash(e.approx ? [4, 4] : []);
          ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); ctx.stroke();
          ctx.setLineDash([]);
          const w = ctx.measureText(e.label).width;
          if (!dense && x - lastLabelX > w + 16) { pill(ctx, x + 3, y, e.label, L.color, w, false); lastLabelX = x; }
        }
      }
      for (const m of this.notes.marks) {
        const x = this.x(m.d, 0.5); if (x == null) continue;
        const c = m.color || '#f7931a';
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
        const w = ctx.measureText(m.label || '').width;
        if (m.label) pill(ctx, x + 4, 64, m.label, c, w, false, true);
      }
      for (const b of this.notes.boxes) {
        const x1 = this.x(b.from, 0); if (x1 == null || !b.label) continue;
        const y = b.top != null ? this.series.priceToCoordinate(b.top) + 12 : 84;
        pill(ctx, x1 + 4, y, b.label, b.color || '#f7931a', ctx.measureText(b.label).width, false, true);
      }
    });
  }

  hitTest(x) {
    const out = [];
    for (const h of this.hits) if (x >= h.x1 && x <= h.x2) out.push(h);
    return out;
  }
}

function pill(ctx, x, y, text, color, w, outline, solid) {
  const h = 15;
  ctx.fillStyle = solid ? color : 'rgba(19,23,34,0.85)';
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  roundRect(ctx, x, y - h / 2, w + 10, h, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = solid ? '#111' : color;
  ctx.fillText(text, x + 5, y + 0.5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function addDaysStr(d, n) { return new Date(toMs(d) + n * DAY_MS).toISOString().slice(0, 10); }
