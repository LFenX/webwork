import type { SqlCatalogMatch, SqlCatalogRelation, SqlSchema, SqlTableCatalogInfo, SqlTableInfo } from "@/lib/sql-lab/types"

type ModuleId =
  | "account"
  | "content"
  | "social"
  | "announcement"
  | "media"
  | "career"
  | "ai"
  | "memory"
  | "roundtable"
  | "community"
  | "sql_lab"
  | "private"

type ModuleDef = {
  id: ModuleId
  name: string
  icon: "admin" | "content" | "social" | "announcement" | "media" | "career" | "ai" | "memory" | "community" | "sql" | "private"
  description: string
  submodules: Record<string, { name: string; description: string }>
}

export type SqlTableCatalogOverrideInput = Partial<{
  schemaName: string
  tableName: string
  moduleId: string | null
  moduleName: string | null
  submoduleId: string | null
  submoduleName: string | null
  description: string | null
  aliases: string[] | null
  keywords: string[] | null
  keyFields: string[] | null
  relations: unknown
  useCases: string[] | null
  notes: string | null
}>

export const SQL_CATALOG_MODULES: Record<ModuleId, ModuleDef> = {
  account: {
    id: "account",
    name: "账号与权限",
    icon: "admin",
    description: "用户身份、登录会话、注册审核、密码修改和管理员权限。",
    submodules: {
      identity: { name: "用户身份", description: "账号资料、登录状态和用户角色。" },
      approval: { name: "注册与密码审核", description: "注册、改密等人工审核流程。" },
      admin: { name: "管理员授权", description: "管理员能力开关和后台权限。" },
    },
  },
  content: {
    id: "content",
    name: "内容与知识库",
    icon: "content",
    description: "文章、笔记、评论、留言、可见性和阅读状态。",
    submodules: {
      article: { name: "文章 / 笔记 / 日记", description: "用户发布和整理的主要内容。" },
      interaction: { name: "评论与留言", description: "围绕内容和主页发生的互动。" },
      visibility: { name: "可见性与阅读", description: "模块可见性、最近阅读和更新覆盖。" },
    },
  },
  social: {
    id: "social",
    name: "社交与消息",
    icon: "social",
    description: "好友关系、私聊、群聊频道、消息和附件。",
    submodules: {
      friends: { name: "好友关系", description: "好友申请和双向好友关系。" },
      private_chat: { name: "私聊", description: "一对一聊天消息和附件。" },
      channel: { name: "频道 / 群聊", description: "频道、成员、群聊消息和附件。" },
    },
  },
  announcement: {
    id: "announcement",
    name: "公告与广播",
    icon: "announcement",
    description: "站内公告、世界广播和用户阅读状态。",
    submodules: {
      announcement: { name: "站内公告", description: "公告内容和阅读记录。" },
      broadcast: { name: "世界广播", description: "广播内容和阅读记录。" },
    },
  },
  media: {
    id: "media",
    name: "表情与上传",
    icon: "media",
    description: "表情包素材、分组、上传文件和资源存储。",
    submodules: {
      sticker: { name: "表情资源", description: "表情素材、分组和分组条目。" },
      upload: { name: "上传文件", description: "用户上传文件和存储位置。" },
    },
  },
  career: {
    id: "career",
    name: "简历与求职",
    icon: "career",
    description: "简历版本、模板配置、投递和面试记录。",
    submodules: {
      resume: { name: "简历", description: "简历主体、版本、模板和审计。" },
      job: { name: "求职流程", description: "岗位投递、进度和面试反馈。" },
    },
  },
  ai: {
    id: "ai",
    name: "AI 助手与配置",
    icon: "ai",
    description: "蝶灵 AI 的会话、消息、运行、工具、配置、授权和审计。",
    submodules: {
      conversation: { name: "会话与消息", description: "AI 对话、消息和消息附件。" },
      run: { name: "运行与工具", description: "AI 运行、步骤和工具调用日志。" },
      access: { name: "配置与授权", description: "模型配置、访问申请、用量授权和用量日志。" },
      web_search: { name: "联网搜索", description: "Web Search 配置和调用日志。" },
      profile: { name: "角色与审计", description: "智能体画像和 AI 审计日志。" },
    },
  },
  memory: {
    id: "memory",
    name: "记忆与自动回复",
    icon: "memory",
    description: "长期记忆、记忆事件、记忆工具事件和自动回复。",
    submodules: {
      memory: { name: "长期记忆", description: "记忆设置、事实、事件和工具事件。" },
      auto_reply: { name: "自动回复", description: "自动回复配置和发送日志。" },
    },
  },
  roundtable: {
    id: "roundtable",
    name: "SoulWing 圆桌",
    icon: "social",
    description: "SoulWing 圆桌的设置、每日议题、讨论、消息和参与者。",
    submodules: {
      setup: { name: "圆桌配置", description: "圆桌开关、时间、参与者设置。" },
      discussion: { name: "议题与消息", description: "每日议题、讨论流程和消息。" },
    },
  },
  community: {
    id: "community",
    name: "社区资源与访问",
    icon: "community",
    description: "网站资源、资源文件夹、访问日志、首页布局、站点设置和用户活动。",
    submodules: {
      resource: { name: "网站资源", description: "用户收藏/分享的网站资源和文件夹。" },
      visit: { name: "访问与活动", description: "主页访问、网站访问和用户活动日志。" },
      site: { name: "首页与站点", description: "首页布局和站点设置。" },
    },
  },
  sql_lab: {
    id: "sql_lab",
    name: "SQL Lab",
    icon: "sql",
    description: "SQL 实验室的授权、审计、收藏查询、Private 库、Stage 线程和分析卡片。",
    submodules: {
      access: { name: "访问授权", description: "用户和表级授权。" },
      query: { name: "查询与审计", description: "收藏查询和执行审计。" },
      private: { name: "Private 库", description: "私有文件夹和私有表元数据。" },
      stage: { name: "Stage", description: "分析线程、步骤和可视化卡片。" },
    },
  },
  private: {
    id: "private",
    name: "Private",
    icon: "private",
    description: "当前用户自己的私有数据库空间。",
    submodules: {
      uncategorized: { name: "未分组", description: "没有放入文件夹的私有表。" },
    },
  },
}

function rel(table: string, fields: string[], description: string, type: SqlCatalogRelation["type"] = "belongs_to"): SqlCatalogRelation {
  return { table, fields, description, type }
}

function c(
  moduleId: ModuleId,
  submoduleId: string,
  description: string,
  options: Partial<Pick<SqlTableCatalogInfo, "aliases" | "keywords" | "keyFields" | "relations" | "useCases" | "notes">> = {}
): SqlTableCatalogInfo {
  const moduleDef = SQL_CATALOG_MODULES[moduleId]
  const submodule = moduleDef.submodules[submoduleId] ?? Object.values(moduleDef.submodules)[0]
  return {
    moduleId: moduleDef.id,
    moduleName: moduleDef.name,
    submoduleId,
    submoduleName: submodule.name,
    description,
    aliases: options.aliases ?? [],
    keywords: options.keywords ?? [],
    keyFields: options.keyFields ?? [],
    relations: options.relations ?? [],
    useCases: options.useCases ?? [],
    notes: options.notes,
  }
}

