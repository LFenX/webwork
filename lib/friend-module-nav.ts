import "server-only"
import { canViewModule, type AccessLevel, type ModuleKey } from "@/lib/permissions"

export const FRIEND_MODULE_NAV_KEYS = ["resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] as const

export type FriendModuleNavKey = (typeof FRIEND_MODULE_NAV_KEYS)[number]

export async function getFriendVisibleModules(ownerId: string, level: AccessLevel) {
  const entries = await Promise.all(
    FRIEND_MODULE_NAV_KEYS.map(async (module) => [module, await canViewModule(ownerId, module, level)] as const)
  )
  return Object.fromEntries(entries) as Record<FriendModuleNavKey, boolean>
}

export function isFriendModuleKey(module: ModuleKey): module is FriendModuleNavKey {
  return FRIEND_MODULE_NAV_KEYS.includes(module as FriendModuleNavKey)
}
