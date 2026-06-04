import "server-only"
import { existsSync } from "node:fs"
import path from "node:path"
import { getPalette, type LatexPalette } from "@/lib/latex/palettes"
import { COMPONENT_GUIDE, COMPONENT_PREAMBLE, COMPONENT_STYLE_DEFAULTS } from "@/lib/latex/components"
import { DEFAULT_DOC_CONFIG, type LatexDocConfig } from "@/lib/latex/config-schema"
import { getLatexTheme, DEFAULT_LATEX_THEME } from "@/lib/latex/themes"
import { escapeLatex, headerLabel } from "@/lib/latex/escape"

// Content-type templates. A template owns WHAT a document is — its default layout
// toggles, body guide, sample, and a suggested visual theme — while the THEME
// (lib/latex/themes.ts) owns HOW it looks (fonts, headings, cover, component
// styling). The shared LatexDocConfig drives palette, toggles, density and info.
// The AI only authors the body using the documented components.

export type LatexTemplate = {
  id: string
  name: string
  description: string
  defaults: Partial<LatexDocConfig>
  bodyGuide: string
  sampleBody: string
  extraPreamble?: string
}

const MARGIN_CM: Record<string, string> = { narrow: "1.8cm", normal: "2.4cm", wide: "3cm" }
const STRETCH: Record<string, string> = { compact: "1.0", normal: "1.15", relaxed: "1.4" }

// Base preamble shared by every theme: document class, packages, palette colors,
// listings/code, link styling, density, the default component styles, and the
// header/footer. Fonts, heading typography, cover and the component SHAPE come
// from the theme (composed after this in renderLatexDocument).
// Map a cjkFont config value to an installed font family name; "auto" (or any
// unknown value) returns null, meaning "keep the theme's font".
const CJK_FONT_MAP: Record<string, string> = {
  songti: "STSong",
  heiti: "SimHei",
  kaiti: "KaiTi",
  fangsong: "FangSong",
  dengxian: "DengXian",
  yahei: "Microsoft YaHei",
}

// Source Han (思源 / Noto CJK) static OTFs with real weights, loaded by absolute
// path so they need no system install and embed reliably (the system-installed
// copies are variable fonts that xdvipdfmx can't embed). When present they are
// the premium default for generic serif/sans themes and the shsong/shhei options;
// when absent everything falls back to system fonts, so rendering never breaks.
const FONT_DIR = path.join(process.cwd(), "storage", "fonts")
const FONT_PATH = `${FONT_DIR.replace(/\\/g, "/")}/`

function sourceHanAvailable(): boolean {
  return existsSync(path.join(FONT_DIR, "NotoSansSC-Regular.otf"))
    && existsSync(path.join(FONT_DIR, "NotoSerifSC-Regular.otf"))
}
const sourceHanSerifDecl = () =>
  `\\setCJKmainfont{NotoSerifSC-Regular.otf}[Path=${FONT_PATH},BoldFont=NotoSerifSC-Bold.otf,AutoFakeBold=false]`
const sourceHanSansDecl = () =>
  `\\setCJKmainfont{NotoSansSC-Regular.otf}[Path=${FONT_PATH},BoldFont=NotoSansSC-Bold.otf,AutoFakeBold=false]`

// Resolve the CJK main-font declaration: an explicit user choice always wins;
// otherwise a generic serif/sans theme is upgraded to Source Han when available.
// Returns "" to keep whatever font the theme already set.
function resolveCjkFont(cjkFont: string, themeCjk: "serif" | "sans" | undefined): string {
  if (cjkFont === "shsong") return sourceHanAvailable() ? sourceHanSerifDecl() : "\\setCJKmainfont{STSong}"
  if (cjkFont === "shhei") return sourceHanAvailable() ? sourceHanSansDecl() : "\\setCJKmainfont{Microsoft YaHei}"
  if (cjkFont !== "auto") {
    const fam = CJK_FONT_MAP[cjkFont]
    return fam ? `\\setCJKmainfont{${fam}}` : ""
  }
  if (themeCjk === "serif" && sourceHanAvailable()) return sourceHanSerifDecl()
  if (themeCjk === "sans" && sourceHanAvailable()) return sourceHanSansDecl()
  return ""
}

