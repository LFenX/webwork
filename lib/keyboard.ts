import type { KeyboardEvent } from "react"

/**
 * Shared onKeyDown handler for textarea inputs:
 * - Enter → submit
 * - Shift+Enter → newline
 * - IME composition → do nothing (prevents sending half-finished Chinese input)
 */
export function handleEnterToSubmit(
  event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  onSubmit: () => void,
  options?: { disabled?: boolean },
) {
  // Don't intercept while the user is composing (e.g. Chinese Pinyin input)
  if (event.nativeEvent?.isComposing || (event as unknown as { isComposing?: boolean }).isComposing) {
    return
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    if (!options?.disabled) onSubmit()
  }
}
