import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MODEL_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260929_212926_92423081-b0e4-4f5a-b650-14af6c05c058.glb';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Slides: headline words (refracted), tagline, counter ---------- */
const SLIDES = [
  { w: ['CLEAR', 'BOLD', 'FOCUSED'], t: ['Bold presence', 'without unnecessary', 'decoration.'], h: 'Clear. Bold. Focused.' },
  { w: ['STRATEGY', 'CREATIVE', 'GROWTH'], t: ['One team for', 'strategy, creative', 'and results.'], h: 'Strategy. Creative. Growth.' },
  { w: ['MODERN', 'DIRECT', 'ENERGETIC'], t: ['Short messages,', 'clear hierarchy,', 'strong contrast.'], h: 'Modern. Direct. Energetic.' }
];
let cur = 0, bgDirty = true, spinBy = () => {}, stageIdx = 0;
const tagline = document.getElementById('tagline');
const dotsEl = [...document.querySelectorAll('.dot')];

function showSlide(i) {
  const s = SLIDES[i];
  tagline.classList.add('swap');
  setTimeout(() => {
    tagline.innerHTML = `${s.t[0]}<br>${s.t[1]}<br><strong>${s.t[2]}</strong>`;
    tagline.classList.remove('swap');
  }, RM ? 0 : 300);
  document.getElementById('count').textContent = String(i + 1).padStart(2, '0');
  document.getElementById('h1').textContent = s.h;
  dotsEl.forEach((d, n) => { d.classList.toggle('active', n === i); n === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'); });
  bgDirty = true;
  window.dispatchEvent(new Event('slidechange'));
}
function goTo(i, spin) {
  i = (i + SLIDES.length) % SLIDES.length;
  if (i === cur) return;
  spinBy(spin !== undefined ? spin : (i - cur) * Math.PI / 2);
  cur = i;
  showSlide(i);
}
/* Scrolling through the pinned hero changes the slide; the dots scroll to a slide */
const wrap = document.getElementById('heroWrap');
const range = () => wrap.offsetHeight - innerHeight;
const wrapTop = () => wrap.getBoundingClientRect().top + scrollY;
function scrollToSlide(i) {
  i = (i + SLIDES.length) % SLIDES.length;
  scrollTo({ top: wrapTop() + ((i + 0.5) / SLIDES.length) * range(), behavior: RM ? 'auto' : 'smooth' });
}
function onScroll() {
  const p = Math.min(1, Math.max(0, (scrollY - wrapTop()) / range()));
  goTo(Math.min(SLIDES.length - 1, Math.floor(p * SLIDES.length)));
  sectionFx();
}
const secs = ['heroWrap', 'about', 'services', 'process', 'contact'].map(id => document.getElementById(id));
function sectionFx() {
  const y = innerHeight * 0.55;
  let s = 0;
  secs.forEach((el, i) => { if (el.getBoundingClientRect().top <= y) s = i; });
  if (s !== stageIdx) { stageIdx = s; window.dispatchEvent(new Event('stagechange')); }
  const st = document.getElementById('steps'), r = st.getBoundingClientRect();
  st.style.setProperty('--p', Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + 80))).toFixed(3));
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
dotsEl.forEach((d, n) => d.addEventListener('click', () => scrollToSlide(n)));

