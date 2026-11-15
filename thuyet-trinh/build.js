// Dựng file thuyết trình "Kháng chiến chống thực dân Pháp (1858 – 1884)" theo phong cách giấy cổ – chữ vàng.
// Bản chữ to, nhiều chữ: người trình bày có thể đọc theo slide, người ngồi dưới đọc được từ xa.
// Chạy: PPTX_SKILL=<thư mục skill pptx> node build.js
// Cần: npm i pptxgenjs jszip; thư mục assets/ (gen_assets.js, gen_video.js, prep_images.py sinh ra phần lớn).
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const OUT = path.join(__dirname, "khang-chien-chong-phap-1858-1884.pptx");
const A = (f) => path.join(__dirname, "assets", f);
const SIZES = require("./assets/sizes.json");
const PH = fs.existsSync(A("photos.json")) ? require("./assets/photos.json") : {};
const used = []; // ảnh tư liệu đã dùng, để ghi nguồn ở slide cuối

const THEME = {
  name: "Giay co 1858-1884",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "3E2A14", lt1: "FFFFFF", dk2: "8E5E22", lt2: "F6EFE2",
    accent1: "B47A2A", accent2: "7A2A22", accent3: "C89A44",
    accent4: "5A3E22", accent5: "F3DCA0", accent6: "2B1A12",
    hlink: "8E5E22", folHlink: "5A3E22",
  },
};
// màu chữ (hex cố định, theo bản mẫu; INK đậm để dễ đọc trên nền giấy)
const INK = "2A1A0A", INK2 = "4A3016", GOLD = "8E5E22", CREAM = "F3DCA0", PAPER = "F6EFE2", PINC = "B47A2A", MAROON = "7A2A22";
const BODY = 28; // cỡ chữ nội dung

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inch
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Kháng chiến chống thực dân Pháp (1858 – 1884)";
pres.defineSlideMaster({ title: "Giay", background: { path: A("bg.jpg") } });
pres.defineSlideMaster({ title: "Toi", background: { color: "2B1A12" } });

// ---------- tiện ích ----------
const W = 13.333, H = 7.5;
function fit(name, maxW, maxH) {
  const [pw, ph] = SIZES[name];
  const r = pw / ph;
  const w = Math.min(maxW, maxH * r);
  return { w, h: w / r };
}
function img(s, name, x, y, maxW, maxH, o = {}) {
  const { w, h } = fit(name, maxW, maxH);
  const xx = o.center ? x - w / 2 : x;
  s.addImage({ path: A(name + ".png"), x: xx, y, w, h, objectName: o.name || name, altText: o.alt || "",
    ...(o.rotate ? { rotate: o.rotate } : {}), ...(o.transparency ? { transparency: o.transparency } : {}) });
  return { x: xx, y, w, h };
}
function raw(s, file, x, y, w, h, name, alt, extra = {}) {
  s.addImage({ path: A(file), x, y, w, h, objectName: name, altText: alt || "", ...extra });
}
function kicker(s, t, x, y, o = {}) {
  s.addText(t, { x, y, w: o.w || 7.2, h: 0.4, margin: 0, isTextBox: true, fontSize: 18, bold: true, charSpacing: 3,
    color: o.color || GOLD, align: o.align || "left", objectName: o.name || "!!nhan" });
}
// tiêu đề đậm (ảnh chữ vàng nâu), dễ đọc từ xa
function title(s, name, x, y, o = {}) {
  return img(s, name, x - 0.12, y, o.maxW || 7.5, o.maxH || 1.3, { name: "tieude_" + name, alt: o.alt || "", center: o.center });
}
// các gạch đầu dòng chữ to; mỗi ý là một câu trọn vẹn để có thể đọc theo
function bullets(s, items, x, y, w, h, o = {}) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: "25C6" }, breakLine: i < items.length - 1 } })),
    { x, y, w, h, margin: 0, isTextBox: true, fontSize: o.size || BODY, color: o.color || INK, valign: "top",
      paraSpaceAfter: o.gap || 12, objectName: o.name || "noidung" });
}
function body(s, t, x, y, w, h, o = {}) {
  s.addText(t, { x, y, w, h, margin: 0, isTextBox: true, fontSize: o.size || BODY, color: o.color || INK,
    valign: o.valign || "top", align: o.align || "left", italic: !!o.italic, bold: !!o.bold, objectName: o.name || "chu" });
}
function pin(s, x, y, num, label, o = {}) {
  if (o.glow) raw(s, "pin_glow.png", x - 1.39, y - 0.57, 2.78, 1.14, "!!glow", "");
  s.addText(String(num), { x: x - 0.2, y: y - 0.2, w: 0.4, h: 0.4, shape: pres.ShapeType.ellipse,
    fill: { color: o.color || PINC }, line: { color: "FFF2CC", width: 2 }, color: "FFFFFF", fontSize: 16, bold: true,
    align: "center", valign: "middle", margin: 0, objectName: "!!pin" + (o.id || num),
    shadow: { type: "outer", color: "3C2410", opacity: 0.35, blur: 4, offset: 2, angle: 90 } });
  if (label) {
    const w = 0.4 + label.length * 0.14;
    s.addText(label, { x: o.left ? x - 0.34 - w : x + 0.34, y: y - 0.23, w, h: 0.46, margin: 0, isTextBox: true,
      fill: { color: PAPER, transparency: 5 }, fontSize: 18, bold: true, color: INK, align: "center", valign: "middle",
      objectName: "!!nhanpin" + (o.id || num) });
  }
}
// ảnh tư liệu trong khung trắng kiểu ảnh rửa, chú thích ngay dưới ảnh; trả về mép dưới của khung
function photo(s, key, x, y, w, cap, o = {}) {
  const p = PH[key];
  if (!p) { console.warn("thiếu ảnh:", key); return y; }
  if (!used.includes(key)) used.push(key);
  const m = 0.1, h = (w - 2 * m) / p.aspect, capH = cap ? 0.5 : 0;
  s.addShape(pres.ShapeType.rect, { x, y, w, h: h + 2 * m + capH, fill: { color: "FDFAF2" }, line: { color: "E6DCC4", width: 0.75 },
    objectName: "khung_" + key, ...(o.rotate ? { rotate: o.rotate } : {}),
    shadow: { type: "outer", color: "3C2410", opacity: 0.35, blur: 8, offset: 3, angle: 90 } });
  s.addImage({ path: A(`ph_${key}.jpg`), x: x + m, y: y + m, w: w - 2 * m, h, objectName: o.name || "anh_" + key,
    altText: cap || p.title, ...(o.rotate ? { rotate: o.rotate } : {}) });
  if (cap) s.addText(cap, { x: x + m, y: y + m + h, w: w - 2 * m, h: capH, margin: 0, isTextBox: true, fontSize: 14,
    color: INK2, align: "center", valign: "middle", objectName: "chuthich_" + key, ...(o.rotate ? { rotate: o.rotate } : {}) });
  return y + h + 2 * m + capH;
}
// khung phim: viền trắng + video + tên phim
function video(s, file, x, y, w, label) {
  const m = 0.12, h = ((w - 2 * m) * 9) / 16, lh = label ? 0.42 : 0;
  s.addShape(pres.ShapeType.rect, { x, y, w, h: h + 2 * m + lh, fill: { color: "FDFAF2" }, line: { color: "E6DCC4", width: 0.75 },
    objectName: "khungphim", shadow: { type: "outer", color: "3C2410", opacity: 0.35, blur: 8, offset: 3, angle: 90 } });
  s.addMedia({ type: "video", path: A(file + ".mp4"), x: x + m, y: y + m, w: w - 2 * m, h,
    cover: "image/jpeg;base64," + fs.readFileSync(A(file + "_bia.jpg")).toString("base64"), objectName: "phim" });
  if (label) s.addText(label, { x: x + m, y: y + m + h, w: w - 2 * m, h: 0.42, margin: 0, isTextBox: true, fontSize: 15,
    color: INK2, align: "center", valign: "middle", objectName: "tenphim" });
}

