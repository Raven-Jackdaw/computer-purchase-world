// 构建脚本：把 src/ 与 data/ 内联成单文件 HTML
// 用法：node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = (...s) => path.join(ROOT, ...s);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const exists = (f) => fs.existsSync(P(f));

const REQUIRED = [
  'id', 'name', 'brand', 'series', 'category', 'price', 'priceNote',
  'cpu', 'cpuBrand', 'gpu', 'gpuType', 'ram', 'ramGB', 'storage', 'storageGB',
  'weightKg', 'ports', 'os', 'pros', 'cons', 'status',
];

const problems = [];
const laptops = [];
const bandStats = [];

for (const b of [1, 2, 3, 4]) {
  const file = `data/band-${b}.json`;
  if (!exists(file)) { bandStats.push({ band: b, count: 0, missing: true }); continue; }
  try {
    const j = JSON.parse(read(file));
    const arr = Array.isArray(j.laptops) ? j.laptops : [];
    for (const l of arr) {
      l.band = b;
      laptops.push(l);
    }
    bandStats.push({ band: b, count: arr.length, collectedAt: j.collectedAt });
  } catch (e) {
    problems.push(`${file} 解析失败：${e.message}`);
    bandStats.push({ band: b, count: 0, error: e.message });
  }
}

// 种子数据兜底（仅开发用，绝不进入正式产物则打印警告）
let usingSeed = false;
if (laptops.length === 0) {
  usingSeed = true;
  const seed = JSON.parse(read('data/seed.json'));
  for (const l of seed.laptops) {
    const p = Number(l.price) || 0;
    l.band = p <= 4499 ? 1 : p <= 5999 ? 2 : p <= 7999 ? 3 : 4;
    laptops.push(l);
  }
}

// —— 校验与去重 ——
const seen = new Set();
const uniq = [];
for (const l of laptops) {
  if (!l.id) { problems.push('机型缺少 id'); continue; }
  if (seen.has(l.id)) { problems.push(`重复 id：${l.id}`); continue; }
  seen.add(l.id);
  for (const k of REQUIRED) {
    if (l[k] === undefined || l[k] === null || l[k] === '') problems.push(`${l.id} 缺少字段 ${k}`);
  }
  if (l.screen == null) problems.push(`${l.id} 缺少 screen`);
  if (l.price != null) {
    const expect = l.price <= 4499 ? 1 : l.price <= 5999 ? 2 : l.price <= 7999 ? 3 : 4;
    if (l.band !== expect) problems.push(`${l.id} 价格 ${l.price} 与价位段 band-${l.band} 不符（应为 band-${expect}）`);
  }
  uniq.push(l);
}

const knowledge = exists('data/knowledge.json')
  ? JSON.parse(read('data/knowledge.json'))
  : { specBaseline: [], pitfalls: [], timing: {}, glossary: [], sources: [] };

// —— 渠道报价（可选，按 data/channels/band-N.json 合并） ——
const channelIndex = new Map();
const channelStats = { files: 0, items: 0, offers: 0, jdSelf: 0, tmallFlag: 0, missingMachines: 0 };
for (const b of [1, 2, 3, 4]) {
  const f = `data/channels/band-${b}.json`;
  if (!exists(f)) continue;
  channelStats.files++;
  try {
    const j = JSON.parse(read(f));
    for (const item of j.items || []) {
      if (!item.laptopId) { problems.push(`${f}: 一个 item 缺 laptopId`); continue; }
      if (!seen.has(item.laptopId)) { problems.push(`${f}: laptopId 不存在 ${item.laptopId}`); continue; }
      channelStats.items++;
      const offers = (item.offers || []).filter((o) => o && Number(o.price) > 0);
      if (offers.length) {
        channelStats.offers += offers.length;
        channelIndex.set(item.laptopId, offers);
        for (const o of offers) {
          if (o.storeType === '京东自营') channelStats.jdSelf++;
          if (String(o.platform) === '天猫') channelStats.tmallFlag++;
          if (!o.evidenceUrl && !o.url) problems.push(`${f}: ${item.laptopId} 的报价缺链接`);
        }
      } else {
        channelStats.missingMachines++;
      }
    }
  } catch (e) {
    problems.push(`${f} 解析失败：${e.message}`);
  }
}
for (const l of uniq) {
  if (channelIndex.has(l.id)) l.offers = channelIndex.get(l.id);
}

