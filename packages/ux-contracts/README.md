# Gate 4F — UI state projections (executable UX contract)

**Status:** tested pure functions, not a running Next.js/React user interface.

- \`projectRunView()\` renders status only from a Zod-validated persisted Execution snapshot. A pending request or animation never produces completed.
- \`applyPersistedEvent()\` accepts SSE-derived events only when they have the same execution ID and the next sequence number; duplicates are ignored, gaps stop updates and require DB-backed resynchronization.
- \`restorePersistedTimeline()\` checks sorted history is complete and contiguous. It deliberately rejects gaps rather than inventing missing audit entries.
- \`entryReducer()\` models HTTP intake interaction without conflating a job accepted (202) with an execution completed.

\`\`\`sh
npm ci
npm run typecheck:ux
npm run test:ux
\`\`\`

This package has **no** runtime API calls, no frontend, no real SSE streaming, no real session or automatic retries. The server will later need to authenticate/authorize all queries and implement a paginated/resumable event-history read protocol. UX needs to handle long timelines beyond the prototype's 1000-record replacement limit.

Evidence: [Gate 4F issue](https://github.com/AlexiVion/automation-control-room/issues/7), [UX spec](../../docs/ux/UX_SPEC.md), [observability](../../docs/operations/OBSERVABILITY.md).
