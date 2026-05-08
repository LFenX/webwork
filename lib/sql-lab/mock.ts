import "server-only"
import type {
  SqlAuditEntry,
  SqlExample,
  SqlGrant,
  SqlGrantSummary,
  SqlHistoryItem,
  SqlRunResult,
  SqlSavedQuery,
  SqlSchema,
  SqlTableInfo,
} from "@/lib/sql-lab/types"

// 这是 SQL 实验室 UI 阶段的占位数据。后端正式接入时,请用真实的:
//  - information_schema 查询(返回 schema/columns)
//  - SqlAccessGrant + SqlAccessTableGrant 表(返回授权)
//  - 后端只读连接 + AST 校验(执行 SQL)
// 替换本文件相应函数即可,UI 不需要修改。

const SAMPLE_SCHEMA_TABLES: SqlTableInfo[] = [
  {
    schema: "public",
    name: "User",
    rowCountEstimate: 12,
    access: "read",
    rowFilterPreview: null,
    comment: "登录与基础资料",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true },
      { name: "email", dataType: "text", nullable: false },
      { name: "displayName", dataType: "text", nullable: false },
      { name: "role", dataType: "text", nullable: false },
      { name: "passwordHash", dataType: "text", nullable: false, isMasked: true, comment: "受保护字段" },
      { name: "lastLoginAt", dataType: "timestamp", nullable: true },
      { name: "createdAt", dataType: "timestamp", nullable: false },
    ],
  },
  {
    schema: "public",
    name: "Post",
    rowCountEstimate: 184,
    access: "read",
    rowFilterPreview: "userId = :viewerId",
    comment: "博客 / 日常 / 心得 / 笔记 共享文章表",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true },
      { name: "title", dataType: "text", nullable: false },
      { name: "module", dataType: "text", nullable: false },
      { name: "visibility", dataType: "text", nullable: false },
      { name: "userId", dataType: "text", nullable: false, isForeignKey: true },
      { name: "folderId", dataType: "text", nullable: true, isForeignKey: true },
      { name: "createdAt", dataType: "timestamp", nullable: false },
    ],
  },
  {
    schema: "public",
    name: "Comment",
    rowCountEstimate: 521,
    access: "read",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true },
      { name: "postId", dataType: "text", nullable: false, isForeignKey: true },
      { name: "userId", dataType: "text", nullable: false, isForeignKey: true },
      { name: "body", dataType: "text", nullable: false },
      { name: "createdAt", dataType: "timestamp", nullable: false },
    ],
  },
  {
    schema: "public",
    name: "JobApplication",
    rowCountEstimate: 23,
    access: "write",
    rowFilterPreview: "userId = :viewerId",
    comment: "求职跟踪。允许写入自己的记录。",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true },
      { name: "userId", dataType: "text", nullable: false, isForeignKey: true },
      { name: "company", dataType: "text", nullable: false },
      { name: "position", dataType: "text", nullable: false },
      { name: "status", dataType: "text", nullable: false },
      { name: "appliedAt", dataType: "timestamp", nullable: true },
    ],
  },
  {
    schema: "public",
    name: "UserActivity",
    rowCountEstimate: 18432,
    access: "none",
    comment: "登录/操作日志(无权限)",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true },
      { name: "userId", dataType: "text", nullable: true, isMasked: true },
      { name: "action", dataType: "text", nullable: false, isMasked: true },
      { name: "ipAddress", dataType: "text", nullable: true, isMasked: true },
    ],
  },
  {
    schema: "public",
    name: "AdminPermission",
    rowCountEstimate: 3,
    access: "none",
    comment: "管理员权限(无权限)",
    columns: [
      { name: "id", dataType: "text", nullable: false, isPrimaryKey: true, isMasked: true },
      { name: "userId", dataType: "text", nullable: false, isMasked: true },
    ],
  },
]

export function buildMockSchema(opts: {
  viewerId: string
  viewerName: string
  role: string
  isOwner: boolean
  canManageSqlLab: boolean
}): SqlSchema {
  const tables = opts.isOwner
    ? SAMPLE_SCHEMA_TABLES.map((t) => ({
        ...t,
        access: "write" as const,
        columns: t.columns.map((c) => ({ ...c, isMasked: false })),
      }))
    : SAMPLE_SCHEMA_TABLES
  return {
    viewer: {
      userId: opts.viewerId,
      displayName: opts.viewerName,
      role: opts.role,
      isOwner: opts.isOwner,
      canManage: opts.canManageSqlLab,
    },
    enabled: opts.isOwner || tables.some((t) => t.access !== "none"),
    defaultLimit: 1000,
    maxLimit: 50000,
    defaultTimeoutMs: 15000,
    dataSource: { name: "primary", engine: "postgres", readOnly: !opts.isOwner },
    schemas: [{ name: "public", tables }],
  }
}

