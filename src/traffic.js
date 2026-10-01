import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { N, ROAD, LANE, PITCH, nodeCoord } from './city.js';
import { mulberry32, beamTexture, clamp } from './utils.js';

// Directions: 0:+x 1:+z 2:-x 3:-z ; right-hand traffic.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const right = (d) => DIRS[(d + 1) % 4];
const STRAIGHT_LEN = PITCH - ROAD;

// Traffic-light cycle (seconds): axis X green, yellow, all-red, axis Z green, yellow, all-red
const CYCLE = [9, 2, 1, 9, 2, 1];
const CYCLE_T = CYCLE.reduce((a, b) => a + b, 0);

function lightState(phaseOffset, time, axis) {
  let t = (time + phaseOffset) % CYCLE_T;
  let idx = 0;
  while (t >= CYCLE[idx]) { t -= CYCLE[idx]; idx++; }
  // idx: 0 X green, 1 X yellow, 2 red, 3 Z green, 4 Z yellow, 5 red
  if (axis === 0) return idx === 0 ? 'g' : idx === 1 ? 'y' : 'r';
  return idx === 3 ? 'g' : idx === 4 ? 'y' : 'r';
}

function paint(geo, c) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set(c, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function createTraffic(count) {
  const rand = mulberry32(777);
  const group = new THREE.Group();

  const nodePos = (i, j) => new THREE.Vector3(nodeCoord(i), 0, nodeCoord(j));
  const valid = (i, j) => i >= 0 && j >= 0 && i <= N && j <= N;
  const phase = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) phase.push(rand() * CYCLE_T);
  const phaseAt = (i, j) => phase[i * (N + 1) + j];

  // ---- geometry: car modelled along +x, ~4.4 m long ----
  const carGeo = mergeGeometries([
    paint(new THREE.BoxGeometry(4.4, 0.72, 1.9).translate(0, 0.72, 0), [1, 1, 1]),
    paint(new THREE.BoxGeometry(2.3, 0.62, 1.68).translate(-0.25, 1.38, 0), [0.08, 0.09, 0.11]),
    paint(new THREE.BoxGeometry(3.5, 0.5, 2.0).translate(0, 0.3, 0), [0.03, 0.03, 0.03]),
  ]);
  const headGeo = mergeGeometries([
    new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.8, 0.62),
    new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.8, -0.62),
  ]);
  const tailGeo = mergeGeometries([
    new THREE.BoxGeometry(0.08, 0.18, 0.5).translate(-2.21, 0.85, 0.6),
    new THREE.BoxGeometry(0.08, 0.18, 0.5).translate(-2.21, 0.85, -0.6),
  ]);
  const beamGeo = new THREE.PlaneGeometry(16, 7).rotateX(-Math.PI / 2).translate(2.2 + 8, 0.05, 0);

  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(), color: 0xfff1d6, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });

  const cars3d = new THREE.InstancedMesh(carGeo, carMat, count);
  const heads = new THREE.InstancedMesh(headGeo, headMat, count);
  const tails = new THREE.InstancedMesh(tailGeo, tailMat, count);
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, count);
  for (const m of [cars3d, heads, tails, beams]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
  }
  beams.renderOrder = 2;
  group.add(cars3d, heads, tails, beams);

  const palette = ['#e8e8ea', '#c9cbd0', '#1a1c22', '#2b2f3a', '#8f1d22', '#1f3a6b', '#e3b021', '#f2f2f2', '#3d4a3a', '#6b6f78', '#2a6e5c', '#b8452c'];
  const tailColor = new THREE.Color();
  const headWarm = new THREE.Color(1, 0.95, 0.85);

  // ---- car state ----
  const cars = [];

  function planNext(c) {
    // choose the direction to take at the node we are driving toward
    const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1];
    const opts = [];
    for (const nd of [c.d, (c.d + 1) % 4, (c.d + 3) % 4]) {
      if (valid(ni + DIRS[nd][0], nj + DIRS[nd][1])) opts.push(nd);
    }
    let nd;
    if (!opts.length) nd = (c.d + 2) % 4;
    else if (opts.includes(c.d) && rand() < 0.62) nd = c.d;
    else nd = opts[Math.floor(rand() * opts.length)];
    c.nd = nd;
    c.ni = ni; c.nj = nj;
    const center = nodePos(ni, nj);
    const [dx, dz] = DIRS[c.d], [ex, ez] = DIRS[nd];
    const [rx, rz] = right(c.d), [sx, sz] = right(nd);
    c.p0.set(center.x - dx * ROAD / 2 + rx * LANE, 0, center.z - dz * ROAD / 2 + rz * LANE);
    c.p2.set(center.x + ex * ROAD / 2 + sx * LANE, 0, center.z + ez * ROAD / 2 + sz * LANE);
    if (nd === c.d) c.p1.copy(c.p0).add(c.p2).multiplyScalar(0.5);
    else if (nd === (c.d + 2) % 4) c.p1.set(center.x + dx * ROAD, 0, center.z + dz * ROAD);
    else c.p1.set(center.x + rx * LANE + sx * LANE, 0, center.z + rz * LANE + sz * LANE);
    c.turnLen = (c.p0.distanceTo(c.p1) + c.p1.distanceTo(c.p2) + c.p0.distanceTo(c.p2)) / 2;
    c.toKey = `${ni},${nj},${nd}`;
  }

  function startStraight(c) {
    const p = nodePos(c.i, c.j);
    const [dx, dz] = DIRS[c.d], [rx, rz] = right(c.d);
    c.a.set(p.x + dx * ROAD / 2 + rx * LANE, 0, p.z + dz * ROAD / 2 + rz * LANE);
    c.b.set(c.a.x + dx * STRAIGHT_LEN, 0, c.a.z + dz * STRAIGHT_LEN);
    c.key = `${c.i},${c.j},${c.d}`;
    c.phase = 0;
    planNext(c);
  }

  function spawn(idx) {
    for (let tries = 0; tries < 50; tries++) {
      const i = Math.floor(rand() * (N + 1)), j = Math.floor(rand() * (N + 1));
      const opts = [0, 1, 2, 3].filter((d) => valid(i + DIRS[d][0], j + DIRS[d][1]));
      const d = opts[Math.floor(rand() * opts.length)];
      const s = 2 + rand() * (STRAIGHT_LEN - 12);
      const key = `${i},${j},${d}`;
      if (cars.some((o) => o.key === key && Math.abs(o.s - s) < 9)) continue;
      const kind = rand();
      const scale = kind < 0.12 ? new THREE.Vector3(1.18, 1.3, 1.06) : kind < 0.3 ? new THREE.Vector3(0.88, 0.98, 0.95) : new THREE.Vector3(1, 1, 1);
      const c = {
        i, j, d, s,
        a: new THREE.Vector3(), b: new THREE.Vector3(),
        p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(),
        pos: new THREE.Vector3(), heading: new THREE.Vector3(1, 0, 0),
        maxSpeed: 8 + rand() * 6, speed: 0, braking: false, scale,
      };
      c.speed = c.maxSpeed * 0.6;
      startStraight(c);
      c.s = s;
      cars3d.setColorAt(idx, new THREE.Color(palette[Math.floor(rand() * palette.length)]));
      cars.push(c);
      return;
    }
  }
  for (let k = 0; k < count; k++) spawn(k);
  cars3d.count = heads.count = tails.count = beams.count = cars.length;

  // ---- traffic lights (one signal head per corner) ----
  const sigPos = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const c = nodePos(i, j);
      const o = ROAD / 2 + 0.4;
      // the corner on the right-hand side *before* the intersection faces approaching traffic
      for (let d = 0; d < 4; d++) {
        const pi = i - DIRS[d][0], pj = j - DIRS[d][1];
        if (!valid(pi, pj)) continue;
        const [dx, dz] = DIRS[d], [rx, rz] = right(d);
        sigPos.push({ i, j, axis: d % 2, x: c.x - dx * o + rx * o, z: c.z - dz * o + rz * o });
      }
    }
  }
  const sigPoleGeo = new THREE.CylinderGeometry(0.09, 0.11, 4.6, 6).translate(0, 2.3, 0);
  const sigPoles = new THREE.InstancedMesh(sigPoleGeo, new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.7 }), sigPos.length);
  const sigMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sigLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), sigMat, sigPos.length);
  const m4 = new THREE.Matrix4();
  sigPos.forEach((p, k) => {
    m4.makeTranslation(p.x, 0.3, p.z);
    sigPoles.setMatrixAt(k, m4);
    m4.makeTranslation(p.x, 4.85, p.z);
    sigLights.setMatrixAt(k, m4);
    sigLights.setColorAt(k, new THREE.Color(0, 0, 0));
  });
  group.add(sigPoles, sigLights);
  const SIG = { g: new THREE.Color(0.15, 1.0, 0.45), y: new THREE.Color(1.0, 0.62, 0.08), r: new THREE.Color(1.0, 0.07, 0.05) };

  // ---- simulation ----
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tmp2 = new THREE.Color();
  let lastSigUpdate = -1;

  function bezier(c, t, out) {
    const it = 1 - t;
    return out.set(
      it * it * c.p0.x + 2 * it * t * c.p1.x + t * t * c.p2.x, 0,
      it * it * c.p0.z + 2 * it * t * c.p1.z + t * t * c.p2.z,
    );
  }
  function bezierTan(c, t, out) {
    return out.set(
      2 * (1 - t) * (c.p1.x - c.p0.x) + 2 * t * (c.p2.x - c.p1.x), 0,
      2 * (1 - t) * (c.p1.z - c.p0.z) + 2 * t * (c.p2.z - c.p1.z),
    ).normalize();
  }

  function gapAhead(c, time) {
    let gap = Infinity;
    for (const o of cars) {
      if (o === c) continue;
      if (c.phase === 0) {
        if (o.phase === 0 && o.key === c.key && o.s > c.s) gap = Math.min(gap, o.s - c.s);
        else if (o.phase === 1 && o.key === c.key) gap = Math.min(gap, STRAIGHT_LEN - c.s + o.s);
        else if (o.phase === 0 && o.key === c.toKey) gap = Math.min(gap, STRAIGHT_LEN - c.s + c.turnLen + o.s);
      } else {
        if (o.phase === 1 && o.key === c.key && o.toKey === c.toKey && o.s > c.s) gap = Math.min(gap, o.s - c.s);
        else if (o.phase === 0 && o.key === c.toKey) gap = Math.min(gap, c.turnLen - c.s + o.s);
      }
    }
    // red / yellow light at the end of the street
    if (c.phase === 0) {
      const st = lightState(phaseAt(c.ni, c.nj), time, c.d % 2);
      const toLine = STRAIGHT_LEN - c.s - 0.6;
      const brakeDist = (c.speed * c.speed) / (2 * 6) + 1;
      if (st === 'r' || (st === 'y' && toLine > brakeDist)) {
        if (toLine > -0.5) gap = Math.min(gap, toLine + 5.5);
      }
    }
    return gap;
  }

  function update(dt, env, time) {
    for (const c of cars) {
      const gap = gapAhead(c, time);
      const target = c.maxSpeed * clamp((gap - 6) / 14, 0, 1);
      const prev = c.speed;
      c.speed += clamp(target - c.speed, -9 * dt, 3.2 * dt);
      c.speed = Math.max(0, c.speed);
      c.braking = c.speed < prev - 0.02 || (c.speed < 0.3 && target < 0.5);
      c.s += c.speed * dt;

      if (c.phase === 0 && c.s >= STRAIGHT_LEN) {
        c.s -= STRAIGHT_LEN;
        c.phase = 1;
      }
      if (c.phase === 1 && c.s >= c.turnLen) {
        c.s -= c.turnLen;
        c.i = c.ni; c.j = c.nj; c.d = c.nd;
        startStraight(c);
      }

      if (c.phase === 0) {
        c.pos.lerpVectors(c.a, c.b, c.s / STRAIGHT_LEN);
        c.heading.set(DIRS[c.d][0], 0, DIRS[c.d][1]);
      } else {
        const t = clamp(c.s / c.turnLen, 0, 1);
        bezier(c, t, c.pos);
        bezierTan(c, t, c.heading);
      }
    }

    const nightK = env.night;
    headMat.color.copy(headWarm).multiplyScalar(0.8 + nightK * 2.4);
    beamMat.color.setRGB(1, 0.94, 0.82).multiplyScalar((0.02 + nightK * 0.22) * (1 + env.wet * 0.6));
    tailMat.color.setRGB(1, 0.05, 0.03).multiplyScalar(0.8 + nightK * 1.6);

    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      q.setFromAxisAngle(up, Math.atan2(-c.heading.z, c.heading.x));
      m4.compose(c.pos, q, c.scale);
      cars3d.setMatrixAt(k, m4);
      heads.setMatrixAt(k, m4);
      tails.setMatrixAt(k, m4);
      beams.setMatrixAt(k, m4);
      tails.setColorAt(k, tailColor.setScalar(c.braking ? 2.2 : 0.7));
    }
    cars3d.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    tails.instanceMatrix.needsUpdate = true;
    beams.instanceMatrix.needsUpdate = true;
    tails.instanceColor.needsUpdate = true;

    // signals change slowly; refresh a few times per second
    if (time - lastSigUpdate > 0.2) {
      lastSigUpdate = time;
      const k2 = 0.6 + nightK * 1.6;
      sigPos.forEach((p, k) => {
        const st = lightState(phaseAt(p.i, p.j), time, p.axis);
        sigLights.setColorAt(k, tmp2.copy(SIG[st]).multiplyScalar(k2));
      });
      sigLights.instanceColor.needsUpdate = true;
    }
  }

  /** Pose for the "follow a car" camera. */
  function carPose(k, outPos, outDir) {
    const c = cars[k % cars.length];
    outPos.copy(c.pos);
    outDir.copy(c.heading);
    return c;
  }

  return { group, update, carPose, count: cars.length };
}
