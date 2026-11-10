// Logic xếp hạng, không đụng DOM để test được bằng Node (rank.test.mjs).

export const TIERS = [
  { name: 'Gỗ', color: '#9b6b43' },
  { name: 'Sắt', color: '#7b828c' },
  { name: 'Đồng', color: '#c27a46' },
  { name: 'Bạc', color: '#c9d1dc' },
  { name: 'Vàng', color: '#f0bd3c' },
  { name: 'Bạch kim', color: '#4fd1c1' },
  { name: 'Kim cương', color: '#5b9cff' },
  { name: 'Cao thủ', color: '#ff5d73' },
  { name: 'Huyền thoại', color: '#c46bff' },
];
// Mỗi rank (trừ rank cao nhất) chia đều thành 3 bậc phụ.
export const SUBS = ['I', 'II', 'III'];
export const TOP = TIERS.length - 1;
export const label = (tier, sub) => (tier < TOP ? `${TIERS[tier].name} ${SUBS[sub]}` : TIERS[tier].name);

export const GROUPS = { chest: 'Ngực', back: 'Lưng', shoulders: 'Vai', arms: 'Tay', legs: 'Chân' };

// Bài gốc có bảng ngưỡng riêng:
//   std: ngưỡng (1RM ÷ cân nặng) để LÊN Sắt, Đồng, Bạc, Vàng, Bạch kim, Kim cương, Cao thủ, Huyền thoại — cho nam.
//   f:   hệ số cho nữ (ngưỡng nữ = std × f).
// Bài phụ mượn ngưỡng của bài gốc: like = bài gốc, k = hệ số nhân.
// bw: bài dùng trọng lượng cơ thể → tải = cân nặng + tạ đeo thêm (số âm = máy hỗ trợ).
// each: tạ tính cho MỖI TAY. machine: bài máy/cáp, mỗi phòng tập nặng nhẹ khác nhau.
// ponytail: mọi std, f và k là ƯỚC TÍNH từ hiểu biết chung về chuẩn sức mạnh, không có nguồn kiểm chứng — chỉnh tại đây.
export const EXERCISES = {
  bench:     { group: 'chest', name: 'Đẩy ngực (Bench press)', std: [0.35, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2], f: 0.6 },
  incline:   { group: 'chest', name: 'Đẩy ngực dốc lên (Incline bench)', like: 'bench', k: 0.85 },
  dbbench:   { group: 'chest', name: 'Đẩy ngực tạ đơn (Dumbbell bench)', like: 'bench', k: 0.4, each: true },
  dips:      { group: 'chest', name: 'Dips', std: [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2], f: 0.8, bw: true },

  deadlift:  { group: 'back', name: 'Deadlift', std: [0.75, 1, 1.25, 1.5, 2, 2.5, 2.75, 3], f: 0.7 },
  row:       { group: 'back', name: 'Kéo tạ đòn (Barbell row)', std: [0.35, 0.5, 0.65, 0.8, 1, 1.2, 1.4, 1.6], f: 0.6 },
  pullup:    { group: 'back', name: 'Hít xà (Pull-up)', std: [0.8, 1, 1.15, 1.3, 1.5, 1.65, 1.8, 2], f: 0.8, bw: true },
  latpull:   { group: 'back', name: 'Kéo xô (Lat pulldown)', like: 'pullup', k: 0.95, machine: true },

  ohp:       { group: 'shoulders', name: 'Đẩy vai (Overhead press)', std: [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.15, 1.3], f: 0.6 },
  dbpress:   { group: 'shoulders', name: 'Đẩy vai tạ đơn (Dumbbell press)', like: 'ohp', k: 0.4, each: true },
  lateral:   { group: 'shoulders', name: 'Nâng tạ ngang (Lateral raise)', like: 'ohp', k: 0.25, each: true },

  curl:      { group: 'arms', name: 'Cuốn tạ đòn (Barbell curl)', like: 'bench', k: 0.45 },
  dbcurl:    { group: 'arms', name: 'Cuốn tạ đơn (Dumbbell curl)', like: 'bench', k: 0.2, each: true },
  pushdown:  { group: 'arms', name: 'Đẩy cáp tay sau (Triceps pushdown)', like: 'bench', k: 0.5, machine: true },
  closegrip: { group: 'arms', name: 'Đẩy ngực tay hẹp (Close-grip bench)', like: 'bench', k: 0.9 },

  squat:     { group: 'legs', name: 'Squat', std: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.25, 2.5], f: 0.7 },
  legpress:  { group: 'legs', name: 'Đạp đùi (Leg press)', like: 'squat', k: 2, machine: true },
  rdl:       { group: 'legs', name: 'Romanian deadlift', like: 'deadlift', k: 0.8 },
  hipthrust: { group: 'legs', name: 'Hip thrust', like: 'squat', k: 1.2 },
  legext:    { group: 'legs', name: 'Đá đùi (Leg extension)', like: 'squat', k: 0.6, machine: true },
  legcurl:   { group: 'legs', name: 'Móc đùi (Leg curl)', like: 'squat', k: 0.45, machine: true },
};

