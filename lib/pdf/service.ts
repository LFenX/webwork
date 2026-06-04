import "server-only"
import { mkdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { PDF_CONTEXT_MAX_CHARS, PDF_MAX_PAGES, PDF_PARSE_QUALITY, getPdfOutputDir } from "@/lib/pdf/config"
import { runPdfParser } from "@/lib/pdf/parser-runner"
import { PDF_PARSE_STATUS, type PdfDocumentSummary, type PdfParseManifest } from "@/lib/pdf/types"

type RuntimePdfAttachment = {
  uploadId?: string | null
  url: string
  originalName: string
  mimeType: string
  size: number
}

function asInputJson(value: unknown) {
  return value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
  if (!value || Number.isNaN(value)) return fallback
  return Math.max(1, Math.min(max, Math.trunc(value)))
}

// Convert an internal parser error (which may contain a Python traceback,
// absolute paths, line numbers, or timeouts) into a short user-facing message.
// The raw error is logged server-side; only the sanitized text reaches the UI.
function sanitizePdfErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/PDF_TOO_LARGE/.test(raw)) return "PDF 文件超过大小上限，无法解析。"
  if (/NOT_A_PDF_UPLOAD/.test(raw)) return "该附件不是有效的 PDF 文件。"
  if (/timed out/i.test(raw)) return "PDF 解析超时，文件可能过大或过于复杂。"
  if (/exceeds limit|pages; limit/i.test(raw)) return "PDF 页数超过上限，无法完整解析。"
  if (/All PDF parsing engines/i.test(raw)) return "PDF 解析失败，解析服务暂不可用或文件无法识别，请稍后重试。"
  return "PDF 解析失败，请稍后重试或更换文件。"
}

// Restrict a PDF document/chunk query to documents that were attached inside a
// specific AI conversation. PDFs are chat-session attachments, not a global
// library, so retrieval must not leak across conversations.
function conversationDocumentFilter(conversationId: string | undefined): Prisma.PdfDocumentWhereInput {
  if (!conversationId) return {}
  return { upload: { aiMessageAttachments: { some: { message: { conversationId } } } } }
}

function normalizeRelativePath(value: string, fallback: string) {
  const raw = value || fallback
  return path.isAbsolute(raw) ? path.relative(process.cwd(), raw) : raw
}

function resolveUploadDiskPath(upload: { storagePath: string | null, url: string }) {
  if (upload.storagePath) {
    const storageRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage")
    const relativePath = upload.storagePath.replace(/^storage[\\/]/i, "").split(/[\\/]+/).filter(Boolean)
    const diskPath = path.join(storageRoot, ...relativePath)
    if (!path.resolve(diskPath).startsWith(path.resolve(storageRoot))) throw new Error("INVALID_STORAGE_PATH")
    return diskPath
  }

  const normalizedUrl = upload.url.replace(/^\/+/, "").split("/").join(path.sep)
  const publicRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), "public")
  const diskPath = path.join(publicRoot, normalizedUrl)
  if (!path.resolve(diskPath).startsWith(path.resolve(publicRoot))) throw new Error("INVALID_PUBLIC_PATH")
  return diskPath
}

