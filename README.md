# lgplayblog / My Space

一个基于 Next.js 16 App Router 的多用户个人空间应用。它不再是默认的
`create-next-app` 示例，而是一个把个人主页、内容写作、简历、求职记录、好友互动、
社区资源、AI 助手和 SQL 分析工作台放在一起的完整产品。

未登录访问者会进入公开落地页；登录后进入个人工作台，并按用户权限展示内容、聊天、
后台管理和实验室能力。

## 当前技术栈

- Next.js `16.2.4`，React `19.2.4`，TypeScript `5`
- App Router，Server Components，Route Handlers
- Tailwind CSS `4`，shadcn/ui 结构，Radix UI，lucide-react
- Prisma `7`，PostgreSQL，`@prisma/adapter-pg`
- TipTap / Markdown / MDX，KaTeX，Mermaid，highlight.js
- JSON Resume 主题系统，PDF/HTML 简历预览与导出
- ECharts、Recharts、React Flow、elkjs
- OpenAI-compatible AI provider 配置、流式响应、工具调用记录、用量审计

Next.js 16 有行为变化：本仓库的 `AGENTS.md` 要求在写 Next.js 相关代码前优先阅读
`node_modules/next/dist/docs/` 下的本地文档。`next dev` 默认使用 Turbopack；
`next build` 不再自动运行 lint，需要显式执行 `npm run lint`。

## 主要功能

### 个人空间

- 登录后的首页聚合写作、求职、聊天、访问、留言和最近动态。
- 个人公开页位于 `/u/[userId]`，支持公开 slug、访问统计和模块可见性。
- 支持中英文界面、个人资料、头像、隐私、Live2D 看板娘、主页卡片布局配置。
- PWA manifest、图标、Service Worker 清理和移动端视口适配已接入。

### 内容系统

- `/blog`、`/daily`、`/reflections`、`/notes` 四类内容。
- 支持新建、编辑、阅读、文件夹、标签、摘要、评论、访客可见性。
- 编辑器使用 TipTap/Markdown 能力，包含表格、代码块、数学公式、Mermaid 等扩展。
- 内容同时支持数据库存储和旧版 `content/` MDX 兼容。

### 简历与求职

- `/resume` 支持 Markdown、PDF、JSON Resume 三种模式。
- `/resume/templates` 管理大量 `jsonresume-theme-*` 主题，支持模板配置和渲染审计。
- 简历版本、上传、预览、HTML iframe、导出接口已经落地。
- `/jobs` 和 `/interviews` 用于记录投递、岗位、状态、面试轮次、反馈和统计图表。

### 好友、聊天与社区

- `/friends` 提供好友请求、私聊、群聊、频道、未读提醒、附件、表情包。
- 世界频道公告、站内广播、实时事件、会话心跳和离线状态已接入。
- SoulWing Roundtable 支持晨间/夜间议题、讨论消息、参与者和后台控制。
- `/community/resources/websites` 提供网站资源分享、文件夹、截图位置、访问统计。
- `/stickers/community` 提供社区表情包贡献与收藏。

### AI 助手

- `/ai` 是 SoulWing AI 助手，支持持久会话、流式输出、多图输入和执行轨迹。
- 用户可配置个人 OpenAI-compatible provider；管理员也可给用户下发 AI grant。
- 后端记录 `AIRun`、`AIRunStep`、工具调用、审计日志和 token/延迟用量。
- AI 工具访问有服务端白名单，按 self、visible-user、admin-delegated 范围控制。
- 长期记忆模块包含 `MemoryFact`、`MemoryEvent`、`MemoryToolEvent`，并使用 pgvector 原生列。

### SQL Lab

- `/sql` 是数据库分析工作台，包含 SQL 执行、历史、保存查询、关系图、可视化和 AI Stage。
- `/sql/relations` 使用 React Flow + elkjs 展示数据库关系。
- 管理员可在后台配置 SQL Lab 表级权限、审计、schema profile 和用户访问。
- `/sql-practice` 是独立的 SQL 练习记录模块，访问由 owner/admin grant 控制。

### 后台管理

- `/admin` 面向 owner/admin。
- 包含用户管理、注册审批、密码变更审批、公告、贴纸、更新日志、活动审计。
- 包含 AI 授权、请求审批、用量统计、模型配置、SQL 访问授权和简历主题管理。

### MCP Server

`mcp-server/` 是单独的 MCP stdio 服务，暴露文章、文件夹、评论和上传工具，供外部 Agent
直接读写本应用的内容模块。详见 `mcp-server/README.md`。

## 目录结构

```txt
app/                  Next.js App Router 页面和 API
app/generated/prisma/  Prisma 7 生成客户端
components/           业务组件、布局组件、shadcn/ui 基础组件
content/              旧版或示例 MDX 内容
data/                 简历示例、主题兼容数据、主题快照
docs/                 迁移、AI、SQL Lab、设计交接等文档
lib/                  业务服务、权限、AI、SQL Lab、简历渲染、工具函数
mcp-server/           独立 MCP 服务
prisma/               Prisma schema、PostgreSQL migrations、旧 SQLite migrations
public/               静态资源、PWA 图标、Live2D 模型、上传文件入口
scripts/              数据迁移、主题验证、图标生成、记忆回填等脚本
resume-cli-master/    JSON Resume CLI 相关源码归档
solar-system-deck/    独立演示 PPT 生成项目
```

