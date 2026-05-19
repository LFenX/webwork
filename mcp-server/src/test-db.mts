import { PrismaPg } from "@prisma/adapter-pg";
import * as PM from "../../app/generated/prisma/client";

const moduleWithDefault = PM as typeof PM & {
  default?: { PrismaClient?: typeof PM.PrismaClient }
};
const PC = PM.PrismaClient || moduleWithDefault.default?.PrismaClient;
const connectionString = process.env.DATABASE_URL!;

async function main() {
  if (!PC) throw new Error("PrismaClient export not found");
  process.stderr.write("Creating adapter...\n");
  const adapter = new PrismaPg({ connectionString });
  process.stderr.write("Creating client...\n");
  const prisma = new PC({ adapter });
  process.stderr.write("Querying users...\n");
  const users = await prisma.user.findMany({ take: 2, select: { id: true, email: true } });
  console.log(JSON.stringify(users));
  await prisma.$disconnect();
}

main().catch(e => { process.stderr.write(`FAIL: ${e.message || e}\n`); process.exit(1); });
