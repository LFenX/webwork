import "server-only"
import type { AIProviderCapabilities, AIResolvedProviderConfig, AISafeProviderConfig } from "@/lib/ai/types"

type ProviderProbeInput = {
  providerLabel: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  streamEnabled: boolean
}

export type ProviderContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type ProviderMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | ProviderContentPart[]
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  reasoning_content?: string
}

export type ProviderToolSpec = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ProviderToolCall = {
  id: string
  name: string
  argumentsText: string
  arguments: Record<string, unknown> | null
}

export type ProviderChatResult = {
  assistantText: string
  reasoningText: string
  toolCalls: ProviderToolCall[]
  finishReason: string | null
  providerMetadata?: Record<string, unknown>
}

const MINIMAL_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnV4W0AAAAASUVORK5CYII="

function buildEndpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function flattenMessageContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map((item) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function extractReasoningDelta(delta: Record<string, unknown>) {
  const candidates = [
    delta.reasoning_content,
    delta.reasoning,
    delta.reasoning_text,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate
    if (candidate && typeof candidate === "object") {
      const text = (candidate as { text?: unknown; content?: unknown }).text
      if (typeof text === "string" && text) return text
      const content = (candidate as { content?: unknown }).content
      if (typeof content === "string" && content) return content
    }
  }

  return ""
}

function normalizeCapabilities(baseUrl: string, providerLabel: string, model: string): AIProviderCapabilities {
  const fingerprint = `${baseUrl} ${providerLabel} ${model}`.toLowerCase()
  const likelyVision =
    /(vision|vl|gpt-4o|gpt-4\.1|gemini|claude-3|claude-4|qwen.*vl|qwen[0-9.\-]*(plus|turbo|max)|glm.*v|kimi.*vision)/.test(fingerprint)
  const likelyReasoning =
    /(reason|o1|o3|o4|gpt-5|qwen3|deepseek|qwq)/.test(fingerprint)
  const likelyNoTools = /(text-completion|completion-only|legacy)/.test(fingerprint)

  return {
    streamText: true,
    toolCalling: !likelyNoTools,
    visionInput: likelyVision,
    reasoningStream: likelyReasoning,
  }
}

export function withProviderCapabilities<T extends Pick<AISafeProviderConfig, "baseUrl" | "providerLabel" | "model"> & {
  temperature: number
  streamEnabled: boolean
}>(config: T): T & { capabilities: AIProviderCapabilities } {
  return {
    ...config,
    capabilities: normalizeCapabilities(config.baseUrl, config.providerLabel, config.model),
  }
}

export async function probeProviderCapabilities(input: ProviderProbeInput) {
  const modelsResponse = await fetch(buildEndpoint(input.baseUrl, "/models"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  if (!modelsResponse.ok) {
    const text = await modelsResponse.text().catch(() => "")
    throw new Error(text || `Provider test failed with status ${modelsResponse.status}`)
  }

  const basePayload = {
    model: input.model,
    temperature: input.temperature,
    messages: [
      {
        role: "user",
        content: "Reply with OK only.",
      },
    ],
  }

  const chatResponse = await fetch(buildEndpoint(input.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(basePayload),
    cache: "no-store",
  })

  if (!chatResponse.ok) {
    const text = await chatResponse.text().catch(() => "")
    throw new Error(text || `Chat request failed with status ${chatResponse.status}`)
  }

  const toolResponse = await fetch(buildEndpoint(input.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...basePayload,
      messages: [
        {
          role: "user",
          content: "Call the echo_tool function and do not answer normally.",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "echo_tool",
            description: "Echoes a simple value.",
            parameters: {
              type: "object",
              properties: {
                value: { type: "string" },
              },
              required: ["value"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: "auto",
    }),
    cache: "no-store",
  })

  const toolPayload = await toolResponse.json().catch(() => null)
  const toolCalling = Boolean(toolPayload?.choices?.[0]?.message?.tool_calls?.length)

  const streamResponse = await fetch(buildEndpoint(input.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...basePayload,
      stream: true,
    }),
    cache: "no-store",
  })

  let streamText = false
  if (streamResponse.ok && streamResponse.body) {
    const reader = streamResponse.body.getReader()
    const { value } = await reader.read().catch(() => ({ value: undefined }))
    streamText = Boolean(value && value.length > 0)
    await reader.cancel().catch(() => null)
  }

  const reasoningStreamResponse = await fetch(buildEndpoint(input.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...basePayload,
      stream: true,
    }),
    cache: "no-store",
  })

  const visionResponse = await fetch(buildEndpoint(input.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image in one short sentence." },
            { type: "image_url", image_url: { url: MINIMAL_PNG_DATA_URL } },
          ],
        },
      ],
    }),
    cache: "no-store",
  })

  let reasoningStream = false
  if (reasoningStreamResponse.ok && reasoningStreamResponse.body) {
    const reader = reasoningStreamResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith("data:")) continue
        const payload = safeJsonParse(line.slice(5).trim())
        const delta = payload?.choices?.[0]?.delta
        if (delta && typeof delta === "object" && extractReasoningDelta(delta as Record<string, unknown>)) {
          reasoningStream = true
          break
        }
      }
      if (reasoningStream) break
    }
    await reader.cancel().catch(() => null)
  }

  return {
    streamText,
    toolCalling,
    visionInput: visionResponse.ok,
    reasoningStream,
  } satisfies AIProviderCapabilities
}

