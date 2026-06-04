import "dotenv/config"
import { syncUpdateLogSnapshot } from "@/lib/update-log-core"

const rawLimit = Number(process.argv[2] ?? 80)

syncUpdateLogSnapshot(Number.isFinite(rawLimit) ? rawLimit : 80)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exitCode = 1
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
