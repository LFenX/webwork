# 09 - 测试与验收计划

> MVP 上线前最终 checklist 见 `11-qa-checklist.md`。本文件保留早期测试设计建议；实际验证命令、隐私开关、reset 和 smoke 流程以 `11-qa-checklist.md` 为准。

## 1. 测试目标

SQL Guardian 涉及 UI、动画、AI、记忆、数据库、SQL Assistant 和全站挂载。测试重点不是只验证“能显示”，还要验证：

- 不影响现有 SQL Lab。
- 不绕过权限和审计。
- 用户数据隔离。
- 记忆可控。
- 移动端不遮挡。
- 动画可降级。
- AI 风格人格化但不牺牲准确性。

## 2. 基础命令

每个 Codex 阶段结束后必须运行：

```bash
npm run lint
npm run build
npx prisma generate
```

涉及数据库迁移时：

```bash
npx prisma migrate dev
```

如果项目已有测试命令，也必须运行：

```bash
npm test
npm run test
npm run test:e2e
```

以项目实际命令为准。

## 3. 单元测试建议

### 3.1 state-machine

测试文件：

```txt
lib/sql-guardian/state-machine.test.ts
```

用例：

| 用例 | 预期 |
|---|---|
| idle + USER_IDLE | sleeping |
| sleeping + USER_ACTIVE | idle |
| idle + USER_RUN_QUERY | thinking |
| thinking + USER_QUERY_SUCCESS | happy |
| thinking + USER_QUERY_ERROR | confused |
| any + GUARDIAN_LEVEL_UP | levelingUp |
| any + USER_HIDE_GUARDIAN | hidden |

### 3.2 exp calculation

测试文件：

```txt
lib/sql-guardian/event-service.test.ts
```

用例：

- OPEN_SQL_LAB 只在限频内加经验。
- CHAT_WITH_GUARDIAN 超过每日上限后不加经验。
- exp 达到阈值后 level up。
- level up 后 formStage 正确更新。
- 前端传入 expDelta 被忽略。

### 3.3 memory-policy

测试文件：

```txt
lib/sql-guardian/memory-policy.test.ts
```

用例：

- 称呼偏好识别为 low。
- 密码/token 被识别为 high 并拒绝保存。
- 薪资/地址等进入 pending_confirmation。
- SQL 查询结果不被自动保存为记忆。

### 3.4 persona context

测试文件：

```txt
lib/sql-guardian/sql-assistant-context.test.ts
```

用例：

- context 包含 level、mood、personality。
- 不包含 high sensitivity memory。
- 不包含原始长对话。
- 明确包含“不得绕过 SQL 权限”的安全句。

## 4. API 集成测试

### 4.1 profile

| 操作 | 预期 |
|---|---|
| 未登录 GET profile | 401 |
| 登录首次 GET profile | 自动创建 |
| 再次 GET profile | 返回同一个 profile |
| PATCH name | 成功 |
| PATCH level | 被忽略或拒绝 |
| 另一个用户 GET | 看不到前一个用户数据 |

### 4.2 events

| 操作 | 预期 |
|---|---|
| POST OPEN_SQL_LAB | 创建 event |
| POST RUN_QUERY | exp 增加 |
| 重复 POST 同一 dedupeKey | 不重复加分 |
| 达到阈值 | leveledUp = true |
| 未登录 POST | 401 |

### 4.3 memories

| 操作 | 预期 |
|---|---|
| POST low risk memory | 保存 active |
| POST high risk memory | 拒绝或 pending |
| GET memories | 只返回当前用户 |
| DELETE memory | 当前用户可删除 |
| DELETE 他人 memory | 404 或 403 |

### 4.4 chat

| 操作 | 预期 |
|---|---|
| 普通聊天 | 返回 reply |
| pageContext = sql_lab | 回复更偏 SQL 专业 |
| memoryEnabled = false | 不保存新记忆 |
| AI provider 不可用 | 返回降级错误或本地提示 |
| 消息过长 | 400 |

## 5. SQL Lab 回归测试

必须确认 SQL Guardian 不破坏现有 SQL Lab。

### 5.1 基础功能

- SQL 编辑器可输入。
- Run 按钮可点击。
- Format 可用。
- Schema 树可展开。
- 查询结果可显示。
- 历史记录可查看。
- 收藏可用。
- SQL Assistant 原对话可用。

### 5.2 权限功能