export const DEFAULT_SQL_TABLE_CATALOG: Record<string, SqlTableCatalogInfo> = {
  User: c("account", "identity", "用户账号主表，保存登录邮箱、展示名、角色、头像、个人简介和最近登录信息。", {
    aliases: ["用户表", "账号表", "users", "用户信息"],
    keywords: ["用户", "账号", "邮箱", "昵称", "角色", "owner", "admin", "user", "displayName"],
    keyFields: ["id", "email", "displayName", "role", "createdAt", "updatedAt", "lastLoginAt"],
    useCases: ["查询用户资料", "关联用户昵称", "按角色筛选用户"],
  }),
  UserSession: c("account", "identity", "用户登录会话表，记录在线状态、设备、地理位置、最近活跃和退出原因。", {
    aliases: ["会话表", "登录记录", "在线设备"],
    keywords: ["登录", "会话", "在线", "设备", "ip", "活跃", "退出"],
    keyFields: ["id", "sessionId", "userId", "status", "ipAddress", "deviceInfo", "lastActiveAt", "loggedOutAt"],
    relations: [rel("User", ["userId"], "每条会话属于一个用户。")],
    useCases: ["查看用户登录设备", "统计在线/离线会话", "排查异地登录"],
  }),
  AdminPermission: c("account", "admin", "管理员细粒度权限表，控制注册审核、用户管理、公告、贴纸、AI、SQL Lab 等后台能力。", {
    aliases: ["管理员权限", "后台权限", "权限配置"],
    keywords: ["权限", "管理员", "审核注册", "管理用户", "SQL Lab", "manageSqlLab"],
    keyFields: ["id", "userId", "approveRegistrations", "manageUsers", "manageAI", "manageSqlLab", "updatedAt"],
    relations: [rel("User", ["userId"], "被授予管理员权限的用户。")],
    useCases: ["查询用户后台权限", "检查谁能管理 SQL Lab", "展示权限开关"],
  }),
  RegistrationRequest: c("account", "approval", "注册申请表，保存待审核邮箱、展示名、状态、审批 token 和通过时间。", {
    aliases: ["注册审核", "注册申请"],
    keywords: ["注册", "申请", "审核", "待通过", "email", "pending"],
    keyFields: ["id", "email", "displayName", "status", "createdAt", "approvedAt"],
    useCases: ["查看待审核注册", "统计注册通过情况"],
  }),
  PasswordChangeRequest: c("account", "approval", "密码修改申请表，记录用户改密请求、状态、请求时间和处理时间。", {
    aliases: ["改密申请", "密码审核"],
    keywords: ["密码", "改密", "申请", "审核", "requestedAt", "respondedAt"],
    keyFields: ["id", "userId", "status", "requestedAt", "respondedAt", "approvedById"],
    relations: [rel("User", ["userId"], "发起改密申请的用户。")],
    useCases: ["查看改密请求", "统计处理时长"],
  }),

  Post: c("content", "article", "内容条目主表，承载博客、笔记、日记、心得等文章内容和发布可见性。", {
    aliases: ["文章表", "博客表", "笔记表", "日记表", "post"],
    keywords: ["文章", "博客", "笔记", "日记", "输出", "发布", "最近文章", "内容", "title", "summary", "content"],
    keyFields: ["id", "authorId", "folderId", "title", "summary", "content", "visibility", "createdAt", "updatedAt"],
    relations: [rel("User", ["authorId"], "文章作者。"), rel("ArticleFolder", ["folderId"], "文章所属文件夹。", "lookup")],
    useCases: ["查询最近发布文章", "按作者查文章", "输出文章标题摘要正文预览"],
  }),
  ArticleFolder: c("content", "article", "文章文件夹表，用于组织博客、笔记、日记等内容目录。", {
    aliases: ["文章文件夹", "内容目录"],
    keywords: ["文章", "文件夹", "栏目", "目录", "folder"],
    keyFields: ["id", "userId", "name", "module", "sortOrder", "createdAt"],
    relations: [rel("User", ["userId"], "文件夹所有者。")],
    useCases: ["查看文章分类", "按目录统计文章"],
  }),
  Comment: c("content", "interaction", "评论表，保存用户对内容或资源的评论、回复和状态。", {
    aliases: ["评论", "回复"],
    keywords: ["评论", "留言", "回复", "comment", "postId", "parentId"],
    keyFields: ["id", "postId", "authorId", "parentId", "content", "createdAt"],
    relations: [rel("Post", ["postId"], "评论所属文章。"), rel("User", ["authorId"], "评论作者。"), rel("Comment", ["parentId"], "父评论。")],
    useCases: ["查看文章评论", "统计评论数", "查询回复链路"],
  }),
  GuestbookMessage: c("content", "interaction", "主页留言表，保存访问者写给主页主人的留言、作者和创建时间。", {
    aliases: ["留言板", "主页留言"],
    keywords: ["留言", "访客留言", "主页", "guestbook"],
    keyFields: ["id", "ownerId", "authorId", "content", "createdAt"],
    relations: [rel("User", ["ownerId"], "留言板主人。"), rel("User", ["authorId"], "留言作者。")],
    useCases: ["查看主页留言", "统计留言互动"],
  }),
  ModuleVisibility: c("content", "visibility", "模块可见性表，控制某个用户的博客、日常、笔记等模块对访问者的开放程度。", {
    aliases: ["模块可见性", "隐私设置"],
    keywords: ["可见性", "隐私", "模块", "visibility", "public", "private"],
    keyFields: ["id", "userId", "module", "visibility", "updatedAt"],
    relations: [rel("User", ["userId"], "配置可见性的用户。")],
    useCases: ["判断模块是否可见", "检查用户公开内容范围"],
  }),
  RecentActivityRead: c("content", "visibility", "最近动态已读表，记录用户已读到的动态位置或时间。", {
    aliases: ["最近动态已读", "已读记录"],
    keywords: ["最近动态", "已读", "阅读状态", "activity", "read"],
    keyFields: ["id", "userId", "module", "lastReadAt", "createdAt"],
    relations: [rel("User", ["userId"], "读取动态的用户。")],
    useCases: ["判断新动态数量", "排查已读状态"],
  }),
  UpdateLogOverride: c("content", "visibility", "更新日志覆盖表，用于自定义模块更新提示、来源模块和目标模块。", {
    aliases: ["更新日志覆盖", "update log override"],
    keywords: ["更新日志", "覆盖", "模块更新", "sourceModule", "targetModule"],
    keyFields: ["id", "userId", "sourceModule", "targetModule", "title", "createdAt"],
    relations: [rel("User", ["userId"], "覆盖配置所属用户。")],
    useCases: ["查看自定义更新提示", "分析模块更新展示"],
  }),

  FriendRequest: c("social", "friends", "好友申请表，保存申请人、接收人、备注、状态和处理时间。", {
    aliases: ["好友申请"],
    keywords: ["好友", "申请", "加好友", "pending", "accepted"],
    keyFields: ["id", "fromUserId", "toUserId", "note", "status", "createdAt", "respondedAt"],
    relations: [rel("User", ["fromUserId"], "发起申请的用户。"), rel("User", ["toUserId"], "接收申请的用户。")],
    useCases: ["查看好友申请", "统计待处理好友请求"],
  }),
  Friendship: c("social", "friends", "好友关系表，保存已经建立的双向好友关系。", {
    aliases: ["好友关系", "朋友关系"],
    keywords: ["好友", "朋友", "关系", "friendship"],
    keyFields: ["id", "userAId", "userBId", "createdAt"],
    relations: [rel("User", ["userAId"], "好友一方。"), rel("User", ["userBId"], "好友另一方。")],
    useCases: ["查询某人的好友", "统计好友数量"],
  }),
  ChatMessage: c("social", "private_chat", "私聊消息表，保存一对一聊天文本、表情、回复关系和已读时间。", {
    aliases: ["私聊消息", "聊天记录", "direct message"],
    keywords: ["私聊", "聊天", "消息", "sender", "receiver", "readAt", "text"],
    keyFields: ["id", "senderId", "receiverId", "replyToId", "text", "stickerId", "readAt", "createdAt"],
    relations: [rel("User", ["senderId"], "发送者。"), rel("User", ["receiverId"], "接收者。"), rel("StickerAsset", ["stickerId"], "消息使用的表情。", "lookup")],
    useCases: ["查询两人私聊记录", "统计未读消息", "按发送者查看消息"],
  }),
  ChatAttachment: c("social", "private_chat", "私聊附件表，保存私聊消息里的文件名、MIME、大小和存储路径。", {
    aliases: ["私聊附件"],
    keywords: ["私聊", "附件", "文件", "chat attachment"],
    keyFields: ["id", "messageId", "uploaderId", "filename", "mimeType", "size", "createdAt"],
    relations: [rel("ChatMessage", ["messageId"], "附件所属私聊消息。"), rel("User", ["uploaderId"], "上传者。")],
    useCases: ["查看私聊附件", "统计附件大小"],
  }),
  ChatChannel: c("social", "channel", "频道/群聊主表，保存频道名称、公告、类型和创建者。", {
    aliases: ["频道", "群聊", "聊天频道"],
    keywords: ["频道", "群聊", "channel", "creator", "公告"],
    keyFields: ["id", "name", "type", "announcement", "createdById", "createdAt"],
    relations: [rel("User", ["createdById"], "频道创建者。")],
    useCases: ["列出群聊频道", "查看频道创建信息"],
  }),
  ChatChannelMember: c("social", "channel", "频道成员表，记录用户加入频道的关系、角色和加入时间。", {
    aliases: ["频道成员", "群成员"],
    keywords: ["频道成员", "群成员", "member", "joinedAt", "role"],
    keyFields: ["id", "channelId", "userId", "role", "joinedAt"],
    relations: [rel("ChatChannel", ["channelId"], "所属频道。"), rel("User", ["userId"], "频道成员。")],
    useCases: ["查询群成员", "判断用户所在频道"],
  }),
  ChannelMessage: c("social", "channel", "频道消息表，保存群聊消息内容、发送者、回复关系和表情。", {
    aliases: ["群聊消息", "频道消息"],
    keywords: ["群聊", "频道消息", "消息", "senderId", "text", "createdAt"],
    keyFields: ["id", "channelId", "senderId", "replyToId", "text", "stickerId", "createdAt"],
    relations: [rel("ChatChannel", ["channelId"], "消息所属频道。"), rel("User", ["senderId"], "发送者。"), rel("StickerAsset", ["stickerId"], "消息表情。", "lookup")],
    useCases: ["查询群聊记录", "按频道统计消息", "找某人群聊发言"],
  }),
  ChannelAttachment: c("social", "channel", "频道附件表，保存群聊消息里的文件名、类型、大小和存储路径。", {
    aliases: ["群聊附件", "频道附件"],
    keywords: ["频道", "群聊", "附件", "文件"],
    keyFields: ["id", "messageId", "uploaderId", "filename", "mimeType", "size", "createdAt"],
    relations: [rel("ChannelMessage", ["messageId"], "附件所属频道消息。"), rel("User", ["uploaderId"], "上传者。")],
    useCases: ["查看群聊附件", "统计频道文件"],
  }),

  Announcement: c("announcement", "announcement", "站内公告表，保存管理员或频道同步产生的公告内容、来源和作者。", {
    aliases: ["公告", "站内公告"],
    keywords: ["公告", "通知", "announcement", "source"],
    keyFields: ["id", "authorId", "content", "source", "createdAt"],
    relations: [rel("User", ["authorId"], "公告作者。")],
    useCases: ["查看最近公告", "统计公告发布"],
  }),
  AnnouncementView: c("announcement", "announcement", "公告阅读表，记录每个用户对公告的查看次数、隐藏状态和最后查看时间。", {
    aliases: ["公告已读", "公告阅读"],
    keywords: ["公告", "阅读", "已读", "viewCount", "hidden"],
    keyFields: ["id", "announcementId", "userId", "viewCount", "hidden", "lastViewedAt"],
    relations: [rel("Announcement", ["announcementId"], "被阅读的公告。"), rel("User", ["userId"], "阅读公告的用户。")],
    useCases: ["查询公告阅读情况", "统计未读公告"],
  }),
  WorldBroadcast: c("announcement", "broadcast", "世界广播表，保存从世界频道同步的广播内容、作者和来源消息。", {
    aliases: ["世界广播", "广播"],
    keywords: ["广播", "世界频道", "world", "broadcast"],
    keyFields: ["id", "authorId", "channelId", "messageId", "content", "createdAt"],
    relations: [rel("User", ["authorId"], "广播作者。"), rel("ChannelMessage", ["messageId"], "来源频道消息。", "lookup")],
    useCases: ["查看世界广播", "按作者统计广播"],
  }),
  WorldBroadcastView: c("announcement", "broadcast", "世界广播阅读表，记录用户对广播的查看次数、隐藏状态和最后查看时间。", {
    aliases: ["广播已读", "广播阅读"],
    keywords: ["广播", "阅读", "已读", "viewCount", "hidden"],
    keyFields: ["id", "broadcastId", "userId", "viewCount", "hidden", "lastViewedAt"],
    relations: [rel("WorldBroadcast", ["broadcastId"], "被阅读的广播。"), rel("User", ["userId"], "阅读广播的用户。")],
    useCases: ["查询广播阅读情况", "统计隐藏广播"],
  }),

  StickerAsset: c("media", "sticker", "表情素材表，保存表情文件、归属、上传者、动画状态和存储路径。", {
    aliases: ["表情素材", "贴纸", "sticker"],
    keywords: ["表情", "贴纸", "素材", "上传", "animated", "filename"],
    keyFields: ["id", "scope", "ownerId", "uploaderId", "name", "filename", "mimeType", "isAnimated", "createdAt"],
    relations: [rel("User", ["ownerId"], "私有表情所有者。"), rel("User", ["uploaderId"], "上传者。")],
    useCases: ["查看用户表情", "统计上传贴纸"],
  }),
  StickerGroup: c("media", "sticker", "表情分组表，保存用户或公共表情包的分组名称、范围和排序。", {
    aliases: ["表情包", "表情分组"],
    keywords: ["表情包", "分组", "sticker group", "sort"],
    keyFields: ["id", "ownerId", "scope", "name", "sortOrder", "createdAt"],
    relations: [rel("User", ["ownerId"], "分组所有者。")],
    useCases: ["查看表情包分组", "统计分组数量"],
  }),
  StickerGroupEntry: c("media", "sticker", "表情分组条目表，将表情素材放入某个分组并保存排序。", {
    aliases: ["表情分组条目"],
    keywords: ["表情", "分组条目", "group entry", "sort"],
    keyFields: ["id", "groupId", "stickerId", "sortOrder", "createdAt"],
    relations: [rel("StickerGroup", ["groupId"], "所属表情分组。"), rel("StickerAsset", ["stickerId"], "分组内表情素材。")],
    useCases: ["展开某个表情包", "查看分组内素材"],
  }),
  Upload: c("media", "upload", "上传文件表，保存用户上传文件的原始名、MIME、大小、路径和时间。", {
    aliases: ["上传", "文件上传", "upload"],
    keywords: ["上传", "文件", "附件", "storagePath", "mimeType", "size"],
    keyFields: ["id", "userId", "originalName", "filename", "mimeType", "size", "storagePath", "createdAt"],
    relations: [rel("User", ["userId"], "上传文件的用户。")],
    useCases: ["查询上传文件", "统计上传大小", "按用户查文件"],
  }),

  Resume: c("career", "resume", "简历主体表，保存用户简历 JSON、渲染 HTML、主题、导出 PDF 和构建信息。", {
    aliases: ["简历", "resume"],
    keywords: ["简历", "resume", "pdf", "模板", "导出"],
    keyFields: ["id", "userId", "resumeJson", "selectedTheme", "lastExportedPdfPath", "updatedAt"],
    relations: [rel("User", ["userId"], "简历所属用户。")],
    useCases: ["查看简历配置", "查询导出记录"],
  }),
  ResumeVersion: c("career", "resume", "简历版本表，保存用户简历历史版本、快照和版本标题。", {
    aliases: ["简历版本", "版本历史"],
    keywords: ["简历", "版本", "历史", "snapshot"],
    keyFields: ["id", "userId", "title", "resumeJson", "createdAt"],
    relations: [rel("User", ["userId"], "版本所属用户。")],
    useCases: ["查看简历版本历史", "比较版本创建时间"],
  }),
  ResumeTemplateConfig: c("career", "resume", "简历模板配置表，保存默认模板、语言、外观和配置 JSON。", {
    aliases: ["简历模板配置", "模板设置"],
    keywords: ["简历", "模板", "配置", "appearance", "locale"],
    keyFields: ["id", "userId", "defaultLocale", "defaultAppearance", "defaultConfig", "updatedAt"],
    relations: [rel("User", ["userId"], "模板配置所属用户。")],
    useCases: ["查询简历模板偏好", "检查默认外观"],
  }),
  ResumeTemplateAuditLog: c("career", "resume", "简历模板审计日志，记录模板渲染、构建、导出相关操作。", {
    aliases: ["简历模板审计", "模板日志"],
    keywords: ["简历", "模板", "审计", "日志", "audit"],
    keyFields: ["id", "userId", "action", "detail", "createdAt"],
    relations: [rel("User", ["userId"], "触发审计的用户。")],
    useCases: ["排查模板生成问题", "查看导出操作历史"],
  }),
  JobApplication: c("career", "job", "岗位申请表，记录公司、岗位、阶段、状态、投递时间、回复时间和备注。", {
    aliases: ["求职申请", "岗位投递"],
    keywords: ["求职", "岗位", "投递", "公司", "进度", "application"],
    keyFields: ["id", "userId", "company", "position", "status", "stage", "appliedAt", "repliedAt"],
    relations: [rel("User", ["userId"], "求职记录所属用户。")],
    useCases: ["查看投递进度", "统计不同状态岗位"],
  }),
  InterviewRecord: c("career", "job", "面试记录表，保存面试轮次、形式、时间、面试官、问题、反馈和结果。", {
    aliases: ["面试记录"],
    keywords: ["面试", "interview", "轮次", "反馈", "结果"],
    keyFields: ["id", "userId", "jobId", "round", "format", "scheduledAt", "result", "feedback"],
    relations: [rel("User", ["userId"], "面试记录所属用户。"), rel("JobApplication", ["jobId"], "对应岗位申请。")],
    useCases: ["查看面试安排", "汇总面试反馈"],
  }),

  AIConversation: c("ai", "conversation", "AI 会话表，记录蝶灵对话标题、用户归属、最近消息时间和删除状态。", {
    aliases: ["AI会话", "蝶灵会话"],
    keywords: ["AI", "会话", "蝶灵", "conversation", "lastMessageAt"],
    keyFields: ["id", "userId", "title", "lastMessageAt", "deletedAt", "createdAt"],
    relations: [rel("User", ["userId"], "会话所属用户。")],
    useCases: ["查看用户 AI 会话", "按时间排序会话"],
  }),
  AIMessage: c("ai", "conversation", "AI 消息表，保存用户/助手消息、推理摘要、工具摘要、模型来源和状态。", {
    aliases: ["AI消息", "蝶灵消息"],
    keywords: ["AI", "消息", "对话内容", "reasoning", "tool trace", "model"],
    keyFields: ["id", "conversationId", "userId", "role", "contentMarkdown", "reasoningSummary", "modelName", "createdAt"],
    relations: [rel("AIConversation", ["conversationId"], "消息所属 AI 会话。"), rel("User", ["userId"], "消息所属用户。")],
    useCases: ["查看 AI 对话明细", "分析模型回答内容"],
  }),
  AIMessageAttachment: c("ai", "conversation", "AI 消息附件表，保存消息里的上传文件、MIME、大小和存储路径。", {
    aliases: ["AI附件", "AI消息附件"],
    keywords: ["AI", "附件", "上传", "文件"],
    keyFields: ["id", "messageId", "userId", "originalName", "mimeType", "size", "createdAt"],
    relations: [rel("AIMessage", ["messageId"], "附件所属 AI 消息。"), rel("User", ["userId"], "附件上传用户。")],
    useCases: ["查看 AI 会话附件", "统计 AI 文件输入"],
  }),
  AIRun: c("ai", "run", "AI 运行表，记录一次 AI 任务的模式、模型、状态、token、耗时和委托目标。", {
    aliases: ["AI运行", "AI任务", "run"],
    keywords: ["AI", "运行", "任务", "token", "latency", "status", "model"],
    keyFields: ["id", "conversationId", "userId", "mode", "status", "modelName", "totalTokens", "latencyMs", "createdAt"],
    relations: [rel("AIConversation", ["conversationId"], "运行所属会话。"), rel("User", ["userId"], "发起运行的用户。")],
    useCases: ["分析 AI 调用耗时", "统计 token 用量", "排查失败运行"],
  }),
  AIRunStep: c("ai", "run", "AI 运行步骤表，保存运行过程中的阶段、输入预览、输出预览和时间。", {
    aliases: ["AI步骤", "运行步骤"],
    keywords: ["AI", "步骤", "step", "input", "output", "startedAt", "finishedAt"],
    keyFields: ["id", "runId", "orderIndex", "type", "summary", "status", "startedAt", "finishedAt"],
    relations: [rel("AIRun", ["runId"], "步骤所属运行。")],
    useCases: ["追踪 AI 执行过程", "定位运行卡住阶段"],
  }),
  AIToolCallLog: c("ai", "run", "AI 工具调用日志，记录工具名、输入 JSON、输出 JSON、状态和耗时。", {
    aliases: ["AI工具日志", "tool call"],
    keywords: ["AI", "工具", "调用", "tool", "input", "result", "latency"],
    keyFields: ["id", "runId", "userId", "toolName", "toolInputJson", "toolResultJson", "status", "createdAt"],
    relations: [rel("AIRun", ["runId"], "工具调用所属运行。"), rel("User", ["userId"], "触发工具的用户。")],
    useCases: ["排查工具调用", "分析工具使用频率"],
  }),
  AIAccessRequest: c("ai", "access", "AI 访问申请表，记录用户申请 AI 权限、状态、审核人和审核意见。", {
    aliases: ["AI申请", "AI访问申请"],
    keywords: ["AI", "申请", "访问", "审核", "review"],
    keyFields: ["id", "userId", "status", "reviewedById", "reviewNote", "createdAt", "reviewedAt"],
    relations: [rel("User", ["userId"], "申请用户。"), rel("User", ["reviewedById"], "审核人。", "lookup")],
    useCases: ["查看 AI 申请", "统计审批状态"],
  }),
  AIUsageGrant: c("ai", "access", "AI 用量授权表，保存用户可用额度、模型权限、开关和授权人。", {
    aliases: ["AI额度", "AI授权", "用量授权"],
    keywords: ["AI", "额度", "授权", "grant", "limit", "enabled"],
    keyFields: ["id", "userId", "enabled", "defaultLimit", "maxLimit", "updatedAt"],
    relations: [rel("User", ["userId"], "被授权用户。")],
    useCases: ["检查用户 AI 额度", "查看 AI 是否启用"],
  }),
  AIUsageLog: c("ai", "access", "AI 用量日志，记录 provider、模型、token、是否真实用量、耗时和状态。", {
    aliases: ["AI用量日志", "token日志"],
    keywords: ["AI", "用量", "token", "provider", "model", "latency"],
    keyFields: ["id", "userId", "providerLabel", "model", "inputTokens", "outputTokens", "totalTokens", "createdAt"],
    relations: [rel("User", ["userId"], "产生用量的用户。")],
    useCases: ["统计 AI token 消耗", "按模型分析成本"],
  }),
  AIUserProviderConfig: c("ai", "access", "用户 AI 模型配置表，保存 provider、baseUrl、模型、密钥掩码和测试状态。", {
    aliases: ["AI配置", "模型配置", "provider配置"],
    keywords: ["AI", "配置", "provider", "model", "apiKey", "baseUrl"],
    keyFields: ["id", "userId", "providerLabel", "providerType", "baseUrl", "model", "isEnabled", "updatedAt"],
    relations: [rel("User", ["userId"], "配置所属用户。")],
    useCases: ["查看蝶灵当前模型配置", "检查 provider 是否启用"],
  }),
  AIWebSearchConfig: c("ai", "web_search", "AI 联网搜索配置表，保存 Web Search 开关、服务信息和凭据来源。", {
    aliases: ["AI搜索配置", "联网搜索配置"],
    keywords: ["AI", "联网", "搜索", "web search", "provider", "enabled"],
    keyFields: ["id", "userId", "provider", "enabled", "credentialSource", "updatedAt"],
    relations: [rel("User", ["userId"], "搜索配置所属用户。")],
    useCases: ["检查联网搜索是否开启", "查看搜索服务配置"],
  }),
  AIWebSearchToolLog: c("ai", "web_search", "AI 联网搜索工具日志，记录查询词、provider、结果数量、关联工具调用和状态。", {
    aliases: ["AI搜索日志", "联网搜索日志", "AIWebSearchToolLog"],
    keywords: ["AIWebSearchToolLog", "联网搜索", "搜索日志", "query", "resultCount", "provider", "工具日志"],
    keyFields: ["id", "userId", "query", "provider", "resultCount", "sourceToolCallLogId", "createdAt"],
    relations: [rel("User", ["userId"], "发起搜索的用户。"), rel("AIToolCallLog", ["sourceToolCallLogId"], "来源工具调用。", "lookup")],
    useCases: ["预览 AI 搜索日志", "查看某次搜索返回数量", "统计搜索关键词"],
  }),
  AIAuditLog: c("ai", "profile", "AI 审计日志，记录 AI 相关管理动作、目标用户、详情和元数据。", {
    aliases: ["AI审计", "AI审核日志"],
    keywords: ["AI", "审计", "管理动作", "audit", "actor"],
    keyFields: ["id", "actorId", "targetUserId", "action", "detail", "metadata", "createdAt"],
    relations: [rel("User", ["actorId"], "操作人。"), rel("User", ["targetUserId"], "目标用户。", "lookup")],
    useCases: ["查看 AI 管理审计", "追踪权限变更"],
  }),
  AgentProfile: c("ai", "profile", "智能体画像表，保存用户的魂、身份、上下文规则、头像和语言配置。", {
    aliases: ["智能体画像", "Agent画像"],
    keywords: ["智能体", "画像", "agent", "persona", "rules", "avatar"],
    keyFields: ["id", "userId", "soulContent", "identityContent", "rulesContent", "language", "updatedAt"],
    relations: [rel("User", ["userId"], "画像所属用户。")],
    useCases: ["查看用户智能体设定", "检查头像和语言配置"],
  }),

  MemorySettings: c("memory", "memory", "记忆设置表，保存用户长期记忆、画像上下文、工具记忆和确认策略开关。", {
    aliases: ["记忆设置"],
    keywords: ["记忆", "设置", "长期记忆", "memory", "persona"],
    keyFields: ["id", "userId", "enableLongTermMemory", "enablePersonaContext", "requireConfirmBeforeSave", "updatedAt"],
    relations: [rel("User", ["userId"], "设置所属用户。")],
    useCases: ["检查记忆开关", "查看自动保存策略"],
  }),
  MemoryFact: c("memory", "memory", "长期记忆事实表，保存可被 AI 召回的偏好、资料、重要事实和敏感标记。", {
    aliases: ["记忆事实", "长期记忆"],
    keywords: ["记忆", "事实", "偏好", "资料", "keywords", "importance"],
    keyFields: ["id", "userId", "content", "category", "keywords", "importance", "sensitive", "createdAt"],
    relations: [rel("User", ["userId"], "记忆所属用户。")],
    useCases: ["查看用户长期记忆", "按关键词检索记忆"],
  }),
  MemoryEvent: c("memory", "memory", "记忆事件表，记录从会话中提取或更新记忆的来源、摘要和状态。", {
    aliases: ["记忆事件"],
    keywords: ["记忆", "事件", "提取", "source", "summary"],
    keyFields: ["id", "userId", "sourceConversationId", "summary", "status", "createdAt"],
    relations: [rel("User", ["userId"], "事件所属用户。"), rel("AIConversation", ["sourceConversationId"], "来源 AI 会话。", "lookup")],
    useCases: ["追踪记忆生成过程", "排查记忆更新"],
  }),
  MemoryToolEvent: c("memory", "memory", "记忆工具事件表，记录工具对记忆的读取、写入、更新或删除行为。", {
    aliases: ["记忆工具事件"],
    keywords: ["记忆", "工具", "读取", "写入", "tool"],
    keyFields: ["id", "userId", "toolName", "action", "metadata", "createdAt"],
    relations: [rel("User", ["userId"], "事件所属用户。")],
    useCases: ["审计记忆工具调用", "查看记忆被修改原因"],
  }),
  AutoReplySetting: c("memory", "auto_reply", "自动回复设置表，保存触发模式、空闲时间、模板、冷却时间和每日上限。", {
    aliases: ["自动回复设置"],
    keywords: ["自动回复", "回复模板", "触发", "cooldown", "idle"],
    keyFields: ["id", "userId", "enabled", "triggerMode", "templateText", "cooldownMinutes", "maxRepliesPerDay", "updatedAt"],
    relations: [rel("User", ["userId"], "设置所属用户。")],
    useCases: ["检查自动回复开关", "查看回复模板"],
  }),
  AutoReplyLog: c("memory", "auto_reply", "自动回复日志，记录自动回复触发、回复内容、模式、原因和关联消息。", {
    aliases: ["自动回复日志"],
    keywords: ["自动回复", "日志", "触发", "replyText", "chatType"],
    keyFields: ["id", "userId", "chatType", "triggerMessageId", "replyMessageId", "replyText", "createdAt"],
    relations: [rel("User", ["userId"], "自动回复所属用户。")],
    useCases: ["查看自动回复记录", "分析触发原因"],
  }),

  SoulWingRoundtableSettings: c("roundtable", "setup", "SoulWing 圆桌全局设置，保存早晚场开关、时间和时区。", {
    aliases: ["圆桌设置"],
    keywords: ["SoulWing", "圆桌", "设置", "morning", "evening"],
    keyFields: ["id", "enabled", "morningEnabled", "eveningEnabled", "morningTime", "eveningTime", "timezone"],
    useCases: ["查看圆桌开关", "检查圆桌时间"],
  }),
  SoulWingRoundtableDay: c("roundtable", "discussion", "SoulWing 每日圆桌表，保存日期、早晚场标题、材料卡和值日用户。", {
    aliases: ["圆桌每日", "圆桌日期"],
    keywords: ["SoulWing", "圆桌", "每日", "dateKey", "morningTitle", "eveningTitle"],
    keyFields: ["id", "dateKey", "morningTitle", "eveningTitle", "dutyUserId", "createdAt"],
    relations: [rel("User", ["dutyUserId"], "当天值日用户。", "lookup")],
    useCases: ["查看每日圆桌主题", "按日期查询圆桌"],
  }),
  SoulWingRoundtableDiscussion: c("roundtable", "discussion", "SoulWing 圆桌讨论表，保存某天某场议题、状态、轮次、总结和运行锁。", {
    aliases: ["圆桌讨论", "圆桌议题"],
    keywords: ["SoulWing", "圆桌", "讨论", "议题", "slot", "status"],
    keyFields: ["id", "dateKey", "slot", "topicTitle", "status", "plannedTurns", "completedTurns", "createdAt"],
    useCases: ["查看圆桌讨论状态", "查询某天议题"],
  }),
  SoulWingRoundtableMessage: c("roundtable", "discussion", "SoulWing 圆桌消息表，保存讨论中的 agent/用户发言、轮次和作者信息。", {
    aliases: ["圆桌消息"],
    keywords: ["SoulWing", "圆桌", "消息", "author", "round", "text"],
    keyFields: ["id", "discussionId", "authorUserId", "authorName", "kind", "round", "text", "createdAt"],
    relations: [rel("SoulWingRoundtableDiscussion", ["discussionId"], "消息所属讨论。"), rel("User", ["authorUserId"], "用户作者。", "lookup")],
    useCases: ["查看圆桌聊天内容", "按轮次分析发言"],
  }),
  SoulWingRoundtableParticipant: c("roundtable", "setup", "SoulWing 圆桌参与者表，记录用户是否启用、管理员暂停和暂停原因。", {
    aliases: ["圆桌参与者"],
    keywords: ["SoulWing", "圆桌", "参与者", "enabled", "paused"],
    keyFields: ["id", "userId", "enabled", "adminPaused", "pauseReason", "updatedAt"],
    relations: [rel("User", ["userId"], "参与圆桌的用户。")],
    useCases: ["查看圆桌参与名单", "检查暂停状态"],
  }),

  WebsiteResource: c("community", "resource", "网站资源表，保存用户分享或收藏的网站、说明、截图、标签、可见性和聊天类型。", {
    aliases: ["网站资源", "网站收藏"],
    keywords: ["网站", "资源", "收藏", "url", "domain", "tags", "visibility"],
    keyFields: ["id", "userId", "folderId", "title", "url", "domain", "tags", "visibility", "createdAt"],
    relations: [rel("User", ["userId"], "资源创建者。"), rel("WebsiteFolder", ["folderId"], "资源所在文件夹。", "lookup")],
    useCases: ["查看用户分享网站", "按标签筛选资源"],
  }),
  WebsiteFolder: c("community", "resource", "网站资源文件夹表，用于对用户分享或收藏的网站进行分组。", {
    aliases: ["网站文件夹", "资源文件夹"],
    keywords: ["网站", "文件夹", "资源分组", "folder"],
    keyFields: ["id", "userId", "name", "description", "sortOrder", "createdAt"],
    relations: [rel("User", ["userId"], "文件夹所属用户。")],
    useCases: ["查看网站资源分类", "统计文件夹资源"],
  }),
  WebsiteVisitLog: c("community", "visit", "网站资源访问日志，记录资源访问者、访问时间、来源和资源。", {
    aliases: ["网站访问日志", "资源访问"],
    keywords: ["网站", "访问", "日志", "visit", "visitor", "website"],
    keyFields: ["id", "websiteId", "visitorId", "userId", "createdAt"],
    relations: [rel("WebsiteResource", ["websiteId"], "被访问的网站资源。"), rel("User", ["visitorId"], "访问者。", "lookup")],
    useCases: ["统计网站资源访问", "查看谁访问了资源"],
  }),
  HomeLayout: c("community", "site", "首页布局表，保存用户主页模块布局、顺序和展示配置。", {
    aliases: ["首页布局", "主页布局"],
    keywords: ["首页", "主页", "布局", "home", "layout"],
    keyFields: ["id", "userId", "config", "updatedAt"],
    relations: [rel("User", ["userId"], "布局所属用户。")],
    useCases: ["查看用户主页布局", "检查模块配置"],
  }),
  VisitLog: c("community", "visit", "主页访问日志，记录谁访问了谁的主页、访问路径、时间和访问来源。", {
    aliases: ["主页访问", "访问我主页", "访客记录", "VisitLog"],
    keywords: ["访问", "主页", "访客", "访问我主页", "visit", "visitor", "owner", "path"],
    keyFields: ["id", "ownerId", "visitorId", "path", "createdAt", "ipAddress"],
    relations: [rel("User", ["ownerId"], "被访问主页的主人。"), rel("User", ["visitorId"], "访问者。", "lookup")],
    useCases: ["查询访问我主页的用户", "统计主页访问次数", "按访客关联昵称"],
  }),
  SiteSettings: c("community", "site", "站点设置表，保存用户主页站点名称、主人名、头像、标语和语言等展示配置。", {
    aliases: ["站点设置", "主页设置"],
    keywords: ["站点", "设置", "主页", "ownerName", "heroTagline", "language"],
    keyFields: ["id", "userId", "ownerName", "heroTagline", "language", "updatedAt"],
    relations: [rel("User", ["userId"], "设置所属用户。")],
    useCases: ["查看主页展示配置", "查询站点语言"],
  }),
  UserActivity: c("community", "visit", "用户活动日志，记录用户行为、详情、IP、地理位置、设备、会话和时间。", {
    aliases: ["用户活动", "活动日志", "UserActivity"],
    keywords: ["用户活动", "行为", "日志", "action", "detail", "device", "geo"],
    keyFields: ["id", "userId", "sessionId", "action", "detail", "ipAddress", "deviceInfo", "createdAt"],
    relations: [rel("User", ["userId"], "发生行为的用户。"), rel("UserSession", ["sessionId"], "关联会话。", "lookup")],
    useCases: ["查询用户最近活动", "统计行为类型", "排查登录行为"],
  }),

  SqlAccessGrant: c("sql_lab", "access", "SQL Lab 用户级授权表，控制是否启用、默认 limit、最大 limit 和超时时间。", {
    aliases: ["SQL授权", "SQL Lab 权限"],
    keywords: ["SQL Lab", "授权", "访问", "limit", "enabled", "defaultTimeout"],
    keyFields: ["id", "userId", "enabled", "defaultLimit", "maxLimit", "defaultTimeoutMs", "updatedAt"],
    relations: [rel("User", ["userId"], "被授权访问 SQL Lab 的用户。")],
    useCases: ["查看用户 SQL Lab 权限", "检查默认 limit"],
  }),
  SqlAccessTableGrant: c("sql_lab", "access", "SQL Lab 表级授权表，控制某个用户对具体表的读写权限、屏蔽列和行过滤规则。", {
    aliases: ["表级授权", "SQL表权限"],
    keywords: ["SQL Lab", "表权限", "read", "write", "blockedColumns", "rowFilter"],
    keyFields: ["id", "grantId", "schemaName", "tableName", "access", "blockedColumns", "rowFilter", "updatedAt"],
    relations: [rel("SqlAccessGrant", ["grantId"], "所属用户级授权。")],
    useCases: ["查看可访问表", "检查字段屏蔽和行过滤"],
  }),
  SqlSavedQuery: c("sql_lab", "query", "SQL Lab 收藏查询表，保存用户命名 SQL、说明、置顶和共享状态。", {
    aliases: ["收藏查询", "保存SQL"],
    keywords: ["SQL Lab", "收藏", "保存", "查询", "pinned", "shared"],
    keyFields: ["id", "userId", "name", "sql", "description", "pinned", "shared", "updatedAt"],
    relations: [rel("User", ["userId"], "保存查询的用户。")],
    useCases: ["查看收藏 SQL", "寻找共享查询"],
  }),
  SqlAuditLog: c("sql_lab", "query", "SQL Lab 执行审计表，记录查询耗时、结果行数、成功状态、涉及表、错误和请求来源。", {
    aliases: ["SQL审计", "执行日志"],
    keywords: ["SQL Lab", "审计", "执行", "耗时", "错误", "touchedTables", "rowCount"],
    keyFields: ["id", "userId", "startedAt", "durationMs", "ok", "rowCount", "sqlPreview", "touchedTables", "errorMessage"],
    relations: [rel("User", ["userId"], "执行 SQL 的用户。")],
    useCases: ["查看 SQL 执行历史", "分析错误查询", "统计执行耗时"],
  }),
  SqlPrivateFolder: c("sql_lab", "private", "SQL Lab 私有文件夹元数据表，保存用户 Private 库文件夹名称、说明和排序。", {
    aliases: ["私有文件夹", "Private 文件夹"],
    keywords: ["SQL Lab", "Private", "文件夹", "folder"],
    keyFields: ["id", "userId", "name", "description", "sortOrder", "createdAt"],
    relations: [rel("User", ["userId"], "文件夹所属用户。")],
    useCases: ["查看私有表分类", "创建/整理 Private 文件夹"],
  }),
  SqlPrivateTable: c("sql_lab", "private", "SQL Lab 私有表元数据表，记录用户 Private schema 中的表名、展示名、文件夹和说明。", {
    aliases: ["私有表", "Private 表"],
    keywords: ["SQL Lab", "Private", "私有表", "schemaName", "tableName"],
    keyFields: ["id", "userId", "folderId", "schemaName", "tableName", "displayName", "description", "updatedAt"],
    relations: [rel("User", ["userId"], "私有表所属用户。"), rel("SqlPrivateFolder", ["folderId"], "私有表所在文件夹。", "lookup")],
    useCases: ["查看 Private 表目录", "移动私有表到文件夹"],
  }),
  SqlTableCatalogOverride: c("sql_lab", "stage", "SQL 表目录覆盖表，允许用数据库配置覆盖代码默认分类、介绍、关键词、别名、关键字段和关联提示。", {
    aliases: ["表目录覆盖", "catalog override", "目录配置"],
    keywords: ["SQL Lab", "目录", "catalog", "override", "分类", "介绍", "关键词", "别名"],
    keyFields: ["id", "schemaName", "tableName", "moduleId", "submoduleId", "description", "keywords", "aliases", "updatedAt"],
    relations: [rel("User", ["updatedById"], "最近更新目录覆盖的用户。", "lookup")],
    useCases: ["覆盖表介绍和分类", "调试 Stage 表目录检索"],
  }),
  SqlThread: c("sql_lab", "stage", "SQL Lab Stage 分析线程表，保存每条分析的标题、状态、置顶和归档信息。", {
    aliases: ["Stage 线程", "SQL 分析线程"],
    keywords: ["SQL Lab", "Stage", "thread", "analysis", "pinned"],
    keyFields: ["id", "userId", "title", "status", "lastEventAt", "pinned"],
    relations: [rel("User", ["userId"], "线程所属用户。")],
    useCases: ["查看分析线程", "统计 Stage 使用情况"],
  }),
  SqlThreadStep: c("sql_lab", "stage", "SQL Lab Stage 步骤表，记录用户问题、AI 思考、探查 SQL、草稿、运行结果和解读。", {
    aliases: ["Stage 步骤", "SQL 时间线"],
    keywords: ["SQL Lab", "Stage", "step", "ai_probe_sql", "sql_run", "sql_draft"],
    keyFields: ["id", "threadId", "userId", "orderIndex", "kind", "status", "createdAt"],
    relations: [rel("SqlThread", ["threadId"], "步骤所属线程。"), rel("User", ["userId"], "步骤所属用户。")],
    useCases: ["复盘 AI 分析过程", "查看自主探查记录"],
  }),
  SqlInsightCard: c("sql_lab", "stage", "SQL Lab 分析卡片表，保存可视化图表配置、SQL、置顶和共享状态。", {
    aliases: ["分析卡片", "Insight Card", "图表卡片"],
    keywords: ["SQL Lab", "chart", "insight", "pinned", "chartConfig"],
    keyFields: ["id", "userId", "threadId", "title", "sql", "chartConfig", "pinned", "updatedAt"],
    relations: [rel("User", ["userId"], "卡片所属用户。"), rel("SqlThread", ["threadId"], "卡片来源线程。", "lookup")],
    useCases: ["查看置顶图表", "保存分析结果"],
  }),
  SqlSchemaProfile: c("sql_lab", "stage", "SQL Lab schema profile 表，缓存表和字段的数据画像、样例值、枚举和时间范围。", {
    aliases: ["数据画像", "Schema Profile"],
    keywords: ["SQL Lab", "profile", "enum", "sampleValues", "distinctCount"],
    keyFields: ["id", "schemaName", "tableName", "columnName", "profileJson", "expiresAt"],
    useCases: ["提升 AI SQL 命中率", "避免枚举和字段猜错"],
  }),
}

