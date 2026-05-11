import { cn } from "@/lib/utils"

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-4", className)}>
      {children}
    </div>
  )
}
