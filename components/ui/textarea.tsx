import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[10px] border border-input bg-background px-4 py-3 text-base transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-[--color-brand]/40 focus-visible:shadow-[0_0_0_1px_rgba(37,99,235,0.1)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
