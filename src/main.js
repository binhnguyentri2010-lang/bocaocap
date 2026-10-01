import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCity, nodeCoord, SPAN } from './city.js';
import { createTraffic } from './traffic.js';
import { createSky } from './sky.js';
import { createRain } from './rain.js';
import { Ambience } from './audio.js';
import { clamp, lerp, smooth } from './utils.js';

// ---------------------------------------------------------------------------
// Device / quality
// ---------------------------------------------------------------------------
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
const quality = {
  low: isTouch || (navigator.hardwareConcurrency || 8) <= 4,
  maxPR: isTouch ? 1.5 : 1.75,
};
quality.traffic = quality.low ? { bikes: 440, cars: 40, buses: 5 } : { bikes: 700, cars: 60, buses: 8 };

const loadingEl = document.getElementById('loading');
const canvas = document.getElementById('scene');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  loadingEl.querySelector('p').textContent = 'Trình duyệt này không hỗ trợ WebGL 😢';
  loadingEl.querySelector('.spinner').remove();
  throw e;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPR);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.002);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 4000);

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const city = createCity(quality);
const traffic = createTraffic(quality.traffic);
const sky = createSky();
const rain = createRain(quality);
scene.add(sky.group, city.group, traffic.group, rain.group);

const sun = new THREE.DirectionalLight(0xffffff, 1);
const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(sun, sun.target, hemi);

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.low ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.6, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Environment presets (0 = sunset, 1 = night)
// ---------------------------------------------------------------------------
const C = (hex) => new THREE.Color(hex);
const PRESET = [
  {
    skyTop: C('#3d5aa8'), horizon: C('#ffa45c'), skyBottom: C('#5a3a3a'),
    sunColor: C('#ffb060'), lightColor: C('#ffc08a'), lightIntensity: 2.8,
    skyAmb: C('#8c84b0'), groundAmb: C('#6a4a3c'),
    fogColor: C('#e8a080'), fogDensity: 0.00105,
    cloudColor: C('#ff9a78'), cloudAmt: 0.6,
    sunVis: 1, moonVis: 0, stars: 0,
    windowLit: 0.32, windowGlow: 0.95, shop: 0.7, lamps: 0.6,
    exposure: 1.1, bloom: 0.45,
  },
  {
    skyTop: C('#0b1238'), horizon: C('#4a3478'), skyBottom: C('#1a1228'),
    sunColor: C('#000000'), lightColor: C('#9fb4ff'), lightIntensity: 0.7,
    skyAmb: C('#3a3a6c'), groundAmb: C('#2a1a22'),
    fogColor: C('#2c2550'), fogDensity: 0.0015,
    cloudColor: C('#3a3266'), cloudAmt: 0.4,
    sunVis: 0, moonVis: 1, stars: 1,
    windowLit: 0.62, windowGlow: 1.1, shop: 1, lamps: 1.15,
    exposure: 1.15, bloom: 0.62,
  },
];
const SUN_DIR = new THREE.Vector3(-0.55, 0.055, -0.83).normalize();
const SUN_LIGHT_DIR = new THREE.Vector3(-0.55, 0.22, -0.8).normalize();
const MOON_DIR = new THREE.Vector3(0.45, 0.55, -0.7).normalize();

const env = {
  skyTop: new THREE.Color(), horizon: new THREE.Color(), skyBottom: new THREE.Color(),
  sunColor: new THREE.Color(), lightColor: new THREE.Color(), skyAmb: new THREE.Color(),
  groundAmb: new THREE.Color(), fogColor: new THREE.Color(), cloudColor: new THREE.Color(),
  sunDir: SUN_DIR.clone(), moonDir: MOON_DIR.clone(), lightDir: new THREE.Vector3(),
  lightIntensity: 1, fogDensity: 0.002, cloudAmt: 0.5, sunVis: 1, moonVis: 0, stars: 0,
  windowLit: 0.3, windowGlow: 1.5, shop: 0.5, lamps: 0.5, exposure: 1, bloom: 0.6,
  night: 0, rain: 0, wet: 0, flash: 0,
};

const grey = new THREE.Color();
function soak(c, k, darken) {
  // desaturate + darken a colour for rainy weather
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  grey.setRGB(l, l, l);
  c.lerp(grey, k * 0.7).multiplyScalar(1 - k * darken);
}

