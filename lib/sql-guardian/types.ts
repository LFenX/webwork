export type GuardianMood = "calm" | "curious" | "focused" | "sleepy" | "excited"

export type GuardianVisualState = "idle" | "talking" | "thinking" | "sleeping" | "hidden"

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
