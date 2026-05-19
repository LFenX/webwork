"use client"

import { OctagonX } from "lucide-react"

type Props = {
  visible: boolean
  onStop: () => void
}

export function StageStopButton({ visible, onStop }: Props) {
  if (!visible) return null
  return (
    <button type="button" className="sql-stage-stop-button" onClick={onStop}>
      <OctagonX size={14} />
      STOP
    </button>
  )
}
