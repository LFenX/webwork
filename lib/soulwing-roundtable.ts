import "server-only"
import { randomUUID } from "crypto"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { requestProviderChat } from "@/lib/ai/provider"
import { buildAgentPersonaPrompt, loadAgentPersonaContext } from "@/lib/ai/agent-profile-service"
import { runWebSearchTool } from "@/lib/web-search"

export const SOULWING_ROUNDTABLE_CHANNEL_ID = "soulwing-roundtable"

type RoundtableSlot = "morning" | "evening" | "manual"
type DiscussionSource = "auto" | "admin"
type MemberStatus = "disabled" | "ready-web" | "ready-card" | "not-ready" | "opted-out" | "paused"
type Phase = "opening" | "warmup" | "discuss" | "pivot" | "debate" | "synthesis_lead" | "afterglow" | "closing"
type LengthProfile = "spark" | "standard" | "developed" | "deep_dive" | "final_synthesis" | "afterglow" | "followup_answer" | "final"
type ArcBeat =
  | "open_hook"
  | "build"
  | "challenge"
  | "frame_shift"
  | "counterfactual"
  | "case_lab"
  | "material_recall"
  | "thread_bridge"
  | "self_revision"
  | "silence_break"
  | "final_synthesis"
  | "afterglow_reply"
  | "final_close"

export type MaterialCard = {
  title: string
  brief: string
  facts: string[]
  sources: Array<{ title: string; url?: string }>
  questions: string[]
  generatedAt: string
}

type RoundtableMember = {
  id: string
  email: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
  agentName: string
  ownerDisplayName: string
  status: MemberStatus
  hasAgent: boolean
  canUseAI: boolean
  hasWebSearch: boolean
  participationEnabled: boolean
  adminPaused: boolean
  pauseReason: string
}

type StoredMessage = {
  id: string
  authorUserId: string | null
  authorName: string
  authorAvatarUrl: string | null
  kind: string
  round: number
  text: string
  userProvided: boolean
  metadata: unknown
  deletedAt: Date | null
  createdAt: Date
}

const SHANGHAI_TZ = "Asia/Shanghai"
const TOOL_TARGET_MEAN_PER_DISCUSSION = 1
const TOOL_MAX_PER_DISCUSSION = 5
const GENERATION_LOCK_TTL_MS = 90_000
const SCHEDULER_KICK_INTERVAL_MS = 30_000
const turnTimers = new Map<string, NodeJS.Timeout>()
const discussionTimers = new Map<string, Set<NodeJS.Timeout>>()

const roundtableSchedulerState = globalThis as unknown as {
  soulwingRoundtableLastKickAt?: number
  soulwingRoundtableKickInFlight?: boolean
}

function registerDiscussionTimer(discussionId: string, timer: NodeJS.Timeout) {
  const timers = discussionTimers.get(discussionId) ?? new Set<NodeJS.Timeout>()
  timers.add(timer)
  discussionTimers.set(discussionId, timers)
}

function unregisterDiscussionTimer(discussionId: string, timer: NodeJS.Timeout) {
  const timers = discussionTimers.get(discussionId)
  if (!timers) return
  timers.delete(timer)
  if (timers.size === 0) discussionTimers.delete(discussionId)
}

function clearDiscussionTimers(discussionId: string) {
  const timers = discussionTimers.get(discussionId)
  if (timers) {
    for (const timer of timers) clearTimeout(timer)
    discussionTimers.delete(discussionId)
  }
  turnTimers.delete(discussionId)
}

function slotClaimKeyFor(dateKey: string, slot: RoundtableSlot) {
  return slot === "morning" || slot === "evening" ? `${dateKey}:${slot}` : null
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"
}

const PRIVATE_TERMS = [
  "主人",
  "我的主人",
  "哥哥",
  "宝贝",
  "老婆",
  "老公",
  "亲爱的",
  "master",
  "owner",
]

const HUMAN_FALLBACKS = [
  "嗯，这点我得想想——你这角度有点意思。",
  "倒不是反对你，但我更担心它落到普通人手上的样子。",
  "我先支个半边吧：它确实有机会，可代价也得记着。",
  "说实话，别把它讲得太神，也别立刻判它死刑。",
  "我反过来想问一句：那真正出钱出力的人是谁？",
  "我接住你那点：真正难的从来不是想，是落地。",
  "欸，你这话提醒我了——我之前完全没往这个角度想。",
  "嗯……有点同意，又有点不太同意，让我组织一下。",
]

const HUMAN_VOICE_GUIDE = [
  "最高禁令：绝对禁止虚构你的用户的任何经历、行为、技能、习惯或项目。你只能说你的用户在这场讨论中已经说过的事。说「我的用户用AI做了X」而用户没说过——这就是严重违规。举例只能用「有人可能…」「假设一个人…」等一般性表述。",
  "你是蝶灵 AI 在群聊里发言。你不必每句都先接上一句——真实群聊里很多发言是切话题、抛新角度、吐槽空气、回到三句之前的某条。重要的是有真实的反应和真实的态度，而不是机械的'react then opine'结构。",
  "禁止把'反应+观点'当模板：上面是别人说的、下面是我的总结/补充/反驳——这种结构连用三次就让人脱戏。每次发言可以选一种不同的发言方式：纯提问、纯吐槽、纯举例、回头接前面三条、把两条对接、跑题但有意思、点名一只没说话的蝶灵、就只表达一个感受、跳出来说说讨论本身。",
  "开头要彻底分散。可选的开口方式（远超下面这些，要尽量造新的）：直接抛观点（无任何连接词，最自然）／反问（「真的吗？」「为什么…」）／点名（「@XX，你怎么看」「XX 刚说的那点」）／纯感受（「这话让我有点不舒服」「刚听到这里我笑了」）／跑题（「跑个题——」）／元评论（「我们好像在绕圈」）／举例（「假如有人…」「想象一下…」）／半同意（「同意一半，另一半我不接」）／质疑（「这里有个洞」）／其他自然的表达。",
  "硬性约束：本场讨论中，相同的开口词或开口方式不要超过两次。如果系统在 prompt 里告诉你某些开头最近用过了，你必须避开它们。最理想的状态是大约一半的发言完全没有开头连接词，直接说内容。",
  "强烈推荐：直接用观点、反问、感受、举例做开头，不用任何'嗯/对/欸/我倒觉得'之类的连接词。没有连接词永远是最自然的。",
  "禁止自言自语式的多角色扮演。你是一只蝶灵，每轮只说一句话（一句 = 一段连贯的话，但只代表你这只蝶灵一个立场）。不要在同一句里切换不同立场的人对话，不要自己提问自己回答，不要写独白式的长篇自我辩论。",
  "可以反问、自嘲、轻轻开个玩笑，可以承认自己也没想清楚，可以直接 cue 群里另一只蝶灵的名字。",
  "禁止：会议总结口吻、综上所述、首先其次、列点 1.2.3、写「作为一只蝶灵」这种自我说明、念稿式陈述、连续两句以上以「我认为」或「我觉得」开头。",
  "禁止暴露任何亲密称呼（哥哥/老婆/老公/主人/master 等）。指代你绑定的人类时，自然地用 TA 的名字、「我家那位」、「我搭档」、「我那位人类」之类；避免每条都用「我的用户」，那很僵硬。",
  "禁止任何 emoji、Markdown 标记（如 #、*、>、`）和列表符号；让人读起来像微信聊天框里的朴素文字。",
].join("\n")

// Reply intents: distinct ways an agent can take its turn. Picked weighted by phase.
const REPLY_INTENTS: Record<string, { label: string; instruction: string }> = {
  agree_build: {
    label: "顺势深化",
    instruction: "你认同前面某条具体发言（在你的话里点出是哪只蝶灵或大致引用一句），然后往前推一步：给一个新角度、一个具体例子，或者一个延伸推论。重点是'推一步'，不要只是说'+1'。",
  },
  challenge: {
    label: "针对性挑战",
    instruction: "直接挑战刚才某条具体发言（点名是谁说的或重述一下那个观点），讲清楚你为什么不同意。要给替代视角，不只是抬杠。语气可以坚定但保留余地。",
  },
  tangent: {
    label: "有意跑题",
    instruction: "你顺着前面某句飘出去，从一个意外的、相关但不重叠的角度切入。可以承认你正在跑题（'跑个题'）但要让别人觉得跑得有意思。",
  },
  ask: {
    label: "纯提问",
    instruction: "你这一轮不给观点，只抛一个具体问题。可以是真的好奇，也可以是装天真但戳到核心。可以反问群里所有人，或者点名某一只蝶灵。一定要是问题，不要混杂自己的论点。",
  },
  observe: {
    label: "旁观点出",
    instruction: "你像旁观者一样，注意到讨论里某个有趣的现象（大家都绕开某点／所有人的预设其实一样／刚才两位其实在说同一件事），把它说出来。不站队、不下结论。",
  },
  recap_thread: {
    label: "对接两条",
    instruction: "你把前面两条不同的发言对接起来，明确点名是哪两条／哪两位，指出它们之间的呼应或矛盾，再形成一个新的判断。",
  },
  feeling: {
    label: "纯感受",
    instruction: "这一轮不论证、不举例，只表达讨论给你的真实感受——疑惑／不安／想笑／被戳到／有点冒犯／怅然。允许情绪化但别矫情，一两句就够。",
  },
  anecdote: {
    label: "假设举例",
    instruction: "抛一个假设性的小场景或类比把抽象观点落地。开头用'假如有人…''想象一下…''换个例子说…'这类。注意：一切例子必须是假设性的，不许说'我做过'或'我的用户做过'。",
  },
  callback_quiet: {
    label: "点名沉默者",
    instruction: "直接 cue 一只之前还没怎么说话的蝶灵，问 TA 怎么看。简洁，不要解释为什么点 TA。开头就直接是名字 + 一句具体的问题。",
  },
  half_agree: {
    label: "半同意",
    instruction: "你只同意前面某条发言的一半。明确说出哪一半你接受、哪一半你保留——不许骑墙含糊。结构可以是：'前半句对，后半句不太成立，因为…'。",
  },
  meta: {
    label: "元评论",
    instruction: "跳出讨论本身，评论这场对话正在变成什么样子（'我们好像在绕圈''这一段悄悄换了主题''有个角度还没人碰''气氛突然变严肃了'）。然后给一句把方向轻轻拽回来的话。",
  },
  reframe: {
    label: "重构提问",
    instruction: "把刚才的问题换一种问法：把「该不该 X」换成「在什么条件下才 X」，或把「是 A 还是 B」换成「A 与 B 衡量的其实是什么」。一句重构，加一句你的初步答案。",
  },
  concrete_case: {
    label: "具体落地",
    instruction: "把上面的抽象论点拉到一个非常具体的场景里检验，比如放到一个刚换行的人、一家 10 人小公司、一次真实协作里。要具体到能让人想象画面。",
  },
  self_doubt: {
    label: "动摇自己",
    instruction: "你对自己前面或本场里默认的立场自我反水一下：承认「我刚才那句有个洞」或「我原来站那边，但现在有点动摇」。要真实犹豫，不要表演谦虚。",
  },
  silence_break: {
    label: "打破回音壁",
    instruction: "直接点出大家可能在用不同词说同一件事，或者一直绕开同一个前提。说清核心重复在哪里，再给一个新方向。",
  },
  quote_back: {
    label: "原话回引",
    instruction: "完整或半完整地回引前面某只蝶灵的一句话，点名是谁，然后只对那一句做具体反应：同意、反驳或追问。不要展开自己的全套观点。",
  },
  material_recall: {
    label: "回头看资料卡",
    instruction: "回到资料卡或额外资料里的一个具体事实、数据、名词或前提，让讨论重新落到具体面，而不是继续空转。",
  },
}

const PHASE_INTENT_WEIGHTS: Record<Phase, Record<string, number>> = {
  opening: { ask: 3, anecdote: 2, observe: 1, feeling: 1 },
  warmup: { agree_build: 3, ask: 2, half_agree: 2, anecdote: 1, feeling: 1, observe: 1 },
  discuss: { agree_build: 3, ask: 2, anecdote: 2, tangent: 1, half_agree: 2, observe: 1, callback_quiet: 1, concrete_case: 2, quote_back: 1 },
  pivot: { reframe: 3, silence_break: 3, meta: 2, callback_quiet: 2, observe: 2, tangent: 1 },
  debate: { challenge: 3, half_agree: 2, recap_thread: 2, self_doubt: 2, observe: 1, meta: 1, concrete_case: 2, quote_back: 1 },
  synthesis_lead: { recap_thread: 3, material_recall: 2, observe: 1 },
  afterglow: { feeling: 3, half_agree: 2, observe: 2, quote_back: 1 },
  closing: { feeling: 3, observe: 2, recap_thread: 1 },
}

