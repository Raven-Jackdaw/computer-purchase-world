/* ============================================================
   剪影小人生成器 v2
   灵感：暗黑地牢的高对比剪影 + 饥荒的拟人比例
   每台电脑 = 一个「头是屏幕、身是键盘」的小人
   外观全部由机型数据推导，不依赖任何图片素材
   ============================================================ */
(function () {
  'use strict';

  const CW = 96, CH = 120;

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePalette(l, theme) {
    const brand = (window.W && window.W.brandColor ? window.W.brandColor(l.brand) : '#c8a45c');
    if (theme === 'light') {
      return {
        ink: '#241c13', inkSoft: 'rgba(36,28,19,.72)', silhouette: '#3b2e21', silhouette2: '#54432e',
        shadow: 'rgba(90,70,35,.25)', metal: '#7a5c2e', metalHi: '#a98643',
        rim: 'rgba(120,90,45,.45)', glow: brand, backdrop: 'rgba(255,246,225,.75)',
      };
    }
    return {
      ink: '#070605', inkSoft: 'rgba(7,6,5,.75)', silhouette: '#171310', silhouette2: '#2a2118',
      shadow: 'rgba(0,0,0,.6)', metal: '#6a5230', metalHi: '#d8b878',
      rim: 'rgba(240,205,145,.42)', glow: brand, backdrop: 'rgba(200,164,92,.17)',
    };
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function outline(ctx, color, width) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function rimGlow(ctx, drawFn, pal, width) {
    ctx.save();
    ctx.strokeStyle = pal.rim;
    ctx.lineWidth = width || 3;
    ctx.lineJoin = 'round';
    drawFn();
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 武器（显卡档位） ---------- */
  function drawWeapon(ctx, gpuTier, x, y, pal, rnd) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.38 + (rnd() - 0.5) * 0.1);
    const blade = (len, wid, tier) => {
      rimGlow(ctx, () => poly(ctx, [[-1, 2], [wid + 1, -len], [wid * 2 + 2, -len + 3], [wid + 2, 4]]), pal, 2.6);
      ctx.fillStyle = tier >= 4.4 ? pal.metalHi : pal.metal;
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2;
      poly(ctx, [[-1, 2], [wid, -len], [wid * 2 + 1, -len + 3], [wid + 1, 4]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      poly(ctx, [[wid * 0.5, 0], [wid * 1.2, -len * 0.8], [wid * 1.35, -len * 0.78], [wid * 0.75, -2]]);
      ctx.fill();
      ctx.fillStyle = pal.silhouette2;
      rr(ctx, -4, 0, wid * 2 + 8, 5, 1.6); ctx.fill(); ctx.stroke();
    };
    if (gpuTier >= 4.4) blade(52, 5.4, 5);
    else if (gpuTier >= 3.0) blade(40, 4.2, 4);
    else if (gpuTier >= 2.0) blade(24, 3.6, 3);
    else {
      rimGlow(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(3, -26); }, pal, 3.4);
      ctx.strokeStyle = pal.metal; ctx.lineWidth = 2.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(3, -26); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,235,190,.4)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0.8, 2); ctx.lineTo(3.6, -24); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 提灯（屏幕素质） ---------- */
  function drawLantern(ctx, screen, x, y, pal, rnd) {
    const strength = Math.max(0.25, Math.min(1, (screen - 25) / 70));
    const rad = 16 + strength * 20;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, rad);
    glow.addColorStop(0, 'rgba(255,236,190,' + (0.55 + strength * 0.3).toFixed(2) + ')');
    glow.addColorStop(0.45, 'rgba(255,206,120,.20)');
    glow.addColorStop(1, 'rgba(255,206,120,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x, y - 8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,226,160,.95)';
    rr(ctx, x - 4.2, y - 8, 8.4, 12, 2); ctx.fill(); outline(ctx, pal.ink, 1.2);
    ctx.strokeStyle = pal.inkSoft; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 8); ctx.lineTo(x + 4, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3); ctx.stroke();
  }

  /* ---------- 背包（接口丰富度） ---------- */
  function drawBag(ctx, portsCount, pal) {
    if (portsCount < 4) return;
    rimGlow(ctx, () => rr(ctx, 64, 74, 16, 20, 4), pal, 2.2);
    ctx.fillStyle = pal.silhouette2;
    rr(ctx, 64, 74, 16, 20, 4); ctx.fill(); outline(ctx, pal.ink, 1.2);
    ctx.strokeStyle = pal.metalHi; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(67, 79); ctx.lineTo(77, 79); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(67, 84); ctx.lineTo(75, 84); ctx.stroke();
    ctx.strokeStyle = pal.metal; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(64, 80); ctx.quadraticCurveTo(57, 78, 55, 72); ctx.stroke();
  }

  /* ---------- 水壶（电池） ---------- */
  function drawFlask(ctx, batteryHours, pal) {
    if (batteryHours < 4) return;
    ctx.fillStyle = pal.silhouette2;
    rr(ctx, 20, 94, 8, 12, 2.6); ctx.fill(); outline(ctx, pal.ink, 1.1);
    ctx.fillStyle = pal.metalHi;
    rr(ctx, 22, 90, 4, 4, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(21, 97); ctx.lineTo(27, 97); ctx.stroke();
  }

  /* ---------- 头饰（品类） ---------- */
  function drawHeadgear(ctx, category, pal, headX, headY, headW) {
    const cx = headX + headW / 2;
    if (/游戏本/.test(category)) {
      rimGlow(ctx, () => {
        poly(ctx, [[headX + 3, headY + 2], [headX - 9, headY - 16], [headX + 9, headY - 7]]);
        poly(ctx, [[headX + headW - 3, headY + 2], [headX + headW + 9, headY - 16], [headX + headW - 9, headY - 7]]);
      }, pal, 2.6);
      ctx.fillStyle = pal.silhouette2;
      poly(ctx, [[headX + 3, headY + 2], [headX - 9, headY - 16], [headX + 9, headY - 7]]); ctx.fill(); outline(ctx, pal.ink, 1.2);
      poly(ctx, [[headX + headW - 3, headY + 2], [headX + headW + 9, headY - 16], [headX + headW - 9, headY - 7]]); ctx.fill(); outline(ctx, pal.ink, 1.2);
      ctx.fillStyle = pal.metalHi;
      ctx.beginPath(); ctx.arc(headX - 5, headY - 12, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(headX + headW + 5, headY - 12, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (/二合一/.test(category)) {
      rimGlow(ctx, () => { ctx.beginPath(); ctx.ellipse(cx, headY - 6, 17, 5, 0, 0, Math.PI * 2); }, pal, 3);
      ctx.strokeStyle = pal.metalHi; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, headY - 6, 17, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = pal.metal; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(cx, headY - 6, 17, 5, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (/创作/.test(category)) {
      ctx.fillStyle = pal.silhouette2;
      poly(ctx, [[headX + 2, headY + 1], [cx, headY - 11], [headX + headW - 2, headY + 1], [headX + headW - 5, headY - 2], [headX + 5, headY - 2]]);
      ctx.fill(); outline(ctx, pal.ink, 1.2);
      ctx.strokeStyle = pal.metalHi; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(cx, headY - 10); ctx.lineTo(cx, headY - 2); ctx.stroke();
    }
  }

  /* ---------- 主绘制 ---------- */
  function drawSprite(canvas, laptop, opts) {
    if (!canvas || !laptop) return;
    opts = opts || {};
    const theme = opts.theme || 'dark';
    const pal = makePalette(laptop, theme);
    const l = laptop;
    const rnd = mulberry32(hashStr(String(l.id || l.name || 'x')));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = opts.width || 64, cssH = opts.height || 80;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = canvas.width / CW, sy = canvas.height / CH;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const size = Number(l.screen && l.screen.size) || 14;
    const weight = Number(l.weightKg) || 1.8;
    const price = Number(l.price) || 5000;
    const band = l.band || (price <= 4499 ? 1 : price <= 5999 ? 2 : price <= 7999 ? 3 : 4);
    const perf = (l.scores && l.scores.perf) || 50;
    const screenScore = (l.scores && l.scores.screen) || 50;
    const gpuT = (window.W && window.W.gpuTier) ? window.W.gpuTier(l) : 1;
    const battH = l.batteryHours || 6;
    const portsN = (l.ports || []).length;
    const jitter = () => (rnd() - 0.5) * 0.9;

    const headW = 32 + (Math.min(Math.max(size, 12), 18) - 12) * 2.6;
    const headH = headW * 0.72;
    const headX = 48 - headW / 2;
    const headY = 36 - headH / 2;
    const bodyW = 28 + Math.min(Math.max(weight, 1.0), 3.0) * 5.5;
    const bodyY = 72;
    const bodyH = 28;

    // 背景烛光（让剪影从暗底里浮出来）
    const bg = ctx.createRadialGradient(48, 64, 3, 48, 64, 46);
    bg.addColorStop(0, pal.backdrop);
    bg.addColorStop(0.55, theme === 'light' ? 'rgba(255,246,225,.35)' : 'rgba(200,164,92,.06)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);

    // 地面阴影
    ctx.fillStyle = pal.shadow;
    ctx.beginPath(); ctx.ellipse(48, 112, 24 + bodyW * 0.22, 4.8, 0, 0, Math.PI * 2); ctx.fill();

    // 排名光环（同价位性能前 3）
    const rank = l.rankInBand && l.rankInBand.perf ? l.rankInBand.perf.rank : 99;
    if (rank <= 3) {
      const g = ctx.createRadialGradient(48, 112, 2, 48, 112, 38);
      g.addColorStop(0, theme === 'light' ? 'rgba(160,120,50,.28)' : 'rgba(200,164,92,.26)');
      g.addColorStop(1, 'rgba(200,164,92,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(48, 112, 38, 13, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---- 披风 / 外衣（价格档） ----
    const cloakColors = {
      1: { fill: theme === 'light' ? '#6d5c44' : '#2b2119', trim: pal.metal },
      2: { fill: theme === 'light' ? '#5e6a3e' : '#33301c', trim: pal.metal },
      3: { fill: theme === 'light' ? '#74403a' : '#46221d', trim: pal.metalHi },
      4: { fill: theme === 'light' ? '#8a6c38' : '#4c3a1c', trim: pal.metalHi },
    };
    const cloak = cloakColors[band] || cloakColors[2];
    rimGlow(ctx, () => poly(ctx, [[48 - bodyW / 2 - 6, 74], [48 + bodyW / 2 + 6, 74], [48 + bodyW / 2 + 12, 106], [48 - bodyW / 2 - 12, 106]]), pal, 2.4);
    ctx.fillStyle = cloak.fill;
    poly(ctx, [[48 - bodyW / 2 - 6, 74], [48 + bodyW / 2 + 6, 74], [48 + bodyW / 2 + 12, 106], [48 - bodyW / 2 - 12, 106]]);
    ctx.fill(); outline(ctx, pal.ink, 1.8);
    ctx.strokeStyle = cloak.trim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(48 - bodyW / 2 - 4, 79); ctx.lineTo(48 + bodyW / 2 + 4, 79); ctx.stroke();

    // ---- 腿 ----
    ctx.strokeStyle = pal.silhouette; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(42, 100); ctx.lineTo(41 + jitter(), 112); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(54, 100); ctx.lineTo(55 + jitter(), 112); ctx.stroke();
    ctx.fillStyle = pal.silhouette2; outline(ctx, pal.ink, 1);
    rr(ctx, 35.5, 109.5, 10, 4, 1.4); ctx.fill(); ctx.stroke();
    rr(ctx, 50.5, 109.5, 10, 4, 1.4); ctx.fill(); ctx.stroke();

    // ---- 键盘身体 ----
    rimGlow(ctx, () => rr(ctx, 48 - bodyW / 2, bodyY, bodyW, bodyH, 3), pal, 2.6);
    ctx.fillStyle = pal.silhouette;
    rr(ctx, 48 - bodyW / 2, bodyY, bodyW, bodyH, 3); ctx.fill(); outline(ctx, pal.ink, 1.8);
    // 键帽
    ctx.fillStyle = theme === 'light' ? 'rgba(36,28,19,.30)' : 'rgba(216,184,120,.26)';
    const kx = 48 - bodyW / 2 + 3.5, kw = bodyW - 7;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const kw2 = kw / 4 - 1.4;
        rr(ctx, kx + col * (kw2 + 1.4), bodyY + 5 + row * 6, kw2, 4, 0.8); ctx.fill();
      }
    }
    // 触控板
    ctx.fillStyle = theme === 'light' ? 'rgba(36,28,19,.22)' : 'rgba(216,184,120,.18)';
    rr(ctx, 48 - 7, bodyY + 21.4, 14, 3.6, 1); ctx.fill();
    // 品牌徽记
    ctx.save();
    ctx.translate(48, bodyY + 2.5);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = pal.glow;
    ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
    ctx.strokeStyle = pal.metalHi; ctx.lineWidth = 0.7;
    ctx.strokeRect(-2.2, -2.2, 4.4, 4.4);
    ctx.restore();

    // ---- 手臂 ----
    const armLx = 48 - bodyW / 2 - 4, armRx = 48 + bodyW / 2 + 4;
    ctx.strokeStyle = pal.silhouette; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(armLx, bodyY + 6); ctx.lineTo(armLx - 9, 94); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(armRx, bodyY + 6); ctx.lineTo(armRx + 7, 66); ctx.stroke();
    ctx.fillStyle = pal.silhouette2; outline(ctx, pal.ink, 0.9);
    ctx.beginPath(); ctx.arc(armLx - 9, 94, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(armRx + 7, 66, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // ---- 配件 ----
    drawLantern(ctx, screenScore, armLx - 10, 94, pal, rnd);
    drawWeapon(ctx, gpuT, armRx + 8, 66, pal, rnd);
    drawBag(ctx, portsN, pal);
    drawFlask(ctx, battH, pal);
    drawHeadgear(ctx, l.category, pal, headX, headY, headW);

    // ---- 脖子 ----
    ctx.strokeStyle = pal.silhouette; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(48, bodyY + 2); ctx.lineTo(48, bodyY - 2); ctx.stroke();

    // ---- 屏幕头 ----
    rimGlow(ctx, () => rr(ctx, headX - 1.5, headY - 1.5, headW + 3, headH + 3, 3), pal, 3);
    ctx.fillStyle = pal.silhouette;
    rr(ctx, headX, headY, headW, headH, 2.8); ctx.fill(); outline(ctx, pal.ink, 2);
    // 屏幕辉光
    const inset = 3.4;
    const glowG = ctx.createLinearGradient(headX, headY, headX + headW, headY + headH);
    glowG.addColorStop(0, theme === 'light' ? 'rgba(138,106,51,.30)' : 'rgba(255,226,170,.16)');
    glowG.addColorStop(0.55, theme === 'light' ? 'rgba(255,255,255,.30)' : 'rgba(200,164,92,.10)');
    glowG.addColorStop(1, theme === 'light' ? 'rgba(138,106,51,.10)' : 'rgba(155,34,38,.10)');
    ctx.fillStyle = glowG;
    rr(ctx, headX + inset, headY + inset, headW - inset * 2, headH - inset * 2, 1.8); ctx.fill();
    // 眼睛
    const eyeY = headY + headH * 0.46;
    const eyeGap = headW * 0.21;
    const eW = 2.8 + Math.min(perf / 100, 1) * 1.8;
    const eH = 2.4 + Math.min(perf / 100, 1) * 1.6;
    ctx.fillStyle = pal.glow;
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.ellipse(48 - eyeGap, eyeY, eW, eH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(48 + eyeGap, eyeY, eW, eH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 嘴
    ctx.strokeStyle = pal.inkSoft; ctx.lineWidth = 1.1;
    ctx.beginPath();
    if (band >= 4) ctx.arc(48, eyeY + headH * 0.16, 3.8, 0.25, Math.PI - 0.25);
    else if (band === 1) { ctx.moveTo(44.5, eyeY + headH * 0.24); ctx.lineTo(51.5, eyeY + headH * 0.24); }
    else ctx.arc(48, eyeY + headH * 0.15, 3.4, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // 屏幕边框
    ctx.strokeStyle = pal.metal; ctx.lineWidth = 0.9;
    rr(ctx, headX + inset - 0.6, headY + inset - 0.6, headW - (inset - 0.6) * 2, headH - (inset - 0.6) * 2, 2); ctx.stroke();
    // 屏幕高光
    ctx.strokeStyle = theme === 'light' ? 'rgba(255,255,255,.6)' : 'rgba(255,240,205,.22)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(headX + 3, headY + headH - 4); ctx.lineTo(headX + headW * 0.45, headY + 3.4); ctx.stroke();

    // 手绘抖动描边（版画粗糙感）
    ctx.strokeStyle = theme === 'light' ? 'rgba(36,28,19,.18)' : 'rgba(230,220,200,.08)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(headX + jitter(), headY + jitter());
    ctx.lineTo(headX + jitter(), headY + headH + jitter());
    ctx.lineTo(headX + headW + jitter(), headY + headH + jitter());
    ctx.stroke();
  }

  window.W_SPRITE = { draw: drawSprite };
})();
