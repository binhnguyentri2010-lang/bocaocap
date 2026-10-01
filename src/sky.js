import * as THREE from 'three';
import { mulberry32 } from './utils.js';

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // always on the far plane
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunVis;
  uniform vec3 uMoonDir;
  uniform float uMoonVis;
  uniform vec3 uCloudColor;
  uniform float uCloudAmt;
  uniform float uTime;
  uniform float uFlash;
  uniform vec3 uFogColor;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5))
      : mix(uHorizon, uBottom, clamp(-h * 5.0, 0.0, 1.0));

    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 6.0) * 0.4 + pow(s, 90.0) * 0.5) * uSunVis;
    col += uSunColor * smoothstep(0.99935, 0.99965, s) * 4.0 * uSunVis;

    float m = max(dot(d, uMoonDir), 0.0);
    vec3 moon = vec3(0.92, 0.95, 1.0);
    col += moon * (smoothstep(0.99955, 0.99968, m) * 3.0 + pow(m, 400.0) * 0.35 + pow(m, 24.0) * 0.05) * uMoonVis;

    if (h > 0.0) {
      vec2 uv = d.xz / (h + 0.12);
      float c = fbm(uv * 1.1 + vec2(uTime * 0.006, uTime * 0.002));
      c = smoothstep(0.42, 0.85, c) * smoothstep(0.0, 0.1, h) * uCloudAmt;
      vec3 cc = uCloudColor * (1.0 + pow(s, 3.0) * 2.5 * uSunVis) + vec3(uFlash * 0.8);
      col = mix(col, cc, clamp(c, 0.0, 1.0) * 0.9);
    }
    // melt into the city haze at the horizon so the ground edge disappears
    col = mix(col, uFogColor, smoothstep(0.1, -0.01, h));
    col += vec3(0.55, 0.6, 0.8) * uFlash * smoothstep(-0.1, 0.4, h);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky() {
  const group = new THREE.Group();
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
    uSunColor: { value: new THREE.Color() },
    uSunVis: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0.5, 0.5, -0.7).normalize() },
    uMoonVis: { value: 0 },
    uCloudColor: { value: new THREE.Color() },
    uCloudAmt: { value: 0.4 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFogColor: { value: new THREE.Color() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  group.add(sky);

  // stars
  const rand = mulberry32(42);
  const n = 1600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2;
    const y = 0.04 + Math.pow(rand(), 0.7) * 0.96;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(u) * r * 1500, y * 1500, Math.sin(u) * r * 1500], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  function update(env, camera, time) {
    group.position.copy(camera.position);
    const u = uniforms;
    u.uTop.value.copy(env.skyTop);
    u.uHorizon.value.copy(env.horizon);
    u.uBottom.value.copy(env.skyBottom);
    u.uSunDir.value.copy(env.sunDir);
    u.uSunColor.value.copy(env.sunColor);
    u.uSunVis.value = env.sunVis;
    u.uMoonDir.value.copy(env.moonDir);
    u.uMoonVis.value = env.moonVis;
    u.uCloudColor.value.copy(env.cloudColor);
    u.uCloudAmt.value = env.cloudAmt;
    u.uTime.value = time;
    u.uFlash.value = env.flash;
    u.uFogColor.value.copy(env.fogColor);
    starMat.opacity = env.stars * (0.75 + 0.25 * Math.sin(time * 0.7));
    stars.visible = env.stars > 0.01;
  }

  return { group, update };
}
