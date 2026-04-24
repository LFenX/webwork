"use client"

export type ActiveChatContext =
  | { kind: "direct"; id: string }
  | { kind: "channel"; id: string }
  | null

declare global {
  interface Window {
    __ACTIVE_CHAT_CONTEXT__?: ActiveChatContext
  }
}

const EVENT_NAME = "chat-active-context"

export function setActiveChatContext(context: ActiveChatContext) {
  if (typeof window === "undefined") return
  window.__ACTIVE_CHAT_CONTEXT__ = context
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: context }))
}

export function getActiveChatContext(): ActiveChatContext {
  if (typeof window === "undefined") return null
  return window.__ACTIVE_CHAT_CONTEXT__ ?? null
}

export function subscribeActiveChatContext(listener: (context: ActiveChatContext) => void) {
  if (typeof window === "undefined") return () => undefined
  const handler = (event: Event) => listener((event as CustomEvent<ActiveChatContext>).detail ?? null)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
