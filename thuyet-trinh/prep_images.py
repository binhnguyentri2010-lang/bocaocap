# Cắt ảnh tư liệu (tải từ Wikimedia Commons) về đúng tỉ lệ khung trên slide.
# Chạy: python3 prep_images.py <thư mục ảnh gốc> <meta.json>
# Sinh ra assets/ph_<khoá>.jpg và assets/photos.json (tỉ lệ + ghi nguồn).
import json, os, sys
from PIL import Image

SRC, META = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

# khoá: (tỉ lệ rộng/cao, trọng tâm cắt theo chiều dọc 0..1, lề cắt bỏ mỗi cạnh)
RULES = {
    "danang": (2.5, 0.5, 0.035),
    "saigon_morel": (1.6, 0.5, 0),
    "saigon2": (1.5, 0.35, 0),
    "truongdinh_tuong": (1.0, 0.12, 0),
    "ntt_tuong": (1.0, 0.1, 0),
    "tkhuan": (1.0, 0.2, 0),
    "nhattao": (1.0, 0.4, 0),
    "nhamtuat": (1.45, 0.5, 0),
    "nhamtuat2": (1.3, 0.5, 0),
    "ptgian": (1.45, 0.3, 0),
    "caugiay": (1.45, 0.5, 0),
    "caugiay2": (1.43, 0.5, 0),
    "thuanan": (1.7, 0.5, 0),
    "tuduc": (0.8, 0.2, 0),
    "seal1884": (0.9, 0.5, 0),
    "patenotre": (0.75, 0.5, 0),
    "giadinh_banve": (1.4, 0.5, 0),
    "dienhai": (2.2, 0.5, 0),
    "hanoi1882": (0.9, 0.4, 0),
    "voduyduong": (1.0, 0.3, 0),
    "garnier": (0.8, 0.2, 0),
    "riviere": (0.8, 0.2, 0),
    "hue": (1.5, 0.5, 0),
}

meta = json.load(open(META, encoding="utf-8"))
photos = {}
for key, (aspect, gy, trim) in RULES.items():
    src = next((os.path.join(SRC, key + e) for e in (".jpg", ".png") if os.path.exists(os.path.join(SRC, key + e))), None)
    if not src or open(src, "rb").read(1) not in (b"\xff", b"\x89"):
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if trim:
        im = im.crop((int(w * trim), int(h * trim * 2), int(w * (1 - trim)), int(h * (1 - trim * 2))))
        w, h = im.size
    if w / h > aspect:  # quá rộng: cắt hai bên
        nw = int(h * aspect)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:  # quá cao: cắt trên/dưới quanh trọng tâm
        nh = int(w / aspect)
        top = max(0, min(h - nh, int(h * gy - nh / 2)))
        im = im.crop((0, top, w, top + nh))
    im.thumbnail((1400, 1400))
    im.save(os.path.join(OUT, f"ph_{key}.jpg"), quality=88)
    m = meta.get(key, {})
    photos[key] = {"aspect": im.size[0] / im.size[1], "title": m.get("title", ""), "lic": m.get("lic", ""), "artist": " ".join(m.get("artist", "").split())}
json.dump(photos, open(os.path.join(OUT, "photos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK", len(photos), "ảnh:", ", ".join(photos))
