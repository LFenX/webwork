/**
 * Backfill script: generate embeddings for existing memories that don't have them yet.
 *
 * Run:
 *   MEMORY_EMBEDDING_PROVIDER=mock MEMORY_EMBEDDING_DIM=1536 npx tsx --env-file=.env scripts/backfill-memory-embeddings.ts
 *
 * Set provider to "disabled" to skip without error.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/app/generated/prisma/client"

const BATCH_SIZE = parseInt(process.env.EMBEDDING_BACKFILL_BATCH || "20", 10)

// ── Inline config (mirrors embedding-service.ts) ──
function getConfig() {
  const provider = (process.env.MEMORY_EMBEDDING_PROVIDER || "disabled").trim().toLowerCase()
  const baseUrl = (process.env.MEMORY_EMBEDDING_BASE_URL || "").trim()
  const model = (process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-3-small").trim()
  const dim = parseInt(process.env.MEMORY_EMBEDDING_DIM || "1536", 10)
  const apiKey = (process.env.MEMORY_EMBEDDING_API_KEY || "").trim()
  if (provider === "mock") return { enabled: true, provider: "mock", baseUrl, model, dim, apiKey: "" }
  if (provider === "disabled" || !apiKey || !baseUrl || !model) return { enabled: false, provider: "disabled", baseUrl, model, dim, apiKey: "" }
  if (provider === "openai-compatible" && apiKey && baseUrl) return { enabled: true, provider, baseUrl, model, dim, apiKey }
  return { enabled: false, provider: "disabled", baseUrl, model, dim, apiKey: "" }
}

// ── Inline mock embedding (mirrors embedding-service.ts) ──
function generateMockEmbedding(text: string, dim: number): number[] {
  let hash = 0
  for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash) + text.charCodeAt(i); hash |= 0 }
  const result: number[] = []
  let seed = Math.abs(hash)
  for (let i = 0; i < dim; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; result.push((seed / 0x7fffffff) * 2 - 1) }
  const norm = Math.sqrt(result.reduce((s, v) => s + v * v, 0))
  return result.map(v => v / (norm || 1))
}

async function fetchOpenAIEmbedding(config: ReturnType<typeof getConfig>, text: string): Promise<number[]> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/embeddings`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: text }),
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  const data = await response.json() as { data: Array<{ embedding: number[] }> }
  const embedding = data.data?.[0]?.embedding
  if (!embedding || !Array.isArray(embedding)) throw new Error("Invalid response")
  return embedding
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const config = getConfig()
  if (!config.enabled) return null
  if (config.provider === "mock") return generateMockEmbedding(text, config.dim)
  if (config.provider === "openai-compatible") {
    try { return await fetchOpenAIEmbedding(config, text) }
    catch { return null }
  }
  return null
}

function serializeVector(v: number[]): string {
  return `[${v.join(",")}]`
}

// ── Inline embedding text builder ──
function compactForEmbedding(value: string, maxChars: number): string {
  const t = value.trim()
  return t.length <= maxChars ? t : `${t.slice(0, maxChars - 3)}...`
}

function buildEmbeddingText(type: "fact" | "event" | "tool_event", item: Record<string, unknown>): string {
  switch (type) {
    case "fact":
      return [item.category, item.title, compactForEmbedding(String(item.content ?? ""), 800),
        Array.isArray(item.tags) ? item.tags.join(", ") : ""].filter(Boolean).join(" | ")
    case "event":
      return [compactForEmbedding(String(item.topicSummary ?? ""), 200),
        compactForEmbedding(String(item.keyTakeaways ?? ""), 400),
        Array.isArray(item.keywords) ? item.keywords.join(", ") : "",
        Array.isArray(item.relatedModules) ? item.relatedModules.join(", ") : ""].filter(Boolean).join(" | ")
    case "tool_event":
      return [item.action, item.module, item.title, item.sourceModule, item.targetModule,
        Array.isArray(item.changedFields) ? item.changedFields.join(", ") : ""].filter(Boolean).join(" | ")
    default: return String(item.title ?? item.topicSummary ?? "")
  }
}

// ── Main ──
async function backfillTable(p: PrismaClient, table: string, type: "fact" | "event" | "tool_event") {
  const config = getConfig()
  if (!config.enabled) { console.log(`  ${table}: disabled — skipped`); return }

  const countRow = await p.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) as cnt FROM "${table}" WHERE "deletedAt" IS NULL AND ("embeddingStatus" IN ('pending','failed') OR "embeddingStatus" IS NULL OR ("embeddingStatus"='ready' AND embedding IS NULL))`
  )
  const total = Number(countRow[0].cnt)
  if (total === 0) { console.log(`  ${table}: all records have embeddings`); return }

  console.log(`  ${table}: ${total} pending (batch ${BATCH_SIZE})`)
  let processed = 0, ok = 0, failed = 0

  while (true) {
    const batch = await p.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "${table}" WHERE "deletedAt" IS NULL AND ("embeddingStatus" IN ('pending','failed') OR "embeddingStatus" IS NULL OR ("embeddingStatus"='ready' AND embedding IS NULL)) LIMIT ${BATCH_SIZE}`
    )
    if (batch.length === 0) break

    for (const record of batch) {
      const id = record.id as string
      try {
        const text = buildEmbeddingText(type, record)
        const emb = await generateEmbedding(text)
        if (!emb) {
          await p.$executeRawUnsafe(`UPDATE "${table}" SET "embeddingStatus"='failed', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`)
          failed++
        } else {
          const vec = serializeVector(emb)
          try {
            await p.$executeRawUnsafe(`UPDATE "${table}" SET embedding='${vec}'::vector, "embeddingStatus"='ready', "embeddingModel"='${config.model}', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`)
            ok++
          } catch {
            await p.$executeRawUnsafe(`UPDATE "${table}" SET "embeddingStatus"='ready', "embeddingModel"='${config.model}', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`)
            ok++
          }
        }
      } catch {
        await p.$executeRawUnsafe(`UPDATE "${table}" SET "embeddingStatus"='failed', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`)
        failed++
      }
      processed++
      if (processed % 10 === 0) console.log(`    ${table}: ${processed}/${total} (${ok} ok, ${failed} failed)`)
    }
  }
  console.log(`  ${table}: done — ${ok} ok, ${failed} failed`)
}

async function main() {
  console.log("═══ Embedding Backfill ═══")
  const config = getConfig()
  console.log(`Provider: ${config.provider}, Model: ${config.model}, Dim: ${config.dim}, Enabled: ${config.enabled}\n`)
  if (!config.enabled) { console.log("Provider disabled. Exiting.\n"); return }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new PrismaClient({ adapter } as any)

  await backfillTable(p, "MemoryFact", "fact")
  await backfillTable(p, "MemoryEvent", "event")
  await backfillTable(p, "MemoryToolEvent", "tool_event")

  console.log("\n═══ Done ═══")
  await p.$disconnect()
}
main().catch(e => { console.error("CRASH:", e); process.exit(1) })
