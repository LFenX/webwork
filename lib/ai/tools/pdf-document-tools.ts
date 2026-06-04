import "server-only"
import {
  getPdfDocumentContentForUser,
  getPdfDocumentForUser,
  listPdfDocumentsForUser,
  searchPdfDocumentsForUser,
} from "@/lib/pdf/service"
import { toolGranted, toolNotFound } from "@/lib/ai/tools/helpers"

export const listMyPdfDocumentsTool = {
  name: "list_my_pdf_documents",
  title: "List PDF attachments in this chat",
  description: "List the PDF files the user attached in the current conversation and their parse status.",
  inputSchemaSummary: "limit?: number",
  sensitivity: "medium" as const,
  auditLabel: "list_self_pdf_documents",
  whenToUse: "Use when the user asks which PDFs they attached in this chat or needs parse status for them.",
  whenNotToUse: "Do not use for image understanding, PDF generation, or PDFs from other conversations.",
  argumentHints: ["limit defaults to 50"],
  returns: "PDF document summaries (current conversation only) with status, engine, and page count.",
  parameterSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, limit }: { userId: string, conversationId?: string, limit?: number }) => {
    const documents = await listPdfDocumentsForUser(userId, { limit, conversationId })
    return toolGranted(`Found ${documents.length} PDF documents.`, { documents })
  },
}

export const getPdfParseStatusTool = {
  name: "get_pdf_parse_status",
  title: "Get PDF parse status",
  description: "Read parse status and metadata for one of the current user's PDF documents.",
  inputSchemaSummary: "documentId: string",
  sensitivity: "medium" as const,
  auditLabel: "read_self_pdf_parse_status",
  whenToUse: "Use when the user asks whether a PDF is parsed, failed, still processing, or which engine was used.",
  whenNotToUse: "Do not use when the user needs actual PDF content; use read_my_pdf_document or search_my_pdf_documents.",
  argumentHints: ["documentId is required"],
  returns: "Status, engine, page count, and parse stats.",
  parameterSchema: {
    type: "object",
    properties: {
      documentId: { type: "string" },
    },
    required: ["documentId"],
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, documentId }: { userId: string, conversationId?: string, documentId: string }) => {
    const document = await getPdfDocumentForUser(userId, documentId, { conversationId })
    if (!document) return toolNotFound("PDF document not found.", "No PDF attached in this conversation has that id.")
    return toolGranted(`PDF status is ${document.status}.`, { document })
  },
}

export const readMyPdfDocumentTool = {
  name: "read_my_pdf_document",
  title: "Read my PDF document",
  description: "Read parsed PDF chunks, outline, warnings, and page references from one current-user PDF.",
  inputSchemaSummary: "documentId: string, query?: string, limit?: number",
  sensitivity: "high" as const,
  auditLabel: "read_self_pdf_document_content",
  whenToUse: "Use when the user asks about the content of a specific PDF attached in this chat, or asks to summarize/read a PDF attachment.",
  whenNotToUse: "Do not use for PDFs from other conversations or for PDF generation/editing.",
  argumentHints: ["query narrows chunks", "limit controls returned chunks"],
  returns: "Document metadata, outline, warnings, and page-scoped chunks. Cite pages, e.g. (filename, p.3).",
  parameterSchema: {
    type: "object",
    properties: {
      documentId: { type: "string" },
      query: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    required: ["documentId"],
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, documentId, query, limit }: { userId: string, conversationId?: string, documentId: string, query?: string, limit?: number }) => {
    const content = await getPdfDocumentContentForUser(userId, documentId, { query, limit, conversationId })
    if (!content) return toolNotFound("PDF document not found.", "No PDF attached in this conversation has that id.")
    return toolGranted(`Read ${content.chunks.length} PDF chunks.`, content)
  },
}

export const searchMyPdfDocumentsTool = {
  name: "search_my_pdf_documents",
  title: "Search PDF attachments in this chat",
  description: "Search parsed chunks across the PDFs attached in the current conversation.",
  inputSchemaSummary: "query: string, documentId?: string, limit?: number",
  sensitivity: "high" as const,
  auditLabel: "search_self_pdf_documents",
  whenToUse: "Use when the user asks a question about a PDF they attached in this chat and a keyword/query should retrieve relevant pages.",
  whenNotToUse: "Do not use for web search, non-PDF private data, or PDFs from other conversations.",
  argumentHints: ["query is required", "documentId optionally narrows to one PDF"],
  returns: "Matching PDF chunks (current conversation only) with document metadata and page labels.",
  parameterSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      documentId: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 30 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute: async ({ userId, conversationId, query, documentId, limit }: { userId: string, conversationId?: string, query: string, documentId?: string, limit?: number }) => {
    const matches = await searchPdfDocumentsForUser(userId, query, { documentId, limit, conversationId })
    return toolGranted(`Found ${matches.length} PDF matches.`, { matches })
  },
}
