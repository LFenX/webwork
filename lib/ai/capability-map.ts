import "server-only"

export type CapabilityTool = {
  name: string
  title: string
  whenToUse: string
  triggers: string[]
}

export type CapabilityCategory = {
  id: string
  label: string
  description: string
  tools: CapabilityTool[]
}

export const AI_CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    id: "self-profile",
    label: "个人资料与设置",
    description: "读取当前用户的基础信息、权限、设置和主页概况",
    tools: [
      { name: "get_my_profile", title: "我的基础资料", whenToUse: "查询昵称、邮箱、简介", triggers: ["我叫什么", "我的邮箱", "我的资料", "我的简介"] },
      { name: "get_my_permissions", title: "我的权限", whenToUse: "查询角色、管理员权限、模块开放设置", triggers: ["我是不是管理员", "我有哪些权限", "我的模块对好友是否开放"] },
      { name: "get_my_module_visibility", title: "模块开放设置", whenToUse: "只查询主页各模块对好友/公开的可见性", triggers: ["我的模块对谁开放", "哪些模块是公开的", "模块可见性设置"] },
      { name: "get_my_settings", title: "站点设置", whenToUse: "查询语言、ownerName 等配置", triggers: ["我的设置", "站点语言", "网站配置"] },
      { name: "get_my_home_overview", title: "主页概况", whenToUse: "查询主页模块和内容分布", triggers: ["我的主页有什么", "主页概况", "首页模块"] },
      { name: "get_my_sessions_overview", title: "登录会话", whenToUse: "查询登录设备、IP、安全状态", triggers: ["我在哪里登录", "我的设备", "登录记录", "会话安全"] },
      { name: "get_my_activity_log", title: "活动日志", whenToUse: "查询系统操作日志、登录登出记录（不是 AI 对话记录）", triggers: ["我最近的操作记录", "系统活动日志", "登录登出记录", "我访问了哪些页面"] },
    ],
  },
  {
    id: "resume",
    label: "简历",
    description: "读取用户简历概况或全文",
    tools: [
      { name: "get_my_resume_overview", title: "简历概况", whenToUse: "查询简历模式、版本数量", triggers: ["我的简历有几个版本", "简历概况"] },
      { name: "get_my_resume_detail", title: "简历全文", whenToUse: "读取全文、润色、总结", triggers: ["看看我的简历", "帮我润色简历", "总结我的简历", "简历内容是什么"] },
      { name: "get_my_resume_versions", title: "简历版本列表", whenToUse: "查询 PDF 版本列表", triggers: ["简历有哪些版本", "简历 PDF"] },
    ],
  },
  {
    id: "posts",
    label: "文章/博客/日常/心得/笔记",
    description: "列出、搜索、读取、创建、修改文章及管理文件夹",
    tools: [
      { name: "get_my_posts_overview", title: "文章概览", whenToUse: "查询文章总量和分布", triggers: ["我写了多少文章", "文章概况"] },
      { name: "list_my_posts", title: "文章列表", whenToUse: "列出某类文章", triggers: ["列出我的博客", "看看我的日常", "我的笔记有哪些"] },
      { name: "search_my_posts", title: "搜索文章", whenToUse: "按关键词搜索文章", triggers: ["找找有没有关于某个主题的文章", "搜索我的笔记", "找到那篇博客"] },
      { name: "list_markdown_articles", title: "文章列表（按文件夹）", whenToUse: "按模块、文件夹或关键词列出文章，用于编辑前定位", triggers: ["列出某文件夹下的文章", "按文件夹查文章"] },
      { name: "get_my_post_detail", title: "文章详情", whenToUse: "查看某篇文章的标题、摘要、标签等元信息（不含全文）", triggers: ["那篇文章的标签是什么", "文章摘要", "文章的元信息"] },
      { name: "get_my_post_content", title: "文章全文", whenToUse: "读取某篇文章全文", triggers: ["读一下那篇文章", "给我看那篇博客的全文", "文章内容是什么"] },
      { name: "get_markdown_article_detail", title: "文章详情（含正文，用于编辑）", whenToUse: "读取某篇文章的完整详情含正文，便于编辑前参考", triggers: ["读取文章用于修改", "编辑前看一下原文"] },
      { name: "create_markdown_article", title: "创建文章", whenToUse: "创建新博客/日常/心得/笔记", triggers: ["帮我写一篇博客", "新建一篇日常", "创建一篇笔记"] },
      { name: "update_markdown_article", title: "修改文章", whenToUse: "修改标题/正文/摘要/标签/可见性", triggers: ["修改那篇文章的标题", "帮我改一下博客内容", "更新文章正文"] },
      { name: "list_content_folders", title: "列出文件夹", whenToUse: "查看文件夹列表", triggers: ["我有哪些文件夹", "列出博客文件夹"] },
      { name: "create_content_folder", title: "创建文件夹", whenToUse: "创建新文件夹/分类", triggers: ["创建一个文件夹", "新建分类"] },
      { name: "move_article_to_folder", title: "移动文章", whenToUse: "将文章移动到指定文件夹或跨模块移动", triggers: ["把这篇文章移到某个分类", "移动文章到另一个分类"] },
    ],
  },
  {
    id: "jobs",
    label: "求职记录",
    description: "读取求职投递记录和详情",
    tools: [
      { name: "get_my_jobs_overview", title: "求职概况", whenToUse: "查询求职整体进展、回复率", triggers: ["我投了多少简历", "求职情况怎么样", "回复率如何"] },
      { name: "list_my_jobs", title: "求职记录列表", whenToUse: "列出投递岗位", triggers: ["我投了哪些岗位", "最近投递记录", "某个公司投递了吗"] },
      { name: "get_my_job_detail", title: "求职详情", whenToUse: "查看某条投递的完整字段", triggers: ["那条投递的详情", "某岗位的进展如何"] },
    ],
  },
  {
    id: "interviews",
    label: "面试记录",
    description: "读取面试记录、复盘和详情",
    tools: [
      { name: "get_my_interviews_overview", title: "面试概况", whenToUse: "查询面试整体情况、通过率", triggers: ["面试通过率多少", "面试情况怎么样"] },
      { name: "list_my_interviews", title: "面试记录列表", whenToUse: "列出面试记录", triggers: ["我参加了哪些面试", "最近的面试", "某公司的面试"] },
      { name: "get_my_interview_detail", title: "面试详情", whenToUse: "查看某次面试的题目、反馈", triggers: ["那次面试的详情", "面试题目是什么", "面试复盘"] },
    ],
  },
  {
    id: "uploads-pdf",
    label: "上传文件与 PDF 解析",
    description: "查看上传记录，以及读取/搜索本次会话中附带的 PDF 附件内容",
    tools: [
      { name: "get_my_uploads_overview", title: "上传概览", whenToUse: "查看最近上传的文件记录", triggers: ["我上传过哪些文件", "最近上传记录", "我的上传"] },
      { name: "list_my_pdf_documents", title: "本次会话的 PDF 列表", whenToUse: "列出本次对话附带的 PDF 及解析状态", triggers: ["我传的PDF", "这次对话的PDF", "PDF解析好了吗"] },
      { name: "read_my_pdf_document", title: "读取 PDF 内容", whenToUse: "阅读或总结本次会话某个 PDF 的内容", triggers: ["读一下这个PDF", "总结这份PDF", "PDF讲了什么"] },
      { name: "search_my_pdf_documents", title: "搜索 PDF 内容", whenToUse: "在本次会话的 PDF 中按关键词检索相关页面", triggers: ["PDF里有没有提到", "在PDF里找", "PDF第几页讲了"] },
      { name: "get_pdf_parse_status", title: "PDF 解析状态", whenToUse: "查询某个 PDF 是否解析完成、失败或用了哪个引擎", triggers: ["PDF解析状态", "PDF解析失败了吗", "PDF还在处理吗"] },
    ],
  },
  {
    id: "knowledge",
    label: "知识库 / 错题本",
    description: "把错题、资料、资讯整理收录成结构化笔记，并快速召回引用",
    tools: [
      { name: "compose_knowledge_note", title: "整理收录知识/错题笔记", whenToUse: "把错题/资料/资讯（含图片或PDF内容）整理成结构化笔记或追加到已有笔记", triggers: ["把这道错题记下来", "整理成错题本", "收录这份资料", "把这些资讯整理成笔记"] },
      { name: "search_knowledge_notes", title: "召回知识/错题笔记", whenToUse: "找回之前收录的某道错题、资料或资讯", triggers: ["我之前记的那道错题", "找一下我收录的资料", "召回错题本"] },
    ],
  },
  {
    id: "pdf-generation",
    label: "生成 PDF 文档 (LaTeX)",
    description: "用 LaTeX 把内容编译成精美中文 PDF，支持模板/主题/配色与超长多章草稿",
    tools: [
      { name: "list_latex_templates", title: "列出 PDF 模板/主题/配色", whenToUse: "生成 PDF 前选择内容类型、视觉主题与配色", triggers: ["有哪些PDF模板", "PDF样式有哪些", "PDF能用什么主题"] },
      { name: "compile_latex_pdf", title: "生成/导出 PDF", whenToUse: "把内容（错题/资料/笔记等）编译导出为 PDF 文档", triggers: ["导出成PDF", "生成一个PDF", "把这些做成PDF", "换个样式重新生成PDF"] },
      { name: "set_latex_doc_config", title: "设置 PDF 文档样式", whenToUse: "调整 PDF 的模板、主题、配色、字体、封面/目录等外观", triggers: ["PDF加个封面", "换个PDF配色", "调一下PDF字号", "PDF换主题"] },
      { name: "get_latex_doc_config", title: "读取 PDF 文档配置", whenToUse: "查看当前会话 PDF 的模板与参数设置", triggers: ["现在PDF是什么配置", "当前PDF用的什么模板"] },
      { name: "start_latex_draft", title: "新建长文档草稿大纲", whenToUse: "生成很长/多章 PDF 时先声明章节大纲，分章写入避免截断", triggers: ["写一份很长的PDF", "做一本多章的教程", "几十页的文档"] },
      { name: "append_latex_draft_section", title: "写入草稿章节", whenToUse: "为长文档草稿逐章写入完整正文", triggers: ["写下一章", "继续写这一章"] },
      { name: "get_latex_draft_status", title: "查看草稿进度", whenToUse: "查看长文档草稿还差哪些章节", triggers: ["草稿写到哪了", "还差几章", "草稿进度"] },
      { name: "compile_latex_draft", title: "编译长文档草稿为 PDF", whenToUse: "草稿章节写齐后组装并编译成最终 PDF", triggers: ["把草稿编译成PDF", "长文档生成PDF"] },
    ],
  },
  {
    id: "web-search",
    label: "联网搜索",
    description: "搜索互联网信息、核验时效性内容（不用于站内私有数据）",
    tools: [
      { name: "web_search", title: "联网搜索", whenToUse: "需要外部网页资料、热点、新闻、技术资料时搜索", triggers: ["上网搜一下", "网上有没有", "查一下", "搜索一下最新的"] },
      { name: "web_verify_current_info", title: "核验当前信息", whenToUse: "问题涉及最新/当前/价格/版本/政策等可能过时的信息时核验", triggers: ["现在是多少", "最新的", "今天的", "当前的价格", "最新版本"] },
    ],
  },
  {
    id: "soulwing-conversations",
    label: "蝶灵对话历史与圆桌",
    description: "查询用户与蝶灵 SoulWing 的 AI 对话记录、统计、主题、摘要，以及蝶灵圆桌讨论记录",
    tools: [
      { name: "search_soulwing_conversations", title: "搜索蝶灵对话历史", whenToUse: "查询与蝶灵的对话次数、主题、摘要或消息内容", triggers: ["我跟你聊了几次", "我和你聊了什么", "我最近和你聊了什么", "我们之前聊过什么", "我问过你什么", "你记得我之前问过你吗", "和蝶灵的对话", "AI助手聊天记录", "我们还聊过什么", "之前聊了什么主题", "过去一天聊了什么", "最近两小时聊了几次"] },
      { name: "get_soulwing_roundtable_records", title: "读取蝶灵圆桌记录", whenToUse: "回顾蝶灵圆桌的公告、今日主题、发言和总结", triggers: ["蝶灵圆桌", "今天圆桌讨论了什么", "圆桌总结", "错过圆桌补课"] },
      { name: "search_user_memory", title: "搜索长期记忆", whenToUse: "搜索用户保存的记忆、对话摘要和工具操作记录", triggers: ["还记得吗", "之前怎么说的", "按照我的习惯", "你记得我们聊过什么吗"] },
    ],
  },
  {
    id: "chat",
    label: "聊天记录",
    description: "查看好友聊天和群聊的概况、搜索消息、读取聊天线程（不是 AI 对话）",
    tools: [
      { name: "get_my_chat_summary", title: "聊天摘要统计", whenToUse: "查询私聊和频道聊天的整体摘要统计", triggers: ["我的聊天总体情况", "私聊和群聊统计", "聊天摘要"] },
      { name: "get_my_chat_threads_overview", title: "聊天线程概况", whenToUse: "查询最近和哪个好友聊得最多", triggers: ["和哪个好友聊得最多", "好友聊天排行"] },
      { name: "search_my_chat_messages", title: "搜索聊天消息", whenToUse: "按关键词搜索好友聊天记录", triggers: ["搜索好友聊天记录", "找找和某人的聊天消息", "好友聊天记录里有没有某内容"] },
      { name: "get_my_chat_thread_messages", title: "聊天线程消息", whenToUse: "查看和某个好友的聊天内容", triggers: ["和某位好友的聊天记录", "查看和好友的消息"] },
      { name: "list_my_channels", title: "列出群聊", whenToUse: "列出所有群聊频道", triggers: ["我的群聊有哪些", "我在哪些群里", "群聊列表"] },
      { name: "get_channel_messages", title: "群聊消息", whenToUse: "读取指定群聊的消息", triggers: ["群里最近聊了什么", "看看群消息", "群聊记录"] },
      { name: "send_draft_chat_message", title: "草拟回复", whenToUse: "起草聊天回复（不发送）", triggers: ["帮我回复他", "替我在群里回一句", "起草一条消息"] },
      { name: "summarize_chat_thread", title: "总结聊天", whenToUse: "总结好友或群聊的聊天记录主题", triggers: ["总结一下和某人的聊天", "好友聊天重点", "群聊摘要"] },
    ],
  },
  {
    id: "friends",
    label: "好友",
    description: "查看好友数量、列表、互动明细和好友资料",
    tools: [
      { name: "get_my_friends_overview", title: "好友概览", whenToUse: "查询好友数量和最近关系概览", triggers: ["我有多少好友", "好友概况", "最近加了哪些好友"] },
      { name: "get_my_friends_detail", title: "好友明细", whenToUse: "查询好友列表与最近互动明细", triggers: ["好友互动明细", "好友关系详情"] },
      { name: "list_my_friends", title: "好友列表", whenToUse: "查询好友资料列表", triggers: ["我有哪些好友", "列出好友", "好友列表"] },
      { name: "get_my_friend_profile", title: "好友资料", whenToUse: "查看某位好友的昵称、邮箱、个签", triggers: ["某好友的资料是什么", "好友的邮箱", "某好友最近互动"] },
    ],
  },
  {
    id: "memory",
    label: "长期记忆",
    description: "保存、搜索、列出、删除用户的长期记忆",
    tools: [
      { name: "save_user_memory", title: "保存记忆", whenToUse: "用户明确说【记住……】时保存", triggers: ["记住我", "以后都按照", "这是我的偏好", "记下来我喜欢"] },
      { name: "search_user_memory", title: "搜索记忆", whenToUse: "用户问【还记得……】或【之前怎么决定的】时搜索", triggers: ["还记得吗", "之前怎么说的", "按照我的习惯"] },
      { name: "list_user_memories", title: "记忆列表", whenToUse: "用户问【你记住了我什么】时列出", triggers: ["你记住了我什么", "列出我的记忆", "我的偏好有哪些"] },
      { name: "forget_user_memory", title: "删除记忆", whenToUse: "用户要求【忘掉这条记忆】时删除", triggers: ["忘掉", "删除这条记忆", "不要记住"] },
      { name: "delete_my_memory_fact_batch", title: "批量删除记忆", whenToUse: "用户要求按标签或分类批量删除记忆", triggers: ["忘掉所有关于XX的记忆", "删掉所有XX类型的记忆", "清除标签为XX的记忆"] },
    ],
  },
  {
    id: "persona",
    label: "人格配置",
    description: "更新蝶灵的身份、性格、用户认知或行为规则",
    tools: [
      { name: "update_agent_profile", title: "更新人格配置", whenToUse: "用户明确要修改蝶灵的长期行为风格", triggers: ["以后你叫", "以后你回答风格要", "我正在做的长期项目是", "以后必须遵守"] },
      { name: "propose_save_user_context", title: "提议保存用户背景", whenToUse: "从对话中抽取用户长期信息提议写入", triggers: ["我在做某个项目", "我正在学", "我的习惯是"] },
    ],
  },
  {
    id: "auto-reply",
    label: "自动回复",
    description: "读取和修改自动回复设置",
    tools: [
      { name: "get_auto_reply_settings", title: "读取自动回复设置", whenToUse: "用户询问自动回复配置状态", triggers: ["我的自动回复怎么设置的", "帮我看看自动回复", "有哪些自动回复规则"] },
      { name: "update_auto_reply_settings", title: "修改自动回复设置", whenToUse: "用户要求修改自动回复开关/模板/方式", triggers: ["帮我打开自动回复", "关闭自动回复", "设置自动回复模板", "调整冷却时间"] },
    ],
  },
  {
    id: "module-settings",
    label: "模块可见性",
    description: "设置各模块的 private/friends/public 可见性",
    tools: [
      { name: "set_module_visibility", title: "设置模块可见性", whenToUse: "用户要求公开、对好友开放或隐藏某个模块", triggers: ["把博客设为公开", "把博客设为好友可见", "关闭简历对好友的可见", "让好友看不到我的求职记录"] },
    ],
  },
  {
    id: "visible-user",
    label: "好友可见内容",
    description: "读取其他用户（好友）的可见主页内容",
    tools: [
      { name: "get_visible_user_permissions", title: "好友权限", whenToUse: "查询我能不能看某好友的内容", triggers: ["我能看某好友的简历吗", "好友的主页对我开放了哪些"] },
      { name: "get_visible_user_home_overview", title: "好友主页概况", whenToUse: "查看好友主页可见内容", triggers: ["好友的主页有什么", "看看某人的主页"] },
      { name: "get_visible_user_resume_detail", title: "好友简历", whenToUse: "读取好友简历全文（需权限）", triggers: ["看看好友的简历", "好友的简历内容"] },
      { name: "list_visible_user_posts", title: "好友文章列表", whenToUse: "列出好友可见文章", triggers: ["好友写了哪些博客", "看看好友的日常"] },
      { name: "get_visible_user_post_content", title: "好友文章全文", whenToUse: "读取有权限查看的好友某篇文章全文", triggers: ["看看好友那篇博客全文", "读好友的文章"] },
      { name: "list_visible_user_jobs", title: "好友求职记录", whenToUse: "查看好友求职记录（需权限）", triggers: ["好友在找什么工作", "好友的求职情况"] },
      { name: "get_visible_user_job_detail", title: "好友求职详情", whenToUse: "查看有权限的好友某条求职记录", triggers: ["好友那条投递的详情"] },
      { name: "list_visible_user_interviews", title: "好友面试记录", whenToUse: "查看好友面试记录（需权限）", triggers: ["好友参加了哪些面试"] },
      { name: "get_visible_user_interview_detail", title: "好友面试详情", whenToUse: "查看有权限的好友某条面试记录", triggers: ["好友那次面试的详情"] },
    ],
  },
  {
    id: "admin",
    label: "管理员后台",
    description: "管理员视角读取用户数据、AI 授权和审计日志",
    tools: [
      { name: "get_admin_self_permissions", title: "我的管理员权限", whenToUse: "管理员确认自己的角色和管理员权限", triggers: ["我有哪些管理员权限", "我是超级管理员吗"] },
      { name: "list_admin_users", title: "后台用户列表", whenToUse: "管理员列出或搜索用户", triggers: ["后台用户有哪些", "查找用户"] },
      { name: "get_admin_user_detail", title: "后台用户详情", whenToUse: "管理员查看某用户详细信息", triggers: ["某人的用户详情", "查看用户的状态"] },
      { name: "list_admin_user_sessions", title: "后台用户会话", whenToUse: "管理员查看某用户登录会话", triggers: ["某用户最近从哪里登录", "用户的会话记录"] },
      { name: "list_admin_user_activity_logs", title: "后台用户活动日志", whenToUse: "管理员查看某用户操作记录", triggers: ["某人的操作日志", "用户的活动记录"] },
      { name: "list_admin_ai_access_requests", title: "AI 访问申请列表", whenToUse: "管理员查看 AI 访问申请记录", triggers: ["谁申请了AI访问", "AI访问申请"] },
      { name: "list_admin_ai_grants", title: "AI 授权列表", whenToUse: "管理员查看 AI 使用授权记录", triggers: ["AI授权记录", "谁有AI权限"] },
      { name: "list_admin_ai_audit_logs", title: "AI 审计日志", whenToUse: "管理员查看 AI 使用审计轨迹", triggers: ["AI 审计日志", "谁用了 AI", "AI 使用记录"] },
      { name: "get_admin_overview", title: "后台总览", whenToUse: "管理员先看后台统计再决策", triggers: ["后台总览", "系统统计"] },
    ],
  },
  {
    id: "capabilities",
    label: "查询工具能力",
    description: "查询蝶灵自身能做什么，列出或搜索可用工具",
    tools: [
      { name: "list_my_capabilities", title: "列出全部能力", whenToUse: "用户问【你能做什么】时列出工具分类", triggers: ["你能做什么", "你有哪些功能", "你会什么", "你有什么工具"] },
      { name: "search_my_capabilities", title: "搜索能力", whenToUse: "用户问【你能不能……】时搜索相关工具", triggers: ["你能不能", "有没有工具可以", "你支持吗"] },
    ],
  },
  {
    id: "diagnostics",
    label: "运行诊断",
    description: "查看上一轮助手运行的真实元数据（技能注入、PDF 生成信息）",
    tools: [
      { name: "get_last_run_metadata", title: "查看上一轮运行元数据", whenToUse: "用户问刚才用了哪些技能/模板/主题或上次 PDF 元数据时", triggers: ["你刚才用了什么技能", "用了哪个PDF模板", "上次PDF用了什么主题", "有没有用PDF skill"] },
    ],
  },
]

export function buildCapabilitySummaryText(): string {
  return [
    "【蝶灵能力清单 — 遇到以下类型问题请优先调用对应工具，不要用'我无法获取'拒绝可以通过工具解决的问题】",
    ...AI_CAPABILITY_CATEGORIES.map(
      (cat) => `- ${cat.label}：${cat.tools.map((t) => t.name).join("、")}`,
    ),
  ].join("\n")
}
