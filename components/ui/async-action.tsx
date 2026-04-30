"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { safeErrorMessage } from "@/lib/interaction-feedback"

type AsyncActionOptions = {
  successMessage?: string
  errorMessage?: string
  finallyMessage?: string
}

export function useAsyncAction(options: AsyncActionOptions = {}) {
  const [loading, setLoading] = React.useState(false)

  const run = React.useCallback(async <T,>(action: () => Promise<T>) => {
    if (loading) return undefined
    setLoading(true)
    try {
      const result = await action()
      if (options.successMessage) toast.success(options.successMessage)
      return result
    } catch (error) {
      toast.error(safeErrorMessage(error, options.errorMessage))
      return undefined
    } finally {
      setLoading(false)
      if (options.finallyMessage) toast.info(options.finallyMessage)
    }
  }, [loading, options.errorMessage, options.finallyMessage, options.successMessage])

  return { loading, run, setLoading }
}

export type LoadingButtonProps = ButtonProps

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, ...props }, ref) => (
    <Button ref={ref} {...props}>
      {children}
    </Button>
  ),
)
LoadingButton.displayName = "LoadingButton"

export type IconActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  loading?: boolean
}

export const IconActionButton = React.forwardRef<HTMLButtonElement, IconActionButtonProps>(
  ({ className, children, label, loading = false, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[--color-text-muted] transition-all duration-200 hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : children}
    </button>
  ),
)
IconActionButton.displayName = "IconActionButton"