// ---------- lược đồ: toạ độ địa lí -> slide ----------
const L0 = 92, L1 = 124, TOP = 23.9, BOT = 6.6;
const fx = (lon) => (lon - L0) / (L1 - L0), fy = (lat) => (TOP - lat) / (TOP - BOT);
function mapAt(s, lon, lat, sx, sy, mw) {
  const mh = (mw * 9) / 16;
  const p = { x: sx - fx(lon) * mw, y: sy - fy(lat) * mh, w: mw, h: mh };
  raw(s, "map.jpg", p.x, p.y, p.w, p.h, "!!bando", "Lược đồ Việt Nam và các nước lân cận (minh hoạ)");
  return p;
}
const pt = (p, lon, lat) => [p.x + fx(lon) * p.w, p.y + fy(lat) * p.h];
const G = { danang: [108.22, 16.07], giadinh: [106.7, 10.78], hanoi: [105.85, 21.03], hue: [107.59, 16.46] };

const slide = (master, section) => pres.addSlide({ masterName: master, sectionTitle: section });
const PRES_LINE = "——   TRÌNH BÀY: TỔ 3  ·  LỚP ……   ——";
const READ = " Các gạch đầu dòng là câu trọn vẹn, có thể đọc theo slide.";

// khung nội dung chuẩn: chữ một bên (rộng 7,2 inch), ảnh/lược đồ bên kia
// side "L": chữ bên trái; "R": chữ bên phải. Trả về toạ độ cột ảnh.
function content(s, o) {
  const left = o.side !== "R";
  if (o.map) raw(s, left ? "panel_l.png" : "panel_r.png", left ? 0 : 3.35, 0, 10.0, H, left ? "!!nenTrai" : "!!nenPhai", "");
  const tx = left ? 0.6 : 5.05;
  kicker(s, o.kicker, tx, 0.42);
  title(s, o.title, tx, 0.68, { alt: o.alt, maxW: 7.7 });
  bullets(s, o.items, tx, 2.05, 7.75, 5.1);
  return { x: left ? 8.75 : 0.4, w: 4.2 };
}

// =====================================================================
// 1. BÌA
// =====================================================================
pres.addSection({ title: "Mở đầu" });
{
  const s = slide("Giay", "Mở đầu");
  raw(s, "cloud_wisp.png", 5.6, 5.9, 7.5, 1.58, "!!mayDai", "");
  s.addText(PRES_LINE, { x: 0, y: 0.32, w: W, h: 0.32, margin: 0, isTextBox: true, fontSize: 14, bold: true,
    charSpacing: 3, color: GOLD, align: "center", objectName: "trinhbay" });
  img(s, "t_cover", W / 2, 0.45, 10.6, 2.9, { center: true, name: "!!tieude", alt: "1858 – 1884" });
  img(s, "vn_cut", 5.0, 2.45, 4.2, 4.9, { center: true, name: "!!vn", alt: "Hình Việt Nam với quần đảo Hoàng Sa, Trường Sa" });
  img(s, "s_cover", 7.3, 3.0, 5.6, 1.3, { name: "!!chuky", alt: "Kháng chiến chống Pháp" });
  body(s, "KHÁNG CHIẾN CHỐNG THỰC DÂN PHÁP", 7.3, 4.25, 5.8, 0.5, { size: 22, bold: true, color: GOLD, name: "tenbai" });
  raw(s, "cloud_side.png", -0.4, 5.3, 5.28, 2.0, "!!mayBen", "");
  raw(s, "cloud_big.png", 9.3, 5.35, 4.31, 1.91, "!!mayLon", "");
  raw(s, "suong.png", -1.4, 4.6, 16.11, 3.49, "!!suong", "");
  s.addNotes("0:30. Chào thầy cô và các bạn, giới thiệu tổ và chủ đề: 26 năm từ khi Pháp nổ súng ở Đà Nẵng (1858) đến khi triều Nguyễn đầu hàng hoàn toàn (1884). Điền tên lớp vào dòng trên cùng.");
}

