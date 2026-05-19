import { BookOpen } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsSection, SettingsShell } from "@/components/settings/settings-shell"
import { MarkdownContent } from "@/components/markdown-content"

export const dynamic = "force-dynamic"

const zhGuide = `
# 使用说明书

## 这是什么网站

这是一个围绕个人成长和日常协作设计的个人空间网站。它不是单一的博客，也不是只展示简历的主页，而是把写作、知识整理、简历管理、求职追踪、面试复盘、好友互动、资源分享、AI 助手和数据查询放在一起的综合工作台。

你可以把它理解成一个长期使用的个人数字空间：

- 用博客、日常、心得和笔记记录想法、经验、知识和生活。
- 用简历、求职、面试模块管理职业材料和求职进度。
- 用首页看板查看近期动态、写作统计、求职漏斗、访问数据和留言。
- 用好友、私聊、频道和留言板与可信任的人互动。
- 用社区资源库收藏和分享网站、表情等公共资源。
- 用 SoulWing AI 助手检索自己的资料、整理内容、起草回复、辅助写作和保存长期记忆。
- 用 SQL Lab 在授权范围内查询和分析站内数据。
- 用后台管理注册、用户、公告、AI 权限、SQL 权限、模板和公共资源。

这个网站最重要的特点是“持续沉淀”。你写过的文章、投过的岗位、经历过的面试、与好友的互动、AI 记住的偏好、收藏和分享的资源，都会逐渐汇成你的个人资料库。

---

## 快速上手

### 第一次使用建议

如果你是第一次进入网站，可以按下面顺序完成初始化：

1. 进入设置，先完善个人资料，包括显示名、头像、地区、简介和邮箱。
2. 在设置中选择语言，中文和 English 可以随时切换。
3. 在设置的资料可见范围中确认哪些模块允许好友查看。
4. 回到首页，查看默认看板，并通过布局编辑调整首页卡片。
5. 进入简历，选择在线简历或 PDF 简历模式，先建立一份基础简历。
6. 进入博客、日常、心得或笔记，写下第一篇内容。
7. 如果正在找工作，进入求职和面试模块，把最近的投递记录补进去。
8. 如果有好友，进入好友页面添加好友，再通过私聊或频道互动。
9. 进入 AI 页面配置或申请 AI 使用权限，然后开始和 SoulWing 对话。
10. 如果你有 SQL Lab 权限，可以进入 SQL Lab 查询自己的站内数据。

### 顶部导航说明

登录后，顶部导航会显示主要入口：

| 入口 | 用途 |
|------|------|
| 首页 | 查看个人看板、最近活动、写作统计、求职漏斗、留言和访问统计 |
| 社区 | 进入社区资源入口，查看网站资源和公共内容 |
| 简历 | 查看自己的简历展示页 |
| 博客 | 写正式文章、项目总结、教程和长文 |
| 日常 | 写生活记录、碎片想法和短记录 |
| 心得 | 写复盘、读书笔记、学习感悟和阶段总结 |
| 笔记 | 做知识整理、资料归档和快速记录 |
| 求职 | 管理岗位投递、状态和求职进度 |
| 面试 | 管理每一轮面试记录和复盘 |
| AI | 进入 SoulWing AI 助手 |
| SQL | 进入 SQL Lab 数据查询工作台 |
| 好友 | 管理好友、私聊和未读消息 |
| 管理 | owner 或管理员可见，用于管理用户、权限和系统资源 |
| 设置 | 管理个人资料、密码、可见范围、语言和说明书 |

手机端会通过菜单按钮打开侧边导航。顶部头像旁边可能显示在线状态，好友入口可能显示未读消息数量。

---

## 账号、登录与注册

### 注册

新用户可以从注册页提交注册信息。根据站点配置，注册可能需要管理员审核。提交后可以查看注册状态，等待管理员通过后再登录。

### 登录

登录后会进入个人空间。系统会记录会话状态，并通过会话心跳维护在线、离开、离线状态。退出登录时，本地缓存中的部分聊天草稿和用户状态会被清理。

### 修改密码

进入设置里的修改密码页面，可以提交密码修改申请。此网站采用审核式密码修改流程，提交后需要管理员批准才会生效。这样做是为了降低误操作和账号被恶意修改的风险。

---

## 设置中心

设置中心是管理个人空间的地方。

### 个人资料

入口：设置 -> 个人资料。

可以维护：

- 显示名：站内展示使用。
- 头像：可以使用头像图片或头像文字。
- 地区：用于个人资料卡展示。
- 简介：会显示在首页和个人主页中。
- 邮箱：账号识别和联系信息。

建议把简介写成一两句话，说明你是谁、正在做什么、这个空间主要记录什么。

### 修改密码

入口：设置 -> 修改密码。

填写新密码并提交申请后，等待管理员审核。审核通过后再使用新密码登录。

### 资料可见范围

入口：设置 -> 资料可见范围。

这里控制好友能看到哪些模块。常见模块包括首页、简历、博客、日常、心得、笔记、求职和面试。

可见范围的建议：

- 公开或半公开内容，如博客、项目总结，可以对好友开放。
- 私密内容，如求职、面试、日常，建议只开放给非常熟悉的人。
- 简历可以根据求职需要开放给好友，也可以保持私密。

### 语言

入口：设置 -> 语言。

网站支持中文和 English。切换后，导航、设置页和大部分界面文案会随之变化。

### 首页布局编辑

入口：设置 -> 首页布局编辑，或访问首页并进入布局编辑状态。

可以调整首页卡片的顺序、宽度和显示状态。隐藏的卡片可以再次添加回来。适合把最常用的信息放在首页前半屏。

---

## 首页使用说明

首页是个人空间的总览。它把站内很多模块的数据聚合到一起。

### 个人资料卡

显示你的头像、昵称、邮箱、地区和简介。这里的数据来自设置中的个人资料。

### 公告与频道动态

显示系统公告、频道广播和与你相关的通知。管理员发布的重要公告会出现在这里。

### 最近活动

最近活动会聚合多个来源：

- 好友的新消息和未读消息。
- 好友发布或更新的文章、简历、求职动态。
- 社区里新分享的网站资源和表情。
- SoulWing 圆桌的讨论动态。

这个模块适合每天打开网站时快速查看“有什么新事发生”。

### 写作统计

写作统计会根据博客、日常、心得和笔记计算：

- 累计文章数量。
- 累计字数。
- 连续写作天数。
- 本月新增数量。
- 常用标签。

如果你想培养写作习惯，可以把这个模块放在首页靠前位置。

### 最新文章与最近日常

这里展示你最近发布或编辑的内容。博客、心得和笔记会汇总为文章列表，日常会单独展示。点击任意条目可以进入阅读页。

### 聊天活跃度

聊天活跃度统计你在私聊和频道中的互动情况，包括单聊、群聊、本周互动等。它能帮助你看到自己最近的社交活跃状态。

### 求职漏斗

求职漏斗会根据求职记录计算从投递到回复、面试、Offer 的转化情况。

如果你正在找工作，建议持续维护求职状态，因为首页漏斗会帮助你判断：

- 投递数量是否足够。
- 回复率是否稳定。
- 面试机会是否增加。
- Offer 进展是否接近目标。

### 最近求职动态

展示最近更新的岗位记录，包括公司、岗位、当前状态和投递日期。

### 访问统计

访问统计展示访问量、访客来源和访问记录。适合查看谁访问过你的空间，以及哪些页面更受关注。

### 留言板

留言板允许好友或有权限的人给你留言。留言可以包含文字、表情和回复。你也可以在自己的留言板中回应别人。

### 贡献热力图

贡献热力图把写作、聊天、求职等行为按日期展示出来。它适合用来回看自己的长期活跃度。

---

## 内容创作说明

网站提供四类内容：博客、日常、心得、笔记。它们都支持创建、编辑、阅读、文件夹整理、标签、摘要、封面和可见范围控制。

### 四类内容怎么区分

| 类型 | 适合写什么 |
|------|------------|
| 博客 | 正式文章、技术教程、项目总结、长文输出 |
| 日常 | 生活记录、短想法、流水账、当天发生的事 |
| 心得 | 学习复盘、读书笔记、工作感悟、经验总结 |
| 笔记 | 知识库、资料整理、链接收集、临时记录 |

建议不要纠结分类是否绝对准确。长期使用时，只要形成自己的分类习惯即可。

### 新建文章

进入对应模块后点击新建。填写标题、摘要、标签、内容和可见范围。保存后文章会进入对应列表，也会出现在首页的最新内容中。

### 编辑文章

进入文章详情页后，如果你是作者，可以进入编辑页修改内容。编辑后的更新时间会影响首页和好友动态中的排序。

### 文件夹管理

内容可以放入文件夹中。文件夹适合用于：

- 按项目整理文章。
- 按学习主题整理笔记。
- 按时间阶段整理日常。
- 按专题整理心得。

### 标签使用

标签适合描述文章主题，例如 React、求职、读书、项目复盘、灵感、生活。首页写作统计会统计常用标签，所以建议标签保持简短、一致。

### 摘要与封面

摘要会出现在列表、首页和部分动态中。封面图可以让文章更容易被识别。正式博客和长文建议填写摘要，日常和笔记可以更简短。

### 可见范围

内容可见性用于控制谁能看到文章。建议：

- 私密内容保持仅自己可见。
- 适合分享给熟人的内容设为好友可见。
- 如果未来支持公开访问，再谨慎开放公开内容。

---

## 编辑器说明

内容编辑器支持 Markdown 形式的写作，也支持更接近所见即所得的编辑体验。具体可用能力会根据页面和编辑器状态有所不同。

常见写作能力包括：

- 标题、正文、列表和引用。
- 链接、图片和附件。
- 代码块、表格、分割线。
- 数学公式、图表或 Mermaid 内容的渲染。
- 草稿保存和内容预览。
- AI 辅助写作入口。

写作建议：

- 标题尽量具体，方便未来搜索。
- 摘要写清楚这篇内容解决什么问题。
- 长文用二级标题拆分结构。
- 技术文章可以多用代码块和列表。
- 复盘类文章可以固定写背景、过程、问题、结论、下一步。

---

## 简历模块说明

简历模块用于维护和展示你的职业资料。它支持在线结构化简历，也支持上传 PDF 简历。

### 简历展示页

入口：简历。

这里展示当前选中的简历版本。根据你的设置，它可能展示在线生成的简历，也可能展示上传的 PDF 简历。

### 编辑简历

入口：简历 -> 编辑。

编辑页通常分为两种模式：

1. 在线简历：使用结构化表单填写基础信息、工作经历、项目经历、教育经历、技能、语言、证书、奖项等。
2. PDF 简历：上传已有 PDF 文件，作为当前展示版本。

### 在线简历

在线简历适合长期维护。它的优势是：

- 内容结构清晰。
- 可以切换模板。
- 可以调整章节顺序。
- 可以隐藏不想展示的章节。
- 可以配置字段标签。
- 可以预览和导出。

建议按这个顺序维护：

1. 先填写基础信息。
2. 再补工作经历和项目经历。
3. 然后补教育、技能、语言、证书等。
4. 选择模板。
5. 调整章节顺序和隐藏项。
6. 预览效果。
7. 需要投递时导出或上传对应版本。

### PDF 简历

PDF 模式适合你已经有外部制作好的简历。上传时可以给版本命名，方便区分不同岗位、不同语言或不同时间的简历。

建议命名方式：

- 中文后端开发简历 2026-05。
- 英文全栈简历 2026-05。
- 数据分析岗位版本。
- 校招版本或社招版本。

### 简历模板

简历模板页可以浏览可用模板。不同模板对字段支持程度不同，如果某些内容没有出现在预览里，可能是模板本身不支持对应字段。编辑页会尽量提示模板能力。

---

## 求职模块说明

求职模块用于记录岗位投递和整体进度。

### 新建求职记录

进入求职页面后，可以新增岗位记录。建议填写：

- 公司名称。
- 岗位名称。
- 投递渠道。
- 投递日期。
- 当前状态。
- 岗位链接或备注。
- 后续跟进计划。

### 状态维护

求职状态越及时，首页漏斗越准确。建议每次有进展时立刻更新状态，例如：

- 已投递。
- 已回复。
- 未通过评估。
- 进入面试。
- 未通过面试。
- 已Offer。
- 已接受。
- 已拒绝。
- 无回复放弃。
- 已放弃。

不同状态会影响统计结果。比如从已投递变成已回复后，回复率会变化；无回复放弃不计入回复，已放弃用于记录已经有回复或进入流程后的主动放弃。

### 查看详情

点击岗位可以查看详情，包括岗位信息、当前状态、关联面试数量和备注。你可以把它当成一个小型求职 CRM 使用。

### 从好友导入

如果好友开放了相关模块，部分求职信息可能支持从好友处参考或导入。使用时要注意尊重对方隐私，不要传播敏感信息。

---

## 面试模块说明

面试模块用于记录每一轮面试过程。它可以单独使用，也可以关联到求职记录。

### 新建面试记录

建议填写：

- 关联岗位。
- 面试时间。
- 面试形式，如电话、视频、现场。
- 面试官或部门。
- 面试问题。
- 自己的回答要点。
- 面试结果。
- 自评分数。
- 复盘总结。

### 面试复盘建议

每轮面试结束后尽快记录，因为细节很容易遗忘。推荐记录：

- 被问到了哪些技术点或经历。
- 哪些问题回答得好。
- 哪些问题回答得不完整。
- 下次应该准备什么。
- 对公司、团队和岗位的真实感受。

这些记录可以在之后让 AI 帮你总结，也可以帮助你发现面试中的重复短板。

---

## 好友与私聊说明

好友系统用于建立可信任关系。好友之间能看到什么，取决于双方的可见范围设置。

### 添加好友

进入好友页面，可以通过用户 ID 或页面提供的方式添加好友。发送申请后，对方接受才会建立好友关系。

### 好友资料

建立好友关系后，可以访问对方允许好友查看的模块，例如文章、简历、求职或面试。具体能看到什么，由对方在设置中决定。

### 私聊

进入好友聊天页面后，可以发送：

- 文本消息。
- 表情。
- 附件。
- 引用回复。

聊天页面会显示未读状态。进入对应会话后，系统会尽量同步已读状态。

### 聊天建议

- 重要事项可以引用对方消息后回复，避免上下文混乱。
- 附件中不要上传敏感文件，除非确认对方可以查看。
- 如果不想立刻自己写回复，可以使用 SoulWing 的聊天回复辅助功能。

---

## 频道与群聊说明

频道适合多人讨论。它可以用于项目协作、朋友群、主题讨论或公告发布。

### 频道能力

频道通常包含：

- 消息列表。
- 成员管理。
- 附件发送和下载。
- 公告。
- 未读和实时更新。

### 使用场景

- 几个朋友一起讨论求职。
- 一个小组维护共享资源。
- 管理员发布站内公告。
- SoulWing 圆桌展示主题讨论。

---

## 留言板说明

留言板位于首页或用户主页相关区域。它适合轻量互动，不适合长篇讨论。

可以留言：

- 文字。
- 表情。
- 对已有留言的回复。

建议把留言板用于问候、反馈、短评论和简单交流。更深入的讨论可以转到私聊或频道。

---

## 社区资源说明

社区资源是大家共同贡献和发现内容的地方。当前主要包括网站资源库和表情社区。

### 网站资源库

入口：社区 -> 资源 -> 网站。

你可以分享一个网站资源，通常包括：

- 网站名称。
- 链接。
- 域名。
- 截图。
- 简介。
- 标签。
- 所属文件夹。
- 可见性。

适合分享：

- 工具网站。
- 学习资源。
- 设计灵感。
- 开发文档。
- 求职资源。
- 有价值的文章合集。

不建议分享：

- 包含个人隐私的链接。
- 需要账号权限的内部页面。
- 可能失效或来源不明的下载站。
- 带有敏感参数的私人链接。

### 网站文件夹

文件夹用于整理资源。例如：

- AI 工具。
- 前端开发。
- 设计参考。
- 求职准备。
- 常用文档。

### 访问统计

网站资源会记录访问情况。热门资源和贡献数据可以帮助大家发现更有价值的内容。

### 表情社区

入口：表情社区。

可以浏览公共表情，把喜欢的表情添加到自己的表情库，也可以贡献自己的表情。管理员可以管理公共表情。

---

## SoulWing AI 助手说明

SoulWing 是你的个人 AI 助手。它不是简单的聊天机器人，而是可以在权限范围内读取站内资料、调用工具、保存记忆、辅助写作和帮助沟通的个人 Agent。

### 进入 AI 页面

入口：AI。

你可以创建或继续一段对话。对话会被保存，之后可以回看。

### AI 能帮你做什么

SoulWing 可以帮助你：

- 总结自己的文章、笔记、求职和面试记录。
- 搜索你写过的内容。
- 起草博客、心得或笔记。
- 修改和润色文章。
- 草拟聊天回复。
- 总结某段聊天或频道讨论。
- 整理长期记忆。
- 读取自己的设置、简历、岗位、面试和活动概况。
- 在授权范围内查看好友公开给你的内容。
- 使用网页搜索工具核验时效性信息。

### 工具调用与权限

SoulWing 访问站内数据时，会通过受控工具完成，而不是直接读取整个数据库。工具大致分为：

- 自己的数据：读取你的资料、文章、简历、求职、面试、聊天等。
- 可见用户数据：读取好友或其他用户允许你看到的内容。
- 管理员数据：只有具备对应管理员权限时才可使用。
- 写入工具：在你明确要求时创建或修改内容。
- 记忆工具：保存、搜索、列出或删除长期记忆。
- 网页搜索工具：查询站外信息或核验当前信息。

### 记忆功能

你可以让 SoulWing 记住偏好、长期目标、项目背景或重要事实。记忆会用于之后的对话。

建议这样表达：

- 请记住我更喜欢简洁直接的回答。
- 请记住我目前正在准备后端开发岗位。
- 请记住我的项目重点是个人空间和 AI 助手。

如果某条记忆不再需要，可以在 AI 相关页面中查看、编辑或删除。

### 使用 AI 的注意事项

- AI 生成内容需要你自己判断准确性。
- 涉及求职、法律、医疗、财务等重要决策时，不要只依赖 AI。
- 如果需要 AI 读取某篇文章或某条记录，请尽量说清楚名称、时间或关键词。
- 如果你想让 AI 修改内容，请明确说明要修改哪篇、改成什么风格、保留哪些信息。
- 不要把不希望长期保存的隐私信息要求 AI 记住。

---

## SoulWing 圆桌说明

SoulWing 圆桌是围绕主题进行讨论和沉淀的空间。它可能包含早间或晚间话题、讨论记录、参与者消息和总结。

你可以把它当作一种主题讨论区：

- 查看当天或历史话题。
- 进入相关频道查看讨论。
- 阅读不同参与者的观点。
- 回看讨论总结。

如果你参与圆桌，请尽量围绕主题发言，让讨论更容易沉淀成可回顾的内容。

---

## SQL Lab 使用说明

SQL Lab 是站内数据查询和分析工具。它适合高级用户、管理员或被授权用户使用。

### 入口与权限

入口：SQL。

如果你没有 SQL 权限，页面可能会提示尚未开放访问。SQL 权限由 owner 或具备 SQL 管理权限的管理员授予。

### 页面区域

SQL Lab 通常包含：

- 左侧 Schema 树：查看可访问的数据表和字段。
- 中间 SQL 编辑器：编写查询。
- 右侧 AI Assistant：辅助生成、解释或优化 SQL。
- 下方结果区：查看查询结果、消息、历史、收藏和示例。

### 查询步骤

1. 在 Schema 树中查看你有权限访问的表。
2. 在编辑器中输入 SQL。
3. 设置查询限制条数。
4. 点击运行。
5. 在结果面板查看返回数据。
6. 如果查询有价值，可以保存为收藏查询。

### 收藏查询

常用查询可以保存，方便之后复用。建议给查询取清晰名称，并填写说明。

### 历史记录

执行过的查询会进入历史记录，方便回看。管理员可能能看到 SQL 审计记录，用于排查问题和保护数据安全。

### AI SQL 助手

SQL Lab 中的 AI 助手可以帮助：

- 根据自然语言生成查询。
- 解释查询含义。
- 提醒可能的表或字段。
- 调整查询限制。

使用时请尽量描述清楚你想分析什么，例如：

- 统计我最近 30 天每天写了多少篇文章。
- 查出我所有状态为面试中的求职记录。
- 汇总每个网站资源的访问次数。

### 安全注意事项

- 只能查询你被授权访问的数据。
- 不要尝试绕过权限。
- 不要查询或导出无关人员的敏感信息。
- 大范围查询前先加限制条数。
- 如果不确定某条 SQL 是否安全，先让 AI 或管理员帮你检查。

---

## 管理后台说明

管理后台只对 owner 或管理员开放。不同管理员能看到的功能取决于被授予的权限。

### 常见管理能力

后台可能包含：

- 注册审核。
- 密码修改审核。
- 用户管理。
- 管理员权限配置。
- 活动日志查看。
- 公告和广播管理。
- 公共表情管理。
- 更新日志管理。
- AI 访问申请和授权管理。
- AI 使用量统计。
- SQL Lab 访问授权。
- SQL 审计。
- 简历模板管理。

### 管理员权限

管理员权限是细分的，不是所有管理员都拥有全部能力。常见权限包括：

- 注册审核。
- 密码修改审核。
- 活动日志。
- 成员管理。
- 公告广播。
- 公共表情。
- 更新日志。
- IP 地理位置刷新。
- AI 助手管理。
- SQL Lab 管理。

owner 默认拥有所有权限，并可以给其他管理员分配部分权限。

### 管理建议

- 审核注册时确认用户来源。
- 修改用户角色前确认必要性。
- 发布公告时保持简洁明确。
- 给 AI 或 SQL 权限时按最小必要原则授权。
- 定期查看活动和审计日志。
- 对公共资源进行清理，避免无效、重复或敏感内容长期存在。

---

## 公开主页与好友可见内容

网站支持访问用户主页以及用户公开或好友可见的内容。用户主页通常包括个人资料、文章、简历、求职或面试等模块，但具体展示取决于可见性设置。

如果你访问别人的主页：

- 能看到的内容不代表对方全部资料，只代表对方开放给你的部分。
- 不要复制或传播对方的私密内容。
- 如果需要引用对方内容，最好先征得对方同意。

如果你管理自己的主页：

- 定期检查好友可见范围。
- 简历、求职和面试内容要谨慎开放。
- 博客和知识内容可以作为对外展示重点。

---

## 上传与附件说明

网站中多个模块可能支持上传，例如头像、文章图片、简历 PDF、聊天附件、频道附件、网站截图和表情。

上传建议：

- 文件命名尽量清晰。
- 不上传身份证、银行卡、合同等敏感文件。
- 简历 PDF 注意版本区分。
- 聊天附件只发给可信任的人。
- 公共社区资源不要包含个人隐私。

如果上传后看不到文件，可能是网络、权限、文件类型或大小限制导致，可以刷新页面或重新上传。

---

## 通知、未读与实时状态

网站会尽量维护实时状态，例如：

- 好友私聊未读数。
- 频道消息更新。
- 最近活动刷新。
- 在线、离开、离线状态。
- 公告查看状态。

如果未读数量没有立即变化，可以进入对应会话或刷新页面。网络不稳定时，实时状态可能会延迟。

---

## 推荐使用方式

### 日常记录型用法

- 每天用日常记录生活和碎片想法。
- 用笔记保存资料和链接。
- 每周用心得做一次复盘。
- 首页查看连续写作和贡献热力图。

### 求职管理型用法

- 简历模块维护主简历。
- 求职模块记录每一次投递。
- 面试模块记录每一轮面试。
- 首页看投递漏斗。
- 让 SoulWing 定期总结求职进度和面试短板。

### 知识库型用法

- 用笔记沉淀知识。
- 用博客输出成体系文章。
- 用标签统一主题。
- 用文件夹管理专题。
- 用 AI 搜索旧内容，避免重复整理。

### 社交协作型用法

- 添加可信好友。
- 开放适合分享的模块。
- 用私聊讨论具体事项。
- 用频道讨论长期主题。
- 用社区资源库沉淀大家都能用的工具和网站。

### 数据分析型用法

- 首页看概览。
- SQL Lab 查细节。
- 保存常用查询。
- 用 AI 解释数据变化。
- 通过数据反推写作、求职或社交习惯。

---

## 隐私与边界

这个网站包含很多个人数据，因此使用时要特别注意边界。

请记住：

- 你只能访问自己有权限的数据。
- 好友能看到什么，由资料可见范围决定。
- 管理员权限应按需分配。
- AI 通过工具读取数据，不应该被当作无限权限入口。
- 社区资源默认更接近公共空间，发布前要确认不含隐私。
- SQL Lab 应只用于正当的数据分析。
- 上传文件前要确认是否适合长期保存在站内。

---

## 常见问题

### 为什么我看不到某个模块

可能原因：

- 没有登录。
- 当前账号没有权限。
- 对方没有向好友开放该模块。
- 管理员没有授予相关权限。
- 页面数据为空。

### 为什么好友看不到我的内容

请检查设置中的资料可见范围。文章本身的可见性也会影响好友是否能看到。

### 为什么 AI 回答不知道我的某些信息

SoulWing 不是天然知道所有站内内容。它需要通过工具读取数据。你可以更明确地告诉它要查什么，例如文章标题、岗位名称、面试日期或关键词。

### 为什么 SQL Lab 不能查询某张表

SQL Lab 受管理员授权控制。你只能看到被授权的表和字段。需要更多权限时，请联系 owner 或管理员。

### 为什么首页数据和我预期不一致

首页数据来自多个模块的聚合。请检查对应模块的数据是否已经填写完整，例如求职状态、文章日期、聊天记录或可见性设置。

### 为什么中文界面有些地方显示异常

如果个别地方出现乱码或文案异常，说明该位置可能存在历史编码问题。可以把具体页面反馈给管理员或开发者处理。

---

## 最后建议

这个网站最适合长期使用。不要只把它当作一次性展示页，而是把它当作一个持续更新的个人系统。

每天记录一点内容，每次求职及时更新，每轮面试认真复盘，看到好资源就收藏或分享，和 SoulWing 逐渐建立上下文。时间久了，这里会变成一个能回看过去、支持现在、辅助未来的个人工作台。
`

