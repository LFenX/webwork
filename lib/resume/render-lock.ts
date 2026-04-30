import "server-only"

/**
 * Per-theme Promise queue lock.
 *
 * Problem: some jsonresume themes expose changeLanguage() which mutates
 * module-level global state. Concurrent renders with different locales
 * can cause language bleeding between requests.
 *
 * Solution: enqueue all render operations for the same npm package
 * so that changeLanguage + render runs atomically per package.
 */
class PromiseQueue {
  private queue: Promise<unknown> = Promise.resolve()

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(() => fn())
    // Swallow errors to keep the queue alive; callers receive the rejected promise.
    this.queue = result.catch(() => {})
    return result
  }
}

const themeLocks = new Map<string, PromiseQueue>()

function getThemeQueue(pkg: string): PromiseQueue {
  if (!themeLocks.has(pkg)) {
    themeLocks.set(pkg, new PromiseQueue())
  }
  return themeLocks.get(pkg)!
}

/**
 * Execute fn under a per-package mutex.
 */
export async function withThemeLock<T>(pkg: string, fn: () => Promise<T>): Promise<T> {
  return getThemeQueue(pkg).enqueue(fn)
}
