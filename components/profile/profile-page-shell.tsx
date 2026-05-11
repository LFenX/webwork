import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type ProfilePageShellProps = {
  children: ReactNode
  className?: string
}

type ProfileMainGridProps = {
  main: ReactNode
  aside: ReactNode
  className?: string
}

export function ProfilePageShell({ children, className }: ProfilePageShellProps) {
  return (
    <div className={cn("profile-page-shell mx-auto w-full max-w-[1200px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7", className)}>
      {children}
    </div>
  )
}

export function ProfileMainGrid({ main, aside, className }: ProfileMainGridProps) {
  return (
    <div className={cn("grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]", className)}>
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <aside className="flex min-w-0 flex-col gap-5">{aside}</aside>
    </div>
  )
}
