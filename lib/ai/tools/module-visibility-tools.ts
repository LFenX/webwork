import "server-only"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

const VALID_MODULES = ["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]

export const setModuleVisibilityTool = {
  name: "set_module_visibility",
  title: "设置模块可见性",
  description:
    "设置某个模块对好友的可见性。触发语：'把我的博客设为好友可见''关闭简历对好友的可见''让好友看不到我的求职记录'。",
  scope: "self" as const,
  inputSchemaSummary: "module: string, visibility: private|friends, confirmedByUser?: boolean",
  sensitivity: "high" as const,
  auditLabel: "set_module_visibility",
  whenToUse:
    "当用户明确说要把某个模块对好友开放或隐藏时使用。",
  whenNotToUse:
    "不要在没有用户明确指令时修改可见性。不要修改其他用户的设置。",
  argumentHints: [
    "module 必填：home/resume/blog/daily/reflections/notes/jobs/interviews",
    "visibility 必填：private（仅自己）或 friends（好友可见）",
    "confirmedByUser：默认可直接设置；将 friends 改为 private 是安全的，将 private 改为 friends 需要 confirmedByUser=true 确认",
  ],
  returns: "module, visibility, updated",
  parameterSchema: {
    type: "object",
    properties: {
      module: { type: "string", enum: VALID_MODULES, description: "Module key to set visibility for." },
      visibility: { type: "string", enum: ["private", "friends"], description: "Target visibility." },
      confirmedByUser: { type: "boolean", description: "Required when changing from private to friends." },
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

    if (visibility !== "private" && visibility !== "friends") {
      return toolForbidden(
        `无效的可见性 "${visibility}"，可选值：private（仅自己）、friends（好友可见）。`,
        "invalid_visibility",
      )
    }

    // Check current visibility
    const current = await prisma.moduleVisibility.findUnique({
      where: { userId_module: { userId, module } },
      select: { visibility: true },
    })
    const currentVisibility = current?.visibility ?? "private"

    if (currentVisibility === visibility) {
      return toolGranted(
        `模块「${module}」已经是「${visibility === "friends" ? "好友可见" : "仅自己可见"}」，无需修改。`,
        {
          module,
          visibility,
          unchanged: true,
        },
      )
    }

    // Opening up visibility requires confirmation
    if (visibility === "friends" && !confirmedByUser) {
      return toolForbidden(
        `即将把模块「${module}」从「仅自己可见」改为「好友可见」。好友将能看到该模块的内容。请确认是否执行。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
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

    const label = visibility === "friends" ? "好友可见" : "仅自己可见"

    return toolGranted(
      `已将模块「${module}」设置为「${label}」。`,
      {
        module,
        visibility,
        updated: true,
      },
    )
  },
}