const enGuide = `
# User Manual

## What This Website Is

This website is a personal workspace for writing, knowledge management, resume building, job tracking, interview review, trusted social interaction, community resources, AI assistance, and data analysis.

You can use it to:

- Write blogs, daily logs, reflections, and notes.
- Maintain online and PDF resumes.
- Track job applications and interview rounds.
- View your personal dashboard, writing stats, job funnel, visits, and messages.
- Add friends, chat privately, and join channels.
- Share useful websites and stickers with the community.
- Use SoulWing as a personal AI assistant with tools and memory.
- Use SQL Lab to analyze authorized site data.
- Use the admin console to manage users, permissions, announcements, AI access, SQL access, and resources.

---

## Quick Start

1. Open Settings and complete your profile.
2. Choose your language.
3. Review visibility settings for friends.
4. Return to Home and customize the dashboard layout.
5. Create or upload your resume.
6. Write your first Blog, Daily, Reflection, or Note.
7. Add job applications and interview records if you are job hunting.
8. Add trusted friends and start conversations.
9. Open AI and configure or request access to SoulWing.
10. Open SQL Lab if you have data access permissions.

---

## Navigation

| Entry | Purpose |
|------|---------|
| Home | Dashboard, recent activity, stats, job funnel, visits, guestbook |
| Community | Shared resources and community areas |
| Resume | View and manage your resume |
| Blog | Formal articles, tutorials, project summaries |
| Daily | Everyday logs and quick thoughts |
| Reflections | Reviews, insights, learning notes |
| Notes | Knowledge base and reference material |
| Jobs | Job application tracking |
| Interviews | Interview records and review |
| AI | SoulWing personal AI assistant |
| SQL | SQL Lab data workspace |
| Friends | Friends, direct messages, unread messages |
| Admin | Admin-only management area |
| Settings | Profile, password, visibility, language, and this manual |

---

## Settings

Use Settings to manage your personal space.

Profile lets you update display name, avatar, location, bio, and email.

Password lets you submit a password change request. The request must be approved by an administrator.

Visibility controls what friends can see, including home, resume, blogs, daily logs, reflections, notes, jobs, and interviews.

Language switches between Chinese and English.

Home layout editing sends you back to the home dashboard where you can reorder, resize, hide, and restore cards.

---

## Home Dashboard

Home is your command center. It can show:

- Profile card.
- Announcements and channel updates.
- Recent activity from chats, friends, community resources, and SoulWing roundtable.
- Writing statistics, including article count, word count, streak, monthly additions, and tags.
- Latest articles and daily logs.
- Chat activity.
- Job funnel from applications to replies, interviews, and offers.
- Recent job updates.
- Visit statistics.
- Guestbook messages.
- Contribution heatmap.

Use layout editing to place your most important cards near the top.

---

## Writing

The site supports four content types:

| Type | Best For |
|------|----------|
| Blog | Formal posts, tutorials, long-form output |
| Daily | Life logs and quick thoughts |
| Reflections | Reviews, lessons, reading notes |
| Notes | Knowledge base, references, quick captures |

Each content type can support titles, summaries, tags, folders, cover images, Markdown content, visibility settings, reading pages, editing pages, and comments.

Recommended habits:

- Use clear titles.
- Keep tags short and consistent.
- Use folders for projects or topics.
- Write summaries for long posts.
- Keep private content private.

---

## Resume

The Resume module supports both structured online resumes and uploaded PDF resumes.

Online resumes are best for long-term maintenance. You can fill structured sections, choose templates, reorder sections, hide sections, customize labels, preview, build, and export.

PDF resumes are best when you already have a finished file. Give each PDF version a clear name, such as English Backend Resume 2026-05 or Product Manager Version.

If a template does not show some fields, the template may not support those fields. Try another template or adjust output options.

---

## Jobs and Interviews

Use Jobs to track applications. A job record can include company, role, channel, application date, status, link, and notes.

Update status whenever progress changes. This keeps the home job funnel useful.

Use Interviews to record each interview round. Include the related job, time, format, interviewer, questions, your answers, result, self-rating, and review notes.

After every interview, record details as soon as possible. Later, SoulWing can help summarize patterns and weak spots.

---

## Friends, Chats, and Channels

Friends are trusted relationships. What friends can see depends on visibility settings.

Direct chat supports text, stickers, attachments, and quote replies. Use quote replies when context matters.

Channels are for group conversations, announcements, member management, attachments, and longer-running discussions.

Do not send sensitive files unless you trust the recipient and understand who can access the conversation.

---

## Community Resources

The website resource library lets users share useful websites with names, links, screenshots, descriptions, tags, folders, and visibility settings.

Good resources include tools, learning materials, documentation, job-hunting resources, design references, and useful collections.

Avoid sharing private links, internal pages, sensitive URLs, or unreliable downloads.

The sticker community lets users browse public stickers, add them to their own library, and contribute stickers.

---

## SoulWing AI Assistant

SoulWing is your personal AI assistant. It can use controlled tools to read permitted site data, search your content, draft writing, summarize jobs and interviews, draft chat replies, manage memories, read channel context, and use web search.

SoulWing does not directly access the entire database. It works through server-side tools with permission scopes.

You can ask it to remember stable preferences or facts. You can also review and delete memories later.

Important notes:

- Review AI-generated content before using it.
- Be specific about what you want SoulWing to read or change.
- Do not ask it to remember sensitive information unless you really want that stored.
- For important decisions, use AI as assistance, not as the final authority.

---

## SQL Lab

SQL Lab is an authorized data analysis workspace.

It usually includes a schema tree, SQL editor, AI assistant panel, results, messages, history, saved queries, and examples.

Basic workflow:

1. Check accessible tables in the schema tree.
2. Write a SQL query.
3. Set a result limit.
4. Run the query.
5. Review results.
6. Save useful queries.

SQL access is controlled by administrators. Only query data you are allowed to access.

---

## Admin Console

The Admin area is available to the owner and authorized admins.

It may include registration review, password change approval, user management, admin permissions, activity logs, announcements, stickers, update logs, AI access and grants, AI usage analytics, SQL Lab access, SQL audit, and resume theme management.

Admin permissions are granular. The owner can assign only the capabilities each admin needs.

---

## Privacy and Boundaries

- You can only access data you have permission to see.
- Friends can only see modules you expose to them.
- Community resources are more public, so avoid private information.
- AI uses tools and should not be treated as an unlimited access channel.
- SQL Lab should be used only for legitimate analysis.
- Uploaded files may remain stored on the server, so upload carefully.

---

## Recommended Workflows

For daily journaling: write Daily entries, collect Notes, publish Reflections weekly, and watch the contribution heatmap.

For job hunting: maintain your Resume, track every Job, review every Interview, and ask SoulWing to summarize progress.

For knowledge management: use Notes for raw material, Blogs for polished output, tags for themes, and folders for structure.

For collaboration: add trusted friends, open selected modules, use chats for specific topics, and use channels for longer discussions.

For data analysis: start with the Home dashboard, use SQL Lab for details, save recurring queries, and ask AI to explain trends.
`

export default async function SettingsUsagePage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  const source = settings.language === "en-US" ? enGuide : zhGuide

  return (
    <SettingsShell
      title={dict.settings.usageTitle}
      backLabel={dict.common.back}
      eyebrow={settings.language === "en-US" ? "Settings · Guide" : "设置 · 使用说明"}
    >
      <SettingsSection icon={<BookOpen size={16} />} bodyClassName="px-5 py-6 sm:px-8 sm:py-8">
        <MarkdownContent source={source} />
      </SettingsSection>
    </SettingsShell>
  )
}
