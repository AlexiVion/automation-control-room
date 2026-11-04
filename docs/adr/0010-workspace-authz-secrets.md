# ADR 0010 — Workspace scoping, authorization and secret handling
**Status:** proposed · **Date:** 2026-11-04

## Decision (proposed)
Workspace scoping, authorization and secret handling.

## Why
All data/commands/effects require server-side scoped checks and encryption/redaction.

## Tradeoff
Guest demo adds isolation and retention work.

## Acceptance / reconsideration
Block launch on cross-tenant negative test failure.

## Gate 4E implementation candidates

- [Workspace authorization policy](../../packages/security/src/authorization.ts): guest and operator grants checked against trusted workspace scope.
- [Guest session and CSRF primitives](../../packages/security/src/sessions.ts): opaque cookie token, hashed storage, expiry, Origin and CSRF.
- [AES-256-GCM scoped envelope](../../packages/security/src/secrets.ts): nonce, AAD, key version and rewrap.
- [PostgreSQL scoping and cleanup spike](../../spikes/gate4e/README.md): atomic demo quota, workspace-qualified synthetic CRM, TTL and cascade cleanup.

All are **component-level test candidates**. Real API auth, scoped repositories, key management and integration tests remain unimplemented. ADR status stays proposed.

## Evidencia Gate 4E

[CI #41840871229](https://github.com/AlexiVion/automation-control-room/actions/runs/41840871229) **PASS**: política de workspace, sesión/CSRF, cifrado AEAD y aislamiento/cuota TTL en PostgreSQL 17. Sigue faltando middleware Fastify, KMS real y control de datos de la aplicación; ADR **propuesto**.
