// 市场价刷新器：抓取逛丢（京东/天猫活动聚合）→ 解析 → 匹配机型 → 写 data/channels/*.json
// 用法：
//   node refresh.mjs                 # 全量刷新 64 台
//   node refresh.mjs --limit 3       # 只刷前 3 台（测试）
//   node refresh.mjs --id xxx --id yyy
//   node refresh.mjs --progress      # 输出 JSON 进度行（供 server.mjs 转发）
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = (...s) => path.join(ROOT, ...s);
const readJSON = (f) => JSON.parse(fs.readFileSync(P(f), 'utf8'));
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(P(f)), { recursive: true }); fs.writeFileSync(P(f), JSON.stringify(v, null, 2), 'utf8'); };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TODAY = new Date('2026-11-17T12:00:00+08:00');

const args = process.argv.slice(2);
const PROGRESS = args.includes('--progress');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1], 10) : null; })();
const IDS = args.reduce((a, x, i) => { if (x === '--id') a.push(args[i + 1]); return a; }, []);

/* ---------------- HTTP ---------------- */
function getBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': 'text/html,application/xhtml+xml' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 3) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return getBuffer(next, redirects + 1).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}
function decode(buf, contentType) {
  const ct = String(contentType || '');
  try {
    if (/charset=gbk|gb2312|gb18030/i.test(ct)) return new TextDecoder('gbk').decode(buf);
    const utf8 = buf.toString('utf8');
    if ((utf8.match(/\uFFFD/g) || []).length > 20) return new TextDecoder('gbk').decode(buf);
    return utf8;
  } catch (e) { return buf.toString('utf8'); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- HTML 解析 ---------------- */
function stripTags(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
function parseDeals(html) {
  const blocks = String(html).split('<div class="gooditem').slice(1);
  const out = [];
  for (const b of blocks) {
    const id = (b.match(/detail\.php\?id=(\d+)/) || [])[1];
    if (!id) continue;
    const title = (b.match(/class="goodname" title="([^"]*)"/) || [])[1] || '';
    const priceRaw = stripTags((b.match(/class="emphricepart">([\s\S]*?)<\/span>/) || [])[1] || '');
    const abs = stripTags((b.match(/class="abstractcontent"[^>]*>([\s\S]*?)<a class="gotodetail"/) || [])[1] || '');
    const timeRaw = stripTags((b.match(/class="infotime"><a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
    const mall = stripTags((b.match(/class="rightmallname"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
    const buyHref = (b.match(/class="innergototobuybtn"[^>]*href="([^"]+)"/) || [])[1] || '';
    const selfOp = /自营/.test(b);
    if (!title) continue;
    out.push({ id, title, priceRaw, abs, timeRaw, mall, buyHref, selfOp });
  }
  return out;
}

/* ---------------- 价格 / 时间 ---------------- */
function parsePrice(d) {
  const take = (s) => { const m = String(s).replace(/,/g, '').match(/([0-9]{2,6}(?:\.[0-9]{1,2})?)\s*元/); return m ? parseFloat(m[1]) : null; };
  let kind = '活动价';
  const raw = d.priceRaw || '';
  if (/国补/.test(raw)) kind = '国补后';
  else if (/券后/.test(raw)) kind = '券后价';
  else if (/到手/.test(raw)) kind = '到手价';
  // 描述里的最终实付优先
  let finalPrice = null;
  const abs = d.abs || '';
  const mFinal = abs.match(/(?:实付低至|到手价|券后|低至)\s*([0-9]{2,6}(?:\.[0-9]{1,2})?)\s*元/);
  if (mFinal) { finalPrice = parseFloat(mFinal[1]); kind = '到手价'; }
  let price = finalPrice;
  if (price == null) price = take(raw) || take(titlePriceText(d));
  if (price == null) return null;
  if (price < 500 || price > 80000) return null;
  return { price, kind };
}
function titlePriceText(d) { return /\d+(\.\d+)?元/.test(d.title) ? d.title : ''; }

function parseDate(timeRaw) {
  const t = String(timeRaw || '').trim();
  const now = TODAY;
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  if (!t) return null;
  let m;
  if ((m = t.match(/^(\d+)\s*小时前/))) return fmt(new Date(now.getTime() - parseInt(m[1], 10) * 3600e3));
  if ((m = t.match(/^(\d+)\s*分钟前/))) return fmt(now);
  if ((m = t.match(/^(\d+)\s*天前/))) return fmt(new Date(now.getTime() - parseInt(m[1], 10) * 86400e3));
  if (/前天/.test(t)) return fmt(new Date(now.getTime() - 2 * 86400e3));
  if (/昨天/.test(t)) return fmt(new Date(now.getTime() - 86400e3));
  if (/今天/.test(t)) return fmt(now);
  if ((m = t.match(/^(\d{1,2})-(\d{1,2})(?:\s|$)/))) {
    let y = now.getFullYear();
    const mo = parseInt(m[1], 10);
    if (mo > now.getMonth() + 1) y -= 1;
    return `${y}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  if ((m = t.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return null;
}

/* ---------------- 机型签名 ---------------- */
function norm(s) { return String(s || '').toLowerCase().replace(/[\s\-_\/·,，、()（）\[\]【】]/g, ''); }

function signature(l) {
  const sig = { must: [], plus: [] };
  const series = norm(l.series);
  const nameBase = norm(String(l.name || '').replace(/[（(].*$/, ''));
  if (series && series.length >= 2) sig.must.push(series);
  else if (nameBase.length >= 2) sig.must.push(nameBase.slice(0, Math.min(8, nameBase.length)));
  // 型号关键 token（从名字里挑 3-6 个字母数字段）
  const modelTokens = String(l.name || '').replace(/[（(].*$/, '').match(/[A-Za-z]{1,4}[- ]?\d{2,4}[A-Za-z]?|\d{2,4}[A-Za-z]{1,3}/g) || [];
  for (const t of modelTokens.slice(0, 3)) sig.plus.push(norm(t));
  // CPU
  const cpu = norm(l.cpu);
  const cpuM = cpu.match(/(ultra[579]|i[3579][0-9]{4,5}[a-z]*|i[3579][a-z]?[0-9]{3,4}[a-z]*|r[3579][a-z]?[0-9]{3,4}[a-z]*|m[0-9](?:pro|max)?|n[0-9]{2,3}|麒麟x?[0-9]{2,3}|骁龙x[a-z]*)/);
  if (cpuM) sig.plus.push(cpuM[1]);
  // GPU
  const gpu = norm(l.gpu);
  const gpuM = gpu.match(/(rtx[0-9]{4}(?:ti|super)?|gtx[0-9]{4}|arc[0-9]{2,3}v?|radeon[0-9]{3,4}m)/);
  if (gpuM) sig.plus.push(gpuM[1]);
  // 内存 / 硬盘
  if (l.ramGB) sig.plus.push(l.ramGB + 'g');
  if (l.storageGB) sig.plus.push(l.storageGB >= 1024 ? '1t' : l.storageGB + 'g');
  return sig;
}

function matchScore(l, deal) {
  const hay = norm(deal.title + ' ' + deal.abs);
  const sig = signature(l);
  let score = 0;
  let mustHit = 0;
  for (const m of sig.must) { if (hay.includes(m)) mustHit++; }
  if (!mustHit) return -1;
  score += 3;
  let plusHit = 0;
  for (const p of sig.plus) {
    if (p.length >= 2 && hay.includes(p)) { plusHit++; score += p.startsWith('rtx') ? 2 : 1.5; }
  }
  // CPU 必须命中（有 CPU 信息时）
  const cpu = norm(l.cpu).match(/(ultra[579]|i[3579][0-9]{4,5}[a-z]*|i[3579][a-z]?[0-9]{3,4}[a-z]*|r[3579][a-z]?[0-9]{3,4}[a-z]*|m[0-9](?:pro|max)?|n[0-9]{2,3}|麒麟x?[0-9]{2,3}|骁龙x[a-z]*)/);
  const cpuOk = cpu ? hay.includes(cpu[1]) : false;
  const hasCpuInfo = /ultra|i[3579]|r[3579]|ryzen|麒麟|骁龙|m[0-9]/.test(hay);
  if (!cpuOk && hasCpuInfo) return -1;
  if (cpuOk) score += 2;
  // 显卡：两边都有型号但对不上就排除（防止 5060 的价套给 5070Ti）
  const gpuTok = (norm(l.gpu).match(/rtx[0-9]{4}(?:ti|super)?|gtx[0-9]{4}/) || [])[1];
  const hayGpu = (hay.match(/rtx[0-9]{4}(?:ti|super)?|gtx[0-9]{4}/) || [])[1];
  if (gpuTok && hayGpu && gpuTok !== hayGpu) return -1;
  // 年份惩罚
  const ly = String(l.name).match(/20(2[0-9])/);
  const dy = (deal.title + deal.abs).match(/20(2[0-9])/);
  if (ly && dy && ly[1] !== dy[1]) score -= 2;
  // 新品名里没有年份的，标题出现"2023/2024"也降分
  if (!ly && /20(23|24)/.test(deal.title)) score -= 1;
  return score;
}

/* ---------------- 主流程 ---------------- */
const bandFiles = [1, 2, 3, 4].map((b) => ({ b, f: `data/band-${b}.json`, c: `data/channels/band-${b}.json` }));
const laptops = [];
for (const { b, f } of bandFiles) {
  if (!fs.existsSync(P(f))) continue;
  for (const l of readJSON(f).laptops || []) { l.band = b; laptops.push(l); }
}
const channelMap = new Map(); // laptopId -> {searchKeyword, offers, note}
for (const { c } of bandFiles) {
  if (!fs.existsSync(P(c))) continue;
  const j = readJSON(c);
  for (const it of j.items || []) channelMap.set(it.laptopId, it);
}

const targets = laptops.filter((l) => !IDS.length || IDS.includes(l.id)).slice(0, LIMIT || undefined);
const progress = { total: targets.length, done: 0, current: '', updated: 0, failed: 0 };
function emit(evt) { if (PROGRESS) console.log('@@' + JSON.stringify(evt)); }

const results = [];
for (const l of targets) {
  progress.current = l.id;
  const prev = channelMap.get(l.id) || {};
  const keyword = prev.searchKeyword || String(l.name || '').replace(/[（(].*$/, '').replace(/\s+/g, ' ').trim();
  let deals = [];
  try {
    const url = `https://guangdiu.com/search.php?q=${encodeURIComponent(keyword)}`;
    const r = await getBuffer(url);
    const html = decode(r.buf, r.headers && r.headers['content-type']);
    deals = parseDeals(html);
  } catch (e) {
    emit({ type: 'error', id: l.id, message: String(e.message || e) });
  }
  const scored = deals
    .map((d) => ({ d, s: matchScore(l, d) }))
    .filter((x) => x.s >= 4.5)
    .sort((a, b) => b.s - a.s);
  // 组装 offers：取分数最高的、不同平台各 1 条（最多 2 条）
  const offers = [];
  const seenPlatform = new Set();
  for (const { d, s } of scored) {
    const p = parsePrice(d);
    if (!p) continue;
    const platform = /京东/.test(d.mall) ? '京东' : /天猫/.test(d.mall) ? '天猫' : /拼多多/.test(d.mall) ? '拼多多' : /淘宝/.test(d.mall) ? '淘宝' : d.mall || '其他';
    if (seenPlatform.has(platform)) continue;
    seenPlatform.add(platform);
    const isSelf = d.selfOp && platform === '京东';
    let storeType = '未知';
    if (platform === '京东') storeType = isSelf ? '京东自营' : (/官方旗舰店|自营旗舰店/.test(d.title + d.abs) ? '京东官方旗舰店' : '京东第三方');
    else if (platform === '天猫') storeType = /自营/.test(d.title + d.abs) ? '天猫自营' : (/旗舰店/.test(d.title + d.abs) ? '天猫官方旗舰店' : '天猫店铺');
    else if (platform === '拼多多') storeType = '拼多多百亿补贴';
    const services = [];
    const text = d.title + ' ' + d.abs;
    for (const [k, re] of [['国补', /国补|国家补贴|政府补贴/], ['学生认证', /学生认证|教育优惠/], ['PLUS会员', /PLUS/], ['88VIP', /88VIP/], ['白条免息', /白条|分期免息/], ['以旧换新', /以旧换新/], ['晒单返现', /晒单|返E卡|返现/], ['赠品', /赠品|赠/], ['京东物流', /京东物流/], ['7天无理由', /7天无理由/], ['运费险', /运费险/], ['全国联保', /全国联保|全国质保/]]) {
      if (re.test(text)) services.push(k);
    }
    const publishedAt = parseDate(d.timeRaw);
    const stale = publishedAt ? publishedAt < '2026-09-01' : false;
    const tmallDirect = /^https?:\/\/detail\.tmall\.com/.test(d.buyHref || '');
    const url = tmallDirect ? d.buyHref : d.buyHref || `https://guangdiu.com/detail.php?id=${d.id}`;
    offers.push({
      platform, storeType,
      storeName: null,
      price: Math.round(p.price),
      priceKind: p.kind,
      priceNote: d.abs.slice(0, 180),
      publishedAt: publishedAt || null,
      stale,
      url,
      evidenceUrl: `https://guangdiu.com/detail.php?id=${d.id}`,
      services,
      status: publishedAt ? '部分待核实' : '待核实',
      _matchedTitle: d.title.slice(0, 120),
      _matchScore: Math.round(s * 10) / 10,
    });
    if (offers.length >= 2) break;
  }
  // 价格合理性：与参考价偏离过大说明匹配到了不同配置，剔除（无参考价则不校验）
  const refPrice = Number(l.price) || 0;
  let sane = offers;
  let sanityNote = '';
  if (refPrice && offers.length) {
    sane = offers.filter((o) => o.price >= refPrice * 0.5 && o.price <= refPrice * 1.8);
    if (!sane.length) {
      sane = offers.map((o) => ({ ...o, status: '待核实', sanityFlag: true }));
      sanityNote = '抓到的活动价与参考价偏差较大，可能不是同一配置，已标「待核实」';
    }
  }
  const item = { laptopId: l.id, searchKeyword: keyword, offers: sane, refreshedAt: new Date().toISOString() };
  if (sanityNote) item.note = sanityNote;
  if (!sane.length) item.note = '本次刷新未匹配到同配置活动价，保留上次结果';
  results.push(item);
  progress.done++;
  progress.updated += sane.length ? 1 : 0;
  if (!sane.length) progress.failed++;
  emit({ type: 'progress', ...progress });
  await sleep(1200);
}

// 写入实时缓存（不改动 data/channels 里的人工核实快照）
writeJSON('data/live/market.json', {
  updatedAt: new Date().toISOString(),
  total: progress.total,
  refreshed: progress.updated,
  failed: progress.failed,
  items: targets.map((l) => {
    const r = results.find((x) => x.laptopId === l.id) || { laptopId: l.id, offers: [] };
    return { laptopId: l.id, searchKeyword: r.searchKeyword, offers: r.offers, note: r.note };
  }),
});
emit({ type: 'done', ...progress });
if (!PROGRESS) {
  console.log(`刷新完成：${progress.done} 台，有报价 ${progress.updated} 台，未匹配 ${progress.failed} 台`);
}
