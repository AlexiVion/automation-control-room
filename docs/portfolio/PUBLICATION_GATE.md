# GitHub + LinkedIn portfolio release gate

**Status: NOT YET PUBLISH-READY AS A DEFAULT-BRANCH LINK.** This is a portfolio publication checklist, **not a product/production release gate**.

## Verified at review — November 4, 2026

- [x] Public repository `AlexiVion/automation-control-room` exists.
- [x] Branch `feat/phase5-slice2-ux-history-20261104` contains a runnable local app with Fastify, Next.js, PostgreSQL and a background worker.
- [x] Owner-provided Windows evidence: `SLICE2_FINAL_WINDOWS_PASS` at `0951e244...`, preserving existing demo DB.
- [x] Last checked branch CI [#41884629235](https://github.com/AlexiVion/automation-control-room/actions/runs/41884629235): **SUCCESS** (documentation-only update after the verified app).
- [x] Reviewed README **25 relative/external links**: no missing repository-relative target in the current branch tree.
- [x] Apache-2.0 LICENSE exists, and the Compose configuration labels its static database/CSRF values as **development-only**, bound to localhost.
- [x] No tracked `.env`, `.pem`, `.p12`, `.pfx` or private-key file was identified by the **filename-only** tree scan. **This is not a comprehensive secret scan or license compliance audit.**

## Must do before pointing external recruiters to the GitHub repository

- [ ] **Default branch mismatch:** `main` still has only an old architecture-phase README and says there is no runnable app. Decide and approve a safe stacked-PR merge strategy after final review; **do not merge automatically**.
- [ ] **Real screenshots:** select and preserve three approved screenshots (finished canvas, scoped history, CRM) from the real product or CI Chromium artifact. No AI-generated UI mockups or stock imagery as execution evidence.
- [ ] **Clean clone:** test the published README commands from a new clone with no cached container images, reused node_modules or preexisting Docker volumes. GitHub CI does check clean source checkout, but that is **not** a proof of a first-time Windows installation.
- [ ] **Trust review:** full secret/static configuration scan (including docs), dependency warnings, basic public-facing accessibility review and license/provenance audit. Local-only dev credentials must never be treated as production-safe.
- [ ] **Video:** 60–90 second continuous, synthetic-only live demo following [storyboard](DEMO_STORYBOARD.md), or explicitly choose screenshots-only for the first post.
- [ ] **LinkedIn assets:** approve accurate caption/Projects blurb and links only after GitHub's default branch shows the verified code.
- [ ] **Owner approval:** decide when to merge and publish; no unauthorised deployment or public hosting.

## Packaging notes

- `docs/portfolio/ARCHITECTURE_AT_A_GLANCE.md` contains a **source-based Mermaid diagram**, so the architecture is inspectable and no image license is required.
- Link to **stable repository paths and verified CI**, not temporary seven-day GitHub artifact downloads.
- Distinguish code visibility (public repo) from service accessibility (localhost only).
- When no hosted demo is available, show the workflow with screenshots/video and clear Docker reproduction instructions.
- Commercial billing, real LLM, general graph editing and third-party connectors are explicitly **not** portfolio publication blockers.

## Final acceptance checklist

**An engineer arriving from LinkedIn should be able to:**
1. Read accurate project scope and stack within 30 seconds of opening the default README.
2. See authentic visual evidence of execution and the architectural boundaries.
3. Clone the published default branch and run a deterministic demo locally.
4. Trace at least one approval and CRM write through the persisted event history.
5. Understand the limitations and find passing CI evidence.

This gate is independent of any future decision to build a commercial product.
