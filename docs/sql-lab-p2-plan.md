# SQL Lab P2 总方案 v2

> 状态：**待审核**
> 作者：Stage 重构小组
> 创建日期：2026-05-11
> 适用对象：在 P1（Stage 时间线 + 流式 AI Copilot）已上线的基础上，规划下一轮升级
> 关联代码：`app/sql/`、`components/sql-lab/`、`lib/sql-lab/`、`prisma/schema.prisma`

---

## 北极星

**让 Stage 成为一个真正的"AI 数据分析师工位"**：

- 用户用自然语言问问题
- AI 在透明、可审计、可叫停的条件下，**自己读取历史结果、自己跑安全探查 SQL、自己生成最终答案与可视化**
- 用户始终看得清每一步用了哪张表、查了什么、为什么这么答

所有改造都围绕这一句话。

---

## 模块全景

| 模块 | 内容 | 性质 |
|---|---|---|
| A | 删除 SQL 助教 | 减法 |
| B | 可视化分析 | 加法 |
| C | AI 推理准确性 | 加法 |
| D | 关系图 v2 | 重做 |
| **E** | **AI 分析师模式（读记忆 + 自主探查 + 安全栏）** | **重大加法（新）** |

模块 E 是这次的灵魂，B/C/D 都为它服务：可视化让 AI 探查结果能直接呈图；准确性让 AI 自主决策少出错；关系图让 AI 和用户共享同一张"地图"。

---

# 模块 A：删除 SQL 助教

## A.1 目标

代码层、UI 层、数据层把"独立助教对话"全部清除；用户唯一的 AI 交互入口 = Stage。

## A.2 删除清单

**前端**

- `components/sql-lab/sql-assistant-panel.tsx`（702 行）
- `app/sql/sql-lab-client.tsx` 中所有 `assistantPrompt` 相关 state、`sendDrawerPrompt` 函数、`sql-stage-floating-followup` 浮动按钮
- `components/sql-lab/sql-console-drawer.tsx` 的 pane 切换 + `assistant` prop（变成纯 SQL 编辑器抽屉，高度可从 320px 调到 380px）
- `components/sql-lab/results-panel.tsx` 的 `messages` tab（reasoning 已在 Stage 卡片里）
- `SqlConsolePane` 类型简化为单一 `"editor"`

**后端**

- `app/api/sql/assistant/route.ts`
- `app/api/sql/assistant/conversations/route.ts` + 子路由
- `lib/sql-lab/assistant.ts`（659 行）
- `lib/sql-lab/assistant-history.ts`（298 行）

**数据库**：迁移 `20260512000000_drop_sql_assistant`

```sql
DROP TABLE IF EXISTS "SqlAssistantMessage" CASCADE;
DROP TABLE IF EXISTS "SqlAssistantConversation" CASCADE;
```

`schema.prisma` 中删 `SqlAssistantConversation` / `SqlAssistantMessage` 及 `User` 上的反向关系。

## A.3 保留的能力

原助教里两个能力会被搬到 Stage 上，不丢：

1. **选中片段后让 AI 解释** → 编辑器按 `⌘E` 触发 `/api/sql/ai/stream` 的 `mode: "explain_selection"`，结果以 `user_note` 步骤插入当前 Stage 线程
2. **AI 重写 SQL** → 编辑器按 `⌘⇧F`，生成 diff 视图直接显示在编辑器右侧（不进 Stage 时间线，避免污染分析记录）

## A.4 边界

旧助教历史会话**不迁移**到 Stage（异构）；上线前给出告知 + 一周内提供一次性"导出助教历史为 markdown"的小工具。

---

# 模块 B：可视化分析

## B.1 目标

任何运行结果（Stage 的 `sql_run` 卡 / 控制台抽屉的 ResultsPanel / 关系图选中表的快速预览）都能**一键变图表**；图表配置可保存为"分析卡片"，AI 也能直接产出图表配置（见模块 E）。

## B.2 用户交互

**触发入口**

- `sql_run` 步骤卡右上：`📊 可视化` 按钮 → 卡片下方展开图表面板
- ResultsPanel 顶部：`视图: [表格 | 图表]` toggle
- AI 在分析师模式下自动生成图表配置（无需用户点）

