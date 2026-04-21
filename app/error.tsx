"use client"

import { useEffect } from "react"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-sm text-[--color-text-muted]">页面加载出错，请重试</p>
      <button
        onClick={reset}
        className="px-3 py-1.5 text-sm border border-[--color-border] rounded hover:bg-[--color-bg-hover] transition-colors"
      >
        重试
      </button>
    </div>
  )
}