function buildPreamble(palette: LatexPalette, config: LatexDocConfig): string {
  const paperOption = config.paperSize === "letter" ? "letterpaper" : "a4paper"
  const paragraph = config.paragraphStyle === "spaced"
    ? "\\setlength{\\parindent}{0pt}\\setlength{\\parskip}{0.55em plus 2pt}"
    : "\\setlength{\\parindent}{2em}\\setlength{\\parskip}{0pt}"
  const lines = [
    `\\documentclass[UTF8,${paperOption},${config.fontSize}pt]{ctexart}`,
    `\\usepackage[margin=${MARGIN_CM[config.margin] ?? "2.4cm"},headheight=15pt]{geometry}`,
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage[table,dvipsnames]{xcolor}",
    "\\usepackage{booktabs}",
    "\\usepackage{array}",
    "\\usepackage{enumitem}",
    "\\usepackage{multicol}",
    "\\usepackage{setspace}",
    "\\usepackage{lettrine}",
    "\\usepackage{fontawesome5}",
    "\\usepackage[most]{tcolorbox}",
    "\\tcbuselibrary{listings,skins,breakable}",
    "\\usepackage{listings}",
    "\\usepackage{tabularray}",
    "\\UseTblrLibrary{booktabs}",
    "\\usepackage{caption}",
    "\\usepackage{titlesec}",
    "\\usepackage{tocloft}",
    "\\usepackage{fancyhdr}",
    "\\usepackage{lastpage}",
    "\\usepackage{hyperref}",
    // Subliminal micro-typography: character protrusion gives justified text an
    // optically aligned right edge (XeTeX supports protrusion, not expansion).
    "\\usepackage[protrusion=true,expansion=false,final]{microtype}",
    `\\definecolor{accent}{HTML}{${palette.accent}}`,
    `\\definecolor{accentdark}{HTML}{${palette.accentDark}}`,
    `\\definecolor{accentsoft}{HTML}{${palette.accentSoft}}`,
    "\\definecolor{codebg}{gray}{0.965}",
    "\\hypersetup{colorlinks=true,linkcolor=accent,urlcolor=accent,citecolor=accent,linktoc=all,bookmarksnumbered=true}",
    // PDF document properties (shown in the reader's Properties panel).
    `\\hypersetup{pdftitle={${escapeLatex(config.title.trim() || "文档")}},pdfauthor={${escapeLatex(config.author.trim())}},pdfcreator={DieLing PDF},pdflang=zh-CN}`,
    "\\lstset{basicstyle=\\footnotesize\\ttfamily,breaklines=true,columns=fullflexible,keepspaces=true,showstringspaces=false}",
    // Premium code card: rounded panel, line-number gutter, and a boxed title tab.
    "\\newtcblisting{code}{breakable,enhanced,colback=codebg,colframe=accent!55,boxrule=0.5pt,arc=3pt,left=9mm,right=2mm,top=2mm,bottom=2mm,listing only,listing options={basicstyle=\\footnotesize\\ttfamily,breaklines=true,numbers=left,numberstyle=\\tiny\\color{black!45},numbersep=7pt,columns=fullflexible,keepspaces=true,showstringspaces=false},title={\\faCode\\ \\ 代码},fonttitle=\\footnotesize\\bfseries,coltitle=white,colbacktitle=accent,attach boxed title to top left={xshift=7mm,yshift=-2.4mm},boxed title style={arc=2pt,boxrule=0pt}}",
    // Airier default tables + styled captions.
    "\\renewcommand{\\arraystretch}{1.25}\\setlength{\\tabcolsep}{8pt}",
    "\\captionsetup{font=small,labelfont={bf,color=accent},labelsep=period,skip=4pt}",
    // Accent-colored list bullets (filled level-1, hollow level-2).
    "\\setlist{itemsep=2pt,topsep=3pt}",
    "\\setlist[itemize,1]{label={\\textcolor{accent}{\\small\\faCircle}},leftmargin=1.6em}",
    "\\setlist[itemize,2]{label={\\textcolor{accent!70}{\\scriptsize\\faCircle[regular]}}}",
    // Styled table of contents: bold accent section entries, dotted leaders on
    // every level, accent page numbers.
    "\\renewcommand{\\cfttoctitlefont}{\\Large\\bfseries\\color{accent}}",
    "\\renewcommand{\\cftsecfont}{\\bfseries\\color{black!85}}",
    "\\renewcommand{\\cftsecpagefont}{\\bfseries\\color{accent!80!black}}",
    "\\renewcommand{\\cftsecleader}{\\color{black!20}\\cftdotfill{\\cftsecdotsep}}",
    "\\renewcommand{\\cftsecdotsep}{\\cftdotsep}",
    "\\renewcommand{\\cftsubsecfont}{\\color{black!70}}",
    "\\renewcommand{\\cftsubsecpagefont}{\\color{black!55}}",
    "\\setlength{\\cftbeforesecskip}{5pt}",
    // CJK refinements: synthesize bold/italic for single-weight fonts (so headings
    // render and an italic CJK run can't trigger an xdvipdfmx abort), and add a
    // small, consistent glue between CJK and Latin/digits (中西文间距).
    "\\xeCJKsetup{AutoFakeBold=2.5,AutoFakeSlant=0.2,CJKecglue={\\hskip 0.16em plus 0.04em minus 0.04em}}",
    // Forbid widows/orphans — no single line stranded at a page top/bottom.
    "\\clubpenalty=10000 \\widowpenalty=10000 \\displaywidowpenalty=10000",
    `\\setstretch{${STRETCH[config.lineSpacing] ?? "1.15"}}`,
    paragraph,
    COMPONENT_STYLE_DEFAULTS,
  ]
  if (config.headerFooter) {
    lines.push(
      "\\pagestyle{fancy}",
      "\\fancyhf{}",
      "\\renewcommand{\\headrule}{\\color{accent}\\hrule height 0.6pt}",
      `\\fancyhead[L]{\\small\\textbf{\\color{accent}${headerLabel(config.title)}}}`,
      "\\fancyhead[R]{\\small\\nouppercase{\\textcolor{black!55}{\\leftmark}}}",
      "\\fancyfoot[C]{\\small\\textcolor{black!55}{第 \\thepage\\ / 共 \\pageref{LastPage} 页}}",
    )
  } else {
    lines.push("\\pagestyle{plain}")
  }
  return lines.join("\n")
}

