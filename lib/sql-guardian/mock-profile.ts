import type { GuardianProfile } from "@/lib/sql-guardian/types"

export const mockGuardianProfile = {
  name: "Query",
  level: 1,
  title: "迷失的数据水手",
  mood: "curious",
  formStage: "seed",
} satisfies GuardianProfile
