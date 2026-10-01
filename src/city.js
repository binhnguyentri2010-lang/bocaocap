import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, radialTexture, fogGLSL } from './utils.js';

// ---- City layout -----------------------------------------------------------
export const N = 8;            // blocks per side
export const PITCH = 60;       // distance between road centre lines
export const ROAD = 16;        // road width (two lanes + margins)
export const LANE = 3.8;       // lane centre offset from road centre
export const SIDEWALK_H = 0.3;
export const SPAN = N * PITCH + ROAD;
export const nodeCoord = (i) => -SPAN / 2 + ROAD / 2 + i * PITCH;

const BLOCK = PITCH - ROAD;    // size of a block (incl. sidewalk)
const WALK = 2.6;              // sidewalk width

// ---- Building shader: procedural windows, lit by the env uniforms ----------
const buildingVert = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vNormalL;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vTint;
  varying float vSeed;
  varying float vTop;
  void main() {
    vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vScale = sc;
    vLocal = position + 0.5;
    vNormalL = normal;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vTint = instanceColor;
    vSeed = fract(dot(floor(instanceMatrix[3].xz * 4.0), vec2(0.0137, 0.0291)));
    vTop = instanceMatrix[3].y + sc.y * 0.5;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const buildingFrag = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyAmb;
  uniform vec3 uGroundAmb;
  uniform vec3 uHorizon;
  uniform float uLit;
  uniform float uGlow;
  uniform float uShop;
  uniform float uStreetGlow;
  uniform float uTime;
  uniform float uFlash;
  ${fogGLSL}
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vNormalL;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vTint;
  varying float vSeed;
  varying float vTop;

  // sin-free hash: stable on mobile GPUs
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    float seed = floor(vSeed * 997.0 + 0.5); // quantised: identical across the face
    vec3 n = normalize(vNormalW);
    vec3 light = uSunColor * max(dot(n, uSunDir), 0.0)
               + mix(uGroundAmb, uSkyAmb, n.y * 0.5 + 0.5)
               + vec3(uFlash);
    // warm bounce from the street lamps at the bottom of the facades
    light += uStreetGlow * vec3(1.0, 0.62, 0.32) * exp(-max(vWorld.y, 0.0) / 9.0) * (1.0 - abs(n.y));

    vec3 col;
    vec3 emis = vec3(0.0);

    if (abs(vNormalL.y) < 0.5) {
      bool sideX = abs(vNormalL.x) > 0.5;
      float faceId = vNormalL.x * 2.0 + vNormalL.z * 3.0;
      float width = sideX ? vScale.z : vScale.x;
      float u = (sideX ? vLocal.z : vLocal.x) * width;
      float v = vWorld.y;
      float cols = max(1.0, floor(width / 2.7));
      float cw = width / cols;
      vec2 cell = vec2(floor(u / cw), floor(v / 3.3));
      vec2 f = vec2(fract(u / cw), fract(v / 3.3));

      // subtle vertical panel shading
      float panel = 0.92 + 0.08 * step(0.5, fract(cell.x * 0.5));
      col = vTint * light * panel;

      float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.24, f.y) * step(f.y, 0.80);
      win *= step(1.0, cell.y) * step((cell.y + 1.0) * 3.3, vTop - 0.7);

      vec2 id = cell + vec2(faceId * 17.0 + seed * 1.37, seed * 0.71);
      float h1 = hash(id);
      float h2 = hash(id + 3.7);
      float h3 = hash(id + 9.1);
      // lights very slowly switch on/off over time
      float thr = uLit + 0.10 * sin(uTime * 0.025 + h2 * 60.0);
      float on = step(h1, thr) * win;

      vec3 warm = mix(vec3(1.0, 0.45, 0.16), vec3(1.0, 0.68, 0.36), h2);
      vec3 wc = mix(warm, vec3(0.55, 0.72, 1.0), step(0.88, h3));
      // curtains: inner falloff toward the frame
      float inner = smoothstep(0.0, 0.25, min(min(f.x - 0.14, 0.86 - f.x), min(f.y - 0.24, 0.8 - f.y)) * 4.0);

      vec3 glass = mix(vec3(0.012, 0.016, 0.026), uHorizon * 0.3, 0.35 + 0.3 * h3) + vec3(uFlash * 0.4);
      col = mix(col, glass, win * (1.0 - on));
      col = mix(col, vec3(0.0), on);
      emis += on * wc * uGlow * (0.45 + 0.9 * h3) * (0.6 + 0.4 * inner);

      // ground-floor shop fronts
      float shop = step(cell.y, 0.0) * step(0.06, f.y) * step(f.y, 0.72) * step(0.08, f.x) * step(f.x, 0.92);
      shop *= step(0.4, hash(vec2(cell.x, faceId) + seed * 3.1));
      shop *= step(vWorld.y, 3.4);
      vec3 shopCol = mix(vec3(1.0, 0.78, 0.5), vec3(0.75, 0.95, 1.0), step(0.7, hash(vec2(cell.x * 3.1, seed))));
      col = mix(col, vec3(0.02), shop * uShop);
      emis += shop * shopCol * uShop * 1.6;
    } else {
      col = vTint * 0.35 * light;
    }

    col += emis;
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

