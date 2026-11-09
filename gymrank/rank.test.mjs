// Chạy: node gymrank/rank.test.mjs
import assert from 'node:assert/strict';
import { e1rm, rate, overall, label } from './rank.js';

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
// "Thêm X kg" phải thật sự đủ để lên bậc kế tiếp, và thiếu 0,5 kg thì chưa đủ
const level = r => r.tier * 3 + r.sub;
for (const [id, kg, reps] of [['squat', 90, 5], ['ohp', 37.5, 8], ['dips', 10, 6], ['bench', 20, 1], ['deadlift', 150, 3], ['row', 70, 10]]) {
  const r = rate(id, 'm', 80, kg, reps);
  const want = r.next.tier * 3 + r.next.sub;
  assert.equal(level(rate(id, 'm', 80, kg + r.next.kg, reps)), want, id);
  if (r.next.kg > 0.5) assert.ok(level(rate(id, 'm', 80, kg + r.next.kg - 0.5, reps)) < want, id);
}
// Rank cao nhất: không còn bậc kế, không có bậc phụ
const legend = rate('deadlift', 'm', 80, 300, 1);
assert.equal(legend.next, null);
assert.equal(label(legend.tier, legend.sub), 'Huyền thoại');
// Hạng tổng
assert.equal(overall([4.5, 3.5]).tier, 4);
assert.equal(overall([4.5, 4.5]).sub, 1);
assert.equal(overall([9, 9]).tier, 8);
assert.equal(overall([]), null);

console.log('rank.test: ok');
