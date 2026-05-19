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
      { name: "get_my_post_content", title: "文章全文", whenToUse: "读取某篇文章全文", triggers: ["读一下那篇文章", "给我看那篇博客的全文", "文章内容是什么"] },
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
    id: "soulwing-conversations",
    label: "蝶灵对话历史",
    description: "查询用户与蝶灵 SoulWing 的 AI 对话记录、统计、主题和摘要",
    tools: [
      { name: "search_soulwing_conversations", title: "搜索蝶灵对话历史", whenToUse: "查询与蝶灵的对话次数、主题、摘要或消息内容", triggers: ["我跟你聊了几次", "我和你聊了什么", "我最近和你聊了什么", "我们之前聊过什么", "我问过你什么", "你记得我之前问过你吗", "和蝶灵的对话", "AI助手聊天记录", "我们还聊过什么", "之前聊了什么主题", "过去一天聊了什么", "最近两小时聊了几次"] },
      { name: "search_user_memory", title: "搜索长期记忆", whenToUse: "搜索用户保存的记忆、对话摘要和工具操作记录", triggers: ["还记得吗", "之前怎么说的", "按照我的习惯", "你记得我们聊过什么吗"] },
    ],
  },
  {
    id: "chat",
    label: "聊天记录",
    description: "查看好友聊天和群聊的概况、搜索消息、读取聊天线程（不是 AI 对话）",
    tools: [
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
    description: "查看好友列表和好友资料",
    tools: [
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
      { name: "list_visible_user_jobs", title: "好友求职记录", whenToUse: "查看好友求职记录（需权限）", triggers: ["好友在找什么工作", "好友的求职情况"] },
      { name: "list_visible_user_interviews", title: "好友面试记录", whenToUse: "查看好友面试记录（需权限）", triggers: ["好友参加了哪些面试"] },
    ],
  },
  {
    id: "admin",
    label: "管理员后台",
    description: "管理员视角读取用户数据、AI 授权和审计日志",
    tools: [
      { name: "list_admin_users", title: "后台用户列表", whenToUse: "管理员列出或搜索用户", triggers: ["后台用户有哪些", "查找用户"] },
      { name: "get_admin_user_detail", title: "后台用户详情", whenToUse: "管理员查看某用户详细信息", triggers: ["某人的用户详情", "查看用户的状态"] },
      { name: "list_admin_user_sessions", title: "后台用户会话", whenToUse: "管理员查看某用户登录会话", triggers: ["某用户最近从哪里登录", "用户的会话记录"] },
      { name: "list_admin_user_activity_logs", title: "后台用户活动日志", whenToUse: "管理员查看某用户操作记录", triggers: ["某人的操作日志", "用户的活动记录"] },
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
]

export function buildCapabilitySummaryText(): string {
  return [
    "【蝶灵能力清单 — 遇到以下类型问题请优先调用对应工具，不要用'我无法获取'拒绝可以通过工具解决的问题】",
    ...AI_CAPABILITY_CATEGORIES.map(
      (cat) => `- ${cat.label}：${cat.tools.map((t) => t.name).join("、")}`,
    ),
  ].join("\n")
}
