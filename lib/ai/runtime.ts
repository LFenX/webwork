import "server-only"
import {
  completeAIRunStep,
  completeAIToolCallLog,
  createAIAuditLog,
  createAIRunStep,
  createAIToolCallLog,
  finalizeAIRun,
  getEffectiveProviderConfig,
  getAIRunByMessageId,
  listRecentConversationHistory,
} from "@/lib/ai/service"
import { AI_TOOL_MAP } from "@/lib/ai/tools/registry"
import { buildAIToolContext, compactText, createAIToolActor } from "@/lib/ai/tools/context"
import { resolveUserReference } from "@/lib/ai/tools/helpers"
import type {
  AIConversationHistoryEntry,
  AIRuntimePlan,
  AIRuntimePlanStep,
  AIRuntimeResponse,
  AIRunStepType,
  AIToolExecutionRecord,
} from "@/lib/ai/types"

type RuntimeParams = {
  userId: string
  conversationId: string
  assistantMessageId: string
  runId: string
  prompt: string
  onToken?: (chunk: string) => Promise<void> | void
  onEvent?: (event: string, payload: unknown) => Promise<void> | void
}

function extractTargetHint(prompt: string) {
  const directId = prompt.match(/\b[a-z0-9]{20,}\b/i)?.[0]
  const email = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const afterUser = prompt.match(/(?:用户|member|user|好友|friend)\s*[:：]?\s*([^\s，。]+)/i)?.[1]
  return directId ?? email ?? afterUser ?? null
}

async function buildPlan(prompt: string, actorUserId: string): Promise<AIRuntimePlan> {
  const normalized = prompt.toLowerCase()
  const targetHint = extractTargetHint(prompt)
  const resolvedTarget = targetHint ? await resolveUserReference(targetHint) : null
  const wantsAdminLookup = /管理员|代查|查看用户|目标用户|member|user profile|user activity|user session/i.test(prompt)

  const steps: AIRuntimePlanStep[] = []

  if (wantsAdminLookup && resolvedTarget && resolvedTarget.id !== actorUserId) {
    if (/活动|日志|login|logout|activity/i.test(normalized)) {
      steps.push({
        toolName: "get_admin_user_activity_log",
        reason: "用户明确要求管理员代查活动日志。",
        input: { targetUserId: resolvedTarget.id },
      })
    } else if (/会话|登录|session|device|ip/i.test(normalized)) {
      steps.push({
        toolName: "get_admin_user_sessions",
        reason: "用户明确要求管理员代查登录会话。",
        input: { targetUserId: resolvedTarget.id },
      })
    } else {
      steps.push({
        toolName: "get_admin_user_profile_overview",
        reason: "问题涉及指定用户概览，先获取受控的管理员视角资料。",
        input: { targetUserId: resolvedTarget.id },
      })
    }

    return {
      mode: "admin-delegated",
      delegatedTargetUserId: resolvedTarget.id,
      summary: `将以管理员受控范围查看 ${resolvedTarget.displayName || resolvedTarget.email} 的数据。`,
      steps,
    }
  }

  if (/主页|可见|对方页面|visible/i.test(normalized) && resolvedTarget && resolvedTarget.id !== actorUserId) {
    return {
      mode: "visible-user",
      delegatedTargetUserId: resolvedTarget.id,
      summary: "将按现有页面可见性规则读取目标用户公开可见内容。",
      steps: [
        {
          toolName: "get_visible_user_page_overview",
          reason: "问题涉及他人页面的可见范围。",
          input: { targetUserId: resolvedTarget.id },
        },
      ],
    }
  }

  if (/搜索|查找|检索|关键词|message search/i.test(normalized) && /聊天|消息|chat/i.test(normalized)) {
    steps.push({
      toolName: "search_my_chat_messages",
      reason: "问题是在当前用户聊天记录里做检索。",
      input: {
        query: prompt.replace(/.*?(搜索|查找|检索)/, "").trim() || prompt,
        peerHint: targetHint ?? undefined,
        limit: 10,
      },
    })
  } else if ((/聊天记录|会话消息|thread/i.test(normalized) || /和谁聊|跟谁聊/.test(prompt)) && targetHint) {
    steps.push({
      toolName: "get_my_chat_thread_messages",
      reason: "问题指向单个聊天对象的消息内容。",
      input: { peerHint: targetHint, limit: 12 },
    })
  } else if (/聊天|消息|chat/i.test(normalized)) {
    steps.push({
      toolName: "get_my_chat_threads_overview",
      reason: "问题涉及聊天数据，先获取会话级概览。",
      input: null,
    })
  }

  if (/好友|朋友|friend/i.test(normalized)) {
    steps.push({
      toolName: /详细|明细|detail|列表/.test(normalized) ? "get_my_friends_detail" : "get_my_friends_overview",
      reason: "问题涉及好友关系和互动情况。",
      input: null,
    })
  }

  if (/登录|ip|设备|session|会话|安全/.test(normalized)) {
    steps.push({
      toolName: "get_my_sessions_overview",
      reason: "问题涉及当前用户最近登录会话。",
      input: null,
    })
  }

  if (/活动|日志|记录|行为/.test(normalized) && !/聊天/.test(normalized)) {
    steps.push({
      toolName: "get_my_activity_log",
      reason: "问题涉及当前用户操作日志。",
      input: null,
    })
  }

  if (/设置|language|偏好/.test(normalized)) {
    steps.push({
      toolName: "get_my_settings",
      reason: "问题涉及站点设置和偏好。",
      input: null,
    })
  }

  if (/简历|resume|pdf/.test(normalized)) {
    steps.push({
      toolName: "get_my_resume_overview",
      reason: "问题涉及简历和版本。",
      input: null,
    })
  }

  if (/求职|投递|job|offer/.test(normalized)) {
    steps.push({
      toolName: "get_my_jobs_overview",
      reason: "问题涉及求职进展。",
      input: null,
    })
  }

  if (/面试|interview/.test(normalized)) {
    steps.push({
      toolName: "get_my_interviews_overview",
      reason: "问题涉及面试进展。",
      input: null,
    })
  }

  if (/文章|博客|daily|notes|reflection|内容/.test(normalized)) {
    steps.push({
      toolName: "get_my_posts_overview",
      reason: "问题涉及已发布内容。",
      input: null,
    })
  }

  if (steps.length === 0) {
    steps.push({
      toolName: "get_my_profile",
      reason: "未命中特定领域，先回到用户基础资料作为默认上下文。",
      input: null,
    })
  }

  const deduped = steps.filter((step, index, list) => list.findIndex((item) => item.toolName === step.toolName) === index)
  return {
    mode: "self",
    delegatedTargetUserId: null,
    summary: "将按问题内容挑选当前用户本人可访问的受控数据工具。",
    steps: deduped,
  }
}

