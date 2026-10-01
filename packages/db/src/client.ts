import { PrismaClient } from "@prisma/client";

/** Creates a Prisma client. The URL comes from the environment only (CLAUDE.md rule 4). */
export function createPrisma(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set; copy .env.example to .env");
  return new PrismaClient({ datasources: { db: { url } } });
}

export type Db = PrismaClient;
