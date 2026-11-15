// Dựng file thuyết trình "Kháng chiến chống thực dân Pháp (1858 – 1884)".
// Chạy: node build.js   (cần: npm i pptxgenjs; map.png và map-red.png nằm cạnh file này)
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const OUT = path.join(__dirname, "khang-chien-chong-phap-1858-1884.pptx");
const MAP = path.join(__dirname, "map.png");
const MAP_RED = path.join(__dirname, "map-red.png");

const THEME = {
  name: "Khang chien 1858-1884",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14233A", lt1: "FFFFFF", dk2: "5A6880", lt2: "EEF1F6",
    accent1: "C8372D", accent2: "A8650A", accent3: "7A1F1A",
    accent4: "2A4A78", accent5: "D98A3D", accent6: "6E8FB8",
    hlink: "A8650A", folHlink: "5A6880",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inch
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Kháng chiến chống thực dân Pháp (1858 – 1884)";
const C = pres.SchemeColor;
// nền sáng: BG = trắng, CREAM = màu chữ chính (xanh đen), LAND = nền thẻ nhạt, MUTED = chữ phụ
const BG = C.background1, CREAM = C.text1, LAND = C.background2, MUTED = C.text2;
const RED = C.accent1, GOLD = C.accent2;
const HEAD = "+mj-lt";

// ---------- Layouts ----------
pres.defineSlideMaster({ title: "Bia", background: { color: THEME.colors.lt1 } });
pres.defineSlideMaster({
  title: "Noi dung",
  background: { color: THEME.colors.lt1 },
  slideNumber: { x: 12.3, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: "right" },
});

// ---------- Lược đồ: toạ độ địa lí -> toạ độ slide ----------
const ASPECT = 3363 / 4025, L0 = 102, L1 = 116, TOP = 23.6, BOT = 7.5, COS = 0.961;
const fx = (lon) => (lon - L0) / (L1 - L0);
const fy = (lat) => (TOP - lat) / (TOP - BOT);
// đặt lược đồ cao h inch sao cho điểm (lon, lat) rơi vào (sx, sy) trên slide
const place = (lon, lat, sx, sy, h) => ({ x: sx - fx(lon) * h * ASPECT, y: sy - fy(lat) * h, w: h * ASPECT, h });
const pt = (p, lon, lat) => [p.x + fx(lon) * p.w, p.y + fy(lat) * p.h];

const PLACES = {
  danang: { lon: 108.22, lat: 16.07 },
  giadinh: { lon: 106.7, lat: 10.78 },
  hanoi: { lon: 105.85, lat: 21.03 },
  hue: { lon: 107.59, lat: 16.46 },
};

function addMap(s, p, { red = false, transparency = 0 } = {}) {
  s.addImage({ path: red ? MAP_RED : MAP, ...p, transparency, objectName: "!!luocdo",
    altText: "Lược đồ Việt Nam (minh hoạ)" });
}

// chấm đỏ trên lược đồ; active = { label } thì to hơn và có nhãn
function addMarkers(s, p, active = {}) {
  for (const [key, g] of Object.entries(PLACES)) {
    const [x, y] = pt(p, g.lon, g.lat);
    const label = active[key];
    const d = label ? 0.3 : 0.14;
    s.addShape(pres.ShapeType.ellipse, { x: x - d / 2, y: y - d / 2, w: d, h: d,
      fill: { color: RED }, line: { color: CREAM, width: label ? 1.5 : 0.75 }, objectName: "!!diem_" + key });
    if (label) {
      s.addText(label, { x: x + 0.28, y: y - 0.22, w: 0.3 + label.length * 0.125, h: 0.44, margin: 0,
        shape: pres.ShapeType.roundRect, rectRadius: 0.08, fill: { color: BG, transparency: 15 },
        fontSize: 16, bold: true, color: CREAM, align: "center", valign: "middle", objectName: "!!nhan_" + key });
    }
  }
}

// ---------- Thanh thời gian ----------
const YEARS = ["1858", "1862", "1874", "1883", "1884"];
const TL_X0 = 1.1, TL_X1 = 12.23, TL_Y = 6.45;
const tlx = (i) => TL_X0 + (i * (TL_X1 - TL_X0)) / 4;
function addTimeline(s, pos) {
  s.addShape(pres.ShapeType.line, { x: TL_X0, y: TL_Y, w: TL_X1 - TL_X0, h: 0,
    line: { color: MUTED, width: 1.25 }, objectName: "!!tl_duong" });
  YEARS.forEach((yr, i) => {
    const on = i <= pos;
    s.addText(yr, { x: tlx(i) - 0.6, y: TL_Y + 0.14, w: 1.2, h: 0.32, margin: 0, isTextBox: true,
      fontFace: HEAD, fontSize: 13, bold: on, color: on ? GOLD : MUTED, align: "center",
      objectName: "!!tl_" + yr });
  });
  s.addShape(pres.ShapeType.ellipse, { x: tlx(pos) - 0.13, y: TL_Y - 0.13, w: 0.26, h: 0.26,
    fill: { color: GOLD }, line: { color: CREAM, width: 1.5 }, objectName: "!!tl_cham" });
}

// ---------- Thẻ hiệp ước ----------
const TREATIES = [
  { yr: "1862", name: "Nhâm Tuất" }, { yr: "1874", name: "Giáp Tuất" },
  { yr: "1883", name: "Hác-măng" }, { yr: "1884", name: "Pa-tơ-nốt" },
];
function addCards(s, count, large = false) {
  for (let i = 0; i < count; i++) {
    const t = TREATIES[i];
    const last = large && i === 3;
    const box = large
      ? { x: 0.72 + i * 3.05, y: 1.95, w: 2.75, h: 1.7 }
      : { x: 7.9 + i * 1.23, y: 0.5, w: 1.11, h: 0.5 };
    const text = large
      ? [{ text: t.yr, options: { fontFace: HEAD, fontSize: 36, bold: true, breakLine: true } },
         { text: "Hiệp ước " + t.name, options: { fontSize: 16 } }]
      : [{ text: t.yr, options: { fontFace: HEAD, fontSize: 14, bold: true } }];
    s.addText(text, { ...box, shape: pres.ShapeType.roundRect, rectRadius: large ? 0.12 : 0.08,
      fill: { color: last ? RED : CREAM }, color: BG, align: "center", valign: "middle",
      margin: 0, objectName: "!!hiepuoc_" + t.yr });
  }
}

// ---------- Khối dựng chung ----------
function contentSlide(section, kicker, title, panelW = 6.9) {
  const s = pres.addSlide({ masterName: "Noi dung", sectionTitle: section });
  s._panelW = panelW;
  s._kicker = kicker; s._title = title;
  return s;
}
// gọi SAU khi đã thêm lược đồ, để chữ nằm trên lược đồ
function addHeader(s) {
  if (s._panelW) {
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: s._panelW, h: 7.5,
      fill: { color: BG, transparency: 12 }, line: { color: BG, width: 0 }, objectName: "!!nen_chu" });
    if (s._panelW < 13) s.addShape(pres.ShapeType.rect, { x: s._panelW, y: 6.15, w: 13.33 - s._panelW, h: 1.35,
      fill: { color: BG, transparency: 12 }, line: { color: BG, width: 0 }, objectName: "!!nen_duoi" });
  }
  s.addText(s._kicker, { x: 0.6, y: 0.5, w: 6.5, h: 0.3, margin: 0, isTextBox: true,
    fontSize: 12, bold: true, color: GOLD, charSpacing: 3, objectName: "!!nhan_phan" });
  s.addText(s._title, { x: 0.6, y: 0.85, w: 6.9, h: 0.8, margin: 0, isTextBox: true,
    fontFace: HEAD, fontSize: 36, bold: true, color: CREAM, valign: "top", objectName: "!!tieu_de" });
}

