import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; discussion?: string }>
}) {
  await requireAuth()
  const query = await searchParams
  const channelId = query.channel || "world"
  const params = new URLSearchParams({ type: "channel", id: channelId })
  if (query.discussion) params.set("discussion", query.discussion)
  redirect(`/friends?${params.toString()}`)
}
