import "server-only"
import { escapeLatex } from "@/lib/latex/escape"
import type { LatexDocConfig } from "@/lib/latex/config-schema"

// A theme owns a document's VISUAL identity — fonts, heading typography, cover
// design, and the styling of the shared component boxes — independently of the
// content type (templates.ts). The same body renders very differently per theme
// because the components are styled through theme-provided tcolorbox styles
// (themebox / themeadmon / themestat) and the headings via titlesec.
//
// Hard-won rules (see compile tests): never use `\\[len]` inside a centered
// title block (breaks under amsmath — use \par\vspace); statcard must use a
// NON-breakable style (themestat) or the metric chips stack instead of sitting
// in a row; the title page must call \thispagestyle{empty}.

export type LatexTheme = {
  id: string
  name: string
  description: string
  // Generic CJK nature of the theme. When set (and the user hasn't chosen a
  // specific font), the renderer upgrades the body to Source Han Serif/Sans if
  // those premium fonts are installed. Omit for themes whose font IS their
  // identity (e.g. 楷体 notebook, 仿宋 公文), so they keep their character.
  cjk?: "serif" | "sans"
  // Defaults this theme prefers; applied (without clobbering explicit choices)
  // when the theme is selected.
  defaults?: Partial<LatexDocConfig>
  // Preamble fragment: CJK/Latin fonts, heading formats (titlesec), and the
  // tcolorbox style overrides (themebox/themeadmon/themestat) plus \dividerline.
  preamble: (config: LatexDocConfig) => string
  // The title block / cover, honoring config.cover (full cover vs compact head).
  // Must set \thispagestyle{empty} for the first page.
  cover: (config: LatexDocConfig) => string
  // Optional body wrapper (e.g. two columns).
  wrapBody?: (body: string, config: LatexDocConfig) => string
}

// Escaped document-info fields with sensible fallbacks, shared by covers.
function docInfo(config: LatexDocConfig) {
  return {
    title: escapeLatex(config.title.trim() || "未命名文档"),
    subtitle: config.subtitle.trim() ? escapeLatex(config.subtitle.trim()) : "",
    author: config.author.trim() ? escapeLatex(config.author.trim()) : "",
    date: config.date.trim() ? escapeLatex(config.date.trim()) : "\\today",
  }
}