// =====================================================================
// 2. MỤC LỤC
// =====================================================================
{
  const s = slide("Giay", "Mở đầu");
  raw(s, "cloud_big.png", 10.1, -0.25, 3.6, 1.6, "!!mayLon", "");
  const t = img(s, "t_mucluc", 0.55, 0.3, 4.4, 1.15, { name: "tieude_mucluc", alt: "MỤC LỤC" });
  s.addShape(pres.ShapeType.line, { x: t.x + t.w + 0.1, y: 0.95, w: 4.0, h: 0, line: { color: "C89A44", width: 1.5 }, objectName: "duong" });
  raw(s, "cloud_orn.png", t.x + t.w + 4.15, 0.73, 1.39, 0.44, "!!mayNho", "");
  const parts = [
    ["01", "m_thegioi", "Bối cảnh\nThế giới và trong nước"], ["02", "m_chien", "Diễn biến\nTừ Đà Nẵng đến Bắc Kì"],
    ["03", "m_hiepuoc", "Kết quả\nBốn hiệp ước, một kết cục"], ["04", "m_nhinlai", "Nhìn lại\nvà câu hỏi thảo luận"],
  ];
  parts.forEach(([n, m, label], i) => {
    const cx = 2.0 + i * 3.11;
    const rd = ["ph_hangnon.png", "rd_02.png", "rd_03.png", "rd_04.png"][i];
    if (fs.existsSync(A(rd))) raw(s, rd, cx - 1.05, 1.62, 2.1, 2.1, i === 0 ? "!!cua01" : "anhmuc" + n, "Ảnh minh hoạ phần " + n);
    else img(s, m, cx, 1.6, 2.3, 2.3, { center: true, name: "anhmuc" + n, alt: "Huy hiệu phần " + n });
    img(s, "n" + n, cx, 3.8, 1.6, 0.95, { center: true, name: "so" + n, alt: n });
    const [a, b] = label.split("\n");
    s.addText([{ text: a, options: { bold: true, fontSize: 26, color: INK, breakLine: true } }, { text: b, options: { fontSize: 18, color: INK2 } }],
      { x: cx - 1.5, y: 4.75, w: 3.0, h: 1.5, margin: 0, isTextBox: true, align: "center", valign: "top", objectName: "muc" + n });
  });
  raw(s, "cloud_side.png", -0.3, 6.0, 3.3, 1.25, "!!mayBen", "");
  s.addNotes("0:20. Bài gồm bốn phần: bối cảnh, diễn biến, kết quả, và phần nhìn lại kèm một câu hỏi cho cả lớp.");
}

// ---------- trang ngăn phần ----------
function divider(s, n, y0 = 2.0) {
  img(s, `d${n}_so`, W / 2, y0, 2, 0.95, { center: true, name: "so", alt: n });
  img(s, `d${n}_ten`, W / 2, y0 + 0.95, 6.6, 1.0, { center: true, name: "tenphan", alt: "" });
  img(s, `d${n}_phu`, W / 2, y0 + 2.0, 6.8, 0.85, { center: true, name: "phude", alt: "" });
}

// =====================================================================
// 3. NGĂN PHẦN 01 – BỐI CẢNH
// =====================================================================
pres.addSection({ title: "Bối cảnh" });
{
  const s = slide("Toi", "Bối cảnh");
  raw(s, "ph_hangnon.png", -1.67, -4.58, 16.67, 16.67, "!!cua01", "Phố Hàng Nón (Hà Nội) đầu thế kỉ XX – bưu ảnh Bắc Kì, ảnh tư liệu");
  raw(s, "vignette.png", 0, 0, W, H, "!!vig", "");
  raw(s, "plaque.png", 2.635, 1.8, 8.06, 3.89, "!!bien", "");
  divider(s, "01");
  s.addNotes("0:10. Chuyển sang phần 1: bối cảnh. Ảnh nền là bưu ảnh phố Hàng Nón (Bắc Kì) đầu thế kỉ XX, dùng để gợi không khí thời kì này.");
}

// =====================================================================
// 4. BỐI CẢNH THẾ GIỚI
// =====================================================================
{
  const s = slide("Giay", "Bối cảnh");
  raw(s, "cloud_big.png", 10.3, 0.1, 2.92, 1.29, "!!mayLon", "");
  const c = content(s, { kicker: "BỐI CẢNH  ·  THẾ GIỚI", title: "h_thegioi", alt: "Thế giới giữa thế kỉ XIX", items: [
    "Giữa thế kỉ XIX, chủ nghĩa tư bản phương Tây phát triển mạnh.",
    "Các nước tư bản cần nguyên liệu, thị trường và thuộc địa.",
    "Nhiều nước phương Đông lần lượt bị xâm lược.",
    "Việt Nam có vị trí quan trọng, giàu tài nguyên nên trở thành mục tiêu của thực dân Pháp.",
  ] });
  photo(s, "saigon_morel", c.x - 0.1, 1.6, c.w + 0.2, "Tàu chiến Pháp, 1859 (tranh Morel-Fatio)", { rotate: 2 });
  raw(s, "cloud_side.png", 9.6, 5.9, 3.3, 1.25, "!!mayBen", "");
  s.addNotes("1:00. Nói về bối cảnh thế giới: vì sao tư bản phương Tây đi tìm thuộc địa, và vì sao Pháp nhắm tới Việt Nam." + READ + " Nội dung slide này là kiến thức chung, hãy đối chiếu sách giáo khoa.");
}

