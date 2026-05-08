# 05 - 数据模型草案

> 本文件给出 Prisma 数据模型建议。Codex 在实施前必须先查看现有 `prisma/schema.prisma` 的命名风格、User 主键类型、索引规则和已有 AI/Memory/SQL 模型，再调整字段类型与关系。

## 1. 数据建模目标

SQL Guardian 需要支持：

- 每个用户一个独立 GuardianProfile。
- 每个 Guardian 有等级、经验、形态、心情、人格参数。
- 记录对话。
- 记录记忆。
- 记录成长事件。
- 支持与 SoulWing 共享上下文但不混表。
- 支持用户删除、重置、关闭。
- 支持后续扩展皮肤、资产、剧情碎片。

## 2. 推荐模型概览

| 模型 | 用途 |
|---|---|
| `GuardianProfile` | 每用户 Guardian 主档案 |
| `GuardianMemory` | Guardian 记住的用户偏好、关系、任务等 |
| `GuardianDialogue` | 用户与 Guardian 的对话记录 |
| `GuardianEvent` | 用户行为和 Guardian 成长事件 |
| `GuardianPersonaSnapshot` | 人格变化快照，可选但推荐 |
| `GuardianAssetUnlock` | 形态、动作、皮肤、台词包解锁记录，可选 |
| `GuardianSettings` | 用户侧显示、动画、记忆开关，可合并到 Profile |

第一版可以将 `GuardianSettings` 合并到 `GuardianProfile`，减少表数量。

## 3. Prisma 草案

> 字段类型中的 `String` / `DateTime` / `Json` 需按现有项目 Prisma 版本和数据库适配调整。

```prisma
model GuardianProfile {
  id              String   @id @default(cuid())
  userId          String   @unique

  name            String   @default("澜守")
  avatarSeed      String
  level           Int      @default(1)
  exp             Int      @default(0)
  formStage       String   @default("lost_data_sailor")
  mood            String   @default("curious")
  intimacy        Int      @default(0)

  personalityJson Json
  traitsJson       Json?
  storyFlagsJson   Json?
  homeSkin         String   @default("query_lighthouse")

  isEnabled       Boolean  @default(true)
  animationEnabled Boolean @default(true)
  selfTalkEnabled Boolean @default(true)
  memoryEnabled   Boolean @default(true)

  lastSeenAt      DateTime?
  lastTalkedAt    DateTime?
  lastLevelUpAt   DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  memories        GuardianMemory[]
  dialogues       GuardianDialogue[]
  events          GuardianEvent[]
  personaSnapshots GuardianPersonaSnapshot[]
  assetUnlocks    GuardianAssetUnlock[]

  @@index([userId])
  @@index([level])
  @@index([updatedAt])
}

model GuardianMemory {
  id              String   @id @default(cuid())
  userId          String
  guardianProfileId String

  type            String
  content         String
  summary         String?
  importance      Int      @default(50)
  sensitivity     String   @default("low")
  status          String   @default("active")
  source          String   @default("guardian_chat")
  visibility      String   @default("user")

  metadataJson    Json?
  lastUsedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardianProfile GuardianProfile @relation(fields: [guardianProfileId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@index([guardianProfileId])
  @@index([status])
  @@index([importance])
  @@index([createdAt])
}

model GuardianDialogue {
  id              String   @id @default(cuid())
  userId          String
  guardianProfileId String

  role            String
  content         String
  mood            String?
  pagePath        String?
  pageContextJson Json?
  model           String?
  provider        String?
  tokenUsageJson  Json?
  metadataJson    Json?

  createdAt       DateTime @default(now())
  deletedAt       DateTime?

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardianProfile GuardianProfile @relation(fields: [guardianProfileId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([guardianProfileId, createdAt])
  @@index([pagePath])
}

model GuardianEvent {
  id              String   @id @default(cuid())
  userId          String
  guardianProfileId String

  eventType       String
  eventPayloadJson Json?
  pagePath        String?
  expDelta        Int      @default(0)
  moodBefore      String?
  moodAfter       String?
  levelBefore     Int?
  levelAfter      Int?

  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardianProfile GuardianProfile @relation(fields: [guardianProfileId], references: [id], onDelete: Cascade)

  @@index([userId, eventType])
  @@index([guardianProfileId, createdAt])
  @@index([createdAt])
}

model GuardianPersonaSnapshot {
  id              String   @id @default(cuid())
  userId          String
  guardianProfileId String

  reason          String
  personalityJson Json
  mood            String?
  level           Int
  exp             Int

  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardianProfile GuardianProfile @relation(fields: [guardianProfileId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([guardianProfileId, createdAt])
}

model GuardianAssetUnlock {
  id              String   @id @default(cuid())
  userId          String
  guardianProfileId String

  assetType       String
  assetKey        String
  unlockedBy      String
  metadataJson    Json?

  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardianProfile GuardianProfile @relation(fields: [guardianProfileId], references: [id], onDelete: Cascade)

  @@unique([guardianProfileId, assetType, assetKey])
  @@index([userId])
}
```

