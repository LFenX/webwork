import type { ResumeThemeInfo } from "./types"

type Override = Partial<Pick<ResumeThemeInfo, "label" | "description" | "tags" | "recommendedFor">> & { sort?: number }

export const RESUME_THEME_METADATA: Record<string, Override> = {
  even: {
    label: "Even",
    description: "扁平、单页、清爽的现代主题。适合通用、技术岗求职。",
    tags: ["简洁", "现代", "单页"],
    recommendedFor: "通用、技术岗",
    sort: 1,
  },
  elegant: {
    label: "Elegant",
    description: "经典深色侧栏 + 主区，信息容量大。适合经验丰富的求职者。",
    tags: ["传统", "信息密集", "侧栏"],
    recommendedFor: "经验丰富的求职者",
    sort: 2,
  },
}
