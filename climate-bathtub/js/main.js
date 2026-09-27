import { Stage } from './stage.js';
import { Chart } from './chart.js';
import {
  history, runFuture, stabilizingEmissions, linearPathway, peakWarming, netZeroDecomposition,
  historicalEmissions, OBSERVED_PPM, PREINDUSTRIAL_PPM, NOW, interp,
} from './model.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const E0 = historicalEmissions(NOW);

// water-world scales
const TANK_L = 300;
// climate-world scales
const PPM_FULL = 800;
const GT_FULL = 60;
const ppmFrac = ppm => ppm / PPM_FULL;
const gt = v => `${Math.round(v)} Gt/yr`;

const stage = new Stage($("stage"));

// The tank can be hidden to give the story full width; the choice is remembered per browser.
function setTankHidden(hidden) {
  document.body.classList.toggle('tank-hidden', hidden);
  try { localStorage.setItem('tankHidden', hidden ? '1' : '0'); } catch { /* storage unavailable */ }
  dispatchEvent(new Event('resize'));
}
$('tankHide').addEventListener('click', () => setTankHidden(true));
$('tankShow').addEventListener('click', () => setTankHidden(false));
try { if (localStorage.getItem('tankHidden') === '1') document.body.classList.add('tank-hidden'); } catch { /* ignore */ }
const status = t => { $('stageStatus').textContent = t; };

const HIST = history().rows;
const histSeries = (key, from = 1850, to = NOW) =>
  HIST.filter(r => r.year >= from && r.year <= to && r[key] != null && !(key === 'sinks' && r.year === 1850)).map(r => [r.year, r[key]]);

// keep range tracks filled up to the thumb (WebKit)
function syncFill(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', p + '%');
}
document.querySelectorAll('input[type=range]').forEach(i => { syncFill(i); i.addEventListener('input', () => syncFill(i)); });

function segmented(container, onPick) {
  const btns = [...container.querySelectorAll('button')];
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    onPick(b.dataset, b);
  }));
}

// Citations: the claim links to the source (new tab); the number jumps to the list at the bottom
function cite(n, text) {
  const a = document.querySelector(`#ref-${n} a`);
  return `<a class="src" href="${a.href}" target="_blank" rel="noopener">${text}</a><sup class="cite"><a href="#ref-${n}" aria-label="Source ${n}">${n}</a></sup>`;
}
document.querySelectorAll('span.src[data-ref]').forEach(el => { el.outerHTML = cite(el.dataset.ref, el.innerHTML); });

const CLIMATE_NAMES = { in: 'Emissions', out: 'Oceans & land', level: 'CO₂ in air' };
const PRE_MARK = { frac: ppmFrac(PREINDUSTRIAL_PPM), label: 'pre-industrial · 284' };
const TODAY_MARK = { frac: ppmFrac(history().state.ppm), label: `today · ${Math.round(history().state.ppm)}` };

// Show a climate row on the tank
function showClimateRow(r, withTemp = false) {
  stage.setState({
    inflow: Math.max(0, r.E) / GT_FULL,
    // carbon removal (negative emissions) drains the tub too
    outflow: (Math.max(0, r.sinks ?? r.E * 0.6) + Math.max(0, -r.E)) / GT_FULL,
    level: ppmFrac(r.ppm),
    inText: r.E < -0.5 ? `${Math.round(-r.E)} Gt/yr removed` : gt(Math.max(0, r.E)),
    outText: r.sinks == null ? '' : r.sinks < -0.5 ? `${Math.round(-r.sinks)} Gt/yr given back` : gt(Math.max(0, r.sinks)),
    levelText: `${Math.round(r.ppm)} ppm`,
    temp: withTemp ? r.T : undefined,
  });
}

// Loops through a set of model rows, driving the tank and a chart playhead.
class Looper {
  constructor(rows, { seconds = 8, hold = 1.5, charts = [], withTemp = false } = {}) {
    Object.assign(this, { rows, seconds, hold, charts, withTemp, t: 0 });
  }
  tick(dt) {
    const total = this.seconds + this.hold;
    this.t = (this.t + dt) % total;
    const f = Math.min(1, this.t / this.seconds);
    const i = Math.round(f * (this.rows.length - 1));
    const r = this.rows[i];
    showClimateRow(r, this.withTemp);
    status(`${r.year}`);
    for (const c of this.charts) c.set('play', { type: 'vline', x: r.year, cls: 'playhead', layer: 'front' });
  }
}

/* ════════════════════════════ chapters ════════════════════════════ */
const chapters = {};

// ── hero ────────────────────────────────────────────────────────────
chapters.hero = {
  enter() {
    stage.setMode({ names: { in: 'Tap', out: 'Drain', level: 'Level' } });
    stage.setState({ inText: '', outText: '', levelText: '' });
    status('');
    this.t = 0;
  },
  tick(dt) {
    this.t += dt;
    const w = Math.sin(this.t * 0.5);
    stage.setState({ inflow: 0.5 + 0.12 * w, outflow: 0.5, level: 0.42 + 0.04 * Math.sin(this.t * 0.5 - 1.2) });
  },
};

// ── 1. tap & drain ─────────────────────────────────────────────────
chapters.tap = {
  level: 120,
  init() {
    this.tap = $('tapSlider');
    this.drain = $('drainSlider');
    const readout = () => {
      $('tapOut').textContent = `${this.tap.value} L/min`;
      $('drainOut').textContent = `${this.drain.value} L/min`;
    };
    this.tap.addEventListener('input', readout);
    this.drain.addEventListener('input', readout);
    readout();
  },
  enter() {
    stage.setMode({ names: { in: 'Tap', out: 'Drain', level: 'Water' }, marks: [] });
  },
  tick(dt) {
    const inflow = +this.tap.value;
    const drain = +this.drain.value;
    // an empty tank can only pass on what flows in
    const out = this.level <= 0 && inflow < drain ? inflow : drain;
    this.level = clamp(this.level + (inflow - out) * dt, 0, TANK_L);
    const full = this.level >= TANK_L - 0.01;
    const empty = this.level <= 0 && inflow <= drain;
    stage.setState({
      inflow: inflow / 100, outflow: out / 100, level: this.level / TANK_L,
      inText: `${inflow} L/min`, outText: `${drain} L/min`, levelText: `${Math.round(this.level)} L`,
    });
    status(full ? 'Overflowing' : empty ? 'Empty' : '');
    $('r1lvl').textContent = `${Math.round(this.level)} L`;
    const net = inflow - drain;
    const trend = full ? 'full, spilling over' : empty ? 'empty' : net > 0 ? '▲ rising' : net < 0 ? '▼ falling' : 'steady';
    const el = $('r1trend');
    el.textContent = trend;
    el.dataset.dir = full || net > 0 ? 'up' : empty || net < 0 ? 'down' : '';
  },
};

