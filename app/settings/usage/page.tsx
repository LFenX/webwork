import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"
import { MarkdownContent } from "@/components/markdown-content"

export const dynamic = "force-dynamic"

const zhGuide = `
# 使用说明

## 这个网站是什么

这不是一个普通的博客，也不是一个静态的简历页。

这是一个**围绕个人内容、求职成长、社交互动、社区资源和专属 AI 助手构建的综合个人空间**。你可以在这里写作、记录、求职、交友、分享资源，并让一个专属 AI 助手参与帮助你完成这些事情。

随着你不断使用，它会逐渐积累你的文章、经历、偏好、长期目标和社交关系，变成一个真正属于你的数字空间。

---

### 核心能力一览

- **内容沉淀**：博客、日常、心得、笔记，四种创作类型覆盖不同写作场景
- **简历展示与求职管理**：一份可编辑的 Markdown 简历，加上求职和面试追踪系统
- **社交互动**：好友、私聊、群聊和频道
- **社区资源共建**：表情包社区 + 网站分享资源库，大家共同贡献和发现好东西
- **专属 AI 助手「蝶灵 SoulWing」**：每个用户自己的 AI Agent，有工具、有记忆、能协作
- **持续成长**：你的写作、求职、互动、AI 对话都会被沉淀下来，成为你的长期积累

---

## 首页

首页是你打开网站后的第一个地方。它默认展示：

- 你的最新动态和内容统计
- 求职和面试进度概览
- 访客统计和留言板
- 可以自由拖拽和调整的自定义布局部件

点击「布局编辑」按钮可以调整部件位置、大小或隐藏不需要的模块。手机端长按部件可以拖动排序。

---

## 简历

简历页用于展示你的个人背景、项目经历和专业技能。你可以选择两种模式：

- **Markdown 模式**：使用熟悉的 Markdown 语法撰写和编辑简历内容
- **PDF 模式**：上传已有 PDF 简历，直接在页面上预览

可以设置简历的可见范围（仅自己 / 好友可见），方便在不同场景下控制展示范围。

---

## 内容创作

你可以创建四种不同类型的文章：

| 类型 | 适用场景 |
|------|----------|
| **博客** | 正式文章、项目总结、技术教程 |
| **日常** | 生活记录、碎片想法、随手记 |
| **心得** | 经验复盘、读书笔记、学习感悟 |
| **笔记** | 知识整理、资料归档、速记 |

每种类型都支持：

- Markdown 编辑器和所见即所得模式切换
- 文件夹分类整理
- 标签标记
- 封面图设置
- 可见范围控制（私密 / 好友可见）

---

## 求职与面试管理

求职模块帮你跟踪整个求职流程：

- **求职记录**：记录公司、职位、投递渠道、投递日期、当前状态（已投递 → 已回复 → 面试 → Offer → 接受）
- **面试记录**：记录每轮面试的时间、形式（电话/视频/现场）、面试官、面试问题、自我评分和结果
- **数据统计**：首页会展示投递回复率和面试 Offer 率，让你对自己的求职进度有直观感知

求职和面试记录可以关联，方便回溯每个职位完整的面试路径。

---

## 好友与聊天

### 好友系统

你可以通过好友 ID 添加好友。好友之间可以访问彼此的公开内容。还可以在隐私设置中控制「哪些模块对好友可见」。

### 私聊

和好友一对一聊天，支持：

- 发送文字和表情包
- 引用回复（长按消息）
- 消息送达/已读状态
- 文件和附件发送

### 群聊和频道

可以创建群聊频道，邀请好友加入。频道内有消息历史、公告和成员管理功能。

---

## 社区资源

社区资源是大家共同贡献和发现的公共空间，目前有两个板块：

### 表情包社区

- 浏览大家上传的公共表情包
- 按贡献者分组查看
- 一键添加到自己表情库
- 把自己表情贡献到社区

### 网站分享

一个公共网站资源库，你可以：

- 分享自己认为好用的网站资源（名称、链接、截图、介绍、标签、放入文件夹）
- 浏览和搜索大家分享的网站
- 按标签、文件夹、分享者筛选
- 创建自己的网站文件夹来整理收藏
- 查看热门访问和贡献排名

> 社区资源是公开的，发布时请注意不要包含隐私信息。

---

## 蝶灵 SoulWing：你的专属 AI 助手

蝶灵不是普通的聊天机器人。每个用户可以配置自己的 AI，它会：

- **理解你的上下文**：蝶灵可以搜索你的文章、求职记录、长期记忆和最近的对话
- **使用站内工具**：蝶灵可以读取、搜索、创建和修改站内内容，也可以查看你的好友和聊天记录
- **记住重要信息**：你可以让蝶灵记住某些偏好或信息，它会保存为长期记忆，之后对话中会自动回忆
- **辅助写作**：帮你润色文章、生成摘要、编写提示词
- **辅助沟通**：在聊天中帮你草拟回复，适合不想打字或想表达得更清楚的场景
- **整理和分析**：帮你汇总数据、分析趋势、整理思路

### 使用方式

- 在 AI 页面发起对话
- 在聊天界面点击蝶灵头像可以让它帮你写回复
- 在编辑器里可以点击 AI 辅助按钮

### 注意事项

- 蝶灵通过工具获取信息，不是天生知道所有内容
- 蝶灵的记忆和偏好需要你在对话中明确表达
- AI 生成的内容需要你自行判断准确性
- 你可以随时编辑、删除蝶灵的记忆记录

---

## 设置中心

设置中心让你管理整个空间：

| 设置 | 说明 |
|------|------|
| **个人资料** | 修改显示名、头像、地区、简介和邮箱 |
| **修改密码** | 提交密码修改申请，管理员审批后生效 |
| **资料可见范围** | 控制每个模块是否对好友可见（首页、简历、博客、日常、心得、笔记、求职、面试） |
| **语言** | 切换中文 / English 界面 |
| **使用说明** | 你正在看的这一页 |

---

## 推荐使用方式

- 把**博客**当作正式输出，写项目总结和技术文章
- 把**日常**当作非结构化记录，随手记想法
- 把**笔记**当作个人知识库，整理碎片信息
- 把**求职和面试**当作成长追踪器，跟踪每一条投递和每一轮面试
- 把**社区资源**当作收藏工具和共享空间，收藏好网站，也分享给别人看
- 多和**蝶灵**聊天，让它了解你的偏好、项目和长期目标

---

## 隐私和边界

- 你只能访问自己有权限的数据。好友之间能看什么，由「资料可见范围」决定
- 蝶灵通过工具系统访问站内数据，不会凭空知道你写了什么
- AI 生成内容由你自行判断，不作为决策依据
- 社区分享的内容是公开的，发布前确认不包含个人敏感信息
- 你的蝶灵记忆长期存储在服务器上，可以随时清理
`

