# Handoff: 登录前落地页（Public Landing Page）

> 给 Claude Code 的实施包。打开 `preview.html` 可以本地预览整个设计。

---

## 一、这是什么？

这是 **webappwork** 项目的**登录前落地页**设计。当前 `app/page.tsx` 通过 `requireAuth()` 把未登录用户直接踢去 `/login`，没有任何介绍页面。这个设计填补这个缺口：

- **目标**：访客（未登录）打开 `/` 时，看到一个介绍平台、展示功能、引导注册/登录的页面
- **范围**：仅替换 `app/page.tsx` 在未登录态的渲染逻辑；已登录用户继续看个人 dashboard
- **风格定位**：GitHub-style dossier 暗色 + 中文 + 衬线斜体大标题。**所有板块均对照 webappwork 的实际功能**（蝶灵圆桌 / AI 助手 / SQL 实验室 / 留言板 / 访客统计等）。

## 二、设计文件说明

`preview/` 里的文件是**设计参考**——用 HTML + Babel JSX 写的原型，**不要直接照搬**。任务是用 webappwork 现有的 Next.js + Tailwind + shadcn/ui 技术栈**重建这个设计**。

```
design_handoff_landing_page/
├── README.md                ← 本文件（实施指南）
├── preview.html             ← 浏览器直接打开看效果
└── preview/                 ← 原型源文件
    ├── tokens.css           ← 设计 token（颜色、字体、间距）
    ├── shared.jsx           ← 数据 + 图标 + 活动热力图 + Sparkline
    ├── landing-header.jsx   ← 全局顶栏 + 项目头部 strip + 标签栏
    ├── landing-sidebar.jsx  ← 左侧概览（296px 宽）
    ├── landing-main.jsx     ← 主栏全部内容
    ├── landing.jsx          ← 整页组合 + 底部 CTA + footer
    ├── app.jsx              ← React 挂载 + Tweaks 面板
    └── tweaks-panel.jsx     ← 仅原型期使用，实施时不要带
```

## 三、保真度

**高保真（hi-fi）**：颜色、字号、间距、布局已经定稿，请像素级还原。但**渲染时使用 webappwork 现有的 Tailwind 类、shadcn 组件、token 系统**，而不是把 `tokens.css` 移植过去。

## 四、技术栈集成

### 4.1 入口改造（最关键的一步）

当前 `app/page.tsx` 第 1-3 行：

```ts
import { requireAuth } from "@/lib/auth"
// ...
const session = await requireAuth()  // 未登录 → redirect("/login")
```

改造方案 A（**推荐**）：让 `/` 同时承载落地页和已登录 dashboard：

```ts
import { getOptionalSession } from "@/lib/auth"
import { LandingPage } from "@/components/landing/landing-page"

export default async function HomePage() {
  const session = await getOptionalSession()
  if (!session) {
    return <LandingPage />   // 未登录 → 落地页
  }
  // 已登录 → 保持原有 dashboard 逻辑
  return <PersonalHomeShell> ... </PersonalHomeShell>
}
```

方案 B：新建独立路由 `app/(public)/welcome/page.tsx`，登录中间件把未登录跳过去。如果方案 A 改动太大可以考虑。**优先用 A，URL 干净。**

### 4.2 文件结构建议

把组件放在 `components/landing/` 下，跟 `components/profile/` 平级：

```
components/landing/
├── landing-page.tsx          ← 主入口，组合所有部分
├── landing-header.tsx        ← 顶部 nav + 项目 strip + 标签栏
├── landing-sidebar.tsx       ← 左侧概览
├── landing-intro-card.tsx    ← 平台介绍卡（README 风）
├── landing-features-grid.tsx ← "十四个模块·一个空间"
├── landing-home-preview.tsx  ← "登录后你会看到"（PersonalHomeGrid mockup）
├── landing-contributions.tsx ← 全站书写热度（热力图）
├── landing-activity.tsx      ← 站内动态 + 本周公开文章
├── landing-changelog.tsx     ← 更新日志 + 本周活跃空间
├── landing-faq.tsx           ← 常见问题
├── landing-cta.tsx           ← 底部 CTA
├── landing-footer.tsx        ← 5 列 footer
└── landing-space-mark.tsx    ← 品牌 SVG mark
```

### 4.3 样式策略

`preview/tokens.css` 是**暗色 token 系统**。webappwork 现有 `app/globals.css` 是**亮色**（暖白 `#F7F4EC` + 蓝品牌 `#2563EB` + Claude 橙 `#C96442`）。

