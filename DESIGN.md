# 个人博客 + 求职追踪 Web App 设计方案

> 本文件为实现蓝图。执行者按 Phase 1 → Phase 5 顺序推进，每个 Phase 结束停下来验收。遇到选型冲突以本方案为准；未覆盖的细节按 Claude + GitHub 的整体风格类推，影响面大先问用户。

---

## 一、项目概述

打造融合「简历 / 博客 / 日常 / 心得 / 求职追踪 / 面试记录」的个人站点。

- **视觉**：Claude 的朴素专业风（暖白底、弱对比、大量留白、极简线条）
- **排版**：GitHub 风（分区清晰、等宽字体用于表格与数据、细边框）
- **使用形态**：单用户个人站，本地开发 + 可部署 Vercel
- **数据存储**：SQLite（Prisma 管理）用于表格类数据；MDX 文件用于内容类（博客/日常/心得/简历）

---

## 二、技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 14（App Router） | SSR + 文件路由 |
| 语言 | TypeScript | 全站严格类型 |
| 样式 | Tailwind CSS | 原子化样式，贴合朴素风格 |
| UI 组件 | shadcn/ui | 无样式包袱，完全可定制 |
| 图标 | lucide-react | 线条风格统一 |
| 内容 | next-mdx-remote + gray-matter | Markdown + frontmatter |
| 数据库 | SQLite + Prisma | 零配置、文件型 |
| 表格 | @tanstack/react-table | 排序、筛选、分页、分组 |
| 图表 | Recharts | 声明式，风格简洁 |
| 字体 | Inter + JetBrains Mono | 正文 + 表格/代码 |
| 校验 | Zod | 表单与 API 体校验 |
| 打印 | react-to-print（简历页） | PDF 导出 |

---

## 三、设计系统（Design Tokens）

### 3.1 色彩
```
--bg-primary     #FAF9F5   暖白（Claude 同款）
--bg-surface     #FFFFFF   卡片/表格背景
--bg-hover       #F4F3EC   表格 hover
--text-primary   #1A1A1A
--text-secondary #6B6B6B
--text-muted     #9A9A9A
--border         #E5E3DC
--border-strong  #D4D1C7
--accent         #C96442   Claude 橙，少量使用
--link           #0969DA   GitHub 蓝
--success        #3A7D5C   通过 / Offer
--warning        #B8902D   待回复 / 进行中
--danger         #A8463A   拒绝 / 未通过
```

### 3.2 字体
- 正文：`Inter`，基准 14px，行高 1.65
- 标题：`Inter`，字重 600；h1 28px / h2 22px / h3 18px
- 表格、数字、代码：`JetBrains Mono`，13px

### 3.3 间距与圆角
- 基础单位 4px；内容区最大宽度 768px（文章）/ 1200px（表格页）
- 圆角：输入 4px，卡片 6px，大容器 8px
- 阴影：不用或几乎不用，一律用 1px 细边框表达层级

### 3.4 交互
- 过渡 150ms ease-out；悬浮用底色变化而非外发光
- 按钮三类：主按钮（填色）、次按钮（边框）、幽灵按钮（纯文字 + hover 底色）

---

## 四、信息架构

```
/                    首页：统计概览 + 最近动态
├─ /resume           简历（单页、可打印）
├─ /blog             博客列表
│   └─ /blog/[slug]  博客详情
├─ /daily            日常（时间线）
│   └─ /daily/[slug]
├─ /reflections      心得
│   └─ /reflections/[slug]
├─ /jobs             求职追踪表格
└─ /interviews       面试记录表格
```

顶部导航按顺序显示：**Home / Resume / Blog / Daily / Reflections / Jobs / Interviews**

---

## 五、页面详细设计

### 5.1 全局 Layout
- 顶部 `<SiteHeader>`：左 Logo（纯文字 "your-name"），中 Tab 导航，右 主题切换（可选，预留）
- 内容区：`max-w-[1200px] mx-auto px-8`
- 底部 `<SiteFooter>`：一行，"© 2026 · Last updated {date}"

### 5.2 首页 `/`
三段纵向：
1. **Hero**：一句话介绍 + 头像（可选）+ 三个快捷入口（Resume / Blog / Jobs）
2. **数据概览**：4 张 `<StatsCard>` —— 累计投递 / 回复率 / 面试数 / Offer 数；每张带小趋势线
3. **最近动态**：两列 —— 左「最近文章」（博客+心得混合 5 条），右「最近日常」5 条

