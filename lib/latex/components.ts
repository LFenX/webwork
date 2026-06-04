import "server-only"

// Default tcolorbox styles + \dividerline, emitted in the base preamble BEFORE
// the components below and BEFORE the theme. Themes override themebox/themeadmon/
// themestat (via \tcbset) and \dividerline (via \renewcommand) afterwards, so the
// SAME component renders differently per theme. These defaults also guarantee the
// styles exist even if a theme forgets to set one.
//   themebox   — structural/academic cards (breakable, can span pages)
//   themeadmon — admonitions (note/tip/warning…) (breakable)
//   themestat  — metric chips (MUST be non-breakable so they sit in a row)
export const COMPONENT_STYLE_DEFAULTS: string = [
  "\\tcbset{themebox/.style={enhanced,breakable,arc=2pt,boxrule=0.5pt,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
  "\\tcbset{themeadmon/.style={enhanced,breakable,arc=2pt,boxrule=0.5pt,left=3mm,right=3mm,top=2mm,bottom=2mm}}",
  "\\tcbset{themestat/.style={enhanced,arc=3pt,boxrule=0.5pt,left=1mm,right=1mm,top=2mm,bottom=2mm}}",
  "\\newcommand{\\dividerline}{\\par\\vspace{4pt}{\\color{accent!40}\\hrule height 1pt}\\vspace{6pt}}",
].join("\n")

// Shared LaTeX component library injected into every document's preamble. Boxes
// inherit their SHAPE (corners/shadow/rules) from the theme styles above and only
// set their own COLORS/title here, so a theme switch restyles them all at once.
// The AI authors the body using these macros; the security scanner is unchanged.
export const COMPONENT_PREAMBLE: string = [
  // —— Admonitions (semantic fixed colors, with icons) ——
  "\\newtcolorbox{note}[1][注意]{themeadmon,colback=blue!4,colframe=blue!55!black,coltitle=white,fonttitle=\\bfseries,title={\\faInfoCircle\\ #1}}",
  "\\newtcolorbox{tip}[1][提示]{themeadmon,colback=teal!5,colframe=teal!60!black,coltitle=white,fonttitle=\\bfseries,title={\\faLightbulb\\ #1}}",
  "\\newtcolorbox{success}[1][结论]{themeadmon,colback=green!5,colframe=green!55!black,coltitle=white,fonttitle=\\bfseries,title={\\faCheckCircle\\ #1}}",
  "\\newtcolorbox{warning}[1][注意]{themeadmon,colback=orange!6,colframe=orange!70!black,coltitle=white,fonttitle=\\bfseries,title={\\faExclamationTriangle\\ #1}}",
  "\\newtcolorbox{danger}[1][警告]{themeadmon,colback=red!5,colframe=red!65!black,coltitle=white,fonttitle=\\bfseries,title={\\faTimesCircle\\ #1}}",
  "\\newtcolorbox{quotebox}{themebox,colback=accentsoft,frame hidden,borderline west={3pt}{0pt}{accent},fontupper=\\itshape\\color{black!75}}",
  // —— Structural callouts / cards (palette colored) ——
  "\\newtcolorbox{callout}[1]{themebox,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title=#1}",
  "\\newtcolorbox{keypoint}[1]{themebox,colback=accentsoft,colframe=accentdark,fonttitle=\\bfseries\\color{white},coltitle=white,title={\\faStar\\ #1}}",
  "\\newtcolorbox{infocard}[1]{themebox,colback=white,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title=#1}",
  "\\newtcolorbox{factbox}[1][要点]{themebox,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title=#1}",
  "\\newcommand{\\fact}[2]{\\par\\noindent{\\bfseries\\color{accentdark}#1：}#2}",
  "\\newcommand{\\statcard}[2]{\\begin{tcolorbox}[themestat,nobeforeafter,width=0.31\\linewidth,halign=center,colback=accentsoft,colframe=accent]{\\LARGE\\bfseries\\color{accent}#1}\\par{\\footnotesize\\color{black!65}#2}\\end{tcolorbox}}",
  // —— Academic boxes ——
  "\\newtcolorbox{definition}[1]{themebox,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title={定义：#1}}",
  "\\newtcolorbox{theorem}[1]{themebox,colback=accentsoft,colframe=accentdark,fonttitle=\\bfseries\\color{white},coltitle=white,title={定理：#1}}",
  "\\newtcolorbox{example}[1]{themebox,colback=black!2,colframe=accent!70!black,fonttitle=\\bfseries,title={例：#1}}",
  // —— Mistake notebook ——
  "\\newtcolorbox{mistake}[1]{themebox,colback=accentsoft,colframe=accent,fonttitle=\\bfseries\\color{white},coltitle=white,title=#1}",
  "\\newcommand{\\field}[2]{\\par\\smallskip\\noindent{\\bfseries\\color{accent}#1：}#2\\par}",
  // —— Inline + small components ——
  "\\newcommand{\\milestone}[2]{\\par\\noindent{\\color{accent}\\rule[-0.1ex]{3pt}{1.15em}}\\hspace{0.6em}{\\bfseries\\color{accentdark}#1}\\hspace{0.6em}#2\\par\\smallskip}",
  "\\newcommand{\\badge}[1]{\\tcbox[on line,boxsep=1.5pt,left=3pt,right=3pt,top=1pt,bottom=1pt,colback=accent,colframe=accent,fontupper=\\footnotesize\\bfseries\\color{white},arc=3pt]{#1}}",
  "\\newcommand{\\hl}[1]{\\colorbox{accentsoft}{#1}}",
  "\\newcommand{\\lead}[1]{{\\large\\color{black!75}#1}\\par\\medskip}",
  "\\newcommand{\\dropcap}[1]{\\lettrine[lines=2,findent=2pt,nindent=0pt]{\\color{accent}#1}{}}",
  // Premium table: colored bold header row, zebra body, accent rules. The single
  // argument is the column spec (e.g. {lrl} / {Xrr}); X columns auto-wrap.
  "\\NewDocumentEnvironment{prettytable}{m}{\\begin{tblr}{colspec={#1},row{1}={font=\\bfseries,fg=white,bg=accent},row{even}={bg=accentsoft},hline{1,Z}={1pt,accent},hline{2}={0.6pt,accent},rowsep=2.5pt,colsep=8pt}}{\\end{tblr}}",
].join("\n")

