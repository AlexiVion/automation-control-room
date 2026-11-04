# Contributing to Automation Control Room

Thank you for helping build an independent, open-source automation platform.

**Current phase: architecture definition.** No production code has been implemented, and the published specs are proposals.

## Before opening code changes

1. Read `docs/product/PRD.md`, `docs/architecture/ARCHITECTURE.md`, and `docs/security/THREAT_MODEL.md`.
2. Check the related Phase 4 gate issue and ADR status.
3. Propose interface/schema changes through an issue or PR before writing an incompatible implementation.
4. Never include ClickDialog source, customer data, personal data, credentials or proprietary code.

## Engineering standards (once code starts)

- TypeScript strict mode, explicit error handling, Zod at trust boundaries.
- Pure domain and engine modules do not import UI, persistence or transport.
- Each worker effect must have authorization, timeout, idempotency policy and audit events.
- Feature claims require tests using real PostgreSQL where transactional behavior matters.
- Keep CI lean: avoid unnecessary parallel workflows and redundant local jobs.
- Document third-party licenses, attribution and provenance before reusing code.

## Review

Use a feature branch and pull request. Document rationale, affected contracts, security changes, test evidence and backwards-compatibility impact. ADRs marked `proposed` are not implementation permission. Do not merge code that grants LLM output authority to execute external effects.

## License

The project's original work is intended under Apache-2.0. Contributors must have the right to license their own work; external snippets and dependencies may require additional notices.
