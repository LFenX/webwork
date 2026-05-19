import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/app/generated/prisma/client"

// Version key - bump this whenever schema changes to invalidate the HMR-cached instance.
const SCHEMA_VERSION = "v30-public-visibility-slug"

const g = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>
  prismaSchemaVersion?: string
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL env var is required for PostgreSQL")
  }
  const adapter = new PrismaPg({ connectionString })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

if (g.prismaSchemaVersion !== SCHEMA_VERSION) {
  g.prisma = createPrisma()
  g.prismaSchemaVersion = SCHEMA_VERSION
}

export const prisma = g.prisma!