/* ---------- WebGL glass cube ---------- */
function initGL() {
  const canvas = document.getElementById('scene');
  const loaderEl = document.getElementById('loader');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0x092C51);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const DPR = Math.min(window.devicePixelRatio, 2);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const scene = new THREE.Scene();
  const bgScene = new THREE.Scene();

  // One scene for the whole page: the cube moves and the refracted words change per section
  const STAGE_WORDS = [null, ['ONE', 'CLEAR', 'MESSAGE'], ['WHAT', 'WE', 'DO'], ['BRIEF', 'TO', 'RESULTS'], ['START', 'A', 'PROJECT']];
  const STAGES = [   // desktop [x, y, height share, width share], mobile [..]
    { d: [.517, .488, .44, .29], m: [.5, .45, .44, .45] },
    { d: [.82, .5, .38, .24], m: [.82, .14, .2, .26] },
    { d: [.18, .5, .38, .24], m: [.18, .14, .2, .26] },
    { d: [.82, .5, .38, .24], m: [.82, .14, .2, .26] },
    { d: [.5, .2, .3, .2], m: [.5, .1, .18, .24] }
  ];
  let stage = 0, view = { w: 1, h: 1, visH: 1, visW: 1, mobile: false };
  const pose = { sx: .5, sy: .5, s: 0 }, tgt = { sx: .5, sy: .5, s: 0 };
  const words = () => stage === 0 ? SLIDES[cur].w : STAGE_WORDS[stage];
  function setTarget(snap) {
    const d = STAGES[stage][view.mobile ? 'm' : 'd'];
    tgt.sx = d[0]; tgt.sy = d[1];
    tgt.s = Math.min(view.h * d[2], view.w * d[3]) / view.h * view.visH;
    if (snap) Object.assign(pose, tgt);
  }

  // Headline drawn to a 2D canvas, used as the refracted background
  const textCanvas = document.createElement('canvas');
  const ctx = textCanvas.getContext('2d');
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.colorSpace = THREE.SRGBColorSpace;
  textTex.minFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;

  function drawHeadline() {
    const w = window.innerWidth, h = window.innerHeight, d = Math.min(window.devicePixelRatio, 2);
    const cw = w * d, ch = h * d;
    textCanvas.width = cw; textCanvas.height = ch;
    ctx.fillStyle = '#092C51'; ctx.fillRect(0, 0, cw, ch);
    const mobile = w < 768 || w / h < 1;
    let fs = Math.min(ch * 0.21, cw * (mobile ? 0.21 : 0.118));
    ctx.font = `800 ${fs}px Manrope, sans-serif`;
    const lines = words();
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const limitW = cw * (mobile ? 0.9 : 0.5);
    if (maxW > limitW) { fs *= limitW / maxW; ctx.font = `800 ${fs}px Manrope, sans-serif`; }
    const cx = cw * (mobile ? 0.5 : 0.505), cy = ch * (mobile ? 0.45 : 0.468);
    const gap = fs * 1.07, cap = fs * 0.7;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => ctx.fillText(line, cx, cy + cap / 2 + (i - (lines.length - 1) / 2) * gap));
    textTex.needsUpdate = true;
    bgDirty = true;
  }

  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: textTex } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: `uniform sampler2D uTex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTex, vUv); #include <colorspace_fragment> }`,
    depthTest: false, depthWrite: false
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false;
  bgScene.add(bgQuad);

  const glassVert = `
    varying vec3 vNormal; varying vec3 vEye;
    void main(){
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vec4 mvPos = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPos;
      vNormal = normalize(normalMatrix * normal);
      vEye = normalize(mvPos.xyz);
    }`;
  const glassFrag = `
    uniform sampler2D uTexture; uniform vec2 uResolution; uniform float uBackside, uRefractPower, uChromatic, uSaturation, uShininess, uDiffuseness, uFresnelPower; uniform vec3 uLight;
    varying vec3 vNormal; varying vec3 vEye;
    float specular(vec3 n, vec3 l, vec3 e, float sh, float d){ vec3 h = normalize(l - e); return pow(max(dot(n, h), 0.0), sh) + max(0.0, dot(n, l)) * d; }
    float luma(vec3 c){ return dot(c, vec3(0.2125, 0.7154, 0.0721)); }
    void main(){
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec3 n = normalize(vNormal); if (uBackside > 0.5) n = -n;
      vec3 eye = normalize(vEye);
      vec3 color = vec3(0.0);
      vec2 refR = refract(eye, n, 1.0/1.15).xy, refY = refract(eye, n, 1.0/1.16).xy, refG = refract(eye, n, 1.0/1.18).xy;
      vec2 refC = refract(eye, n, 1.0/1.22).xy, refB = refract(eye, n, 1.0/1.22).xy, refP = refract(eye, n, 1.0/1.22).xy;
      for (int i = 0; i < 16; i++) {
        float slide = float(i) / 16.0 * 0.045;
        vec3 tR = texture2D(uTexture, uv + refR * (uRefractPower + slide * 1.0) * uChromatic).rgb;
        vec3 tY = texture2D(uTexture, uv + refY * (uRefractPower + slide * 1.0) * uChromatic).rgb;
        vec3 tG = texture2D(uTexture, uv + refG * (uRefractPower + slide * 2.0) * uChromatic).rgb;
        vec3 tC = texture2D(uTexture, uv + refC * (uRefractPower + slide * 2.5) * uChromatic).rgb;
        vec3 tB = texture2D(uTexture, uv + refB * (uRefractPower + slide * 3.0) * uChromatic).rgb;
        vec3 tP = texture2D(uTexture, uv + refP * (uRefractPower + slide * 1.0) * uChromatic).rgb;
        float r = tR.r * 0.5, y = (tY.r * 2.0 + tY.g * 2.0 - tY.b) / 6.0, g = tG.g * 0.5;
        float c = (tC.g * 2.0 + tC.b * 2.0 - tC.r) / 6.0, b = tB.b * 0.5, p = (tP.b * 2.0 + tP.r * 2.0 - tP.g) / 6.0;
        color += vec3(r + (2.0*p + 2.0*y - c) / 3.0, g + (2.0*y + 2.0*c - p) / 3.0, b + (2.0*c + 2.0*p - y) / 3.0);
      }
      color /= 16.0;
      color = mix(vec3(luma(color)), color, uSaturation);
      vec3 lightVec = normalize(-uLight);
      float spec = specular(n, lightVec, eye, uShininess, uDiffuseness) + 0.6 * specular(n, normalize(vec3(1,1,-1)), eye, uShininess * 0.6, uDiffuseness * 0.5);
      color += spec * (uBackside > 0.5 ? 0.35 : 1.0);
      float f = pow(1.0 + dot(eye, n), uFresnelPower);
      color = mix(color, vec3(1.0), f * (uBackside > 0.5 ? 0.25 : 0.55));
      color += vec3(0.004, 0.005, 0.007);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`;
  const res = new THREE.Vector2(1, 1);
  const uniforms = back => ({
    uTexture: { value: null }, uResolution: { value: res }, uBackside: { value: back ? 1 : 0 },
    uRefractPower: { value: back ? 0.22 : 0.30 }, uChromatic: { value: 0.5 }, uSaturation: { value: 1.08 },
    uShininess: { value: 90 }, uDiffuseness: { value: 0.02 }, uFresnelPower: { value: 5.0 }, uLight: { value: new THREE.Vector3(-1, 1, 1) }
  });
  const backMat = new THREE.ShaderMaterial({ vertexShader: glassVert, fragmentShader: glassFrag, uniforms: uniforms(true), side: THREE.BackSide });
  const frontMat = new THREE.ShaderMaterial({ vertexShader: glassVert, fragmentShader: glassFrag, uniforms: uniforms(false), side: THREE.FrontSide });

  const pivot = new THREE.Group(), spinner = new THREE.Group();
  spinner.rotation.set(-0.42, 0.62, 0.18);
  scene.add(pivot); pivot.add(spinner);
  let cubeMesh = null;

  function applyModel(geometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox, c = box.getCenter(new THREE.Vector3());
    geometry.translate(-c.x, -c.y, -c.z);
    const s = box.getSize(new THREE.Vector3());
    const m = Math.max(s.x, s.y, s.z);
    geometry.scale(1 / m, 1 / m, 1 / m);
    cubeMesh = new THREE.Mesh(geometry, frontMat);
    spinner.add(cubeMesh);
    loaderEl.classList.add('done');
    layout();
  }
  const fallbackCube = () => applyModel(new RoundedBoxGeometry(1, 1, 1, 8, 0.12));
  new GLTFLoader().load(MODEL_URL, gltf => {
    const geos = [];
    gltf.scene.traverse(ch => {
      if (!ch.isMesh) return;
      let g = ch.geometry.clone();
      ['uv', 'color', 'tangent'].forEach(a => g.deleteAttribute(a));
      g = mergeVertices(g, 1e-4); g.computeVertexNormals(); g.applyMatrix4(ch.matrixWorld);
      geos.push(g);
    });
    geos.length ? applyModel(mergeGeometries(geos, false)) : fallbackCube();
  }, undefined, fallbackCube);

  const rtBack = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const rtFront = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });

  function layout() {
    const w = window.innerWidth, h = window.innerHeight, d = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(d); renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    rtBack.setSize(w * d, h * d); rtFront.setSize(w * d, h * d);
    res.set(w * d, h * d);
    drawHeadline();
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10, visW = visH * camera.aspect;
    view = { w, h, visH, visW, mobile: w < 768 || w / h < 1 };
    setTarget(true);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('slidechange', drawHeadline);
  window.addEventListener('stagechange', () => {
    stage = stageIdx; setTarget(false); spinBy(Math.PI / 2); drawHeadline();
  });

  // Interaction: drag to rotate (vertical swipes still scroll the page on touch)
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
  let dragging = false, lx = 0, ly = 0, vx = 0, vy = 0, remaining = 0, idle = 0;
  const rot = (x, y) => spinner.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AY, x)).premultiply(new THREE.Quaternion().setFromAxisAngle(AX, y));
  spinBy = a => { remaining += a; idle = 0; vx = vy = 0; };
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lx = e.clientX; ly = e.clientY; vx = vy = 0; remaining = 0; idle = 0;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    vx = (e.clientX - lx) * 0.008; vy = (e.clientY - ly) * 0.008;
    lx = e.clientX; ly = e.clientY; idle = 0;
    rot(vx, vy);
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let last = performance.now();
  function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - last) / 1000, 0.05); last = time;
    const r = canvas.getBoundingClientRect();
    if (!(r.bottom > 0 && r.top < window.innerHeight)) return;   // pause when hero is off-screen

    if (!dragging) {
      if (Math.abs(remaining) > 0.0005) {
        const step = remaining * Math.min(1, 0.09 * dt * 60);
        rot(step, 0); remaining -= step;
      } else {
        if (Math.abs(vx) > 1e-4 || Math.abs(vy) > 1e-4) {
          rot(vx, vy);
          const damp = Math.pow(0.94, dt * 60); vx *= damp; vy *= damp;
        }
        idle += dt;
        if (!RM && idle > 0.6) {
          const b = Math.min(1, (idle - 0.6) / 1.0);
          rot(0.0035 * b * dt * 60, 0.0012 * b * dt * 60);
        }
      }
    }
    const k = RM ? 1 : 0.07;   // glide to the current section's pose
    pose.sx += (tgt.sx - pose.sx) * k; pose.sy += (tgt.sy - pose.sy) * k; pose.s += (tgt.s - pose.s) * k;
    pivot.position.set((pose.sx - 0.5) * view.visW, (0.5 - pose.sy) * view.visH, 0);
    pivot.scale.setScalar(Math.max(pose.s, 1e-4));
    if (!cubeMesh) {
      renderer.setRenderTarget(null); renderer.clear(); renderer.render(bgScene, camera);
      return;
    }
    if (bgDirty) {                      // the background only changes with the slide or a resize
      renderer.setRenderTarget(rtBack); renderer.clear(); renderer.render(bgScene, camera);
      bgDirty = false;
    }
    renderer.setRenderTarget(rtFront); renderer.clear(); renderer.render(bgScene, camera);
    cubeMesh.material = backMat; backMat.uniforms.uTexture.value = rtBack.texture;
    renderer.autoClear = false; renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(bgScene, camera);
    renderer.clearDepth();
    cubeMesh.material = frontMat; frontMat.uniforms.uTexture.value = rtFront.texture;
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }

  Promise.race([
    Promise.all([document.fonts.load('800 100px Manrope'), document.fonts.ready]),
    new Promise(r => setTimeout(r, 2500))
  ]).then(() => { layout(); last = performance.now(); animate(last); });
}