// ── 2. predict ─────────────────────────────────────────────────────
const inflow2 = t => (t <= 4 ? 50 + 10 * t : t <= 12 ? 90 - 10 * (t - 4) : 10 + 10 * (t - 12));
const level2 = t => {
  if (t <= 4) return 100 + 5 * t * t;
  if (t <= 12) { const s = t - 4; return 180 + 40 * s - 5 * s * s; }
  const u = t - 12; return 180 - 40 * u + 5 * u * u;
};
chapters.predict = {
  init() {
    const xf = v => `${v}m`;
    this.flows = new Chart($('c2flows'), { x: [0, 16], y: [0, 100], height: 150, xTicks: [0, 4, 8, 12, 16], yTicks: [0, 50, 100], xFormat: xf, ariaLabel: 'Inflow rises from 50 to 90 litres per minute by minute 4, falls to 10 by minute 12, and returns to 50 by minute 16. Outflow is constant at 50.' });
    const inPts = []; for (let t = 0; t <= 16; t += 0.25) inPts.push([t, inflow2(t)]);
    this.flows.set('in', { type: 'line', data: inPts, cls: 'in', label: 'inflow', labelX: 2.6, labelDy: 17 });
    this.flows.set('out', { type: 'line', data: [[0, 50], [16, 50]], cls: 'out', label: 'drain', labelX: 14.6, labelDy: -8 });

    this.capDefault = $('c2cap').innerHTML;
    this.level = new Chart($('c2level'), { x: [0, 16], y: [0, 300], height: 200, xTicks: [0, 4, 8, 12, 16], yTicks: [0, 100, 200, 300], xFormat: xf, yLabel: 'litres', ariaLabel: 'Drawing area for your prediction of the water level' });
    this.level.set('start', { type: 'marker', x: 0, y: 100, cls: 'stock', label: 'start: 100 L', dy: 18 });
    this.level.enableDraw({
      samples: 65, fixedStart: 100, clampY: [0, 300],
      onChange: g => {
        $('c2check').disabled = g.coverage < 0.6;
        $('c2hint').hidden = g.coverage > 0.05;
      },
    });
    $('c2check').addEventListener('click', () => this.check());
    $('c2reset').addEventListener('click', () => this.reset());
  },
  enter() {
    stage.setMode({ names: { in: 'Tap', out: 'Drain', level: 'Water' } });
    if (!this.anim) this.showMinute(this.revealed ? 16 : 0);
  },
  showMinute(t) {
    stage.setState({
      inflow: inflow2(t) / 100, outflow: 0.5, level: level2(t) / TANK_L,
      inText: `${Math.round(inflow2(t))} L/min`, outText: '50 L/min', levelText: `${Math.round(level2(t))} L`,
    });
    status(`minute ${t.toFixed(1)}`);
  },
  reset() {
    this.anim = null; this.revealed = false;
    this.level.lockDraw(false);
    this.level.clearGuess(100);
    this.level.remove('truth'); this.level.remove('peak'); this.level.remove('yourpeak');
    this.flows.remove('play'); this.flows.remove('cross'); this.flows.remove('rise'); this.flows.remove('fall');
    $('c2feedback').hidden = true;
    $('c2cap').innerHTML = this.capDefault;
    $('c2check').hidden = false;
    this.showMinute(0);
  },
  check() {
    this.level.lockDraw(true);
    $('c2check').hidden = true;
    this.anim = { t: 0 };
  },
  tick(dt) {
    if (!this.anim) return;
    const a = this.anim;
    a.t = Math.min(16, a.t + dt * (reduced ? 8 : 2)); // 8 s for 16 minutes
    const pts = []; for (let t = 0; t <= a.t + 1e-6; t += 0.1) pts.push([t, level2(t)]);
    this.level.set('truth', { type: 'line', data: pts, cls: 'stock' });
    this.flows.set('play', { type: 'vline', x: a.t, cls: 'playhead', layer: 'front' });
    this.showMinute(a.t);
    if (a.t >= 16) { this.anim = null; this.revealed = true; this.feedback(); }
  },
  feedback() {
    const g = this.level.guess().points;
    let peakT = 0, peakV = -1;
    for (const [x, y] of g) if (y > peakV) { peakV = y; peakT = x; }
    const endV = g.length ? g[g.length - 1][1] : 100;
    this.level.set('peak', { type: 'marker', x: 8, y: 260, cls: 'stock', label: 'peak at minute 8', dy: -10 });
    this.flows.set('cross', { type: 'marker', x: 8, y: 50, cls: 'in' });
    this.flows.remove('play');

    const fb = $('c2feedback');
    let verdict, cls;
    if (peakT >= 6.5 && peakT <= 9.5) {
      cls = 'good';
      verdict = '✓ Your curve peaks at about the right time, minute 8.';
    } else if (peakT >= 2.5 && peakT <= 5.5) {
      cls = 'warn';
      verdict = '✗ Your curve peaks at minute 4, when the tap is open widest. The level actually peaks at minute 8.';
    } else {
      cls = 'warn';
      verdict = '✗ Not quite. The level peaks at minute 8.';
    }
    const why = `<p class="reveal-title">Why minute 8 and not minute 4</p>
      <p>The level rises for as long as the tap lets in more than 50 litres a minute, the rate at which the drain removes water. That is true for the whole of the first eight minutes, shaded on the chart above.</p>
      <p>At minute 4 the tap is open widest, pouring in 90 litres a minute, 40 more than the drain removes. After that the tap starts closing. At minute 6 it lets in 70 litres, still 20 more than drains out, so the tank is still gaining water, only more slowly. Only at minute 8, when the tap is down to 50, do inflow and outflow match. That is the peak. After minute 8 the tap lets in less than 50, so the level falls.</p>
      ${peakT >= 2.5 && peakT <= 5.5 ? `<p>Sterman and Booth Sweeney call this error pattern matching: expecting the level to follow the shape of the inflow.</p>` : ''}`;
    const endNote = Math.abs(endV - 100) > 35
      ? `<p>The tank also ends at 100 litres, where it started. The water gained in the first eight minutes equals the water lost in the last eight.</p>` : '';
    $('c2cap').innerHTML = '<span class="k-stock">Water level</span>, litres. Dotted: your sketch. Solid blue: what actually happens.';
    fb.className = 'reveal ' + cls;
    fb.innerHTML = `<p class="verdict">${verdict}</p>${why}${endNote}
      <p class="aside">In an ${cite(2, 'earlier study')} using simple tasks like this one, Booth Sweeney and Sterman found that more than half of the MIT graduate students they tested got the basic shape wrong.</p>
      <div class="actions"><button class="btn ghost" id="c2again">↺ Try again</button></div>`;
    this.flows.set('rise', { type: 'xband', x0: 0, x1: 8, cls: 'rise', label: 'rising', labelX: 6.4, layer: 'back' });
    this.flows.set('fall', { type: 'xband', x0: 8, x1: 16, cls: 'fall', label: 'falling', labelX: 12, layer: 'back' });
    fb.hidden = false;
    $('c2again').addEventListener('click', () => this.reset());
  },
};

