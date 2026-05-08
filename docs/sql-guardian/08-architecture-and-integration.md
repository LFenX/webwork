# 08 - 架构与集成方案

## 1. 总体架构

SQL Guardian 分为五层：

```txt
UI Layer
  GuardianHost / GuardianHome / GuardianSprite / GuardianBubble / GuardianChatPanel

State Layer
  useGuardian / GuardianProvider / state-machine / position engine

API Layer
  /api/guardian/profile
  /api/guardian/chat
  /api/guardian/events
  /api/guardian/memories
  /api/guardian/reset

Service Layer
  profile-service
  event-service
  memory-service
  dialogue-service
  persona-service
  sql-assistant-context
  soulwing-shared-context

Data Layer
  GuardianProfile
  GuardianMemory
  GuardianDialogue
  GuardianEvent
  GuardianPersonaSnapshot
  GuardianAssetUnlock
```

## 2. 前端架构

### 2.1 GuardianProvider

负责全局状态：

```ts
type GuardianContextValue = {
  profile: GuardianProfile | null
  state: GuardianState
  mood: GuardianMood
  position: GuardianPosition
  bubble: GuardianBubbleMessage | null
  isChatOpen: boolean
  sendEvent: (event: GuardianUiEvent, payload?: unknown) => void
  openChat: () => void
  closeChat: () => void
  hideGuardian: () => void
  updateSettings: (settings: Partial<GuardianSettings>) => Promise<void>
}
```

### 2.2 GuardianHost

初始化逻辑：

1. 检查用户是否登录。
2. 检查 reduced motion。
3. 请求 `/api/guardian/profile`。
4. 根据当前页面路径选择初始状态。
5. 注册事件监听。
6. 渲染角色和气泡。

### 2.3 页面上下文识别

```ts
type GuardianPageContext = {
  path: string
  module:
    | 'home'
    | 'sql_lab'
    | 'blog'
    | 'resume'
    | 'job'
    | 'chat'
    | 'community'
    | 'admin'
    | 'settings'
    | 'unknown'
}
```

不同模块影响：

| module | 行为 |
|---|---|
| home | 普通陪伴，低频自言自语 |
| sql_lab | 专业模式，响应 SQL 事件 |
| blog | 写作陪伴，降低干扰 |
| resume | 鼓励与复盘 |
| job | 轻量提醒，避免压力 |
| chat | 安静模式 |
| community | 巡逻、发现资源 |
| admin | 默认收起或低活跃 |
| settings | 可引导用户设置 Guardian |

## 3. 后端服务拆分

### 3.1 profile-service

职责：

- getOrCreateGuardianProfile(userId)
- updateGuardianSettings(userId, patch)
- applyExpAndLevel(userId, expDelta, reason)
- resetGuardian(userId, mode)

### 3.2 event-service

职责：

- createGuardianEvent(userId, eventType, payload)
- dedupe events
- calculate expDelta
- update mood
- trigger level up

### 3.3 memory-service

职责：

- listGuardianMemories(userId)
- createGuardianMemory(userId, input)
- softDeleteGuardianMemory(userId, id)
- extractMemoryCandidates(dialogue)
- classify sensitivity

### 3.4 dialogue-service

职责：

- save user message
- save guardian reply
- list recent dialogue
- summarize dialogue if needed

### 3.5 persona-service

职责：

- buildGuardianSystemPrompt(userId, pageContext)
- updatePersonalityFromEvent(userId, event)
- generateSelfTalk(userId, pageContext)
- chooseBubbleMessage(userId, event)

### 3.6 sql-assistant-context

职责：

- buildSqlAssistantPersonaContext(userId)
- provide compact prompt for SQL Assistant
- never bypass SQL safety

### 3.7 soulwing-shared-context

职责：

- read authorized SoulWing memory summary
- convert to compact context
- exclude sensitive or unauthorized content

## 4. AI Prompt Stack

### 4.1 Guardian Chat Prompt

层级：

```txt
System: 平台安全、隐私、边界
Developer: Guardian 人格、世界观、当前等级、口吻
Context: 用户低风险记忆、蝶灵共享摘要、页面上下文
User: 用户当前消息
```

### 4.2 SQL Assistant Prompt

层级：

```txt
System: SQL Lab 安全规则、权限、审计、禁止越权
Developer: SQL Assistant 任务定义
Context: 数据表 schema、用户授权范围、Guardian persona context
User: 用户 SQL 请求
```

注意：Guardian persona context 只能影响表达风格，不能覆盖安全规则。

## 5. SQL Lab 集成流程

### 5.1 用户打开 SQL Lab

```txt
User opens SQL Lab
  -> frontend emits OPEN_SQL_LAB
  -> POST /api/guardian/events
  -> event-service adds exp maybe once per day
  -> response returns bubble suggestion
  -> Guardian enters focused or idle state
```

### 5.2 用户运行查询

