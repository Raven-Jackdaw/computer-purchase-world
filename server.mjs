// 本地实时价格服务
// 启动：node server.mjs（或双击「启动实时价格.bat」）
// 应用页面：http://127.0.0.1:8787/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const P = (...s) => path.join(ROOT, ...s);
const PORT = Number(process.env.PORT || 8787);
const HOST = '127.0.0.1';
const TTL_MS = 30 * 60 * 1000; // 超过 30 分钟自动建议刷新

const state = { running: false, progress: null, startedAt: null, lastError: null };

function readLive() {
  try {
    return JSON.parse(fs.readFileSync(P('data/live/market.json'), 'utf8'));
  } catch (e) { return null; }
}
function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function startRefresh() {
  if (state.running) return false;
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.lastError = null;
  state.progress = { total: 64, done: 0, current: '', updated: 0, failed: 0 };
  const child = spawn(process.execPath, ['refresh.mjs', '--progress'], { cwd: ROOT });
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('@@')) continue;
      try {
        const ev = JSON.parse(line.slice(2));
        if (ev.type === 'progress') state.progress = { ...state.progress, ...ev };
        else if (ev.type === 'done') state.progress = { ...state.progress, ...ev, finished: true };
        else if (ev.type === 'error') state.lastError = ev.message;
      } catch (e) { }
    }
  });
  child.stderr.on('data', (d) => { state.lastError = String(d).slice(0, 500); });
  child.on('close', (code) => {
    state.running = false;
    state.progress = { ...(state.progress || {}), done: (state.progress && state.progress.total) || 0, exitCode: code, finished: true };
    console.log(`[refresh] 完成，exit=${code}`);
  });
  return true;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  if (u.pathname === '/api/status') {
    const live = readLive();
    const updatedAt = live && live.updatedAt ? live.updatedAt : null;
    const age = updatedAt ? Date.now() - new Date(updatedAt).getTime() : null;
    return json(res, 200, {
      ok: true, host: 'local', running: state.running, progress: state.progress,
      updatedAt, ageMs: age, stale: age == null || age > TTL_MS,
      total: live && live.total, refreshed: live && live.refreshed,
      lastError: state.lastError,
    });
  }
  if (u.pathname === '/api/prices') {
    const live = readLive();
    return json(res, 200, live || { updatedAt: null, items: [] });
  }
  if (u.pathname === '/api/refresh' && req.method === 'POST') {
    if (state.running) return json(res, 409, { ok: false, error: '正在刷新中', progress: state.progress });
    startRefresh();
    return json(res, 202, { ok: true, started: true });
  }
  // 页面
  const file = P('dist/电脑购买大世界.html');
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('还没有构建产物：请先运行 node build.mjs');
});

server.listen(PORT, HOST, () => {
  console.log('==============================================');
  console.log('  电脑购买大世界 · 本地实时价格服务已启动');
  console.log(`  应用地址： http://${HOST}:${PORT}/`);
  console.log('  刷新价格：页面右上角「刷新市场价」按钮');
  console.log('  关闭服务：直接关闭这个窗口');
  console.log('==============================================');
});
