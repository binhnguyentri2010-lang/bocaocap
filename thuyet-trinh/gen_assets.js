// Sinh hoạ tiết cho bài thuyết trình: chữ vàng, huy hiệu, thẻ, lược đồ.
// Chạy: FONTS=<thư mục chứa font .ttf> node gen_assets.js
// Cần: playwright, react, react-dom, react-icons, topojson-client, world-atlas.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const gi = require("react-icons/gi");
const topo = require("topojson-client");

const OUT = path.join(__dirname, "assets");
const FONTS = process.env.FONTS;
// nhúng font dạng data URL (trang about:blank không đọc được file://)
const font = (f) => "data:font/ttf;base64," + fs.readFileSync(path.join(FONTS, f)).toString("base64");
const b64 = (f) => fs.readFileSync(path.join(OUT, f)).toString("base64");

const CSS = `
@font-face{font-family:Script;src:url(${font("f1.ttf")})}
@font-face{font-family:Caps;font-weight:600;src:url(${font("f2.ttf")})}
@font-face{font-family:Caps;font-weight:700;src:url(${font("f3.ttf")})}
@font-face{font-family:Serif;font-weight:500;src:url(${font("f4.ttf")})}
@font-face{font-family:Serif;font-weight:700;src:url(${font("f5.ttf")})}
@font-face{font-family:Serif;font-style:italic;font-weight:500;src:url(${font("f6.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
#a{display:inline-block;padding:24px}
.g{-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap;display:inline-block;padding:.42em .1em .16em}
.caps{font-family:Caps;font-weight:700;letter-spacing:.05em;line-height:1.15;
  background-image:linear-gradient(180deg,#F1D488 0%,#D2A04A 45%,#9C6A22 100%);filter:drop-shadow(0 3px 3px rgba(80,50,10,.28))}
.capsL{font-family:Caps;font-weight:700;letter-spacing:.07em;line-height:1.15;
  background-image:linear-gradient(180deg,#FBEBB8 0%,#E6BD68 60%,#C99A44 100%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
.head{font-family:Caps;font-weight:700;letter-spacing:.005em;line-height:1.2;
  background-image:linear-gradient(180deg,#8A5A14 0%,#6B430E 50%,#4A2C07 100%);filter:drop-shadow(0 2px 2px rgba(80,50,10,.15))}
.headL{font-family:Caps;font-weight:700;letter-spacing:.005em;line-height:1.2;
  background-image:linear-gradient(180deg,#FFF1C4 0%,#EBC676 70%,#D3A650 100%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.script{font-family:Script;line-height:1.25;padding:.2em .25em .3em;
  background-image:linear-gradient(180deg,#C99640 0%,#9A6A24 55%,#6E4614 100%);filter:drop-shadow(0 2px 2px rgba(80,50,10,.22))}
.scriptL{font-family:Script;line-height:1.25;padding:.2em .25em .3em;
  background-image:linear-gradient(180deg,#FFF1C4 0%,#EBC676 70%,#D3A650 100%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
`;

const icon = (name, size, fill) => {
  const svg = renderToStaticMarkup(React.createElement(gi[name], { size }));
  return svg.replace("<svg ", `<svg style="display:block" `).replace(/fill="currentColor"/, `fill="${fill}"`);
};
const DEFS = `<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="sepia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B98A3E"/><stop offset=".55" stop-color="#8A5E24"/><stop offset="1" stop-color="#5C3A12"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3D88E"/><stop offset=".5" stop-color="#D1A04A"/><stop offset="1" stop-color="#9A6A22"/></linearGradient>
</defs></svg>`;

// ---------- danh sách hoạ tiết ----------
const items = [];
const text = (name, t, cls, px) => items.push({ name, html: `<span class="g ${cls}" style="font-size:${px}px">${t}</span>` });