function cleanList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.map((item) => item.trim()).filter(Boolean) : []
}

function isRelationArray(value: unknown): value is SqlCatalogRelation[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && "table" in item && "description" in item)
}

export function catalogKey(schema: string, table: string) {
  return `${schema}.${table}`.toLowerCase()
}

export function mergeCatalog(base: SqlTableCatalogInfo, override?: SqlTableCatalogOverrideInput | null): SqlTableCatalogInfo {
  if (!override) return base
  return {
    moduleId: override.moduleId || base.moduleId,
    moduleName: override.moduleName || base.moduleName,
    submoduleId: override.submoduleId || base.submoduleId,
    submoduleName: override.submoduleName || base.submoduleName,
    description: override.description || base.description,
    aliases: cleanList(override.aliases).length ? cleanList(override.aliases) : base.aliases,
    keywords: cleanList(override.keywords).length ? cleanList(override.keywords) : base.keywords,
    keyFields: cleanList(override.keyFields).length ? cleanList(override.keyFields) : base.keyFields,
    relations: isRelationArray(override.relations) ? override.relations : base.relations,
    useCases: cleanList(override.useCases).length ? cleanList(override.useCases) : base.useCases,
    notes: override.notes || base.notes,
  }
}

function privateCatalog(table: SqlTableInfo): SqlTableCatalogInfo {
  const folderName = table.folderName || "Uncategorized"
  return {
    moduleId: "private",
    moduleName: "Private",
    submoduleId: table.folderId || "uncategorized",
    submoduleName: folderName,
    description: table.comment || `Private table ${table.name} in folder ${folderName}. The owner can read, write, and manage the table.`,
    aliases: [table.name, folderName, "private table", "Private"],
    keywords: [table.name, folderName, "Private", "private", "custom table", ...table.columns.map((column) => column.name).slice(0, 12)],
    keyFields: table.columns.slice(0, 8).map((column) => column.name),
    relations: [],
    useCases: ["Query and maintain private data", "Create, insert, update, or organize Private tables through SQL Lab"],
  }
}