// các ý đánh số: vòng tròn đỏ + chữ
function addPoints(s, items, { x = 0.6, y = 2.05, w = 5.9, step = 1.35, size = 18 } = {}) {
  items.forEach((it, i) => {
    const yy = y + i * step;
    s.addText(String(i + 1), { x, y: yy, w: 0.5, h: 0.5, shape: pres.ShapeType.ellipse,
      fill: { color: RED }, color: BG, fontFace: HEAD, fontSize: 16, bold: true,
      align: "center", valign: "middle", margin: 0, objectName: "so_" + (i + 1) });
    const runs = Array.isArray(it)
      ? [{ text: it[0], options: { bold: true, color: GOLD } }, { text: " " + it[1], options: {} }]
      : [{ text: it, options: {} }];
    s.addText(runs, { x: x + 0.75, y: yy - 0.03, w: w - 0.75, h: step - 0.2, margin: 0, isTextBox: true,
      fontSize: size, color: CREAM, valign: "top", objectName: "y_" + (i + 1) });
  });
}

// khung chờ chèn phim / ảnh
function addFrame(s, x, y, w, h, label, sub) {
  const runs = [{ text: label, options: { bold: true, color: GOLD, fontSize: 14, breakLine: !!sub } }];
  if (sub) runs.push({ text: sub, options: { color: MUTED, fontSize: 12 } });
  s.addText(runs, { x, y, w, h, shape: pres.ShapeType.roundRect, rectRadius: 0.1,
    fill: { color: BG, transparency: 15 }, line: { color: GOLD, width: 1.25, dashType: "dash" },
    align: "center", valign: "middle", margin: 6, objectName: "khung_" + label });
}