// Công thức Epley; 1 rep thì 1RM chính là mức tạ đó.
const factor = reps => (reps <= 1 ? 1 : 1 + reps / 30);
export const e1rm = (kg, reps) => kg * factor(reps);
const subOf = (tier, progress) => (tier < TOP ? Math.min(Math.floor(progress * SUBS.length), SUBS.length - 1) : 0);

// Ngưỡng tỉ lệ để vào từng rank (rank 0 = 0).
export function thresholds(id, sex) {
  const ex = EXERCISES[id], base = EXERCISES[ex.like ?? id];
  const m = (ex.k ?? 1) * (sex === 'f' ? base.f : 1);
  return [0, ...base.std.map(t => t * m)];
}

// ponytail: tỉ lệ thẳng 1RM/cân nặng nên người nặng cân hơi thiệt; đổi sang hệ số DOTS/allometric nếu cần công bằng hơn.
export function rate(id, sex, bw, kg, reps) {
  const ex = EXERCISES[id];
  const th = thresholds(id, sex);
  const load = ex.bw ? bw + kg : kg;
  const oneRm = e1rm(load, reps);
  const ratio = oneRm / bw;
  let tier = 0;
  while (tier < TOP && ratio >= th[tier + 1]) tier++;
  const progress = tier === TOP ? 1 : (ratio - th[tier]) / (th[tier + 1] - th[tier]);
  const sub = subOf(tier, progress);
  // Mục tiêu kế tiếp là bậc phụ kế tiếp (hoặc rank kế); cần thêm bao nhiêu kg, giữ nguyên số rep, làm tròn lên 0,5 kg.
  let next = null;
  if (tier < TOP) {
    const up = sub + 1 < SUBS.length;
    const goal = th[tier] + ((sub + 1) / SUBS.length) * (th[tier + 1] - th[tier]);
    const kg = Math.max(0.5, Math.ceil(((goal * bw) / factor(reps) - load) * 2) / 2);
    next = { tier: up ? tier : tier + 1, sub: up ? sub + 1 : 0, kg };
  }
  return { tier, sub, progress, score: tier + progress, oneRm, ratio, next };
}

// Trung bình các điểm (rank + tiến độ trong rank) → rank.
export function overall(scores) {
  if (!scores.length) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const tier = Math.min(Math.floor(avg), TOP);
  const progress = Math.min(avg - tier, 1);
  return { tier, progress, sub: subOf(tier, progress) };
}

// Dữ liệu cũ lưu { best: { id: { kg, reps } } }; nay mọi lần ghi nằm trong log: [{ id, kg, reps, t }].
// Dữ liệu cũ không có ngày nên lấy thời điểm chuyển đổi.
export function migrate(state, now = Date.now()) {
  if (!Array.isArray(state.log)) state.log = [];
  for (const [id, b] of Object.entries(state.best ?? {})) {
    if (!state.log.some(e => e.id === id && e.kg === b.kg && e.reps === b.reps)) state.log.push({ id, kg: b.kg, reps: b.reps, t: now });
  }
  delete state.best;
  return state;
}

// Mọi thứ giao diện cần, tính từ log:
//   byEx[id]   = lần ghi có 1RM ước tính cao nhất của bài (kỷ lục) kèm rank của nó
//   byGroup[g] = bài có điểm cao nhất trong nhóm cơ
//   overall    = trung bình điểm các nhóm cơ đã ghi
// ponytail: bài dùng cân nặng (hít xà, dips) tính theo cân nặng HIỆN TẠI cho cả lịch sử; lưu thêm bw vào từng dòng log nếu cần đúng theo thời gian.
export function standing({ sex, bw, log }) {
  const byEx = {}, byGroup = {};
  if (bw > 0) for (const e of log) {
    if (!EXERCISES[e.id]) continue;
    const r = rate(e.id, sex, bw, e.kg, e.reps);
    if (!byEx[e.id] || r.oneRm > byEx[e.id].oneRm) byEx[e.id] = { ...r, entry: e };
  }
  for (const r of Object.values(byEx)) {
    const g = EXERCISES[r.entry.id].group;
    if (!byGroup[g] || r.score > byGroup[g].score) byGroup[g] = r;
  }
  return { byEx, byGroup, overall: overall(Object.values(byGroup).map(r => r.score)) };
}
