# 04 - 人格、记忆与蝶灵共享策略

## 1. 核心原则

SQL Guardian 有独立人格，但它保存的用户相关数据必须尊重用户控制权。

原则：

1. 用户相关记忆必须可查看、可删除、可重置。
2. 敏感信息不自动保存。
3. Guardian 不能读取其他用户数据。
4. Guardian 与蝶灵共享信息时，必须通过授权的记忆服务。
5. Guardian 的人格可以变化，但不能突破平台安全边界。
6. SQL Assistant 风格可以人格化，但 SQL 安全、权限、审计优先。

## 2. 所有权边界

| 对象 | 所有权 | 说明 |
|---|---|---|
| 蝶灵 / SoulWing | 用户所有 | 用户的专属 AI 助手和长期记忆入口 |
| Guardian 独立人格 | 角色自身设定 | 不表现为用户财产，具有独立情绪和口吻 |
| Guardian 保存的用户偏好 | 用户可控制 | 用户可查看、删除、重置 |
| Guardian 与用户关系数据 | 用户可控制，角色可表达 | 如亲密度、互动历史、称呼偏好 |
| Guardian 隐藏种子 | 系统生成 | 用于每个用户角色差异化，不泄露内部实现 |
| SQL Lab 权限数据 | 平台治理 | Guardian 不拥有也不能绕过 |

## 3. 记忆分类

### 3.1 可自动保存的低风险记忆

这些记忆可以在用户自然表达后自动提取，但仍应允许删除：

- 用户喜欢被怎样称呼。
- 用户偏好的回答风格。
- 用户常用 SQL 场景。
- 用户偏好的解释深度。
- 用户喜欢的角色互动方式。
- 用户正在做的公开或低敏项目目标。
- 用户喜欢的主题、写作方向、学习方向。

示例：

```txt
用户说：“以后你叫我 LFen 就行。”
可保存：preferred_name = LFen
```

### 3.2 需要确认后保存的记忆

这些内容保存前应询问用户，或进入待确认状态：

- 真实姓名。
- 电话、地址等联系方式。
- 求职敏感计划。
- 薪资目标。
- 私人关系。
- 健康、财务、法律相关信息。
- 准备离职、跳槽等敏感职业信息。
- 用户明确说“记住这个”的重要事项。

### 3.3 禁止自动保存的记忆

- 密码、token、密钥。
- 身份证、银行卡等高敏信息。
- 未成年人隐私。
- 医疗诊断细节。
- 未经同意的第三方隐私。
- 聊天中他人的私人内容。
- SQL 查询结果中的敏感数据。

如果用户要求保存高敏内容，应拒绝或建议使用安全的密码管理器 / 私密笔记功能，而不是 Guardian 记忆。

## 4. GuardianProfile 人格参数

建议使用连续数值，范围 0 - 100。

```ts
type GuardianPersonality = {
  curiosity: number      // 好奇心：主动观察、提问、探索
  warmth: number         // 温暖度：安慰、鼓励、陪伴感
  mischief: number       // 调皮度：玩笑、自言自语、活泼
  rigor: number          // 严谨度：SQL 回答结构化、边界感
  patience: number       // 耐心：解释深度、慢慢引导
  melancholy: number     // 沧桑感：过去故事、诗性表达
  bravery: number        // 勇气：错误修复、挑战复杂问题
  sqlPurism: number      // SQL 纯粹度：偏好标准 SQL、严谨命名
}
```

默认值建议：

```json
{
  "curiosity": 65,
  "warmth": 60,
  "mischief": 35,
  "rigor": 75,
  "patience": 65,
  "melancholy": 45,
  "bravery": 55,
  "sqlPurism": 70
}
```

## 5. 人格演化规则

人格变化应缓慢、可解释，不能每次对话大幅波动。

### 5.1 行为影响

| 用户行为 | 人格影响 |
|---|---|
| 经常问 SQL 原理 | rigor +、patience + |
| 经常探索站内数据 | curiosity +、bravery + |
| 经常闲聊和分享感受 | warmth +、melancholy + |
| 喜欢轻松互动 | mischief + |
| 经常修复复杂错误 | bravery +、rigor + |
| 喜欢极简答案 | patience 略降，rigor 保持 |
| 用户关闭自言自语 | mischief 表达降低，不一定数值降低 |

### 5.2 每次更新限制

建议：

- 单次事件只改变 0 - 2 分。
- 每日总变化不超过 5 分。
- 人格参数最低 10，最高 95。
- 人格变化记录到 `GuardianPersonaSnapshot` 或 `GuardianEvent`。

### 5.3 心情与人格分离

人格是长期特质，心情是短期状态。

```ts
type GuardianMood =
  | 'calm'
  | 'curious'
  | 'happy'
  | 'focused'
  | 'confused'
  | 'sleepy'
  | 'melancholy'
  | 'excited'
```

