import "server-only"

// In-process pub/sub so a running agent loop's SSE events can be re-subscribed
// after the original client navigated away. The producer (/api/ai/stream) keeps
// running server-side and publishes every event here; a late subscriber
// (/api/ai/runs/[messageId]/stream) gets a snapshot of the content accumulated so
// far, then live events — so streaming truly RESUMES on return instead of being
// reconstructed by polling.
//
// Single-process only. With multiple server instances the producer's channel may
// live in another process; the subscriber detects the missing channel and tells
// the client to fall back to polling (getRunSnapshot returns null).

export type RunBusEvent = { event: string; payload: unknown }
type Listener = (e: RunBusEvent) => void

const TERMINAL_EVENTS = new Set(["run_completed", "run_failed", "run_cancelled"])
// Keep a finished channel around briefly so a subscriber that connects right
// after completion still receives the final content + terminal event.
const TERMINAL_RETENTION_MS = 30_000

type Channel = {
  listeners: Set<Listener>
  content: string
  draftProgress: unknown | null
  terminal: RunBusEvent | null
}

const channels = new Map<string, Channel>()

function getOrCreate(runId: string): Channel {
  let channel = channels.get(runId)
  if (!channel) {
    channel = { listeners: new Set(), content: "", draftProgress: null, terminal: null }
    channels.set(runId, channel)
  }
  return channel
}

// Producer side: called for every event the runtime emits for this run.
export function publishRunEvent(runId: string, event: string, payload: unknown) {
  const channel = getOrCreate(runId)
  if (event === "assistant_delta") {
    channel.content += (payload as { delta?: string })?.delta ?? ""
  } else if (event === "draft_progress") {
    channel.draftProgress = payload
  } else if (TERMINAL_EVENTS.has(event)) {
    channel.terminal = { event, payload }
  }

  for (const listener of channel.listeners) {
    try { listener({ event, payload }) } catch { /* a slow/broken subscriber must not break the run */ }
  }

  if (channel.terminal) {
    setTimeout(() => {
      const current = channels.get(runId)
      if (current && current.terminal && current.listeners.size === 0) channels.delete(runId)
    }, TERMINAL_RETENTION_MS).unref?.()
  }
}

// Subscriber side: current accumulated state, or null when there is no in-process
// producer for this run (caller should fall back to polling). A snapshot taken
// here plus all subsequently delivered events is gap-free (single-threaded JS).
export function getRunSnapshot(runId: string): { content: string; draftProgress: unknown | null; terminal: RunBusEvent | null } | null {
  const channel = channels.get(runId)
  if (!channel) return null
  return { content: channel.content, draftProgress: channel.draftProgress, terminal: channel.terminal }
}

export function subscribeRun(runId: string, listener: Listener): () => void {
  const channel = getOrCreate(runId)
  channel.listeners.add(listener)
  return () => {
    const current = channels.get(runId)
    if (!current) return
    current.listeners.delete(listener)
    if (current.listeners.size === 0 && current.terminal) channels.delete(runId)
  }
}
