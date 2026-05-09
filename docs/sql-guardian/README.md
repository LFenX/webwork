# SQL Guardian 文档包

本目录是给 Codex 使用的 **SQL Guardian / 数据航海守门人** 功能文档包。它的目标不是只做一个会动的贴纸，而是把 SQL Lab 右侧的 SQL Assistant 升级成一个全站陪伴型、可成长、可记忆、有独立人格的 2D 角色系统。

> 建议：不要一次性让 Codex 完成全部功能。请按 `10-codex-task-list.md` 逐步派发任务，每轮只允许它完成一个明确阶段。

## 一句话目标

在现有个人空间平台中新增一个住在网站里的 2D AI 守门人：它与 SQL Assistant 深度绑定，也能在全站页面活动；它有自己的家、动作、表情、人格、记忆、成长系统和世界观；它与用户的专属 AI 助手“蝶灵 / SoulWing”是朋友关系，能够在授权边界内共享用户上下文，但它本身是独立人格，不属于用户所有。

## 当前项目上下文

项目是一个综合型个人数字空间平台，已包含首页、内容系统、简历、求职、好友、聊天、社区资源、SoulWing AI、SQL Lab、后台治理、权限审计等模块。技术栈以 Next.js App Router、React、TypeScript、Tailwind、Prisma、PostgreSQL 为核心。SQL Lab 已具备多标签编辑器、Schema 树、查询执行、结果面板、历史、收藏、SQL Assistant、权限、授权、列屏蔽、行过滤与审计等能力。

SQL Guardian 必须作为现有平台能力的延展，而不是另起一套孤立系统。

## 文档清单

| 文件 | 用途 |
|---|---|
| `00-brief.md` | 一页纸产品总纲，给 Codex 快速理解愿景和边界 |
| `01-code-map.md` | 当前代码结构假设、需要 Codex 先验证的路径、集成点 |
| `02-mvp-scope.md` | MVP 范围、用户故事、阶段边界、验收口径 |
| `03-worldview-and-character.md` | 宏大世界观、角色设定、形态升级、台词风格 |
| `04-personality-memory-policy.md` | 人格、记忆、蝶灵共享、隐私、风格注入规则 |
| `05-data-model.md` | Prisma 数据模型草案、索引、迁移策略、事件积分 |
| `06-ui-animation-spec.md` | 2D 视觉、动作、状态机、边界行走、虫洞、移动端与无障碍 |
| `07-api-contract.md` | API 路由、请求响应、权限、错误码、SQL Assistant 集成契约 |
| `08-architecture-and-integration.md` | 前后端架构、服务拆分、AI Prompt Stack、模块接入路线 |
| `09-test-plan.md` | 单测、集成、E2E、安全、性能、无障碍验收清单 |
| `10-codex-task-list.md` | 可直接复制给 Codex 的分阶段任务卡 |
| `AGENTS.sql-guardian.template.md` | 可合并到仓库根目录 `AGENTS.md` 的 Codex 工作说明模板 |

## 推荐使用顺序

1. 把本目录复制到仓库根目录的 `docs/sql-guardian/`。
2. 将 `AGENTS.sql-guardian.template.md` 合并到根目录 `AGENTS.md`，或临时放在根目录给 Codex 读取。
3. 先让 Codex 执行 `10-codex-task-list.md` 的 Task 00：只扫描代码，不修改文件。
4. 根据 Codex 扫描出的真实路径，更新 `01-code-map.md`。
5. 从纯前端骨架开始实现，再接数据库，再接 AI，再接 SQL Assistant 风格，最后接蝶灵共享记忆和高级形态。

## 总体原则

- **先让它活在网站里，再让它变得宏大。** 第一版先做舒适、稳定、可关闭、可对话。
- **先做骨架，再做人格，再做剧情。** 不要把剧情系统和前端挂载混在第一轮开发里。
- **不重写 SQL Lab。** SQL Guardian 是 SQL Assistant 的人格层和交互层，不改变 SQL 安全边界。
- **不重写 SoulWing。** 复用现有 AI、记忆、权限、审计和工具调用系统。
- **不复制已有动漫角色。** 可以采用热血航海冒险氛围，但必须是原创角色设计。
- **用户数据归用户控制。** Guardian 有独立人格，但它保存的用户相关记忆必须可查看、可删除、可重置。
