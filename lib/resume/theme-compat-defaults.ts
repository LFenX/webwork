// 内置默认主题兼容性配置
// 这些值在 data/resume-theme-compat.json 不存在时使用。
// 若 JSON 文件存在，会与内置默认合并（JSON 文件优先），但 disabled 始终优先于 verified。

export const BUILT_IN_VERIFIED_THEMES: Record<string, { pkg: string; version?: string }> = {
  elegant:       { pkg: "jsonresume-theme-elegant" },
  engineering:   { pkg: "jsonresume-theme-engineering" },
  flat:          { pkg: "jsonresume-theme-flat" },
  kendall:       { pkg: "jsonresume-theme-kendall" },
  macchiato:     { pkg: "jsonresume-theme-macchiato" },
  paper:         { pkg: "jsonresume-theme-paper" },
  stackoverflow: { pkg: "jsonresume-theme-stackoverflow" },
  tech:          { pkg: "jsonresume-theme-tech" },
}

export const BUILT_IN_DISABLED_THEMES: Record<string, { pkg: string; reason: string }> = {
  even:     { pkg: "jsonresume-theme-even",    reason: "依赖 @rbardini/html ESM-only，当前 CJS 服务端加载失败" },
  eventide: { pkg: "jsonresume-theme-eventide", reason: "依赖 @rbardini/html ESM-only，当前 CJS 服务端加载失败" },
  cjean:    { pkg: "jsonresume-theme-cjean",   reason: "render 返回 object，不是 HTML string，需单独适配" },
  react:    { pkg: "jsonresume-theme-react",   reason: "包含浏览器环境依赖 / 严格 Zod 校验，会触发 window.location 或 unhandledRejection" },
  github:   { pkg: "jsonresume-theme-github",  reason: "使用 Dart Sass 编译 @primer/css，产生大量 deprecation warning，污染服务端日志" },
}

export const DEFAULT_THEME_PREFERENCE_ORDER = ["elegant", "stackoverflow", "engineering", "flat"]
