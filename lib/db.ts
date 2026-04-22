import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/app/generated/prisma/client"

// Version key — bump this whenever schema changes to invalidate the HMR-cached instance
const SCHEMA_VERSION = "v9-sessions-article-folders"

const g = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>
  prismaSchemaVersion?: string
}

function createPrisma() {
  const adapter = new PrismaLibSql({ url: "file:./dev.db" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

if (g.prismaSchemaVersion !== SCHEMA_VERSION) {
  g.prisma = createPrisma()
  g.prismaSchemaVersion = SCHEMA_VERSION
}

export const prisma = g.prisma!