export function buildMockRunResult(sql: string): SqlRunResult {
  const startedAt = new Date()
  const trimmed = sql.trim().toLowerCase()
  const id = `run_${startedAt.getTime().toString(36)}`
  if (!trimmed) {
    return {
      runId: id,
      ok: false,
      resultSets: [],
      durationMs: 1,
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      warnings: [],
      error: { code: "EMPTY", message: "请输入 SQL 语句", hint: "可以用 Cmd/Ctrl + Enter 直接执行" },
    }
  }
  if (/(drop|truncate|alter)\s+/i.test(trimmed)) {
    return {
      runId: id,
      ok: false,
      resultSets: [],
      durationMs: 4,
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      warnings: [],
      error: { code: "FORBIDDEN_DDL", message: "拒绝执行 DDL: DROP/TRUNCATE/ALTER 不在允许范围", hint: "如需修改结构,请联系终极管理员" },
    }
  }
  // mock SELECT
  const rows = Array.from({ length: 8 }, (_, i) => ({
    id: `cmrkw0${(i + 100).toString(36)}`,
    title: ["设计系统改版", "周末复盘", "面试反思", "求职心得", "博客上线", "新功能上线", "迭代记录", "首次发布"][i] ?? `示例条目 ${i + 1}`,
    module: ["blog", "daily", "reflections", "notes"][i % 4],
    visibility: ["public", "friends", "private"][i % 3],
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }))
  return {
    runId: id,
    ok: true,
    resultSets: [
      {
        statement: sql.trim(),
        columns: [
          { name: "id", type: "text" },
          { name: "title", type: "text" },
          { name: "module", type: "text" },
          { name: "visibility", type: "text" },
          { name: "createdAt", type: "timestamp" },
        ],
        rows,
        rowCount: rows.length,
        truncated: false,
      },
    ],
    durationMs: 32 + Math.floor(Math.random() * 80),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date(startedAt.getTime() + 60).toISOString(),
    warnings: ["示例数据 - 后端尚未接入真实数据库"],
    touchedTables: ["public.Post"],
  }
}

export function buildMockHistory(): SqlHistoryItem[] {
  const base = Date.now()
  const samples = [
    { sql: "SELECT id, title FROM \"Post\" WHERE userId = :viewerId LIMIT 50", rows: 12, ok: true },
    { sql: "SELECT count(*) FROM \"Comment\"", rows: 1, ok: true },
    { sql: "SELECT email FROM \"User\" WHERE role = 'admin'", rows: 0, ok: false },
    { sql: "SELECT * FROM \"JobApplication\" ORDER BY appliedAt DESC", rows: 23, ok: true },
  ]
  return samples.map((s, i) => ({
    id: `hist_${i}`,
    sql: s.sql,
    startedAt: new Date(base - i * 600_000).toISOString(),
    durationMs: 18 + i * 12,
    rowCount: s.rows,
    ok: s.ok,
    truncated: false,
    errorMessage: s.ok ? undefined : "拒绝读取受限列 email",
  }))
}