// ── 3. stories ─────────────────────────────────────────────────────
const STORIES = {
  tub: {
    flow: '<span class="k-in">Tap</span>, turned down steadily, and <span class="k-out">drain</span>, litres a minute',
    stock: '<span class="k-stock">Water in the tub</span>, litres',
    inName: 'tap', outName: 'drain', stockName: 'water', unitX: v => `${v}m`,
    text: 'The tap is turned down a little each minute. The water keeps rising, more slowly as time goes on, until the tap matches the drain.',
  },
  debt: {
    flow: '<span class="k-in">Government spending</span>, cut every year, and <span class="k-out">tax revenue</span>, billions a year',
    stock: '<span class="k-stock">Total national debt</span>, billions',
    inName: 'spending', outName: 'taxes', stockName: 'debt', unitX: v => `yr ${v}`,
    text: 'A government reduces its deficit every year. Its total debt still grows every year until spending falls to the level of tax revenue.',
  },
  crowd: {
    flow: '<span class="k-in">People arriving</span>, fewer each minute, and <span class="k-out">people leaving</span>, per minute',
    stock: '<span class="k-stock">People inside the stadium</span>',
    inName: 'arriving', outName: 'leaving', stockName: 'crowd', unitX: v => `${v}m`,
    text: 'Fans arrive at a stadium more slowly as kickoff approaches. The crowd inside keeps growing until arrivals fall to the rate at which people leave.',
  },
};
const in3 = t => (t < 8 ? 90 - 5 * t : 50);
const stock3 = t => (t < 8 ? 100 + 40 * t - 2.5 * t * t : 260);
chapters.stories = {
  init() {
    this.flows = new Chart($('c3flows'), { x: [0, 10], y: [0, 100], height: 140, yTicks: [0, 50, 100] });
    this.stock = new Chart($('c3stock'), { x: [0, 10], y: [0, 300], height: 150, yTicks: [0, 100, 200, 300] });
    segmented($('storyTabs'), d => this.pick(d.story));
    this.pick('tub');
    this.t = 0;
  },
  pick(key) {
    const s = STORIES[key];
    this.key = key;
    $('c3capFlow').innerHTML = s.flow; $('c3capStock').innerHTML = s.stock;
    $('c3text').textContent = s.text;
    for (const c of [this.flows, this.stock]) { c.o.xFormat = s.unitX; c.render(); }
    const ip = []; for (let t = 0; t <= 10; t += 0.25) ip.push([t, in3(t)]);
    this.flows.set('in', { type: 'line', data: ip, cls: 'in', label: s.inName });
    this.flows.set('out', { type: 'line', data: [[0, 50], [10, 50]], cls: 'out', label: s.outName, labelDy: 16 });
    this.anim = 0;
  },
  enter() { stage.setMode({ names: { in: 'Tap', out: 'Drain', level: 'Water' } }); this.t = 0; },
  tick(dt) {
    // draw the stock line progressively after each story switch
    if (this.anim != null && this.anim < 10) {
      this.anim = Math.min(10, this.anim + dt * (reduced ? 20 : 5));
      const sp = []; for (let t = 0; t <= this.anim + 1e-6; t += 0.1) sp.push([t, stock3(t)]);
      this.stock.set('s', { type: 'area', data: sp, cls: 'stock' });
      this.stock.set('l', { type: 'line', data: sp, cls: 'stock', label: this.anim >= 10 ? STORIES[this.key].stockName : '' });
    }
    // the tub quietly acts out the same story on a loop
    this.t = (this.t + dt) % 12;
    const tt = Math.min(10, this.t);
    stage.setState({
      inflow: in3(tt) / 100, outflow: 0.5, level: stock3(tt) / TANK_L,
      inText: `${Math.round(in3(tt))} L/min`, outText: '50 L/min', levelText: `${Math.round(stock3(tt))} L`,
    });
    status(`minute ${tt.toFixed(1)}`);
  },
};

// ── 4. the sky ─────────────────────────────────────────────────────
chapters.sky = {
  init() {
    this.flows = new Chart($('c4flows'), { x: [1850, 2025], y: [0, 45], height: 170, yTicks: [0, 20, 40], ariaLabel: 'Emissions and natural uptake since 1850' });
    this.stock = new Chart($('c4stock'), { x: [1850, 2025], y: [260, 440], height: 170, yTicks: [280, 320, 360, 400, 440], ariaLabel: 'Atmospheric CO2 since 1850' });
    this.stock.set('pre', { type: 'hline', y: PREINDUSTRIAL_PPM, cls: 'pre', label: 'pre-industrial', align: 'right', layer: 'back' });
    this.stock.set('obs', { type: 'dots', data: OBSERVED_PPM.map(([y, v]) => [y, v]), cls: 'observed', r: 3, layer: 'front' });
    this.year = NOW;
    this.scrub = $('c4scrub');
    this.scrub.addEventListener('input', () => { this.playing = false; this.setYear(+this.scrub.value); });
    $('c4play').addEventListener('click', () => { this.year = 1850; this.playing = true; });
    this.setYear(NOW);
  },
  setYear(y) {
    this.year = y;
    const E = histSeries('E', 1850, y), S = histSeries('sinks', 1851, y), P = histSeries('ppm', 1850, y);
    this.flows.set('gap', { type: 'between', a: E.filter(p => p[0] >= 1851), b: S, cls: 'gap', layer: 'back' });
    this.flows.set('E', { type: 'line', data: E, cls: 'in', label: y > 1990 ? 'emissions' : '', labelX: 1945, labelDy: -14 });
    this.flows.set('S', { type: 'line', data: S, cls: 'out solid', label: y > 1990 ? 'nature absorbs' : '', labelX: 2008, labelDy: 20 });
    this.stock.set('P', { type: 'line', data: P, cls: 'stock' });
    const r = HIST.find(h => h.year === Math.round(y)) || HIST[HIST.length - 1];
    this.stock.set('m', { type: 'marker', x: r.year, y: r.ppm, cls: 'stock', label: `${Math.round(r.ppm)} ppm` });
    $('c4year').textContent = Math.round(y);
    this.scrub.value = Math.round(y); syncFill(this.scrub);
    showClimateRow(r.sinks ? r : { ...r, sinks: 0 });
    status(`${Math.round(y)}`);
  },
  enter() {
    stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK] });
    this.setYear(this.year);
  },
  tick(dt) {
    if (!this.playing) return;
    const y = Math.min(NOW, this.year + dt * (reduced ? 60 : 20));
    this.setYear(y);
    if (y >= NOW) this.playing = false;
  },
};

