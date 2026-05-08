# SQL 实验室 — 后端实施方案

> 当前阶段:UI + 接口契约已落地;`/api/sql/*` 与 `/api/admin/sql-access/*`
> 现在返回 `lib/sql-lab/mock.ts` 中的占位数据。本文档说明把它们换成真实
> 后端时所需做的具体改动。UI 端不需要再改。

---

## 1. 数据模型(Prisma 迁移)

新增三张表 + 一张审计日志:

```prisma
// prisma/schema.prisma

model SqlAccessGrant {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation("sqlGrantUser", fields: [userId], references: [id], onDelete: Cascade)
  enabled          Boolean  @default(false)
  defaultLimit     Int      @default(1000)
  maxLimit         Int      @default(50000)
  defaultTimeoutMs Int      @default(15000)
  updatedById      String?
  updatedBy        User?    @relation("sqlGrantUpdater", fields: [updatedById], references: [id], onDelete: SetNull)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tables           SqlAccessTableGrant[]
}

model SqlAccessTableGrant {
  id              String   @id @default(cuid())
  grantId         String
  grant           SqlAccessGrant @relation(fields: [grantId], references: [id], onDelete: Cascade)
  schemaName      String   // "public"
  tableName       String   // "Post"
  // none / read / write
  access          String   @default("read")
  blockedColumns  String[] @default([])
  rowFilter       String?  // 形如 `"userId" = :viewerId`
  updatedAt       DateTime @updatedAt

  @@unique([grantId, schemaName, tableName])
  @@index([schemaName, tableName])
}

model SqlSavedQuery {
  id          String   @id @default(cuid())
  userId      String   // 拥有者;owner 共享条目可保留为系统账号
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  sql         String
  description String   @default("")
  pinned      Boolean  @default(false)
  shared      Boolean  @default(false) // owner 共享给所有人
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, pinned])
}

model SqlAuditLog {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  startedAt     DateTime @default(now())
  durationMs    Int
  ok            Boolean
  rowCount      Int      @default(0)
  truncated     Boolean  @default(false)
  sqlPreview    String   // 只截前 2KB
  fullSqlSha256 String   // 用于去重 / 取证
  touchedTables String[] @default([])
  errorCode     String?
  errorMessage  String?
  ipAddress     String?
  userAgent     String?

  @@index([userId, startedAt])
  @@index([startedAt])
}
```

并在 `User` 模型上加上反向关系字段。`SqlAccessGrant` 是 user 维度,
单条记录控制是否启用 + 默认 limit/timeout;具体可访问的表落在
`SqlAccessTableGrant` 中。

---

## 2. 权限校验 (`lib/sql-lab/access.ts`)

服务端入口辅助函数:

- `getEffectiveSchema(viewerId)` —
  按 `SqlAccessGrant + SqlAccessTableGrant` 把 information_schema 数据
  过滤后返回 `SqlSchema`(对应 `lib/sql-lab/types.ts`)。被遮罩列设
  `isMasked: true`,无权限的表 `access: "none"`(若管理员要求完全隐藏
  这些表,把它们从返回中剔除即可)。
- `assertAllowedSql({ viewerId, sql })` —
  在执行前用 SQL 解析器把 AST 拿出来,校验:
  1. 只允许单语句
  2. 关键字白名单:`SELECT / WITH / INSERT / UPDATE / DELETE / EXPLAIN`
     - DDL(CREATE / ALTER / DROP / TRUNCATE)直接拒绝
     - `COPY / SET / PREPARE / LISTEN / NOTIFY / VACUUM` 拒绝
     - `pg_*` 系列函数与 `LATERAL` 子查询根据策略选择是否启用
  3. 任何 `INSERT/UPDATE/DELETE` 必须命中拥有 `write` 授权的表
  4. 引用的表/列必须在 grant 内,否则抛 `FORBIDDEN_TABLE` /
     `FORBIDDEN_COLUMN`
  5. 把每个表的 `rowFilter`(如 `"userId" = :viewerId`)合并到该表的
     `WHERE` 子句:
     - 推荐做法是构造一层只读视图:
       `CREATE VIEW sqlLab_<userId>_<table> AS SELECT <非遮罩列> FROM <table> WHERE <rowFilter>`
       并在执行时把 `<table>` 标识符 rewrite 成视图。这样把过滤交给
       数据库,不需要 AST 重写 WHERE。
     - 视图可缓存,grant 变更时刷新或直接删除。