function fallbackCatalog(table: SqlTableInfo): SqlTableCatalogInfo {
  return {
    moduleId: "sql_lab",
    moduleName: "SQL Lab",
    submoduleId: "query",
    submoduleName: "Query and audit",
    description: `${table.name} is an accessible table in the current schema. When no catalog entry exists, SQL Lab uses its column structure as query context.`,
    aliases: [table.name],
    keywords: [table.name, ...table.columns.map((column) => column.name).slice(0, 12)],
    keyFields: table.columns.slice(0, 8).map((column) => column.name),
    relations: [],
    useCases: ["Ad hoc queries based on the column structure"],
    notes: "fallback",
  }
}
export function applyCatalogToTables(tables: SqlTableInfo[], overrides: SqlTableCatalogOverrideInput[] = []) {
  const overridesByKey = new Map(overrides.map((row) => [catalogKey(row.schemaName || "public", row.tableName || ""), row]))
  return tables.map((table) => {
    const base = table.scope === "private" ? privateCatalog(table) : DEFAULT_SQL_TABLE_CATALOG[table.name] ?? fallbackCatalog(table)
    const override = overridesByKey.get(catalogKey(table.schema, table.name))
    const catalog = mergeCatalog(base, override)
    return {
      ...table,
      comment: table.comment || catalog.description,
      catalog,
    }
  })
}

