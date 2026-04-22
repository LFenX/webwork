"use client"

import { useState, useEffect, useCallback } from "react"
import { formatChinaTime } from "@/lib/time"

interface ErrorLog {
  id: string
  timestamp: string
  type: "error" | "rejection"
  message: string
  url: string
  details?: Record<string, unknown>
}

/**
 * 开发环境调试面板
 * 用于监控和记录 RSC 传输错误
 */
export function DebugPanel() {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(true)

  const addErrorLog = useCallback((type: "error" | "rejection", message: string, details?: Record<string, unknown>) => {
    if (!isMonitoring) return

    const newLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: formatChinaTime(new Date()),
      type,
      message,
      url: window.location.href,
      details,
    }

    setErrorLogs((prev) => [newLog, ...prev].slice(0, 50)) // 最多保留 50 条
  }, [isMonitoring])

  useEffect(() => {
    // 监听窗口错误
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      const msg = event.message || error?.message || "Unknown error"
      
      // 只关注 RSC 相关错误
      if (
        msg.includes("enqueueModel") ||
        msg.includes("Cannot read properties of null") ||
        msg.includes("react-server-dom")
      ) {
        addErrorLog("error", msg, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: error?.stack,
        })
      }
    }

    // 监听 Promise rejection
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const msg = typeof reason?.message === "string" ? reason.message : String(reason)

      if (
        msg.includes("enqueueModel") ||
        msg.includes("Cannot read properties of null")
      ) {
        addErrorLog("rejection", msg, {
          stack: reason?.stack,
        })
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [addErrorLog])

  // 快捷键切换面板显示 (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setIsVisible((v) => !v)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!isVisible || process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[500px] max-h-[60vh] bg-[--color-bg-surface] border border-[--color-border] rounded-md shadow-lg flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[--color-border]">
        <h3 className="text-sm font-semibold text-[--color-text-primary]">
          🔍 调试面板
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`px-2 py-1 text-xs rounded ${
              isMonitoring
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isMonitoring ? "监控中" : "已暂停"}
          </button>
          <button
            onClick={() => setErrorLogs([])}
            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            清空
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 统计 */}
      <div className="px-4 py-2 bg-[--color-bg-hover] text-xs text-[--color-text-secondary] flex gap-4">
        <span>错误数: {errorLogs.length}</span>
        <span>页面: {window.location.pathname}</span>
      </div>

      {/* 错误列表 */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {errorLogs.length === 0 ? (
          <p className="text-sm text-[--color-text-muted] text-center py-8">
            暂无错误记录
          </p>
        ) : (
          errorLogs.map((log) => (
            <details
              key={log.id}
              className="border border-[--color-border] rounded bg-[--color-bg-hover] text-xs"
            >
              <summary className="cursor-pointer px-3 py-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  log.type === "error" ? "bg-red-500" : "bg-yellow-500"
                }`} />
                <span className="text-[--color-text-muted] font-mono">{log.timestamp}</span>
                <span className="text-[--color-text-primary] truncate flex-1">
                  {log.message.slice(0, 80)}
                </span>
              </summary>
              <div className="px-3 pb-3 space-y-2">
                <div>
                  <span className="text-[--color-text-muted]">URL:</span>
                  <span className="ml-2 text-[--color-text-primary] font-mono text-[11px]">
                    {log.url}
                  </span>
                </div>
                <div>
                  <span className="text-[--color-text-muted]">完整消息:</span>
                  <pre className="mt-1 p-2 bg-white rounded border border-[--color-border] text-[11px] text-[--color-danger] overflow-auto max-h-[200px]">
                    {String(log.message)}
                  </pre>
                </div>
                {log.details && 'stack' in log.details && typeof log.details.stack === 'string' && log.details.stack && (
                  <div>
                    <span className="text-[--color-text-muted]">堆栈:</span>
                    <pre className="mt-1 p-2 bg-white rounded border border-[--color-border] text-[11px] text-[--color-text-secondary] overflow-auto max-h-[300px]">
                      {log.details.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-1 border-t border-[--color-border] text-[10px] text-[--color-text-muted] text-center">
        快捷键: Ctrl+Shift+D 切换面板
      </div>
    </div>
  )
}
