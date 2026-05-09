export const guardianLines = {
  default: [
    "我在站点边界巡航，今天的数据风很平稳。",
    "你忙你的，我守着这片小港口。",
    "如果迷路了，我可以带你回 SQL 港。",
  ],
  sqlLab: [
    "我闻到了查询语句的味道。",
    "这条 SQL 航线看起来可以再检查一下。",
    "我先守着结果表，别让坏查询溜过去。",
    "表结构的潮汐正在变化，我看着呢。",
    "我从查询小屋出来了。",
    "收到召唤，我来守这条 SQL 航线。",
  ],
  thinking: [
    "让我看看这些表之间的潮汐。",
    "我正在听字段名说话。",
    "这条查询航线需要一点耐心。",
  ],
  sleeping: [
    "呼……等你召唤我。",
    "我把罗盘抱着睡一会儿。",
    "数据港暂时风平浪静。",
  ],
  walking: [
    "巡逻中，别担心。",
    "我沿着页面边界看看。",
    "这里没有异常查询。",
  ],
  teleporting: [
    "开一道查询虫洞。",
    "我从另一条数据航线过来。",
    "空间索引建立完成，出发。",
  ],
  jumping: [
    "前面过不去，我跳一下。",
    "小心，我要越过这段边界。",
    "这点高度难不倒守门人。",
  ],
  wake: [
    "我在，刚才只是安静巡航。",
    "收到召唤，守门人归位。",
    "数据港口的灯又亮起来了。",
  ],
} as const

export type GuardianLineKind = keyof typeof guardianLines

export function pickGuardianLine(kind: GuardianLineKind, cursor: number) {
  const lines = guardianLines[kind]
  return lines[Math.abs(cursor) % lines.length]
}

export function getContextLineKind(isSqlLab: boolean): GuardianLineKind {
  return isSqlLab ? "sqlLab" : "default"
}

export const guardianFormStageLines = {
  seed: [
    "My compass is small, but it is awake.",
    "The data shell is warm today.",
    "I am learning the harbor one light at a time.",
  ],
  sailor: [
    "A new query route is coming into view.",
    "The little data sail caught a steady wind.",
    "I can trace this harbor edge a bit farther now.",
  ],
  navigator: [
    "The index star map is opening.",
    "I can read more of the table tides now.",
    "The query lighthouse is clearer from here.",
  ],
  guardian: [
    "The star harbor light is steady.",
    "I will keep this data gate calm and bright.",
    "The deep-space route is quiet. I am on watch.",
  ],
} as const

export const guardianMoodLines = {
  calm: ["The harbor is quiet. I will keep watch."],
  curious: ["I wonder where this query route leads."],
  focused: ["Compass steady. Boundaries clear."],
  sleepy: ["I will dim the light until you call."],
  excited: ["The data wind just picked up."],
  confused: ["I may need one more bearing mark."],
  proud: ["The gate light is holding strong."],
} as const

export const guardianLevelUpLines = {
  seed: "My little compass just caught a new glimmer.",
  sailor: "A fresh query route is coming into view.",
  navigator: "The index star map opened a little wider.",
  guardian: "The star harbor light is brighter now.",
} as const
