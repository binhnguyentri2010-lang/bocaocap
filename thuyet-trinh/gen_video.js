// Dựng 2 đoạn phim hoạt hoạ lược đồ (MP4, 1280x720, không tiếng) từ assets/map.jpg.
// Chạy: FONTS=<thư mục font> FRAMES=<thư mục tạm> node gen_video.js   (cần playwright và ffmpeg)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const OUT = path.join(__dirname, "assets");
const FONTS = process.env.FONTS, TMP = process.env.FRAMES;
const f64 = (f) => "data:font/ttf;base64," + fs.readFileSync(path.join(FONTS, f)).toString("base64");
const MAP = "data:image/jpeg;base64," + fs.readFileSync(path.join(OUT, "map.jpg")).toString("base64");
const FPS = 24;

const VIDEOS = {
  phim1_danang_giadinh: {
    dur: 18,
    title: ["1858 – 1859", "Từ Đà Nẵng vào Gia Định"],
    cam: [[0, 110.2, 14.6, 0.5], [2, 110.2, 14.6, 0.5], [6, 108.9, 15.6, 0.95], [9, 108.9, 15.6, 0.95], [13.5, 107.6, 11.2, 0.9], [18, 107.4, 11.0, 0.95]],
    years: [[0, "1858"], [9, "1859"]],
    arrows: [
      { t0: 2, t1: 5.5, pts: [[114.2, 12.2], [111.2, 14.6], [108.32, 16.1]] },
      { t0: 9.3, t1: 13.5, pts: [[108.7, 16.0], [110.0, 14.0], [109.9, 11.6], [108.3, 10.0], [106.85, 10.55]] },
    ],
    pins: [{ t: 5.2, lon: 108.22, lat: 16.07, label: "Đà Nẵng" }, { t: 13.2, lon: 106.7, lat: 10.78, label: "Gia Định" }],
    bursts: [{ t0: 5.5, t1: 9, lon: 108.22, lat: 16.07 }, { t0: 13.5, t1: 18, lon: 106.7, lat: 10.78 }],
    caps: [[2.2, 9, "Liên quân Pháp – Tây Ban Nha tấn công Đà Nẵng"], [9.3, 18, "Pháp chuyển hướng vào Nam, đánh chiếm Gia Định"]],
  },
  phim2_backi_caugiay: {
    dur: 18,
    title: ["1873 – 1883", "Bắc Kì và hai trận Cầu Giấy"],
    cam: [[0, 106.9, 20.4, 1.1], [2, 106.9, 20.4, 1.1], [6, 106.35, 20.75, 1.9], [18, 106.3, 20.8, 2.0]],
    years: [[0, "1873"], [9.6, "1874"], [11.5, "1882"], [14.2, "1883"]],
    arrows: [
      { t0: 2, t1: 5.5, pts: [[108.3, 19.6], [107.2, 20.45], [106.6, 20.8], [105.95, 21.0]] },
      { t0: 11.6, t1: 14, pts: [[108.3, 19.9], [107.3, 20.6], [106.6, 20.95], [105.95, 21.07]], dash: true },
    ],
    pins: [{ t: 4.8, lon: 105.85, lat: 21.03, label: "Hà Nội" }],
    bursts: [{ t0: 6, t1: 9.4, lon: 105.8, lat: 21.03 }, { t0: 14.2, t1: 18, lon: 105.8, lat: 21.03 }],
    caps: [[2.2, 6, "Pháp đánh ra Bắc Kì lần thứ nhất"], [6, 9.6, "Chiến thắng Cầu Giấy lần 1"],
      [9.6, 11.5, "Triều đình kí Hiệp ước Giáp Tuất"], [11.6, 14.2, "Pháp đánh Bắc Kì lần thứ hai"], [14.2, 18, "Chiến thắng Cầu Giấy lần 2"]],
  },
};

