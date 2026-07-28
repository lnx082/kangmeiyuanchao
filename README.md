# 抗美援朝胜利战役日记

回顾 1950—1953 年中国人民志愿军在朝鲜战场上的五大标志性胜利战役。

---

## 功能

- **📅 日历模式** — 复古时间线，按时间顺序排列战役，点击展开日记全文
- **🌍 位置模式** — Cesium.js 3D 地球，红星标记战役坐标，FlyTo 飞行动画
- **🔄 跨模式同步** — 任一模式选中战役 → 切换模式 → 自动定位/飞行
- **📱 响应式** — 桌面侧栏 / 移动端底部抽屉，时间线双列 / 单列自适应
- **📖 日记体叙事** — 第一人称纪实视角，还原五大战役的战场实录

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
# → http://localhost:5173/
```

> **无需注册任何服务即可运行！** 默认使用 ESRI 免费卫星底图。

### 可选：配置 Cesium ion Token

配置后可启用高精度 3D 地形：

```bash
# 1. 免费注册 → https://ion.cesium.com/signup/
# 2. 创建 .env 文件：
echo VITE_CESIUM_TOKEN=pk.your_token_here > .env
# 3. 重启 npm run dev
```

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | TailwindCSS v4 + CSS 自定义属性 |
| 3D 地球 | Cesium.js（MIT 开源，零依赖可运行） |
| 底图 | ESRI World Imagery（免费）/ Cesium ion（可选） |

## 项目结构

```txt
src/
├── types/battle.ts            # 战役数据 TypeScript 接口
├── data/mockBattles.ts        # 五大战役 Mock 数据
├── components/
│   ├── Navbar.tsx             # 顶栏 + 模式 Toggle
│   ├── TimelineView.tsx       # 日历时间线视图
│   ├── MapView.tsx            # 3D Cesium 地球
│   └── BattleInfoPanel.tsx    # 信息面板（桌面侧栏/移动底部抽屉）
├── App.tsx                    # 根组件 — 全局选中状态
├── App.css                    # 切换动画 / 响应式覆盖
└── index.css                  # 设计令牌 / 全局排版
```txt

## 五大战役

| 战役 | 日期 | 坐标 |
| --- | --- | --- |
| 云山战役 | 1950.10.25 — 11.05 | 39.95°N 125.81°E |
| 清川江战役 | 1950.11.25 — 12.02 | 39.68°N 125.82°E |
| 长津湖战役 | 1950.11.27 — 12.24 | 40.39°N 127.25°E |
| 上甘岭战役 | 1952.10.14 — 11.25 | 38.32°N 127.46°E |
| 金城战役 | 1953.07.13 — 07.27 | 38.42°N 127.58°E |

数据接口见 [src/types/battle.ts](src/types/battle.ts)。

## 生产构建

```bash
npm run build       # → dist/
npm run preview     # 本地预览构建产物
```

## 设计

- **配色**：志愿军军服卡其 / 旗帜深红 / 复古纸张暖底
- **字体**：Georgia 衬线体（历史文献感）
- **动效**：模式切换淡入淡出 / 面板滑入 / 底部抽屉弹出 / FlyTo 飞行
- **移动端**：时间线单列 + 底部抽屉面板，触控友好

## License

MIT
