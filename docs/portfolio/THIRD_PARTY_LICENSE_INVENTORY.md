# Third-party dependency license inventory — 2026-11-04

**Scope:** the locked npm dependency graph as recorded in [`package-lock.json`](../../package-lock.json) on the integrated portfolio branch. This is an inventory derived from lockfile `packages[*].license` metadata, **not** an automated legal opinion or independent reproduction of every upstream license text. Package entries include optional platform-specific builds and are not a count of packages actually installed on one machine.

| SPDX license expression in lock metadata | Package entries |
| --- | ---: |
| MIT | 236 |
| Apache-2.0 | 41 |
| ISC | 27 |
| MPL-2.0 | 12 |
| LGPL-3.0-or-later | 10 |
| BSD-3-Clause | 7 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| Unlicense | 2 |
| BSD-2-Clause | 1 |
| 0BSD | 1 |
| MIT and ISC | 1 |
| CC-BY-4.0 | 1 |
| EPL-2.0 | 1 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| (MIT OR CC0-1.0) | 1 |
| **Total dependency entries** | **345** |

All **345** locked dependency entries include a license metadata field; that does **not** prove the licenses are compliant or that all transitive notices are fulfilled.

## Packages whose license obligations deserve explicit attention

- **`@img/sharp-libvips-*`**: 10 optional platform binary packages report `LGPL-3.0-or-later`. Four `@img/sharp-win32-*`/`@img/sharp-wasm32` combinations report Apache/LGPL (and optionally MIT). Review distribution, source-offer and linking conditions for any **distributed compiled artifact/container**; the unbundled source repository alone is different from binary distribution.
- **`lightningcss` and its platform builds**: 12 package entries report `MPL-2.0`. Review source-file modification/distribution obligations if distributing binaries.
- **`elkjs`**: 1 entry reports `EPL-2.0`. Review compatibility and distribution notices as applicable.
- **`caniuse-lite`**: 1 entry reports `CC-BY-4.0`. Review required attribution when redistributing its database.

These packages and their metadata are included for transparency; this inventory does not conclude that they are incompatible with Apache-2.0 or that the project violates any terms. A formal release involving shipped binaries, a hosted service or commercial products requires a separately scoped review.

## Independent checks already reported

- Owner executed `npm audit --json` inside the isolated API container, resulting in **0 low, 0 moderate, 0 high and 0 critical** advisories, exit code **0** on 2026-11-04. Audit is time-specific and is not a license scan.
- Owner executed a targeted `git grep` for private-key headers and several token formats on tracked files: **0 matching files**. This does not cover all secrets, binary content or full repository history.
- The root [`LICENSE`](../../LICENSE) text is an Apache-2.0 copy whose Appendix, after whitespace normalization, exactly matches the [Sim Studio repository LICENSE](https://github.com/simstudioai/sim/blob/main/LICENSE), including the line `Copyright 2026 Sim Studio, Inc.`. It is an unresolved **application-code provenance and copyright attribution review**, separate from transitive npm packages. Do not remove third-party attribution by assumption.

## Review status

**Complete:** inventory of the committed npm lockfile metadata; no license field missing; owner-run advisory and targeted tracked-pattern scans recorded; authentic screenshot provenance recorded elsewhere.

**Open:** license text/NOTICE verification against upstream for non-permissive and attribution licenses, ownership/provenance of any reused source or assets, exact `LICENSE` correction if justified, historical secret scanning and final owner acceptance.
