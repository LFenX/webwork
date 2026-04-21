"use client"

import { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error)
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack)
    
    // 如果是 enqueueModel 错误，记录更多信息
    if (error.message?.includes("enqueueModel")) {
      console.error("[ErrorBoundary] enqueueModel error detected:", {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      })
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <div className="border border-[--color-border] rounded-md p-6 bg-[--color-bg-surface]">
            <h2 className="text-lg font-semibold text-[--color-text-primary] mb-2">
              加载失败
            </h2>
            <p className="text-sm text-[--color-text-muted] mb-4">
              页面组件加载时出现错误，这可能是由于网络问题或缓存导致。
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-4 py-2 text-sm bg-[--color-text-primary] text-white rounded hover:opacity-90 transition-opacity"
            >
              刷新页面
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 p-3 bg-[--color-bg-hover] rounded text-xs font-mono">
                <summary className="cursor-pointer text-[--color-text-secondary]">
                  查看错误详情（开发环境）
                </summary>
                <pre className="mt-2 text-[--color-danger] overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
