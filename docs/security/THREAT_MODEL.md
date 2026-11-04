# Threat Model — ACR
**Status:** proposed · **Gate:** 4E

## Trust boundaries
Browser → authenticated API; external webhook sender → validated intake; API → PostgreSQL; worker → credential vault → connector; untrusted lead text → LLM; public guest demo → isolated fixture only.

## Risks and mandatory controls
| Threat | Mitigation |
|---|---|
| Forged/replayed webhook | HMAC signatures, timestamp window, source event ID deduplication |
| Cross-workspace access | Server-side scoped queries; per-resource authorization; negative tests |
| Prompt injection | Treat model response as untrusted data; schema/policy validation before publishing |
| SSRF via HTTP node | Explicit destination allowlist, DNS/IP validation, redirect checks, network-level egress rules |
| Credential exfiltration | Encryption at rest, scoped access, no secrets in logs, frontend or AI prompt |
| Duplicate external effects | Stable idempotency key, ActionLedger, reconciliation/needs_review |
| Guest demo abuse | Per-session isolation, resource quotas, rate limits, expiry and hard egress restrictions |
| Dependency compromise | Lockfiles, dependency review, CI scanning and provenance |

## Security gate
Negative integration tests for every boundary; validate network egress at connection time, not only string/hostname checks. No production visitor credentials or unrestricted outbound HTTP in the demo.
