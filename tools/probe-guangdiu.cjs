// 探针：抓取逛丢搜索页并正确解码 GBK，摸清结构（仅开发用）
const path = require('node:path');
const fs = require('node:fs');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getBuf(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('node:https') : require('node:http');
    const req = lib.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return getBuf(next).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')); });
  });
}

function decodeBody(buf, contentType) {
  const ct = String(contentType || '');
  if (/charset=gbk|charset=gb2312|charset=gb18030/i.test(ct)) return new TextDecoder('gbk').decode(buf);
  // 尝试 utf8；若出现大量替换符则退回 gbk
  const utf8 = buf.toString('utf8');
  if ((utf8.match(/\uFFFD/g) || []).length > 20) {
    try { return new TextDecoder('gbk').decode(buf); } catch (e) { return utf8; }
  }
  return utf8;
}

(async () => {
  const kw = encodeURIComponent('拯救者Y9000P');
  const url = `https://guangdiu.com/search.php?q=${kw}`;
  const r = await getBuf(url);
  const html = decodeBody(r.buf, r.headers && r.headers['content-type']);
  console.log('status', r.status, 'bytes', r.buf.length, 'decoded', html.length);
  const outDir = path.join(__dirname, '..', '_tmp');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'guangdiu-raw.html'), html, 'utf8');
  console.log('含"自营"次数:', (html.match(/自营/g) || []).length);
  const k = html.indexOf('自营');
  if (k > 0) console.log('--- 自营上下文 ---\n' + html.slice(Math.max(0, k - 400), k + 300));
  // 打印第一个条目完整结构
  const s = html.indexOf('<div class="gooditem');
  const e = html.indexOf('<div class="gooditem', s + 10);
  console.log('--- gooditem 结构 ---');
  console.log(html.slice(s, Math.min(e, s + 2600)));
})();