// ───────────────────────── academic-classic ─────────────────────────
const academicClassic: LatexTheme = {
  id: "academic-classic",
  name: "学术经典",
  description: "宋体衬线、规整克制：编号小节配细分隔线、描边方框，适合论文、报告与正式文档。",
  cjk: "serif",
  defaults: { palette: "royal", fontSize: 11, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{STSong}",
    "\\setCJKsansfont{SimHei}",
    "\\setmainfont{TeX Gyre Termes}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{\\thesection}{0.6em}{}[{\\color{accent!35}\\titlerule[0.6pt]}]",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries\\color{accent!85!black}}{\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.4em}{0.7em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,boxrule=0.4pt,arc=0pt,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,boxrule=0.4pt,arc=0pt,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,boxrule=0.4pt,arc=0pt,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{4pt}{\\color{accent!30}\\hrule height 0.6pt}\\vspace{6pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join(" \\quad\\textbar\\quad ")
    if (config.cover) {
      return [
        "\\begin{titlepage}\\thispagestyle{empty}\\centering",
        "\\vspace*{3cm}{\\color{accent}\\hrule height 1.2pt}\\vspace{1cm}",
        `{\\Huge\\bfseries\\color{accent!92!black} ${title}\\par}`,
        subtitle ? `\\vspace{0.6cm}{\\Large\\color{black!60} ${subtitle}\\par}` : "",
        "\\vspace{1cm}{\\color{accent}\\hrule height 0.6pt}",
        "\\vfill",
        meta ? `{\\large\\color{black!55} ${meta}\\par}` : "",
        "\\vspace{2cm}\\end{titlepage}",
      ].filter(Boolean).join("\n")
    }
    return [
      "\\thispagestyle{empty}\\begin{center}",
      `{\\Large\\bfseries\\color{accent!92!black} ${title}\\par}`,
      subtitle ? `\\vspace{4pt}{\\normalsize\\color{black!60} ${subtitle}\\par}` : "",
      meta ? `\\vspace{4pt}{\\small\\color{black!55} ${meta}\\par}` : "",
      "\\end{center}\\vspace{4pt}{\\color{accent}\\hrule height 1pt}\\vspace{12pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── modern-magazine ─────────────────────────
const modernMagazine: LatexTheme = {
  id: "modern-magazine",
  name: "现代杂志",
  description: "无衬线双栏、整幅色块封面与编号色标题、柔和投影卡片，编辑感强，适合报告与简报。",
  cjk: "sans",
  defaults: { palette: "ocean", cover: true, fontSize: 10, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{Microsoft YaHei}",
    "\\setCJKsansfont{Microsoft YaHei}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\Large\\bfseries\\color{accent}}{\\colorbox{accent}{\\color{white}\\bfseries\\,\\thesection\\,}}{0.6em}{}",
    "\\titleformat{\\subsection}{\\large\\bfseries\\color{accent!85!black}}{}{0em}{}",
    "\\titlespacing*{\\section}{0pt}{1.2em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,arc=4pt,boxrule=0pt,drop fuzzy shadow=black!18,left=3.5mm,right=3.5mm,top=2.5mm,bottom=2.5mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,arc=4pt,boxrule=0pt,drop fuzzy shadow=black!12,left=3.5mm,right=3.5mm,top=2.5mm,bottom=2.5mm}}",
    "\\tcbset{themestat/.style={enhanced,arc=4pt,boxrule=0pt,drop fuzzy shadow=black!12,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{4pt}{\\color{accent!30}\\hrule height 1pt}\\vspace{6pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join(" · ")
    // Banner spanning the page width above the two columns.
    const banner = [
      "\\thispagestyle{empty}",
      "\\begin{tcolorbox}[blank,interior style={left color=accentdark,right color=accent},sharp corners,boxsep=0pt,left=6mm,right=6mm,top=5mm,bottom=5mm]",
      `{\\color{white}\\Huge\\bfseries ${title}\\par}`,
      subtitle ? `\\vspace{4pt}{\\color{white!88}\\Large ${subtitle}\\par}` : "",
      meta ? `\\vspace{4pt}{\\color{white!80}\\normalsize ${meta}}` : "",
      "\\end{tcolorbox}\\vspace{0.5cm}",
    ].filter(Boolean).join("\n")
    return banner
  },
  // Two-column body; the banner is injected as the \twocolumn optional argument
  // (full page width above the columns), and the TOC, if any, leads the columns.
  wrapBody: (body, config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join(" · ")
    const banner = [
      "\\thispagestyle{empty}\\vspace*{-0.6cm}",
      "\\begin{tcolorbox}[blank,interior style={left color=accentdark,right color=accent},sharp corners,boxsep=0pt,left=6mm,right=6mm,top=5mm,bottom=5mm]",
      `{\\color{white}\\Huge\\bfseries ${title}\\par}`,
      subtitle ? `\\vspace{4pt}{\\color{white!88}\\Large ${subtitle}\\par}` : "",
      meta ? `\\vspace{4pt}{\\color{white!80}\\normalsize ${meta}}` : "",
      "\\end{tcolorbox}\\vspace{0.5cm}",
    ].filter(Boolean).join("\n")
    const toc = config.toc && /\\(section|subsection|chapter)\b/.test(body)
      ? "{\\small\\tableofcontents}\\medskip\n"
      : ""
    return `\\twocolumn[{${banner}}]\n${toc}${body}`
  },
}

// ───────────────────────── fresh-notebook ─────────────────────────
const freshNotebook: LatexTheme = {
  id: "fresh-notebook",
  name: "清新手账",
  description: "楷体、圆角投影卡片、彩色编号侧标与竖条小节，宽松活泼，适合笔记、手册与读书摘录。",
  defaults: { palette: "teal", fontSize: 12, margin: "normal", lineSpacing: "relaxed" },
  preamble: () => [
    "\\setCJKmainfont{KaiTi}",
    "\\setCJKsansfont{Microsoft YaHei}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{}{0em}{\\colorbox{accent}{\\color{white}\\,\\thesection\\,}\\hspace{0.6em}}",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries\\color{accent!80!black}}{}{0em}{\\color{accent}\\rule[0.1ex]{3pt}{1em}\\hspace{0.5em}}",
    "\\titlespacing*{\\section}{0pt}{1.3em}{0.7em}",
    "\\tcbset{themebox/.style={enhanced,breakable,arc=7pt,boxrule=0pt,drop shadow=accent!25,left=4mm,right=4mm,top=3mm,bottom=3mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,arc=7pt,boxrule=0.8pt,left=4mm,right=4mm,top=3mm,bottom=3mm}}",
    "\\tcbset{themestat/.style={enhanced,arc=7pt,boxrule=0pt,drop shadow=accent!25,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{5pt}{\\color{accent!35}\\hrule height 1pt}\\vspace{7pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join(" · ")
    return [
      "\\thispagestyle{empty}",
      "\\begin{tcolorbox}[colback=accentsoft,colframe=accent,arc=10pt,boxrule=1pt,left=5mm,right=5mm,top=5mm,bottom=5mm]\\begin{center}",
      `{\\huge\\bfseries\\color{accent!90!black} ${title}\\par}`,
      subtitle ? `\\vspace{5pt}{\\large\\color{black!60} ${subtitle}\\par}` : "",
      meta ? `\\vspace{5pt}{\\color{black!55} ${meta}\\par}` : "",
      "\\end{center}\\end{tcolorbox}\\vspace{10pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── swiss-minimal ─────────────────────────
const swissMinimal: LatexTheme = {
  id: "swiss-minimal",
  name: "瑞士极简",
  description: "等线无衬线、留白充足、零修饰描边：左对齐细体标题、扁平细框，干净现代，适合说明与通用文档。",
  cjk: "sans",
  defaults: { palette: "graphite", cover: false, fontSize: 11, margin: "wide", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{DengXian}",
    "\\setCJKsansfont{DengXian}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\large\\bfseries\\color{black!85}}{\\color{accent}\\thesection}{0.6em}{}",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries\\color{black!70}}{\\color{accent}\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.6em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.6pt,colframe=accent!55,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0pt,borderline west={2.5pt}{0pt}{accent},left=3.5mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,arc=0pt,boxrule=0.6pt,colframe=accent!55,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{6pt}{\\color{black!15}\\hrule height 0.5pt}\\vspace{8pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("  /  ")
    if (config.cover) {
      return [
        "\\begin{titlepage}\\thispagestyle{empty}\\noindent",
        "\\vspace*{4cm}",
        `{\\Huge\\bfseries\\color{black!88} ${title}\\par}`,
        subtitle ? `\\vspace{0.5cm}{\\Large\\color{black!55} ${subtitle}\\par}` : "",
        "\\vspace{0.6cm}{\\color{accent}\\rule{4cm}{2pt}}",
        "\\vfill",
        meta ? `\\noindent{\\normalsize\\color{black!50} ${meta}\\par}` : "",
        "\\vspace{2cm}\\end{titlepage}",
      ].filter(Boolean).join("\n")
    }
    return [
      "\\thispagestyle{empty}\\noindent",
      `{\\LARGE\\bfseries\\color{black!88} ${title}\\par}`,
      subtitle ? `\\vspace{3pt}\\noindent{\\normalsize\\color{black!55} ${subtitle}\\par}` : "",
      meta ? `\\vspace{3pt}\\noindent{\\small\\color{black!50} ${meta}\\par}` : "",
      "\\vspace{5pt}\\noindent{\\color{accent}\\rule{3cm}{2pt}}\\vspace{12pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── dark-spotlight ─────────────────────────
const darkSpotlight: LatexTheme = {
  id: "dark-spotlight",
  name: "暗色聚光",
  description: "整版深色封面、深色胶囊编号与粗强调线，白底正文高对比，发布与演示感强，适合报告、提案与简报。",
  cjk: "sans",
  defaults: { palette: "ocean", cover: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{Microsoft YaHei}",
    "\\setCJKsansfont{Microsoft YaHei}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\Large\\bfseries\\color{accentdark}}{\\colorbox{accentdark}{\\color{white}\\,\\thesection\\,}}{0.6em}{}[{\\color{accent}\\titlerule[2pt]}]",
    "\\titleformat{\\subsection}{\\large\\bfseries\\color{accent!85!black}}{\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.3em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,arc=2pt,boxrule=0pt,drop fuzzy shadow=black!20,left=3.5mm,right=3.5mm,top=2.5mm,bottom=2.5mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,arc=2pt,boxrule=0pt,borderline west={3pt}{0pt}{accentdark},left=3.5mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,arc=2pt,boxrule=0pt,drop fuzzy shadow=black!18,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{4pt}{\\color{accentdark}\\hrule height 1.4pt}\\vspace{6pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("  ·  ")
    if (config.cover) {
      return [
        "\\begin{titlepage}\\thispagestyle{empty}",
        "\\begin{tikzpicture}[remember picture,overlay]\\shade[top color=accentdark,bottom color=accent!85](current page.south west)rectangle(current page.north east);\\fill[white,opacity=0.85]([yshift=4.2cm]current page.west)rectangle([yshift=4.16cm]current page.east);\\end{tikzpicture}",
        "\\color{white}\\vspace*{0.34\\paperheight}\\noindent",
        `{\\fontsize{32}{38}\\selectfont\\bfseries ${title}\\par}`,
        subtitle ? `\\vspace{0.7cm}\\noindent{\\Large\\color{white!82} ${subtitle}\\par}` : "",
        "\\vfill",
        meta ? `\\noindent{\\color{white!75} ${meta}\\par}` : "",
        "\\vspace{1.6cm}\\end{titlepage}",
      ].filter(Boolean).join("\n")
    }
    return [
      "\\thispagestyle{empty}",
      "\\begin{tcolorbox}[colback=accentdark,colframe=accentdark,sharp corners,boxrule=0pt,left=6mm,right=6mm,top=5mm,bottom=5mm]",
      `{\\color{white}\\Huge\\bfseries ${title}\\par}`,
      subtitle ? `\\vspace{4pt}{\\color{white!82}\\Large ${subtitle}\\par}` : "",
      meta ? `\\vspace{4pt}{\\color{white!75}\\normalsize ${meta}}` : "",
      "\\end{tcolorbox}\\vspace{10pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── editorial-serif ─────────────────────────
const editorialSerif: LatexTheme = {
  id: "editorial-serif",
  name: "编辑杂志",
  description: "衬线大字、宽留白、居中带细线标题与圆点分隔，杂志专栏感，适合长文、随笔与深度报道。",
  cjk: "serif",
  defaults: { palette: "crimson", cover: false, fontSize: 12, margin: "wide", lineSpacing: "relaxed" },
  preamble: () => [
    "\\setCJKmainfont{FandolSong}",
    "\\setCJKsansfont{Microsoft YaHei}",
    "\\setmainfont{TeX Gyre Termes}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\centering\\Large\\bfseries\\color{accent!90!black}}{\\thesection}{0.6em}{}[{\\color{accent!30}\\titlerule[0.5pt]}]",
    "\\titleformat{\\subsection}{\\large\\itshape\\bfseries\\color{accent!80!black}}{\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.9em}{0.9em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,boxrule=0pt,borderline north={1pt}{0pt}{accent},borderline south={1pt}{0pt}{accent},left=4mm,right=4mm,top=3mm,bottom=3mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,boxrule=0.4pt,left=3.5mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,boxrule=0.4pt,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{6pt}\\centerline{\\color{accent!55}\\textbullet\\ \\ \\textbullet\\ \\ \\textbullet}\\vspace{8pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("  ·  ")
    return [
      "\\thispagestyle{empty}\\begin{center}",
      "{\\color{accent!50}\\rule{2.2cm}{0.5pt}}\\par\\vspace{10pt}",
      `{\\fontsize{26}{32}\\selectfont\\bfseries\\color{accent!90!black} ${title}\\par}`,
      subtitle ? `\\vspace{8pt}{\\large\\itshape\\color{black!60} ${subtitle}\\par}` : "",
      "\\vspace{8pt}{\\color{accent!50}\\rule{2.2cm}{0.5pt}}\\par",
      meta ? `\\vspace{8pt}{\\small\\color{black!55} ${meta}\\par}` : "",
      "\\end{center}\\vspace{16pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── technical-handbook ─────────────────────────
const technicalHandbook: LatexTheme = {
  id: "technical-handbook",
  name: "技术手册",
  description: "等宽编号、竖条侧标与锐利描边框，代码友好，适合 API/工具文档、规范与教程。",
  cjk: "sans",
  defaults: { palette: "graphite", cover: false, fontSize: 11, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{DengXian}",
    "\\setCJKsansfont{DengXian}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\large\\bfseries\\sffamily\\color{accentdark}}{}{0em}{\\color{accent}\\rule[-0.1em]{4pt}{1.1em}\\hspace{0.5em}{\\ttfamily\\normalsize\\color{accent}\\thesection}\\hspace{0.5em}}",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries\\sffamily\\color{accent!80!black}}{}{0em}{{\\ttfamily\\color{accent}\\thesubsection}\\hspace{0.5em}}",
    "\\titlespacing*{\\section}{0pt}{1.3em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.7pt,colframe=accent,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0pt,borderline west={3pt}{0pt}{accent},left=3.5mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,arc=0pt,boxrule=0.7pt,colframe=accent,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{5pt}{\\color{accent!30}\\hrule height 0.7pt}\\vspace{7pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("   ")
    return [
      "\\thispagestyle{empty}\\noindent",
      "{\\ttfamily\\small\\color{accent}// document}\\par\\vspace{4pt}",
      `\\noindent{\\LARGE\\bfseries\\sffamily\\color{accentdark} ${title}\\par}`,
      subtitle ? `\\vspace{4pt}\\noindent{\\normalsize\\color{black!55} ${subtitle}\\par}` : "",
      meta ? `\\vspace{4pt}\\noindent{\\ttfamily\\footnotesize\\color{black!50} ${meta}\\par}` : "",
      "\\vspace{6pt}\\noindent{\\color{accent}\\hrule height 1.5pt}\\vspace{12pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── blueprint ─────────────────────────
const blueprint: LatexTheme = {
  id: "blueprint",
  name: "蓝图线框",
  description: "全描边线框、双线标题与边框封面，工程制图感，适合方案、规格书与结构化文档。",
  cjk: "sans",
  defaults: { palette: "ocean", cover: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{DengXian}",
    "\\setCJKsansfont{DengXian}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\large\\bfseries\\color{accent}}{\\thesection}{0.6em}{}[{\\color{accent}\\titlerule[1.4pt]\\vspace{1pt}\\color{accent!50}\\titlerule[0.4pt]}]",
    "\\titleformat{\\subsection}{\\normalsize\\bfseries\\color{accent!85!black}}{\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.4em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.7pt,colback=white,colframe=accent,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.7pt,colback=white,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,arc=0pt,boxrule=0.7pt,colback=white,colframe=accent,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{5pt}{\\color{accent!50}\\hrule height 0.5pt}\\vspace{7pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("   |   ")
    const inner = [
      `{\\LARGE\\bfseries\\color{accent} ${title}\\par}`,
      subtitle ? `\\vspace{6pt}{\\large\\color{black!60} ${subtitle}\\par}` : "",
      meta ? `\\vspace{10pt}{\\small\\color{black!55} ${meta}\\par}` : "",
    ].filter(Boolean).join("\n")
    return [
      "\\thispagestyle{empty}",
      `\\begin{tcolorbox}[enhanced,sharp corners,colback=white,colframe=accent,boxrule=1pt,arc=0pt,left=6mm,right=6mm,top=8mm,bottom=8mm,borderline={0.4pt}{2pt}{accent!55}]\\begin{center}${inner}\\end{center}\\end{tcolorbox}\\vspace{12pt}`,
    ].join("\n")
  },
}

// ───────────────────────── elegant-letter ─────────────────────────
const elegantLetter: LatexTheme = {
  id: "elegant-letter",
  name: "典雅信笺",
  description: "仿宋公文风：居中标题、克制线条、正式舒展排版，适合通知、公文、正式信函与纪要。",
  defaults: { palette: "crimson", cover: false, fontSize: 12, margin: "normal", lineSpacing: "relaxed" },
  preamble: () => [
    "\\setCJKmainfont{FangSong}",
    "\\setCJKsansfont{SimHei}",
    "\\setmainfont{TeX Gyre Termes}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\centering\\large\\bfseries\\color{black!85}}{\\thesection、}{0.3em}{}",
    "\\titleformat{\\subsection}{\\bfseries\\color{black!75}}{\\thesubsection}{0.5em}{}",
    "\\titlespacing*{\\section}{0pt}{1.5em}{0.7em}",
    "\\tcbset{themebox/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.4pt,colframe=accent!60,left=3.5mm,right=3.5mm,top=2.5mm,bottom=2.5mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,sharp corners,arc=0pt,boxrule=0.4pt,colframe=accent!60,left=3.5mm,right=3mm,top=2mm,bottom=2mm}}",
    "\\tcbset{themestat/.style={enhanced,sharp corners,arc=0pt,boxrule=0.4pt,colframe=accent!60,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{5pt}{\\color{black!25}\\hrule height 0.5pt}\\vspace{7pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("　　")
    return [
      "\\thispagestyle{empty}\\begin{center}",
      `{\\fontsize{24}{30}\\selectfont\\bfseries\\color{accent!85!black} ${title}\\par}`,
      subtitle ? `\\vspace{8pt}{\\large\\color{black!60} ${subtitle}\\par}` : "",
      "\\vspace{10pt}{\\color{accent}\\hrule height 1.2pt}\\vspace{1.5pt}{\\color{accent}\\hrule height 0.4pt}",
      meta ? `\\vspace{8pt}{\\color{black!55} ${meta}\\par}` : "",
      "\\end{center}\\vspace{16pt}",
    ].filter(Boolean).join("\n")
  },
}

// ───────────────────────── vivid-cards ─────────────────────────
const vividCards: LatexTheme = {
  id: "vivid-cards",
  name: "活力卡片",
  description: "高饱和圆角色块、白字胶囊编号与醒目卡片，信息图风，适合活动、营销与亮点汇报。",
  cjk: "sans",
  defaults: { palette: "rose", cover: true, fontSize: 11, margin: "normal", lineSpacing: "normal" },
  preamble: () => [
    "\\setCJKmainfont{Microsoft YaHei}",
    "\\setCJKsansfont{Microsoft YaHei}",
    "\\setmainfont{TeX Gyre Heros}",
    "\\setsansfont{TeX Gyre Heros}",
    "\\titleformat{\\section}{\\Large\\bfseries\\color{accent!90!black}}{}{0em}{\\tcbox[on line,nobeforeafter,colback=accent,colframe=accent,arc=4pt,boxsep=1pt,left=6pt,right=6pt,top=2pt,bottom=2pt]{\\color{white}\\bfseries\\thesection}\\hspace{0.6em}}",
    "\\titleformat{\\subsection}{\\large\\bfseries\\color{accent!85!black}}{}{0em}{\\color{accent}\\rule[0.1ex]{4pt}{1em}\\hspace{0.5em}}",
    "\\titlespacing*{\\section}{0pt}{1.3em}{0.6em}",
    "\\tcbset{themebox/.style={enhanced,breakable,arc=8pt,boxrule=0pt,drop fuzzy shadow=accent!30,left=4mm,right=4mm,top=3mm,bottom=3mm}}",
    "\\tcbset{themeadmon/.style={enhanced,breakable,arc=8pt,boxrule=0pt,drop fuzzy shadow=black!12,left=4mm,right=3.5mm,top=2.5mm,bottom=2.5mm}}",
    "\\tcbset{themestat/.style={enhanced,arc=8pt,boxrule=0pt,drop fuzzy shadow=accent!30,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
    "\\renewcommand{\\dividerline}{\\par\\vspace{5pt}{\\color{accent!40}\\hrule height 1.4pt}\\vspace{7pt}}",
  ].join("\n"),
  cover: (config) => {
    const { title, subtitle, author, date } = docInfo(config)
    const meta = [author, date].filter(Boolean).join("  ·  ")
    return [
      "\\thispagestyle{empty}",
      "\\begin{tcolorbox}[enhanced,interior style={left color=accent,right color=accentdark},colframe=accent,arc=14pt,boxrule=0pt,drop fuzzy shadow=accent!40,left=6mm,right=6mm,top=8mm,bottom=8mm]",
      `{\\color{white}\\Huge\\bfseries ${title}\\par}`,
      subtitle ? `\\vspace{6pt}{\\color{white!90}\\Large ${subtitle}\\par}` : "",
      meta ? `\\vspace{6pt}{\\color{white!82}\\normalsize ${meta}}` : "",
      "\\end{tcolorbox}\\vspace{12pt}",
    ].filter(Boolean).join("\n")
  },
}

const THEMES: LatexTheme[] = [
  academicClassic,
  modernMagazine,
  freshNotebook,
  swissMinimal,
  darkSpotlight,
  editorialSerif,
  technicalHandbook,
  blueprint,
  elegantLetter,
  vividCards,
]

export const DEFAULT_LATEX_THEME = THEMES[0].id
export const LATEX_THEME_IDS = THEMES.map((theme) => theme.id)

export function getLatexTheme(id: string | undefined): LatexTheme | undefined {
  return THEMES.find((theme) => theme.id === id)
}

export function listLatexThemes() {
  return THEMES.map(({ id, name, description }) => ({ id, name, description }))
}
