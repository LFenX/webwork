export const PDF_PARSE_STATUS = {
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed",
} as const

export type PdfParseStatus = (typeof PDF_PARSE_STATUS)[keyof typeof PDF_PARSE_STATUS]

export type PdfChunkKind = "text" | "table" | "formula" | "image" | "heading"

export type PdfParseManifest = {
  source: {
    filename: string
    size: number
    sha256: string
    mimeType: string
  }
  engineChain: Array<{
    engine: string
    status: "success" | "failed" | "skipped"
    elapsedMs: number
    error?: string
    warnings?: string[]
  }>
  stats: {
    pages: number
    characters: number
    tables: number
    formulas: number
    images: number
    ocrPages: number
  }
  outline: Array<{
    title: string
    level: number
    page: number
  }>
  chunks: Array<{
    chunkId: string
    pageStart: number
    pageEnd: number
    kind: PdfChunkKind
    heading: string
    content: string
    metadata?: Record<string, unknown>
  }>
  warnings: string[]
  output: {
    markdownPath: string
    jsonPath: string
    manifestPath: string
  }
}

export type PdfDocumentSummary = {
  id: string
  uploadId: string
  filename: string
  mimeType: string
  size: number
  status: string
  engine: string
  pageCount: number
  textChars: number
  tableCount: number
  formulaCount: number
  ocrPageCount: number
  errorMessage: string
  createdAt: string
  updatedAt: string
}