// —— 渠道报价清洗与时间校验 ——
function minusMonths(ym, n) {
  const m = String(ym || '').match(/(\d{4})-(\d{2})/);
  if (!m) return null;
  let y = parseInt(m[1], 10), mo = parseInt(m[2], 10) - n;
  while (mo <= 0) { mo += 12; y -= 1; }
  return `${y}-${String(mo).padStart(2, '0')}`;
}
for (const l of uniq) {
  if (!Array.isArray(l.offers)) continue;
  const earliest = l.launchDate ? minusMonths(l.launchDate, 2) : null;
  const keep = [];
  for (const o of l.offers) {
    o.price = Math.round(Number(o.price));
    if (o.publishedAt && o.publishedAt < '2026-09-01') o.stale = true;
    if (earliest && o.publishedAt && o.publishedAt.slice(0, 7) < earliest) {
      o.suspect = true;
      problems.push(`${l.id}: 渠道活动 ${o.publishedAt} 早于上市时间 ${l.launchDate}，疑似匹配到旧款`);
    }
    if (o.price <= 0) { problems.push(`${l.id}: 渠道价异常 ${o.price}`); continue; }
    // 与参考价偏差过大 → 大概率是不同配置，剔除
    if (l.price && (o.price < l.price * 0.45 || o.price > l.price * 1.8)) {
      problems.push(`${l.id}: 渠道价 ${o.price} 与参考价 ${l.price} 偏差过大，已剔除`);
      continue;
    }
    keep.push(o);
  }
  l.offers = keep;
}

// 渠道 UI 开发用 mock（data/channels/_mock.json，正式构建前请删除该文件）
if (exists('data/channels/_mock.json')) {
  console.log('\n⚠️  使用 data/channels/_mock.json 渠道 mock 数据（正式产物请删除）');
  const mock = JSON.parse(read('data/channels/_mock.json'));
  for (const item of mock.items || []) {
    const target = uniq.find((x) => x.id === item.laptopId);
    if (target && item.offers && item.offers.length) target.offers = item.offers;
  }
}

const dataDate = (() => {
  const ds = bandStats.map((s) => s.collectedAt).filter(Boolean).sort();
  return ds[ds.length - 1] || '2026-11-17';
})();

const payload = {
  meta: { builtAt: new Date().toISOString(), dataDate, count: uniq.length, usingSeed, bandStats, channelStats },
  laptops: uniq,
  knowledge,
};

// —— 内联 ——
const html = read('src/index.html');
const styles = read('src/styles.css');
const js = [
  'src/avatar.js',
  'src/engine.js',
  'src/sprite.js',
  'src/banner.js',
  'src/app.js',
].map(read).join('\n\n/* ===================== */\n\n');

const json = JSON.stringify(payload).replace(/</g, '\\u003c');

const out = html
  .replace('<!--STYLES-->', () => styles)
  .replace('<!--DATA-->', () => `window.__DATA__ = ${json};`)
  .replace('<!--SCRIPTS-->', () => js);

fs.mkdirSync(P('dist'), { recursive: true });
const outFile = P('dist/电脑购买大世界.html');
fs.writeFileSync(outFile, out, 'utf8');

// —— 报告 ——
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('=== 构建完成 ===');
console.log('产物：', outFile);
console.log('体积：', kb(Buffer.byteLength(out)));
console.log('机型：', uniq.length, '台');
console.log('价位段：', bandStats.map((s) => `band-${s.band}:${s.count}${s.missing ? '(缺)' : ''}`).join('  '));
const st = {};
for (const l of uniq) st[l.status] = (st[l.status] || 0) + 1;
console.log('核实状态：', JSON.stringify(st));
if (usingSeed) console.log('\n⚠️  警告：当前使用 data/seed.json 种子数据（开发用），不是真实机型！');
if (problems.length) {
  console.log(`\n⚠️  问题 ${problems.length} 条：`);
  for (const p of problems.slice(0, 40)) console.log('  -', p);
  if (problems.length > 40) console.log(`  ... 其余 ${problems.length - 40} 条省略`);
} else {
  console.log('校验：通过（无问题）');
}