try {
  const t = document.createElement('canvas');
  if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('no webgl');
  initGL();
} catch (e) {
  document.documentElement.classList.add('no-gl');   // CSS shows a static headline instead
}

/* ---------- Reveal on scroll ---------- */
const rv = document.querySelectorAll('.rv');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.15 });
  rv.forEach(el => io.observe(el));
} else rv.forEach(el => el.classList.add('in'));

/* ---------- Nav: a red dot slides to the hovered link, then back to the current section ---------- */
const navUl = document.querySelector('.nav-links'), navDot = document.querySelector('.nav-dot');
const navA = [...navUl.querySelectorAll('a')];
const NAV_MAP = { 1: '#about', 2: '#services', 3: '#services', 4: '#contact' };
let navActive = null;
function placeDot(a) {
  if (!a) { navDot.style.opacity = 0; return; }
  const u = navUl.getBoundingClientRect(), r = a.getBoundingClientRect();
  navDot.style.transform = `translateX(${(r.left - u.left + r.width / 2 - 4).toFixed(1)}px)`;
  navDot.style.opacity = 1;
}
function setActive() {
  navActive = navA.find(a => a.getAttribute('href') === NAV_MAP[stageIdx]) || null;
  navA.forEach(a => a.classList.toggle('on', a === navActive));
  placeDot(navActive);
}
navA.forEach(a => {
  a.addEventListener('pointerenter', () => placeDot(a));
  a.addEventListener('pointerleave', () => placeDot(navActive));
});
window.addEventListener('stagechange', setActive);
addEventListener('resize', setActive);
setActive();