// =====================================================================
// 5. BỐI CẢNH TRONG NƯỚC
// =====================================================================
{
  const s = slide("Giay", "Bối cảnh");
  const p = mapAt(s, 106.5, 16.0, 10.3, 3.75, 15);
  const c = content(s, { map: true, kicker: "BỐI CẢNH  ·  TRONG NƯỚC", title: "h_vietnam", alt: "Việt Nam trước năm 1858", items: [
    "Chế độ phong kiến nhà Nguyễn đang khủng hoảng, suy yếu.",
    "Triều đình thi hành chính sách “bế quan toả cảng”, cấm đạo Gia Tô.",
    "Quốc phòng yếu kém, vũ khí lạc hậu so với phương Tây.",
    "Pháp lấy cớ bảo vệ đạo Gia Tô để đem quân xâm lược Việt Nam.",
  ] });
  const [hx, hy] = pt(p, ...G.hue);
  pin(s, hx, hy, "★", "Kinh đô Huế", { glow: true, id: "hue" });
  photo(s, "tuduc", 8.2, 4.6, 2.0, "Vua Tự Đức", { rotate: -3 });
  s.addNotes("1:10. Nói về tình hình trong nước: triều Nguyễn suy yếu, chính sách khép kín, và cái cớ để Pháp nổ súng." + READ + " Nội dung slide này là kiến thức chung, hãy đối chiếu sách giáo khoa.");
}

// =====================================================================
// 6. NGĂN PHẦN 02 – DIỄN BIẾN (hai cánh cửa đóng)
// =====================================================================
pres.addSection({ title: "Diễn biến" });
{
  const s = slide("Toi", "Diễn biến");
  mapAt(s, 106.5, 16.0, 9.2, 3.75, 15);
  raw(s, "door_l.jpg", 0, 0, 6.67, H, "!!cuaTrai", "Cánh cửa son thếp vàng");
  raw(s, "door_r.jpg", 6.667, 0, 6.67, H, "!!cuaPhai", "");
  raw(s, "plaque.png", 2.635, 1.8, 8.06, 3.89, "!!bien", "");
  divider(s, "02");
  s.addNotes("0:10. Chuyển sang phần 2: diễn biến. Bấm tiếp, hai cánh cửa sẽ mở ra lược đồ.");
}

// =====================================================================
// 7. LƯỢC ĐỒ BA MẶT TRẬN (cửa mở)
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  const p = mapAt(s, 106.5, 16.0, 9.2, 3.75, 15);
  raw(s, "door_l.jpg", -6.9, 0, 6.67, H, "!!cuaTrai", "");
  raw(s, "door_r.jpg", 13.56, 0, 6.67, H, "!!cuaPhai", "");
  raw(s, "panel_l.png", -1.6, 0, 8.19, H, "!!nenTrai", "");
  kicker(s, "LƯỢC ĐỒ KHÁNG CHIẾN", 0.6, 0.45);
  title(s, "h_luocdo", 0.6, 0.7, { alt: "Ba mặt trận kháng chiến", maxW: 6.2 });
  bullets(s, [
    "Năm 1858: Pháp tấn công Đà Nẵng.",
    "Năm 1859: Pháp chuyển vào đánh Gia Định.",
    "Từ 1873 đến 1883: Pháp hai lần đánh ra Bắc Kì.",
    "Nhân dân ta kháng chiến ở khắp các mặt trận.",
  ], 0.6, 2.1, 5.6, 4.9);
  const [ax, ay] = pt(p, ...G.danang), [bx, by] = pt(p, ...G.giadinh), [cx, cy] = pt(p, ...G.hanoi);
  pin(s, ax, ay, 1, "Đà Nẵng · 1858");
  pin(s, bx, by, 2, "Gia Định · 1859");
  pin(s, cx, cy, 3, "Bắc Kì · 1873 – 1883");
  s.addNotes("0:40. Giới thiệu ba mặt trận theo thứ tự thời gian: Đà Nẵng, Gia Định, Bắc Kì. Chỉ lướt nhanh, chi tiết ở các slide sau." + READ);
}

// =====================================================================
// 8. ĐÀ NẴNG 1858
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  mapAt(s, ...G.danang, 10.5, 4.9, 38);
  const c = content(s, { map: true, kicker: "MẶT TRẬN 1/3  ·  NĂM 1858", title: "h_danang", alt: "Pháp tấn công Đà Nẵng", items: [
    "Ngày 1/9/1858, liên quân Pháp – Tây Ban Nha nổ súng tấn công Đà Nẵng.",
    "Sự kiện này mở đầu cuộc chiến tranh xâm lược Việt Nam.",
    "Nhân dân phối hợp với quân đội triều đình anh dũng chống trả.",
    "Pháp bị cầm chân ở Đà Nẵng, không thể đánh nhanh thắng nhanh.",
  ] });
  photo(s, "danang", c.x, 0.5, c.w, "Pháp bắn phá Đà Nẵng, 1858 (tranh khắc)");
  pin(s, 10.5, 4.9, 1, "Đà Nẵng", { glow: true });
  s.addNotes("1:10. Lược đồ phóng vào Đà Nẵng. Kể sự kiện mở đầu." + READ + " Ngày 1/9/1858 và ý “đánh nhanh thắng nhanh” là kiến thức chung, hãy đối chiếu sách giáo khoa.");
}

// =====================================================================
// 9. GIA ĐỊNH 1859
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  mapAt(s, ...G.giadinh, 2.6, 5.35, 38);
  const c = content(s, { map: true, side: "R", kicker: "MẶT TRẬN 2/3  ·  NĂM 1859", title: "h_giadinh", alt: "Pháp đánh chiếm Gia Định", items: [
    "Năm 1859, Pháp chuyển hướng vào Nam, đánh chiếm thành Gia Định.",
    "Nhân dân cùng quân đội triều đình chiến đấu ở mặt trận Gia Định.",
    "Pháp vấp phải sức kháng cự bền bỉ, phải đánh kéo dài.",
    "Sau đó Pháp mở rộng đánh chiếm các tỉnh miền Đông Nam Kì.",
  ] });
  photo(s, "saigon2", c.x, 0.5, c.w, "Pháp đánh thành Gia Định, 1859 (tranh khắc)");
  pin(s, 2.6, 5.35, 2, "Gia Định", { glow: true });
  s.addNotes("1:10. Lược đồ trượt từ Đà Nẵng xuống Gia Định: nhấn mạnh Pháp đổi hướng tấn công." + READ + " Ý cuối (Pháp mở rộng đánh chiếm miền Đông Nam Kì) là kiến thức chung, hãy đối chiếu sách giáo khoa.");
}

