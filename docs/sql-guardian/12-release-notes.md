# 12 - SQL Guardian MVP Release Notes

## 1. Release summary

SQL Guardian MVP 是一个住在网站里的 AI 守门人角色系统。它把 SQL Lab 附近的 Guardian 小屋、全站 2D 角色、成长档案、轻量聊天、可控记忆和用户隐私设置组合成一个可上线的第一版。

本版本包含：

- 全站 2D Guardian
- SQL Lab 数据小屋
- 巡航 / 睡眠 / teleport / level-up
- GuardianProfile / level / exp / title
- 轻量 Guardian Chat
- GuardianDialogue 短对话历史
- GuardianMemory 可控长期记忆
- SoulWing 授权共享摘要桥
- SQL Assistant style-only persona
- 用户设置与 reset

## 2. What is included

- 每个用户独立 GuardianProfile。
- 服务端计算 GuardianEvent 经验、等级、称号和形态。
- 全站 GuardianHost 浮层，支持隐藏、恢复、dock、compact、reduced-motion。
- SQL Assistant 标题栏附近的 GuardianHomeIcon。
- Guardian Chat，非 streaming，复用现有 AI provider。
- GuardianDialogue 短历史，可关闭和清空。
- GuardianMemory 长期记忆，可查看、候选确认、拒绝、删除和关闭。
- SoulWing -> Guardian 授权共享摘要桥，只读用户授权的 `sharedSummary`。
- SQL Assistant style-only Guardian persona，仅影响表达风格。
- Settings / reset API 和前端轻量设置面板。

## 3. What is not included

- Guardian 不执行 SQL。
- Guardian 不绕过 SQL 权限。
- Guardian 不读取全部 SoulWing memory。
- Guardian 不写入 SoulWing memory。
- Guardian 不扫描用户全站数据。
- Guardian 不使用 AI tools。
- Guardian 不使用 embedding / vector search。
- Guardian 不把 GuardianMemory 注入 SQL Assistant。
- Guardian 不把 bridge summary 注入 SQL Assistant。
- Guardian 不替代 SoulWing。

## 4. Safety boundaries

- SQL 执行仍由 SQL Lab 原有权限、审计、安全检查、行过滤和列屏蔽控制。
- SQL Assistant persona 是 style-only，不能改变 SQL 正确性、权限、审计或可执行 SQL 格式。
- GuardianMemory 和 bridge 都由用户控制，可关闭、删除或撤销。
- Reset 只影响 SQL Guardian 数据，不删除 SoulWing、SQL Lab、SQL Assistant conversations、文章、简历、聊天或频道。
- Settings 可以关闭显示、动画、巡航、成长事件、短历史、长期记忆、SQL Assistant persona 和 SoulWing 共享摘要桥。

## 5. Migration notes

SQL Guardian MVP 新增过以下 migrations：

- `20260509100000_add_sql_guardian_profile`
- `20260509143000_add_sql_guardian_dialogue`
- `20260509170000_add_sql_guardian_memory`
- `20260509183000_add_sql_guardian_memory_bridge`

本地开发过程中，曾因仓库既有 shadow DB 历史迁移问题使用 `prisma db execute` + `prisma migrate resolve` 处理 GuardianDialogue migration。上线时请按部署环境的标准迁移流程谨慎执行，先确认 migration SQL 只包含预期的 Guardian 表、索引和外键变更。不要把本地执行状态等同于生产环境已执行。

## 6. Rollback / disable strategy

最小关闭方式：

- PATCH settings: `guardianEnabled=false`
- PATCH settings: `guardianMemoryEnabled=false`
- PATCH settings: `soulwingToGuardianMemoryBridgeEnabled=false`
- PATCH settings: `sqlAssistantPersonaEnabled=false`

数据清理方式：

- `POST /api/sql-guardian/reset` with `scope=all`
- `confirmText` 必须为 `RESET SQL GUARDIAN`

完全停用方式：

- 后续可增加 feature flag。
- 当前也可以从全站 Layout 中移除 GuardianHost，但这不属于本 release 的运行时设置能力。

## 7. Known limitations

- Guardian Chat v1 非 streaming。
- GuardianMemory 无 embedding / semantic search。
- Bridge v1 只实现 SoulWing -> Guardian。
- 视觉系统使用 CSS / SVG 轻量形态，不是完整 sprite sheet。
- 当前项目没有 `npm test` 脚本。
- 指定 ESLint 范围可能仍显示既有 unrelated warning，例如 `lib/sql-lab/assistant.ts` 中的未使用变量 warning。