const html = (v) => `<!doctype html><style>
@font-face{font-family:Script;src:url(${f64("f1.ttf")})}
@font-face{font-family:Caps;font-weight:700;src:url(${f64("f3.ttf")})}
@font-face{font-family:Serif;font-weight:700;src:url(${f64("f5.ttf")})}
@font-face{font-family:Serif;font-style:italic;font-weight:500;src:url(${f64("f6.ttf")})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:720px;overflow:hidden;background:#F1E6CC;position:relative}
#world{position:absolute;left:0;top:0;width:4800px;height:2700px;transform-origin:0 0}
#world img{position:absolute;left:0;top:0;width:4800px;height:2700px}
#world svg{position:absolute;left:0;top:0}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(60,35,10,.38) 100%)}
#year{position:absolute;left:44px;top:26px;font-family:Caps;font-weight:700;font-size:92px;letter-spacing:.03em;
  background:linear-gradient(180deg,#E9C36E,#A36F24);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 3px 3px rgba(70,40,10,.35))}
#cap{position:absolute;left:0;right:0;bottom:0;height:104px;background:linear-gradient(180deg,rgba(58,22,18,.0),rgba(58,22,18,.92) 38%);
  display:flex;align-items:flex-end;justify-content:center;padding-bottom:20px;font-family:Serif;font-weight:700;font-size:38px;color:#FBEBC0;text-shadow:0 2px 4px rgba(0,0,0,.5)}
#note{position:absolute;right:20px;top:18px;font-family:Serif;font-style:italic;font-size:20px;color:#7A5A2C}
#title{position:absolute;inset:0;background:rgba(48,20,16,.9);display:flex;flex-direction:column;align-items:center;justify-content:center}
#title .a{font-family:Caps;font-weight:700;font-size:120px;letter-spacing:.04em;background:linear-gradient(180deg,#FBEBB8,#D3A650);-webkit-background-clip:text;color:transparent}
#title .b{font-family:Script;font-size:76px;color:#F3DCA0;margin-top:6px}
.pin{position:absolute;font-family:Serif;font-weight:700;font-size:30px;color:#4E3418;white-space:nowrap}
.pin i{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;background:#B4352B;border:4px solid #FFF2CC;box-shadow:0 2px 5px rgba(0,0,0,.4)}
.pin span{position:absolute;left:24px;top:-22px;background:rgba(246,239,226,.9);padding:2px 12px;border-radius:4px}
.burst{position:absolute;border-radius:50%;border:5px solid #C8372D}
</style><body><div id="world"><img src="${MAP}"><svg id="svg" width="4800" height="2700"></svg></div>
<div id="pins"></div><div id="vig"></div><div id="year"></div><div id="note">Sơ đồ minh hoạ</div><div id="cap"></div>
<div id="title"><div class="a">${v.title[0]}</div><div class="b">${v.title[1]}</div></div>
<script>
const V=${JSON.stringify(v)};
const K=2700/(23.9-6.6), P=(lon,lat)=>[(lon-92)*0.961*K,(23.9-lat)*K];
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x), lerp=(a,b,x)=>a+(b-a)*x;
const svg=document.getElementById('svg'), NS='http://www.w3.org/2000/svg';
// đường mũi tên: nội suy trơn qua các điểm, lấy mẫu sẵn để vẽ dần
const paths=V.arrows.map(a=>{const p=a.pts.map(q=>P(q[0],q[1]));const out=[];
  for(let i=0;i<p.length-1;i++){const p0=p[Math.max(0,i-1)],p1=p[i],p2=p[i+1],p3=p[Math.min(p.length-1,i+2)];
    for(let k=0;k<40;k++){const t=k/40,t2=t*t,t3=t2*t;out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)));}}
  out.push(p[p.length-1]);
  const line=document.createElementNS(NS,'path');line.setAttribute('fill','none');line.setAttribute('stroke','#B4352B');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');
  const head=document.createElementNS(NS,'path');head.setAttribute('fill','#B4352B');svg.append(line,head);return {a,out,line,head};});
function render(t){
  // máy quay
  const c=V.cam;let i=0;while(i<c.length-2&&t>=c[i+1][0])i++;
  const x=ease((t-c[i][0])/(c[i+1][0]-c[i][0]));
  const lon=lerp(c[i][1],c[i+1][1],x),lat=lerp(c[i][2],c[i+1][2],x),s=lerp(c[i][3],c[i+1][3],x);
  const [cx,cy]=P(lon,lat);const tx=640-cx*s,ty=360-cy*s;
  document.getElementById('world').style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';
  const S=(lo,la)=>{const [px,py]=P(lo,la);return [px*s+tx,py*s+ty];};
  // mũi tên
  for(const p of paths){const f=ease((t-p.a.t0)/(p.a.t1-p.a.t0));const n=Math.max(1,Math.round(f*(p.out.length-1)));
    if(t<p.a.t0){p.line.setAttribute('d','');p.head.setAttribute('d','');continue;}
    p.line.setAttribute('d','M'+p.out.slice(0,n+1).map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join('L'));
    p.line.setAttribute('stroke-width',9/s);p.line.setAttribute('stroke-dasharray',p.a.dash?(22/s)+' '+(16/s):'');
    const a=p.out[n],b=p.out[Math.max(0,n-3)],ang=Math.atan2(a[1]-b[1],a[0]-b[0]),L=30/s,W=15/s;
    const pt=(dx,dy)=>(a[0]+dx*Math.cos(ang)-dy*Math.sin(ang)).toFixed(1)+','+(a[1]+dx*Math.sin(ang)+dy*Math.cos(ang)).toFixed(1);
    p.head.setAttribute('d','M'+pt(L*0.9,0)+'L'+pt(-L*0.3,W)+'L'+pt(-L*0.3,-W)+'Z');}
  // chấm địa danh và vòng lan toả
  let h='';
  for(const b of V.bursts){if(t<b.t0||t>b.t1)continue;const [bx,by]=S(b.lon,b.lat);
    for(let k=0;k<2;k++){const ph=(((t-b.t0)*0.8+k*0.5)%1),r=10+ph*70;h+='<div class="burst" style="left:'+(bx-r)+'px;top:'+(by-r)+'px;width:'+2*r+'px;height:'+2*r+'px;opacity:'+(1-ph).toFixed(2)+'"></div>';}}
  for(const p of V.pins){const o=ease((t-p.t)/0.5);if(o<=0)continue;const [px,py]=S(p.lon,p.lat);
    h+='<div class="pin" style="left:'+px+'px;top:'+py+'px;opacity:'+o+'"><i></i><span>'+p.label+'</span></div>';}
  document.getElementById('pins').innerHTML=h;
  // năm, phụ đề, bìa
  let y='';for(const q of V.years)if(t>=q[0])y=q[1];document.getElementById('year').textContent=y;
  let cap='',co=0;for(const q of V.caps)if(t>=q[0]&&t<q[1]){cap=q[2];co=Math.min(ease((t-q[0])/0.4),ease((q[1]-t)/0.3+0.2));}
  const ce=document.getElementById('cap');ce.textContent=cap;ce.style.opacity=cap?Math.max(co,0.0):0;
  document.getElementById('title').style.opacity=1-ease((t-1.3)/0.7);
}
</script>`;

(async () => {
  const browser = await chromium.launch();
  for (const [name, v] of Object.entries(VIDEOS)) {
    const dir = path.join(TMP, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.setContent(html(v));
    await page.evaluate(() => document.fonts.ready);
    const n = v.dur * FPS;
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => render(t), i / FPS);
      await page.screenshot({ path: path.join(dir, String(i).padStart(4, "0") + ".jpg"), type: "jpeg", quality: 92 });
    }
    await page.evaluate((t) => render(t), 7);
    await page.screenshot({ path: path.join(OUT, name + "_bia.jpg"), type: "jpeg", quality: 88 });
    await page.close();
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "%04d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-movflags", "+faststart", path.join(OUT, name + ".mp4")]);
    console.log("OK", name, n, "khung hình");
  }
  await browser.close();
})();