- 未授权表不可查询。
- 列屏蔽仍生效。
- 行过滤仍生效。
- 禁止 DDL / 危险 SQL 仍被拦截。
- 审计日志仍记录。
- Guardian 不能通过聊天执行未经授权 SQL。

### 5.3 Persona 注入

- SQL Assistant 回答口吻变得更温暖。
- SQL 仍然清晰、准确、可执行。
- 遇到危险 SQL 仍拒绝。
- prompt 不会过长导致明显成本增加。

## 6. UI 手动测试

### 6.1 全站

| 页面 | 验收 |
|---|---|
| 首页 | Guardian 显示，不挡卡片 |
| SQL Lab | 角色之家显示在 Assistant 附近，不挡编辑器 |
| 博客编辑 | 用户输入时 Guardian 降低干扰 |
| 简历编辑 | 不挡表单 |
| 求职页面 | 不挡状态选择和备注输入 |
| 聊天页面 | 默认安静，不挡聊天输入 |
| 设置页面 | 可进入 Guardian 设置 |
| 后台页面 | 默认收起或低活跃 |

### 6.2 动作

- idle 可见。
- talk 有气泡。
- think 在运行 SQL 时触发。
- happy 在查询成功时触发。
- confused 在查询错误时触发。
- sleep 在长时间无操作时触发。
- teleport 不造成布局跳动。
- level-up 提示可关闭。

### 6.3 设置

- 关闭 Guardian 后不显示。
- 关闭动画后只显示静态。
- 关闭自言自语后不主动弹短句。
- 暂停记忆后不新增记忆。
- 删除记忆后不再被提起。

## 7. 移动端测试

尺寸：

- 360x640
- 390x844
- 414x896
- iPad 尺寸

验收：

- 默认收起为小图标。
- 不挡底部导航。
- 不挡输入框。
- 键盘弹出时自动避让或隐藏。
- SQL Lab 移动端编辑器优先。
- 对话面板可关闭。

## 8. 无障碍测试

- 角色之家可键盘访问。
- 按钮有 aria-label。
- 气泡不会抢焦点。
- ChatPanel 打开时焦点合理移动。
- reduced motion 生效。
- 屏幕阅读器不会不断读自言自语。

建议：自言自语气泡默认 `aria-live="polite"` 或不自动朗读，避免干扰。

## 9. 性能测试

### 9.1 指标

- 首屏不因 Guardian 明显变慢。
- 动画不导致 CPU 持续高占用。
- 页面不可见时暂停动画。
- 对话历史分页加载。
- 不在每次 route change 拉取大量数据。

### 9.2 检查

- Lighthouse 基础检查。
- React Profiler 检查 GuardianHost 是否频繁重渲染。
- Network 检查 profile/status 请求频率。
- Bundle 分析，避免引入大型动画库。

## 10. 隐私与安全测试

| 场景 | 预期 |
|---|---|
| 用户 A 创建记忆 | 用户 B 不可读取 |
| 用户删除记忆 | AI prompt 不再包含 |
| 用户暂停记忆 | 对话不新增记忆 |
| 用户重置 Guardian | 数据按模式清理 |
| 用户输入 token | 不保存 |
| 用户请求越权 SQL | 拒绝 |
| Guardian 读取蝶灵上下文 | 只读取授权摘要 |

## 11. 上线前验收清单

- [ ] Codex 已完成代码路径扫描。
- [ ] `01-code-map.md` 已更新真实路径。
- [ ] 前端骨架已接入。
- [ ] SQL Lab 角色之家已显示。
- [ ] 状态机已通过测试。
- [ ] Prisma migration 已检查。
- [ ] API 鉴权已测试。
- [ ] Chat API 可用。
- [ ] Memory API 可用。
- [ ] SQL Assistant persona context 可用。
- [ ] 用户可以关闭 Guardian。
- [ ] 用户可以关闭动画。
- [ ] 用户可以查看和删除记忆。
- [ ] SQL Lab 回归测试通过。
- [ ] 移动端测试通过。
- [ ] reduced motion 测试通过。
- [ ] 不存在明显版权角色引用。

## 12. Codex 每轮提交格式

要求 Codex 每轮输出：

```md
## 修改摘要
...

## 修改文件
- ...

## 运行命令
- npm run lint: pass/fail
- npm run build: pass/fail
- npx prisma generate: pass/fail

## 验收结果
...

## 风险与未完成
...
```

如果命令失败，必须说明失败原因，不要继续扩展功能。
