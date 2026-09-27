// The 3D tank: a glass tub with a tap, a drain, a level, and (later) a thermometer.
// Chapters drive it through setMode() and setState(); it eases toward targets itself.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const W = 3.0, D = 1.7, H = 1.6, WALL = 0.045, R = 0.3;
const Y0 = 0.46;                       // bottom of tank interior
const HI = H - 0.02;                   // usable interior height
const SPOUT = new THREE.Vector3(-1.05, 2.34, -0.36);
const OUTLET = new THREE.Vector3(1.84, 0.4, 0.3);

function rrect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

const streamVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const streamFrag = /* glsl */`
  uniform float uTime; uniform vec3 uColor; uniform float uOpacity; uniform float uSpeed;
  varying vec2 vUv;
  void main(){
    float a = 0.62 + 0.22*sin(vUv.y*46.0 + uTime*uSpeed + sin(vUv.x*18.85)*1.4)
                   + 0.14*sin(vUv.y*13.0 + uTime*uSpeed*0.6);
    float edge = pow(abs(sin(vUv.x*3.14159)), 0.35);
    vec3 c = mix(uColor, vec3(1.0), 0.35*edge);
    gl_FragColor = vec4(c, clamp(a,0.0,1.0)*uOpacity);
  }`;
const surfFrag = /* glsl */`
  uniform float uTime; uniform vec3 uColor; uniform vec3 uHi; uniform vec2 uImpact; uniform float uFlow; uniform float uOpacity;
  varying vec3 vP;
  void main(){
    vec2 p = vP.xy;
    float d = distance(p, uImpact);
    float rings = sin(d*34.0 - uTime*7.0) * exp(-d*2.4) * uFlow;
    float c = sin(p.x*7.0 + uTime*0.8) * sin(p.y*9.0 - uTime*0.6) + 0.6*sin((p.x - p.y)*5.0 + uTime*1.1);
    float k = clamp(0.45 + 0.18*c + 0.5*rings, 0.0, 1.0);
    vec3 col = mix(uColor, uHi, k*0.32);
    gl_FragColor = vec4(col, uOpacity*(0.9 + 0.1*rings));
  }`;
