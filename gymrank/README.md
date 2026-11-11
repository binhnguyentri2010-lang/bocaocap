# Iron Ascend 🏋️

Tên hiển thị trong app là **Iron Ascend**; thư mục, khóa lưu dữ liệu (`gymrank`) và tiêu đề Artifact vẫn giữ tên cũ GymRank để không mất dữ liệu.

Web app xếp hạng sức mạnh: nhập mức tạ (kg) và số rep, app cho biết bạn đang ở rank nào, cần thêm bao nhiêu kg để lên bậc kế tiếp, và giữ lịch sử để xem tiến bộ. Không cần cài đặt hay build.

## Mở app

- **Claude Artifact**: dựng một file bằng `node gymrank/build-artifact.mjs <file-đích.html>` rồi đăng file đó. Trong Artifact, dữ liệu lưu vào kho riêng của tài khoản nên mở máy khác vẫn còn.
- **GitHub Pages**: bật Pages cho repo (xem [README gốc](../README.md#mở-trên-ipad-github-pages)), mở `https://<tên-github>.github.io/bocaocap/gymrank/` bằng Safari, rồi **Chia sẻ → Thêm vào Màn hình chính**. Ở đây dữ liệu chỉ nằm trên máy (localStorage); app ở màn hình chính và tab Safari có thể dùng hai kho khác nhau.
- **Máy tính**: `python3 -m http.server 8000` ở thư mục gốc repo, mở `http://localhost:8000/gymrank/`.

## Cách tính rank

1. **1RM ước tính** theo công thức Epley: `1RM = kg × (1 + rep / 30)`. Với 1 rep thì 1RM chính là mức tạ đó. Từ khoảng 10 rep trở lên, ước tính kém chính xác hơn.
2. **Tỉ lệ** = 1RM ÷ cân nặng cơ thể. Với hít xà và dips, tải = cân nặng + tạ đeo thêm (dùng máy hỗ trợ thì nhập số âm). Bài tạ đơn nhập số kg của **một tay**.
3. Tỉ lệ được so với ngưỡng của bài để ra 1 trong 9 rank: **Đồng → Bạc → Vàng → Bạch kim → Kim cương → Cao thủ → Đại cao thủ → Thách đấu → Huyền thoại**. Mỗi rank (trừ Huyền thoại) chia đều thành 3 bậc phụ **I, II, III**.
4. **Kỷ lục của một bài** = lần ghi có 1RM ước tính cao nhất trong lịch sử.
5. **Rank nhóm cơ** = bài tốt nhất của nhóm. **Rank tổng** = trung bình các nhóm cơ đã ghi, nên ghi nhiều bài ngực không kéo lệch rank tổng.

### Bài tập và ngưỡng

7 bài gốc có bảng ngưỡng riêng (nam, tính theo số lần cân nặng, để lên Bạc / Vàng / Bạch kim / Kim cương / Cao thủ / Đại cao thủ / Thách đấu / Huyền thoại):

| Bài gốc | Ngưỡng | Hệ số nữ |
| --- | --- | --- |
| Bench press | 0,35 / 0,5 / 0,75 / 1 / 1,25 / 1,5 / 1,75 / 2 | 0,6 |
| Squat | 0,5 / 0,75 / 1 / 1,25 / 1,5 / 2 / 2,25 / 2,5 | 0,7 |
| Deadlift | 0,75 / 1 / 1,25 / 1,5 / 2 / 2,5 / 2,75 / 3 | 0,7 |
| Overhead press | 0,25 / 0,35 / 0,5 / 0,65 / 0,8 / 1 / 1,15 / 1,3 | 0,6 |
| Barbell row | 0,35 / 0,5 / 0,65 / 0,8 / 1 / 1,2 / 1,4 / 1,6 | 0,6 |
| Pull-up (tính cả cân nặng) | 0,8 / 1 / 1,15 / 1,3 / 1,5 / 1,65 / 1,8 / 2 | 0,8 |
| Dips (tính cả cân nặng) | 0,8 / 1 / 1,2 / 1,4 / 1,6 / 1,8 / 2 / 2,2 | 0,8 |

14 bài còn lại mượn ngưỡng của một bài gốc rồi nhân hệ số:

| Nhóm cơ | Bài (in đậm = bài gốc) |
| --- | --- |
| Ngực | **Bench**, Đẩy ngực dốc lên (bench × 0,85), Đẩy ngực tạ đơn mỗi tay (bench × 0,4), **Dips** |
| Lưng | **Deadlift**, **Kéo tạ đòn**, **Hít xà**, Kéo xô máy (ngưỡng hít xà × 0,95, không cộng cân nặng) |
| Vai | **Đẩy vai**, Đẩy vai tạ đơn mỗi tay (ohp × 0,4), Nâng tạ ngang mỗi tay (ohp × 0,25) |
| Tay | Cuốn tạ đòn (bench × 0,45), Cuốn tạ đơn mỗi tay (bench × 0,2), Đẩy cáp tay sau (bench × 0,5), Đẩy ngực tay hẹp (bench × 0,9) |
| Chân | **Squat**, Đạp đùi máy (squat × 2), Romanian deadlift (deadlift × 0,8), Hip thrust (squat × 1,2), Đá đùi máy (squat × 0,6), Móc đùi máy (squat × 0,45) |

⚠️ **Mọi ngưỡng, hệ số nữ và hệ số giữa các bài đều là ước tính** từ hiểu biết chung về chuẩn sức mạnh, không có nguồn kiểm chứng và không phải số liệu chính thức. Bài máy và cáp càng kém tin cậy vì mỗi phòng tập máy nặng nhẹ khác nhau. Muốn chỉnh thì sửa `EXERCISES` trong `rank.js`.

## Dữ liệu

`{ sex, bw, log: [{ id, kg, reps, t }] }`. Mọi lần ghi nằm trong `log`; kỷ lục và rank đều tính lại từ đó. Dữ liệu kiểu cũ (`best`) được chuyển sang `log` khi mở app. Với hít xà và dips, 1RM trong lịch sử tính theo cân nặng hiện tại.

## Cấu trúc

```
index.html          giao diện, animation huy hiệu và lên bậc, biểu đồ, lưu dữ liệu
ranks.webp          9 huy hiệu (lưới 3×3, ô 520×280, nền trong suốt), cắt từ ảnh bộ huy hiệu do chủ dự án cung cấp; chưa rõ nguồn gốc và quyền sử dụng ảnh
rank.js             logic: bài tập, ngưỡng, 1RM, rank bài / nhóm cơ / tổng, chuyển dữ liệu cũ
rank.test.mjs       kiểm tra logic: node gymrank/rank.test.mjs
build-artifact.mjs  gộp index.html + rank.js + ranks.webp (data URI) thành một file để đăng lên Claude Artifact
icon.png            icon màn hình chính
```