// ── 5. the test ────────────────────────────────────────────────────
chapters.test = {
  init() {
    this.rows = runFuture(() => E0, 2100);
    const quiz = $('quiz5');
    quiz.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => this.answer(b.dataset.a, b)));
  },
  answer(a, btn) {
    const quiz = $('quiz5');
    quiz.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      b.classList.toggle('picked', b === btn);
      if (b.dataset.a === 'rise') b.classList.add('correct'); else if (b !== btn) b.classList.add('dim');
    });
    $('c5result').hidden = false;
    this.flows = new Chart($('c5flows'), { x: [1990, 2100], y: [0, 50], height: 150, yTicks: [0, 20, 40] });
    this.stock = new Chart($('c5stock'), { x: [1990, 2100], y: [300, 600], height: 170, yTicks: [300, 400, 500, 600] });
    this.flows.set('now', { type: 'vline', x: NOW, label: 'today', layer: 'back' });
    this.stock.set('now', { type: 'vline', x: NOW, layer: 'back' });
    this.stock.set('pre', { type: 'hline', y: PREINDUSTRIAL_PPM, cls: 'pre', label: 'pre-industrial', align: 'left', layer: 'back' });
    this.stock.set('today', { type: 'hline', y: this.rows[0].ppm, label: "today's level", align: 'left', layer: 'back' });
    this.choice = a;
    this.anim = 0;
    this.looper = null;
    this.feedback();
  },
  enter() {
    stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK] });
    if (!this.anim && this.anim !== 0) { showClimateRow(this.rows[0]); status(`${NOW}`); }
  },
  tick(dt) {
    if (this.anim == null) return;
    if (this.looper) { this.looper.tick(dt); return; }
    this.anim = Math.min(1, this.anim + dt / (reduced ? 1 : 5));
    const n = Math.round(this.anim * (this.rows.length - 1));
    const fut = this.rows.slice(0, n + 1);
    const hE = histSeries('E', 1990), hS = histSeries('sinks', 1990), hP = histSeries('ppm', 1990);
    this.flows.set('gap', { type: 'between', a: [...hE, ...fut.slice(1).map(r => [r.year, r.E])], b: [...hS, ...fut.slice(1).map(r => [r.year, r.sinks])], cls: 'gap', layer: 'back' });
    this.flows.set('E', { type: 'line', data: [...hE, ...fut.slice(1).map(r => [r.year, r.E])], cls: 'in', label: 'emissions (frozen)' });
    this.flows.set('S', { type: 'line', data: [...hS, ...fut.slice(1).map(r => [r.year, r.sinks])], cls: 'out solid', label: 'nature absorbs', labelDy: 18 });
    const P = [...hP, ...fut.map(r => [r.year, r.ppm])];
    this.stock.set('P', { type: 'line', data: P, cls: 'stock' });
    const last = fut[fut.length - 1];
    this.stock.set('m', { type: 'marker', x: last.year, y: last.ppm, cls: 'stock', label: `${Math.round(last.ppm)} ppm` });
    showClimateRow(last); status(`${last.year}`);
    if (this.anim >= 1) {
      this.looper = new Looper(this.rows, { seconds: 7, charts: [this.stock] });
    }
  },
  feedback() {
    const end = this.rows[this.rows.length - 1];
    const s0 = this.rows[1].sinks, s1 = end.sinks;
    const right = this.choice === 'rise';
    const fb = $('c5feedback');
    fb.className = 'reveal ' + (right ? 'good' : 'warn');
    fb.innerHTML = `<p class="verdict">${right ? '✓ Correct. It would keep rising through 2100.' : '✗ Not quite. It would keep rising through 2100.'}</p>
      ${right ? '' : '<p>Most participants in the MIT study made the same kind of error.</p>'}
      <p>Emissions would stay at ${Math.round(E0)} billion tonnes a year. The ocean and land would absorb about ${Math.round(s0)} billion tonnes now, and about ${Math.round(s1)} billion by 2100 as CO₂ builds up. Because more goes in than comes out every year, the level keeps rising, to about ${Math.round(end.ppm)} ppm by 2100, roughly double the pre-industrial level.</p>
      <p class="aside">In the ${cite(1, 'original study')}, 63 percent of participants drew CO₂ levels holding steady while emissions stayed above the rate of removal.</p>`;
  },
};

// ── 6. hold the line (game) ───────────────────────────────────────
const BAND = 8;
chapters.hold = {
  init() {
    this.stab = stabilizingEmissions(2101);
    this.stock = new Chart($('c6stock'), { x: [2025, 2100], y: [380, 480], height: 160, yTicks: [380, 400, 420, 440, 460, 480], yLabel: 'CO₂ ppm' });
    this.flows = new Chart($('c6flows'), { x: [2025, 2100], y: [0, 60], height: 130, yTicks: [0, 20, 40, 60], yLabel: 'Gt/yr' });
    this.slider = $('gSlider');
    this.slider.addEventListener('input', () => { $('gOut').textContent = `${(+this.slider.value).toFixed(1)} Gt/yr`; });
    $('gStart').addEventListener('click', () => this.start(false));
    $('gAuto').addEventListener('click', () => this.start(true));
    this.reset();
  },
  reset() {
    this.state = history().state.clone();
    this.target = this.state.ppm;
    this.rowsE = []; this.rowsS = []; this.rowsP = [[NOW, this.target]];
    this.score = 0; this.acc = 0; this.running = false;
    const lo = Math.round(this.target - BAND), hi = Math.round(this.target + BAND);
    $('bandLo').textContent = lo; $('bandHi').textContent = hi; $('bandMid').textContent = Math.round(this.target);
    this.stock.set('band', { type: 'band', y0: this.target - BAND, y1: this.target + BAND, label: `target: ${lo}–${hi} ppm`, layer: 'back' });
    this.stock.remove('P'); this.stock.remove('m');
    this.flows.remove('E'); this.flows.remove('S'); this.flows.remove('ghost');
    this.flows.set('today', { type: 'hline', y: E0, label: 'today', layer: 'back' });
    $('gYear').textContent = NOW; $('gPpm').textContent = `${Math.round(this.target)} ppm`;
    $('gScore').textContent = `0 / 75 years in band`;
    this.slider.value = E0; syncFill(this.slider); $('gOut').textContent = `${E0.toFixed(1)} Gt/yr`;
  },
  start(auto) {
    this.reset();
    this.auto = auto;
    this.running = true;
    this.countdown = auto ? 0 : 3;
    this.slider.disabled = auto;
    $('game').classList.add('running');
    $('gStart').textContent = '↺ Restart';
    $('c6feedback').hidden = true;
  },
  enter() {
    stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK] });
    if (!this.running) { showClimateRow({ E: +this.slider.value, sinks: 25.7, ppm: this.state.ppm }); status(`${this.state.year}`); }
  },
  tick(dt) {
    if (!this.running) {
      showClimateRow({ E: +this.slider.value, sinks: this.rowsS.length ? this.rowsS.at(-1)[1] : 25.7, ppm: this.state.ppm });
      if (this.state.year === NOW) { status('Paused · press Start'); $('gYear').textContent = 'Press Start'; }
      return;
    }
    if (this.countdown > 0) {
      this.countdown -= dt;
      $('gYear').textContent = this.countdown > 0 ? `Get ready… ${Math.ceil(this.countdown)}` : NOW;
      showClimateRow({ E: +this.slider.value, sinks: 25.7, ppm: this.state.ppm });
      return;
    }
    this.acc += dt;
    const yearSec = reduced ? 0.25 : 0.45;
    while (this.acc >= yearSec && this.state.year < 2100) {
      this.acc -= yearSec;
      if (this.auto) {
        const s = this.stab.find(r => r.year === this.state.year);
        this.slider.value = s.E; syncFill(this.slider); $('gOut').textContent = `${s.E.toFixed(1)} Gt/yr`;
      }
      const y = this.state.year;
      const r = this.state.step(+this.slider.value);
      this.rowsE.push([y, r.E], [y + 1, r.E]);
      this.rowsS.push([y + 0.5, r.sinks]);
      this.rowsP.push([r.year, r.ppm]);
      if (Math.abs(r.ppm - this.target) <= BAND) this.score++;
    }
    const ppm = this.state.ppm;
    this.stock.set('P', { type: 'line', data: this.rowsP, cls: 'stock' });
    this.stock.set('m', { type: 'marker', x: this.state.year, y: clamp(ppm, 380, 480), cls: 'stock' });
    this.flows.set('E', { type: 'line', data: this.rowsE, cls: 'in' });
    this.flows.set('S', { type: 'line', data: this.rowsS, cls: 'out' });
    $('gYear').textContent = this.state.year;
    $('gPpm').textContent = `${Math.round(ppm)} ppm`;
    $('gScore').textContent = `${this.score} / 75 years in band`;
    showClimateRow({ E: +this.slider.value, sinks: this.rowsS.length ? this.rowsS.at(-1)[1] : 25, ppm });
    status(`${this.state.year}`);
    if (this.state.year >= 2100) this.finish();
  },
  finish() {
    this.running = false;
    this.slider.disabled = false;
    $('game').classList.remove('running');
    const ghost = this.stab.flatMap(r => [[r.year, r.E], [r.year + 1, r.E]]);
    this.flows.set('ghost', { type: 'line', data: ghost, cls: 'ghost', label: 'holds CO₂ level', labelDy: -8 });
    const firstUser = this.rowsE[0][1];
    const lastUser = this.rowsE.at(-1)[1];
    const s0 = this.stab[0].E, s50 = this.stab.find(r => r.year === 2050).E, s100 = this.stab.at(-1).E;
    const fb = $('c6feedback');
    fb.className = 'reveal ' + (this.score >= 60 ? 'good' : 'warn');
    fb.innerHTML = `<p class="verdict">${this.auto ? 'The emissions needed to hold CO₂ steady' : `CO₂ stayed in the band for ${this.score} of 75 years.`}</p>
      ${this.auto ? '' : `<p>You began at ${firstUser.toFixed(0)} billion tonnes a year and ended at ${lastUser.toFixed(0)}.</p>`}
      <p>The dashed line shows the emissions that would hold CO₂ exactly level. They would have to fall right away to about ${s0.toFixed(0)} billion tonnes a year, a ${Math.round((1 - s0 / E0) * 100)} percent cut, and then keep falling, to about ${s50.toFixed(0)} billion by 2050 and ${s100.toFixed(0)} billion by 2100. That is about a sixth of today's level.</p>
      <p>They have to keep falling because natural uptake slows as the ocean and land take on more CO₂. The next section explains why.</p>`;
    fb.hidden = false;
  },
};