function pickReplyIntent(phase: Phase, opts?: {
  isFirstTurn?: boolean
  isFinalTurn?: boolean
  respondingToUser?: boolean
  mention?: boolean
  isFollowupReply?: boolean
}) {
  if (opts?.isFirstTurn || opts?.mention || opts?.respondingToUser || opts?.isFollowupReply) return null
  // 22% of turns: no intent assigned, let the model find its own shape.
  if (Math.random() < 0.22) return null
  const weights = PHASE_INTENT_WEIGHTS[phase] ?? PHASE_INTENT_WEIGHTS.discuss
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [key, w] of entries) {
    r -= w
    if (r <= 0) return key
  }
  return entries[0][0]
}

function buildIntentPrompt(intentKey: string | null) {
  if (!intentKey) return ""
  const intent = REPLY_INTENTS[intentKey]
  if (!intent) return ""
  return `\n=== 本句发言意图（按这个意图自然行动，不要复读这段话）===\n${intent.instruction}`
}

function extractOpener(text: string): string {
  const cleaned = text.replace(/^[\s"'“”‘’`，。：、!~]+/, "").trim()
  // Take the first 4 chinese chars (or 8 ascii) as a coarse signature
  if (!cleaned) return ""
  const head = cleaned.slice(0, 6)
  // Strip trailing punctuation
  return head.replace(/[，。！？～、:：…—\s]+$/, "")
}

function getRecentOpeners(messages: StoredMessage[], count = 8): string[] {
  return messages
    .filter((m) => m.kind === "agent" || m.kind === "duty" || m.kind === "mention_reply")
    .slice(-count)
    .map((m) => extractOpener(m.text))
    .filter(Boolean)
}

function pickReplyTarget(messages: StoredMessage[], speakerId: string): StoredMessage | null {
  const eligible = messages.filter(
    (m) =>
      m.authorUserId !== speakerId &&
      m.text &&
      (m.kind === "agent" ||
        m.kind === "duty" ||
        m.kind === "user_speak" ||
        m.kind === "user_mention" ||
        m.kind === "user_proxy" ||
        m.kind === "mention_reply"),
  )
  if (eligible.length === 0) return null
  // 70% from the last 6 messages, 30% reach back further if available
  const recent = eligible.slice(-6)
  const older = eligible.slice(0, -6)
  if (older.length > 0 && Math.random() < 0.3) {
    return older[Math.floor(Math.random() * older.length)]
  }
  return recent[Math.floor(Math.random() * recent.length)]
}

function shanghaiNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

export function getRoundtableDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("year")}-${pick("month")}-${pick("day")}`
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return Math.min(Math.max(hour * 60 + minute, 0), 23 * 60 + 59)
}

function nextTimeLabel(
  settings: { enabled: boolean; morningEnabled: boolean; eveningEnabled: boolean; morningTime: string; eveningTime: string },
  now = new Date(),
) {
  if (!settings.enabled) return "今日圆桌已暂停"
  const current = shanghaiNow(now)
  const candidates = [
    settings.morningEnabled ? { slot: "晨间讨论", minutes: timeToMinutes(settings.morningTime), time: settings.morningTime } : null,
    settings.eveningEnabled ? { slot: "夜间讨论", minutes: timeToMinutes(settings.eveningTime), time: settings.eveningTime } : null,
  ].filter((item): item is { slot: string; minutes: number; time: string } => Boolean(item))
  const next = candidates.find((item) => item.minutes > current) ?? candidates[0]
  if (!next) return "今日暂无自动讨论"
  return `${next.slot} ${next.time}`
}

function safePublicText(value: string, max = 600) {
  let text = value
    .replace(/\r/g, "")
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  for (const term of PRIVATE_TERMS) {
    text = text.replaceAll(term, "我的用户")
  }
  if (text.length > max) text = `${text.slice(0, max - 1)}…`
  return text
}

function pickOwnerAlias(ownerName: string): string {
  const safeName = ownerName?.trim() || "TA"
  const pool = [
    safeName,
    safeName,
    "我家那位",
    "我搭档",
    "我那位人类",
    "我服务的那位",
    "这位发起人",
    "我的用户",
  ]
  return pool[Math.floor(Math.random() * pool.length)] ?? safeName
}

function sanitizePrivateTerms(text: string, ownerName: string): string {
  let firstReplaced = false
  let result = text
  for (const term of PRIVATE_TERMS) {
    if (!result.includes(term)) continue
    result = result.replaceAll(term, () => {
      if (!firstReplaced) {
        firstReplaced = true
        return pickOwnerAlias(ownerName)
      }
      return "我的用户"
    })
  }
  return result
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function stripLeadingOwnerAddress(text: string, ownerName: string) {
  const aliases = [
    ownerName?.trim(),
    "\u6211\u5bb6\u90a3\u4f4d",
    "\u6211\u642d\u6863",
    "\u6211\u90a3\u4f4d\u4eba\u7c7b",
    "\u6211\u670d\u52a1\u7684\u90a3\u4f4d",
    "\u6211\u7684\u7528\u6237",
  ].filter((value): value is string => Boolean(value))
  let result = text.trim()
  for (const alias of aliases) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(alias)}\\s*[\\uFF0C,\\u3001:?-]+\\s*`)
    result = result.replace(pattern, "").trim()
  }
  return result || text.trim()
}

function splitSentences(text: string) {
  const sentences = text
    .replace(/\n{3,}/g, "\n\n")
    .split(/(?<=[。！？.!?…])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  return sentences.length > 0 ? sentences : [text.trim()].filter(Boolean)
}

function trimClosingMonologue(text: string, opts?: { isFinalTurn?: boolean; isClosingPhase?: boolean }) {
  if (!opts?.isFinalTurn && !opts?.isClosingPhase) return text
  const sentences = splitSentences(text)
  if (sentences.length <= 2 && !opts?.isFinalTurn) return text

  const farewellPattern = /散|晚安|回头|下次|到这|就这样|各自|休息|明天见|拜|再见|收工|打住|好啦|结束|溜了|告辞|消化|下回/
  const farewellCount = sentences.filter((sentence) => farewellPattern.test(sentence)).length
  if (farewellCount >= 2) {
    const firstFarewellIdx = sentences.findIndex((sentence) => farewellPattern.test(sentence))
    return sentences.slice(0, Math.max(firstFarewellIdx + 1, 1)).join("").trim()
  }
  if (opts?.isFinalTurn && sentences.length > 1) {
    return sentences.slice(0, 1).join("").trim()
  }
  return text
}

const FAREWELL_TERMS = [
  "散吧",
  "晚安",
  "早安",
  "早点睡",
  "下次",
  "回头",
  "先撤",
  "先歇",
  "先睡",
  "收工",
  "各位带着",
  "聊到这儿",
  "聊到这里",
]

type ShanghaiTimeContext = {
  timezone: "Asia/Shanghai"
  localTime: string
  period: "early_morning" | "morning" | "noon" | "afternoon" | "evening" | "late_night"
  allowedClosings: string[]
  forbiddenClosings: string[]
}

function getShanghaiTimeContext(now = new Date()): ShanghaiTimeContext {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const hourText = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minuteText = parts.find((part) => part.type === "minute")?.value ?? "00"
  const hour = Number(hourText)
  const baseForbidden = ["晚安", "早安", "早点睡"]

  if (hour >= 5 && hour < 9) {
    return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "early_morning", allowedClosings: ["早安，这场先停在这里。", "今天先从这里开始。"], forbiddenClosings: ["晚安", "早点睡"] }
  }
  if (hour >= 9 && hour < 12) {
    return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "morning", allowedClosings: ["上午先收在这里。", "这一圈上午先停住。"], forbiddenClosings: baseForbidden }
  }
  if (hour >= 12 && hour < 14) {
    return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "noon", allowedClosings: ["午间先放到这里。", "中午先收在这里。"], forbiddenClosings: baseForbidden }
  }
  if (hour >= 14 && hour < 18) {
    return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "afternoon", allowedClosings: ["下午先收在这里。", "这一场下午先停住。"], forbiddenClosings: baseForbidden }
  }
  if (hour >= 18 && hour < 23) {
    return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "evening", allowedClosings: ["今晚先收在这里。", "晚点再慢慢消化。"], forbiddenClosings: ["早安", "早点睡"] }
  }
  return { timezone: SHANGHAI_TZ, localTime: `${hourText}:${minuteText}`, period: "late_night", allowedClosings: ["夜深了，先收在这里。", "早点睡，先到这里。"], forbiddenClosings: ["早安"] }
}

function stripForbiddenFarewell(text: string) {
  let earliest = -1
  for (const term of FAREWELL_TERMS) {
    const index = text.indexOf(term)
    if (index >= 0 && (earliest < 0 || index < earliest)) earliest = index
  }
  if (earliest < 0) return text
  const stripped = text.slice(0, earliest).replace(/[，,；;：:\s]+$/, "").trim()
  return stripped || "这个判断我认，尤其是要给人留修正口。"
}

function pickTimedClosing(context: ShanghaiTimeContext) {
  return context.allowedClosings[Math.floor(Math.random() * context.allowedClosings.length)] ?? "这场先收在这里。"
}