### 5.3 简历 `/resume`
- 内容源：`content/resume.mdx`
- 结构：基本信息 → 核心技能 → 工作经历 → 项目经历 → 教育背景 → 联系方式
- 右上角「打印 / 导出 PDF」按钮
- 打印样式：`@media print` 隐藏 Header/Footer，A4 边距

### 5.4 博客 `/blog`
- 列表项样式（仿 GitHub Releases）：日期（左侧灰字，等宽）+ 标题（加粗）+ 一行摘要 + 标签
- 详情：最大宽 720px 正文 + 右侧固定目录 TOC（≥1280px 屏才显示）
- 顶部支持标签筛选（tag chips）

### 5.5 日常 `/daily`
- 左侧「年/月」纵向时间线 + 右侧内容流
- 每条卡片：日期 + 标题 + 正文节选（最多 3 行）
- 不显示 TOC，保持轻量
- 用途偏「流水账」，允许短内容

### 5.6 心得 `/reflections`
- 视觉与 `/blog` 几乎一致，但列表强调「主题标签」而非日期
- 适合放长思考、总结、复盘

### 5.7 求职追踪 `/jobs`
页面自上而下：
1. **统计区**（四张 `<StatsCard>` + 两张 Chart）
   - 卡片：投递总数 / 回复率 / 面试转化率 / Offer 率
   - 图表：按状态分布（水平条形）、按月份投递数（折线）
2. **工具条**：状态筛选 chips + 日期范围 + 搜索框 + 「新建记录」按钮
3. **表格**：见下表头

**表头**：
| 列 | 类型 | 说明 |
|----|------|------|
| 公司 | text | 可点击展开详情 |
| 职位 | text | |
| 渠道 | enum | Boss / 拉勾 / 官网 / 内推 / 猎头 / 其他 |
| 投递日期 | date | |
| 状态 | enum（徽章） | 已投递 / 已回复 / 进入面试 / 已拒绝 / 已 Offer / 已接受 / 已放弃 |
| 是否回复 | bool | 自动推导：状态 >= 已回复 即 true |
| 面试机会 | bool | 自动推导：状态 >= 进入面试 即 true |
| 备注 | text | |
| 操作 | 按钮 | 编辑 / 删除 |

**交互**：
- 行内编辑：点击单元格即可改（文本、选择、日期）
- 多条件筛选与排序，URL 持久化查询参数
- 空状态：提示「还没有投递记录，点击右上角新建」

### 5.8 面试记录 `/interviews`
结构同 `/jobs`：顶部统计 + 工具条 + 表格。

**表头**：
| 列 | 类型 |
|----|------|
| 公司 | text |
| 职位 | text |
| 轮次 | enum：HR / 技术一面 / 技术二面 / 交叉面 / Leader 面 / HRBP / 终面 |
| 形式 | enum：电话 / 视频 / 现场 / 笔试 |
| 日期 | datetime |
| 面试官 | text |
| 问题记录 | markdown（详情弹窗打开） |
| 自评 | 1–5 星 |
| 结果 | enum：通过 / 未通过 / 待定 |
| 反馈 | text |

**统计元素**：
- 按公司聚合的面试次数（柱状）
- 按轮次的通过率（分组柱）
- 按形式分布（饼图）
- 关联 Job：录入时可选择已有 Job，建立外键

---

## 六、数据模型（Prisma Schema 草案）

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client { provider = "prisma-client-js" }

