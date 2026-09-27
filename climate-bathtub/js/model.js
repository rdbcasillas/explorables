// A small, honest climate model for the explorable.
//
// Carbon: the Joos et al. (2013) multi-model impulse response for CO2 —
//   the same curve IPCC AR5 uses. A pulse of CO2 splits into four "boxes"
//   that decay on different timescales (one effectively never, on human scales).
// Heat: a two-layer energy balance model (surface + deep ocean),
//   in the style of Held et al. (2010) / Geoffroy et al. (2013).
// Non-CO2 influences (methane, aerosols, …) are folded in as a fixed
//   fraction of CO2 forcing. This is a teaching model, not a forecast.

export const PPM_TO_GTC = 2.124;           // 1 ppm CO2 = 2.124 GtC
export const GTC_TO_GTCO2 = 3.664;
export const PPM_TO_GTCO2 = PPM_TO_GTC * GTC_TO_GTCO2; // ≈ 7.78 GtCO2 per ppm
export const PREINDUSTRIAL_PPM = 284;
export const START_YEAR = 1850;
export const NOW = 2025;

// Joos et al. 2013, Table 5 (PI100 multi-model mean)
const A = [0.2173, 0.2240, 0.2824, 0.2763];
// Timescales are scaled by ALPHA, as FaIR does, so the historical record is
// reproduced (the raw Joos response is tuned for today's weaker sinks).
export let ALPHA = 0.3;
const TAU = [Infinity, 394.4, 36.54, 4.304].map(t => t * ALPHA);
const DECAY = TAU.map(t => (t === Infinity ? 1 : Math.exp(-1 / t)));
// exact integral of a constant 1-yr inflow into a decaying box
const GAIN = TAU.map(t => (t === Infinity ? 1 : t * (1 - Math.exp(-1 / t))));

// Two-layer energy balance (per year steps)
// Heat parameters are calibrated so the model matches observed human-caused warming
// (about 1.37°C in 2024) and roughly reproduces the IEA WEO 2025 scenario projections.
export const P = {
  F2X: 3.93,      // W/m² for doubled CO2 (AR6)
  LAMBDA: 1.0,    // W/m²/K climate feedback
  C_UP: 8.0,      // upper layer heat capacity, W·yr/m²/K
  C_DEEP: 100,    // deep ocean heat capacity
  GAMMA: 1.3,     // heat exchange with the deep ocean
  NON_CO2: 0.1,   // other forcings, as a fraction of CO2 forcing
};

// Historical total CO2 emissions (fossil + land use), GtCO2/yr.
// Anchors approximated from the Global Carbon Budget 2025.
const HIST = [
  [1850, 2.9], [1870, 3.6], [1890, 4.9], [1900, 5.6], [1910, 7.2], [1920, 7.6],
  [1930, 8.6], [1940, 9.9], [1950, 11.6], [1955, 13.0], [1960, 15.2], [1965, 17.6],
  [1970, 20.3], [1975, 22.0], [1980, 24.3], [1985, 24.6], [1990, 27.2], [1995, 28.6],
  [2000, 30.3], [2005, 34.4], [2010, 38.0], [2015, 39.6], [2019, 41.6], [2020, 39.6],
  [2021, 41.2], [2022, 41.4], [2023, 42.0], [2024, 42.4], [2025, 42.2],
];

// Observed CO2 (ppm) for comparison / annotation
export const OBSERVED_PPM = [
  [1850, 285], [1900, 296], [1950, 311], [1960, 317], [1970, 326], [1980, 339],
  [1990, 354], [2000, 369], [2010, 390], [2020, 414], [2024, 424], [2025, 426],
];

export function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export const historicalEmissions = y => interp(HIST, y);

function forcing(ppm) {
  return (P.F2X / Math.log(2)) * Math.log(ppm / PREINDUSTRIAL_PPM) * (1 + P.NON_CO2);
}

// A simulation state that can be stepped one year at a time.
export class ClimateState {
  constructor() {
    this.year = START_YEAR;
    this.boxes = [0, 0, 0, 0]; // excess ppm held in each box
    this.T = 0.0;              // surface warming, °C above 1850-1900
    this.Td = 0.0;             // deep ocean warming
    this.cumulative = 0;       // GtCO2 emitted since START_YEAR
  }
  clone() {
    const s = new ClimateState();
    s.year = this.year; s.boxes = [...this.boxes]; s.T = this.T; s.Td = this.Td;
    s.cumulative = this.cumulative;
    return s;
  }
  get ppm() { return PREINDUSTRIAL_PPM + this.boxes.reduce((a, b) => a + b, 0); }

  // Advance one year with emissions E (GtCO2/yr). Returns flows for that year.
  step(E) {
    const before = this.ppm;
    const inPpm = E / PPM_TO_GTCO2;
    for (let i = 0; i < 4; i++) {
      this.boxes[i] = this.boxes[i] * DECAY[i] + A[i] * inPpm * GAIN[i];
    }
    const after = this.ppm;
    const growth = (after - before) * PPM_TO_GTCO2; // GtCO2 that stayed in the air
    const sinks = E - growth;                        // what oceans & land took up

    const F = forcing(after);
    const dT = (F - P.LAMBDA * this.T - P.GAMMA * (this.T - this.Td)) / P.C_UP;
    const dTd = (P.GAMMA * (this.T - this.Td)) / P.C_DEEP;
    this.T += dT; this.Td += dTd;
    this.cumulative += E;
    this.year += 1;
    return { year: this.year, E, sinks, ppm: after, T: this.T };
  }

