// 引擎与数据自检：不需要浏览器
// 用法：node test/engine.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

let fails = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓', msg);
  else { console.log('  ✗', msg); fails++; }
};

const html = read('dist/电脑购买大世界.html');
const m = html.match(/window\.__DATA__ = (\{[\s\S]*?\});<\/script>/);
if (!m) { console.log('找不到 __DATA__'); process.exit(1); }
const data = JSON.parse(m[1].replace(/\\u003c/g, '<'));

const sandbox = { window: { __DATA__: data }, console, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(read('src/engine.js'), sandbox);
const W = sandbox.window.W;

console.log('\n== 数据完整性 ==');
const L = W.LAPTOPS;
ok(L.length >= 60, `机型数 ${L.length} ≥ 60`);
const ids = new Set();
let dup = 0;
for (const l of L) { if (ids.has(l.id)) dup++; ids.add(l.id); }
ok(dup === 0, `id 无重复（重复 ${dup}）`);
const REQUIRED = ['id', 'name', 'brand', 'category', 'price', 'cpu', 'gpu', 'gpuType', 'ram', 'ramGB', 'storage', 'storageGB', 'weightKg', 'ports', 'os', 'pros', 'cons', 'screen'];
const missing = [];
for (const l of L) for (const k of REQUIRED) if (l[k] === undefined || l[k] === null || l[k] === '') missing.push(`${l.id}.${k}`);
ok(missing.length === 0, `必填字段齐全（缺 ${missing.length}）${missing.slice(0, 6).join(', ')}`);

console.log('\n== 价位段归属 ==');
let bandBad = 0;
for (const l of L) {
  const expect = l.price <= 4499 ? 1 : l.price <= 5999 ? 2 : l.price <= 7999 ? 3 : 4;
  if (l.band !== expect) { bandBad++; console.log('    ×', l.id, l.price, 'band', l.band, 'expect', expect); }
}
ok(bandBad === 0, `价位段与价格一致（错 ${bandBad}）`);

console.log('\n== 六维评分范围 ==');
let nan = 0, range = 0;
for (const l of L) for (const d of W.DIMS) {
  const v = l.scores[d];
  if (typeof v !== 'number' || !isFinite(v)) { nan++; console.log('    NaN', l.id, d, v); }
  else if (v < 0 || v > 100) { range++; console.log('    越界', l.id, d, v); }
}
ok(nan === 0 && range === 0, `评分无 NaN / 越界（NaN ${nan}, 越界 ${range}）`);

console.log('\n== 对比度检查（分数分布不应挤成一条线）==');
for (const d of W.DIMS) {
  const vs = L.map((l) => l.scores[d]);
  const min = Math.min(...vs), max = Math.max(...vs);
  ok(max - min >= 25, `${d} 分差 ${(max - min).toFixed(1)} ≥ 25`);
}

console.log('\n== 榜单排序 ==');
for (const bar of ['overall', 'value', 'perf', 'battery']) {
  const list = W.rankList(bar, { band: 'all', category: 'all' });
  const key = bar === 'overall' ? (l) => l.fitBase : (l) => l.scores[bar];
  let bad = 0;
  for (let i = 1; i < list.length; i++) if (key(list[i]) > key(list[i - 1]) + 1e-9) bad++;
  ok(bad === 0, `${bar} 榜严格降序（乱序 ${bad}）`);
}
// 价位/品类过滤（UI 传字符串，回归测试）
const bandCounts = ['1', '2', '3', '4'].map((b) => W.rankList('overall', { band: b, category: 'all' }).length);
ok(bandCounts.join(',') === '16,18,18,12', `排行榜价位过滤正确（各段 ${bandCounts.join('/')} 台）`);
ok(W.rankList('overall', { band: 2, category: 'all' }).length === 18, '排行榜价位传数字也正确');
ok(W.rankList('overall', { band: 'all', category: '游戏本' }).length === 18, '排行榜品类过滤正确（游戏本 18 台）');

console.log('\n== 筛选语义 ==');
const gpuMust = W.evaluate({ wall: { gpu: 'must' } });
ok(gpuMust.results.every((r) => r.l.gpuTier >= 2.2), '「必须独显」结果都满足');
ok(gpuMust.results.length > 0 && gpuMust.results.length < L.length, `「必须独显」命中 ${gpuMust.results.length} 台（应介于 0 与总数之间）`);
const twoBands = W.evaluate({ wall: { band1: 'must', band2: 'must' } });
ok(twoBands.results.length === twoBands.results.filter((r) => r.l.band === 1 || r.l.band === 2).length, '多选预算为「或」关系');
const wantOnly = W.evaluate({ wall: { gpu: 'want' } });
ok(wantOnly.results.length === L.length, '只勾偏好不排除任何机型');
const empty = W.evaluate({ wall: { gpu: 'must', mac: 'must' } });
ok(empty.results.length === 0, '互斥条件命中 0 台（不应报错）');
const wantBoost = W.evaluate({ wall: { gpu: 'want' } });
const topGpu = wantBoost.results.slice().sort((a, b) => b.fit - a.fit)[0];
ok(topGpu.l.gpuTier >= 2.2, '勾「偏好独显」后头部排序偏向独显');

console.log('\n== 地形分配 ==');
const terrainCount = {};
for (const l of L) terrainCount[l.terrain] = (terrainCount[l.terrain] || 0) + 1;
ok(Object.keys(terrainCount).every((t) => ['library', 'workshop', 'arena', 'inn'].includes(t)), '地形 id 合法');
console.log('   ', JSON.stringify(terrainCount));

console.log('\n== 本季格局 ==');
const hs = W.highlights();
ok(hs.length === 5 && hs.every((x) => x.l), '本季格局 5 张牌子都有机型');
ok(hs.every((x) => !/NaN|Infinity/.test(x.why())), '牌子文案无 NaN/Infinity');

console.log('\n== 渠道报价 ==');
const withOffers = L.filter((l) => l.offers && l.offers.length);
const totalOffers = withOffers.reduce((a, l) => a + l.offers.length, 0);
console.log(`   覆盖 ${withOffers.length}/${L.length} 台，报价 ${totalOffers} 条`);
if (totalOffers) {
  let offerBad = 0, sortedBad = 0, bestBad = 0;
  for (const l of withOffers) {
    for (const o of l.offers) {
      if (!(o.price > 0) || !o.platform || !o.storeType || typeof o.score !== 'number' || o.score < 0 || o.score > 100) offerBad++;
    }
    for (let i = 1; i < l.offers.length; i++) if (l.offers[i].score > l.offers[i - 1].score) sortedBad++;
    if (l.bestOffer !== l.offers[0]) bestBad++;
  }
  ok(offerBad === 0, `渠道报价字段/分数合法（坏 ${offerBad}）`);
  ok(sortedBad === 0, `渠道按分数降序（乱序 ${sortedBad}）`);
  ok(bestBad === 0, `bestOffer 为第一名（错 ${bestBad}）`);
  const jdSelf = withOffers.reduce((a, l) => a + l.offers.filter((o) => o.storeType === '京东自营').length, 0);
  const tmall = withOffers.reduce((a, l) => a + l.offers.filter((o) => o.platform === '天猫').length, 0);
  console.log(`   京东自营 ${jdSelf} 条，天猫 ${tmall} 条`);
} else {
  console.log('   ⚠️ 尚无渠道数据（data/channels/ 未就绪）');
}

console.log('\n== 知识库 ==');
const K = data.knowledge || {};
ok((K.specBaseline || []).length >= 7, `规格底线 ${(K.specBaseline || []).length} 条 ≥ 7`);
ok((K.pitfalls || []).length >= 12, `避坑 ${(K.pitfalls || []).length} 条 ≥ 12`);
ok((K.glossary || []).length >= 15, `黑话 ${(K.glossary || []).length} 条 ≥ 15`);

console.log('\n========================');
if (fails) { console.log(`❌ 失败 ${fails} 项`); process.exit(1); }
console.log('✅ 全部通过');