function buildReasoningSummary(plan: AIRuntimePlan, executions: AIToolExecutionRecord[]) {
  return `${plan.summary} 共规划 ${plan.steps.length} 步，实际完成 ${executions.filter((item) => item.status === "completed").length} 个工具。`
}

function buildToolTraceSummary(executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) return "未执行工具。"
  return executions
    .map((item) => `${item.title}（${item.name}）：${item.status === "completed" ? "已完成" : `失败 - ${item.error ?? "未知错误"}`}`)
    .join("\n")
}

function buildFallbackAnswer(prompt: string, executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) {
    return `我没有匹配到可执行的受控工具。\n\n问题：${prompt}`
  }

  return [
    `问题：${prompt}`,
    "",
    ...executions.map((item) => {
      if (item.status === "failed") {
        return `## ${item.title}\n\n执行失败：${item.error ?? "未知错误"}`
      }

      return `## ${item.title}\n\n\`\`\`json\n${JSON.stringify(item.result, null, 2)}\n\`\`\``
    }),
  ].join("\n")
}

function buildModelMessages(params: {
  prompt: string
  history: AIConversationHistoryEntry[]
  plan: AIRuntimePlan
  executions: AIToolExecutionRecord[]
}) {
  const toolContext = params.executions
    .map((item) => `工具：${item.title} (${item.name})\n状态：${item.status}\n结果：${JSON.stringify(item.result)}`)
    .join("\n\n")

  return [
    {
      role: "system",
      content:
        "你是站内 AI 助手。只能依据对话上下文和受控工具结果回答，不得虚构或声称读取了未提供的数据。请用简洁、可信、结构化的中文回答。",
    },
    ...params.history.map((item) => ({ role: item.role, content: item.content })),
    {
      role: "user",
      content: [
        `当前问题：${params.prompt}`,
        `执行模式：${params.plan.mode}`,
        `执行摘要：${params.plan.summary}`,
        "",
        toolContext || "本次没有工具结果。",
      ].join("\n"),
    },
  ]
}

