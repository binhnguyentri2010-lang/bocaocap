import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, radialTexture, fogGLSL, signAtlas, sagPoints, SIGN_COLS, SIGN_ROWS } from './utils.js';
import { bikeFrameGeo, paint, BIKE_COLORS, SHIRT_COLORS } from './vehicles.js';

// ---- City layout -----------------------------------------------------------
export const N = 8;            // blocks per side
export const PITCH = 60;       // distance between road centre lines
export const ROAD = 16;        // road width (kerb to kerb)
export const SIDEWALK_H = 0.3;
export const SPAN = N * PITCH + ROAD;
export const nodeCoord = (i) => -SPAN / 2 + ROAD / 2 + i * PITCH;

const BLOCK = PITCH - ROAD;    // size of a block (incl. sidewalk)
const WALK = 3.4;              // sidewalk width
const FLOOR = 3.4;             // storey height of a tube house

// building styles (instance attribute aStyle)
const TOWER = 0, TUBE_OPEN = 1, TUBE_SHUT = 2, FILLER = 3;

// ---- Building shader: procedural facades, lit by the env uniforms ----------
const buildingVert = /* glsl */ `
  attribute float aStyle;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  varying vec3 vNormalL;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vTint;
  varying float vSeed;
  varying float vTop;
  varying float vBase;
  varying float vStyle;
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
    vBase = instanceMatrix[3].y - sc.y * 0.5;
    vStyle = aStyle;
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
  varying float vBase;
  varying float vStyle;

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
    // warm bounce from street lamps and shop fronts at the bottom of the facades
    light += uStreetGlow * vec3(1.0, 0.66, 0.36) * exp(-max(vWorld.y, 0.0) / 8.0) * (1.0 - abs(n.y));

    vec3 col = vTint * light;
    vec3 emis = vec3(0.0);

    bool sideX = abs(vNormalL.x) > 0.5;
    float faceId = vNormalL.x * 2.0 + vNormalL.z * 3.0;
    float width = sideX ? vScale.z : vScale.x;
    float u = (sideX ? vLocal.z : vLocal.x) * width;

    if (abs(vNormalL.y) > 0.5) {
      // roof: concrete with a hint of the wall colour
      col = mix(vec3(0.5), vTint, 0.4) * 0.55 * light;
    } else if (vStyle < 0.5) {
      // ---------------- tower ----------------
      float v = vWorld.y;
      float cols = max(1.0, floor(width / 2.7));
      float cw = width / cols;
      vec2 cell = vec2(floor(u / cw), floor(v / 3.3));
      vec2 f = vec2(fract(u / cw), fract(v / 3.3));
      col *= 0.92 + 0.08 * step(0.5, fract(cell.x * 0.5));
      float win = step(0.14, f.x) * step(f.x, 0.86) * step(0.24, f.y) * step(f.y, 0.80);
      win *= step(1.0, cell.y) * step((cell.y + 1.0) * 3.3, vTop - 0.7);
      vec2 id = cell + vec2(faceId * 17.0 + seed * 1.37, seed * 0.71);
      float h1 = hash(id), h2 = hash(id + 3.7), h3 = hash(id + 9.1);
      float on = step(h1, uLit + 0.10 * sin(uTime * 0.025 + h2 * 60.0)) * win;
      vec3 wc = h2 < 0.55 ? vec3(1.0, 0.6, 0.28) : (h2 < 0.9 ? vec3(0.85, 0.94, 1.0) : vec3(0.6, 0.75, 1.0));
      vec3 glass = mix(vec3(0.03, 0.05, 0.08), uHorizon * 0.45, 0.35 + 0.3 * h3) + vec3(uFlash * 0.4);
      col = mix(col, glass, win * (1.0 - on));
      col = mix(col, vec3(0.0), on);
      emis += on * wc * uGlow * (0.5 + 0.8 * h3);
      // lobby
      float lobby = step(vWorld.y, 3.6) * step(0.1, fract(u / cw)) * step(fract(u / cw), 0.9);
      col = mix(col, vec3(0.02), lobby * uShop);
      emis += lobby * vec3(1.0, 0.85, 0.65) * uShop * 1.2;
    } else if (vStyle < 2.5) {
      // ---------------- tube house (nhà ống) ----------------
      float v = vWorld.y - vBase;
      float fl = floor(v / ${FLOOR.toFixed(1)});
      float fy = fract(v / ${FLOOR.toFixed(1)});
      float floors = floor((vScale.y - 0.3) / ${FLOOR.toFixed(1)});
      if (vNormalL.z > 0.5) {
        float cols = width < 5.6 ? 1.0 : 2.0;
        float cw = width / cols;
        float cx = floor(u / cw);
        float fx = fract(u / cw);
        // ledge between storeys
        col *= 1.0 - 0.3 * step(fy, 0.05) * step(1.0, fl);
        if (fl < 0.5) {
          float open = step(0.03, u / width) * step(u / width, 0.97) * step(v, 2.85);
          if (vStyle < 1.5) {
            float h = hash(vec2(seed, 7.0));
            vec3 inside = h < 0.45 ? vec3(1.0, 0.8, 0.5) : (h < 0.85 ? vec3(0.9, 0.97, 1.0) : vec3(1.0, 0.6, 0.75));
            float g = 0.55 + 0.45 * smoothstep(0.0, 2.8, v);
            // goods on shelves: darker vertical stripes in the back
            float shelf = 0.8 + 0.2 * step(0.5, fract(u * 1.7 + h * 3.0));
            col = mix(col, inside * 0.06, open);
            emis += open * inside * g * shelf * (0.25 + uShop * 0.75);
          } else {
            float stripes = 0.78 + 0.22 * step(0.5, fract(v * 5.0));
            col = mix(col, vec3(0.42, 0.44, 0.46) * light * stripes, open);
          }
        } else if (fl < floors) {
          float win = step(0.16, fx) * step(fx, 0.84) * step(0.14, fy) * step(fy, 0.86);
          float glassA = step(0.21, fx) * step(fx, 0.79) * step(0.19, fy) * step(fy, 0.81);
          vec2 id = vec2(cx + seed * 1.37, fl + seed * 0.71);
          float h1 = hash(id), h2 = hash(id + 3.7), h3 = hash(id + 9.1);
          float on = step(h1, uLit + 0.18 + 0.08 * sin(uTime * 0.03 + h2 * 50.0)) * glassA;
          vec3 wc = h2 < 0.5 ? vec3(1.0, 0.62, 0.3) : (h2 < 0.86 ? vec3(0.85, 0.96, 1.0) : vec3(1.0, 0.45, 0.72));
          vec3 glass = mix(vec3(0.03, 0.035, 0.05), uHorizon * 0.4, 0.4 + 0.3 * h3) + vec3(uFlash * 0.4);
          // window frame (dark aluminium / wood)
          col = mix(col, vec3(0.12, 0.1, 0.09) * light, win * (1.0 - glassA));
          col = mix(col, glass, glassA * (1.0 - on));
          col = mix(col, vec3(0.0), on);
          // curtains: soft vertical folds
          float folds = 0.75 + 0.25 * sin(fx * 40.0 + h3 * 6.0);
          emis += on * wc * uGlow * (0.55 + 0.55 * h3) * folds;
        }
      } else if (vNormalL.z < -0.5) {
        // back: small bathroom / kitchen windows
        float cw = 2.6;
        float cx = floor(u / cw), fx = fract(u / cw);
        float win = step(0.35, fx) * step(fx, 0.65) * step(0.45, fy) * step(fy, 0.75) * step(1.0, fl) * step(fl, floors - 1.0);
        float on = step(hash(vec2(cx + seed, fl)), uLit * 0.8) * win;
        col = mix(col, vec3(0.03), win);
        emis += on * vec3(1.0, 0.75, 0.45) * uGlow * 0.6;
      } else {
        // side wall: bare, a little weathered
        col *= 0.8 + 0.12 * hash(vec2(floor(v * 0.6), seed + faceId));
      }
    } else {
      // ---------------- filler (back buildings) ----------------
      float cw = 3.0;
      vec2 cell = vec2(floor(u / cw), floor(vWorld.y / 3.3));
      vec2 f = vec2(fract(u / cw), fract(vWorld.y / 3.3));
      float win = step(0.3, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.75) * step(1.0, cell.y) * step((cell.y + 1.0) * 3.3, vTop);
      float on = step(hash(cell + vec2(seed, faceId * 5.0)), uLit) * win;
      col = mix(col * 0.85, vec3(0.03), win);
      emis += on * vec3(1.0, 0.7, 0.4) * uGlow * 0.7;
    }

    col += emis;
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
/** ry so that local +z faces (fx, fz) */
const faceRy = (fx, fz) => Math.atan2(fx, fz);
/** ry so that local +x faces (dx, dz) */
const headRy = (dx, dz) => Math.atan2(-dz, dx);

export function createCity(quality) {
  const rand = mulberry32(20241031);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  function instanced(geo, mat, items) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    items.forEach((it, i) => {
      q.setFromAxisAngle(UP, it.ry || 0);
      m4.compose(it.p, q, it.s || ONE);
      mesh.setMatrixAt(i, m4);
      if (it.c) mesh.setColorAt(i, it.c);
    });
    mesh.count = items.length;
    group.add(mesh);
    return mesh;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const C = (hex) => new THREE.Color(hex);

  // ---- ground ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x232327, roughness: 0.95, metalness: 0.0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // ---- blocks ----
  const blocks = [];
  for (let bi = 0; bi < N; bi++) {
    for (let bj = 0; bj < N; bj++) {
      const cx = (nodeCoord(bi) + nodeCoord(bi + 1)) / 2;
      const cz = (nodeCoord(bj) + nodeCoord(bj + 1)) / 2;
      const ring = Math.max(Math.abs(bi - (N - 1) / 2), Math.abs(bj - (N - 1) / 2)); // 0.5 = centre
      const park = ring > 1 && rand() < 0.07;
      blocks.push({ cx, cz, ring, park });
    }
  }
  const walkItems = [];
  for (const b of blocks) {
    walkItems.push({ p: V(b.cx, SIDEWALK_H / 2, b.cz), s: V(BLOCK, SIDEWALK_H, BLOCK), c: C('#5a5650') });
    if (b.park) walkItems.push({ p: V(b.cx, SIDEWALK_H + 0.02, b.cz), s: V(BLOCK - WALK * 2, 0.06, BLOCK - WALK * 2), c: C('#2f5a2c') });
  }
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const walkExtra = [];

  // ---- collections ----
  const bld = [];        // {p, s, ry, tint, style}
  const signs = [];      // {p, ry, s, k}
  const awnings = [], balconies = [], plants = [], tanks = [], parked = [], shopPools = [];
  const lanterns = [], tables = [], stools = [], sitters = [], heads = [], carts = [], neon = [], beacons = [];

  const tubeTints = ['#f2d27a', '#f4b6a6', '#9fd6c9', '#ece5d0', '#d98c5f', '#b9d98c', '#f3f1ea', '#8fb8de', '#e6a4b4', '#f6c56b', '#c7e3e0', '#e9b97a'];
  const towerTints = ['#9fb3c8', '#7d8fa3', '#c8c2b4', '#a7b6c2', '#d6d0c4', '#8796a8', '#b9c4cf'];
  const awningCols = ['#1e88e5', '#d32f2f', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#fdd835'];
  const neonPalette = ['#ff2e88', '#20e0ff', '#9b5cff', '#ff8a2a', '#39ff88', '#ff4d4d', '#ffe14d'];
  const skin = ['#e0b08a', '#c99a7a', '#d8a47f', '#b9876a'];

  function addBuilding(x, y0, z, w, h, d, ry, tint, style) {
    bld.push({ p: V(x, y0 + h / 2, z), s: V(w, h, d), ry, tint, style });
  }

  /** A row of tube houses along one facade line. */
  function tubeRow(ax, az, dir, len, fx, fz, maxDepth, detail) {
    // (ax,az) start of the row on the facade line, dir = unit vector along it, (fx,fz) = front direction
    let cur = 0;
    while (cur < len - 0.5) {
      let w = rand() < 0.1 ? 7 + rand() * 2 : 4 + rand() * 2.4;
      if (len - cur - w < 3.6) w = len - cur;
      const d = Math.min(maxDepth, 12 + rand() * 6);
      const floors = 3 + Math.floor(rand() * (detail.tall ? 5 : 4));
      const h = floors * FLOOR + 0.4 + (rand() < 0.3 ? 0.8 : 0);
      const mid = cur + w / 2;
      const fxp = ax + dir[0] * mid, fzp = az + dir[1] * mid; // facade centre
      const cx = fxp - fx * d / 2, cz = fzp - fz * d / 2;
      const ry = faceRy(fx, fz);
      const open = rand() < 0.82;
      const tint = C(pick(tubeTints)).multiplyScalar(0.78 + rand() * 0.22);
      addBuilding(cx, SIDEWALK_H, cz, w, h, d, ry, tint, open ? TUBE_OPEN : TUBE_SHUT);
      const at = (along, out, y) => V(fxp + dir[0] * along + fx * out, y, fzp + dir[1] * along + fz * out);

      // rooftop "tum" (stair house) + inox water tank
      if (rand() < 0.45) addBuilding(cx - fx * (d / 2 - 3), SIDEWALK_H + h, cz - fz * (d / 2 - 3), w * 0.7, 2.8, 4, ry, tint.clone().multiplyScalar(0.92), FILLER);
      if (rand() < 0.65) tanks.push({ p: V(cx - fx * (d / 2 - 1.8) + dir[0] * (rand() - 0.5) * w * 0.4, SIDEWALK_H + h + 0.75, cz - fz * (d / 2 - 1.8) + dir[1] * (rand() - 0.5) * w * 0.4), ry });

      // balconies on the upper floors
      if (rand() < 0.6) {
        for (let f = 1; f < floors; f++) {
          balconies.push({ p: at(0, 0, SIDEWALK_H + f * FLOOR + 0.05), ry, s: V(w * 0.84, 1, 1), c: tint.clone().multiplyScalar(1.05) });
          if (rand() < 0.55) {
            for (let k = 0; k < 2; k++) plants.push({ p: at((rand() - 0.5) * w * 0.7, 0.85, SIDEWALK_H + f * FLOOR + 1.15), ry, s: V(0.8 + rand() * 0.6, 0.8 + rand() * 0.8, 0.8) });
          }
        }
      }

      if (open) {
        if (rand() < 0.9) signs.push({ p: at(0, 0.14, SIDEWALK_H + 3.55), ry, s: V(w * 0.94, 1.15, 1), k: Math.floor(rand() * 16) });
        if (rand() < 0.45) awnings.push({ p: at(0, 0.75, SIDEWALK_H + 2.75), ry, s: V(w * 0.92, 1, 1), c: C(pick(awningCols)) });
        shopPools.push({ p: at(0, 1.7, SIDEWALK_H + 0.025), ry, s: V(w * 1.5, 1, 3.2) });
        const r = rand();
        if (detail.street && r < 0.22) {
          // quán vỉa hè: low table, plastic stools, people
          const a = (rand() - 0.5) * (w - 2);
          tables.push({ p: at(a, 1.9, SIDEWALK_H), ry });
          const seats = [[-0.62, 0], [0.62, 0], [0, -0.55], [0, 0.55]];
          const stoolCol = C(rand() < 0.6 ? '#d32f2f' : '#1e88e5');
          seats.forEach(([sa, so], k) => {
            const p = at(a + sa, 1.9 + so, SIDEWALK_H);
            stools.push({ p, c: stoolCol });
            if (k < 3 && rand() < 0.75) {
              const face = headRy(-sa * dir[0] - so * fx, -sa * dir[1] - so * fz); // look at the table
              sitters.push({ p: p.clone(), ry: face, c: C(pick(SHIRT_COLORS)) });
              heads.push({ p: p.clone().setY(SIDEWALK_H + 1.04), c: C(pick(skin)) });
            }
          });
        } else if (r < 0.55) {
          // parked motorbikes facing the shop
          const n = 2 + Math.floor(rand() * Math.min(6, w / 0.8));
          for (let k = 0; k < n; k++) {
            const a = -w / 2 + 0.6 + k * 0.78 + (rand() - 0.5) * 0.15;
            if (a > w / 2 - 0.3) break;
            parked.push({ p: at(a, 1.5 + (rand() - 0.5) * 0.3, SIDEWALK_H), ry: headRy(-fx, -fz) + (rand() - 0.5) * 0.25, c: C(pick(BIKE_COLORS)) });
          }
        } else if (detail.street && r < 0.6) {
          carts.push({ p: at((rand() - 0.5) * (w - 1.6), 2.6, SIDEWALK_H), ry: headRy(dir[0], dir[1]), c: C(pick(['#e3f2fd', '#fff8e1', '#e8f5e9'])) });
        }
        if (detail.street && rand() < 0.2) {
          for (const sx of [-0.3, 0.3]) lanterns.push({ p: at(sx * w, 0.9, SIDEWALK_H + 2.5) });
        }
      }
      cur += w;
    }
  }

  function towers(x0, z0, x1, z1, maxH, count) {
    const iw = x1 - x0, id = z1 - z0;
    const nx = count === 1 ? 1 : 2, nz = count <= 2 ? 1 : 2;
    const lw = iw / nx, ld = id / nz;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const w = lw - 1.5 - rand() * lw * 0.2, d = ld - 1.5 - rand() * ld * 0.2;
        const x = x0 + lw * (ix + 0.5), z = z0 + ld * (iz + 0.5);
        const h = maxH * (0.45 + rand() * 0.55);
        const tint = C(pick(towerTints)).multiplyScalar(0.8 + rand() * 0.25);
        addBuilding(x, SIDEWALK_H, z, w, h, d, 0, tint, TOWER);
        if (h > 40 && rand() < 0.6) {
          const k = 0.6 + rand() * 0.2, h2 = h * (0.12 + rand() * 0.2);
          addBuilding(x, SIDEWALK_H + h, z, w * k, h2, d * k, 0, tint.clone().multiplyScalar(0.95), TOWER);
          if (h + h2 > 70) beacons.push({ p: V(x, SIDEWALK_H + h + h2 + 0.6, z) });
        } else if (h > 70) beacons.push({ p: V(x, SIDEWALK_H + h + 0.6, z) });
        // neon on the tower crown
        if (rand() < 0.7) {
          const side = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
          neon.push({ p: V(x + side[0] * (w / 2 + 0.1), SIDEWALK_H + h - 4, z + side[1] * (d / 2 + 0.1)), ry: faceRy(side[0], side[1]), s: V(Math.min(w, d) * 0.6, 2.2, 1), c: C(pick(neonPalette)) });
        }
      }
    }
  }

  for (const b of blocks) {
    if (b.park) continue;
    const x0 = b.cx - BLOCK / 2 + WALK, z0 = b.cz - BLOCK / 2 + WALK;
    const x1 = b.cx + BLOCK / 2 - WALK, z1 = b.cz + BLOCK / 2 - WALK;
    const inner = x1 - x0;
    if (b.ring < 1) {
      // downtown: high-rises with a podium of shops
      towers(x0 + 2, z0 + 2, x1 - 2, z1 - 2, 95, rand() < 0.3 ? 1 : 4);
      continue;
    }
    const detail = { tall: b.ring < 2.5, street: b.ring < 3 };
    const dN = 15, dW = 15;
    tubeRow(x0, z0, [1, 0], inner, 0, -1, dN, detail);           // facing -z
    tubeRow(x1, z1, [-1, 0], inner, 0, 1, dN, detail);           // facing +z
    tubeRow(x0, z1 - dN, [0, -1], inner - 2 * dN, -1, 0, dW, detail); // facing -x
    tubeRow(x1, z0 + dN, [0, 1], inner - 2 * dN, 1, 0, dW, detail);   // facing +x
    // back courtyard: a mid-rise or just lower roofs
    if (b.ring < 2 && rand() < 0.7) towers(x0 + 13, z0 + 13, x1 - 13, z1 - 13, 55, 1);
    else addBuilding(b.cx, SIDEWALK_H, b.cz, inner - 20, 5 + rand() * 6, inner - 20, 0, C(pick(tubeTints)).multiplyScalar(0.7), FILLER);
  }

  // the far side of the perimeter roads gets a sidewalk and a row of houses too
  {
    const e = nodeCoord(N) + ROAD / 2, len = 2 * e;
    for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = fx * (e + WALK / 2), cz = fz * (e + WALK / 2);
      walkExtra.push({ p: V(cx, SIDEWALK_H / 2, cz), s: V(fx ? WALK : len + 2 * WALK, SIDEWALK_H, fz ? WALK : len + 2 * WALK), c: C('#5a5650') });
      // facade line on the outer edge of that sidewalk, houses face the city (-f)
      const ax = fx ? fx * (e + WALK) : (fz > 0 ? e : -e);
      const az = fz ? fz * (e + WALK) : (fx > 0 ? -e : e);
      const dir = fx ? [0, fx] : [-fz, 0];
      tubeRow(ax, az, dir, len, -fx, -fz, 15, { tall: false, street: false });
    }
  }

  // endless suburbs beyond the edge: small colourful houses
  const maxR = SPAN / 2;
  const ringCount = quality.low ? 360 : 620;
  const used = new Set();
  for (let k = 0, tries = 0; k < ringCount && tries < ringCount * 6; tries++) {
    const a = rand() * Math.PI * 2;
    const rr = maxR + 45 + Math.pow(rand(), 0.8) * 760;
    const gx = Math.round((Math.cos(a) * rr) / 16), gz = Math.round((Math.sin(a) * rr) / 16);
    const key = gx + ',' + gz;
    if (used.has(key)) continue;
    used.add(key);
    const tall = rand() < 0.07;
    const w = tall ? 14 + rand() * 10 : 6 + rand() * 7, d = tall ? 14 + rand() * 10 : 10 + rand() * 6;
    const h = tall ? 30 + rand() * 45 : 6 + rand() * 16;
    const ry = Math.floor(rand() * 4) * Math.PI / 2;
    addBuilding(gx * 16, 0, gz * 16, w, h, d, ry, C(pick(tall ? towerTints : tubeTints)).multiplyScalar(0.75 + rand() * 0.2), tall ? TOWER : TUBE_OPEN);
    k++;
  }

  instanced(new THREE.BoxGeometry(1, 1, 1), walkMat, walkItems.concat(walkExtra));

  // ---- buildings mesh ----
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
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  buildingGeo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(new Float32Array(bld.map((b) => b.style)), 1));
  const buildings = instanced(
    buildingGeo,
    new THREE.ShaderMaterial({ uniforms: buildingUniforms, vertexShader: buildingVert, fragmentShader: buildingFrag }),
    bld.map((b) => ({ p: b.p, s: b.s, ry: b.ry, c: b.tint })),
  );
  buildings.computeBoundingSphere();

  // ---- shop signs (Vietnamese text atlas, per-instance tile) ----
  const atlas = signAtlas();
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, color: 0xffffff });
  signMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSign;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float sc = mod(aSign, ${SIGN_COLS.toFixed(1)});
        float sr = floor(aSign / ${SIGN_COLS.toFixed(1)});
        vMapUv = vec2((uv.x + sc) / ${SIGN_COLS.toFixed(1)}, (uv.y + ${(SIGN_ROWS - 1).toFixed(1)} - sr) / ${SIGN_ROWS.toFixed(1)});`);
  };
  const signGeo = new THREE.PlaneGeometry(1, 1);
  signGeo.setAttribute('aSign', new THREE.InstancedBufferAttribute(new Float32Array(signs.map((s) => s.k)), 1));
  instanced(signGeo, signMat, signs);

  // ---- façade details ----
  const awningGeo = new THREE.BoxGeometry(1, 0.06, 1.5).rotateX(0.32);
  instanced(awningGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }), awnings);

  const balconyGeo = mergeGeometries([
    paint(new THREE.BoxGeometry(1, 0.14, 0.9).translate(0, 0, 0.45), [1, 1, 1]),
    paint(new THREE.BoxGeometry(1, 0.06, 0.06).translate(0, 1.0, 0.88), [0.2, 0.2, 0.2]),
    paint(new THREE.BoxGeometry(1, 0.85, 0.02).translate(0, 0.5, 0.88), [0.35, 0.35, 0.37]),
  ]);
  instanced(balconyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, opacity: 0.96 }), balconies);

  const plantGeo = mergeGeometries([
    paint(new THREE.BoxGeometry(0.3, 0.25, 0.3).translate(0, 0.12, 0), [0.6, 0.3, 0.2]),
    paint(new THREE.IcosahedronGeometry(0.28, 0).translate(0, 0.45, 0), [0.15, 0.45, 0.18]),
  ]);
  instanced(plantGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), plants);

  const tankGeo = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.5, 0.5, 1.7, 12).rotateZ(Math.PI / 2), [0.85, 0.87, 0.9]),
    paint(new THREE.BoxGeometry(1.3, 0.3, 0.8).translate(0, -0.6, 0), [0.3, 0.3, 0.3]),
  ]);
  instanced(tankGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 }), tanks);

  instanced(bikeFrameGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), parked.slice(0, 2400));

  // street food: tables, stools, people, carts
  instanced(new THREE.BoxGeometry(0.7, 0.45, 0.5).translate(0, 0.225, 0), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.5 }), tables);
  instanced(new THREE.CylinderGeometry(0.15, 0.18, 0.3, 8).translate(0, 0.15, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), stools);
  const sitterGeo = mergeGeometries([
    paint(new THREE.BoxGeometry(0.3, 0.55, 0.4).translate(0, 0.62, 0), [1, 1, 1]),
    paint(new THREE.BoxGeometry(0.42, 0.14, 0.36).translate(0.2, 0.36, 0), [0.25, 0.25, 0.3]),
    paint(new THREE.BoxGeometry(0.12, 0.34, 0.32).translate(0.38, 0.17, 0), [0.25, 0.25, 0.3]),
  ]);
  instanced(sitterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), sitters.map((s) => ({ ...s, p: s.p.clone().setY(SIDEWALK_H) })));
  const headGeo = mergeGeometries([
    paint(new THREE.SphereGeometry(0.13, 8, 6), [1, 1, 1]),
    paint(new THREE.SphereGeometry(0.135, 8, 4, 0, Math.PI * 2, 0, 1.3).translate(0, 0.02, 0), [0.05, 0.04, 0.04]),
  ]);
  instanced(headGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), heads);
  const cartGeo = mergeGeometries([
    paint(new THREE.BoxGeometry(1.4, 0.8, 0.7).translate(0, 0.65, 0), [1, 1, 1]),
    paint(new THREE.BoxGeometry(0.05, 0.05, 0.8).translate(0.95, 0.9, 0), [0.3, 0.3, 0.3]),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10).rotateX(Math.PI / 2).translate(-0.3, 0.2, 0.38), [0.05, 0.05, 0.05]),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10).rotateX(Math.PI / 2).translate(-0.3, 0.2, -0.38), [0.05, 0.05, 0.05]),
  ]);
  instanced(cartGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), carts);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  instanced(new THREE.BoxGeometry(1.3, 0.5, 0.62).translate(0, 1.3, 0), glowMat, carts.map((c) => ({ p: c.p, ry: c.ry, c: C('#ffd9a0') })));

  // ---- lights that glow: lanterns, neon, beacons ----
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  instanced(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.25, 1), lanternMat, lanterns);
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  instanced(new THREE.PlaneGeometry(1, 1), neonMat, neon);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  instanced(new THREE.SphereGeometry(0.45, 8, 6), beaconMat, beacons);

  // ---- road markings ----
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const marks = [];
  for (let r = 0; r <= N; r++) {
    for (let seg = 0; seg < N; seg++) {
      const a = nodeCoord(seg) + ROAD / 2 + 4.5, b2 = nodeCoord(seg + 1) - ROAD / 2 - 4.5;
      for (let p = a + 1.5; p < b2 - 1.5; p += 6.5) {
        marks.push({ p: V(p, 0.015, nodeCoord(r)), s: V(3, 1, 0.22), c: C('#d8cfa0') });
        marks.push({ p: V(nodeCoord(r), 0.015, p), s: V(0.22, 1, 3), c: C('#d8cfa0') });
      }
    }
  }
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const cx = nodeCoord(i), cz = nodeCoord(j);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + dx, nj = j + dz;
        if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
        const off = ROAD / 2 + 2;
        for (let k = 0; k < 7; k++) {
          const across = -ROAD / 2 + 1.6 + k * ((ROAD - 3.2) / 6);
          marks.push(dx !== 0
            ? { p: V(cx + dx * off, 0.015, cz + across), s: V(3, 1, 0.85), c: C('#9a958a') }
            : { p: V(cx + across, 0.015, cz + dz * off), s: V(0.85, 1, 3), c: C('#9a958a') });
        }
      }
    }
  }
  const markMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  instanced(markGeo, markMat, marks);

  // ---- street lamps, trees, power lines ----
  const lamps = [];
  const sideOff = ROAD / 2 + 0.6;
  const treeItems = [];
  const lines = new Map(); // per road side: list of pole positions for overhead wires
  for (let r = 0; r <= N; r++) {
    const c = nodeCoord(r);
    for (let seg = 0; seg < N; seg++) {
      const a = nodeCoord(seg) + ROAD / 2, b2 = nodeCoord(seg + 1) - ROAD / 2;
      const len = b2 - a;
      const sides = [];
      if (r < N) sides.push([1, [0.22, 0.72], [0.08, 0.47, 0.92]]);
      if (r > 0) sides.push([-1, [0.47, 0.97], [0.22, 0.72]]);
      for (const [side, fracs, treeFracs] of sides) {
        for (const f of fracs) {
          if (f > 0.95) continue;
          const p = a + len * f;
          lamps.push({ x: p, z: c + side * sideOff, ax: 0, az: -side, key: `x${r}${side}`, along: p });
          lamps.push({ x: c + side * sideOff, z: p, ax: -side, az: 0, key: `z${r}${side}`, along: p });
        }
        for (const f of treeFracs) {
          if (rand() > 0.55) continue;
          const p = a + len * f, k = 0.8 + rand() * 0.5;
          treeItems.push({ p: V(p, SIDEWALK_H, c + side * (ROAD / 2 + 1.0)), ry: rand() * 6, s: V(k, k, k) });
          treeItems.push({ p: V(c + side * (ROAD / 2 + 1.0), SIDEWALK_H, p), ry: rand() * 6, s: V(k, k, k) });
        }
      }
    }
  }
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.17, 8.2, 6).translate(0, 4.1, 0),
    new THREE.BoxGeometry(2.4, 0.12, 0.14).translate(1.1, 7.1, 0),
    new THREE.BoxGeometry(1.4, 0.1, 0.1).translate(0.2, 7.9, 0),   // cross-arm for the wires
  ]);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.8 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const poolTex = radialTexture();
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xffb070, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const poleItems = [], headItems = [], poolItems = [], coilItems = [];
  for (const l of lamps) {
    const ry = headRy(l.ax, l.az);
    poleItems.push({ p: V(l.x, SIDEWALK_H, l.z), ry });
    const hx = l.x + l.ax * 2.0, hz = l.z + l.az * 2.0;
    headItems.push({ p: V(hx, SIDEWALK_H + 7.0, hz), ry });
    poolItems.push({ p: V(hx, 0.03, hz), s: V(18, 1, 18) });
    if (rand() < 0.4) coilItems.push({ p: V(l.x, SIDEWALK_H + 6.2 + rand() * 1.2, l.z), ry: rand() * 3, s: V(0.6 + rand() * 0.6, 0.5 + rand() * 0.5, 0.6 + rand() * 0.6) });
    if (!lines.has(l.key)) lines.set(l.key, []);
    lines.get(l.key).push(l);
  }
  instanced(poleGeo, poleMat, poleItems);
  instanced(new THREE.BoxGeometry(0.9, 0.14, 0.42), headMat, headItems);
  const pools = instanced(markGeo, poolMat, poolItems);
  pools.renderOrder = 1;
  instanced(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 1 }), coilItems);

  // sagging overhead cables between consecutive poles — very Saigon / Hanoi
  const wirePos = [];
  for (const list of lines.values()) {
    list.sort((a, b) => a.along - b.along);
    for (let i = 0; i + 1 < list.length; i++) {
      const A = list[i], B = list[i + 1];
      const nWires = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < nWires; k++) {
        const off = (k / (nWires - 1) - 0.5) * 1.2;
        // spread across the cross-arm (which points toward the road)
        const pa = V(A.x + A.ax * (off + 0.2), SIDEWALK_H + 7.6 + rand() * 0.4, A.z + A.az * (off + 0.2));
        const pb = V(B.x + B.ax * (off + 0.2), SIDEWALK_H + 7.6 + rand() * 0.4, B.z + B.az * (off + 0.2));
        const pts = sagPoints(pa, pb, 0.6 + rand() * 0.9, 8);
        for (let s = 0; s < pts.length - 1; s++) wirePos.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z);
      }
    }
  }

  // ---- festive string lights across some streets ----
  const bulbs = [];
  const bulbPalettes = [['#ffd27a'], ['#ffd27a'], ['#ff4d4d', '#ffe14d', '#39ff88', '#20a0ff', '#ff5ce1']];
  for (let r = 1; r < N; r++) {
    for (let seg = 0; seg < N; seg++) {
      const segMid = (nodeCoord(seg) + nodeCoord(seg + 1)) / 2;
      if (Math.hypot(segMid, nodeCoord(r)) > SPAN * 0.42 || rand() > 0.3) continue;
      const pal = pick(bulbPalettes);
      const alongX = rand() < 0.5;
      const c = nodeCoord(r);
      for (let k = -2; k <= 2; k++) {
        const along = segMid + k * 7;
        const half = ROAD / 2 + WALK * 0.9;
        const skew = (rand() - 0.5) * 6;
        const pa = alongX ? V(along, 6.8, c - half) : V(c - half, 6.8, along);
        const pb = alongX ? V(along + skew, 6.8, c + half) : V(c + half, 6.8, along + skew);
        const pts = sagPoints(pa, pb, 1.4, 18);
        for (let s = 0; s < pts.length - 1; s++) wirePos.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z);
        pts.forEach((p, i) => { if (i % 2 === 1) bulbs.push({ p: p.clone().setY(p.y - 0.15), c: C(pick(pal)) }); });
      }
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
  const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x0a0a0c }));
  group.add(wires);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  instanced(new THREE.SphereGeometry(0.11, 6, 4), bulbMat, bulbs);

  // ---- shop light spilling onto the sidewalk ----
  const shopPoolMat = new THREE.MeshBasicMaterial({
    map: poolTex, color: 0xffe0b0, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  instanced(markGeo, shopPoolMat, shopPools).renderOrder = 1;

  // ---- trees (sidewalk + parks) ----
  for (const b of blocks) {
    if (!b.park) continue;
    const inner = BLOCK - WALK * 2 - 4;
    for (let k = 0; k < 26; k++) {
      const s = 0.9 + rand() * 0.7;
      treeItems.push({ p: V(b.cx + (rand() - 0.5) * inner, SIDEWALK_H, b.cz + (rand() - 0.5) * inner), ry: rand() * 6, s: V(s, s, s) });
    }
  }
  const treeGeo = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.16, 0.24, 3.6, 6).translate(0, 1.8, 0), [0.3, 0.22, 0.15]),
    paint(new THREE.IcosahedronGeometry(1.9, 0).scale(1.2, 0.85, 1.2).translate(0, 4.4, 0), [0.16, 0.38, 0.17]),
    paint(new THREE.IcosahedronGeometry(1.3, 0).translate(0.8, 5.0, 0.4), [0.2, 0.45, 0.2]),
  ]);
  instanced(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), treeItems);

  // ---- per-frame update ----
  const dryColor = new THREE.Color(0x232327);
  const wetColor = new THREE.Color(0x121316);
  const lampWarm = new THREE.Color(0xffc870);
  const poolWarm = new THREE.Color(0xffa040);

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
    u.uStreetGlow.value = env.lamps * 0.3;
    u.uTime.value = time;
    u.uFlash.value = env.flash * 0.6;

    headMat.color.copy(lampWarm).multiplyScalar(0.3 + env.lamps * 3.2);
    poolMat.color.copy(poolWarm).multiplyScalar(env.lamps * (0.4 + env.wet * 0.5));
    shopPoolMat.color.setRGB(1, 0.85, 0.65).multiplyScalar(env.shop * (0.14 + env.wet * 0.2));
    signMat.color.setScalar(0.75 + env.night * 0.9);
    neonMat.color.setScalar(0.9 + env.night * 2.0);
    lanternMat.color.setRGB(1, 0.16, 0.05).multiplyScalar(0.8 + env.night * 2.2);
    bulbMat.color.setScalar(0.6 + env.night * 2.4 * (0.9 + 0.1 * Math.sin(time * 3)));
    glowMat.color.setScalar(0.7 + env.night * 1.5);
    beaconMat.color.setRGB(Math.max(0, Math.sin(time * 2.4)) > 0.75 ? 4 : 0.15, 0.02, 0.02);

    groundMat.color.lerpColors(dryColor, wetColor, env.wet);
    groundMat.roughness = 0.95 - env.wet * 0.6;
    markMat.roughness = groundMat.roughness;
    walkMat.roughness = 0.9 - env.wet * 0.45;
  }

  return { group, update, buildingCount: bld.length, lampCount: lamps.length };
}