## 4. User 关系注意事项

如果现有 `User` 模型已经有很多关系，Codex 需要补充：

```prisma
model User {
  // existing fields...

  guardianProfile GuardianProfile?
  guardianMemories GuardianMemory[]
  guardianDialogues GuardianDialogue[]
  guardianEvents GuardianEvent[]
  guardianPersonaSnapshots GuardianPersonaSnapshot[]
  guardianAssetUnlocks GuardianAssetUnlock[]
}
```

如果项目中 User id 不是 `String`，需要同步调整。

## 5. 默认 Profile 初始化

用户首次访问时自动创建 GuardianProfile。

```ts
const DEFAULT_PERSONALITY = {
  curiosity: 65,
  warmth: 60,
  mischief: 35,
  rigor: 75,
  patience: 65,
  melancholy: 45,
  bravery: 55,
  sqlPurism: 70,
}
```

`avatarSeed` 建议基于：

- userId
- createdAt
- 随机盐

不要让用户之间角色完全相同。

## 6. 等级与经验

### 6.1 等级阈值

```ts
export const GUARDIAN_LEVELS = [
  { level: 1, minExp: 0, title: '迷失的数据水手', formStage: 'lost_data_sailor' },
  { level: 2, minExp: 50, title: '查询港口见习守卫', formStage: 'query_port_guard' },
  { level: 3, minExp: 150, title: 'Schema 航线绘图师', formStage: 'schema_cartographer' },
  { level: 4, minExp: 350, title: '数据风暴穿越者', formStage: 'data_storm_walker' },
  { level: 5, minExp: 700, title: '星海查询守门人', formStage: 'starsea_query_warden' },
]
```

### 6.2 经验事件

```ts
export const GUARDIAN_EXP_EVENTS = {
  OPEN_SQL_LAB: 1,
  RUN_QUERY: 2,
  QUERY_SUCCESS: 3,
  QUERY_ERROR: 1,
  FIX_QUERY_ERROR: 5,
  USE_SQL_ASSISTANT: 2,
  CHAT_WITH_GUARDIAN: 2,
  WRITE_CONTENT: 3,
  UPDATE_RESUME: 3,
  UPDATE_JOB_APPLICATION: 2,
  DAILY_ACTIVE: 5,
}
```

## 7. 事件去重策略

避免刷经验：

- `OPEN_SQL_LAB` 每日最多一次或每小时一次。
- `CHAT_WITH_GUARDIAN` 每日最多 N 次计经验。
- `RUN_QUERY` 可按分钟限频。
- `QUERY_SUCCESS` 同一 SQL hash 短时间内不重复加分。
- `DAILY_ACTIVE` 每天只加一次。

建议字段：

```ts
eventPayloadJson: {
  dedupeKey: string,
  sqlHash?: string,
  sourceModule?: string
}
```

## 8. 记忆生命周期

| 状态 | 含义 |
|---|---|
| active | 当前有效 |
| pending_confirmation | 等用户确认 |
| rejected | 用户拒绝保存 |
| deleted | 用户删除，软删除 |

建议使用软删除 `deletedAt`，避免误删后不可恢复。用户请求彻底删除时再 hard delete。

## 9. 重置策略

### 9.1 轻重置

更新：

- mood = curious 或 calm
- 清理临时 story flags
- lastSeenAt 更新

不删除：

- exp
- level
- memory
- dialogue

### 9.2 记忆重置

软删除：

- GuardianMemory
- GuardianDialogue

保留：

- GuardianProfile
- level
- exp
- assetUnlock

### 9.3 完全重置

删除：

- GuardianProfile
- GuardianMemory
- GuardianDialogue
- GuardianEvent
- GuardianPersonaSnapshot
- GuardianAssetUnlock

然后重新创建 Profile。

## 10. 迁移实施步骤

1. Codex 扫描现有 Prisma schema。
2. 确认 User id 类型与 relation 命名。
3. 添加模型。
4. 运行：

```bash
npx prisma format
npx prisma generate
npx prisma migrate dev --name add_sql_guardian
```

5. 检查 migration SQL。
6. 增加基础 service。
7. 增加 API 路由。
8. 增加权限测试。

## 11. 查询性能注意

- 常用查询必须按 userId 索引。
- 对话列表按 userId + createdAt 分页。
- 记忆列表按 userId + status 查询。
- 事件可保留大量数据，后续考虑归档。
- 不要在每次页面渲染时拉取全部 dialogue。
- GuardianHost 初始只需要 profile + 最近少量状态。

## 12. 数据安全注意

- API 不信任前端传入的 userId。
- 后端从 session 获取 userId。
- 所有查询都带 userId。
- 不返回其他用户 profile。
- 不将高敏记忆注入 AI prompt。
- 删除用户时级联删除 Guardian 数据。
