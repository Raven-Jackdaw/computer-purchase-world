// 一次性迁移脚本：把 knowledge.json 里「数字媒体剪辑」拆成 3 档
import fs from 'node:fs';

const file = new URL('../data/knowledge.json', import.meta.url);
const k = JSON.parse(fs.readFileSync(file, 'utf8'));
const idx = k.specBaseline.findIndex((x) => x.id === 'media');
if (idx < 0) { console.log('找不到 media 条目，可能已迁移'); process.exit(0); }

const entries = [
  {
    id: 'media-basic',
    label: '数字媒体 · 入门剪辑（1080p / 短视频 / Vlog）',
    icon: 'film',
    minSpec: {
      cpu: '标压 i5 / R5 或酷睿 Ultra 5 及以上；1080p 短视频核显也能剪',
      ram: '16GB 起（后台软件多、多轨就上 32GB）',
      storage: '512GB SSD 起（素材放外置硬盘）',
      gpu: '核显可用；有入门独显（RTX 4050/5050 级）更稳',
      screen: '100% sRGB（低色域屏剪完发出去颜色会变）',
      ports: '至少 1 个全功能 USB-C + HDMI + USB-A',
      weight: '≤1.9kg（方便带去拍素材）',
    },
    why: '入门剪辑的门槛比想象低：1080p 短视频、Vlog、课程作业，16GB 内存 + 标压 CPU + 100% sRGB 屏就能流畅剪。真正的坑是低色域屏和 8GB 内存——剪得动，但预览卡、导出色偏。',
    upgradeHint: '先加内存到 32GB，再考虑硬盘 1TB；核显够用的话，把预算花在屏幕色域和续航上更值。',
  },
  {
    id: 'media-pro',
    label: '数字媒体 · 进阶剪辑（4K 多轨 / Pr+AE 特效）',
    icon: 'film',
    minSpec: {
      cpu: '标压 H/HX：酷睿 Ultra 7 / 锐龙 7 及以上（8 核以上）',
      ram: '32GB 起（4K 多轨 + AE 特效）',
      storage: '1TB SSD 起，最好有第二个 M.2 插槽',
      gpu: 'RTX 5060 8GB 起（GPU 加速/降噪/调色）；苹果 M 系列 24GB 统一内存起',
      screen: '100% sRGB 是底线；调色看 100% DCI-P3、亮度 400nit+',
      ports: '雷电 4/USB4 + HDMI，有 SD 读卡器更佳',
      weight: '≤2.3kg（要带去工作室/拍摄现场）',
    },
    why: '4K 多轨 + 中度 AE 特效是分水岭：16GB 内存会频繁爆缓存，512GB 硬盘两三个项目就满，核显剪 4K 预览会掉帧。这一档建议认准「RTX 5060 + 32GB + 1TB」三件套。',
    upgradeHint: '内存 32GB 比 CPU 升一档更值；硬盘优先第二 M.2 插槽；屏幕色域是调色底线，别省。',
  },
  {
    id: 'media-color',
    label: '数字媒体 · 调色特效（达芬奇调色 / 重度 AE / 3D 合成）',
    icon: 'film',
    minSpec: {
      cpu: 'HX 标压 12 核以上（酷睿 Ultra 9 / 锐龙 9 HX）',
      ram: '32GB 起，重度 AE / 3D 合成建议 64GB',
      storage: '2TB 或双 M.2 插槽（素材库与缓存分开）',
      gpu: 'RTX 5070 12GB 起，显存优先（调色/降噪/3D 合成吃显存）',
      screen: '100% DCI-P3 广色域，OLED/MiniLED，亮度 500nit+，色准 ΔE<2 更好',
      ports: '雷电 4/5 + HDMI 2.1 + SD 读卡器',
      weight: '不限（台面工作站型）',
    },
    why: '达芬奇调色、重度 AE、3D 合成是「显存 + 色准」的战场：8GB 显存跑 4K 降噪会爆，低色域屏调出来的颜色换块屏幕就翻车。这一档别只盯 CPU 型号，显存和屏幕色准才是分水岭。',
    upgradeHint: '优先显存 12GB+ 和广色域屏；64GB 内存对多轨 AE 有意义，但不如显存和色准优先。',
  },
];

k.specBaseline.splice(idx, 1, ...entries);
k.specBaselineOrder = undefined;
delete k.specBaselineOrder;
fs.writeFileSync(file, JSON.stringify(k, null, 2));
console.log('已拆分：', k.specBaseline.map((x) => x.id).join(', '));
