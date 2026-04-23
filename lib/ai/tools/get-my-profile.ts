import "server-only"
import { getCreatorProfile } from "@/lib/profile"

export const getMyProfileTool = {
  name: "get_my_profile",
  title: "我的基础资料",
  description: "获取当前用户自己的基础资料概览",
  execute: async ({ userId }: { userId: string }) => {
    const profile = await getCreatorProfile(userId)
    return {
      profile: profile
        ? {
            displayName: profile.displayName,
            email: profile.email,
            bio: profile.bio,
            location: profile.location,
          }
        : null,
    }
  },
}
