# Model của game đu dây

Đặt 2 file xuất từ Blender (glTF Binary `.glb`) vào thư mục này. Chưa có file nào thì game dùng model tạm bằng hình khối.

| File | Yêu cầu |
| --- | --- |
| `hero.glb` | Có Armature và các animation tên `idle`, `run`, `jump`, `swing`, `fall`. Thiếu clip nào thì game bỏ qua clip đó. |
| `car.glb` | 4 bánh là object riêng tên `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, gốc toạ độ (origin) của mỗi bánh nằm ở tâm bánh. |

Quy ước: nhân vật và đầu xe nhìn về **+Z** trong glTF (tức là **−Y** trong Blender, hướng mặc định khi xuất với "+Y Up"), chân / gầm bánh ở độ cao 0, đơn vị mét.

Model bị lệch, quá to, quay lưng, bánh quay sai trục: sửa trong khối `CONFIG` ở đầu `../index.html` (`scale`, `rotY`, `yOffset`, `wheelAxis`, `wheelSpinDir`, `wheelRadius`). Khi nạp xong, game in kích thước model và danh sách animation ra console (F12) để bạn đối chiếu.
