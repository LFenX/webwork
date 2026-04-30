import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-input bg-background px-4 py-2 text-base transition-colors duration-200 file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-[--color-brand]/40 focus-visible:shadow-[0_0_0_1px_rgba(37,99,235,0.1)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm md:file:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