// ── 7. the drain ───────────────────────────────────────────────────
chapters.drain = {
  init() {
    this.chart = new Chart($('c7stock'), { x: [1850, 2400], y: [260, 500], height: 200, xTicks: [1900, 2000, 2100, 2200, 2300, 2400], yTicks: [280, 340, 400, 460] });
    this.chart.set('pre', { type: 'hline', y: PREINDUSTRIAL_PPM, cls: 'pre', label: 'pre-industrial', align: 'right', layer: 'back' });
    this.chart.set('hist', { type: 'line', data: histSeries('ppm'), cls: 'stock' });
    segmented($('nzTabs'), d => this.pick(+d.nz));
    this.pick(2025);
  },
  pick(nz) {
    const fn = nz === NOW ? () => 0 : linearPathway(NOW, nz);
    this.rows = runFuture(fn, 2400);
    const fut = this.rows.map(r => [r.year, r.ppm]);
    this.chart.set('fut', { type: 'area', data: fut, cls: 'stock', base: PREINDUSTRIAL_PPM, layer: 'back' });
    this.chart.set('futl', { type: 'line', data: fut, cls: 'stock' });
    if (nz !== NOW) this.chart.set('nz', { type: 'vline', x: nz, label: 'net zero', layer: 'back' }); else this.chart.remove('nz');
    let pk = this.rows[0];
    for (const r of this.rows) if (r.ppm > pk.ppm) pk = r;
    const end = this.rows.at(-1);
    this.chart.set('pk', { type: 'marker', x: pk.year, y: pk.ppm, cls: 'stock', label: `peak ${Math.round(pk.ppm)}` });
    this.chart.set('end', { type: 'marker', x: end.year, y: end.ppm, cls: 'stock', label: `${Math.round(end.ppm)} in 2400`, dy: -10 });
    const extra = (end.ppm - PREINDUSTRIAL_PPM) / (pk.ppm - PREINDUSTRIAL_PPM);
    $('c7stat').innerHTML = `Peak: ${Math.round(pk.ppm)} ppm in ${pk.year}. In 2400: ${Math.round(end.ppm)} ppm, with ${Math.round(extra * 100)} percent of the added CO₂ still in the air.`;
    this.looper = new Looper(this.rows, { seconds: 9, charts: [this.chart] });
  },
  enter() { stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK] }); },
  tick(dt) { this.looper && this.looper.tick(dt); },
};

// ── 8. warming ─────────────────────────────────────────────────────
// The two opposing effects after net zero, revealed one step at a time
const PARTS = netZeroDecomposition(100);
const signed = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}°C`;
const nzParts = {
  step: 1,
  init() {
    this.chart = new Chart($('c8parts'), { x: [0, 100], y: [-0.6, 0.6], height: 210, xTicks: [0, 25, 50, 75, 100], yTicks: [-0.6, -0.3, 0, 0.3, 0.6], xFormat: v => `${v} yr`, yFormat: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°' });
    this.chart.set('zero', { type: 'hline', y: 0, layer: 'back' });
    this.slider = $('partYear');
    this.slider.addEventListener('input', () => this.render());
    segmented($('partTabs'), d => { this.step = +d.step; this.render(); });
    this.render();
  },
  render() {
    const t = +this.slider.value, st = this.step, r = PARTS[t];
    $('partYearOut').textContent = t;
    const series = k => PARTS.map(p => [p.t, p[k]]);
    const c = this.chart;
    c.set('pushA', { type: 'area', data: series('oceanPush'), base: 0, cls: 'push' + (st === 3 ? ' faded' : ''), layer: 'back' });
    c.set('push', { type: 'line', data: series('oceanPush'), cls: 'push' + (st === 3 ? ' faded' : ''), label: 'ocean catching up', labelX: 70, labelDy: -10 });
    c.set('pullA', { type: 'area', data: series('co2Pull'), base: 0, cls: 'pull' + (st === 3 ? ' faded' : ''), hidden: st < 2, layer: 'back' });
    c.set('pull', { type: 'line', data: series('co2Pull'), cls: 'pull' + (st === 3 ? ' faded' : ''), hidden: st < 2, label: 'CO₂ falling', labelX: 70, labelDy: 18 });
    c.set('net', { type: 'line', data: series('net'), cls: 'net', hidden: st < 3, label: 'what actually happens', labelX: 30, labelDy: -10 });
    c.set('now', { type: 'vline', x: t, cls: 'playhead', layer: 'front' });
    c.set('mPush', { type: 'marker', x: t, y: r.oceanPush, cls: 'push' });
    c.set('mPull', { type: 'marker', x: t, y: r.co2Pull, cls: 'pull', hidden: st < 2 });
    c.set('mNet', { type: 'marker', x: t, y: r.net, cls: 'net', hidden: st < 3 });

    // tug of war: bars from the centre line, scaled to ±0.6 °C
    const pct = v => `${(Math.abs(v) / 0.6) * 50}%`;
    const rows = $('tug').children;
    rows[0].querySelector('.tug-bar').style.width = pct(r.oceanPush);
    rows[0].querySelector('.tug-val').textContent = signed(r.oceanPush);
    rows[1].hidden = st < 2;
    rows[1].querySelector('.tug-bar').style.width = pct(r.co2Pull);
    rows[1].querySelector('.tug-val').textContent = signed(r.co2Pull);
    rows[2].hidden = st < 3;
    rows[2].querySelector('.tug-dot').style.left = `${50 + (r.net / 0.6) * 50}%`;
    rows[2].querySelector('.tug-val').textContent = signed(r.net);

    const text = {
      1: `Imagine CO₂ stayed frozen at today's level. The planet would keep warming anyway: ${signed(r.oceanPush)} after ${t} years. So far the ocean has been soaking up a large share of the extra heat, which has kept the surface cooler than today's CO₂ would otherwise make it. As the ocean slowly warms, it soaks up less, and more of that heat stays at the surface.`,
      2: `But CO₂ doesn't stay frozen. With the tap off, the ocean and plants keep draining it, from ${Math.round(PARTS[0].ppm)} ppm to about ${Math.round(r.ppm)} ppm after ${t} years. Less CO₂ traps less heat. On its own, that would change the temperature by ${signed(r.co2Pull)} over the same ${t} years.`,
      3: `Add the two together and they nearly cancel: ${signed(r.oceanPush)} from the ocean and ${signed(r.co2Pull)} from falling CO₂ leave a net change of ${signed(r.net)} after ${t} years. The black line stays close to zero. Warming stops rising once emissions stop, but it doesn't come back down.`,
    };
    $('partText').textContent = text[st];
  },
};

