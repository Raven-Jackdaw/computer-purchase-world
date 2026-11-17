# 机型数据规范 v1 —— 《电脑购买大世界》

> 采集者必读。目标：给「世界地图」提供**可核实、可追溯、不编造**的机型数据。

## 一、目录与分工

| 路径 | 谁维护 | 说明 |
|---|---|---|
| `data/band-1.json` ~ `data/band-4.json` | 数据采集者 | 按价位段分文件，互不重叠 |
| `data/knowledge.json` | 内容采集者 | 规格底线 / 避坑 / 购买时机（非机型数据） |
| `src/`、`build.mjs`、`dist/` | Lead | 应用源码与构建，采集者**不要碰** |
| `spec/data-schema.md` | Lead | 本文件 |

## 二、硬性质量规则（违反即返工）

1. **只收 2026 年 11 月中国国行在售或近期在售的笔记本**；包含 2025 年上代降价机（这是学生性价比重点）。不收台式机 / 平板 / 迷你主机 / 海外版 / 已停产无货机型。
2. **每个字段必须来自你实际打开过的页面**。页面打不开、查不到 → `null`，并在 `status` 里标 `部分待核实`。**禁止估算、禁止编造、禁止用上一代数据顶替**。
3. 每台至少 2 条来源：`sourceSpec`（品牌官网规格页优先）+ `sourcePrice`（京东自营 / 品牌商城 / IT 媒体报价页）。
4. 价格单位：元（整数）。写**当前到手参考价**；若含国补 / 学生优惠 / 以旧换新，在 `priceNote` 写清楚。
5. `status` 只能三选一：`已核实`（规格+价格都有来源）/ `部分待核实`（缺 1 项或个别字段未知）/ `待核实`（只有名称，不建议收录）。
6. `pros` / `cons` 各 2~3 条，**必须能从上表字段推出**，不写「手感超好」这类无法证实的吹捧。
7. 同一台机器只能出现在一个价位段文件里，按 `price` 判定归属（见第三节区间）。
8. 每个价位段内**品类覆盖**：轻薄本约 45%、全能本约 30%、游戏本约 20%、二合一约 5%；该价位段没有对应品类（如 4000 元内游戏本）就如实减少，不要凑数。
9. **禁止抄袭其他采集者**：各写各的价位段，不要跨段补机器；宁可少 1 台也不要重复。

## 三、价位段与数量目标

| 文件 | 价位区间（元） | 至少台数 | 大陆名 |
|---|---|---|---|
| `data/band-1.json` | ≤ 4499 | 14 | 学徒区 |
| `data/band-2.json` | 4500 – 5999 | 18 | 主力区 |
| `data/band-3.json` | 6000 – 7999 | 16 | 进阶区 |
| `data/band-4.json` | ≥ 8000 | 12 | 秘境 |

判重规则：价格落在哪个区间就归哪个文件；边界价（4499/4500、5999/6000、7999/8000）按上表闭区间执行。

## 四、文件格式

```json
{
  "band": 1,
  "range": [0, 4499],
  "collectedAt": "2026-11-17",
  "collector": "data-band1",
  "laptops": [ { ... }, { ... } ]
}
```

## 五、单台机型字段

| 字段 | 类型 | 必填 | 说明 / 取值 |
|---|---|---|---|
| `id` | string | ✅ | kebab-case，如 `lenovo-xiaoxin-pro-14-2026` |
| `name` | string | ✅ | 官方全名（含年份/代次），如「联想小新 Pro 14 2026」 |
| `brand` | string | ✅ | 联想 / 华硕 / 惠普 / 戴尔 / 宏碁 / 小米 / 华为 / 荣耀 / 苹果 / 机械革命 / 神舟 / 雷蛇 / 微星 / 微软 … |
| `series` | string | ✅ | 系列名，如「小新 Pro」「拯救者」「天选」 |
| `category` | string | ✅ | `轻薄本` / `全能本` / `游戏本` / `二合一` |
| `price` | number\|null | ✅ | 当前到手参考价（元） |
| `priceNote` | string | ✅ | 如「京东自营到手价，含国补 15%」「首发价」 |
| `launchDate` | string\|null | ✅ | 上市年月 `YYYY-MM`；未知 null |
| `cpu` | string | ✅ | 精确型号，如 `Intel Core Ultra 7 258V` / `AMD Ryzen 7 8845H` |
| `cpuBrand` | string | ✅ | `Intel` / `AMD` / `Apple` / `Qualcomm` |
| `gpu` | string | ✅ | 如 `Intel Arc 140V` / `RTX 5060 Laptop 8GB` / `核显` |
| `gpuType` | string | ✅ | `核显` / `入门独显` / `甜品独显` / `高端独显` |
| `ram` | string | ✅ | 如 `32GB LPDDR5X 8533` |
| `ramGB` | number | ✅ | 内存容量 GB |
| `ramReplaceable` | boolean\|null | ✅ | 板载不可换 = false；有插槽 = true；不确定 null |
| `storage` | string | ✅ | 如 `1TB PCIe 4.0 SSD` |
| `storageGB` | number | ✅ | 硬盘容量 GB |
| `screen.size` | number | ✅ | 英寸，如 14.0 |
| `screen.resolution` | string | ✅ | 如 `2880x1800` |
| `screen.refresh` | number | ✅ | Hz |
| `screen.panel` | string | ✅ | `IPS` / `OLED` / `MiniLED` / `TN` |
| `screen.colorGamut` | string\|null | ✅ | 如 `100% sRGB`；未知 null |
| `screen.touch` | boolean | ✅ | 是否触控 |
| `screen.glossy` | boolean\|null | ✅ | 镜面/雾面；未知 null |
| `weightKg` | number | ✅ | 整机重量 kg（保留 2 位） |
| `thicknessMm` | number\|null | ✅ | 最厚处 mm |
| `batteryWh` | number\|null | ✅ | 电池 Wh |
| `batteryLifeH` | number\|null | ✅ | 官方/实测续航小时，`batteryLifeNote` 说明口径 |
| `batteryLifeNote` | string\|null | ✅ | 如「PCMark 10 现代办公实测」 |
| `ports` | string[] | ✅ | 如 `["2x USB-C 雷电4", "1x USB-A 3.2", "HDMI 2.1", "SD 读卡器", "3.5mm"]` |
| `os` | string | ✅ | `Windows 11` / `macOS` / … |
| `performanceReleaseW` | number\|null | ✅ | 整机性能释放 W；未知 null（不要猜） |
| `special` | string[] | ✅ | 卖点短词，如 `["独显直连","高刷","面部识别"]` |
| `pros` | string[] | ✅ | 2~3 条，可从字段推出 |
| `cons` | string[] | ✅ | 2~3 条 |
| `sourceSpec` | string\|null | ✅ | 官方规格页 URL |
| `sourcePrice` | string\|null | ✅ | 价格来源 URL |
| `status` | string | ✅ | `已核实` / `部分待核实` / `待核实` |

## 六、提交前自检

```powershell
node -e "const d=require('./data/band-1.json');console.log(d.laptops.length, d.laptops.filter(x=>x.status==='已核实').length)"
```

- JSON 必须能被 `node -e "require(...)"` 解析（UTF-8，无 BOM，无注释）。
- 数量达标、`id` 唯一、价格落在本段区间、必填字段齐全。
- 回报时给：台数、已核实台数、品类分布、你打不开/放弃的机器（避免 Lead 重复踩坑）。