export async function requestProviderChat(params: {
  provider: AIResolvedProviderConfig
  messages: ProviderMessage[]
  tools?: ProviderToolSpec[]
  toolChoice?: "auto" | "none"
  stream?: boolean
  timeoutMs?: number
  onReasoningStart?: () => Promise<void> | void
  onReasoningDelta?: (delta: string) => Promise<void> | void
  onAssistantStart?: () => Promise<void> | void
  onAssistantDelta?: (delta: string) => Promise<void> | void
  onToolCallDelta?: (toolCall: {
    id: string
    name: string
    argumentsDelta: string
    argumentsText: string
  }) => Promise<void> | void
}) {
  const timeoutMs = params.timeoutMs ?? Number(process.env.AI_PROVIDER_TIMEOUT_MS || 120_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  let response: Response
  try {
    response = await fetch(buildEndpoint(params.provider.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.provider.model,
        temperature: params.provider.temperature,
        stream: params.stream ?? false,
        messages: params.messages,
        ...(params.tools?.length ? { tools: params.tools, tool_choice: params.toolChoice ?? "auto" } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    if (controller.signal.aborted) {
      throw new Error(`AI provider request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    clearTimeout(timer)
    throw new Error(text || `Provider request failed with status ${response.status}`)
  }

  if (!params.stream || !response.body) {
    let payload: Awaited<ReturnType<Response["json"]>> | null = null
    try {
      payload = await response.json().catch(() => null)
    } finally {
      clearTimeout(timer)
    }
    const message = payload?.choices?.[0]?.message ?? {}
    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.map((item: { id?: string; function?: { name?: string; arguments?: string } }) => ({
          id: item.id ?? crypto.randomUUID(),
          name: item.function?.name ?? "unknown_tool",
          argumentsText: item.function?.arguments ?? "{}",
          arguments: safeJsonParse(item.function?.arguments ?? "{}") as Record<string, unknown> | null,
        }))
      : []

    return {
      assistantText: flattenMessageContent(message.content),
      reasoningText:
        typeof message.reasoning_content === "string"
          ? message.reasoning_content
          : typeof message.reasoning === "string"
            ? message.reasoning
            : "",
      toolCalls,
      finishReason: payload?.choices?.[0]?.finish_reason ?? null,
      providerMetadata: {
        id: payload?.id ?? null,
        usage: payload?.usage ?? null,
      },
    } satisfies ProviderChatResult
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let assistantStarted = false
  let reasoningStarted = false
  let assistantText = ""
  let reasoningText = ""
  const toolCallsByIndex = new Map<number, ProviderToolCall>()
  let finishReason: string | null = null
  let responseId: string | null = null
  let usage: unknown = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (!data || data === "[DONE]") continue
      const payload = safeJsonParse(data)
      if (!payload) continue

      responseId = payload.id ?? responseId
      usage = payload.usage ?? usage
      const choice = payload.choices?.[0]
      if (!choice) continue
      finishReason = choice.finish_reason ?? finishReason
      const delta = (choice.delta ?? {}) as Record<string, unknown>

      const reasoningDelta = extractReasoningDelta(delta)
      if (reasoningDelta) {
        if (!reasoningStarted) {
          reasoningStarted = true
          await params.onReasoningStart?.()
        }
        reasoningText += reasoningDelta
        await params.onReasoningDelta?.(reasoningDelta)
      }

      const contentDelta = flattenMessageContent(delta.content)
      if (contentDelta) {
        if (!assistantStarted) {
          assistantStarted = true
          await params.onAssistantStart?.()
        }
        assistantText += contentDelta
        await params.onAssistantDelta?.(contentDelta)
      }

      const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : []
      for (const rawToolCall of toolCalls) {
        const index = typeof rawToolCall.index === "number" ? rawToolCall.index : 0
        const existing = toolCallsByIndex.get(index) ?? {
          id: rawToolCall.id ?? `tool-${index}`,
          name: "",
          argumentsText: "",
          arguments: null,
        }
        if (typeof rawToolCall.id === "string" && rawToolCall.id) existing.id = rawToolCall.id
        // DeepSeek sends function.name="" in follow-up deltas — only overwrite with a non-empty value
        if (typeof rawToolCall.function?.name === "string" && rawToolCall.function.name.trim()) {
          existing.name = rawToolCall.function.name
        }
        const argumentsDelta = typeof rawToolCall.function?.arguments === "string" ? rawToolCall.function.arguments : ""
        if (argumentsDelta) {
          existing.argumentsText += argumentsDelta
          await params.onToolCallDelta?.({
            id: existing.id,
            name: existing.name,
            argumentsDelta,
            argumentsText: existing.argumentsText,
          })
        }
        toolCallsByIndex.set(index, existing)
      }
    }
  }

  const toolCalls = [...toolCallsByIndex.values()].map((item) => ({
    ...item,
    arguments: safeJsonParse(item.argumentsText) as Record<string, unknown> | null,
  }))
  clearTimeout(timer)

  return {
    assistantText,
    reasoningText,
    toolCalls,
    finishReason,
    providerMetadata: {
      id: responseId,
      usage,
    },
  } satisfies ProviderChatResult
}