function toDocumentSummary(document: {
  id: string
  uploadId: string
  status: string
  engine: string
  pageCount: number
  textChars: number
  tableCount: number
  formulaCount: number
  ocrPageCount: number
  errorMessage: string
  createdAt: Date
  updatedAt: Date
  upload: {
    originalName: string
    mimeType: string
    size: number
  }
}): PdfDocumentSummary {
  return {
    id: document.id,
    uploadId: document.uploadId,
    filename: document.upload.originalName,
    mimeType: document.upload.mimeType,
    size: document.upload.size,
    status: document.status,
    engine: document.engine,
    pageCount: document.pageCount,
    textChars: document.textChars,
    tableCount: document.tableCount,
    formulaCount: document.formulaCount,
    ocrPageCount: document.ocrPageCount,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

async function readManifest(manifestPath: string): Promise<PdfParseManifest | null> {
  if (!manifestPath) return null
  const absolutePath = path.isAbsolute(manifestPath) ? manifestPath : path.join(process.cwd(), manifestPath)
  const raw = await readFile(absolutePath, "utf8").catch(() => "")
  if (!raw) return null
  return JSON.parse(raw) as PdfParseManifest
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 3.5)
}

function pageRange(pageStart: number, pageEnd: number) {
  return pageStart === pageEnd ? `p.${pageStart}` : `pp.${pageStart}-${pageEnd}`
}

async function persistManifest(documentId: string, userId: string, manifest: PdfParseManifest) {
  const output = manifest.output ?? { markdownPath: "", jsonPath: "", manifestPath: "" }
  const manifestPath = normalizeRelativePath(output.manifestPath, path.join(getPdfOutputDir(userId, documentId), "manifest.json"))
  const markdownPath = normalizeRelativePath(output.markdownPath, path.join(getPdfOutputDir(userId, documentId), "document.md"))
  const jsonPath = normalizeRelativePath(output.jsonPath, path.join(getPdfOutputDir(userId, documentId), "document.json"))
  const successfulEngine = manifest.engineChain.find((item) => item.status === "success")?.engine ?? ""

  await prisma.$transaction(async (tx) => {
    await tx.pdfChunk.deleteMany({ where: { documentId } })
    await tx.pdfDocument.update({
      where: { id: documentId },
      data: {
        status: PDF_PARSE_STATUS.completed,
        engine: successfulEngine,
        parserVersion: "local-hybrid-v1",
        pageCount: manifest.stats.pages,
        markdownPath,
        manifestPath,
        jsonPath,
        textChars: manifest.stats.characters,
        tableCount: manifest.stats.tables,
        formulaCount: manifest.stats.formulas,
        imageCount: manifest.stats.images,
        ocrPageCount: manifest.stats.ocrPages,
        warningsJson: asInputJson(manifest.warnings),
        errorMessage: "",
        completedAt: new Date(),
      },
    })

    if (manifest.chunks.length > 0) {
      await tx.pdfChunk.createMany({
        data: manifest.chunks.map((chunk, index) => ({
          documentId,
          userId,
          chunkIndex: index,
          kind: chunk.kind || "text",
          heading: chunk.heading || "",
          pageStart: Math.max(1, chunk.pageStart || 1),
          pageEnd: Math.max(chunk.pageStart || 1, chunk.pageEnd || chunk.pageStart || 1),
          content: chunk.content || "",
          tokenEstimate: estimateTokens(chunk.content || ""),
          metadataJson: asInputJson({
            chunkId: chunk.chunkId,
            ...chunk.metadata,
          }),
        })),
      })
    }
  })
}

export async function listPdfDocumentsForUser(userId: string, options: { limit?: number, conversationId?: string } = {}) {
  const documents = await prisma.pdfDocument.findMany({
    where: { userId, ...conversationDocumentFilter(options.conversationId) },
    orderBy: { updatedAt: "desc" },
    take: clampLimit(options.limit, 50, 100),
    include: {
      upload: {
        select: {
          originalName: true,
          mimeType: true,
          size: true,
        },
      },
    },
  })

  return documents.map(toDocumentSummary)
}

export async function getPdfDocumentForUser(userId: string, documentId: string, options: { conversationId?: string } = {}) {
  const document = await prisma.pdfDocument.findFirst({
    where: { id: documentId, userId, ...conversationDocumentFilter(options.conversationId) },
    include: {
      upload: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          url: true,
        },
      },
    },
  })
  if (!document) return null
  return {
    ...toDocumentSummary(document),
    url: document.upload.url,
    quality: document.quality,
    completedAt: document.completedAt?.toISOString() ?? null,
    startedAt: document.startedAt?.toISOString() ?? null,
  }
}

