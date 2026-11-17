/* ============================================================
   主应用：渲染与交互
   ============================================================ */
(function () {
  'use strict';

  const W = window.W;
  const SPR = window.W_SPRITE;
  const DATA = W.DATA;
  const LAPTOPS = W.LAPTOPS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else e.setAttribute(k, v);
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('w_' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('w_' + k, JSON.stringify(v)); } catch (e) { } },
  };

  const state = {
    theme: store.get('theme', 'dark'),
    view: 'world',
    wall: store.get('wall', {}),
    search: '',
    sort: store.get('sort', 'fit'),
    compare: [],
    detailId: null,
    rankBar: 'overall',
    rankBand: 'all',
    rankCat: 'all',
    live: { available: false, updatedAt: null, running: false, progress: null, stale: true },
    preset: store.get('preset', null),
    budgetMax: store.get('budgetMax', null),
  };

  function currentWeights() {
    const p = W.PRESETS.find((x) => x.id === state.preset);
    return p && p.weights ? p.weights : null;
  }

  /* ---------- 链接状态（可分享的 #hash） ---------- */
  function readHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return;
    const p = new URLSearchParams(raw);
    if (p.get('theme') === 'light' || p.get('theme') === 'dark') state.theme = p.get('theme');
    if (p.get('view')) state.view = p.get('view');
    if (p.get('q')) state.search = p.get('q');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('rank')) state.rankBar = p.get('rank');
    if (p.get('rankband')) state.rankBand = p.get('rankband');
    if (p.get('rankcat')) state.rankCat = p.get('rankcat');
    if (p.get('detail')) state.detailId = p.get('detail');
    if (p.get('cmp')) state.compare = p.get('cmp').split(',').filter(Boolean).slice(0, 4);
    const f = p.get('filter');
    if (f) {
      state.wall = {};
      for (const part of f.split(',')) {
        const i = part.indexOf(':');
        const id = i > 0 ? part.slice(0, i) : part;
        const st = i > 0 ? part.slice(i + 1) : 'must';
        if (id && (st === 'want' || st === 'must')) state.wall[id] = st;
      }
    }
  }

  function syncHash() {
    const p = new URLSearchParams();
    if (state.view !== 'world') p.set('view', state.view);
    if (state.theme !== 'dark') p.set('theme', state.theme);
    if (state.search) p.set('q', state.search);
    if (state.sort !== 'fit') p.set('sort', state.sort);
    const ids = Object.keys(state.wall);
    if (ids.length) p.set('filter', ids.map((id) => id + ':' + state.wall[id]).join(','));
    if (state.detailId) p.set('detail', state.detailId);
    if (state.compare.length) p.set('cmp', state.compare.join(','));
    if (state.view === 'rank') {
      if (state.rankBar !== 'overall') p.set('rank', state.rankBar);
      if (state.rankBand !== 'all') p.set('rankband', state.rankBand);
      if (state.rankCat !== 'all') p.set('rankcat', state.rankCat);
    }
    const s = p.toString();
    try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (e) { }
  }

  const drawer = $('#detailDrawer');
  const detailPanel = $('#detailPanel');
  const compareModal = $('#compareModal');
  const comparePanel = $('#comparePanel');
  const toastEl = $('#toast');
  let toastTimer = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1800);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $('#themeBtn').textContent = state.theme === 'dark' ? '☾' : '☀';
    $('#themeBtn').title = state.theme === 'dark' ? '切换到烛光羊皮纸' : '切换回黑夜';
  }

  const fmt = W.fmtPrice;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function specVal(v) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) {
      return h('span', { class: 'v unknown' }, '待核实');
    }
    return h('span', { class: 'v' }, String(v));
  }
  const DIM_NAMES = { perf: '性能', portable: '便携', screen: '屏幕', battery: '续航', expand: '扩展', value: '性价比' };

  /* ================= 小工具 ================= */
  function drawCanvas(canvas, l, w, hgt) {
    try { SPR.draw(canvas, l, { theme: state.theme, width: w, height: hgt }); } catch (e) { console.error(e); }
  }

  function drawBanner() {
    const cv = $('#bannerCanvas');
    if (!cv || !window.W_BANNER) return;
    try { window.W_BANNER.draw(cv, state.theme); } catch (e) { console.error(e); }
  }

  /* ================= 分享 / 导出 ================= */
  function download(text, filename, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function topSorted() {
    const ev = W.evaluate({ wall: state.wall, search: state.search, weights: currentWeights(), maxPrice: state.budgetMax });
    return W.sortResults(ev.results, state.sort);
  }
  function copyShareLink() {
    syncHash();
    const url = location.href;
    const done = () => toast('已复制筛选链接，发给同学打开同一份文件即可复现');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => { window.prompt('复制这个链接：', url); });
    } else {
      window.prompt('复制这个链接：', url);
    }
  }
  function copyTopList() {
    const list = topSorted().slice(0, 10);
    const lines = list.map((r, i) => `${i + 1}. ${r.l.name}｜${fmt(r.l.price)}｜匹配 ${Math.round(r.fit)}｜${r.l.brand} ${r.l.category}`);
    const text = `《电脑购买大世界》推荐清单（数据 ${DATA.meta.dataDate}）\n` + lines.join('\n') + `\n\n来自：电脑购买大世界`;
    const done = () => toast('Top10 清单已复制');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => window.prompt('复制清单：', text));
    else window.prompt('复制清单：', text);
  }
  function exportResults() {
    const list = topSorted();
    const payload = {
      exportedAt: new Date().toISOString(),
      dataDate: DATA.meta.dataDate,
      filters: state.wall,
      search: state.search,
      sort: state.sort,
      count: list.length,
      results: list.map(({ l, fit }) => ({
        id: l.id, name: l.name, brand: l.brand, category: l.category,
        price: l.price, priceNote: l.priceNote, status: l.status,
        fit: Math.round(fit),
        dims: Object.fromEntries(W.DIMS.map((d) => [d, Math.round(l.scores[d])])),
        cpu: l.cpu, gpu: l.gpu, ram: l.ram, storage: l.storage,
        screen: l.screen, weightKg: l.weightKg, batteryWh: l.batteryWh,
        sourceSpec: l.sourceSpec, sourcePrice: l.sourcePrice,
      })),
    };
    download(JSON.stringify(payload, null, 2), '电脑购买大世界-筛选结果.json');
    toast('已导出 ' + list.length + ' 台结果');
  }

  function badgeList(l) {
    const out = [];
    out.push(l.category || '笔记本');
    if (l.screen && l.screen.size) out.push(Number(l.screen.size).toFixed(1).replace('.0', '') + '"');
    if (l.gpuType === '独显' || l.gpuType === '甜品独显' || l.gpuType === '高端独显') out.push('独显');
    else if (/核显/.test(l.gpuType || '')) out.push('核显');
    if (l.ramGB) out.push(l.ramGB + 'G');
    if (l.screen && l.screen.refresh >= 120) out.push(l.screen.refresh + 'Hz');
    return out.slice(0, 4);
  }

  /* ================= 筛选面板 ================= */
  function saveWall() { store.set('wall', state.wall); }

  function setFilter(id) {
    const it = W.FILTER_INDEX[id];
    if (!it) return;
    const cur = state.wall[id];
    if (it.band) {
      if (cur) delete state.wall[id]; else state.wall[id] = 'must';
    } else if (!cur) state.wall[id] = 'want';
    else if (cur === 'want') state.wall[id] = 'must';
    else delete state.wall[id];
    saveWall();
    renderFilters();
    renderWorld();
  }

  function resetFilters() {
    state.wall = {};
    state.search = '';
    state.preset = null;
    state.budgetMax = null;
    store.set('preset', null);
    store.set('budgetMax', null);
    $('#search').value = '';
    saveWall();
    renderFilters();
    renderWorld();
    toast('已重置所有勾选与预算上限');
  }

  function renderFilters() {
    const root = $('#filters');
    root.innerHTML = '';
    const head = h('div', { class: 'filters-head' },
      h('h2', null, '勾选条件'),
      h('button', { onClick: resetFilters, title: '清空全部条件' }, '重置')
    );
    const legend = h('div', { class: 'filters-legend' },
      h('i', { class: 'lg-want' }, '◇ 偏好'),
      h('i', null, '（加分排序）'),
      h('i', { class: 'lg-must' }, '◆ 必须'),
      h('i', null, '（直接排除）')
    );
    const hint = h('p', { class: 'filters-hint' },
      '点一下 = 偏好，再点 = 必须，第三下取消。预算可多选（或关系）。');
    root.append(head, legend, hint);

    // 速选方案
    const presetWrap = h('div', { class: 'filter-group' },
      h('div', { class: 'filter-group-title' }, '速选方案'),
      h('div', { class: 'filter-chips' }, ...W.PRESETS.map((p) =>
        h('button', {
          class: 'chip' + (state.preset === p.id ? ' active' : ''),
          title: p.uses, dataset: { preset: p.id },
          onClick: () => applyPreset(p.id),
        }, p.label)
      ))
    );
    root.append(presetWrap);

    // 预算上限（硬上限，比价位段更精细）
    const caps = [0, 5000, 6000, 8000, 12000, 15000];
    const capWrap = h('div', { class: 'filter-group' },
      h('div', { class: 'filter-group-title' }, '预算上限'),
      h('div', { class: 'filter-chips' }, ...caps.map((c) =>
        h('button', {
          class: 'chip' + (Number(state.budgetMax || 0) === c ? ' active' : ''),
          title: c ? '只看 ¥' + c.toLocaleString() + ' 以内的机型' : '不设上限',
          onClick: () => {
            state.budgetMax = c || null;
            store.set('budgetMax', state.budgetMax);
            renderFilters();
            renderWorld();
          },
        }, c ? '≤ ¥' + c.toLocaleString() : '不限')
      ))
    );
    root.append(capWrap);

    for (const g of W.FILTER_GROUPS) {
      const group = h('div', { class: 'filter-group' },
        h('div', { class: 'filter-group-title' }, g.label)
      );
      const chips = h('div', { class: 'filter-chips' });
      for (const it of g.items) {
        const st = state.wall[it.id] || '';
        chips.append(h('button', {
          class: 'chip',
          dataset: { state: st, filter: it.id },
          title: it.band ? '预算大陆（硬性）' : '点一下=偏好 / 再点=必须',
          onClick: () => setFilter(it.id),
        }, it.label));
      }
      group.append(chips);
      root.append(group);
    }

    // 底部分享与导出
    root.append(h('div', { class: 'filter-tools' },
      h('div', { class: 'filter-tools-title' }, '分享与导出'),
      h('button', { class: 'btn ghost small', onClick: copyShareLink }, '复制当前筛选链接'),
      h('button', { class: 'btn ghost small', onClick: exportResults }, '导出筛选结果 JSON'),
      h('button', { class: 'btn ghost small', onClick: copyTopList }, '复制 Top10 清单')
    ));
  }

  function applyPreset(pid) {
    const p = W.PRESETS.find((x) => x.id === pid);
    if (!p) return;
    state.wall = {};
    for (const k in p.wall) state.wall[k] = p.wall[k];
    state.preset = pid;
    store.set('preset', pid);
    saveWall();
    renderFilters();
    renderWorld();
    toast('已套用「' + p.label.replace(/^[^ ]+\s*/, '') + '」方案（排序权重也一起切了），可在上方继续微调');
  }

  /* ================= 世界地图 ================= */
  let lastWorld = null;

  function renderWorld() {
    const map = $('#map');
    const hero = $('#hero');
    if (!LAPTOPS.length) {
      map.innerHTML = '<div class="map-empty">还没有机型数据。请先运行 <b>node build.mjs</b> 采集并构建。</div>';
      $('#stats').innerHTML = '暂无数据';
      return;
    }
    const ev = W.evaluate({ wall: state.wall, search: state.search, weights: currentWeights(), maxPrice: state.budgetMax });
    lastWorld = ev;
    const results = W.sortResults(ev.results, state.sort);
    const fitMap = new Map(results.map((r) => [r.l.id, r.fit]));

    // —— 本季格局 ——
    if (hero) {
      hero.innerHTML = '';
      const bars = W.highlights();
      hero.append(
        h('div', { class: 'hero-title' },
          h('h2', null, '本季格局'),
          h('span', null, '数据采集 ' + (DATA.meta.dataDate || '—') + ' · 每台都写清楚凭什么')
        ),
        h('div', { class: 'hero-grid' }, ...bars.map((b) => {
          const card = h('div', { class: 'panel rivets hero-card', onClick: () => openDetail(b.l.id) });
          const cv = h('canvas', { class: 'hero-sprite' });
          const bandName = (W.CONTINENTS.find((c) => c.band === b.l.band) || {}).name || '';
          card.append(cv,
            h('div', { class: 'hero-kind' }, b.kind, h('span', { class: 'hero-band' }, bandName)),
            h('div', { class: 'hero-name' }, b.l.name),
            h('div', { class: 'hero-why', html: b.why() })
          );
          requestAnimationFrame(() => drawCanvas(cv, b.l, 52, 66));
          return card;
        }))
      );
    }

    // —— 四块大陆 ——
    map.innerHTML = '';
    const mustCount = ev.mustCount;
    if (!results.length) {
      const mustNames = Object.keys(state.wall)
        .filter((k) => state.wall[k] === 'must')
        .map((id) => (W.FILTER_INDEX[id] || {}).label || id);
      map.append(h('div', { class: 'map-empty' },
        '没有机型同时满足这些「必须」条件。',
        mustNames.length ? h('div', { class: 'empty-musts' }, '当前必须条件：' + mustNames.join('、')) : null,
        h('div', { style: { marginTop: '8px' } }, '试试：取消其中一条必须项、把它改成「偏好」，' + (state.budgetMax ? '或提高预算上限。' : '或放宽预算。')),
        h('div', { style: { marginTop: '4px', opacity: .75 } }, '偏好只影响排序，不会把机型排除。')
      ));
    }
    for (const c of W.CONTINENTS) {
      const inBand = results.filter((r) => r.l.band === c.band);
      if (!inBand.length) {
        // 空大陆折叠成一行，避免占满整屏
        map.append(h('div', { class: 'continent-empty' },
          h('span', { class: 'ce-name' }, c.name),
          h('span', { class: 'ce-sub' }, c.range),
          h('span', { class: 'ce-count' }, '0 台符合')
        ));
        continue;
      }
      const section = h('section', { class: 'continent' });
      const head = h('div', { class: 'continent-head' },
        h('span', { class: 'c-name' }, c.name),
        h('span', { class: 'c-sub' }, c.range + ' · ' + c.sub),
        h('span', { class: 'c-count' }, inBand.length + ' 台符合'),
        h('span', { class: 'c-score' }, '最高匹配 ' + Math.round(Math.max(...inBand.map((r) => r.fit))) + '/100')
      );
      section.append(head);

      const grid = h('div', { class: 'terrain-grid' });
      for (const t of W.TERRAINS) {
        const cell = h('div', { class: 'terrain' });
        const items = inBand.filter((r) => r.l.terrain === t.id);
        cell.append(h('div', { class: 'terrain-head' },
          h('span', { class: 't-icon' }, t.icon),
          h('span', null, t.name + ' · ' + t.sub),
          h('span', { class: 't-count' }, String(items.length))
        ));
        if (!items.length) {
          cell.append(h('div', { class: 'terrain-empty' }, '此地形暂无符合条件的机型'));
        } else {
          const gridEl = h('div', { class: 'laptop-grid' });
          items.forEach((r, idx) => gridEl.append(makeCard(r.l, r.fit, idx)));
          cell.append(gridEl);
        }
        grid.append(cell);
      }
      section.append(grid);
      map.append(section);
    }

    const foot = h('div', { class: 'map-foot' },
      h('span', null, '共 ' + LAPTOPS.length + ' 台在册，当前命中 ' + results.length + ' 台' + (mustCount !== LAPTOPS.length ? '，被必选条件排除 ' + (LAPTOPS.length - mustCount) + ' 台' : '')),
      h('span', { class: 'mf-rule' }),
      h('span', null, '点击小人查看身份卡')
    );
    map.append(foot);

    // —— 状态栏 ——
    const mustN = Object.keys(state.wall).filter((k) => state.wall[k] === 'must').length;
    const wantN = Object.keys(state.wall).filter((k) => state.wall[k] === 'want').length;
    const offersTotal = W.LAPTOPS.reduce((a, x) => a + (x.channelCount || 0), 0);
    const channelMachines = W.LAPTOPS.filter((x) => x.bestOffer).length;
    $('#stats').innerHTML =
      '命中 <b>' + results.length + '</b> / ' + LAPTOPS.length + ' 台' +
      (state.budgetMax ? ' · 预算 ≤ <b>' + fmt(state.budgetMax) + '</b>' : '') +
      ' · 必须 <span class="sb-must">' + mustN + '</span> · 偏好 <b>' + wantN + '</b>' +
      ' · 数据 ' + (DATA.meta.dataDate || '—') +
      (offersTotal ? ' · 渠道 <b>' + offersTotal + '</b> 条（<b>' + channelMachines + '</b> 台）' : ' · 渠道报价待补') +
      (state.live.available ? ' · <span class="sb-live">市场价 ' + fmtClock(state.live.updatedAt) + '</span>' : '') +
      (DATA.meta.usingSeed ? ' · <span class="sb-must">种子数据</span>' : '');
    renderCompareTray();
  }

  function splitName(n) {
    const s = String(n || '');
    let i = s.indexOf('（');
    if (i > 0) return { base: s.slice(0, i), cfg: s.slice(i + 1).replace(/）\s*$/, '') };
    i = s.indexOf('(');
    if (i > 0) return { base: s.slice(0, i), cfg: s.slice(i + 1).replace(/\)\s*$/, '') };
    return { base: s, cfg: '' };
  }

  function makeCard(l, fit, idx) {
    const card = h('div', {
      class: 'laptop-card' + (idx < 3 ? ' is-top' : ''),
      dataset: { id: l.id }, tabindex: '0', role: 'button',
      title: l.name + ' · ' + fmt(l.price) + ' · ' + l.brand,
      onClick: () => openDetail(l.id),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(l.id); } },
    });
    const cv = h('canvas');
    const rank = h('span', { class: 'lc-rank' }, idx < 3 ? '#' + (idx + 1) : '');
    const nm = splitName(l.name);
    const name = h('div', { class: 'lc-name' }, nm.base);
    const cfg = h('div', { class: 'lc-cfg', title: nm.cfg }, nm.cfg || (l.category || ''));
    const price = h('div', { class: 'lc-price' }, '参考 ' + fmt(l.price));
    const bar = h('div', { class: 'lc-fit' }, h('i', { style: { width: Math.round(fit) + '%' } }));
    const cmpOn = state.compare.includes(l.id);
    const cmpBtn = h('button', {
      class: 'lc-cmp' + (cmpOn ? ' on' : ''),
      title: cmpOn ? '移出对比' : '加入对比',
      text: cmpOn ? '✓' : '+',
      onClick: (e) => { e.stopPropagation(); toggleCompare(l.id); },
    });
    card.append(cv, rank, cmpBtn, name, cfg, price);
    if (l.bestOffer) {
      card.append(h('div', { class: 'lc-shop', title: '平台活动到手价（点开看渠道详情）' },
        (l.bestOffer.storeType || l.bestOffer.platform) + ' ' + fmt(l.bestOffer.price) + (l.bestOffer.stale ? ' · 旧' : '')));
    }
    card.append(bar);
    requestAnimationFrame(() => drawCanvas(cv, l, 56, 70));
    return card;
  }

  /* ================= 详情 ================= */
  function openDetail(id) {
    const l = W.LAPTOPS.find((x) => x.id === id);
    if (!l) return;
    state.detailId = id;
    detailPanel.innerHTML = '';
    const d = h('div', { class: 'detail' });
    d.append(h('button', { class: 'drawer-close', onClick: closeDetail, title: '关闭 (Esc)' }, '✕'));

    const spriteWrap = h('div', { class: 'detail-sprite' }, h('canvas'));
    const top = h('div', { class: 'detail-top' },
      spriteWrap,
      h('div', { class: 'detail-id' },
        h('h2', { class: 'detail-name' }, l.name),
        h('div', { class: 'detail-meta' },
          h('span', { class: 'tag gold' }, l.brand),
          h('span', { class: 'tag' }, l.category || '笔记本'),
          h('span', { class: 'tag' }, W.CONTINENTS.find((c) => c.band === l.band)?.name || ''),
          h('span', { class: 'tag ' + (l.gameReady ? 'olive' : 'blood') }, '游戏：' + (l.gameLevel || (l.gameReady ? '可玩' : '仅轻度'))),
          h('span', { class: 'tag ' + (l.status === '已核实' ? 'olive' : 'blood') }, l.status || '待核实')
        ),
        h('div', { class: 'detail-price' },
          h('span', { class: 'num' }, fmt(l.price)),
          h('span', { class: 'note' }, l.priceNote || '参考价（采集 ' + (DATA.meta.dataDate || '—') + '）')
        ),
        h('div', { class: 'status-line' },
          '上市 ' + (l.launchDate || '待核实') + ' · 数据采集 ' + (DATA.meta.dataDate || '—')
        ),
        h('div', { class: 'detail-actions' },
          h('button', { class: 'btn primary small', onClick: () => { toggleCompare(l.id); } }, state.compare.includes(l.id) ? '已加入对比' : '加入对比'),
          l.sourcePrice ? h('a', { class: 'btn ghost small', href: l.sourcePrice, target: '_blank', rel: 'noopener' }, '查看价格来源') : null,
          h('button', { class: 'btn ghost small', onClick: closeDetail }, '关闭')
        )
      )
    );
    d.append(top);

    // 六维
    const dims = h('div', { class: 'dims' });
    for (const key of W.DIMS) {
      const v = Math.round(l.scores[key] || 0);
      const r = l.rankInBand && l.rankInBand[key];
      dims.append(h('div', { class: 'dim' },
        h('span', { class: 'd-name' }, DIM_NAMES[key]),
        h('span', { class: 'd-bar' }, h('i', { style: { width: v + '%' } })),
        h('span', { class: 'd-val' }, String(v), r ? h('em', null, ' ' + r.rank + '/' + r.total) : null)
      ));
    }
    d.append(h('div', { class: 'detail-section' }, h('h3', null, '六维能力（' + (l.band ? '同价位排名见小字' : '') + '）'), dims));

    // 参数
    const spec = h('div', { class: 'spec-table' });
    const rows = [
      ['处理器', l.cpu], ['显卡', l.gpu], ['内存', l.ram + (l.ramReplaceable === true ? '（可扩展）' : l.ramReplaceable === false ? '（板载）' : '')],
      ['硬盘', l.storage],
      ['屏幕', [l.screen && l.screen.size ? l.screen.size + '"' : '', l.screen && l.screen.resolution, l.screen && l.screen.refresh ? l.screen.refresh + 'Hz' : '', l.screen && l.screen.panel, l.screen && l.screen.colorGamut, l.screen && l.screen.touch ? '触控' : ''].filter(Boolean).join(' · ')],
      ['重量', l.weightKg ? l.weightKg + ' kg' : null], ['厚度', l.thicknessMm ? l.thicknessMm + ' mm' : null],
      ['电池', l.batteryWh ? l.batteryWh + ' Wh' : null],
      ['续航', l.batteryLifeH ? l.batteryLifeH + ' 小时' + (l.batteryLifeNote ? '（' + l.batteryLifeNote + '）' : '') : null],
      ['性能释放', l.performanceReleaseW ? l.performanceReleaseW + ' W' : null],
      ['接口', (l.ports || []).join(' / ')],
      ['系统', l.os], ['上市', l.launchDate],
    ];
    for (const [k, v] of rows) {
      spec.append(h('div', { class: 'spec-cell' }, h('span', { class: 'k' }, k), specVal(v)));
    }
    d.append(h('div', { class: 'detail-section' }, h('h3', null, '参数'), spec));

    // —— 购买渠道 ——
    const chSection = h('div', { class: 'detail-section' }, h('h3', null, '购买渠道（按可靠度 · 售后 · 价格排序）'));
    if (l.offers && l.offers.length) {
      const list = h('div', { class: 'channel-list' });
      for (const o of l.offers) {
        const platformCls = o.platform === '京东' ? 'jd' : o.platform === '天猫' ? 'tm' : '';
        const row = h('div', { class: 'channel-row' + (o === l.bestOffer ? ' best' : '') });
        row.append(
          h('span', { class: 'ch-badge ' + platformCls }, o.platform || '平台'),
          h('div', { class: 'ch-main' },
            h('div', { class: 'ch-store' },
              (o.storeType || '店铺类型待核实') + (o.storeName ? ' · ' + o.storeName : ''),
              o === l.bestOffer ? h('span', { class: 'ch-rec' }, '推荐') : null
            ),
            h('div', { class: 'ch-services' }, ...(o.services || []).map((s) => h('span', { class: 'tag mini' }, s))),
            o.priceNote ? h('div', { class: 'ch-pricenote' }, o.priceNote) : null
          ),
          h('div', { class: 'ch-right' },
            h('div', { class: 'ch-price' }, fmt(o.price), h('span', { class: 'ch-kind' }, o.priceKind || '到手价')),
            h('div', { class: 'ch-meta' },
              '渠道分 ' + o.score,
              ' · ' + (o.publishedAt ? String(o.publishedAt).slice(5) + ' 活动' : '日期待核实'),
              o.stale ? h('span', { class: 'ch-stale' }, '可能已变') : null,
              o.suspect ? h('span', { class: 'ch-stale' }, '时间存疑') : null
            ),
            o.priceDiff > 0
              ? h('div', { class: 'ch-diff' }, '比最低价贵 ' + fmt(o.priceDiff))
              : h('div', { class: 'ch-diff cheapest' }, '查到的最低价')
          ),
          h('div', { class: 'ch-actions' },
            o.url ? h('a', { class: 'btn primary small', href: o.url, target: '_blank', rel: 'noopener' }, '去平台看') : null,
            o.evidenceUrl ? h('a', { class: 'ch-evidence', href: o.evidenceUrl, target: '_blank', rel: 'noopener', title: '价格证据（活动快照页）' }, '证据') : null
          )
        );
        list.append(row);
      }
      chSection.append(list);
      const liveNote = state.live.available && state.live.updatedAt
        ? '本地刷新器最近抓取 ' + new Date(state.live.updatedAt).toLocaleString('zh-CN')
        : '静态快照采集 ' + (DATA.meta.dataDate || '—');
      chSection.append(h('div', { class: 'ch-note' },
        '渠道价 = 平台/店铺的近期活动到手价（' + liveNote + '），会随促销波动；下单前以平台页面为准，店铺与售后政策以平台为准。'
      ));
    } else {
      const q = encodeURIComponent(l.name);
      chSection.append(h('div', { class: 'ch-empty' },
        h('p', null, '这台暂时没有采到可验证的平台活动价。可以自己去两个官方渠道比一下：'),
        h('div', { class: 'ch-actions' },
          h('a', { class: 'btn ghost small', href: 'https://search.jd.com/Search?keyword=' + q + '&enc=utf-8', target: '_blank', rel: 'noopener' }, '京东搜同款'),
          h('a', { class: 'btn ghost small', href: 'https://s.taobao.com/search?q=' + q, target: '_blank', rel: 'noopener' }, '淘宝搜同款')
        )
      ));
    }
    d.append(chSection);

    // 优缺点
    d.append(h('div', { class: 'detail-section' },
      h('h3', null, '优点与代价'),
      h('div', { class: 'pro-con' },
        h('ul', { class: 'pro' }, ...(l.pros || []).map((x) => h('li', null, x))),
        h('ul', { class: 'con' }, ...(l.cons || []).map((x) => h('li', null, x)))
      )
    ));

    // 来源
    const src = h('div', { class: 'sources' });
    if (l.sourceSpec) src.append(h('a', { href: l.sourceSpec, target: '_blank', rel: 'noopener' }, l.sourceSpec), h('br'));
    if (l.sourcePrice) src.append(h('a', { href: l.sourcePrice, target: '_blank', rel: 'noopener' }, l.sourcePrice));
    d.append(h('div', { class: 'detail-section' },
      h('h3', null, '数据来源'),
      src,
      h('div', { class: 'status-line' }, '数据核实状态：' + (l.status || '待核实') + ' · 价格为参考到手价，随时间波动，请以购买时页面为准。')
    ));

    detailPanel.append(d);
    drawer.hidden = false;
    requestAnimationFrame(() => {
      const cv = $('canvas', spriteWrap);
      drawCanvas(cv, l, 150, 190);
    });
  }
  function closeDetail() { drawer.hidden = true; state.detailId = null; }

  /* ================= 对比 ================= */
  function toggleCompare(id) {
    const i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1);
    else {
      if (state.compare.length >= 4) { toast('最多同时对比 4 台'); return; }
      state.compare.push(id);
    }
    refreshCardCompare(id);
    renderCompareTray();
    if (state.detailId === id) openDetail(id);
    if (!compareModal.hidden) renderCompareModal();
  }

  function refreshCardCompare(id) {
    const on = state.compare.includes(id);
    $$('.laptop-card[data-id="' + id + '"] .lc-cmp').forEach((b) => {
      b.classList.toggle('on', on);
      b.textContent = on ? '✓' : '+';
      b.title = on ? '移出对比' : '加入对比';
    });
  }

  function renderCompareTray() {
    const tray = $('#compareTray');
    const ids = state.compare.map((id) => W.LAPTOPS.find((l) => l.id === id)).filter(Boolean);
    if (!ids.length) { tray.hidden = true; tray.innerHTML = ''; return; }
    tray.hidden = false;
    tray.innerHTML = '';
    tray.append(h('span', { class: 'ct-label' }, '对比栏'));
    for (const l of ids) {
      tray.append(h('span', { class: 'ct-chip' },
        l.name,
        h('button', { onClick: () => toggleCompare(l.id), title: '移除' }, '✕')
      ));
    }
    tray.append(h('button', { class: 'btn primary small', onClick: openCompare }, '开始对比（' + ids.length + '）'));
    tray.append(h('button', { class: 'btn ghost small', onClick: () => { state.compare = []; renderCompareTray(); } }, '清空'));
  }

  function openCompare() {
    if (state.compare.length < 2) { toast('至少选 2 台才能对比'); return; }
    renderCompareModal();
    compareModal.hidden = false;
  }
  function closeCompare() { compareModal.hidden = true; }

  function renderCompareModal() {
    const items = state.compare.map((id) => W.LAPTOPS.find((l) => l.id === id)).filter(Boolean);
    comparePanel.innerHTML = '';
    const head = h('div', { class: 'modal-head' },
      h('h2', null, '机型对比'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost small', onClick: closeCompare }, '关闭')
    );
    const table = h('table', { class: 'cmp' });
    const thead = h('thead', null, h('tr', null, h('th', null, '项目'), ...items.map((l) =>
      h('th', { class: 'cmp-name' }, l.name)
    )));
    const tb = h('tbody');
    const rows = [
      ['参考价', (l) => h('span', { class: 'cmp-price' }, fmt(l.price))],
      ['价位', (l) => W.CONTINENTS.find((c) => c.band === l.band)?.name || ''],
      ['品类', (l) => l.category],
      ['CPU', (l) => l.cpu],
      ['GPU', (l) => l.gpu],
      ['内存', (l) => l.ram],
      ['硬盘', (l) => l.storage],
      ['屏幕', (l) => [l.screen && l.screen.size + '"', l.screen && l.screen.resolution, l.screen && l.screen.refresh ? l.screen.refresh + 'Hz' : '', l.screen && l.screen.panel].filter(Boolean).join(' · ')],
      ['重量', (l) => l.weightKg ? l.weightKg + 'kg' : '—'],
      ['电池', (l) => l.batteryWh ? l.batteryWh + 'Wh' : '—'],
      ['续航', (l) => l.batteryHours ? Math.round(l.batteryHours * 10) / 10 + 'h' + (l.batteryEstimated ? '（推估）' : '') : '—'],
    ];
    for (const [k, fn] of rows) {
      tb.append(h('tr', null, h('th', null, k), ...items.map((l) => h('td', null, fn(l)))));
    }
    // 六维
    for (const key of W.DIMS) {
      const max = Math.max(...items.map((l) => l.scores[key]));
      const min = Math.min(...items.map((l) => l.scores[key]));
      tb.append(h('tr', null, h('th', null, DIM_NAMES[key]),
        ...items.map((l) => {
          const v = Math.round(l.scores[key]);
          return h('td', { class: v === max && max !== min ? 'cmp-best' : v === min && max !== min ? 'cmp-worst' : '' },
            String(v),
            h('div', { class: 'cmp-bar' }, h('i', { style: { width: v + '%' } }))
          );
        })
      ));
    }
    // 优缺点
    tb.append(h('tr', null, h('th', null, '优点'),
      ...items.map((l) => h('td', null, h('div', null, ...(l.pros || []).map((x) => h('div', null, '· ' + x)))))));
    tb.append(h('tr', null, h('th', null, '代价'),
      ...items.map((l) => h('td', null, h('div', null, ...(l.cons || []).map((x) => h('div', null, '· ' + x)))))));
    table.append(thead, tb);
    comparePanel.append(head, h('div', { class: 'cmp-wrap' }, table));
  }

  /* ================= 排行榜 ================= */
  function renderRank() {
    const bar = W.RANK_BARS.find((b) => b.id === state.rankBar) || W.RANK_BARS[0];
    const tb = $('#rankToolbar');
    tb.innerHTML = '';
    const barGroup = h('div', { class: 'toolbar-group' }, h('span', { class: 'tg-label' }, '榜单'));
    for (const b of W.RANK_BARS) {
      barGroup.append(h('button', {
        class: 'chip' + (state.rankBar === b.id ? ' active' : ''), title: b.desc,
        onClick: () => { state.rankBar = b.id; renderRank(); },
      }, b.label));
    }
    const bandGroup = h('div', { class: 'toolbar-group' }, h('span', { class: 'tg-label' }, '价位'));
    bandGroup.append(h('button', { class: 'chip' + (state.rankBand === 'all' ? ' active' : ''), onClick: () => { state.rankBand = 'all'; renderRank(); } }, '全部'));
    for (const c of W.CONTINENTS) {
      bandGroup.append(h('button', {
        class: 'chip' + (state.rankBand === String(c.band) ? ' active' : ''),
        onClick: () => { state.rankBand = String(c.band); renderRank(); },
      }, c.name));
    }
    const catGroup = h('div', { class: 'toolbar-group' }, h('span', { class: 'tg-label' }, '品类'));
    for (const cat of ['all', '轻薄本', '全能本', '游戏本', '二合一']) {
      catGroup.append(h('button', {
        class: 'chip' + (state.rankCat === cat ? ' active' : ''),
        onClick: () => { state.rankCat = cat; renderRank(); },
      }, cat === 'all' ? '全部' : cat));
    }
    tb.append(barGroup, bandGroup, catGroup);

    const list = W.rankList(bar.id, { band: state.rankBand, category: state.rankCat });
    const body = $('#rankBody');
    body.innerHTML = '';
    if (!list.length) { body.append(h('div', { class: 'map-empty' }, '这个组合下没有机型。')); return; }
    const listEl = h('div', { class: 'rank-list' });
    list.slice(0, 40).forEach((l, i) => {
      const value = bar.id === 'overall' ? Math.round(l.fitBase) : Math.round(l.scores[bar.id]);
      const row = h('div', { class: 'rank-row', onClick: () => openDetail(l.id), role: 'button', tabindex: '0' });
      const cv = h('canvas');
      row.append(
        h('div', { class: 'rk-no' + (i < 3 ? ' top' : '') }, '#' + (i + 1)),
        cv,
        h('div', { class: 'rk-name' }, l.name, h('em', null, l.brand + ' · ' + (l.category || '') + ' · ' + (l.cpu || ''))),
        h('div', { class: 'rk-price' }, fmt(l.price)),
        h('div', { class: 'rk-bar' }, h('i', { style: { width: value + '%' } })),
        h('div', { class: 'rk-tags' }, ...badgeList(l).map((b) => h('span', { class: 'tag' }, b))),
        h('div', { class: 'rk-score' }, String(value))
      );
      requestAnimationFrame(() => drawCanvas(cv, l, 40, 48));
      listEl.append(row);
    });
    body.append(
      h('p', { class: 'page-sub', style: { margin: '0 0 10px' } }, bar.desc + ' · 共 ' + list.length + ' 台，展示前 ' + Math.min(list.length, 40) + ' 台'),
      listEl
    );
  }

  /* ================= 时间线 ================= */
  function renderTimeline() {
    const body = $('#timelineBody');
    body.innerHTML = '';
    const withDate = LAPTOPS.filter((l) => l.launchDate);
    const without = LAPTOPS.filter((l) => !l.launchDate);
    if (!LAPTOPS.length) { body.append(h('div', { class: 'tl-empty' }, '暂无数据')); return; }
    const groups = {};
    for (const l of withDate) {
      const key = String(l.launchDate).slice(0, 7);
      (groups[key] = groups[key] || []).push(l);
    }
    const keys = Object.keys(groups).sort().reverse();
    for (const k of keys) {
      const items = groups[k].sort((a, b) => a.price - b.price);
      const month = h('div', { class: 'tl-month' });
      month.append(h('div', { class: 'tl-month-label' }, k.replace('-', ' 年 ') + ' 月'));
      const wrap = h('div', { class: 'tl-items' });
      for (const l of items) {
        const card = h('div', { class: 'tl-card', onClick: () => openDetail(l.id), title: l.name });
        const cv = h('canvas');
        card.append(cv, h('div', null,
          h('div', { class: 'tl-name' }, l.name),
          h('div', { class: 'tl-meta' }, fmt(l.price) + ' · ' + (l.category || '') + ' · ' + (l.brand || ''))
        ));
        requestAnimationFrame(() => drawCanvas(cv, l, 34, 42));
        wrap.append(card);
      }
      month.append(wrap);
      body.append(month);
    }
    if (without.length) {
      body.append(h('div', { class: 'tl-empty' }, '另有 ' + without.length + ' 台上市时间待核实，未上时间线。'));
    }
  }

  /* ================= 选购须知 ================= */
  function renderGuide() {
    const k = DATA.knowledge || {};
    const body = $('#guideBody');
    body.innerHTML = '';
    (k.specBaseline || []).forEach(() => { });

    if ((k.specBaseline || []).length) {
      const GROUPS = [
        ['humanities', '📖 文科 / 商科'],
        ['cs', '⌨ 计算机编程'],
        ['media', '🎬 数字媒体 / 剪辑'],
        ['design', '🎨 设计 / 建模'],
        ['gaming', '🎮 游戏'],
        ['ai', '🧠 AI 深度学习'],
        ['engineering', '📐 工程制图'],
      ];
      const nav = h('div', { class: 'guide-nav' });
      const wrap = h('div', { class: 'guide-groups' });
      for (const [gid, gname] of GROUPS) {
        const items = k.specBaseline.filter((s) => String(s.id).split('-')[0] === gid);
        if (!items.length) continue;
        const subId = 'guide-g-' + gid;
        nav.append(h('button', {
          class: 'chip',
          onClick: () => {
            const el = document.getElementById(subId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        }, gname));
        wrap.append(h('div', { class: 'guide-subhead', id: subId },
          h('h3', null, gname),
          h('span', { class: 'guide-subcount' }, items.length + ' 档')
        ));
        const grid = h('div', { class: 'guide-grid' });
        for (const s of items) {
          const ms = s.minSpec || {};
          const card = h('div', { class: 'panel rivets guide-card' },
            h('h3', null, s.label),
            h('p', { class: 'why' }, s.why || ''),
            h('p', { class: 'spec-line', html: Object.entries(ms).map(([kk, vv]) => `<b>${esc(SPEC_NAMES[kk] || kk)}：</b>${esc(vv)}`).join('<br>') }),
            s.upgradeHint ? h('p', { class: 'hint' }, '加钱优先：' + s.upgradeHint) : null
          );
          const rec = recStrip(s.id);
          if (rec) card.append(rec);
          grid.append(card);
        }
        wrap.append(grid);
      }
      body.append(h('section', { class: 'guide-section' }, h('h2', null, '一、规格底线：各类专业该买什么'), nav, wrap));
    }

    if ((k.pitfalls || []).length) {
      const list = h('div', { class: 'pitfall-list' });
      for (const p of k.pitfalls) {
        const sev = p.severity === 'high' ? 'high' : p.severity === 'medium' ? 'medium' : 'low';
        list.append(h('div', { class: 'pitfall sev-' + sev },
          h('div', null,
            h('div', { class: 'pf-title' }, p.title),
            h('div', { class: 'pf-detail' }, p.detail)
          ),
          h('span', { class: 'pf-tag' }, (p.appliesTo && p.appliesTo !== 'all' ? String(p.appliesTo).replace('band', '') + ' 档 · ' : '') + ({ high: '高危', medium: '注意', low: '留意' }[sev] || ''))
        ));
      }
      body.append(h('section', { class: 'guide-section' }, h('h2', null, '二、避坑清单'), list));
    }

    const t = k.timing || {};
    const timingMap = [['bestWindows', '什么时候买'], ['channels', '在哪买'], ['subsidy', '补贴与教育优惠'], ['warranty', '售后与保修']];
    if (timingMap.some(([kk]) => (t[kk] || []).length)) {
      const cols = h('div', { class: 'timing-cols' });
      for (const [kk, label] of timingMap) {
        if (!(t[kk] || []).length) continue;
        cols.append(h('div', { class: 'timing-col' }, h('h3', null, label),
          h('ul', null, ...t[kk].map((x) => h('li', null, x)))));
      }
      body.append(h('section', { class: 'guide-section' }, h('h2', null, '三、购买时机与渠道'), cols));
    }

    if ((k.glossary || []).length) {
      const g = h('div', { class: 'glossary' });
      for (const item of k.glossary) {
        g.append(h('div', { class: 'gloss-item' },
          h('div', { class: 'gt' }, item.term),
          h('div', { class: 'gp' }, item.plain)));
      }
      body.append(h('section', { class: 'guide-section' }, h('h2', null, '四、参数黑话翻译'), g));
    }

    // 五、在哪买：平台与店铺怎么排
    const tierCards = h('div', { class: 'channel-tiers' }, ...CHANNEL_TIERS.map((t) => h('div', { class: 'channel-tier panel rivets' },
      h('div', { class: 'ct-head' },
        h('span', { class: 'ct-name' }, t.name),
        h('span', { class: 'ct-score' }, String(t.score)),
        h('span', { class: 'ct-tag ' + (t.tag === '谨慎' ? 'warn' : '') }, t.tag)
      ),
      h('p', { class: 'ct-line pros' }, '✓ ' + t.pros),
      h('p', { class: 'ct-line cons' }, '× ' + t.cons),
      h('p', { class: 'ct-tip' }, t.tip)
    )));
    const checklist = h('div', { class: 'channel-checklist' },
      h('h3', null, '下单前只查这 5 件事'),
      h('ul', null, ...CHANNEL_CHECKLIST.map((x) => h('li', null, x)))
    );
    body.append(h('section', { class: 'guide-section' },
      h('h2', null, '五、在哪买：平台与店铺可靠性排序'),
      h('p', { class: 'guide-intro' },
        '同样的机器，不同渠道的价格和售后差别很大。机型详情页的「购买渠道」按三部分打分：',
        h('b', null, ' 平台/店铺档位（权威可靠）+ 售后条款 + 价格竞争力'),
        '，再扣掉活动过期的时效分。渠道分高 ≠ 一定最便宜，它是「省心程度」的排序。'),
      tierCards,
      checklist
    ));

    if ((k.sources || []).length) {
      body.append(h('section', { class: 'guide-section' },
        h('h2', null, '资料来源'),
        h('div', { class: 'guide-sources', html: k.sources.map((s) => `<div>· <a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></div>`).join('') })
      ));
    }
    if (!body.children.length) body.append(h('div', { class: 'map-empty' }, '内容知识库尚未生成。'));
  }
  const SPEC_NAMES = { cpu: '处理器', ram: '内存', storage: '硬盘', gpu: '显卡', screen: '屏幕', ports: '接口', weight: '重量' };

  // 渠道可靠性档位（权威可靠 + 售后），与 engine 里的评分规则保持一致
  const CHANNEL_TIERS = [
    { name: '京东自营', score: 96, tag: '最稳', pros: '京东负责售后，退换/价保响应快；京东物流；多数支持 7 天无理由', cons: '价格通常要蹲活动，日常价偏高', tip: '学生党稳妥首选：出问题找京东，不用和品牌扯皮。' },
    { name: '天猫官方旗舰店', score: 90, tag: '官方', pros: '品牌直营，正品与售后有保障；88VIP / 学生优惠常可叠加', cons: '物流看品牌，价保政策不如京东统一', tip: '认准「官方旗舰店」四个字，别把专卖店当旗舰店。' },
    { name: '京东品牌官方旗舰店', score: 86, tag: '官方', pros: '品牌授权直营，京东物流', cons: '售后主体是品牌，不如京东自营爽快', tip: '价格常比自营低一档，适合做比价参照。' },
    { name: '品牌官网 / 直营', score: 85, tag: '官方', pros: '教育优惠最正规，配置可定制', cons: '发货慢、退换流程长，价格通常不低', tip: '苹果 / 华为等教育优惠走官网最稳。' },
    { name: '京东第三方专营店', score: 62, tag: '谨慎', pros: '价格可能更低，有京东平台兜底', cons: '售后由店铺负责，非自营发货，翻新 / 样机风险高', tip: '只买「京东物流发货 + 7 天无理由 + 全国联保」的店。' },
    { name: '淘宝店铺 / 拼多多', score: 55, tag: '谨慎', pros: '价格最低，常有平台补贴', cons: '售后最难，店铺跑路与翻新机风险较高', tip: '除非你有验机能力，否则大件不建议押在这里。' },
  ];
  const CHANNEL_CHECKLIST = [
    '是不是「京东自营」或「品牌官方旗舰店」——不是就再想想',
    '商品页是否写明「7 天无理由」与「全国联保」',
    '是否支持价保（双 11 / 双 12 前后的差价能退）',
    '国补 / 学生优惠能否叠加，结算页实付到底多少',
    '发票类型、发货方、退换货地址（异地寄修要算时间成本）',
  ];

  // 选购须知每一档的“直接用”推荐规则（筛选条件 + 排序权重 + 预算上限）
  const GUIDE_RECS = {
    'humanities-basic': { wall: { band1: 'must', band2: 'must', w18: 'want', b8: 'want', oled: 'want' }, budgetMax: 6000,
      weights: { perf: 0.08, portable: 0.3, screen: 0.18, battery: 0.24, expand: 0.08, value: 0.12 } },
    'humanities-heavy': { wall: { m32: 'must', color: 'want', b8: 'want' }, budgetMax: 9000,
      weights: { perf: 0.12, portable: 0.22, screen: 0.24, battery: 0.16, expand: 0.14, value: 0.12 } },
    'cs-basic': { wall: { w18: 'want', m32: 'want', b8: 'want' }, budgetMax: 8000,
      weights: { perf: 0.24, portable: 0.18, screen: 0.14, battery: 0.1, expand: 0.24, value: 0.1 } },
    'cs-fullstack': { wall: { m32: 'must', tb: 'want', st1t: 'want' }, budgetMax: 12000,
      weights: { perf: 0.26, portable: 0.12, screen: 0.14, battery: 0.08, expand: 0.28, value: 0.12 } },
    'cs-ai': { wall: { gpu: 'must', m32: 'want', st1t: 'want' }, budgetMax: 20000,
      weights: { perf: 0.32, portable: 0.04, screen: 0.18, battery: 0.06, expand: 0.24, value: 0.16 } },
    'media-basic': { wall: { color: 'must', gpu: 'want', m32: 'want', b8: 'want' }, budgetMax: 8000,
      weights: { perf: 0.2, portable: 0.16, screen: 0.26, battery: 0.1, expand: 0.14, value: 0.14 } },
    'media-pro': { wall: { gpu: 'must', color: 'must', m32: 'want', st1t: 'want', k2: 'want' }, budgetMax: 12000,
      weights: { perf: 0.28, portable: 0.05, screen: 0.33, battery: 0.07, expand: 0.17, value: 0.1 } },
    'media-color': { wall: { gpu: 'must', color: 'must', m32: 'must', k2: 'want' }, budgetMax: 20000,
      weights: { perf: 0.28, portable: 0.03, screen: 0.36, battery: 0.05, expand: 0.18, value: 0.1 } },
    'design-2d': { wall: { color: 'must', m32: 'want', k2: 'want' }, budgetMax: 10000,
      weights: { perf: 0.16, portable: 0.16, screen: 0.34, battery: 0.08, expand: 0.12, value: 0.14 } },
    'design-3d': { wall: { gpu: 'must', color: 'must', k2: 'must', m32: 'want' }, budgetMax: 15000,
      weights: { perf: 0.3, portable: 0.04, screen: 0.32, battery: 0.06, expand: 0.18, value: 0.1 } },
    'gaming-3a': { wall: { gpu: 'must', hz: 'must', m32: 'want' }, budgetMax: 20000,
      weights: { perf: 0.42, portable: 0.03, screen: 0.24, battery: 0.05, expand: 0.12, value: 0.14 } },
    'gaming-esports': { wall: { gpu: 'must', hz: 'must' }, budgetMax: 12000,
      weights: { perf: 0.34, portable: 0.05, screen: 0.3, battery: 0.05, expand: 0.12, value: 0.14 } },
    'gaming-stream': { wall: { gpu: 'must', m32: 'want', lan: 'want' }, budgetMax: 15000,
      weights: { perf: 0.32, portable: 0.03, screen: 0.22, battery: 0.05, expand: 0.2, value: 0.18 } },
    'ai-infer': { wall: { gpu: 'must', m32: 'want' }, budgetMax: 15000,
      weights: { perf: 0.3, portable: 0.04, screen: 0.18, battery: 0.06, expand: 0.22, value: 0.2 } },
    'ai-finetune': { wall: { gpu: 'must', m32: 'must', st1t: 'want' }, budgetMax: 25000,
      weights: { perf: 0.36, portable: 0.02, screen: 0.2, battery: 0.04, expand: 0.22, value: 0.16 } },
    'engineering-2d': { wall: { w18: 'want', b8: 'want', color: 'want' }, budgetMax: 7000,
      weights: { perf: 0.16, portable: 0.26, screen: 0.2, battery: 0.18, expand: 0.12, value: 0.08 } },
    'engineering-3d': { wall: { gpu: 'want', m32: 'want', k2: 'want', lan: 'want' }, budgetMax: 12000,
      weights: { perf: 0.28, portable: 0.08, screen: 0.28, battery: 0.08, expand: 0.18, value: 0.1 } },
  };

  function recStrip(specId) {
    const rule = GUIDE_RECS[specId];
    if (!rule) return null;
    let ev;
    try {
      ev = W.evaluate({ wall: rule.wall || {}, weights: rule.weights || null, maxPrice: rule.budgetMax || 0 });
    } catch (e) { return null; }
    const list = W.sortResults(ev.results, rule.sort || 'fit').slice(0, rule.limit || 3);
    if (!list.length) return null;
    const strip = h('div', { class: 'rec-strip' });
    for (const { l, fit } of list) {
      const card = h('div', { class: 'rec-card', title: l.name, onClick: () => openDetail(l.id) });
      const cv = h('canvas');
      const nm = splitName(l.name);
      card.append(
        cv,
        h('div', { class: 'rec-name' }, nm.base),
        h('div', { class: 'rec-fit' }, '匹配 ' + Math.round(fit)),
        h('div', { class: 'rec-price' }, '参考 ' + fmt(l.price))
      );
      if (l.bestOffer) card.append(h('div', { class: 'rec-channel' }, l.bestOffer.storeType + ' ' + fmt(l.bestOffer.price)));
      requestAnimationFrame(() => drawCanvas(cv, l, 40, 50));
      strip.append(card);
    }
    return h('div', { class: 'rec-block' },
      h('div', { class: 'rec-head' },
        h('span', null, '这一档直接看'),
        h('em', null, rule.budgetMax ? '预算 ≤ ' + fmt(rule.budgetMax) : '按匹配度')
      ),
      strip,
      h('button', { class: 'rec-all btn ghost small', onClick: () => applyRecToWorld(rule) }, '在世界里看这一档全部 →')
    );
  }

  function applyRecToWorld(rule) {
    state.wall = {};
    for (const k in (rule.wall || {})) state.wall[k] = rule.wall[k];
    state.budgetMax = rule.budgetMax || null;
    state.preset = null;
    store.set('preset', null);
    store.set('budgetMax', state.budgetMax);
    saveWall();
    renderFilters();
    setView('world');
    renderWorld();
    toast('已按这一档的条件筛好，可在世界页继续微调');
  }

  /* ================= 视图 ================= */
  function setView(v) {
    state.view = v;
    $$('.view').forEach((el) => el.classList.toggle('active', el.id === 'view-' + v));
    $$('#viewTabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    if (v === 'rank') renderRank();
    if (v === 'timeline') renderTimeline();
    if (v === 'guide') renderGuide();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================= 实时价格（本地刷新器） ================= */
  const LIVE_API = 'http://127.0.0.1:8787';

  function fmtClock(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return '—'; }
  }

  function updateLiveUI() {
    const btn = $('#liveBtn');
    if (!btn) return;
    if (state.live.running) {
      const p = state.live.progress || {};
      btn.textContent = '刷新中 ' + (p.done || 0) + '/' + (p.total || 64);
      btn.classList.add('busy'); btn.classList.remove('live');
      btn.title = '正在抓取市场价…';
      return;
    }
    btn.classList.remove('busy');
    if (!state.live.available) {
      btn.textContent = '市场价 · 快照';
      btn.classList.remove('live');
      btn.title = '双击项目里「启动实时价格.bat」后可获取最新市场价，并可点此刷新';
      return;
    }
    btn.classList.add('live');
    btn.textContent = '市场价 ' + fmtClock(state.live.updatedAt) + ' ⟳';
    btn.title = '点一下重新抓取市场价（约 1-2 分钟）';
  }

  async function fetchLiveJSON(path, opts) {
    const o = opts || {};
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeout || 1500);
    try {
      const r = await fetch(LIVE_API + path, {
        method: o.method || 'GET', signal: ctrl.signal,
      });
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function loadLivePrices() {
    const j = await fetchLiveJSON('/api/prices', { timeout: 5000 });
    if (!j || !Array.isArray(j.items)) return 0;
    const map = {};
    for (const it of j.items) if (it.laptopId && it.offers && it.offers.length) map[it.laptopId] = it.offers;
    const n = W.applyChannels(map);
    state.live.updatedAt = j.updatedAt || null;
    state.live.available = true;
    if (n) {
      renderWorld();
      if (state.view === 'rank') renderRank();
      if (state.detailId) openDetail(state.detailId);
    }
    return n;
  }

  async function probeLive() {
    try {
      const st = await fetchLiveJSON('/api/status', { timeout: 1800 });
      if (!st || !st.ok) return;
      state.live.available = true;
      if (st.running) {
        state.live.running = true;
        state.live.progress = st.progress;
        updateLiveUI();
        pollRefresh();
      }
      await loadLivePrices();
      state.live.stale = !!st.stale;
      updateLiveUI();
      if (st.stale && !st.running) {
        toast('市场价超过 30 分钟，正在自动刷新…');
        triggerRefresh(true);
      }
    } catch (e) { updateLiveUI(); }
  }

  async function triggerRefresh(auto) {
    if (!state.live.available) {
      toast('实时刷新需要先双击项目里的「启动实时价格.bat」');
      return;
    }
    if (state.live.running) return;
    try {
      const r = await fetchLiveJSON('/api/refresh', { method: 'POST', timeout: 4000 });
      if (r && r.ok) {
        state.live.running = true; state.live.progress = { done: 0, total: 64 };
        updateLiveUI();
        toast(auto ? '正在抓取最新市场价…' : '开始刷新，约 1-2 分钟');
        pollRefresh();
      } else {
        toast((r && r.error) || '刷新启动失败');
      }
    } catch (e) {
      toast('刷新服务未响应，请确认「启动实时价格.bat」窗口还在');
    }
  }

  async function pollRefresh() {
    if (!state.live.running) return;
    try {
      const st = await fetchLiveJSON('/api/status', { timeout: 3000 });
      state.live.progress = st.progress || state.live.progress;
      state.live.running = !!st.running;
      updateLiveUI();
      if (!st.running) {
        const n = await loadLivePrices();
        state.live.stale = false;
        updateLiveUI();
        toast(n ? '市场价已刷新：' + n + ' 台有报价' : '刷新完成，但没匹配到新报价');
        return;
      }
    } catch (e) { }
    setTimeout(pollRefresh, 1500);
  }

  /* ================= 守夜人开场 ================= */
  function initGreet() {
    const modal = $('#greet');
    if (!modal) return;
    const img = $('#greetAvatar');
    if (img && window.__AVATAR__) img.src = window.__AVATAR__;
    const close = () => { modal.hidden = true; };
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close="greet"]')) close();
    });
    const enter = $('#greetEnter');
    if (enter) enter.addEventListener('click', close);
    const mark = $('.brand-mark');
    if (mark) {
      mark.title = '守夜人：Raven·Jackdaw · 点这里再看一次';
      mark.addEventListener('click', () => { modal.hidden = false; });
    }
    // 每次打开都出现；带深链接（分享的筛选/详情）时不打扰
    if (!location.hash || /(^|[#&])greet/.test(location.hash)) modal.hidden = false;
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    $('#liveBtn').addEventListener('click', () => triggerRefresh(false));
    $('#themeBtn').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      store.set('theme', state.theme);
      applyTheme();
      drawBanner();
      renderWorld();
      if (state.view === 'rank') renderRank();
      if (state.view === 'timeline') renderTimeline();
    });
    $('#viewTabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b) setView(b.dataset.view);
    });
    let st = null;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(st);
      st = setTimeout(() => { state.search = e.target.value; renderWorld(); }, 130);
    });
    $('#filterToggle').addEventListener('click', () => {
      $('#filters').classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close="detail"]')) closeDetail();
      if (e.target.matches('[data-close="compare"]')) closeCompare();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDetail(); closeCompare();
        const g = $('#greet'); if (g) g.hidden = true;
        $('#filters').classList.remove('open');
      }
    });
    // 任何交互后同步到 #hash（链接可分享：同一份 HTML + hash 即复现筛选）
    let hashTimer = null;
    const scheduleHash = () => { clearTimeout(hashTimer); hashTimer = setTimeout(syncHash, 60); };
    document.addEventListener('click', scheduleHash, true);
    document.addEventListener('input', scheduleHash, true);
    document.addEventListener('keydown', () => scheduleHash(), true);
    // 视口变化时重绘横幅
    let bannerTimer = null;
    window.addEventListener('resize', () => { clearTimeout(bannerTimer); bannerTimer = setTimeout(drawBanner, 180); });

    // 回顶部
    const toTop = h('button', {
      class: 'to-top', title: '回到顶部', text: '↑',
      onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    });
    toTop.hidden = true;
    document.body.append(toTop);
    window.addEventListener('scroll', () => { toTop.hidden = window.scrollY < 520; }, { passive: true });

    // “/” 聚焦搜索
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement && document.activeElement.tagName) || '')) {
        e.preventDefault();
        $('#search').focus();
      }
    });
    // 排序选择器
    const sortWrap = $('#sortbar');
    sortWrap.append(h('span', { class: 'tg-label' }, '排列方式'));
    for (const s of W.SORTS) {
      sortWrap.append(h('button', {
        class: 'chip' + (state.sort === s.id ? ' active' : ''),
        dataset: { sort: s.id },
        onClick: () => {
          state.sort = s.id; store.set('sort', s.id);
          $$('#sortbar .chip').forEach((c) => c.classList.toggle('active', c.dataset.sort === s.id));
          renderWorld();
        },
      }, s.label));
    }
  }

  /* ================= 初始化 ================= */
  function init() {
    readHash();
    applyTheme();
    $('#dataDate').textContent = DATA.meta.dataDate || '—';
    $('#dataCount').textContent = String(LAPTOPS.length);
    if (state.search) $('#search').value = state.search;
    renderFilters();
    bind();
    setView(state.view || 'world');
    renderWorld();
    drawBanner();
    initGreet();
    updateLiveUI();
    probeLive();
    if (state.detailId) setTimeout(() => openDetail(state.detailId), 40);
    if (state.compare.length >= 2) setTimeout(openCompare, 120);
    if (DATA.meta.usingSeed) toast('当前为种子数据（开发用），尚未载入真实机型');
    // 布局自检探针（#debug）：把溢出元素写进 <title>，方便无头浏览器抓取
    if (String(location.hash || '').includes('debug')) {
      setTimeout(() => {
        const vw = document.documentElement.clientWidth;
        const sw = document.documentElement.scrollWidth;
        const bad = Array.from(document.querySelectorAll('body *'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter((x) => x.r.right > vw + 1 && x.r.width > 30)
          .slice(0, 10)
          .map((x) => (x.el.tagName + '.' + String(x.el.className || '')).slice(0, 44) + '|w' + Math.round(x.r.width) + '|r' + Math.round(x.r.right));
        document.title = 'DBG vw=' + vw + ' sw=' + sw + ' :: ' + (bad.join(' ;; ') || 'none');
      }, 700);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
