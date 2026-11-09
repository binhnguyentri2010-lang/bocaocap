// Chạy: node gymrank/rank.test.mjs
import assert from 'node:assert/strict';
import { e1rm, rate, overall } from './rank.js';

assert.equal(e1rm(100, 1), 100);
assert.equal(Math.round(e1rm(100, 5) * 100) / 100, 116.67);

// Nam 80 kg: bench 80 kg × 1 = 1,0× cân nặng → Vàng; hụt 0,5 kg → Bạc
assert.equal(rate('bench', 'm', 80, 80, 1).tier, 3);
assert.equal(rate('bench', 'm', 80, 79.5, 1).tier, 2);
// Nữ dùng ngưỡng × 0,6: bench 1,0× cân nặng ≥ 0,9 → Kim cương
assert.equal(rate('bench', 'f', 60, 60, 1).tier, 5);
// Hít xà 1 rep không đeo tạ → Đồng; đeo máy hỗ trợ (−10 kg) → Sắt
assert.equal(rate('pullup', 'm', 70, 0, 1).tier, 1);
assert.equal(rate('pullup', 'm', 70, -10, 1).tier, 0);
// "Thêm X kg" phải thật sự đủ để lên hạng kế
for (const [id, kg, reps] of [['squat', 90, 5], ['ohp', 37.5, 8], ['dips', 10, 6], ['bench', 20, 1]]) {
  const r = rate(id, 'm', 80, kg, reps);
  assert.equal(rate(id, 'm', 80, kg + r.next.kg, reps).tier, r.next.tier, id);
  assert.ok(rate(id, 'm', 80, kg + r.next.kg - 0.5, reps).tier < r.next.tier, id);
}
// Hạng cao nhất: không còn hạng kế
assert.equal(rate('deadlift', 'm', 80, 300, 1).next, null);
// Hạng tổng
assert.equal(overall([3.5, 2.5]).tier, 3);
assert.equal(overall([7, 7]).tier, 6);
assert.equal(overall([]), null);

console.log('rank.test: ok');
