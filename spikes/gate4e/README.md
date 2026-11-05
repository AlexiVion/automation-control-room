# Gate 4E — Guest access and quota persistence spike

**Status:** candidate requiring CI and review; not production database models.

Extends the **disposable Gate 4D Prisma/PostgreSQL schema** with workspace, guest session and scoped synthetic CRM rows. Tests verify separate guest sessions do not share a record, atomic reserve of one active run/5 starts per guest, idle/absolute expiry and cascade deletion of guest data.

```bash
export DATABASE_URL='postgresql://acr:acr_test@127.0.0.1:5432/acr_test'
npm ci
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts --accept-data-loss
npm run typecheck:gate4e
npm run test:gate4e
```

- Session authenticity is checked from the stored hash; only scope returned by session lookup may be used in queries.
- Quotas are enforced through **atomic PostgreSQL conditional updates**, never an in-process counter.
- Expired scopes become inaccessible even before cleanup runs; cascade deletion occurs with the workspace in the spike.
- No global cross-session concurrency budget, rate-limit-by-source, distributed cleanup scheduler, connection limits or real Fastify middleware is provided.
- This uses `db push` for **throwaway test DB only**. Production requires migrations, database permissions and test isolation.

See [Security controls](../../docs/security/SECURITY_CONTROLS.md) and [Threat model](../../docs/security/THREAT_MODEL.md).
