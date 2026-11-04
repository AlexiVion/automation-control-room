# Gate 4E — Security control primitives (NOT production middleware)

This package provides **tested primitives**, not a deployed security perimeter. All tests run with the same CI as the contract and PostgreSQL reliability spike.

## Included

- **Webhook** HMAC-SHA256: canonical raw bytes, timestamp ±300 s, event ID and constant-time digest check. Replay **deduplication** still belongs to PostgreSQL UNIQUE receipt ingestion (Gate 4D).
- **Guest session**: 256-bit opaque bearer token stored hashed, 30-minute idle/24-hour absolute expiry checks, HttpOnly+Secure cookie builder, origin and CSRF token checks.
- **Workspace permission**: deny-by-default principal/resource matching; guest may operate only in isolated demo workspace. Must be integrated with scoped SQL queries and authenticated principals in Fastify.
- **Secrets**: AES-256-GCM with random nonce, AAD bound to workspace + credential ID, key-versioned envelopes and rewrapping; no production KMS/rotation scheduler is included.
- **SSRF preflight**: exact named HTTPS destination, public IPv4 DNS answers only, no redirects, no userinfo/fragment/port override. **Security is not complete until the actual transport pins the validated IP, verifies TLS hostname/SNI, and applies network-level egress restrictions**.
- **LLM policy**: strict structured output + existing workflow graph validation using server policy; no publish/execute authority.

## Run

```bash
npm ci
npm run typecheck:security
npm run test:security
```

## Explicitly outstanding for security acceptance

Fastify middleware; actual session issuance storage and TTL cleanup; atomic per-workspace quotas and global backpressure; operator auth; scoped Prisma repository queries; secure DNS-to-socket transport; redirect policy in HTTP adapter; CI supply-chain analysis; guest-mode end-to-end cross-session tests; key management in a deployed environment.

See [Threat model](../../docs/security/THREAT_MODEL.md), [Security evidence](../../docs/security/SECURITY_EVIDENCE.md), [Gate 4E issue](https://github.com/AlexiVion/automation-control-room/issues/6).
