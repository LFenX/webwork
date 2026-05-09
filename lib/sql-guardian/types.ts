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

export type GuardianFormStage =
  | "seed"
  | "harbor"
  | "voyager"
  | "sailor"
  | "navigator"
  | "guardian"

export type GuardianPreferences = {
  dockMode?: GuardianDockMode
  reducedMotionAware?: boolean
  autoBubbleInSqlLab?: boolean
  guardianMemoryEnabled?: boolean
  soulwingToGuardianMemoryBridgeEnabled?: boolean
  guardianToSoulWingMemoryBridgeEnabled?: boolean
}

export type GuardianPersonality = {
  curiosity: number
  warmth: number
  mischief: number
  rigor: number
  patience: number
  melancholy: number
  bravery: number
  sqlPurism: number
}

export type GuardianProfile = {
  id?: string
  name: string
  level: number
  title: string
  mood: GuardianMood
  formStage: GuardianFormStage
  exp?: number
  avatarSeed?: string
  personality?: GuardianPersonality
  preferences?: GuardianPreferences
}

export type GuardianProfileClient = GuardianProfile & {
  exp: number
}

export type GuardianProgress = {
  level: number
  currentLevelExp: number
  nextLevelExp: number
  progress: number
}

export type GuardianProfileResponse = {
  profile: GuardianProfileClient
  progress: GuardianProgress
}

export type GuardianEventResponse = {
  event: {
    id: string
    eventType: string
    expDelta: number
    createdAt: string
  }
  profile: GuardianProfileClient
  progress: GuardianProgress
  cooldownApplied?: boolean
}

export type GuardianDialogueRole = "user" | "assistant"

export type GuardianDialogueClient = {
  id: string
  role: GuardianDialogueRole
  content: string
  mood: string | null
  pagePath: string | null
  createdAt: string
}

export type GuardianDialogueListResponse = {
  items: GuardianDialogueClient[]
}

export type GuardianChatResponse = {
  reply: string
  dialogue: {
    user: GuardianDialogueClient
    assistant: GuardianDialogueClient
  } | null
  profile: GuardianProfileClient
  progress: GuardianProgress
  memoryCandidates?: GuardianMemoryClient[]
  fallback?: boolean
  fallbackReason?: string
}

export type GuardianMemoryType =
  | "preference"
  | "nickname"
  | "sqlHabit"
  | "learningGoal"
  | "relationship"
  | "projectContext"
  | "boundary"
  | "other"

export type GuardianMemoryStatus =
  | "active"
  | "candidate"
  | "archived"
  | "rejected"

export type GuardianMemorySource =
  | "manual"
  | "guardianChat"
  | "userConfirmed"
  | "system"

export type GuardianMemorySensitivity =
  | "low"
  | "medium"
  | "high"

export type GuardianMemoryClient = {
  id: string
  type: GuardianMemoryType
  status: GuardianMemoryStatus
  source: GuardianMemorySource
  sensitivity: GuardianMemorySensitivity
  content: string
  summary: string | null
  importance: number
  visibility: string
  metadataJson?: unknown
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GuardianMemoryListResponse = {
  items: GuardianMemoryClient[]
}

export type GuardianMemoryMutationResponse = {
  memory: GuardianMemoryClient
}

export type GuardianMemoryBridgeDirection =
  | "soulwing_to_guardian"
  | "guardian_to_soulwing"

export type GuardianMemoryBridgeStatus =
  | "active"
  | "revoked"

export type GuardianMemoryBridgeSharedType =
  | "nickname"
  | "communicationPreference"
  | "learningGoal"
  | "sqlPreference"
  | "projectContext"
  | "boundary"
  | "safePreference"

export type GuardianMemoryBridgeClient = {
  id: string
  direction: GuardianMemoryBridgeDirection
  sourceType: string
  sourceId: string
  target: string
  type: GuardianMemoryBridgeSharedType
  status: GuardianMemoryBridgeStatus
  sharedSummary: string
  sensitivity: "low"
  lastReadAt: string | null
  readCount: number
  createdAt: string
  updatedAt: string
  revokedAt: string | null
}

export type GuardianMemoryBridgeSettings = {
  soulwingToGuardianMemoryBridgeEnabled: boolean
  guardianToSoulWingMemoryBridgeEnabled: boolean
}

export type GuardianMemoryBridgeSettingsResponse = {
  settings: GuardianMemoryBridgeSettings
  soulWingMemoryAvailable: boolean
}

export type GuardianMemoryBridgeListResponse = {
  items: GuardianMemoryBridgeClient[]
}

export type GuardianMemoryBridgeMutationResponse = {
  bridge: GuardianMemoryBridgeClient
}

export type GuardianClientEventType =
  | "HOME_CLICKED"
  | "SPRITE_CLICKED"
  | "BUBBLE_OPENED"
  | "ENTER_SQL_LAB"
  | "GUARDIAN_WOKE"

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
  | "LEVEL_UP"
  | "LEVEL_UP_COMPLETE"
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