function computeEnv(t, r) {
  const a = PRESET[0], b = PRESET[1];
  const tt = smooth(t);
  for (const k of ['skyTop', 'horizon', 'skyBottom', 'sunColor', 'lightColor', 'skyAmb', 'groundAmb', 'fogColor', 'cloudColor']) {
    env[k].lerpColors(a[k], b[k], tt);
  }
  for (const k of ['lightIntensity', 'fogDensity', 'cloudAmt', 'sunVis', 'moonVis', 'stars', 'windowLit', 'windowGlow', 'shop', 'lamps', 'exposure', 'bloom']) {
    env[k] = lerp(a[k], b[k], tt);
  }
  env.night = tt;
  env.lightDir.lerpVectors(SUN_LIGHT_DIR, MOON_DIR, tt).normalize();

  // rain
  env.rain = r;
  soak(env.skyTop, r, 0.25);
  soak(env.horizon, r, 0.35);
  soak(env.fogColor, r, 0.3);
  soak(env.cloudColor, r, 0.2);
  env.cloudColor.lerp(env.fogColor, r * 0.5);
  env.fogDensity *= 1 + r * 0.9;
  env.cloudAmt = lerp(env.cloudAmt, 1.35, r);
  env.sunVis *= 1 - r * 0.85;
  env.moonVis *= 1 - r * 0.95;
  env.stars *= 1 - r;
  env.lightIntensity *= 1 - r * 0.55;
  env.windowLit += r * 0.06;
}

// ---------------------------------------------------------------------------
// Settings & state
// ---------------------------------------------------------------------------
const STORE = 'chill-city-v2';
const settings = { time: 0, rain: false, rainAmt: 0.65, auto: true, view: 1, sound: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || '{}'), { sound: false }); } catch (_) { /* ignore */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (_) { /* ignore */ } };

const state = {
  t: settings.time,          // current blend sunset→night
  r: settings.rain ? settings.rainAmt : 0,
  wet: settings.rain ? settings.rainAmt : 0,
  flash: 0,
  nextStrike: 15,
  strikeSeq: [],
};

const ambience = new Ambience();

// ---------------------------------------------------------------------------
// Camera & views
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 700;
controls.maxPolarAngle = 1.45;
controls.autoRotateSpeed = 0.35;
controls.rotateSpeed = isTouch ? 0.6 : 0.8;
controls.zoomSpeed = 0.8;
controls.target.set(0, 12, 0);

const VIEWS = [
  { name: 'Toàn cảnh', kind: 'orbit', pos: new THREE.Vector3(250, 150, 270), target: new THREE.Vector3(0, 12, 0) },
  { name: 'Tầng thấp', kind: 'orbit', pos: new THREE.Vector3(128, 32, 178), target: new THREE.Vector3(128, 2, 100) },
  { name: 'Dạo phố', kind: 'cruise' },
  { name: 'Theo xe', kind: 'follow' },
];

// cruise path: a rounded loop along the road centre lines around downtown
const cruisePath = (() => {
  const lo = nodeCoord(2), hi = nodeCoord(6), r = 12;
  const corners = [[lo, hi], [hi, hi], [hi, lo], [lo, lo]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4], c = corners[(k + 2) % 4];
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const start = a.clone().addScaledVector(d1, r), end = b.clone().addScaledVector(d1, -r);
    for (let s = 0; s < 6; s++) pts.push(start.clone().lerp(end, s / 6));
    // rounded corner: quadratic bezier with the intersection as control point
    const p0 = end, p2 = b.clone().addScaledVector(d2, r);
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const it = 1 - t;
      pts.push(p0.clone().multiplyScalar(it * it).addScaledVector(b, 2 * it * t).addScaledVector(p2, t * t));
    }
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
})();
const cruiseLen = cruisePath.getLength();
let cruiseS = 0;
let followIdx = 3;

const tween = { active: false, t: 0, dur: 2.2, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toPos: new THREE.Vector3(), toTarget: new THREE.Vector3() };
const camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();

function adjustFov() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 64 : aspect < 1.4 ? 55 : 50;
  camera.updateProjectionMatrix();
}

function applyView(idx, instant = false) {
  settings.view = idx;
  const v = VIEWS[idx];
  document.getElementById('viewLabel').textContent = v.name;
  document.getElementById('btnView').title = `Góc nhìn: ${v.name} (V)`;
  if (v.kind === 'orbit') {
    controls.enabled = true;
    if (instant) {
      camera.position.copy(v.pos);
      controls.target.copy(v.target);
      tween.active = false;
    } else {
      tween.active = true;
      tween.t = 0;
      tween.fromPos.copy(camera.position);
      tween.fromTarget.copy(camLook.lengthSq() ? camLook : controls.target);
      tween.toPos.copy(v.pos);
      tween.toTarget.copy(v.target);
    }
  } else {
    controls.enabled = false;
    tween.active = false;
    if (v.kind === 'follow') followIdx = (followIdx + 11) % traffic.bikeCount;
  }
  updateAutoBtn();
  save();
}

