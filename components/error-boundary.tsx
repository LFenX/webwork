"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { getDict } from "@/lib/i18n"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

function ErrorFallback({ error }: { error: Error | null }) {
  const d = getDict().error

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="border border-[--color-border] rounded-md p-6 bg-[--color-bg-surface]">
        <h2 className="text-lg font-semibold text-[--color-text-primary] mb-2">
          {d.title}
        </h2>
        <p className="text-sm text-[--color-text-muted] mb-4">
          {d.description}
        </p>
        <button
          onClick={() => {
            window.location.reload()
          }}
          className="px-4 py-2 text-sm bg-[--color-text-primary] text-white rounded hover:opacity-90 transition-opacity"
        >
          {d.refreshPage}
        </button>
        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-4 p-3 bg-[--color-bg-hover] rounded text-xs font-mono">
            <summary className="cursor-pointer text-[--color-text-secondary]">
              {d.showDetails}
            </summary>
            <pre className="mt-2 text-[--color-danger] overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
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
      return <ErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}
