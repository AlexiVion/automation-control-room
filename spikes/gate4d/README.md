# Gate 4D — PostgreSQL/Prisma/pg-boss transactional spike

**Scope:** isolated technical proof only. Not the workflow engine, public API or a production deployment.

## Pinned versions for the experiment

- PostgreSQL 17 via GitHub Actions service
- Prisma ORM / @prisma/client / @prisma/adapter-pg **7.10.1**
- pg-boss **12.38.0**
- Node.js 22 on CI
- No Redis or third-party paid services

**Why Prisma 7:** Prisma 8 is still RC as of 2026-11-04 and its interfaces differ from the v7 adapter used by pg-boss. Official pg-boss docs support `fromPrisma(tx)` in v7 + `@prisma/adapter-pg`.

## Run locally (on a disposable local DB)

```sh
export DATABASE_URL='postgresql://acr:acr_test@127.0.0.1:5432/acr_test'
npm ci
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts --accept-data-loss
npm run typecheck:gate4d
npm run test:gate4d
```

The spike **refuses nonlocal database hostnames**. The schema is intentionally disposable; `db push` is **not** a production migration strategy.

## What tests prove (if green)

1. Same Prisma interactive transaction persists execution/event and pg-boss job.
2. Throw before commit restores no execution and **no matching queued job**.
3. Concurrent duplicate intake is prevented by a database UNIQUE constraint and does not enqueue twice.
4. Competing approval decisions via conditional update yield a single winner. Additional tests verify **approval decision + execution state + event + resume job** commit atomically and rollback together.
5. Queued job remains durable with no consumer and is processed when an independent worker starts; local CRM upsert and event are idempotent after duplicate delivery.
7. A real OS-level **SIGKILL** of an independently spawned worker after claiming a short-expiry job permits the supervisor to retry it; the recovered worker applies a single idempotent local CRM upsert.
6. A deliberately uncertain *remote* effect is marked `needs_review` without external retry.

## Not proven here

- A genuine OS-kill of a worker **during a remote HTTP side effect**; the added SIGKILL test interrupts the worker **before any side effect** and waits for supervisor retry.
- Exactly-once effects on arbitrary third-party APIs.
- Atomicity of **worker acknowledgement** with multiple Prisma writes (a separate pg-boss transactional worker design may be appropriate).
- Production network security, billing, auth, multi-tenancy, capacity, backups or disaster recovery.
- A complete workflow runtime (this spike proves the atomic **approval resume job handoff**, not a running approval workflow).

Before accepting Gate 4D, confirm CI evidence for the SIGKILL recovery and approval resume tests, document the remaining uncertainty of external effects, and explicitly approve bounded reliability semantics.

## Reference

[pg-boss transaction adapters](https://pgboss.io/api/adapters), [transactional workers](https://pgboss.io/api/workers), [Prisma v7](https://www.prisma.io/docs/orm/v7).
