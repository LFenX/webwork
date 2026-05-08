export type GuardianMood =
  | "calm"
  | "curious"
  | "focused"
  | "sleepy"
  | "excited"
  | "confused"
  | "proud"

export type GuardianVisualState =
  | "idle"
  | "walking"
  | "talking"
  | "thinking"
  | "sleeping"
  | "jumping"
  | "teleporting"
  | "celebrating"
  | "hidden"

export type GuardianFormStage = "seed" | "harbor" | "voyager"

export type GuardianProfile = {
  name: string
  level: number
  title: string
  mood: GuardianMood
  formStage: GuardianFormStage
}

export type GuardianContext = {
  pagePath: string
  isSqlLab: boolean
}

export type GuardianEventType =
  | "WAKE"
  | "MINIMIZE"
  | "RESTORE"
  | "OPEN_BUBBLE"
  | "CLOSE_BUBBLE"
  | "USER_ACTIVITY"
  | "USER_IDLE"
  | "ENTER_SQL_LAB"
  | "LEAVE_SQL_LAB"
  | "HOME_CLICKED"
  | "SPRITE_CLICKED"
  | "START_THINKING"
  | "STOP_THINKING"
  | "START_WALKING"
  | "BOUNDARY_BLOCKED"
  | "JUMP_COMPLETE"
  | "TELEPORT"
  | "TELEPORT_COMPLETE"

export type GuardianRuntimeState = {
  visualState: GuardianVisualState
  mood: GuardianMood
  bubbleOpen: boolean
  minimized: boolean
  currentLine: string
  lastInteractionAt: number
  isSqlLab: boolean
  lineCursor: number
}

export type GuardianEvent = {
  type: GuardianEventType
  at?: number
  line?: string
  isSqlLab?: boolean
  useTeleport?: boolean
  nextVisualState?: GuardianVisualState
}

export type GuardianEdge = "top" | "right" | "bottom" | "left"

export type GuardianPosition = {
  edge: GuardianEdge
  x: number
  y: number
}

export type GuardianDockMode =
  | "floating"
  | "docked"
  | "compact"
  | "minimized"

export type GuardianBubblePlacement =
  | "above-left"
  | "above-right"
  | "left"
  | "right"
  | "compact"

export type GuardianCommandReason =
  | "home-clicked"
  | "sprite-clicked"
  | "route-change"
  | "manual"
  | "sql-lab"
  | "minimized-dock"
