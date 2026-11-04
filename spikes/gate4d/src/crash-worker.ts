import { PgBoss } from "pg-boss";
import { BOSS_SCHEMA, CRASH_QUEUE } from "./spike.js";

const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Refusing nonlocal database for worker-crash spike");
}
const boss = new PgBoss({ connectionString: url, schema: BOSS_SCHEMA, supervise: false });
boss.on("error", error => { process.stderr.write(String(error) + "\n"); });
await boss.start();
await boss.work(CRASH_QUEUE, { pollingIntervalSeconds: 0.5 }, async jobs => {
  process.send?.({ type: "claimed", executionId: (jobs[0]?.data as {executionId:string})?.executionId });
  // Intentionally never settle. Parent SIGKILLs the OS process to simulate abrupt crash.
  await new Promise<void>(() => {});
});
process.send?.({ type: "ready" });
