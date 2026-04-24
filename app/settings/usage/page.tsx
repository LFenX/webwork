import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"
import { MarkdownContent } from "@/components/markdown-content"

export const dynamic = "force-dynamic"

const zhGuide = `
# 使用说明

## 聊天
- 顶部或好友页都可以进入私聊。
- 在聊天里长按消息可以引用回复。
- 发送后的最新消息会显示已送达或已读状态。

## AI 助手
- 可以创建多轮对话，并在同一个会话里继续追问。
- 支持上传一张图片作为附件，让 AI 结合图片和文字一起回答。
- 右侧会保留会话列表，方便回到历史对话。

## 首页布局
- 点击布局调整按钮后，可以调整部件大小或隐藏部件。
- 手机端在编辑模式下长按部件即可拖动排序。

## 隐私与设置
- 语言切换会立即生效。
- 修改密码需要输入两次新密码并提交审批。

## 管理后台
- 管理员可以查看审批、公告、贴图、审计和 AI 授权。
- 授权管理员权限时，先选中管理员，再进入授权卡片进行设置。
`

const enGuide = `
# Usage Guide

## Chat
- Open direct chats from the top bar or the friends page.
- Long-press a message to quote-reply to it.
- Your latest sent message shows a delivered or read state.

## AI Assistant
- Start multi-turn conversations and continue inside the same thread.
- Upload one image as an attachment so the assistant can respond with both text and image context.
- The conversation list stays on the side so you can jump back to history.

## Home Layout
- Use the layout edit button to resize or hide widgets.
- On mobile, long-press a widget in edit mode to drag and reorder it.

## Privacy and Settings
- Language changes apply immediately.
- Changing your password requires entering the new password twice and submitting it for approval.

## Admin
- Admins can review approvals, announcements, stickers, audits, and AI grants.
- To edit admin permissions, choose an admin first and then update permissions in the authorization card.
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