// =====================================================================
// 1. BÌA
// =====================================================================
{
  pres.addSection({ title: "Mở đầu" });
  const s = pres.addSlide({ masterName: "Bia", sectionTitle: "Mở đầu" });
  addMap(s, { x: 6.9, y: -0.75, w: 9 * ASPECT, h: 9 }, { transparency: 55 });
  s.addText("LỊCH SỬ  ·  BÀI THUYẾT TRÌNH", { x: 0.6, y: 0.6, w: 7, h: 0.3, margin: 0, isTextBox: true,
    fontSize: 12, bold: true, color: GOLD, charSpacing: 3, objectName: "!!nhan_phan" });
  s.addText("1858", { x: 0.6, y: 1.2, w: 4.3, h: 2.0, margin: 0, isTextBox: true, fontFace: HEAD,
    fontSize: 130, bold: true, color: GOLD, valign: "middle", objectName: "!!tl_1858" });
  s.addText("1884", { x: 5.0, y: 1.2, w: 4.3, h: 2.0, margin: 0, isTextBox: true, fontFace: HEAD,
    fontSize: 130, bold: true, color: MUTED, valign: "middle", objectName: "!!tl_1884" });
  s.addText("Kháng chiến chống thực dân Pháp", { x: 0.6, y: 3.55, w: 9, h: 0.8, margin: 0, isTextBox: true,
    fontFace: HEAD, fontSize: 40, bold: true, color: CREAM, objectName: "!!tieu_de" });
  s.addText("Từ tiếng súng Đà Nẵng đến Hiệp ước Pa-tơ-nốt", { x: 0.6, y: 4.45, w: 9, h: 0.5, margin: 0,
    isTextBox: true, fontSize: 22, italic: true, color: CREAM, objectName: "phu_de" });
  s.addText("Nhóm: ……   ·   Lớp: ……", { x: 0.6, y: 6.4, w: 7, h: 0.4, margin: 0, isTextBox: true,
    fontSize: 16, color: MUTED, objectName: "nhom_lop" });
  s.addNotes("0:30. Chào lớp, giới thiệu nhóm và chủ đề: 26 năm từ lúc Pháp nổ súng (1858) đến khi triều Nguyễn đầu hàng hoàn toàn (1884). Điền tên nhóm và lớp vào dòng dưới cùng.");
}

