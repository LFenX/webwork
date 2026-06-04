import "server-only"
import { DEFAULT_PALETTE, LATEX_PALETTE_IDS } from "@/lib/latex/palettes"

export type LatexFontSize = 10 | 11 | 12
export type LatexMargin = "narrow" | "normal" | "wide"
export type LatexLineSpacing = "compact" | "normal" | "relaxed"
// CJK main-font override. "auto" keeps the theme's font; others swap just the
// main CJK font (sans/mono stay the theme's), for variety without changing theme.
export type LatexCjkFont = "auto" | "songti" | "heiti" | "kaiti" | "fangsong" | "dengxian" | "yahei" | "shsong" | "shhei"
export type LatexParagraphStyle = "indent" | "spaced"
export type LatexPaperSize = "a4" | "letter"

// Per-conversation document configuration shared by the template modal and the
// AI tools. Drives how a template is rendered (palette, layout toggles, density,
// document info). The body content is supplied separately at compile time.
export type LatexDocConfig = {
  templateId: string
  // Visual theme — owns fonts, heading typography, cover and component styling.
  // Orthogonal to templateId (the content type): the same content can be
  // rendered under any theme. See lib/latex/themes.ts.
  theme: string
  palette: string
  cover: boolean
  toc: boolean
  headerFooter: boolean
  fontSize: LatexFontSize
  margin: LatexMargin
  lineSpacing: LatexLineSpacing
  cjkFont: LatexCjkFont
  paragraphStyle: LatexParagraphStyle
  paperSize: LatexPaperSize
  title: string
  subtitle: string
  author: string
  date: string
}

// Keep templateId/theme in sync with the registries (templates.ts / themes.ts).
export const DEFAULT_DOC_CONFIG: LatexDocConfig = {
  templateId: "academic-paper",
  theme: "academic-classic",
  palette: DEFAULT_PALETTE,
  cover: false,
  toc: true,
  headerFooter: true,
  fontSize: 11,
  margin: "normal",
  lineSpacing: "normal",
  cjkFont: "auto",
  paragraphStyle: "indent",
  paperSize: "a4",
  title: "",
  subtitle: "",
  author: "",
  date: "",
}

const FONT_SIZES: LatexFontSize[] = [10, 11, 12]
const MARGINS: LatexMargin[] = ["narrow", "normal", "wide"]
const SPACINGS: LatexLineSpacing[] = ["compact", "normal", "relaxed"]
const CJK_FONTS: LatexCjkFont[] = ["auto", "songti", "heiti", "kaiti", "fangsong", "dengxian", "yahei", "shsong", "shhei"]
const PARAGRAPH_STYLES: LatexParagraphStyle[] = ["indent", "spaced"]
const PAPER_SIZES: LatexPaperSize[] = ["a4", "letter"]

function str(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback
}

// Validate/clamp an arbitrary object (from the DB, API, or a tool) into a safe
// LatexDocConfig, falling back to `base` for any missing/invalid field.
// templateId is NOT checked against the template registry here (avoids a cyclic
// import); callers validate it via getLatexTemplate.
export function normalizeDocConfig(raw: unknown, base: LatexDocConfig = DEFAULT_DOC_CONFIG): LatexDocConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    templateId: typeof r.templateId === "string" && r.templateId.trim() ? r.templateId.trim() : base.templateId,
    theme: typeof r.theme === "string" && r.theme.trim() ? r.theme.trim() : base.theme,
    palette: typeof r.palette === "string" && LATEX_PALETTE_IDS.includes(r.palette) ? r.palette : base.palette,
    cover: typeof r.cover === "boolean" ? r.cover : base.cover,
    toc: typeof r.toc === "boolean" ? r.toc : base.toc,
    headerFooter: typeof r.headerFooter === "boolean" ? r.headerFooter : base.headerFooter,
    fontSize: FONT_SIZES.includes(Number(r.fontSize) as LatexFontSize) ? (Number(r.fontSize) as LatexFontSize) : base.fontSize,
    margin: MARGINS.includes(r.margin as LatexMargin) ? (r.margin as LatexMargin) : base.margin,
    lineSpacing: SPACINGS.includes(r.lineSpacing as LatexLineSpacing) ? (r.lineSpacing as LatexLineSpacing) : base.lineSpacing,
    cjkFont: CJK_FONTS.includes(r.cjkFont as LatexCjkFont) ? (r.cjkFont as LatexCjkFont) : base.cjkFont,
    paragraphStyle: PARAGRAPH_STYLES.includes(r.paragraphStyle as LatexParagraphStyle) ? (r.paragraphStyle as LatexParagraphStyle) : base.paragraphStyle,
    paperSize: PAPER_SIZES.includes(r.paperSize as LatexPaperSize) ? (r.paperSize as LatexPaperSize) : base.paperSize,
    title: str(r.title, 200, base.title),
    subtitle: str(r.subtitle, 200, base.subtitle),
    author: str(r.author, 120, base.author),
    date: str(r.date, 60, base.date),
  }
}