// A colored table of contents, emitted only when the body actually has sections
// (so a sparse body never produces a blank TOC page). Shared by render and by
// themes whose wrapBody must place the TOC itself (e.g. two-column layouts).
export function tocBlock(config: LatexDocConfig, hasSections: boolean): string {
  // Styling (title/entries/leaders) comes from tocloft in the preamble.
  return config.toc && hasSections ? "\\tableofcontents\n\\clearpage" : ""
}

function bodyHasSections(body: string): boolean {
  return /\\(section|subsection|chapter)\b/.test(body)
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const ABSTRACT_EXTRA =
  "\\newcommand{\\keywords}[1]{\\par\\smallskip\\noindent{\\bfseries\\color{accent}关键词：}#1\\par\\medskip}\n" +
  "\\renewenvironment{abstract}{\\begin{tcolorbox}[enhanced,breakable,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title=摘要,boxrule=0.5pt,arc=2pt]}{\\end{tcolorbox}}"

const SUMMARY_EXTRA =
  "\\newtcolorbox{summary}{enhanced,breakable,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title={\\faNewspaper\\ 摘要},boxrule=0.5pt,arc=2pt}"

const EXAM_EXTRA = "\\newcommand{\\answerspace}[1][2.5cm]{\\par\\vspace{#1}}"

const TEMPLATES: LatexTemplate[] = [
  {
    id: "academic-paper",
    name: "学术论文（默认）",
    description: "专业学术论文：摘要框、关键词、彩色目录与标题、规范图表公式。综合报告首选。",
    defaults: { palette: "royal", cover: false, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    extraPreamble: ABSTRACT_EXTRA,
    bodyGuide: "可选 \\begin{abstract}…\\end{abstract} + \\keywords{…}；正文 \\section/\\subsection。" + COMPONENT_GUIDE,
    sampleBody:
      "\\begin{abstract}本文综合分析了平台运营的关键数据，给出趋势与建议。\\end{abstract}\n\\keywords{数据分析，运营，报告}\n\\section{研究背景}\n\\dropcap{本}文基于全量数据展开分析。关键关系满足 $E=mc^2$。\n\\begin{callout}{核心发现}近 30 天活跃度显著提升。\\end{callout}\n\\section{数据结果}\n\\statcard{65}{投递}\\hfill\\statcard{17}{回复}\\hfill\\statcard{5}{面试}\n\\begin{note}样本来自 2026 年最新统计。\\end{note}",
  },
  {
    id: "modern-report",
    name: "现代报告",
    description: "商务/技术报告：整页封面、指标卡、提示框，适合数据分析与项目汇报。",
    defaults: { palette: "ocean", cover: true, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 \\section 分章，关键指标用 statcard 一行三个，结论用 success / callout。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{概览}\n\\lead{本报告汇总本季度核心经营数据与洞察。}\n\\statcard{65}{总投递}\\hfill\\statcard{26\\%}{回复率}\\hfill\\statcard{5}{面试}\n\\begin{success}[关键结论]投递转化稳步提升，建议聚焦头部渠道。\\end{success}\n\\section{明细}\n\\begin{prettytable}{lrl}渠道 & 占比 & 备注\\\\ Boss直聘 & 86\\% & 主力\\\\ 官网 & 14\\% & 补充\\\\ 社群 & 12\\% & 增长中\\\\\\end{prettytable}\n\\begin{warning}官网渠道回复较慢，需跟进。\\end{warning}",
  },
  {
    id: "knowledge-handbook",
    name: "知识手册 / 资料合集",
    description: "系统化手册：封面、彩色目录、章节、要点卡与信息卡，适合长篇结构化内容。",
    defaults: { palette: "teal", cover: true, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 \\section/\\subsection 组织；要点用 keypoint，信息用 infocard。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{概念总览}\n\\begin{keypoint}{核心定义}知识库是结构化的资料集合。\\end{keypoint}\n\\begin{infocard}{适用场景}错题整理、资料归档、资讯沉淀。\\end{infocard}\n\\subsection{要点}\n\\begin{itemize}\\item 结构清晰\\item 可检索\\item 可追溯来源\\end{itemize}\n\\begin{tip}善用标签与目录提升检索效率。\\end{tip}",
  },
  {
    id: "course-notes",
    name: "学习讲义 / 课程笔记",
    description: "讲义：定义/定理/例题彩色框，彩色目录与标题，条理清晰。",
    defaults: { palette: "indigo", cover: false, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 definition/theorem/example 组织知识点。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{微积分基础}\n\\begin{definition}{导数}函数在某点的瞬时变化率，记作 $f'(x)$。\\end{definition}\n\\begin{theorem}{中值定理}若 $f$ 在 $[a,b]$ 连续，则存在 $\\xi$ 使 $f'(\\xi)=\\frac{f(b)-f(a)}{b-a}$。\\end{theorem}\n\\begin{example}{求导}对 $x^2$ 求导得 $2x$。\\end{example}\n\\begin{note}牢记链式法则。\\end{note}",
  },
  {
    id: "mistake-notebook",
    name: "错题本",
    description: "错题集：每题彩色卡片，含题目/答案/解析/知识点/易错点，可按科目分章。",
    defaults: { palette: "crimson", cover: false, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 \\section 按科目分章；每题用 \\begin{mistake}{错题N：标题} + \\field{字段}{值}。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{数学}\n\\begin{mistake}{错题1：二次函数最值}\n\\field{题目}{求 $f(x)=x^2-4x+1$ 的最小值。}\n\\field{我的答案}{$1$}\n\\field{正确答案}{$-3$}\n\\field{详细解析}{配方得 $(x-2)^2-3$，最小值 $-3$。}\n\\field{易错点}{忘记常数项变化}\n\\end{mistake}\n\\begin{tip}同类题先配方再判断。\\end{tip}",
  },
  {
    id: "info-briefing",
    name: "资讯简报",
    description: "资讯简报：摘要框、要点高亮、来源标注，干净紧凑无目录。",
    defaults: { palette: "amber", cover: false, toc: false, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    extraPreamble: SUMMARY_EXTRA,
    bodyGuide: "文首用 \\begin{summary}…\\end{summary}；要点 itemize；关键结论 \\hl{…}；务必标注来源。" + COMPONENT_GUIDE,
    sampleBody:
      "\\begin{summary}本期聚焦行业动态与关键数据变化。\\end{summary}\n\\section{要闻}\n\\begin{itemize}\\item \\hl{核心事件}：市场周收入创新高。\\item 媒体榜单更新，关注度上升。\\end{itemize}\n\\begin{note}来源：公开行业报告（2026）。\\end{note}",
  },
  {
    id: "cheatsheet",
    name: "速查卡 Cheatsheet",
    description: "多栏密排速查卡：紧凑双栏、小字号、要点框，适合复习与命令速查。",
    defaults: { palette: "emerald", cover: false, toc: false, headerFooter: false, fontSize: 10, margin: "narrow", lineSpacing: "compact" },
    bodyGuide: "用 \\section 小节 + 紧凑 itemize + keypoint，信息密排。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{SQL 速查}\n\\begin{keypoint}{JOIN}INNER/LEFT/RIGHT/FULL。\\end{keypoint}\n\\begin{itemize}\\item \\texttt{WHERE} 行过滤\\item \\texttt{HAVING} 组过滤\\item \\texttt{GROUP BY} 聚合\\end{itemize}\n\\section{窗口函数}\n\\begin{code}\nSELECT id, RANK() OVER(ORDER BY score DESC) FROM t;\n\\end{code}",
  },
  {
    id: "project-proposal",
    name: "方案 / 计划书",
    description: "方案/计划书：封面、时间线里程碑、指标卡与表格，适合提案与规划。",
    defaults: { palette: "royal", cover: true, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 \\section 分章；进度用 \\milestone{日期}{事件}；目标用 statcard；要点 callout。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{项目背景}\n\\lead{本方案旨在提升知识沉淀与复用效率。}\n\\begin{callout}{目标}三个月内完成知识库搭建与试点。\\end{callout}\n\\section{里程碑}\n\\milestone{第 1 月}{需求调研与原型}\n\\milestone{第 2 月}{核心功能开发}\n\\milestone{第 3 月}{试点上线与复盘}\n\\section{预期收益}\n\\statcard{+30\\%}{效率}\\hfill\\statcard{-50\\%}{重复劳动}\\hfill\\statcard{100\\%}{可追溯}",
  },
  {
    id: "meeting-minutes",
    name: "会议纪要",
    description: "会议纪要：议程、决议、行动项清晰分区，适合团队会议记录。",
    defaults: { palette: "graphite", cover: false, toc: false, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 factbox 记录会议信息；议程用 \\section；决议用 success；行动项用 note 或 itemize。" + COMPONENT_GUIDE,
    sampleBody:
      "\\begin{factbox}[会议信息]\n\\fact{时间}{2026-06-04 14:00}\n\\fact{参会}{LFen、蝶灵}\n\\fact{主题}{知识库迭代}\n\\end{factbox}\n\\section{议程与讨论}\n\\begin{itemize}\\item 模板系统升级方案\\item 预览与交互设计\\end{itemize}\n\\begin{success}[决议]采用模板中心 + 双向同步方案。\\end{success}\n\\begin{note}行动项：本周完成核心模板与组件库。\\end{note}",
  },
  {
    id: "exam-paper",
    name: "试卷 / 练习",
    description: "试卷：题号与分值、作答留白，行距宽松，适合出题与练习。",
    defaults: { palette: "graphite", cover: false, toc: false, headerFooter: true, fontSize: 12, margin: "normal", lineSpacing: "relaxed" },
    extraPreamble: EXAM_EXTRA,
    bodyGuide: "用 \\section 分大题；小题用 enumerate；需要作答区时用 \\answerspace[3cm] 留白。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{选择题（每题 5 分）}\n\\begin{enumerate}\\item 下列哪个是质数？ A. 4 \\quad B. 6 \\quad C. 7 \\quad D. 9\\item $2^3=$ ？\\end{enumerate}\n\\section{解答题（10 分）}\n求 $f(x)=x^2-4x+1$ 的最小值，写出过程。\n\\answerspace[3cm]",
  },
  {
    id: "reading-notes",
    name: "读书 / 文献笔记",
    description: "读书与文献笔记：引文块、批注、金句要点，适合精读与摘录。",
    defaults: { palette: "violet", cover: false, toc: true, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "relaxed" },
    bodyGuide: "原文摘录用 \\begin{quotebox}…\\end{quotebox}；批注用 note；金句用 keypoint；概念用 definition。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{第一章 摘录与批注}\n\\begin{quotebox}知识的价值在于被检索与复用。\\end{quotebox}\n\\begin{note}批注：与本项目的知识库理念一致。\\end{note}\n\\begin{keypoint}{金句}结构化是长期复利。\\end{keypoint}\n\\begin{definition}{复利}收益再投入产生的指数增长。\\end{definition}",
  },
  {
    id: "general-document",
    name: "通用文档",
    description: "干净优雅的通用文档：彩色页眉页脚与标题，适合一般正文与说明。",
    defaults: { palette: "graphite", cover: false, toc: false, headerFooter: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
    bodyGuide: "用 \\section/\\subsection 组织正文；重点用 callout / note。" + COMPONENT_GUIDE,
    sampleBody:
      "\\section{简介}\n\\dropcap{这}是一份通用文档示例，排版干净。\n\\begin{callout}{说明}支持公式 $a^2+b^2=c^2$、表格与代码。\\end{callout}\n\\begin{prettytable}{ll}项 & 值\\\\ A & 1\\\\ B & 2\\\\\\end{prettytable}",
  },
]

export const DEFAULT_LATEX_TEMPLATE = TEMPLATES[0].id
export const LATEX_TEMPLATE_IDS = TEMPLATES.map((template) => template.id)

export function getLatexTemplate(id: string): LatexTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id)
}

// Suggested visual theme per content type — the default applied when a type is
// selected. The user/AI can switch theme independently afterwards, so the same
// content type can be rendered under any theme.
const CONTENT_TYPE_THEME: Record<string, string> = {
  "academic-paper": "academic-classic",
  "modern-report": "modern-magazine",
  "knowledge-handbook": "fresh-notebook",
  "course-notes": "fresh-notebook",
  "mistake-notebook": "fresh-notebook",
  "info-briefing": "modern-magazine",
  "cheatsheet": "swiss-minimal",
  "project-proposal": "modern-magazine",
  "meeting-minutes": "swiss-minimal",
  "exam-paper": "academic-classic",
  "reading-notes": "fresh-notebook",
  "general-document": "swiss-minimal",
}

export function templateDefaultTheme(templateId: string): string {
  return CONTENT_TYPE_THEME[templateId] ?? DEFAULT_LATEX_THEME
}

export function listLatexTemplates() {
  return TEMPLATES.map(({ id, name, description, defaults, bodyGuide }) => ({
    id, name, description, defaults, bodyGuide, suggestedTheme: templateDefaultTheme(id),
  }))
}

// Apply a content type's default layout to a config (used when the user/AI
// switches type). Adopts that type's suggested theme too — switching type is a
// deliberate restyle. Document info (title/subtitle/author/date) and an explicit
// palette choice are preserved.
export function applyTemplateDefaults(config: LatexDocConfig, templateId: string): LatexDocConfig {
  const template = getLatexTemplate(templateId)
  if (!template) return { ...config, templateId }
  return {
    ...config,
    ...template.defaults,
    templateId,
    theme: templateDefaultTheme(templateId),
    palette: config.palette || template.defaults.palette || config.palette,
  }
}

// Code blocks are authored with the shell-escape-free `code` environment. Older
// habits (or model training) may still emit `minted`, which is no longer loaded;
// rewrite its delimiters to `code` so those bodies keep compiling. Only the
// begin/end markers are touched — the verbatim content is left untouched.
function normalizeCodeBlocks(body: string): string {
  return body
    .replace(/\\begin\s*\{\s*minted\s*\}\s*(?:\{[^}]*\}|\[[^\]]*\])*/g, "\\begin{code}")
    .replace(/\\end\s*\{\s*minted\s*\}/g, "\\end{code}")
}

export function renderLatexDocument(config: LatexDocConfig, body: string): string | null {
  const template = getLatexTemplate(config.templateId)
  if (!template) return null
  const theme = getLatexTheme(config.theme) ?? getLatexTheme(DEFAULT_LATEX_THEME)
  if (!theme) return null
  const palette = getPalette(config.palette)
  // Preamble order matters: base (default component styles + \dividerline) →
  // components (boxes that reference those styles) → theme (fonts, headings, and
  // the style/divider OVERRIDES) → content-type extras. tcolorbox styles are
  // late-bound, so the theme's overrides win at body-render time.
  // The CJK-font declaration is appended LAST so it wins over the theme's font:
  // it upgrades generic serif/sans themes to Source Han (when available) and
  // applies any explicit user/AI font choice.
  const cjkOverride = resolveCjkFont(config.cjkFont, theme.cjk)
  const preamble = [
    buildPreamble(palette, config),
    COMPONENT_PREAMBLE,
    theme.preamble(config),
    template.extraPreamble ?? "",
    cjkOverride,
  ].filter(Boolean).join("\n")

  const normalized = normalizeCodeBlocks(body)
  const hasSections = bodyHasSections(normalized)
  // Themes with a body wrapper (e.g. two-column) own their own front matter
  // (cover + TOC placed inside the wrapper); others get cover + TOC in normal flow.
  const wrapped = theme.wrapBody ? theme.wrapBody(normalized, config) : normalized
  const front = theme.wrapBody ? "" : [theme.cover(config), tocBlock(config, hasSections)].filter(Boolean).join("\n")
  return `${preamble}\n\\begin{document}\n${front}\n\n${wrapped.trim()}\n\n\\end{document}\n`
}

export function getTemplateSampleBody(templateId: string): string {
  return getLatexTemplate(templateId)?.sampleBody ?? DEFAULT_DOC_CONFIG.title
}
