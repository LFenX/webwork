"use client"

import { useEffect } from "react"

/**
 * 全局错误监听器
 * 捕获窗口级别的未捕获错误，特别是 RSC/Transport 相关错误
 * 
 * 注意：2026-04-21 修复后，所有 router.refresh() + router.push() 的竞态组合已移除
 * 如果此错误仍然出现，可能是 Turbopack dev 模式下的已知问题，生产环境应无此问题
 */
export function GlobalErrorListener() {
  useEffect(() => {
    // 监听未捕获的错误
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      if (!error) return

      if (
        error.message?.includes("enqueueModel") ||
        error.message?.includes("Cannot read properties of null") ||
        event.message?.includes("enqueueModel")
      ) {
        console.error("[GlobalErrorListener] RSC transport error detected:", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        })

        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[GlobalErrorListener] RSC 传输错误（Turbopack dev 模式已知问题，生产环境不应出现）。"
          )
        }
      }
    }

    // 监听 Promise rejection
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (!reason) return

      if (
        typeof reason.message === "string" &&
        (reason.message.includes("enqueueModel") ||
          reason.message.includes("Cannot read properties of null"))
      ) {
        console.error("[GlobalErrorListener] Unhandled promise rejection (enqueueModel):", {
          reason: reason.message,
          stack: reason.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        })
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  return null
}
