# Architecture Decision Records
All ADRs are currently **proposed**, not final. Every accepted decision must include rationale, tradeoffs, date, evidence, and a rule for revisiting it.

## Proposed records
- 0001 Modular monolith, three processes
- 0002 PostgreSQL source of truth
- 0003 pg-boss pending compatibility spike
- 0004 Immutable versioned DAG
- 0005 No arbitrary code in MVP
- 0006 Typed connector registry
- 0007 Durable approvals
- 0008 AI proposes only
- 0009 ActionLedger and explicit uncertain effects
- 0010 Workspace authorization and secrets
- 0011 Event ledger with SSE replay
- 0012 Apache 2.0 for original source
- 0013 Independent deployment from ClickDialog
- 0014 Anonymous demo sandbox, LLM modes and quota budgets
- 0015 Strict typed contracts, Zod v4 and OpenAPI 3.1

## Workflow
Status transitions: proposed → accepted or rejected → superseded. Avoid silently editing accepted ADRs; create a superseding record when implementation evidence changes the decision.