**图表面板**

```
┌──────────────────────────────────────────────────────┐
│ [折线 ▾]  X: createdAt ▾   Y: count ▾   分组: -    │
│ 调色板 ▾  Top N: 全部 ▾   主题: 跟随          [⋯] │
├──────────────────────────────────────────────────────┤
│                                                      │
│                  ECharts 图表区                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ AI 解读：周末峰值明显 (vs 工作日均值 +47%) [追问]   │
└──────────────────────────────────────────────────────┘
```

- 切换图表类型时智能保留 X/Y 选择
- 点击数据点 → 复制对应原始行 + 弹出"为什么这个点高？"追问按钮（自动入 Stage 命令栏）
- 底部 AI 解读 = 调用 `/api/sql/ai/stream` 的 `mode: "interpret_chart"`

## B.3 自动图表选择

`lib/sql-lab/visualization/auto-chart.ts`：

```ts
type ColumnRole = "time" | "category" | "metric" | "id" | "boolean"
type ChartType = "line" | "bar" | "area" | "pie" | "scatter" | "heatmap" | "funnel" | "kpi" | "table"

function inferColumnRoles(columns, sampleValues): Record<string, ColumnRole>
function chooseChart(roles, rowCount): ChartConfig
```

规则（覆盖 90% 常见场景）：

| 列组合 | 推荐 |
|---|---|
| 1 time + 1 number | 折线 |
| 1 time + 1 number + 1 category(≤8) | 多线折线 / 堆叠面积 |
| 1 category(≤30) + 1 number | 条形 |
| 1 category(≤8) + 1 number 且总和 ≈ 总体 | 饼 |
| 2 numbers | 散点 |
| 1 time + 1 category + 1 number | 热力 |
| 单聚合数值（COUNT/SUM 单值） | KPI 卡 |
| 行数 < 5 且字段多 | 表格 |

## B.4 技术选型

- **ECharts** + 按需引入（gz < 80KB）
- 自写 `<StageChart>`，不走 `echarts-for-react`，避免黑盒
- 浅 / 深两套 ECharts theme JSON（跟随 `layout.theme`）

## B.5 新增文件

```
components/sql-lab/visualization/
├─ chart-panel.tsx
├─ chart-canvas.tsx
├─ chart-toolbar.tsx
└─ chart-export-menu.tsx

lib/sql-lab/visualization/
├─ auto-chart.ts
├─ chart-config.ts
├─ chart-options-builder.ts
├─ aggregate.ts          # 客户端聚合（行数 > 5000 时降采）
└─ formatters.ts
```

## B.6 数据库变更：分析卡片

```prisma
model SqlInsightCard {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  threadId    String?
  thread      SqlThread? @relation(fields: [threadId], references: [id], onDelete: SetNull)
  title       String
  description String   @default("")
  sql         String
  chartConfig Json
  pinned      Boolean  @default(false)
  shared      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, pinned, updatedAt])
}
```

路由：`/api/sql/cards`（POST/GET/PATCH/DELETE）。

## B.7 边界

- 行数 > 5000 → client-side aggregate；> 50,000 → 提示"先 SQL 聚合"
- 时间识别：ISO 8601 / Unix sec/ms / Date / `YYYY-MM-DD`
- 移动端图最小高 240px

---

# 模块 C：AI 推理准确性

## C.1 目标

把 AI 看得到的"数据世界"从一张静态目录扩展到**真实的库结构 + 数据分布 + 历史成功范式**，让"字段不存在"和"enum 值瞎猜"两类故障接近 0。

## C.2 五个改进

### C.2.1 Schema Profile（数据画像）

新增 `SqlSchemaProfile`：

```prisma
model SqlSchemaProfile {
  id          String   @id @default(cuid())
  schemaName  String
  tableName   String
  columnName  String?
  profileJson Json
  generatedAt DateTime @default(now())
  expiresAt   DateTime
  @@unique([schemaName, tableName, columnName])
  @@index([expiresAt])
}
```

`profileJson` 内容：

