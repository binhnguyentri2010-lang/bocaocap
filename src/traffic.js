import * as THREE from 'three';
import { N, ROAD, PITCH, nodeCoord, SIDEWALK_H } from './city.js';
import { mulberry32, beamTexture, clamp } from './utils.js';
import {
  bikeFrameGeo, riderGeo, helmetGeo, carGeo, busGeo, busWindowGeo, VEHICLE_LIGHTS,
  BIKE_COLORS, SHIRT_COLORS, HELMET_COLORS, RAINCOAT_COLORS, CAR_COLORS, BUS_COLORS,
} from './vehicles.js';

// Directions: 0:+x 1:+z 2:-x 3:-z ; right-hand traffic.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const right = (d) => DIRS[(d + 1) % 4];
const STRAIGHT_LEN = PITCH - ROAD;
const HALF = ROAD / 2;

// Traffic-light cycle (seconds): axis X green, yellow, all-red, axis Z green, yellow, all-red
const CYCLE = [11, 2.5, 1, 11, 2.5, 1];
const CYCLE_T = CYCLE.reduce((a, b) => a + b, 0);

function lightState(phaseOffset, time, axis) {
  let t = (time + phaseOffset) % CYCLE_T;
  let idx = 0;
  while (t >= CYCLE[idx]) { t -= CYCLE[idx]; idx++; }
  if (axis === 0) return idx === 0 ? 'g' : idx === 1 ? 'y' : 'r';
  return idx === 3 ? 'g' : idx === 4 ? 'y' : 'r';
}

// lat = lateral offset from the road centre line, on the right-hand half
const TYPES = {
  bike: { len: 1.9, width: 0.8, gap: 0.8, speed: [7, 11], lat: [0.9, HALF - 0.8], latRate: 1.3, front: 0.9 },
  car: { len: 4.4, width: 2.0, gap: 1.8, speed: [8, 12], lat: [2.2, 4.6], latRate: 0.5, front: 2.2 },
  bus: { len: 11, width: 2.6, gap: 2.5, speed: [6, 8.5], lat: [3.6, 4.4], latRate: 0.3, front: 5.5 },
};

