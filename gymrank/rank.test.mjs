// Chạy: node gymrank/rank.test.mjs
import assert from 'node:assert/strict';
import { EXERCISES, GROUPS, e1rm, rate, overall, label, thresholds, migrate, standing } from './rank.js';

assert.equal(e1rm(100, 1), 100);
assert.equal(Math.round(e1rm(100, 5) * 100) / 100, 116.67);

// Nam 80 kg: bench 80 kg × 1 = 1,0× cân nặng → vừa chạm Vàng I; hụt 0,5 kg → Bạc III
const gold = rate('bench', 'm', 80, 80, 1);
assert.equal(label(gold.tier, gold.sub), 'Vàng I');
const silver = rate('bench', 'm', 80, 79.5, 1);
assert.equal(label(silver.tier, silver.sub), 'Bạc III');
// Nữ dùng ngưỡng × 0,6: bench 1,0× cân nặng ≥ 0,9 → Kim cương
assert.equal(rate('bench', 'f', 60, 60, 1).tier, 6);
// Hít xà 1 rep không đeo tạ → Đồng; máy hỗ trợ −10 kg → Sắt; −30 kg → Gỗ
assert.equal(rate('pullup', 'm', 70, 0, 1).tier, 2);
assert.equal(rate('pullup', 'm', 70, -10, 1).tier, 1);
assert.equal(rate('pullup', 'm', 70, -30, 1).tier, 0);

// Mọi bài: thuộc một nhóm có thật, ngưỡng tăng dần, bài phụ trỏ tới bài gốc có bảng ngưỡng
for (const [id, ex] of Object.entries(EXERCISES)) {
  assert.ok(GROUPS[ex.group], id);
  assert.ok(EXERCISES[ex.like ?? id].std, id);
  for (const sex of ['m', 'f']) {
    const th = thresholds(id, sex);
    assert.equal(th.length, 9, id);
    assert.ok(th.every((t, i) => !i || t > th[i - 1]), id);
  }
}
// Bài phụ = ngưỡng bài gốc × k; nữ lấy hệ số của bài gốc
assert.equal(thresholds('incline', 'm')[4], 0.85);
assert.equal(thresholds('dbbench', 'f')[4], 1 * 0.4 * 0.6);
// Đẩy ngực tạ đơn 32 kg mỗi tay ở 80 kg = đúng ngưỡng Vàng (0,4 × 80)
assert.equal(rate('dbbench', 'm', 80, 32, 1).tier, 4);
// Kéo xô mượn ngưỡng hít xà nhưng KHÔNG cộng cân nặng
assert.equal(rate('latpull', 'm', 80, 76, 1).tier, 2);

// "Thêm X kg" phải thật sự đủ để lên bậc kế tiếp, và thiếu 0,5 kg thì chưa đủ
const level = r => r.tier * 3 + r.sub;
for (const [id, kg, reps] of [['squat', 90, 5], ['ohp', 37.5, 8], ['dips', 10, 6], ['bench', 20, 1], ['deadlift', 150, 3], ['row', 70, 10],
  ['lateral', 8, 12], ['legpress', 180, 8], ['dbcurl', 12, 10], ['latpull', 60, 8], ['rdl', 90, 6]]) {
  const r = rate(id, 'm', 80, kg, reps);
  const want = r.next.tier * 3 + r.next.sub;
  assert.equal(level(rate(id, 'm', 80, kg + r.next.kg, reps)), want, id);
  if (r.next.kg > 0.5) assert.ok(level(rate(id, 'm', 80, kg + r.next.kg - 0.5, reps)) < want, id);
}
// Rank cao nhất: không còn bậc kế, không có bậc phụ
const legend = rate('deadlift', 'm', 80, 300, 1);
assert.equal(legend.next, null);
assert.equal(label(legend.tier, legend.sub), 'Huyền thoại');

assert.equal(overall([4.5, 3.5]).tier, 4);
assert.equal(overall([4.5, 4.5]).sub, 1);
assert.equal(overall([9, 9]).tier, 8);
assert.equal(overall([]), null);

// Chuyển dữ liệu cũ: đúng dữ liệu thật đang có trong Artifact
const old = migrate({ sex: 'm', bw: 85, best: { bench: { kg: 60, reps: 6 } } }, 1000);
assert.deepEqual(old, { sex: 'm', bw: 85, log: [{ id: 'bench', kg: 60, reps: 6, t: 1000 }] });
assert.deepEqual(standing(old).byEx.bench.entry, { id: 'bench', kg: 60, reps: 6, t: 1000 });
assert.equal(standing(old).byEx.bench.tier, rate('bench', 'm', 85, 60, 6).tier);
// Chuyển lần nữa (ví dụ kho từ xa vẫn còn best) không nhân đôi dòng
assert.equal(migrate({ ...old, best: { bench: { kg: 60, reps: 6 } } }).log.length, 1);
assert.deepEqual(migrate({ sex: 'm', bw: 0 }).log, []);

// standing: kỷ lục = lần ghi 1RM cao nhất; rank nhóm = bài tốt nhất; rank tổng = trung bình nhóm
const s = standing({ sex: 'm', bw: 80, log: [
  { id: 'bench', kg: 60, reps: 5, t: 1 }, { id: 'bench', kg: 80, reps: 1, t: 2 }, { id: 'bench', kg: 70, reps: 1, t: 3 },
  { id: 'incline', kg: 30, reps: 1, t: 4 },   // cùng nhóm Ngực nhưng yếu hơn → không kéo rank nhóm xuống
  { id: 'squat', kg: 120, reps: 1, t: 5 },    // 1,5× → Bạch kim I (điểm 5,0)
  { id: 'xoa-roi', kg: 999, reps: 1, t: 6 },  // bài không còn tồn tại → bỏ qua, không lỗi
] });
assert.equal(s.byEx.bench.entry.t, 2);
assert.equal(s.byGroup.chest.entry.id, 'bench');
assert.deepEqual(Object.keys(s.byGroup).sort(), ['chest', 'legs']);
assert.equal(s.byGroup.chest.score, 4);
assert.equal(s.byGroup.legs.score, 5);
assert.equal(label(s.overall.tier, s.overall.sub), 'Vàng II');   // (4 + 5) / 2 = 4,5
// Chưa nhập cân nặng → chưa có rank
assert.equal(standing({ sex: 'm', bw: 0, log: [{ id: 'bench', kg: 60, reps: 5, t: 1 }] }).overall, null);

console.log('rank.test: ok');
