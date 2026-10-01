import * as THREE from 'three';
import { mulberry32 } from './utils.js';

const BOX = 150;     // horizontal size of the rain volume around the camera
const HEIGHT = 110;  // vertical size

const streakVert = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aEnd;
  uniform float uTime;
  uniform vec3 uCam;
  uniform vec2 uWind;
  varying float vFade;
  void main() {
    vec3 p = aOffset;
    // wrap the drop into the box nearest the camera
    p.xz = uCam.xz + mod(p.xz - uCam.xz + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
    float fall = mod(p.y - uTime * 48.0, ${HEIGHT.toFixed(1)});
    p.y = max(uCam.y - ${(HEIGHT * 0.45).toFixed(1)}, 0.0) + fall;
    p.xz += uWind * (fall / ${HEIGHT.toFixed(1)}) * 6.0;
    vec3 dir = normalize(vec3(uWind.x * 0.12, -1.0, uWind.y * 0.12));
    p += dir * aEnd * 1.5;
    float d = distance(p, uCam);
    vFade = smoothstep(2.0, 9.0, d) * (1.0 - smoothstep(40.0, ${(BOX / 2).toFixed(1)}, d)) * step(0.0, p.y) * mix(0.35, 1.0, aEnd);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const streakFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() { gl_FragColor = vec4(uColor, uOpacity * vFade); }
`;

const splashVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uSize;
  uniform float uScale;
  varying float vPhase;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float t = uTime * (1.6 + aSeed.z) + aSeed.x * 10.0;
    float cycle = floor(t);
    vPhase = fract(t);
    vec3 p = vec3(
      uCenter.x + (hash(cycle * 12.9 + aSeed.y * 91.7) - 0.5) * uSize,
      0.06,
      uCenter.z + (hash(cycle * 78.2 + aSeed.x * 37.3) - 0.5) * uSize
    );
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((1.0 + vPhase * 5.0) * uScale / -mv.z, 1.0, 14.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const splashFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vPhase;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    c.y *= 2.2; // flatten into an ellipse lying on the road
    float d = length(c);
    float ring = smoothstep(0.5, 0.38, d) * smoothstep(0.18, 0.36, d);
    float a = ring * (1.0 - vPhase) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function createRain(quality) {
  const rand = mulberry32(99);
  const group = new THREE.Group();
  const maxDrops = quality.low ? 6000 : 10000;

  const offs = new Float32Array(maxDrops * 2 * 3);
  const ends = new Float32Array(maxDrops * 2);
  for (let i = 0; i < maxDrops; i++) {
    const x = rand() * BOX, y = rand() * HEIGHT, z = rand() * BOX;
    offs.set([x, y, z, x, y, z], i * 6);
    ends[i * 2] = 0;
    ends[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxDrops * 2 * 3), 3));
  geo.setAttribute('aOffset', new THREE.BufferAttribute(offs, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const streakUniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uWind: { value: new THREE.Vector2(0.6, 0.25) },
    uColor: { value: new THREE.Color(0.7, 0.76, 0.9) },
    uOpacity: { value: 0 },
  };
  const streaks = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    uniforms: streakUniforms, vertexShader: streakVert, fragmentShader: streakFrag,
    transparent: true, depthWrite: false,
  }));
  streaks.frustumCulled = false;
  streaks.renderOrder = 5;
  group.add(streaks);

  // splashes / ripples on the road
  const nSplash = quality.low ? 1400 : 2400;
  const seeds = new Float32Array(nSplash * 3);
  for (let i = 0; i < nSplash; i++) seeds.set([rand(), rand(), rand()], i * 3);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSplash * 3), 3));
  sgeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const splashUniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uSize: { value: 220 },
    uScale: { value: 300 },
    uColor: { value: new THREE.Color(0.75, 0.8, 0.95) },
    uOpacity: { value: 0 },
  };
  const splashes = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: splashUniforms, vertexShader: splashVert, fragmentShader: splashFrag,
    transparent: true, depthWrite: false,
  }));
  splashes.frustumCulled = false;
  splashes.renderOrder = 4;
  group.add(splashes);

  function update(env, camera, target, time, viewportH) {
    const k = env.rain;
    group.visible = k > 0.01;
    if (!group.visible) return;
    streakUniforms.uTime.value = time;
    streakUniforms.uCam.value.copy(camera.position);
    streakUniforms.uOpacity.value = 0.14 + 0.2 * k;
    streakUniforms.uColor.value.setRGB(0.55, 0.6, 0.72).lerp(env.fogColor, 0.25).multiplyScalar(1.0 + env.lamps * 0.4 + env.flash * 2);
    geo.setDrawRange(0, Math.floor(maxDrops * Math.min(1, k * 1.1)) * 2);

    splashUniforms.uTime.value = time;
    splashUniforms.uCenter.value.set(target.x, 0, target.z);
    splashUniforms.uSize.value = Math.min(320, 90 + camera.position.distanceTo(target) * 0.9);
    splashUniforms.uScale.value = viewportH * 0.3;
    splashUniforms.uOpacity.value = 0.22 * k;
    splashUniforms.uColor.value.setRGB(0.6, 0.62, 0.7).multiplyScalar(0.6 + env.lamps * 0.6);
    sgeo.setDrawRange(0, Math.floor(nSplash * k));
  }

  return { group, update };
}