export function createTraffic(counts) {
  const rand = mulberry32(777);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const group = new THREE.Group();

  const valid = (i, j) => i >= 0 && j >= 0 && i <= N && j <= N;
  const phase = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) phase.push(rand() * CYCLE_T);
  const phaseAt = (i, j) => phase[i * (N + 1) + j];

  // ---------------------------------------------------------------- vehicles
  const vehicles = [];

  function chooseNext(c) {
    const ni = c.i + DIRS[c.d][0], nj = c.j + DIRS[c.d][1];
    const opts = [];
    for (const nd of [c.d, (c.d + 1) % 4, (c.d + 3) % 4]) {
      if (valid(ni + DIRS[nd][0], nj + DIRS[nd][1])) opts.push(nd);
    }
    // far from downtown, prefer heading back toward the centre (keeps the busy streets busy)
    const mid = N / 2;
    const inward = opts.filter((d) => Math.abs(ni + DIRS[d][0] - mid) + Math.abs(nj + DIRS[d][1] - mid) < Math.abs(ni - mid) + Math.abs(nj - mid));
    const far = Math.max(Math.abs(ni - mid), Math.abs(nj - mid)) >= 2;
    let nd;
    if (!opts.length) nd = (c.d + 2) % 4;
    else if (far && inward.length && rand() < 0.5) nd = pick(inward);
    else if (opts.includes(c.d) && rand() < 0.55) nd = c.d;
    else nd = pick(opts);
    c.ni = ni; c.nj = nj; c.nd = nd;
    c.toKey = `${ni},${nj},${nd}`;
  }

  function buildTurn(c) {
    const cx = nodeCoord(c.ni), cz = nodeCoord(c.nj);
    const [dx, dz] = DIRS[c.d], [ex, ez] = DIRS[c.nd];
    const [rx, rz] = right(c.d), [sx, sz] = right(c.nd);
    const L = c.lat;
    c.p0.set(cx - dx * HALF + rx * L, 0, cz - dz * HALF + rz * L);
    c.p2.set(cx + ex * HALF + sx * L, 0, cz + ez * HALF + sz * L);
    if (c.nd === c.d) c.p1.copy(c.p0).add(c.p2).multiplyScalar(0.5);
    else if (c.nd === (c.d + 2) % 4) c.p1.set(cx + dx * ROAD, 0, cz + dz * ROAD);
    else c.p1.set(cx + rx * L + sx * L, 0, cz + rz * L + sz * L);
    c.turnLen = (c.p0.distanceTo(c.p1) + c.p1.distanceTo(c.p2) + c.p0.distanceTo(c.p2)) / 2;
  }

  function startStraight(c) {
    c.key = `${c.i},${c.j},${c.d}`;
    c.phase = 0;
    chooseNext(c);
  }

  function makeVehicle(type, i, j, d, s) {
    const T = TYPES[type];
    const c = {
      type, T, i, j, d, s,
      len: T.len, width: T.width,
      lat: T.lat[0] + rand() * (T.lat[1] - T.lat[0]),
      p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(),
      pos: new THREE.Vector3(), heading: new THREE.Vector3(1, 0, 0),
      maxSpeed: T.speed[0] + rand() * (T.speed[1] - T.speed[0]),
      speed: 0, braking: false, latVel: 0,
      wob: rand() * 10, retarget: rand() * 5,
      rebel: type === 'bike' && rand() < 0.05, // runs red lights, as some do…
      turnLen: ROAD,
    };
    c.latTarget = c.lat;
    c.speed = c.maxSpeed * 0.6;
    startStraight(c);
    c.s = s;
    return c;
  }

  const overlaps = (aLat, aW, b) => Math.abs(aLat - b.lat) < (aW + b.width) / 2 + 0.25;

  function spawn(type) {
    const T = TYPES[type];
    for (let tries = 0; tries < 80; tries++) {
      // spawn mostly around downtown
      const g = () => clamp(Math.round(N / 2 + (rand() + rand() + rand() - 1.5) * N * 0.55), 0, N);
      const i = g(), j = g();
      const opts = [0, 1, 2, 3].filter((d) => valid(i + DIRS[d][0], j + DIRS[d][1]));
      const d = pick(opts);
      const s = T.len / 2 + rand() * (STRAIGHT_LEN - T.len - 2);
      const c = makeVehicle(type, i, j, d, s);
      const key = c.key;
      if (vehicles.some((o) => o.key === key && Math.abs(o.s - s) < (o.len + c.len) / 2 + 1 && overlaps(c.lat, c.width, o))) continue;
      vehicles.push(c);
      return c;
    }
    return null;
  }
  for (let k = 0; k < counts.bikes; k++) spawn('bike');
  const bikeCount = vehicles.length;
  for (let k = 0; k < counts.cars; k++) spawn('car');
  for (let k = 0; k < counts.buses; k++) spawn('bus');
  const bikes = vehicles.filter((v) => v.type === 'bike');
  const cars = vehicles.filter((v) => v.type === 'car');
  const buses = vehicles.filter((v) => v.type === 'bus');

  // ---------------------------------------------------------------- meshes
  const beamTex = beamTexture();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex, color: 0xfff1d6, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
  });

  function dyn(geo, mat, n) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.count = n;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    group.add(m);
    return m;
  }

  const fleets = [];
  for (const [type, list, geo, palette] of [
    ['bike', bikes, bikeFrameGeo(), BIKE_COLORS],
    ['car', cars, carGeo(), CAR_COLORS],
    ['bus', buses, busGeo(), BUS_COLORS],
  ]) {
    const L = VEHICLE_LIGHTS[type];
    const [bl, bw] = L.beam;
    const f = {
      list,
      body: dyn(geo, bodyMat, list.length),
      head: dyn(L.head(), headMat, list.length),
      tail: dyn(L.tail(), tailMat, list.length),
      beam: dyn(new THREE.PlaneGeometry(bl, bw).rotateX(-Math.PI / 2).translate(TYPES[type].front + bl / 2, 0.05, 0), beamMat, list.length),
    };
    f.beam.renderOrder = 2;
    list.forEach((v, k) => {
      f.body.setColorAt(k, new THREE.Color(pick(palette)));
      f.tail.setColorAt(k, new THREE.Color(0.7, 0.7, 0.7));
    });
    fleets.push(f);
  }

  // riders: one per bike, plus some passengers
  const riderMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const riders = [];
  for (const b of bikes) {
    riders.push({ bike: b, offset: 0, shirt: new THREE.Color(pick(SHIRT_COLORS)), coat: new THREE.Color(pick(RAINCOAT_COLORS)), helmet: new THREE.Color(pick(HELMET_COLORS)) });
    if (rand() < 0.35) riders.push({ bike: b, offset: -0.46, shirt: new THREE.Color(pick(SHIRT_COLORS)), coat: new THREE.Color(pick(RAINCOAT_COLORS)), helmet: new THREE.Color(pick(HELMET_COLORS)) });
  }
  const riderMesh = dyn(riderGeo(), riderMat, riders.length);
  const helmetMesh = dyn(helmetGeo(), riderMat, riders.length);
  riders.forEach((r, k) => {
    riderMesh.setColorAt(k, r.shirt);
    helmetMesh.setColorAt(k, r.helmet);
  });
  let rainy = false;

  const busWinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const busWin = dyn(busWindowGeo(), busWinMat, buses.length);

  // ---------------------------------------------------------------- traffic lights
  const sigPos = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const o = HALF + 0.4;
      for (let d = 0; d < 4; d++) {
        const pi = i - DIRS[d][0], pj = j - DIRS[d][1];
        if (!valid(pi, pj)) continue;
        const [dx, dz] = DIRS[d], [rx, rz] = right(d);
        sigPos.push({ i, j, axis: d % 2, x: nodeCoord(i) - dx * o + rx * o, z: nodeCoord(j) - dz * o + rz * o });
      }
    }
  }
  const m4 = new THREE.Matrix4();
  const sigPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 6).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.7 }), sigPos.length);
  const sigLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), sigPos.length);
  sigPos.forEach((p, k) => {
    sigPoles.setMatrixAt(k, m4.makeTranslation(p.x, SIDEWALK_H, p.z));
    sigLights.setMatrixAt(k, m4.makeTranslation(p.x, 4.85, p.z));
    sigLights.setColorAt(k, new THREE.Color(0, 0, 0));
  });
  group.add(sigPoles, sigLights);
  const SIG = { g: new THREE.Color(0.15, 1.0, 0.45), y: new THREE.Color(1.0, 0.62, 0.08), r: new THREE.Color(1.0, 0.07, 0.05) };

  // ---------------------------------------------------------------- simulation
  const buckets = new Map();
  function rebuildBuckets() {
    for (const arr of buckets.values()) arr.length = 0;
    for (const v of vehicles) {
      let arr = buckets.get(v.key);
      if (!arr) buckets.set(v.key, (arr = []));
      arr.push(v);
    }
  }

  /** Free distance (bumper to bumper) to the nearest vehicle ahead whose path overlaps lateral position `lat`. */
  function freeAhead(c, lat, lookBehind = 0) {
    let free = Infinity;
    const same = buckets.get(c.key);
    if (same) {
      for (const o of same) {
        if (o === c || !overlaps(lat, c.width, o)) continue;
        let d;
        if (c.phase === 0) {
          if (o.phase === 0 && o.s > c.s - lookBehind) d = o.s - c.s;
          else if (o.phase === 1) d = STRAIGHT_LEN - c.s + o.s;
          else continue;
        } else if (o.phase === 1 && o.toKey === c.toKey && o.s > c.s) d = o.s - c.s;
        else continue;
        free = Math.min(free, d - (c.len + o.len) / 2);
      }
    }
    const next = buckets.get(c.toKey);
    if (next) {
      const base = c.phase === 0 ? STRAIGHT_LEN - c.s + ROAD : c.turnLen - c.s;
      for (const o of next) {
        if (o.phase !== 0 || !overlaps(lat, c.width, o)) continue;
        free = Math.min(free, base + o.s - (c.len + o.len) / 2);
      }
    }
    return free;
  }

  function stopLine(c, time) {
    if (c.phase !== 0 || c.rebel) return Infinity;
    const st = lightState(phaseAt(c.ni, c.nj), time, c.d % 2);
    if (st === 'g') return Infinity;
    const toLine = STRAIGHT_LEN - 0.4 - c.s - c.len / 2;
    const brakeDist = (c.speed * c.speed) / (2 * 6);
    if (st === 'y' && toLine < brakeDist) return Infinity; // too close, go through
    return toLine > -1 ? toLine : Infinity;
  }

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

  function step(c, dt, time) {
    const T = c.T;
    const lead = freeAhead(c, c.lat);
    const free = Math.min(lead, stopLine(c, time));
    const target = c.maxSpeed * clamp((free - T.gap) / (c.type === 'bike' ? 5 : 8), 0, 1);
    const prev = c.speed;
    c.speed += clamp(target - c.speed, -10 * dt, (c.type === 'bike' ? 4 : 2.8) * dt);
    c.speed = Math.max(0, c.speed);
    c.braking = c.speed < prev - 0.02 || (c.speed < 0.3 && target < 0.5);

    // weave: drift sideways, look for a gap when stuck behind someone
    c.retarget -= dt;
    if (c.phase === 0 && c.retarget <= 0) {
      c.retarget = c.type === 'bike' ? 1.2 + rand() * 3 : 6 + rand() * 6;
      if (lead < 8 || rand() < 0.3) {
        let best = c.latTarget, bestFree = lead;
        for (let k = 0; k < 4; k++) {
          const cand = T.lat[0] + rand() * (T.lat[1] - T.lat[0]);
          const f = freeAhead(c, cand, (c.len + 2.2) / 2);
          if (f > bestFree + 1.5) { best = cand; bestFree = f; }
        }
        c.latTarget = best;
      }
    }
    const prevLat = c.lat;
    if (c.phase === 0 && c.speed > 0.5) {
      c.lat += clamp(c.latTarget - c.lat, -T.latRate * dt, T.latRate * dt);
    }
    c.latVel = (c.lat - prevLat) / Math.max(dt, 1e-4);

    c.s += c.speed * dt;
    if (c.phase === 0 && c.s >= STRAIGHT_LEN) {
      c.s -= STRAIGHT_LEN;
      c.phase = 1;
      buildTurn(c);
    }
    if (c.phase === 1 && c.s >= c.turnLen) {
      c.s -= c.turnLen;
      c.i = c.ni; c.j = c.nj; c.d = c.nd;
      startStraight(c);
    }

    if (c.phase === 0) {
      const [dx, dz] = DIRS[c.d], [rx, rz] = right(c.d);
      const along = HALF + c.s;
      c.pos.set(nodeCoord(c.i) + dx * along + rx * c.lat, 0, nodeCoord(c.j) + dz * along + rz * c.lat);
      c.heading.set(dx, 0, dz);
      // tilt the heading a touch when changing lateral position
      if (Math.abs(c.latVel) > 0.05 && c.speed > 1) {
        c.heading.addScaledVector(new THREE.Vector3(rx, 0, rz), clamp(c.latVel / c.speed, -0.3, 0.3)).normalize();
      }
    } else {
      const t = clamp(c.s / c.turnLen, 0, 1);
      bezier(c, t, c.pos);
      bezierTan(c, t, c.heading);
    }
  }

  const up = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3(1, 0, 0);
  const qYaw = new THREE.Quaternion();
  const qRoll = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const coatScale = new THREE.Vector3(1.12, 1.04, 1.28);
  const tmpC = new THREE.Color();
  const offM = new THREE.Matrix4();
  const sclM = new THREE.Matrix4();
  let lastSigUpdate = -1;

  function update(dt, env, time) {
    rebuildBuckets();
    for (const c of vehicles) step(c, dt, time);

    const nightK = env.night;
    headMat.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.8 + nightK * 2.4);
    beamMat.color.setRGB(1, 0.94, 0.82).multiplyScalar((0.02 + nightK * 0.2) * (1 + env.wet * 0.6));
    tailMat.color.setRGB(1, 0.05, 0.03).multiplyScalar(0.8 + nightK * 1.6);
    busWinMat.color.setRGB(0.9, 0.97, 1.0).multiplyScalar(0.25 + nightK * 1.3);

    for (const f of fleets) {
      f.list.forEach((c, k) => {
        qYaw.setFromAxisAngle(up, Math.atan2(-c.heading.z, c.heading.x));
        if (c.type === 'bike') {
          c.wob += dt * (1.2 + c.speed * 0.15);
          const roll = Math.sin(c.wob) * 0.03 * Math.min(1, c.speed / 3) - clamp(c.latVel * 0.08, -0.15, 0.15);
          qRoll.setFromAxisAngle(fwd, roll);
          q.multiplyQuaternions(qYaw, qRoll);
        } else q.copy(qYaw);
        m4.compose(c.pos, q, one);
        c.matrix = c.matrix || new THREE.Matrix4();
        c.matrix.copy(m4);
        f.body.setMatrixAt(k, m4);
        f.head.setMatrixAt(k, m4);
        f.tail.setMatrixAt(k, m4);
        f.beam.setMatrixAt(k, m4);
        f.tail.setColorAt(k, tmpC.setScalar(c.braking ? 2.2 : 0.7));
        if (c.type === 'bus') busWin.setMatrixAt(k, m4);
      });
      for (const m of [f.body, f.head, f.tail, f.beam]) m.instanceMatrix.needsUpdate = true;
      f.tail.instanceColor.needsUpdate = true;
    }
    busWin.instanceMatrix.needsUpdate = true;

    // riders follow their bikes; raincoats when it pours
    const nowRainy = env.rain > 0.25;
    if (nowRainy !== rainy) {
      rainy = nowRainy;
      riders.forEach((r, k) => riderMesh.setColorAt(k, rainy ? r.coat : r.shirt));
      riderMesh.instanceColor.needsUpdate = true;
    }
    riders.forEach((r, k) => {
      offM.makeTranslation(r.offset, r.offset ? 0.04 : 0, 0);
      m4.multiplyMatrices(r.bike.matrix, offM);
      helmetMesh.setMatrixAt(k, m4);
      if (rainy) m4.multiply(sclM.makeScale(coatScale.x, coatScale.y, coatScale.z));
      riderMesh.setMatrixAt(k, m4);
    });
    riderMesh.instanceMatrix.needsUpdate = true;
    helmetMesh.instanceMatrix.needsUpdate = true;

    if (time - lastSigUpdate > 0.2) {
      lastSigUpdate = time;
      const k2 = 0.6 + nightK * 1.6;
      sigPos.forEach((p, k) => sigLights.setColorAt(k, tmpC.copy(SIG[lightState(phaseAt(p.i, p.j), time, p.axis)]).multiplyScalar(k2)));
      sigLights.instanceColor.needsUpdate = true;
    }
  }

  /** Pose for the "follow" camera. Indices below bikeCount are motorbikes. */
  function carPose(k, outPos, outDir) {
    const c = vehicles[k % vehicles.length];
    outPos.copy(c.pos);
    outDir.copy(c.heading);
    return c;
  }

  return { group, update, carPose, count: vehicles.length, bikeCount };
}
