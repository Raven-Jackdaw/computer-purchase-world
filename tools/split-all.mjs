// 迁移：把知识库七大类的其余六类也拆成细分档（剪辑已在上一版拆分）
import fs from 'node:fs';

const file = new URL('../data/knowledge.json', import.meta.url);
const k = JSON.parse(fs.readFileSync(file, 'utf8'));

const E = (id, label, icon, minSpec, why, upgradeHint) => ({ id, label, icon, minSpec, why, upgradeHint });

const replacement = {
  humanities: [
    E('humanities-basic', '文科 / 商科 · 基础（论文·网课·PPT·查资料）', 'book', {
      cpu: '酷睿 Ultra 5 / 锐龙 5 及以上；CPU 不用追高',
      ram: '16GB 起（32GB 更从容）',
      storage: '512GB SSD 起，1TB 更安心',
      gpu: '核显即可',
      screen: '14 英寸，1920×1200 以上，100% sRGB 更好',
      ports: '至少 1 个全功能 USB-C + 1 个 USB-A + HDMI',
      weight: '≤1.8kg（宿舍—教室—图书馆）',
    }, '日常是“多开”：几十个网页、PDF、Office 同时在线，8GB 内存会卡，低色域屏做 PPT 显色会偏。CPU 买当前代中端就够了，钱花在内存和屏幕上。', '经常挂后台就 16→32GB；看资料多就 512GB→1TB；不要为 Ultra 7/9 多花钱。'),
    E('humanities-heavy', '文科 / 商科 · 重度多任务（文献堆·统计软件·多窗口）', 'book', {
      cpu: '酷睿 Ultra 5 / 锐龙 5 标压及以上',
      ram: '32GB（SPSS/Stata/R + 浏览器多标签很吃内存）',
      storage: '1TB SSD 起',
      gpu: '核显即可；不打游戏不必上独显',
      screen: '2.5K 以上，100% sRGB，长时间看文献更舒服',
      ports: '全功能 USB-C + HDMI + USB-A',
      weight: '≤2.0kg',
    }, '写论文开一堆文献管理器和地图网页，再跑 SPSS/Stata，16GB 会频繁假死；大 Excel 表也吃内存。这一档 32GB + 1TB 是底线，屏幕分辨率影响连续几小时的阅读疲劳。', '内存优先 32GB；其次屏幕 2.5K；硬盘 1TB；CPU 不用追高。'),
  ],
  cs: [
    E('cs-basic', '计算机 · 基础（课程·刷题·前端）', 'code', {
      cpu: '酷睿 Ultra 5 / 锐龙 5 标压及以上',
      ram: '16GB（32GB 更安心）',
      storage: '512GB SSD 起（1TB 建议）',
      gpu: '核显即可',
      screen: '14 英寸，1920×1200 以上；16:10 更适合写代码',
      ports: '全功能 USB-C + USB-A + HDMI',
      weight: '≤1.8kg',
    }, '课程代码、刷题、前端开发对配置要求不高，关键是内存别被浏览器+IDE 吃满，屏幕纵向高度（16:10）比分辨率数字更有用。', '内存 16→32GB 最值；硬盘 512GB→1TB；CPU 不用追；接口越多越省扩展坞的钱。'),
    E('cs-fullstack', '计算机 · 容器 / 全栈（Docker·虚拟机·多服务）', 'code', {
      cpu: '标压 H：酷睿 Ultra 7 / 锐龙 7 及以上（8 核以上）',
      ram: '32GB 起（Docker + 虚拟机很吃）',
      storage: '1TB SSD 起，最好有第二个 M.2 插槽',
      gpu: '核显够用；不玩 3A 不必上独显',
      screen: '2.5K，16:10，100% sRGB',
      ports: '雷电 4/USB4 + HDMI + USB-A 至少 2 个',
      weight: '≤2.0kg',
    }, '同时跑 3~4 个容器 + 一个 Windows 虚拟机 + 浏览器，16GB 会频繁 swap；多服务编译还吃 CPU。这一档 32GB + 标压 H + 接口多，比显卡重要。', '32GB 内存优先；1TB 硬盘 + 第二 M.2；雷电接口方便外接显示器/硬盘；独显不是必需。'),
    E('cs-ai', '计算机 · AI 开发 / 大项目（本地跑模型·编译）', 'code', {
      cpu: 'H/HX 标压：酷睿 Ultra 7 / 锐龙 7 及以上',
      ram: '32GB 起（跑本地模型 64GB 更稳）',
      storage: '1TB SSD 起，第二 M.2 更佳',
      gpu: 'RTX 5060 8GB 起；显存优先，12GB 更适合跑模型',
      screen: '2.5K，100% sRGB（长时间看日志/代码）',
      ports: '雷电 4/USB4 + HDMI + USB-A',
      weight: '≤2.3kg',
    }, '本地跑 7B~14B 量化模型、跑大项目编译，显存和内存是硬门槛：8GB 显存只能跑小模型，16GB 内存会爆。CPU 单核性能和散热同样影响编译速度。', '先加显存（8→12GB）和内存（32→64GB）；硬盘 1TB 起步；屏幕 2.5K。'),
  ],
  design: [
    E('design-2d', '设计 · 平面 / 视觉（PS·AI·排版）', 'palette', {
      cpu: '酷睿 Ultra 5 / 锐龙 5 及以上',
      ram: '16GB 起，大文件/多画板建议 32GB',
      storage: '512GB SSD 起（1TB 更适合素材库）',
      gpu: '核显可用；有入门独显加成有限',
      screen: '100% sRGB 是底线（低色域做图会偏色）',
      ports: '全功能 USB-C + USB-A + HDMI',
      weight: '≤1.8kg',
    }, '平面设计最吃“屏幕色准”和内存，不是显卡：低色域屏做出来的图在手机上会变味；大 PSD/多画板 + 浏览器会吃掉 16GB。', '先把屏幕色域和分辨率拉满（100% sRGB 起），再加内存 32GB；显卡可以省。'),
    E('design-3d', '设计 · 3D 建模渲染（Blender·C4D·KeyShot）', 'palette', {
      cpu: 'H/HX 标压：酷睿 Ultra 7 / 锐龙 7 及以上',
      ram: '32GB 起（大场景 64GB）',
      storage: '1TB SSD 起，第二 M.2 更佳',
      gpu: 'RTX 5060 8GB 起；渲染/显存优先 5070 12GB',
      screen: '2.5K 以上，100% sRGB / DCI-P3',
      ports: '雷电 4/USB4 + HDMI + USB-A',
      weight: '≤2.3kg',
    }, '3D 渲染吃 GPU 和显存，场景一大 8GB 显存就会爆；内存 32GB 是底线。买笔记本做 3D，散热和性能释放比 CPU 型号更重要。', '显存 8→12GB 优先；内存 32GB；硬盘 1TB + 第二 M.2；屏幕色域次之。'),
  ],
  gaming: [
    E('gaming-3a', '游戏 · 3A 单机 / 光追高画质', 'gamepad', {
      cpu: 'HX 标压：酷睿 Ultra 9 / 锐龙 9 HX',
      ram: '32GB 起（2026 新 3A 建议 32GB）',
      storage: '1TB SSD 起（一个 3A 就 100GB 以上）',
      gpu: 'RTX 5070 12GB 起；想 4K 看 5070 Ti / 5080',
      screen: '16 英寸 2.5K、240Hz、100% sRGB',
      ports: 'HDMI 2.1 + 至少 2 个 USB-A + 雷电/USB-C',
      weight: '2.2~2.6kg（游戏本别指望轻薄）',
    }, '3A 高画质看显卡和性能释放：同为 RTX 5060，115W 和 140W 是两个档次；显存 8GB 跑 2.5K 高材质会爆，光追更吃显存。', '同价位优先显存大 + 性能释放高 + 双 M.2；CPU 从 Ultra 7 换 Ultra 9 对帧数影响有限（约 1-3%），别为它加预算。'),
    E('gaming-esports', '游戏 · 电竞网游（高帧率·低延迟）', 'gamepad', {
      cpu: 'HX 标压：酷睿 Ultra 7 HX / 锐龙 7 HX',
      ram: '16GB 起（32GB 更稳）',
      storage: '1TB SSD 起',
      gpu: 'RTX 5060 8GB 起',
      screen: '16 英寸 2.5K、240Hz 以上、3ms 级响应',
      ports: 'HDMI 2.1 + USB-A ×2 + 网口（有线更稳）',
      weight: '2.2~2.5kg',
    }, '电竞网游吃的是高刷新率、CPU 单核和网络延迟：屏幕 165Hz 和 240Hz 是两种体验，有线网口比 Wi-Fi 稳。显卡 5060 级就够跑满高帧。', '优先 240Hz 高刷屏和好散热；网口/雷电外接；显卡不必上到 70 级。'),
    E('gaming-stream', '游戏 · 直播 / 录屏（编码·多任务）', 'gamepad', {
      cpu: 'HX 8 核以上：酷睿 Ultra 7 HX / 锐龙 7 HX',
      ram: '32GB（游戏 + 直播软件同时跑）',
      storage: '1TB SSD 起（录屏很占空间）',
      gpu: 'RTX 5060 8GB 起（NVENC 编码器）',
      screen: '2.5K、165Hz 以上、100% sRGB',
      ports: 'HDMI 2.1 + 网口 + 雷电/USB-C',
      weight: '2.3~2.6kg',
    }, '边玩边推流是“游戏 + 编码 + 弹幕/浏览器”三开：内存 32GB 才不会掉帧，N 卡 NVENC 编码器对 OBS 更友好；录屏文件很大，1TB 起步。', '内存 32GB 优先；硬盘 1TB+；有网口和好散热比显卡等级更重要。'),
  ],
  ai: [
    E('ai-infer', 'AI · 本地推理 / Agent 开发（7B~14B 量化）', 'brain', {
      cpu: '标压 H：酷睿 Ultra 7 / 锐龙 7 及以上',
      ram: '32GB 起（本地模型常驻内存）',
      storage: '1TB SSD 起（模型文件很大）',
      gpu: 'RTX 5060 8GB 起；12GB 显存更从容',
      screen: '2.5K、100% sRGB',
      ports: '雷电/USB4 + HDMI',
      weight: '≤2.3kg',
    }, '本地推理的门槛是显存：7B 量化约 5GB、14B 约 9~10GB，8GB 显存只能勉强跑小模型；内存 16GB 会被模型+系统吃满。CPU 不是瓶颈。', '先加显存 8→12GB，再内存 32→64GB；硬盘 1TB 起。'),
    E('ai-finetune', 'AI · 小模型微调 / 训练（显存优先）', 'brain', {
      cpu: 'HX 10 核以上：酷睿 Ultra 9 HX / 锐龙 9 HX',
      ram: '64GB 起（数据加载+训练并行）',
      storage: '2TB 或双 M.2（数据集与缓存分开）',
      gpu: 'RTX 5070 Ti 12GB 起，优先 5080 16GB',
      screen: '2.5K、100% sRGB',
      ports: '雷电 + HDMI（外接屏看训练曲线）',
      weight: '不限（工作站型）',
    }, '微调/训练看显存带宽和容量：12GB 起步，16GB 才能舒服跑中小模型 LoRA；64GB 内存和 2TB 硬盘是数据集的基础。笔记本训练能力有限，预算应优先显存。', '显存 > 内存 > 硬盘：12→16GB 显存最值；64GB 内存；2TB 起步。'),
  ],
  engineering: [
    E('eng-2d', '工程 · 2D 制图 / CAD 入门', 'ruler', {
      cpu: '酷睿 Ultra 5 / 锐龙 5 及以上',
      ram: '16GB 起（大图纸 32GB）',
      storage: '512GB SSD 起',
      gpu: '核显可用',
      screen: '14~15.6 英寸，1080P 以上，防眩光',
      ports: 'USB-A ×2 + 全功能 USB-C + HDMI',
      weight: '≤1.9kg（带去实验室/教室）',
    }, 'AutoCAD 2D 制图对配置要求不高，关键是屏幕不反光、接口够用、重量能天天背。别被“专业显卡”话术加预算。', '内存 16→32GB；硬盘 1TB；屏幕防眩光；CPU 中端即可。'),
    E('eng-3d', '工程 · 3D 仿真（SolidWorks·Revit·ANSYS）', 'ruler', {
      cpu: 'H/HX 标压：酷睿 Ultra 7 / 锐龙 7 及以上',
      ram: '32GB 起（装配体/模型越大越吃）',
      storage: '1TB SSD 起',
      gpu: 'RTX 5060 8GB 起；OpenGL 稳定性优先',
      screen: '15~16 英寸，2.5K，100% sRGB',
      ports: 'USB-A ×2 + HDMI + 有线网口',
      weight: '2.1~2.5kg',
    }, 'SolidWorks/Revit 大装配体吃内存和显卡，核显会卡在旋转/剖切；ANSYS 仿真更吃 CPU 核心。学校机房能跑不等于你的本子能跑，按 32GB + 独显买。', '内存 32GB 优先；显存 8GB 起；散热和性能释放比 CPU 型号更影响长时间仿真。'),
  ],
};

const out = [];
for (const s of k.specBaseline) {
  out.push(...(replacement[s.id] || [s]));
}
k.specBaseline = out;
fs.writeFileSync(file, JSON.stringify(k, null, 2));
console.log('共', out.length, '档：', out.map((x) => x.id).join(', '));
