// Tiny responsive SVG chart helper: keyed layers that re-render on resize,
// plus an optional "draw your guess" mode that works with mouse, pen and touch.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

function niceTicks(min, max, count = 5) {
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export class Chart {
  constructor(container, opts) {
    this.container = container;
    this.o = Object.assign({
      x: [0, 1], y: [0, 1], height: 220, xTicks: null, yTicks: null,
      xFormat: v => v, yFormat: v => v, xLabel: '', yLabel: '',
      margin: { t: 14, r: 14, b: 30, l: 44 }, ariaLabel: '',
    }, opts);
    this.h = this.o.height;
    this.o.margin = { ...this.o.margin };
    if (this.o.yLabel) this.o.margin.t = Math.max(this.o.margin.t, 26);
    this.items = new Map();
    this.svg = el('svg', { class: 'chart', role: 'img', 'aria-label': this.o.ariaLabel });
    container.appendChild(this.svg);
    this.gGrid = el('g', { class: 'grid' }, this.svg);
    this.gBack = el('g', {}, this.svg);
    this.gMain = el('g', {}, this.svg);
    this.gFront = el('g', {}, this.svg);
    this.w = 0;
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(container);
    this._resize();
  }

  get iw() { return this.w - this.o.margin.l - this.o.margin.r; }
  get ih() { return this.h - this.o.margin.t - this.o.margin.b; }
  sx(v) { const [a, b] = this.o.x; return this.o.margin.l + ((v - a) / (b - a)) * this.iw; }
  sy(v) { const [a, b] = this.o.y; return this.o.margin.t + (1 - (v - a) / (b - a)) * this.ih; }
  ix(px) { const [a, b] = this.o.x; return a + ((px - this.o.margin.l) / this.iw) * (b - a); }
  iy(py) { const [a, b] = this.o.y; return a + (1 - (py - this.o.margin.t) / this.ih) * (b - a); }

  setDomain({ x, y }) { if (x) this.o.x = x; if (y) this.o.y = y; this.render(); }

  _resize() {
    const w = Math.max(240, this.container.clientWidth);
    if (w === this.w) return;
    this.w = w;
    // wider charts get taller, up to 35% more than their base height
    this.h = Math.round(Math.max(this.o.height, Math.min(this.o.height * 1.35, w * 0.34)));
    this.svg.setAttribute('viewBox', `0 0 ${w} ${this.h}`);
    this.svg.setAttribute('width', w);
    this.svg.setAttribute('height', this.h);
    this.render();
  }

  _axes() {
    const g = this.gGrid; g.replaceChildren();
    const { margin } = this.o;
    const xt = this.o.xTicks || niceTicks(...this.o.x, Math.max(3, Math.floor(this.iw / 80)));
    const yt = this.o.yTicks || niceTicks(...this.o.y, Math.max(3, Math.floor(this.ih / 45)));
    for (const v of yt) {
      const y = this.sy(v);
      el('line', { x1: margin.l, x2: this.w - margin.r, y1: y, y2: y, class: 'gridline' }, g);
      const t = el('text', { x: margin.l - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' }, g);
      t.textContent = this.o.yFormat(v);
    }
    for (const v of xt) {
      const x = this.sx(v);
      el('line', { x1: x, x2: x, y1: this.h - margin.b, y2: this.h - margin.b + 4, class: 'tickmark' }, g);
      const t = el('text', { x, y: this.h - margin.b + 17, class: 'tick', 'text-anchor': 'middle' }, g);
      t.textContent = this.o.xFormat(v);
    }
    el('line', { x1: margin.l, x2: this.w - margin.r, y1: this.h - margin.b, y2: this.h - margin.b, class: 'axis' }, g);
    if (this.o.yLabel) {
      const t = el('text', { x: margin.l - 8, y: margin.t - 14, class: 'axis-label', 'text-anchor': 'start' }, g);
      t.textContent = this.o.yLabel;
    }
  }

  // ---- keyed items --------------------------------------------------------
  set(id, spec) { this.items.set(id, Object.assign(this.items.get(id) || {}, spec)); this._draw(id); return this; }
  remove(id) { const it = this.items.get(id); if (it && it.node) it.node.remove(); this.items.delete(id); }
  has(id) { return this.items.has(id); }

  render() {
    if (!this.w) return;
    this._axes();
    for (const id of this.items.keys()) this._draw(id);
  }

  _path(pts) {
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p == null || p[1] == null || Number.isNaN(p[1])) continue;
      d += (d ? 'L' : 'M') + this.sx(p[0]).toFixed(1) + ',' + this.sy(p[1]).toFixed(1);
    }
    return d;
  }

  _draw(id) {
    if (!this.w) return;
    const it = this.items.get(id);
    const layer = it.layer === 'back' ? this.gBack : it.layer === 'front' ? this.gFront : this.gMain;
    if (!it.node) {
      it.node = el('g', { class: 'item ' + (it.cls || '') }, layer);
    }
    const g = it.node; g.replaceChildren();
    g.setAttribute('class', 'item ' + (it.cls || ''));
    if (it.hidden) return;
    const [y0] = this.o.y;
    switch (it.type) {
      case 'line': {
        el('path', { d: this._path(it.data), class: 'line', fill: 'none' }, g);
        if (it.label && it.data.length) {
          const valid = it.data.filter(p => p && p[1] != null);
          const last = it.labelX != null
            ? valid.reduce((best, p) => (Math.abs(p[0] - it.labelX) < Math.abs(best[0] - it.labelX) ? p : best), valid[0])
            : valid[valid.length - 1];
          if (last) {
            const t = el('text', { x: this.sx(last[0]) + (it.labelX != null ? 0 : -4), y: this.sy(last[1]) + (it.labelDy ?? -8), class: 'line-label', 'text-anchor': it.labelX != null ? 'middle' : 'end' }, g);
            t.textContent = it.label;
          }
        }
        break;
      }
      case 'area': {
        const base = it.base ?? y0;
        const pts = it.data.filter(p => p && p[1] != null);
        if (pts.length < 2) break;
        const top = this._path(pts);
        const d = top + `L${this.sx(pts[pts.length - 1][0])},${this.sy(base)}L${this.sx(pts[0][0])},${this.sy(base)}Z`;
        el('path', { d, class: 'area' }, g);
        break;
      }
      case 'between': { // area between two series sharing x
        const a = it.a, b = it.b;
        if (a.length < 2) break;
        let d = this._path(a);
        for (let i = b.length - 1; i >= 0; i--) d += `L${this.sx(b[i][0])},${this.sy(b[i][1])}`;
        el('path', { d: d + 'Z', class: 'area' }, g);
        break;
      }
      case 'hline': {
        const y = this.sy(it.y);
        el('line', { x1: this.o.margin.l, x2: this.w - this.o.margin.r, y1: y, y2: y, class: 'rule' }, g);
        if (it.label) {
          const t = el('text', { x: it.align === 'left' ? this.o.margin.l + 4 : this.w - this.o.margin.r - 4, y: y - 5, class: 'rule-label', 'text-anchor': it.align === 'left' ? 'start' : 'end' }, g);
          t.textContent = it.label;
        }
        break;
      }
      case 'band': {
        const ya = this.sy(it.y1), yb = this.sy(it.y0);
        el('rect', { x: this.o.margin.l, width: this.iw, y: ya, height: Math.max(1, yb - ya), class: 'band' }, g);
        if (it.label) {
          const t = el('text', { x: this.o.margin.l + 6, y: ya - 5, class: 'rule-label' }, g);
          t.textContent = it.label;
        }
        break;
      }
      case 'xband': {
        const xa = this.sx(it.x0), xb = this.sx(it.x1);
        el('rect', { x: xa, width: Math.max(1, xb - xa), y: this.o.margin.t, height: this.ih, class: 'xband' }, g);
        if (it.label) {
          const t = el('text', { x: it.labelX != null ? this.sx(it.labelX) : (xa + xb) / 2, y: this.o.margin.t + 11, class: 'rule-label', 'text-anchor': 'middle' }, g);
          t.textContent = it.label;
        }
        break;
      }
      case 'vline': {
        const x = this.sx(it.x);
        el('line', { x1: x, x2: x, y1: this.o.margin.t, y2: this.h - this.o.margin.b, class: 'rule' }, g);
        if (it.label) {
          const t = el('text', { x: x + 5, y: this.o.margin.t + 10, class: 'rule-label' }, g);
          t.textContent = it.label;
        }
        break;
      }
      case 'dots': {
        for (const p of it.data) {
          el('circle', { cx: this.sx(p[0]), cy: this.sy(p[1]), r: it.r || 3.5, class: 'dot' + (p[2] ? ' ' + p[2] : '') }, g);
        }
        break;
      }
      case 'marker': {
        if (it.x == null || it.y == null) break;
        const cx = this.sx(it.x), cy = this.sy(it.y);
        el('circle', { cx, cy, r: it.r || 5, class: 'marker' }, g);
        if (it.label) {
          const right = cx < this.w * 0.65;
          const t = el('text', { x: cx + (right ? 9 : -9), y: cy + (it.dy ?? -8), class: 'marker-label', 'text-anchor': right ? 'start' : 'end' }, g);
          t.textContent = it.label;
        }
        break;
      }
      case 'text': {
        const t = el('text', { x: this.sx(it.x) + (it.dx || 0), y: this.sy(it.y) + (it.dy || 0), class: 'note', 'text-anchor': it.anchor || 'start' }, g);
        t.textContent = it.text;
        break;
      }
    }
  }

  // ---- drawing ------------------------------------------------------------
  // samples: number of evenly spaced x-samples captured
  enableDraw({ samples = 65, onChange, clampY, fixedStart, guessCls = 'guess' } = {}) {
    const [xa, xb] = this.o.x;
    this.draw = { samples, values: new Array(samples).fill(null), onChange, clampY: clampY || this.o.y, cls: guessCls };
    if (fixedStart != null) this.draw.values[0] = fixedStart;
    const xs = i => xa + (i / (samples - 1)) * (xb - xa);
    this.draw.xs = xs;
    const overlay = el('rect', { class: 'draw-surface', fill: 'transparent' }, this.svg);
    this.draw.overlay = overlay;
    const place = () => {
      overlay.setAttribute('x', this.o.margin.l); overlay.setAttribute('y', 0);
      overlay.setAttribute('width', Math.max(0, this.iw)); overlay.setAttribute('height', this.h);
    };
    place();
    const origRender = this.render.bind(this);
    this.render = () => { origRender(); place(); this._drawGuess(); };

    let last = null;
    const toData = e => {
      const r = this.svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * this.w;
      const py = ((e.clientY - r.top) / r.height) * this.h;
      const [lo, hi] = this.draw.clampY;
      return [this.ix(px), Math.min(hi, Math.max(lo, this.iy(py)))];
    };
    const idx = x => Math.round(((x - xa) / (xb - xa)) * (samples - 1));
    const put = ([x, y]) => {
      const i = Math.min(samples - 1, Math.max(0, idx(x)));
      if (last) {
        const [li, ly] = last;
        const n = Math.abs(i - li);
        for (let k = 1; k <= n; k++) {
          const j = li + Math.sign(i - li) * k;
          this.draw.values[j] = ly + ((y - ly) * k) / n;
        }
      }
      this.draw.values[i] = y;
      if (fixedStart != null) this.draw.values[0] = fixedStart;
      last = [i, y];
      this._drawGuess();
      onChange && onChange(this.guess());
    };
    let drawing = false;
    overlay.addEventListener('pointerdown', e => {
      if (this.draw.locked) return;
      try { overlay.setPointerCapture(e.pointerId); } catch { /* synthetic or unsupported */ }
      drawing = true;
      last = null;
      put(toData(e));
      e.preventDefault();
    });
    overlay.addEventListener('pointermove', e => {
      if (this.draw.locked || !drawing) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) put(toData(ev));
    });
    const end = () => { drawing = false; last = null; };
    overlay.addEventListener('pointerup', end);
    overlay.addEventListener('pointercancel', end);
    this._drawGuess();
  }

  lockDraw(locked) { if (this.draw) { this.draw.locked = locked; this.svg.classList.toggle('locked', locked); } }
  clearGuess(fixedStart) {
    if (!this.draw) return;
    this.draw.values.fill(null);
    if (fixedStart != null) this.draw.values[0] = fixedStart;
    this._drawGuess();
    this.draw.onChange && this.draw.onChange(this.guess());
  }
  setGuess(fn) {
    this.draw.values = this.draw.values.map((_, i) => fn(this.draw.xs(i)));
    this._drawGuess();
  }

  // returns { coverage, points: [[x,y]...] (gaps interpolated) }
  guess() {
    const v = this.draw.values, n = v.length;
    const filled = v.filter(a => a != null).length;
    const pts = [];
    let prevI = -1;
    for (let i = 0; i < n; i++) {
      if (v[i] != null) {
        if (prevI >= 0 && i - prevI > 1) {
          for (let j = prevI + 1; j < i; j++) pts.push([this.draw.xs(j), v[prevI] + ((v[i] - v[prevI]) * (j - prevI)) / (i - prevI)]);
        }
        pts.push([this.draw.xs(i), v[i]]);
        prevI = i;
      }
    }
    return { coverage: filled / n, points: pts, values: v };
  }

  _drawGuess() {
    if (!this.draw) return;
    if (!this.draw.g) this.draw.g = el('g', { class: 'item ' + this.draw.cls }, this.gFront);
    const g = this.draw.g; g.replaceChildren();
    const pts = this.guess().points;
    if (pts.length) el('path', { d: this._path(pts), class: 'line', fill: 'none' }, g);
  }
}