落地页应该有**两种模式**：

- **默认暗色**：GitHub 风。新增一组 token，命名空间用 `--landing-*` 避免污染。
- **亮色**：直接复用现有 `--color-bg-primary` / `--color-brand` / `--color-accent`。

推荐做法：在 `components/landing/landing.module.css` 里定义两套 token，通过给根 div 加 `.landing-light` / `.landing-dark` 切换。Tweaks 是原型期的实验，**实施时不需要带过去**——给一个 `data-theme="dark"` 属性就够了，或者直接固定一种主题。

---

## 五、页面结构与板块

页面整体宽度 **min-width: 1280px**（桌面优先，移动端简单堆叠即可）。`max-width: 1440px` 居中。

### 5.1 全局顶栏（GlobalHeader）

高度 54px · `position: sticky · top: 0 · z-index: 50` · 底边 hairline 1px

从左到右：
1. **菜单按钮**（hamburger，移动端用）
2. **品牌 mark + 文字** `my space` —— 26×26 SVG（嵌套方框 + 中心橙色实心），文字用衬线斜体 Instrument Serif 17px
3. **版本标签** `v2.4.1 · 邀请测试中` —— monospace 10.5px，1px border
4. **搜索框** —— 320px 宽，含 `⌘ K` 快捷键提示，5px 12px padding
5. **导航**（间距 16px）：功能 / 预览 / 社区 / 更新 / FAQ
6. **登录** 链接 + **创建你的空间** 按钮（绿色 `#58c25c` 底）

### 5.2 项目头部 Strip（ProjectHeaderStrip）

`background: linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%)` · 底边 hairline

**左侧**：
- 📁 `my-space / 你的个人空间` —— 18px 600 weight，斜杠用 `var(--text-3)`
- 两个 chip：`公开` · `📌 邀请制`（橙色）
- 副标题：`一处写作、求职、复盘、社交的个人空间。博客 · 日常 · 简历 · 求职追踪 · 面试记录 · 蝶灵圆桌 · AI 助手 · SQL 实验室。所有模块逐项可见性控制，数据可导出。` —— 13px，760px max-width

**右侧**：3 个 GroupButton（GitHub-style 拆分按钮），从左到右：
- `👁 浏览公开空间 │ 1,247`
- `🔔 订阅更新 │ RSS`
- `★ 收藏 │ 1,247` （高亮态）

**底部标签栏**（margin-top: 16px）：
- 总览（active，橙底线 `#f6c177`）/ 空间 1,247 / 动态 18,642 / 公开文章 8,946 / 更新日志 12 / 讨论 1.8k / FAQ
- 每个 tab `padding: 10px 12px`，含图标 + 数字 chip

### 5.3 内容主区（max-width: 1440px · padding: 26px 22px）

**左 296px 侧边栏 + 32px gap + 右主栏（1fr）**

#### Sidebar
- **296×296 圆形头像区**：外圈 1px border + 镜像，内部 220×220 SVG「品牌 mark」—— 外圆 + 两层嵌套方框（虚线点缀 + 实色品牌方块）+ 四角刻度 + 底部 `MY · SPACE · 2026` 字样
- 头像下方浮动 status pill：`● 当前 43 人在线 · 28 个新空间 / 7d`，pulse 动画
- **h1** `my-space` · **handle** `/@你`（mono，浅色）
- **描述**：`一处统御写作、求职、社交的个人空间。每个用户自带一整套模块，公开还是私人由你决定。`
- **三个按钮**（垂直堆，gap 6px）：
  - `+ 创建你的空间`（主，绿色）
  - `→ 登录已有账号`（次，描边）
  - `👁 浏览公开空间`（最弱，灰底）
- **About 列表**（6 项 + 底部 hairline）：活跃空间数 / 公开文章数 / 求职记录数 / 访客数 / 上线天数 + uptime / 开源 MIT
- **平台模块**：7 色分割条（彩条 + 文字列表 + 公开/私 标签）+ `查看全部 14 个模块 →`
- **推荐空间**：4 个用户（@ada @mori @shen @lin01），26px 圆形头像 + 角色 + 连续天数（🔥 213d）
- 最底部：`反馈问题 · 自部署文档`

#### Main（主栏，gap 22px 纵向堆叠）