export async function parsePdfDocumentForUser(userId: string, documentId: string, options: { force?: boolean } = {}) {
  const document = await prisma.pdfDocument.findFirst({
    where: { id: documentId, userId },
    include: { upload: true },
  })
  if (!document) return null
  if (document.status === PDF_PARSE_STATUS.processing) return getPdfDocumentForUser(userId, documentId)
  if (document.status === PDF_PARSE_STATUS.completed && !options.force) return getPdfDocumentForUser(userId, documentId)
  if (document.upload.kind !== "pdf") throw new Error("NOT_A_PDF_UPLOAD")
  if (document.upload.size > 50 * 1024 * 1024) throw new Error("PDF_TOO_LARGE")

  const inputPath = resolveUploadDiskPath(document.upload)
  const outputDir = getPdfOutputDir(userId, document.id)
  await mkdir(outputDir, { recursive: true })
  await prisma.pdfDocument.update({
    where: { id: document.id },
    data: {
      status: PDF_PARSE_STATUS.processing,
      quality: PDF_PARSE_QUALITY,
      startedAt: new Date(),
      completedAt: null,
      errorMessage: "",
    },
  })

  try {
    await runPdfParser({ inputPath, outputDir, quality: PDF_PARSE_QUALITY })
    const manifestPath = path.join(outputDir, "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PdfParseManifest
    if (manifest.stats.pages > PDF_MAX_PAGES) {
      throw new Error(`PDF page count ${manifest.stats.pages} exceeds limit ${PDF_MAX_PAGES}`)
    }
    await persistManifest(document.id, userId, manifest)
  } catch (error) {
    // Log full detail (traceback, paths, line numbers) server-side only.
    console.error(`[pdf] parse failed for document ${document.id}:`, error)
    await prisma.pdfChunk.deleteMany({ where: { documentId: document.id } })
    await prisma.pdfDocument.update({
      where: { id: document.id },
      data: {
        status: PDF_PARSE_STATUS.failed,
        errorMessage: sanitizePdfErrorMessage(error),
        completedAt: new Date(),
      },
    })
  }

  return getPdfDocumentForUser(userId, documentId)
}

// Tracks documents whose parse was already kicked off in this process so a
// burst of requests does not spawn duplicate Python runs for the same file.
const inFlightParses = new Set<string>()

// Start parsing in the background and return immediately. This keeps upload and
// chat requests fast: the Python pipeline can take seconds to minutes, so it
// must never run inline in the request/response path.
export async function enqueuePdfParse(userId: string, documentId: string, options: { force?: boolean } = {}) {
  const document = await prisma.pdfDocument.findFirst({
    where: { id: documentId, userId },
    include: { upload: { select: { originalName: true, mimeType: true, size: true } } },
  })
  if (!document) return null
  if (document.status === PDF_PARSE_STATUS.completed && !options.force) return toDocumentSummary(document)
  if (document.status === PDF_PARSE_STATUS.processing || inFlightParses.has(documentId)) {
    return toDocumentSummary(document)
  }

  inFlightParses.add(documentId)
  void parsePdfDocumentForUser(userId, documentId, options)
    .catch((error) => console.error(`[pdf] background parse failed for ${documentId}:`, error))
    .finally(() => inFlightParses.delete(documentId))

  return { ...toDocumentSummary(document), status: PDF_PARSE_STATUS.processing }
}

// Remove parsed outputs (markdown/json/manifest) from disk. Chunks and the
// PdfDocument row are removed by the Upload cascade; this clears the on-disk
// artifacts that the cascade cannot reach.
export async function deletePdfArtifactsForUpload(userId: string, uploadId: string) {
  const document = await prisma.pdfDocument.findFirst({
    where: { uploadId, userId },
    select: { id: true },
  })
  if (!document) return
  await rm(getPdfOutputDir(userId, document.id), { recursive: true, force: true }).catch((error) => {
    console.error(`[pdf] failed to remove artifacts for document ${document.id}:`, error)
  })
}

export async function getPdfDocumentContentForUser(
  userId: string,
  documentId: string,
  options: { query?: string, limit?: number, conversationId?: string } = {},
) {
  const document = await prisma.pdfDocument.findFirst({
    where: { id: documentId, userId, ...conversationDocumentFilter(options.conversationId) },
    include: { upload: { select: { originalName: true, mimeType: true, size: true } } },
  })
  if (!document) return null

  const limit = clampLimit(options.limit, options.query ? 10 : 30, 100)
  const query = options.query?.trim()
  const chunkWhere: Prisma.PdfChunkWhereInput = {
    documentId,
    userId,
    ...(query
      ? {
          OR: [
            { content: { contains: query, mode: "insensitive" } },
            { heading: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  }
  let chunks = await prisma.pdfChunk.findMany({
    where: chunkWhere,
    orderBy: [{ pageStart: "asc" }, { chunkIndex: "asc" }],
    take: limit,
  })

  if (query && chunks.length === 0) {
    const terms = query.split(/\s+/).filter((term) => term.length >= 2).slice(0, 6)
    if (terms.length > 0) {
      chunks = await prisma.pdfChunk.findMany({
        where: {
          documentId,
          userId,
          OR: terms.flatMap((term) => [
            { content: { contains: term, mode: "insensitive" as const } },
            { heading: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        orderBy: [{ pageStart: "asc" }, { chunkIndex: "asc" }],
        take: limit,
      })
    }
  }

  const manifest = await readManifest(document.manifestPath)
  return {
    document: toDocumentSummary(document),
    outline: manifest?.outline ?? [],
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      kind: chunk.kind,
      heading: chunk.heading,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      pageLabel: pageRange(chunk.pageStart, chunk.pageEnd),
      content: chunk.content,
    })),
    warnings: manifest?.warnings ?? [],
  }
}

export async function searchPdfDocumentsForUser(userId: string, query: string, options: { documentId?: string, limit?: number, conversationId?: string } = {}) {
  const cleanedQuery = query.trim()
  if (!cleanedQuery) return []
  const limit = clampLimit(options.limit, 10, 30)
  const rows = await prisma.pdfChunk.findMany({
    where: {
      userId,
      ...(options.documentId ? { documentId: options.documentId } : {}),
      document: { status: PDF_PARSE_STATUS.completed, ...conversationDocumentFilter(options.conversationId) },
      OR: [
        { content: { contains: cleanedQuery, mode: "insensitive" } },
        { heading: { contains: cleanedQuery, mode: "insensitive" } },
        { document: { title: { contains: cleanedQuery, mode: "insensitive" } } },
        { document: { upload: { originalName: { contains: cleanedQuery, mode: "insensitive" } } } },
      ],
    },
    orderBy: [{ documentId: "asc" }, { pageStart: "asc" }, { chunkIndex: "asc" }],
    take: limit,
    include: {
      document: {
        include: {
          upload: {
            select: {
              originalName: true,
              mimeType: true,
              size: true,
            },
          },
        },
      },
    },
  })

  return rows.map((row) => ({
    document: toDocumentSummary(row.document),
    chunk: {
      id: row.id,
      chunkIndex: row.chunkIndex,
      kind: row.kind,
      heading: row.heading,
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
      pageLabel: pageRange(row.pageStart, row.pageEnd),
      content: row.content,
    },
  }))
}

export async function buildPdfAttachmentContext(userId: string, attachments: RuntimePdfAttachment[], prompt: string) {
  const pdfAttachments = attachments.filter((attachment) => attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.originalName))
  if (pdfAttachments.length === 0) return ""

  const sections: string[] = []
  let usedChars = 0
  for (const attachment of pdfAttachments) {
    if (!attachment.uploadId) {
      sections.push(`[PDF attachment skipped] ${attachment.originalName}: missing upload id.`)
      continue
    }

    const document = await prisma.pdfDocument.findFirst({
      where: { uploadId: attachment.uploadId, userId },
      include: { upload: { select: { originalName: true, mimeType: true, size: true } } },
    })
    if (!document) {
      sections.push(`[PDF attachment skipped] ${attachment.originalName}: no parsed document record.`)
      continue
    }

    // Never parse inline: kick off a background parse if needed and tell the
    // model the file is not ready yet. This keeps the chat request fast.
    if (document.status !== PDF_PARSE_STATUS.completed) {
      if (document.status === PDF_PARSE_STATUS.queued) {
        void enqueuePdfParse(userId, document.id)
      }
      const note = document.status === PDF_PARSE_STATUS.failed
        ? `《${document.upload.originalName}》解析失败，暂时无法读取该 PDF 的内容。`
        : `《${document.upload.originalName}》正在解析中，请告知用户稍候再询问该文件的内容。`
      sections.push(`[PDF 状态] ${note}`)
      continue
    }

    const current = document
    const matches = await searchPdfDocumentsForUser(userId, prompt, { documentId: current.id, limit: 8 })
    const fallback = matches.length > 0
      ? matches
      : (await getPdfDocumentContentForUser(userId, current.id, { limit: 8 }))?.chunks.map((chunk) => ({
          document: toDocumentSummary(current),
          chunk,
        })) ?? []

    for (const item of fallback) {
      const header = `[PDF: ${current.upload.originalName} | ${item.chunk.pageLabel} | ${item.chunk.kind}${item.chunk.heading ? ` | ${item.chunk.heading}` : ""}]`
      const body = `${header}\n${item.chunk.content.trim()}`
      if (usedChars + body.length > PDF_CONTEXT_MAX_CHARS) break
      sections.push(body)
      usedChars += body.length
    }
  }

  if (sections.length === 0) return ""
  return [
    "[PDF attachment context]",
    "Use these excerpts when answering. Cite pages with the page labels provided, for example (filename, p.3). Do not claim unsupported PDF details.",
    ...sections,
  ].join("\n\n")
}