// Concise reference appended to each template's bodyGuide so the model knows the
// available components and how to use them.
export const COMPONENT_GUIDE: string =
  "可用组件：" +
  "提示框 \\begin{note}/{tip}/{success}/{warning}/{danger}[可选标题] … \\end{…}（带图标，语义配色）；" +
  "引用 \\begin{quotebox} … \\end{quotebox}；" +
  "通用框 \\begin{callout}{标题} / \\begin{keypoint}{标题} / \\begin{infocard}{标题}；" +
  "事实清单 \\begin{factbox}[标题] \\fact{字段}{值} … \\end{factbox}；" +
  "指标卡（一行三个）\\statcard{数值}{标签}\\hfill\\statcard{…}{…}\\hfill\\statcard{…}{…}；" +
  "学术框 \\begin{definition}{名} / \\begin{theorem}{名} / \\begin{example}{标题}；" +
  "错题卡 \\begin{mistake}{标题} \\field{字段}{值} … \\end{mistake}；" +
  "时间线 \\milestone{日期}{事件}；" +
  "行内 \\badge{标签}、\\hl{高亮}、\\lead{导语段}、\\dropcap{首}字下沉、\\dividerline 分隔线。" +
  "精美表格 \\begin{prettytable}{列格式} … \\end{prettytable}（首行自动表头配色、隔行斑马纹；列格式如 lrl，用 X 列可自动换行；建议外套 \\begin{table}[h]\\centering\\caption{标题}…\\end{table}）；也可用普通 tabular+booktabs；公式 $...$ 或 equation；代码 \\begin{code} … \\end{code}（圆角卡片，自带行号，无需指定语言）。"
