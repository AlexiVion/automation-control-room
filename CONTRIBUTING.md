# Contributing to Automation Control Room

Automation Control Room is a **working, local-only open-source engineering portfolio project**, currently maintained as a series of draft architecture and implementation pull requests. The documented general workflow editor, connectors and agent features are proposals, **not implemented product functionality**.

Contributions are welcome where they improve correctness, reproducibility, accessibility, documentation or inspectability of the existing demonstration. Product features require a separate scope decision.

## Get started

1. Read [the README](README.md), [portfolio scope](docs/PORTFOLIO_FIRST.md) and [Slice 2 validation guide](docs/phase5/SLICE2.md).
2. Run the demo on Docker Desktop with Linux containers using `scripts/windows-start-slice2.ps1` (from the implementation branch), or run the documented Compose flow on Linux.
3. Reproduce the relevant test before proposing a fix. Use a feature branch and a focused PR.
4. Include tests and update user-facing documentation for behavior changes. Treat external AI/connector effects as disabled until their security controls are implemented.

## Engineering standards

- TypeScript strict checks and Zod parsing at trust boundaries.
- PostgreSQL is the durable source of truth; never replace verified events with fake UI states.
- Maintain workspace isolation and explicit CSRF/Origin checks; approvals are server-authoritative.
- Preserve idempotent effects, retry semantics and exact attempt/retry metrics.
- Run contract/security tests and real database integration tests when touching persistence.
- Keep CI compact: prefer modifying the existing workflow to adding redundant jobs.
- Do not commit credentials, customer data, private business code or proprietary content.
- Check external package, font, image and code licensing before incorporating assets.

## Review / publication boundary

Architecture ADRs labelled **proposed** are not blanket implementation approval. The current application is **not** a publicly hosted product or SaaS. Do not expose its development-only PostgreSQL credentials or deterministic CSRF fixture key on the public Internet.

Production deployment, general AI agent authority, connector egress and merging the stacked draft PRs require explicit owner review. The [portfolio publication gate](docs/portfolio/PUBLICATION_GATE.md) tracks the near-term GitHub/LinkedIn release independently of feature expansion.

## License

Original repository work is provided under [Apache-2.0](LICENSE). Contributors must have the right to license their changes; third-party software and assets retain their own license obligations.
