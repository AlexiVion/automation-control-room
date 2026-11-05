# Portfolio publication readiness review — 2026-11-04

**Purpose:** close the GitHub + LinkedIn **engineering portfolio** release without inventing product features. This is not a SaaS-production audit or a legal certification.

## Evidence reviewed

- Functional base: [Slice 2 PR #10](https://github.com/AlexiVion/automation-control-room/pull/10); owner's Windows `SLICE2_FINAL_WINDOWS_PASS` at the validated Slice 2 implementation head.
- UX corrections: [draft PR #14](https://github.com/AlexiVion/automation-control-room/pull/14), head `dc4f0f13d4c6103f60ba18a06174cafd30df4080`; [GitHub Actions #41894674451](https://github.com/AlexiVion/automation-control-room/actions/runs/41894674451) completed successfully. Its code gates include Next.js build, product Compose, API smoke and Chromium desktop/mobile UX tests.
- Existing CI checks out source on a disposable Ubuntu runner and exercises PostgreSQL migrations, tests and Docker. **Subsequently, the owner supplied a successful new-clone Windows acceptance at the UX head**, with a fresh Compose project and database volume; cached Docker build layers were reused.
- [Draft PR #13](https://github.com/AlexiVion/automation-control-room/pull/13) contains portfolio documentation, but PR #13 and PR #14 were independently based on the Slice 2 branch; neither is in `main`.
- Examined `.github/workflows/contracts.yml`, `ops/compose/product.yml`, `scripts/windows-start-slice2.ps1`, `package.json`, `.gitignore`, `LICENSE`, `README.md` and the release documentation. Subsequently, the owner reported an `npm audit --json` exit 0 (zero advisories) and an exact-pattern `git grep -IlE` with zero tracked-file hits. These are useful **dated, scoped checks**, not a full credential-history or software-license scan.

## Findings that block recommending the default GitHub link

| Priority | Finding | Required closure |
| --- | --- | --- |
| **P0** | `main` does not yet represent the validated runnable demo. Functional and UX changes, documentation and three screenshots now coexist on [integrated release PR #15](https://github.com/AlexiVion/automation-control-room/pull/15), still draft. | Verify combined-branch CI, resolve attribution concerns, review claims and merge into `main` only after release acceptance. Do not advertise default branch yet. |
| **P0 / provenance** | The ACR `LICENSE` content, after whitespace trimming, **exactly matches** the [Sim Studio upstream LICENSE](https://github.com/simstudioai/sim/blob/main/LICENSE), including `Copyright 2026 Sim Studio, Inc.`. This comparison establishes the license-text match, not the origin of ACR's application code. | Verify code/assets provenance, copyright and NOTICE responsibilities, and obtain owner approval for any proposed license correction. Do **not** silently delete a third-party attribution. |
| **Closed for UX branch** | A new Windows checkout was tested on 2026-11-04 at exact SHA `dc4f0f13...`, with `ACR_CLEAN_CLONE_PASS`, `SLICE2_WINDOWS_PASS`, `PRODUCT_SLICE1_E2E_PASS`, 4 history tests and 5 canvas tests. | Retain evidence; recheck the eventual merged default-branch instructions. Docker used cached dependencies, so no-cache build remains untested. |
| **Advisories/metadata checked; attribution open** | Owner's `npm audit --json` exit 0 and 0 advisories. The current `package-lock.json` has 345 dependency entries with **no missing SPDX license expression**; note 12 MPL-2.0, 10 LGPL-3.0-or-later, and other license combinations. | See [exact license metadata inventory](THIRD_PARTY_LICENSE_INVENTORY.md); upstream license text and redistribution notices require independent review. |
| **Closed for release candidate (owner display review open)** | Three original PNG screenshots captured from the passing Chromium CI at UX head `12211b15...` are committed in `docs/portfolio/media`: completed graph with `crm.confirmed`, saved history after reload and the confirmed synthetic CRM row. | Verify [source SHA, artifact and checksums](ASSET_PROVENANCE.md), confirm owner display approval before LinkedIn. Video is optional. |
| **P2 / docs** | `docs/quality/RELEASE_GATES.md` is a historical Phase 4 proposal claiming web/API/worker do not exist. | Clearly label it historical; point portfolio readers to `docs/portfolio/PUBLICATION_GATE.md`, rather than using the obsolete gate as a current checklist. |

## Safe Windows clean-clone acceptance procedure (executed with equivalent owner command; PASS)

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

**Observed owner's execution:** fresh checkout `C:\Users\alexi\AppData\Local\Temp\ACR-clean-20261104164028`; project `acrverify1104164028`; fresh Postgres volume; frontend `127.0.0.1:3301`; commit `dc4f0f13d4c6103f60ba18a06174cafd30df4080`; all service health checks and smoke PASS, history 4/4 and canvas 5/5. Markers `PRODUCT_SLICE1_E2E_PASS`, `SLICE2_WINDOWS_PASS` and `ACR_CLEAN_CLONE_PASS`. **Caveat:** cached Docker layers reused, no `--no-cache` build; UI still requires manual final review. The test did not delete any existing Docker volume.

## Decision boundary

- **Completed:** Slice 2 product E2E, UX PR #14 code CI, new isolated Windows clone/DB acceptance at the exact UX head (with Docker cache).
- **Integrated but unmerged:** release PR #15 incorporates functional Slice 2, UX PR #14 and docs PR #13; the individual PRs remain draft for traceability. Three original CI screenshots are committed, and README displays them.
- **Open before LinkedIn default-branch publication:** ownership/code/third-party licensing provenance (especially the copied root Apache Appendix), historical secret coverage, final owner UI/LinkedIn text approval and a combined release gate on PR #15. Media and functional UX branch acceptance are done; final default-branch instructions should be retested after merge.
- **Out of scope:** hosted service, commercial billing, arbitrary workflow editor, real LLM and provider connectors.

Source of truth for publication checkboxes: [PUBLICATION_GATE.md](PUBLICATION_GATE.md) and [Issue #12](https://github.com/AlexiVion/automation-control-room/issues/12).
