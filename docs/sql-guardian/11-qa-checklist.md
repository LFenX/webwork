# 11 - SQL Guardian 上线前 QA Checklist

本清单用于 SQL Guardian MVP 上线前的安全、隐私、性能和可用性验收。它以当前已实现的 `/api/sql-guardian/*` 路由和前端组件为准。

## 1. Scope

SQL Guardian MVP 包含：

- GuardianProfile
- GuardianEvent
- GuardianDialogue
- GuardianMemory
- GuardianMemoryBridge
- 全站 Guardian 浮层
- SQL Lab dock / compact 停靠
- 轻量聊天
- 短对话历史
- 可控长期记忆
- SoulWing 授权共享摘要桥
- SQL Assistant style-only persona
- 等级形态和视觉表现系统
- 用户设置与 reset

## 2. Auth and user isolation checklist

- [ ] 所有 SQL Guardian API 未登录返回 401。
- [ ] 所有 API 使用当前 session `userId`。
- [ ] API 不接受客户端传入的 `userId`。
- [ ] 用户不能读取其他用户的 GuardianProfile / GuardianEvent / GuardianDialogue / GuardianMemory / GuardianMemoryBridge。
- [ ] 用户不能修改或删除其他用户的 Guardian 数据。
- [ ] reset 只作用于当前用户自己的 Guardian 数据。

## 3. Settings and privacy checklist

- [ ] `PATCH /api/sql-guardian/settings` 只接受白名单 boolean key。
- [ ] settings 更新会 merge `preferencesJson`，不覆盖未知 key。
- [ ] `guardianEnabled=false` 后 chat / events 返回 disabled。
- [ ] `guardianEnabled=false` 后仍可使用 settings / reset / profile 恢复或清理数据。
- [ ] `guardianEventTrackingEnabled=false` 后前端不 POST growth event，后端也不记录 event。
- [ ] `guardianChatHistoryEnabled=false` 后 Guardian Chat 不读取或写入 GuardianDialogue。
- [ ] `guardianMemoryEnabled=false` 后 Guardian Chat 不读取或写入 GuardianMemory，手动 create memory 返回 disabled。
- [ ] `sqlAssistantPersonaEnabled=false` 后 SQL Assistant 不注入 Guardian style。
- [ ] `soulwingToGuardianMemoryBridgeEnabled=false` 后 Guardian Chat 不读取 bridge summary。

## 4. Reset safety checklist

- [ ] reset `dialogues` 只物理删除当前用户 GuardianDialogue。
- [ ] reset `events` 只物理删除当前用户 GuardianEvent，并同步重置 profile 成长：EXP、level、title、formStage、mood。
- [ ] reset `memories` 只物理删除当前用户 GuardianMemory。
- [ ] reset `bridge` 只撤销当前用户 active GuardianMemoryBridge，保留 bridge record 和 audit。
- [ ] reset `profile` 保留 `preferencesJson`，不重新打开用户关闭的隐私开关。
- [ ] reset `all` 不删除 SoulWing memory、SQL Lab 数据、SQL Assistant conversations、文章、简历、聊天、频道等非 Guardian 数据。
- [ ] 所有 reset 都必须提交精确确认文本：`RESET SQL GUARDIAN`。

## 5. AI and memory boundary checklist

- [ ] Guardian Chat 使用现有 AI provider。
- [ ] Guardian Chat 不使用 `runAIRuntime`。
- [ ] Guardian Chat 不传 tools，不启用 AI 工具调用。
- [ ] Guardian Chat 不读取 SoulWing memory，除非 bridge summary 已授权且开关开启。
- [ ] Guardian Chat 不读取用户全站数据。
- [ ] GuardianMemory 不写入 SoulWing memory。
- [ ] SoulWing memory 不复制进 GuardianMemory。
- [ ] Bridge 只读取 `sharedSummary`。
- [ ] Bridge 默认关闭。
- [ ] Bridge revoke 后不再被 Guardian Chat 读取。
- [ ] metadata / audit 不写完整 prompt、message、reply 或 raw memory。

## 6. SQL Assistant and SQL Lab boundary checklist

- [ ] SQL Assistant 只读取 GuardianProfile style-only persona。
- [ ] SQL Assistant 不读取 GuardianDialogue。
- [ ] SQL Assistant 不读取 GuardianMemory。
- [ ] SQL Assistant 不读取 bridge summary。
- [ ] SQL Assistant 不读取 SoulWing memory。
- [ ] SQL 代码块不包含角色台词。
- [ ] SQL safety / permission / audit / row filters / column masking 不受影响。
- [ ] SQL run route 未被 SQL Guardian 修改。
- [ ] SQL grant / audit 相关逻辑未被 SQL Guardian 修改。

## 7. Frontend UX checklist

- [ ] SQL Lab 中 Guardian 不遮挡 SQL 编辑器。
- [ ] SQL Lab 中 Guardian 不遮挡 Run / Format / Save。
- [ ] SQL Lab 中 Guardian 不遮挡结果表格。
- [ ] SQL Lab 中 Guardian 不遮挡 SQL Assistant 输入框。
- [ ] Guardian disabled 后有恢复入口。
- [ ] compact / mobile 下 Guardian 可用。
- [ ] `prefers-reduced-motion: reduce` 下复杂动画关闭。
- [ ] Settings / memory / bridge / chat 面板不会撑爆 Bubble。
- [ ] Guardian z-index 不高过 Dialog / Modal / Toast。
- [ ] 外层 `pointer-events` 不影响页面滚动、输入和按钮点击。
- [ ] 不出现 hydration warning。

## 8. Performance checklist

- [ ] 没有高频 `requestAnimationFrame`。
- [ ] 没有高频 setState 循环。
- [ ] 不上报 mousemove / scroll 事件。
- [ ] 自动巡航可通过 `autoPatrolEnabled=false` 关闭。
- [ ] profile / settings / memory / bridge 请求不会无限循环。
- [ ] Chat / events / bridge 有 cooldown 或 limit。
- [ ] 没有新增大型依赖。

## 9. Validation commands

上线前运行：

```bash
npx eslint components/sql-guardian lib/sql-guardian app/api/sql-guardian app/layout.tsx components/sql-lab/sql-assistant-panel.tsx lib/sql-lab/assistant.ts
npx tsc --noEmit --pretty false
npm run build
npx prisma validate
npx prisma migrate status
git diff --check
```

当前项目 `package.json` 没有 `npm test` 脚本；不要伪造测试结果。如后续新增测试脚本，再把它加入本清单。

## 10. Manual smoke checklist

- [ ] 未登录所有 Guardian API 返回 401。
- [ ] 登录后 profile / settings 正常。
- [ ] Guardian 显示、隐藏、恢复正常。
- [ ] 点击角色、小屋、Bubble 正常。
- [ ] Chat 正常。
- [ ] Chat history disabled 后不保存对话。
- [ ] Memory disabled 后不读写 memory。
- [ ] Bridge disabled 后不读取 shared summary。
- [ ] Settings PATCH merge 正常。
- [ ] 每个 reset scope 行为正常。
- [ ] SQL Assistant persona enabled / disabled 正常。
- [ ] SQL Lab run / permission / audit 正常。
- [ ] SQL Lab UI 不遮挡。
- [ ] Mobile / compact 可用。
- [ ] reduced-motion 可用。
- [ ] build 通过。
