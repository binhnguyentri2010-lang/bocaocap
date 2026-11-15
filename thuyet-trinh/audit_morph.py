# Rà soát Morph: liệt kê các vật thể "!!…" được ghép giữa hai slide liền nhau và báo chỗ đáng ngờ.
# Chạy: python3 audit_morph.py <file.pptx>
import hashlib, re, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
n = len([f for f in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", f)])
slides, bad = [], 0
for i in range(1, n + 1):
    x = z.read(f"ppt/slides/slide{i}.xml").decode()
    rel = z.read(f"ppt/slides/_rels/slide{i}.xml.rels").decode()
    rid = {m.group(1): m.group(0) for m in re.finditer(r'<Relationship [^>]*Id="(rId\d+)"[^>]*>', rel)}
    # so sánh ảnh theo nội dung (pptxgenjs chép cùng một ảnh thành nhiều file)
    tgt = lambda r: hashlib.md5(z.read("ppt/media/" + re.search(r'Target="([^"]+)"', rid[r]).group(1).split("/")[-1])).hexdigest()[:8] if r in rid else "?"
    objs = {}
    for m in re.finditer(r"<p:(pic|sp)>.*?</p:\1>", x, re.S):
        b = m.group(0)
        name = re.search(r'<p:cNvPr id="\d+" name="([^"]*)"', b).group(1)
        if not name.startswith("!!"):
            continue
        e = re.search(r'r:embed="(rId\d+)"', b)
        ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', b)
        kind = ("ảnh:" + tgt(e.group(1))) if m.group(1) == "pic" and e else "hình/chữ"
        if name in objs:
            print(f"  LỖI slide {i}: trùng tên {name}"); bad += 1
        objs[name] = (kind, int(ext.group(1)) / int(ext.group(2)) if ext and int(ext.group(2)) else 0)
    if "p159:morph" not in x and i > 1:
        print(f"  LỖI slide {i}: thiếu chuyển cảnh Morph"); bad += 1
    if x.find("p:transition") > x.find("<p:timing") > 0:
        print(f"  LỖI slide {i}: chuyển cảnh đứng sau <p:timing>"); bad += 1
    slides.append(objs)
for i in range(n - 1):
    a, b = slides[i], slides[i + 1]
    shared = sorted(set(a) & set(b))
    notes = []
    for k in shared:
        if a[k][0] != b[k][0]:
            notes.append(f"{k}: KHÁC NỘI DUNG ({a[k][0]} -> {b[k][0]})"); bad += 1
        elif a[k][0].startswith("ảnh") and a[k][1] and b[k][1] and abs(a[k][1] / b[k][1] - 1) > 0.02:
            notes.append(f"{k}: méo tỉ lệ ({a[k][1]:.2f} -> {b[k][1]:.2f})")
    print(f"{i+1:>2} -> {i+2:<2} ghép: {', '.join(k[2:] for k in shared) or '(không có, chỉ mờ dần)'}")
    for t in notes:
        print("     !", t)
print("Tổng số chỗ đáng ngờ:", bad)