function splitTerms(text: string) {
  return (text.toLowerCase().match(/[a-z0-9_]+|[\u4e00-\u9fff]{2,}/g) ?? []).filter((term) => term.length > 1)
}

function normalize(text: string) {
  return text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
}

function allTables(schema: SqlSchema) {
  return schema.schemas.flatMap((item) => item.tables)
}

function extractTableRefs(sql: string) {
  const refs = new Set<string>()
  const stripped = sql.replace(/'[^']*'|"[^"]*"/g, " ")
  const patterns = [/\bfrom\s+([A-Za-z_][\w."]*|"[^"]+")/gi, /\bjoin\s+([A-Za-z_][\w."]*|"[^"]+")/gi, /\bupdate\s+([A-Za-z_][\w."]*|"[^"]+")/gi, /\binto\s+([A-Za-z_][\w."]*|"[^"]+")/gi]
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) {
      const raw = match[1].replace(/"/g, "")
      const table = raw.split(".").at(-1)
      if (table) refs.add(table.toLowerCase())
    }
  }
  return refs
}

function extractMissingField(errorMessage = "") {
  const quoted = errorMessage.match(/column\s+"?([^"\s]+)"?\s+does not exist/i)?.[1]
  const chinese = errorMessage.match(/字段\s*"?([^"\s]+)"?\s*不存在/)?.[1]
  return quoted || chinese || ""
}

function similar(a: string, b: string) {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x === y || x.includes(y) || y.includes(x)
}

export function searchSqlCatalog(
  schema: SqlSchema,
  input: {
    prompt?: string
    currentSql?: string
    lastError?: string
    touchedTables?: string[]
  },
  limit = 12
): SqlCatalogMatch[] {
  const text = normalize([input.prompt, input.currentSql, input.lastError, input.touchedTables?.join(" ")].filter(Boolean).join("\n"))
  const terms = splitTerms(text)
  const refs = extractTableRefs(input.currentSql ?? "")
  const missingField = extractMissingField(input.lastError)
  const touched = new Set((input.touchedTables ?? []).map((item) => item.split(".").at(-1)?.toLowerCase() ?? item.toLowerCase()))

  const matches: SqlCatalogMatch[] = []
  for (const table of allTables(schema)) {
    const catalog = table.catalog ?? (table.scope === "private" ? privateCatalog(table) : DEFAULT_SQL_TABLE_CATALOG[table.name] ?? fallbackCatalog(table))
    const reasons: string[] = []
    let score = 0
    const tableName = table.name.toLowerCase()
    const normalizedName = normalize(table.name)
    const catalogHaystack = normalize([
      table.name,
      table.schema,
      catalog.moduleName,
      catalog.submoduleName,
      catalog.description,
      catalog.aliases.join(" "),
      catalog.keywords.join(" "),
      catalog.useCases.join(" "),
      catalog.relations.map((relation) => `${relation.table} ${relation.description}`).join(" "),
    ].join(" "))

    if (text.includes(tableName) || text.includes(normalizedName)) {
      score += 120
      reasons.push("显式命中表名")
    }
    if (refs.has(tableName)) {
      score += 90
      reasons.push("当前 SQL 引用了该表")
    }
    if (touched.has(tableName)) {
      score += 55
      reasons.push("上次执行涉及该表")
    }

    for (const alias of catalog.aliases) {
      const lower = normalize(alias)
      if (lower && text.includes(lower)) {
        score += 34
        reasons.push(`命中别名：${alias}`)
      }
    }
    for (const keyword of catalog.keywords) {
      const lower = normalize(keyword)
      if (lower && text.includes(lower)) {
        score += 22
        reasons.push(`命中关键词：${keyword}`)
      }
    }
    for (const term of terms) {
      if (catalogHaystack.includes(term)) score += term.length > 4 ? 8 : 4
    }

    const matchedColumns: string[] = []
    for (const column of table.columns) {
      const columnName = column.name.toLowerCase()
      const normalizedColumn = normalize(column.name)
      if (text.includes(columnName) || text.includes(normalizedColumn)) {
        score += catalog.keyFields.includes(column.name) ? 16 : 9
        matchedColumns.push(column.name)
      } else if (missingField && similar(column.name, missingField)) {
        score += 18
        matchedColumns.push(column.name)
        reasons.push(`字段名接近：${missingField}`)
      }
    }

    if (/最近|latest|recent|newest/.test(text) && table.columns.some((column) => /createdAt|updatedAt|lastMessageAt|startedAt/i.test(column.name))) {
      score += 8
      reasons.push("包含时间字段，适合最近/排序需求")
    }
    if (/统计|count|数量|多少|sum|total/.test(text) && table.columns.length) {
      score += 4
    }

    if (score > 0) {
      matches.push({
        schema: table.schema,
        table: table.name,
        score,
        reasons: [...new Set(reasons)].slice(0, 5),
        matchedColumns: [...new Set(matchedColumns)].slice(0, 12),
        catalog,
      })
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.table.localeCompare(b.table))
    .slice(0, limit)
}

export function selectedTableDetails(schema: SqlSchema, selected: Array<{ schema: string; table: string }>) {
  const byKey = new Map(allTables(schema).map((table) => [catalogKey(table.schema, table.name), table]))
  return selected
    .map((item) => byKey.get(catalogKey(item.schema, item.table)))
    .filter((table): table is SqlTableInfo => Boolean(table))
}

export function validateDefaultCatalogCoverage(publicTableNames: string[]) {
  const missing = publicTableNames.filter((table) => !DEFAULT_SQL_TABLE_CATALOG[table])
  const fallback = publicTableNames.filter((table) => DEFAULT_SQL_TABLE_CATALOG[table]?.notes === "fallback")
  return {
    ok: missing.length === 0 && fallback.length === 0,
    missing,
    fallback,
  }
}
