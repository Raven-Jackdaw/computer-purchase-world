/* ============================================================
   引擎：档位映射 / 六维打分 / 筛选条件 / 排序
   —— 纯计算，不碰 DOM
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.__DATA__ || { meta: {}, laptops: [], knowledge: {} };
  const LAPTOPS = Array.isArray(DATA.laptops) ? DATA.laptops.slice() : [];

  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  const has = (s, re) => re.test(s || '');

  /* ---------- 连续性表述 ---------- */
  function parseResolution(res) {
    const m = String(res || '').match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})/);
    if (!m) return 0;
    return parseInt(m[1], 10) * parseInt(m[2], 10);
  }
  function lifeToScore(h) {
    return clamp(8 + (h - 3) * 8.5, 8, 97);
  }
  function hexA(hex, a) {
    const h = String(hex || '').replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(v || 'c8a45c', 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------- CPU / GPU 档位 ---------- */
  const CPU_RULES = [
    { re: /麒麟\s*x90|kirin\s*x90/i, tier: 3.6 },
    { re: /麒麟|kirin/i, tier: 3.0 },
    { re: /m\d+\s*(max|ultra)/i, tier: 6.0 },
    { re: /m\d+\s*pro/i, tier: 5.4 },
    { re: /m\d+/i, tier: 4.8 },
    { re: /core\s*ultra\s*9.*hx/i, tier: 6.0 },
    { re: /core\s*ultra\s*9/i, tier: 5.2 },
    { re: /core\s*ultra\s*7.*hx/i, tier: 5.4 },
    { re: /core\s*ultra\s*7/i, tier: 4.6 },
    { re: /core\s*ultra\s*5.*hx/i, tier: 4.6 },
    { re: /core\s*ultra\s*5/i, tier: 3.8 },
    { re: /ryzen\s*ai\s*9.*hx/i, tier: 5.0 },
    { re: /ryzen\s*ai\s*9/i, tier: 4.8 },
    { re: /ryzen\s*ai\s*7/i, tier: 4.2 },
    { re: /ryzen\s*ai\s*5/i, tier: 3.4 },
    { re: /i9.*hx/i, tier: 5.6 },
    { re: /i7.*hx/i, tier: 5.0 },
    { re: /i9/i, tier: 4.8 },
    { re: /i7/i, tier: 4.0 },
    { re: /i5.*hx/i, tier: 4.4 },
    { re: /i5/i, tier: 3.2 },
    { re: /i3/i, tier: 2.2 },
    { re: /ryzen\s*9.*hx/i, tier: 5.8 },
    { re: /ryzen\s*9/i, tier: 5.0 },
    { re: /ryzen\s*7.*hx/i, tier: 5.2 },
    { re: /ryzen\s*7/i, tier: 4.2 },
    { re: /ryzen\s*5.*hx/i, tier: 4.6 },
    { re: /ryzen\s*5/i, tier: 3.4 },
    { re: /snapdragon\s*x\s*elite/i, tier: 4.2 },
    { re: /snapdragon/i, tier: 3.0 },
  ];
  function cpuTier(cpu) {
    const s = String(cpu || '');
    for (const r of CPU_RULES) if (r.re.test(s)) return r.tier;
    return 3.0;
  }

  const GPU_RULES = [
    { re: /rtx\s*50\s*90/i, tier: 5.2 },
    { re: /rtx\s*50\s*80/i, tier: 4.7 },
    { re: /rtx\s*50\s*70/i, tier: 4.2 },
    { re: /rtx\s*50\s*60/i, tier: 3.4 },
    { re: /rtx\s*50\s*50/i, tier: 2.6 },
    { re: /rtx\s*40\s*90/i, tier: 4.6 },
    { re: /rtx\s*40\s*80/i, tier: 4.4 },
    { re: /rtx\s*40\s*70/i, tier: 3.8 },
    { re: /rtx\s*40\s*60/i, tier: 3.2 },
    { re: /rtx\s*40\s*50/i, tier: 2.4 },
    { re: /rtx\s*30\s*90/i, tier: 4.2 },
    { re: /rtx\s*30\s*80/i, tier: 4.0 },
    { re: /rtx\s*30\s*70/i, tier: 3.4 },
    { re: /rtx\s*30\s*60/i, tier: 2.8 },
    { re: /rtx\s*30\s*50/i, tier: 2.2 },
    { re: /arc\s*(140v|130v|1[34]0v)/i, tier: 1.9 },
    { re: /(890m|880m|780m|760m)/i, tier: 1.8 },
    { re: /(arc|iris\s*xe|radeon\s*8\d0m)/i, tier: 1.4 },
  ];
  function gpuTier(l) {
    const s = `${l.gpu || ''} ${l.gpuType || ''}`;
    for (const r of GPU_RULES) if (r.re.test(s)) return r.tier;
    if (has(l.gpuType, /核显|集成/)) return 1.0;
    if (has(l.gpuType, /入门/)) return 2.4;
    if (has(l.gpuType, /甜品/)) return 3.2;
    if (has(l.gpuType, /高端/)) return 4.4;
    return 1.0;
  }

  /* ---------- 六维打分 ---------- */
  function batteryHours(l) {
    if (num(l.batteryLifeH, 0) > 0) return l.batteryLifeH;
    const wh = num(l.batteryWh, 0) || 50;
    const drain = 3 + cpuTier(l.cpu) * 0.55 + gpuTier(l) * 1.7;
    return wh / drain;
  }

  function rawScores(l) {
    const cpuT = cpuTier(l.cpu);
    const gpuT = gpuTier(l);
    const s = l.screen || {};
    const size = num(s.size, 15);
    const weight = num(l.weightKg, 2.0);
    const thick = num(l.thicknessMm, 20);
    const px = parseResolution(s.resolution);
    const hz = num(s.refresh, 60);
    const gamut = String(s.colorGamut || '').toLowerCase();
    const ports = (l.ports || []).join(' ');

    // 性能
    let perf = (cpuT / 6) * 100 * 0.55 + (gpuT / 5) * 100 * 0.45;
    if (num(l.performanceReleaseW, 0) > 0) perf += clamp((l.performanceReleaseW - 45) * 0.3, -6, 12);
    perf = clamp(perf, 5, 100);

    // 便携（16 寸大屏不致命，重量与厚度才是主罚项）
    let portable = 100 - Math.max(0, weight - 1.0) * 45 - Math.max(0, thick - 12) * 1.0 - Math.max(0, size - 14) * 4;
    portable = clamp(portable, 5, 100);

    // 屏幕
    let screen = 0;
    screen += px >= 5000000 ? 26 : px >= 3600000 ? 21 : px >= 2000000 ? 12 : 6;
    screen += hz >= 165 ? 20 : hz >= 144 ? 18 : hz >= 120 ? 15 : hz >= 90 ? 9 : 0;
    screen += has(s.panel, /oled/i) ? 24 : has(s.panel, /miniled/i) ? 20 : has(s.panel, /ips/i) ? 10 : 6;
    screen += has(gamut, /dci-?p3/) ? 15 : has(gamut, /100\s*%.*srgb/) ? 12 : gamut ? 6 : 0;
    screen += s.touch ? 4 : 0;
    screen = clamp(screen, 5, 100);

    // 续航
    const bh = batteryHours(l);
    const battery = lifeToScore(bh);

    // 扩展
    let expand = 25;
    if (has(ports, /雷电|thunderbolt|usb4/i)) expand += 18;
    const usbC = (ports.match(/usb-?c/gi) || []).length;
    expand += Math.min(usbC, 3) * 3;
    if (has(ports, /usb-?a/i)) expand += 8;
    if (has(ports, /hdmi/i)) expand += 7;
    if (has(ports, /sd|读卡器/i)) expand += 6;
    if (has(ports, /网口|rj45/i)) expand += 5;
    if (has(ports, /3\.5mm/i)) expand += 3;
    if (l.ramReplaceable === true) expand += 12;
    if (num(l.storageGB, 0) >= 1024) expand += 4;
    expand = clamp(expand, 5, 100);

    return { perf, portable, screen, battery, expand };
  }

  /* ---------- 用途地形 / 大陆 ---------- */
  const TERRAINS = [
    { id: 'library', name: '藏书阁', sub: '学习办公', icon: '📖' },
    { id: 'workshop', name: '工坊', sub: '创作设计', icon: '⚒' },
    { id: 'arena', name: '竞技场', sub: '游戏', icon: '⚔' },
    { id: 'inn', name: '旅店', sub: '全能通用', icon: '🛏' },
  ];
  const CONTINENTS = [
    { band: 1, name: '学徒区', range: '≤ ¥4,499', sub: '入门之土 · 够用就好' },
    { band: 2, name: '主力区', range: '¥4,500 – 5,999', sub: '学生主战场 · 卷得最凶' },
    { band: 3, name: '进阶区', range: '¥6,000 – 7,999', sub: '性能与创作的边缘' },
    { band: 4, name: '秘境', range: '≥ ¥8,000', sub: '此处物价高，慎入' },
  ];

  function assignTerrain(l) {
    const cat = l.category || '';
    const g = gpuTier(l);
    const gamut = String((l.screen && l.screen.colorGamut) || '').toLowerCase();
    const creativeScreen = has(gamut, /dci-?p3|100\s*%.*srgb/) || has(l.screen && l.screen.panel, /oled/i);
    if (cat === '游戏本') return 'arena';
    if (cat === '二合一') return 'inn';
    if (cat === '创作本') return 'workshop';
    if (cat === '全能本') return (g >= 2.0 || creativeScreen) ? 'workshop' : 'inn';
    // 轻薄本：有独显 → 工坊；配置高/好屏 → 旅店（全能通用）；基础款 → 藏书阁
    if (g >= 2.0) return 'workshop';
    const highSpec = num(l.ramGB, 0) >= 32 || (l.scores && l.scores.screen >= 68);
    return highSpec ? 'inn' : 'library';
  }

  /* ---------- 预处理 ---------- */
  const byId = new Map();
  for (const l of LAPTOPS) {
    l.cpuTier = cpuTier(l.cpu);
    l.gpuTier = gpuTier(l);
    l.batteryHours = batteryHours(l);
    l.batteryEstimated = !(num(l.batteryLifeH, 0) > 0);
    l.screenPx = parseResolution(l.screen && l.screen.resolution);
    l.band = l.band || 1;
    l.terrain = assignTerrain(l);
    l.scores = rawScores(l);
    l.price = num(l.price, 0);
    byId.set(l.id, l);
  }

  // 性价比：综合能力 / 价格，按全库百分位
  const comp = LAPTOPS.map((l) => {
    const s = l.dimRaw || {};
    const composite = (l.scores.perf * 0.45 + l.scores.screen * 0.2 + l.scores.battery * 0.15 + l.scores.portable * 0.2);
    return { id: l.id, ratio: composite / Math.max(l.price, 1000) };
  });
  comp.sort((a, b) => a.ratio - b.ratio);
  const n = Math.max(comp.length - 1, 1);
  comp.forEach((c, i) => { byId.get(c.id).scores.value = clamp(Math.round((i / n) * 100), 1, 100); });

  // 同价位段排名
  const DIMS = ['perf', 'portable', 'screen', 'battery', 'expand', 'value'];
  for (const l of LAPTOPS) l.rankInBand = {};
  for (const d of DIMS) {
    const sorted = LAPTOPS.slice().sort((a, b) => b.scores[d] - a.scores[d]);
    const bandCount = {};
    for (const l of LAPTOPS) bandCount[l.band] = (bandCount[l.band] || 0) + 1;
    const seenIdx = {};
    for (const l of sorted) {
      seenIdx[l.band] = (seenIdx[l.band] || 0) + 1;
      l.rankInBand[d] = { rank: seenIdx[l.band], total: bandCount[l.band] };
    }
  }

  // 基础匹配度（默认权重）
  const BASE_W = { perf: 0.28, portable: 0.2, screen: 0.18, battery: 0.14, expand: 0.1, value: 0.1 };
  function baseFit(l) {
    let s = 0;
    for (const k in BASE_W) s += l.scores[k] * BASE_W[k];
    return clamp(s, 0, 100);
  }
  for (const l of LAPTOPS) l.fitBase = baseFit(l);

  /* ---------- 渠道报价评分 ---------- */
  // 权威可靠（平台/店铺档位）+ 售后（服务标签）+ 价格竞争力 - 时效惩罚
  const CHANNEL_BASE = {
    '京东自营': 32, '京东官方旗舰店': 27, '天猫官方旗舰店': 28, '天猫自营': 25, '天猫店铺': 22,
    '品牌官网': 30, '京东第三方': 10, '淘宝店铺': 8, '拼多多百亿补贴': 9, '未知': 5,
  };
  const SERVICE_PTS = {
    '国补': 4, '学生认证': 3, 'PLUS会员': 2, '88VIP': 2, '白条免息': 2, '以旧换新': 2,
    '晒单返现': 1, '赠品': 1, '京东物流': 6, '7天无理由': 8, '运费险': 3, '上门服务': 5, '全国联保': 8,
  };
  function channelScore(offer, minPrice) {
    const base = CHANNEL_BASE[offer.storeType] != null ? CHANNEL_BASE[offer.storeType] : CHANNEL_BASE['未知'];
    let svc = 0;
    for (const s of offer.services || []) svc += SERVICE_PTS[s] || 0;
    svc = Math.min(svc, 20);
    const pricePts = minPrice > 0 && offer.price > 0 ? clamp(15 * (minPrice / offer.price), 0, 15) : 0;
    let penalty = 0;
    if (offer.stale) penalty += 12;
    if (offer.suspect) penalty += 18;
    if (offer.status === '待核实') penalty += 6;
    else if (offer.status === '部分待核实') penalty += 3;
    return Math.round(clamp(30 + base + svc + pricePts - penalty, 0, 100));
  }
  function applyOfferScoring(l, offers) {
    if (!Array.isArray(offers) || !offers.length) {
      l.offers = []; l.bestOffer = null; l.lowestPrice = null; l.lowestPriceOffer = null; l.channelCount = 0;
      return;
    }
    const valid = offers.filter((o) => Number(o.price) > 0).map((o) => ({ ...o }));
    if (!valid.length) {
      l.offers = []; l.bestOffer = null; l.lowestPrice = null; l.lowestPriceOffer = null; l.channelCount = 0;
      return;
    }
    const minPrice = Math.min(...valid.map((o) => Number(o.price)));
    for (const o of valid) {
      o.price = Number(o.price);
      o.score = channelScore(o, minPrice);
      o.priceDiff = o.price - minPrice;
    }
    valid.sort((a, b) => b.score - a.score || a.price - b.price);
    l.offers = valid;
    l.bestOffer = valid[0];
    l.lowestPrice = minPrice;
    l.lowestPriceOffer = valid.slice().sort((a, b) => a.price - b.price)[0];
    l.channelCount = valid.length;
  }
  for (const l of LAPTOPS) applyOfferScoring(l, l.offers);
  // 运行时热更新（本地实时价格服务返回新报价时调用）
  function applyChannels(map) {
    if (!map) return 0;
    let n = 0;
    for (const l of LAPTOPS) {
      if (map[l.id] && map[l.id].length) { applyOfferScoring(l, map[l.id]); n++; }
    }
    return n;
  }

  /* ---------- 勾选条件定义 ---------- */
  const FILTER_GROUPS = [
    {
      id: 'budget', label: '预算大陆', mode: 'band', hint: '多选为「或」关系，不选=全部',
      items: CONTINENTS.map((c) => ({ id: 'band' + c.band, label: c.name, band: c.band, pred: (l) => l.band === c.band })),
    },
    {
      id: 'perf', label: '性能', items: [
        { id: 'gpu', label: '要独显', dim: 'perf', pred: (l) => l.gpuTier >= 2.2 },
        { id: 'release', label: '性能释放 ≥80W', dim: 'perf', pred: (l) => num(l.performanceReleaseW, 0) >= 80 },
        { id: 'hz', label: '高刷 ≥120Hz', dim: 'screen', pred: (l) => num(l.screen && l.screen.refresh, 60) >= 120 },
      ],
    },
    {
      id: 'portable', label: '便携', items: [
        { id: 'w14', label: '轻于 1.4kg', dim: 'portable', pred: (l) => num(l.weightKg, 9) <= 1.4 },
        { id: 'w18', label: '轻于 1.8kg', dim: 'portable', pred: (l) => num(l.weightKg, 9) <= 1.8 },
        { id: 's14', label: '14 英寸及以下', dim: 'portable', pred: (l) => num(l.screen && l.screen.size, 99) <= 14.1 },
        { id: 's16', label: '16 英寸及以上', dim: 'screen', pred: (l) => num(l.screen && l.screen.size, 0) >= 15.9 },
      ],
    },
    {
      id: 'screen', label: '屏幕', items: [
        { id: 'oled', label: 'OLED', dim: 'screen', pred: (l) => has(l.screen && l.screen.panel, /oled/i) },
        { id: 'color', label: '高色域', dim: 'screen', pred: (l) => has(String((l.screen && l.screen.colorGamut) || '').toLowerCase(), /dci-?p3|100\s*%.*srgb/) },
        { id: 'k2', label: '2.5K 以上', dim: 'screen', pred: (l) => l.screenPx >= 3500000 },
        { id: 'touch', label: '触控', dim: 'screen', pred: (l) => !!(l.screen && l.screen.touch) },
      ],
    },
    {
      id: 'mem', label: '内存 / 硬盘', items: [
        { id: 'm32', label: '32GB 内存', dim: 'expand', pred: (l) => num(l.ramGB, 0) >= 32 },
        { id: 'mup', label: '内存可扩展', dim: 'expand', pred: (l) => l.ramReplaceable === true },
        { id: 'st1t', label: '1TB 硬盘', dim: 'expand', pred: (l) => num(l.storageGB, 0) >= 1024 },
      ],
    },
    {
      id: 'io', label: '接口', items: [
        { id: 'tb', label: '雷电 / USB4', dim: 'expand', pred: (l) => has((l.ports || []).join(' '), /雷电|thunderbolt|usb4/i) },
        { id: 'hdmi', label: 'HDMI', dim: 'expand', pred: (l) => has((l.ports || []).join(' '), /hdmi/i) },
        { id: 'sd', label: 'SD 读卡器', dim: 'expand', pred: (l) => has((l.ports || []).join(' '), /sd|读卡器/i) },
        { id: 'lan', label: '有线网口', dim: 'expand', pred: (l) => has((l.ports || []).join(' '), /网口|rj45/i) },
      ],
    },
    {
      id: 'battery', label: '续航', items: [
        { id: 'b8', label: '≥8 小时', dim: 'battery', pred: (l) => l.batteryHours >= 8 },
        { id: 'b12', label: '≥12 小时', dim: 'battery', pred: (l) => l.batteryHours >= 12 },
      ],
    },
    {
      id: 'platform', label: '平台 / 系统', items: [
        { id: 'win', label: 'Windows', dim: null, bonus: 2, pred: (l) => has(l.os, /windows/i) },
        { id: 'mac', label: 'macOS', dim: null, bonus: 3, pred: (l) => has(l.os, /macos/i) },
        { id: 'intel', label: 'Intel', dim: null, bonus: 1, pred: (l) => has(l.cpuBrand, /intel/i) },
        { id: 'amd', label: 'AMD', dim: null, bonus: 1, pred: (l) => has(l.cpuBrand, /amd/i) },
        { id: 'apple', label: 'Apple 芯片', dim: null, bonus: 2, pred: (l) => has(l.cpuBrand, /apple/i) },
        { id: 'kirin', label: '华为麒麟', dim: null, bonus: 1, pred: (l) => has(l.cpu, /麒麟|kirin/i) },
        { id: 'qualcomm', label: '高通骁龙', dim: null, bonus: 1, pred: (l) => has(l.cpu, /骁龙|snapdragon/i) },
      ],
    },
    {
      id: 'extra', label: '其他', items: [
        { id: 'face', label: '人脸识别', dim: null, bonus: 2, pred: (l) => has((l.special || []).join(' '), /人脸|面部|face/i) },
        { id: 'backlit', label: '背光键盘', dim: null, bonus: 1, pred: (l) => has((l.special || []).join(' '), /背光/i) },
        { id: 'convertible', label: '二合一', dim: null, bonus: 2, pred: (l) => l.category === '二合一' },
        { id: 'thin', label: '厚度 ≤16mm', dim: 'portable', pred: (l) => num(l.thicknessMm, 99) <= 16 },
      ],
    },
  ];

  // 品牌组：从数据动态生成
  const brands = Array.from(new Set(LAPTOPS.map((l) => l.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh'));
  FILTER_GROUPS.push({
    id: 'brand', label: '品牌', items: brands.map((b) => ({
      id: 'b-' + b, label: b, dim: null, bonus: 3, pred: (l) => l.brand === b,
    })),
  });

  const FILTER_INDEX = {};
  for (const g of FILTER_GROUPS) for (const it of g.items) FILTER_INDEX[it.id] = { ...it, group: g.id };

  /* ---------- 速选方案（快速档） ---------- */
  const PRESETS = [
    { id: 'office', label: '📚 学习办公', wall: { w18: 'must', b8: 'must', 'band1': 'must', 'band2': 'must' }, uses: '文档、网课、PPT、查资料，轻便优先，预算压在一万以内',
      weights: { perf: 0.08, portable: 0.3, screen: 0.18, battery: 0.24, expand: 0.08, value: 0.12 } },
    { id: 'coder', label: '⌨ 写代码', wall: { w18: 'must', m32: 'want', mup: 'want', tb: 'want', b8: 'want' }, uses: 'IDE、Docker、多开虚拟机，内存与接口优先（32G 是加分不是硬门槛）',
      weights: { perf: 0.24, portable: 0.18, screen: 0.14, battery: 0.1, expand: 0.24, value: 0.1 } },
    { id: 'editor', label: '🎬 剪视频', wall: { color: 'must', gpu: 'want', m32: 'want', st1t: 'want', hdmi: 'want' }, uses: 'Pr / AE / 达芬奇，色域是硬门槛，独显与内存是加分项（Mac 也能剪）',
      weights: { perf: 0.3, portable: 0.06, screen: 0.3, battery: 0.08, expand: 0.16, value: 0.1 } },
    { id: 'designer', label: '🎨 设计建模', wall: { gpu: 'must', color: 'must', k2: 'must', m32: 'want' }, uses: 'PS / Blender / CAD，显存、色域、分辨率都是硬指标',
      weights: { perf: 0.3, portable: 0.04, screen: 0.32, battery: 0.06, expand: 0.18, value: 0.1 } },
    { id: 'gamer', label: '🎮 打游戏', wall: { gpu: 'must', hz: 'must', release: 'want', 'band3': 'must', 'band4': 'must' }, uses: '高帧率与性能释放，屏幕刷新率不能省',
      weights: { perf: 0.4, portable: 0.03, screen: 0.24, battery: 0.05, expand: 0.14, value: 0.14 } },
    { id: 'commute', label: '🎒 天天背', wall: { w14: 'must', b8: 'must', s14: 'want', oled: 'want', b12: 'want' }, uses: '教室—宿舍—图书馆三点一线，重量和续航第一',
      weights: { perf: 0.1, portable: 0.34, screen: 0.16, battery: 0.26, expand: 0.06, value: 0.08 } },
  ];

  /* ---------- 排序 ---------- */
  const SORTS = [
    { id: 'fit', label: '匹配度' },
    { id: 'value', label: '性价比' },
    { id: 'perf', label: '性能' },
    { id: 'portable', label: '便携' },
    { id: 'screen', label: '屏幕' },
    { id: 'battery', label: '续航' },
    { id: 'expand', label: '扩展' },
    { id: 'price-asc', label: '价格 ↑' },
    { id: 'price-desc', label: '价格 ↓' },
  ];

  /* ---------- 评估 ---------- */
  function wallOf(wall) { return wall || {}; }

  function matchMust(l, wall) {
    for (const fid in wall) {
      if (wall[fid] !== 'must') continue;
      const it = FILTER_INDEX[fid];
      if (!it || it.band) continue;
      if (!it.pred(l)) return false;
    }
    return true;
  }

  function bandsSelected(wall) {
    const set = new Set();
    for (const fid in wall) {
      const it = FILTER_INDEX[fid];
      if (it && it.band && wall[fid]) set.add(it.band);
    }
    return set;
  }

  function fitFor(l, wall, bands, weights) {
    const w = { ...(weights || BASE_W) };
    let bonus = 0;
    for (const fid in wall) {
      if (!wall[fid]) continue;
      const it = FILTER_INDEX[fid];
      if (!it) continue;
      if (it.band) continue;
      const st = wall[fid];
      const mult = st === 'must' ? 1.0 : 0.6;
      if (it.dim && w[it.dim] != null) w[it.dim] += 0.07 * mult;
      if (it.bonus) bonus += it.bonus * mult;
      // 偏好项：命中就给一点硬加分，让「偏好」真的体现在排序上
      if (st === 'want' && typeof it.pred === 'function' && it.pred(l)) bonus += 3.5;
    }
    let sum = 0;
    for (const k in w) sum += w[k];
    let s = 0;
    for (const k in w) s += (l.scores[k] || 0) * (w[k] / sum);
    return clamp(s + bonus, 0, 100);
  }

  /**
   * 评估全库
   * @param {object} opts {wall, search, bands}
   * @returns {matched, mustCount, byId}
   */
  function evaluate(opts) {
    const wall = wallOf(opts.wall);
    const bands = bandsSelected(wall);
    const q = String(opts.search || '').trim().toLowerCase();
    const maxPrice = Number(opts.maxPrice) > 0 ? Number(opts.maxPrice) : 0;
    const weights = opts.weights || null;
    const results = [];
    let mustCount = 0;
    for (const l of LAPTOPS) {
      if (bands.size && !bands.has(l.band)) continue;
      if (maxPrice && l.price > maxPrice) continue;
      if (!matchMust(l, wall)) continue;
      mustCount++;
      if (q) {
        const hay = [l.name, l.brand, l.series, l.cpu, l.gpu, l.category, (l.special || []).join(' '), l.os].join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }
      results.push({ l, fit: fitFor(l, wall, bands, weights) });
    }
    return { results, mustCount, total: LAPTOPS.length, bands };
  }

  function sortResults(results, mode) {
    const arr = results.slice();
    const by = {
      fit: (a, b) => b.fit - a.fit,
      value: (a, b) => b.l.scores.value - a.l.scores.value || b.fit - a.fit,
      perf: (a, b) => b.l.scores.perf - a.l.scores.perf,
      portable: (a, b) => b.l.scores.portable - a.l.scores.portable,
      screen: (a, b) => b.l.scores.screen - a.l.scores.screen,
      battery: (a, b) => b.l.scores.battery - a.l.scores.battery,
      expand: (a, b) => b.l.scores.expand - a.l.scores.expand,
      'price-asc': (a, b) => a.l.price - b.l.price,
      'price-desc': (a, b) => b.l.price - a.l.price,
    }[mode] || ((a, b) => b.fit - a.fit);
    return arr.sort(by);
  }

  /* ---------- 榜单 ---------- */
  const RANK_BARS = [
    { id: 'overall', label: '综合实力', desc: '性能、屏幕、便携、续航、扩展、性价比的默认权重合成分' },
    { id: 'value', label: '性价比', desc: '同价位「能力 / 价格」百分位，穷学生的第一生产力' },
    { id: 'perf', label: '性能', desc: 'CPU 档位 + 显卡档位 + 性能释放修正' },
    { id: 'portable', label: '便携', desc: '重量、厚度、屏幕尺寸共同决定' },
    { id: 'screen', label: '屏幕', desc: '分辨率、刷新率、面板、色域、触控' },
    { id: 'battery', label: '续航', desc: '有实测/标称用标称，否则按电池容量与功耗推估（会标注）' },
    { id: 'expand', label: '扩展', desc: '接口、内存可换性、硬盘容量' },
  ];

  function rankList(bar, opts) {
    opts = opts || {};
    let list = LAPTOPS.slice();
    if (opts.band && opts.band !== 'all') list = list.filter((l) => l.band === opts.band);
    if (opts.category && opts.category !== 'all') list = list.filter((l) => l.category === opts.category);
    const key = bar === 'overall' ? 'fitBase' : 'scores';
    if (bar !== 'overall') list.sort((a, b) => b.scores[bar] - a.scores[bar]);
    else list.sort((a, b) => b.fitBase - a.fitBase);
    return list;
  }

  /* ---------- 本季格局 ---------- */
  function highlights() {
    const all = LAPTOPS.slice();
    if (!all.length) return [];
    const pick = (arr, key) => arr.slice().sort((a, b) => key(b) - key(a))[0];
    const out = [];
    const cheapestValue = pick(all, (l) => l.scores.value);
    out.push({ kind: '最值得买', l: cheapestValue, why: () => `性价比 ${cheapestValue.scores.value}/100 · 同价位价值榜首 · 参考价 ¥${cheapestValue.price.toLocaleString()}` });
    const lightest = all.slice().sort((a, b) => num(a.weightKg, 9) - num(b.weightKg, 9))[0];
    out.push({ kind: '最轻', l: lightest, why: () => `${lightest.weightKg}kg · ${num(lightest.screen && lightest.screen.size, 0)} 英寸 · 参考价 ¥${lightest.price.toLocaleString()}` });
    const strongest = pick(all, (l) => l.scores.perf);
    out.push({ kind: '最猛', l: strongest, why: () => `性能 ${Math.round(strongest.scores.perf)}/100 · ${strongest.cpu} · 参考价 ¥${strongest.price.toLocaleString()}` });
    const bestScreen = pick(all, (l) => l.scores.screen);
    out.push({ kind: '屏最好', l: bestScreen, why: () => `屏幕 ${Math.round(bestScreen.scores.screen)}/100 · ${bestScreen.screen && bestScreen.screen.resolution} ${bestScreen.screen && bestScreen.screen.panel} · 参考价 ¥${bestScreen.price.toLocaleString()}` });
    const editor = pick(all, (l) => l.scores.perf * 0.45 + l.scores.screen * 0.3 + l.scores.expand * 0.15 + l.scores.battery * 0.1);
    out.push({ kind: '适合剪片', l: editor, why: () => `性能 ${Math.round(editor.scores.perf)} · 屏幕 ${Math.round(editor.scores.screen)} · 参考价 ¥${editor.price.toLocaleString()}` });
    return out;
  }

  /* ---------- 工具 ---------- */
  function fmtPrice(p) {
    if (!p) return '待核实';
    return '¥' + Math.round(Number(p)).toLocaleString('zh-CN');
  }
  function dimLabel(l, d) {
    const r = l.rankInBand && l.rankInBand[d];
    if (!r) return '';
    return `同价位 ${r.rank}/${r.total}`;
  }
  function brandColor(brand) {
    const map = {
      '联想': '#c8102e', '华硕': '#00539b', '惠普': '#0096d6', '戴尔': '#0076ce',
      '宏碁': '#83b81a', '小米': '#ff6900', '红米': '#ff6900', '华为': '#c7000b',
      '荣耀': '#00a0e9', '苹果': '#a8a8a8', '机械革命': '#e60012', '神舟': '#1a5fb4',
      '微星': '#ff0000', '雷蛇': '#44d62c', '微软': '#7fba00', 'ThinkPad': '#c8102e',
      'ROG': '#ff003c', '玩家国度': '#ff003c', '外星人': '#21d4fd',
    };
    return map[brand] || '#c8a45c';
  }

  window.W = {
    DATA, LAPTOPS, CONTINENTS, TERRAINS, DIMS, FILTER_GROUPS, FILTER_INDEX, PRESETS, SORTS, RANK_BARS,
    cpuTier, gpuTier, evaluate, sortResults, rankList, highlights, fmtPrice, dimLabel, clamp, num, hexA, brandColor,
    channelScore, applyChannels,
  };
})();
