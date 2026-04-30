const fs = require("fs")
const path = require("path")

// 必须与 lib/resume/themes.ts 中的 RESUME_THEME_NAME_REGEX 保持一致
const RESUME_THEME_NAME_REGEX = /^jsonresume-theme-[a-z0-9][a-z0-9-]*$/

function discoverJsonResumeThemes() {
  try {
    const pkgPath = path.join(__dirname, "package.json")
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    return Object.keys(all).filter((n) => RESUME_THEME_NAME_REGEX.test(n)).sort()
  } catch (err) {
    console.warn("[next.config] discoverJsonResumeThemes failed:", err && err.message)
    return []
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["nebula-lg.top", "*.nebula-lg.top"],
  experimental: {
    serverActions: {
      allowedOrigins: ["nebula-lg.top", "*.nebula-lg.top"],
    },
  },
  serverExternalPackages: discoverJsonResumeThemes(),
}

module.exports = nextConfig
