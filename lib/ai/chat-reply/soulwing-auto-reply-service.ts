import "server-only"
import { prisma } from "@/lib/db"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { requestProviderChat } from "@/lib/ai/provider"

const AUTO_REPLY_ENABLED = process.env.SOULWING_AUTO_REPLY_ENABLED === "true"

const AWAY_NOTICE_DIRECT = "我现在暂时不在，这是蝶灵帮我自动回复：我稍后看到会认真回复你。"
const AWAY_NOTICE_GROUP = "我现在暂时不在，稍后看到会再回复大家。"
const SAFE_REPLY = "我现在暂时不在，稍后看到会回复你。"
const MAX_CONTEXT = 50

// ── Helpers ──

function isHighRiskMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return /(转账|汇款|银行卡|密码|账号|借.*钱|付款|佣金|合同|签约|承诺|担保|法律|诉讼|医疗|病历|体检|身份证|住址|感情|分手|离婚|隐私|秘密)/.test(lower)
}

function buildAutoReplySystemPrompt(discloseAsAutoReply: boolean): string {
  return [
    "你是蝶灵（SoulWing），用户开启了自动回复。",
    "你的任务：帮用户生成一条简短的自动回复消息。",
    discloseAsAutoReply ? "必须明确说明用户暂时不在，或这是自动回复。" : "",
    "不要假装用户正在实时在线聊天。",
    "不要替用户做任何承诺。",
    "不要答应转账、合同、身份验证等高风险事项。",
    "回复控制在 1-3 句话，不要过长。",
    "群聊要更短更克制，不要刷屏。",
    "只输出一条可直接发送的消息，不要解释。",
  ].filter(Boolean).join(" ")
}

// ── Get matching settings ──

export async function getMatchingAutoReplySettings(userId: string, chatType: string, conversationId: string) {
  return prisma.autoReplySetting.findMany({
    where: {
      userId,
      enabled: true,
      OR: [
        { scope: "global" },
        { chatType, conversationId },
        { chatType, conversationId: null, scope: { in: ["all_direct", "all_group"] } },
      ],
    },
  })
}

// ── Check if trigger should fire ──

export async function shouldTriggerAutoReply(params: {
  userId: string
  chatType: string
  conversationId: string
  senderUserId: string
}): Promise<boolean> {
  const { userId, chatType, conversationId, senderUserId } = params

  // Don't reply to self
  if (senderUserId === userId) return false

  // Don't reply in group chats unless explicitly allowed
  if (chatType === "group") {
    const groupSetting = await prisma.autoReplySetting.findFirst({
      where: { userId, enabled: true, allowGroupReply: true, chatType: "group" },
    })
    if (!groupSetting) return false
  }

  const settings = await getMatchingAutoReplySettings(userId, chatType, conversationId)
  if (settings.length === 0) return false

  // Check cooldown: has there been a reply in the last N minutes?
  const minCooldown = Math.min(...settings.map(s => s.cooldownMinutes))
  const recentLog = await prisma.autoReplyLog.findFirst({
    where: { userId, conversationId, createdAt: { gte: new Date(Date.now() - minCooldown * 60 * 1000) } },
    select: { id: true },
  })
  if (recentLog) return false

  // Check daily limit
  const minDaily = Math.min(...settings.map(s => s.maxRepliesPerDay))
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCount = await prisma.autoReplyLog.count({
    where: { userId, createdAt: { gte: todayStart } },
  })
  if (todayCount >= minDaily) return false

  return true
}

// ── Generate auto-reply text ──

