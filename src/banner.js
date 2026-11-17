/* ============================================================
   哥特城市天际线横幅
   canvas 程序化生成，不依赖图片素材
   夜：黑金 + 冷月 + 窗火；昼：羊皮纸晨曦
   ============================================================ */
(function () {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawSkyline(ctx, W, H, baseY, color, r, opt) {
    opt = opt || {};
    const minH = opt.minH || 18, maxH = opt.maxH || 84;
    const minW = opt.minW || 16, maxW = opt.maxW || 52;
    ctx.fillStyle = color;
    let x = -30;
    while (x < W + 40) {
      const tw = minW + r() * (maxW - minW);
      const th = minH + r() * (maxH - minH);
      ctx.fillRect(x, baseY - th, tw, th + 4);
      const roll = r();
      if (roll < 0.42) {
        // 尖塔
        const sh = 14 + r() * 34;
        ctx.beginPath();
        ctx.moveTo(x + tw / 2, baseY - th - sh);
        ctx.lineTo(x + tw * 0.12, baseY - th);
        ctx.lineTo(x + tw * 0.88, baseY - th);
        ctx.closePath();
        ctx.fill();
        if (r() < 0.5) {
          // 塔尖小旗
          ctx.fillRect(x + tw / 2, baseY - th - sh - 8, 7, 5);
        }
      } else if (roll < 0.68) {
        // 城垛
        const n = 3 + Math.floor(r() * 4);
        const cw = tw / n;
        for (let i = 0; i < n; i++) ctx.fillRect(x + i * cw + 1, baseY - th - 7, cw * 0.55, 7);
      } else if (roll < 0.82) {
        // 穹顶
        ctx.beginPath();
        ctx.arc(x + tw / 2, baseY - th, tw * 0.42, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(x + tw / 2 - 1.5, baseY - th - tw * 0.42 - 10, 3, 12);
      }
      x += tw + 2 + r() * 16;
    }
  }

  function draw(canvas, theme) {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(canvas.clientWidth || 1200, 320);
    const H = Math.max(canvas.clientHeight || 170, 100);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const light = theme === 'light';
    const rnd = rng(20261117);

    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (light) {
      sky.addColorStop(0, '#f4e8cc');
      sky.addColorStop(0.5, '#e8d5ae');
      sky.addColorStop(1, '#d3b98c');
    } else {
      sky.addColorStop(0, '#0b0908');
      sky.addColorStop(0.5, '#1a1110');
      sky.addColorStop(0.82, '#33201a');
      sky.addColorStop(1, '#41291f');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 星
    if (!light) {
      for (let i = 0; i < 90; i++) {
        const x = rnd() * W, y = rnd() * H * 0.6;
        const a = 0.12 + rnd() * 0.5;
        ctx.fillStyle = `rgba(230,220,200,${a})`;
        ctx.fillRect(x, y, rnd() < 0.85 ? 1 : 1.6, 1);
      }
    }

    // 月
    const mx = W * (light ? 0.24 : 0.79), my = H * 0.3, mr = Math.min(W, H) * (light ? 0.1 : 0.115);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4.2);
    halo.addColorStop(0, light ? 'rgba(255,248,226,.85)' : 'rgba(228,206,168,.20)');
    halo.addColorStop(0.5, light ? 'rgba(255,248,226,.30)' : 'rgba(228,206,168,.05)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(mx, my, mr * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = light ? 'rgba(252,247,232,.95)' : 'rgba(232,214,176,.92)';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = light ? 'rgba(210,190,150,.35)' : 'rgba(180,160,128,.30)';
    ctx.beginPath(); ctx.arc(mx - mr * 0.28, my - mr * 0.18, mr * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.3, my + mr * 0.24, mr * 0.13, 0, Math.PI * 2); ctx.fill();

    // 薄云
    const cloud = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.62);
    cloud.addColorStop(0, light ? 'rgba(255,250,238,0)' : 'rgba(90,60,45,0)');
    cloud.addColorStop(0.5, light ? 'rgba(255,250,238,.45)' : 'rgba(90,60,45,.30)');
    cloud.addColorStop(1, light ? 'rgba(255,250,238,0)' : 'rgba(90,60,45,0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(0, H * 0.38, W, H * 0.24);

    // 三层天际线
    const far = light ? 'rgba(120,96,60,.30)' : 'rgba(26,18,16,.72)';
    const mid = light ? 'rgba(96,74,44,.48)' : 'rgba(16,11,9,.88)';
    const near = light ? '#3a2c1b' : '#080605';
    drawSkyline(ctx, W, H, H * 0.74, far, rng(11), { minH: 18, maxH: 52, minW: 12, maxW: 34 });
    drawSkyline(ctx, W, H, H * 0.86, mid, rng(22), { minH: 26, maxH: 78, minW: 16, maxW: 46 });
    drawSkyline(ctx, W, H, H * 1.0, near, rng(33), { minH: 30, maxH: 96, minW: 20, maxW: 58 });

    // 窗火（只在近景层，稀疏暖光）
    const rw = rng(77);
    for (let i = 0; i < 120; i++) {
      if (rw() > 0.22) continue;
      const x = rw() * W;
      const y = H * (0.62 + rw() * 0.36);
      const s = rw() < 0.8 ? 1.4 : 2.2;
      ctx.fillStyle = light ? 'rgba(120,90,40,.55)' : `rgba(255,196,110,${0.35 + rw() * 0.5})`;
      ctx.fillRect(x, y, s, s);
    }

    // 前景雾
    const fog = ctx.createLinearGradient(0, H * 0.66, 0, H);
    fog.addColorStop(0, light ? 'rgba(233,223,201,0)' : 'rgba(10,9,8,0)');
    fog.addColorStop(0.45, light ? 'rgba(233,223,201,.42)' : 'rgba(10,9,8,.45)');
    fog.addColorStop(1, light ? 'rgba(233,223,201,.82)' : 'rgba(10,9,8,.92)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, H * 0.66, W, H * 0.34);

    // 蝙蝠
    const rb = rng(99);
    ctx.strokeStyle = light ? 'rgba(60,44,26,.5)' : 'rgba(10,8,7,.9)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const bx = rb() * W * 0.7 + W * 0.1;
      const by = H * (0.1 + rb() * 0.3);
      const s = 3 + rb() * 4;
      ctx.beginPath();
      ctx.moveTo(bx - s, by);
      ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.8, bx, by);
      ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.8, bx + s, by);
      ctx.stroke();
    }

    // 暗角
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, light ? 'rgba(90,70,35,.20)' : 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  window.W_BANNER = { draw };
})();
