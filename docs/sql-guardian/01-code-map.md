# 01 - 代码地图与集成点

> 本文件是给 Codex 的“代码侦察指南”。其中部分路径是基于当前项目结构的合理推测，Codex 在第一轮任务中必须扫描仓库并补全真实路径，然后再开始编码。

## 1. 当前项目结构摘要

当前项目是一个 Next.js App Router 应用，技术栈包括：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- App Router Route Handler
- SoulWing AI 助手
- SQL Lab
- 后台权限与审计
- PWA、实时通知、会话心跳、活动记录等平台能力

SQL Guardian 应该作为现有平台能力的延展，而不是新增一套完全独立的应用。

## 2. Codex 第一轮必须确认的路径

请 Codex 第一轮只扫描代码，不修改文件，并补全下表。

| 模块 | 需要确认的真实路径 | 备注 |
|---|---|---|
| 全站根布局 | `app/layout.tsx` 或 `app/(...)/layout.tsx` | 用于挂载 `GuardianHost` |
| App Shell | `components/app-shell/*` 或类似路径 | 如果已有全站 Shell，应挂载在这里 |
| SQL Lab 页面 | `app/sql-lab/*` 或 `app/(protected)/sql-lab/*` | 用于插入角色之家 |
| SQL Lab 组件 | `components/sql-lab/*` | 找到 editor、assistant panel、layout |
| SQL Assistant API | `app/api/sql-lab/assistant/*` 或类似路径 | 用于注入人格上下文 |
| SQL 执行 API | `app/api/sql-lab/query/*` 或类似路径 | 只读取事件，不改变安全逻辑 |
| SQL Lab 权限服务 | `lib/sql-lab/*` 或 `lib/sql/*` | 不允许绕过 |
| SoulWing AI 服务 | `lib/ai/*`、`app/api/ai/*` | 复用 provider 与审计 |
| 记忆服务 | `lib/ai/memory*` 或类似路径 | Guardian 读取共享记忆 |
| 活动日志 | `lib/activity*`、`app/api/activity*` | 可用于成长事件 |
| 认证/session | `lib/auth*`、`auth.ts`、`middleware.ts` | 所有 API 必须校验用户 |
| 用户设置 | `app/settings/*`、`components/settings/*` | 后续增加 Guardian 设置 |
| Prisma schema | `prisma/schema.prisma` | 新增数据模型 |
| 迁移目录 | `prisma/migrations/*` | 新增 migration |
| UI 基础组件 | `components/ui/*` | 复用 Button、Dialog、Popover、Tooltip |
| Toast | `components/ui/toast*` 或 `sonner` | 角色升级提示可复用 |
| CSS 变量 | `app/globals.css` 或 `styles/*` | 新增 Guardian 主题变量 |

## 3. 推荐新增目录

如果仓库没有更合适的约定，建议新增以下目录：

```txt
components/sql-guardian/
  GuardianHost.tsx
  GuardianProvider.tsx
  GuardianHome.tsx
  GuardianSprite.tsx
  GuardianBubble.tsx
  GuardianChatPanel.tsx
  GuardianSettingsPanel.tsx
  GuardianLevelUpToast.tsx
  GuardianReducedMotionFallback.tsx

hooks/
  use-guardian.ts
  use-guardian-events.ts
  use-guardian-position.ts

lib/sql-guardian/
  constants.ts
  events.ts
  state-machine.ts
  persona.ts
  memory-policy.ts
  prompts.ts
  profile-service.ts
  memory-service.ts
  event-service.ts
  dialogue-service.ts
  sql-assistant-context.ts

app/api/guardian/
  profile/route.ts
  chat/route.ts
  events/route.ts
  memories/route.ts
  reset/route.ts
  status/route.ts
```

如果项目已有命名风格，例如 `kebab-case` 或 `camelCase`，Codex 必须遵守现有风格。

## 4. 全站挂载点

### 4.1 首选位置

