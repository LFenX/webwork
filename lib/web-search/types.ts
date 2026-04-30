export type WebSearchContentType = "snippet" | "summary"

export type WebSearchCredentialSource = "USER_CONFIG" | "ADMIN_GRANT"

export type WebSearchCredential = {
  apiKey: string
  host: string
  workspace?: string
  serviceId?: string
}

export type WebSearchInput = {
  query: string
  queryRewrite?: boolean
  maxResults?: number
  contentType?: WebSearchContentType
  credential: WebSearchCredential
}

export type WebSearchResultItem = {
  title: string
  url: string
  snippet?: string
  content?: string
  position?: number
}

export type WebSearchOutput = {
  ok: boolean
  query: string
  results: WebSearchResultItem[]
  usage?: unknown
  error?: string
}

export type ResolvedWebSearchCredential =
  | {
      ok: true
      source: WebSearchCredentialSource
      ownerId: string
      credential: WebSearchCredential
    }
  | {
      ok: false
      source?: WebSearchCredentialSource
      ownerId?: string
      message: string
    }
