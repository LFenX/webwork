export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return
  const { startSessionSweepScheduler } = await import("@/lib/session")
  startSessionSweepScheduler()
}