function updateCamera(dt) {
  const v = VIEWS[settings.view];
  const k = 1 - Math.exp(-dt * 2.5);
  if (v.kind === 'orbit') {
    if (tween.active) {
      tween.t += dt / tween.dur;
      const e = smooth(clamp(tween.t, 0, 1));
      camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
      // lift the path so we never dive through buildings
      camera.position.y += Math.sin(e * Math.PI) * 60;
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
      camera.lookAt(controls.target);
      if (tween.t >= 1) tween.active = false;
    } else {
      controls.autoRotate = settings.auto;
      controls.update();
    }
    camLook.copy(controls.target);
  } else if (v.kind === 'cruise') {
    cruiseS = (cruiseS + dt * 6.5) % cruiseLen;
    const u = cruiseS / cruiseLen;
    cruisePath.getPointAt(u, tmpV);
    cruisePath.getPointAt((u + 18 / cruiseLen) % 1, tmpV2);
    tmpV.y = 4.2 + Math.sin(cruiseS * 0.05) * 0.6;
    tmpV2.y = 7.5;
    camera.position.lerp(tmpV, camera.position.distanceTo(tmpV) > 60 ? 1 : k * 2);
    camLook.lerp(tmpV2, camLook.distanceTo(tmpV2) > 60 ? 1 : k);
    camera.lookAt(camLook);
  } else {
    let car = traffic.carPose(followIdx, tmpV, tmpV2);
    // if our rider wanders to the quiet outskirts, hop onto someone downtown
    if (Math.max(Math.abs(tmpV.x), Math.abs(tmpV.z)) > 170) {
      for (let k = 0; k < 40; k++) {
        const idx = Math.floor(Math.random() * traffic.bikeCount);
        traffic.carPose(idx, tmpV, tmpV2);
        if (Math.max(Math.abs(tmpV.x), Math.abs(tmpV.z)) < 90) { followIdx = idx; break; }
      }
      car = traffic.carPose(followIdx, tmpV, tmpV2);
    }
    tmpV3.copy(tmpV).addScaledVector(tmpV2, -(3 + car.len * 2)).setY(2.6 + car.len * 0.4);
    tmpV.addScaledVector(tmpV2, 8).setY(1.4);
    const far = camera.position.distanceTo(tmpV3) > 80;
    camera.position.lerp(tmpV3, far ? 1 : k);
    camLook.lerp(tmpV, far ? 1 : k * 1.6);
    camera.lookAt(camLook);
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const timeBtns = [...document.querySelectorAll('[data-time]')];
const rainGroup = document.querySelector('.rain-group');

function updateTimeBtns() {
  timeBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.time) === settings.time));
  document.body.classList.toggle('night', settings.time === 1);
}
function updateRainBtn() {
  $('btnRain').classList.toggle('on', settings.rain);
  rainGroup.classList.toggle('on', settings.rain);
  $('rainAmt').value = settings.rainAmt;
}
function updateSoundBtn() {
  $('btnSound').classList.toggle('on', settings.sound);
  $('btnSound').querySelector('.ico').textContent = settings.sound ? '🔊' : '🔇';
}
function updateAutoBtn() {
  const orbit = VIEWS[settings.view].kind === 'orbit';
  $('btnAuto').classList.toggle('on', settings.auto && orbit);
  $('btnAuto').disabled = !orbit;
  $('btnAuto').style.opacity = orbit ? '' : '0.4';
}

function setTime(t) { settings.time = t; updateTimeBtns(); save(); }
function toggleRain() { settings.rain = !settings.rain; updateRainBtn(); save(); }
function toggleAuto() { settings.auto = !settings.auto; updateAutoBtn(); save(); }
async function toggleSound() {
  settings.sound = !settings.sound;
  updateSoundBtn();
  const ok = await ambience.setEnabled(settings.sound);
  if (!ok && settings.sound) { settings.sound = false; updateSoundBtn(); }
}
function nextView() { applyView((settings.view + 1) % VIEWS.length); }

const fsEl = document.documentElement;
const canFS = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
if (!canFS) $('btnFull').style.display = 'none';
function toggleFullscreen() {
  const cur = document.fullscreenElement || document.webkitFullscreenElement;
  if (cur) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl);
}