chapters.heat = {
  init() {
    nzParts.init();
    this.temp = new Chart($('c8temp'), { x: [1850, 2200], y: [0, 2.5], height: 190, xTicks: [1900, 1950, 2000, 2050, 2100, 2150, 2200], yTicks: [0, 0.5, 1, 1.5, 2, 2.5], yFormat: v => `${v}°` });
    this.temp.set('l15', { type: 'hline', y: 1.5, cls: 'limit', label: '1.5°C', align: 'left', layer: 'back' });
    this.temp.set('l2', { type: 'hline', y: 2, cls: 'limit', label: '2°C', align: 'left', layer: 'back' });
    this.temp.set('hist', { type: 'line', data: histSeries('T'), cls: 'heat' });

    // one point per possible net-zero year: CO₂ emitted before it, warming when it arrives
    this.line = [[0, history().state.T]];
    for (let nz = 2030; nz <= 2100; nz++) this.line.push(this.atNetZero(nz));
    this.budget = new Chart($('c8budget'), { x: [0, 1700], y: [1.3, 2.2], height: 190, xTicks: [0, 400, 800, 1200, 1600], yTicks: [1.4, 1.6, 1.8, 2.0, 2.2], xFormat: v => `${v} Gt`, yFormat: v => `${v}°`, margin: { t: 14, r: 18, b: 30, l: 44 } });
    this.budget.set('l15', { type: 'hline', y: 1.5, cls: 'limit', label: '1.5°C', align: 'right', layer: 'back' });
    this.budget.set('l2', { type: 'hline', y: 2, cls: 'limit', label: '2°C', align: 'right', layer: 'back' });
    this.budget.set('line', { type: 'line', data: this.line, cls: 'heat' });
    this.budget.set('today', { type: 'marker', x: 0, y: this.line[0][1], cls: 'heat', r: 4, label: 'if emissions stopped today', dy: -10 });

    this.slider = $('nzSlider');
    this.slider.addEventListener('input', () => this.update(+this.slider.value));
    this.update(2050);
  },
  atNetZero(nz) {
    const rows = runFuture(linearPathway(NOW, nz), nz + 1);
    const r = rows.find(x => x.year === nz + 1) || rows.at(-1);
    return [r.cum, r.T];
  },
  update(nz) {
    $('nzOut').textContent = nz;
    const rows = runFuture(linearPathway(NOW, nz), 2200);
    const [cum, T] = this.atNetZero(nz);
    this.temp.set('fut', { type: 'line', data: rows.map(r => [r.year, r.T]), cls: 'heat' });
    this.temp.set('nz', { type: 'vline', x: nz, label: 'net zero', layer: 'back' });
    this.temp.set('pk', { type: 'marker', x: nz, y: T, cls: 'heat', label: `+${T.toFixed(2)}°C at net zero` });
    this.budget.set('today', { label: cum < 380 ? '' : 'if emissions stopped today' });
    this.budget.set('pick', { type: 'marker', x: cum, y: T, cls: 'heat', r: 7, label: `net zero in ${nz}: ${Math.round(cum)} Gt → +${T.toFixed(2)}°C`, dy: 22, layer: 'front' });
    $('c8stat').innerHTML = `Net zero in ${nz}: ${Math.round(cum)} billion tonnes emitted before then. Warming reaches ${T.toFixed(2)}°C when emissions stop, then stays roughly flat.`;
    this.looper = new Looper(rows, { seconds: 9, charts: [this.temp], withTemp: true });
  },
  enter() { stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK], thermo: true }); },
  tick(dt) { this.looper && this.looper.tick(dt); },
};