```json
{
  "rowEstimate": 1280,
  "distinctCount": 4,
  "nullRatio": 0.0,
  "sampleValues": ["applied", "interview", "offer", "rejected"],
  "minValue": "2024-01-12T03:11:00Z",
  "maxValue": "2026-05-09T22:30:00Z",
  "isMonotonic": true,
  "isLikelyEnum": true
}
```

后台采集：

- `lib/sql-lab/profiler.ts`
- `/api/admin/sql/refresh-profile` 手动触发 + 每周 cron
- 双模式：
  - **轻量**：用 `pg_class.reltuples` + 类型推断（< 1s）
  - **完整**：含 sample + distinct + min/max（10-15s 70 张表，后台跑）

### C.2.2 真实 FK 图

`lib/sql-lab/fk-graph.ts`：

```ts
type FkEdge = { from: {schema,table,column}, to: {schema,table,column}, onDelete: string }
export async function readForeignKeyGraph(): Promise<FkEdge[]>
```

查询 `information_schema.referential_constraints` + `key_column_usage` + `constraint_column_usage`，结果缓存 1 小时。

用于：

1. AI 选完主表后自动用 1-hop 邻居扩展候选集（漏关联表问题）
2. 模块 D 关系图直接消费
3. 注入 AI prompt（"primary 表的 FK 邻居有 X/Y/Z"）

### C.2.3 结构化 prompt + few-shot

prompt 从 JSON blob 改为结构化 Markdown：

````
你是 SQL Lab Stage Copilot。把用户中文需求 → 安全可执行的 PostgreSQL 查询。

## 数据源
- PostgreSQL 16，当前用户：{name}（owner / read-only / write）
- 严格遵循行级过滤与列遮罩

## 选定的表（按相关性排序）

### JobApplication (career.job, primary)
**用途**：用户岗位申请，每行 = 一次投递
**行数估算**：1,280
**关键字段**：
- id (text, PK) cuid
- userId (text, FK→User.id) 投递人
- status (text, enum: applied / interview / offer / rejected)
- appliedAt (timestamp) [2024-01-12 ~ 2026-05-09]
**外键关系**：
← InterviewRecord.jobId（一对多）

### InterviewRecord (career.job, joined)
...

## Few-shot 示例（最近成功 SQL，已脱敏）
### 示例 1：求职转化率
**用户**：最近一个月各阶段转化率
**SQL**：
```sql
SELECT status, COUNT(*) AS cnt
FROM "JobApplication"
WHERE "appliedAt" >= NOW() - INTERVAL '30 days'
GROUP BY status;
```

## 输出契约
返回严格 JSON：{ message, sql, title, reasoningMarkdown, confidence, needsClarification, suggestedCharts? }
````

收益巨大：AI 看到 enum 值就不会写错；看到时间范围就知道"最近 30 天"应该用 `appliedAt >= NOW() - INTERVAL '30 days'` 而不是查 2026 年。

### C.2.4 Few-shot bank

`lib/sql-lab/ai/few-shot-bank.ts`：

- 12-15 个人工 anchor 示例（覆盖 SELECT / JOIN / 聚合 / 时间窗 / Private 操作 / 错误修复）
- 候选从 `SqlAuditLog WHERE ok=true AND rowCount>0 AND durationMs<5000` 里挑
- prompt-time 用关键词命中评分，每次注入 top-3

### C.2.5 Self-validation

`lib/sql-lab/ai/self-validation.ts`：

- AI 生成 SQL 后立刻 PREPARE 校验（已有的 `validateSql`）
- 失败 → 把错误 + 相似列名建议反馈给 AI，自动重试 1 次
- 重试失败 → step 标为 `error`，前端显示"AI 自检未通过，建议手改"
- 通过 → `step.payload.selfValidated = true`（卡片上显示 ✓ 标签）

## C.3 重构落点

```
lib/sql-lab/ai/
├─ context-builder.ts          # 总入口：组合 schema + profile + fk + few-shot
├─ schema-renderer.ts           # 把数据渲染成 prompt Markdown
├─ system-prompts.ts            # 各 mode 的 system 模板
├─ few-shot-bank.ts             # anchors + 检索
├─ self-validation.ts           # PREPARE + 重试
└─ token-budget.ts              # prompt 裁剪（不超 12k tokens）
```

