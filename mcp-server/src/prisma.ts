import { PrismaPg } from "@prisma/adapter-pg"
// The parent app's generated Prisma client lives outside our ESM boundary,
// so Node/tsx wraps its named exports under a CJS `default`. We import the
// whole module namespace and pick `PrismaClient` off whichever form is live
// at runtime.
import * as PrismaModule from "../../app/generated/prisma/client"

const moduleWithDefault = PrismaModule as typeof PrismaModule & {
  default?: { PrismaClient?: typeof PrismaModule.PrismaClient }
}
const PrismaClient = PrismaModule.PrismaClient ?? moduleWithDefault.default?.PrismaClient

if (!PrismaClient) {
  throw new Error(
    "[mcp-server] Could not find PrismaClient export in ../../app/generated/prisma/client. " +
      "Did you run `prisma generate` in the parent project?",
  )
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    "[mcp-server] DATABASE_URL is required. Pass it via the `env:` block in ~/.hermes/config.yaml.",
  )
}

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter })
