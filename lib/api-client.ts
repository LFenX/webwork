const NO_STORE: RequestInit = { cache: "no-store" }

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...NO_STORE, ...init })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "请求失败" }))
    throw new Error(err.error ?? "请求失败")
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function apiDelete(url: string): Promise<void> {
  await apiFetch<unknown>(url, { method: "DELETE" })
}