替换现有 `app/api/sql/ai/stream/route.ts` 里的 inline prompt 拼装。

---

# 模块 D：关系图 v2

## D.1 现状

当前 73 张表挤在 720px 高浮层里，标签互相覆盖，看不清也用不上。

## D.2 重做核心

1. **独立路由 `/sql/relations`**，占满整个视口，浮层方案彻底废弃
2. **React Flow (`@xyflow/react`) + elkjs** —— 真正的图编辑器引擎
3. **三层视图**：模块全景 → 模块内表 → 单表字段
4. **可缩放 / 拖拽 / 多选 / minimap**
5. **从 AI 候选表可一键跳转聚焦**

## D.3 三层视图

| 层 | 节点 | 边 | 触发 |
|---|---|---|---|
| L1 模块全景 | 10 个模块卡 | 模块间聚合 FK（粗细=数量） | 默认 |
| L2 模块内表 | 单模块下所有表 | 表 FK + catalog lookup | 双击模块 |
| L3 字段视图 | 单表 + FK 邻居（含字段） | 字段级 FK | 双击表 |

## D.4 节点设计（L2）

```
┌─────────────────────────────┐
│ 🔵 JobApplication            │
│ career · 可写 · 1.3k 行     │
│ ──                          │
│ • id (PK)                   │
│ • userId  → User.id          │
│ • status                    │
│ • appliedAt                 │
│   ▼ 展开                    │
└─────────────────────────────┘
```

## D.5 交互

- 滚轮缩放 (0.2× ~ 2.5×)
- 拖拽空白 = 平移；拖拽节点 = 临时摆位
- 单击节点 = 高亮自身 + 1-hop 邻居，其他淡化
- 双击 = 进入下一层
- Shift + 拖拽 = lasso 多选 → 右键 "用这些表分析" → 自动跳 Stage 并把表预钉
- ⌘F = 搜索高亮
- ESC = 返回上一层
- 右下 minimap

## D.6 后端

扩展 `/api/sql/relations` 输出 `SqlRelationGraphV2`，**只输出数据**：

```ts
{
  modules: [...],
  tables: [...],
  fkEdges: [...],
  moduleEdges: [...]
}
```

**布局完全在前端用 elkjs 算**，筛选时实时重排。

## D.7 文件

```
components/sql-lab/relations/
├─ relations-canvas.tsx
├─ module-node.tsx
├─ table-node.tsx
├─ column-table-node.tsx
├─ relation-edge.tsx
├─ relations-side-panel.tsx
├─ relations-filters.tsx
└─ relations-toolbar.tsx

app/sql/relations/page.tsx   # 独立路由
```

## D.8 性能

- L1: 10 节点直接渲染
- L2: 单模块 5-15 节点直接渲染
- L3: 单表 + ~10 邻居
- 完整 70 张表场景启用 reactflow 的 `onlyRenderVisibleElements`

## D.9 视觉

深 / 浅双主题；节点圆角 12px、1px 描边、hover 4px 投影；边按目标模块染色；进入动效 scale + fade 200ms。

---

# 模块 E：AI 分析师模式（核心）

这一节是本次重大新增。把 AI 从"帮你写 SQL 的助手"升级为"帮你完成分析的实习生"。

## E.1 设计哲学

**三条铁律**：

1. **透明**：AI 做的每一件事都在 Stage 时间线显示为一张步骤卡，可点开看完整 SQL、完整结果。
2. **可逆**：任何时候用户可叫停（红色 STOP 按钮在 Stage 顶栏），所有 AI 操作只是 SELECT，不写数据。
3. **配额**：单次分析最多 8 次自主探查，单条线程累计 ≤ 20 次，超额 AI 必须返回最终答案或主动询问用户。

## E.2 三个子能力

### E.2.1 子能力 1：结果记忆（context-aware）

**定义**：AI 在当前线程内生成新答案时，能"看到"前面已经跑过的 `sql_run` 结果。

