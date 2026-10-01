import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Give every vertex of a geometry the same colour (multiplied with instanceColor). */
export function paint(geo, c) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set(c, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const box = (w, h, d, x, y, z, c) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

// All vehicles are modelled facing +x, origin on the ground at their centre.

/** Scooter / motorbike frame (~1.9 m). Body colour comes from instanceColor. */
export function bikeFrameGeo() {
  return mergeGeometries([
    box(0.5, 0.5, 0.12, 0.66, 0.27, 0, [0.04, 0.04, 0.04]),    // front wheel
    box(0.5, 0.5, 0.14, -0.66, 0.27, 0, [0.04, 0.04, 0.04]),   // rear wheel
    box(1.15, 0.34, 0.38, -0.12, 0.58, 0, [1, 1, 1]),          // body
    box(0.22, 0.62, 0.42, 0.52, 0.78, 0, [1, 1, 1]),           // front shield
    box(0.72, 0.12, 0.34, -0.2, 0.82, 0, [0.07, 0.07, 0.07]),  // seat
    box(0.08, 0.06, 0.68, 0.5, 1.12, 0, [0.1, 0.1, 0.1]),      // handlebar
    box(0.3, 0.1, 0.3, -0.8, 0.62, 0, [0.15, 0.15, 0.15]),     // rear rack
  ]);
}

/** Seated rider (shirt colour from instanceColor; legs darker). */
export function riderGeo() {
  return mergeGeometries([
    paint(new THREE.BoxGeometry(0.3, 0.6, 0.44).rotateZ(-0.18).translate(-0.18, 1.22, 0), [1, 1, 1]), // torso
    box(0.52, 0.18, 0.4, 0.06, 0.92, 0, [0.32, 0.32, 0.34]),     // thighs
    box(0.14, 0.4, 0.36, 0.3, 0.72, 0, [0.3, 0.3, 0.32]),        // shins
    paint(new THREE.BoxGeometry(0.5, 0.11, 0.5).rotateZ(-0.35).translate(0.18, 1.24, 0), [1, 1, 1]),   // arms
    box(0.16, 0.12, 0.16, -0.12, 1.57, 0, [0.85, 0.65, 0.5]),    // neck
  ]);
}

/** Helmet (colour from instanceColor) with a dark visor. */
export function helmetGeo() {
  return mergeGeometries([
    paint(new THREE.SphereGeometry(0.17, 8, 6).scale(1.05, 0.95, 0.95).translate(-0.1, 1.74, 0), [1, 1, 1]),
    box(0.06, 0.1, 0.24, 0.06, 1.69, 0, [0.15, 0.15, 0.15]),
  ]);
}

export function carGeo() {
  return mergeGeometries([
    box(4.4, 0.72, 1.9, 0, 0.72, 0, [1, 1, 1]),
    box(2.3, 0.62, 1.68, -0.25, 1.38, 0, [0.08, 0.09, 0.11]),
    box(3.5, 0.5, 2.0, 0, 0.3, 0, [0.03, 0.03, 0.03]),
  ]);
}

export function busGeo() {
  return mergeGeometries([
    box(11, 1.2, 2.5, 0, 0.95, 0, [1, 1, 1]),
    box(11, 0.4, 2.5, 0, 2.75, 0, [1, 1, 1]),
    box(0.1, 1.0, 2.3, 5.5, 2.05, 0, [0.08, 0.08, 0.09]),         // windscreen frame
    box(1.3, 0.6, 2.56, 3.6, 0.35, 0, [0.03, 0.03, 0.03]),
    box(1.3, 0.6, 2.56, -3.4, 0.35, 0, [0.03, 0.03, 0.03]),
    box(10.9, 0.12, 2.48, 0, 1.6, 0, [0.9, 0.9, 0.9]),             // white stripe
  ]);
}

/** Lit window band of a bus (rendered with an emissive material). */
export function busWindowGeo() {
  return new THREE.BoxGeometry(10.8, 0.95, 2.46).translate(-0.05, 2.06, 0);
}

export const VEHICLE_LIGHTS = {
  bike: {
    head: () => new THREE.BoxGeometry(0.06, 0.12, 0.2).translate(0.64, 1.0, 0),
    tail: () => new THREE.BoxGeometry(0.06, 0.1, 0.22).translate(-0.96, 0.72, 0),
    beam: [9, 3.6],
  },
  car: {
    head: () => mergeGeometries([
      new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.8, 0.62),
      new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.8, -0.62),
    ]),
    tail: () => mergeGeometries([
      new THREE.BoxGeometry(0.08, 0.18, 0.5).translate(-2.21, 0.85, 0.6),
      new THREE.BoxGeometry(0.08, 0.18, 0.5).translate(-2.21, 0.85, -0.6),
    ]),
    beam: [16, 7],
  },
  bus: {
    head: () => mergeGeometries([
      new THREE.BoxGeometry(0.08, 0.25, 0.4).translate(5.51, 0.8, 0.9),
      new THREE.BoxGeometry(0.08, 0.25, 0.4).translate(5.51, 0.8, -0.9),
    ]),
    tail: () => mergeGeometries([
      new THREE.BoxGeometry(0.08, 0.3, 0.3).translate(-5.51, 0.9, 1.0),
      new THREE.BoxGeometry(0.08, 0.3, 0.3).translate(-5.51, 0.9, -1.0),
    ]),
    beam: [18, 8],
  },
};

export const BIKE_COLORS = ['#b71c1c', '#212121', '#eeeeee', '#1565c0', '#9e9e9e', '#d32f2f', '#2e2e2e', '#6d4c41', '#f5f5f5', '#0d47a1', '#c62828', '#455a64'];
export const SHIRT_COLORS = ['#ffffff', '#e8e8e8', '#1e3a8a', '#f87171', '#fbbf24', '#10b981', '#6b7280', '#111827', '#f472b6', '#60a5fa', '#a16207', '#7c3aed', '#fb923c'];
export const HELMET_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#212121', '#43a047', '#fb8c00', '#ec407a', '#8e24aa', '#00acc1'];
export const RAINCOAT_COLORS = ['#2d7ff9', '#ff4f9a', '#ffd23f', '#3ad18a', '#a35cff', '#ff7a2f', '#20c5d8', '#e9ff70'];
export const CAR_COLORS = ['#f2f2f2', '#1f8a4c', '#ffffff', '#c9cbd0', '#1a1c22', '#8f1d22', '#1f3a6b', '#00b14f', '#e3e3e3', '#6b6f78'];
export const BUS_COLORS = ['#2e9e4f', '#2e9e4f', '#f2a900', '#d6402b'];
