import * as THREE from 'three';

/** Small seeded PRNG so the city looks the same every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);

/** Soft round glow, used for street-lamp light pools on the asphalt. */
export function radialTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cone of light thrown on the road by a car's headlights (u = forward). */
export function beamTexture(w = 128, h = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = (y / (h - 1)) * 2 - 1;
      const spread = 0.25 + u * 0.75;
      const across = Math.max(0, 1 - Math.abs(v) / spread);
      const along = Math.pow(1 - u, 1.6) * Math.min(1, u * 8);
      const a = Math.pow(across, 1.5) * along;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Shared fog snippet for custom shaders (matches THREE.FogExp2). */
export const fogGLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  vec3 applyFog(vec3 col, vec3 worldPos) {
    float d = length(worldPos - cameraPosition);
    float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
    return mix(col, uFogColor, clamp(f, 0.0, 1.0));
  }
`;

/**
 * Texture atlas of Vietnamese shop signs: 2 columns x 8 rows (16 signs).
 * Sign k lives in column k % 2, row floor(k / 2) counted from the top.
 */
export const SIGN_COLS = 2;
export const SIGN_ROWS = 8;
export function signAtlas() {
  const W = 1024, H = 1024, cw = W / SIGN_COLS, ch = H / SIGN_ROWS;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const signs = [
    ['PHỞ BÒ', 'GIA TRUYỀN', '#c62828', '#ffeb3b'],
    ['CÀ PHÊ', 'MUỐI · SỮA ĐÁ', '#4e342e', '#ffcc80'],
    ['TẠP HÓA', 'MINH TÂM', '#1565c0', '#ffffff'],
    ['BÚN BÒ HUẾ', 'O XUÂN', '#2e7d32', '#ffee58'],
    ['CƠM TẤM', 'SƯỜN BÌ CHẢ', '#ef6c00', '#ffffff'],
    ['TRÀ SỮA', 'TRÂN CHÂU', '#ec407a', '#ffffff'],
    ['TIỆM VÀNG', 'KIM THÀNH', '#b71c1c', '#ffd54f'],
    ['SỬA XE', 'VÁ VỎ · THAY NHỚT', '#263238', '#4fc3f7'],
    ['KARAOKE', 'NICE', '#6a1b9a', '#f8bbd0'],
    ['NHÀ THUỐC', 'TÂM ĐỨC', '#00897b', '#ffffff'],
    ['BÁNH MÌ', 'HUỲNH HOA', '#f9a825', '#b71c1c'],
    ['LẨU NƯỚNG', 'BIA TƯƠI', '#d84315', '#fff59d'],
    ['HỦ TIẾU', 'NAM VANG', '#0277bd', '#ffeb3b'],
    ['SPA · NAIL', 'LINH', '#ad1457', '#ffffff'],
    ['ĐIỆN THOẠI', 'MUA BÁN · SỬA CHỮA', '#283593', '#ffeb3b'],
    ['BIA HƠI', 'HÀ NỘI', '#1b5e20', '#fff176'],
  ];
  const font = '"Arial Black", "Helvetica Neue", Arial, "Noto Sans", sans-serif';
  signs.forEach(([title, sub, bg, fg], k) => {
    const x = (k % SIGN_COLS) * cw, y = Math.floor(k / SIGN_COLS) * ch;
    g.fillStyle = bg;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 58px ${font}`;
    const tw = g.measureText(title).width;
    const sx = Math.min(1, (cw - 40) / tw);
    g.save();
    g.translate(x + cw / 2, y + ch * 0.42);
    g.scale(sx, 1);
    g.fillText(title, 0, 0);
    g.restore();
    g.font = `700 22px ${font}`;
    g.globalAlpha = 0.9;
    g.fillText(sub, x + cw / 2, y + ch * 0.8);
    g.globalAlpha = 1;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, count: signs.length };
}

/** Points along a sagging wire between a and b (simple parabola). */
export function sagPoints(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t),
      a.z + (b.z - a.z) * t,
    ));
  }
  return pts;
}
