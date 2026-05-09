# 07 - API 契约

> 本文件定义 SQL Guardian 第一版 API。Codex 实施时必须对照项目现有 Route Handler、认证、错误返回、审计和 AI 调用风格进行适配。

## 1. API 总原则

- 所有个人数据 API 必须登录。
- 后端从 session 获取 userId，不信任前端传入 userId。
- 所有查询必须限制在当前用户。
- AI 调用必须复用现有 provider、权限和审计。
- SQL Assistant 集成不得绕过 SQL Lab 权限。
- API 返回应尽量小，不返回完整历史。

## 2. 通用响应格式

如果项目已有统一响应格式，请优先使用现有格式。

建议：

```ts
type ApiSuccess<T> = {
  ok: true
  data: T
}

type ApiError = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

## 3. GET /api/guardian/profile

获取当前用户的 GuardianProfile。若不存在，自动创建。

### Request

无 body。

### Response

```ts
type GuardianProfileResponse = {
  id: string
  name: string
  avatarSeed: string
  level: number
  exp: number
  formStage: string
  mood: GuardianMood
  intimacy: number
  personality: GuardianPersonality
  settings: {
    isEnabled: boolean
    animationEnabled: boolean
    selfTalkEnabled: boolean
    memoryEnabled: boolean
  }
  homeSkin: string
  lastSeenAt?: string
  lastTalkedAt?: string
  lastLevelUpAt?: string
  createdAt: string
  updatedAt: string
}
```

### Side Effects

- 首次访问创建 profile。
- 更新 lastSeenAt 可选。

## 4. PATCH /api/guardian/profile

更新用户可修改的 profile 字段。

### Request

```ts
type UpdateGuardianProfileRequest = {
  name?: string
  settings?: {
    isEnabled?: boolean
    animationEnabled?: boolean
    selfTalkEnabled?: boolean
    memoryEnabled?: boolean
  }
}
```

### 不允许前端直接更新

- level
- exp
- personalityJson
- avatarSeed
- userId

这些只能由后端事件系统更新。

## 5. POST /api/guardian/events

记录 Guardian 事件，用于成长和状态变化。

### Request

```ts
type CreateGuardianEventRequest = {
  eventType:
    | 'OPEN_SQL_LAB'
    | 'RUN_QUERY'
    | 'QUERY_SUCCESS'
    | 'QUERY_ERROR'
    | 'FIX_QUERY_ERROR'
    | 'USE_SQL_ASSISTANT'
    | 'CHAT_WITH_GUARDIAN'
    | 'WRITE_CONTENT'
    | 'UPDATE_RESUME'
    | 'UPDATE_JOB_APPLICATION'
    | 'DAILY_ACTIVE'
    | 'PAGE_VISIT'
  pagePath?: string
  payload?: Record<string, unknown>
}
```

### Response

```ts
type GuardianEventResponse = {
  eventId: string
  expDelta: number
  levelBefore: number
  levelAfter: number
  leveledUp: boolean
  mood: GuardianMood
  bubble?: {
    text: string
    durationMs: number
  }
}
```

### 注意

- 后端计算 expDelta，不能信任前端传入。
- 应做事件去重和限频。
- SQL hash 可放在 payload，但不能保存敏感查询结果。

## 6. GET /api/guardian/memories

获取当前用户 Guardian 记忆列表。

### Query

```txt
?status=active&type=preference&limit=20&cursor=...
```

### Response

```ts
type GuardianMemoryListResponse = {
  items: Array<{
    id: string
    type: string
    summary?: string
    content: string
    importance: number
    sensitivity: 'low' | 'medium' | 'high'
    status: 'active' | 'pending_confirmation' | 'rejected' | 'deleted'
    source: string
    createdAt: string
    updatedAt: string
  }>
  nextCursor?: string
}
```

## 7. POST /api/guardian/memories

手动保存一条 Guardian 记忆。

### Request

```ts
type CreateGuardianMemoryRequest = {
  type: 'preference' | 'relationship' | 'task' | 'sql_context' | 'story'
  content: string
  importance?: number
}
```

### 行为

- 后端判断敏感度。
- 高敏内容拒绝或 pending。
- 记录 source = manual。

## 8. DELETE /api/guardian/memories/:id

删除当前用户的一条 Guardian 记忆。

### 行为

- 只允许删除自己的记忆。
- 可软删除。
- 返回删除结果。

## 9. POST /api/guardian/chat

与 Guardian 对话。

### Request

```ts
type GuardianChatRequest = {
  message: string
  pagePath?: string
  pageContext?: {
    module?: string
    sqlLab?: {
      activeTabId?: string
      hasQuery?: boolean
      lastQueryStatus?: 'success' | 'error' | 'idle'
    }
  }
}
```

### Response

非流式第一版：

```ts
type GuardianChatResponse = {
  reply: string
  mood: GuardianMood
  profile: {
    level: number
    exp: number
    formStage: string
  }
  memoriesAdded?: Array<{
    id: string
    summary: string
    type: string
  }>
  event?: {
    expDelta: number
    leveledUp: boolean
  }
}
```

后续可升级流式：

```txt
POST /api/guardian/chat/stream
```

### 后端步骤

1. 获取 session userId。
2. 获取或创建 GuardianProfile。
3. 拉取最近对话摘要。
4. 拉取低风险 GuardianMemory。
5. 拉取 SoulWing 共享摘要。
6. 构建 persona prompt。
7. 调用现有 AI provider。
8. 保存 user dialogue。
9. 保存 assistant dialogue。
10. 记忆提取。
11. 写入 CHAT_WITH_GUARDIAN event。
12. 返回回复。

## 10. POST /api/guardian/reset

重置 Guardian。

### Request

```ts
type GuardianResetRequest = {
  mode: 'soft' | 'memory' | 'full'
  confirm?: boolean
}
```

### Response

```ts
type GuardianResetResponse = {
  mode: 'soft' | 'memory' | 'full'
  profile: GuardianProfileResponse
}
```

### 要求

- `memory` 和 `full` 必须二次确认。
- full reset 会删除并重新创建 GuardianProfile。

## 11. GET /api/guardian/status

给 `GuardianHost` 轻量轮询或初始化使用。

### Response

```ts
type GuardianStatusResponse = {
  isEnabled: boolean
  animationEnabled: boolean
  selfTalkEnabled: boolean
  level: number
  exp: number
  mood: GuardianMood
  stateSuggestion: GuardianState
  bubble?: {
    text: string
    durationMs: number
  }
}
```

## 12. SQL Assistant 集成函数

建议使用服务函数，而不是单独暴露公开 API。

```ts
export async function buildSqlAssistantPersonaContext(userId: string): Promise<string> {
  // returns compact prompt context
}
```

返回示例：

```txt
SQL Guardian persona context:
- Name: 澜守
- Level: 3 / Schema 航线绘图师
- Mood: focused
- Personality: rigor high, warmth medium, mischief low
- User preferred name: LFen
- Style: clear, precise, lightly adventurous, no noisy roleplay
- Safety: Never bypass SQL Lab permissions, row filters, column masks, audit rules.
```

## 13. SoulWing 共享上下文函数

```ts
export async function getSoulWingSharedContextForGuardian(userId: string): Promise<{
  preferredName?: string
  goals: string[]
  stylePreferences: string[]
  activeProjects: string[]
  memoryHighlights: string[]
}> {
  // use existing memory/tool service with user-scoped permission
}
```

不要直接让 Guardian 查询 SoulWing 原始记忆表。

## 14. 错误码建议

| code | message |
|---|---|
| `UNAUTHORIZED` | 请先登录 |
| `GUARDIAN_DISABLED` | SQL Guardian 已关闭 |
| `MEMORY_DISABLED` | 记忆功能已暂停 |
| `MEMORY_NOT_FOUND` | 记忆不存在 |
| `RATE_LIMITED` | 操作太频繁，请稍后再试 |
| `AI_UNAVAILABLE` | AI 服务暂时不可用 |
| `INVALID_RESET_CONFIRMATION` | 重置需要二次确认 |
| `SENSITIVE_MEMORY_REJECTED` | 这类内容不适合保存为角色记忆 |

## 15. 安全检查清单

每个 API 必须：

- 校验 session。
- 使用 session userId。
- 校验输入长度。
- 校验枚举值。
- 限制返回字段。
- 记录必要审计。
- 不返回敏感记忆给 AI。
- 不保存密钥、密码、token。

## 16. 输入长度建议

| 字段 | 限制 |
|---|---:|
| chat.message | 4000 字符 |
| memory.content | 2000 字符 |
| profile.name | 20 字符 |
| bubble text | 80 字符 |
| pagePath | 512 字符 |

## 17. 速率限制建议

| API | 限制 |
|---|---|
| chat | 每分钟 10 次，每日可按 AI 配额限制 |
| events | 每分钟 60 次，同类事件去重 |
| memories create | 每分钟 20 次 |
| profile patch | 每分钟 20 次 |
| reset | 每小时 5 次 |