/* ---------- Count-up stats ---------- */
document.querySelectorAll('[data-count]').forEach(el => {
  const end = +el.dataset.count, suf = el.dataset.suffix || '';
  new IntersectionObserver((en, o) => en.forEach(x => {
    if (!x.isIntersecting) return;
    o.disconnect();
    if (RM) return;
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: 0.6 }).observe(el);
});

/* ---------- Card tilt and spotlight ---------- */
document.querySelectorAll('.card').forEach(c => {
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
    if (!RM) { c.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 10).toFixed(2) + 'deg'); }
  });
  c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
});
onScroll();

/* ---------- Contact: two-step form ---------- */
const form = document.getElementById('form');
const steps = [...form.querySelectorAll('.fstep')];
const toast = document.getElementById('toast');
const TIERS = ['Under $2k', '$2k to $5k', '$5k to $10k', '$10k to $25k', '$25k+'];
const TITLES = { 1: 'About you', 2: 'Your project' };
// Paste your Google Apps Script web app URL here to receive messages in a Sheet and by email
const FORM_ENDPOINT = '';
let toastT = 0, summary = '';

function say(msg) {
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2200);
}
function copyText(t, msg) {
  const done = () => say(msg);
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => say('Copy failed'));
  else { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) { say('Copy failed'); } a.remove(); }
}
function showStep(n) {
  steps.forEach(s => s.classList.toggle('on', n === 'done' ? s.id === 'done' : s.dataset.step == n));
  document.getElementById('bar').style.width = n === 1 ? '50%' : '100%';
  document.getElementById('stepl').style.display = n === 'done' ? 'none' : '';
  if (n !== 'done') { document.getElementById('stepn').textContent = n; document.getElementById('stept').textContent = TITLES[n]; }
}
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function check(input, ok) { input.closest('.fld').classList.toggle('bad', !ok); return ok; }
form.addEventListener('input', e => { const f = e.target.closest('.fld'); if (f) f.classList.remove('bad'); });

