"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { confirmAction } from "@/lib/interaction-feedback"

type Member = {
  id: string
  email: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
  role: string
}

export function GroupSettingsClient({
  channel,
  labels,
}: {
  channel: {
    id: string
    name: string
    announcement: string
    currentUserRole: "owner" | "member"
    ownerName: string | null
    members: Member[]
  }
  labels: {
    groupName: string
    groupAnnouncement: string
    groupOwner: string
    groupMembers: string
    removeMember: string
    leaveGroup: string
    dissolveGroup: string
    saveGroup: string
    savedGroup: string
    removedMember: string
    leftGroup: string
    dissolvedGroup: string
    ownerOnly: string
    noAnnouncement: string
    confirmRemovePrefix: string
    confirmRemoveSuffix: string
    confirmLeave: string
    confirmDissolve: string
  }
}) {
  const router = useRouter()
  const [name, setName] = useState(channel.name)
  const [announcement, setAnnouncement] = useState(channel.announcement)
  const [submitting, setSubmitting] = useState(false)
  const [memberActionId, setMemberActionId] = useState<string | null>(null)

  const isOwner = channel.currentUserRole === "owner"

  async function saveGroup() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, announcement }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.ownerOnly)
      toast.success(labels.savedGroup)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.ownerOnly)
    } finally {
      setSubmitting(false)
    }
  }

  async function removeMember(member: Member) {
    if (!confirmAction(`${labels.confirmRemovePrefix}${member.displayName || member.email}${labels.confirmRemoveSuffix}`)) return
    setMemberActionId(member.id)
    try {
      const res = await fetch(`/api/channels/${channel.id}/members/${member.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? labels.ownerOnly)
        return
      }
      toast.success(labels.removedMember)
      router.refresh()
    } finally {
      setMemberActionId(null)
    }
  }

  async function leaveGroup() {
    if (!confirmAction(`${labels.confirmLeave}\n离开后需要其他成员重新邀请才能加入。`)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/channels/${channel.id}/leave`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? labels.ownerOnly)
        return
      }
      toast.success(labels.leftGroup)
      router.push("/channels")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function dissolveGroup() {
    if (!confirmAction(`${labels.confirmDissolve}\n解散后群聊和成员关系将被移除，请确认这是预期操作。`)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/channels/${channel.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? labels.ownerOnly)
        return
      }
      toast.success(labels.dissolvedGroup)
      router.push("/channels")
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
        <div className="grid gap-5">
          <div>
            <Label className="mb-2 block">{labels.groupName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner || submitting} />
          </div>
          <div>
            <Label className="mb-2 block">{labels.groupAnnouncement}</Label>
            <Textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              rows={6}
              disabled={!isOwner || submitting}
              placeholder={labels.noAnnouncement}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {isOwner ? (
              <Button type="button" onClick={saveGroup} loading={submitting} loadingText="保存中...">
                {labels.saveGroup}
              </Button>
            ) : (
              <p className="text-sm text-[--color-text-secondary]">{labels.ownerOnly}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[--color-text-primary]">{labels.groupMembers}</h2>
            <p className="mt-1 text-sm text-[--color-text-secondary]">
              {labels.groupOwner}: {channel.ownerName ?? "-"}
            </p>
          </div>
          {!isOwner ? (
            <Button type="button" variant="outline" onClick={leaveGroup} loading={submitting} loadingText="离开中...">
              {labels.leaveGroup}
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={dissolveGroup} loading={submitting} loadingText="解散中...">
              {labels.dissolveGroup}
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {channel.members.map((member) => {
            const memberName = member.displayName || member.email
            const memberIsOwner = member.role === "owner"
            return (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-[--radius-md] border border-[--color-border] px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar size="sm" name={memberName} email={member.email} avatarText={member.avatarText} avatarUrl={member.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[--color-text-primary]">{memberName}</p>
                    <p className="truncate text-xs text-[--color-text-muted]">{member.email}</p>
                  </div>
                </div>
                {memberIsOwner ? (
                  <span className="rounded-full bg-[--color-bg-hover] px-2 py-1 text-xs text-[--color-text-secondary]">{labels.groupOwner}</span>
                ) : isOwner ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => removeMember(member)} loading={memberActionId === member.id} loadingText="移除中...">
                    {labels.removeMember}
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
