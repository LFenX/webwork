"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Settings } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface SettingsDialogProps {
  ownerName: string
  heroTagline: string
}

export function SettingsDialog({ ownerName, heroTagline }: SettingsDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(ownerName)
  const [tagline, setTagline] = useState(heroTagline)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName: name, heroTagline: tagline }),
      })
      if (!res.ok) throw new Error()
      toast.success("设置已保存")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-hover] rounded transition-colors"
        title="站点设置"
      >
        <Settings size={15} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>站点设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block">你的名字</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="LFen"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">首页简介</Label>
              <Textarea
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