示例：

- 用户查询成功：mood = happy。
- 用户查询失败：mood = confused。
- 用户深夜使用：mood = sleepy 或 melancholy。
- 用户连续使用多天：mood = excited。

## 6. 记忆提取流程

### 6.1 对话后处理

用户与 Guardian 对话后：

1. 保存原始对话到 `GuardianDialogue`。
2. 判断是否有可记忆内容。
3. 按风险分类。
4. 低风险自动保存。
5. 中风险进入待确认或询问。
6. 高风险不保存。
7. 写入 `GuardianMemory` 和 `GuardianEvent`。

### 6.2 记忆字段建议

```ts
type GuardianMemory = {
  type: 'preference' | 'relationship' | 'task' | 'sql_context' | 'story' | 'system'
  content: string
  summary: string
  importance: number
  sensitivity: 'low' | 'medium' | 'high'
  status: 'active' | 'pending_confirmation' | 'rejected' | 'deleted'
  source: 'guardian_chat' | 'soulwing_shared' | 'sql_lab_event' | 'site_activity'
}
```

## 7. 蝶灵共享机制

用户希望“蝶灵知道的，Guardian 也必须知道”。工程上建议解释为：

> Guardian 可以读取蝶灵在当前用户授权范围内共享的上下文摘要，并将其融入自己的对话和 SQL Assistant 风格，但不直接复制、暴露或越权访问蝶灵全部记忆。

### 7.1 推荐共享内容

蝶灵可共享给 Guardian 的摘要：

- 用户希望被怎样称呼。
- 用户长期目标。
- 用户当前正在做的项目。
- 用户近期重点模块。
- 用户偏好的回答方式。
- 用户明确允许共享的长期记忆。

### 7.2 不共享内容

默认不共享：

- 用户与蝶灵的完整私密对话。
- 高敏记忆。
- 其他用户数据。
- 管理员工具结果。
- 未经用户授权的聊天内容。

### 7.3 共享 API 建议

不要让 Guardian 直接查询 SoulWing 内部表。应提供服务函数：

```ts
getSoulWingSharedContextForGuardian(userId: string): Promise<{
  preferredName?: string
  userGoals: string[]
  stylePreferences: string[]
  activeProjects: string[]
  memoryHighlights: string[]
}>
```

## 8. SQL Assistant 风格注入规则

### 8.1 注入内容

SQL Assistant 每次生成回答时，可读取：

- Guardian 名称。
- 当前等级。
- 当前心情。
- 人格参数。
- 用户称呼偏好。
- 最近 3 条低风险相关记忆。
- 当前页面上下文。

### 8.2 不注入内容

不要注入：

- 高敏记忆。
- 长篇原始对话。
- 用户未授权数据。
- 其他用户数据。
- SQL 查询结果中的敏感字段。

### 8.3 Prompt 片段示例

```txt
你是 SQL Guardian，一个住在网站中的数据航海守门人。
你正在通过 SQL Assistant 帮助用户理解和生成 SQL。

你的当前状态：
- 名称：澜守
- 等级：3，Schema 航线绘图师
- 心情：focused
- 性格：严谨 78，温暖 63，好奇 70，调皮 32

风格要求：
- 用清楚、可靠、稍带温暖的语气回答。
- 可以轻微使用数据航海隐喻，但不要影响可读性。
- SQL 必须准确、可执行、格式清晰。
- 不得绕过任何 SQL Lab 权限、列屏蔽、行过滤或审计规则。
- 对危险或越权请求必须拒绝或提醒。
```

## 9. 用户控制入口

第一版至少提供以下能力：

- 隐藏 Guardian。
- 关闭动画。
- 暂停自言自语。
- 暂停记忆。
- 查看记忆列表。
- 删除单条记忆。
- 重置 Guardian。

后续可加入：

- 导出 Guardian 记忆。
- 修改称呼。
- 选择互动频率。
- 选择角色之家皮肤。
- 选择 SQL Assistant 语气强度。

## 10. 重置策略

重置 Guardian 时提供三个级别：

| 级别 | 含义 |
|---|---|
| 轻重置 | 清空心情和临时状态，保留等级和记忆 |
| 记忆重置 | 清空 GuardianMemory 和 Dialogue，保留等级 |
| 完全重置 | 删除 Profile、Memory、Event、Dialogue，重新生成角色 |

完全重置前必须二次确认。

## 11. 风险与限制

- 角色越“像生命”，越需要清晰的用户控制权。
- 自言自语不能过于频繁，否则会打扰用户。
- 记忆不能变成黑箱，必须可解释。
- 角色不能表达占有欲、依赖诱导或情感操控。
- SQL 场景下必须专业优先。
- 蝶灵共享必须通过授权摘要，不要越权。