// =====================================================================
// 2. BỐI CẢNH THẾ GIỚI
// =====================================================================
pres.addSection({ title: "Bối cảnh" });
{
  const s = contentSlide("Bối cảnh", "BỐI CẢNH", "Thế giới giữa thế kỉ XIX");
  const p = { x: 8.6, y: 1.5, w: 4.4 * ASPECT, h: 4.4 };
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p);
  addPoints(s, [
    "Chủ nghĩa tư bản phương Tây phát triển mạnh, cần thị trường và thuộc địa",
    "Các nước phương Tây đẩy mạnh xâm lược phương Đông",
    "Việt Nam có vị trí quan trọng, giàu tài nguyên nên trở thành mục tiêu của Pháp",
  ]);
  addTimeline(s, 0);
  s.addNotes("1:00. Nói về bối cảnh thế giới: vì sao các nước tư bản phương Tây đi xâm chiếm thuộc địa và vì sao Pháp nhắm tới Việt Nam. Nội dung slide này là kiến thức chung, hãy đối chiếu sách giáo khoa.");
}

// =====================================================================
// 3. BỐI CẢNH TRONG NƯỚC
// =====================================================================
{
  const s = contentSlide("Bối cảnh", "BỐI CẢNH", "Việt Nam trước năm 1858");
  const p = { x: 6.5, y: 1.2, w: 5.0 * ASPECT, h: 5.0 };
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { hue: "Kinh đô Huế" });
  addPoints(s, [
    "Chế độ phong kiến nhà Nguyễn khủng hoảng, suy yếu",
    "Triều đình thi hành chính sách bế quan toả cảng, cấm đạo",
    "Pháp lấy cớ bảo vệ đạo Gia Tô để đem quân xâm lược",
  ]);
  addFrame(s, 10.4, 1.9, 2.3, 2.2, "ẢNH", "Kinh thành Huế");
  addTimeline(s, 0);
  s.addNotes("1:15. Nói về tình hình trong nước: triều Nguyễn suy yếu, chính sách đối ngoại khép kín, và cái cớ của Pháp. Nội dung slide này là kiến thức chung, hãy đối chiếu sách giáo khoa. Chèn ảnh kinh thành Huế vào khung.");
}

// =====================================================================
// 4. ĐÀ NẴNG 1858
// =====================================================================
pres.addSection({ title: "Diễn biến" });
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1858", "Tiếng súng Đà Nẵng");
  const p = place(PLACES.danang.lon, PLACES.danang.lat, 9.3, 2.9, 15);
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { danang: "Đà Nẵng, 1858" });
  addPoints(s, [
    ["1/9/1858:", "liên quân Pháp – Tây Ban Nha tấn công Đà Nẵng"],
    "Mở đầu cuộc chiến tranh xâm lược Việt Nam",
    "Nhân dân phối hợp với quân đội triều đình anh dũng chống trả",
  ]);
  addFrame(s, 7.5, 4.0, 5.2, 2.0, "PHIM 1", "Chèn đoạn phim tư liệu về Đà Nẵng 1858 (30–40 giây)");
  addTimeline(s, 0);
  s.addNotes("1:45 (gồm 30–40 giây phim). Lược đồ phóng vào Đà Nẵng. Kể sự kiện mở đầu, rồi bấm phát phim. Chèn phim: Insert > Video > This Device, đặt vào khung rồi xoá khung.");
}