export function createCity(quality) {
  const rand = mulberry32(20241031);
  const group = new THREE.Group();

  // ---- ground ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.95, metalness: 0.0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // ---- blocks: sidewalks / parks ----
  const blocks = [];
  for (let bi = 0; bi < N; bi++) {
    for (let bj = 0; bj < N; bj++) {
      const cx = (nodeCoord(bi) + nodeCoord(bi + 1)) / 2;
      const cz = (nodeCoord(bj) + nodeCoord(bj + 1)) / 2;
      const central = Math.abs(bi - (N - 1) / 2) < 1.6 && Math.abs(bj - (N - 1) / 2) < 1.6;
      const park = !central && rand() < 0.08;
      blocks.push({ cx, cz, park });
    }
  }
  const walkGeo = new THREE.BoxGeometry(1, 1, 1);
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const walks = new THREE.InstancedMesh(walkGeo, walkMat, blocks.length * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  let wi = 0;
  for (const b of blocks) {
    m4.compose(v.set(b.cx, SIDEWALK_H / 2, b.cz), q.identity(), s.set(BLOCK, SIDEWALK_H, BLOCK));
    walks.setMatrixAt(wi, m4);
    walks.setColorAt(wi++, col.set(0x3b3c43));
    if (b.park) {
      m4.compose(v.set(b.cx, SIDEWALK_H + 0.02, b.cz), q.identity(), s.set(BLOCK - WALK * 2, 0.06, BLOCK - WALK * 2));
      walks.setMatrixAt(wi, m4);
      walks.setColorAt(wi++, col.set(0x1d3020));
    }
  }
  walks.count = wi;
  group.add(walks);

  // ---- buildings ----
  const bld = []; // {x,y,z,w,h,d,color}
  const tints = ['#7d7f86', '#6a6f7a', '#8a8378', '#5d6470', '#9a9590', '#4f5866', '#7a6f68', '#6f7a80', '#857a70', '#5a5f6b'];
  const pickTint = () => new THREE.Color(tints[Math.floor(rand() * tints.length)]).multiplyScalar(0.7 + rand() * 0.35);
  const maxR = SPAN / 2;

  function addTower(x, z, w, d, h, tint) {
    bld.push({ x, y: SIDEWALK_H + h / 2, z, w, h, d, tint });
    if (h > 34 && rand() < 0.55) {
      const k = 0.55 + rand() * 0.25;
      const h2 = h * (0.12 + rand() * 0.25);
      bld.push({ x, y: SIDEWALK_H + h + h2 / 2, z, w: w * k, h: h2, d: d * k, tint: tint.clone().multiplyScalar(0.95) });
      if (rand() < 0.4) {
        const h3 = 3 + rand() * 6;
        bld.push({ x, y: SIDEWALK_H + h + h2 + h3 / 2, z, w: w * k * 0.4, h: h3, d: d * k * 0.4, tint: tint.clone().multiplyScalar(0.8) });
      }
    }
  }

  const neon = [];   // signs on facades
  const beacons = []; // red aircraft lights on the tallest roofs
  const neonPalette = ['#ff2e88', '#20e0ff', '#9b5cff', '#ff8a2a', '#39ff88', '#ff4d4d', '#ffe14d'];

  for (const b of blocks) {
    if (b.park) continue;
    const x0 = b.cx - BLOCK / 2 + WALK, z0 = b.cz - BLOCK / 2 + WALK;
    const inner = BLOCK - WALK * 2;
    const r = rand();
    let nx, nz;
    if (r < 0.14) { nx = 1; nz = 1; }
    else if (r < 0.58) { nx = 2; nz = 2; }
    else if (rand() < 0.5) { nx = 3; nz = 2; }
    else { nx = 2; nz = 3; }
    const lw = inner / nx, ld = inner / nz;
    const dist = Math.hypot(b.cx, b.cz) / maxR;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const w = lw - 1.2 - rand() * lw * 0.18;
        const d = ld - 1.2 - rand() * ld * 0.18;
        // keep buildings flush to the street edge where possible
        const x = x0 + lw * ix + lw / 2 + (ix === 0 ? -(lw - w) / 2 + 0.6 : ix === nx - 1 ? (lw - w) / 2 - 0.6 : 0);
        const z = z0 + ld * iz + ld / 2 + (iz === 0 ? -(ld - d) / 2 + 0.6 : iz === nz - 1 ? (ld - d) / 2 - 0.6 : 0);
        let h = 7 + rand() * 13 + Math.pow(Math.max(0, 1 - dist), 1.5) * (20 + rand() * 85);
        if (nx === 1 && nz === 1) h *= 1.35;
        if (rand() < 0.04) h += 40;
        const tint = pickTint();
        addTower(x, z, w, d, h, tint);
        if (h > 62) beacons.push(new THREE.Vector3(x, SIDEWALK_H + h + 0.6, z));

        // neon signs on street-facing facades
        if (h > 10 && rand() < 0.45) {
          const faces = [];
          if (ix === 0) faces.push([-1, 0]);
          if (ix === nx - 1) faces.push([1, 0]);
          if (iz === 0) faces.push([0, -1]);
          if (iz === nz - 1) faces.push([0, 1]);
          if (faces.length) {
            const [fx, fz] = faces[Math.floor(rand() * faces.length)];
            const vertical = rand() < 0.6;
            const sw = vertical ? 1.1 : 4 + rand() * 4;
            const sh = vertical ? 4 + rand() * 6 : 1.2;
            const along = (rand() - 0.5) * ((fx !== 0 ? d : w) - sw - 1);
            const y = SIDEWALK_H + 4.5 + rand() * Math.min(10, h - sh - 5) + sh / 2;
            neon.push({
              x: x + fx * (w / 2 + 0.08) + (fz !== 0 ? along : 0),
              z: z + fz * (d / 2 + 0.08) + (fx !== 0 ? along : 0),
              y, sw, sh, fx, fz,
              color: new THREE.Color(neonPalette[Math.floor(rand() * neonPalette.length)]),
            });
          }
        }
      }
    }
  }

  // endless skyline: sparse blocks on a grid beyond the city edge
  const ringCount = quality.low ? 260 : 460;
  const used = new Set();
  for (let k = 0, tries = 0; k < ringCount && tries < ringCount * 6; tries++) {
    const a = rand() * Math.PI * 2;
    const rr = maxR + 40 + Math.pow(rand(), 0.8) * 760;
    const gx = Math.round((Math.cos(a) * rr) / 28), gz = Math.round((Math.sin(a) * rr) / 28);
    const key = gx + ',' + gz;
    if (used.has(key)) continue;
    used.add(key);
    const w = 12 + rand() * 13, d = 12 + rand() * 13;
    const fall = 1 - (rr - maxR) / 900;
    const h = 8 + rand() * 30 + rand() * 55 * fall;
    bld.push({ x: gx * 28, y: h / 2, z: gz * 28, w, h, d, tint: pickTint() });
    k++;
  }

  const buildingUniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSkyAmb: { value: new THREE.Color() },
    uGroundAmb: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.002 },
    uLit: { value: 0.3 },
    uGlow: { value: 1.5 },
    uShop: { value: 0.5 },
    uStreetGlow: { value: 0.2 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  };
  const buildingMat = new THREE.ShaderMaterial({
    uniforms: buildingUniforms,
    vertexShader: buildingVert,
    fragmentShader: buildingFrag,
  });
  const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), buildingMat, bld.length);
  bld.forEach((b, i) => {
    m4.compose(v.set(b.x, b.y, b.z), q.identity(), s.set(b.w, b.h, b.d));
    buildings.setMatrixAt(i, m4);
    buildings.setColorAt(i, b.tint);
  });
  buildings.computeBoundingSphere();
  group.add(buildings);

  // ---- neon signs ----
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: true });
  const neonMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), neonMat, Math.max(1, neon.length));
  neon.forEach((n, i) => {
    q.setFromAxisAngle(v.set(0, 1, 0), Math.atan2(n.fx, n.fz));
    m4.compose(new THREE.Vector3(n.x, n.y, n.z), q, s.set(n.sw, n.sh, 1));
    neonMesh.setMatrixAt(i, m4);
    neonMesh.setColorAt(i, n.color);
  });
  neonMesh.count = neon.length;
  group.add(neonMesh);

  // ---- roof beacons ----
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const beaconMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), beaconMat, Math.max(1, beacons.length));
  beacons.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    beaconMesh.setMatrixAt(i, m4);
  });
  beaconMesh.count = beacons.length;
  group.add(beaconMesh);

  // ---- road markings ----
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const dashes = [];
  const zebra = [];
  for (let r = 0; r <= N; r++) {
    for (let seg = 0; seg < N; seg++) {
      const a = nodeCoord(seg) + ROAD / 2 + 4.5, b2 = nodeCoord(seg + 1) - ROAD / 2 - 4.5;
      for (let p = a + 1.5; p < b2 - 1.5; p += 6.5) {
        dashes.push([p, nodeCoord(r), 3, 0.22]);   // along x
        dashes.push([nodeCoord(r), p, 0.22, 3]);   // along z
      }
    }
  }
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const cx = nodeCoord(i), cz = nodeCoord(j);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of dirs) {
        const ni = i + dx, nj = j + dz;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const off = ROAD / 2 + 2;
        for (let k = 0; k < 7; k++) {
          const across = -ROAD / 2 + 1.6 + k * ((ROAD - 3.2) / 6);
          if (dx !== 0) zebra.push([cx + dx * off, cz + across, 3, 0.85]);
          else zebra.push([cx + across, cz + dz * off, 0.85, 3]);
        }
      }
    }
  }
  const markMat = new THREE.MeshStandardMaterial({ color: 0x8a8270, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const marks = new THREE.InstancedMesh(markGeo, markMat, dashes.length + zebra.length);
  [...dashes, ...zebra].forEach(([x, z, w, d], i) => {
    m4.compose(v.set(x, 0.015, z), q.identity(), s.set(w, 1, d));
    marks.setMatrixAt(i, m4);
    marks.setColorAt(i, col.setScalar(i < dashes.length ? 0.85 : 0.6));
  });
  group.add(marks);

  // ---- street lamps ----
  const lamps = []; // {x,z, ax, az} position of pole + direction toward road
  const sideOff = ROAD / 2 + 0.7;
  for (let r = 0; r <= N; r++) {
    for (let seg = 0; seg < N; seg++) {
      const a = nodeCoord(seg) + ROAD / 2, b2 = nodeCoord(seg + 1) - ROAD / 2;
      const len = b2 - a;
      const c = nodeCoord(r);
      const sides = [];
      if (r < N) sides.push([1, [0.22, 0.72]]);
      if (r > 0) sides.push([-1, [0.47, 0.97]]);
      for (const [side, fracs] of sides) {
        for (const f of fracs) {
          if (f > 0.95) continue;
          const p = a + len * f;
          lamps.push({ x: p, z: c + side * sideOff, ax: 0, az: -side }); // road along x
          lamps.push({ x: c + side * sideOff, z: p, ax: -side, az: 0 }); // road along z
        }
      }
    }
  }
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.1, 0.14, 7.2, 6).translate(0, 3.6, 0),
    new THREE.BoxGeometry(2.4, 0.12, 0.14).translate(1.1, 7.1, 0),
  ]);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.6, metalness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.14, 0.42), headMat, lamps.length);
  const poolTex = radialTexture();
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xffb070, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const pools = new THREE.InstancedMesh(markGeo, poolMat, lamps.length);
  lamps.forEach((l, i) => {
    const ang = Math.atan2(-l.az, l.ax);
    q.setFromAxisAngle(v.set(0, 1, 0), ang);
    m4.compose(new THREE.Vector3(l.x, SIDEWALK_H, l.z), q, s.set(1, 1, 1));
    poles.setMatrixAt(i, m4);
    const hx = l.x + l.ax * 2.0, hz = l.z + l.az * 2.0;
    m4.compose(new THREE.Vector3(hx, SIDEWALK_H + 7.0, hz), q, s.set(1, 1, 1));
    heads.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(hx, 0.03, hz), q.identity(), s.set(17, 1, 17));
    pools.setMatrixAt(i, m4);
  });
  pools.renderOrder = 1;
  group.add(poles, heads, pools);

  // ---- park trees ----
  const trees = [];
  for (const b of blocks) {
    if (!b.park) continue;
    const inner = BLOCK - WALK * 2 - 4;
    for (let k = 0; k < 26; k++) {
      trees.push([b.cx + (rand() - 0.5) * inner, b.cz + (rand() - 0.5) * inner, 0.8 + rand() * 0.7]);
    }
  }
  const trunk = new THREE.CylinderGeometry(0.18, 0.25, 2.2, 5).translate(0, 1.1, 0);
  const crown = new THREE.ConeGeometry(1.8, 4.5, 7).translate(0, 4.3, 0);
  const paint = (g, c) => {
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) { arr[i] = c[0]; arr[i + 1] = c[1]; arr[i + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const treeGeo = mergeGeometries([paint(trunk.toNonIndexed(), [0.18, 0.12, 0.08]), paint(crown.toNonIndexed(), [0.08, 0.2, 0.11])]);
  const treeMesh = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), Math.max(1, trees.length));
  trees.forEach(([x, z, sc], i) => {
    m4.compose(v.set(x, SIDEWALK_H, z), q.setFromAxisAngle(s.set(0, 1, 0), rand() * 6), new THREE.Vector3(sc, sc, sc));
    treeMesh.setMatrixAt(i, m4);
  });
  treeMesh.count = trees.length;
  group.add(treeMesh);

  // ---- per-frame update ----
  const dryColor = new THREE.Color(0x17181d);
  const wetColor = new THREE.Color(0x0c0d11);
  const lampWarm = new THREE.Color(0xffd29a);
  const poolWarm = new THREE.Color(0xff9a50);

  function update(env, time) {
    const u = buildingUniforms;
    u.uSunDir.value.copy(env.lightDir);
    u.uSunColor.value.copy(env.lightColor).multiplyScalar(env.lightIntensity * 0.55);
    u.uSkyAmb.value.copy(env.skyAmb);
    u.uGroundAmb.value.copy(env.groundAmb);
    u.uHorizon.value.copy(env.horizon);
    u.uFogColor.value.copy(env.fogColor);
    u.uFogDensity.value = env.fogDensity;
    u.uLit.value = env.windowLit;
    u.uGlow.value = env.windowGlow;
    u.uShop.value = env.shop;
    u.uStreetGlow.value = env.lamps * 0.18;
    u.uTime.value = time;
    u.uFlash.value = env.flash * 0.6;

    headMat.color.copy(lampWarm).multiplyScalar(0.25 + env.lamps * 3.2);
    poolMat.color.copy(poolWarm).multiplyScalar(env.lamps * (0.32 + env.wet * 0.5));
    neonMat.color.setScalar(0.9 + env.night * 2.2);
    beaconMat.color.setRGB(Math.max(0, Math.sin(time * 2.4)) > 0.75 ? 4 : 0.15, 0.02, 0.02);

    groundMat.color.lerpColors(dryColor, wetColor, env.wet);
    groundMat.roughness = 0.95 - env.wet * 0.6;
    markMat.roughness = groundMat.roughness;
    walkMat.roughness = 0.9 - env.wet * 0.45;
  }

  return { group, update, buildingCount: bld.length, lampCount: lamps.length };
}
