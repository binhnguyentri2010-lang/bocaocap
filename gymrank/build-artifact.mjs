// Dựng bản đăng lên Claude Artifact từ index.html + rank.js thành MỘT file.
// Chạy từ thư mục gốc repo: node gymrank/build-artifact.mjs <file-đích.html>
// Artifact tự bọc trang trong khung <head>/<body> và không tải được file bên cạnh,
// nên ở đây bỏ khung, bỏ các thẻ meta/icon chỉ dành cho bản GitHub Pages, nhúng rank.js vào script và ranks.webp dạng data URI.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const src = readFileSync(new URL('index.html', dir), 'utf8');
const rank = readFileSync(new URL('rank.js', dir), 'utf8').replace(/^export /gm, '');
const spr = `url(data:image/webp;base64,${readFileSync(new URL('ranks.webp', dir)).toString('base64')})`;
const head = src.replace('url(ranks.webp)', () => spr).match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/^\s*<(meta (charset|name="(viewport|apple|mobile|theme))|link rel="apple-touch-icon"|title>).*\n/gm, '');
const body = src.match(/<body>([\s\S]*)<\/body>/)[1].replace(/^\s*import \{[^}]*\} from '\.\/rank\.js';\n/m, () => rank);
if (body.includes("from './rank.js'") || /^export /m.test(body)) throw new Error('rank.js chưa được nhúng hết');
if (!head.includes('data:image/webp')) throw new Error('ranks.webp chưa được nhúng');

writeFileSync(process.argv[2], `<title>GymRank</title>\n<meta name="claude:viewport-fit-sides" content="cover" />\n${head.trim()}\n${body.trim()}\n`);