const surfVert = /* glsl */`
  varying vec3 vP;
  void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export class Stage {
  constructor(container) {
    this.container = container;
    this.t = 0;
    this.visible = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // targets (set by chapters) and eased current values
    this.target = { inflow: 0.5, outflow: 0.5, level: 0.4, temp: 0 };
    this.cur = { ...this.target };
    this.mode = { climate: 0 };
    this.climateMix = 0;

    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'stage-labels';
    container.appendChild(this.labels.domElement);

    const scene = this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.lookAt = new THREE.Vector3(0.3, 1.2, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c3, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-3, 6, 4); scene.add(key);

    this._build();
    this._readTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this._readTheme());
    // an explicit light/dark choice is stamped on the root element as data-theme
    new MutationObserver(() => this._readTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    this.pointer = new THREE.Vector2();
    addEventListener('pointermove', e => {
      this.pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    }, { passive: true });

    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);
  }

  _build() {
    const s = this.scene;
    const g = this.g = new THREE.Group();
    s.add(g);

    // glass walls (open top) + floor
    const outer = rrect(W, D, R);
    const wallShape = rrect(W, D, R);
    wallShape.holes.push(rrect(W - 2 * WALL, D - 2 * WALL, R - WALL));
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: H, bevelEnabled: false, curveSegments: 20 });
    wallGeo.rotateX(-Math.PI / 2);
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2,
      clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
    });
    const walls = new THREE.Mesh(wallGeo, this.glassMat);
    walls.position.y = Y0 - 0.02; walls.renderOrder = 5;
    g.add(walls);

    const floorGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.06, bevelEnabled: false, curveSegments: 20 });
    floorGeo.rotateX(-Math.PI / 2);
    this.baseMat = new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.55, metalness: 0.0 });
    const floor = new THREE.Mesh(floorGeo, this.baseMat);
    floor.position.y = Y0 - 0.08;
    g.add(floor);

    // rim highlight
    const rimPts = rrect(W, D, R).getPoints(80).map(p => new THREE.Vector3(p.x, 0, -p.y));
    this.rimMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rimPts), this.rimMat);
    rim.position.y = Y0 - 0.02 + H;
    g.add(rim);

    // plinth
    this.plinthMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7 });
    for (const x of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, Y0 - 0.08, D - 0.3), this.plinthMat);
      leg.position.set(x, (Y0 - 0.08) / 2, 0);
      g.add(leg);
    }

    // soft contact shadow
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const grd = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = grd; cx.fillRect(0, 0, 128, 128);
    this.shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.5 });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.4), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002;
    g.add(shadow);

    // water body (unit height, scaled)
    const inner = rrect(W - 2 * WALL - 0.01, D - 2 * WALL - 0.01, R - WALL - 0.005);
    const waterGeo = new THREE.ExtrudeGeometry(inner, { depth: 1, bevelEnabled: false, curveSegments: 20 });
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x2c63c9, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.92,
      clearcoat: 0.4, envMapIntensity: 0.12, depthWrite: false,
    });
    this.water = new THREE.Mesh(waterGeo, this.waterMat);
    this.water.position.y = Y0; this.water.renderOrder = 2;
    g.add(this.water);

    // water surface shimmer
    const surfGeo = new THREE.ShapeGeometry(inner, 24);
    this.surfMat = new THREE.ShaderMaterial({
      vertexShader: surfVert, fragmentShader: surfFrag, transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uHi: { value: new THREE.Color() },
        uImpact: { value: new THREE.Vector2(SPOUT.x, -SPOUT.z) }, uFlow: { value: 0.5 }, uOpacity: { value: 1 },
      },
    });
    this.surface = new THREE.Mesh(surfGeo, this.surfMat);
    this.surface.rotation.x = -Math.PI / 2; this.surface.renderOrder = 3;
    g.add(this.surface);

    // tap
    this.chromeMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16 });
    const tapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, 0.0, -1.18), new THREE.Vector3(-1.05, 1.9, -1.18),
      new THREE.Vector3(-1.05, 2.46, -1.05), new THREE.Vector3(-1.05, 2.56, -0.62),
      new THREE.Vector3(-1.05, 2.42, -0.38), new THREE.Vector3(SPOUT.x, SPOUT.y, SPOUT.z),
    ], false, 'catmullrom', 0.3);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(tapCurve, 90, 0.058, 18), this.chromeMat));
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 10, 24), this.chromeMat);
    lip.position.copy(SPOUT); lip.rotation.x = Math.PI / 2; g.add(lip);
    // valve wheel
    this.wheel = new THREE.Group();
    const accent = this.valveMat = new THREE.MeshStandardMaterial({ color: 0xd9782d, roughness: 0.4 });
    this.wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 40), accent));
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), accent);
      spoke.rotation.z = (i * Math.PI) / 3; this.wheel.add(spoke);
    }
    this.wheel.rotation.x = Math.PI / 2;
    this.wheel.position.set(-1.05, 2.66, -0.86);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), this.chromeMat);
    stem.position.set(-1.05, 2.6, -0.86); g.add(stem);
    g.add(this.wheel);

    // drain pipe on the right wall
    const drainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.42, Y0 + 0.12, OUTLET.z), new THREE.Vector3(1.7, Y0 + 0.12, OUTLET.z),
      new THREE.Vector3(1.82, Y0 + 0.05, OUTLET.z), new THREE.Vector3(OUTLET.x, OUTLET.y, OUTLET.z),
    ], false, 'catmullrom', 0.2);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(drainCurve, 40, 0.055, 16), this.chromeMat));
    this.drainValveMat = new THREE.MeshStandardMaterial({ color: 0x2a8c7e, roughness: 0.4 });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 20), this.drainValveMat);
    collar.rotation.z = Math.PI / 2; collar.position.set(1.62, Y0 + 0.12, OUTLET.z); g.add(collar);
    const grate = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), this.plinthMat);
    grate.rotation.x = -Math.PI / 2; grate.position.set(OUTLET.x, 0.004, OUTLET.z); g.add(grate);

    // streams
    const mkStream = () => {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
      geo.translate(0, -0.5, 0);
      const mat = new THREE.ShaderMaterial({
        vertexShader: streamVert, fragmentShader: streamFrag, transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0.85 }, uSpeed: { value: 16 } },
      });
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 4; return m;
    };
    this.streamIn = mkStream(); this.streamIn.position.copy(SPOUT); g.add(this.streamIn);
    this.streamOut = mkStream(); this.streamOut.position.copy(OUTLET); g.add(this.streamOut);

    // splash rings
    this.rings = [];
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), this.ringMat.clone());
      r.rotation.x = -Math.PI / 2; r.position.set(SPOUT.x, 0, SPOUT.z); r.renderOrder = 4;
      r.userData.phase = i / 3; this.rings.push(r); g.add(r);
    }

    // CO2 "molecules" for the climate chapters
    const N = 140;
    this.molMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    this.mols = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), this.molMat, N);
    this.molData = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * (W - 0.4), z: (Math.random() - 0.5) * (D - 0.4), y: Math.random(),
      s: Math.random() * Math.PI * 2, v: 0.5 + Math.random(),
    }));
    this.mols.renderOrder = 6;
    g.add(this.mols);
    this._m4 = new THREE.Matrix4();

    // CO₂ carried in by the tap and out by the drain (climate chapters)
    const NS_ = 36;
    this.dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const mkDrops = () => {
      const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 8, 6), this.dropMat, NS_);
      m.userData.seeds = Array.from({ length: NS_ }, (_, i) => ({ p: i / NS_, j: Math.random() * Math.PI * 2 }));
      m.renderOrder = 7; g.add(m); return m;
    };
    this.dropsIn = mkDrops();
    this.dropsOut = mkDrops();

    // level marks
    this.marks = new THREE.Group(); g.add(this.marks);
    this.markPts = rrect(W + 0.03, D + 0.03, R + 0.015).getPoints(80).map(p => new THREE.Vector3(p.x, 0, -p.y));

    // labels
    const mkTag = (cls) => {
      const div = document.createElement('div');
      div.className = 'tag ' + cls;
      div.innerHTML = '<span class="tag-name"></span><span class="tag-val"></span><span class="tag-trend" aria-hidden="true"></span>';
      const obj = new CSS2DObject(div);
      g.add(obj);
      return { obj, div, name: div.children[0], val: div.children[1], trend: div.children[2], last: null, dir: 0, until: 0 };
    };
    this.tagIn = mkTag('tag-in'); this.tagIn.obj.position.set(-1.05, 2.84, -0.86);
    this.tagOut = mkTag('tag-out'); this.tagOut.obj.position.set(OUTLET.x + 0.22, 0.22, OUTLET.z); this.tagOut.obj.center.set(0, 0.5);
    this.tagLevel = mkTag('tag-level');

    // thermometer (HTML)
    const th = document.createElement('div');
    th.className = 'thermo';
    th.innerHTML = `<div class="thermo-head"><span>Warming</span><b class="thermo-val">+1.4°C</b></div>
      <div class="thermo-bar"><div class="thermo-fill"></div>
      <div class="thermo-tick l" style="--v:0.3333"><span>1.5°</span></div>
      <div class="thermo-tick r" style="--v:0.5"><span>2°</span></div>
      <div class="thermo-tick" style="--v:0.8333"><span>3°</span></div></div>`;
    this.container.appendChild(th);
    this.thermo = th;
  }

  _readTheme() {
    this.colors = {
      water: cssColor('--water', '#2c63c9'),
      waterHi: cssColor('--water-hi', '#9cc3ff'),
      co2: cssColor('--co2-fluid', '#4b5670'),
      co2Hi: cssColor('--co2-hi', '#c9cfdd'),
      mol: cssColor('--co2-mol', '#f2c59a'),
      base: cssColor('--plinth-top', '#eeeae2'),
      plinth: cssColor('--plinth', '#2a2f36'),
      inflow: cssColor('--c-in', '#d9782d'),
      outflow: cssColor('--c-out', '#2a8c7e'),
    };
    const theme = document.documentElement.dataset.theme;
    const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    this.baseMat.color.copy(this.colors.base);
    this.plinthMat.color.copy(this.colors.plinth);
    this.valveMat.color.copy(this.colors.inflow);
    this.drainValveMat.color.copy(this.colors.outflow);
    this.molMat.color.copy(this.colors.mol);
    this.dropMat.color.copy(this.colors.mol);
    this.shadowMat.opacity = dark ? 0.7 : 0.45;
    this.glassMat.opacity = dark ? 0.07 : 0.2;
    this.waterMat.envMapIntensity = dark ? 0.04 : 0.12;
    this.glassMat.envMapIntensity = dark ? 0.5 : 1.6;
    this.rimMat.opacity = dark ? 0.35 : 0.8;
    this.markColor = dark ? 0xffffff : 0x1d2127;
  }

  _resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    // fit the rig (≈5.4 wide, ≈3.2 tall) into view
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const narrow = this.camera.aspect < 1.4;
    // In a tall, narrow stage there is room below the outlet but not beside it
    if (narrow) { this.tagOut.obj.position.set(OUTLET.x - 0.1, -0.12, OUTLET.z + 0.2); this.tagOut.obj.center.set(0.5, 0); }
    else { this.tagOut.obj.position.set(OUTLET.x + 0.22, 0.22, OUTLET.z); this.tagOut.obj.center.set(0, 0.5); }
    this.container.classList.toggle('compact', w < 480);
    // fit ~3.8 units of height (floor to tap label) and ~5.6 of width (tap to drain label)
    this.dist = narrow
      ? Math.max(2.1 / t, 2.45 / (t * this.camera.aspect))
      : Math.max(2.05 / t, 2.8 / (t * this.camera.aspect));
    // on small wide stages (phones) nudge the view right so the drain label stays inside
    this.lookAt.set(narrow ? 0.3 : w < 480 ? 0.95 : 0.35, narrow ? 1.3 : 1.42, 0);
    this.camera.updateProjectionMatrix();
  }

  // ---- API ----------------------------------------------------------------
  setMode({ climate = false, names = {}, marks = [], thermo = false } = {}) {
    this.mode.climate = climate ? 1 : 0;
    this.tagIn.name.textContent = names.in ?? 'Tap';
    this.tagOut.name.textContent = names.out ?? 'Drain';
    this.tagLevel.name.textContent = names.level ?? 'Level';
    this.thermo.classList.toggle('on', !!thermo);
    this.container.classList.toggle('climate', !!climate);
    // rebuild marks
    for (const c of [...this.marks.children]) {
      c.traverse(o => { if (o.isCSS2DObject) o.element.remove(); });
      this.marks.remove(c);
    }
    for (const m of marks) {
      const grp = new THREE.Group();
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(this.markPts),
        new THREE.LineDashedMaterial({ color: this.markColor, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.45 }));
      line.computeLineDistances();
      grp.add(line);
      const div = document.createElement('div');
      div.className = 'mark-label'; div.textContent = m.label;
      const lab = new CSS2DObject(div); lab.position.set(-W / 2 + 0.12, 0, D / 2); lab.center.set(0, 1.25);
      grp.add(lab);
      grp.position.y = Y0 + m.frac * HI;
      this.marks.add(grp);
    }
  }

  // inflow/outflow are 0..1 visual strengths; level 0..1 of tank; texts for tags
  setState({ inflow, outflow, level, inText, outText, levelText, temp }) {
    if (inflow != null) this.target.inflow = inflow;
    if (outflow != null) this.target.outflow = outflow;
    if (level != null) this.target.level = Math.max(0, Math.min(1, level));
    if (temp != null) this.target.temp = temp;
    if (inText != null) this._text(this.tagIn, inText);
    if (outText != null) this._text(this.tagOut, outText);
    if (levelText != null) this._text(this.tagLevel, levelText);
  }

  // update a tag's value and remember which way its number moved (for the ▲/▼ arrow)
  _text(tag, text) {
    const n = parseFloat(text.replace(/[^0-9.\-]/g, ''));
    if (tag.last != null && Number.isFinite(n) && n !== tag.last && text.includes('removed') === tag.lastRemoved) {
      tag.dir = Math.sign(n - tag.last);
      tag.until = this.t + 0.9;
    }
    tag.last = Number.isFinite(n) ? n : null;
    tag.lastRemoved = text.includes('removed');
    tag.val.textContent = text;
  }

  // snap instead of easing (e.g. when a chapter resets)
  snap() {
    Object.assign(this.cur, this.target);
    for (const tg of [this.tagIn, this.tagOut, this.tagLevel]) tg.until = 0;
  }

  frame(dt) {
    if (!this.visible || document.hidden) return;
    const motion = this.reduced ? 0.25 : 1;
    this.t += dt * motion;
    const k = 1 - Math.exp(-dt * 10);
    for (const key in this.target) this.cur[key] += (this.target[key] - this.cur[key]) * k;
    this.climateMix += (this.mode.climate - this.climateMix) * (1 - Math.exp(-dt * 3));
    const { inflow, outflow, level } = this.cur;

    // water
    const lh = Math.max(0.002, level * HI);
    this.water.scale.y = lh;
    this.surface.position.y = Y0 + lh + 0.001;
    const cm = this.climateMix;
    this.waterMat.color.copy(this.colors.water).lerp(this.colors.co2, cm);
    this.waterMat.opacity = 0.92 - 0.1 * cm;
    const u = this.surfMat.uniforms;
    u.uTime.value = this.t; u.uFlow.value = Math.min(1, inflow * 1.4);
    u.uColor.value.copy(this.colors.water).lerp(this.colors.co2, cm);
    u.uHi.value.copy(this.colors.waterHi).lerp(this.colors.co2Hi, cm);

    // streams: radius ~ sqrt(flow)
    const streamColor = this.colors.waterHi.clone().lerp(this.colors.co2Hi, cm);
    const rIn = inflow > 0.004 ? 0.012 + 0.07 * Math.sqrt(inflow) : 0;
    const lenIn = SPOUT.y - (Y0 + lh);
    this.streamIn.visible = rIn > 0;
    this.streamIn.scale.set(rIn, Math.max(0.01, lenIn), rIn);
    this.streamIn.material.uniforms.uTime.value = this.t;
    this.streamIn.material.uniforms.uColor.value.copy(streamColor);
    const rOut = outflow > 0.004 && level > 0.002 ? 0.012 + 0.07 * Math.sqrt(outflow) : 0;
    this.streamOut.visible = rOut > 0;
    this.streamOut.scale.set(rOut, OUTLET.y - 0.01, rOut);
    this.streamOut.material.uniforms.uTime.value = this.t;
    this.streamOut.material.uniforms.uColor.value.copy(streamColor);

    this.wheel.rotation.z = -inflow * Math.PI * 1.5;

    for (const r of this.rings) {
      const p = (this.t * 0.9 + r.userData.phase) % 1;
      const s = 0.05 + p * (0.18 + 0.35 * inflow);
      r.scale.set(s, s, s);
      r.position.y = Y0 + lh + 0.004;
      r.material.opacity = (1 - p) * 0.55 * Math.min(1, inflow * 2) * (rIn > 0 ? 1 : 0);
    }

    // molecules drift inside the "air"
    this.molMat.opacity = 0.75 * cm;
    this.mols.visible = cm > 0.02;
    if (this.mols.visible) {
      this.molData.forEach((m, i) => {
        const y = Y0 + 0.05 + m.y * Math.max(0, lh - 0.1);
        const x = m.x + Math.sin(this.t * 0.4 * m.v + m.s) * 0.06;
        const z = m.z + Math.cos(this.t * 0.35 * m.v + m.s) * 0.06;
        const sc = lh > 0.1 ? 1 : 0;
        this._m4.makeScale(sc, sc, sc).setPosition(x, y + Math.sin(this.t * m.v + m.s) * 0.02, z);
        this.mols.setMatrixAt(i, this._m4);
      });
      this.mols.instanceMatrix.needsUpdate = true;
    }

    // arrows showing which way each number is moving
    for (const tg of [this.tagIn, this.tagOut, this.tagLevel]) {
      const on = this.t < tg.until;
      tg.trend.textContent = on ? (tg.dir > 0 ? '▲' : '▼') : '';
      tg.trend.dataset.dir = on ? (tg.dir > 0 ? 'up' : 'down') : '';
    }

    // CO₂ particles riding the streams: more particles for a bigger flow
    this.dropMat.opacity = 0.95 * cm;
    const runDrops = (mesh, flow, from, toY, radius, speed) => {
      mesh.visible = cm > 0.02 && flow > 0.004;
      if (!mesh.visible) return;
      const n = mesh.count;
      const active = Math.round(n * Math.min(1, flow * 1.6));
      mesh.userData.seeds.forEach((sd, i) => {
        const p = (sd.p + this.t * speed) % 1;
        const sc = i < active ? 1 : 0;
        const y = from.y + (toY - from.y) * p;
        this._m4.makeScale(sc, sc, sc).setPosition(from.x + Math.cos(sd.j) * radius * 0.6, y, from.z + Math.sin(sd.j) * radius * 0.6);
        mesh.setMatrixAt(i, this._m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    runDrops(this.dropsIn, inflow, SPOUT, Y0 + lh, rIn, 0.55);
    runDrops(this.dropsOut, rOut > 0 ? outflow : 0, OUTLET, 0.02, rOut, 0.8);

    // level tag follows the surface, on the front-right corner
    // kept above the drain tag when the tank is nearly empty
    this.tagLevel.obj.position.set(W / 2 + 0.1, Y0 + Math.max(lh, 0.42), D / 2 - 0.1);

    // warming gauge (0.5..3.5 °C mapped to 0..1)
    const tv = Math.max(0, Math.min(1, (this.cur.temp - 0.5) / 3));
    this.thermo.style.setProperty('--t', tv.toFixed(4));
    this.thermo.querySelector('.thermo-val').textContent = `+${this.cur.temp.toFixed(2)}°C`;

    // camera: slow breathing + pointer parallax
    const px = this.reduced ? 0 : this.pointer.x, py = this.reduced ? 0 : this.pointer.y;
    const az = 0.2 + Math.sin(this.t * 0.12) * 0.06 + px * 0.18;
    const el = 0.33 + py * 0.05;
    const c = this.camera;
    c.position.set(
      this.lookAt.x + Math.sin(az) * Math.cos(el) * this.dist,
      this.lookAt.y + Math.sin(el) * this.dist,
      this.lookAt.z + Math.cos(az) * Math.cos(el) * this.dist,
    );
    c.lookAt(this.lookAt);

    this.renderer.render(this.scene, c);
    this.labels.render(this.scene, c);
  }
}