**实现**：

- `context-builder.ts` 在拼 prompt 时，把当前线程最近 N 个（默认 3）`sql_run` 步骤的精简快照塞进上下文：

  ```
  ## 当前线程已知的事实

  ### 事实 1（来自前面第 3 步）
  问题：最近 30 天投递数量
  SQL：SELECT COUNT(*) FROM "JobApplication" WHERE "appliedAt" >= NOW() - INTERVAL '30 days'
  结果：[{ count: 87 }]

  ### 事实 2（来自前面第 5 步）
  问题：各阶段分布
  SQL：SELECT status, COUNT(*) FROM ... GROUP BY status
  结果：[{ status: "applied", count: 42 }, { status: "interview", count: 28 }, ...]
  ```

- 跨线程：用户**已置顶 (`pinned=true`) 的 `SqlInsightCard`** 也作为长期记忆注入（"你之前置顶过一个分析卡片显示 X = N"）
- 隐私：永远只用当前用户的数据，不跨用户

**触发**：所有 AI 调用都默认带这个上下文，不需要用户开关

### E.2.2 子能力 2：自主探查（agentic probing）

**定义**：AI 在生成最终答案前，可以**自己**发起若干只读 SQL 探查，再综合结果给出答案。

**实现**：tool-calling 循环

```ts
const TOOL_RUN_SAFE_SQL = {
  name: "run_safe_sql",
  description: "Execute a read-only SQL query and read the result. Use to verify hypotheses, check distinct values, sample data, or compute aggregates the user didn't explicitly ask for but that are needed to answer their question well.",
  parameters: {
    type: "object",
    required: ["sql", "purpose"],
    properties: {
      sql: { type: "string", description: "A single SELECT or WITH...SELECT statement. Other commands rejected." },
      purpose: { type: "string", description: "Why this query — 1 sentence in Chinese, shown to user." }
    }
  }
}
```

AI 在 stream 过程中可以多次调用 `run_safe_sql`。后端：

1. 收到 tool call → 验证 SQL 是只读 → 调用 `executeSafeProbe(viewerId, sql, threadId, parentStepId)`
2. `executeSafeProbe` 复用 `executeSql` 但带严格选项：

   ```ts
   await executeSql(viewerId, {
     sql,
     limit: 100,                    // 探查行数硬上限
     forceReadOnly: true,
   }, {
     threadId,
     threadStepId: parentStepId,
     aiInitiated: true,             // 新字段，写入 audit log
     timeoutMs: 5000,               // 探查超时硬上限
   })
   ```

3. 探查作为 `ai_probe_sql` 步骤插入时间线（新 step kind）
4. 把结果（前 20 行 + 列元信息）作为 `tool` role message 反馈给 AI
5. AI 继续生成或再发起下一个 tool call，最多 8 次

**新 step kind**：`ai_probe_sql`

- `payload: { sql, purpose, rowCount, columns, sampleRows, durationMs }`
- 卡片视觉：黄色 mini 卡片（比 sql_draft 小一号），可折叠
- 用户体感：能看到 AI "在想什么"——例如 AI 先查"User 表里 status 字段有哪些值"，再用得到的 enum 写最终 SQL

**配额机制**：

```ts
// lib/sql-lab/ai/probe-budget.ts
type ProbeBudget = {
  maxPerCall: 8,           // 单次 AI 响应内最多 8 次
  maxPerThread: 20,        // 单条线程累计 20 次
  maxRowsPerProbe: 100,
  maxDurationMsPerProbe: 5000,
}
```

超出时 tool call 返回错误信息给 AI，AI 必须返回最终答案。

### E.2.3 子能力 3：安全栏 + 自动运行（合并原 P2.3）

**定义**：AI 生成完最终 SQL 后，**默认自动执行**——除非属于高风险操作。

**安全栏判定**：

| 命令 | 行为 |
|---|---|
| SELECT / WITH ... SELECT | 自动执行（含 self-validation） |
| EXPLAIN | 自动执行 |
| INSERT / UPDATE / DELETE | 暂停，需要用户点"确认执行" |
| CREATE / ALTER / DROP / TRUNCATE | 暂停，需要用户点"确认执行" |
| **作用于 Private schema 之外的所有 DDL** | 强制拒绝，AI 会被告知它无权 |

