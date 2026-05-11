import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getGroupChannelDetails, WORLD_CHANNEL_ID } from "@/lib/channel-chat"
import { SOULWING_ROUNDTABLE_CHANNEL_ID } from "@/lib/soulwing-roundtable"
import { getUserAdminInfo } from "@/lib/admin"
import { AdminShell } from "@/components/admin/admin-shell"
import { SettingsShell } from "@/components/settings/settings-shell"
import { GroupSettingsClient } from "@/components/channels/group-settings-client"
import { SoulWingRoundtableManageClient } from "@/components/ai/soulwing-roundtable-manage-client"
import { LayoutDashboard, Palette, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ChannelDetailsPage({
  params,
}: {
  params: Promise<{ channelId: string }>
}) {
  const session = await requireAuth()
  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) redirect("/friends?type=channel&id=world")

  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  if (channelId === SOULWING_ROUNDTABLE_CHANNEL_ID) {
    const adminInfo = await getUserAdminInfo(session.userId)
    const isAdmin = adminInfo?.role === "admin" || adminInfo?.role === "owner"
    const isOwner = adminInfo?.role === "owner"
    const navItems = [
      ...(isAdmin
        ? [
            { key: "overview", label: "后台概览", href: "/admin?section=overview", icon: <LayoutDashboard size={17} />, description: "回到主后台" },
          ]
        : []),
      ...(isOwner
        ? [
            { key: "resume-themes", label: "简历主题", href: "/admin/resume-themes", icon: <Palette size={17} />, description: "主题验证与配置" },
          ]
        : []),
      { key: "roundtable", label: "圆桌管理", href: "/channels/soulwing-roundtable", icon: <Sparkles size={17} />, description: "蝶灵圆桌控制台" },
    ]

    return (
      <AdminShell
        title="蝶灵圆桌管理"
        description="管理今日议题、资料卡、自动讨论、成员参与状态与历史讨论。"
        eyebrow="Roundtable Console"
        backHref="/friends?type=channel&id=soulwing-roundtable"
        backLabel="返回频道"
        activeKey="roundtable"
        navItems={navItems}
      >
        <SoulWingRoundtableManageClient currentUserId={session.userId} />
      </AdminShell>
    )
  }

  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) notFound()

  return (
    <SettingsShell title={dict.channels.groupInfo} backHref={`/friends?type=channel&id=${encodeURIComponent(channelId)}`} backLabel={dict.common.back}>
      <GroupSettingsClient
        channel={channel}
        labels={{
          groupName: dict.channels.groupName,
          groupAnnouncement: dict.channels.groupAnnouncement,
          groupOwner: dict.channels.groupOwner,
          groupMembers: dict.channels.groupMembers,
          removeMember: dict.channels.removeMember,
          leaveGroup: dict.channels.leaveGroup,
          dissolveGroup: dict.channels.dissolveGroup,
          saveGroup: dict.channels.saveGroup,
          savedGroup: dict.channels.savedGroup,
          removedMember: dict.channels.removedMember,
          leftGroup: dict.channels.leftGroup,
          dissolvedGroup: dict.channels.dissolvedGroup,
          ownerOnly: dict.channels.ownerOnly,
          noAnnouncement: dict.channels.noAnnouncement,
          confirmRemovePrefix: settings.language === "zh-CN" ? "确认将 " : "Remove ",
          confirmRemoveSuffix: settings.language === "zh-CN" ? " 移出群聊吗？" : " from this group?",
          confirmLeave: dict.channels.confirmLeave,
          confirmDissolve: dict.channels.confirmDissolve,
        }}
      />
    </SettingsShell>
  )
}
