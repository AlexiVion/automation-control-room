import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/product/client.js";
import { PgBoss } from "pg-boss";
export { fromPrisma } from "pg-boss";
export { Prisma } from "../../../generated/product/client.js";
export type { DemoExecution, DemoSession, DemoApproval } from "../../../generated/product/client.js";
export const QUEUE = "acr-demo-start";
export const RESUME = "acr-demo-continue";
export const BOSS_SCHEMA = "acr_product_jobs";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
export const boss = new PgBoss({ connectionString, schema: BOSS_SCHEMA });
boss.on("error", error => console.error("queue service error", error));
export async function initializeBoss() {
  await boss.start();
  await boss.createQueue(QUEUE, { retryLimit: 2, retryDelay: 1 });
  await boss.createQueue(RESUME, { retryLimit: 2, retryDelay: 1 });
}
