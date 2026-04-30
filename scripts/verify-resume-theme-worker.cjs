// 主题验证子进程 worker（CJS，隔离执行）
// 参数：
//   argv[2]  pkgName     必须
//   argv[3]  snapshotPath 可选，成功时把渲染 HTML 写入此路径

const { createRequire } = require("module")
const path = require("path")
const fs = require("fs")

const pkgName = process.argv[2]
const snapshotPath = process.argv[3] || null

if (!pkgName) {
  process.stdout.write(JSON.stringify({ ok: false, error: "缺少 pkgName 参数" }))
  process.exit(1)
}

const TIMEOUT_MS = 12_000
const SETTLE_MS = 400

// ── 拦截所有 console 输出 ──
const capturedLogs = []
const MAX_LOGS = 500
const MAX_LOG_LENGTH = 120_000
const logLevels = ["log", "warn", "error", "info", "debug"]
const _orig = {}
for (const lv of logLevels) {
  _orig[lv] = console[lv]
  console[lv] = (...args) => {
    if (capturedLogs.length < MAX_LOGS) {
      const line = args.map(a => {
        try { return typeof a === "string" ? a : JSON.stringify(a) } catch { return String(a) }
      }).join(" ")
      capturedLogs.push(`[${lv}] ${line}`)
    }
  }
}

// ── 拦截 process.emitWarning（捕获 Sass / Node deprecation）──
const origEmitWarning = process.emitWarning.bind(process)
let deprecationCount = 0
process.emitWarning = (warning, ...rest) => {
  deprecationCount++
  const msg = typeof warning === "string" ? warning : (warning && warning.message) || String(warning)
  if (capturedLogs.length < MAX_LOGS) {
    capturedLogs.push(`[process.warning] ${msg}`)
  }
}

// ── 全局错误捕获 ──
let settled = false
let asyncError = null

process.on("uncaughtException", (err) => {
  asyncError = `uncaughtException: ${err?.message || String(err)}`
  if (!settled) { settled = true; sendResult({ ok: false, error: asyncError }) }
})
process.on("unhandledRejection", (reason) => {
  const msg = reason?.message || String(reason)
  asyncError = `unhandledRejection: ${msg}`
  capturedLogs.push(`[unhandledRejection] ${msg}`)
})
process.on("warning", (w) => {
  capturedLogs.push(`[process.warning.event] ${w?.message || String(w)}`)
})

// ── 超时 ──
const timer = setTimeout(() => {
  if (!settled) { settled = true; sendResult({ ok: false, error: "渲染超时（>12s）" }) }
}, TIMEOUT_MS)

function sendResult(result) {
  if (settled) return
  settled = true
  clearTimeout(timer)

  // 恢复 console & emitWarning
  for (const lv of logLevels) { console[lv] = _orig[lv] }
  process.emitWarning = origEmitWarning

  // 收集日志
  const logs = capturedLogs.join("\n")
  if (logs.length > MAX_LOG_LENGTH) {
    result.warnings = logs.substring(0, MAX_LOG_LENGTH) + "\n...(truncated)"
  } else if (logs.length > 0) {
    result.warnings = logs
  }

  // 统计 warning 数量（包含 emitWarning 调用次数）
  const warnCount = capturedLogs.filter(l => l.startsWith("[warn]") || l.startsWith("[process.warning")).length + deprecationCount
  result.deprecationCount = deprecationCount
  if (warnCount > 100 || logs.length > 50000 || deprecationCount > 50) {
    result.noisy = true
  }

  // 检测浏览器 API 错误
  const allText = logs + (result.error || "")
  if (/window/.test(allText) || /location/.test(allText) || /document/.test(allText) || /navigator/.test(allText)) {
    if (/undefined/.test(allText) || /is not defined/.test(allText) || /Cannot read/.test(allText)) {
      result.ok = false
      result.error = "依赖浏览器环境，不兼容服务端渲染"
    }
  }

  if (asyncError && result.ok) {
    result.ok = false
    result.error = asyncError
  }

  process.stdout.write(JSON.stringify(result))
  process.exit(result.ok ? 0 : 1)
}

// ── 主逻辑 ──
try {
  const req = createRequire(path.join(process.cwd(), "package.json"))

  // 加载 sanitized sample
  let sample
  const samplePath = path.join(process.cwd(), "data", "resume-sample.sanitized.json")
  try {
    sample = JSON.parse(fs.readFileSync(samplePath, "utf8"))
  } catch {
    sample = { basics: { name: "Test User", email: "test@example.com" }, work: [], education: [], skills: [], projects: [] }
  }

  // require 模块
  let mod
  try { mod = req(pkgName) } catch (err) {
    sendResult({ ok: false, error: `模块加载失败: ${err?.message || String(err)}` })
    return
  }

  // pickRender
  let render = null
  if (mod && typeof mod.render === "function") render = mod.render
  else if (mod && mod.default && typeof mod.default.render === "function") render = mod.default.render
  else if (mod && typeof mod.default === "function") render = mod.default

  if (typeof render !== "function") {
    sendResult({ ok: false, error: `render 导出缺失 (keys: ${Object.keys(mod || {}).join(",") || "无"})` })
    return
  }

  // 调用 render
  let result
  try { result = render(sample) } catch (err) {
    sendResult({ ok: false, error: `render 执行失败: ${err?.message || String(err)}` })
    return
  }

  function finalizeHtml(html) {
    const htmlLength = html.length
    // 写入 snapshot（如提供路径）
    if (snapshotPath && typeof html === "string" && html.length > 100) {
      try {
        const dir = path.dirname(snapshotPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(snapshotPath, html, "utf8")
      } catch (e) {
        capturedLogs.push(`[snapshot-write-error] ${e?.message || String(e)}`)
      }
    }
    sendResult({ ok: true, htmlLength })
  }

  // 处理 Promise
  if (result instanceof Promise) {
    result.then((html) => {
      setTimeout(() => {
        if (typeof html === "string" && html.length > 100) finalizeHtml(html)
        else if (html && typeof html === "object" && typeof html.html === "string" && html.html.length > 100) finalizeHtml(html.html)
        else sendResult({ ok: false, error: `async render 返回异常类型: ${typeof html}` })
      }, SETTLE_MS)
    }).catch((err) => {
      sendResult({ ok: false, error: `async render 失败: ${err?.message || String(err)}` })
    })
    return
  }

  // 同步结果
  setTimeout(() => {
    if (typeof result === "string" && result.length > 100) finalizeHtml(result)
    else if (result && typeof result === "object" && typeof result.html === "string" && result.html.length > 100) finalizeHtml(result.html)
    else sendResult({ ok: false, error: `render 返回非字符串 (typeof=${typeof result}${result && typeof result === "object" ? ", keys=" + Object.keys(result).join(",") : ""})` })
  }, SETTLE_MS)
} catch (err) {
  sendResult({ ok: false, error: `worker 异常: ${err?.message || String(err)}` })
}