// ── 9. waiting ─────────────────────────────────────────────────────
// Remaining budgets from the start of 2026, 50% chance (Global Carbon Budget 2025)
const BUDGETS = { 1.5: 170, 1.7: 525, 2: 1055 };
chapters.wait = {
  limit: 1.7,
  init() {
    this.chart = new Chart($('c9flows'), { x: [2020, 2110], y: [0, 50], height: 200, xTicks: [2020, 2040, 2060, 2080, 2100], yTicks: [0, 10, 20, 30, 40, 50] });
    this.slider = $('waitSlider');
    this.slider.addEventListener('input', () => this.update());
    segmented($('limitTabs'), d => { this.limit = +d.limit; this.update(); });
    this.update();
  },
  update() {
    const S = +this.slider.value;
    $('waitOut').textContent = S;
    const B = BUDGETS[this.limit];
    const hist = histSeries('E', 2020);
    const ghostDur = (2 * B) / E0;
    const ghost = [[NOW, E0], [NOW + ghostDur, 0]];
    this.chart.set('ghostA', { type: 'area', data: ghost, cls: 'ghost', layer: 'back' });
    this.chart.set('ghost', { type: 'line', data: ghost, cls: 'ghost' });
    this.chart.set('hist', { type: 'line', data: hist, cls: 'in' });
    this.chart.set('start', { type: 'vline', x: S, label: S > NOW + 1 ? 'start cutting' : '', layer: 'back' });
    const used = E0 * (S - NOW);
    const R = B - used;
    const k = $('c9kpis');
    if (R <= 0) {
      const path = [[NOW, E0], [S, E0]];
      this.chart.set('pathA', { type: 'area', data: path, cls: 'in', layer: 'back' });
      this.chart.set('path', { type: 'line', data: path, cls: 'in' });
      k.innerHTML = `<div class="kpi bad"><div class="k">Budget</div><div class="v">Used up</div><div class="s">At today's rate, emissions use up the whole ${this.limit}°C budget in about ${Math.round(B / E0)} years.</div></div>
        <div class="kpi"><div class="k">Remaining option</div><div class="v">Removal</div><div class="s">Staying under the limit would require pulling CO₂ back out of the air.</div></div>`;
      this.looper = new Looper(runFuture(y => (y < S ? E0 : 0), 2100), { seconds: 8, charts: [this.chart], withTemp: true });
      return;
    }
    const dur = (2 * R) / E0;
    const nz = S + dur;
    const path = [[NOW, E0], [S, E0], [nz, 0]];
    this.chart.set('pathA', { type: 'area', data: path, cls: 'in', layer: 'back' });
    this.chart.set('path', { type: 'line', data: path, cls: 'in', label: '' });
    const cut = E0 / dur;
    const fn = y => (y < S ? E0 : y >= nz ? 0 : E0 * (1 - (y - S) / dur));
    const p = peakWarming(fn, 2110);
    k.innerHTML = `
      <div class="kpi"><div class="k">Net zero by</div><div class="v">${Math.round(nz)}</div><div class="s">If cuts began now: ${Math.round(NOW + ghostDur)}</div></div>
      <div class="kpi ${cut > 2.5 ? 'bad' : ''}"><div class="k">Cut required each year</div><div class="v">${cut.toFixed(1)} Gt</div><div class="s">${((cut / E0) * 100).toFixed(1)} percent of current emissions</div></div>
      <div class="kpi"><div class="k">For comparison</div><div class="v">≈2 Gt</div><div class="s">The ${cite(7, 'drop in 2020')}, during pandemic lockdowns, about 5 percent</div></div>
      <div class="kpi"><div class="k">Budget for ${this.limit}°C</div><div class="v">${B.toLocaleString('en-US')} Gt</div><div class="s">About ${Math.round(B / E0)} years of current emissions</div></div>`;
    this.looper = new Looper(p.rows.filter(r => r.year <= 2110), { seconds: 8, charts: [this.chart], withTemp: true });
  },
  enter() { stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK], thermo: true }); },
  tick(dt) { this.looper && this.looper.tick(dt); },
};

// ── 10. outlook ────────────────────────────────────────────────────
// Total CO₂ (energy + ~4 Gt land use). IEA WEO 2025 paths to 2050; after 2050,
// current policies are held flat and announced policies continue their 2035–2050 decline.
const SCENARIOS = {
  cps: { name: 'Current policies', short: 'current policies', iea: 'almost 3°C', fn: y => interp([[NOW, E0], [2032, 44], [2100, 44]], y) },
  steps: { name: 'Announced policies', short: 'announced policies', iea: '2.5°C', fn: y => interp([[NOW, E0], [2027, 42.5], [2035, 39], [2050, 33], [2100, 13]], y) },
  nze: { name: 'Net zero by 2050', short: 'net zero 2050', iea: 'above 1.5°C for decades, back below it by 2100', fn: y => interp([[NOW, E0], [2050, 0], [2100, 0]], y) },
};
chapters.headed = {
  init() {
    this.flows = new Chart($('c10flows'), { x: [2000, 2100], y: [0, 50], height: 190, xTicks: [2000, 2025, 2050, 2075, 2100], yTicks: [0, 10, 20, 30, 40, 50] });
    this.temp = new Chart($('c10temp'), { x: [2000, 2100], y: [0.5, 3.5], height: 190, xTicks: [2000, 2025, 2050, 2075, 2100], yTicks: [1, 1.5, 2, 2.5, 3], yFormat: v => `${v}°` });
    this.temp.set('l15', { type: 'hline', y: 1.5, cls: 'limit', label: '1.5°C', align: 'left', layer: 'back' });
    this.temp.set('l2', { type: 'hline', y: 2, cls: 'limit', label: '2°C', align: 'left', layer: 'back' });
    for (const c of [this.flows, this.temp]) c.set('now', { type: 'vline', x: NOW, label: 'today', layer: 'back' });
    this.flows.set('hist', { type: 'line', data: histSeries('E', 2000), cls: 'in' });
    this.temp.set('hist', { type: 'line', data: histSeries('T', 2000), cls: 'heat' });
    this.runs = {};
    for (const k in SCENARIOS) this.runs[k] = runFuture(SCENARIOS[k].fn, 2100);
    segmented($('scenTabs'), d => this.pick(d.scen));
    this.pick('cps');
  },
  pick(key) {
    for (const k in SCENARIOS) {
      const rows = this.runs[k], on = k === key, lbl = SCENARIOS[k].short;
      this.flows.set('s-' + k, { type: 'line', data: rows.map(r => [r.year, SCENARIOS[k].fn(r.year)]), cls: on ? 'in' : 'dim', label: lbl, labelDy: k === 'nze' ? -6 : -8, layer: on ? 'main' : 'back' });
      this.temp.set('s-' + k, { type: 'line', data: rows.map(r => [r.year, r.T]), cls: on ? 'heat' : 'dim', label: lbl, labelDy: -8, layer: on ? 'main' : 'back' });
    }
    // redraw selected lines on top
    for (const c of [this.flows, this.temp]) { const it = c.items.get('s-' + key); c.remove('s-' + key); c.set('s-' + key, { ...it, node: undefined }); }
    const rows = this.runs[key], end = rows.at(-1);
    let pk = rows[0]; for (const r of rows) if (r.T > pk.T) pk = r;
    const sc = SCENARIOS[key];
    $('c10kpis').innerHTML = `
      <div class="kpi ${end.T > 2 ? 'bad' : ''}"><div class="k">Warming in 2100, this model</div><div class="v">+${end.T.toFixed(1)}°</div><div class="s">${pk.year < 2100 ? `Peak of ${pk.T.toFixed(1)}° around ${pk.year}` : 'Still rising in 2100'}</div></div>
      <div class="kpi"><div class="k">IEA estimate</div><div class="v">${key === 'nze' ? '≈1.5°' : key === 'cps' ? '≈3°' : '2.5°'}</div><div class="s">${sc.iea}</div></div>
      <div class="kpi"><div class="k">CO₂ in 2100</div><div class="v">${Math.round(end.ppm)}</div><div class="s">ppm, compared with ${Math.round(rows[0].ppm)} today</div></div>`;
    this.looper = new Looper(rows, { seconds: 8, charts: [this.flows, this.temp], withTemp: true });
  },
  enter() { stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK], thermo: true }); },
  tick(dt) { this.looper && this.looper.tick(dt); },
};