form.querySelector('[data-next]').addEventListener('click', () => {
  const n = form.elements.name, em = form.elements.email;
  const a = check(n, n.value.trim() !== ''), b = check(em, emailOk(em.value.trim()));
  if (a && b) showStep(2); else (a ? em : n).focus();
});
form.querySelector('[data-back]').addEventListener('click', () => showStep(1));

const chips = document.getElementById('chips');
chips.addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
  chips.classList.remove('bad');
});
const budget = document.getElementById('budget');
function setBudget() {
  budget.style.setProperty('--v', (budget.value / 4 * 100) + '%');
  document.getElementById('bud').textContent = TIERS[budget.value];
}
budget.addEventListener('input', setBudget); setBudget();
const msg = document.getElementById('f-msg');
msg.addEventListener('input', () => { document.getElementById('cnt').textContent = msg.value.length; });

form.addEventListener('submit', e => {
  e.preventDefault();
  const picked = [...chips.querySelectorAll('[aria-pressed=true]')].map(c => c.textContent);
  const okS = picked.length > 0, okM = check(msg, msg.value.trim() !== '');
  chips.classList.toggle('bad', !okS);
  if (!okS || !okM) { (okS ? msg : chips.querySelector('.chip')).focus(); return; }
  const d = new FormData(form);
  summary = 'Name: ' + d.get('name') + '\nEmail: ' + d.get('email') + (d.get('company') ? '\nCompany: ' + d.get('company') : '') +
    '\nServices: ' + picked.join(', ') + '\nBudget: ' + TIERS[budget.value] + '\n\n' + d.get('msg');
  const payload = { name: d.get('name'), email: d.get('email'), company: d.get('company') || '', services: picked.join(', '), budget: TIERS[budget.value], msg: d.get('msg') };
  const btn = document.getElementById('send');
  btn.classList.add('loading'); btn.textContent = 'Sending';
  const reset = () => { btn.classList.remove('loading'); btn.textContent = 'Send message'; };
  const finish = viaEmail => {
    reset();
    document.getElementById('donetxt').textContent = viaEmail
      ? "Your email app should open with your brief ready to send. If it doesn't, copy the summary and email it to hello@dronze.com."
      : 'Your message has been sent. We will reply within one business day.';
    showStep('done');
  };
  if (FORM_ENDPOINT) {
    fetch(FORM_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(() => finish(false))
      .catch(() => { reset(); say('Could not send. Please try again.'); });
  } else {
    setTimeout(() => {   // no endpoint set yet: fall back to the visitor's email app
      finish(true);
      location.href = 'mailto:hello@dronze.com?subject=' + encodeURIComponent('New project from ' + payload.name) + '&body=' + encodeURIComponent(summary);
    }, RM ? 0 : 900);
  }
});
document.getElementById('copysum').addEventListener('click', () => copyText(summary, 'Summary copied'));
document.getElementById('again').addEventListener('click', () => {
  form.reset(); setBudget(); document.getElementById('cnt').textContent = '0';
  chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
  showStep(1);
});
document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
  copyText(b.dataset.copy, 'Email copied'); b.querySelector('em').textContent = 'Copied';
  setTimeout(() => { b.querySelector('em').textContent = 'Copy'; }, 1800);
}));
/* Magnetic buttons */
if (!RM) form.querySelectorAll('.submit').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 10}px,${((e.clientY - r.top) / r.height - .5) * 8}px)`; });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
});
document.getElementById('year').textContent = new Date().getFullYear();
