import "server-only"
import { listRoundtableRecords } from "@/lib/soulwing-roundtable"
import { toolGranted } from "@/lib/ai/tools/helpers"

export const getSoulWingRoundtableRecordsTool = {
  name: "get_soulwing_roundtable_records",
  title: "读取蝶灵圆桌记录",
  description: "读取当前用户可见的蝶灵圆桌公告、今日主题、资料卡、参与蝶灵、发言内容、总结和最近讨论历史，用于回顾、总结、对比观点。",
  scope: "self" as const,
  inputSchemaSummary: "query?: string, limit?: number",
  sensitivity: "medium" as const,
  auditLabel: "read_soulwing_roundtable",
  whenToUse:
    "当用户询问蝶灵圆桌，例如今天早上讨论了什么、昨晚 9 点总结、大家对某话题的分歧、哪几个蝶灵观点有意思、错过圆桌补课、资料卡背景时使用。",
  whenNotToUse:
    "不要用于读取普通群聊或私聊。不要泄露圆桌以外的私密昵称、人设称谓或无权限消息。",
  argumentHints: ["query 可选，用于说明用户想回顾的时间、场次或主题", "limit 可选，默认返回最近讨论"],
  returns: "蝶灵圆桌公告、主题、资料卡、成员状态、最近讨论和消息。",
  parameterSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional user query about a roundtable session." },
      limit: { type: "integer", minimum: 1, maximum: 10, description: "Max discussions to return." },
    },
    additionalProperties: false,
  },
  execute: async ({ limit }: { userId: string; query?: string; limit?: number }) => {
    const state = await listRoundtableRecords()
    const max = Math.min(Math.max(limit ?? 5, 1), 10)
    return toolGranted("已读取蝶灵圆桌的公告、资料卡和最近讨论记录。", {
      dateKey: state.dateKey,
      announcement: state.announcement,
      currentDuty: state.currentDuty,
      nextDiscussionTime: state.nextDiscussionTime,
      day: {
        morningTitle: state.day.morningTitle,
        morningDescription: state.day.morningDescription,
        eveningTitle: state.day.eveningTitle,
        eveningDescription: state.day.eveningDescription,
        materialCard: state.day.materialCard,
      },
      members: state.members.map((member) => ({
        id: member.id,
        agentName: member.agentName,
        status: member.status,
      })),
      discussions: state.discussions.slice(0, max).map((discussion) => ({
        id: discussion.id,
        slot: discussion.slot,
        source: discussion.source,
        status: discussion.status,
        topicTitle: discussion.topicTitle,
        topicDescription: discussion.topicDescription,
        startedAt: discussion.startedAt,
        endedAt: discussion.endedAt,
        summary: discussion.summary,
        messages: discussion.messages.map((message) => ({
          authorName: message.authorName,
          kind: message.kind,
          round: message.round,
          text: message.text,
          userProvided: message.userProvided,
          createdAt: message.createdAt,
        })),
      })),
    })
  },
}
