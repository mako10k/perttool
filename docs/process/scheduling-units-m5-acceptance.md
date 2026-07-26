# SU-M5 Atomic Contract 4 Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-07-26
- Accepted contract:
  [temporal and unit interface](../specs/temporal-unit-interface.md)
- Macro plan:
  [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan:
  [../../plans/scheduling-units-m5.pert](../../plans/scheduling-units-m5.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-020`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v2`

## 1. Decision

Accept the atomic public Contract 4 source cutover. Grammar 1, 2, and 3
documents now use one active parser, validator, formatter, mutation, and
safe-write boundary. The public package root exposes AnalysisResult v3,
NextResult v4, UnitMigrationResult v2, exact unit migration, and the retained
Contract 3 capabilities without exposing capability tokens or target-only
helpers.

The typed 28-command registry is authoritative for dispatch, option parsing,
text help, JSON help, and structured recovery. Temporal project, task, and
milestone fields and `project migrate-unit` use source-preserving preview by
default, explicit digest-locked writes, complete JSON identities, and
deterministic text. Guide, README, local-link, and isolated installed-package
workflows describe and exercise the same surface.

A complete known non-truncated NextResult v4 with policy
`recommendation_v1_plus_release_gate` is normal start authority. The
recommended set `R` remains independent from scheduler set `L`; temporal
eligibility gates `R` without intersecting it with `runnable_now`. Unknown,
incomplete, future, or unavailable temporal authority fails closed. Human
override validation consumes NextResult v4 but cannot bypass temporal
eligibility.

There are no open SU-M5 acceptance findings. This acceptance authorizes the
scheduling-and-units macro roll-up and the separate `0.3.0` readiness gate. It
does not itself push Git, create a tag or GitHub release, publish npm, promote
`latest`, or accept the release.

## 2. Public boundary

| Surface | Accepted behavior |
| --- | --- |
| Source | Grammar versions 1, 2, and 3 are accepted through the active public parser and validator; exact Fraction Duration source remains reduced and unrounded |
| Read results | CheckResult v2 and ProjectResult v2 expose declared temporal inputs; AnalysisResult v3 exposes temporal schedules and deadlines; NextResult v4 exposes release-gated start authority |
| Mutation | Project `as_of`, milestone `deadline`, and task `not_before`/`deadline` are available through direct and atomic-batch mutation with common preview and safe-write controls |
| Migration | `project migrate-unit` exposes complete exact inventory, velocity disposition, Decimal-or-Fraction output, no-op, repetition, inverse qualification, grammar upgrade, diagnostics, diff, and write state |
| Discovery | One Contract 4 registry drives 28 commands, options, schemas, effects, examples, text/JSON help, and usage recovery |
| Guidance | Guide and README explain Grammar 3, temporal analysis, start authority, exact migration, `npx`, and `npm exec` without runtime localization |
| Package | The isolated tarball workflow initializes and maintains every entity, analyzes deadlines, selects through Next v4, advances, migrates forward/repeat/inverse, and imports the public Core without target capability exports |

## 3. Interface observation trace

| ID | SU-M5 observation |
| --- | --- |
| `TUI-001` | Active parsing and validation accept Grammar 1/2/3 identities through one public boundary. |
| `TUI-002` | CheckResult v2 and ProjectResult v2 expose exact declared calendar values and retain explicit `as_of`. |
| `TUI-003` | Parser, formatter, mutation, help, and migration use the same canonical field order. |
| `TUI-004` | Public CheckResult v2 and ProjectResult v2 replace their Contract 3 identities atomically. |
| `TUI-005` | AnalysisResult v3 preserves base precedence/resource results and adds separate exact temporal projections. |
| `TUI-006` | Deadline evaluations keep precedence proof, heuristic resource forecast, current-state qualification, and unavailable causes distinct. |
| `TUI-007` | NextResult v4 preserves the complete Recommendation v1 graph and adds a separate temporal authority projection. |
| `TUI-008` | `not_before` changes temporal eligibility and start authority without changing structural readiness or recommendation ranking. |
| `TUI-009` | Direct temporal mutation is source-preserving, preview-first, conflict-checked, and available through the installed CLI. |
| `TUI-010` | Atomic batch accepts explicit temporal fields while automatic unit migration remains one dedicated coordinated operation. |
| `TUI-011` | Public migration owns the complete Duration inventory, exact conversion, and stable fail-closed causes. |
| `TUI-012` | UnitMigrationResult v2 exposes exact records, grammar/unit/velocity dispositions, reversibility, qualifications, candidate data, and write state. |
| `TUI-013` | Migration preview, diff, in-place/out writes, digest locks, symlink/race rejection, and post-write validation reuse common mechanics. |
| `TUI-014` | The active registry exposes exactly 28 Contract 4 commands including `project migrate-unit`. |
| `TUI-015` | Text/JSON help and Guide expose every temporal and migration option, result identity, recovery route, and consumer-safety rule. |
| `TUI-016` | Core, text, and JSON projections are deterministic for identical source and options. |
| `TUI-017` | Absolute temporal tokens survive migration; exact inverse values retain explicit grammar and velocity qualifications. |
| `TUI-018` | Root exports expose public Contract 4 services and types while capability tokens and target-only helpers remain unexported. |
| `TUI-019` | Grammar 3 Decimal-or-Fraction values remain exact through formatting, analysis, mutation, migration, and installed-package use. |
| `TUI-020` | Malformed Fraction or temporal input fails before analysis/migration candidates and never produces a partial write. |

## 4. Example observation trace

| ID | SU-M5 observation |
| --- | --- |
| `TUE-001` | Grammar 1 compatibility and Grammar 2/3 activation are both exercised through public check and package routes. |
| `TUE-002` | Missing temporal anchors return PTSEM-112 without inventing a clock or host timezone. |
| `TUE-003` | Invalid calendar tokens retain exact source spans and suppress temporal results and candidates. |
| `TUE-004` | Leap-day release constraints produce exact release-aware precedence and delayed start authority. |
| `TUE-005` | Equal fixed-offset instants are time-eligible and retain their declared source spelling. |
| `TUE-006` | Mixed date/date-time comparison remains explicitly unavailable and fails start authority closed. |
| `TUE-007` | Date anchors with hour durations retain exact relative facts without implicit calendar promotion. |
| `TUE-008` | Current deadline comparison and forecast evaluation remain separately identified. |
| `TUE-009` | Resource deadline evidence remains heuristic and does not enter Recommendation v1 ranking. |
| `TUE-010` | Blocked work remains structurally blocked with conditional deadline evidence. |
| `TUE-011` | Completed history retains declared deadline facts without inventing actual completion time. |
| `TUE-012` | Point-to-day migration converts the complete inventory exactly and preserves temporal source. |
| `TUE-013` | Hour-to-Point migration inserts an explicit exact replacement velocity and reports the qualification. |
| `TUE-014` | Direction, velocity, same-unit, and invalid-source failures remain stable and expose no partial candidate. |
| `TUE-015` | Non-terminating values emit reduced Fractions and upgrade the same candidate atomically to Grammar 3. |
| `TUE-016` | Same-unit and repeated migration are source- and digest-stable no-ops. |
| `TUE-017` | Forward and inverse conversion restores every Rational value without claiming lexical restoration. |
| `TUE-018` | Public Result v2 JSON and text retain one deterministic semantic record order. |
| `TUE-019` | Decimal and Fraction property tests round-trip exact values without binary floating-point truth. |
| `TUE-020` | Malformed Fraction source fails before conversion and remains unwritable. |

## 5. Acceptance findings closed during integration

The installed-package workflow found that Contract 4 option augmentation had
replaced the existing `task set --clear` values with only temporal fields.
The active descriptor now retains all prior clearable task fields and adds
`not_before` and `deadline`; the file-first tarball workflow exercises
`blocked_reason`.

Plan self-use then found a start-authority defect when the independently
feasible Recommendation set `R` differed from scheduler set `L`. The first
implementation incorrectly intersected `R` with `runnable_now`, producing an
empty startable set. Commit `4cef3e8` makes temporal authority gate `R` only by
time eligibility and adds a regression in which the scheduler chooses a
higher-priority task while Recommendation v1 correctly chooses the driving
task.

## 6. Verification and release handoff

| Gate | Evidence |
| --- | --- |
| Public Grammar 1/2/3 Core and closed target exports | `test/contract4-public-core.test.mjs`, target parser/validator/formatter/mutation tests |
| Temporal schedules, deadlines, exact values, and deterministic failures | temporal TUI/TUE unit and acceptance tests |
| Next v4 authority, R/L independence, unknown/incomplete safe-stop, and override boundary | `test/recommendation-authority-adoption.test.mjs`, `test/target-temporal-analysis.test.mjs`, override tests |
| Registry, dispatch, text/JSON help, Guide, diagnostics, and recovery | command/help/guide/CLI tests |
| Exact unit migration, no-op, repeat, inverse, grammar upgrade, and safe write | unit-migration and write-safety tests |
| README, local link, tarball root, and complete file-first installed workflow | `scripts/check-npm-link.sh`, `scripts/check-package.sh`, `scripts/check-package-file-first.mjs` |
| Documentation, all self-use plans, package normalization, and regression | `npm run check`, `git diff --check` |

The accepted source still identifies the package as `0.2.0`; changing
package, lockfile, CLI/tool version, changelog, and release-source identity to
`0.3.0` belongs to `RELEASE_030_PREPARATION`. After this detail reaches and
advances `CONTRACT4_ACCEPTED`, roll SU-M5 into
`SU_M5_INTEGRATED_ACCEPTANCE` exactly once. Only then may
`RELEASE_030_CONTRACT_4_READINESS` consume the accepted finish.
