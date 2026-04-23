import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getGroupChannelDetails, WORLD_CHANNEL_ID } from "@/lib/channel-chat"
import { SettingsShell } from "@/components/settings/settings-shell"
import { GroupSettingsClient } from "@/components/channels/group-settings-client"

export const dynamic = "force-dynamic"

export default async function ChannelDetailsPage({
  params,
}: {
  params: Promise<{ channelId: string }>
}) {
  const session = await requireAuth()
  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) redirect("/channels")

  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) notFound()

  return (
    <SettingsShell title={dict.channels.groupInfo} backHref="/channels" backLabel={dict.common.back}>
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