  // Advance one year with CO₂ held exactly where it is: only the heat side moves.
  stepFixedCO2() {
    const F = forcing(this.ppm);
    const dT = (F - P.LAMBDA * this.T - P.GAMMA * (this.T - this.Td)) / P.C_UP;
    const dTd = (P.GAMMA * (this.T - this.Td)) / P.C_DEEP;
    this.T += dT; this.Td += dTd;
    this.year += 1;
    return { year: this.year, E: 0, sinks: 0, ppm: this.ppm, T: this.T };
  }
}

// What happens after emissions stop today, split into its two opposing parts.
//   oceanPush: warming if CO₂ were frozen at today's level (the ocean catching up)
//   co2Pull:   the extra cooling because CO₂ actually falls once the tap is off
//   net:       what actually happens (the sum of the two)
export function netZeroDecomposition(years = 100) {
  const frozen = history().state.clone();
  const real = history().state.clone();
  const T0 = real.T;
  const out = [{ t: 0, oceanPush: 0, co2Pull: 0, net: 0, ppm: real.ppm }];
  for (let t = 1; t <= years; t++) {
    const f = frozen.stepFixedCO2();
    const r = real.step(0);
    out.push({ t, oceanPush: f.T - T0, co2Pull: r.T - f.T, net: r.T - T0, ppm: r.ppm });
  }
  return out;
}

// Run history once and cache the state at the start of NOW.
let _history = null;
export function resetCache() { _history = null; _budgetCache.clear(); }
export function history() {
  if (_history) return _history;
  const s = new ClimateState();
  const rows = [{ year: START_YEAR, E: historicalEmissions(START_YEAR), sinks: 0, ppm: s.ppm, T: 0 }];
  while (s.year < NOW) {
    rows.push(s.step(historicalEmissions(s.year)));
  }
  _history = { rows, state: s.clone() };
  return _history;
}

// Run a future scenario. emissionsFn(year) -> GtCO2/yr. Returns rows from NOW.
export function runFuture(emissionsFn, endYear = 2100, from = null) {
  const s = (from || history().state).clone();
  const cum0 = s.cumulative;
  const rows = [{ year: s.year, E: historicalEmissions(s.year), sinks: null, ppm: s.ppm, T: s.T, cum: 0 }];
  while (s.year < endYear) {
    const r = s.step(emissionsFn(s.year));
    r.cum = s.cumulative - cum0;
    rows.push(r);
  }
  return rows;
}

// Emissions that keep CO2 exactly flat at the current level (inverse model).
export function stabilizingEmissions(endYear = 2100) {
  const s = history().state.clone();
  const target = s.ppm;
  const out = [];
  while (s.year < endYear) {
    // decay of existing boxes this year
    let decayed = 0;
    for (let i = 0; i < 4; i++) decayed += s.boxes[i] * (1 - DECAY[i]);
    const gainSum = A.reduce((acc, a, i) => acc + a * GAIN[i], 0);
    const inPpm = decayed / gainSum;
    const E = inPpm * PPM_TO_GTCO2;
    out.push({ year: s.year, E });
    s.step(E);
  }
  void target;
  return out;
}

// Fraction of a CO2 pulse still in the air after t years
export const airborneFraction = t =>
  A.reduce((acc, a, i) => acc + a * (TAU[i] === Infinity ? 1 : Math.exp(-t / TAU[i])), 0);

// Peak warming for a pathway that declines linearly from today to zero at netZeroYear.
export function linearPathway(startCutYear, netZeroYear, level = historicalEmissions(NOW)) {
  return y => {
    if (y < startCutYear) return level;
    if (y >= netZeroYear) return 0;
    return level * (1 - (y - startCutYear) / (netZeroYear - startCutYear));
  };
}

export function peakWarming(emissionsFn, endYear = 2200) {
  const rows = runFuture(emissionsFn, endYear);
  let peak = -Infinity, peakYear = NOW;
  for (const r of rows) if (r.T > peak) { peak = r.T; peakYear = r.year; }
  return { peak, peakYear, rows, cum: rows[rows.length - 1].cum };
}

// Remaining budget (GtCO2 from NOW) for a warming limit, found with the model itself.
const _budgetCache = new Map();
export function modelBudget(limit) {
  if (_budgetCache.has(limit)) return _budgetCache.get(limit);
  const E0 = historicalEmissions(NOW);
  let lo = 0.2, hi = 200; // years to reach zero with a straight-line decline
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const { peak } = peakWarming(linearPathway(NOW, NOW + mid, E0), NOW + 400);
    if (peak > limit) hi = mid; else lo = mid;
  }
  const budget = E0 * lo / 2;
  _budgetCache.set(limit, budget);
  return budget;
}