// =====================================================================
// 5. GIA ĐỊNH
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1859", "Pháp đánh Gia Định");
  const p = place(PLACES.giadinh.lon, PLACES.giadinh.lat, 9.3, 3.0, 15);
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { giadinh: "Gia Định, 1859" });
  addPoints(s, [
    ["1859:", "Pháp chuyển hướng vào Nam, đánh chiếm thành Gia Định"],
    "Nhân dân cùng quân triều đình chiến đấu ở mặt trận Gia Định",
    "Pháp vấp phải sức kháng cự bền bỉ, phải đánh kéo dài",
  ]);
  addFrame(s, 7.5, 4.3, 3.2, 1.7, "ẢNH", "Thành Gia Định");
  addTimeline(s, 0.25);
  s.addNotes("1:15. Lược đồ trượt từ Đà Nẵng xuống Gia Định: nhấn mạnh Pháp đổi hướng tấn công. Chèn ảnh thành Gia Định vào khung.");
}

// =====================================================================
// 6. CÁC CUỘC NỔI DẬY
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  NAM KÌ", "Nhân dân Nam Kì nổi dậy", 13.33);
  const p = place(PLACES.giadinh.lon, PLACES.giadinh.lat, 10.6, 4.2, 12);
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p);
  const people = [
    ["Trương Định", "Được nhân dân suy tôn là Bình Tây Đại nguyên soái"],
    ["Nguyễn Trung Trực", "Đốt cháy tàu chiến Pháp trên sông Nhật Tảo"],
    ["Võ Duy Dương", "Lập căn cứ kháng chiến ở Đồng Tháp Mười"],
    ["Nguyễn Hữu Huân", "Thủ khoa Huân, kiên trì chống Pháp đến cùng"],
  ];
  people.forEach(([name, desc], i) => {
    const x = 0.6 + i * 3.1;
    s.addText("ẢNH", { x, y: 2.0, w: 1.6, h: 1.6, shape: pres.ShapeType.ellipse,
      fill: { color: LAND }, line: { color: GOLD, width: 1.5, dashType: "dash" }, color: MUTED,
      fontSize: 12, align: "center", valign: "middle", margin: 0, objectName: "!!chandung_" + (i + 1) });
    s.addText(name, { x, y: 3.85, w: 2.8, h: 0.4, margin: 0, isTextBox: true,
      fontFace: HEAD, fontSize: 20, bold: true, color: GOLD, objectName: "ten_" + (i + 1) });
    s.addText(desc, { x, y: 4.3, w: 2.7, h: 1.3, margin: 0, isTextBox: true,
      fontSize: 16, color: CREAM, valign: "top", objectName: "mota_" + (i + 1) });
  });
  addTimeline(s, 0.6);
  s.addNotes("1:45. Giới thiệu lần lượt bốn thủ lĩnh, mỗi người khoảng 20 giây. Chèn ảnh chân dung vào bốn vòng tròn (chọn vòng tròn > Shape Fill > Picture). Bốn tên lấy từ sách giáo khoa; các chi tiết mô tả là kiến thức chung, hãy đối chiếu sách trước khi trình bày.");
}

// =====================================================================
// 7. NHÂM TUẤT 1862
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1862", "Hiệp ước Nhâm Tuất");
  const p = place(PLACES.giadinh.lon, PLACES.giadinh.lat, 9.6, 3.4, 14);
  addMap(s, p);
  const [gx, gy] = pt(p, 106.75, 10.85);
  s.addShape(pres.ShapeType.ellipse, { x: gx - 1.3, y: gy - 0.95, w: 2.6, h: 1.9,
    fill: { color: RED, transparency: 45 }, line: { color: RED, width: 1.5 }, objectName: "!!vung_mat" });
  addHeader(s);
  addMarkers(s, p);
  s.addText("3 tỉnh miền Đông Nam Kì", { x: gx - 1.7, y: gy + 1.05, w: 3.4, h: 0.4, margin: 0, isTextBox: true,
    fontSize: 16, bold: true, color: CREAM, align: "center", objectName: "nhan_vung" });
  addPoints(s, [
    ["1862:", "triều đình kí với Pháp Hiệp ước Nhâm Tuất"],
    "Nhượng cho Pháp ba tỉnh miền Đông Nam Kì",
    "Phong trào kháng chiến đang mạnh nhưng triều đình bắt đầu nhượng bộ",
  ]);
  addCards(s, 1);
  addTimeline(s, 1);
  s.addNotes("1:00. Thẻ hiệp ước đầu tiên xuất hiện ở góc phải, vùng đỏ là phần đất bị nhượng (vị trí minh hoạ, không phải ranh giới chính xác). Nhấn mạnh sự trái ngược: dân đang đánh mạnh thì triều đình kí hiệp ước. Đối chiếu điều khoản hiệp ước với sách giáo khoa.");
}