export function buildMockSaved(): SqlSavedQuery[] {
  return [
    {
      id: "saved_self_posts",
      name: "我的最新文章",
      sql: "SELECT id, title, module, createdAt\nFROM \"Post\"\nWHERE userId = :viewerId\nORDER BY createdAt DESC\nLIMIT 50;",
      description: "查看本账户最新发布的所有模块文章",
      pinned: true,
      shared: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "saved_comments_summary",
      name: "评论统计",
      sql: "SELECT postId, count(*) AS comments\nFROM \"Comment\"\nGROUP BY postId\nORDER BY comments DESC\nLIMIT 20;",
      description: "热门文章的评论数 Top 20",
      pinned: false,
      shared: true,
      updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ]
}

export function buildMockExamples(): SqlExample[] {
  return [
    {
      id: "ex_intro",
      title: "查询自己的资料",
      sql: "SELECT id, displayName, role, createdAt\nFROM \"User\"\nWHERE id = :viewerId;",
      description: "用预置参数 :viewerId 替换为当前登录用户",
      category: "intro",
    },
    {
      id: "ex_join",
      title: "联表 - 我的文章 + 评论数",
      sql: "SELECT p.id, p.title, count(c.id) AS comments\nFROM \"Post\" p\nLEFT JOIN \"Comment\" c ON c.postId = p.id\nWHERE p.userId = :viewerId\nGROUP BY p.id, p.title\nORDER BY comments DESC;",
      description: "JOIN + GROUP BY 用法",
      category: "join",
    },
    {
      id: "ex_aggregate",
      title: "求职状态分组",
      sql: "SELECT status, count(*) AS total\nFROM \"JobApplication\"\nWHERE userId = :viewerId\nGROUP BY status;",
      description: "聚合求职申请状态分布",
      category: "aggregate",
    },
  ]
}

export function buildMockGrantSummaries(): SqlGrantSummary[] {
  return [
    {
      userId: "u_alice",
      email: "alice@example.com",
      displayName: "Alice",
      role: "admin",
      enabled: true,
      tableCount: 5,
      readOnlyCount: 4,
      writableCount: 1,
      updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      userId: "u_bob",
      email: "bob@example.com",
      displayName: "Bob",
      role: "user",
      enabled: true,
      tableCount: 2,
      readOnlyCount: 2,
      writableCount: 0,
      updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    },
    {
      userId: "u_chris",
      email: "chris@example.com",
      displayName: "Chris",
      role: "user",
      enabled: false,
      tableCount: 0,
      readOnlyCount: 0,
      writableCount: 0,
      updatedAt: null,
    },
  ]
}

export function buildMockGrantDetail(userId: string): SqlGrant {
  const summaries = buildMockGrantSummaries()
  const summary = summaries.find((s) => s.userId === userId) ?? summaries[0]
  return {
    userId: summary.userId,
    email: summary.email,
    displayName: summary.displayName,
    role: summary.role,
    enabled: summary.enabled,
    defaultLimit: 1000,
    defaultTimeoutMs: 15000,
    tables:
      summary.tableCount === 0
        ? []
        : [
            {
              schema: "public",
              table: "Post",
              access: "read",
              blockedColumns: [],
              rowFilter: "userId = :viewerId",
              updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            },
            {
              schema: "public",
              table: "Comment",
              access: "read",
              blockedColumns: [],
              updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            },
            {
              schema: "public",
              table: "JobApplication",
              access: "write",
              blockedColumns: [],
              rowFilter: "userId = :viewerId",
              updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
            },
          ],
    updatedAt: summary.updatedAt ?? new Date().toISOString(),
  }
}

export function buildMockAllTables(): Array<{ schema: string; table: string; columns: string[] }> {
  return SAMPLE_SCHEMA_TABLES.map((t) => ({
    schema: t.schema,
    table: t.name,
    columns: t.columns.map((c) => c.name),
  }))
}

export function buildMockAudit(): SqlAuditEntry[] {
  const base = Date.now()
  return [
    {
      id: "audit_1",
      userId: "u_alice",
      email: "alice@example.com",
      displayName: "Alice",
      startedAt: new Date(base - 5 * 60_000).toISOString(),
      durationMs: 42,
      ok: true,
      rowCount: 12,
      truncated: false,
      sqlPreview: "SELECT id, title FROM \"Post\" WHERE userId = :viewerId LIMIT 50",
      touchedTables: ["public.Post"],
      ipAddress: "10.0.1.21",
    },
    {
      id: "audit_2",
      userId: "u_bob",
      email: "bob@example.com",
      displayName: "Bob",
      startedAt: new Date(base - 24 * 60_000).toISOString(),
      durationMs: 11,
      ok: false,
      rowCount: 0,
      truncated: false,
      sqlPreview: "SELECT * FROM \"User\" WHERE role = 'admin'",
      touchedTables: ["public.User"],
      errorMessage: "FORBIDDEN_TABLE: 用户对 public.User 无读取权限",
      ipAddress: "10.0.1.42",
    },
    {
      id: "audit_3",
      userId: "u_alice",
      email: "alice@example.com",
      displayName: "Alice",
      startedAt: new Date(base - 60 * 60_000).toISOString(),
      durationMs: 138,
      ok: true,
      rowCount: 1024,
      truncated: true,
      sqlPreview: "SELECT * FROM \"Comment\" ORDER BY createdAt DESC",
      touchedTables: ["public.Comment"],
      ipAddress: "10.0.1.21",
    },
  ]
}
