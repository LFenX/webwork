# 数据库操作安全须知

## 禁止的操作

以下命令**绝对禁止**在此项目中执行：

```bash
npx prisma db push                    # 可能删除 pgvector embedding 列
npx prisma db push --accept-data-loss # 同上，且静默接受数据丢失
npx prisma migrate reset              # 会删除整个数据库
npx prisma migrate resolve --applied  # 标记已应用但不执行 SQL，导致迁移链断裂
```

## 原因

Prisma 的 `db push` 通过对比 schema 文件和真实数据库来同步结构。
本项目使用了 Prisma schema 不支持的 `vector(1536)` 类型，这些列通过 raw SQL 迁移添加。

执行 `db push` 时，Prisma 发现数据库中存在 schema 里没有定义的 `embedding vector(1536)` 列，
会将其视为"多余列"并尝试删除。

## 受影响的表和列（raw SQL 创建，Prisma schema 不可见）

| 表 | 列 | 类型 |
|---|---|---|
| MemoryFact | embedding | vector(1536) |
| MemoryEvent | embedding | vector(1536) |
| MemoryToolEvent | embedding | vector(1536) |

对应索引同样是 raw SQL 创建：

| 索引 | 方法 |
|---|---|
| MemoryFact_embedding_idx | HNSW (vector_cosine_ops) |
| MemoryEvent_embedding_idx | HNSW (vector_cosine_ops) |
| MemoryToolEvent_embedding_idx | HNSW (vector_cosine_ops) |

## 正确的数据库变更方式

1. 修改 `prisma/schema.prisma`
2. 运行 `npx prisma migrate dev --name your_migration_name`
3. 如果需要 raw SQL（如 vector 列），在 migration SQL 文件中手动添加
4. 如果有 raw SQL 字段，在迁移完成后手动核验这些字段仍存在
5. 在 schema 文件中用注释标注存在 raw SQL 隐藏字段的表

## 恢复 embedding 列（如果不慎删除）

如果 `db push` 意外删除了 embedding 列，可以重新执行迁移
`20260426230247_add_pgvector_memory_embeddings` 中的 SQL 来恢复列和索引：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE "MemoryEvent" ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE "MemoryToolEvent" ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS "MemoryFact_embedding_idx" ON "MemoryFact" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "MemoryEvent_embedding_idx" ON "MemoryEvent" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "MemoryToolEvent_embedding_idx" ON "MemoryToolEvent" USING hnsw (embedding vector_cosine_ops);
```

然后重新运行 embedding 回填：
```bash
npx tsx --env-file=.env scripts/backfill-memory-embeddings.ts
```

## 执行迁移前必须做的事

1. 确保有数据库备份
2. 确认 migration SQL 文件不包含 DROP 关键表或列
3. 确认 Raw SQL 字段不会被 migration 覆盖
4. 在开发环境先测试迁移结果
