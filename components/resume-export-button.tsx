"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export function ResumeExportButton({
  lastExportedAt: _lastExportedAt,
}: { lastExportedAt?: Date | null }) {
  return (
    <Button size="sm" variant="outline" disabled title="即将支持" className="gap-1.5">
      <Download size={14} /> 导出 PDF（即将支持）
    </Button>
  )
}