text("t_cover", "1858 – 1884", "caps", 300);
text("s_cover", "Kháng chiến chống Pháp", "script", 150);
text("t_mucluc", "MỤC LỤC", "caps", 150);
["01", "02", "03", "04"].forEach((n) => text("n" + n, n, "caps", 150));
[["01", "BỐI CẢNH", "Việt Nam giữa thế kỉ XIX"], ["02", "DIỄN BIẾN", "Từ Đà Nẵng đến Bắc Kì"],
 ["03", "KẾT QUẢ", "Bốn hiệp ước, một kết cục"]].forEach(([n, a, b]) => {
  text("d" + n + "_so", n, "capsL", 220);
  text("d" + n + "_ten", a, "capsL", 130);
  text("d" + n + "_phu", b, "scriptL", 130);
});
Object.entries({
  s_thegioi: "Thế giới", s_vietnam: "Việt Nam", s_luocdo: "Ba mặt trận", s_danang: "Đà Nẵng", s_giadinh: "Gia Định",
  s_namki: "Nam Kì nổi dậy", s_nhamtuat: "Nhâm Tuất", s_caugiay1: "Cầu Giấy lần 1", s_caugiay2: "Cầu Giấy lần 2",
  s_ketcuc: "Một kết cục", s_thaido: "Hai thái độ", s_nhinlai: "Nhìn lại", s_camon: "thầy cô và các bạn đã lắng nghe",
}).forEach(([k, v]) => text(k, v, "script", 170));
text("s_hue", "Kinh đô Huế", "scriptL", 170);
// tiêu đề đậm, dễ đọc từ xa
Object.entries({
  h_thegioi: "Thế giới giữa thế kỉ XIX", h_vietnam: "Việt Nam trước năm 1858", h_luocdo: "Ba mặt trận kháng chiến",
  h_danang: "Pháp tấn công Đà Nẵng", h_giadinh: "Pháp đánh chiếm Gia Định", h_namki: "Nhân dân Nam Kì nổi dậy",
  h_nhamtuat: "Hiệp ước Nhâm Tuất 1862", h_caugiay1: "Chiến thắng Cầu Giấy lần 1", h_caugiay2: "Chiến thắng Cầu Giấy lần 2",
  h_ketcuc: "Bốn hiệp ước, một kết cục", h_thaido: "Hai thái độ trái ngược", h_nguon: "Nguồn ảnh",
  h_phim1: "Từ Đà Nẵng vào Gia Định", h_phim2: "Bắc Kì và hai trận Cầu Giấy",
}).forEach(([k, v]) => text(k, v, "head", 120));
text("h_hue", "Hai hiệp ước cuối cùng", "headL", 120);
text("t_camon", "CẢM ƠN", "caps", 260);
[["st_1883", "1883"], ["st_1884", "1884"], ["st_4", "4"]].forEach(([k, v]) => text(k, v, "capsL", 170));
["1858", "1862", "1874", "1883", "1884"].forEach((y) => text("y" + y, y, "caps", 110));
// tiêu đề nghệ thuật slide Tổng kết: chữ thư pháp + năm vàng ánh kim
items.push({ name: "h_nhinlai", html: `<div style="display:flex;align-items:center;white-space:nowrap">
  <span class="g script" style="font-size:190px">Nhìn lại</span>
  <span class="g caps" style="font-size:130px;margin-left:10px">1858 – 1884</span></div>` });

// huy hiệu tròn: nền giấy, viền vàng kép, biểu tượng nâu
const medal = (name, ic) => items.push({ name, html: `<div style="width:420px;height:420px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#FFF9EA 0%,#F4E6C4 55%,#E2CB9A 100%);
  box-shadow:0 0 0 7px #C89A44,0 0 0 11px #F7E7B4,0 0 0 16px #B4832F,0 10px 18px 14px rgba(70,45,15,.28);
  display:flex;align-items:center;justify-content:center;margin:34px">${icon(ic, 250, "url(#sepia)")}</div>` });
Object.entries({
  m_thegioi: "GiEarthAsiaOceania", m_chien: "GiCrossedSabres", m_hiepuoc: "GiScrollQuill", m_nhinlai: "GiPositionMarker",
  m_vua: "GiImperialCrown", m_dongcua: "GiLockedFortress", m_dao: "GiChurch",
  m_co: "GiFlyingFlag", m_dottau: "GiShipWreck", m_sen: "GiLotus", m_but: "GiQuillInk",
  m_dan: "GiRallyTheTroops", m_trieudinh: "GiThroneKing",
  m_tau: "GiGalleon", m_phao: "GiCannon", m_thanh: "GiMilitaryFort", m_dau: "GiWaxSeal", m_kiem: "GiCrossedSwords",
}).forEach(([k, v]) => medal(k, v));