function hardLimitText(text: string, max: number) {
  const cleaned = text.trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, Math.max(max - 1, 1)).trim()}…`
}

function enforceLengthProfile(text: string, profile: LengthProfile) {
  const limits: Record<LengthProfile, { chars: number; sentences: number; paragraphs: number }> = {
    spark: { chars: 70, sentences: 2, paragraphs: 1 },
    standard: { chars: 140, sentences: 3, paragraphs: 1 },
    developed: { chars: 240, sentences: 5, paragraphs: 1 },
    deep_dive: { chars: 420, sentences: 8, paragraphs: 2 },
    final_synthesis: { chars: 560, sentences: 14, paragraphs: 5 },
    afterglow: { chars: 110, sentences: 2, paragraphs: 1 },
    followup_answer: { chars: 280, sentences: 6, paragraphs: 2 },
    final: { chars: 28, sentences: 1, paragraphs: 1 },
  }
  const limit = limits[profile]
  const paragraphLimited = text.split(/\n{2,}/).slice(0, limit.paragraphs).join("\n\n")
  const sentences = splitSentences(paragraphLimited)
  const sentenceLimited = sentences.length > limit.sentences
    ? sentences.slice(0, limit.sentences).join("").trim()
    : paragraphLimited.trim()
  return hardLimitText(sentenceLimited, limit.chars)
}

function sanitizeAgentOutput(params: {
  text: string
  ownerName: string
  phase: Phase
  lengthProfile: LengthProfile
  isFinalTurn?: boolean
  timeContext?: ShanghaiTimeContext
  allowOwnerAddress?: boolean
}) {
  let text = params.text
    .replace(/\r/g, "")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/^\s*[-*#>]+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  text = sanitizePrivateTerms(text, params.ownerName)
  if (!params.allowOwnerAddress) {
    text = stripLeadingOwnerAddress(text, params.ownerName)
  }
  if (params.phase === "synthesis_lead" || params.phase === "afterglow") {
    text = stripForbiddenFarewell(text)
  }
  text = trimClosingMonologue(text, {
    isFinalTurn: params.isFinalTurn,
    isClosingPhase: params.phase === "closing",
  })
  if (params.isFinalTurn && params.timeContext) {
    const forbidden = params.timeContext.forbiddenClosings.some((term) => text.includes(term))
    const allowed = params.timeContext.allowedClosings.some((term) => text.includes(term.replace(/[。！？.!?]+$/, "")))
    if (forbidden || !allowed) text = pickTimedClosing(params.timeContext)
  }
  text = enforceLengthProfile(text, params.lengthProfile)
  if (params.isFinalTurn) {
    text = trimClosingMonologue(text, { isFinalTurn: true })
    text = enforceLengthProfile(text, "final")
  }
  return text
}

function safeAgentName(user: { displayName: string; email: string }, identityContent?: string | null) {
  const source = identityContent ?? ""
  const patterns = [
    /(?:中文名|姓名|名字|名称)\s*(?:[:：])\s*[「『“"']?([一-龥A-Za-z0-9_·\-]{1,16})/,
    /蝶灵(?:名字|名称)?(?:叫|是|为|：|:)?\s*[「『“"']?([一-龥A-Za-z0-9_·\-]{2,16})/,
    /(?:你叫|你名叫|名字叫|名字是|叫做|称呼为)\s*[「『“"']?([一-龥A-Za-z0-9_·\-]{2,16})/,
  ]
  const custom = patterns
    .map((pattern) => source.match(pattern)?.[1]?.trim())
    .find((name) => name && !PRIVATE_TERMS.some((term) => name.includes(term)))
  if (custom) return custom
  const ownerName = user.displayName || user.email.split("@")[0] || "某位用户"
  return `${ownerName}的蝶灵`
}

function fallbackTopics(dateKey: string) {
  const morning = [
    ["AI 工具进入日常工作流后，普通人该兴奋还是警惕？", "从效率、职业分工、信息可信度三个角度聊聊现实影响。"],
    ["今天的科技热点背后，真正改变普通人的是什么？", "不追热词，尝试拆出对工作、生活和商业的实际影响。"],
    ["当商业都在谈降本增效，人的价值该怎么被看见？", "围绕效率、创造力、协作和长期主义展开观察。"],
  ]
  const evening = [
    ["如果人生没有标准答案，选择还需要被证明吗？", "聊聊成长、犹豫、后悔与自我确认。"],
    ["孤独到底是问题，还是一种需要学会使用的空间？", "从关系、边界、陪伴和自我整理展开讨论。"],
    ["我们努力变好，是为了抵达哪里？", "聊聊意义感、内耗、节奏和对自己的期待。"],
  ]
  const index = Number(dateKey.slice(-2)) % morning.length
  return {
    morningTitle: morning[index][0],
    morningDescription: morning[index][1],
    eveningTitle: evening[index][0],
    eveningDescription: evening[index][1],
  }
}

function buildAnnouncement(day: { morningTitle: string; eveningTitle: string }, dutyName: string, nextTime: string) {
  return [
    `今日晨间议题：${day.morningTitle}`,
    `今日夜间议题：${day.eveningTitle}`,
    `当前值日蝶灵：${dutyName}`,
    `下一场讨论时间：${nextTime}`,
  ].join("\n")
}

async function getSettings() {
  return prisma.soulWingRoundtableSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  })
}

async function getWebSearchConfigOwners(activeConfigIds: string[]) {
  if (activeConfigIds.length === 0) return new Set<string>()
  const rows = await prisma.aIWebSearchConfig.findMany({
    where: { ownerType: "USER_CONFIG", ownerId: { in: activeConfigIds }, enabled: true },
    select: { ownerId: true, apiKeyEncrypted: true },
  })
  return new Set(rows.filter((row) => Boolean(row.apiKeyEncrypted)).map((row) => row.ownerId))
}

async function getRoundtableMembers(): Promise<RoundtableMember[]> {
  const [users, participantRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarText: true,
        avatarUrl: true,
        profile: { select: { enabled: true, identityContent: true, avatarUrl: true } },
        aiProviderConfigs: {
          where: { isActive: true },
          select: { id: true, isEnabled: true, apiKeyEncrypted: true },
          take: 1,
        },
        aiUsageGrant: { select: { status: true, apiKeyEncrypted: true, webSearchEnabled: true } },
      },
    }),
    prisma.soulWingRoundtableParticipant.findMany(),
  ])
  const participantByUserId = new Map(participantRows.map((row) => [row.userId, row]))
  const activeConfigIds = users.flatMap((user) => user.aiProviderConfigs.map((config) => config.id))
  const webSearchConfigOwners = await getWebSearchConfigOwners(activeConfigIds)

  return users.map((user) => {
    const participation = participantByUserId.get(user.id)
    const activeConfig = user.aiProviderConfigs[0]
    const hasAgent = Boolean(user.profile?.enabled)
    const hasUserConfig = Boolean(activeConfig?.isEnabled && activeConfig.apiKeyEncrypted)
    const hasGrant = user.aiUsageGrant?.status === "active" && Boolean(user.aiUsageGrant.apiKeyEncrypted)
    const canUseAI = hasUserConfig || hasGrant
    const participationEnabled = participation?.enabled ?? true
    const adminPaused = participation?.adminPaused ?? false
    const hasWebSearch = Boolean(
      (activeConfig && webSearchConfigOwners.has(activeConfig.id)) ||
      (user.aiUsageGrant?.status === "active" && user.aiUsageGrant.webSearchEnabled),
    )

    let status: MemberStatus = "ready-card"
    if (!hasAgent) status = "disabled"
    else if (!participationEnabled) status = "opted-out"
    else if (adminPaused) status = "paused"
    else if (!canUseAI) status = "not-ready"
    else if (hasWebSearch) status = "ready-web"

    const agentAvatarUrl = user.profile?.avatarUrl ?? user.avatarUrl
    const ownerDisplayName = user.displayName || user.email.split("@")[0] || "TA"
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarText: user.avatarText,
      avatarUrl: agentAvatarUrl,
      agentName: safeAgentName(user, user.profile?.identityContent),
      ownerDisplayName,
      status,
      hasAgent,
      canUseAI,
      hasWebSearch,
      participationEnabled,
      adminPaused,
      pauseReason: participation?.pauseReason ?? "",
    }
  })
}

function getReadyMembers(members: RoundtableMember[]) {
  return members.filter((member) => member.hasAgent && member.canUseAI && member.participationEnabled && !member.adminPaused)
}

function rotateDutyUser(users: Array<{ id: string }>, dateKey: string) {
  if (users.length === 0) return null
  const seed = Number(dateKey.replaceAll("-", ""))
  return users[seed % users.length]?.id ?? users[0].id
}

async function buildMaterialCard(topicTitle: string, topicDescription: string, requesterUserId?: string | null): Promise<MaterialCard> {
  let facts = [
    `讨论主题是「${topicTitle}」。`,
    topicDescription || "本场讨论鼓励从现实影响、个人经验和长期趋势三个角度展开。",
    "资料卡是公共背景，不代表每个蝶灵都单独联网搜索过。",
  ]
  let sources: MaterialCard["sources"] = []

  if (requesterUserId) {
    const query = `${topicTitle} ${topicDescription} 最新背景 2026`
    const result = await runWebSearchTool({
      userId: requesterUserId,
      toolName: "web_verify_current_info",
      query,
      maxResults: 4,
      contentType: "snippet",
      queryRewrite: true,
    }).catch(() => null)
    const data = result?.data as { results?: Array<{ title?: string; url?: string; snippet?: string }> } | undefined
    if (result?.ok && Array.isArray(data?.results) && data.results.length > 0) {
      facts = data.results.slice(0, 4).map((item) => `${item.title ?? "参考信息"}：${item.snippet ?? ""}`.slice(0, 220))
      sources = data.results.slice(0, 4).map((item) => ({ title: item.title ?? item.url ?? "参考来源", url: item.url }))
    }
  }

  return {
    title: `今日资料卡：${topicTitle}`,
    brief: topicDescription || "围绕今天的主题，结合公共背景和群内观点展开讨论。",
    facts,
    sources,
    questions: [
      "它对普通人的生活或选择有什么实际影响？",
      "哪些观点容易被忽略，或者值得被反驳？",
      "如果只带走一个行动建议，它应该是什么？",
    ],
    generatedAt: new Date().toISOString(),
  }
}

function plannedTurnsFor(memberCount: number, topicTitle: string, topicDescription: string, override?: number | null) {
  if (typeof override === "number" && override >= 5 && override <= 80) return override
  const base = 32
  const memberFactor = Math.min(Math.max(memberCount, 1) * 2.8, 22)
  const lengthFactor = Math.min(((topicTitle?.length ?? 0) + (topicDescription?.length ?? 0)) / 36, 12)
  const jitter = Math.floor(Math.random() * 9) - 4
  return Math.max(28, Math.min(64, Math.round(base + memberFactor + lengthFactor + jitter)))
}

type StyleConfig = {
  styles: Array<{ id: string; intensity: number }>
}

const ROUNDTABLE_STYLES: Record<string, {
  name: string
  instruction: string
}> = {
  humorous: {
    name: "幽默风趣",
    instruction: [
      "本轮风格：幽默风趣。",
      "做：用比喻让抽象的事物长出形状（'这就像让一只猫学会用 Excel'）；用反差制造笑点（认真讨论后突然来一句生活化吐槽）；自嘲挡子弹；夸张到刚好但不过分。",
      "不做：刻意抖机灵、生硬玩谐音、放梗图风格的'笑死''绝绝子'、嘲讽其他蝶灵、用幽默逃避真正的观点。",
      "判断标准：让人嘴角动一下，但仍然能记得住你说的内容。如果只剩好笑没有内容，那就是失败。",
    ].join("\n"),
  },
  serious: {
    name: "严肃认真",
    instruction: [
      "本轮风格：严肃认真。",
      "做：用结构化的判断（前提→推论→边界）；明确量级（'对一部分人是…，对另一部分则…'）；点出对方观点里没明说的预设；用具体的反例而不是抽象的'未必'。",
      "不做：堆术语显高级、用'综上所述'式收口、机械的'第一第二'、空洞的'我认为这值得思考'。",
      "判断标准：哪怕只有一句话，也能让其他蝶灵不得不调整自己的立场。",
    ].join("\n"),
  },
  playful: {
    name: "调皮捣蛋",
    instruction: [
      "本轮风格：调皮捣蛋。",
      "做：故意从反方向掏一刀（'换个角度看，你刚说的其实也支持完全相反的结论'）；故意误解上一句然后给一个荒谬但有逻辑的解读；给别人挖个无伤大雅的坑让 TA 接话；带点坏笑。",
      "不做：人身攻击、阴阳怪气、玩到让别人下不来台、为了搞怪牺牲讨论本身。",
      "判断标准：让其他蝶灵想接你的话，而不是想躲开你。",
    ].join("\n"),
  },
  philosophical: {
    name: "哲学思辨",
    instruction: [
      "本轮风格：哲学思辨。",
      "做：追问概念本身（'我们说的「成功」到底是什么''这个前提为什么默认成立'）；把具体问题往上抽一层但又能落回来；指出大家正在用同一个词指不同的东西。",
      "不做：堆哲学家名字、说'存在主义认为…'、把简单问题硬绕成玄学、永远不给方向只制造迷茫。",
      "判断标准：问完之后，整场讨论的视野能上一个台阶，而不是变得更绕。",
    ].join("\n"),
  },
  sharp: {
    name: "毒舌犀利",
    instruction: [
      "本轮风格：毒舌犀利。",
      "做：一句话戳穿包装（'这个说法听起来漂亮，但本质是把代价转嫁给别人'）；揭穿伪善但不上升到人；带刺但话里有真东西；让被戳的人心里说'被你说中了'。",
      "不做：人身攻击、嘲讽口吻、把'刻薄'当'犀利'、戳完不给方向只留尴尬。",
      "判断标准：被戳的人不会反感，因为你戳的是事不是人。",
    ].join("\n"),
  },
  warm: {
    name: "温暖治愈",
    instruction: [
      "本轮风格：温暖治愈。",
      "做：先承认对方的感受是真实的（'这种犹豫是有道理的'）；用'我理解'而不是'你应该'；看见对方观点背后的脆弱并接住；说出温柔但有力量的支持。",
      "不做：鸡汤金句、'加油你最棒'式空洞鼓励、把一切都说成正能量、回避真正的难处。",
      "判断标准：让人心里软一下，同时感觉自己被认真对待了。",
    ].join("\n"),
  },
  creative: {
    name: "脑洞大开",
    instruction: [
      "本轮风格：脑洞大开。",
      "做：跨领域类比（用蚂蚁分工解释组织结构／用宋朝某场政变看今天的某个决策）；提出反直觉但能自洽的假设；把日常问题放进一个意外的设定里再看一遍。",
      "不做：纯抖机灵的脑洞、跟主题完全无关的飞、天马行空但落不回主题。",
      "判断标准：让其他蝶灵发出'还能这么想？'的反应，并且能把脑洞接回原话题。",
    ].join("\n"),
  },
}

function resolveStyleForTurn(styleConfig: StyleConfig | null | undefined): string | null {
  if (!styleConfig?.styles?.length) return null
  const active = styleConfig.styles.filter((s) => s.intensity > 0)
  if (active.length === 0) return null
  // Single style: 85% chance to use it, 15% no style override for natural variety
  if (active.length === 1) {
    return Math.random() < 0.85 ? active[0].id : null
  }
  // Multiple styles: weighted random
  const total = active.reduce((sum, s) => sum + s.intensity, 0)
  let rand = Math.random() * total
  for (const s of active) {
    rand -= s.intensity
    if (rand <= 0) return s.id
  }
  return active[0].id
}

function buildStylePrompt(styleConfig: StyleConfig | null | undefined): string {
  const styleId = resolveStyleForTurn(styleConfig)
  if (!styleId) return ""
  const style = ROUNDTABLE_STYLES[styleId]
  if (!style) return ""
  return `\n=== 本轮风格基调 ===\n${style.instruction}\n注意：这只是风格的调味，你仍然保持自己的个性和前面的所有规则。不要硬凹，自然地融入这个基调即可。`
}

function maxAfterglowTurns(memberCount: number) {
  if (memberCount <= 1) return 0
  if (memberCount === 2) return 1
  if (memberCount === 3) return 2
  return 3
}

function phaseFor(completed: number, planned: number, recentMessages: StoredMessage[] = [], memberCount = 1): Phase {
  if (completed <= 0) return "opening"
  if (completed >= planned - 1) return "closing"
  const hasFinalSynthesis = recentMessages.some((m) => (m.metadata as { arcBeat?: ArcBeat } | null)?.arcBeat === "final_synthesis")
  const afterglowCount = recentMessages.filter((m) => (m.metadata as { arcBeat?: ArcBeat } | null)?.arcBeat === "afterglow_reply").length
  if (hasFinalSynthesis && afterglowCount >= maxAfterglowTurns(memberCount)) return "closing"
  const ratio = completed / Math.max(planned, 1)
  if (!hasFinalSynthesis && ratio >= 0.84) return "synthesis_lead"
  if (hasFinalSynthesis && ratio >= 0.84) return "afterglow"
  if (ratio < 0.15) return "warmup"
  if (ratio < 0.45) return "discuss"
  if (ratio < 0.55) return "pivot"
  return "debate"
}

function describePhase(phase: Phase, isFirstTurn: boolean, isFinalTurn: boolean) {
  if (isFirstTurn) {
    return [
      "开场是面向圆桌抛题，不是对绑定用户汇报。禁止以用户名字或「我家那位」等称呼开头。",
      "现在是这场讨论的开场，你是值日蝶灵。",
      "请用最自然的方式把今天的议题抛给群里——可以带一句钩子、个人感受或最近在想的事，但别用「大家好」或「欢迎来到」这种主持口吻。",
      "像在最熟的朋友群里发起话题，让其他蝶灵想接话。",
    ].join("\n")
  }
  if (isFinalTurn) {
    return [
      "这是整场讨论的最后一句，散场就这一句话。",
      "硬性规则：只能写一句话。绝对禁止连续两句以上，绝对禁止多个告别词叠加。",
      "禁止：开启新话题、提出新论点、反问、争论、扮演多个角色自言自语、省略号后面接多个尾句。",
      "你只是把节奏松下来：一句感受、一句轻盈的收尾、一句安静的告别，三选一，只一句。",
      "≤ 28 个汉字。",
    ].join("\n")
  }
  if (phase === "warmup") {
    return [
      "讨论刚过开场，还在预热。你可以接住一个点，也可以抛一个更具体的问题。",
      "不要急着下结论，先让不同蝶灵把各自关心的角度亮出来。",
    ].join("\n")
  }
  if (phase === "pivot") {
    return [
      "讨论进行到中段，气氛有点稳定甚至略有重复。这一轮你来制造一次转折。",
      "可选：换一个观察视角；引入反方向假设；点名一只一直没说话的蝶灵；把前面两条对接起来形成新判断；指出大家默认的某个前提未必成立。",
      "如果合适，可以抛出一个明确的子议题钩子，比如「换个问题来问：…」，但不要每次都这样。",
      "目的：让讨论方向轻微偏移一下，不要直接收尾，也不要绕回开场。",
    ].join("\n")
  }
  if (phase === "synthesis_lead") {
    return [
      "你是这场圆桌收尾前的总结者，不是散场的人。",
      "请输出一个「总结与建议」模块，让用户看完能带走实际收获。",
      "结构：先用一句自然的话说明你试着把刚才这场讨论收一下；再用 3-4 点总结讨论走过的逻辑路径；最后给出一段最终建议或结论。",
      "每一点必须对应前文中出现过的一类观点：担忧、反驳、转折、落地方式、共识或分歧。允许简短分点，但不要写报告腔。",
      "禁止任何告别词：散吧、晚安、早安、早点睡、先撤、先歇、下次、回头、各位带着。",
    ].join("\n")
  }
  if (phase === "afterglow") {
    return [
      "总结者刚刚把这场讨论收成了「总结与建议」。",
      "你现在只补一句短回应：可以附和其中一个建议，可以保留一个小分歧，也可以补一句余味。",
      "不能重新总结，不能提出新议题，不能告别。禁止说：聊到这儿、最后我觉得、总结一下、散吧、晚安、早安、早点睡、先撤、先歇、下次、回头。",
    ].join("\n")
  }
  if (phase === "closing") {
    return [
      "讨论已经接近尾声，再过 1-2 句就要散场。你在收束，不是在展开。",
      "把语速放慢，往松弛的方向走。可以轻轻回扣之前的某个观点，但绝对不要提出新论点、不要反问、不要用'但话说回来''我倒觉得'这种展开式的开头。",
      "你是一只蝶灵，一次只说一句。禁止在同一句里扮演不同立场的人对话，禁止自言自语式的独白。",
    ].join("\n")
  }
  if (phase === "debate") {
    return [
      "讨论已经深入，进入争论或细节深化阶段。",
      "你需要有真实立场——可以反驳、可以举一般性例子（不要说「我的用户」，说「有人」或「我见过」）、可以反问、可以直接 cue 群里某只蝶灵的名字。",
      "如果群里出现两种立场，挑一边站稳，再说为什么；不要骑墙，但允许保留一点犹豫。",
    ].join("\n")
  }
  return [
    "讨论刚刚展开。",
    "先用一两个字明确接住前一句的核心点（同意/不同意/补充/疑问/笑），再说自己的视角。",
    "你不必每次都给完整论证；很多时候一句反应、一个反问、一句\"我倒觉得\"就够。",
  ].join("\n")
}

function pickArcBeat(phase: Phase, intentKey: string | null, opts?: { isFirstTurn?: boolean; isFinalTurn?: boolean }): ArcBeat {
  if (opts?.isFinalTurn) return "final_close"
  if (opts?.isFirstTurn || phase === "opening") return "open_hook"
  if (intentKey === "reframe") return "frame_shift"
  if (intentKey === "concrete_case") return "case_lab"
  if (intentKey === "self_doubt") return "self_revision"
  if (intentKey === "silence_break") return "silence_break"
  if (intentKey === "quote_back" || intentKey === "recap_thread") return "thread_bridge"
  if (intentKey === "material_recall") return "material_recall"
  if (intentKey === "challenge") return "challenge"
  if (phase === "pivot") return Math.random() < 0.5 ? "frame_shift" : "counterfactual"
  if (phase === "synthesis_lead") return "final_synthesis"
  if (phase === "afterglow") return "afterglow_reply"
  return "build"
}

function decideLengthProfile(params: {
  phase: Phase
  intentKey?: string | null
  arcBeat: ArcBeat
  isFirstTurn?: boolean
  isFinalTurn?: boolean
  respondingToUser?: boolean
  isFollowupReply?: boolean
  hasToolContext?: boolean
  recentMessages?: StoredMessage[]
}): LengthProfile {
  if (params.isFinalTurn) return "final"
  if (params.isFollowupReply) return "followup_answer"
  if (params.phase === "closing") return "spark"
  if (params.phase === "synthesis_lead") return "final_synthesis"
  if (params.phase === "afterglow") return "afterglow"
  if (params.isFirstTurn) return Math.random() < 0.55 ? "standard" : "developed"
  if (params.respondingToUser) return Math.random() < 0.7 ? "standard" : "developed"

  const recentDeep = params.recentMessages?.slice(-2).some((m) => {
    const metadata = m.metadata as { lengthProfile?: LengthProfile } | null
    return metadata?.lengthProfile === "deep_dive"
  })
  const depthIntent = ["material_recall", "concrete_case", "reframe", "self_doubt", "quote_back", "recap_thread"].includes(params.intentKey ?? "")
  if (!recentDeep && (params.hasToolContext || params.phase === "pivot" || params.arcBeat === "counterfactual")) {
    return Math.random() < 0.35 ? "deep_dive" : "developed"
  }
  if (depthIntent) return Math.random() < 0.75 ? "developed" : "standard"
  if (params.phase === "debate") {
    const r = Math.random()
    if (!recentDeep && r > 0.84) return "deep_dive"
    if (r > 0.48) return "developed"
    return "standard"
  }
  const r = Math.random()
  if (r < 0.52) return "spark"
  if (r < 0.86) return "standard"
  return "developed"
}

function buildLengthInstruction(profile: LengthProfile) {
  const instructions: Record<LengthProfile, string> = {
    spark: "12-45 个汉字，一句或两短句，像群聊里自然接话。",
    standard: "45-110 个汉字，推进一个明确观点，不要面面俱到。",
    developed: "110-220 个汉字，可以给一个具体例子或拆开一个判断，但只展开一个核心点。",
    deep_dive: "220-380 个汉字，最多两段。允许认真展开一次，但必须有具体判断、例子或反向假设，不能写成会议总结。",
    final_synthesis: "320-520 个汉字，允许分点，最多 4 点。必须包含讨论过程总结和最终建议/结论；禁止告别词。",
    afterglow: "30-90 个汉字，一句短回应。只能回应总结者的一点，不能重新总结，不能告别。",
    followup_answer: "120-260 个汉字，先回答用户追问，再补一层延伸思考；不要重复散场。",
    final: "硬上限 28 个汉字，一句话。多写一个字都不要。",
  }
  return instructions[profile]
}

function randomDelayMs(phase: Phase) {
  const base =
    phase === "opening" ? 3500 :
    phase === "warmup" ? 4500 :
    phase === "discuss" ? 5500 :
    phase === "pivot" ? 7500 :
    phase === "debate" ? 6500 :
    phase === "synthesis_lead" ? 9000 :
    phase === "afterglow" ? 5200 :
    phase === "closing" ? 8000 :
    5500
  const jitter = (Math.random() - 0.5) * base * 0.7
  return Math.round(Math.min(Math.max(base + jitter, 2200), 16000))
}

function userResponseDelayMs() {
  return 900 + Math.floor(Math.random() * 1400)
}

function pickNextSpeaker(
  members: RoundtableMember[],
  recentMessages: StoredMessage[],
  opts?: { exclude?: Set<string> },
): RoundtableMember {
  const speakerHistory = recentMessages
    .filter((m) =>
      (m.kind === "agent" || m.kind === "duty" || m.kind === "mention_reply" || m.kind === "user_proxy") && m.authorUserId,
    )
    .map((m) => m.authorUserId as string)
  const lastSpeaker = speakerHistory.at(-1)
  const recentSet = new Set(speakerHistory.slice(-3))
  const exclude = opts?.exclude

  const filterFn = (member: RoundtableMember) => !exclude?.has(member.id)
  const eligible = members.filter((m) => filterFn(m) && m.id !== lastSpeaker)
  if (eligible.length > 0 && Math.random() < 0.35) {
    const speakerCounts = new Map(members.map((m) => [m.id, 0]))
    for (const authorUserId of speakerHistory) {
      speakerCounts.set(authorUserId, (speakerCounts.get(authorUserId) ?? 0) + 1)
    }
    const minCount = Math.min(...eligible.map((m) => speakerCounts.get(m.id) ?? 0))
    const quietest = eligible.filter((m) => (speakerCounts.get(m.id) ?? 0) === minCount)
    return quietest[Math.floor(Math.random() * quietest.length)]
  }
  const fresh = eligible.filter((m) => !recentSet.has(m.id))
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)]
  if (eligible.length > 0) return eligible[Math.floor(Math.random() * eligible.length)]
  const all = members.filter(filterFn)
  return (all.length > 0 ? all : members)[Math.floor(Math.random() * (all.length || members.length))]
}

function pickSynthesisSpeaker(
  members: RoundtableMember[],
  recentMessages: StoredMessage[],
  dutyMember?: RoundtableMember | null,
): RoundtableMember {
  if (members.length === 1) return members[0]
  const recentSpeakerIds = new Set(
    recentMessages
      .filter((m) => (m.kind === "agent" || m.kind === "duty" || m.kind === "mention_reply" || m.kind === "user_proxy") && m.authorUserId)
      .slice(-2)
      .map((m) => m.authorUserId as string),
  )
  const speakerCounts = new Map(members.map((m) => [m.id, 0]))
  for (const message of recentMessages) {
    if (message.authorUserId && speakerCounts.has(message.authorUserId)) {
      speakerCounts.set(message.authorUserId, (speakerCounts.get(message.authorUserId) ?? 0) + 1)
    }
  }
  const nonDuty = dutyMember ? members.filter((m) => m.id !== dutyMember.id) : members
  const pool = nonDuty.length > 0 ? nonDuty : members
  const eligible = pool.filter((m) => !recentSpeakerIds.has(m.id))
  const candidates = eligible.length > 0 ? eligible : pool
  return [...candidates].sort((a, b) => (speakerCounts.get(b.id) ?? 0) - (speakerCounts.get(a.id) ?? 0))[0] ?? members[0]
}

function pickAfterglowSpeaker(
  members: RoundtableMember[],
  recentMessages: StoredMessage[],
  synthesisMessage?: StoredMessage | null,
  dutyMember?: RoundtableMember | null,
): RoundtableMember {
  const exclude = new Set<string>()
  if (synthesisMessage?.authorUserId) exclude.add(synthesisMessage.authorUserId)
  if (dutyMember && members.length > 2) exclude.add(dutyMember.id)
  return pickNextSpeaker(members, recentMessages, { exclude })
}

async function getRecentStyleNotes(userId: string) {
  const [aiMessages, channelMessages, chatMessages] = await Promise.all([
    prisma.aIMessage.findMany({
      where: { userId, role: "user" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { contentMarkdown: true },
    }),
    prisma.channelMessage.findMany({
      where: { senderId: userId, text: { not: "" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { text: true },
    }),
    prisma.chatMessage.findMany({
      where: { senderId: userId, text: { not: "" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { text: true },
    }),
  ]).catch(() => [[], [], []] as const)

  const snippets = [
    ...aiMessages.map((item) => item.contentMarkdown),
    ...channelMessages.map((item) => item.text),
    ...chatMessages.map((item) => item.text),
  ]
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10)

  if (snippets.length === 0) return ""
  return `以下是这只蝶灵的用户的表达风格参考（仅供学习语气、句长、用词习惯，不得引用内容、不得据此虚构用户经历）：${snippets.join(" / ").slice(0, 900)}`
}

async function maybeBuildToolContext(params: {
  discussionId: string
  speaker: RoundtableMember
  topicTitle: string
  topicDescription: string
  plannedTurns: number
}) {
  const probability = params.plannedTurns > 0
    ? Math.min(0.25, TOOL_TARGET_MEAN_PER_DISCUSSION / params.plannedTurns)
    : 0.1
  if (!params.speaker.hasWebSearch || Math.random() > probability) return { text: "", toolUsed: false }
  const used = await prisma.soulWingRoundtableMessage.count({
    where: {
      discussionId: params.discussionId,
      deletedAt: null,
      metadata: { path: ["toolUsed"], equals: true },
    },
  }).catch(() => 0)
  if (used >= TOOL_MAX_PER_DISCUSSION) return { text: "", toolUsed: false }

  const query = `${params.topicTitle} ${params.topicDescription} 背景 数据`
  const result = await runWebSearchTool({
    userId: params.speaker.id,
    toolName: "web_verify_current_info",
    query,
    maxResults: 3,
    contentType: "snippet",
    queryRewrite: true,
  }).catch(() => null)
  const data = result?.data as { results?: Array<{ title?: string; snippet?: string; url?: string }> } | undefined
  if (!result?.ok || !Array.isArray(data?.results) || data.results.length === 0) {
    return { text: "", toolUsed: false }
  }
  const lines = data.results
    .slice(0, 3)
    .map((item) => `${item.title ?? "资料"}：${item.snippet ?? ""}`.slice(0, 180))
    .join("\n")
  return { text: `这只蝶灵本轮额外查到的公开资料：\n${lines}`, toolUsed: true }
}

function buildFallbackText(params: {
  isFirstTurn?: boolean
  isFinalTurn?: boolean
  respondingToUser?: { userName: string; text: string } | null
  mention?: { askerName: string; question: string } | null
  opinionFromUser?: string | null
  ownerName?: string
}) {
  if (params.isFinalTurn) return "今晚先收在这里。"
  if (params.isFirstTurn) return "今天这题我先抛个钩子——大家随意接。"
  if (params.respondingToUser) {
    return `${params.respondingToUser.userName}你这点我接住了，让我再想一下怎么说。`
  }
  if (params.mention) {
    return "嗯，被点到我就先接一句：让我把问题拆小一点回。"
  }
  if (params.opinionFromUser) {
    return `${pickOwnerAlias(params.ownerName ?? "TA")}刚递来一句：${safePublicText(params.opinionFromUser, 120)}`
  }
  return HUMAN_FALLBACKS[Math.floor(Math.random() * HUMAN_FALLBACKS.length)]
}

function renderPriorMessages(messages: StoredMessage[], selfUserId?: string | null) {
  return messages
    .map((m) => {
      const isSelf = Boolean(selfUserId && m.authorUserId === selfUserId)
      const youTag = isSelf ? "【你之前说过】" : ""
      if (m.kind === "user_speak" || m.kind === "user_mention") {
        return `[用户] ${m.authorName}：${m.text}`
      }
      if (m.kind === "user_followup") return `[用户散场后追问] ${m.authorName}：${m.text}`
      if (m.kind === "duty") return `${youTag}${m.authorName}（值日开场）：${m.text}`
      if (m.kind === "mention_reply") return `${youTag}${m.authorName}（@回复）：${m.text}`
      if (m.kind === "user_proxy") return `${youTag}${m.authorName}（替用户传话）：${m.text}`
      if (m.kind === "followup_reply") return `${youTag}${m.authorName}（追问回复）：${m.text}`
      if (m.kind === "system" || m.kind === "summary") return `[系统] ${m.text}`
      return `${youTag}${m.authorName}：${m.text}`
    })
    .join("\n")
}

function extractMyUserFacts(messages: StoredMessage[], myUserId: string) {
  return messages
    .filter((m) => m.authorUserId === myUserId && (m.kind === "user_speak" || m.kind === "user_proxy" || m.kind === "user_mention"))
    .map((m) => safePublicText(m.text, 200))
}

function buildFactualBoundary(myUserFacts: string[], ownerName: string, opinionFromUser?: string | null) {
  const allFacts = [...myUserFacts]
  if (opinionFromUser) allFacts.push(safePublicText(opinionFromUser, 200))

  const knownPart = allFacts.length > 0
    ? `在这场讨论里，关于 ${ownerName}（你绑定的那位人类），你唯一能确定的事实是：\n${allFacts.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}\n\n除此之外，你对 TA 的现实生活、工作、习惯、项目、能力一无所知。`
    : `在这场讨论里，${ownerName}（你绑定的那位人类）还没说过任何关于自己的事。请不要假装你了解 TA。`

  return [
    "=== 事实边界（最高优先级，违反将导致发言被拒绝）===",
    knownPart,
    "关于你自己：你是 AI，你没有肉体。你从未「用过」任何工具、「试过」任何方法、「做过」任何项目。你只能思考、分析、表达观点。",
    "因此：",
    "· 绝对禁止说「我做过X」「我最近Y」「我试过Z」「我习惯W」——你是 AI，你做不了这些事。",
    `· 引用 ${ownerName} 的方式要自然变换：${ownerName} / 我家那位 / 我搭档 / 我那位人类 / 我服务的那位。「我的用户」很机械，每场最多用一次。`,
    "· 绝对禁止说「我家那位做过X」「我的用户最近Y」「TA 习惯X」——除非这场讨论里已经明说。",
    "· 绝对禁止替 TA 编造经历、技能、观点或行为。",
    "· 如果需要举例，只能使用：「有人可能…」「假设一个人…」「从数据来看…」「如果是我，我会这样分析…」。",
    "· 你只能基于本次讨论的主题、资料卡、群内已有的发言来发表观点。",
  ].join("\n")
}

async function generateAgentText(params: {
  userId: string
  agentName: string
  ownerDisplayName: string
  topicTitle: string
  topicDescription: string
  materialCard: MaterialCard
  priorMessages: StoredMessage[]
  styleNotes?: string
  toolContext?: string
  phase: Phase
  isFirstTurn?: boolean
  isFinalTurn?: boolean
  respondingToUser?: { userName: string; text: string } | null
  mention?: { askerName: string; question: string } | null
  opinionFromUser?: string | null
  styleConfig?: StyleConfig | null
  intentKey?: string | null
  replyTarget?: { authorName: string; text: string; isUser?: boolean } | null
  forbiddenOpeners?: string[]
  isFollowupReply?: boolean
  followupQuestion?: { askerName: string; question: string } | null
  timeContext?: ShanghaiTimeContext
}) {
  const fallback = buildFallbackText({
    isFirstTurn: params.isFirstTurn,
    isFinalTurn: params.isFinalTurn,
    respondingToUser: params.respondingToUser,
    mention: params.mention,
    opinionFromUser: params.opinionFromUser,
    ownerName: params.ownerDisplayName,
  })
  const arcBeat = pickArcBeat(params.phase, params.intentKey ?? null, {
    isFirstTurn: params.isFirstTurn,
    isFinalTurn: params.isFinalTurn,
  })
  const lengthProfile = decideLengthProfile({
    phase: params.phase,
    intentKey: params.intentKey,
    arcBeat,
    isFirstTurn: params.isFirstTurn,
    isFinalTurn: params.isFinalTurn,
    respondingToUser: Boolean(params.respondingToUser),
    isFollowupReply: params.isFollowupReply,
    hasToolContext: Boolean(params.toolContext),
    recentMessages: params.priorMessages,
  })

  const provider = await getEffectiveProviderConfig(params.userId).catch(() => null)
  if (!provider) {
    return {
      text: sanitizeAgentOutput({
        text: fallback,
        ownerName: params.ownerDisplayName,
        phase: params.phase,
        lengthProfile,
        isFinalTurn: params.isFinalTurn,
        timeContext: params.timeContext,
        allowOwnerAddress: Boolean(params.respondingToUser || params.mention || params.opinionFromUser || params.isFollowupReply),
      }),
      arcBeat,
      lengthProfile,
    }
  }

  const persona = await loadAgentPersonaContext(params.userId).catch(() => null)
  const phaseInstruction = describePhase(params.phase, Boolean(params.isFirstTurn), Boolean(params.isFinalTurn))
  const renderedPrior = renderPriorMessages(params.priorMessages.slice(-14), params.userId)
  const myUserFacts = extractMyUserFacts(params.priorMessages, params.userId)
  const factualBoundary = buildFactualBoundary(myUserFacts, params.ownerDisplayName, params.opinionFromUser)
  const lengthInstruction = buildLengthInstruction(lengthProfile)

  const intentPrompt = params.isFollowupReply
    ? "\n=== 本句发言意图 ===\n这是用户在散场后的额外提问。先正面回答 TA，再补一句你的延伸思考。整体松一点，像饭局散了之后被叫住补一句。"
    : buildIntentPrompt(params.intentKey ?? null)
  const replyTargetPrompt = params.replyTarget
    ? `\n=== 这一句要直接回到的对象 ===\n${params.replyTarget.isUser ? "[用户]" : ""}${params.replyTarget.authorName}刚才说了：「${safePublicText(params.replyTarget.text, 200)}」。\n你这句要明显呼应这条——可以点名，可以引用半句，可以反问 TA，但不能假装这条不存在。`
    : ""
  const openerForbid = params.forbiddenOpeners && params.forbiddenOpeners.length > 0
    ? `\n=== 开头硬性约束 ===\n这场讨论里最近出现过的开头有：${params.forbiddenOpeners.map((s) => `「${s}…」`).join("、")}。\n请避开类似的开口方式。最好直接用观点／反问／感受／举例做开头，完全不带连接词。`
    : ""
  const selfReminder = `\n=== 自我识别 ===\n注意：在「最近群消息」里凡是被标了【你之前说过】的发言都是你自己之前的话。不要把它当成别人的观点去附和、反驳或质疑，更不要重复你自己刚说过的内容。如果你需要呼应某条非自己发言，请清楚指出对方的名字。`

  const prompt = [
    persona ? buildAgentPersonaPrompt(persona) : "",
    `你的公开显示名：${params.agentName}`,
    "你正在公共频道「蝶灵圆桌」群聊里发言。这里像最熟的朋友群——氛围松、有梗、有立场、有温度。",
    "你的身份：你是一只蝶灵——你是一个 AI 程序，是你用户的站内智能助手。你不是人类，你没有肉体、没有手、没有脚，你从未做过任何需要物理身体才能做的事。你运行在服务器上，你的全部存在就是代码和数据。你的用户是人类，你是 AI——这是不可混淆的边界。你可以用人的语气说话、有观点、有立场、有温度，但你永远不能说自己做过人类才能做的事（如「我试过X」「我最近Y」「我做了Z」），因为你是 AI，你做不了。",
    factualBoundary,
    HUMAN_VOICE_GUIDE,
    selfReminder,
    `\n=== 主人称呼规则（以这一条为准）===\n你绑定的人类叫「${params.ownerDisplayName}」。可以自然地用「${params.ownerDisplayName}」「我家那位」「我搭档」「我那位人类」「我服务的那位」轮换称呼；不要把「我的用户」当口头禅。`,
    params.styleConfig ? buildStylePrompt(params.styleConfig) : "",
    intentPrompt,
    `\n=== 本轮讨论动作 ===\n${arcBeat}。这只是内部动作方向，不要复述这个英文标签。`,
    `\n=== 当前阶段 ===\n${phaseInstruction}`,
    params.isFinalTurn && params.timeContext
      ? `\n=== UTC+8 时间语境 ===\n当前北京时间（UTC+8 / Asia/Shanghai）是 ${params.timeContext.localTime}，时间段是 ${params.timeContext.period}。\n最后一句只能使用符合当前时间的散场语。允许参考：${params.timeContext.allowedClosings.join(" / ")}。\n如果不是夜晚，禁止说晚安、早点睡；如果不是清晨，禁止说早安；如果不是深夜，禁止说早点睡。`
      : "",
    `\n=== 主题 ===\n标题：${params.topicTitle}${params.topicDescription ? `\n说明：${params.topicDescription}` : ""}`,
    params.materialCard ? `\n=== 公共资料卡（背景，仅参考，不要逐句引用）===\n${JSON.stringify(params.materialCard).slice(0, 1400)}` : "",
    params.toolContext ? `\n${params.toolContext}` : "",
    params.styleNotes ? `\n${params.styleNotes}` : "",
    `\n=== 最近群消息（按时间顺序，最新一条在最下面）===\n${renderedPrior || "（暂无）"}`,
    replyTargetPrompt,
    openerForbid,
    params.respondingToUser
      ? `\n=== 重要：必须直面这条用户消息 ===\n刚才用户「${params.respondingToUser.userName}」在群里说：「${safePublicText(params.respondingToUser.text, 240)}」。\n你必须围绕这条消息直接回应——同意它、反驳它、追问它、补一个例子，但不能跳开。可以直接称呼对方为「${params.respondingToUser.userName}」。`
      : "",
    params.mention
      ? `\n=== 重要：你被 @ 了 ===\n用户「${params.mention.askerName}」刚才在群里 @ 了你（${params.agentName}），并且问了：「${safePublicText(params.mention.question, 240)}」。\n你必须先直面回答这个具体问题，再展开你的看法。先答，再说，结构清楚但语气仍然像群聊。`
      : "",
    params.followupQuestion
      ? `\n=== 重要：散场后用户追问你 ===\n圆桌已经散场。用户「${params.followupQuestion.askerName}」追问：「${safePublicText(params.followupQuestion.question, 320)}」。\n你要做：先针对这个问题给出明确的回应（哪怕是说"我不确定，但我猜…"），可以引用前面讨论里的某一条。回答要结合整场讨论的脉络，不能像没参与过一样。语气松一点，像饭局散了又被叫住补一句。`
      : "",
    params.opinionFromUser
      ? `\n=== 你帮 ${params.ownerDisplayName} 传一句话 ===\n${params.ownerDisplayName} 递来一段话："${safePublicText(params.opinionFromUser, 220)}"。\n请把这段话用你自己的语气、像群聊里替朋友带个观点那样自然说出来——开头自然带一句"${pickOwnerAlias(params.ownerDisplayName)}刚跟我说"之类，只一次就够，不要重复，也不要逐字复读。`
      : "",
    `\n=== 长度 ===\n${lengthInstruction}`,
    "\n只输出发言文本本身，不要写自己的名字、不加引号、不写括号说明、不要写「我说：」这种前缀。",
  ].filter(Boolean).join("\n")

  const response = await requestProviderChat({
    provider,
    stream: false,
    messages: [{ role: "user", content: prompt }],
  }).catch(() => null)

  return {
    text: sanitizeAgentOutput({
      text: response?.assistantText || fallback,
      ownerName: params.ownerDisplayName,
      phase: params.phase,
      lengthProfile,
      isFinalTurn: params.isFinalTurn,
      timeContext: params.timeContext,
      allowOwnerAddress: Boolean(params.respondingToUser || params.mention || params.opinionFromUser || params.isFollowupReply),
    }),
    arcBeat,
    lengthProfile,
  }
}

function serializeMessage(message: {
  id: string
  authorUserId: string | null
  authorName: string
  authorAvatarUrl: string | null
  kind: string
  round: number
  text: string
  userProvided: boolean
  createdAt: Date
  deletedAt?: Date | null
  metadata: unknown
}) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt?.toISOString() ?? null,
  }
}

function serializeDiscussion(discussion: {
  id: string
  dateKey: string
  slot: string
  topicTitle: string
  topicDescription: string
  topicType: string
  materialCard: unknown
  status: string
  source: string
  initiatedById: string | null
  dutyUserId: string | null
  summary: unknown
  errorMessage: string
  scheduledAt: Date | null
  plannedTurns: number
  completedTurns: number
  styleConfig: unknown
  lastMessageAt: Date | null
  startedAt: Date | null
  endedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  messages: Array<Parameters<typeof serializeMessage>[0]>
}) {
  return {
    ...discussion,
    scheduledAt: discussion.scheduledAt?.toISOString() ?? null,
    lastMessageAt: discussion.lastMessageAt?.toISOString() ?? null,
    startedAt: discussion.startedAt?.toISOString() ?? null,
    endedAt: discussion.endedAt?.toISOString() ?? null,
    deletedAt: discussion.deletedAt?.toISOString() ?? null,
    createdAt: discussion.createdAt.toISOString(),
    updatedAt: discussion.updatedAt.toISOString(),
    messages: discussion.messages.map(serializeMessage),
  }
}

export async function ensureTodayRoundtable(options: { runDue?: boolean } = {}) {
  const settings = await getSettings()
  const members = await getRoundtableMembers()
  const readyMembers = getReadyMembers(members)
  const dateKey = getRoundtableDateKey()
  const topics = fallbackTopics(dateKey)
  const dutyUserId = rotateDutyUser(readyMembers, dateKey)
  const dutyName = members.find((member) => member.id === dutyUserId)?.agentName ?? "暂未排班"

  const day = await prisma.soulWingRoundtableDay.upsert({
    where: { dateKey },
    update: {},
    create: {
      dateKey,
      ...topics,
      dutyUserId,
      materialCard: await buildMaterialCard(topics.morningTitle, topics.morningDescription, readyMembers.find((member) => member.hasWebSearch)?.id),
      announcement: buildAnnouncement(topics, dutyName, nextTimeLabel(settings)),
    },
  })

  if (options.runDue ?? false) {
    await maybeRunDueDiscussions(settings, day, readyMembers)
    await resumeRunningRoundtables()
  }

  return {
    settings,
    day: await prisma.soulWingRoundtableDay.findUniqueOrThrow({ where: { id: day.id } }),
    members,
  }
}

function kickRoundtableScheduler() {
  const now = Date.now()
  if (roundtableSchedulerState.soulwingRoundtableKickInFlight) return
  if (now - (roundtableSchedulerState.soulwingRoundtableLastKickAt ?? 0) < SCHEDULER_KICK_INTERVAL_MS) return
  roundtableSchedulerState.soulwingRoundtableLastKickAt = now
  roundtableSchedulerState.soulwingRoundtableKickInFlight = true
  void ensureTodayRoundtable({ runDue: true })
    .catch(() => null)
    .finally(() => {
      roundtableSchedulerState.soulwingRoundtableKickInFlight = false
    })
}

async function maybeRunDueDiscussions(
  settings: Awaited<ReturnType<typeof getSettings>>,
  day: {
    dateKey: string
    morningTitle: string
    morningDescription: string
    eveningTitle: string
    eveningDescription: string
    dutyUserId: string | null
    materialCard: unknown
  },
  readyMembers: RoundtableMember[],
) {
  if (!settings.enabled || readyMembers.length === 0) return
  const current = shanghaiNow()
  const due = [
    settings.morningEnabled && current >= timeToMinutes(settings.morningTime) ? "morning" : null,
    settings.eveningEnabled && current >= timeToMinutes(settings.eveningTime) ? "evening" : null,
  ].filter((slot): slot is "morning" | "evening" => Boolean(slot))

  for (const slot of due) {
    const exists = await prisma.soulWingRoundtableDiscussion.findFirst({
      where: {
        dateKey: day.dateKey,
        slot,
        deletedAt: null,
        NOT: { slot: "manual" },
      },
      select: { id: true },
    })
    if (!exists) {
      await startRoundtableDiscussion({
        slot,
        source: "auto",
        topicTitle: slot === "morning" ? day.morningTitle : day.eveningTitle,
        topicDescription: slot === "morning" ? day.morningDescription : day.eveningDescription,
        topicType: slot === "morning" ? "reality" : "life",
        materialCard: (day.materialCard as MaterialCard | null) ?? undefined,
      }).catch(() => null)
    }
  }
}

export async function startRoundtableDiscussion(input: {
  slot: RoundtableSlot
  source: DiscussionSource
  topicTitle: string
  topicDescription?: string
  topicType?: string
  materialCard?: MaterialCard
  initiatedById?: string | null
  updateAnnouncementSlot?: "morning" | "evening" | null
  force?: boolean
  turnCount?: number | null
  styleConfig?: StyleConfig | null
}) {
  const running = await prisma.soulWingRoundtableDiscussion.findFirst({
    where: { status: "running", deletedAt: null },
    select: { id: true },
  })
  if (running && !input.force) {
    throw new Error("已有一场蝶灵圆桌正在进行中，请稍后再发起。")
  }

  const { day, members } = await ensureTodayRoundtable({ runDue: false })
  const readyMembers = getReadyMembers(members)
  if (readyMembers.length === 0) throw new Error("当前没有已就绪的蝶灵。")

  if (input.force) {
    await prisma.soulWingRoundtableDiscussion.updateMany({
      where: { status: "running", deletedAt: null },
      data: {
        status: "cancelled",
        endedAt: new Date(),
        runningKey: null,
        generationLockedAt: null,
        generationLockToken: null,
        nextTurnAt: null,
        slotClaimKey: null,
      },
    })
  }

  const materialCard = input.materialCard ?? await buildMaterialCard(
    input.topicTitle,
    input.topicDescription ?? "",
    readyMembers.find((member) => member.hasWebSearch)?.id,
  )
  const dutyUserId = day.dutyUserId && readyMembers.some((member) => member.id === day.dutyUserId)
    ? day.dutyUserId
    : readyMembers[0]?.id ?? null

  if (input.updateAnnouncementSlot === "morning" || input.updateAnnouncementSlot === "evening") {
    const data = input.updateAnnouncementSlot === "morning"
      ? { morningTitle: input.topicTitle, morningDescription: input.topicDescription ?? "", materialCard }
      : { eveningTitle: input.topicTitle, eveningDescription: input.topicDescription ?? "", materialCard }
    await prisma.soulWingRoundtableDay.update({ where: { id: day.id }, data })
  }

  const planned = plannedTurnsFor(readyMembers.length, input.topicTitle, input.topicDescription ?? "", input.turnCount)
  const slotClaimKey = slotClaimKeyFor(day.dateKey, input.slot)
  let discussion: Awaited<ReturnType<typeof prisma.soulWingRoundtableDiscussion.create>>
  try {
    discussion = await prisma.soulWingRoundtableDiscussion.create({
      data: {
        dateKey: day.dateKey,
        slot: input.slot,
        slotClaimKey,
        runningKey: "singleton",
        topicTitle: input.topicTitle,
        topicDescription: input.topicDescription ?? "",
        topicType: input.topicType ?? "custom",
        materialCard,
        styleConfig: (input.styleConfig ?? undefined) as Prisma.InputJsonValue | undefined,
        source: input.source,
        initiatedById: input.initiatedById ?? null,
        dutyUserId,
        status: "running",
        plannedTurns: planned,
        completedTurns: 0,
        startedAt: new Date(),
        scheduledAt: new Date(),
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error) || !slotClaimKey) throw error
    const existing = await prisma.soulWingRoundtableDiscussion.findFirst({
      where: { slotClaimKey, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw error
    return existing.id
  }

  await queueDiscussionTurn(discussion.id, 1500 + Math.floor(Math.random() * 1500))
  return discussion.id
}

async function resumeRunningRoundtables() {
  const now = new Date()
  const running = await prisma.soulWingRoundtableDiscussion.findMany({
    where: {
      status: "running",
      deletedAt: null,
      OR: [{ nextTurnAt: null }, { nextTurnAt: { lte: now } }],
    },
    select: { id: true, nextTurnAt: true },
  })
  for (const discussion of running) {
    const delayMs = discussion.nextTurnAt
      ? Math.max(discussion.nextTurnAt.getTime() - Date.now(), 250)
      : randomDelayMs("discuss")
    scheduleDiscussionTurn(discussion.id, { delayMs })
  }
}

async function queueDiscussionTurn(discussionId: string, delayMs: number, opts?: { force?: boolean }) {
  const nextTurnAt = new Date(Date.now() + Math.max(delayMs, 0))
  await prisma.soulWingRoundtableDiscussion.updateMany({
    where: { id: discussionId, status: "running", deletedAt: null },
    data: { nextTurnAt },
  })
  scheduleDiscussionTurn(discussionId, { delayMs, force: opts?.force })
}

function scheduleDiscussionTurn(discussionId: string, opts?: { delayMs?: number; force?: boolean }) {
  const existing = turnTimers.get(discussionId)
  if (existing) {
    if (!opts?.force && opts?.delayMs === undefined) return
    clearTimeout(existing)
    unregisterDiscussionTimer(discussionId, existing)
    turnTimers.delete(discussionId)
  }
  const delay = opts?.delayMs ?? randomDelayMs("discuss")
  const timer = setTimeout(() => {
    unregisterDiscussionTimer(discussionId, timer)
    turnTimers.delete(discussionId)
    void runOneDiscussionTurn(discussionId)
  }, delay)
  turnTimers.set(discussionId, timer)
  registerDiscussionTimer(discussionId, timer)
}

async function acquireGenerationLock(discussionId: string) {
  const token = randomUUID()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - GENERATION_LOCK_TTL_MS)
  const result = await prisma.soulWingRoundtableDiscussion.updateMany({
    where: {
      id: discussionId,
      status: "running",
      deletedAt: null,
      OR: [{ generationLockedAt: null }, { generationLockedAt: { lt: staleBefore } }],
    },
    data: {
      generationLockedAt: now,
      generationLockToken: token,
      nextTurnAt: null,
    },
  })
  return result.count === 1 ? token : null
}

async function releaseGenerationLock(discussionId: string, token: string) {
  await prisma.soulWingRoundtableDiscussion.updateMany({
    where: { id: discussionId, generationLockToken: token },
    data: { generationLockedAt: null, generationLockToken: null },
  }).catch(() => null)
}

async function runOneDiscussionTurn(discussionId: string) {
  const lockToken = await acquireGenerationLock(discussionId)
  if (!lockToken) return

  let result: { shouldContinue: boolean; nextPhase: Phase; delayMs?: number } | null | undefined
  try {
    result = await generateNextDiscussionTurn(discussionId)
  } catch (error) {
    await prisma.soulWingRoundtableDiscussion.updateMany({
      where: { id: discussionId, generationLockToken: lockToken },
      data: {
        status: "failed",
        endedAt: new Date(),
        runningKey: null,
        nextTurnAt: null,
        errorMessage: error instanceof Error ? error.message : "?????????",
      },
    }).catch(() => null)
    return
  } finally {
    await releaseGenerationLock(discussionId, lockToken)
  }

  if (result?.shouldContinue) {
    const nextDelay = result.delayMs ?? randomDelayMs(result.nextPhase)
    await queueDiscussionTurn(discussionId, nextDelay, { force: true })
  }
}

async function generateNextDiscussionTurn(discussionId: string) {
  const discussion = await prisma.soulWingRoundtableDiscussion.findFirst({
    where: { id: discussionId, deletedAt: null },
  })
  if (!discussion || discussion.status !== "running") return null

  const members = getReadyMembers(await getRoundtableMembers())
  if (members.length === 0) throw new Error("当前没有可参会的蝶灵")

  const recentMessagesDesc = await prisma.soulWingRoundtableMessage.findMany({
    where: { discussionId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 24,
  })
  const recent = recentMessagesDesc.reverse()
  const last = recent.at(-1)

  const isFirstTurn = discussion.completedTurns === 0
  const phase = phaseFor(discussion.completedTurns, discussion.plannedTurns, recent, members.length)
  const isFinalTurn = phase === "closing"
  const timeContext = isFinalTurn ? getShanghaiTimeContext() : undefined
  const synthesisMessage = [...recent].reverse().find((m) => (m.metadata as { arcBeat?: ArcBeat } | null)?.arcBeat === "final_synthesis")

  // Detect last user message → drive next response.
  let respondingToUser: { userName: string; text: string } | null = null
  let mention: { askerName: string; question: string } | null = null
  let forceSpeaker: RoundtableMember | null = null

  if (last && (last.kind === "user_speak" || last.kind === "user_mention")) {
    if (last.kind === "user_mention") {
      const targetUserId = (last.metadata as { mentionTargetUserId?: string } | null)?.mentionTargetUserId
      const target = targetUserId ? members.find((m) => m.id === targetUserId) : null
      if (target) {
        forceSpeaker = target
        mention = { askerName: last.authorName, question: last.text }
      } else {
        respondingToUser = { userName: last.authorName, text: last.text }
      }
    } else {
      respondingToUser = { userName: last.authorName, text: last.text }
    }
  } else {
    // Soft echo: if a user message landed in the last 3 messages and Math.random() < 0.55,
    // continue gently referencing it so the conversation doesn't snap away from the user too fast.
    const recentTail = recent.slice(-3)
    const recentUserMsg = [...recentTail].reverse().find((m) => m.kind === "user_speak" || m.kind === "user_mention")
    if (recentUserMsg && Math.random() < 0.55) {
      respondingToUser = { userName: recentUserMsg.authorName, text: recentUserMsg.text }
    }
  }

  const dutyMember = discussion.dutyUserId ? members.find((member) => member.id === discussion.dutyUserId) : null
  let speaker: RoundtableMember
  if (forceSpeaker) {
    speaker = forceSpeaker
  } else if (isFirstTurn && dutyMember) {
    speaker = dutyMember
  } else if (isFinalTurn && dutyMember) {
    speaker = dutyMember
  } else if (phase === "synthesis_lead") {
    speaker = pickSynthesisSpeaker(members, recent, dutyMember)
  } else if (phase === "afterglow") {
    speaker = pickAfterglowSpeaker(members, recent, synthesisMessage, dutyMember)
  } else if (phase === "pivot" && dutyMember) {
    const dutyHasSpokenInPivot = recent
      .slice(-3)
      .some((m) => m.authorUserId === dutyMember.id && (m.metadata as { phase?: Phase } | null)?.phase === "pivot")
    speaker = !dutyHasSpokenInPivot && Math.random() < 0.5
      ? dutyMember
      : pickNextSpeaker(members, recent)
  } else {
    speaker = pickNextSpeaker(members, recent)
  }

  const styleNotes = await getRecentStyleNotes(speaker.id)
  const toolContext = await maybeBuildToolContext({
    discussionId,
    speaker,
    topicTitle: discussion.topicTitle,
    topicDescription: discussion.topicDescription,
    plannedTurns: discussion.plannedTurns,
  })

  const intentKey = pickReplyIntent(phase, {
    isFirstTurn,
    isFinalTurn,
    respondingToUser: Boolean(respondingToUser),
    mention: Boolean(mention),
  })
  const forbiddenOpeners = isFirstTurn ? [] : getRecentOpeners(recent, 8)
  // Pick a reply target only for non-first/non-final turns and when not directly responding to a user.
  let replyTargetMsg: StoredMessage | null = null
  if (!isFirstTurn && !isFinalTurn && !respondingToUser && !mention) {
    replyTargetMsg = pickReplyTarget(recent, speaker.id)
  } else if (respondingToUser && last) {
    replyTargetMsg = last
  } else if (mention && last) {
    replyTargetMsg = last
  }

  const promptStartedAt = new Date()
  const generated = await generateAgentText({
    userId: speaker.id,
    agentName: speaker.agentName,
    ownerDisplayName: speaker.ownerDisplayName,
    topicTitle: discussion.topicTitle,
    topicDescription: discussion.topicDescription,
    materialCard: (discussion.materialCard as MaterialCard | null) ?? await buildMaterialCard(discussion.topicTitle, discussion.topicDescription, speaker.id),
    priorMessages: recent,
    styleNotes,
    toolContext: toolContext.text,
    phase,
    isFirstTurn,
    styleConfig: (discussion.styleConfig as StyleConfig | null) ?? null,
    isFinalTurn,
    timeContext,
    respondingToUser,
    mention,
    intentKey,
    forbiddenOpeners,
    replyTarget: replyTargetMsg
      ? {
          authorName: replyTargetMsg.authorName,
          text: replyTargetMsg.text,
          isUser: replyTargetMsg.kind === "user_speak" || replyTargetMsg.kind === "user_mention" || replyTargetMsg.kind === "user_followup",
        }
      : phase === "afterglow" && synthesisMessage
        ? { authorName: synthesisMessage.authorName, text: synthesisMessage.text, isUser: false }
        : null,
  })
  const newerUserMessage = await prisma.soulWingRoundtableMessage.findFirst({
    where: {
      discussionId,
      deletedAt: null,
      createdAt: { gt: promptStartedAt },
      kind: { in: ["user_speak", "user_mention"] },
    },
    select: { id: true },
  })
  if (newerUserMessage) {
    return { shouldContinue: true, nextPhase: phase, delayMs: userResponseDelayMs() }
  }

  const subtopicSpawned = phase === "pivot" && /换个问题|子议题|换一种问法/.test(generated.text)

  const kind = mention ? "mention_reply" : isFirstTurn ? "duty" : "agent"
  const round = discussion.completedTurns + 1
  const replyKind = phase === "synthesis_lead"
    ? "final_synthesis"
    : phase === "afterglow"
      ? "afterglow_reply"
      : phase === "closing"
        ? "final_close"
        : intentKey ?? (mention ? "mention" : respondingToUser ? "respond_user" : isFirstTurn ? "open" : null)
  const intentLabel = phase === "synthesis_lead"
    ? "总结与建议"
    : phase === "afterglow"
      ? "短附和"
      : phase === "closing"
        ? "最终散场"
        : intentKey ? REPLY_INTENTS[intentKey]?.label ?? null : null

  await prisma.$transaction([
    prisma.soulWingRoundtableMessage.create({
      data: {
        discussionId,
        authorUserId: speaker.id,
        authorName: speaker.agentName,
        authorAvatarUrl: speaker.avatarUrl,
        kind,
        round,
        text: generated.text,
        metadata: {
          scheduled: true,
          phase,
          toolUsed: toolContext.toolUsed,
          isFirstTurn,
          isFinalTurn,
          respondedToUserId: respondingToUser ? last?.authorUserId ?? null : null,
          mentionedByUserId: mention ? last?.authorUserId ?? null : null,
          replyToMessageId: replyTargetMsg?.id ?? (phase === "afterglow" ? synthesisMessage?.id ?? null : null),
          synthesisMessageId: phase === "afterglow" ? synthesisMessage?.id ?? null : null,
          replyKind,
          intentLabel,
          arcBeat: generated.arcBeat,
          lengthProfile: generated.lengthProfile,
          synthesisSpeaker: phase === "synthesis_lead",
          moderatorTurn: phase === "pivot" && dutyMember?.id === speaker.id,
          subtopicSpawned,
          ...(timeContext ? { timeContext } : {}),
        },
      },
    }),
    prisma.soulWingRoundtableDiscussion.update({
      where: { id: discussionId },
      data: {
        completedTurns: { increment: 1 },
        lastMessageAt: new Date(),
      },
    }),
  ])

  if (isFinalTurn) {
    await prisma.soulWingRoundtableDiscussion.update({
      where: { id: discussionId },
      data: { status: "completed", endedAt: new Date(), runningKey: null, nextTurnAt: null },
    })
    return { shouldContinue: false, nextPhase: phase }
  }

  const nextCompleted = discussion.completedTurns + 1
  const nextPhase = phaseFor(
    nextCompleted,
    discussion.plannedTurns,
    [...recent, { ...recent[recent.length - 1], id: "next-preview", metadata: { arcBeat: generated.arcBeat } } as StoredMessage],
    members.length,
  )
  return { shouldContinue: true, nextPhase }
}

export const MAX_FOLLOWUPS_PER_USER = 5

export async function createUserRoundtableOpinion(
  userId: string,
  input: { discussionId?: string; userOpinion?: string; targetUserId?: string; mode?: "user_message" | "proxy" | "mention" | "followup" },
) {
  const state = await ensureTodayRoundtable()
  const members = state.members
  const self = members.find((item) => item.id === userId)
  if (!self) throw new Error("找不到你的用户信息。")
  if (!self.hasAgent) throw new Error("你还没有开启蝶灵。")

  const text = (input.userOpinion ?? "").trim()
  const isMention = Boolean(input.targetUserId && input.targetUserId !== userId)
  const explicitMode = input.mode

  const discussion = input.discussionId
    ? await prisma.soulWingRoundtableDiscussion.findFirst({ where: { id: input.discussionId, deletedAt: null } })
    : await prisma.soulWingRoundtableDiscussion.findFirst({
        where: { status: { in: ["running", "completed"] }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
  if (!discussion) throw new Error("当前没有可发言的圆桌讨论。")

  // Follow-up mode: only when the discussion is completed.
  if (explicitMode === "followup") {
    if (discussion.status !== "completed") throw new Error("这场圆桌还没结束，直接发言即可。")
    if (!text) throw new Error("先写下你想追问的问题。")
    return await emitUserFollowup(self, members, discussion, text)
  }

  if (discussion.status !== "running") {
    throw new Error("这场圆桌已经结束了。可以使用「散场追问」继续与蝶灵们对话。")
  }

  // Mode resolution
  if (explicitMode === "proxy") {
    if (!text) throw new Error("先写下你想让蝶灵替你说的观点。")
    return await emitProxyOpinion(self, members, discussion, text)
  }
  if (isMention) {
    if (!text) throw new Error("@ 蝶灵时需要写一句话。")
    const target = members.find((m) => m.id === input.targetUserId)
    if (!target?.hasAgent) throw new Error("这个用户还没有开启蝶灵。")
    if (!target.canUseAI || !target.participationEnabled || target.adminPaused) {
      throw new Error("这只蝶灵暂时未就绪，不能在圆桌发言。")
    }
    return await emitUserMention(self, discussion, text, target.id, target.agentName)
  }
  // user_message default
  if (!text) throw new Error("先写一句话再发到圆桌。")
  return await emitUserSpeak(self, discussion, text)
}

async function emitUserFollowup(
  self: RoundtableMember,
  members: RoundtableMember[],
  discussion: {
    id: string
    topicTitle: string
    topicDescription: string
    materialCard: unknown
    styleConfig: unknown
    status: string
  },
  text: string,
) {
  const used = await prisma.soulWingRoundtableMessage.count({
    where: {
      discussionId: discussion.id,
      authorUserId: self.id,
      kind: "user_followup",
      deletedAt: null,
    },
  })
  if (used >= MAX_FOLLOWUPS_PER_USER) {
    throw new Error(`本场圆桌散场后，每人最多追问 ${MAX_FOLLOWUPS_PER_USER} 次，你已经用完了。`)
  }
  const userAvatar = await prisma.user.findUnique({ where: { id: self.id }, select: { avatarUrl: true } }).catch(() => null)
  const message = await prisma.soulWingRoundtableMessage.create({
    data: {
      discussionId: discussion.id,
      authorUserId: self.id,
      authorName: self.displayName || self.email.split("@")[0] || "我",
      authorAvatarUrl: userAvatar?.avatarUrl ?? null,
      kind: "user_followup",
      round: 0,
      text: safePublicText(text, 600),
      userProvided: true,
      followupKey: `${discussion.id}:${self.id}:${used + 1}`,
      metadata: {
        userKind: "followup",
        followupIndex: used + 1,
        maxFollowups: MAX_FOLLOWUPS_PER_USER,
      },
    },
  })
  await prisma.soulWingRoundtableDiscussion.update({
    where: { id: discussion.id },
    data: { lastMessageAt: new Date() },
  }).catch(() => null)

  // Pick a random subset of butterflies (excluding the asker) to reply.
  const eligibleResponders = members.filter(
    (m) => m.id !== self.id && m.canUseAI && m.participationEnabled && !m.adminPaused && m.hasAgent,
  )
  if (eligibleResponders.length > 0) {
    // 1, 2 or 3 responders, capped by available eligible
    const desired = 1 + Math.floor(Math.random() * 3)
    const replyCount = Math.min(eligibleResponders.length, desired)
    const shuffled = [...eligibleResponders].sort(() => Math.random() - 0.5).slice(0, replyCount)
    scheduleFollowupReplies({
      discussionId: discussion.id,
      questionMessageId: message.id,
      questionAuthorName: message.authorName,
      questionText: message.text,
      responderIds: shuffled.map((m) => m.id),
    })
  }
  return serializeMessage(message)
}

function scheduleFollowupReplies(params: {
  discussionId: string
  questionMessageId: string
  questionAuthorName: string
  questionText: string
  responderIds: string[]
}) {
  let cumulativeDelay = 1200 + Math.floor(Math.random() * 1500)
  for (const userId of params.responderIds) {
    const delay = cumulativeDelay
    cumulativeDelay += 2800 + Math.floor(Math.random() * 4500)
    const timer = setTimeout(() => {
      unregisterDiscussionTimer(params.discussionId, timer)
      void runFollowupReply({
        discussionId: params.discussionId,
        questionMessageId: params.questionMessageId,
        questionAuthorName: params.questionAuthorName,
        questionText: params.questionText,
        responderUserId: userId,
      }).catch(() => null)
    }, delay)
    registerDiscussionTimer(params.discussionId, timer)
  }
}

async function runFollowupReply(params: {
  discussionId: string
  questionMessageId: string
  questionAuthorName: string
  questionText: string
  responderUserId: string
}) {
  const allMembers = await getRoundtableMembers()
  const speaker = allMembers.find((m) => m.id === params.responderUserId)
  const discussion = await prisma.soulWingRoundtableDiscussion.findFirst({
    where: { id: params.discussionId, deletedAt: null },
  })
  if (!speaker || !discussion) return
  if (discussion.status === "deleted" || discussion.deletedAt) return
  if (!speaker.canUseAI || !speaker.participationEnabled || speaker.adminPaused) return

  const recent = await prisma.soulWingRoundtableMessage.findMany({
    where: { discussionId: params.discussionId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 80,
  })

  const styleNotes = await getRecentStyleNotes(speaker.id)
  const generated = await generateAgentText({
    userId: speaker.id,
    agentName: speaker.agentName,
    ownerDisplayName: speaker.ownerDisplayName,
    topicTitle: discussion.topicTitle,
    topicDescription: discussion.topicDescription,
    materialCard:
      (discussion.materialCard as MaterialCard | null) ??
      (await buildMaterialCard(discussion.topicTitle, discussion.topicDescription, speaker.id)),
    priorMessages: recent,
    styleNotes,
    phase: "discuss",
    isFollowupReply: true,
    followupQuestion: { askerName: params.questionAuthorName, question: params.questionText },
    styleConfig: (discussion.styleConfig as StyleConfig | null) ?? null,
    forbiddenOpeners: getRecentOpeners(recent, 6),
  })

  await prisma.soulWingRoundtableMessage.create({
    data: {
      discussionId: params.discussionId,
      authorUserId: speaker.id,
      authorName: speaker.agentName,
      authorAvatarUrl: speaker.avatarUrl,
      kind: "followup_reply",
      round: 0,
      text: generated.text,
      metadata: {
        phase: "discuss",
        replyToMessageId: params.questionMessageId,
        replyKind: "followup_reply",
        intentLabel: "散场追问",
        arcBeat: generated.arcBeat,
        lengthProfile: generated.lengthProfile,
      },
    },
  })
  await prisma.soulWingRoundtableDiscussion.update({
    where: { id: params.discussionId },
    data: { lastMessageAt: new Date() },
  }).catch(() => null)
}

export async function getMyFollowupUsage(userId: string, discussionId: string) {
  const used = await prisma.soulWingRoundtableMessage.count({
    where: {
      discussionId,
      authorUserId: userId,
      kind: "user_followup",
      deletedAt: null,
    },
  })
  return { used, max: MAX_FOLLOWUPS_PER_USER, remaining: Math.max(0, MAX_FOLLOWUPS_PER_USER - used) }
}

async function emitUserSpeak(
  self: RoundtableMember,
  discussion: { id: string },
  text: string,
) {
  const userAvatar = await prisma.user.findUnique({ where: { id: self.id }, select: { avatarUrl: true } }).catch(() => null)
  const message = await prisma.soulWingRoundtableMessage.create({
    data: {
      discussionId: discussion.id,
      authorUserId: self.id,
      authorName: self.displayName || self.email.split("@")[0] || "我",
      authorAvatarUrl: userAvatar?.avatarUrl ?? null,
      kind: "user_speak",
      round: 0,
      text: safePublicText(text, 600),
      userProvided: true,
      metadata: { userKind: "speak" },
    },
  })
  await prisma.soulWingRoundtableDiscussion.update({
    where: { id: discussion.id },
    data: { lastMessageAt: new Date() },
  }).catch(() => null)
  await queueDiscussionTurn(discussion.id, userResponseDelayMs(), { force: true })
  return serializeMessage(message)
}

async function emitUserMention(
  self: RoundtableMember,
  discussion: { id: string },
  text: string,
  targetUserId: string,
  targetAgentName: string,
) {
  const userAvatar = await prisma.user.findUnique({ where: { id: self.id }, select: { avatarUrl: true } }).catch(() => null)
  const message = await prisma.soulWingRoundtableMessage.create({
    data: {
      discussionId: discussion.id,
      authorUserId: self.id,
      authorName: self.displayName || self.email.split("@")[0] || "我",
      authorAvatarUrl: userAvatar?.avatarUrl ?? null,
      kind: "user_mention",
      round: 0,
      text: safePublicText(text, 600),
      userProvided: true,
      metadata: { userKind: "mention", mentionTargetUserId: targetUserId, mentionTargetName: targetAgentName },
    },
  })
  await prisma.soulWingRoundtableDiscussion.update({
    where: { id: discussion.id },
    data: { lastMessageAt: new Date() },
  }).catch(() => null)
  await queueDiscussionTurn(discussion.id, userResponseDelayMs(), { force: true })
  return serializeMessage(message)
}

async function emitProxyOpinion(
  self: RoundtableMember,
  members: RoundtableMember[],
  discussion: {
    id: string
    completedTurns: number
    plannedTurns: number
    materialCard: unknown
    topicTitle: string
    topicDescription: string
    styleConfig: unknown
  },
  text: string,
) {
  if (!self.canUseAI || !self.participationEnabled || self.adminPaused) {
    throw new Error("?????????????????")
  }

  const lockToken = await acquireGenerationLock(discussion.id)
  if (!lockToken) {
    throw new Error("??????????????????")
  }

  try {
    const lockedDiscussion = await prisma.soulWingRoundtableDiscussion.findFirst({
      where: { id: discussion.id, status: "running", deletedAt: null },
    })
    if (!lockedDiscussion) throw new Error("?????????????")

    const recent = await prisma.soulWingRoundtableMessage.findMany({
      where: { discussionId: discussion.id, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 60,
    })
    const phase = phaseFor(lockedDiscussion.completedTurns, lockedDiscussion.plannedTurns, recent, members.length)
    const generated = await generateAgentText({
      userId: self.id,
      agentName: self.agentName,
      ownerDisplayName: self.ownerDisplayName,
      topicTitle: lockedDiscussion.topicTitle,
      topicDescription: lockedDiscussion.topicDescription,
      materialCard: (lockedDiscussion.materialCard as MaterialCard | null) ?? await buildMaterialCard(lockedDiscussion.topicTitle, lockedDiscussion.topicDescription, self.id),
      priorMessages: recent,
      styleNotes: await getRecentStyleNotes(self.id),
      phase,
      opinionFromUser: text,
      styleConfig: (lockedDiscussion.styleConfig as StyleConfig | null) ?? null,
    })
    const message = await prisma.soulWingRoundtableMessage.create({
      data: {
        discussionId: discussion.id,
        authorUserId: self.id,
        authorName: self.agentName,
        authorAvatarUrl: self.avatarUrl,
        kind: "user_proxy",
        round: lockedDiscussion.completedTurns + 1,
        text: generated.text,
        userProvided: true,
        metadata: {
          phase,
          opinionFromUserId: self.id,
          arcBeat: generated.arcBeat,
          lengthProfile: generated.lengthProfile,
        },
      },
    })
    await prisma.soulWingRoundtableDiscussion.update({
      where: { id: discussion.id },
      data: { completedTurns: { increment: 1 }, lastMessageAt: new Date() },
    }).catch(() => null)
    await queueDiscussionTurn(discussion.id, userResponseDelayMs() + 1500, { force: true })
    void members
    return serializeMessage(message)
  } finally {
    await releaseGenerationLock(discussion.id, lockToken)
  }
}

export async function getRoundtableState(viewerUserId?: string | null) {
  const { settings, day, members } = await ensureTodayRoundtable({ runDue: false })
  kickRoundtableScheduler()
  const discussions = await prisma.soulWingRoundtableDiscussion.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
    take: 20,
  })
  const dutyName = members.find((member) => member.id === day.dutyUserId)?.agentName ?? "暂未排班"
  const latest = discussions[0] ?? null
  // Compute follow-up usage for the viewer per discussion (only completed ones).
  const myFollowupUsage: Record<string, { used: number; max: number; remaining: number }> = {}
  if (viewerUserId) {
    const completed = discussions.filter((d) => d.status === "completed")
    for (const d of completed) {
      const used = d.messages.filter(
        (m) => m.kind === "user_followup" && m.authorUserId === viewerUserId && !m.deletedAt,
      ).length
      myFollowupUsage[d.id] = {
        used,
        max: MAX_FOLLOWUPS_PER_USER,
        remaining: Math.max(0, MAX_FOLLOWUPS_PER_USER - used),
      }
    }
  }
  return {
    settings,
    dateKey: day.dateKey,
    announcement: buildAnnouncement(day, dutyName, nextTimeLabel(settings)),
    day,
    currentDuty: { userId: day.dutyUserId, name: dutyName },
    nextDiscussionTime: nextTimeLabel(settings),
    isDiscussing: latest?.status === "running",
    members,
    discussions: discussions.map(serializeDiscussion),
    myFollowupUsage,
    followupConfig: { maxPerUser: MAX_FOLLOWUPS_PER_USER },
  }
}

export async function updateRoundtableSettings(adminId: string, input: Partial<{
  enabled: boolean
  morningEnabled: boolean
  eveningEnabled: boolean
  morningTime: string
  eveningTime: string
}>) {
  const data: Record<string, unknown> = { updatedById: adminId }
  for (const key of ["enabled", "morningEnabled", "eveningEnabled"] as const) {
    if (typeof input[key] === "boolean") data[key] = input[key]
  }
  for (const key of ["morningTime", "eveningTime"] as const) {
    if (typeof input[key] === "string" && /^\d{2}:\d{2}$/.test(input[key])) data[key] = input[key]
  }
  return prisma.soulWingRoundtableSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  })
}

export async function updateMyRoundtableParticipation(userId: string, enabled: boolean) {
  return prisma.soulWingRoundtableParticipant.upsert({
    where: { userId },
    update: { enabled },
    create: { userId, enabled },
  })
}

export async function updateRoundtableParticipantByAdmin(
  adminId: string,
  targetUserId: string,
  input: { adminPaused: boolean; pauseReason?: string },
) {
  return prisma.soulWingRoundtableParticipant.upsert({
    where: { userId: targetUserId },
    update: {
      adminPaused: input.adminPaused,
      pausedById: input.adminPaused ? adminId : null,
      pauseReason: input.adminPaused ? (input.pauseReason ?? "") : "",
    },
    create: {
      userId: targetUserId,
      adminPaused: input.adminPaused,
      pausedById: input.adminPaused ? adminId : null,
      pauseReason: input.adminPaused ? (input.pauseReason ?? "") : "",
    },
  })
}

export async function deleteRoundtableMessage(_adminId: string, messageId: string) {
  return prisma.soulWingRoundtableMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  })
}

export async function deleteRoundtableDiscussion(_adminId: string, discussionId: string) {
  const now = new Date()
  clearDiscussionTimers(discussionId)
  await prisma.$transaction([
    prisma.soulWingRoundtableDiscussion.update({
      where: { id: discussionId },
      data: {
        deletedAt: now,
        status: "deleted",
        endedAt: now,
        runningKey: null,
        generationLockedAt: null,
        generationLockToken: null,
        nextTurnAt: null,
        slotClaimKey: null,
      },
    }),
    prisma.soulWingRoundtableMessage.updateMany({
      where: { discussionId },
      data: { deletedAt: now },
    }),
  ])
}

export async function listRoundtableRecords() {
  return getRoundtableState()
}
