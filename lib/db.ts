import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/app/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> }

function createPrisma() {
  const adapter = new PrismaLibSql({ url: "file:./dev.db" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