// =====================================================================
// 8. BẮC KÌ, CẦU GIẤY LẦN 1
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1873 – 1874", "Bắc Kì và Cầu Giấy lần 1");
  const p = place(PLACES.hanoi.lon, PLACES.hanoi.lat, 9.3, 3.0, 16);
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { hanoi: "Cầu Giấy (Hà Nội)" });
  addPoints(s, [
    ["1873:", "Pháp đánh ra Bắc Kì lần thứ nhất"],
    "Chiến thắng Cầu Giấy lần 1 gây cho Pháp nhiều thiệt hại",
    ["1874:", "triều đình vẫn kí Hiệp ước Giáp Tuất"],
  ]);
  addFrame(s, 7.5, 4.3, 3.2, 1.7, "ẢNH", "Thành Hà Nội");
  addCards(s, 2);
  addTimeline(s, 2);
  s.addNotes("1:30. Lược đồ bay từ Nam ra Bắc. Kể trận Cầu Giấy lần 1 rồi nêu nghịch lí: thắng trận nhưng triều đình vẫn kí Hiệp ước Giáp Tuất. Chèn ảnh thành Hà Nội vào khung.");
}

// =====================================================================
// 9. CẦU GIẤY LẦN 2
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1882 – 1883", "Cầu Giấy lần 2");
  const p = place(PLACES.hanoi.lon, PLACES.hanoi.lat, 9.3, 2.9, 20);
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { hanoi: "Cầu Giấy (Hà Nội)" });
  addPoints(s, [
    ["1882:", "Pháp đánh Bắc Kì lần thứ hai"],
    ["1883:", "quân dân ta lại thắng lớn ở Cầu Giấy"],
    "Hai chiến thắng Cầu Giấy làm quân Pháp hoang mang, thiệt hại nặng",
  ]);
  addFrame(s, 7.5, 4.0, 5.2, 2.0, "PHIM 2", "Chèn đoạn phim về trận Cầu Giấy (20–30 giây)");
  addCards(s, 2);
  addTimeline(s, 2.9);
  s.addNotes("1:15 (gồm 20–30 giây phim). Lược đồ phóng sâu hơn vào Hà Nội. Kể trận Cầu Giấy lần 2 rồi phát phim. Chèn phim: Insert > Video > This Device, đặt vào khung rồi xoá khung.");
}

// =====================================================================
// 10. HÁC-MĂNG, PA-TƠ-NỐT
// =====================================================================
{
  const s = contentSlide("Diễn biến", "DIỄN BIẾN  ·  1883 – 1884", "Hai hiệp ước cuối cùng");
  const p = { x: 7.7, y: 1.35, w: 4.9 * ASPECT, h: 4.9 };
  addMap(s, p);
  addHeader(s);
  addMarkers(s, p, { hue: "Huế" });
  addPoints(s, [
    ["1883:", "triều đình kí Hiệp ước Hác-măng"],
    ["1884:", "triều đình kí tiếp Hiệp ước Pa-tơ-nốt"],
    "Trong hơn 20 năm, triều Nguyễn lần lượt kí bốn hiệp ước với Pháp",
  ]);
  addCards(s, 4);
  addTimeline(s, 4);
  s.addNotes("1:15. Lược đồ thu về toàn cảnh, đủ bốn thẻ hiệp ước ở góc phải. Chỉ lướt nhanh hai hiệp ước, để dành phần ý nghĩa cho slide sau.");
}

