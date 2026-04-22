"use client"

import { useEffect, useId, useRef, useState } from "react"

interface MermaidBlockProps {
  code: string
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const diagramId = `mermaid-${useId().replace(/:/g, "")}`

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({ startOnLoad: false, theme: "neutral" })
        const { svg } = await mermaid.render(diagramId, code)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "图表渲染失败")
      }
    }
    render()
    return () => { cancelled = true }
  }, [code, diagramId])

  if (error) {
    return (
      <pre className="text-xs text-[--color-danger] bg-[--color-danger-bg] rounded p-3 overflow-x-auto">
        Mermaid 错误: {error}
      </pre>
    )
  }

  return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />
}