// ── 11. sandbox ────────────────────────────────────────────────────
const PRESETS = {
  cps: SCENARIOS.cps.fn,
  steps: SCENARIOS.steps.fn,
  nz2050: y => (y >= 2050 ? 0 : E0 * (1 - (y - NOW) / 25)),
  delay: y => (y < 2040 ? E0 + 0.3 * (y - NOW) : y >= 2055 ? 0 : (E0 + 4.5) * (1 - (y - 2040) / 15)),
  removal: y => (y < 2045 ? E0 * (1 - (y - NOW) / 20) : Math.max(-12, -0.8 * (y - 2045))),
};
chapters.sandbox = {
  init() {
    this.flows = new Chart($('c11flows'), { x: [NOW, 2100], y: [-20, 60], height: 200, xTicks: [2025, 2050, 2075, 2100], yTicks: [-20, 0, 20, 40, 60], ariaLabel: 'Draw an emissions pathway' });
    this.flows.set('zero', { type: 'hline', y: 0, label: 'net zero', align: 'right', layer: 'back' });
    this.flows.set('today', { type: 'hline', y: E0, label: 'today', align: 'right', layer: 'back' });
    this.flows.enableDraw({ samples: 76, fixedStart: E0, clampY: [-20, 60], guessCls: 'in drawn', onChange: () => this.dirty = true });
    this.stock = new Chart($('c11stock'), { x: [1950, 2100], y: [280, 700], height: 160, yTicks: [300, 400, 500, 600, 700] });
    this.stock.set('pre', { type: 'hline', y: PREINDUSTRIAL_PPM, cls: 'pre', label: 'pre-industrial', align: 'left', layer: 'back' });
    this.stock.set('hist', { type: 'line', data: histSeries('ppm', 1950), cls: 'stock' });
    this.temp = new Chart($('c11temp'), { x: [1950, 2100], y: [0, 4], height: 160, yTicks: [0, 1, 1.5, 2, 3, 4], yFormat: v => `${v}°` });
    this.temp.set('l15', { type: 'hline', y: 1.5, cls: 'limit', label: '1.5°C', align: 'left', layer: 'back' });
    this.temp.set('l2', { type: 'hline', y: 2, cls: 'limit', label: '2°C', align: 'left', layer: 'back' });
    this.temp.set('hist', { type: 'line', data: histSeries('T', 1950), cls: 'heat' });
    const presetBtns = [...document.querySelectorAll('#presets button')];
    presetBtns.forEach(b => b.addEventListener('click', () => {
      presetBtns.forEach(x => x.classList.toggle('on', x === b));
      this.flows.setGuess(PRESETS[b.dataset.preset]);
      this.dirty = true;
    }));
    presetBtns[0].classList.add('on');
    this.flows.setGuess(PRESETS.cps);
    this.dirty = true;
  },
  compute() {
    const v = this.flows.guess().values;
    const E = y => { const i = clamp(Math.round(y - NOW), 0, v.length - 1); return v[i] ?? E0; };
    const rows = runFuture(E, 2100);
    this.stock.set('fut', { type: 'line', data: rows.map(r => [r.year, r.ppm]), cls: 'stock' });
    this.temp.set('fut', { type: 'line', data: rows.map(r => [r.year, r.T]), cls: 'heat' });
    let pk = rows[0]; for (const r of rows) if (r.T > pk.T) pk = r;
    const end = rows.at(-1);
    const tone = pk.T > 2 ? 'bad' : pk.T <= 1.7 ? 'good' : '';
    $('c11kpis').innerHTML = `
      <div class="kpi ${tone}"><div class="k">Peak warming</div><div class="v">+${pk.T.toFixed(2)}°</div><div class="s">${pk.year >= 2100 ? 'Still rising in 2100' : 'Around ' + pk.year}</div></div>
      <div class="kpi"><div class="k">CO₂ in 2100</div><div class="v">${Math.round(end.ppm)}</div><div class="s">ppm, compared with ${Math.round(rows[0].ppm)} today</div></div>
      <div class="kpi"><div class="k">Emitted 2025–2100</div><div class="v">${Math.round(end.cum)}</div><div class="s">billion tonnes of CO₂</div></div>`;
    this.looper = new Looper(rows, { seconds: 8, charts: [this.stock, this.temp], withTemp: true });
  },
  enter() { stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK], thermo: true }); },
  tick(dt) {
    if (this.dirty) { this.dirty = false; this.compute(); }
    this.looper && this.looper.tick(dt);
  },
};

// ── 12. end ────────────────────────────────────────────────────────
chapters.end = {
  init() {
    const fn = y => E0 * (1 - 0.3 * Math.min(1, (y - NOW) / 15));
    this.rows = runFuture(fn, 2100);
    $('quiz11').querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => this.answer(b)));
    $('restart').addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  },
  answer(btn) {
    const opts = $('quiz11').querySelectorAll('.opt');
    opts.forEach(b => {
      b.disabled = true; b.classList.toggle('picked', b === btn);
      if (b.dataset.a === 'higher') b.classList.add('correct'); else if (b !== btn) b.classList.add('dim');
    });
    const right = btn.dataset.a === 'higher';
    const end = this.rows.at(-1), start = this.rows[0];
    const fb = $('c11feedback');
    fb.className = 'reveal ' + (right ? 'good' : 'warn');
    fb.innerHTML = `<p class="verdict">${right ? '✓ Correct. It will be higher than today.' : '✗ Not quite. It will be higher than today.'}</p>
      <p>At 30 percent below today's level, the world would still emit about ${Math.round(E0 * 0.7)} billion tonnes a year, more than the ocean and land absorb. CO₂ would keep rising, to about ${Math.round(end.ppm)} ppm, and warming would increase from ${start.T.toFixed(1)}°C today to about ${end.T.toFixed(1)}°C in 2100.</p>
      <p>Cutting emissions slows the increase. It stops only when emissions reach net zero.</p>`;
    fb.hidden = false;
    this.looper = new Looper(this.rows, { seconds: 7, withTemp: true });
  },
  enter() {
    stage.setMode({ climate: true, names: CLIMATE_NAMES, marks: [PRE_MARK, TODAY_MARK], thermo: true });
    if (!this.looper) showClimateRow({ ...this.rows[0], sinks: 25.7 }, true);
  },
  tick(dt) { this.looper && this.looper.tick(dt); },
};

/* ════════════════════════════ orchestration ════════════════════════════ */
const sections = [...document.querySelectorAll('.chapter')];
for (const key in chapters) chapters[key].init && chapters[key].init();

// table of contents
const toc = $('toc');
sections.forEach((s, i) => {
  s.id = s.id || `ch-${s.dataset.ch}`;
  const li = document.createElement('li');
  li.innerHTML = `<a href="#${s.id}"><span>${i ? String(i).padStart(2, '0') + ' ' : ''}${s.dataset.title}</span></a>`;
  toc.appendChild(li);
});
const tocLinks = [...toc.querySelectorAll('a')];

let active = null;
function pickActive() {
  const desktop = innerWidth >= 960;
  const stageH = desktop ? 0 : document.querySelector('.stage-wrap').offsetHeight;
  const line = desktop ? innerHeight * 0.5 : stageH + (innerHeight - stageH) * 0.35;
  let current = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
  const key = current.dataset.ch;
  if (key !== active) {
    active = key;
    chapters[key]?.enter?.();
    const idx = sections.indexOf(current);
    tocLinks.forEach((a, i) => { a.classList.toggle('active', i === idx); a.classList.toggle('done', i < idx); });
  }
}
let scheduled = false;
addEventListener('scroll', () => {
  if (scheduled) return; scheduled = true;
  requestAnimationFrame(() => { scheduled = false; pickActive(); });
}, { passive: true });
addEventListener('resize', pickActive);
pickActive();
stage.snap();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  chapters[active]?.tick?.(dt);
  stage.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