**A. IntroCard（平台介绍）** —— `card-gh` 容器（surface 底 + 1px line border + 8px radius）
- 卡片头：📄 `平台介绍` + 右侧 `README.md · 中文 / EN · 阅读约 2 分钟`
- 大标题（36px 衬线斜体）：`一处属于你的个人空间。`「属于你」用 accent 色
- 段落：`my-space 是一个多用户写作 + 求职 + 社交平台。每个用户登录后会得到一整套模块——博客、日常、心得、笔记、简历、求职追踪、面试记录、好友 / 聊天频道、蝶灵圆桌、AI 助手、SQL 实验室、留言板。哪些公开、哪些只给好友看、哪些彻底私人——逐模块由你决定。`
- 引用块（左侧 3px accent border，斜体衬线）：
  > "把事情写下来。回头看。注意到自己这一年的形状。"
  > —— 这个平台唯一的规矩
- 命令行块（mono · bg-deep · 12.5px）：`→ 访问 /u/<你的 handle>   # 注册即生成你的公开空间 URL，可一键分享   [复制]`
- 二级标题：`为什么用 my-space`
- 6 项 checkbox 列表：
  1. 公开主页可分享：/u/handle 自定义短链，访客可留言、统计访问数
  2. 求职闭环：投递 → 已回复 → 进入面试 → Offer，看漏斗看自己的转化率
  3. 面试记录：每轮提问、自评 1–5 星、复盘，下次复习不靠记忆
  4. 蝶灵圆桌：每天早晚两场议题，多人异步讨论，凉了再来
  5. AI 助手只对你说话：写作辅助、简历润色、不训练你的数据
  6. 数据全部可导出：Markdown + JSON，跟我无关也带走
- 底部相关链接

**B. FeaturesShowcase（十四个模块·一个空间）**
- 标题行：📌 `十四个模块 · 一个空间` + `实际功能` chip / 右侧 `逐项可见性控制 →`
- 3 列网格（9 个 card），每个卡：
  - 颜色图标（每个模块有自己的色 dot：blue / green / amber / orange / red / purple / cyan / pink）
  - 模块中文名（accent 色 600 weight）
  - `公开可见` / `仅登录` chip
  - 描述行
  - 底部：色 dot · 类型标签 · 数据 X 条

**模块完整列表**（含真实功能映射）：

| ID | 中文 | 描述 | 可见性 |
|---|---|---|---|
| home | 个人主页 | 一处统御所有模块的入口仪表盘 | 公开 |
| blog | 博客 | 长文 · 技术 · 读书 · 随笔 | 公开 |
| daily | 日常 | 时间线式的轻量日记 | 公开 |
| reflections | 心得 | 复盘 · 年度总结 · 专题思考 | 公开 |
| notes | 笔记 | 碎片素材、剪贴板、私人备忘 | 仅登录 |
| resume | 简历 | 多模板 · Markdown / JSON · 一键打印 | 公开 |
| jobs | 求职追踪 | 投递 · 回复 · 面试 · Offer 全流程看板 | 仅登录 |
| interviews | 面试记录 | 每轮提问 · 自评 · 复盘 | 仅登录 |
| friends | 好友 · 聊天 | 私聊、群聊、好友圈动态 | 仅登录 |
| community | 社区资源 | 网站收藏 · GIF 表情包社区 | 公开 |
| soulwing | 蝶灵圆桌 | 每天两场议题，多人异步讨论 | 仅登录 |
| ai | AI 助手 | 私人对话 · 写作 / 简历润色 | 仅登录 |
| sql | SQL 实验室 | 在线 SQL 练习 + 小型数据探索 | 仅登录 |
| guestbook | 留言板 | 访客留言、表情包、回复线程 | 公开 |

**C. PersonalHomePreview（登录后你会看到）**
- 标题：👁 `登录后你会看到` + 绿色 `实景` chip
- 右上：`/u/<你> · 主页布局`
- 容器（bg-deep 暗底卡），内含 mockup：
  - **左主区**（grid template `1fr 240px`）：
    - Hero 卡：56px 圆头像 `AD` + @handle + 角色 + 加入天数 + 3 个按钮 chip + `/u/ada` 角标
    - 6 列 metric strip（文章 / 日常 / 求职 / 访客 / 互动 / 留言）
    - 双卡列：最新文章列表 + 求职漏斗（4 层渐变彩条）
  - **右 aside**（240px 宽）：
    - 写作统计卡（128k 字 / 连续 23 天 / mini heatmap）
    - 访客概览卡（1,247 / 30d sparkline）
    - 最近访客列表（@mori @shen 匿名 + path + 时间）

  > 这一节是说服访客的核心——用 PersonalHomeGrid mockup 直观告诉他们登录后会得到什么。实施时可以**直接 import 你的 `<PersonalHeroCard>` / `<MetricStrip>` / `<JobFunnelCard>` / `<WritingStatsCard>` / `<VisitOverviewCard>`，喂假数据**，比 mockup 还真。

