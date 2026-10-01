# Chill City 🌆🌧️

Thành phố 3D để thư giãn buổi tối: **hoàng hôn** / **đêm**, bật **mưa**, xe chạy qua lại có đèn giao thông, đèn đường, biển neon. Chạy trên trình duyệt, tối ưu cho **laptop 16"** và **iPad 11"**.

Không cần cài đặt hay build — chỉ là HTML + JavaScript dùng [three.js](https://threejs.org) (tải từ CDN).

## Chạy thử trên máy

Trình duyệt chặn ES module khi mở bằng `file://`, nên cần một web server nhỏ:

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

## Mở trên iPad (GitHub Pages)

1. Vào **Settings → Pages** của repo.
2. *Source*: **Deploy from a branch**, chọn branch rồi thư mục `/ (root)`, bấm **Save**.
3. Sau khoảng 1 phút, mở link `https://<tên-github>.github.io/bocaocap/` trên iPad bằng Safari.
4. Bấm **Chia sẻ → Thêm vào Màn hình chính** để mở toàn màn hình như một app.

## Điều khiển

| Nút | Phím | Chức năng |
| --- | --- | --- |
| 🌇 / 🌙 | `1` / `2` | Hoàng hôn / Đêm (chuyển mượt) |
| 🌧️ + thanh trượt | `R` | Bật/tắt mưa, chỉnh cường độ (mưa to có sấm chớp) |
| 🔇 / 🔊 | `M` | Âm thanh mưa + tiếng thành phố (tự tạo, không cần file) |
| 🎥 | `A` | Camera tự lượn chậm quanh thành phố |
| 🏙️ | `V` | Đổi góc nhìn: Toàn cảnh → Tầng thấp → Dạo phố → Theo xe |
| ⛶ | `F` | Toàn màn hình |
| 👁️ | `H` | Ẩn giao diện (chạm / di chuột để hiện lại) |

- Chuột: kéo để xoay, cuộn để zoom, chuột phải để di chuyển.
- Cảm ứng: kéo một ngón để xoay, chụm để zoom, hai ngón để di chuyển.
- Giao diện tự ẩn sau vài giây không thao tác. Lựa chọn được lưu cho lần mở sau.

## Hiệu năng

- Thành phố, xe, đèn đều dùng `InstancedMesh` nên rất nhẹ (vài chục draw call).
- Tự giới hạn độ phân giải theo thiết bị và **tự hạ chất lượng** nếu FPS < 42 (giảm pixel ratio, rồi tắt bloom).

## Cấu trúc

```
index.html      giao diện + importmap three.js
style.css       UI kính mờ, responsive cho laptop & iPad
src/main.js     renderer, camera, các góc nhìn, thời gian/thời tiết, UI
src/city.js     sinh thành phố: đường, nhà (shader cửa sổ), đèn đường, neon, cây
src/traffic.js  xe chạy theo làn, rẽ ở ngã tư, đèn tín hiệu, đèn pha/đèn hậu
src/sky.js      bầu trời, mặt trời, mặt trăng, mây, sao
src/rain.js     mưa rơi + gợn nước trên đường
src/audio.js    âm thanh mưa/sấm bằng Web Audio
src/utils.js    hàm tiện ích
```
