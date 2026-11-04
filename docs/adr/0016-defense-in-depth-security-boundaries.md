# ADR 0016 — Security trust boundaries are server-owned

**Status: proposed** · **Date:** 2026-11-04 · **Gate:** 4E

## Proposed decision

- Authentication, workspace authorization, session expiry and quotas live on server/DB, never client or model.
- Guest mode permits only synthetic demo operations. No live model billing, arbitrary HTTP, external provider access or credential read.
- HMAC signing uses original raw-body bytes plus timestamp/event ID; DB receipt uniqueness provides replay deduplication.
- Mutating cookie-auth API routes require Origin and CSRF verification. Tokens are opaque, stored hashed and expire by inactivity/absolute deadline.
- Encrypt connector secrets with workspace/credential-bound AEAD and key IDs, keeping keys outside the database.
- HTTP nodes use named allowlisted destinations with DNS/IP checks, TLS hostname validation, IP pinning and network egress filtering. Without a pinned transport, HTTP effects remain disabled.
- LLM output can propose structurally valid drafts but never grant policy or approve/execute effects.

## Rejected alternatives

Using browser-local permissions as authorization; in-memory-only rate limits and cooldowns; arbitrary HTTP fetch from a workflow URL; unvalidated model-generated tool invocations; logging raw webhook bodies/credentials; trusting CORS as the only CSRF defense.

## Consequences

More explicit boundaries and security testing. MVP HTTP connector must remain unavailable until connection-level SSRF defenses are implemented; isolated policy tests cannot substitute for an integrated security review.

## Evidence and acceptance

Unit and PostgreSQL security tests in Gate 4E provide **component evidence only**. ADR acceptance requires owner review and documented integration/operations tasks. Public release requires verification of real middleware, egress controls, isolation and secrets lifecycle.

Links: [Security Controls](../security/SECURITY_CONTROLS.md) · [Threat Model](../security/THREAT_MODEL.md) · [Issue #6](https://github.com/AlexiVion/automation-control-room/issues/6).

## Evidencia de implementación candidata

[GitHub Actions #41840871229](https://github.com/AlexiVion/automation-control-room/actions/runs/41840871229) **PASS**: controles aislados probados (HMAC, sesiones/CSRF, scopes, AES-GCM, SSRF preflight, IA) y aislamiento/cuotas/cleanup en PostgreSQL real. Los límites están documentados en [SECURITY_EVIDENCE.md](../security/SECURITY_EVIDENCE.md). **ADR propuesto; no constituye certificación ni gate de release.**