**D. ContributionCard（全站书写热度）**
- 卡头：`18,642 次写入，来自 1,247 个空间的过去一年` + 右侧两个下拉（过去一年 / 全部模块）
- 主体：**53 周 × 7 天 SVG 热力图**，每格 13×13，间距 3，rx 2。颜色用 accent 色 + 5 级 opacity（0 / 0.22 / 0.42 / 0.68 / 1）。0 级用 `var(--surface-2)`
- 下方图例：`包含：博客 · 日常 · 心得 · 求职 · 面试 · 留言 · 圆桌` + 少→多 色阶
- 底部 4 列统计（公开文章 / 求职记录 / 面试记录 / 留言互动），每个含主数字 + 绿色 `+XXX 本月`

**E. RecentRow（站内动态 + 本周公开文章）** —— 双列等宽
- **站内动态**（左）：实时 chip + 全部模块下拉。每条：22px 圆头像 + `@user` 动作 + 目标 + 时间 + tag chip + 右侧操作图标
  - 用真实动作映射：发布博客 / 记录投递 / 新增面试 / 写日常 / 留言 / 加入平台 / 评论 / 更新简历 / 参加圆桌 / 调用 AI
- **本周公开文章**（右）：每篇 14px 色 dot + `@user · 日期` + 标题 + tag · 读时 + 浏览/评论数

**F. ChangelogAndSpacesRow（更新日志 + 本周活跃空间）** —— 双列
- **更新日志**：4 条 release，每条 `🏷 v2.4.1 [最新]` + 标题 + 日期 + 右侧 `详情 →`
  - 内容来自 CHANGES-V2.md 风格：搜索 ⌘K · 暗色 dim 模式 · 留言板优化 / AI 助手 + 面试记录模板 / SQL 实验室上线 · 全站活跃热力图 / 好友圈、聊天频道、蝶灵圆桌
- **本周活跃空间**：4 个用户卡片，每个 28px 圆头像 + @handle + 角色 + `XX 篇文章 · 🔥 连续 XX 天` + `↑ XX%` chip + `👁 看看` 按钮

**G. FAQCard（常见问题）** —— 2 列网格，6 个问答
- 数据真的可以导出吗？/ Markdown + JSON 全量打包
- 我能让某个模块只给好友看吗？/ ModuleVisibility per module（public / friends / private）
- 公开主页的 URL 能自定义吗？/ publicSlug → /@yourname
- AI 助手会拿我的数据训练吗？/ 不会
- 想自部署？/ Next.js + Prisma + PostgreSQL，开源 MIT
- 蝶灵圆桌是什么？/ 每天 8:00 / 22:00 自动开启议题，可回看追问

### 5.4 BottomCTA（底部行动召唤）

`background: var(--bg-deep)` · padding 44px 22px · 上下 hairline

居中 880px 列：
- accent 小字：`→ 准备好开始了？`
- 大标题（48px 衬线斜体）：`创建一个空间，把这一年写下来。`（"这一年"用 accent 色）
- 段落：`免费 · 邀请制 · MIT 开源 · 数据可随时导出。注册后立刻拿到 /u/yourname 的公开主页。`
- 3 个按钮：`+ 创建你的空间 →` / `登录已有账号` / `浏览公开空间 →`

### 5.5 Footer（5 列）

- 第一列（260px）：品牌 mark + 描述 + 4 个圆形社交图标按钮（RSS · code · book · chat）
- 4 个内容列：产品 / 资源 / 社区 / 支持，每列 5 个链接
- 底部 hairline + 左右两个 kicker：
  - 左：`© 2026 MY-SPACE · 构建 a3f9c27 · v2.4.1 · 运行 757 天 · 在线 43 人`
  - 右：`● 全部系统正常 · 隐私 · 条款 · 许可`

---

## 六、设计 Token（暗色为主）

> ⚠️ **不要直接 import preview/tokens.css**。把这些值加进 `app/globals.css` 的 `@theme inline` 区块，或者在 `components/landing/landing.module.css` 里作为 landing 局部 token。

### 6.1 颜色