**用户控制**：Stage 命令栏上方现在有三档：

- **默认 / Safe Auto**：SELECT 自动跑，DML/DDL 暂停确认
- **Analyst（深度分析）**：开启 agentic probing（子能力 2），其他同 Safe Auto
- **Manual Approve**：所有 SQL 都暂停，等用户点运行

撤回：每个 `sql_run` 步骤卡有"撤回到此步前"按钮，逻辑上把后续步骤折叠（不删，只是 UI 折叠），用户可重启分析。

## E.3 紧急停止 / 叫停机制

Stage 顶栏在 AI streaming 期间显示红色 **STOP** 按钮：

- 点击 → 前端 `AbortController.abort()` 切断 SSE
- 后端收到 abort → 把当前 thinking step 标为 `aborted`，停止任何进行中的 tool call
- 已经发出的探查 SQL 若仍在执行：通过 PG 后端的 `pg_cancel_backend()` 取消（需要在 `executeSql` 里记 query pid 并暴露 cancel 接口）
- 用户也可按 `Esc`

## E.4 审计

`SqlAuditLog` 已经能挂 `threadId / threadStepId`。再加两个字段：

```sql
ALTER TABLE "SqlAuditLog"
  ADD COLUMN "aiInitiated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "probePurpose" TEXT;

CREATE INDEX "SqlAuditLog_aiInitiated_idx" ON "SqlAuditLog"("aiInitiated", "startedAt");
```

效果：管理员页（如果有）可单独查看"过去 7 天 AI 自主跑了多少 SQL、谁在用、有没有滥用"。

## E.5 多步推理可视化

Stage 时间线在 Analyst 模式下可能长这样：

```
1. 你的问题：分析最近的求职情况，找出值得关注的点
2. 工具：catalog_search → 命中 JobApplication / InterviewRecord
3. AI 推荐表：JobApplication（主）+ InterviewRecord（关联）
4. AI 思考流（流式）…
5. AI 探查：检查 status 的所有 distinct 值
   purpose: "确认枚举值，避免使用错误的中文标签"
   结果: ["applied", "interview", "offer", "rejected"]
6. AI 探查：最近 30 天 vs 之前 30 天投递数对比
   purpose: "判断近期投递是否有显著变化"
   结果: [{ recent: 87, previous: 64, delta: +35.9% }]
7. AI 探查：interview 阶段平均停留时间
   purpose: "找出可能的瓶颈环节"
   结果: [{ avg_days: 12.3 }]
8. AI 思考流（综合上面探查）…
9. SQL 草稿：综合查询返回完整看板数据
10. SQL 运行结果（自动执行 + 表格 + 可视化）
11. AI 解读：最近 30 天投递增加 36%，但 interview→offer 转化率下降；
            建议关注 5 家进入 interview 但停留超 14 天的公司。
```

这就是和"只会写 SQL"的市面 AI 工具的本质区别。

## E.6 新增 / 修改文件

```
app/api/sql/ai/
├─ stream/route.ts            # 改造：tool-calling 循环 + 自动执行 + 安全栏
└─ cancel/route.ts (新)       # 接收前端 abort 信号，取消后端 PG 查询

lib/sql-lab/ai/
├─ tools.ts (新)               # run_safe_sql 工具定义
├─ probe-budget.ts (新)        # 配额计算与拦截
├─ agent-loop.ts (新)          # 多轮 tool-calling 状态机
├─ safety-bar.ts (新)          # 安全栏判定（哪些 SQL 自动跑、哪些暂停）
├─ context-builder.ts          # 扩展：注入前面 sql_run 摘要 + pinned cards
└─ result-memory.ts (新)       # 把 sql_run 步骤压缩为 prompt 友好的"事实"格式

lib/sql-lab/service.ts         # executeSql 新增 aiInitiated/probePurpose meta
lib/sql-lab/types.ts           # 新增 SqlThreadStepKind "ai_probe_sql"
                               # 新增 SqlStageMode = "auto" | "analyst" | "manual"
components/sql-lab/stage/
├─ stage-mode-switch.tsx (新)  # 三档模式切换
├─ stage-stop-button.tsx (新)  # 红色 STOP
└─ step-card.tsx               # 新增 ai_probe_sql 分支渲染
```