// =====================================================================
// 11. KẾT QUẢ
// =====================================================================
pres.addSection({ title: "Kết quả" });
{
  const s = contentSlide("Kết quả", "KẾT QUẢ", "Bốn hiệp ước, một kết cục", 0);
  addMap(s, { x: 7.6, y: -0.5, w: 8.6 * ASPECT, h: 8.6 }, { red: true, transparency: 55 });
  addHeader(s);
  addCards(s, 4, true);
  addPoints(s, [
    "Hiệp ước Pa-tơ-nốt đánh dấu sự đầu hàng hoàn toàn của triều Nguyễn trước thực dân Pháp",
    "Kết thúc giai đoạn tồn tại của Nhà nước phong kiến Việt Nam độc lập",
  ], { y: 4.1, w: 11.5, step: 1.0, size: 22 });
  addTimeline(s, 4);
  s.addNotes("1:45. Slide Morph chính: bốn thẻ hiệp ước bay ra giữa, lược đồ chuyển sang màu đỏ. Dừng 2–3 giây cho hiệu ứng chạy xong rồi mới nói. Đọc chậm hai ý kết quả, đây là phần giáo viên yêu cầu.");
}

// =====================================================================
// 12. NHẬN XÉT
// =====================================================================
{
  const s = contentSlide("Kết quả", "NHẬN XÉT", "Hai thái độ trái ngược", 0);
  addHeader(s);
  const cols = [
    { x: 0.6, head: "NHÂN DÂN", big: "Anh dũng kháng chiến", color: GOLD, img: "Nghĩa quân chống Pháp",
      items: ["Chiến đấu ở Đà Nẵng, Gia Định, Bắc Kì", "Nổi dậy khắp Nam Kì", "Hai lần chiến thắng Cầu Giấy"] },
    { x: 6.83, head: "TRIỀU ĐÌNH NGUYỄN", big: "Từng bước nhượng bộ", color: RED, img: "Triều đình kí hiệp ước",
      items: ["Nhượng bộ khi phong trào đang mạnh", "Kí liên tiếp bốn hiệp ước", "Cuối cùng đầu hàng hoàn toàn"] },
  ];
  cols.forEach((c, i) => {
    s.addShape(pres.ShapeType.roundRect, { x: c.x, y: 1.9, w: 5.9, h: 4.1, rectRadius: 0.12,
      fill: { color: LAND }, line: { color: LAND, width: 0 }, objectName: "cot_" + (i + 1) });
    s.addText(c.head, { x: c.x + 0.35, y: 2.15, w: 3.3, h: 0.3, margin: 0, isTextBox: true,
      fontSize: 12, bold: true, color: c.color, charSpacing: 3, objectName: "cot_nhan_" + (i + 1) });
    s.addText(c.big, { x: c.x + 0.35, y: 2.55, w: 3.7, h: 0.9, margin: 0, isTextBox: true,
      fontFace: HEAD, fontSize: 24, bold: true, color: CREAM, valign: "top", objectName: "cot_lon_" + (i + 1) });
    s.addText(c.items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < c.items.length - 1 } })),
      { x: c.x + 0.35, y: 3.75, w: 5.2, h: 2.0, margin: 0, isTextBox: true, fontSize: 18, color: CREAM,
        paraSpaceAfter: 12, valign: "top", objectName: "cot_y_" + (i + 1) });
    addFrame(s, c.x + 4.1, 2.15, 1.5, 1.4, "ẢNH", c.img);
    s.addShape(pres.ShapeType.ellipse, { x: c.x + 0.35, y: 1.75, w: 0.3, h: 0.3,
      fill: { color: c.color }, line: { color: CREAM, width: 1.5 }, objectName: "cot_cham_" + (i + 1) });
  });
  addTimeline(s, 4);
  s.addNotes("1:00. So sánh hai cột: nhân dân đánh đến cùng, triều đình nhượng bộ. Slide này không nằm trong yêu cầu ghi trên bảng; nếu tập thử bị quá 17 phút thì bỏ slide này trước.");
}

