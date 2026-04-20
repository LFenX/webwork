"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[--color-border-strong] rounded-[--radius-sm] text-[--color-text-secondary] hover:bg-[--color-bg-hover] cursor-pointer transition-colors no-print"
    >
      <Printer size={14} />
      打印 / 导出 PDF
    </button>
  )
}
