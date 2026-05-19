"use client"

import { Download } from "lucide-react"

type Props = {
  onDownloadPng?: () => void
  iconOnly?: boolean
}

export function ChartExportMenu({ onDownloadPng, iconOnly }: Props) {
  return (
    <button type="button" className="sql-chart-export" onClick={onDownloadPng} title="导出 PNG">
      <Download size={13} /> {iconOnly ? null : "PNG"}
    </button>
  )
}