const enGuide = `
# Usage Guide

## What is this site

This is not an ordinary blog or a static resume page.

It is a **comprehensive personal space built around content creation, career growth, social interaction, community resources, and a dedicated AI assistant**. You can write, record, job-hunt, connect with friends, share resources, and have your own AI agent collaborate with you — all in one place.

The more you use it, the more it accumulates your articles, experiences, preferences, long-term goals, and social connections, gradually becoming a digital space that truly belongs to you.

---

### Core Capabilities

- **Content Creation**: Blog, Daily, Reflections, Notes — four content types for different writing needs
- **Resume & Career Tracking**: An editable Markdown resume paired with job and interview tracking
- **Social Features**: Friends, direct chat, group chat, and channels
- **Community Resources**: Sticker community + Website sharing library
- **Dedicated AI Assistant "SoulWing"**: Your personal AI agent with tools, memory, and collaboration
- **Continuous Growth**: Your writing, career history, interactions, and AI conversations accumulate over time

---

## Home

The home page is your personal dashboard. It shows:

- Recent activity and content statistics
- Job and interview progress overview
- Visitor stats and guestbook
- Customizable layout widgets

Click "Edit Layout" to resize, hide, or reorder widgets. On mobile, long-press a widget in edit mode to drag it.

---

## Resume

The resume page showcases your background, projects, and skills. Two modes are available:

- **Markdown mode**: Write and edit your resume with familiar Markdown syntax
- **PDF mode**: Upload an existing PDF resume for inline preview

Visibility can be set to private or friends-only.

---

## Content Creation

Four article types serve different purposes:

| Type | Best For |
|------|----------|
| **Blog** | Formal articles, project summaries, tutorials |
| **Daily** | Life logs, quick thoughts, casual notes |
| **Reflections** | Lessons learned, reading notes, insights |
| **Notes** | Knowledge base, references, quick captures |

All types support:

- Markdown editor with WYSIWYG toggle
- Folder organization
- Tag labeling
- Cover images
- Visibility control (private / friends)

---

## Job & Interview Tracking

Track your entire job search process:

- **Job Applications**: Record company, position, channel, date, and status (Applied → Replied → Interviewing → Offer → Accepted)
- **Interview Records**: Log each round format (phone/video/onsite), interviewers, questions, self-rating, and results
- **Statistics**: The home page shows reply rate and offer rate at a glance

Job and interview records can be linked together for a complete view of each position's interview journey.

---

## Friends & Chat

### Friends

Add friends by user ID. Friends can access each other's public content. Control which modules are visible to friends in privacy settings.

### Direct Chat

One-on-one chat with friends:

- Text and stickers
- Quote-reply (long-press a message)
- Read/delivered status

### Groups & Channels

Create group chat channels and invite friends. Channels include message history, announcements, and member management.

---

## Community Resources

The community section is a shared public space with two areas:

### Sticker Community

- Browse public stickers contributed by everyone
- Grouped by contributor
- One-click add to your personal library
- Contribute your own stickers

### Website Sharing

A public resource library where you can:

- Share useful websites (name, link, screenshot, description, tags, folder)
- Browse and search sites shared by others
- Filter by tags, folders, and contributors
- Create your own folders to organize websites
- View popular visits and contributor rankings

> Community resources are public. Avoid sharing personal or sensitive information.

---

## SoulWing: Your Personal AI Assistant

SoulWing is not a generic chatbot. Each user's AI is uniquely configured to:

- **Understand your context**: It can search your articles, job records, long-term memory, and recent conversations
- **Use in-site tools**: It can read, search, create, and modify content; check friends and chat history
- **Remember what matters**: Ask it to remember preferences or facts — it stores them as long-term memory and recalls them automatically later
- **Assist with writing**: Polish articles, generate summaries, draft prompts
- **Help with communication**: Draft chat replies for you
- **Summarize and analyze**: Aggregate data, spot trends, organize thoughts

### How to Use

- Start a conversation on the AI page
- Click the SoulWing icon in a chat to get reply suggestions
- Use the AI helper button in the editor

### Important Notes

- SoulWing accesses information through tools — it does not inherently know everything
- Memory and preferences are built through conversation — be explicit when you want something remembered
- Always review AI-generated content before acting on it
- You can view, edit, and delete SoulWing's memories at any time

---

## Settings

The Settings center lets you manage your space:

| Setting | Purpose |
|---------|---------|
| **Profile** | Display name, avatar, location, bio, email |
| **Password** | Request a password change (admin-approved) |
| **Visibility** | Control which modules are visible to friends |
| **Language** | Switch between Chinese and English |
| **Usage Guide** | The page you are reading now |

---

## Suggested Workflow

- Use **Blog** for formal output — project summaries, technical articles
- Use **Daily** for unstructured logging — quick thoughts and life updates
- Use **Notes** as your knowledge base — collect and organize information
- Use **Jobs & Interviews** as your career tracker — follow every application and interview round
- Use **Community Resources** as your toolkit and sharing space — collect great websites and share your own
- Talk to **SoulWing** regularly — the more context it has, the better it can help you

---

## Privacy & Boundaries

- You can only access data you have permission to see. What friends can view is controlled by visibility settings
- SoulWing accesses site data through its tool system — it does not magically know everything
- AI-generated content is for reference only — always use your own judgment
- Community-shared content is public — do not include personal or sensitive information
- Your SoulWing memories are stored on the server and can be cleared at any time
`

export default async function SettingsUsagePage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  const source = settings.language === "en-US" ? enGuide : zhGuide

  return (
    <SettingsShell title={dict.settings.usageTitle} backLabel={dict.common.back}>
      <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6">
        <MarkdownContent source={source} />
      </div>
    </SettingsShell>
  )
}
