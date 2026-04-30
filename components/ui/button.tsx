import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-wait [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_12px_28px_rgba(37,99,235,0.28)] hover:-translate-y-px",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_8px_20px_rgba(168,70,58,0.2)] hover:shadow-[0_12px_28px_rgba(168,70,58,0.28)] hover:-translate-y-px",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-[--color-brand-border]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-10 rounded-full px-4 text-xs sm:h-9 sm:text-sm",
        lg: "h-11 rounded-full px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={!asChild ? disabled || loading : disabled}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {loading && loadingText ? loadingText : children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