```css
/* 底色 */
--landing-bg:         #0b0d10;   /* 主底 */
--landing-bg-deep:    #07090b;   /* 更深 — header/footer/code block */
--landing-surface:    #11141a;   /* 卡片 */
--landing-surface-2:  #161a21;   /* 嵌套表面 */

/* 描边 */
--landing-line:        #1b2029;   /* 卡内分割线 */
--landing-line-2:      #262c35;   /* 卡片边框 */
--landing-line-strong: #353c47;

/* 文字 */
--landing-text:    #e6e1d6;   /* 暖白 cream，非纯白 */
--landing-text-2:  #9ea4ad;
--landing-text-3:  #5f6671;
--landing-text-4:  #3e444d;

/* 强调色（默认 blue accent） */
--landing-blue:    #6aa6ff;
--landing-green:   #7ee787;
--landing-red:     #e94560;
--landing-warm:    #f6c177;
--landing-accent:  var(--landing-blue);
```

模块色（用于色 dot + module bar）：
- blue `#6aa6ff` · green `#7ee787` · amber `#f6c177` · red `#e94560`
- purple `#a78bfa` · cyan `#22d3ee` · pink `#ec4899` · orange `#fb923c`

### 6.2 字体

```css
--f-display: "Instrument Serif", "Source Han Serif SC", "Noto Serif SC", "Songti SC", Georgia, serif;
--f-sans:    "Inter", "PingFang SC", -apple-system, "Microsoft YaHei", system-ui, sans-serif;
--f-mono:    "Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
--f-cn-serif:"Source Han Serif SC", "Noto Serif SC", "Songti SC", Georgia, serif;
```

字体引入（`app/layout.tsx` 已用 Geist，仍需新增 Instrument Serif + Noto Serif SC）：

```ts
import { Instrument_Serif, Noto_Serif_SC } from "next/font/google"

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
})

const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-sc",
})
```

### 6.3 字号 / 行距

| 用途 | 字号 | weight | letter-spacing | family |
|---|---|---|---|---|
| Hero 大标题（48–84px） | 48 / 84px | 400 | -0.025em | display italic |
| H2 卡内大标题 | 28–36px | 400/600 | -0.015em | display italic |
| H3 区块标题 | 14px | 600 | 0 | sans |
| 正文 | 14px | 400 | 0 | sans / cn-serif |
| 副文 / desc | 12.5–13px | 400 | 0 | sans |
| Kicker / 小标签 | 10.5px | 500 | 0.06em uppercase | mono |
| 数字 | tabular-nums | 500/600 | -0.01em | mono |
| Code | 12.5px | 400 | 0 | mono |

### 6.4 间距 + 圆角 + 描边

```
卡片圆角:   8px           (.card-gh)
按钮圆角:   4px / 6px / 999px (chip)
内边距:     卡片头 10px 16px / 卡片体 14–26px / sticky header 0 22px
section gap: 22px (主栏内卡片之间)
column gap:  32px (sidebar ↔ main)
hairline:    1px solid var(--landing-line-2)
```

### 6.5 阴影

页面整体不用大阴影，只在 sidebar status pill 用：
```
0 4px 12px rgba(0,0,0,0.3)
```
卡片**完全靠 1px hairline 表达层级**，不要加阴影。

---

## 七、交互与动效

| 元素 | 交互 |
|---|---|
| 顶栏链接 | hover 颜色变为 `var(--landing-accent)` |
| 模块卡片 | hover border 变 accent 50% mix · 150ms ease |
| 状态 pulse | sidebar pill 上的小绿点：`@keyframes pulse-dot` opacity 0.4↔1 · 1.4s ease-in-out infinite |
| 按钮 | hover 加 1px border 或 bg 提亮 8% · 150ms |
| 链接 | underline 用 1px accent 30% mix，hover 完整 accent |

**全站不要 transform / scale 动效**——保持 GitHub 那种克制的"颜色微变"感。

---

## 八、状态管理 / 数据

落地页本身**无状态**，全部静态渲染即可（Next.js Server Component）。

数据来源选项：

**A. 真实数据（推荐）**：服务端聚合查询
```ts
// app/page.tsx 未登录分支
const [platformStats, recentPosts, recentActivity, activeSpaces] = await Promise.all([
  getPlatformStats(),       // count users / posts / jobs / visits
  getRecentPublicPosts(),   // 取 public visibility 的最新 5-6 篇
  getRecentActivity(),      // 类似 getRecentActivityHub 但限定 public
  getTopActiveSpaces(),     // 按 streak 排序
])
```

