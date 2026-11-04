# Portfolio publication readiness review — 2026-11-04

**Purpose:** close the GitHub + LinkedIn **engineering portfolio** release without inventing product features. This is not a SaaS-production audit or a legal certification.

## Evidence reviewed

- Functional base: [Slice 2 PR #10](https://github.com/AlexiVion/automation-control-room/pull/10); owner's Windows `SLICE2_FINAL_WINDOWS_PASS` at the validated Slice 2 implementation head.
- UX corrections: [draft PR #14](https://github.com/AlexiVion/automation-control-room/pull/14), head `dc4f0f13d4c6103f60ba18a06174cafd30df4080`; [GitHub Actions #41894674451](https://github.com/AlexiVion/automation-control-room/actions/runs/41894674451) completed successfully. Its code gates include Next.js build, product Compose, API smoke and Chromium desktop/mobile UX tests.
- Existing CI checks out source on a disposable Ubuntu runner and exercises PostgreSQL migrations, tests and Docker. That is **not** proof that a first-time Windows user can follow the README without prior images, volumes or configuration.
- [Draft PR #13](https://github.com/AlexiVion/automation-control-room/pull/13) contains portfolio documentation, but PR #13 and PR #14 were independently based on the Slice 2 branch; neither is in `main`.
- Examined `.github/workflows/contracts.yml`, `ops/compose/product.yml`, `scripts/windows-start-slice2.ps1`, `package.json`, `.gitignore`, `LICENSE`, `README.md` and the release documentation. This was a targeted file and tracked-path review, **not** a complete secret, dependency or copyright scan.

## Findings that block recommending the default GitHub link

| Priority | Finding | Required closure |
| --- | --- | --- |
| **P0** | `main` does not yet represent the validated runnable demo; development, UX and documentation PRs are stacked or parallel drafts. | Owner-approved merge order; only then link the default branch from LinkedIn. Do not merge without owner approval. |
| **P0 / provenance** | `LICENSE` includes `Copyright 2026 Sim Studio, Inc.` in its final Appendix boilerplate. This may be retained third-party attribution or copied template text; current evidence does **not** establish which. | Verify origin and code/assets provenance, determine correct copyright/NOTICE treatment, and have the owner approve any license changes. Do **not** silently delete a third party's notice. |
| **P1** | No independent first-time **Windows clean clone** is recorded for the post-UX branch. | Run the isolated clean-clone checklist below and preserve the output/commit SHA. |
| **P1** | CI runs `npm ci --no-audit` and has no vulnerability-policy gate. | Review `npm audit` results or equivalent advisory data, document material exceptions, and check third-party licenses; do not equate the Apache-2.0 repository license with a dependency-license audit. |
| **P1** | Authentic screenshots and optional walkthrough are not committed as permanent portfolio media. | Curate three real synthetic-only screenshots from the latest branch and owner-review labels and personal-data exposure. |
| **P2 / docs** | `docs/quality/RELEASE_GATES.md` is a historical Phase 4 proposal claiming web/API/worker do not exist. | Clearly label it historical; point portfolio readers to `docs/portfolio/PUBLICATION_GATE.md`, rather than using the obsolete gate as a current checklist. |

## Safe Windows clean-clone acceptance procedure (not yet executed)

From a PowerShell window with Docker Desktop running in Linux-container mode:

```powershell
$ErrorActionPreference = 'Stop'
$checkout = Join-Path $env:TEMP ('acr-portfolio-clean-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
git clone --branch feat/portfolio-ux-navigation-audit-20261104 --single-branch https://github.com/AlexiVion/automation-control-room.git $checkout
if ($LASTEXITCODE -ne 0) { throw 'CLEAN_CLONE_FAILED' }
Set-Location $checkout
$project = 'acrportfolioclean' + (Get-Date -Format 'MMddHHmmss')
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-start-slice2.ps1 -Port 3301 -Project $project -NoBrowser
if ($LASTEXITCODE -ne 0) { throw 'CLEAN_CLONE_E2E_FAILED' }
git rev-parse HEAD
Write-Host ('CLEAN_CLONE_PROJECT=' + $project)
Write-Host ('CLEAN_CLONE_PATH=' + $checkout)
```

**Safety:** the unique clone directory and Compose project name avoid the existing Slice 2 Docker project/volume. Port 3301 must be free; change `-Port` if needed. The command **does not delete any Docker volume**. A passing run should print `PRODUCT_SLICE1_E2E_PASS` and `SLICE2_WINDOWS_PASS` on the tested UX branch; manually inspect the latest UI afterward.

## Decision boundary

- **Completed:** Slice 2 product E2E, UX PR #14 code CI.
- **Prepared but unmerged:** portfolio PR #13; UX PR #14.
- **Open before LinkedIn default-branch publication:** ownership/license provenance; clean Windows clone; dependency/security/licensing review; permanent screenshots; owner review of messaging; owner-controlled PR integration.
- **Out of scope:** hosted service, commercial billing, arbitrary workflow editor, real LLM and provider connectors.

Source of truth for publication checkboxes: [PUBLICATION_GATE.md](PUBLICATION_GATE.md) and [Issue #12](https://github.com/AlexiVion/automation-control-room/issues/12).
