# 10 - Codex 分阶段任务卡

> 使用方式：每次只复制一个任务给 Codex。不要一次性复制所有任务。每轮完成后人工检查，再进入下一轮。

## Task 00 - 代码扫描，不修改文件

```md
请先不要修改任何代码。

阅读以下文档：
- docs/sql-guardian/00-brief.md
- docs/sql-guardian/01-code-map.md
- docs/sql-guardian/02-mvp-scope.md
- docs/sql-guardian/08-architecture-and-integration.md

然后扫描当前仓库，找出实现 SQL Guardian 需要改动或新增的真实文件路径。

请输出：
1. 现有 SQL Lab 页面路径
2. 现有 SQL Assistant 组件路径
3. 现有 SQL Assistant API 路径
4. 全站 layout / AppShell 可挂载 GuardianHost 的位置
5. 现有 AI provider / SoulWing 服务入口
6. 现有 memory service 或 AI memory 相关路径
7. 现有 auth/session 获取 userId 的方式
8. Prisma User 模型主键类型与 schema 路径
9. 推荐新增文件清单
10. 风险点
11. 分阶段实现建议

本任务禁止修改文件。
```

验收：

- Codex 没有改文件。
- 输出真实路径。
- 能据此更新 `01-code-map.md`。

---

## Task 01 - 新增前端骨架

```md
实现 SQL Guardian 第一版前端骨架。

阅读：
- docs/sql-guardian/00-brief.md
- docs/sql-guardian/02-mvp-scope.md
- docs/sql-guardian/06-ui-animation-spec.md
- docs/sql-guardian/08-architecture-and-integration.md

目标：
1. 新增 GuardianHost
2. 新增 GuardianProvider
3. 新增 GuardianSprite
4. 新增 GuardianBubble
5. 新增 GuardianHome
6. 在全站 layout 或 AppShell 中挂载 GuardianHost
7. 使用本地 mock profile，不接数据库，不接 AI

限制：
- 不修改 Prisma
- 不新增 API route
- 不修改 SQL 执行逻辑
- 不修改 AI provider
- 不引入大型动画库
- 不影响 SQL Lab 原功能

验收：
- 登录后全站能看到 Guardian 占位角色
- 可以点击角色显示/隐藏气泡
- 可以关闭 Guardian
- npm run lint 通过
- npm run build 通过
```

---

## Task 02 - SQL Lab 角色之家入口

```md
在 SQL Lab 的 SQL Assistant 区域接入 GuardianHome。

目标：
1. 找到 SQL Assistant 面板标题栏或右侧图标区域
2. 加入 GuardianHome 入口
3. 点击入口时打开 Guardian 气泡或聊天面板
4. SQL Lab 页面中 Guardian 默认进入 sql_lab/focused 上下文

限制：
- 不修改 SQL Assistant API
- 不修改 SQL 执行逻辑
- 不接数据库
- 不影响编辑器、Run、Format、结果面板

验收：
- SQL Lab 中可看到角色之家
- 点击角色之家有反馈
- SQL Assistant 原功能可用
- npm run lint 通过
- npm run build 通过
```

---

## Task 03 - 动画状态机与基础动作

```md
实现 Guardian 的轻量状态机和基础动画。

阅读：
- docs/sql-guardian/06-ui-animation-spec.md

目标：
1. 新增 lib/sql-guardian/state-machine.ts
2. 支持状态：home、idle、walking、jumping、teleporting、thinking、talking、happy、confused、sleeping、levelingUp、hidden
3. GuardianSprite 根据状态显示不同 CSS 动画或占位表现
4. 用户 idle 后进入 sleeping
5. 用户点击后进入 talking
6. SQL Lab 事件可让角色进入 thinking/happy/confused，先用前端事件模拟
7. 支持 prefers-reduced-motion 降级

限制：
- 不引入物理引擎
- 不引入大型动画库
- 不接数据库

验收：
- 至少 5 个状态肉眼可区分
- reduced motion 下动画显著减少
- npm run lint 通过
- npm run build 通过
```

---

## Task 04 - Prisma 数据模型与基础服务

```md
新增 SQL Guardian 数据模型与基础 service。

阅读：
- docs/sql-guardian/05-data-model.md
- docs/sql-guardian/07-api-contract.md

目标：
1. 在 prisma/schema.prisma 中新增 GuardianProfile、GuardianMemory、GuardianDialogue、GuardianEvent
2. 可选新增 GuardianPersonaSnapshot、GuardianAssetUnlock
3. 补充 User relation
4. 新增 lib/sql-guardian/profile-service.ts
5. 新增 lib/sql-guardian/event-service.ts
6. 实现 getOrCreateGuardianProfile(userId)
7. 实现基础 exp/level 计算

限制：
- 必须先确认 User id 类型
- 必须使用 onDelete: Cascade 或符合现有项目删除策略
- 不接 AI
- 不接 SQL Assistant

需要运行：
- npx prisma format
- npx prisma generate
- npx prisma migrate dev --name add_sql_guardian
- npm run lint
- npm run build

验收：
- migration 创建成功
- Prisma generate 成功
- getOrCreateGuardianProfile 可用
- 不影响现有模型
```

---

## Task 05 - Profile 与 Event API

