// Logic xếp hạng, không đụng DOM để test được bằng Node (rank.test.mjs).

export const TIERS = [
  { name: 'Sắt', color: '#8a8f98' },
  { name: 'Đồng', color: '#c98250' },
  { name: 'Bạc', color: '#c9d1dc' },
  { name: 'Vàng', color: '#f2c14e' },
  { name: 'Bạch kim', color: '#5fd4c4' },
  { name: 'Kim cương', color: '#6ea8ff' },
  { name: 'Huyền thoại', color: '#c77dff' },
];

// std: ngưỡng (1RM ÷ cân nặng) để LÊN Đồng, Bạc, Vàng, Bạch kim, Kim cương, Huyền thoại — cho nam.
// f: hệ số cho nữ (ngưỡng nữ = std × f).
// bw: bài dùng trọng lượng cơ thể → tải = cân nặng + tạ đeo thêm (số âm = máy hỗ trợ).
// ponytail: các ngưỡng là ƯỚC TÍNH tham khảo từ bảng chuẩn sức mạnh phổ biến, không phải số liệu chính thức — chỉnh tại đây.
export const EXERCISES = {
  bench:    { name: 'Đẩy ngực (Bench press)',   std: [0.5, 0.75, 1, 1.25, 1.5, 2],     f: 0.6 },
  squat:    { name: 'Squat',                    std: [0.75, 1, 1.25, 1.5, 2, 2.5],     f: 0.7 },
  deadlift: { name: 'Deadlift',                 std: [1, 1.25, 1.5, 2, 2.5, 3],        f: 0.7 },
  ohp:      { name: 'Đẩy vai (Overhead press)', std: [0.35, 0.5, 0.65, 0.8, 1, 1.3],   f: 0.6 },
  row:      { name: 'Kéo tạ đòn (Barbell row)', std: [0.5, 0.65, 0.8, 1, 1.25, 1.5],   f: 0.6 },
  pullup:   { name: 'Hít xà (Pull-up)',         std: [1, 1.15, 1.3, 1.5, 1.75, 2],     f: 0.8, bw: true },
  dips:     { name: 'Dips',                     std: [1, 1.2, 1.4, 1.6, 1.9, 2.2],     f: 0.8, bw: true },
};

// Công thức Epley; 1 rep thì 1RM chính là mức tạ đó.
const factor = reps => (reps <= 1 ? 1 : 1 + reps / 30);
export const e1rm = (kg, reps) => kg * factor(reps);

// ponytail: tỉ lệ thẳng 1RM/cân nặng nên người nặng cân hơi thiệt; đổi sang hệ số DOTS/allometric nếu cần công bằng hơn.
export function rate(id, sex, bw, kg, reps) {
  const ex = EXERCISES[id];
  const th = [0, ...ex.std.map(t => (sex === 'f' ? t * ex.f : t))];
  const load = ex.bw ? bw + kg : kg;
  const oneRm = e1rm(load, reps);
  const ratio = oneRm / bw;
  let tier = 0;
  while (tier + 1 < th.length && ratio >= th[tier + 1]) tier++;
  const top = tier === th.length - 1;
  const progress = top ? 1 : (ratio - th[tier]) / (th[tier + 1] - th[tier]);
  // Cần thêm bao nhiêu kg (giữ nguyên số rep) để lên hạng kế, làm tròn lên 0,5 kg.
  const next = top ? null : { tier: tier + 1, kg: Math.ceil(((th[tier + 1] * bw) / factor(reps) - load) * 2) / 2 };
  return { tier, progress, score: tier + progress, oneRm, ratio, next };
}

// Hạng tổng = trung bình điểm (hạng + tiến độ) của các bài đã ghi.
export function overall(scores) {
  if (!scores.length) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const tier = Math.min(Math.floor(avg), TIERS.length - 1);
  return { tier, progress: Math.min(avg - tier, 1) };
}
