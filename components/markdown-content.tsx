"use client"

import dynamic from "next/dynamic"

const MDPreview = dynamic(() => import("@uiw/react-markdown-preview"), { ssr: false })

interface MarkdownContentProps {
  source: string
}

export function MarkdownContent({ source }: MarkdownContentProps) {
  return (
    <div data-color-mode="light">
      <MDPreview source={source} wrapperElement={{ "data-color-mode": "light" }} />
    </div>
  )
}