async function generateAutoReplyText(
  userId: string,
  chatType: string,
  conversationId: string,
  setting: { replyMode: string; templateText?: string | null; customInstruction?: string | null; discloseAsAutoReply: boolean },
  triggerText: string,
): Promise<string> {
  const { replyMode, templateText, customInstruction, discloseAsAutoReply } = setting

  // away_notice — fixed safe message
  if (replyMode === "away_notice") {
    return chatType === "direct" ? AWAY_NOTICE_DIRECT : AWAY_NOTICE_GROUP
  }

  // template — user's own template
  if (replyMode === "template") {
    const tmpl = templateText?.trim() || (chatType === "direct" ? AWAY_NOTICE_DIRECT : AWAY_NOTICE_GROUP)
    if (discloseAsAutoReply && !tmpl.includes("不在")) {
      return `【自动回复】${tmpl}`
    }
    return tmpl
  }

  // high-risk content → safe fallback immediately
  if (isHighRiskMessage(triggerText)) return SAFE_REPLY

  // Check user memory settings — respect persona & memory toggles
  const memSettings = await prisma.memorySettings.findUnique({ where: { userId } }).catch(() => null)
  if (memSettings && !memSettings.enablePersonaContext) {
    return chatType === "direct" ? AWAY_NOTICE_DIRECT : AWAY_NOTICE_GROUP
  }

  const provider = await getEffectiveProviderConfig(userId).catch(() => null)
  if (!provider) return SAFE_REPLY

  let messages: Array<{ text: string; senderId: string; sender: { displayName: string } | null }> = []
  try {
    if (chatType === "direct") {
      // Verify friendship before reading messages
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: userId, userBId: conversationId },
            { userAId: conversationId, userBId: userId },
          ],
        },
        select: { id: true },
      })
      if (!friendship) return SAFE_REPLY

      messages = await prisma.chatMessage.findMany({
        where: { OR: [{ senderId: userId, receiverId: conversationId }, { senderId: conversationId, receiverId: userId }] },
        orderBy: { createdAt: "desc" }, take: Math.min(20, MAX_CONTEXT),
        select: { senderId: true, text: true, sender: { select: { displayName: true } } },
      })
    } else {
      const membership = await prisma.chatChannelMember.findFirst({ where: { channelId: conversationId, userId }, select: { id: true } })
      if (!membership) return SAFE_REPLY
      messages = await prisma.channelMessage.findMany({
        where: { channelId: conversationId },
        orderBy: { createdAt: "desc" }, take: Math.min(20, MAX_CONTEXT),
        select: { senderId: true, text: true, sender: { select: { displayName: true } } },
      })
    }
  } catch { return SAFE_REPLY }

  if (messages.length === 0) {
    return chatType === "direct" ? AWAY_NOTICE_DIRECT : AWAY_NOTICE_GROUP
  }

  const context = messages.reverse().map(m => {
    const isMe = m.senderId === userId
    return `${isMe ? "我" : (m.sender?.displayName || "对方")}: ${m.text || "[表情]"}`
  }).join("\n")

  const systemContent = [
    buildAutoReplySystemPrompt(discloseAsAutoReply),
    replyMode === "hybrid" ? "先简短说明用户不在，再根据聊天语境给一句简短回应。" : "",
    customInstruction?.trim() ? `\n用户自定义要求：${customInstruction.trim()}` : "",
    `\n聊天类型：${chatType === "direct" ? "单聊" : "群聊"}`,
    `\n最近消息：\n${context}`,
    "\n请生成一条自动回复消息（1-3句话）：",
  ].join("")

  try {
    const result = await requestProviderChat({
      provider,
      messages: [{ role: "system", content: systemContent }],
      stream: false,
      onAssistantStart: () => {},
      onAssistantDelta: () => {},
    })
    const reply = (result.assistantText || "").trim()
    if (!reply || isHighRiskMessage(reply)) return SAFE_REPLY
    // Force disclosure prefix for semantic/hybrid when discloseAsAutoReply is on
    if (discloseAsAutoReply && !reply.includes("不在") && !reply.includes("自动回复")) {
      return `【自动回复】${reply}`
    }
    return reply
  } catch {
    return SAFE_REPLY
  }
}

// ── Main entry point ──

export async function maybeRunSoulWingAutoReply(params: {
  userId: string
  chatType: string
  conversationId: string
  newMessageId: string
  senderUserId: string
}) {
  // Hard gate — feature must be explicitly enabled via env
  if (!AUTO_REPLY_ENABLED) return

  const { userId, chatType, conversationId, newMessageId, senderUserId } = params

  // Quick guards
  if (senderUserId === userId) return
  if (chatType === "group") {
    const anyGroupEnabled = await prisma.autoReplySetting.findFirst({
      where: { userId, enabled: true, allowGroupReply: true },
      select: { id: true },
    })
    if (!anyGroupEnabled) return
  }

  const shouldTrigger = await shouldTriggerAutoReply(params).catch(() => false)
  if (!shouldTrigger) return

  const settings = await getMatchingAutoReplySettings(userId, chatType, conversationId)
  if (settings.length === 0) return

  // Get the trigger message text
  let triggerText = ""
  try {
    const msg = chatType === "direct"
      ? await prisma.chatMessage.findUnique({ where: { id: newMessageId }, select: { text: true } })
      : await prisma.channelMessage.findUnique({ where: { id: newMessageId }, select: { text: true } })
    triggerText = msg?.text || ""
  } catch { /* continue */ }

  // Generate reply using the first matching setting
  const setting = settings[0]
  const replyText = await generateAutoReplyText(userId, chatType, conversationId, setting, triggerText)

  // Send the reply and write log atomically to prevent concurrent duplicates
  try {
    await prisma.$transaction(async (tx) => {
      // Double-check cooldown inside transaction
      const recentLog = await tx.autoReplyLog.findFirst({
        where: { userId, conversationId, createdAt: { gte: new Date(Date.now() - setting.cooldownMinutes * 60 * 1000) } },
        select: { id: true },
      })
      if (recentLog) return

      let replyMessageId: string | undefined
      if (chatType === "direct") {
        const msg = await tx.chatMessage.create({
          data: { senderId: userId, receiverId: conversationId, text: replyText },
          select: { id: true },
        })
        replyMessageId = msg.id
      } else {
        const msg = await tx.channelMessage.create({
          data: { channelId: conversationId, senderId: userId, text: replyText },
          select: { id: true },
        })
        replyMessageId = msg.id
      }

      await tx.autoReplyLog.create({
        data: {
          userId, chatType, conversationId,
          triggerMessageId: newMessageId,
          replyMessageId,
          replyText,
          replyMode: setting.replyMode,
          reason: `trigger=${setting.triggerMode}`,
        },
      })
    })
  } catch { /* silent failure — log is best-effort */ }
}