## E.7 边界与防滥用

| 风险 | 缓解 |
|---|---|
| AI 死循环跑探查 | 配额 8/次 + 20/线程；超出强制结束 |
| AI 探查泄露用户隐私 | 全部走 `executeSql`，行级过滤和列遮罩同步生效；不能绕开 |
| 长查询拖慢实验室 | 探查超时 5s，PG `statement_timeout` 兜底 |
| AI 误执行 DML | 安全栏白名单只允许 SELECT/WITH/EXPLAIN，其余强制要用户点确认 |
| 探查泛滥占额度 | 模型用量纳入用户 AI 用量配额（`AIUsageLog` 写入） |
| 用户想看 AI 究竟跑了什么 | 全部以 step 形式持久化 + audit log，可重放 |
| AI 在 Private schema 乱建表 | 安全栏判定 DDL 即使在 Private 也需用户确认 |

---

# 数据库变更总览

迁移按顺序合：

1. `20260512000000_drop_sql_assistant` — 删 2 张表
2. `20260513000000_sql_schema_profile` — 新增 `SqlSchemaProfile`
3. `20260514000000_sql_insight_cards` — 新增 `SqlInsightCard`
4. `20260515000000_audit_ai_initiated` — `SqlAuditLog` 加 `aiInitiated`、`probePurpose` 字段 + 索引
5. *（无需新表）* `SqlThreadStep.kind` 字段扩展（已是 string 类型，应用层 enum 加 `ai_probe_sql`）

净变化：**+2 张表，-2 张表，+2 列**。

---

# 阶段排序（v2）

每一阶段独立可上线、独立可回滚。

| 阶段 | 范围 | 估算 | 用户可见变化 |
|---|---|---|---|
| **P2.0** | 模块 A 删助教 | 0.5 周 | 控制台抽屉变干净，浮动按钮消失，旧助教历史已导出 |
| **P2.1** | 模块 C 准确性 (schema profile + fk graph + structured prompt) | 1.5 周 | AI 生成 SQL 显著更准，enum / 时间窗 / 关联表都不出错 |
| **P2.2** | 模块 C self-validation | 0.5 周 | "字段不存在"几乎绝迹，sql_draft 卡片显示 ✓ 自检通过 |
| **P2.3** | 模块 D 关系图 v2 | 1.5 周 | 独立路由的三层关系探索，可缩放可分组，从 AI 候选表可跳转聚焦 |
| **P2.4** | **模块 E 核心：结果记忆 + 安全栏自动执行** | **1 周** | **AI 看到前面的结果；SELECT 自动跑；DML/DDL 暂停确认** |
| **P2.5** | **模块 E 完整：Analyst 模式 + 探查 + STOP** | **1.5 周** | **开启深度分析后 AI 自己跑探查、综合答题、用户随时叫停** |
| **P2.6** | 模块 B 可视化 + 自动图表 | 1 周 | sql_run 卡 / ResultsPanel 一键变图表 |
| **P2.7** | 模块 B 分析卡片保存 + AI 自动产图配置 | 0.5 周 | AI 直接产出带图表的"分析卡片"，可置顶 / 分享 |

**总：约 8 周**，关键路径在 P2.4 + P2.5（合计 2.5 周）。

---