// =====================================================================
// 13. TỔNG KẾT
// =====================================================================
pres.addSection({ title: "Tổng kết" });
{
  const s = contentSlide("Tổng kết", "TỔNG KẾT", "Nhìn lại 1858 – 1884", 0);
  addHeader(s);
  const X0 = 1.5, X1 = 11.83, Y = 3.2;
  const bx = (i) => X0 + (i * (X1 - X0)) / 4;
  const events = ["Pháp tấn công Đà Nẵng", "Hiệp ước Nhâm Tuất", "Hiệp ước Giáp Tuất", "Hiệp ước Hác-măng", "Hiệp ước Pa-tơ-nốt"];
  s.addShape(pres.ShapeType.line, { x: X0, y: Y, w: X1 - X0, h: 0,
    line: { color: MUTED, width: 2 }, objectName: "!!tl_duong" });
  YEARS.forEach((yr, i) => {
    s.addShape(pres.ShapeType.ellipse, { x: bx(i) - 0.1, y: Y - 0.1, w: 0.2, h: 0.2,
      fill: { color: i === 0 ? RED : CREAM }, line: { color: BG, width: 1 }, objectName: "moc_" + yr });
    s.addText(yr, { x: bx(i) - 1.1, y: Y - 0.95, w: 2.2, h: 0.6, margin: 0, isTextBox: true,
      fontFace: HEAD, fontSize: 30, bold: true, color: GOLD, align: "center", objectName: "!!tl_" + yr });
    s.addText(events[i], { x: bx(i) - 1.15, y: Y + 0.3, w: 2.3, h: 0.7, margin: 0, isTextBox: true,
      fontSize: 15, color: CREAM, align: "center", valign: "top", objectName: "sukien_" + yr });
  });
  s.addShape(pres.ShapeType.ellipse, { x: bx(4) - 0.2, y: Y - 0.2, w: 0.4, h: 0.4,
    fill: { color: GOLD }, line: { color: CREAM, width: 2 }, objectName: "!!tl_cham" });
  s.addText([
    { text: "CÂU HỎI CHO CẢ LỚP", options: { fontSize: 12, bold: true, color: GOLD, charSpacing: 3, breakLine: true } },
    { text: "Vì sao nhân dân chiến đấu anh dũng mà Việt Nam vẫn rơi vào tay thực dân Pháp?",
      options: { fontFace: HEAD, fontSize: 24, italic: true, color: CREAM } },
  ], { x: 0.6, y: 4.9, w: 12.13, h: 1.7, shape: pres.ShapeType.roundRect, rectRadius: 0.12,
    fill: { color: LAND }, line: { color: LAND, width: 0 }, margin: [10, 28, 10, 28], valign: "middle",
    paraSpaceAfter: 6, objectName: "cau_hoi" });
  s.addNotes("0:45. Thanh thời gian phóng to ra giữa: nhắc lại năm mốc trong 20 giây, rồi đặt câu hỏi cho lớp và cảm ơn.");
}

// ---------- Ghi file, áp theme, thêm chuyển cảnh Morph ----------
const MORPH =
  '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
  '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">' +
  '<p:transition spd="slow" p14:dur="1800" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">' +
  '<p159:morph option="byObject"/></p:transition></mc:Choice>' +
  '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>';

(async () => {
  await pres.writeFile({ fileName: OUT });
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
    xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + MORPH);
    zip.file(name, xml);
    n++;
  }
  const clean = new JSZip(); // chỉ chép file, bỏ các entry thư mục
  for (const [name, f] of Object.entries(zip.files)) if (!f.dir) clean.file(name, await f.async("nodebuffer"), { createFolders: false });
  fs.writeFileSync(OUT, await clean.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("OK:", OUT, "- Morph trên", n, "slide");
})();