**B. Demo 数据**（先上线，逐步替换）：直接把 `preview/shared.jsx` 里的常量翻译成 TS 常量。**至少**真实的部分应该是：
- 平台模块列表（14 个，对照 lib/permissions.ts 的 ModuleKey）
- 在线人数（lib/active-chat 已有 presence 机制）
- 更新日志（用 CHANGES-V2.md 解析）

热力图数据：可以用 `getArticleActivityData()` + `getJobActivityData()` 聚合所有用户（不是单用户），转成 53 周 × 7 天矩阵。

---

## 九、关键资源 / 复用机会

webappwork 里**已经存在**可以直接利用的组件：

| 落地页用途 | 现有组件 | 路径 |
|---|---|---|
| Hero metric strip | `<MetricStrip>` | components/profile/personal-home.tsx |
| 求职漏斗 | `<JobFunnelCard>` | components/profile/personal-home.tsx |
| 写作统计 | `<WritingStatsCard>` | components/profile/personal-home.tsx |
| 访客概览 | `<VisitOverviewCard>` | components/profile/personal-home.tsx |
| 紧凑热力图 | `<CompactHeatmapCard>` | components/profile/personal-home.tsx |
| 用户头像 | `<UserAvatar>` | components/user-avatar.tsx |
| 通用按钮 | `<Button>` | components/ui/button.tsx |
| 通用 chip | shadcn Badge | components/ui/badge.tsx |
| Markdown 卡 | `<MarkdownContent>` | components/markdown-content.tsx |

特别是 §5.3.C "登录后你会看到"——**这一节强烈建议直接用现有的 PersonalHero/MetricStrip/JobFunnel 渲染假数据**，而不是重新画 mockup。视觉效果会比预览还好，因为预览是手画的。

---

## 十、Assets

- **品牌 mark SVG**：见 `preview/landing-header.jsx` 的 `<SpaceMark>` 和 `preview/landing-sidebar.jsx` 的 `<BigSpaceMark>`。两个尺寸都是纯 SVG，直接复制即可
- **图标**：`preview/shared.jsx` 里的 `<Icon name="...">` 列表都是手绘 1.5 stroke 线性图标。webappwork 已有 lucide-react，**优先用 lucide 对应图标**：
  - arrowR → ArrowRight · arrowUR → ArrowUpRight · plus → Plus · enter → LogIn
  - lock → Lock · open → Eye · folder → Folder · file → FileText · book → BookOpen
  - briefcase → BriefcaseBusiness · video → Video · sticky → StickyNote · pen → PenLine
  - calendar → CalendarDays · bulb → Lightbulb · chat → MessageCircle
  - person → User · persons → Users · sparkles → Sparkles · database → Database
  - tag → Tag · pin → Pin · flame → Flame · activity → Activity · search → Search
  - bell → Bell · menu → Menu · funnel → Filter · star → Star

- 字体：Google Fonts (Instrument Serif + Noto Serif SC) — next/font/google

---

## 十一、Definition of Done

- [ ] `/` 未登录态显示落地页；登录态保持原 dashboard
- [ ] 落地页全中文
- [ ] 与 preview.html 视觉一致（颜色、字体、间距、布局）
- [ ] 使用 lucide-react 替换内联 SVG 图标
- [ ] §5.3.C 复用现有 PersonalHome 组件
- [ ] 热力图数据用真实平台聚合（不是 hardcode）
- [ ] FAQ 6 项原文不改
- [ ] CTA 跳转：`创建你的空间` → /register · `登录` → /login · `浏览公开空间` → /u/[首页推荐用户] or /community
- [ ] 移动端简单堆叠不破版（侧边栏放顶部）
- [ ] 不引入 tweaks-panel.jsx（仅原型用）

---

## 十二、参考文件

直接打开看：

- `preview.html` — 完整落地页预览（在浏览器里打开，可以滚动 / 切 Tweaks 试色）
- `preview/landing-main.jsx` — 主栏所有板块的精确实现，是最重要的参考
- `preview/landing-sidebar.jsx` — 侧边栏全部细节
- `preview/landing-header.jsx` — 顶栏 + 标签栏
- `preview/tokens.css` — 全部 token 定义

webappwork 项目里需要重点看的：

- `app/page.tsx` — 这是改造目标
- `lib/auth.ts` — `getOptionalSession()` / `requireAuth()`
- `components/profile/personal-home.tsx` — 可复用的卡片组件
- `app/globals.css` — 现有 design token 系统
- `CHANGES-V2.md` — 用于生成"更新日志"区块内容