# 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Schema profile 首次跑慢 | 加载 / refresh 体验差 | 后台 cron；read-through 缓存；profile 缺失时 fallback |
| ECharts / elkjs bundle 大 | 首屏慢 | 路由级 dynamic import + 骨架；初始 bundle 不增加 |
| AI 探查死循环 / 爆耗 | 服务可用性 + 钱 | 配额硬上限 + per-thread cap + 用量审计 |
| AI 误把 Public 数据写到 Private | 数据污染 | 安全栏对所有 DML/DDL 暂停；Private 写也需用户点确认 |
| 用户对"AI 自动执行"不放心 | 体验抵触 | 模式三档默认是 Auto 但每张 sql_run 卡有"撤回"按钮，且 STOP 按钮永远可见 |
| 删助教影响熟用户 | 抱怨 | 上线一周缓冲期 + 一次性导出助教历史为 markdown |
| Stage 失败时无后路 | 全靠 Stage | self-validation + 错误卡显示清楚 + SQL 控制台抽屉手写兜底 |
| 跨用户 / 团队记忆混淆 | 隐私 | 所有 context-builder 都按 userId 过滤；pinned card 只用本人的 |

---

# 待确认的关键开关

**P2.4 上线时，Stage 模式的默认值要用哪个？**

- **默认 Auto**（推荐）：SELECT 自动跑，DML/DDL 暂停。Stage 自然像"AI 帮你完成"，但有人会觉得"太快还没看清就执行了"
- **默认 Manual**：所有 SQL 都暂停。AI 像"会写 SQL 的助手"，但每次都要点一下，体验慢
- **跟随线程**：第一次问问题用默认 Auto，用户首次按 STOP 后自动降级为 Manual

倾向：**默认 Auto + 第一次按 STOP 后自动降级**（最像产品级的"自适应"设计）。审核确认后写进 P2.4 验收标准。

---

# 验收标准（每阶段）

P2.0：
- [ ] 旧助教路由全部 404，旧组件 / lib 文件被删
- [ ] `npm run build` 通过；既有 Stage 流不受影响
- [ ] 数据库无 `SqlAssistantConversation` / `SqlAssistantMessage` 表

P2.1：
- [ ] 70 张表都有 `SqlSchemaProfile` 记录
- [ ] FK 图查询有 1 小时缓存
- [ ] Prompt 渲染含 enum 值、时间范围、FK 邻居
- [ ] 抽样 10 个常见问题，AI 命中率从 ≤60% 提升到 ≥85%

P2.2：
- [ ] AI 生成的 SQL 100% 经过 PREPARE
- [ ] PREPARE 失败的重试机制有日志
- [ ] sql_draft 卡片显示 ✓ 自检状态

P2.3：
- [ ] `/sql/relations` 独立路由可用
- [ ] L1/L2/L3 三层可正常切换
- [ ] 缩放、平移、minimap、lasso 多选都能工作
- [ ] 70 张表场景下渲染 ≤500ms，交互 ≤16ms / frame

P2.4：
- [ ] AI 能引用前 3 个 `sql_run` 步骤的事实
- [ ] 安全栏白名单正确：SELECT 自动跑、DML/DDL 暂停
- [ ] 每个 `sql_run` 卡有"撤回到此步前"按钮
- [ ] 模式切换持久化到 localStorage

P2.5：
- [ ] AI 在 Analyst 模式下可发起 ≥3 次连续探查
- [ ] 配额 8/次 + 20/线程生效
- [ ] STOP 按钮可叫停 SSE + 取消 PG 查询
- [ ] 所有 `ai_probe_sql` 步骤可见、可折叠、可重放

P2.6：
- [ ] sql_run 卡片可切换表格 / 图表视图
- [ ] 8 种图表类型可用
- [ ] auto-chart 命中率 ≥80%（人工评估 30 个样本）

P2.7：
- [ ] 任意 sql_run 卡可保存为 `SqlInsightCard`
- [ ] AI 输出可直接带 chartConfig
- [ ] 卡片可置顶 / 删除 / 重命名

---

# 后续展望（不在 P2 范围）

- **P3 看板**：把 InsightCard 组合成多面板 dashboard（类似轻量 Metabase）
- **P3 自然语言 Schema 编辑**：用户对 Private 表说"加一列叫 priority"，AI 生成 DDL 经用户确认后执行
- **P3 多用户协作**：分享 thread 链接，他人只读浏览（不能再执行）
- **P4 自动巡检**：每天后台跑一组通用查询，找异常推到首页
- **P4 字段血缘**：AI 在 reasoning 里把"这个数据来自 X.y 经过 Z 转换"做出可视化追踪图
