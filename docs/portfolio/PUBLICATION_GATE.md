# GitHub + LinkedIn portfolio release gate

**Status: INTEGRATED RELEASE CANDIDATE, NOT YET MERGED TO DEFAULT BRANCH.** This is a portfolio publication checklist, **not a product/production release gate**.

## Verified at review — November 4, 2026

- [x] Public repository `AlexiVion/automation-control-room` exists.
- [x] Branch `feat/phase5-slice2-ux-history-20261104` contains a runnable local app with Fastify, Next.js, PostgreSQL and a background worker.
- [x] Owner-provided Windows evidence: `SLICE2_FINAL_WINDOWS_PASS` at `0951e244...`, preserving existing demo DB.
- [x] Last checked branch CI [#41884629235](https://github.com/AlexiVion/automation-control-room/actions/runs/41884629235): **SUCCESS** (documentation-only update after the verified app).
- [x] Reviewed README **25 relative/external links**: no missing repository-relative target in the current branch tree.
- [x] Apache-2.0 LICENSE exists, and the Compose configuration labels its static database/CSRF values as **development-only**, bound to localhost.
- [x] No tracked `.env`, `.pem`, `.p12`, `.pfx` or private-key file was identified by the **filename-only** tree scan. **This is not a comprehensive secret scan or license compliance audit.**

## Updated evidence and specific blocker — 2026-11-04

- [x] PR #14 UX code CI [#41894674451](https://github.com/AlexiVion/automation-control-room/actions/runs/41894674451) completed successfully at `dc4f0f13...`. **Owner-provided Windows new-clone acceptance also passed at the same exact head** on 2026-11-04: isolated Compose project `acrverify1104164028`, freshly created Postgres volume, web `http://localhost:3301`, `PRODUCT_SLICE1_E2E_PASS`, history 4/4, canvas 5/5, `SLICE2_WINDOWS_PASS`, `ACR_CLEAN_CLONE_PASS`. Docker reused cached Node layers, so this is a clean source/DB/environment check, not a cache-free build. The UX PR remains draft/unmerged.
- [ ] **Verify license/code provenance:** the repository's `LICENSE`, after trimming leading/trailing whitespace, exactly matches the [Sim Studio upstream LICENSE](https://github.com/simstudioai/sim/blob/main/LICENSE), including `Copyright 2026 Sim Studio, Inc.`. This proves matching license text, **not** that ACR application code was copied. Confirm code/asset origins, ownership, copyright and NOTICE obligations before changing or removing attribution.
- [x] **Preliminary dependency advisory scan (owner Windows, 2026-11-04):** `npm audit --json` executed inside the isolated API container returned `NPM_AUDIT_EXIT=0` and **0 low / 0 moderate / 0 high / 0 critical** advisories. Report saved locally at `C:\Users\alexi\AppData\Local\Temp\ACR-dependency-audit.json` (not uploaded/independently inspected). This is time-specific, not an attestation of all future package versions.
- [x] **Preliminary tracked secret-pattern scan (owner Windows, 2026-11-04):** `git grep -IlE` with patterns for PEM private key headers, GitHub classic/fine-grained tokens and OpenAI-style keys returned **0 flagged tracked files**. This is not a full entropy/history or credential scan; known local-only demonstration secrets are intentionally present in Compose.
- [ ] **Still open:** check third-party license/asset provenance, remaining secret formats/history and correct treatment of the upstream `LICENSE` attribution. Existing CI runs `npm ci --no-audit`; the owner-run advisory scan is outside CI.

See the [source-grounded publication readiness review](READINESS_AUDIT_20261104.md) for an isolated Windows fresh-clone procedure and a precise separation of passed tests from remaining release requirements.
## Must do before pointing external recruiters to the GitHub repository

- [ ] **Default branch mismatch:** created [integrated release PR #15](https://github.com/AlexiVion/automation-control-room/pull/15), from the latest successful UX code head plus eight portfolio documentation files and the committed screenshots. It is a draft targeting `main`; `main` remains the old architecture-only README until merge. Review combined-head CI and obtain final release approval; **do not advertise default branch yet**.
- [x] **Authentic screenshots preserved on release branch:** completed workflow focus with persisted `crm.confirmed`, reloadable history, and a confirmed synthetic CRM row. All three actual PNGs are committed under [`docs/portfolio/media/`](media/) and [their source commit, artifact and SHA-256 checksums are documented](ASSET_PROVENANCE.md). Owner approval for external LinkedIn presentation is separate.
- [x] **Clean clone functional acceptance:** a new Windows checkout of the UX branch passed the launcher and real smoke/unit tests with a new Compose project and Postgres volume (see above). Docker layer cache was reused; a no-cache build was not performed. This validates the UX branch, **not yet the future merged default `main`**.
- [ ] **Trust review (partially complete):** owner-reported npm audit and tracked secret-pattern scan both PASS; full history/entropy/provider-token coverage, dependency licensing/asset origins and repository LICENSE provenance still require explicit review. Local-only dev credentials must never be treated as production-safe.
- [x] **Media scope for first portfolio post:** three verified Chromium screenshots are sufficient; a 60–90 second [video storyboard](DEMO_STORYBOARD.md) is available as an optional follow-up. No video recorded.
- [ ] **LinkedIn assets:** approve accurate caption/Projects blurb and links only after GitHub's default branch shows the verified code.
- [ ] **Owner approval:** decide when to merge and publish; no unauthorised deployment or public hosting.


## Integrated release PR and CI evidence — 2026-11-04

- [x] [UX head CI #41929735160](https://github.com/AlexiVion/automation-control-room/actions/runs/41929735160) passed after the CRM screenshot fix, with real Compose and Chromium evidence at `12211b158e9618e341ebf2cd2fdecc9775610760`.
- [x] [Release PR #15](https://github.com/AlexiVion/automation-control-room/pull/15) combines functional code, UX, documentation and preserved screenshots without changing API/worker/database behavior.
- [x] Three screenshots copied from pinned CI artifact `13370474471` using a one-time workflow and verified SHA-256; the temporary workflow was removed after import. See [asset provenance](ASSET_PROVENANCE.md).
- [ ] Inspect the **combined release branch** CI conclusion after the documentation/media integration. The last observed run before this update was in progress; do not infer success from the base UX run.
- [ ] Run a final default-branch smoke after approval and merge; that has not happened yet.

## Packaging notes

- `docs/portfolio/ARCHITECTURE_AT_A_GLANCE.md` contains a **source-based Mermaid diagram**; all three featured screenshots are original CI-generated PNGs stored in-repo, not stock or AI-generated assets.
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
