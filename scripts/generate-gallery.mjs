/**
 * 生成画廊占位图。
 * 用法: node scripts/generate-gallery.mjs
 *
 * 这些是占位素材，等你把真作品放进 public/gallery/ 之后，
 * 改掉 src/pages/gallery.astro 里的 GALLERY 数组即可（那里有注释说明）。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'gallery');

/** 固定数据，保证每次生成结果一致 */
const WORKS = [
  { file: 'summer-festival.svg', title: '夏日祭典', w: 800, h: 1100, from: '#ff5c8a', to: '#ffb26b' },
  { file: 'starfall.svg', title: '星空下的约定', w: 1200, h: 800, from: '#6c5ce7', to: '#00b8d9' },
  { file: 'rainy-window.svg', title: '雨天的窗', w: 900, h: 900, from: '#2d3561', to: '#6c5ce7' },
  { file: 'sakura-road.svg', title: '樱花坂道', w: 800, h: 1200, from: '#ff7eb3', to: '#ffd6e8' },
  { file: 'mecha-dock.svg', title: '机库黄昏', w: 1300, h: 750, from: '#f59e0b', to: '#7c2d12' },
  { file: 'cat-cafe.svg', title: '猫与咖啡', w: 1000, h: 1000, from: '#a78bfa', to: '#fbcfe8' },
  { file: 'deep-sea.svg', title: '深海回声', w: 1200, h: 900, from: '#0ea5e9', to: '#0f172a' },
  { file: 'lantern-night.svg', title: '灯笼夜行', w: 850, h: 1150, from: '#ef4444', to: '#fbbf24' },
  { file: 'train-window.svg', title: '车窗外的雪', w: 1250, h: 800, from: '#93c5fd', to: '#1e3a8a' },
  { file: 'shrine-steps.svg', title: '神社长阶', w: 900, h: 1200, from: '#22c55e', to: '#065f46' },
  { file: 'city-pop.svg', title: 'City Pop 夜', w: 1200, h: 800, from: '#ec4899', to: '#4c1d95' },
  { file: 'morning-class.svg', title: '早自习', w: 1000, h: 950, from: '#facc15', to: '#fb923c' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg({ title, w, h, from, to }) {
  const base = Math.min(w, h);
  const cx = w * 0.34;
  const cy = h * 0.38;
  const r = base * 0.19;
  const fontSize = Math.round(base * 0.075);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity="0.24"/>
  <circle cx="${w * 0.74}" cy="${h * 0.72}" r="${r * 0.62}" fill="#fff" fill-opacity="0.14"/>
  <rect y="${h * 0.58}" width="${w}" height="${h * 0.42}" fill="url(#v)"/>
  <text x="${w / 2}" y="${h * 0.9}" text-anchor="middle" fill="#fff" fill-opacity="0.95"
        font-family="ui-sans-serif, system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif"
        font-size="${fontSize}" font-weight="600">${esc(title)}</text>
</svg>
`;
}

await mkdir(outDir, { recursive: true });

const manifest = [];
for (const work of WORKS) {
  const target = join(outDir, work.file);
  await writeFile(target, svg(work), 'utf8');
  manifest.push({ src: `/gallery/${work.file}`, title: work.title });
  console.log(`generated ${work.file}  ${work.w}x${work.h}`);
}

console.log(`\n共 ${manifest.length} 张，输出到 public/gallery/`);
