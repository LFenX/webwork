"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useEffect } from "react"
import type { ArticleWorkspaceNav } from "@/lib/article-workspace"
import { WorkspaceSidebarBody } from "@/components/article-workspace-sidebar-body"

interface MobileSidebarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nav: ArticleWorkspaceNav
}

export function MobileSidebarDrawer({ open, onOpenChange, nav }: MobileSidebarDrawerProps) {
  // Close the drawer automatically when navigating to a new route — clicks on links inside
  // would otherwise leave it open. Listen for popstate / pushstate via a small URL watcher.
  useEffect(() => {
    if (!open) return
    const handler = () => onOpenChange(false)
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [open, onOpenChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-[61] w-[80%] max-w-[320px] border-r border-[--color-border] bg-[#f1f1ef] shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left"
          onClick={(event) => {
            const target = event.target as HTMLElement
            // Close after tapping any link
            if (target.closest("a")) onOpenChange(false)
          }}
        >
          <DialogPrimitive.Title className="sr-only">侧边导航</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="关闭"
            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-[--color-text-muted] hover:bg-[--color-bg-hover]"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
          <div className="h-full overflow-y-auto">
            <WorkspaceSidebarBody nav={nav} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