// =====================================================================
// PHIM 1 (slide riêng)
// =====================================================================
function filmSlide(kick, titleName, alt, file, note) {
  const s = slide("Giay", "Diễn biến");
  kicker(s, kick, 0, 0.3, { w: W, align: "center" });
  title(s, titleName, W / 2 + 0.12, 0.45, { center: true, maxH: 1.05, alt });
  video(s, file, 1.9, 1.5, 9.53);
  s.addNotes(note);
}
filmSlide("PHIM LƯỢC ĐỒ  ·  1858 – 1859", "h_phim1", "Từ Đà Nẵng vào Gia Định", "phim1_danang_giadinh",
  "0:25 (phim dài 18 giây). Bấm vào khung phim để phát; phim không có tiếng, có thể nói đè: Pháp đánh Đà Nẵng năm 1858 rồi chuyển vào Gia Định năm 1859. Phim là hoạt hoạ lược đồ tự dựng, đường mũi tên chỉ minh hoạ hướng tiến quân. Có thể thay bằng phim tư liệu: chọn khung phim, bấm Delete, rồi Insert > Video > This Device.");

// =====================================================================
// 10. NAM KÌ NỔI DẬY
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  raw(s, "cloud_big.png", 10.3, 0.1, 2.92, 1.29, "!!mayLon", "");
  kicker(s, "DIỄN BIẾN  ·  NAM KÌ", 0.6, 0.45);
  title(s, "h_namki", 0.6, 0.7, { alt: "Nhân dân Nam Kì nổi dậy" });
  const people = [
    ["truongdinh_tuong", "m_co", "Trương Định", "Được nhân dân suy tôn là Bình Tây Đại nguyên soái"],
    ["ntt_tuong", "m_dottau", "Nguyễn Trung Trực", "Đốt cháy tàu chiến Pháp trên sông Nhật Tảo"],
    ["voduyduong", "m_sen", "Võ Duy Dương", "Lập căn cứ kháng chiến ở Đồng Tháp Mười"],
    ["tkhuan", "m_but", "Nguyễn Hữu Huân", "Thủ khoa Huân, kiên trì chống Pháp đến cùng"],
  ];
  people.forEach(([key, m, name, desc], i) => {
    const x = 0.55 + i * 3.1, w = 2.9;
    if (PH[key]) photo(s, key, x + 0.2, 2.0, 2.5, "", { name: "!!thuLinh" + i });
    else img(s, m, x + w / 2, 2.05, 2.5, 2.5, { center: true, name: "!!thuLinh" + i, alt: "Huy hiệu minh hoạ: " + name });
    s.addText(name, { x, y: 4.75, w, h: 0.5, margin: 0, isTextBox: true, fontSize: 24, bold: true, color: GOLD,
      align: "center", valign: "middle", objectName: "ten" + i });
    s.addText(desc, { x: x + 0.05, y: 5.3, w: w - 0.1, h: 1.6, margin: 0, isTextBox: true, fontSize: 22, color: INK,
      align: "center", valign: "top", objectName: "mota" + i });
  });
  s.addNotes("1:30. Giới thiệu lần lượt bốn thủ lĩnh, mỗi người khoảng 20 giây; có thể đọc theo chữ dưới mỗi ảnh. Bốn tên lấy từ sách giáo khoa; phần mô tả là kiến thức chung, hãy đối chiếu sách. Ảnh là tượng đài tưởng niệm ngày nay, không phải ảnh chụp nhân vật.");
}

// =====================================================================
// 11. NHÂM TUẤT 1862
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  mapAt(s, 106.75, 10.85, 10.65, 5.75, 38);
  s.addShape(pres.ShapeType.ellipse, { x: 10.65 - 1.25, y: 5.75 - 0.9, w: 2.5, h: 1.8, fill: { color: MAROON, transparency: 55 },
    line: { color: MAROON, width: 1.5, dashType: "dash" }, objectName: "!!vungmat" });
  const c = content(s, { map: true, kicker: "HIỆP ƯỚC THỨ NHẤT  ·  NĂM 1862", title: "h_nhamtuat", alt: "Hiệp ước Nhâm Tuất 1862", items: [
    "Năm 1862, triều đình Huế kí với Pháp Hiệp ước Nhâm Tuất.",
    "Triều đình nhượng cho Pháp ba tỉnh miền Đông Nam Kì.",
    "Lúc đó phong trào kháng chiến của nhân dân đang diễn ra mạnh mẽ.",
    "Đây là bước nhượng bộ đầu tiên của triều Nguyễn.",
  ] });
  photo(s, PH.nhamtuat ? "nhamtuat" : "ptgian", c.x, 0.5, c.w, PH.nhamtuat ? "Lễ kí Hiệp ước Nhâm Tuất tại Sài Gòn, 1862" : "Sứ bộ Phan Thanh Giản tại Pháp, 1863");
  s.addText("Ba tỉnh miền Đông Nam Kì", { x: 8.8, y: 6.75, w: 3.7, h: 0.46, margin: 0, isTextBox: true, fill: { color: PAPER, transparency: 5 },
    fontSize: 18, bold: true, color: INK, align: "center", valign: "middle", objectName: "nhanvung" });
  s.addNotes("1:00. Vùng khoanh đỏ là phần đất bị nhượng (vị trí minh hoạ, không phải ranh giới chính xác). Nhấn mạnh sự trái ngược: dân đang đánh mạnh thì triều đình kí hiệp ước." + READ + " Đối chiếu điều khoản hiệp ước với sách giáo khoa.");
}