// hình minh hoạ lớn (thay cho ảnh cắt nền): biểu tượng nâu vàng, bóng mờ
const cut = (name, ic, px = 760) => items.push({ name, html: `<div style="padding:50px;
  filter:drop-shadow(0 14px 16px rgba(80,50,15,.30))">${icon(ic, px, "url(#sepia)")}</div>` });
cut("c_tau", "GiGalleon"); cut("c_thanh", "GiMilitaryFort"); cut("c_cuon", "GiScrollUnfurled"); cut("c_phao", "GiCannon");

// thẻ kiểu polaroid: huy hiệu + tên + chú thích
const card = (name, ic, title, sub) => items.push({ name, html: `<div style="width:434px;height:500px;background:#FDFAF2;
  box-shadow:0 8px 16px rgba(60,40,15,.35);padding:22px 22px 0;margin:26px;text-align:center">
  <div style="height:300px;background:radial-gradient(circle at 40% 30%,#F8ECCB,#E3CC9B);display:flex;align-items:center;justify-content:center;
    box-shadow:inset 0 0 0 2px #C89A44">${icon(ic, 210, "url(#sepia)")}</div>
  <div style="font-family:Caps;font-weight:700;font-size:${title.length > 9 ? 40 : 62}px;color:#8A5A1E;margin-top:${title.length > 9 ? 28 : 16}px;letter-spacing:.02em">${title}</div>
  <div style="font-family:Serif;font-weight:500;font-style:italic;font-size:36px;color:#5A3E22;margin-top:2px">${sub}</div></div>` });
card("the_1862", "GiWaxSeal", "1862", "Nhâm Tuất");
card("the_1874", "GiWaxSeal", "1874", "Giáp Tuất");
card("the_1883", "GiWaxSeal", "1883", "Hác-măng");
card("the_1884", "GiWaxSeal", "1884", "Pa-tơ-nốt");

