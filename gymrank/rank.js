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

// std: ngưỡng (1RM ÷ cân nặng) để LÊN Sắt, Đồng, Bạc, Vàng, Bạch kim, Kim cương, Cao thủ, Huyền thoại — cho nam.
// f: hệ số cho nữ (ngưỡng nữ = std × f).
// bw: bài dùng trọng lượng cơ thể → tải = cân nặng + tạ đeo thêm (số âm = máy hỗ trợ).
// ponytail: các ngưỡng là ƯỚC TÍNH tham khảo từ bảng chuẩn sức mạnh phổ biến, không phải số liệu chính thức — chỉnh tại đây.
export const EXERCISES = {
  bench:    { name: 'Đẩy ngực (Bench press)',   std: [0.35, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],     f: 0.6 },
  squat:    { name: 'Squat',                    std: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.25, 2.5],      f: 0.7 },
  deadlift: { name: 'Deadlift',                 std: [0.75, 1, 1.25, 1.5, 2, 2.5, 2.75, 3],        f: 0.7 },
  ohp:      { name: 'Đẩy vai (Overhead press)', std: [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.15, 1.3],   f: 0.6 },
  row:      { name: 'Kéo tạ đòn (Barbell row)', std: [0.35, 0.5, 0.65, 0.8, 1, 1.2, 1.4, 1.6],     f: 0.6 },
  pullup:   { name: 'Hít xà (Pull-up)',         std: [0.8, 1, 1.15, 1.3, 1.5, 1.65, 1.8, 2],       f: 0.8, bw: true },
  dips:     { name: 'Dips',                     std: [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2],         f: 0.8, bw: true },
};

// Công thức Epley; 1 rep thì 1RM chính là mức tạ đó.
const factor = reps => (reps <= 1 ? 1 : 1 + reps / 30);
export const e1rm = (kg, reps) => kg * factor(reps);
const subOf = (tier, progress) => (tier < TOP ? Math.min(Math.floor(progress * SUBS.length), SUBS.length - 1) : 0);

// ponytail: tỉ lệ thẳng 1RM/cân nặng nên người nặng cân hơi thiệt; đổi sang hệ số DOTS/allometric nếu cần công bằng hơn.
export function rate(id, sex, bw, kg, reps) {
  const ex = EXERCISES[id];
  const th = [0, ...ex.std.map(t => (sex === 'f' ? t * ex.f : t))];
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

// Hạng tổng = trung bình điểm (rank + tiến độ trong rank) của các bài đã ghi.
export function overall(scores) {
  if (!scores.length) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const tier = Math.min(Math.floor(avg), TOP);
  const progress = Math.min(avg - tier, 1);
  return { tier, progress, sub: subOf(tier, progress) };
}