// =====================================================================
// 12. BẮC KÌ – CẦU GIẤY LẦN 1
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  mapAt(s, ...G.hanoi, 2.3, 5.6, 38);
  const c = content(s, { map: true, side: "R", kicker: "MẶT TRẬN 3/3  ·  1873 – 1874", title: "h_caugiay1", alt: "Chiến thắng Cầu Giấy lần 1", items: [
    "Năm 1873, Pháp đánh ra Bắc Kì lần thứ nhất.",
    "Quân dân ta giành chiến thắng Cầu Giấy lần 1, gây cho Pháp nhiều thiệt hại.",
    "Nhưng năm 1874, triều đình lại kí với Pháp Hiệp ước Giáp Tuất.",
  ] });
  photo(s, PH.caugiay ? "caugiay" : "caugiay2", c.x, 0.5, c.w, "Cầu Giấy (Hà Nội) cuối thế kỉ XIX");
  pin(s, 2.3, 5.6, 3, "Cầu Giấy (Hà Nội)", { glow: true });
  raw(s, "pl_cotco.png", 5.6, 5.15, 2.1, 2.0, "anh_cotco", "Cột cờ Hà Nội", { rotate: -3 });
  s.addText("Cột cờ Hà Nội – di tích còn lại của thành Hà Nội", { x: 8.0, y: 5.7, w: 4.6, h: 0.9, margin: 0, isTextBox: true, fontSize: 18,
    color: INK2, valign: "middle", objectName: "chuthich_cotco" });
  s.addNotes("1:20. Lược đồ bay từ Nam ra Bắc. Kể trận Cầu Giấy lần 1 rồi nêu nghịch lí: thắng trận nhưng triều đình vẫn kí Hiệp ước Giáp Tuất." + READ);
}

// =====================================================================
// 13. CẦU GIẤY LẦN 2
// =====================================================================
{
  const s = slide("Giay", "Diễn biến");
  mapAt(s, ...G.hanoi, 10.9, 5.5, 46);
  const c = content(s, { map: true, kicker: "MẶT TRẬN 3/3  ·  1882 – 1883", title: "h_caugiay2", alt: "Chiến thắng Cầu Giấy lần 2", items: [
    "Năm 1882, Pháp đánh Bắc Kì lần thứ hai.",
    "Năm 1883, quân dân ta lại thắng lớn ở Cầu Giấy.",
    "Hai chiến thắng Cầu Giấy làm quân Pháp hoang mang, thiệt hại nặng.",
  ] });
  photo(s, "caugiay2", c.x, 0.5, c.w, "Cầu Giấy khoảng năm 1884 – 1885");
  pin(s, 10.9, 5.5, 3, "Cầu Giấy (Hà Nội)", { glow: true, left: true });
  raw(s, "pl_thehuc1884.png", 0.9, 5.3, 2.5, 1.77, "anh_thehuc", "Cầu Thê Húc (Hà Nội) năm 1884 – ảnh tư liệu", { rotate: -3 });
  s.addText("Hà Nội năm 1884 – ảnh tư liệu", { x: 3.7, y: 5.9, w: 3.6, h: 0.5, margin: 0, isTextBox: true, fontSize: 18,
    color: INK2, valign: "middle", objectName: "chuthich_thehuc" });
  s.addNotes("1:00. Kể trận Cầu Giấy lần 2." + READ + " Ảnh Cầu Thê Húc năm 1884 lấy từ bài Hà Nội trước của bạn.");
}
filmSlide("PHIM LƯỢC ĐỒ  ·  1873 – 1883", "h_phim2", "Bắc Kì và hai trận Cầu Giấy", "phim2_backi_caugiay",
  "0:25 (phim dài 18 giây). Bấm vào khung phim để phát; phim không có tiếng, có thể nói đè: Pháp hai lần đánh ra Bắc Kì, quân dân ta hai lần thắng ở Cầu Giấy. Phim là hoạt hoạ lược đồ tự dựng, đường mũi tên chỉ minh hoạ.");

// =====================================================================
// 14. HAI HIỆP ƯỚC CUỐI (nền tối)
// =====================================================================
{
  const s = slide("Toi", "Diễn biến");
  raw(s, "map_dark.jpg", 0, 0, W, H, "!!khung", "Lược đồ miền Trung Việt Nam, tông tối");
  raw(s, "vignette.png", 0, 0, W, H, "!!vig", "");
  raw(s, "shade_left.png", 0, 0, W, H, "!!shadeL", "");
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 8.0, h: H, fill: { color: "1E120A", transparency: 28 }, line: { color: "1E120A", width: 0 }, objectName: "!!phutoi" });
  kicker(s, "KINH ĐÔ HUẾ  ·  1883 – 1884", 0.6, 0.45, { color: CREAM });
  title(s, "h_hue", 0.6, 0.7, { alt: "Hai hiệp ước cuối cùng" });
  bullets(s, [
    "Năm 1883, triều đình kí Hiệp ước Hác-măng.",
    "Năm 1884, triều đình kí tiếp Hiệp ước Pa-tơ-nốt.",
    "Trong hơn 20 năm, triều Nguyễn đã lần lượt kí bốn hiệp ước với Pháp.",
  ], 0.6, 2.05, 7.1, 5.0, { color: "FBF0D4" });
  photo(s, "thuanan", 8.35, 0.6, 4.6, "Sơ đồ Pháp bắn phá cửa Thuận An, 1883");
  s.addNotes("1:00. Chỉ lướt nhanh hai hiệp ước cuối, để dành phần ý nghĩa cho phần Kết quả." + READ);
}

// =====================================================================
// 15. NGĂN PHẦN 03 – KẾT QUẢ (cuộn giấy khép)
// =====================================================================
pres.addSection({ title: "Kết quả" });
{
  const s = slide("Toi", "Kết quả");
  raw(s, "cloud_wisp.png", -0.6, 0.55, 6.25, 1.31, "may1", "", { transparency: 60 });
  raw(s, "cloud_side.png", 9.2, 5.45, 3.89, 1.47, "may2", "", { transparency: 60 });
  divider(s, "03", 0.35);
  raw(s, "scroll_paper.jpg", 6.39, 3.75, 0.56, 3.06, "!!giayCuon", "");
  raw(s, "rod.png", 6.02, 3.48, 0.62, 3.61, "!!truc1", "");
  raw(s, "rod.png", 6.7, 3.48, 0.62, 3.61, "!!truc2", "");
  s.addNotes("0:10. Chuyển sang phần 3: kết quả. Bấm tiếp, cuộn giấy sẽ mở ra.");
}