## 本地启动

### 环境要求

- Node.js `20.9+`
- npm，本仓库使用 `package-lock.json`
- PostgreSQL 数据库
- 如果启用记忆向量检索，需要 PostgreSQL 安装 `vector` 扩展

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env`，至少配置：

```bash
DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/webappwork_dev?schema=public"
POSTGRES_PASSWORD="replace-with-local-password"
SESSION_SECRET="replace-with-a-long-random-secret"
AI_SECRET_KEY="replace-with-32-byte-base64-or-long-random-secret"
```

常用变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 应用主 PostgreSQL 连接串，必填 |
| `POSTGRES_PASSWORD` | 本地 Postgres 密码，可被 `DATABASE_URL` 引用 |
| `SQLITE_DATABASE_URL` | 旧 SQLite 数据源，供迁移脚本使用，默认 `file:./dev.db` |
| `SESSION_SECRET` | 登录 session 签名密钥，必填 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | 旧迁移或本地 bootstrap 使用 |
| `AI_SECRET_KEY` | 加密 AI provider key、admin grant 等敏感配置 |
| `AI_PROVIDER_TIMEOUT_MS` | AI provider 请求超时，默认 120 秒 |
| `SQL_LAB_DATABASE_URL` | SQL Lab 可选独立连接串，默认复用 `DATABASE_URL` |
| `NEXT_PUBLIC_SITE_URL` | 生成公开链接和 SEO base URL |
| `NEXT_PUBLIC_GIT_HASH` | 落地页展示的构建版本短 hash |
| `MEMORY_EMBEDDING_*` | AI 记忆 embedding 回填和查询配置 |
| `SOULWING_AUTO_REPLY_ENABLED` | 启用聊天自动回复相关能力 |

MCP 服务还会使用 `BLOG_USER_ID`、`BLOG_USER_EMAIL`、`UPLOADS_DIR`，配置方式见
`mcp-server/README.md`。

### 初始化数据库

```bash
npm run db:generate
npm run db:migrate
```

如果需要把根目录旧 `dev.db` 导入 PostgreSQL：

```bash
npm run db:migrate:sqlite-to-postgres
```

迁移脚本会拒绝导入到非空 PostgreSQL 数据库。只有在确认目标库可丢弃并已经备份后，
才使用：

```bash
npm run db:migrate:sqlite-to-postgres -- --truncate
```

### 启动开发服务器

```bash
npm run dev
```

然后访问 `http://localhost:3000`。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run db:generate` | 生成 Prisma client 到 `app/generated/prisma` |
| `npm run db:migrate` | 执行已提交的 Prisma migrations |
| `npm run db:migrate:sqlite-to-postgres` | 从旧 SQLite `dev.db` 导入 PostgreSQL |
| `npm run resume:verify-themes` | 验证已安装 JSON Resume 主题 |
| `npm run resume:seed-template-config` | 初始化简历主题配置 |

## 数据库安全

本仓库当前数据库以 PostgreSQL migration 为准。请注意：

- 不要运行 `npx prisma db push`。
- 不要运行 `npx prisma db push --accept-data-loss`。
- 不要运行 `npx prisma migrate reset`，除非明确在一次性本地库中操作。
- 需要 schema 变更时，使用 migration，并检查生成 SQL。
- `MemoryFact`、`MemoryEvent`、`MemoryToolEvent` 有 raw SQL 创建的
  `embedding vector(1536)` 列和 HNSW 索引，Prisma schema 看不到这些列。

更多细节见 `docs/database-safety.md` 和 `docs/postgres-migration.md`。

## 开发注意事项

- 这是 Next.js 16 项目，修改路由、缓存、Server Actions、middleware/proxy 等逻辑前先读
  `node_modules/next/dist/docs/` 对应文档。
- 路由大多显式使用 `dynamic = "force-dynamic"` 和 `fetchCache = "force-no-store"`，避免用户态数据被错误缓存。
- 权限入口集中在 `lib/auth.ts`、`lib/admin.ts`、`lib/permissions.ts` 和各模块 access/service 文件。
- 业务数据默认按 `userId` 隔离；公开页和好友可见内容依赖 `ModuleVisibility`。
- 上传文件主要落在 `public/uploads` 或数据库记录指向的 storage path。
- `resume-cli-master/` 和 `solar-system-deck/` 是仓库内独立项目，主应用 lint 已忽略 `resume-cli-master/**`。

## 参考文档

- `docs/postgres-migration.md`：SQLite 到 PostgreSQL 的迁移审计和回滚说明
- `docs/database-safety.md`：数据库危险命令和 pgvector 隐藏列说明
- `docs/ai-assistant.md`：AI 助手 v2 的流程、权限边界和验证清单
- `docs/sql-lab-backend-plan.md`：SQL Lab 后端和权限模型规划
- `docs/sql-lab-p2-plan.md`：SQL Lab Stage、可视化和 AI 分析师模式规划
- `docs/sql-guardian/`：SQL Guardian 设计文档集合
- `mcp-server/README.md`：MCP 服务安装和工具说明
