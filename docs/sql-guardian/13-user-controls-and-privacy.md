# 13 - SQL Guardian 用户控制与隐私说明

SQL Guardian 有独立人格，但它保存和使用的用户相关数据必须由用户控制。本文件说明 Guardian 会记住什么、不会自动读取什么，以及用户如何关闭、删除和重置。

## 1. What SQL Guardian can remember

SQL Guardian 的长期记忆保存在 GuardianMemory 中。它用于让 Guardian 在自己的聊天里记住少量用户可控信息，例如：

- 称呼偏好
- SQL 解释偏好
- 学习目标
- 项目上下文
- 用户声明的边界

候选记忆需要用户确认。用户可以查看、拒绝、删除或关闭长期记忆。

## 2. What SQL Guardian does not remember automatically

SQL Guardian 不会自动保存敏感信息。

SQL Guardian 不会自动扫描：

- 文章
- 简历
- 聊天
- 频道
- 求职记录
- SQL 历史
- SQL 查询结果
- 用户全站数据

SQL Guardian 不会读取 SoulWing 的全部 memory。只有用户授权共享给 Guardian 的摘要 `sharedSummary` 才可能被读取。

## 3. Chat history

GuardianDialogue 是 Guardian 自己的短对话历史。

- 用户可以关闭短历史。
- 用户可以清空短历史。
- `guardianChatHistoryEnabled=false` 后，Guardian Chat 不读取也不写入 GuardianDialogue。
- 关闭短历史后，Guardian 仍可聊天，但不会因为聊天保存历史或增加聊天成长经验。

## 4. Long-term memory

GuardianMemory 是用户可控的长期记忆。

- 用户可以查看 active / candidate memory。
- 用户可以确认 candidate。
- 用户可以拒绝 candidate。
- 用户可以删除 active memory。
- `guardianMemoryEnabled=false` 后，Guardian Chat 不读取 GuardianMemory，也不生成 candidate memory。
- 手动创建 memory 时，高敏内容会被拒绝，中敏内容不会直接 active。

高敏内容包括但不限于密码、token、API key、私钥、证件、银行卡、精确住址、健康、财务、法律和未成年人隐私。

## 5. SoulWing shared memory bridge

SoulWing -> Guardian 共享桥默认关闭。

- 只共享用户授权的 `sharedSummary`。
- Guardian 不读取完整 SoulWing memory。
- Guardian 不读取 SoulWing conversations。
- Guardian 不写入 SoulWing memory。
- 撤销 bridge 后，Guardian Chat 不再读取该摘要。
- `soulwingToGuardianMemoryBridgeEnabled=false` 后，Guardian Chat 不读取任何 bridge summary。

Guardian -> SoulWing 目前只保留设置字段，不接入 SoulWing runtime。

## 6. SQL Assistant persona

SQL Assistant persona 是 style-only。

- 它只读取 GuardianProfile 的 name、level、title、mood、formStage 和白名单 personality 字段。
- 它不读取 GuardianMemory。
- 它不读取 GuardianDialogue。
- 它不读取 bridge summary。
- 它不读取 SoulWing memory。
- 它不影响 SQL 安全、权限、审计、行过滤、列屏蔽或 SQL 执行。
- `sqlAssistantPersonaEnabled=false` 后，SQL Assistant 不注入 Guardian style。

## 7. Reset and deletion

所有 reset 都只影响当前用户自己的 SQL Guardian 数据，并且需要输入确认文本：

```txt
RESET SQL GUARDIAN
```

Reset scopes:

| Scope | Effect |
|---|---|
| `dialogues` | 删除当前用户 GuardianDialogue。 |
| `events` | 删除当前用户 GuardianEvent，并重置成长进度。 |
| `memories` | 删除当前用户 GuardianMemory。 |
| `bridge` | 撤销当前用户 active GuardianMemoryBridge，保留 audit。 |
| `profile` | 重置 GuardianProfile 基础字段，保留 settings / preferences。 |
| `all` | 删除 dialogues / events / memories，撤销 active bridge，重置 profile，保留 preferences 和 bridge audit。 |

Reset 不会删除：

- SoulWing memory
- SQL Lab 数据
- SQL Assistant conversations
- 用户文章
- 简历
- 求职记录
- 聊天
- 频道
- 用户账号

## 8. User controls table

| Setting | Effect |
|---|---|
| `guardianEnabled` | 控制 Guardian 是否显示和响应 chat/events；关闭后仍保留恢复/设置入口。 |
| `animationsEnabled` | 控制复杂动画；关闭后等价于更安静的 reduced-motion 行为。 |
| `autoPatrolEnabled` | 控制自动巡航；关闭后 Guardian 停靠，不自动巡逻。 |
| `autoBubbleEnabled` | 控制非主动气泡；用户点击仍可打开。 |
| `autoBubbleInSqlLab` | 控制 SQL Lab 中自动气泡策略，默认关闭。 |
| `guardianEventTrackingEnabled` | 控制成长事件记录；关闭后前后端都不记录 GuardianEvent。 |
| `guardianChatHistoryEnabled` | 控制短对话历史；关闭后不读写 GuardianDialogue。 |
| `guardianMemoryEnabled` | 控制长期记忆；关闭后不读写 GuardianMemory。 |
| `sqlAssistantPersonaEnabled` | 控制 SQL Assistant 是否使用 Guardian style-only persona。 |
| `soulwingToGuardianMemoryBridgeEnabled` | 控制 Guardian Chat 是否读取授权 SoulWing shared summary。 |
| `guardianToSoulWingMemoryBridgeEnabled` | 预留开关；当前版本不接入 SoulWing runtime。 |