// =====================================================================
// 16. KẾT QUẢ (cuộn giấy mở)
// =====================================================================
{
  const s = slide("Giay", "Kết quả");
  raw(s, "scroll_paper.jpg", 0.9, 0.55, 11.53, 6.4, "!!giayCuon", "");
  raw(s, "rod.png", 0.4, 0.2, 0.76, 7.1, "!!truc1", "");
  raw(s, "rod.png", 12.17, 0.2, 0.76, 7.1, "!!truc2", "");
  kicker(s, "KẾT QUẢ", 0, 0.8, { w: W, align: "center" });
  title(s, "h_ketcuc", W / 2 + 0.12, 0.95, { center: true, alt: "Bốn hiệp ước, một kết cục", maxH: 1.2 });
  ["1862", "1874", "1883", "1884"].forEach((y, i) => {
    img(s, "the_" + y, 2.9 + i * 2.5, 2.1, 1.75, 2.0, { center: true, name: "!!the" + i, alt: "Thẻ hiệp ước năm " + y, rotate: [-3, 2, -2, 3][i] });
  });
  bullets(s, [
    "Hiệp ước Pa-tơ-nốt đánh dấu sự đầu hàng hoàn toàn của triều Nguyễn trước thực dân Pháp.",
    "Kết thúc giai đoạn tồn tại của Nhà nước phong kiến Việt Nam độc lập.",
  ], 1.8, 4.25, 9.8, 2.6, { size: 28, gap: 10 });
  s.addNotes("1:20. Slide Morph chính: cuộn giấy mở ra, bốn thẻ hiệp ước xếp hàng. Dừng 2–3 giây cho hiệu ứng chạy xong rồi mới nói. Đọc chậm hai ý kết quả trên slide, đây là phần giáo viên yêu cầu.");
}

// =====================================================================
// 17. NHẬN XÉT
// =====================================================================
{
  const s = slide("Giay", "Kết quả");
  raw(s, "cloud_big.png", 10.3, 0.1, 2.92, 1.29, "!!mayLon", "");
  kicker(s, "NHẬN XÉT", 0.6, 0.45);
  title(s, "h_thaido", 0.6, 0.7, { alt: "Hai thái độ trái ngược" });
  const cols = [
    { x: 0.5, m: "m_dan", head: "NHÂN DÂN", color: GOLD, items: ["Anh dũng chiến đấu ở Đà Nẵng, Gia Định, Bắc Kì.", "Nổi dậy khắp Nam Kì.", "Hai lần thắng lớn ở Cầu Giấy."] },
    { x: 6.85, m: "m_trieudinh", head: "TRIỀU ĐÌNH NGUYỄN", color: MAROON, items: ["Nhượng bộ khi phong trào đang mạnh.", "Kí liên tiếp bốn hiệp ước.", "Cuối cùng đầu hàng hoàn toàn."] },
  ];
  cols.forEach((c, i) => {
    raw(s, "parch_b.png", c.x, 2.05, 6.0, 5.1, "!!giay" + (i + 1), "");
    img(s, c.m, c.x + 0.45, 2.4, 1.25, 1.25, { name: "huyhieu" + i, alt: c.head });
    s.addText(c.head, { x: c.x + 1.85, y: 2.65, w: 3.8, h: 0.7, margin: 0, isTextBox: true, fontSize: 24, bold: true, charSpacing: 2,
      color: c.color, valign: "middle", objectName: "cot" + i });
    bullets(s, c.items, c.x + 0.55, 3.8, 5.0, 3.1, { size: 24, gap: 8, name: "cot_y" + i });
  });
  s.addNotes("0:50. So sánh hai thái độ: nhân dân đánh đến cùng, triều đình nhượng bộ. Có thể đọc theo hai cột. Slide này không nằm trong yêu cầu ghi trên bảng; nếu tập thử bị quá 17 phút thì bỏ slide này trước.");
}

// =====================================================================
// 18. NHÌN LẠI
// =====================================================================
pres.addSection({ title: "Tổng kết" });
{
  const s = slide("Giay", "Tổng kết");
  const p = mapAt(s, 106.5, 16.0, 10.8, 3.75, 15);
  raw(s, "panel_l.png", 0, 0, 9.0, H, "!!nenTrai", "");
  kicker(s, "04  ·  TỔNG KẾT", 0.6, 0.45);
  title(s, "h_nhinlai", 0.6, 0.7, { alt: "Nhìn lại 1858 – 1884" });
  const ev = [["1858", "Pháp tấn công Đà Nẵng"], ["1862", "Hiệp ước Nhâm Tuất"], ["1874", "Hiệp ước Giáp Tuất"],
    ["1883", "Hiệp ước Hác-măng"], ["1884", "Hiệp ước Pa-tơ-nốt"]];
  ev.forEach(([y, t], i) => {
    const yy = 2.0 + i * 0.76;
    img(s, "y" + y, 0.45, yy - 0.12, 1.9, 0.95, { name: "nam" + y, alt: y });
    body(s, t, 2.15, yy, 5.4, 0.7, { valign: "middle", name: "sk" + y });
  });
  const stops = [["danang", 1], ["giadinh", 2], ["hanoi", 3], ["hue", 4]].map(([k, n]) => [...pt(p, ...G[k]), n, k]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [x1, y1] = stops[i], [x2, y2] = stops[i + 1];
    s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipH: x2 < x1, flipV: y2 < y1, line: { color: MAROON, width: 2, dashType: "dash" }, objectName: "tuyen" + i });
  }
  const names = { danang: "Đà Nẵng", giadinh: "Gia Định", hanoi: "Hà Nội", hue: "Huế" };
  stops.forEach(([x, y, n, k]) => pin(s, x, y, n, names[k], { id: k, left: k === "hue" }));
  raw(s, "parch_e.png", 0.35, 5.9, 8.3, 1.35, "!!giay9", "");
  s.addText("Câu hỏi: Vì sao nhân dân chiến đấu anh dũng mà Việt Nam vẫn rơi vào tay thực dân Pháp?", { x: 0.75, y: 6.02, w: 7.5, h: 1.1,
    margin: 0, isTextBox: true, fontSize: 22, bold: true, color: INK, align: "center", valign: "middle", objectName: "cauhoi" });
  s.addNotes("0:45. Nhắc lại năm mốc trong 20 giây; đường nét đứt nối bốn địa điểm theo thứ tự thời gian. Sau đó đọc câu hỏi ở mẩu giấy phía dưới cho cả lớp.");
}