async function streamOpenAICompatibleResponse(params: {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  streamEnabled: boolean
  messages: Array<{ role: string; content: string }>
  onToken?: (chunk: string) => Promise<void> | void
}) {
  const endpoint = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      stream: params.streamEnabled,
      messages: params.messages,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Provider request failed with status ${response.status}`)
  }

  if (!params.streamEnabled) {
    const payload = await response.json()
    const text = payload?.choices?.[0]?.message?.content
    if (typeof text !== "string" || !text.trim()) throw new Error("Provider returned an empty response")
    if (params.onToken) {
      for (const chunk of text.match(/.{1,80}/g) ?? [text]) await params.onToken(chunk)
    }
    return text
  }

  if (!response.body) throw new Error("Provider stream is unavailable")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let built = ""

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
      const payload = JSON.parse(data)
      const delta = payload?.choices?.[0]?.delta?.content
      if (typeof delta === "string" && delta.length > 0) {
        built += delta
        if (params.onToken) await params.onToken(delta)
      }
    }
  }

  if (!built.trim()) throw new Error("Provider returned an empty streaming response")
  return built
}

async function emit(params: RuntimeParams, event: string, payload: unknown) {
  if (params.onEvent) await params.onEvent(event, payload)
}

async function runStep(params: RuntimeParams, type: AIRunStepType, title: string, summary: string, work: (stepId: string) => Promise<unknown>) {
  const step = await createAIRunStep({
    runId: params.runId,
    messageId: params.assistantMessageId,
    userId: params.userId,
    type,
    title,
    summary,
  })
  await emit(params, type, {
    stepId: step.id,
    title,
    status: "running",
    summary,
  })

  try {
    const result = await work(step.id)
    await completeAIRunStep(step.id, {
      status: "completed",
      summary,
      outputPreview: result,
    })
    return { stepId: step.id, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await completeAIRunStep(step.id, {
      status: "failed",
      summary,
      errorMessage: message,
    })
    await emit(params, type === "tool_started" ? "tool_failed" : "run_failed", {
      stepId: step.id,
      title,
      status: "failed",
      summary,
      errorMessage: message,
    })
    throw error
  }
}

async function executePlan(params: RuntimeParams, plan: AIRuntimePlan) {
  const actor = await createAIToolActor(params.userId)
  const executions: AIToolExecutionRecord[] = []

  for (const step of plan.steps) {
    const tool = AI_TOOL_MAP.get(step.toolName)
    if (!tool) continue

    await runStep(params, "tool_started", `调用 ${tool.title}`, step.reason, async (runStepId) => {
      const input = step.input ?? {}
      const context = buildAIToolContext({
        actor,
        targetUserId: (input as { targetUserId?: string }).targetUserId ?? plan.delegatedTargetUserId ?? actor.userId,
        scope: tool.scope,
      })
      const log = await createAIToolCallLog({
        conversationId: params.conversationId,
        messageId: params.assistantMessageId,
        userId: params.userId,
        toolName: tool.name,
        toolInputJson: input,
      })

      try {
        const result = await tool.execute({ ...context, ...(input ?? {}) })
        await completeAIToolCallLog(log.id, result, "completed")
        await createAIAuditLog(actor.userId, context.targetUserId, "ai_tool_executed", tool.auditLabel, {
          runId: params.runId,
          stepId: runStepId,
          toolName: tool.name,
          scope: tool.scope,
          delegatedTargetUserId: plan.delegatedTargetUserId ?? null,
        })
        executions.push({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          input: input ?? null,
          result,
          status: "completed",
          scope: tool.scope,
          sensitivity: tool.sensitivity,
          auditLabel: tool.auditLabel,
        })
        await emit(params, "tool_completed", {
          stepId: runStepId,
          toolName: tool.name,
          title: tool.title,
          status: "completed",
          summary: step.reason,
          outputPreview: result,
        })
        return result
      } catch (error) {
        const failure = { error: error instanceof Error ? error.message : "Unknown tool error" }
        await completeAIToolCallLog(log.id, failure, "failed")
        executions.push({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          input: input ?? null,
          result: failure,
          status: "failed",
          error: failure.error,
          scope: tool.scope,
          sensitivity: tool.sensitivity,
          auditLabel: tool.auditLabel,
        })
        throw error
      }
    })
  }

  return executions
}

export async function runAIRuntime(params: RuntimeParams): Promise<AIRuntimeResponse> {
  await emit(params, "run_started", { runId: params.runId, conversationId: params.conversationId })

  const planStep = await runStep(params, "plan_created", "生成执行计划", "根据问题和权限生成受控执行计划。", async () => {
    const plan = await buildPlan(params.prompt, params.userId)
    return {
      mode: plan.mode,
      summary: plan.summary,
      steps: plan.steps.map((item) => ({ toolName: item.toolName, reason: item.reason })),
      delegatedTargetUserId: plan.delegatedTargetUserId ?? null,
    }
  })

  const plan = (await buildPlan(params.prompt, params.userId))
  await emit(params, "plan_created", {
    stepId: planStep.stepId,
    runId: params.runId,
    mode: plan.mode,
    summary: plan.summary,
    delegatedTargetUserId: plan.delegatedTargetUserId ?? null,
    steps: plan.steps,
    persisted: planStep.result,
  })

  const executions = await executePlan(params, plan)
  const reasoningSummary = buildReasoningSummary(plan, executions)
  const toolTraceSummary = buildToolTraceSummary(executions)

  const verificationStep = await runStep(params, "verification_started", "检查工具结果", "检查已执行工具是否完整并形成结论上下文。", async () => ({
    completedTools: executions.filter((item) => item.status === "completed").length,
    failedTools: executions.filter((item) => item.status === "failed").length,
  }))
  await emit(params, "verification_completed", {
    stepId: verificationStep.stepId,
    runId: params.runId,
    summary: toolTraceSummary,
  })

  const history = await listRecentConversationHistory(params.userId, params.conversationId, 10)
  const provider = await getEffectiveProviderConfig(params.userId)
  let contentMarkdown = ""
  let modelName = "structured-fallback"
  let runSummary = reasoningSummary

  await runStep(params, "final_started", "生成最终回答", "基于工具结果生成最终结论。", async () => {
    if (provider) {
      try {
        contentMarkdown = await streamOpenAICompatibleResponse({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: provider.model,
          temperature: provider.temperature,
          streamEnabled: provider.streamEnabled,
          messages: buildModelMessages({
            prompt: params.prompt,
            history,
            plan,
            executions,
          }),
          onToken: params.onToken,
        })
        modelName = provider.model
      } catch (error) {
        const intro = `> provider 调用失败，已回退到结构化模式：${error instanceof Error ? error.message : "未知错误"}\n\n`
        contentMarkdown = intro + buildFallbackAnswer(params.prompt, executions)
        if (params.onToken) {
          for (const chunk of contentMarkdown.match(/.{1,100}/g) ?? [contentMarkdown]) {
            await params.onToken(chunk)
          }
        }
        modelName = `${provider.model} (fallback)`
      }
    } else {
      contentMarkdown = buildFallbackAnswer(params.prompt, executions)
      if (params.onToken) {
        for (const chunk of contentMarkdown.match(/.{1,100}/g) ?? [contentMarkdown]) {
          await params.onToken(chunk)
        }
      }
    }

    runSummary = compactText(reasoningSummary, 140)
    await finalizeAIRun({
      runId: params.runId,
      status: "completed",
      summary: runSummary,
      finalModel: modelName,
    })
    return { modelName, contentLength: contentMarkdown.length }
  })

  await emit(params, "run_completed", {
    runId: params.runId,
    summary: runSummary,
    modelName,
  })

  const run = await getAIRunByMessageId(params.userId, params.assistantMessageId, true)

  return {
    contentMarkdown,
    reasoningSummary,
    toolTraceSummary,
    modelName,
    toolExecutions: executions,
    plan,
    compactSteps: run?.steps.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      status: item.status,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      summary: item.summary,
      errorMessage: item.errorMessage,
    })) ?? [],
    runSummary,
  }
}
