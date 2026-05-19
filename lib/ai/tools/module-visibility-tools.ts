import "server-only"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"
import { revalidatePublicUserPaths } from "@/lib/public-revalidation"
import { isVisibility, normalizeVisibility, VISIBILITY_LEVELS } from "@/lib/visibility"

const VALID_MODULES = ["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]

export const setModuleVisibilityTool = {
  name: "set_module_visibility",
  title: "设置模块可见性",
  description:
    "设置某个模块的 private/friends/public 可见性。触发语：'把我的博客设为公开''把我的博客设为好友可见''关闭简历对外可见'。",
  scope: "self" as const,
  inputSchemaSummary: "module: string, visibility: private|friends|public, confirmedByUser?: boolean",
  sensitivity: "high" as const,
  auditLabel: "set_module_visibility",
  whenToUse:
    "当用户明确说要把某个模块设为公开、好友可见或私密时使用。",
  whenNotToUse:
    "不要在没有用户明确指令时修改可见性。不要修改其他用户的设置。",
  argumentHints: [
    "module 必填：home/resume/blog/daily/reflections/notes/jobs/interviews",
    "visibility 必填：private（仅自己）、friends（好友可见）或 public（公开）",
    "confirmedByUser：默认可直接设置；收紧为 private 是安全的，开放为 friends/public 需要 confirmedByUser=true 确认",
  ],
  returns: "module, visibility, updated",
  parameterSchema: {
    type: "object",
    properties: {
      module: { type: "string", enum: VALID_MODULES, description: "Module key to set visibility for." },
      visibility: { type: "string", enum: VISIBILITY_LEVELS, description: "Target visibility." },
      confirmedByUser: { type: "boolean", description: "Required when opening visibility to friends or public." },
    },
    required: ["module", "visibility"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    module,
    visibility,
    confirmedByUser,
  }: {
    userId: string
    module: string
    visibility: string
    confirmedByUser?: boolean
  }) => {
    if (!VALID_MODULES.includes(module)) {
      return toolForbidden(
        `无效的模块名 "${module}"，可选值：${VALID_MODULES.join("、")}。`,
        "invalid_module",
      )
    }

    if (!isVisibility(visibility)) {
      return toolForbidden(
        `无效的可见性 "${visibility}"，可选值：private（仅自己）、friends（好友可见）、public（公开）。`,
        "invalid_visibility",
      )
    }

    // Check current visibility
    const current = await prisma.moduleVisibility.findUnique({
      where: { userId_module: { userId, module } },
      select: { visibility: true },
    })
    const currentVisibility = normalizeVisibility(current?.visibility)
    const visibilityLabel = visibility === "public" ? "公开" : visibility === "friends" ? "好友可见" : "仅自己可见"

    if (currentVisibility === visibility) {
      return toolGranted(
        `模块「${module}」已经是「${visibilityLabel}」，无需修改。`,
        {
          module,
          visibility,
          unchanged: true,
        },
      )
    }

    if (visibility !== "private" && !confirmedByUser) {
      return toolForbidden(
        `即将把模块「${module}」从「${currentVisibility}」改为「${visibilityLabel}」。${visibility === "public" ? "公开访客将能访问该模块入口，但文章仍需单独公开。" : "好友将能看到该模块内容。"}请确认是否执行。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        "open_visibility_needs_confirmation",
        {
          need_confirmation: true,
          module,
          from: currentVisibility,
          to: visibility,
        },
      )
    }

    // Upsert module visibility
    await prisma.moduleVisibility.upsert({
      where: { userId_module: { userId, module } },
      create: { userId, module, visibility },
      update: { visibility },
    })
    await revalidatePublicUserPaths(userId, ["", module])

    return toolGranted(
      `已将模块「${module}」设置为「${visibilityLabel}」。`,
      {
        module,
        visibility,
        updated: true,
      },
    )
  },
}
