import "server-only"
import type { AISkill, SkillContext, SkillEvaluation } from "@/lib/ai/skills/types"

// Conservative PDF intent: bare "编译/导出/排版" must NOT match (those are common
// outside PDF, e.g. "编译 TypeScript 报错"). Require pdf/latex, or a doc-generation
// phrase. Follow-up tweaks are caught by pdfSessionActive instead.
const PDF_INTENT =
  /pdf|latex|xelatex|生成.*pdf|导出.*pdf|编译.*pdf|排版.*pdf|latex.*文档|(生成|制作|做|导出|输出).{0,6}(文档|报告|简报|手册|讲义|笔记|错题本|试卷|方案|纪要|文件)|下载.{0,4}文档/i

const BODY = `# 技能：把内容编译成精美 PDF（蝶灵 LaTeX 排版标准）

你正在处理"生成 / 导出 / 编译 PDF 文档"类任务。本技能定义蝶灵的排版标准：让你写出的正文，编译后达到"细致入微、专业排版"的水准。严格执行。

## 0. 质量底线
合格的蝶灵 PDF：结构清晰（有层级与小节）、信息分块（用对组件）、忠于事实（不虚构）、一次写全（不留占位）。读者应感到"排得很用心"，而不是"一段大白话导出成 PDF"。

## 1. 分工：你只写正文
版式、字体、配色、封面、页眉页脚、目录、微排版（标点挤压 / 中西文间距 / protrusion）全部由系统的"主题 + 导言区"负责，已经做好。你**只**写正文内容，使用下方文档化组件。
严禁出现：\\documentclass、任何导言区、\\usepackage、\\input、\\include、\\write18、\\begin{document}（出现即被拒绝）。

## 2. 工作流（按顺序）
1) 取真实素材：整理错题 / 资料 / 资讯 / 笔记前，先用 search_knowledge_notes / read_my_pdf_document 拿到带来源的事实，**不得虚构**。
2) 选内容类型 + 主题 + 配色：调用一次 list_latex_templates 了解可选项与各模板写法；按文档性质选择（§4 决策表），用 set_latex_doc_config 设定（或在 compile 时用 template/theme/palette 覆盖）。
3) 设定文档信息：标题 / 副标题 / 作者 / 日期。
4) 组织结构：拆成 3–7 个 \\section（必要时 \\subsection）；首节开头用 \\lead{导语} 或 \\dropcap{首}字下沉起头。
5) 用对组件（§3）：组件给散文"断句"，不要堆砌。
5.5) **长文档必须先定大纲**：写长教程 / 深度解析 / 详细报告 / 多章文档时，先列出全部一级章节。
   - 中等长度（约 ≤ 6 章、单次能写完）：用 compile_latex_pdf，并通过 **expectedSections** 传入完整章节清单，系统据此校验完整性。
   - **很长（几十页 / 上百页 / 章节多、单次正文会被截断）：必须改用【草稿分章流程】**，避免一次塞超长正文被截断：
     a. start_latex_draft({ plan: [全部章节标题], title })——先声明完整大纲。
     b. 对每一章 append_latex_draft_section({ sectionId: 章节标题, bodyLatex: 该章完整正文（不含 \\section 标题）})——一次只写一章，写到自然收尾。
     c. get_latex_draft_status() 查看还差哪些章。
     d. 全部写齐后 compile_latex_draft({ template/theme/palette })——组装并编译（自动完整性校验 + PDF 反查）。
   宁可每章写精简些，也要把所有章节写齐，绝不中途停笔或只写前几章。
   - **篇幅 / 章节需要调整时，复用已写内容，绝不从零重写**（像改代码一样做局部修改）：
     · 要新增章节（如篇幅不够要加内容）：用【原有全部标题 + 新增标题】的完整 plan 再调用一次 start_latex_draft（默认保留已写章节，只把新章列为待写），然后只对**新增章节** append；已写章节一律不重写。
     · 要重排顺序：用新顺序的 plan 调 start_latex_draft 即可，正文自动跟随。
     · 要重命名章节：start_latex_draft 时传 rename:{旧标题:新标题}，让已写正文跟随。
     · 要调整 / 扩写某一章内容：只对该章再 append_latex_draft_section（会覆盖该章正文），不动其他章。
     · 只有确实要整篇推翻重做时才 start_latex_draft({ reset: true })。
6) 一次写全：bodyLatex 必须是完整正文，含 expectedSections 里的**全部**章节与每节完整内容，一次写完、每节都要写到自然收尾；**绝不**只给章节骨架、开头、或写到一半就停（结尾不能停在"包括："/"分别为："/逗号等处）。若内容很长、担心被截断，宁可减少每节字数也要把所有章节写齐。
7) 编译：调用 compile_latex_pdf。返回错误时按信息定位**具体那一处**修正后重试（§5）；返回 body_low_quality 时按 guidance 补足结构后重写正文重试。
8) 收尾：成功后只用一两句话说明"生成了什么、用了哪个模板 / 主题"。系统会自动在聊天里附上可下载的 PDF 卡片——**不要**在回复里粘贴任何下载链接或 /api/uploads 地址，也不要整段复述正文。

## 3. 组件与审美（蝶灵标准）
组件是给正文"断句"的标点。满屏的框 = 没有框一样糟。
- 标题层级：每篇都要有 \\section；3–7 个主节最佳；需要再分用 \\subsection。
- 开篇：首节用 \\lead{一句话导语} 或 \\dropcap{首}字下沉，别一上来就丢组件。
- 重点框 callout / keypoint / infocard：每节**至多 1 个**，只突出该节唯一核心；不要节节都放。
- 语义提示 note / tip / success / warning / danger：只在真有注意 / 提示 / 结论 / 警示时用，语义要对应，别当装饰。
- 指标卡 \\statcard：只用于关键数字，且**一行正好三个**：\\statcard{值}{标签}\\hfill\\statcard{…}{…}\\hfill\\statcard{…}{…}。
- 表格 prettytable：**任何 ≥2 列的表格型数据都必须用表格**，不要写成流水句。\\begin{prettytable}{lrl} 首行表头 \\\\ 数据行… \\end{prettytable}（首行自动表头配色 + 斑马纹）；建议外套 \\begin{table}[h]\\centering\\caption{表标题} … \\end{table}。
- 代码 \\begin{code} … \\end{code}：任何代码 / 命令 / 配置（自带圆角卡片 + 行号）。
- 引用 \\begin{quotebox} … \\end{quotebox}：原文摘录 / 金句。
- 错题 \\begin{mistake}{错题N：标题} \\field{题目}{…}\\field{正确答案}{…}\\field{解析}{…} \\end{mistake}。
- 事实清单 \\begin{factbox}[标题] \\fact{字段}{值} … \\end{factbox}；时间线 \\milestone{日期}{事件}；行内 \\badge{标签}、\\hl{高亮}。
- 列表用 itemize / enumerate（项目符号已美化）；公式用 $...$ 或 equation。

## 4. 内容类型 → 推荐主题（决策表）
- 论文 / 正式报告 → academic-paper（academic-classic）
- 数据 / 商务报告、提案 → modern-report / project-proposal（modern-magazine）
- 资料手册 / 长篇结构化 → knowledge-handbook（fresh-notebook）
- 课程讲义 / 读书笔记 → course-notes / reading-notes（fresh-notebook）
- 错题本 → mistake-notebook；资讯简报 → info-briefing（modern-magazine）
- 速查卡 → cheatsheet（swiss-minimal）；会议纪要 / 通用 → meeting-minutes / general-document（swiss-minimal）；试卷 → exam-paper
其它可选视觉主题（用户可换）：dark-spotlight 暗色演示、editorial-serif 杂志衬线、technical-handbook 技术手册、blueprint 蓝图线框、elegant-letter 仿宋公文、vivid-cards 活力卡片。

## 5. LaTeX 正确性清单（避免编译失败）
- 特殊字符必须转义：% → \\%，& → \\&，# → \\#，_ → \\_，$ → \\$（数学除外），{ } 配对。
- 数学放进 $...$ 或 \\[ \\]；上下标 ^ _ 只在数学里用。
- 表格行用 & 分列、\\\\ 换行；列数与列格式一致。
- 中文标点照常写（。，、；："" 等），系统会做挤压。
- 正文必须完整：所有 \\section 与内容一次写齐，禁止占位 / 骨架 / "以下省略"。

## 6. 用户调整协议（最重要——务必精确执行）
用户会要求微调。把自然语言**准确**映射到工具调用。

【内容不变、只换样式时】调用 compile_latex_pdf 并设置 **reuseLastBody=true**，按需带上样式参数，**不要写 bodyLatex**（系统会复用上次完整正文重排）：
- "换个模板 / 换个主题 / 换种风格 / 换种排版" → reuseLastBody=true, theme=<§4 主题 id>。
- "换颜色 / 换配色" → reuseLastBody=true, palette=<royal/teal/emerald/indigo/violet/crimson/amber/rose/ocean/graphite>。
- "换字体 / 用楷体 / 仿宋 / 思源" → reuseLastBody=true, cjkFont=<auto/songti/heiti/kaiti/fangsong/dengxian/yahei/shsong/shhei>。
- "加封面 / 去目录 / 字大点 / 首行缩进 / A4" 等版式项 → 既可用 set_latex_doc_config 改配置，也可在带 reuseLastBody=true 的 compile 里调整。

【改内容时】重写**完整** bodyLatex 后调用 compile_latex_pdf（**不要**设 reuseLastBody）：
- "把内容改成…… / 加一节…… / 删掉……" → 提供完整新正文。
- "重新生成 / 再做一份"（内容不变）→ reuseLastBody=true；（要改内容）→ 提供完整 bodyLatex。

铁律：**绝不用"留空 bodyLatex"表示复用——那会被拒绝。复用必须显式 reuseLastBody=true。** 只换样式时绝不重写正文、绝不凭空生成新内容；找不到可复用正文时系统会报 missing_last_body_for_restyle，此时请重新提供完整正文。

【如实汇报】成功后必须依据工具返回的元数据（usedBodySource / sectionCount / pdfPageCount）说明，**不得**自行声称"内容完整""共 X 章"——只能说工具返回的实际 sectionCount 与 pdfPageCount（例如实际 5 页 3 章，就只能说 5 页 3 章，绝不能说 10 章完整）。
【完整性失败处理】若返回 body_incomplete_by_outline / probable_truncation / compiled_pdf_incomplete，说明正文被截断或缺章节，必须按 guidance 把缺失/未写完的章节补齐成完整 bodyLatex 后重新编译，**不要**直接告诉用户"已完成"。若多次因过长被截断，把每节内容写精简些以容纳全部章节。
其它失败（restyle_content_lost / body_low_quality / empty_body_without_reuse_flag / missing_last_body_for_restyle / template_options_not_loaded）同样按其 guidance 修正后重试。

## 7. 反面教材（禁止）
✗ 一大段大白话直接当正文（无 \\section、无组件）。
✗ 把表格型数据写成"渠道A占比86%，渠道B占比14%"的流水句（应用 prettytable）。
✗ 在聊天里粘贴下载链接 / /api/uploads 地址 / 复述全文。
✗ 只写章节标题骨架或"开头"就调用编译。
✗ 节节都塞 callout、满屏框、滥用 statcard。
✗ 编造数据 / 来源 / 数字。
✗ 写 \\usepackage / \\documentclass / 导言区。

## 8. 短例（仅示意结构，勿照抄题材）
\\section{数据结果}
\\lead{本季度转化稳步提升。}
\\statcard{65}{投递}\\hfill\\statcard{17}{回复}\\hfill\\statcard{5}{面试}
\\begin{prettytable}{lrl}渠道 & 占比 & 备注\\\\ 官网 & 14\\% & 补充\\\\ 社群 & 12\\% & 增长\\\\\\end{prettytable}
\\begin{success}[结论]聚焦头部渠道。\\end{success}`

const evaluate = (ctx: SkillContext): SkillEvaluation => {
  if (!ctx.hasToolAccess) return { matched: false }
  if (PDF_INTENT.test(ctx.prompt)) return { matched: true, reason: "pdf_intent" }
  if (ctx.pdfSessionActive) return { matched: true, reason: "pdf_session_active" }
  return { matched: false }
}

export const pdfAuthoringSkill: AISkill = {
  id: "pdf-authoring",
  name: "PDF 排版（LaTeX）",
  version: "1.0.0",
  triggerHint: "用户要把内容生成 / 导出 / 编译为 PDF，或在已有 PDF 会话中调整样式。",
  evaluate,
  body: BODY,
}