```txt
User clicks Run
  -> SQL Lab existing query flow runs
  -> Guardian UI enters thinking
  -> after query result:
      success -> POST QUERY_SUCCESS -> happy bubble
      error   -> POST QUERY_ERROR -> confused bubble
```

不要在 Guardian API 里执行 SQL。

### 5.3 SQL Assistant 生成回答

```txt
SQL Assistant API
  -> existing auth and SQL permission context
  -> buildSqlAssistantPersonaContext(userId)
  -> existing AI provider
  -> response saved as existing assistant history
  -> optional GuardianEvent USE_SQL_ASSISTANT
```

## 6. 蝶灵共享流程

```txt
Guardian Chat API
  -> get current GuardianProfile
  -> get GuardianMemory
  -> getSoulWingSharedContextForGuardian(userId)
  -> build prompt
  -> call existing AI provider
  -> save dialogue
  -> extract memory candidates
  -> create event
```

共享上下文必须是摘要，不是完整私密记录。

## 7. 活动接入策略

第一版不需要在所有模块深度改造。可以先接：

- SQL Lab 事件。
- Guardian 对话事件。
- 页面访问事件。

后续再扩展：

- 写文章成功。
- 更新简历成功。
- 新增求职记录。
- 使用 SoulWing。
- 添加社区资源。

建议对站内活动提供统一函数：

```ts
trackGuardianActivity(userId, eventType, payload)
```

如果现有活动日志系统可复用，优先复用。

## 8. 状态同步策略

### 8.1 服务器状态

持久化：

- profile
- exp
- level
- personality
- memory
- dialogue
- events

### 8.2 客户端状态

短期：

- sprite state
- position
- bubble visible
- chat panel open
- animation preference cache

### 8.3 localStorage 可存

- 最近位置。
- 用户本地隐藏状态。
- 面板展开状态。

不要只靠 localStorage 存等级、记忆、人格。

## 9. 权限与审计

### 9.1 权限

- 所有 Guardian API 登录后可用。
- 管理员不默认查看用户 Guardian 记忆。
- 后台如果增加审计，只显示统计和安全日志，不显示私密对话，除非产品明确设计并提示。

### 9.2 审计

建议审计：

- Guardian AI 调用。
- 敏感记忆拒绝。
- 记忆删除。
- 完全重置。
- SQL Assistant persona context 使用。

## 10. 失败降级

| 失败 | 降级 |
|---|---|
| profile API 失败 | 显示无状态静态小屋或隐藏 |
| AI 不可用 | Guardian 用本地短句回应 |
| memory API 失败 | 对话仍可进行，但不保存记忆 |
| event API 失败 | 不影响页面主流程 |
| 动画资产加载失败 | 使用 fallback SVG |
| SQL Assistant context 失败 | 使用原 SQL Assistant prompt |

## 11. 文件建议

```txt
components/sql-guardian/
  GuardianProvider.tsx
  GuardianHost.tsx
  GuardianHome.tsx
  GuardianSprite.tsx
  GuardianBubble.tsx
  GuardianChatPanel.tsx
  GuardianSettingsMenu.tsx
  GuardianLevelUpToast.tsx

lib/sql-guardian/
  constants.ts
  types.ts
  state-machine.ts
  position.ts
  persona.ts
  prompts.ts
  memory-policy.ts
  profile-service.ts
  event-service.ts
  memory-service.ts
  dialogue-service.ts
  sql-assistant-context.ts
  soulwing-shared-context.ts

app/api/guardian/
  profile/route.ts
  chat/route.ts
  events/route.ts
  memories/route.ts
  reset/route.ts
  status/route.ts
```

## 12. 逐步接入路线

1. 纯前端占位组件。
2. 全站挂载。
3. SQL Lab 角色之家。
4. 状态机和基础动画。
5. Profile API。
6. Event API。
7. Chat API。
8. Memory API。
9. SQL Assistant persona context。
10. SoulWing shared context。
11. 设置与记忆管理。
12. 美术资产替换。

## 13. 技术风险

| 风险 | 处理 |
|---|---|
| Hydration 错误 | GuardianHost 做 Client Component，浏览器 API 放 useEffect |
| 动画影响性能 | transform/opacity，暂停不可见页面动画 |
| SQL Assistant prompt 变复杂 | persona context 保持短小 |
| 记忆泄露 | 分类、过滤、用户控制 |
| Codex 大改跑偏 | 每轮任务卡限制范围 |
| 移动端遮挡 | 默认收起 |
| 角色过度打扰 | 自言自语限频，可关闭 |

## 14. 最小实现优先级

Codex 实施时，优先级如下：

1. 不破坏现有功能。
2. 全站能稳定显示和隐藏。
3. SQL Lab 能看到角色之家。
4. 聊天能工作。
5. 数据隔离正确。
6. SQL Assistant 风格融合。
7. 动画和剧情打磨。
