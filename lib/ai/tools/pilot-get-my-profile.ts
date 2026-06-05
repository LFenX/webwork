import "server-only"
import { z } from "zod"
import { getCreatorProfile } from "@/lib/profile"
import { defineTool } from "@/lib/ai/tools/define"
import { toolGranted } from "@/lib/ai/tools/helpers"

// ───────────────────────────────────────────────────────────────────────────
// PHASE-0 PILOT — get_my_profile migrated onto the unified defineTool() shape.
//
// This is the reference for how every tool will look after migration: one
// self-describing object carrying its metadata, category, triggers, and a zod
// `input` schema, returning a structured result. It is intentionally NOT wired
// into AI_TOOLS_REGISTRY yet (the live path still uses the legacy get_my_profile
// in get-my-profile.ts), so it changes no runtime behavior. A verification
// script proves it derives output equivalent to the legacy tool.
//
// Differences from the legacy version that the migration standardizes:
//  - input is a zod schema (here empty) → validated before execute, JSON Schema
//    derived from it (no runtime.ts switch entry needed).
//  - execute returns a structured AIToolStructuredResult (toolGranted), instead
//    of a bare object, so traces/memory extraction are uniform.
// ───────────────────────────────────────────────────────────────────────────
export const getMyProfileToolV2 = defineTool({
  name: "get_my_profile",
  title: "我的基础资料",
  description: "获取当前用户自己的基础资料概览",
  category: "self-profile",
  scope: "self",
  sensitivity: "low",
  auditLabel: "read_self_profile",
  whenToUse: "适合当前用户读取自己的资料、内容与站内记录。 查询我的基础资料、昵称、邮箱、简介时使用。",
  whenNotToUse: "不要用于读取管理员后台数据、好友可见内容或文章全文。",
  triggers: ["我叫什么", "我的邮箱", "我的资料", "我的简介"],
  returns: "用户基础资料。",
  input: z.object({}),
  execute: async ({ userId }) => {
    const profile = await getCreatorProfile(userId)
    return toolGranted("已读取当前用户基础资料。", {
      profile: profile
        ? {
            displayName: profile.displayName,
            email: profile.email,
            bio: profile.bio,
            location: profile.location,
          }
        : null,
    })
  },
})