timeBtns.forEach((b) => b.addEventListener('click', () => setTime(Number(b.dataset.time))));
$('btnRain').addEventListener('click', toggleRain);
$('rainAmt').addEventListener('input', (e) => { settings.rainAmt = Number(e.target.value); save(); });
$('btnSound').addEventListener('click', toggleSound);
$('btnAuto').addEventListener('click', toggleAuto);
$('btnView').addEventListener('click', nextView);
$('btnFull').addEventListener('click', toggleFullscreen);
$('btnHide').addEventListener('click', (e) => { e.stopPropagation(); goIdle(); });

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === '1') setTime(0);
  else if (k === '2') setTime(1);
  else if (k === 'r') toggleRain();
  else if (k === 'm') toggleSound();
  else if (k === 'a') toggleAuto();
  else if (k === 'v') nextView();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'h') goIdle();
  else return;
  wake();
});

// auto-hide UI when idle
let idleTimer = 0;
function goIdle() { document.body.classList.add('idle'); clearTimeout(idleTimer); }
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(goIdle, isTouch ? 6000 : 4500);
}
window.addEventListener('pointerdown', wake);
window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') wake(); });
window.addEventListener('wheel', wake, { passive: true });
setTimeout(() => $('hint').classList.add('gone'), 12000);

// clock
function tickClock() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 10000);

// ---------------------------------------------------------------------------
// Resize & adaptive quality
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  adjustFov();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));

const perf = { frames: 0, time: 0, warmup: 4 };
document.addEventListener('visibilitychange', () => { perf.frames = 0; perf.time = 0; perf.warmup = 1.5; });
function adaptQuality(dt) {
  if (perf.warmup > 0) { perf.warmup -= dt; return; }
  perf.frames++;
  perf.time += dt;
  if (perf.time < 2.5) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0;
  perf.time = 0;
  if (fps < 42) {
    if (pixelRatio > 0.9) {
      pixelRatio = Math.max(0.85, pixelRatio - 0.2);
      renderer.setPixelRatio(pixelRatio);
      composer.setPixelRatio(pixelRatio);
      onResize();
    } else if (bloom.enabled) {
      bloom.enabled = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;

  // ease environment toward the chosen settings
  state.t += (settings.time - state.t) * (1 - Math.exp(-dt * 1.1));
  const rTarget = settings.rain ? settings.rainAmt : 0;
  state.r += (rTarget - state.r) * (1 - Math.exp(-dt * 0.9));
  // roads get wet quickly and dry slowly
  const wetRate = rTarget > state.wet ? 0.35 : 0.06;
  state.wet += (Math.min(1, rTarget * 1.3) - state.wet) * (1 - Math.exp(-dt * wetRate));

  // lightning in heavier rain
  if (state.r > 0.55) {
    state.nextStrike -= dt;
    if (state.nextStrike <= 0) {
      state.nextStrike = 14 + Math.random() * 30;
      state.strikeSeq = [0, 0.12, 0.32].slice(0, 2 + Math.floor(Math.random() * 2)).map((d) => elapsed + d);
      ambience.thunder(0.6 + state.r * 0.6);
    }
  }
  state.flash *= Math.exp(-dt * 14);
  while (state.strikeSeq.length && state.strikeSeq[0] <= elapsed) {
    state.strikeSeq.shift();
    state.flash = 0.6 + Math.random() * 0.5;
  }

  computeEnv(state.t, state.r);
  env.wet = state.wet;
  env.flash = state.flash;
  ambience.setRain(state.r);

  // lights, fog, exposure
  sun.position.copy(env.lightDir).multiplyScalar(500);
  sun.color.copy(env.lightColor);
  sun.intensity = env.lightIntensity + env.flash * 2;
  hemi.color.copy(env.skyAmb);
  hemi.groundColor.copy(env.groundAmb);
  hemi.intensity = 2.0 + env.flash * 4;
  scene.fog.color.copy(env.fogColor);
  scene.fog.density = env.fogDensity;
  renderer.toneMappingExposure = env.exposure;
  bloom.strength = env.bloom;

  updateCamera(dt);
  traffic.update(dt, env, elapsed);
  city.update(env, elapsed);
  sky.update(env, camera, elapsed);
  rain.update(env, camera, camLook, elapsed, renderer.domElement.height);

  composer.render(dt);
  adaptQuality(dt);

  if (!loadingEl.classList.contains('done')) loadingEl.classList.add('done');
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
adjustFov();
updateTimeBtns();
updateRainBtn();
updateSoundBtn();
applyView(settings.view % VIEWS.length, true);
camera.lookAt(controls.target);
camLook.copy(controls.target);
wake();
requestAnimationFrame(frame);

// handy for debugging from the console
window.__city = { settings, state, env, VIEWS, applyView, setTime, toggleRain, SPAN };
window.__traffic = traffic;