model JobApplication {
  id         String    @id @default(cuid())
  company    String
  position   String
  channel    String
  appliedAt  DateTime
  status     String    // JobStatus 枚举字符串
  repliedAt  DateTime?
  notes      String?
  interviews InterviewRecord[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model InterviewRecord {
  id              String          @id @default(cuid())
  jobId           String?
  job             JobApplication? @relation(fields: [jobId], references: [id])
  company         String
  position        String
  round           String          // InterviewRound
  format          String          // InterviewFormat
  scheduledAt     DateTime
  interviewers    String?
  questions       String?         // Markdown
  selfRating      Int?
  result          String          // InterviewResult
  feedback        String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

**枚举（TS 常量）**：
```ts
export const JOB_STATUS = ['已投递','已回复','进入面试','已拒绝','已 Offer','已接受','已放弃'] as const
export const INTERVIEW_ROUND = ['HR','技术一面','技术二面','交叉面','Leader 面','HRBP','终面'] as const
export const INTERVIEW_FORMAT = ['电话','视频','现场','笔试'] as const
export const INTERVIEW_RESULT = ['待定','通过','未通过'] as const
```

**MDX frontmatter**（blog / daily / reflections 通用）：
```yaml
---
title: 标题
date: 2026-04-20
tags: [tag1, tag2]
summary: 一行摘要（列表页显示）
---
```

---

## 七、核心组件清单

| 组件 | 作用 |
|------|------|
| `<SiteHeader>` | 顶部导航 |
| `<SiteFooter>` | 页脚 |
| `<StatsCard>` | 数值 + 标题 + 趋势 |
| `<StatusBadge>` | 状态彩色徽章 |
| `<DataTable>` | 通用表格，基于 tanstack/react-table |
| `<InlineEditCell>` | 行内编辑单元格（text / select / date） |
| `<MarkdownContent>` | MDX 渲染 + 代码高亮 |
| `<TOC>` | 文章目录 |
| `<Timeline>` | 日常页时间线 |
| `<EmptyState>` | 空状态提示 |
| `<Chart.Bar / .Line / .Pie>` | Recharts 封装 |
| `<DateRangePicker>` | 筛选组件 |
| `<TagFilter>` | chips 式标签筛选 |

---

## 八、API 路由（Next.js Route Handlers）

```
POST   /api/jobs                 创建
GET    /api/jobs                 列表（支持 status, from, to, q 查询）
PATCH  /api/jobs/[id]            更新（支持部分字段）
DELETE /api/jobs/[id]            删除
GET    /api/jobs/stats           聚合统计（回复率、转化率、按月分布）

POST   /api/interviews           创建
GET    /api/interviews
PATCH  /api/interviews/[id]
DELETE /api/interviews/[id]
GET    /api/interviews/stats
```

所有写入接口用 Zod 校验 body；错误统一 `{ error: string, code: string }` 返回。

---

## 九、文件结构

```
webappwork/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # 首页
│   ├── globals.css
│   ├── resume/page.tsx
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── daily/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── reflections/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── jobs/page.tsx
│   ├── interviews/page.tsx
│   └── api/
│       ├── jobs/
│       │   ├── route.ts
│       │   ├── stats/route.ts
│       │   └── [id]/route.ts
│       └── interviews/
│           ├── route.ts
│           ├── stats/route.ts
│           └── [id]/route.ts
├── components/
│   ├── ui/                         # shadcn 基础组件
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── stats-card.tsx
│   ├── status-badge.tsx
│   ├── data-table.tsx
│   ├── inline-edit-cell.tsx
│   ├── markdown-content.tsx
│   ├── toc.tsx
│   ├── timeline.tsx
│   ├── empty-state.tsx
│   └── charts/
│       ├── bar.tsx
│       ├── line.tsx
│       └── pie.tsx
├── content/
│   ├── resume.mdx
│   ├── blog/               *.mdx
│   ├── daily/              *.mdx
│   └── reflections/        *.mdx
├── lib/
│   ├── db.ts               # Prisma client（单例）
│   ├── mdx.ts              # 读取 MDX + frontmatter
│   ├── enums.ts
│   ├── validators.ts       # Zod schema
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── package.json
└── DESIGN.md
```

---

## 十、实现阶段（给 Sonnet 4.6 的执行顺序）

### Phase 1 — 脚手架（约 0.5 天）
1. `npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"`
2. 安装依赖：`shadcn/ui`（`npx shadcn@latest init` + 先装 button/input/select/badge/dialog/table/sheet/tabs/toast）、`lucide-react`、`prisma`、`@prisma/client`、`@tanstack/react-table`、`recharts`、`next-mdx-remote`、`gray-matter`、`zod`、`date-fns`、`clsx`、`tailwind-merge`
3. 在 `tailwind.config.ts` 注入设计系统色板与字体，在 `globals.css` 设置 `--bg-primary` 等 CSS 变量
4. 实现 `<SiteHeader>` + `<SiteFooter>` + `app/layout.tsx`
5. 放一个占位首页，确认视觉基调通过用户验收再继续

**验收点**：跑 `npm run dev` 打开首页，颜色、字体、导航符合方案 3.1-3.2。

### Phase 2 — 静态内容区（约 0.5 天）
6. `lib/mdx.ts`：扫描目录、解析 frontmatter、排序、按 slug 读取
7. `/resume` 页 + 打印样式
8. `/blog`、`/daily`、`/reflections` 列表页 + 详情页；`<MarkdownContent>`、`<TOC>`、`<Timeline>`
9. 放 1–2 篇示例 MDX 验证排版

**验收点**：三类内容页渲染正常，排版接近 GitHub README。

### Phase 3 — 数据库 + 求职追踪（约 1 天）
10. `prisma init` + 迁移；写 seed 脚本放 3–5 条示例数据
11. `lib/validators.ts`（Zod）+ API Route：`/api/jobs/*`
12. `<DataTable>`、`<StatusBadge>`、`<InlineEditCell>`
13. `/jobs` 页：统计卡 + 图表 + 工具条 + 表格，支持筛选、排序、行内编辑、新建/删除
14. URL 查询参数持久化筛选状态

**验收点**：能增删改查、筛选、排序；统计区数字与图表与表格一致。

### Phase 4 — 面试记录（约 0.5 天）
15. `/api/interviews/*` + schema
16. `/interviews` 页：复用 `<DataTable>`、`<StatsCard>`、Charts
17. 面试记录关联 Job：录入弹窗支持从已有 Job 选择

**验收点**：关联关系、统计、详情弹窗全部可用。

### Phase 5 — 首页聚合 + 打磨（约 0.5 天）
18. 首页拉取真实统计 + 最近动态
19. 统一空状态、加载骨架、错误边界
20. 响应式：移动端导航折叠、表格横向滚动
21. `@media print` 简历样式校验
22. 一次性过一遍 Lighthouse，修显著问题

**验收点**：首页与各页之间数据一致；移动端不破版；打印简历干净。

---

## 十一、风格细节要点（写代码时始终贴合）

- **等宽字体** 仅用于：表格、数字、代码块、日期、ID。其他一律 Inter。
- **表格**：
  - 表头底部 1px 深一点边框（`--border-strong`），数据行底部 1px 浅边框
  - 行 hover `--bg-hover`；选中行左侧 2px 强调色竖条
  - 状态徽章：浅底色 + 深文字，不加边框
- **按钮**：
  - 主按钮：`bg-[--text-primary] text-white`，hover 提亮 8%
  - 次按钮：`border border-[--border-strong] bg-transparent`
  - 幽灵按钮：`text-[--text-secondary]`，hover 加 `--bg-hover`
- **卡片**：`bg-[--bg-surface] border border-[--border] rounded-md p-6`，不要阴影
- **标题层级**：h1 只用于页面标题；一页最多一个 h1
- **链接**：正文链接 `--link`，悬浮加下划线；非正文链接（导航、列表）用 `--text-primary`
- **图表**：用主色 + 两到三种饱和度变体，避免彩虹色
- **空状态**：居中、一个轻灰图标 + 一句话 + 一个主按钮
- **无过度动画**：除了 150ms 的颜色/背景过渡，不要位移、缩放、弹跳

---

## 十二、交付提示词（复制给 Sonnet 4.6）

> 按 `D:\appmy\webappwork\DESIGN.md` 初始化并实现此项目。严格按 Phase 1 → Phase 5 顺序推进，每个 Phase 结束后停下来让我验收再继续。遇到选型冲突以本方案为准；方案未覆盖的小细节按 Claude + GitHub 的整体风格类推；若影响面较大（例如需要换数据库、改路由结构），先问我。每完成一个 Phase 给我一个简短变更摘要与下一步。

---

## 附：未决事项（可供用户选择）

1. **是否要登录/密码保护**？当前方案默认无鉴权（单人本地使用）。若需部署到公网，建议加 `next-auth` + 单密码或 GitHub OAuth，工作量约 +0.5 天。
2. **是否需要全文搜索**？默认无。若需要，推荐 `minisearch`（纯前端索引），工作量约 +0.25 天。
3. **暗色模式**？方案已预留 CSS 变量，可在 Phase 5 之后再加。
4. **部署目标**？Vercel（需把 SQLite 换为 Turso 或 Neon Postgres）/ 本地永久运行（保持 SQLite）。