// ---------- lược đồ ----------
const L0 = 92, L1 = 124, TOP = 23.9, BOT = 6.6, COS = 0.961, MW = 4800, MH = 2700;
const K = MH / (TOP - BOT);
const P = ([lon, lat]) => [((lon - L0) * COS * K).toFixed(1), ((TOP - lat) * K).toFixed(1)];
function mapSvg(dark, cut) {
  const w10 = require("world-atlas/countries-10m.json");
  const w50 = require("world-atlas/countries-50m.json");
  const f10 = topo.feature(w10, w10.objects.countries).features;
  const f50 = topo.feature(w50, w50.objects.countries).features;
  const d = (f) => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let s = "";
    for (const poly of polys) for (const ring of poly) {
      if (!ring.some(([x, y]) => x > L0 - 12 && x < L1 + 12 && y > BOT - 10 && y < TOP + 10)) continue;
      s += "M" + ring.map((p) => P(p).join(",")).join("L") + "Z";
    }
    return s;
  };
  const vn = f10.find((f) => f.id === "704");
  const others = f50.filter((f) => f.id !== "704").map(d).join("");
  const c = dark
    ? { sea: "#22140B", sea2: "#2E1C10", land: "#36230F", ls: "#4A3218", vn: "#7A5524", vs: "#E6BD68", lab: "#6B5230", isl: "#C99A44" }
    : { sea: "#F6EEDC", sea2: "#EFE2C6", land: "#EBDDBE", ls: "#D6C296", vn: "#DDB572", vs: "#8A5A1E", lab: "#BBA376", isl: "#8A5A1E" };
  const lab = (lon, lat, t, size, sp = 0.3, it = true) => {
    const [x, y] = P([lon, lat]);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Serif" font-weight="500" ${it ? 'font-style="italic"' : ""} font-size="${size}" letter-spacing="${sp}em" fill="${c.lab}">${t}</text>`;
  };
  const isl = (lon, lat, n, t) => {
    const [x, y] = P([lon, lat]).map(Number);
    let s = "";
    for (let i = 0; i < n; i++) { const a = i * 2.4, r = 10 + i * 5; s += `<circle cx="${x + Math.cos(a) * r}" cy="${y + Math.sin(a) * r}" r="3.5" fill="${c.isl}"/>`; }
    return s + `<text x="${x}" y="${y + 78}" text-anchor="middle" font-family="Serif" font-style="italic" font-weight="500" font-size="32" fill="${c.isl}">${t}</text>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}" style="display:block">
  <defs><radialGradient id="sea" cx="55%" cy="50%" r="75%"><stop offset="0" stop-color="${c.sea}"/><stop offset="1" stop-color="${c.sea2}"/></radialGradient>
  <filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="${dark ? "#000" : "#6B4A1E"}" flood-opacity="${dark ? 0.6 : 0.35}"/></filter></defs>
  ${cut ? "" : `<rect width="100%" height="100%" fill="url(#sea)"/>
  <path d="${others}" fill="${c.land}" stroke="${c.ls}" stroke-width="2.5" stroke-linejoin="round"/>`}
  <path d="${d(vn)}" fill="${c.vn}" stroke="${c.vs}" stroke-width="3" stroke-linejoin="round" filter="url(#sh)"/>
  ${cut ? "" : lab(113.2, 13.6, "BIỂN ĐÔNG", 74, 0.5)}${cut ? "" : lab(107.6, 20.0, "Vịnh Bắc Bộ", 28, 0.1) + lab(102.6, 9.6, "Vịnh Thái Lan", 34, 0.15) +
    lab(110.5, 23.2, "TRUNG QUỐC", 56, 0.4, false) + lab(103.0, 18.9, "LÀO", 44, 0.4, false) + lab(104.6, 12.9, "CAM-PU-CHIA", 36, 0.25, false) +
    lab(100.3, 15.9, "THÁI LAN", 50, 0.4, false) + lab(96.0, 20.6, "MI-AN-MA", 50, 0.4, false)}
  ${isl(112, 16.5, 6, "Q.Đ. Hoàng Sa")}${isl(114, 10, 8, "Q.Đ. Trường Sa")}
  </svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2600, height: 1400 }, deviceScaleFactor: 1 });
  const sizes = {};
  for (const it of items) {
    await page.setContent(`<style>${CSS}</style>${DEFS}<div id="a">${it.html}</div>`);
    await page.evaluate(() => document.fonts.ready);
    const el = await page.$("#a");
    await el.screenshot({ path: path.join(OUT, it.name + ".png"), omitBackground: true });
    const bb = await el.boundingBox();
    sizes[it.name] = [Math.round(bb.width), Math.round(bb.height)];
  }
  // lược đồ sáng (4800x2700) và tối (1920x1080)
  const mp = await browser.newPage({ viewport: { width: MW, height: MH }, deviceScaleFactor: 1 });
  await mp.setContent(`<style>${CSS}</style>${mapSvg(false)}`);
  await mp.evaluate(() => document.fonts.ready);
  await mp.screenshot({ path: path.join(OUT, "map.jpg"), type: "jpeg", quality: 90 });
  await mp.setContent(`<style>${CSS}</style>${mapSvg(true)}`);
  await mp.evaluate(() => document.fonts.ready);
  // cắt vùng miền Trung (quanh Huế) cho nền tối 16:9
  await mp.screenshot({ path: path.join(OUT, "map_dark.jpg"), type: "jpeg", quality: 88, clip: { x: 900, y: 420, width: 3000, height: 1687 } });
  // riêng hình Việt Nam (nền trong suốt) cho bìa
  await mp.setContent(`<style>${CSS}</style>${mapSvg(false, true)}`);
  await mp.evaluate(() => document.fonts.ready);
  await mp.screenshot({ path: path.join(OUT, "vn_cut.png"), omitBackground: true, clip: { x: 1480, y: 30, width: 2080, height: 2440 } });
  await browser.close();
  // kích thước ảnh để build.js giữ đúng tỉ lệ
  for (const f of fs.readdirSync(OUT)) {
    if (!/\.(png|jpe?g)$/.test(f) || sizes[f.replace(/\.\w+$/, "")]) continue;
    const buf = fs.readFileSync(path.join(OUT, f));
    if (f.endsWith(".png")) sizes[f.replace(/\.\w+$/, "")] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  fs.writeFileSync(path.join(OUT, "sizes.json"), JSON.stringify(sizes, null, 1));
  console.log("OK", items.length, "hoạ tiết + 2 lược đồ");
})();