优先挂载在全站 App Shell 内，确保：

- 已登录用户可见。
- 可访问 session/userId。
- 不影响服务端渲染主要内容。
- 可以在所有模块页面出现。

示意：

```tsx
<AppShell>
  {children}
  <GuardianHost />
</AppShell>
```

### 4.2 次选位置

如果没有统一 App Shell，可在 `app/layout.tsx` 或受保护路由组 layout 中挂载：

```tsx
<body>
  {children}
  <GuardianHost />
</body>
```

注意：如果 `GuardianHost` 使用浏览器 API，需要是 Client Component，并避免 SSR hydration 错误。

## 5. SQL Lab 集成点

### 5.1 角色之家入口

在 SQL Assistant 面板顶部或右上角加入 `GuardianHome`。

角色之家应当：

- 不挤压核心 SQL Assistant 内容。
- 能显示当前心情或等级。
- 点击后打开 Guardian 对话。
- 在 SQL Lab 中优先使用“专业模式”台词。

### 5.2 SQL Assistant 风格注入

不要修改 SQL 安全逻辑。只在生成回答时注入 persona context：

```ts
const personaContext = await buildSqlAssistantPersonaContext(userId)
```

然后将其作为 system/developer prompt 的一部分传入 SQL Assistant。

必须保持：

- 表授权不变。
- 列屏蔽不变。
- 行过滤不变。
- 审计不变。
- 禁止语句检测不变。
- 查询执行限制不变。

### 5.3 SQL 事件接入

SQL Lab 的这些事件可以写入 GuardianEvent：

- 打开 SQL Lab
- 运行查询
- 查询成功
- 查询失败
- 保存收藏查询
- 使用 SQL Assistant 生成查询
- 使用 SQL Assistant 解释查询
- 修复查询错误

事件只用于成长和情绪变化，不应该改变查询结果。

## 6. SoulWing / 蝶灵集成点

Guardian 与蝶灵共享上下文时，必须通过现有记忆服务或工具服务读取，不要直接访问所有用户数据。

推荐调用路径：

```txt
Guardian API
  -> guardianMemoryService
    -> existing SoulWing memory service / tool gateway
      -> authorized user-scoped memory summary
```

原则：

- 只读取当前用户可访问的数据。
- 只读取允许共享给 Guardian 的摘要。
- 不让 Guardian 直接调用 admin-only 工具。
- 不绕过 AI 工具审计。
- 不复制 SoulWing 的完整实现。

## 7. 后台与设置集成点

第一阶段可以不做后台管理，但至少预留：

- 用户可关闭 Guardian。
- 用户可关闭动画。
- 用户可暂停记忆。
- 用户可查看 Guardian 记住了什么。
- 用户可删除单条记忆。
- 用户可重置 Guardian。

后续可在后台增加：

- Guardian 功能开关。
- Guardian 使用统计。
- Guardian AI 成本统计。
- Guardian 记忆审计。
- 角色资产管理。

## 8. 需要避免的错误

- 不要在 `window` 未定义的服务端组件里访问浏览器 API。
- 不要把 Guardian API 写成无鉴权公开接口。
- 不要让前端传入 `userId` 后端直接信任。
- 不要让 Guardian 获取其他用户记忆。
- 不要在 SQL Assistant 中降低安全提示。
- 不要为了动画引入过大的库，除非有明确收益。
- 不要将版权角色形象写入 prompt 或资源名。
- 不要把角色状态全部存在 localStorage，核心状态必须服务端持久化。
- 不要让动画遮挡编辑器输入、Run 按钮或查询结果。

## 9. Codex 第一轮输出要求

Codex 第一轮执行后，应输出：

```md
# SQL Guardian Code Scan Result

## 确认的真实路径
...

## 建议新增文件
...

## 可复用的现有服务
...

## 风险点
...

## 分阶段实现建议
...

## 本轮是否修改代码
否
```

第一轮禁止修改代码。