```md
实现 Guardian Profile 和 Event API。

阅读：
- docs/sql-guardian/07-api-contract.md
- docs/sql-guardian/05-data-model.md

目标：
1. GET /api/guardian/profile
2. PATCH /api/guardian/profile
3. POST /api/guardian/events
4. 前端 GuardianProvider 从真实 API 获取 profile
5. 事件 API 可更新 exp、level、mood
6. 前端打开 SQL Lab 时发送 OPEN_SQL_LAB

限制：
- 后端从 session 获取 userId
- 不信任前端 userId
- 前端不能直接修改 level/exp/personality
- 不接 AI

验收：
- 不同用户 profile 独立
- 未登录访问返回 401 或现有项目统一错误
- SQL Lab 打开能记录事件
- 升级逻辑可工作
- npm run lint 通过
- npm run build 通过
```

---

## Task 06 - Chat API 与聊天面板

```md
实现 Guardian 聊天能力。

阅读：
- docs/sql-guardian/04-personality-memory-policy.md
- docs/sql-guardian/07-api-contract.md
- docs/sql-guardian/08-architecture-and-integration.md

目标：
1. 新增 GuardianChatPanel
2. 新增 POST /api/guardian/chat
3. 复用现有 AI provider / SoulWing AI 调用方式
4. 构建 Guardian persona prompt
5. 保存 GuardianDialogue
6. 发送 CHAT_WITH_GUARDIAN 事件
7. AI 不可用时有降级提示

限制：
- 不直接新建一套 AI provider
- 不绕过现有 AI 授权和审计
- 不做复杂记忆提取，第一版只保存对话
- 不让 Guardian 执行 SQL

验收：
- 用户可打开面板聊天
- 回复有 Guardian 角色口吻
- 对话保存到数据库
- 未登录不可调用
- npm run lint 通过
- npm run build 通过
```

---

## Task 07 - Memory API 与低风险记忆

```md
实现 Guardian 记忆管理。

阅读：
- docs/sql-guardian/04-personality-memory-policy.md
- docs/sql-guardian/07-api-contract.md

目标：
1. GET /api/guardian/memories
2. POST /api/guardian/memories
3. DELETE /api/guardian/memories/:id 或等价实现
4. 新增 memory-service
5. 支持低风险偏好记忆保存
6. 支持记忆列表与删除 UI
7. memoryEnabled=false 时不保存新记忆

限制：
- 高敏内容不自动保存
- 不保存密码/token/密钥
- 不读取其他用户记忆
- 不把全部记忆注入 AI prompt

验收：
- 用户可查看 Guardian 记住了什么
- 用户可删除记忆
- 删除后不再进入 prompt
- 不同用户记忆隔离
- npm run lint 通过
- npm run build 通过
```

---

## Task 08 - SQL Assistant 人格融合

```md
将 Guardian persona context 接入 SQL Assistant。

阅读：
- docs/sql-guardian/04-personality-memory-policy.md
- docs/sql-guardian/07-api-contract.md
- docs/sql-guardian/08-architecture-and-integration.md

目标：
1. 新增 buildSqlAssistantPersonaContext(userId)
2. 在 SQL Assistant API 中注入紧凑 persona context
3. 让 SQL Assistant 回答风格轻微体现 Guardian 当前等级、心情、人格
4. SQL Assistant 使用后写入 USE_SQL_ASSISTANT 事件

限制：
- 不修改 SQL 执行安全逻辑
- 不降低权限、列屏蔽、行过滤、审计
- persona context 必须短小
- 不注入高敏记忆
- 不让角色扮演影响 SQL 准确性

验收：
- SQL Assistant 回答更有温度
- SQL 仍准确清晰
- 危险 SQL 仍拒绝
- 权限测试通过
- npm run lint 通过
- npm run build 通过
```

---

## Task 09 - 蝶灵共享上下文

```md
实现 Guardian 与 SoulWing / 蝶灵的共享上下文。

阅读：
- docs/sql-guardian/04-personality-memory-policy.md
- docs/sql-guardian/08-architecture-and-integration.md

目标：
1. 找到现有 SoulWing memory service 或工具服务
2. 新增 getSoulWingSharedContextForGuardian(userId)
3. 只返回授权摘要：称呼、目标、偏好、活跃项目、低风险记忆亮点
4. Guardian Chat prompt 使用该摘要
5. SQL Assistant persona context 可使用部分摘要

限制：
- 不直接暴露 SoulWing 原始私密对话
- 不读取其他用户数据
- 不读取 admin-only 工具结果
- 不注入高敏记忆
- 如果现有服务不足，先返回空摘要并标注 TODO

验收：
- Guardian 能提到蝶灵共享的低风险偏好
- 用户关闭记忆或共享后不再读取
- 权限隔离正确
- npm run lint 通过
- npm run build 通过
```

---

## Task 10 - 设置、重置与上线打磨

```md
完善 SQL Guardian 设置、重置、移动端和上线前打磨。

阅读：
- docs/sql-guardian/06-ui-animation-spec.md
- docs/sql-guardian/09-test-plan.md

目标：
1. 用户可关闭 Guardian
2. 用户可关闭动画
3. 用户可关闭自言自语
4. 用户可暂停记忆
5. 用户可软重置、记忆重置、完全重置
6. 移动端默认收起
7. reduced motion 完整生效
8. 补充关键测试
9. 完成上线前验收清单

限制：
- full reset 必须二次确认
- 不删除非 Guardian 数据
- 不影响 SQL Lab 原功能

验收：
- 设置全部可用
- 重置模式符合文档
- 移动端不遮挡主要操作
- SQL Lab 回归测试通过
- npm run lint 通过
- npm run build 通过
```

---

## 每轮 Codex 输出格式

每次任务完成后，要求 Codex 输出：

```md
## 完成内容

## 修改文件

## 运行命令与结果

## 验收情况

## 风险与未完成

## 建议下一步
```

如果构建或 lint 失败，不要进入下一轮任务。
