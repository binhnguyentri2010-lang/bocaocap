# GymRank 🏋️

Web app xếp hạng sức mạnh: nhập mức tạ (kg) và số rep, app cho biết bạn đang ở rank nào và cần thêm bao nhiêu kg để lên rank kế tiếp. Không cần cài đặt hay build, dữ liệu lưu ngay trên máy.

## Mở trên iPhone

1. Bật GitHub Pages cho repo (xem hướng dẫn trong [README gốc](../README.md#mở-trên-ipad-github-pages)).
2. Mở `https://<tên-github>.github.io/bocaocap/gymrank/` bằng Safari.
3. Bấm **Chia sẻ → Thêm vào Màn hình chính** để mở toàn màn hình như một app.

> Lưu ý: app ở màn hình chính và tab Safari có thể dùng **hai kho lưu trữ khác nhau** trên iOS. Nên chọn dùng một chỗ cố định.

Chạy thử trên máy tính: `python3 -m http.server 8000` ở thư mục gốc repo, rồi mở `http://localhost:8000/gymrank/`.

## Cách tính rank

1. **1RM ước tính** theo công thức Epley: `1RM = kg × (1 + rep / 30)`. Với 1 rep thì 1RM chính là mức tạ đó. Từ khoảng 10 rep trở lên, ước tính kém chính xác hơn.
2. **Tỉ lệ** = 1RM ÷ cân nặng cơ thể. Với hít xà và dips, tải = cân nặng + tạ đeo thêm. Nếu dùng máy hỗ trợ thì nhập số âm.
3. Tỉ lệ được so với bảng ngưỡng của từng bài để ra 1 trong 9 rank: **Gỗ → Sắt → Đồng → Bạc → Vàng → Bạch kim → Kim cương → Cao thủ → Huyền thoại**. Mỗi rank (trừ Huyền thoại) chia đều thành 3 bậc phụ **I, II, III**, hiện bằng 1–3 hạt nhỏ dưới huy hiệu. Ngưỡng của nữ = ngưỡng nam × hệ số (0,6 cho bài thân trên, 0,7 cho bài thân dưới, 0,8 cho hít xà/dips).
4. **Rank tổng** = trung bình điểm (rank + tiến độ) của các bài đã ghi.
5. Lên rank mới thì có màn hình chúc mừng; lên bậc phụ thì hiện một dòng thông báo.

Ngưỡng (nam), tính theo số lần cân nặng cơ thể, để lên Sắt / Đồng / Bạc / Vàng / Bạch kim / Kim cương / Cao thủ / Huyền thoại:

| Bài | Ngưỡng |
| --- | --- |
| Bench press | 0,35 / 0,5 / 0,75 / 1 / 1,25 / 1,5 / 1,75 / 2 |
| Squat | 0,5 / 0,75 / 1 / 1,25 / 1,5 / 2 / 2,25 / 2,5 |
| Deadlift | 0,75 / 1 / 1,25 / 1,5 / 2 / 2,5 / 2,75 / 3 |
| Overhead press | 0,25 / 0,35 / 0,5 / 0,65 / 0,8 / 1 / 1,15 / 1,3 |
| Barbell row | 0,35 / 0,5 / 0,65 / 0,8 / 1 / 1,2 / 1,4 / 1,6 |
| Pull-up (tính cả cân nặng) | 0,8 / 1 / 1,15 / 1,3 / 1,5 / 1,65 / 1,8 / 2 |
| Dips (tính cả cân nặng) | 0,8 / 1 / 1,2 / 1,4 / 1,6 / 1,8 / 2 / 2,2 |

⚠️ Đây là **ước tính tham khảo** dựa trên các bảng chuẩn sức mạnh phổ biến, không phải số liệu chính thức. Muốn chỉnh thì sửa `EXERCISES` trong `rank.js`.

## Cấu trúc

```
index.html     giao diện + lưu dữ liệu (localStorage)
rank.js        logic: 1RM, rank từng bài, rank tổng
rank.test.mjs  kiểm tra logic: node gymrank/rank.test.mjs
```
