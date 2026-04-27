import "server-only"

// ── Config ────────────────────────────────────────────────────────────────

interface MemoryEmbeddingConfig {
  enabled: boolean
  provider: string
  baseUrl: string
  model: string
  dim: number
  apiKey: string
}

export function getMemoryEmbeddingConfig(): MemoryEmbeddingConfig {
  const provider = (process.env.MEMORY_EMBEDDING_PROVIDER || "disabled").trim().toLowerCase()
  const baseUrl = (process.env.MEMORY_EMBEDDING_BASE_URL || "").trim()
  const model = (process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-3-small").trim()
  const dim = parseInt(process.env.MEMORY_EMBEDDING_DIM || "1536", 10)
  const apiKey = (process.env.MEMORY_EMBEDDING_API_KEY || "").trim()

  if (provider === "mock") {
    return { enabled: true, provider: "mock", baseUrl, model, dim, apiKey: "" }
  }

  if (provider === "disabled" || !apiKey || !baseUrl || !model) {
    return { enabled: false, provider: "disabled", baseUrl, model, dim, apiKey: "" }
  }

  if (provider === "openai-compatible" && apiKey && baseUrl) {
    return { enabled: true, provider, baseUrl, model, dim, apiKey }
  }

  return { enabled: false, provider: "disabled", baseUrl, model, dim, apiKey: "" }
}

// ── Embedding text builder ────────────────────────────────────────────────

function compactForEmbedding(value: string, maxChars: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars - 3) + "..."
}

export function buildMemoryEmbeddingText(type: "fact" | "event" | "tool_event", item: Record<string, unknown>): string {
  switch (type) {
    case "fact":
      return [
        item.category,
        item.title,
        compactForEmbedding(String(item.content ?? ""), 800),
        Array.isArray(item.tags) ? item.tags.join(", ") : "",
      ].filter(Boolean).join(" | ")

    case "event":
      return [
        compactForEmbedding(String(item.topicSummary ?? ""), 200),
        compactForEmbedding(String(item.keyTakeaways ?? ""), 400),
        Array.isArray(item.keywords) ? item.keywords.join(", ") : "",
        Array.isArray(item.relatedModules) ? item.relatedModules.join(", ") : "",
      ].filter(Boolean).join(" | ")

    case "tool_event":
      return [
        item.action,
        item.module,
        item.title,
        item.sourceModule,
        item.targetModule,
        Array.isArray(item.changedFields) ? item.changedFields.join(", ") : "",
      ].filter(Boolean).join(" | ")

    default:
      return String(item.title ?? item.topicSummary ?? "")
  }
}

// ── Vector serialization ──────────────────────────────────────────────────

export function serializeVector(vector: number[]): string {
  return `[${vector.join(",")}]`
}

// ── Embedding generation ──────────────────────────────────────────────────

async function fetchOpenAIEmbedding(config: MemoryEmbeddingConfig, text: string): Promise<number[]> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/embeddings`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: text }),
  })

  if (!response.ok) {
    throw new Error(`Embedding API returned ${response.status}: ${await response.text().catch(() => "unknown")}`)
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> }
  const embedding = data.data?.[0]?.embedding
  if (!embedding || !Array.isArray(embedding)) throw new Error("Invalid embedding response")

  if (embedding.length !== config.dim) {
    throw new Error(`Embedding dimension mismatch: got ${embedding.length}, expected ${config.dim}`)
  }

  return embedding
}

function generateMockEmbedding(text: string, dim: number): number[] {
  // Deterministic mock embedding for local testing only.
  // NOT for production use.
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  // Use the hash as a seed to generate a pseudo-random vector
  const result: number[] = []
  let seed = Math.abs(hash)
  for (let i = 0; i < dim; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    result.push((seed / 0x7fffffff) * 2 - 1)
  }
  // Normalize
  const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0))
  return result.map((v) => v / (norm || 1))
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const config = getMemoryEmbeddingConfig()
  if (!config.enabled) return null

  try {
    if (config.provider === "mock") {
      return generateMockEmbedding(text, config.dim)
    }
    return await fetchOpenAIEmbedding(config, text)
  } catch {
    return null
  }
}

// ── Safe generate and store ───────────────────────────────────────────────

export async function safeGenerateAndStoreEmbedding(
  table: "MemoryFact" | "MemoryEvent" | "MemoryToolEvent",
  id: string,
  type: "fact" | "event" | "tool_event",
  item: Record<string, unknown>,
  prismaClient: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
): Promise<void> {
  const config = getMemoryEmbeddingConfig()

  if (!config.enabled) {
    await prismaClient.$executeRawUnsafe(
      `UPDATE "${table}" SET "embeddingStatus"='skipped', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`
    ).catch(() => {})
    return
  }

  const text = buildMemoryEmbeddingText(type, item)

  try {
    const embedding = await generateEmbedding(text)
    if (!embedding) {
      await prismaClient.$executeRawUnsafe(
        `UPDATE "${table}" SET "embeddingStatus"='failed', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`
      ).catch(() => {})
      return
    }

    const vectorStr = serializeVector(embedding)

    // Only update vector column if pgvector extension exists
    try {
      await prismaClient.$executeRawUnsafe(
        `UPDATE "${table}" SET embedding='${vectorStr}'::vector, "embeddingStatus"='ready', "embeddingModel"='${config.model}', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`
      )
    } catch {
      // vector column doesn't exist (pgvector not installed)
      await prismaClient.$executeRawUnsafe(
        `UPDATE "${table}" SET "embeddingStatus"='ready', "embeddingModel"='${config.model}', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`
      ).catch(() => {})
    }
  } catch {
    await prismaClient.$executeRawUnsafe(
      `UPDATE "${table}" SET "embeddingStatus"='failed', "embeddingUpdatedAt"=NOW() WHERE id='${id}'`
    ).catch(() => {})
  }
}