// =====================================================================
// 19. CẢM ƠN
// =====================================================================
{
  const s = slide("Giay", "Tổng kết");
  raw(s, "cloud_wisp.png", 5.6, 5.9, 7.5, 1.58, "!!mayDai", "");
  s.addText(PRES_LINE, { x: 0, y: 0.32, w: W, h: 0.32, margin: 0, isTextBox: true, fontSize: 14, bold: true,
    charSpacing: 3, color: GOLD, align: "center", objectName: "trinhbay" });
  img(s, "t_camon", W / 2, 0.45, 8.0, 2.6, { center: true, name: "!!tieude", alt: "CẢM ƠN" });
  img(s, "vn_cut", 5.0, 2.7, 4.1, 4.65, { center: true, name: "!!vn", alt: "Hình Việt Nam với quần đảo Hoàng Sa, Trường Sa" });
  img(s, "s_camon", 7.2, 3.3, 5.8, 1.3, { name: "!!chuky", alt: "thầy cô và các bạn đã lắng nghe" });
  raw(s, "cloud_side.png", -0.4, 5.3, 5.28, 2.0, "!!mayBen", "");
  raw(s, "cloud_big.png", 9.3, 5.35, 4.31, 1.91, "!!mayLon", "");
  raw(s, "suong.png", -1.4, 4.6, 16.11, 3.49, "!!suong", "");
  s.addNotes("0:10. Cảm ơn và mời thầy cô, các bạn đặt câu hỏi.");
}

// =====================================================================
// 20. NGUỒN ẢNH (phụ lục, không cần trình bày)
// =====================================================================
{
  const s = slide("Giay", "Tổng kết");
  kicker(s, "PHỤ LỤC", 0.6, 0.45);
  title(s, "h_nguon", 0.6, 0.7, { alt: "Nguồn ảnh", maxH: 1.1 });
  const lines = used.map((k) => {
    const p = PH[k];
    const a = (p.artist || "").replace(/(Unknown author)+/g, "").trim();
    const who = a && a.length < 60 && !/[<>=]/.test(a) ? a + ", " : "";
    return `${(p.title || k).replace(/\.(jpe?g|png)$/i, "")} — ${who}${p.lic || "Wikimedia Commons"}`;
  });
  lines.push("Ảnh Hà Nội xưa (phố Hàng Nón) và hoạ tiết giấy cổ, mây vàng: lấy từ bài thuyết trình Hà Nội trước của người trình bày");
  lines.push("Biểu tượng huy hiệu: game-icons.net (CC BY 3.0)  ·  Dữ liệu lược đồ: Natural Earth  ·  Phim hoạt hoạ lược đồ: tự dựng");
  s.addText([{ text: "Ảnh tư liệu lấy từ Wikimedia Commons:", options: { bold: true, breakLine: true } },
    ...lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } }))],
    { x: 0.6, y: 1.85, w: 12.1, h: 5.3, margin: 0, isTextBox: true, fontSize: 12, color: INK2, valign: "top", paraSpaceAfter: 3, objectName: "nguon" });
  s.addNotes("Phụ lục ghi nguồn ảnh, không cần trình bày. Giữ slide này trong file vì nhiều ảnh dùng giấy phép Creative Commons yêu cầu ghi tên tác giả.");
}

// ---------- Ghi file, áp theme, thêm chuyển cảnh Morph ----------
const MORPH =
  '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
  '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">' +
  '<p:transition spd="slow" p14:dur="2000" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">' +
  '<p159:morph option="byObject"/></p:transition></mc:Choice>' +
  '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>';

(async () => {
  await pres.writeFile({ fileName: OUT });
  // (áp theme trước khi sửa XML)
  const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");
  await applyTheme(OUT, THEME);
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  let n = 0;
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (!m || m[1] === "1") continue; // slide 1 không cần chuyển cảnh vào
    let xml = await zip.file(name).async("string");
    if (!xml.includes("</p:clrMapOvr>")) throw new Error("không tìm thấy clrMapOvr trong " + name);
    // Morph phải đứng trước <p:timing> (slide có phim), nên chèn ngay sau clrMapOvr
    xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + MORPH);
    zip.file(name, xml);
    n++;
  }
  // Morph chỉ được ghép các vật thể đặt tên "!!…"; mọi tên khác gắn thêm số slide cho khỏi trùng
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (!m) continue;
    const xml = await zip.file(name).async("string");
    zip.file(name, xml.replace(/(<p:cNvPr id="\d+" name=")([^"!][^"]*)"/g, `$1$2 · ${m[1]}"`));
  }
  const clean = new JSZip(); // chỉ chép file, bỏ các entry thư mục
  for (const [name, f] of Object.entries(zip.files)) if (!f.dir) clean.file(name, await f.async("nodebuffer"), { createFolders: false });
  fs.writeFileSync(OUT, await clean.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("OK:", OUT, "- Morph trên", n, "slide; ảnh tư liệu:", used.join(", "));
})();