- `executeSafely({ viewerId, sql, limit, timeoutMs })` —
  使用单独的连接池(只读 + 受限角色),要点:
  ```ts
  await client.query("BEGIN READ ONLY")          // SELECT 时
  await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`)
  await client.query(`SET LOCAL search_path = sqlLab_${viewerId}, public`)
  // 注入 :viewerId 等命名参数 -> $1
  const r = await client.query({ text: rewritten, values })
  ```
  - 写操作走 `BEGIN`(可写事务),但仍然限制 `statement_timeout`
    + `idle_in_transaction_session_timeout`
  - 截断:`LIMIT min(userLimit, grant.defaultLimit, maxLimit)`,客户端
    要求超过 grant 上限的直接拒绝。

### Postgres 角色建议
为 SQL 实验室建一个 role `sqllab_runner`:
```sql
CREATE ROLE sqllab_runner LOGIN PASSWORD '...';
REVOKE ALL ON SCHEMA public FROM sqllab_runner;
-- 仅授予访问那些 sqlLab_<userId>_* 视图的权限
GRANT USAGE ON SCHEMA sqlLab_<userId> TO sqllab_runner;
GRANT SELECT ON ALL TABLES IN SCHEMA sqlLab_<userId> TO sqllab_runner;
```
配合 `SET ROLE sqllab_runner;` 在每次连接复用前切换,做"双保险":
即便 AST 校验有漏,数据库也会把不允许的访问驳回。

---

## 3. 接口实现位置

| 路由 | 现状 | 替换内容 |
|------|------|---------|
| `GET  /api/sql/schema` | 返回 mock | `getEffectiveSchema(session.userId)` |
| `POST /api/sql/run` | 返回 mock | `assertAllowedSql` → `executeSafely` → 写 `SqlAuditLog` |
| `GET  /api/sql/history` | 返回 mock | `prisma.sqlAuditLog.findMany({ where: { userId } })` |
| `GET  /api/sql/saved` | 返回 mock | `prisma.sqlSavedQuery.findMany({ where: { OR: [{ userId }, { shared: true }] }})` |
| `POST /api/sql/saved` | 返回 mock | upsert + `assertAllowedSql` 的 dry-run(不执行,仅校验) |
| `PATCH/DELETE /api/sql/saved/:id` | 返回 mock | 校验 ownerId 后写 prisma |
| `GET  /api/sql/examples` | 静态数组 | 可改为根据 grant.tables 动态生成 |
| `POST /api/sql/cancel` | 暂未连线 UI | 在 `executeSafely` 中把 `runId → pg.PID` 缓存,收到 cancel 调 `pg_cancel_backend(pid)` |

| 管理员路由 | 现状 | 替换 |
|-----------|------|------|
| `GET /api/admin/sql-access/users` | mock | `prisma.user.findMany` left join `sqlAccessGrant` |
| `GET /api/admin/sql-access/users/:id` | mock | `prisma.sqlAccessGrant.findUnique({ include: { tables: true }})` |
| `PATCH /api/admin/sql-access/users/:id` | mock | upsert grant 行 |
| `PATCH /api/admin/sql-access/users/:id/tables/:table` | mock | upsert SqlAccessTableGrant + 重建视图 |
| `DELETE /api/admin/sql-access/users/:id/tables/:table` | mock | 删除行 + drop view |
| `GET /api/admin/sql-access/tables` | mock | `information_schema.columns where schemaname='public'` 缓存 5 min |
| `GET /api/admin/sql-access/audit` | mock | 分页查 `SqlAuditLog` |

所有 admin 路由已用 `requireAdminPermission("manageSqlLab")` 把关,
owner 透传 (`hasAdminPermission` 对 owner 总是 true)。

---

## 4. SQL 解析器选型

- **首选**:`libpg_query` 的 Node 绑定 `pg-query-emscripten`,
  Postgres 原生语法,精度高,单解析 ~1ms。
- **备选**:`node-sql-parser`(纯 JS,功能弱一些,但跨方言)。

无论选哪种,都要在 CI 里加 fuzz 用例,确保以下绕过被拒绝:

```sql
-- 多语句
SELECT 1; DROP TABLE "User";
-- 注释绕过
SELECT 1 /*; DROP TABLE "User"; */;
-- 函数侧攻击
SELECT pg_read_file('/etc/passwd');
-- pg_catalog 直读
SELECT * FROM pg_catalog.pg_authid;
-- 大小写
sElEcT * fRoM "User";
```

---

## 5. 速率限制 / 滥用防护

- 每用户 `M` 条/分钟、`N` 条/天;超出走 `429`。
- 单条语句硬上限:`statement_timeout = grant.defaultTimeoutMs`(默认
  15s,可调到 5min)。
- 全局:数据库连接池限定 4-8 条 SQL 实验室连接,防止一个用户跑死全站。
- 失败语句记入 `SqlAuditLog` 但不计入历史(避免暴露错误信息扫描)。

---

## 6. 与现有权限系统的衔接

已经把 `manageSqlLab` 加进了 `lib/admin-permissions.ts`:

- **owner**:总是有(`hasAdminPermission` 直接返回 true)。
- **普通管理员**:owner 在 `/admin → 管理员权限` 弹窗里可以勾选
  `manageSqlLab`,勾选后该 admin 才会看到 `AdminSqlAccessPanel`,
  并能为非 owner 成员授权。
- **普通成员**:导航里的"SQL 实验室"始终可见,但页面会向
  `/api/sql/schema` 拉一次:返回 `enabled=false` 时显示"尚未开放访问"。

---

## 7. 验证步骤

1. `npx prisma migrate dev --name add_sql_lab` 生成迁移
2. `prisma generate`
3. 在 owner 帐号下打开 `/admin`,把自己以外的某个成员加入 grant
4. 用该成员登录 `/sql`,验证只能看到被授权的表 + 行过滤生效
5. 用 owner 登录,验证侧边栏列出全部表 + READ ONLY 标记消失
6. 写入一个被禁止的 `DROP TABLE` 语句,验证返回 `FORBIDDEN_DDL`
7. 在管理员"最近执行审计"里看到所有记录

---

## 8. 已留好的扩展点

- `SqlRunResult.touchedTables`:供未来"被引用得最多的表"统计
- `SqlSavedQuery.shared`:owner 共享的范例
- `SqlExample.category`:范例分组,UI 已支持显示分类
- `SqlAccessTableGrant.rowFilter`:支持参数化(`:viewerId` 等),
  可扩展为 `:viewerEmail`、`:teamId` 等。
- `forceReadOnly` 参数(`SqlRunRequest`)预留给未来的"只读模式"按钮,
  即使有写权限也强制走只读事务。
