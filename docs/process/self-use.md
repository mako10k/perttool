# `perttool` self-use plan

- Document status: Active Stage 3 / Revision 2.66
- Creation date: 2026-07-21
- Update date: 2026-08-07
- Related design: [../basic-design.md](../basic-design.md)

## 1. Purpose

Use `perttool` to manage its own development from the point at which it has the minimum read-only functionality.

The initial scope is DSL grammar design and implementation. However, avoid a cycle in which incomplete parsers or formatters are unconditionally applied to the source of truth.

## 2. Separation of sources of truth

| Artifact | Role | Source of truth |
| --- | --- | --- |
| `docs/specs/dsl-grammar.md` | DSL normative grammar, EBNF, examples, and error policy | Markdown document |
| `plans/mvp.pert` | macro milestones and work packages from MVP to beta | `.pert` document |
| `plans/grammar.pert` | Current and future grammar-work DAG | `.pert` document |
| `plans/control-plane.pert` | Current and future DAG for the Issue #1 AI project-control design | `.pert` document |
| `plans/operations.pert` | Current and future DAG from formatter preview through advance | `.pert` document |
| `plans/recommendation.pert` | MIG-01 to MIG-07 implementation/shadow/adoption DAG | `.pert` document |
| `plans/agent-guidance.pert` | provider baseline, Core, `agent help`, and beta-acceptance DAG for Issue #2 | `.pert` document |
| `plans/adapter-platform.pert` | Selected shared adapter architecture, Core and Node boundary, CLI parity, read-only LSP, VSIX DAG view, MCP, and integrated acceptance DAG | `.pert` document |
| `plans/english-baseline.pert` | Post-beta migration of maintained repository surfaces to canonical English | `.pert` document |
| `plans/governance.pert` | Independent post-beta Issue #4 owner-aware goal and DAG mutation governance roadmap | `.pert` document |
| `plans/cli-surface-reset.pert` | Review-derived post-beta CLI/help design, implementation, migration, and acceptance DAG | `.pert` document |
| `plans/release-0.2.0.pert` | Contract 3 version decision, local preparation, authorized distribution, and acceptance DAG | `.pert` document |
| `plans/release-0.3.0.pert` | Contract 4 version gate, accepted implementation input, preparation, authorized PUBLISH, and acceptance DAG | `.pert` document |
| `plans/release-0.4.0.pert` | Contract 5 version gate, accepted governance input, preparation, separately authorized PUBLISH, and acceptance DAG | `.pert` document |
| `plans/release-0.5.0.pert` | Contract 6 version gate, accepted actuals and English-baseline input, preparation, authorized PUBLISH, acceptance, and exact local-install boundary | `.pert` document |
| `plans/release-0.5.1.pert` | Compatible Contract 6 patch self-review, preparation, authorized PUBLISH, and durable acceptance | `.pert` document |
| `plans/release-0.7.0.pert` | Grammar 6 and Contract 7 release gate, accepted ASSURE-001 input, preparation, separately authorized PUBLISH, and durable acceptance | `.pert` document |
| `plans/release-0.7.1.pert` | Compatible Grammar 6 and Contract 7 Help and Guide consistency patch self-review, preparation, separately authorized PUBLISH, and durable acceptance | `.pert` document |
| `plans/release-0.8.0.pert` | Additive adapter-platform, historical-DAG, and declaration-identity beta gate, preparation, separately authorized PUBLISH, and durable acceptance | `.pert` document |
| `plans/help-guide-consistency.pert` | Independent active Guide, command-example, diagnostic-navigation, documentation, symmetry, and acceptance correction | `.pert` document |
| `plans/scheduling-units.pert` | Milestone-level roadmap for temporal properties, deadline capabilities, and unit migration | `.pert` document |
| `plans/scheduling-units-m1.pert` | Task-level detail required only to reach the SU-M1 contract | `.pert` document |
| `plans/scheduling-units-m2.pert` | Completed and advanced task-level detail for target-only temporal source and Core foundations through SU-M2 | `.pert` document |
| `plans/scheduling-units-m2r.pert` | Completed exact rational Duration contract and target-only source/editing extension before SU-M3 and SU-M4 | `.pert` document |
| `plans/scheduling-units-m3.pert` | Completed and advanced temporal deadline and NextResult v4 target Core detail | `.pert` document |
| `plans/scheduling-units-m4.pert` | Completed and advanced exact unit-migration version 2 Core detail | `.pert` document |
| `plans/scheduling-units-m5.pert` | Current atomic public Contract 4 cutover and integrated acceptance detail | `.pert` document |
| `test/fixtures/grammar/` | Specific examples of what parser should accept or reject | fixture/golden |
| Git history | Past plans, specifications, and implementation | commit history |

Do not embed EBNF itself in `plans/grammar.pert` to replace the normative specification.

## 3. Stage 0: bootstrap (completed)

Completed the TypeScript CLI bootstrap and verified `dsl check`, `dag analyze`, `dag next`, and the bootstrap gate.

In Stage 0, requirements and basic design were managed with Markdown, grammar plans were not created in `.pert`, and the state where tools were missing was not considered self-used.

Exit criteria:

- `docs/specs/dsl-grammar.md` reaches implementable granularity
- Minimal valid/invalid fixtures can be reviewed

## 4. Stage 1: read-only self-use

The start conditions were met on 2026-07-21, when the [MVP macro plan](../../plans/mvp.pert) and [grammar detail plan](../../plans/grammar.pert) began to be used as read-only plans of record. The [AI Project Control Plane design plan](../../plans/control-plane.pert) and [operations detail plan](../../plans/operations.pert) were added on 2026-07-22; Stage 2 began that day, and Stage 3 began after operational work completed. The [AI Agent Guidance detail plan](../../plans/agent-guidance.pert) was added on 2026-07-23 as the beta gate after MVP public-alpha acceptance.

On the same date, `english-baseline.pert` was added as an independent post-beta detail plan for the phased migration required by ADR 0004.

On 2026-07-24, `cli-surface-reset.pert` was added as an independent post-beta
plan that maps the completed human/LLM CLI review and all eight CLI/help backlog
items to a dependency-ordered workstream. Creating the plan did not accept CLI
contract 3 or implement any proposed command.

Later on 2026-07-24, `CONTRACT_V3_DESIGN` accepted the requirements, standalone
Contract 3 specification, basic design, migration boundary, and 14 normative
acceptance cases. The 5p task was completed and advanced, establishing the
first plan-specific velocity sample of `5p/1d`; no runtime command changed.

After Contract 3 source acceptance, `release-0.2.0.pert` was added as the ninth
independent plan. Its design gate selected `0.2.0` without changing package
identity and separated local release work from the explicitly authorized
external distribution task.

On 2026-07-25, `scheduling-units.pert` and
`scheduling-units-m1.pert` were added after `TIME-001` and `UNIT-001` were
explicitly selected for refinement. The first plan records only SU-M0 through
SU-M5 work packages. The second records the seven tasks required to accept
SU-M1 and inherits the closest completed contract-design velocity,
`16p/1d`. Later work packages remain provisional until the preceding
milestone supplies accepted semantics and a new detail plan.

Later that day, `TEMPORAL_REQUIREMENTS` fixed the initial temporal extension to
the existing project `as_of` anchor, milestone `deadline`, and task
`not_before` and `deadline`. It kept structural readiness separate from
temporal eligibility, required new grammar and result versions instead of
silently widening version 1, and retained calendar arithmetic, deadline
derivation, migration, interfaces, examples, and cross-cutting review as
dependency-ordered SU-M1 work. The task was completed and advanced through the
Stage 3 safe-write path. Its 3p sample established provisional observed
velocity `3p/1d`; six tasks and 21p remain, with a 17p precedence makespan, a
21p heuristic resource makespan, 4p resource delay, and a 7d resource
forecast. Complete `NextResult.v3` recommends `CALENDAR_SEMANTICS`. The detail
forecast is rolled up to the macro SU-M1 work package, producing provisional
13d precedence and 15d heuristic resource makespans with 2d resource delay.

`CALENDAR_SEMANTICS` then accepted
[`perttool.calendar-projection` version 1](../specs/temporal-calendar.md).
Date values remain civil-day labels without an implicit midnight or time zone;
offset-bearing date-times compare as exact Rational SI-second instants while
retaining their declared offsets. The contract fixes the date/day,
date/hour, date-time/day, and date-time/hour projection matrix; exact point
velocity projection; `not_before` release bounds; mixed-kind and fractional
date unavailability; and the continuous fixed-offset profile without a host
clock, named zones, DST, business calendars, or time-varying resources.
Calendar projection remains separate from Analysis version 1 and cannot
authorize source unit migration. The 4p task was completed and advanced through
the expected-digest Stage 3 path. The same-day cumulative sample is `7p/1d`;
five tasks and 17p remain, with a 13p precedence makespan, 17p heuristic
resource makespan, 4p resource delay, and exact `17/7d` resource forecast.
Complete `NextResult.v3` recommends `DEADLINE_SEMANTICS`. The six-decimal macro
rollup produces `8.428571d` precedence and `10.428571d` heuristic resource
makespans with 2d resource delay.

`DEADLINE_SEMANTICS` then accepted
[`perttool.deadline-evaluation` version 1](../specs/temporal-deadline.md).
It fixes task finish, milestone reach, project finish, current deadline state,
signed margin, precedence lower bounds, heuristic resource forecasts, combined
assessment, blocked-cone qualification, and explicit unavailable causes.
Temporal deadline results remain separate from Analysis version 1, and
Recommendation algorithm version 1 does not rank from deadline data. The 4p
task was completed and advanced through the committed-snapshot and
expected-digest Stage 3 path. The same-day cumulative sample is `11p/1d`;
four tasks and 13p remain,
with 13p precedence and heuristic resource makespans, no resource delay, and
exact `13/11d` forecasts. Complete `NextResult.v3` recommends
`UNIT_MIGRATION_SEMANTICS`. The six-decimal macro rollup produces `7.181818d`
precedence and `9.181818d` heuristic resource makespans with 2d resource delay.

`UNIT_MIGRATION_SEMANTICS` then accepted
[`perttool.unit-migration` version 1](../specs/unit-migration.md). It fixes the
four permitted Point/linked-time directions; declared, replaced, or inserted
effective velocity; the complete base-unit-bearing source-field inventory;
exact Rational conversion; finite-decimal representability; atomic
source-preserving candidates; no-op and repeated behavior; exact inverse
values; and explicit metadata-change and fail-closed qualifications. It does
not infer day/hour conversion or add a public command. The 4p task was
completed and advanced through the committed-snapshot and expected-digest
Stage 3 path. The same-day cumulative sample is `15p/1d`; three tasks and 9p
remain, with 9p precedence and heuristic resource makespans, no resource
delay, and exact `3/5d` forecasts. Complete `NextResult.v3` recommends
`INTERFACE_PROJECTION_CONTRACT`. The macro rollup produces `6.6d` precedence
and `8.6d` heuristic resource makespans with 2d resource delay.

`INTERFACE_PROJECTION_CONTRACT` then accepted
[`perttool.temporal-unit-interface` version 1](../specs/temporal-unit-interface.md).
It keeps grammar version 1 and CLI Contract 3 closed while selecting target
Grammar 2, CLI Contract 4, CheckResult v2, ProjectResult v2, AnalysisResult
v3, NextResult v4, and UnitMigrationResult v1. The contract fixes temporal
field validation and source-preserving mutation, the dedicated
`project migrate-unit` boundary, batch exclusion for automatic migration,
preview/write safety, text/JSON, Guide topics, diagnostics, and the separation
of unchanged recommendation ranking from release-gated start authority.
Runtime activation and Next v4 authority adoption remain later gates. The 4p
task was completed and advanced through the committed-snapshot and
expected-digest Stage 3 path. The same-day cumulative sample is `19p/1d`; two
tasks and 5p remain, with 5p precedence and heuristic resource makespans, no
resource delay, and exact `5/19d` forecasts. Complete `NextResult.v3`
recommends `NORMATIVE_EXAMPLES`. The six-decimal macro rollup produces
`6.263158d` precedence and `8.263158d` heuristic resource makespans with 2d
resource delay.

`NORMATIVE_EXAMPLES` then accepted the
[Normative Temporal and Unit-Migration Examples](../examples/temporal-units.md),
nine target Grammar 2 source fixtures, and
`Perttool.TemporalUnitExampleBaseline.v1`. `TUE-001` through `TUE-018` fix
valid, invalid, unavailable, and not-applicable calendar/deadline cases;
release-gated Next v4 authority; precedence, heuristic-resource, and blocked
qualifications; both migration directions; velocity and finite-decimal
failures; idempotence and inverse behavior; and deterministic text/JSON
ordering. These are target-only witnesses and do not activate Grammar 2,
Contract 4, or NextResult v4 authority. The 3p task was completed and advanced
through the committed-snapshot and expected-digest Stage 3 path. The same-day
cumulative sample is `22p/1d`; one task and 2p remain, with 2p precedence and
heuristic resource makespans, no resource delay, and exact `1/11d` forecasts.
Complete `NextResult.v3` recommends `M1_CONTRACT_REVIEW`.

`M1_CONTRACT_REVIEW` then accepted the
[cross-cutting contract review](scheduling-units-m1-acceptance.md). It traced
all 18 `TUI-*` observations, completed the three-field validation boundaries,
deadline/start-authority state witnesses, and per-field temporal-token
preservation, and resolved the delivery conflict by keeping SU-M2 through
SU-M4 target-only and assigning the atomic public Contract 4 cutover to SU-M5.
The 2p task completed and both the detail and macro were advanced from clean
committed snapshots with expected digests. The detail is complete at a
cumulative provisional `24p/1d`, with no remaining or recommended task.

The SU-M2 detail was then created from that accepted contract by the
preview-first and expected-digest write path. It contains six tasks totaling
24p: target Grammar 2 source, temporal validation, formatter round-trip,
declared-input Core, temporal mutation/batch Core, and cross-cutting
acceptance. Its precedence and heuristic resource makespans are both 21p with
no resource delay. The inherited provisional `24p/1d` velocity yields an exact
`7/8d` forecast, and complete `NextResult.v3` recommends
`GRAMMAR_V2_TEMPORAL_SOURCE`. The active runtime remains Grammar 1 and CLI
Contract 3 throughout this detail; public Contract 4 projections, help, Guide,
package workflows, temporal analysis, Next v4 authority, unit migration, and
publication remain outside SU-M2. Rolling the forecast up once changes the
macro precedence and heuristic resource makespans to `39/8d` and `55/8d`,
retaining 2d resource delay and the macro recommendation
`SU_M2_TEMPORAL_SURFACE_WORK_PACKAGE`.

`GRAMMAR_V2_TEMPORAL_SOURCE` then added an identity-checked internal target
capability, exact declared `CalendarValue` source records, and only milestone
`deadline`, task `not_before`, and task `deadline`. The active
`parseDocument`, formatter, CLI Contract 3 registry, root exports, and
installed-package workflows remain unchanged. Dedicated tests cover Grammar 1
closure, contextual IDs, exact field positions, source tokens and spans,
fractional seconds and offsets, all nine target fixtures, TUE-001, and
TUE-003. All 326 tests, documentation, twelve self-use plans, link checks, and
package inspection passed. The 5p task was completed through an atomic
expected-digest batch together with velocity recalibration to `5p/1d`, then
advanced from commit `43dbf94` with the exact expected source digest
`sha256:6df2f704b50fa2a743bd916227a0c3062d21f72b26239dbfebd6b18cdce297f7`.
Five tasks and
19p remain, both precedence and heuristic resource makespans are 16p with no
resource delay, both forecasts are `16/5d`, and complete `NextResult.v3`
recommends `TEMPORAL_SEMANTIC_VALIDATION`. Rolling that forecast to the macro
produces `36/5d` precedence and `46/5d` heuristic resource makespans with 2d
resource delay.

`TEMPORAL_SEMANTIC_VALIDATION` then added an internal, nominally branded
`TargetValidatedDocument` boundary over the target capability. It accepts
Grammar 1/2, reports field-local `PTSEM-112` for every Grammar 2 temporal
field without `project.as_of`, and retains mixed date/date-time kinds,
date-anchor/hour inputs, and temporal fields on active, done, or reached
history as valid source. It reads no wall clock, host zone, locale, path, or
Git state and does not add projection, start-authority, CLI, help, or public
schema behavior. All 336 tests, documentation, twelve self-use plans, link
checks, and package inspection passed. The 4p task was completed with the
source task through a cumulative `9p/1d` sample, then advanced from commit
`936f372` with the exact expected source digest
`sha256:234c5f566b7c338622615e46c31dcb23ee0e65cff95c7ca8b53200c30b51ed57`.
Four tasks and 15p remain; precedence
and heuristic resource makespans are both 12p with no resource delay, both
forecasts are `4/3d`, and complete `NextResult.v3` recommends
`TEMPORAL_FORMATTER_ROUNDTRIP` while `DECLARED_TEMPORAL_INPUT_CORE` is
resource-feasible and `allowed`. Rolling the detail forecast to six decimal
day precision produces macro precedence and heuristic resource makespans of
`5.333333d` and `7.333333d`, retaining 2d resource delay.

`TEMPORAL_FORMATTER_ROUNDTRIP` then introduced one shared canonical
declaration-field order for the active Grammar 1 and target Grammar 2 parser
profiles and an internal target-only formatter over the target validated
document. The formatter preserves existing field and declaration order,
comments, blank lines, BOM, predominant line endings, and exact `as_of`,
`deadline`, and `not_before` tokens while retaining the ordinary lexical
normalization rules, UTF-16 edits, candidate revalidation, idempotence, and
target-AST equivalence. Malformed temporal source exposes no candidate; all
nine target fixtures and the six TUE-012/TUE-013 temporal field occurrences
round trip, while the active Contract 3 formatter and root exports remain
Grammar 1. All 342 tests, documentation, twelve self-use plans, link checks,
and package inspection passed. The 3p task was completed through an atomic
expected-digest batch together with cumulative velocity recalibration to
`12p/1d`, then advanced from commit `6d40a20` with the exact expected source
digest
`sha256:6bfdfee6d953c4a298249c4af105c077ff11dfd7684e7b31b20ac92cb0f08997`.
Three tasks and 12p remain; the precedence makespan is 9p and the
heuristic resource makespan is 12p with 3p resource delay. The forecasts are
`3/4d` and `1d`, and complete `NextResult.v3` recommends
`TEMPORAL_MUTATION_BATCH_CORE`; `DECLARED_TEMPORAL_INPUT_CORE` is deferred by
the selected task's `TARGET_CORE_SURFACE` use. Rolling the resource forecast
to the macro produces 5d precedence and 7d heuristic resource makespans with
2d resource delay.

`TEMPORAL_MUTATION_BATCH_CORE` then implemented private target task/milestone
temporal add, set, and clear requests over the shared Grammar 2 declaration
order. The capability-checked target application plans localized UTF-16 edits
against one original AST and validates only the final candidate, including
atomic version 1 to 2 anchor/temporal upgrades and complete downgrades. Invalid
calendar values, missing anchors, comment-ownership clears, overlapping or
duplicate targets, and invented migration batch members fail closed. Internal
target safe-write adapters bind the same digest lock, in-place/out,
symlink/race rejection, fsync, and post-write verification mechanics without
changing active Contract 3 APIs, root exports, descriptors, help, or installed
CLI behavior. All 348 tests, documentation, twelve self-use plans, local link,
package dry run, and installed-package file-first gate passed. The 5p task was
completed through an atomic expected-digest batch, recalibrating the cumulative
SU-M2 velocity to `17p/1d`, then advanced from commit `65c8cda` with the exact
expected source digest
`sha256:35d92ed13d050992eb2eb5872eaa5133e17e3b325b8c0b8c47cb15377171d420`.
Two tasks and 7p remain; both precedence and
heuristic resource makespans are 7p with no delay, both forecasts are exact
`7/17d`, and complete `NextResult.v3` recommends
`DECLARED_TEMPORAL_INPUT_CORE`. The six-decimal macro rollup is
`0.411765d`, producing provisional precedence/resource makespans of
`4.411765d` and `6.411765d` with 2d resource delay.

`DECLARED_TEMPORAL_INPUT_CORE` then added internal target CheckResult v2 and
ProjectResult v2 Core projections over one capability-checked target
validation. The check projection exposes exact tagged anchors, milestone
deadlines, and nullable task constraints in source declaration order,
retaining exact source tokens and exact fractional seconds. Syntax failures
and invalid legacy anchors suppress untrusted temporal inputs, while semantic
errors such as a missing anchor retain trusted declared fields and complete
diagnostic counts under truncation. The project projection reuses that check
once, changes `asOf` to the tagged value, derives `finishDeadline` only from
the milestone referenced by `finish`, and returns null project and grammar
metadata for every invalid document. Active CheckResult v1, ProjectResult v1,
CLI Contract 3, root exports, descriptors, help, and installed behavior remain
unchanged. All 355 tests, documentation, twelve self-use plans, local link,
package dry run, and installed-package file-first gate passed. The 3p task was
completed through an atomic expected-digest batch,
recalibrating cumulative SU-M2 velocity to `20p/1d`, then advanced from clean
implementation commit `5dc3390` with the exact expected source digest
`sha256:c78e3e8516c77b66c5fa59b7c0346869dd978a32d69e9caeda2c3a0111f7c61a`.
One task and 4p remain;
both precedence and heuristic resource makespans are 4p with no delay, both
forecasts are exact `1/5d`, and complete `NextResult.v3` recommends
`M2_FOUNDATION_ACCEPTANCE`. The detail forecast rolls up to 0.2d, producing
provisional macro precedence/resource makespans of 4.2d and 6.2d with 2d
resource delay.

`M2_FOUNDATION_ACCEPTANCE` then accepted the
[SU-M2 cross-cutting record](scheduling-units-m2-acceptance.md). The review
traces all `TUI-001` through `TUI-018` and `TUE-001` through `TUE-018`,
malformed input, source preservation, final-candidate batch behavior,
determinism, Contract 3 registry/help/schema identity, package-root exports,
and the actual installed CLI. Active Grammar 1 and all 27 Contract 3 commands
continue to reject Grammar 2; no target Core API is exported from the package
root. The full gate passes 361 tests plus documentation, twelve self-use
plans, local link, dry-run package, and installed file-first checks. Completing
the final 4p recalibrates the one-day SU-M2 sample to `24p/1d`. The completed
detail and macro were then advanced from clean acceptance commit `a51decf`
with expected source digests
`sha256:4173812cbd35ed9cb02e297530b2986126c6b0e78a2ecf1c273902acecf76d17`
and
`sha256:29a266bb0cffec0096409514f495503f5b65c59577e5d1145d013f402e28e18d`.
The final detail digest is
`sha256:c2973ddd7596582d383b071abcb0b405269400c0ef825b93bad57c2627611c68`;
the macro metadata-synchronized digest is
`sha256:cb919310d661d470d78efe8da45da0307ebca08c623eb6cfdce366cb0a3615fb`.
The remaining macro has 4d precedence and 6d heuristic resource makespans with
2d delay. Its scheduler set is SU-M3, while complete Next v3 recommends the
different jointly feasible SU-M4 set. Recommendation section 10 permits this
orthogonality; the self-use shadow no longer imposes the false `recommended
subset of runnable_now` condition.

The user then rejected finite-decimal-only source migration as too incomplete
for common exact values such as `1/3d` and selected an exact fraction Duration
extension. `scheduling-units-m2r.pert` was created through `project init` and
one expected-digest atomic batch rather than manual `.pert` editing. Its seven
tasks total 24p; precedence is 15p and the heuristic resource makespan is 18p
with 3p delay. The inherited provisional `24p/1d` velocity produces exact
forecasts of `5/8d` and `3/4d`. The macro rolls the resource forecast up as
`0.75d`, inserts SU-M2R as the common predecessor of SU-M3 and SU-M4, and now
has `4.75d` precedence and `6.75d` heuristic resource makespans with 2d delay.

`RATIONAL_DURATION_CONTRACT` then accepted
`perttool.temporal-unit-interface@2`, Grammar 3,
`perttool.unit-migration@2`, `Perttool.UnitMigrationResult.v2`, exact
Decimal-or-fraction Duration serialization, atomic source-grammar selection,
and explicit reversibility metadata. The
[acceptance record](scheduling-units-m2r-contract-acceptance.md) traces the
requirements, grammar, migration, interface, mutation, design, and TUI/TUE
observations without activating Grammar 3, Contract 4, or a public migration
command. Commit `c1dec29` provides the exact pre-advance snapshot, so the task
and its prerequisite frontier were advanced through the expected-digest
Stage 3 path.

`RATIONAL_DURATION_SOURCE_MODEL` and `EXACT_DURATION_SERIALIZER` were then
started together from one complete Next v3 selection. The source branch adds
a separate identity-checked Grammar 3 parser and validated-document boundary,
retains Decimal or reduced Fraction Duration values with their exact tokens
and spans, rejects malformed fractions as `PTDSL-007`, and applies existing
suffix, positivity, PERT-order, and temporal-anchor constraints without
widening Grammar 1 or Grammar 2. The serializer branch converts a Rational to
the shortest exact ordinary Decimal when its reduced denominator contains
only factors 2 and 5, otherwise emits a reduced Fraction, and never calls
display-rounding code. Both APIs remain internal and the two tasks are done
in implementation commit `787f0bb`; their tasks and prerequisite frontier
were then advanced through the expected-digest Stage 3 path.

`RATIONAL_DURATION_FORMATTER` and `RATIONAL_DURATION_MUTATION` were then
started together from the next complete recommendation. The separate internal
Grammar 3 formatter emits every exact Duration as the shortest ordinary
Decimal or reduced Fraction while preserving comments, layout, calendar
tokens, and exact Rational semantics; repeated formatting is idempotent. The
Grammar 3 mutation path canonicalizes only changed project/task Duration
values, supports task add/set/estimate and final-candidate grammar
upgrade/return, preserves unrelated source tokens, rejects invented automatic
migration members, and uses the existing digest-locked in-place/out safe-write
mechanics. Grammar 1 and Grammar 2 behavior and public exports remain closed.
Both tasks are done in implementation commit `f0d9a26`; their task edges were
then removed and their reached milestones retained through the expected-digest
Stage 3 advance path required by the temporary ADV-001 procedure.

`RATIONAL_DURATION_VERSION_BOUNDARY` then implemented a pure selection over
the complete canonical generated-token set and an identity-checked target
application that emits either no version edit or one localized Grammar 3
upgrade. It retains Grammar 1/2 for all-Decimal output, never downgrades
Grammar 3, reports grammar disposition, compatibility qualifications, and
reversibility, preserves temporal source, and remains absent from root
exports and Contract 3 behavior. The implementation is committed at
`fa698ca`; the task edge was then removed and the acceptance-input milestone
reached through the expected-digest Stage 3 advance path required by ADV-001.

The detail digest is
`sha256:5ba8eb9d5ec192f2d30568e1c51ebba670c4c496b232e6ad8bb9e965490931bb`.
`RATIONAL_DURATION_ACCEPTANCE` is committed at `29550c5`; its task edge was
then removed and the finish milestone retained through the expected-digest
Stage 3 advance path required by ADV-001. The
[SU-M2R acceptance record](scheduling-units-m2r-acceptance.md) traces
TUI-001 through TUI-020 and TUE-001 through TUE-020, accepts TUE-015 exact
Fraction representation without claiming the SU-M4 migration operation, and
fixes internal composition plus the closed package boundary. All 24p are done
at provisional `24p/1d`; the detail has zero precedence and heuristic resource
makespans and no recommendation.

The committed SU-M2R snapshot was then rolled up once in `a93c129` and the
macro frontier was advanced from that committed state in `b4e891d`. Accepted
semantics re-estimate SU-M3 at 23p (`0.958333d`) and SU-M4 at 25p
(`1.041667d`). The macro now has `2.041667d` precedence and `3d` heuristic
resource makespans with `0.958333d` delay. Complete Next v3 recommends SU-M4,
while the separate scheduler `runnable_now` set contains SU-M3.

`scheduling-units-m4.pert` was created through `project init`, one
expected-digest atomic batch, and a metadata-safe `project set`; no `.pert`
declaration was authored manually. Its six tasks total 25p. Precedence is 21p,
the heuristic resource makespan is 25p with 4p delay, and the inherited
`24p/1d` velocity produces exact forecasts `7/8d` and `25/24d`. Complete Next
v3 recommends `MIGRATION_REQUEST_AND_INVENTORY`. The detail keeps the
unit-migration version 2 request, exact conversion, candidate, result,
no-op/repetition/inverse, and acceptance work internal until SU-M5.

`MIGRATION_REQUEST_AND_INVENTORY` then added a pure internal request and
inventory Core plus a capability-checked application boundary. It selects the
declared, semantically equal, replaced, or inserted exact velocity; keeps
same-unit requests without replacement as no-ops; rejects malformed
replacement velocities, unsupported day/hour directions, missing velocity,
period mismatch, and same-unit velocity changes with stable causes mapped to
`PTMIG-401` through `PTMIG-407`, while retaining `PTMIG-408` as reserved. The
declaration/field-order inventory covers project epsilon/target and every
deterministic or three-point task Duration for Grammar 1, 2, and 3, independent
of task status. Absolute `as_of`, `deadline`, and `not_before` source tokens
are captured for later candidate-preservation checks, and an unknown future
base-unit field fails closed. The internal modules remain absent from root
exports and the 27-command Contract 3 registry. The 4p first-day sample
recalibrates velocity to `4p/1d`; 21p remain with 17p precedence, 21p
heuristic resources, 4p delay, forecasts `17/4d` and `21/4d`, and complete
Next v3 recommends `EXACT_UNIT_CONVERSION`. Implementation commit `163e1bd`
then satisfied ADV-001; canonical advance removed the completed task and
predecessor milestone, retained `MIGRATION_REQUEST_READY` as reached, preserved
the ready/recommended sets, and cleared `PTDAG-208`.

`EXACT_UNIT_CONVERSION` then added the pure ordered conversion layer. It uses
only reduced Rational multiplication and division with the prepared positive
velocity, records exact original and converted values with source and target
units, reuses the accepted shortest-Decimal-or-reduced-Fraction serializer,
and feeds every generated token into the existing Grammar 1/2/3 retention or
upgrade decision. TUE-012, TUE-013, and TUE-015 fix Decimal, inserted-velocity,
and Fraction-upgrade results; no-op, malformed prepared input, deterministic
composition, ordering, positivity, PERT ordering, and exact inverse probes
keep calendar projections and display precision out of the algorithm. The
module remains internal and absent from the root API. The cumulative 8p
first-day sample recalibrates velocity to `8p/1d`; 17p remain with 13p
precedence, 17p heuristic resources, 4p delay, forecasts `13/8d` and `17/8d`,
and complete Next v3 recommends `UNIT_MIGRATION_CANDIDATE`. The task remains
done until implementation commit `e442ea9` satisfies ADV-001. Canonical
advance then removes the completed task, retains both
`MIGRATION_REQUEST_READY` and `EXACT_CONVERSION_READY` as reached because the
result branch still starts from the request frontier, preserves the
ready/recommended sets, and clears `PTDAG-208`.

`UNIT_MIGRATION_CANDIDATE` then added the internal application service that
composes request preparation and exact conversion without publishing a batch
member or command. It plans grammar version, `duration_unit`, velocity
retention/replacement/insertion, and every inventoried Duration against the
one original target AST as non-overlapping UTF-16 edits; applies one
in-memory candidate; validates only that final Grammar 1/2/3 candidate; and
checks the selected grammar, exact canonical Duration order, retained
velocity bytes or canonical replacement, and every absolute temporal token
before returning SHA-256 digest, unified diff, edits, and source. TUE-012,
TUE-013, and TUE-015 cover retained, inserted, and Grammar 3 upgrade cases;
failure, no-op, determinism, BOM, edit replay, and existing target safe-write
tests keep partial candidates and Contract 3 exposure closed. The cumulative
13p first-day sample leaves 12p, with 8p precedence, 12p heuristic resources,
4p delay, forecasts `8/13d` and `12/13d`, and complete Next v3 recommends
`MIGRATION_NOOP_REPEAT_INVERSE`; `UNIT_MIGRATION_RESULT_V2` remains
resource-deferred.

`MIGRATION_NOOP_REPEAT_INVERSE` then accepted the candidate service's
round-trip behavior without adding a new runtime surface. TUE-016 repeats a
completed target and receives the same source, digest, and empty edits/diff
without rescaling. TUE-017 performs Point-to-day-to-Point and compares every
parsed Rational, semantic velocity, non-timing field, absolute temporal token,
standalone comment, and blank line; the original `4.00p` returns canonically
as `4p`. TUE-015 proves an exact-Fraction forward migration retains Grammar 3
and reports `grammar_version_retained_on_inverse`. An inserted-velocity round
trip restores all original Duration values while retaining the new velocity;
the forward result supplies `values_exact_metadata_changed` and
`velocity_inserted`, and the corresponding replacement case records
`velocity_replaced`; their history-free inverses do not invent provenance. The
cumulative 17p first-day sample leaves 8p; precedence and heuristic resource
makespans are both 8p with no delay, both forecasts are `8/17d`, and complete
Next v3 recommends `UNIT_MIGRATION_RESULT_V2`. The candidate and round-trip
implementation is committed at `b8da602`; canonical expected-digest advance
then removes both task edges and the exact-conversion/candidate intermediate
milestones while retaining `MIGRATION_REQUEST_READY` and
`MIGRATION_ROUNDTRIP_READY` as the two reached frontiers. Reanalysis preserves
the ready/recommended result task and clears both `PTDAG-208` warnings.

`UNIT_MIGRATION_RESULT_V2` then added the internal schema projection over the
accepted candidate. It fixes `Perttool.UnitMigrationResult.v2`, projects the
algorithm identity and grammar/unit dispositions, removes the request-only
velocity token and token classification, emits exact unit-bearing effective
velocity and converted fields, preserves reversibility, qualifications,
complete causes, candidate data, diagnostics, and deterministic invalid
results, and attaches only a matching target safe-write outcome. Dedicated
tests cover TUE-012, no-op, Grammar 3 upgrade, failure determinism, root-export
closure, and digest-matched writes. No JSON/text adapter, CLI envelope, help,
registry, or installed workflow is added. The cumulative 21p first-day sample
leaves only the 4p acceptance task; precedence and heuristic resource
makespans are both 4p with no delay, both forecasts are `4/21d`, and complete
Next v3 recommends `M4_UNIT_MIGRATION_ACCEPTANCE`. The task is done but
committed at `94d4e11`; canonical expected-digest advance then removes the
completed result branch and retains `M4_ACCEPTANCE_INPUT_READY` as the reached
frontier. Reanalysis clears both `PTDAG-208` warnings while preserving the
ready and recommended acceptance task.

`M4_UNIT_MIGRATION_ACCEPTANCE` then accepted the complete internal migration
version 2 Core and recorded the
[SU-M4 acceptance evidence](scheduling-units-m4-acceptance.md). The record
traces TUI-001 through TUI-020 and TUE-001 through TUE-020, with direct
migration witnesses for TUE-012 through TUE-017. Cross-layer tests add an
exact Rational/velocity property matrix, the complete stable cause/code map,
full Result v2 composition, and Contract 3 root/registry/help/Guide rejection.
Existing suites retain malformed input, UTF-16/source/BOM preservation,
digest, race, symlink, in-place/out, no-op, repeat, inverse, and deterministic
candidate evidence. All six tasks and 25p are done at cumulative `25p/1d`;
the detail has zero precedence and heuristic resource makespans and no
recommendation. The final acceptance snapshot is committed at `bc75b37`; the
expected-digest advance retains only reached `UNIT_MIGRATION_ACCEPTED`. The
macro SU-M4 work package is rolled up once in commit `4101ef7` and then
advanced to reached `UNIT_MIGRATION_ACCEPTED`. Fresh complete macro Next v3
recommends `SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE`; the remaining
precedence and heuristic resource makespans are both `1.958333d` with no
resource delay. SU-M5 owns the atomic public Contract 4 cutover; publication
remains separately authorized.

`M3_DEADLINE_ACCEPTANCE` then accepted the complete internal temporal deadline
and NextResult v4 target Core and recorded the
[SU-M3 acceptance evidence](scheduling-units-m3-acceptance.md). The record
traces TUI-001 through TUI-020 and TUE-001 through TUE-020 across exact
calendar input, release-aware precedence, release-aware heuristic resource
scheduling, deadline evaluation, target AnalysisResult v3/NextResult v4,
malformed input, blocked qualification, completed-history unavailability,
determinism, and the Contract 3 root/registry/help/Guide/package boundary.
The accepted Next v4 retains the complete Recommendation version 1 graph,
applies only the temporal release gate to `runnable_now`, and fixes
`deadline_facts_used_for_ranking=false`. All six tasks and 23p are done at
`23p/1d`; the detail has zero precedence and heuristic resource makespans and
no recommendation. The acceptance snapshot is committed at `9c61bac`, and
the expected-digest advance retains only reached
`DEADLINE_CAPABILITIES_ACCEPTED`. SU-M5 owns the atomic public Contract 4
cutover and remains separately gated from release publication.

Starting conditions:

- `perttool dsl check <file>` works
- Can parse project, resource, milestone, task, gate
- Can detect duplicate ID, undefined endpoint, self-loop, cycle, finish unreachable
- `perttool dag analyze <file>` can calculate expected, float, resource schedule
- `perttool dag next <file>` returns active/ready/runnable_now/blocked_now/upcoming
- Text and JSON fixture tests pass

Actions performed at start:

1. Created `plans/grammar.pert` manually
2. Ran `perttool dsl check plans/grammar.pert`
3. Ran `perttool dag analyze plans/grammar.pert`
4. Ran `perttool dag next plans/grammar.pert`
5. Added those three commands to CI required checks through `npm run check:self-use`
6. Recorded check/analyze/next projections in the [grammar golden](../../test/golden/self-use/grammar.expected.json) and [MVP golden](../../test/golden/self-use/mvp.expected.json)

Mechanical results at start:

- precedence makespan: 8d
- resource-constrained makespan: 10d
- ready: `ERROR_RECOVERY`, `FIELD_FIXTURES`, `BLOCK_TEXT_SPANS`
- runnable_now: `ERROR_RECOVERY`, `BLOCK_TEXT_SPANS`
- `FIELD_FIXTURES` is waiting for resource because `GRAMMAR_REVIEW` temporarily acquires `ERROR_RECOVERY` capacity 1 first.

After Point/velocity was introduced on 2026-07-21, the initial target, `plans/grammar.pert`, was migrated to `duration_unit point`. The existing 10d resource baseline was used as the initial calibration, `velocity 10p/10d`. The PERT/CPM baselines, 8p/10p, were kept separate from the velocity forecasts, 8d/10d, and both were fixed in the golden file. The plan was recalibrated from completed work on 2026-07-22; see "Velocity measurement calibration" in this section.

On the same day, `ERROR_RECOVERY` was completed. Fixtures and CLI E2E tests fixed handling of multiple syntax errors, phase suppression, and the diagnostic limit. Completed tasks remain `done` until the not-yet-implemented advance operation can safely compress them. The remaining plan was 7p for both precedence and resources, with a velocity forecast of 7d; `FIELD_FIXTURES` and `BLOCK_TEXT_SPANS` were both next and runnable concurrently.

Next, `FIELD_FIXTURES` was completed. One valid fixture covers every project/resource/milestone/task/gate field. Invalid fixtures for Identifier, string, duration, velocity, date, list, integer, enum, and inline comments, plus the boundaries for missing, duplicate, and incompatible field combinations, were fixed as independent inputs. The omitted `PTDSL-011` specified in the documentation was corrected, and `#` was distinguished from inline comments in quoted strings, tag lists, and block text.

Next, `BLOCK_TEXT_SPANS` was completed. Decoded block-text values preserve common indentation, blank paragraphs, tabs after the common indentation, and trailing spaces. `FieldNode.valueSpan` remains the `|` marker; a UTF-16-code-unit `contentSpan` was added; and leading/trailing blanks remain CST trivia. The remaining plan was 5p for both precedence and resources, with a 1d forecast at the latest observed velocity. `FORMATTER_IMPLEMENT` and `HELP_FIXTURE_SYNC` were next, ready, and `runnable_now`; only the former was precedence- and resource-critical.

`FORMATTER_IMPLEMENT` was then completed. The pure `formatDocument` Core returns UTF-16 `TextEdit` values and a revalidated candidate for a valid document. It aligns HSPACE acceptance with the EBNF and normalizes syntax spacing, Decimal, String, TagList, block common indentation, and the trailing newline, while preserving declaration/field order, comments, blanks, decoded block text, BOM, and the predominant line ending. The remaining precedence makespan was 2p; the resource makespan, accounting for `GRAMMAR_REVIEW` capacity, was 3p; and observed-velocity forecasts were `2/5d` and `3/5d`, respectively. `FORMATTER_ROUNDTRIP` was critical and `runnable_now`; `HELP_FIXTURE_SYNC` was ready but excluded from `runnable_now` by resource rejection caused by reviewer contention.

Next, `FORMATTER_ROUNDTRIP` was completed, adding a source fixture and canonical golden covering every declaration/field, comments, blanks, block text, non-canonical HSPACE, Decimal, String, and TagList. Automated checks cover golden formatting output, no edits on reformatting, and AST equivalence by exact value excluding source tokens and spans. Only `HELP_FIXTURE_SYNC` remained, at 1p for both precedence and resources, with an observed-velocity forecast of `1/5d`; it became the sole ready, critical, and `runnable_now` task, and its completion established grammar acceptance.

Finally, `HELP_FIXTURE_SYNC` was completed. The registry gained unregistered project, resource, milestone, string, text, tag, comment, and top-level help topics referenced by parser/validator diagnostics, along with the gate topics required by the basic design. Automated checks cover related links for every registry topic, stable `.pert` references and parser acceptance for syntax/sample topics, and diagnostic `helpTopic` resolution for every invalid parser fixture. All 13p of the grammar plan are done, and the remaining makespan and ready tasks are 0. In the macro plan, `GRAMMAR_WORK_PACKAGE` is also done; the next critical and `runnable_now` task is `M1_ROADMAP_UPDATE`, which establishes the operations roadmap.

On 2026-07-22, [Issue #1 “Evolve `dag next` into an AI project-control API”](https://github.com/mako10k/perttool/issues/1) was reflected in the macro plan. Without inventing functional dependencies, `CONTROL_PLANE_DESIGN_WORK_PACKAGE` and `GRAMMAR_WORK_PACKAGE` were made parallelizable and their acceptance converged at `FOUNDATION_INPUTS_ACCEPTED`. Immediately after Issue #1 design acceptance, the control-plane work package was done; the only remaining ready and critical macro work package was `GRAMMAR_WORK_PACKAGE`. After grammar acceptance, formatter and later work cannot become ready until `M1_ROADMAP_UPDATE` fixes the operational detail plan.

[AI project-control design plan](../../plans/control-plane.pert) decomposes Issue #1's design scope into points and a velocity forecast. In addition to `VISION_REQUIREMENTS` and `RECOMMENDATION_MODEL`, `RANKING_POLICY` fixes the selection horizon, complete tie-break, and joint-feasible recommended set in the [Ranking Policy specification](../specs/recommendation-ranking.md); `REASON_CODE_TAXONOMY` fixes stable codes, effect/role, typed fact categories, and entity references in the [Reason Taxonomy specification](../specs/recommendation-reasons.md); `STRUCTURED_EXPLANATION_MODEL` fixes typed facts, restricted expressions, comparisons, decision traces, and description projections in the [Structured Explanation specification](../specs/recommendation-explanation.md); `INTERFACE_CONTRACT` fixes the Core type, complete JSON, text summary, and `NextResult.v3` migration in the [Recommendation Interface Contract specification](../specs/recommendation-interface.md); and `HUMAN_OVERRIDE_CONTRACT` fixes feasible replacements, human reasons, Git audit artifacts, single use, and reanalysis in the [Recommendation Human Override Contract specification](../specs/recommendation-override.md). `NORMATIVE_EXAMPLES` fixes the critical-versus-priority distinction, unlocks, gate neighborhoods, parallel recommendations, selected/active-only blockers, the empty set, structured descriptions, and the human-override boundary in the [Recommendation example](../examples/recommendation.md). `PROCESS_MIGRATION` fixes the path from Core to v3 publication, shadow evaluation, normal authority, and the gate through override apply in the [Recommendation implementation/self-use migration](recommendation-migration.md). The final `DESIGN_REVIEW` was completed by verifying cross-cutting consistency in the [design acceptance record](recommendation-design-review.md). All 17p are done, the remaining resource makespan and velocity forecast are 0, and there are no ready tasks. The 1p `DESIGN_REVIEW` task that was incomplete at calibration is carried into the next sample. Check/analyze/next projections are fixed in the [control-plane golden](../../test/golden/self-use/control-plane.expected.json).

On the same day, [Issue #2 "Add AI Agent Guidance Registry and provider-specific help"](https://github.com/mako10k/perttool/issues/2) was registered as an independent feature. Whereas Issue #1 addresses "what should be done now," Issue #2 addresses how to present provider-specific prompts, skills, agents, hooks, and similar guidance for following that decision. Its initial scope is offline, read-only `agent help`; audit, scaffolding, and hook enforcement are later stages. Issue #2 is not a predecessor of M1; it remains an independent backlog that may run in parallel only within capacity that does not delay the operations track.

On the same day, [Issue #3 "Integrating backlog hierarchy and multi-plan PERT composition"](https://github.com/mako10k/perttool/issues/3) was registered as a future concept. Its design scope covers Product/Sprint Backlogs, Sprint PERT, and macro/detail PERT ownership, links, roll-ups, and include/reference. It remains an independent backlog that adds no functional dependency to grammar version 1 or the MVP operations track.

In `M1_ROADMAP_UPDATE`, we created the [operations detail plan](../../plans/operations.pert), allocating formatter preview 3p, mutation preview 9p, safe write 6p, and advance 6p to concrete modules/files, acceptance criteria, narrow tests, and parallel availability. Because the operations track had no completed sample, it provisionally inherited the latest observed `3p/1d` velocity from the closely related grammar implementation work. Precedence and resource makespans were both 21p, with a 7d forecast. `TASK_MUTATION_CORE` was the first critical and `runnable_now` task; `FORMAT_APPLICATION`, with 6p float, was also `runnable_now`. The macro makespan was 17d with 0d resource delay, and `MUTATION_PREVIEW` and `FORMATTER_CORE` were runnable concurrently.

Next, `TASK_MUTATION_CORE` was completed. Using the [Mutation Semantics specification](../specs/mutation.md) as the source of truth, we implemented a pure library Core that returns task add/set/remove/finish operations as localized, non-overlapping UTF-16 `TextEdit` values against source spans, together with a revalidated candidate, SHA-256 digest, and deterministic unified diff. Dedicated tests fix comment ownership, BOM, predominant line ending, trailing trivia, duration/estimate switching, local tag/requirement updates, and suppression of invalid candidates; I/O and CLI exposure were not added. Because the first 4p operations sample was completed in one Asia/Tokyo active day, velocity was recalibrated to the observed `4p/1d`. The remaining precedence/resource makespan was 17p, the forecast was `17/4d`, the next critical and `runnable_now` task was `ENTITY_MUTATION_CORE`, and the parallelizable non-critical task was `FORMAT_APPLICATION`. The macro resource makespan was `59/4d`.

Then, `ENTITY_MUTATION_CORE` was completed. Milestone/resource add/set/remove operations were integrated into the same source-preserving path as tasks, preserving comment ownership, unrelated fields, existing resource tags, and declaration order. To close the specification gap in which a single milestone addition cannot create a valid intermediate DAG, we added a batch contract that plans multiple atomic mutations against original spans and validates only the final candidate. Tests fix connected milestone addition, path replacement, and simultaneous addition of a resource and task requirement; candidate diagnostics reject destruction of standalone references, isolated milestones, and capacity reductions. The same-day operations sample reached a cumulative 7p/1 active day, and velocity was recalibrated to `7p/1d`. The remaining precedence makespan was 15p (`15/7d`), the resource makespan 16p (`16/7d`), and the resource delay 1p. The macro used deterministic rounding to six decimal days, yielding a makespan of `13.428572d`. Its critical path was `FORMATTER_CORE`; in the detail plan, `FORMAT_APPLICATION` was precedence-critical and `MUTATION_CLI_PREVIEW` schedule-critical, and both were `runnable_now`.

Using Developer capacity 2, `FORMAT_APPLICATION` and `MUTATION_CLI_PREVIEW` were completed in parallel by an agent in a separate worktree. The formatter projected the revalidated candidate, UTF-16 `TextEdit`, digest, and diff into a pure application result. The mutation CLI exposed task/milestone/resource actions and atomic batches as a default candidate or `--diff`, in text/JSON; it handles BOM and stdin separately, hides candidates on error, retains the JSON candidate under warning policy, accepts document IDs and preview summaries, and fixes these behaviors in tests. The write option remained a usage error. The same-day sample became a cumulative 10p/1 active day; the remaining precedence/resource makespan was 14p, the forecast 1.4d, and resource delay 0p. The macro makespan was 12.8d, and the next detail task, `FORMAT_CLI_PREVIEW`, corresponding to macro `FORMATTER_CORE`, was precedence/schedule-critical and `runnable_now`.

Then completed `FORMAT_CLI_PREVIEW`. `dsl format` exposes the default candidate, `--diff`, `--check`, text/JSON, and stdin while preserving the BOM and raw-byte digest. When candidate generation succeeds, it retains the JSON candidate, diff, and UTF-16 TextEdits even if `--check` or `--warnings-as-errors` makes CLI `ok=false`; invalid input exposes none of them. `--write`, `--out`, and `--expect-digest` remain usage errors and do not modify the source. The same-day operations sample totaled 12p/1 active day, yielding observed velocity `12p/1d`. The remaining precedence/resource makespan was 12p, the forecast was 1d, and resource delay was 0p. The macro makespan was 12.5d; macro `WRITE_SAFETY` and detail `SAFE_WRITE_ADAPTER` were precedence/schedule critical and `runnable_now`.

Then, `SAFE_WRITE_ADAPTER` was completed. The raw-byte document reader is shared with the CLI. In-place replacement rejects symlinks and non-regular files; verifies digests immediately before the initial, expected, and commit stages; confirms path identity; inherits mode; uses an exclusive temporary directory, file fsync, atomic rename, and parent-directory fsync; and revalidates the digest/document after rename. New output is published as an exclusive hard link from the fsynced temporary; overwriting an existing target, symlink, or concurrent writer is refused. CLI write options remained usage errors and Stage 2 had not yet begun. The same-day samples totaled 16p/1 active day, with observed velocity `16p/1d`. The remaining precedence/resource makespan was 8p, the forecast 0.5d, and resource delay 0p. The macro makespan was 12.125d; macro `WRITE_SAFETY` and detail `SAFE_WRITE_ACCEPTANCE` were precedence/schedule-critical and `runnable_now`.

Then, `SAFE_WRITE_ACCEPTANCE` was completed. `dsl format` and task/milestone/resource/batch mutations retain their default previews while connecting explicit `--write`, exclusive `--out`, and `--expect-digest` to a common safe-write path. A no-op write does not replace the file after the lock check and returns `written=false`; conflicts return stable reason `PTIO-501` with exit 5. CLI/E2E tests using only temporary copies fix races, symlinks, existing targets, preservation of the original on warning/invalid failure, exact round-tripping of the grammar plan, and check/analyze/next after writing. Once the gate was established, the completed state of `plans/operations.pert` was reflected in the source of truth for the first time by using `--write` with an expected digest after inspecting the preview diff. The operations sample reached 18p/1 active day, observed velocity was `18p/1d`, 6p of advance work remained, and the forecast was `1/3d`. Macro `WRITE_SAFETY` was done, its remaining makespan was 12d, `MERMAID_PROFILE` was precedence/schedule-critical and `runnable_now`, and `ADVANCE` was ready but waiting on a `REVIEWERS` conflict.

Then completed `MERMAID_PROFILE`. The [Mermaid Profile specification](../specs/mermaid-profile.md) fixed the complete semantic record, canonical JSON, metadata/projection SHA-256, stable node/edge mapping, fail-closed import, plain-import loss codes, and security boundaries after default application. The [normative example](../examples/mermaid-profile.md) fixed the source DSL, record count, canonical JSON, and both digests in contract tests, while help distinguished designed profiles from unimplemented commands. `plans/mvp.pert` was updated with `task finish --write` after checking the preview diff and expected digest. The remaining precedence/resource makespan was 10d and resource delay was 0d. Both `ADVANCE` and `MERMAID_EXPORT` were ready and `runnable_now`, but `MERMAID_EXPORT` was precedence/schedule critical.

Then completed `MERMAID_EXPORT`. `exportMermaid` generated all semantic records, canonical decimal/velocity, stable projection, metadata/projection digest after applying default, and `dag render --to mermaid` exposed profile/plain, precedence/resource annotation, capacity override, text/JSON, `PTCNV-206`, `--strict-loss`, exclusive `--out`. After matching the Core bytes to the normative artifact and inspecting the unit, CLI, E2E, link, and package checks, we checked the preview diff and `sha256:38b2337f81702d6e93e00819c72c6a33d189ad343969a561a033b3ecaa5db626` for `plans/mvp.pert`, then ran `task finish --write`. The remaining precedence makespan was 7d, the resource makespan was 7.333333d, and resource delay was 0.333333d. `ADVANCE` and `MERMAID_ROUNDTRIP` on the precedence critical path were ready, but priority-20 `ADVANCE` acquired `REVIEWERS` capacity 1 first, so only `ADVANCE` was `runnable_now`. In the detail plan, `ADVANCE_PLANNER` was the only ready, precedence/schedule-critical, and `runnable_now` task. Because the Mermaid macro was a day estimate rather than a Point result, the operations velocity sample remained `18p/1d`.

Then completed `ADVANCE_PLANNER`. The pure `planAdvance` Core determines the canonical keep/remove set from effective reached state and removes past edges and unnecessary milestones through source-preserving `TextEdit`s. Completed tasks and satisfied gates entering unreached joins are retained with the reason `partial_satisfaction`, and the retained root is converted to an explicit `state reached`. Dedicated tests fix candidate reinspection; effective reached state, task classification, and residual-analysis input before and after the change; agreement with project completion; an empty edit on re-execution as a postcondition; partial joins; a completed project; BOM/CRLF; and invalid input. CLI and filesystem writes were intentionally deferred to subsequent tasks. After checking the preview diff and `sha256:ed7a1e02bc22cd076a52f11f0d2df69b2b5e92e0b9cc536992fc472f48cc5f93`, `plans/operations.pert` was completed with `task finish --write`. The same-day operations sample was cumulative 22p/1 active day, with observed velocity `22p/1d`; the remaining `ADVANCE_CLI_ACCEPTANCE` work was 2p, with a `1/11d` forecast. Macro `ADVANCE` rolled its remaining work up to 0.090909d; remaining precedence makespan was 7d, resource makespan was 7.090909d, and resource delay was 0.090909d. The detail plan's only ready, precedence/schedule-critical, `runnable_now` task was `ADVANCE_CLI_ACCEPTANCE`.

Finally completed `ADVANCE_CLI_ACCEPTANCE`. `dag advance` exposes the default candidate, `--diff`, advance-specific JSON, the deleted task/gate/milestone lists, and before/after comparisons of frontier and ready tasks, and connects to the same atomic `--write`, exclusive `--out`, and `--expect-digest` controls as the other editing commands. E2E tests fix the path from a partial-join preview through check/analyze/next, a digest-guarded write to a temporary copy, and a no-op on re-execution. All 158 tests, documentation, four self-use plans, link checks, and package inspections passed. After checking their preview diffs and initial digests, `plans/operations.pert` and macro `ADVANCE` were completed with `task finish --write`. The same-day operations sample totaled 24p/1 active day with observed velocity `24p/1d`; remaining work and forecast were 0. Macro remaining precedence and resource makespans were both 7d, resource delay was 0d, and the only ready, `runnable_now`, precedence/schedule-critical work package was `MERMAID_ROUNDTRIP`. Establishing this gate moved the workflow to Stage 3.

Then completed `MERMAID_ROUNDTRIP`. `importMermaid` and `dag import --from mermaid` fail closed while validating the profile's canonical JSON, record order, metadata/projection digests, semantic model, and projection correspondence, then restore canonical DSL. Plain input converts only a limited subset, with stable generated IDs and a loss report from `PTCNV-201` through `PTCNV-205`, and rejects executable directives and raw HTML. Unit, CLI, and E2E tests fix strict-loss behavior, exclusive `--out`, Core/CLI/package parity, PERT/velocity preservation, and tamper rejection. All 167 tests, documentation, four self-use plans, link checks, and package inspections passed. After checking the preview diff and `sha256:8de200ead6689709245d94c1473804cd28dca361397193fab8f8f1ea979acb96`, `plans/mvp.pert` was completed with `task finish --write`. Macro remaining precedence and resource makespans were both 2d, resource delay was 0d, and the only ready, `runnable_now`, precedence/schedule-critical work package was `RELEASE_E2E`. Because the Mermaid task is a macro day-estimate sample rather than a point result, the point-based operations velocity remains `24p/1d`.

Then began an acceptance audit for `RELEASE_E2E`, which found that the recommendation tiers, recommended set, structured explanation, and higher-priority comparison required by [MVP acceptance condition 16](../requirements.md#21-mvp-acceptance-criteria) had not been implemented. Do not reinterpret the `dag next` v2 operational group as a recommendation; keep `RELEASE_E2E` incomplete. The [recommendation implementation plan](../../plans/recommendation.pert) decomposed MIG-01 through MIG-07 into 22p and rolled its `11/12d` resource forecast, based on the operations measurement `24p/1d`, up to the macro as `0.916667d`. Macro remaining precedence/resource makespan was `2.916667d`, resource delay was 0d, `RECOMMENDATION_IMPLEMENTATION` was the only ready, `runnable_now`, precedence/schedule-critical work package, and `RELEASE_E2E` was upcoming. In the detail plan, `FIXTURE_BASELINE` was the only ready, precedence/schedule-critical, `runnable_now` task. The [release-readiness record](mvp-release-readiness.md) is the authority for the audit basis and restart conditions.

Then completed `FIXTURE_BASELINE`. REC-001 through REC-007 were expanded into minimal warning-free `.pert` files, and REC-008 through REC-011 into unit inputs. Future candidate facts and expected decisions were separated from the current `Perttool.NextResult.v2` groups, tasks, resource rejections, and upcoming explanations, then fixed as goldens. REC-002, for which gate distance 0 and new satisfied-gate count 0 could not coexist, was corrected to the normative distance 1 versus 2, preserving the preceding-rule tie. All 170 tests confirmed that the public schema and text were unchanged. After checking the preview diff and `sha256:920718d3f18cc45bb615488d986b4088dcff925ac20dc891d3ee42d10559c67a`, `plans/recommendation.pert` was completed with `task finish --write`. The first completed sample, 2p/1 active day, established recommendation-specific velocity `2p/1d`; remaining precedence was 17p, resource work 20p, resource delay 3p, and resource forecast 10d. Rolling 10d up to the macro left a 12d precedence/resource makespan, and `RANKING_CORE` was the next detail critical task.

Then completed `RANKING_CORE`. The pure Core in `src/recommendation/` considers only actually ready tasks and calculates completion counterfactuals, structural distance, a complete order using exact Rational values and stable task IDs, driving/near-critical/minimum-float selection horizons, joint resource scans including active allocations, and the `recommended`/`allowed`/`deferred` tiers. Dedicated tests fix REC-001 through REC-007, all 10 ranking rules, parallel and empty sets, capacity overrides, and selected/active-only blockers; all 175 tests confirmed that the existing Core exports, CLI, help, and `Perttool.NextResult.v2` remained unchanged. After checking the preview diff and `sha256:688cc5aa9091b37576f619c6d9111d05e5d1a4e24f3cf12016e5caa461cc5e87`, `plans/recommendation.pert` was completed with `task finish --write`; the post-write digest was `sha256:e239c14c804f53e65162e112871483ef1c88ac90a13f9169e1bde44f87ab1ceb`. The cumulative 6p/1 active-day sample recalibrated velocity to `6p/1d`, leaving 13p precedence, 16p resource work, 3p resource delay, and a resource forecast of `8/3d`. Rolling `2.666667d` up to the macro left a `4.666667d` precedence/resource makespan, and `EXPLANATION_CORE` was the next detail critical task.

Then completed `EXPLANATION_CORE`. From the MIG-02 result, a private pure Core builds exact typed facts; bounded expressions with maximum depth 8; minimal comparisons with winner, alternative, and decisive rule; phase-ordered decision traces; taxonomy 1.0 reason occurrences; and canonical English descriptions from typed parameters. Reference closure, tier/set consistency, expression reevaluation, and corruption of version/rule/code/fact registries or description key/parameter/text are converted to `PTREC-301` through `PTREC-303`, with no partial result returned. Dedicated tests fix REC-001 through REC-011, selected/active-only blockers, resource witnesses at scan time and in the final set, zero ready tasks, exact Rational values, and each diagnostic corruption; all 186 tests confirmed that existing Core exports, CLI, help, and `Perttool.NextResult.v2` were unchanged. After checking preview source digest `sha256:6f29a90d7958dfe8101527afad0d06c111e86fe57a6285e72d4f50a8509f0c5c`, `plans/recommendation.pert` was completed with `task finish --write`; its digest was `sha256:f9ade5949069deec4164d5ee4b6bae5c396df6addd5bec00c5134fa34f8282e7` immediately after completion and `sha256:31985c15f5cb32a3340519b093eb6036606502e2026b33d5d8a145c5ca9cf700` after recording velocity. The cumulative 11p/1 active-day sample recalibrated velocity to `11p/1d`, leaving 8p precedence, 11p resource work, 3p resource delay, and a 1d resource forecast. Rolling 1d up to the macro left a 3d precedence/resource makespan, and `NEXT_V3_PUBLICATION` was the next detail critical task.

Then completed `NEXT_V3_PUBLICATION`. Ranking and the explanation graph were connected to `selectNextTasks`, and the public `NextResultV3` type, `recommendationAnalysisToJson`, `Perttool.NextResult.v3` CLI JSON, four-tier text summary, structured help, consumer migration guide, and CHANGELOG were published atomically. Dedicated tests fix Core/CLI complete-graph parity, complete JSON with zero ready tasks, text/error goldens, byte determinism, raw-BOM digest provenance, partial-result suppression with `PTREC-*` and exit 70, retained v2 operational fields, and package-installed API/CLI. All 195 tests, documentation, five self-use plans, the local link, and package inspections passed. After checking preview source digest `sha256:31985c15f5cb32a3340519b093eb6036606502e2026b33d5d8a145c5ca9cf700`, `plans/recommendation.pert` was completed with `task finish --write`; its digest was `sha256:eeab2abcf0be0ca25fe8124dbea46c90dff130721f1ba43fcdf211569b924069` immediately after completion and `sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d` after recording velocity. The cumulative 15p/1 active-day sample recalibrated velocity to `15p/1d`, leaving 4p precedence, 7p resource work, 3p resource delay, and a `7/15d` resource forecast. Rolling `0.466667d` up to the macro produced digest `sha256:1bc4b4b9d16fe9ab6b96491e6270a8c9c9c3de19af2eddff5fc4d30a044556fd` and left a `2.466667d` precedence/resource makespan. In the detail plan, `SELF_USE_SHADOW` was recommended and `OVERRIDE_VALIDATION` was deferred because of a reviewer conflict. Because V3 had not yet passed shadow acceptance, manual selection remained the authority.

On 2026-07-23, the user explicitly brought forward npm-publication preparation. This human override permits only package metadata, the publish-normalization dry run, the same-tarball publish guard, and the TOKEN-injection procedure; it does not start or complete `RELEASE_E2E`. In the maintainer domain, `NPM_ACCESS_TOKEN` was renamed to `NPM_TOKEN`; the absence of the old name, presence of the new name, and successful `npm whoami` were confirmed without displaying its value. The current `0.1.0-alpha.1` contains changes later than the existing Git tag/GitHub Release, so it will not be published. The version update to the next candidate `0.1.0-alpha.2`, tag, GitHub asset, npm publication, and registry installation remain after the release gate. Macro/detail status and recommendation results remain unchanged, and `SELF_USE_SHADOW` remains the next normal task.

Then completed `SELF_USE_SHADOW`. `dag next --format=json` was executed twice against the same snapshot for five plans to verify the known `Perttool.NextResult.v3` contract, complete graph, byte determinism, ready subset, joint resource feasibility of the recommended set, v2 operational-field compatibility, and absence of `PTREC-*`. In the pre-acceptance detail snapshot, the difference between `SELF_USE_SHADOW` and `OVERRIDE_VALIDATION` was explainable solely by the primary comparison, the `REVIEWERS` resource witness, and the canonical description; the decision and digest were fixed in the [shadow acceptance record](recommendation-shadow-review.md). After checking preview source digest `sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d`, `plans/recommendation.pert` was completed with an expected-digest `task finish --write`; the digest immediately after completion was `sha256:2494c60b92f70a8bb66ab35e05e789bac717cd06a2d00e3f2f8f15b1f78cc94d`. Adding the completed 2p to the same-day sample recalibrated velocity to `17p/1d`, leaving 3p precedence, 5p resource work, 2p resource delay, and a `5/17d` resource forecast. Rolling `0.294118d` up to the macro left a `2.294118d` precedence/resource makespan. In the detail plan, `OVERRIDE_VALIDATION` was recommended and `AUTHORITY_ADOPTION` was deferred because of a reviewer conflict. Manual selection remained the authority until MIG-07 was complete.

Then completed `OVERRIDE_VALIDATION`. It implements pure `validateOverride`, public request/result types, snake_case projection, and a canonical artifact, and fixes in dedicated tests and the package-installed API the allowed/deferred replacements for OVR-001 through OVR-004 and OVR-006; normal-authority selection; stale/eligibility/resource failures; caller-asserted actor; explicit UTC time; evidence canonicalization; capacity-override binding; normal-trace reference; and SHA-256 identity. The discouraged OVR-005 fixture remains reserved for a future version that introduces concrete negative facts. The function reads only the source result and request; it does not change task state, files, Git, or the network. After checking preview source digest `sha256:f7b46fca9c5ce53f8cea57c2a12ecd38dcca33c542865fdb72dfac74da573507`, `plans/recommendation.pert` was completed with an expected-digest `task finish --write`; its digest was `sha256:2e1a1d0412230d60a805e17ee3f30a1308460142c0d1244d953c6e3ec1f53038` immediately after completion and `sha256:bf9622a81219e4dceca2279305ed015da964680c6856d0e081f566224f679ac2` after recording velocity. Adding the completed 3p to the same-day sample recalibrated velocity to `20p/1d`, leaving 2p precedence/resource work, 0p resource delay, and a `1/10d` resource forecast. Rolling `0.1d` up to the macro produced digest `sha256:5006bf9b863538ec8404665c9150b8c40a048ddb1a4008591276117424c7cf21` and left a `2.1d` precedence/resource makespan. In the detail plan, `AUTHORITY_ADOPTION` was the only ready, recommended, and critical task. Override application, audit writes, and Git operations remain unavailable until MIG-08.

Then completed `AUTHORITY_ADOPTION`. The normal-selection rule was synchronized from the macro and detail plans into `AGENTS.md`, Copilot instructions, the AI development guide, consumer guide, and help. Tests fix every recommended subset, the complete recommended set plus one allowed task, allowed replacements, deferred selections, and the empty recommendation as dry runs. At 16 boundaries—schema, interface, algorithm, taxonomy, explanation, expression, description, locale, completeness, tier, decisive rule/reason/expression, and `PTREC-*`—selection safely stops without choosing a task. From preview source digest `sha256:bf9622a81219e4dceca2279305ed015da964680c6856d0e081f566224f679ac2`, `plans/recommendation.pert` was completed with an expected-digest `task finish --write`; its digest was `sha256:bfe6fecde02b11cb14d451388c7bf234ee91029fef8e78a7d0a2caed592abdf3` immediately after completion and `sha256:b683fdacbbff39c0afd7ee20faf6cc4c05c50ece2ea350e4ce15e4a599f61464` after recording velocity. Adding the completed 2p to the same-day sample recalibrated velocity to `22p/1d`, leaving 0p detail work. Macro `RECOMMENDATION_IMPLEMENTATION` was likewise completed from source digest `sha256:5006bf9b863538ec8404665c9150b8c40a048ddb1a4008591276117424c7cf21` with the expected digest; its digest was `sha256:a3056f2c72554b2835acc6b48ec8db3a795c35a635f3af851e4262ab331ae075` immediately after completion and `sha256:741c027228dd13cfdf6bcdb6a4e0c0f6523848aba6f1c4f6e4d1f762433533bf` after synchronizing the description. `RELEASE_E2E` was the only ready, `runnable_now`, recommended, precedence/schedule-critical work package, with 2d remaining. Override application, audit writes, and Git operations remain unavailable until MIG-08.

Then completed `RELEASE_E2E`. Version `0.1.0-alpha.2`, all 206 tests, documentation, five plans, the local link, package installation, and publish normalization were verified. Release commit `dd4fc3efc01945544a2dad7e1838fdd4d06d7275` was pushed to `origin/main`, and an annotated tag was created for that commit. A tarball generated only once outside the worktree was used for the GitHub prerelease asset and npm publication; the GitHub public asset and registry tarball had SHA-256 `aadb757a5d7bb82eed677158ce5c4b0672c5695a6dde97bec6f10c438711be8a`, and npm integrity, `alpha=0.1.0-alpha.2`, an isolated installation, CLI version, and `dsl check` were verified. An immediate registry `E404` was not retried; publication success was confirmed by querying durable state. On the first publication, the registry also created `latest` at the same version and rejected tag deletion with `E400`, so the existing immutable-`latest` guard was extended to wait for future propagation in the script, and the first-publish exception was recorded. After checking macro preview source digest `sha256:741c027228dd13cfdf6bcdb6a4e0c0f6523848aba6f1c4f6e4d1f762433533bf` and candidate digest `sha256:47937515ecbf024bd1dd23ca7d73e526e2fb25ae6fac27cc4ff179ece45d5217`, it was completed with an expected-digest `task finish --write`. Once all tasks were complete, precedence/resource makespan, ready, and recommended were 0.

After MVP public-alpha acceptance, the user chose to include Issue #2 in the first beta. [ADR 0003](../adr/0003-beta-versioning.md) established suffix-free `0.1.0`, beta releases in the `0.x.x` line, no strict compatibility requirement from alpha, and no additional soak period; it also separated the workflow into the [beta release procedure](beta-release.md). Issue #2 was decomposed into five tasks totaling 22p in `plans/agent-guidance.pert`, and the provisional observed `22p/1d` velocity from the recommendation implementation was rolled up as an initial duration of 1d. The macro plan added `AGENT_GUIDANCE_IMPLEMENTATION` (1d) and `BETA_RELEASE_E2E` (1d), based on the alpha-release results, in series. Issue #3 is not a beta blocker and remains future design work outside the MVP.

Next, `PROVIDER_BASELINE` was completed. Official material for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity was revalidated as of 2026-07-23. The [Provider baseline](agent-guidance-provider-baseline.md) and offline fixture record the artifacts, scope, maturity evidence, risks, and sources for instructions, workflows, delegated agents, enforcement, prompts, and connectors. Public schema and support status were deferred to the subsequent contract; unspecified paths were represented as empty arrays rather than inferred. From preview source digest `sha256:b39ceba34d6eee0b6d6c2a663d35bdbe95d89ea9172bfb977f839d0e715c2334`, `plans/agent-guidance.pert` used `task finish --write` with the expected digest. Its digest was `sha256:c3ba8dc7d8d9cbf237c35e9ddd94d42477f442c89bd379b7ca4bddb9ce4eda9e` immediately after completion and `sha256:bf403deb5d8a39f186cd72fafcae3726187821255f0f7ca588ff4673b30d99d9` after recording velocity and evidence. The first completed sample, 4p over one active day, established the plan-specific observed velocity of `4p/1d`; the remaining 18p had a precedence/resource forecast of 4.5d. The macro plan rolled `AGENT_GUIDANCE_IMPLEMENTATION` up to 4.5d, leaving a 5.5d makespan to the beta release. The detail plan's only ready, `runnable_now`, recommended task was `GUIDANCE_CONTRACT`.

Then `GUIDANCE_CONTRACT` was completed. The [AI Agent Guidance Registry specification](../specs/agent-guidance.md) and [normative example](../examples/agent-guidance.md) established five providers, six surfaces, the `grok` alias, six support statuses and their structural basis, artifact resolution, common guidance/risk IDs, project-first composition, snapshot-relative staleness, `Perttool.AgentGuidanceResult.v1`, text/JSON, `PTAGT-*`, read-only capability, and migration paths for audit, scaffolding, and enforcement. `test/fixtures/agent-guidance/contract.v1.json` and its dedicated test covered version identity, ordering, reference closure, 20 cases, and axis consistency with the existing provider baseline; all checks passed, including the focused test of the existing `dsl help`. From preview source digest `sha256:bf403deb5d8a39f186cd72fafcae3726187821255f0f7ca588ff4673b30d99d9`, the detail plan used `task finish --write` with the expected digest. Its digest was `sha256:54721b08fa2e878c9d12bb72ba77900d5a2fb180e2f2ae547642f02ca7c3d455` immediately after completion and `sha256:68596c119c9af06ee571f3081eacb50919e776a97f21cebe61097638f5916845` after velocity was recorded. The completed sample was updated to a cumulative 9p over one active day, leaving a precedence/resource forecast of `13/9d` for the remaining 13p. From preview source digest `sha256:ffc0d2197b5fe8f0237ad9cd10a25e58eb123f037df5974b69f3693fe6106af6`, the macro plan updated `AGENT_GUIDANCE_IMPLEMENTATION` to 1.444444d with the expected digest. Its digest was `sha256:67bef4a902b5849aaab8e5dfd6f01b985f00fd1095f0d1fad8d50f5d74e07dce` immediately after the task update and `sha256:9153023d3e3d01e3dd8e065b79c8e616b3e949fc95eeca6c9d1f179fec46792e` after synchronizing the roll-up explanation. The remaining makespan to the beta release was 2.444444d, and the detail plan's only ready, `runnable_now`, recommended task was `GUIDANCE_CORE`.

Then `GUIDANCE_CORE` was completed. It added a public type in `src/guidance/`; a versioned offline profile for five providers × six surfaces; a canonical profile digest; a fail-closed validator; exact lookup and `grok` alias normalization; reference-closed index, quick, and detail projections; deterministic schema-ordered JSON; and publication through the public library. The bundled profile retains the provider-baseline artifact path, while dedicated tests and goldens cover native, compatible, preview, deprecated, unsupported, unknown, unknown artifact paths, snapshot-relative staleness, description conflicts, dangling references, and digest mismatches. The Core and its capabilities do not access files, hooks, commands, networks, or provider state; CLI/text publication was deferred to the successor. After all 229 tests passed, the detail plan used `task finish --write` with the expected digest from preview source digest `sha256:68596c119c9af06ee571f3081eacb50919e776a97f21cebe61097638f5916845`. Its digest was `sha256:c914a3a78905a67cfe59bef00e11d8e8f5d3308aa399505db8ef2395afc32d7c` immediately after completion and `sha256:8a40f693313273de4a97dcd891aca4cb27e6ee5618a9645ba507bcfaafd6a62a` after velocity was recorded. The completed sample was updated to a cumulative 14p over one active day, leaving a precedence/resource forecast of `4/7d` for the remaining 8p. From source digest `sha256:9153023d3e3d01e3dd8e065b79c8e616b3e949fc95eeca6c9d1f179fec46792e`, the macro plan updated `AGENT_GUIDANCE_IMPLEMENTATION` to 0.571429d with the expected digest. Its digest was `sha256:00c0e62752d21212ff9a7dae76be2a94c231467e3db62b07d0ca3cb83762da6c` immediately after the task update and `sha256:bffd75002d05868bc4d6fd08a2c0e35c3ad378ebaa3ecfed01a61a8df69602e4` after synchronizing the roll-up explanation. The remaining makespan to the beta release was 1.571429d, and the detail plan's only ready, `runnable_now`, recommended task was `AGENT_HELP_PUBLICATION`.

Then `AGENT_HELP_PUBLICATION` was completed. The same Guidance Core result was connected to `agent help [provider [surface]]` index, quick, and detail views; text/JSON output; `grok` alias canonicalization; `PTAGT-*` domain errors; and `PTCLI-001` usage errors. The agent-specific structured command help in `src/help/registry.ts` remains separate from the legacy `dsl help` topic registry, and a golden preserves the existing index JSON bytes. Dedicated tests and E2E cover the public text renderer, byte parity between CLI JSON and the Core serializer, source detail, read-only capability, execution without project or provider state, the local link, and Core/CLI parity from an isolated release-tarball installation. The detail plan was previewed from source digest `sha256:8a40f693313273de4a97dcd891aca4cb27e6ee5618a9645ba507bcfaafd6a62a`, checked candidate digest `sha256:a655ae11a32aa2827bf44a9b9446c2094b0937239440f3753e9ac4ced6b746b1`, and used `task finish --write` with the expected digest. After velocity was recorded, its digest was `sha256:ee68daf19e2e99bcafe2317eb4649cfd98f277cc07db438d4a8b991fecc62a27`. The completed sample was updated to a cumulative 19p over one active day; the remaining `GUIDANCE_ACCEPTANCE` 3p had a precedence/resource forecast of `3/19d`. The macro plan was previewed from source digest `sha256:bffd75002d05868bc4d6fd08a2c0e35c3ad378ebaa3ecfed01a61a8df69602e4` and updated to 0.157895d with the expected digest. Its digest was `sha256:0c02bb566596ab903f31c915df08e42d3384fceffd3e9cd07c89c7f4e592444b` immediately after the task update and `sha256:a68c8ee462224ea6e2387b5c332fea398132afff17e4d72860f58b6a483b43c3` after project-description synchronization. The remaining makespan to the beta release was 1.157895d, and the detail plan's only ready, `runnable_now`, recommended task was `GUIDANCE_ACCEPTANCE`.

Then `GUIDANCE_ACCEPTANCE` was completed. The [acceptance record](agent-guidance-acceptance.md) fixed the trace from Issue #2's 12 criteria to the specification, Core, CLI, text/JSON, fixtures/goldens, package, and security boundaries. It verified 30 dedicated tests, 244 tests in total, documentation, six plans, the local link, isolated installation of the release tarball, the publish dry-run, and `git diff --check`; it did not perform an actual publish. The detail plan was previewed from source digest `sha256:ee68daf19e2e99bcafe2317eb4649cfd98f277cc07db438d4a8b991fecc62a27`; its digest was `sha256:a1e843e565f9efff52564d591098e646cb2c9fe106dcdf622fcf15e6abbed644` after the expected-digest finish and `sha256:1db794b333a5e65d8b15eab1b748118debc3f30f49741df91399bd1084f3093d` after advance. After recording the 22p-over-one-active-day velocity of `22p/1d` and the acceptance trail in project metadata, then mechanically formatting the blank lines introduced by advance, its final digest was `sha256:c88d8f03b52a2c4e1f1f533f977343bdf033b827a0464bfc2edf2f6019662b6e`. From source digest `sha256:15ab17484073e08b0f4dbb56e78afbdf669731db4d19a1b520643838e411382a`, the macro task `AGENT_GUIDANCE_IMPLEMENTATION` had digest `sha256:1992f2eb4600819d4e346f77dcfaa3dd536df00f4fa8a8c50afb8cbe044cb394` after the expected-digest finish, `sha256:05ee6bc35139c537205b3724a0fb0cf0d84c581486b009cb305ebdf10b9d6c16` after advance, and `sha256:b05c1c294f9349ee04e1cc158a53f18e108f33a5750ca6c1cb62e70efd3e5eb4` after synchronizing the current/future description and formatting the same blank lines. Detail work remaining was 0p; the macro plan's only ready, `runnable_now`, recommended, precedence/schedule-critical task was `BETA_RELEASE_E2E`, with a remaining makespan of 1d.

In the same logical change, the independent post-first-beta backlog added an LSP server, a VSIX with code highlighting and an LSP client, and an MCP server. The LSP server is the predecessor of the VSIX; the MCP server is an independent workstream. None of these items was added to the current macro plan or the first-beta blocker.

The `BETA_RELEASE_E2E` task then completed. Release commit `4ba630f39a727f40d10518e5ab9155f9fbc9a8f6` and annotated tag `v0.1.0` were pushed, and one tarball was published as a GitHub prerelease and to npm `beta`. The local, GitHub, and registry tarballs shared SHA-256 `a077b54d7b9a0f0c054ee1ce667a6784821af825954f350ce4f76bf43b11831c`; the publish operation left `latest=0.1.0-alpha.2` unchanged, and isolated GitHub and registry installations passed the CLI and Core smoke checks. After acceptance, the user explicitly promoted `0.1.0` to npm `latest`; both `beta` and `latest` now resolve to `0.1.0`. The [beta acceptance record](beta-release-acceptance.md) fixes the full evidence. The macro plan was completed and advanced to an empty recommendation. Its post-promotion metadata update used the Stage 3 expected-digest write and produced source digest `sha256:689462cc4c8a3b5d860f50c9e9a8de3c42ae9caea8fea4cd293ef2076d8caf24`. The English-baseline external gate was removed through the Stage 3 preview-first workflow; source digest `sha256:8bb1f1eca3563c093eb6cadb5155233791b2a91286e9f549e0823d3168a563bd` was the beta-acceptance snapshot at which `SURFACE_INVENTORY` became ready, runnable, and recommended.

On 2026-07-24, `SURFACE_INVENTORY` recorded the canonical surface counts, 13 runtime source files, Unicode allowlist, and stable identifier exclusions in [English surface migration inventory](english-surface-inventory.md). One atomic batch updated the plan metadata to the first workstream-specific velocity `2p/1d` and finished the 2p task; `dag advance` then removed the completed edge and prior milestone with expected-digest safe writes. The resulting digest is `sha256:16eb52f11d40d7c884d2bb6c46d3e8cd062559ebd66fd2df502152d270036c37`. Seven tasks and 40p remain; precedence is 27p, resource makespan is 30p, resource forecast is 15d, and fresh complete `NextResult.v3` recommends `NORMATIVE_DOCS`.

Later that day, `NORMATIVE_DOCS` migrated the requirements, basic design, normative specifications, examples, and ADR surface to English while preserving normative strength, stable identifiers, exact values, and intentional Unicode boundaries. The Mermaid normative artifact and its metadata/projection digests were regenerated from the translated source DSL. An atomic batch recalibrated the cumulative workstream velocity to `15p/1d` and finished the 13p task; `dag advance` then removed the completed edge with expected-digest safe writes. The resulting digest is `sha256:c822e9a3b9f7eff72359ff3dab84abd3c285ded4b92e06f3c6beb1ea8a50c458`. Six tasks and 27p remain; precedence is 14p, resource makespan is 17p, resource forecast is `17/15d`, and fresh complete `NextResult.v3` recommends `PROCESS_AND_GUIDANCE_DOCS`.

`PROCESS_AND_GUIDANCE_DOCS` then migrated the repository entrypoints, current CHANGELOG guidance, security guidance, process runbooks, and provider-facing development guidance. Lightweight translation agents worked in non-overlapping slices, and independent cross-review compared the results with the source text for normative strength, historical evidence, links, commands, stable identifiers, digests, and permission boundaries. The broad language scan leaves only the intentional Japanese-script detection expression in `english-surface-inventory.md`. An atomic batch recalibrated the cumulative workstream velocity to `23p/1d` and finished the 8p task; `dag advance` then removed the completed edge with an expected-digest safe write. The resulting digest is `sha256:6e75ee63b4821dfe3104a2a5b91ab44cdece659644d74a9dee2917516768f57d`. Five tasks and 19p remain; precedence is 11p, resource makespan is 16p with 5p resource delay, and fresh complete `NextResult.v3` recommends `RUNTIME_MESSAGES`.

`RUNTIME_MESSAGES` then migrated parser, semantic, application, mutation, conversion, CLI usage-diagnostic, and safe-write messages to English. Lightweight translation agents worked in non-overlapping slices and independently cross-reviewed each other's changes. Stable diagnostic codes, source spans, JSON fields, schema shapes, interpolation values, fail-closed boundaries, and safe-write checks remain unchanged; one byte-level recommendation golden was updated with the runtime message. The remaining Japanese runtime source is confined to `src/help/registry.ts` for `HELP_AND_USAGE`. An atomic batch recalibrated the cumulative workstream velocity to `28p/1d` and finished the 5p task; `dag advance` then removed the completed edge with an expected-digest safe write. The resulting digest is `sha256:88698003c0100623e5aeb80e3407847e898e36770813ddd0945932ee98c293e8`. Four tasks and 14p remain; precedence and resource makespans are both 11p with no resource delay, and fresh complete `NextResult.v3` recommends `HELP_AND_USAGE`.

`HELP_AND_USAGE` then migrated all 65 repository-maintained Japanese help entries in the structured registry, including `dsl help`, the `agent help` command description, safe-editing guidance, Mermaid fail-closed boundaries, and `NextResult.v3` authority guidance. A lightweight translation agent performed the translation and another independently cross-reviewed the source meaning and stable identifiers. Help tests retain the preview/write, normal-authority, safe-stop, reanalysis, read-only override, secret-handling, and unavailable apply/audit boundaries. Linked and packed CLI checks now verify the stable help schema, topic and section IDs, and English-only index and detail projections. An atomic batch recalibrated the cumulative workstream velocity to `33p/1d` and finished the 5p task; `dag advance` then removed the completed edge with an expected-digest safe write. The resulting digest is `sha256:540165d6de11dde691c689ccd7d5c1f03e73f5b36557d046e49cf011c7ae8b39`. Three tasks and 9p remain; precedence and resource makespans are both 9p with no resource delay, and fresh complete `NextResult.v3` recommends `PERT_PLANS`.

On 2026-07-29, `PERT_PLANS` migrated the remaining repository-maintained plan
metadata in `mvp.pert`, `grammar.pert`, `control-plane.pert`,
`operations.pert`, `recommendation.pert`, and `agent-guidance.pert`, plus the
current and historical evidence prose in `plans/README.md`. The migration used
six atomic `batch apply` safe writes and changed only project, resource,
milestone, task, and gate prose. Existing self-use projections confirm that
IDs, topology, estimates, states, priorities, and resource requirements are
unchanged; no completed edge was reconstructed from Git. The plans-scoped
language scan has no Japanese-script match, and the recommendation shadow
golden changed only the six translated source digests before the task state
change. An expected-digest atomic batch set `as_of` to 2026-07-29,
recalibrated the cumulative sample to `36p/2d`, and finished the 3p task. The
exact completed pre-advance digest is
`sha256:46d60e078c894943fac4d42e87910f32b39aca6aa95023c1c2fef4ec89a72866`.
Git commit `9d9fdbf` records that exact snapshot. Governed `dag advance` then
removed the completed task, four satisfied gates, and five prior frontier
milestones while preserving reached `ENGLISH_CONTENT_READY` and the ready set;
the residual digest is
`sha256:5ef6da21733179d8d0df03bb83de0fac90257cd91dcb5300f97c9909fb924c86`.
Two tasks and 6p remain; precedence and resource makespans are both 6p with no
resource delay, both forecasts are `1/3d`, and fresh complete, non-truncated
`NextResult.v5` recommends only `GOLDEN_UNICODE_AUDIT`. The
[PERT plan migration acceptance record](english-pert-plans-acceptance.md)
fixes the scope, invariants, digests, and non-goals.

`GOLDEN_UNICODE_AUDIT` then migrated the remaining repository-authored prose
in six E2E and four invalid fixtures, retained the dedicated Japanese/emoji
round-trip fixture, and added an exact, counted, fail-closed Japanese-script
allowlist to `npm run check` and CI. Pre-migration layout and semantic
projection digests verify that IDs, endpoints, structured values, declaration
order, and UTF-16 source layout did not change. The complete gate passed 641
tests, all 20 self-use plans, 94 Markdown documents, seven PERT examples, and
the link/package workflows. An expected-digest atomic batch recalibrated the
cumulative sample to `39p/2d` and finished the 3p task. The exact completed
pre-advance digest is
`sha256:9aa145806e7aeee32e7ad97ed45ec1df9a9d954100f3e96bcea8196f1be90e25`.
Git commit `81ab774` records that exact snapshot. Governed `dag advance`
removed the completed task and prior frontier while preserving reached
`GOLDEN_UNICODE_READY` and the ready set; the residual digest is
`sha256:fe7241624e95e60f5bca184f8a402e9d0ed5ded4be4f77a0e8404a6a36248d86`.
One task and 3p remain; precedence and heuristic resource makespans are both 3p
with no resource delay, both forecasts are `2/13d`, and complete
`NextResult.v5` recommends only `ENGLISH_ACCEPTANCE`. The
[golden and Unicode audit acceptance record](english-golden-unicode-acceptance.md)
fixes the allowlist, invariant evidence, verification, and non-goals.

`ENGLISH_ACCEPTANCE` then traced ADR 0004 through requirements, design,
runtime and diagnostics, help and usage, documentation, plans, tests and
goldens, package contents, and the shared agent entrypoints. The full gate
passed 641 tests, 437 scanned text files with exactly three allowlisted lines,
96 Markdown documents, seven PERT examples, all 20 self-use plans, and the
link/package workflows. An expected-digest atomic batch recalibrated the
cumulative sample to `42p/2d` and finished the 3p task. The exact completed
pre-advance digest is
`sha256:e9b306ff0423ad8bc8114a1c1c35affae60e6cd79f1f52fa9cd997c3a7727462`,
recorded by Git commit `2001cdf`. Governed `dag advance` removed the task and
prior frontier, retained reached `ENGLISH_BASELINE_ACCEPTED`, and preserved an
empty ready set. A source-preserving `project set` synchronized the accepted
description; the final residual digest is
`sha256:160e1af66d7bc8c2c8ea6b7a9f62ad7b533ec74e1ae1adc3b5d9f176745362a4`.
All nine tasks and 42p are accepted over two active dates. Precedence and
heuristic resource makespans are zero, and complete NextResult v5 has no ready,
recommended, or startable task. The
[final acceptance record](english-baseline-acceptance.md) fixes the trace,
verification, plan evidence, and non-goals.

`CLI_001_COMMAND_REGISTRY` then selected `src/command/registry.ts` as the immutable typed registry for all 22 active Contract 2 commands. Dispatch lookup, accepted-option parsing, exact text help, deterministic JSON descriptor projections, operands, defaults, conflicts, input/output modes, effects, result schemas, exit statuses, and examples now share the expanded descriptors. Completeness tests fail when a command path, option, handler, help projection, schema, or example is missing; the public Contract 2 help bytes remain unchanged and `project init` remains unavailable backlog item `MUT-001`. All 255 tests, documentation, eight self-use plans, link checks, and package inspections passed. An atomic batch recalibrated the cumulative plan velocity to `13p/1d` and finished the 8p task; `dag advance` then removed the completed edge with an expected-digest safe write. The resulting digest is `sha256:a2efa9b0ef7d1c55cc2892de03ff8dd83e101e98864dd0916e0ebc5abc2c6e0c`. Seven tasks and 36p remain; precedence is 20p, the heuristic resource makespan is 36p with 16p resource delay, and the resource forecast is `36/13d`. Fresh complete `NextResult.v3` recommends `HELP_001_COMMAND_DISCOVERY`.

`HELP_001_COMMAND_DISCOVERY` then added the pure Contract 3 preview in `src/command/discovery.ts`. It derives 23 implemented target paths, accepted renames, examples, resource order, top-level/resource/action lookup, `Perttool.CommandHelpResult.v1`, and deterministic text/JSON from the expanded descriptors. Unknown resources and actions return `PTHLP-002` and `PTHLP-003`; isolated-process tests verify no project read, filesystem mutation, environment discovery, or non-local dependency. `project init` and gate maintenance remain absent because they are not implemented, and the active Contract 2 CLI still rejects public Contract 3 names. All 261 tests, documentation, eight self-use plans, link checks, and package inspections passed. An atomic batch recalibrated cumulative velocity to `18p/1d` and finished the 5p task; `dag advance` then removed the completed edge with an expected-digest safe write. The resulting digest is `sha256:555c2fd30244a590184bbe3b953b872cbc5caf59152d6ba92759b7749daf20f0`. Six tasks and 31p remain; precedence is 18p, the heuristic resource makespan is 31p with 13p resource delay, and the forecasts are `1d` and `31/18d`. Fresh complete `NextResult.v3` recommends `MUT_002_GATE_MAINTENANCE`; `project init` remains backlog item `MUT-001`.

`MUT_002_GATE_MAINTENANCE` then added source-preserving gate add/set/remove Core requests, atomic-batch routing, localized endpoint and reason edits, non-cascade removal, and final-candidate validation for endpoints, cycles, joins, and finish reachability. The existing Contract 2 `mutation apply` path provides preview, diff, JSON, `--write`, exclusive `--out`, and optimistic locking for gate batches; direct Contract 3 gate commands remain inactive until cutover. The internal command discovery now projects 26 target paths including gate add/set/remove while still excluding `project init`. Unit, CLI, E2E, safe-write, discovery, and documentation tests cover valid changes, no-ops, request/target errors, connected milestone/gate batches, and public-name rejection. An atomic batch recalibrated cumulative velocity to `26p/1d` and finished the 8p task; `dag advance` then removed the completed edge with expected-digest safe writes. The resulting digest is `sha256:cede87824c095ef4054b3fb058c8ebf1adc80cf846cb720dc9a1cc42c46128b1`. Five tasks and 23p remain; precedence is 15p, the heuristic resource makespan is 23p with 8p resource delay, and the forecasts are `15/26d` and `23/26d`. Fresh complete `NextResult.v3` recommends `MUT_001_PROJECT_INIT`, which remains backlog until separately implemented.

`MUT_001_PROJECT_INIT` then added the pure initialization Core, the deterministic `Perttool.InitResult.v1` text/JSON projection, one UTF-16 insertion edit at offset zero, and composition with the existing exclusive-create safe-write adapter. The smallest candidate has exactly one project and one reached milestone; point units require velocity, finish must equal the initial milestone, and invalid requests or candidates fail closed without templates or implicit tasks, gates, resources, or dependencies. Internal Contract 3 discovery now projects 27 target paths, while the active Contract 2 CLI still rejects `project init`. An atomic batch recalibrated cumulative velocity to `31p/1d` and finished the 5p task; `dag advance` then removed the completed edge with expected-digest safe writes, and `project set` synchronized the plan description. The resulting digest is `sha256:f73ad8098f6f363f220dbd4733ebee561f8f351d1b1ff46100a89d89003000c6`. Four tasks and 18p remain; precedence is 15p, the heuristic resource makespan is 18p with 3p resource delay, and the forecasts are `15/31d` and `18/31d`. Fresh complete `NextResult.v3` recommends `HELP_003_USAGE_RECOVERY`; `HELP_002_DOMAIN_GUIDE_SPLIT` is ready but deferred because it conflicts with the recommended task on `CLI_SURFACE`.

`HELP_003_USAGE_RECOVERY` then added the pure internal `src/command/usage.ts` projection. It resolves the Contract 3 descriptor before document I/O, validates option spelling and values, repeatability, operands, required options, conflicts, and requirements, and returns exact typed help targets for stable `Perttool.CliError.v1` text/JSON. A fixed restricted Damerau-Levenshtein rule limits suggestions to the applicable registry resource, action, or option set; exact command `--help`, direct and conditional conflicts, shared stdin, determinism, and operation without project or environment state are covered. The active Contract 2 CLI still rejects public Contract 3 names. All 280 tests, documentation, eight self-use plans, link checks, and package inspections passed. An atomic batch recalibrated cumulative velocity to `36p/1d` and finished the 5p task; `dag advance` then removed the completed edge with expected-digest safe writes, and `project set` synchronized the plan description. The resulting digest is `sha256:9da629a01dcb37df7b2a5242bd0de29459756c9112025474c746a7ea6f332fb8`. Three tasks and 13p remain; precedence and heuristic resource makespans are both 13p with no resource delay, and both forecasts are `13/36d`. Fresh complete `NextResult.v3` recommends `HELP_002_DOMAIN_GUIDE_SPLIT`.

`HELP_002_DOMAIN_GUIDE_SPLIT` then added the pure internal `src/help/guide.ts` projection. The existing HelpNode registry remains the sole domain-topic authority, while `Perttool.GuideResult.v1` gives Contract 3 its own deterministic index, quick/detail topic, text, JSON, and `guide_topic` diagnostic contract without importing command descriptors or changing legacy Contract 2 help bytes. Tests cover every registered topic and level, parser and source-diagnostic link resolution, unknown topics, deterministic isolated operation without filesystem or environment discovery, and installed-package projection parity. The active Contract 2 CLI still rejects public `guide`. All 287 tests, documentation, eight self-use plans, link checks, and package inspections passed. An atomic batch recalibrated cumulative velocity to `39p/1d` and finished the 3p task; `dag advance` then removed the completed edge and prerequisite frontier with expected-digest safe writes, and `project set` synchronized the plan description. The resulting digest is `sha256:efe1d0fe3f8295a554b683ae9c990cf2e436a717b8c545a3dd9707ddc49a359e`. Two tasks and 10p remain; precedence and heuristic resource makespans are both 10p with no resource delay, and both forecasts are `10/39d`. Fresh complete `NextResult.v3` recommends the breaking atomic public cutover `CLI_002_CONTRACT_V3_CUTOVER`.

`CLI_002_CONTRACT_V3_CUTOVER` then activated all 27 Contract 3 descriptors as the single dispatch, option-validation, text-help, and JSON-help authority. The source CLI now exposes hierarchical `help`, separate domain `guide`, `document check|format`, `project init`, direct gate maintenance, and `batch apply`; every CLI JSON envelope includes `cli_contract_version=3`, conceptual diagnostics use `guide_topic`, and the four renamed Contract 2 routes fail with exit 2 and structured recovery. The package root exports the active registry and projections, while README, CHANGELOG, requirements, specifications, design, migration guidance, package smoke, CLI/E2E, and goldens use the same surface. All 286 tests, the local link, and the isolated package inspection passed without publishing or changing npm tags. An atomic batch recalibrated cumulative velocity to `44p/1d` and finished the 5p task; `dag advance` then removed the completed edge and prerequisite frontier with expected-digest safe writes. The resulting plan digest is `sha256:f7cd81c517a32b2516a50d62e7163848f51ad2c613a463fccecbf0dabd2c3676`. One task and 5p remain; precedence and heuristic resource makespans are both 5p with no resource delay, and both forecasts are `5/44d`. Fresh complete `NextResult.v3` recommends `CLI_003_FILE_FIRST_ACCEPTANCE`.

`CLI_003_FILE_FIRST_ACCEPTANCE` then added `scripts/check-package-file-first.mjs` to the isolated tarball inspection. The test imports no repository Core: it invokes only the installed CLI to initialize and directly read a plan, covers every project/task/gate/milestone/resource field through one atomic batch and typed commands, observes blocked, recommended, active, and done states through JSON, advances completed history, and validates the final one-frontier document. The package check passed without publication or dist-tag changes. An atomic batch recalibrated cumulative velocity to `49p/1d` and finished the 5p task; `dag advance` then removed the completed edge and prerequisite frontier with expected-digest safe writes. Because the source-preserving formatter intentionally retained deletion-adjacent blank lines, one final whitespace-only patch removed the new trailing blank lines that `git diff --check` rejected. The resulting plan digest is `sha256:a0aff025db519b5f31f924b15f79b8370f2abb3a8881d7f441724a677168da2f`. No detail task remains; precedence and heuristic resource makespans are zero, and fresh complete `NextResult.v3` has no recommendation.

After the user selected `0.2.0` for the first Contract 3 package, `plans/release-0.2.0.pert` was created through Contract 3 `project init` and one atomic batch rather than manual source authoring. Its five tasks separate release-gate design, local version preparation, clean-candidate acceptance, authorized distribution, and durable acceptance; `RELEASE_020_DISTRIBUTION` carries an explicit authorization block, and npm `latest` promotion is outside the plan. Requirements 21.3, ADR 0003, the Contract 3 specification and migration guide, basic design, and `docs/process/0.2.0-release.md` fix the version, same-tarball rule, unchanged-`latest` rule, external authority boundary, and restart behavior. The initial valid plan totaled 17p with matching precedence and heuristic resource makespans, no resource delay, inherited provisional velocity `29p/2d`, and a complete recommendation for `RELEASE_020_GATE_DESIGN`. An atomic batch completed the 3p design and established the first plan-specific observation of `3p/1d`; `dag advance` removed the completed task and initial milestone with an expected digest. The resulting digest is `sha256:4e6b252e498d11b577ed266a84970c052ed6fdde6ab4a9f7489b795acb9ad69c`. Four tasks and 14p remain; both makespans are 14p, conditional on the distribution authorization block, and fresh complete `NextResult.v3` recommends `RELEASE_020_PREPARATION`. Package identity remains `0.1.0`, and no external write occurred.

`RELEASE_020_PREPARATION` then aligned `package.json`, both lockfile root
identities, the CLI version, dated CHANGELOG section, README version selection,
and release goldens at `0.2.0`. The README pins Contract 3 in symmetric `npx`
and `npm exec` examples because unqualified npm `latest` remains the published
Contract 2 `0.1.0` artifact. `npm ci`, all 289 tests, documentation, nine
self-use plans, local link, npm `beta` publish normalization, isolated package
installation, complete file-first workflow, and `git diff --check` passed.
An expected-digest atomic batch recalibrated cumulative velocity to `6p/1d`
and finished the 3p task; `dag advance` then removed the completed edge and
prior frontier, and `project set` synchronized current metadata. The resulting
digest is
`sha256:56956997d46f54a702c5fe06e92a83748c6df35b46c8fbe4a569a6f96c4c6a9b`.
Three tasks and 11p remain; precedence and heuristic resource makespans are
both 11p with no resource delay, conditional on distribution authorization,
and fresh complete `NextResult.v3` recommends `RELEASE_020_CANDIDATE`. No
registry lookup, push, tag, release, publication, or dist-tag write occurred.

On 2026-07-25, `RELEASE_020_CANDIDATE` reran the complete local gate and
confirmed that package, lockfile, CLI, and tag identities agree on `0.2.0` /
`v0.2.0`. Read-only public checks established that the npm version, local and
remote tag, and GitHub release were unused and that npm remained
`beta=latest=0.1.0` with `alpha=0.1.0-alpha.2`. The user authorized the named
Git force-update, annotated tag, GitHub prerelease, and npm `beta` publication
batch while leaving `latest` excluded. An expected-digest atomic batch
recalibrated cumulative velocity to `9p/2d`, completed the 3p candidate, and
removed the distribution block; `dag advance` removed the completed edge and
prior frontier. The resulting digest is
`sha256:5a3b88b673fa52d98dcb7ccad6442db2528d966b328fc178746722f6f38fe0a9`.
Two tasks and 8p remain; precedence and heuristic resource makespans are both
8p with no resource delay, and fresh complete `NextResult.v3` recommends
`RELEASE_020_DISTRIBUTION`.

The authorized distribution then replaced the prior WIP tip with release
commit `826b8ec3de2629aa3050a2affb8bdd79c4f5000b` through a lease-guarded
force update and fixed annotated `v0.2.0` at that commit. One retained tarball
passed the package and file-first gates, was attached to the GitHub prerelease,
and was published exactly once to npm `beta` through the process-limited
`NPM_TOKEN` route. Local, downloaded GitHub, and independently downloaded npm
bytes share SHA-256
`26ab6fc3f27574f293e985032d3701e4ca1ae69f2471e6c58d0a2e4bc0cbe52b`;
isolated Contract 3, renamed-command rejection, read-only agent guidance,
complete Next v3, and file-first checks passed. npm now reports
`beta=0.2.0`, `latest=0.1.0`, and `alpha=0.1.0-alpha.2`, so `latest` did not
move. Expected-digest batch and advance writes completed the 5p distribution
and 3p acceptance tasks, recalibrated cumulative velocity to `17p/2d`, and
left only reached `RELEASE_020_ACCEPTED`. The final digest is
`sha256:3ea3923fb7ae8ac5874e9856ac05f699d9de341f486ee9b9e7472fe028b7071b`;
fresh complete `NextResult.v3` has no recommendation. The durable evidence is
in [`0.2.0-release-acceptance.md`](0.2.0-release-acceptance.md).

After acceptance, the user explicitly selected the accepted `beta` version for
npm `latest`. One `secdat`-routed
`npm dist-tag add perttool@0.2.0 latest` operation changed only the default
tag. Prefer-online and direct registry reads confirmed
`beta=latest=0.2.0` and `alpha=0.1.0-alpha.2`; an isolated
`perttool@latest` installation reported `0.2.0` and returned CLI Contract 3.
The immutable release artifact and completed release plan were not changed.

### 4.1 Velocity measurement calibration

DSL version 1 has no working calendar, pause, or work-start time, so it does not convert the hours between commit timestamps into implicit engineering days. Measure the velocity of a self-use plan using the following definitive active-day method:

1. In the target plan, confirm that the same logical change as the commit that set the task to `done` has an acceptance artifact and test result.
2. Sum the declared points of tasks completed after the previous calibration.
3. Count the distinct Asia/Tokyo dates of the completion commits as active days.
4. Set `completed points / active days` as the project-wide team velocity.
5. Count parallel work on the same day only once as a day, while including it in the points total.
6. Defer tasks completed by the calibration itself to the next sample to avoid a cycle.

Recalibration from 2026-07-22 to 2026-07-29:

| Plan | Closed sample | Completed Point | Active day | Velocity | Remaining forecast |
| --- | --- | ---: | ---: | --- | --- |
| `grammar.pert` | `FORMATTER_ROUNDTRIP`, `HELP_FIXTURE_SYNC` | 3p | 1d | `3p/1d` | 0p |
| `control-plane.pert` | 9 tasks from `VISION_REQUIREMENTS` to `PROCESS_MIGRATION` | 16p | 1d | `16p/1d` | 1p = `1/16d` at calibration time |
| `operations.pert` | formatter/mutation preview, safe write, advance, project metadata CLI | 29p | 2d | `29p/2d` | 0p |
| `recommendation.pert` | `FIXTURE_BASELINE`, `RANKING_CORE`, `EXPLANATION_CORE`, `NEXT_V3_PUBLICATION`, `SELF_USE_SHADOW`, `OVERRIDE_VALIDATION`, `AUTHORITY_ADOPTION` | 22p | 1d | `22p/1d` | 0p |
| `agent-guidance.pert` | Total 5 tasks | 22p | 1d | `22p/1d` | 0p |
| `english-baseline.pert` | All 9 tasks through `ENGLISH_ACCEPTANCE` | 42p | 2d | `42p/2d` | 0p |
| `cli-surface-reset.pert` | All 9 tasks through `CLI_003_FILE_FIRST_ACCEPTANCE` | 49p | 1d | `49p/1d` | 0p |
| `release-0.2.0.pert` | All 5 tasks through `RELEASE_020_ACCEPTANCE` | 17p | 2d | `17p/2d` | 0p |
| `scheduling-units-m1.pert` | All 7 tasks through `M1_CONTRACT_REVIEW` | 24p | 1d | `24p/1d` | 0p |
| `scheduling-units-m2.pert` | All 6 tasks through `M2_FOUNDATION_ACCEPTANCE` | 24p | 1d | `24p/1d` | 0p |
| `scheduling-units-m2r.pert` | All 7 tasks through `RATIONAL_DURATION_ACCEPTANCE` | 24p | 1d | provisional `24p/1d` | 0p |

This is neither effort hours nor individual productivity; it is observed throughput per plan. Because the measured sample has few active days, its value is provisional and will be recalibrated when new active days or multiple task completions accumulate. Grammar implementation, control-plane design, operations and editing work, recommendation implementation, agent guidance, English-baseline migration, and the CLI-surface reset are not averaged because their work types differ. Future detail plans specify the sample from the closest work type as their initial value. `scheduling-units-m2.pert` initially inherited `24p/1d` from SU-M1, replaced it with its own sample after the first task, and now records all six completed SU-M2 tasks as cumulative `24p/1d` on the same active day.

`english-baseline.pert` completed 33p through help and usage on 2026-07-24,
then completed the 3p PERT-plan migration, 3p golden/Unicode audit, and 3p
final acceptance on 2026-07-29. Its cumulative observed velocity is
`42p/2d`; no work remains. This remains a two-day sample.

The `release-0.2.0.pert` workstream completed its 3p gate design and 3p source
preparation on 2026-07-24, then completed its 3p candidate, 5p distribution,
and 3p acceptance on 2026-07-25. Its cumulative observed velocity is
`17p/2d`, and no work remains.

Grammar was recalibrated after `FORMATTER_ROUNDTRIP` (2p) and `HELP_FIXTURE_SYNC` (1p) were completed on the same active day after the previous calibration, updating velocity to `3p/1d`. Because no work remains, the forecast is 0. Control-plane's `DESIGN_REVIEW` (1p) is deferred to the next calibration because the new sample still contains only one task.

Operations added `PROJECT_METADATA_CLI` (5p) on 2026-07-23 to formatter/mutation preview (12p), safe write (6p), and advance (6p) completed on 2026-07-22. The observed velocity was recalibrated to `29p/2d` from a cumulative 29p over two active days. The macro duration of the project-metadata task remains rounded to six decimal places from the `24p/1d` available at its start: `5/24d` = `0.208333d`. Current detail work remaining and resource delay are both 0p.

Recommendation implementation completed `FIXTURE_BASELINE` (2p), `RANKING_CORE` (4p), `EXPLANATION_CORE` (5p), `NEXT_V3_PUBLICATION` (4p), `SELF_USE_SHADOW` (2p), `OVERRIDE_VALIDATION` (3p), and `AUTHORITY_ADOPTION` (2p) on the same active day, 2026-07-23. Because it was completed in one day, its cumulative observed velocity was updated to `22p/1d` from 22p over one active day. The remaining resource makespan is 0p. As this is still a sample of only one active day, recalibrate on the next different active day or after multiple task completions.

Agent guidance completed `PROVIDER_BASELINE` (4p), `GUIDANCE_CONTRACT` (5p), `GUIDANCE_CORE` (5p), `AGENT_HELP_PUBLICATION` (5p), and `GUIDANCE_ACCEPTANCE` (3p) on the same active day, 2026-07-23, updating the provisional observed velocity to `22p/1d` from 22p over one active day. The sample includes cross-provider research, a public contract, normative examples, a versioned offline profile, a validator, queries/projections, machine-readable cases, deterministic text/JSON, structured command help, CLI/E2E, package-installed parity, security acceptance, and plan reanalysis; detail's remaining resource makespan is 0p. As this is still a sample of only one active day, recalibrate on the next different active day or after multiple task completions.

On 2026-07-26, `governance.pert` was added after Issue #4 was reviewed and
accepted as design input. It is an independent post-beta workstream for
project-model write authority, separate from recommendation override MIG-08.
Its requirements and contract tasks precede implementation; creating the plan
does not add authentication, activate governance checks, or authorize a
release.

Then `GOV_REQUIREMENTS` accepted the accidental-overreach threat model;
separate goal, DAG, and ordinary-maintenance scopes; effective `user` owners
with empty delegates for omitted metadata; caller-asserted principals and owner
confirmation; pre-change authorization; preview/write separation; batch,
import, and advance coverage; direct-edit guidance; and explicit
authentication, ranking, audit, and enforcement non-goals in requirements
Draft 0.15. The atomic completion and project-metadata candidate was previewed
from source digest
`sha256:e27992631183cf7dacae4da549cdd335a4822854ac8d11b7888a9db8457bb588`
and produced digest
`sha256:b23e0652b94e55021f76a61d510449c6a742371d4ce5ad6b1e5111c20b100ddd`.
The first accepted 3p sample establishes plan-specific velocity `3p/1d`.
There are 42p remaining, with a 30p precedence makespan, 37p heuristic
resource makespan, 7p resource delay, and forecasts of 10d and `37/3d`.
Complete NextResult v4 recommends `GOV_AUTHORITY_CONTRACT`;
`GOV_DSL_CONTRACT` is ready but deferred by the shared `DOC_SURFACE` and
`REVIEWERS` resources. Owner-aware runtime enforcement remains unavailable.

After the acceptance snapshot was committed at `e0dcf6f`, the advance preview
from digest
`sha256:b23e0652b94e55021f76a61d510449c6a742371d4ce5ad6b1e5111c20b100ddd`
removed both completed task `GOV_REQUIREMENTS` and its reached origin milestone
`ISSUE_4_ACCEPTED`, while retaining `REQUIREMENTS_ACCEPTED` as the reached
frontier. The advanced source digest is
`sha256:d90a7869b2737115b5f1a0bba06a444731051e9907cac5849d64d337acc80242`.
Reanalysis preserves the 42p remaining work, 30p precedence makespan, 37p
heuristic resource makespan, 7p resource delay, forecasts, ready set, and
`GOV_AUTHORITY_CONTRACT` recommendation, and clears `PTDAG-208`.

`GOV_AUTHORITY_CONTRACT` then accepted owner-aware governance semantics version
1. The contract fixes actual candidate-change classification; goal, DAG, and
ordinary-maintenance boundaries; owner/delegate and caller-asserted
confirmation decisions; pre-change self-authorization rejection; atomic
mixed-scope behavior; new-document and direct-edit limits; composition with
candidate validation, optimistic locking, and safe writes; and the stable
domain meaning and causes of `PTGOV-101`. It deliberately leaves DSL spelling,
public Core/CLI/JSON shapes, runtime enforcement, authentication, and durable
audit to later gates.

The atomic completion and project-metadata candidate was previewed from source
digest
`sha256:d90a7869b2737115b5f1a0bba06a444731051e9907cac5849d64d337acc80242`
and produced digest
`sha256:ea8ee6a0c60dd46246b2b2493964f8918b1ec58ee891264d0c6641c9aeb7c438`.
The cumulative 7p completed on one active day updates plan-specific velocity
to `7p/1d`. There are 38p remaining, with a 30p precedence makespan, 33p
heuristic resource makespan, 3p resource delay, and forecasts of `30/7d` and
`33/7d`. Complete NextResult v4 recommends and authorizes only
`GOV_DSL_CONTRACT`. The accepted snapshot retains `PTDAG-208` until the
completion edge is advanced. Owner-aware runtime enforcement remains
unavailable.

After the acceptance snapshot was committed at `ab823c7`, the advance preview
from digest
`sha256:ea8ee6a0c60dd46246b2b2493964f8918b1ec58ee891264d0c6641c9aeb7c438`
removed completed task `GOV_AUTHORITY_CONTRACT`, retained
`AUTHORITY_SEMANTICS_DEFINED` as a reached frontier alongside the still-needed
`REQUIREMENTS_ACCEPTED`, and produced digest
`sha256:15f91d1ab76e7fb2b2d0fe1cc44a7bb66478b8e68361f95d2b047bc2a3583a2f`.
Reanalysis preserves the 38p remaining work, 30p precedence makespan, 33p
heuristic resource makespan, 3p resource delay, both forecasts, and the sole
`GOV_DSL_CONTRACT` recommendation, and clears `PTDAG-208`.

`GOV_DSL_CONTRACT` then accepted governance source contract version 1.
Principal IDs reuse the case-sensitive ASCII Identifier form, delegate lists
retain source order while authority consumes sets, and duplicate delegates
fail with `PTSEM-113`. Explicit Grammar 4 inherits Grammar 3 and adds only the
four governance project fields; Grammar 1 through 3 remain valid through
declared omission and effective `user`/empty defaults. The contract fixes
atomic version upgrades, localized set/clear behavior, no automatic downgrade,
project init/show semantics, the exact generated direct-edit warning,
digest-bound pre-change snapshots, Grammar 4 unit-migration retention, and a
fail-closed Mermaid Profile v1 boundary without changing DAG, resource,
temporal, unit, recommendation, or normal start-authority semantics.

The atomic completion and project-metadata candidate was previewed from source
digest
`sha256:15f91d1ab76e7fb2b2d0fe1cc44a7bb66478b8e68361f95d2b047bc2a3583a2f`
and produced digest
`sha256:b04565729a8f33c1af3de57a94889747077c2e9b9f615a89ba1e4fdac717cd8f`.
The cumulative 11p completed on one active day updates plan-specific velocity
to `11p/1d`. There are 34p remaining, with a 26p precedence makespan, 29p
heuristic resource makespan, 3p resource delay, and forecasts of `26/11d` and
`29/11d`. The dedicated source-contract tests and all 520 unit tests pass.
Complete, non-truncated NextResult v4 recommends and authorizes only
`GOV_INTERFACE_CONTRACT`. The accepted snapshot retains `PTDAG-208` for
`DSL_CONTRACT_DEFINED` and `INTERFACE_INPUT_READY` until advance. Grammar 4
and owner-aware runtime enforcement remain unavailable.

After the acceptance snapshot was committed at `468c76f`, the advance preview
from digest
`sha256:b04565729a8f33c1af3de57a94889747077c2e9b9f615a89ba1e4fdac717cd8f`
removed completed task `GOV_DSL_CONTRACT`; gates
`GOV_DSL_INTERFACE_INPUT` and `GOV_AUTHORITY_INTERFACE_INPUT`; and historical
milestones `REQUIREMENTS_ACCEPTED`, `DSL_CONTRACT_DEFINED`, and
`AUTHORITY_SEMANTICS_DEFINED`. It retained `INTERFACE_INPUT_READY` as the
reached frontier and produced digest
`sha256:d02c20ac5665084ab757f82c10fab63aa4ad92ee54d8f5732e32a4137d9d571b`.
Reanalysis preserves 34p remaining, 26p precedence and 29p heuristic resource
makespans, 3p resource delay, both forecasts, and the sole
`GOV_INTERFACE_CONTRACT` recommendation while clearing both `PTDAG-208`
warnings.

`GOV_INTERFACE_CONTRACT` then accepted governance interface version 1. It
selects one optional caller-asserted actor, repeatable
`--accepted-by-owner`, one operation-level assertion set for atomic batch,
ProjectResult v3, MutationResult v2 with GovernanceDecision v1, PTGOV-101
under the existing domain-error exit 1, typed registry/help and `guide
editing` coverage, and one atomic Grammar 4/CLI Contract 5 cutover. Governed
preview remains successful without assertions and returns whether the
corresponding write is authorized. A denied persistent result retains its
reviewable candidate and decision with `written=false`, while an authorized
stale write remains PTIO-501/exit 5.

The atomic completion and project-metadata candidate was previewed from source
digest
`sha256:d02c20ac5665084ab757f82c10fab63aa4ad92ee54d8f5732e32a4137d9d571b`
and produced digest
`sha256:fde88f087fa285249566bf66b3ac7fe7581402435c46e7ade55c161bb47f3e48`.
The cumulative 15p completed on one active day updates plan-specific velocity
to `15p/1d`. There are 30p remaining, with a 22p precedence makespan, 25p
heuristic resource makespan, 3p resource delay, and forecasts of `22/15d` and
`5/3d`. Six dedicated interface-contract tests and all 526 unit tests pass;
the documentation, all 18 self-use plans, local link, package, and installed
file-first gates also pass. Complete, non-truncated NextResult v4 recommends
and authorizes only `GOV_NORMATIVE_EXAMPLES`. The accepted snapshot retains
`PTDAG-208` for `INTERFACE_CONTRACT_DEFINED` until advance. Grammar 4,
Contract 5, and owner-aware runtime enforcement remain unavailable.

After the acceptance snapshot was committed at `eed04f9`, the advance preview
from digest
`sha256:fde88f087fa285249566bf66b3ac7fe7581402435c46e7ade55c161bb47f3e48`
removed completed task `GOV_INTERFACE_CONTRACT` and historical milestone
`INTERFACE_INPUT_READY`. It retained `INTERFACE_CONTRACT_DEFINED` as the
reached frontier and produced digest
`sha256:f10dd3e1ebb5a672ac6db058273399ba53e8eadfccbe6891f74888fca268f303`.
Reanalysis preserves 30p remaining, 22p precedence and 25p heuristic resource
makespans, 3p resource delay, both forecasts, and the sole
`GOV_NORMATIVE_EXAMPLES` recommendation while clearing `PTDAG-208`.

`GOV_NORMATIVE_EXAMPLES` then accepted 15 authority and write-path cases as
one Markdown and machine-readable baseline. The cases fix omitted defaults,
governed preview without assertions, scope-local owner/delegate authority,
missing/matching/wrong owner confirmation, the independent actor requirement,
same- and distinct-owner batches, pre-change self-authorization rejection,
stale-digest composition, ordinary and byte-identical maintenance,
transformation and new-document boundaries, assertion validation, atomic
Contract 5 activation, and direct-edit guidance without authentication or
enforcement claims.

The atomic completion and project-metadata candidate was previewed from source
digest
`sha256:f10dd3e1ebb5a672ac6db058273399ba53e8eadfccbe6891f74888fca268f303`
and produced digest
`sha256:e9be2602378f21d7fd6181359c796cf29bac8c18c0ff397029b5d15860c0ec39`.
The cumulative 17p completed on one active day updates plan-specific velocity
to `17p/1d`. There are 28p remaining, with a 20p precedence makespan, 23p
heuristic resource makespan, 3p resource delay, and forecasts of `20/17d` and
`23/17d`. Six dedicated example-contract tests and all 532 unit tests pass;
the documentation, all 18 self-use plans, local link, package, and installed
file-first gates also pass. Complete, non-truncated NextResult v4 recommends
and authorizes only `GOV_DESIGN_ACCEPTANCE`. The accepted snapshot retains
`PTDAG-208` for `EXAMPLES_DEFINED` until advance. Grammar 4, Contract 5, and
owner-aware runtime enforcement remain unavailable.

After the acceptance snapshot was committed at `39f6162`, the advance preview
from digest
`sha256:e9be2602378f21d7fd6181359c796cf29bac8c18c0ff397029b5d15860c0ec39`
removed completed task `GOV_NORMATIVE_EXAMPLES` and historical milestone
`INTERFACE_CONTRACT_DEFINED`. It retained `EXAMPLES_DEFINED` as the reached
frontier and produced digest
`sha256:745adb51cd8e52272e1714566e2ce0013b05b29de1eae9c86f82495ad260b69e`.
Reanalysis preserves 28p remaining, 20p precedence and 23p heuristic resource
makespans, 3p resource delay, both forecasts, and the sole
`GOV_DESIGN_ACCEPTANCE` recommendation while clearing `PTDAG-208`.

`GOV_DESIGN_ACCEPTANCE` then accepted the cross-cutting Issue #4 design with
no open findings. The durable review traces all 10 Issue criteria, all 15
interface invariants, six source cases, 15 authority/write cases, and nine
explicit non-goal boundaries into the delivery gates. It resolves repeatable
distinct-owner confirmation, digest-bound pre-change self-authorization,
new-document import versus existing-document replacement, and direct-edit
guidance without claiming technical prevention. Authentication, recommendation
ranking, MIG-08 override audit/apply, Git integration, and release publication
remain separate.

The atomic completion and project-metadata candidate was previewed from source
digest
`sha256:745adb51cd8e52272e1714566e2ce0013b05b29de1eae9c86f82495ad260b69e`
and produced digest
`sha256:723fd69263973debb28e094521eeb428b4bdf51a9136b0ae05449a330063a02c`.
The cumulative 19p completed on one active day updates plan-specific velocity
to `19p/1d`. There are 26p remaining, with an 18p precedence makespan, 21p
heuristic resource makespan, 3p resource delay, and forecasts of `18/19d` and
`21/19d`. Five dedicated acceptance-review tests and all 537 unit tests pass;
the documentation, all 18 self-use plans, local link, package, and installed
file-first gates also pass. Complete, non-truncated NextResult v4 recommends
and authorizes the joint start of `GOV_AUTHORITY_CORE` and
`GOV_SOURCE_MODEL`. `GOV_GUIDANCE` is ready but deferred by the selected set's
`DEVELOPERS` and `DOC_SURFACE` use. The accepted snapshot retains `PTDAG-208`
for `DESIGN_ACCEPTED` until advance. Grammar 4, Contract 5, and owner-aware
runtime enforcement remain unavailable.

After the acceptance snapshot was committed at `07f536c`, the advance preview
from digest
`sha256:723fd69263973debb28e094521eeb428b4bdf51a9136b0ae05449a330063a02c`
removed completed task `GOV_DESIGN_ACCEPTANCE` and historical milestone
`EXAMPLES_DEFINED`. It retained `DESIGN_ACCEPTED` as the reached frontier and
produced digest
`sha256:e67a3f069aee26614418d7bd50f9de925e87d28895c08a9e28030ca53eb07789`.
Reanalysis preserves 26p remaining, 18p precedence and 21p heuristic resource
makespans, 3p resource delay, both forecasts, and the joint
`GOV_AUTHORITY_CORE` and `GOV_SOURCE_MODEL` recommendation while clearing
`PTDAG-208`. `GOV_GUIDANCE` remains ready but deferred by the selected
resource-feasible set.

The governance workstream subsequently completed and advanced every remaining
task through `GOV_ACCEPTANCE`; reached `GOVERNANCE_ACCEPTED`, the accepted
source/package boundary, and its `45p/2d` observation remain in the current
plan and acceptance record. After the user selected release-gate design as
the next task, Contract 5 `project init` created
`plans/release-0.4.0.pert` as Grammar 4 with explicit goal/DAG owner `user`.
One governed atomic batch changed both goal and DAG scopes using actor `codex`
and the user-authorized `accepted-by-owner user` assertion. It replaced source
digest
`sha256:069823f669f09617f8068e12614297b7c1ffe259d21c7cdf01df05ea007fa13c`
with
`sha256:89b4c2f74ee221500b90d3c5530eb02a9b74ee721d7d7b621ebf002c495ed110`.
An ordinary project-description clarification then produced snapshot digest
`sha256:3664c6149673f53221716d91c1a7fadf6eac15c02ac13ea230659c0ab286a0a1`.
After committed snapshot `eb74b6e`, canonical advance removed
`RELEASE_040_GATE_DESIGN` and `RELEASE_040_PLANNING_STARTED`, retained
`RELEASE_040_GATE_ACCEPTED` as the reached frontier, and produced current
digest
`sha256:6745eb3bd85eebf54a18408fb36841fd80bd176b6c18fa9d9bddb1fbeefd1f7d`.
The gate-design task is complete and advanced. Sixteen points remain;
the precedence makespan is 16p, and the heuristic resource makespan is
conditionally 16p if publication authorization is resolved at time zero.
Both inherited forecasts are `32/19d`, and complete NextResult v4 recommends
and starts only `RELEASE_040_CONTRACT_5_READINESS`.

The user then authorized only that readiness task. Read-only Issue #4 review
confirmed that the issue remains open with no comments or labels adding a
release-blocking finding. The accepted
[Contract 5 readiness record](0.4.0-contract5-readiness.md) verifies reached
governance acceptance, the public Grammar 4 and Contract 5 boundary, legacy
effective defaults, owner-aware safe-write behavior, the root/help/Guide
surface, and the installed file-first workflow. An ordinary, governance-not-
applicable atomic batch updated the release description and completed the 2p
readiness task from source digest
`sha256:6745eb3bd85eebf54a18408fb36841fd80bd176b6c18fa9d9bddb1fbeefd1f7d`
to
`sha256:009fa869798727cc67eeddcf08fcafa4e9e677433af1952b1c8a133ac3b0b7a9`.
After committed snapshot `9f100ab`, canonical governed advance removed the
readiness task and `RELEASE_040_GATE_ACCEPTED`, retained
`RELEASE_040_CONTRACT_5_READY` as the reached frontier, and produced current
digest
`sha256:f70120b3f46b0d2a9f74741a06dc0488217d94d5e1381e1f76506b30f1598100`.
The task is complete and advanced. Fourteen points remain; precedence and
conditional heuristic resource makespans are 14p with no resource delay,
both inherited forecasts are `28/19d`, and complete NextResult v4 recommends
and starts only `RELEASE_040_PREPARATION`.
`RELEASE_040_PUBLISH` is explicitly blocked pending a separate named
authorization; npm `latest` promotion and Issue #4 closure remain separate
post-acceptance decisions.

On 2026-07-28, the next bounded instruction completed and advanced
`RELEASE_040_PREPARATION`, aligned the package and tool version at `0.4.0`,
added the Contract 4-to-5 migration guidance, and passed the complete Node.js
22 repository and isolated-package gates. A later instruction authorized only
`RELEASE_040_CANDIDATE`. Candidate acceptance reverified 585 tests, 78
Markdown documents, six PERT examples, all nineteen self-use plans, the local
link and installed file-first package workflow. Read-only checks established
that `v0.4.0`, its GitHub Release, and npm `perttool@0.4.0` are absent; npm
remains `beta=latest=0.3.0` and `alpha=0.1.0-alpha.2`; and the required
protected routes are available without exposing credentials.

The accepted 392-file tarball is 402211 bytes with SHA-256
`010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a`.
Candidate completion leaves two tasks and 6p; precedence and conditional
heuristic resource makespans are 6p with no resource delay, observed
cumulative velocity is `13p/2d`, and both forecasts are `12/13d`. Complete
NextResult v4 has no startable recommendation while
`RELEASE_040_PUBLISH` remains blocked pending a separate named authorization.

Later on 2026-07-28, after that boundary was restated, the user authorized the
named `0.4.0` PUBLISH batch. Release commit
`6b341d1913bd943d872b14d7ef48645ac7b26667` was pushed; the annotated local
and remote tag peeled to that commit; and the GitHub prerelease published
`perttool-0.4.0.tgz` plus `SHA256SUMS`. The retained candidate, downloaded
GitHub asset, and independently packed npm registry tarball are byte-identical
at SHA-256
`010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a`.
The npm mutation returned `+ perttool@0.4.0`, then bounded immediate reads
exhausted propagation-time `E404` responses; no retry occurred. Later durable
reads verified package integrity, `beta=0.4.0`, unchanged `latest=0.3.0`, and
`alpha=0.1.0-alpha.2`. Both public tarballs passed the complete installed
Contract 5 package workflow, and an isolated registry installation reported
`perttool 0.4.0`. The PUBLISH snapshot recalibrates velocity to `16p/2d`;
one 3p acceptance task remains with a `3/8d` forecast, and complete
NextResult v4 recommends only `RELEASE_040_ACCEPTANCE`. npm `latest`
promotion and Issue #4 closure remain separate post-acceptance decisions.
After commit `486ae67` preserved the completed task snapshot, canonical
governed advance removed `RELEASE_040_PUBLISH` and
`RELEASE_040_CANDIDATE_ACCEPTED`, retained reached
`RELEASE_040_PUBLISHED`, and produced digest
`sha256:e7f1f67e134f0351ba676e6dabb576ab5ff13010958ae75f1d2f6e35a6b21769`.

Durable acceptance then reverified the GitHub and npm tarballs through the
complete installed Contract 5 package workflow, retained common SHA-256
`010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a`,
and completed `RELEASE_040_ACCEPTANCE`. All six release tasks and 19p are
accepted over two active days. The pre-advance snapshot has digest
`sha256:c1bf2fb42e79cf6f0f6b0d8280397ed30085e83dda33a2b27cc979b12173109e`,
zero precedence and heuristic resource makespans, no ready or recommended
task, and only the expected `PTDAG-208` advance warning. At acceptance npm
reported `beta=0.4.0`, unchanged `latest=0.3.0`, and
`alpha=0.1.0-alpha.2`. The user separately authorized a later one-time
`perttool@0.4.0` `latest` promotion; Issue #4 closure remains separate.
Commit `d016e59` preserves that completed task state. Canonical governed
advance then removed `RELEASE_040_ACCEPTANCE` and
`RELEASE_040_PUBLISHED`, retained reached `RELEASE_040_ACCEPTED`, and
produced digest
`sha256:9abdbbfbd8431d854977af74d1483777f822cb38afecf180022050bc5bbaf342`
with no diagnostic, ready task, or recommendation.

After the acceptance and advance commits were pushed, the user separately
selected `perttool@0.4.0` for npm `latest`. Process-scoped npm authentication
confirmed identity `mako10k`, and the one-time
`npm dist-tag add perttool@0.4.0 latest` operation succeeded. A fresh
uncached registry read reported `beta=latest=0.4.0` and
`alpha=0.1.0-alpha.2`. An unqualified isolated installation resolved
`perttool@0.4.0`, reported `perttool 0.4.0`, exposed CLI Contract 5, and
successfully checked the reached Grammar 4 release plan. The immutable
artifact and completed release plan were unchanged.

The user then selected and authorized the complete named `0.5.0` release and
an exact post-release local installation. Contract 6 `project init` created
`plans/release-0.5.0.pert` as Grammar 5 with explicit goal/DAG owner `user`;
one governed atomic batch established its six-task 19p release DAG and
completed the 3p `RELEASE_050_GATE_DESIGN` task. Git commit `1641a32` records
the exact completed pre-advance snapshot with five resources, seven
milestones, six tasks, and no gates. Canonical governed advance removed only
the gate-design task and planning-start milestone, retained reached
`RELEASE_050_GATE_ACCEPTED`, and produced residual digest
`sha256:914ee9f43985c5150ffc0e22b2a9be6d0d46540c008954179a3e0808d5083701`.
Sixteen points remain; precedence and heuristic resource makespans are both
16p with no resource delay, inherited release velocity is `19p/2d`, and both
forecasts are `32/19d`. Complete, non-truncated NextResult v5 under
`recommendation_v1_plus_release_gate` still recommends and starts only
`RELEASE_050_CONTRACT_6_READINESS`. The named authorization applies only
after each predecessor gate passes. npm `latest` promotion and Issue #4
closure remain separate decisions.

The [Contract 6 readiness record](0.5.0-contract6-readiness.md) then accepted
the reached project-actuals and English-baseline inputs, active Grammar 5 and
Contract 6 source/package boundary, retained compatibility and safe-write
controls, 33-command registry, and installed workflows. The 2p
`RELEASE_050_CONTRACT_6_READINESS` task is complete at pre-advance digest
`sha256:ce63915222107023f6a00d00620a3bc93caba00064465afcb17d927dfa231797`.
Git commit `ba84cd8` records that exact snapshot. Canonical governed advance
removed the readiness task and prior gate frontier, retained reached
`RELEASE_050_CONTRACT_6_READY`, and produced residual digest
`sha256:2768eed58c579c96f7cbbfc1d71ba7a1b77206b868d1f7d327614ed33b2d0ad9`.
Fourteen points remain; precedence and heuristic resource makespans are 14p
with zero resource delay, inherited forecasts are `28/19d`, and complete
NextResult v5 recommends and starts only `RELEASE_050_PREPARATION`.

Source preparation then aligned the `0.5.0` package, lockfile, CLI identity,
CHANGELOG, README, Contract 5-to-6 migration guidance, release tests, and
deterministic goldens. The complete Node.js 22 repository, temporary-link,
468-file isolated-package, and publish-normalization dry-run gates passed
without an external mutation. The 4p `RELEASE_050_PREPARATION` task is
complete at digest
`sha256:d87eac750abf15c3a0fb3518ddbccc567eaad4c3ae813b804ee6f2ff82d260ee`.
Git commit `e1e7ccf` records that exact snapshot. Canonical governed advance
removed the task and the prior readiness frontier, retained reached
`RELEASE_050_SOURCE_PREPARED`, and produced residual digest
`sha256:0e1643bad5486b447b59d0b4ca40d2462e16f31ea76e0c9969da5319d68d2b75`.
Ten points remain; precedence and heuristic resource makespans are 10p with
zero resource delay, inherited forecasts are `20/19d`, and complete
NextResult v5 recommends and starts only `RELEASE_050_CANDIDATE`.

Candidate acceptance reverified the clean source under Node.js v25.1.0,
version and channel identity, absent local and remote tag, absent GitHub
Release, unpublished npm version, unchanged dist-tag baseline, protected
routes, complete repository and installed-package gates, and one retained
468-file tarball. Its SHA-256 is
`f3ba9b3f52dd055618084bde5e9fa51e98adf3e0e29e10ac8c7e09fd4142208c`.
Canonical governed advance removed `RELEASE_050_CANDIDATE` and the prior
source frontier, retained reached `RELEASE_050_CANDIDATE_ACCEPTED`, and
produced residual digest
`sha256:f024e75607a866555dee4313ca8c272a0c6d56a2f4c5c4e213ac1d36b06e915c`.
Six points remain; precedence and heuristic resource makespans are 6p with
zero resource delay, observed velocity is `13p/1d`, forecasts are `6/13d`,
and complete NextResult v5 recommends and starts only
`RELEASE_050_PUBLISH`.

PUBLISH then pushed release commit `af819b4`, attached the retained tarball
and `SHA256SUMS` to the public `v0.5.0` GitHub prerelease, and published the
same bytes to npm `beta`. The candidate, GitHub, and npm tarballs are
byte-identical at SHA-256
`f3ba9b3f52dd055618084bde5e9fa51e98adf3e0e29e10ac8c7e09fd4142208c`.
Both public tarballs passed the complete isolated-package workflow. Fresh
registry reads report `beta=0.5.0`, unchanged `latest=0.4.0`, and
`alpha=0.1.0-alpha.2`. The publication command reported success, while its
five immediate verification polls observed propagation-time `E404`; no
publish retry occurred, and fresh registry plus direct HTTP reads established
durable publication. The exact evidence is in
[`0.5.0-publish.md`](0.5.0-publish.md). Git commit `94a8b62` preserves the
exact completed PUBLISH pre-advance snapshot. Canonical governed advance
removed the task and prior candidate frontier, retained reached
`RELEASE_050_PUBLISHED`, and produced residual digest
`sha256:dd834f22577b7336e900e34731a45d7353a3b02636d641284a170b2886a223b1`.
Three points remain; precedence and heuristic resource makespans are 3p with
zero resource delay, observed velocity is `16p/1d`, forecasts are `3/16d`,
and complete NextResult v5 recommends and starts only
`RELEASE_050_ACCEPTANCE`.

Release acceptance independently reread local and remote Git references, the
public GitHub prerelease and assets, fresh npm version metadata and dist-tags,
and all three tarball files. Candidate, GitHub, and npm bytes remain
identical, and both public tarballs again passed the complete isolated-package
workflow. The [acceptance record](0.5.0-release-acceptance.md) fixes those
results. All six tasks and 19p are complete at the observed `19p/1d`
velocity; precedence and heuristic resource makespans are zero, and complete
NextResult v5 has no ready, recommended, or startable task. Git commit
`bacd413` preserves the exact completed acceptance pre-advance snapshot.
Canonical governed advance removed the final task and published frontier,
retained reached `RELEASE_050_ACCEPTED`, and produced residual digest
`sha256:b8ade1fa4ea713407aebf6345fd21a1ef2a6092adbc0385fc9f2c19ede7954b5`.
The separately ordered exact global installation then replaced local
`perttool@0.4.0` with registry `perttool@0.5.0` in the active NVM prefix.
The resolved executable reports `perttool 0.5.0`; 33-command Contract 6 help,
Grammar 5 checking, and ProjectHistoryResult v1 reconstruction all pass. npm
`latest` and Issue #4 remain unchanged.

The user selected and authorized the complete compatible `0.5.1` patch
release on 2026-07-30 after requesting a self-review. The independent
`plans/release-0.5.1.pert` plan records five sequential tasks and 17p.
`RELEASE_051_SELF_REVIEW` and `RELEASE_051_PREPARATION` are complete at 8p
after verifying that all 33 existing command descriptors, 108 existing
package exports, result identities, Grammar 5, CLI Contract 6, and
representative normalized outputs remain compatible. The review corrected
available real-Git result validation and package wildcard-export consumption
coverage. Package, lockfile, CLI, CHANGELOG, README, release guidance, tests,
goldens, and the isolated package now identify `0.5.1`. All 652 tests, 105
Markdown documents, seven normative PERT examples, twenty-two self-use plans,
the temporary-link workflow, and the 491-file isolated-package workflow
passed under Node.js 22. Nine points remain; precedence and heuristic resource
makespans are both 9p with no resource delay, observed velocity is `8p/1d`,
both forecasts are `9/8d`, and complete NextResult v5 recommends only
`RELEASE_051_CANDIDATE`. No external write has occurred. npm `latest`
promotion and Issue #5 closure remain separate decisions.

Candidate acceptance then reverified the clean source under Node.js 22.22.3,
version and channel identity, absent local and remote tag, absent GitHub
Release, unpublished npm version, unchanged dist-tag baseline, protected
routes, complete repository and installed-package gates, and one retained
491-file tarball. Its SHA-256 is
`93f3e01a22a41a7260792cba8df3ec9e47deedd4647b8c61616bb58886941339`.
Canonical governed advance removed `RELEASE_051_CANDIDATE` and the prior
source frontier, retained reached `RELEASE_051_CANDIDATE_ACCEPTED`, and
produced residual digest
`sha256:3f7940749e87d3721af7ef384fd45537c622600fd4f9ed198c4d7af049d5265c`.
Six points remain; precedence and heuristic resource makespans are 6p with
zero resource delay, observed velocity is `11p/1d`, forecasts are `6/11d`,
and complete NextResult v5 recommends and starts only
`RELEASE_051_PUBLISH`.

PUBLISH then fixed release commit and peeled `v0.5.1` target `31d162a`,
successful Node.js 22 and 24 CI run 30509133874, byte-identical
candidate/GitHub/npm tarballs at SHA-256 `93f3e01a...1339`, npm
`beta=0.5.1` with unchanged `latest=0.4.0`, and complete isolated
public-package checks. The npm publication process returned success but its
bounded immediate verification exhausted five propagation-time `E404`
responses. No retry occurred; public, authenticated, and direct registry
reads then established durable publication. Three points remain; precedence
and heuristic resource makespans are both 3p with no resource delay, observed
velocity is `14p/1d`, both forecasts are `3/14d`, and complete NextResult v5
recommends and starts only `RELEASE_051_ACCEPTANCE`.

Durable acceptance then independently reread Git, GitHub, npm, artifact, and
dist-tag state and reran the isolated package gate against both public
tarballs. The exact `0.5.0` comparison confirms that the patch retains Grammar
5, CLI Contract 6, all 33 prior commands, all 108 prior exports, result
identities, and normalized payload meanings. All five tasks and 17p are done
at `17p/1d`; precedence and heuristic resource makespans are zero, and
complete NextResult v5 has no ready, recommended, or startable task. npm
`latest` promotion and Issue #5 closure remain separate decisions. Git commit
`9ecae00` records the exact completed acceptance pre-advance snapshot, and
canonical governed advance retains only reached `RELEASE_051_ACCEPTED`.

The user then separately selected `perttool@0.5.1` for npm `latest`.
Process-scoped authentication confirmed identity `mako10k`, and the one-time
`npm dist-tag add perttool@0.5.1 latest` operation succeeded. A fresh npm
read and the direct registry endpoint reported `beta=latest=0.5.1` and
`alpha=0.1.0-alpha.2`. An unqualified isolated installation resolved
`perttool@0.5.1`, reported CLI Contract 6 with 34 commands, checked the reached
Grammar 5 plan, and listed all eighteen root schemas. The immutable artifact
and completed release DAG were unchanged; tool-managed project metadata
records the post-promotion state.

The independent `release-0.5.2.pert` workstream then completed self-review,
source preparation, and candidate acceptance for complete nested schemas and
full and reference-based outline/detail views. The clean Node.js 22 candidate
passed 655 tests, 109 Markdown documents, seven normative PERT examples, all
twenty-three self-use plans, and the temporary-link and isolated-package
workflows. Its retained 491-file tarball has SHA-256
`e8512f0d3e20764e9397af827f6ea57f8bea7361d1e414102b0350bcaa54bbce`.

PUBLISH then fixed release commit and peeled `v0.5.2` target `501d4b1`,
successful Node.js 22 and 24 CI run 30517079581, byte-identical
candidate/GitHub/npm tarballs, npm `beta=0.5.2` with unchanged
`latest=0.5.1`, and complete isolated public-package checks. The publication
process and independent registry reads verified the version, integrity,
artifact identity, and dist-tags without a retry. Three points remain;
precedence and heuristic resource makespans are both 3p with no resource
delay, observed velocity is `14p/1d`, both forecasts are `3/14d`, and
complete NextResult v5 recommends and starts only
`RELEASE_052_ACCEPTANCE`. npm `latest` promotion and Issue #5 closure remain
separate decisions.

Durable acceptance then independently reread Git, GitHub, npm, artifact, and
dist-tag state, reran the isolated package gate against both public tarballs,
and compared installed `0.5.1` and `0.5.2` surfaces. All 116 prior runtime
exports and 34 command operations remain; the 33 non-schema descriptors are
byte-identical; the schema command retains `--format` and adds only `--view`
and `--ref`; and default/full, outline, and detail projections passed. All
five tasks and 17p are done at `17p/1d`; precedence and heuristic resource
makespans are zero, and complete NextResult v5 has no ready, recommended, or
startable task. Git commit `3f7cc04` records the exact completed acceptance
pre-advance snapshot, and canonical governed advance retains only reached
`RELEASE_052_ACCEPTED`. npm `latest` promotion and Issue #5 closure remain
separate decisions.

The independent `release-0.5.3.pert` workstream then selected the compatible
governance-guidance patch. Its five serial tasks cover compatibility and
threat-model review, version-bearing source preparation, one immutable
candidate, authorized GitHub/npm beta publication, and durable acceptance.
The initial 15p plan uses the preceding release's observed `17p/1d` velocity.
Self-review, source preparation, candidate acceptance, publication, and
durable acceptance are complete. Independent Git, GitHub, npm, artifact, and
installed-package checks accepted all five tasks and 15p. Both precedence and
heuristic resource makespans are zero, and complete NextResult v5 has no
ready, recommended, or startable task. The completed declarations remain
until a separately confirmed single-candidate `dag advance`; npm `latest`
promotion remains outside the named release scope.

The independent `release-0.5.4.pert` workstream then selected the compatible
governance-runtime-warning patch. Its five serial tasks cover trigger and
compatibility review, version-bearing source preparation, one immutable
candidate, authorized GitHub/npm beta publication, and durable acceptance.
The initial 15p plan uses the preceding release's observed `15p/1d`
velocity. Self-review, source preparation, and candidate acceptance are
complete after the clean repository, external preflight, protected-route, and
retained 491-file package gates passed. The candidate is 521641 bytes with
SHA-256 `d3123ef0...3c01`. At publication, release commit, remote main, peeled
tag, Node.js 22/24 CI, GitHub prerelease, npm `beta=0.5.4`, and the common
tarball agreed.
Independent public installation and PTGOV-103 default/strict verification
accepted all five tasks and 15p. Both makespans are zero, and complete
NextResult v5 has no recommendation. Completed declarations remain until a
separately confirmed `dag advance`; `latest=0.5.1` and npm `latest` promotion
remains outside the named release scope.

The independent `release-0.5.5.pert` workstream durably accepts the compatible
governed-preview-warning patch. Its five serial tasks cover compatibility
review, version-bearing source preparation, one immutable candidate,
authorized GitHub/npm beta publication, and durable acceptance. The 15p plan
uses `15p/1d` velocity. Compatibility self-review classified the original 10
governed invocations as five previews and five
persistent attempts. PTGOV-104 covers the five previews without reinterpreting
the persistent attempts. Release commit `04055c9`, peeled tag, successful
Node.js 22/24 CI, GitHub prerelease, npm `beta=0.5.5`, and the common
491-file, 522117-byte tarball agree. All five tasks and 15p are complete with
zero makespans and no recommendation. The user later separately authorized
one `latest` mutation and the exact displayed plan-advance candidate. Fresh
registry reads and an unqualified isolated installation confirmed
`beta=latest=0.5.5`, Contract 6, 34 commands, 18 schemas, and Grammar 5. The
governed advance used actor `codex`, owner assertion `user`, and the exact
preview digest. It removed the five completed tasks and five intermediate
milestones while retaining reached `RELEASE_055_ACCEPTED`; the residual plan
has no diagnostics, task, recommendation, or makespan.

The independent `release-0.6.0.pert` workstream selects the advance-history
safety beta minor. The user confirmed its exact 5,289-byte initial candidate
for goal and DAG scopes; the one write used actor `codex` and the scope-bound
owner assertion `user`. `RELEASE_060_SELF_REVIEW` is complete after a direct
Node.js 22 comparison with installed `0.5.5` confirmed unchanged Grammar 5,
CLI Contract 6, and prior advance JSON fields, plus the deliberate
`AdvanceResult.v1`, required nullable history guard, nineteenth root schema,
and exact force option. `RELEASE_060_PREPARATION` is complete after 712 tests,
29 self-use plans, 138 Markdown files, the temporary-link workflow, and the
504-file isolated-package gate passed under Node.js 22. Candidate acceptance
repeated the clean gate and protected-route preflight and retained one
504-file, 543508-byte tarball with SHA-256 `6d03e270...e42acd`. PUBLISH
completed from those exact bytes: release commit `935b097`, peeled tag,
successful Node.js 22/24 CI run `30631050662`, GitHub prerelease, npm
`beta=0.6.0`, and the three tarball copies agree. Independent acceptance
covered Git, both successful CI snapshots, GitHub, npm, artifact identity,
installed packages, and the repository-clean history guard. All five tasks
and 17p are complete with zero makespans and no recommendation. npm
`latest` remained `0.5.5` at release acceptance. The user later separately
authorized promotion, and the current registry baseline is
`beta=latest=0.6.0` with no maintained `alpha`; plan advance and Issue mutation
remain separate.

The independent `release-0.7.0.pert` workstream selects the first public
Grammar 6 and CLI Contract 7 package for conditional plan assurance. The six
serial tasks total 21p: release-gate design, accepted Contract 7 readiness,
source preparation, one immutable candidate, separately authorized PUBLISH,
and durable acceptance. The initial 2026-08-04 instruction authorized the
local gate-design task, and a later instruction separately authorized Contract
7 readiness; the next instruction separately authorized source preparation;
subsequent instructions authorized candidate acceptance and PUBLISH. The user
then separately authorized the exact `0.7.0` npm `latest` promotion, and a
following instruction authorized the narrow acceptance-condition replan and
durable acceptance.
Read-only external checks at the design decision point report
`beta=latest=0.6.0`, no maintained `alpha`, unused `0.7.0`, and remote main at
the earlier accepted ASSURE internal-core commit. The readiness record accepts
the exact completed ASSURE-001 input and active Contract 7 boundary.
Source preparation is complete before advance with package and CLI identity
`0.7.0`; `docs/process/0.7.0-preparation.md` records the migration, audit,
repository, temporary-link, and installed-package evidence. No candidate was
accepted or public state changed during preparation. `RELEASE_070_CANDIDATE`
is complete and accepted. Final review rejected the preliminary SHA-256
`7e57cc89...3ac8a0` tarball because its bundled README retained a transient
preparation-time claim; the intact bytes remain preserved under a SHA-bound
rejected filename. Corrected clean source commit `51984c8` passed the repeated
complete Node.js 22 and read-only external gates. Its retained 601-file,
656702-byte candidate has SHA-256 `8585adb5...f4d623` and passed isolated
Contract 7 file-first and plan-assurance acceptance. Push, tag, GitHub/npm
publication then completed under the user's separate authorization. Release
commit and peeled `v0.7.0` target `1279e3c` agree; Node.js 22 and 24 CI run
`30895944899` passed; the GitHub prerelease, npm `beta=0.7.0`, and all three
tarball copies agree at SHA-256 `8585adb5...f4d623`; at publication,
`latest=0.6.0` and `alpha` remained absent. Exactly one separately authorized
post-publication mutation later made `beta=latest=0.7.0`; an unqualified
isolated installation confirmed Contract 7, 44 commands, and 20 schemas.
Independent Git, CI, GitHub, npm, byte-identity, exact/beta/latest
installation, rollback-pin, and complete public-package verification passed.
All six tasks and 21p are complete with zero precedence and heuristic resource
makespans; fresh complete NextResult v6 has no ready, recommended, or startable
task. The acceptance record is `docs/process/0.7.0-release-acceptance.md`.
Both plan advances and Issue mutation remain separate.

The independent `help-guide-consistency.pert` workstream then corrected the
repository-wide Guide and Help review under
`docs/specs/help-guide-consistency.md`. Its four serial tasks total 14p and
cover the correction contract, active Guide and command Help, current and
historical documentation, and complete acceptance. The active Guide now
states AnalysisResult v5, NextResult v6, and the combined temporal and
plan-assurance authority directly; all 44 command examples pass active
argument parsing, every literal runtime diagnostic topic resolves, and
`PTCNV-210` is specified and directly tested. All four tasks are complete and
retained before advance with zero precedence and heuristic resource
makespans. Complete NextResult v6 has no ready, recommended, or startable task.
Release, remote writes, publication, Issue mutation, and plan advance remain
separate.

The independent `release-0.7.1.pert` workstream selects suffix-free `0.7.1`
for publishing the accepted `GUIDE-CONSISTENCY-001` runtime guidance
corrections. Its five serial tasks total 15p and separate compatibility
self-review, version-bearing preparation, one immutable candidate, PUBLISH,
and durable acceptance. The exact initial plan candidate was confirmed with
goal and DAG owner `user`. Compatibility self-review and version-bearing source
preparation are complete; package, lockfile, CLI, CHANGELOG, README, tests,
and package workflow identify `0.7.1`. Candidate acceptance is complete from
source commit `a05b769` and the retained 601-file, 660003-byte tarball with
SHA-256 `5bf47231...e4454c`; its exact record is
`docs/process/0.7.1-candidate.md`. PUBLISH is complete from release commit
`eee0f05`, CI run `30969627120`, peeled tag, GitHub prerelease, and one npm
`beta` publication of the identical artifact. The later separately authorized
promotion made `beta=latest=0.7.1`; exact, beta, latest, and rollback installs
passed. Durable acceptance is recorded in
`docs/process/0.7.1-release-acceptance.md`. All five tasks are complete with
zero makespans and no recommendation. Both plan advances and Issue mutation
remain separately gated.

The independent `release-0.8.0.pert` workstream selects suffix-free `0.8.0`
for the additive adapter-platform, historical-DAG, and declaration-identity
public-package boundary. Its six serial tasks total 22p and separate release-
gate design, accepted-input readiness, version-bearing preparation, one
immutable candidate, separately authorized PUBLISH, and durable acceptance.
The exact initial plan candidate was confirmed with goal and DAG owner `user`.
`RELEASE_080_GATE_DESIGN` accepts Requirements 21.15, ADR 0003, the Post-MVP
4S design slice, the release procedure, 45 commands, 21 schemas, 122 root and
Node exports, 45 Core exports, and private-adapter exclusions.
`RELEASE_080_INPUT_READINESS` directly rechecks the retained complete adapter
and historical plans and their final records plus `DECL-ID-001`; its completed
plan digest is `sha256:4b3f887a...386628cf5`. Package, lockfile, CLI, adapter
peer, tests, CHANGELOG, README, migration, and release records now identify
`0.8.0`. Source preparation passed all 973 tests, all 36 self-use plans,
isolated adapter gates, temporary linking, and the 679-file installed-package
gate; its completed plan digest is `sha256:0cce301f...858dc457`. Candidate
acceptance is complete from clean source commit `f9be1cc` and the retained
679-file, 2753740-byte tarball with SHA-256
`d761e2a1...1ac00b28`; its exact record is
`docs/process/0.8.0-candidate.md`. The separately authorized PUBLISH completed
from release commit `db5c2f8`, CI run `31154880011`, peeled tag, GitHub
prerelease, and one npm `beta` publication. Candidate, GitHub, and npm
tarballs are byte-identical; exact and beta installed acceptance passed.
Durable acceptance is recorded in
`docs/process/0.8.0-release-acceptance.md`. All six tasks and 22p are complete
with zero makespans and no recommendation. At acceptance, npm `latest`, public
VSIX publication, both input-plan advances, release-plan advance, and Issue
mutation remained separately gated. The user later separately authorized one
npm `latest` mutation. Direct registry and fresh-cache npm reads established
`beta=latest=0.8.0`, no `alpha`, and unchanged package integrity; unqualified
global and isolated installations resolved to `perttool 0.8.0`, 45 commands,
and 21 schemas. The exact post-acceptance record is
`docs/process/0.8.0-latest-promotion.md`. Public VSIX publication, both
input-plan advances, release-plan advance, and Issue mutation remain separate.

The explicitly selected `adapter-platform.pert` workstream composes the
previously separate LSP, VSIX, and MCP backlogs behind one accepted shared
architecture boundary without making MCP depend on the editor branch. Its 16
tasks total 91p and cover the cross-adapter dependency contract, reverse-
dependency cleanup, shared library and Node ports, CLI compatibility,
versioned editor protocol, document session, read-only LSP, VSIX shell and DAG
Webview, fail-closed read-only MCP, and integrated acceptance.
`ADAPTER_ARCHITECTURE_CONTRACT`, `CORE_DEPENDENCY_CLEANUP`,
`SHARED_LIBRARY_BOUNDARY`, `EDITOR_PROTOCOL_CONTRACT`, and
`DOCUMENT_SESSION_CORE` are complete with exact start/finish evidence and
retained before advance. The normative
contract fixes the 121-export, 44-command, 20-schema baseline, exact twelve-
file/nineteen-import migration input, dependency directions, Core/Node
subpaths, private adapter distribution inputs, capability ownership, and
semantic parity. The cleanup moves five reusable implementations to neutral
owners behind exact compatibility facades, inverts analyzer and override
dependencies, and enforces that only CLI and package-root composition import
Application externally. The shared-library slice establishes the original
forty-name portable Core, the exact 121-name Node facade, root-identical
Grammar 6 source functions, and isolated export-map consumption without adding
a production dependency or release. Editor protocol model 1 fixes stable LSP
3.17, exact URI/generation/version and UTF-16 behavior, cancellation and stale
rejection, the closed read-only capability set, `Perttool.GraphViewResult.v1`,
four DAG
analysis modes, source navigation, VS Code `^1.101.0`, offline server
distribution, workspace trust, restrictive CSP, and accessibility. The
document-session slice adds five Core-only runtime values for frozen
URI/generation/version/digest snapshots, exact UTF-16 changes, stateless and
stateful validated-snapshot analysis, snapshot-scoped completed caches, and
cancellation/stale rejection. The current Core is an exact portable 45-name,
34-module closure. The accepted six-port Node Host boundary adds one default
Node composition and a portable semantic SHA-256 owner; root and Node now
remain exact 122-name facades. The private
`adapters/lsp` workspace implements the accepted stable LSP 3.17.5 stdio
surface, versioned read-only projections, negotiated Help and four-mode
GraphView, cancellation/stale rejection, and public-package isolation.
`LSP_READ_CORE`, its isolated dual-tarball `LSP_ACCEPTANCE`, and the private
`VSIX_SHELL` are complete with exact lifecycle evidence and retained before
advance. The VSIX shell fixes VS Code `^1.101.0`, exact language client 9.0.1,
TextMate presentation, untrusted/virtual workspace support, version-bound
virtual Help, and an offline bundled server in an eleven-file disposable
package without adding the DAG Webview. `NODE_PORT_BOUNDARY` is complete from
exact start event
`WE-9ec8f2ce85327b3830e27b14b00d04e0ecd4567bedeb433d5dfa8c221bb1fdd6`
at `2026-08-05T18:48:48+09:00` through finish event
`WE-9d9be8b2b1b21978a34a3b84f0de4919890b7c25a551cbcad87e852841d808d6`
at `2026-08-05T19:02:00+09:00`, with exact active time and effort `11/50h`
and `11/50ph`. The accepted [read-only MCP
contract](../specs/mcp-read-contract.md) fixes final revision `2026-07-28`,
exact stable server SDK `2.0.0`, local stdio, four immutable resources, five
closed read-only tools, exact inline and digest-bound registered sources,
adapter-owned results, failure ownership, hard limits, and parity without a
CLI subprocess. `MCP_READ_CONTRACT` starts with event
`WE-a53bbaf695f8dff592f835bbb58f8e3e9d9f5989351960ec82510fe22d02d970`
at `2026-08-05T19:17:13+09:00` and finishes with event
`WE-7145073435056597697b7c3e713ccc715273d1bfce06a750ad63f2f74aad4032`
at `2026-08-05T19:45:00+09:00`, with exact active time and effort
`1667/3600h` and `1667/3600ph`. Six tasks and 32p remain; precedence makespan
is 16p and the `parallel-sgs` version 1 heuristic resource makespan is 25p
with 9p resource delay. Complete NextResult v6 recommends and makes startable
exactly `MCP_READ_ADAPTER` and `VSIX_DAG_VIEW`; `CLI_FACADE_PARITY` is deferred
by the current resource-feasible selection. Source digest is
`sha256:e4461dc339d58773a08d13d857c2ffdbca1245748aa9e9db57458a5bbdc9ed72`.
Editor and MCP mutation, release selection, publication, remote writes, Issue
mutation, and plan advance remain separate.

The separately selected `editor-mutations.pert` workstream implements GitHub
Issue #13 without retroactively changing `ADAPTER-001`. Its 11 serial tasks
total 77p from `EDITOR_MUTATION_CONTRACT` through
`EDITOR_MUTATION_ACCEPTANCE`. The accepted
[Tiered Editor Mutation Contract](../specs/editor-mutations.md) fixes additive
Editor Protocol model 2, the strict `E0 < E1 < E2 < E3` classification of one
complete final candidate, complete semantic fingerprint evidence, exact
document and candidate bindings, independent recovery, staged interaction,
candidate-bound governance and assurance, exact advance history safety,
closed diagnostics, hard limits, and model-1 compatibility. The contract task
activates no mutation capability; the active private LSP still selects only
model 1 and does not advertise document formatting. Its separately confirmed
conformant outcome was written once with actor `codex`, the candidate-bound
`user` assertion, accepted basis `sha256:166d04ca...0294b6`, and resulting
source digest `sha256:e5ebb94a...9436ca`. Complete assurance has no required
action, and fresh complete NextResult v7 recommends only
`EDITOR_FORMAT_CORE`. Later repair, recoverable-edit, and authority-sensitive
slices remain dependency gated. MCP mutation, public VSIX publication,
release selection, remote writes, Issue mutation, and plan advance remain
separate.

`EDITOR_FORMAT_CORE` then adds the pure
`Perttool.EditorSemanticFingerprint.v1` owner to the portable Core closure and
one session-level E0 format projection. The proof accepts only exact normalized
Core formatter edits whose complete Grammar 1 through 7 candidate validates,
has the same semantic fingerprint, reproduces the candidate bytes, and is
idempotent. The private LSP now selects model 2 from an ordered `[2, 1]` offer
and advertises only `textDocument/formatting`; model-1 connections remain
read-only. URI/generation/version/source-digest binding, UTF-16 edits,
cancellation, staleness, invalid and truncated input, malformed formatter
results, fixed limits, and production stdio Grammar 7 behavior are covered by
fourteen dependency-ordered cases. The server returns edits only and performs
no filesystem, Git, CLI, settings, or editor mutation. The VSIX still offers
model 1, so Format Document and format-on-save integration remain in the next
task. E1 through E3, release, public VSIX publication, remote writes, Issue
mutation, and plan advance remain separate.

After the complete Node.js 22 gate and exact implementation review,
`EDITOR_FORMAT_CORE` was marked done with one expected-digest status-only
write. The source digest changed from `sha256:3323fecd...cc627d` to
`sha256:32606859...f7609b`; governance was not applicable, and no owner
assertion was supplied. Implementation commit `5245235` is the bounded
artifact evidence. The reached-milestone criterion set, its receipt, and the
plan-assurance outcome are separate candidate-bound owner-confirmation steps.
The criterion set was separately confirmed and written once with the
candidate-bound `user` assertion, changing the plan digest from
`sha256:32606859...f7609b` to `sha256:9f6b3d2a...152486`. Readback retained
reached closure and pending acceptance. The receipt was separately confirmed
and written once with a fresh candidate-bound `user` assertion, changing the
digest to `sha256:21ec01eb...a2bbaa`. Readback reports accepted milestone
evidence with no blocking criterion. At that boundary the outcome remained
unwritten, so `EDITOR_FORMAT_ACCEPTANCE` was not yet start-authorized. The
conformant outcome was then separately confirmed and written once with a fresh
candidate-bound `user` assertion and accepted basis
`sha256:7c0e42ed...92572`, changing the
plan digest to `sha256:690f65bd...a8b79a`. Complete assurance has no
unavailable task, mismatch, replan requirement, or required action. Fresh
complete NextResult v7 recommends and makes startable only
`EDITOR_FORMAT_ACCEPTANCE`.

The `EDITOR_FORMAT_ACCEPTANCE` implementation then activates E0 in the private
VSIX without changing the private package identity. The client offers the exact
ordered `[2, 1]` models, accepts model 1 for the existing read-only results, and
forwards standard whole-document formatting only after model 2 is confirmed.
VS Code owns explicit Format Document and user-enabled format-on-save
application; the extension contributes no setting and implements no private
format command. E1 through E3 and range/on-type formatting remain absent.

Implementation commit `a5729f7` adds eighteen dependency-ordered cases and a
disposable supported-host probe. Exact VS Code 1.101.0 trusted and untrusted
hosts accepted local BOM/CRLF/comment/Unicode formatting, user-enabled format-
on-save, an untitled virtual document, invalid and no-op results, range-
formatting absence, non-target identity, isolated replacement, and uninstall.
The acceptance record is
[editor-format-acceptance.md](editor-format-acceptance.md). The status-only
completion changed plan digest `sha256:690f65bd...a8b79a` to
`sha256:e8bce9a2...e04105` without an owner assertion. The criterion set, receipt,
and conformant outcome were then separately confirmed with fresh candidate-
bound `user` assertions. The receipt binds integrated merge revision `a569a47`;
the outcome binds accepted basis `sha256:2163ddab...58f823e0`; and final plan
digest `sha256:62b134ef...53ad48` has complete assurance with no required
action. Fresh complete NextResult v7 recommends only
`EDITOR_REPAIR_CONTRACT`. Its accepted
[E1 child contract](../specs/editor-repairs.md) fixes registry version 1 to the
single `duration_unit_to_point` repair with an existing compatible velocity,
all plan tasks unsealed before and after, atomic versioned Quick Fix/Fix All,
exact recovery, and strict escalation at protected, lifecycle, work-event,
governance, history, or destructive boundaries. Its 22 dependency-ordered
cases and contract-only runtime check are recorded in
`test/fixtures/editor-repair-contract-v1.json` and
`docs/process/editor-repair-contract-acceptance.md`. The contract artifacts are
complete. The status-only completion, separately confirmed criterion set and
receipt, and separately confirmed conformant outcome bind implementation commit
`e4681530`, accepted basis `sha256:9f7292b4...08f6a6`, and final plan digest
`sha256:fac511d0...87af00`. Complete assurance has no required action, and fresh
complete NextResult v7 recommends and makes startable only
`EDITOR_REPAIR_ACCEPTANCE`. No release, persistent VSIX installation, public
publication, remote write, Issue mutation, or plan advance occurred in this
contract slice.

The following live open-Issue review then reset the product interruption order
without rewriting the selected plan. Seven Issues were open. Issue #19 /
`ADV-006` is the sole P0 and pauses `EDITOR_REPAIR_ACCEPTANCE`; Issues #7 /
`ACT-004` and #6 / `ACT-005` are P1; Issues #13, #18, and #12 are P2; and
Issue #3 is P3. Repository inspection confirmed the #19 retained-criterion,
#7 Velocity-token/parser, and #6 rename-control boundaries. Exactly one remote
mutation changed #7 from P0 to P1, and immediate plus complete readback showed
one priority label on every open Issue. The durable trace is
[issue-priority-review-2026-08-14.md](issue-priority-review-2026-08-14.md).
The subsequent local Issue #19 correction used llmthink to distinguish the
record-ownership cause from the stale-final-diagnostics detection escape. The
advance composition now protects all retained milestone records through
`keptMilestoneIds`, preserves explicit removed-milestone contraction, and
checks the complete Contract 8 candidate before projecting diagnostics. The
synthetic branch case and read-only image-platform replay are recorded in
[issue-19-advance-criterion-acceptance.md](issue-19-advance-criterion-acceptance.md),
with the structured RCA in
[issue-19-advance-criterion-rca.think](issue-19-advance-criterion-rca.think).
No release, remote source push, Issue close, or plan advance followed from the
priority review or local correction.

The later separately authorized `0.9.4` release, durable acceptance, Issue #19
closure, and release-plan advance removed that P0 interruption. Final live
readback found no open P0; Issues #7 and #6 remain P1, and the selected editor
workstream resumed from `EDITOR_REPAIR_ACCEPTANCE`. Its llmthink RCA identified
a deliberate activation gap: the exact unit-migration service existed, but no
E1 whole-candidate evaluator, Application composition, or edit-bearing LSP
mapping existed after contract acceptance. The local implementation now adds
those three bounded owners, activates only model-2 `quickfix` and
`source.fixAll.perttool`, and retains model 1, E0 formatting, public counts,
direct-write ownership, release, and persistent VSIX state. The 24-case trace
is [editor-repair-acceptance.md](editor-repair-acceptance.md); durable
milestone evidence and the subsequent plan frontier remain separately gated.

Stage 1 allowed operations:

- check
- analyze
- next
- check/analyze/next results in CLI JSON
- `document format` preview, diff, check, and JSON results
- text/JSON results for `project show`, and preview, diff, and JSON results for `project set`
- preview, diff, and JSON results for task/milestone/resource changes and atomic batches
- a preview of Mermaid export, when it is available read-only

Stage 1 prohibited operations:

- `document format --write`
- `project set --write`
- `task ... --write`
- `milestone ... --write`
- `resource ... --write`
- `dag advance --write`

## 5. Relationship between detailed plan and macro

### 5.1 First grammar plan

`plans/grammar.pert` contains only items that were incomplete when the plan was created.

Expected task groups:

- finalize lexical rules
- finalize indentation and block rules
- finalize identifier, string, and comment rules
- finalize project, milestone, task, and gate grammar
- finalize duration and estimate grammar
- finalize resource, capacity, requires, and priority grammar
- EBNF and sample alignment
- parser error recovery
- source span
- formatter round-trip
- help sample synchronization

Do not add already-completed work merely to recreate history. Refer to Git for necessary historical information.

### 5.2 Relationship with macro plans from MVP to beta

`plans/mvp.pert` contains only the M1–M8 stage gates and work packages. `GRAMMAR_WORK_PACKAGE` rolls up the resource makespan and velocity forecast from `plans/grammar.pert`; `CONTROL_PLANE_DESIGN_WORK_PACKAGE` does so from `plans/control-plane.pert`; the M1–M4 operations work packages do so from `plans/operations.pert`; `RECOMMENDATION_IMPLEMENTATION` does so from `plans/recommendation.pert`; and `AGENT_GUIDANCE_IMPLEMENTATION` does so from `plans/agent-guidance.pert`. It does not duplicate the state management of their internal tasks.

- macro milestone and overall critical path: `mvp.pert`
- current grammar implementation tasks and resource waits: `grammar.pert`
- current AI workflow-control design tasks and resource waits: `control-plane.pert`
- current operations implementation tasks and resource waits: `operations.pert`
- current recommendation implementation tasks and resource waits: `recommendation.pert`
- current AI Agent Guidance implementation tasks and resource waits: `agent-guidance.pert`
- Completed post-beta English surface migration: `english-baseline.pert`
- Independent post-beta owner-aware mutation governance: `governance.pert`
- Independent post-beta CLI/help reset: `cli-surface-reset.pert`
- Independent Contract 3 `v0.2.0` release: `release-0.2.0.pert`
- Completed independent Contract 4 `v0.3.0` release: `release-0.3.0.pert`
- Completed independent Contract 5 `v0.4.0` release: `release-0.4.0.pert`
- Accepted, advanced, and exactly locally installed independent Contract 6
  `v0.5.0` release: `release-0.5.0.pert`
- Current compatible Contract 6 `v0.5.1` patch release:
  `release-0.5.1.pert`
- Independent scheduling/unit milestone roadmap: `scheduling-units.pert`
- Completed detail only to SU-M1: `scheduling-units-m1.pert`
- Completed and advanced target-only source/Core detail to SU-M2:
  `scheduling-units-m2.pert`
- Completed exact rational Duration detail before SU-M3 and SU-M4:
  `scheduling-units-m2r.pert`
- Current temporal deadline and NextResult v4 target Core detail:
  `scheduling-units-m3.pert`
- Completed exact unit-migration Core detail: `scheduling-units-m4.pert`
- after selecting a workstream in the macro plan, select daily tasks from the corresponding detail plan
- update the corresponding macro task to `done` only when its detail slice is complete
- `M1_ROADMAP_UPDATE` is complete and decomposed formatter preview, mutation preview, safe write, and advance into the operations detail plan
- formatter/mutation preview, safe write, and advance Core/CLI are complete; the workflow moved to Stage 3
- `MERMAID_PROFILE`, `MERMAID_EXPORT`, `MERMAID_ROUNDTRIP`, and `ADVANCE` are complete. A release audit identified the missing condition 16, so `RECOMMENDATION_IMPLEMENTATION` was added to the macro release gate
- the MVP public alpha, including `RELEASE_E2E`, is complete
- Issue #2 and `AGENT_GUIDANCE_IMPLEMENTATION` are accepted, and the detail plan has been advanced to 0p remaining work
- the suffix-free `v0.1.0` beta is accepted, and the macro has advanced to `M8_BETA_RELEASED` with no remaining or recommended task
- Issue #3 is a future backlog-hierarchy and multi-plan-composition design and does not add work packages to the current macro
- the LSP server, VSIX, and MCP server are independent post-first-beta backlogs and do not add work packages to the current macro
- The independent English-baseline migration completed and advanced all nine tasks through `ENGLISH_ACCEPTANCE`; commit `2001cdf` records the final-task pre-advance snapshot, the final acceptance record traces ADR 0004 across the canonical surfaces, and complete NextResult v5 has no ready, recommended, or startable task.

For the explicitly selected scheduling-and-units workstream, first use a fresh
complete `NextResult.v3` from `scheduling-units.pert` to select the milestone
work package. Then use the current `scheduling-units-m*.pert` detail plan to
select the daily task. Do not duplicate detail-task status in the macro. When a
detail finish is reached, complete and advance the corresponding macro work
package once, re-estimate the remaining provisional macro packages, and create
only the next milestone-detail plan from the accepted contract.

### 5.3 AI process control design plan

`plans/control-plane.pert` decomposes Issue #1's design acceptance criteria in the following order.

1. Product vision and requirement boundaries
2. Separation of lifecycle/eligibility, resource selection, and recommendation tiers
3. Deterministic ranking policy, stable reason codes, and the human-override contract
4. Structured reason descriptions and decision traces
5. Core, text, and JSON interface contracts
6. Normative examples, test perspectives, and self-use and migration policies
7. Cross-cutting design review

Put normative recommendation content in `docs/requirements.md` and the corresponding `docs/specs/`; do not use plan descriptions as substitutes for specifications. This detail plan covers design only and does not include implementation changes to `dag next` or Core APIs.

### 5.4 Recommendation implementation and transition to self-use

[Recommendation implementation and self-use migration](recommendation-migration.md) is authoritative and separates the following:

- internal Core implementation
- `NextResult.v3` atomic publication
- self-use shadow evaluation
- normal recommendation authority adoption
- override apply/audit adoption after safe-write

V3 publication alone does not replace the current manual task-selection rule. Keep the manual selection procedure in the [AI development guide](ai-development.md) until the shadow gate and shared-instruction update are complete. The safe-write gate is met, but override application remains unavailable until MIG-08 verification and the audit contract are complete. If operations and recommendation implementation conflict over resources or file ownership, use the macro plan to determine their order, including operations work that proceeds to Stage 3.

## 6. Stage 2: safe-write self-use

The entry conditions were met and the workflow moved on 2026-07-22. For the first authoritative write, the preview diff and initial digest for `SAFE_WRITE_ACCEPTANCE` were checked, then `task finish --write` was applied to `plans/operations.pert` with an expected digest. The check/analyze/next results and self-use golden were updated afterward.

Entry conditions:

- formatter is idempotent
- regression tests preserve comments, declaration order, and block text
- mutation uses local TextEdits for source spans
- the document is reparsed and revalidated after changes
- unified diffs can be previewed
- writes are atomic
- expected digests reject conflicts
- `plans/grammar.pert` has a round-trip golden test

Additional operations allowed:

- `document format --write`
- `project set --write`
- `task add|set|remove|finish --write`
- `gate add|set|remove --write`
- `milestone add|set|remove --write`
- `resource add|set|remove --write`
- `batch apply --write`
- `--out` for the editing commands above, and `--expect-digest` for in-place `--write`

Procedure:

1. Always obtain a preview first.
2. Confirm that the diff does not extend beyond the target task or milestone.
3. Rerun check/analyze/next after the write.
4. Include the `.pert` change and its corresponding specification and implementation in the same logical commit.

## 7. Stage 3: advance self-use

The entry conditions were met and the workflow moved on 2026-07-22. Partial joins, complete projects, BOM/CRLF, and invalid input were covered by Core tests; CLI preview/write/repeated no-op behavior was covered by CLI/E2E tests; and the completed state of `ADVANCE_CLI_ACCEPTANCE` and macro `ADVANCE` was recorded using Stage 2's safe `task finish --write`. `dag advance --write` may subsequently be used on an authoritative plan when the following procedure is followed.

Entry conditions:

- a join fixture includes a `done` task
- a test compares the effective reached set and ready set before and after advance
- a test preserves `done` tasks necessary to determine joins
- a test removes only unnecessary historical subgraphs
- rollback-capable Git operations are verified

Additional operations allowed:

- `dag advance --write`

Advance procedure:

1. Set the task to `done`.
2. Check the new reached closure with next/analyze.
3. Commit the exact pre-advance plan snapshot, including the `done` transition
   and any comments or field changes that advance may remove.
4. Confirm that the target path is tracked in `HEAD` and has no staged,
   unstaged, or untracked difference from that committed snapshot. Unrelated
   dirty paths do not prevent this check.
5. Check the advance preview and diff.
6. Check the list of tasks, gates, milestones, state values, and owned comments
   to be removed or replaced.
7. Confirm that `Perttool.AdvanceResult.v1.history_guard` reports the expected
   destructive IDs and a passing repository/path/`HEAD`/stage-0-index proof.
   Write with the reviewed source digest, then check the reached closure,
   ready set, analysis, and next result again.
8. Commit the advanced present/future plan as a second logical change.

The runtime permits dirty source ranges retained by the candidate, but this
repository procedure deliberately keeps the exact plan snapshot clean and
committed before advance. `--force-history-loss` is not part of normal
self-use authority and is never inferred from an earlier command or approval.

The active project-actuals contract makes task-owned work events part of the
exact pre-advance snapshot and removal review. Its Grammar 5 source Core is
accepted in
[`project-actuals-source-core-acceptance.md`](project-actuals-source-core-acceptance.md),
and internal eventful finish and task-owned advance removal are accepted in
[`project-actuals-finish-acceptance.md`](project-actuals-finish-acceptance.md).
First-parent semantic reconstruction, explicit-event removal,
qualified legacy transitions, and exact task summaries are accepted in
[`project-actuals-history-acceptance.md`](project-actuals-history-acceptance.md).
Start, suspend, resume, resource release, and suspended result
handling are accepted in
[`project-actuals-lifecycle-acceptance.md`](project-actuals-lifecycle-acceptance.md).
Exact elapsed-hour, qualified active-date, effort-productivity, and
Git-recorded observations are accepted in
[`project-actuals-velocity-observation-acceptance.md`](project-actuals-velocity-observation-acceptance.md).
The current source package root, CLI, exact-pinned `0.5.5`, and published npm
`beta=0.6.0` package activate Grammar 5 and Contract 6 atomically. Use
only the public root and CLI names; target-prefixed modules remain internal
implementation details. Grammar 4 and Contract 5 remain available by pinning
`0.4.0`.
The active contract is
[`docs/specs/project-actuals.md`](../specs/project-actuals.md), and the
source-cutover evidence is
[`project-actuals-public-contract-acceptance.md`](project-actuals-public-contract-acceptance.md).
The complete fourteen-case repository, real-Git, linked, packaged, and
installed-workflow trace is accepted in
[`project-actuals-acceptance.md`](project-actuals-acceptance.md). The source
workstream has zero remaining makespan and no ready, recommended, or
startable task. Git mutation and automatic declared-velocity adoption remain
separate boundaries.

The runtime history guard in backlog
[`ADV-001`](../backlog.md#adv-001-guard-advance-writes-that-can-erase-uncommitted-history)
is not implemented. Until it is accepted, do not use in-place
`dag advance --write` when the exact target-file snapshot has not first been
committed. Use preview or `--out` to retain the source instead. Staging alone
is not durable history, and the current `--expect-digest` control detects
source races but does not prove that removed information exists in Git
history.

## 8. Stage 4: Scope expansion

The MVP macro plan is used from Stage 1 to confirm overall milestones. After read-only operation began with the grammar plan, the Issue #1 control-plane design plan and M1–M4 operations plan were added to Stage 1. After the MVP public alpha was accepted, Issue #2 was expanded into a detail plan as a beta gate. Issue #3 remains an independent backlog. The current order is:

- formatter and mutation preview
- safe write
- advance
- recommendation implementation based on Issue #1's design results after safe write
- Mermaid conversion
- perttool-wide MVP release plan
- the read-only AI Agent Guidance Registry in Issue #2 after the MVP public alpha
- the suffix-free `0.1.0` beta release after Issue #2 is accepted
- After the suffix-free `0.1.0` beta release, migrate the repository to the English baseline
- refine and deliver temporal properties, deadline-aware capabilities, and safe point/time-unit migration through the SU-M0 to SU-M5 milestone roadmap
- deliver Issue #4 owner-aware governance, then release its accepted Grammar 4
  and Contract 5 boundary through the independent `0.4.0` beta workstream
- the Issue #3 backlog hierarchy and multi-plan composition after the MVP
- the LSP server after the first beta
- the VSIX, with code highlighting and an LSP client, after the LSP server
- the MCP server independently of LSP/VSIX after the first beta

Each plan represents only the present and future; completed work is managed through advance and Git history.

## 9. Failure handling

### parser regression

- Check the grammar specification and fixture first.
- Do not change the plan to match a parser bug.
- Check the plan with the previous working version.
- Record the result difference between the old and new versions after the fix.

### formatter/mutation regression

- Stop writes.
- Isolate unintended changes in the Git diff.
- Restore the source document from the previous commit.
- Add a regression fixture before resuming.

### analysis regression

- Do not use a next result to make task-selection decisions.
- Compare with a known small golden graph rather than hand calculations.
- Isolate the stage at which the difference occurs: expected, float, critical, or ready.

## 10. Evidence of self-use

A self-use start commit records the following:

- test name that satisfies bootstrap gate
- `plans/grammar.pert`
- golden results for check/analyze/next
- CI command
- that it began in read-only mode

Commits that enable safe write and advance also retain the tests and goldens that satisfy each gate.

Stage 1 entry evidence:

- parser/check gate: `all normative examples parse and validate`, each invalid fixture diagnostic test, `resource requirements do not become precedence edges`
- analyze gate: `analysis.test.mjs` fixes precedence, capacity override, active allocation, resource witnesses, and the schedule critical path
- next gate: `parallel next selects a deterministic runnable subset`, classification/depth unit tests, and text/JSON CLI integration tests
- self-use golden: check/analyze/next projection tests for the grammar, control-plane, operations, recommendation, and MVP plans
- point self-use gate: golden tests separately check the baseline unit for grammar/control-plane/operations/recommendation plans, measured or explicit initial velocity, and precedence/resource forecasts
- field fixture gate: `all declaration fields parse from the grammar acceptance fixture` and every `grammar fixture ... reports only ...` test fix field/token boundaries
- block text/span gate: parser tests and dedicated fixtures fix common indentation, paragraphs, tabs/trailing spaces, leading/trailing trivia, and UTF-16 marker/content spans
- formatter Core gate: formatter tests fix HSPACE input, source-structure preservation, lexical normalization, UTF-16 non-overlapping edits, and invalid-input rejection
- formatter round-trip gate: formatter tests fix golden agreement for all fields, idempotence, and exact-value AST equivalence
- help/fixture sync gate: help tests fix registry-related links, syntax/sample `.pert` references, and help-topic resolution for invalid-fixture diagnostics
- control-plane planning gate: Issue #1's 17p design is complete with 0p remaining and no ready task; the design acceptance record is fixed in the golden and documentation
- operations planning gate: M1–M4's 24p are decomposed by file ownership, acceptance, and narrow tests; a 21p critical/resource makespan, initial 7d forecast, and runnable frontier are fixed in the golden
- task mutation Core gate: mutation tests fix add/set/remove/finish, UTF-16 local edits, comment ownership, candidate revalidation, digest, unified diff, and invalid-result suppression
- entity mutation Core gate: mutation tests fix milestone/resource add/set/remove, atomic batch, connected milestones, path replacement, simultaneous resource-requirement addition, and non-cascade rejection
- formatter application gate: formatter tests fix revalidated candidates, UTF-16 edits, digest, unified diffs, and invalid/no-op results
- mutation CLI preview gate: CLI/E2E tests fix entity/batch actions, text/JSON, stdin separation, BOM, document ID, warning policy, and preview-only write rejection
- formatter CLI preview gate: CLI/E2E tests fix default candidates, diff, check, text/JSON, stdin, BOM, document ID, warning policy, and preview-only write rejection
- safe-write adapter gate: write-safety tests fix raw-byte digests, symlink/non-regular-file rejection, expected/stale digests, mode inheritance, exclusive temporary files, fsync, atomic replacement, concurrent-writer rejection for new output, revalidation, and cleanup
- safe-write CLI gate: CLI/E2E/self-use tests fix formatter and entity/batch mutation `--write`/`--out`/`--expect-digest`, no-op behavior, conflict reasons, original preservation on failure, grammar temporary-copy round trips, and reanalysis after writes
- advance planner gate: advance tests fix canonical keep/remove sets, retention of partial-join `done` tasks and satisfied gates, explicit reached frontiers, before/after invariants, idempotence, and invalid-candidate suppression
- advance CLI gate: CLI/E2E/self-use tests fix the default preview, diff, advance-specific JSON, removed entities and frontier/ready comparisons, partial joins, digest-guarded writes, and repeated no-op behavior
- operations calibration gate: the completed nine tasks' 24p/1 active day measured velocity is fixed at `24p/1d`, along with remaining precedence/resource forecasts of 0 and a 0p resource delay
- Mermaid profile contract gate: specifications, help, and tests fix all semantic records, canonical JSON, metadata/projection digests, fail-closed import, stable loss codes, security boundaries, and normative artifacts
- release readiness gate: audit MVP conditions 1–16 individually; do not mark an unimplemented condition Pass by reinterpreting existing fields; fix the recommendation detail/macro gate and restart conditions
- recommendation authority gate: after MIG-07, use only detail remaining work of 0p, measured velocity `22p/1d`, and known/complete v3 as normal selection authority. After `RELEASE_E2E`, fix the empty recommendation in the golden
- release distribution gate: inspect the release commit, remote main, annotated tag, GitHub asset, npm publication, and registry installation using the same tarball, and record the version, integrity, SHA-256, and release URL
- agent guidance planning gate: decompose Issue #2 into provider baseline, common contract, deterministic Core, read-only publication, and acceptance; fix initial velocity `22p/1d`, a 1d resource forecast, and first recommended task `PROVIDER_BASELINE` in the golden
- agent guidance provider baseline gate: the official source, artifact, scope, maturity evidence, risk, and `verified_at` for 5 providers × 6 surfaces are fixed as offline design input; measured velocity is `4p/1d`, 18p remain = 4.5d, and `GUIDANCE_CONTRACT` is fixed as the next recommended task in the golden
- agent guidance contract gate: the normative specification, 20 cases, and contract fixture fix stable provider/surface/guidance/risk IDs; structured support-status evidence; the offline profile; Core/text/JSON; diagnostics; staleness; project-first composition; and read-only migration. Cumulative measured velocity is `9p/1d`, 13p remain = `13/9d`, and `GUIDANCE_CORE` is the next recommended task in the golden
- agent guidance Core gate: the public library and dedicated tests fix a versioned offline profile, canonical digest, validator, exact lookup and aliases, reference-closed index/quick/detail projections, deterministic JSON, six statuses and fixed-date staleness, and no-side-effect capability. Cumulative measured velocity is `14p/1d`, 8p remain = `4/7d`, and `AGENT_HELP_PUBLICATION` is the next recommended task in the golden
- agent guidance publication gate: the same Core result fixes deterministic text/JSON, structured command help, the `agent help` CLI, aliases, unknown/usage diagnostics, read-only capability, legacy `dsl help` bytes, and package-installed Core/CLI parity. Cumulative measured velocity is `19p/1d`, 3p remain = `3/19d`, and `GUIDANCE_ACCEPTANCE` is the next recommended task in the golden
- agent guidance acceptance gate: trace Issue #2's 12 criteria to specifications, Core, CLI, text/JSON, fixtures/goldens, packages, and security; accept all 244 tests, the local link, and release packages. Cumulative measured velocity is `22p/1d`, detail work remaining is 0p, and the macro's next recommended task `BETA_RELEASE_E2E` is fixed in the golden
- beta release gate: accepted `v0.1.0` from one tarball after verifying the GitHub prerelease, npm `beta`, unchanged `latest` during publication, artifact parity, and isolated registry installation; the later explicit promotion made `beta=latest=0.1.0`
- English-baseline planning gate: the seventh self-use plan fixes ADR 0004, the completed surface inventory and normative-document migration, six remaining tasks totaling 27p, a 14p precedence makespan, a 17p resource makespan, observed velocity `15p/1d`, and the then-recommended task `PROCESS_AND_GUIDANCE_DOCS`
- English-baseline process-and-guidance gate: repository entrypoints and process/provider guidance are translated and cross-reviewed; five tasks totaling 19p remain, precedence is 11p, resource makespan is 16p with 5p delay, observed velocity is `23p/1d`, and `RUNTIME_MESSAGES` is recommended
- English-baseline runtime-message gate: runtime diagnostics are translated and cross-reviewed without changing stable machine contracts; four tasks totaling 14p remain, precedence and resource makespans are both 11p, observed velocity is `28p/1d`, and `HELP_AND_USAGE` is recommended
- English-baseline help-and-usage gate: structured help and installed-package projections are translated and cross-reviewed without changing command or schema contracts; three tasks totaling 9p remain, precedence and resource makespans are both 9p, observed velocity is `33p/1d`, and `PERT_PLANS` is recommended
- English-baseline PERT-plan gate: the six remaining plan metadata surfaces and `plans/README.md` are translated without changing stable structure or reconstructing completed history; two tasks totaling 6p remain, precedence and resource makespans are both 6p, observed velocity is `36p/2d`, and `GOLDEN_UNICODE_AUDIT` is recommended
- English-baseline golden and Unicode gate: the ten remaining repository-authored fixtures are translated with pre-migration source-layout and semantic-structure digests unchanged; an exact counted allowlist retains only three Japanese-script lines, one task totaling 3p remains, precedence and resource makespans are both 3p, observed velocity is `39p/2d`, and `ENGLISH_ACCEPTANCE` is recommended
- CLI-surface-reset planning gate: the eighth self-use plan maps all eight review backlog IDs one-to-one after a normative design precursor; 9 tasks total 49p, precedence makespan is 33p, heuristic resource makespan is 49p with 16p delay, inherited provisional velocity is `29p/2d`, and `CONTRACT_V3_DESIGN` is the only initial recommendation
- CLI-surface-reset design gate: requirements, Contract 3 specification, basic design, migration guide, 14 `CLI3-*` cases, and design-consistency tests are accepted without runtime changes; the 5p task is advanced, 44p remain, observed provisional velocity is `5p/1d`, precedence/resource makespans are 28p/44p, `CLI_001_COMMAND_REGISTRY` is recommended, and `project init` remains backlog `MUT-001`
- CLI-surface-reset gate-maintenance gate: gate add/set/remove Core, atomic batch, source-preserving endpoints/reason, non-cascade rejection, Contract 2 safe-write projection, and three internal Contract 3 descriptors are covered by unit/CLI/E2E/discovery tests; 23p remain, precedence/resource makespans are 15p/23p with 8p delay, observed provisional velocity is `26p/1d`, and `MUT_001_PROJECT_INIT` is recommended
- CLI-surface-reset project-initialization gate: pure smallest-document Core, `Perttool.InitResult.v1`, deterministic text/JSON, UTF-16 insertion edit, exclusive output, fail-closed validation, and the internal descriptor are covered while public Contract 2 rejects `project init`; 18p remain, precedence/resource makespans are 15p/18p with 3p delay, observed provisional velocity is `31p/1d`, and `HELP_003_USAGE_RECOVERY` is recommended
- CLI-surface-reset usage-recovery gate: pure registry-scoped argv validation, exact typed help targets, stable text/JSON errors, bounded non-invented suggestions, command-help aliases, conflict and stdin checks, determinism, and no-I/O operation are covered while public Contract 2 remains active; 13p remain, precedence/resource makespans are both 13p, observed provisional velocity is `36p/1d`, and `HELP_002_DOMAIN_GUIDE_SPLIT` is recommended
- CLI-surface-reset domain-guide gate: the HelpNode registry remains the sole domain-topic authority while the pure internal `Perttool.GuideResult.v1` projection provides separate index, quick/detail topic, text/JSON, and `guide_topic` diagnostics without command-descriptor coupling or Contract 2 byte changes; 10p remain, precedence/resource makespans are both 10p, observed provisional velocity is `39p/1d`, and `CLI_002_CONTRACT_V3_CUTOVER` is recommended
- CLI-surface-reset Contract 3 cutover gate: the active 27-command registry drives dispatch, argv validation, text/JSON command help, separate guide publication, project initialization, direct gate maintenance, and `cli_contract_version=3`; four renamed Contract 2 routes fail with exit 2, 5p remain, precedence/resource makespans are both 5p, observed provisional velocity is `44p/1d`, and `CLI_003_FILE_FIRST_ACCEPTANCE` is recommended
- CLI-surface-reset file-first acceptance gate: the isolated installed-package CLI alone initializes, reads, mutates every entity field, analyzes, selects, advances, and validates a plan without manual source rewriting; cumulative velocity is `49p/1d`, no detail work remains, and complete `NextResult.v3` has no recommendation
- Contract 3 `v0.2.0` acceptance gate: one verified tarball is byte-identical across local, GitHub prerelease, and npm; installed Contract 3, renamed-command rejection, read-only agent guidance, complete Next v3, and file-first checks pass; publication left `latest=0.1.0` unchanged, then a separately authorized post-acceptance operation made `beta=latest=0.2.0`; cumulative velocity is `17p/2d`, no detail work remains, and complete Next v3 has no recommendation
- Contract 4 `v0.3.0` acceptance gate: one verified tarball is byte-identical across local, GitHub prerelease, and npm; installed Grammar 3, temporal/deadline analysis, complete Next v4 start authority, exact unit migration, and file-first checks pass; publication left `latest=0.2.0` unchanged, then a separately authorized post-acceptance operation made `beta=latest=0.3.0`; an unqualified global installation and light smoke pass; cumulative velocity is `19p/2d`, no detail work remains, and complete Next v4 has no recommendation
- Contract 5 `v0.4.0` acceptance gate: the release commit and peeled tag agree; the candidate, GitHub, and npm tarballs are byte-identical at SHA-256 `010af9ce...7cc4a`; both public-package workflows and registry installs pass; all six tasks and 19p are complete and advanced with zero makespans and no recommendation; publication retained `latest=0.3.0`, then a separately authorized post-acceptance operation made `beta=latest=0.4.0`; an unqualified isolated installation confirms CLI Contract 5 and Grammar 4
- Contract 6 `v0.5.0` PUBLISH gate: release commit and peeled tag target `af819b4` agree; the candidate, GitHub, and npm tarballs are byte-identical at SHA-256 `f3ba9b3f...2208c`; both public-package workflows pass; npm reports `beta=0.5.0`, unchanged `latest=0.4.0`, and `alpha=0.1.0-alpha.2`; 3p remain at `16p/1d`, and complete Next v5 recommends only release acceptance
- Contract 6 `v0.5.0` acceptance gate: independent Git, GitHub, npm, artifact, and installed-package reads pass; all six tasks and 19p are complete at `19p/1d`; both makespans are zero, complete Next v5 has no recommendation, and exact local installation remains the ordered post-acceptance step
- scheduling-and-units rational-Duration replanning gate: completed SU-M1/SU-M2 history remains advanced; the new SU-M2R common predecessor captures the user-selected Decimal-or-fraction target DSL direction without changing active Grammar 1, accepted Grammar 2, migration version 1, or Contract 3; the contract task selects new version identities where compatibility requires them; seven detail tasks total 24p with 15p precedence and 18p heuristic resource makespans, 3p delay, inherited forecasts `5/8d` and `3/4d`; the macro has `4.75d` precedence and `6.75d` resource makespans with 2d delay; complete Next v3 recommends `SU_M2R_RATIONAL_DURATION_WORK_PACKAGE` and then `RATIONAL_DURATION_CONTRACT`
- SU-M2R exact-Duration contract gate: Grammar 3, `perttool.temporal-unit-interface@2`, `perttool.unit-migration@2`, `Perttool.UnitMigrationResult.v2`, unsigned exact Fraction syntax, canonical shortest-Decimal-or-reduced-Fraction output, atomic grammar retention/upgrade, and reversibility metadata are accepted without runtime activation; `RATIONAL_DURATION_CONTRACT` is committed at `c1dec29` and advanced through the expected-digest path
- SU-M2R rational-source and exact-serializer gate: a separate identity-checked internal Grammar 3 parser/validator retains reduced Fraction values, exact source tokens, and spans while Grammar 1/2 stay closed; exact Rational serialization emits the shortest ordinary Decimal or a reduced Fraction without display rounding; both tasks are committed at `787f0bb` and advanced through the expected-digest path; 13p remain with 7p precedence and 10p heuristic resource makespans, 3p delay, inherited forecasts `7/24d` and `5/12d`; the macro rollup is `0.416667d`, and complete Next v3 recommends `RATIONAL_DURATION_FORMATTER` plus `RATIONAL_DURATION_MUTATION`
- SU-M2R exact-formatter and source-mutation gate: separate internal Grammar 3 formatting and mutation paths canonicalize exact Duration values without rounding, preserve unrelated source and existing Grammar 1/2 behavior, validate final candidates through the matching capability, reject automatic migration batch members, and retain digest-locked in-place/out safe writes; both tasks are committed at `f0d9a26` and advanced through the expected-digest path; 7p remain with matching precedence and heuristic resource makespans, no resource delay, inherited forecast `7/24d`; the macro rollup is `0.291667d`, and complete Next v3 recommends `RATIONAL_DURATION_VERSION_BOUNDARY`
- SU-M2R grammar-version boundary gate: pure canonical-token selection and the identity-checked version-candidate planner retain Grammar 1/2 for all-Decimal output, upgrade one localized project version only for Fraction output, never downgrade Grammar 3, preserve temporal source, and report grammar/qualification/reversibility metadata without changing root exports or Contract 3; the task is committed at `fa698ca` and advanced through the expected-digest path; 4p remain with matching precedence and heuristic resource makespans, no resource delay, inherited forecast `1/6d`; the detail digest is `sha256:63bbe45287126762e0e27ca09b0a4822968a6ab1a5aee9f5dfb7410ffc5590e6`, the macro rollup is `0.166667d`, and complete Next v3 recommends `RATIONAL_DURATION_ACCEPTANCE`
- SU-M2R exact-Duration acceptance gate: the accepted record traces TUI/TUE through 020, verifies exact source/formatter/mutation/version-boundary composition, turns TUE-015 into an exact Grammar 3 representation without claiming the SU-M4 migration operation, and proves source and installed Contract 3 keep Grammar 2/3 and target APIs closed; acceptance is committed at `29550c5`, all 24p are complete and advanced at provisional `24p/1d`, and the detail has zero makespans and no recommendation at digest `sha256:5ba8eb9d5ec192f2d30568e1c51ebba670c4c496b232e6ad8bb9e965490931bb`
- SU-M2R macro-rollup and SU-M4 planning gate: the committed SU-M2R snapshot is rolled up at `a93c129` and advanced at `b4e891d`; SU-M3 and SU-M4 are re-estimated at 23p and 25p, complete macro Next v3 recommends SU-M4, and the current six-task `scheduling-units-m4.pert` detail has 21p precedence, 25p heuristic resources, 4p delay, forecasts `7/8d` and `25/24d`, and recommends `MIGRATION_REQUEST_AND_INVENTORY`
- SU-M1 temporal-requirements gate: project `as_of`, milestone `deadline`, task `not_before`, and task `deadline` are the exact initial property scope; grammar version 1 and existing result identities are not widened; `TEMPORAL_REQUIREMENTS` is completed and advanced; six tasks total 21p, precedence is 17p, heuristic resource work is 21p with 4p delay, observed provisional velocity is `3p/1d`, the resource forecast is `7d`, and `CALENDAR_SEMANTICS` is recommended
- SU-M1 calendar-semantics gate: `perttool.calendar-projection` and the continuous fixed-offset profile version 1 fix tagged date/date-time comparison, `as_of`, exact projection, velocity, `not_before`, unavailable causes, and the no-business-calendar/no-unit-migration boundary; `CALENDAR_SEMANTICS` is completed and advanced; five tasks total 17p, precedence is 13p, heuristic resource work is 17p with 4p delay, cumulative provisional velocity is `7p/1d`, the resource forecast is `17/7d`, and `DEADLINE_SEMANTICS` is recommended
- SU-M1 deadline-semantics gate: `perttool.deadline-evaluation` version 1 fixes task finish, milestone reach, project finish, current deadline state, signed margin, precedence lower bounds, heuristic resource forecasts, combined assessment, blocked-cone qualification, unavailable causes, and the Analysis/Recommendation version boundary; `DEADLINE_SEMANTICS` is complete and advanced through the committed-snapshot and expected-digest path; four tasks and 13p remain, both precedence and heuristic resource makespans are 13p with no resource delay, cumulative provisional velocity is `11p/1d`, both forecasts are `13/11d`, and `UNIT_MIGRATION_SEMANTICS` is recommended
- SU-M1 unit-migration-semantics gate: `perttool.unit-migration` version 1 fixes permitted Point/linked-time directions, effective velocity disposition, the complete source-field inventory, exact finite-decimal conversion, atomic candidates, no-op/repetition, inverse qualification, and fail-closed causes without adding a CLI command; `UNIT_MIGRATION_SEMANTICS` is complete and advanced through the committed-snapshot and expected-digest path; three tasks and 9p remain, both precedence and heuristic resource makespans are 9p with no resource delay, cumulative provisional velocity is `15p/1d`, both forecasts are `3/5d`, and `INTERFACE_PROJECTION_CONTRACT` is recommended
- SU-M1 interface-contract gate: `perttool.temporal-unit-interface` version 1 selects target Grammar 2, CLI Contract 4, temporal/unit Core and result identities, source-preserving mutation, dedicated migration, help, diagnostics, and release-gated Next v4 start authority without activating them in Contract 3; `INTERFACE_PROJECTION_CONTRACT` is complete and advanced through the committed-snapshot and expected-digest path; two tasks and 5p remain, both precedence and heuristic resource makespans are 5p with no resource delay, cumulative provisional velocity is `19p/1d`, both forecasts are `5/19d`, and `NORMATIVE_EXAMPLES` is recommended
- SU-M1 normative-examples gate: `TUE-001` through `TUE-018`, nine target Grammar 2 source fixtures, and `Perttool.TemporalUnitExampleBaseline.v1` fix calendar, deadline, release-gated authority, migration, failure, idempotence, inverse, and deterministic text/JSON witnesses without runtime activation; `NORMATIVE_EXAMPLES` is complete and advanced through the committed-snapshot and expected-digest path; one task and 2p remain, both precedence and heuristic resource makespans are 2p with no resource delay, cumulative provisional velocity is `22p/1d`, both forecasts are `1/11d`, and `M1_CONTRACT_REVIEW` is recommended
- SU-M1 contract-acceptance gate: all `TUI-001` through `TUI-018` observations trace through requirements, specifications, examples, delivery gates, and tests; the sequencing conflict is resolved with target-only SU-M2 through SU-M4 Core slices and one SU-M5 public cutover; the completed detail is advanced at `24p/1d` with no recommendation
- SU-M2 Grammar 2 source gate: `GRAMMAR_V2_TEMPORAL_SOURCE` is complete and advanced from the clean committed snapshot through an identity-checked internal capability, exact declared calendar records, Grammar 1 closure, contextual IDs, exact field-position checks, all nine target fixtures, and TUE-001/TUE-003 coverage; five tasks and 19p remain, both precedence and heuristic resource makespans are 16p with no resource delay, observed provisional velocity is `5p/1d`, both forecasts are `16/5d`, active Grammar 1 and CLI Contract 3 remain fixed, and `TEMPORAL_SEMANTIC_VALIDATION` is recommended
- SU-M2 temporal-semantic-validation gate: `TEMPORAL_SEMANTIC_VALIDATION` is complete and advanced from the clean committed snapshot through the internal target validated-document boundary, field-local `PTSEM-112`, mixed-kind validity, date-anchor/hour validity, active/done/reached temporal retention, deterministic diagnostic limits, and clock-free TUE-002/TUE-006/TUE-007/TUE-011 coverage; four tasks and 15p remain, both precedence and heuristic resource makespans are 12p with no resource delay, cumulative provisional velocity is `9p/1d`, both forecasts are `4/3d`, active Grammar 1 and CLI Contract 3 remain fixed, `TEMPORAL_FORMATTER_ROUNDTRIP` is recommended, and `DECLARED_TEMPORAL_INPUT_CORE` is resource-feasible and allowed
- SU-M2 temporal-formatter gate: `TEMPORAL_FORMATTER_ROUNDTRIP` is complete and advanced from the clean committed snapshot through one shared active/target canonical field order and the internal target formatter; field/declaration order, comments, blank lines, BOM, line endings, exact temporal tokens, UTF-16 edits, malformed-input suppression, target-AST equivalence, idempotence, all nine fixtures, and all six TUE-012/TUE-013 occurrences are covered while active Grammar 1, CLI Contract 3, and root exports remain fixed; three tasks and 12p remain, precedence/resource makespans are 9p/12p with 3p resource delay, cumulative provisional velocity is `12p/1d`, forecasts are `3/4d` and `1d`, `TEMPORAL_MUTATION_BATCH_CORE` is recommended, and `DECLARED_TEMPORAL_INPUT_CORE` is deferred by `TARGET_CORE_SURFACE`
- SU-M2 temporal-mutation gate: `TEMPORAL_MUTATION_BATCH_CORE` is complete and advanced from clean implementation commit `65c8cda` through private capability-checked task/milestone temporal requests, shared canonical placement, localized UTF-16 edits, final-candidate-only version/anchor/temporal upgrade and downgrade batches, fail-closed invalid candidates, common deterministic diff/digest, and shared in-place/out safe-write mechanics; active Grammar 1, CLI Contract 3, root exports, descriptors, help, and installed behavior remain fixed; two tasks and 7p remain, precedence/resource makespans are both 7p with no delay, cumulative provisional velocity is `17p/1d`, both forecasts are `7/17d`, and `DECLARED_TEMPORAL_INPUT_CORE` is recommended
- SU-M2 declared-input Core gate: `DECLARED_TEMPORAL_INPUT_CORE` is complete and advanced from clean implementation commit `5dc3390` through internal target CheckResult v2 and ProjectResult v2 Core projections over one validated source order; exact anchors, milestone deadlines, nullable task constraints, finish-milestone deadlines, Grammar 1 compatibility, syntax suppression, semantic-error retention, complete invalid project results, diagnostic limits, determinism, and the TUI-004 Core boundary are covered while active Contract 3 schemas, CLI, root exports, descriptors, help, and installed behavior remain fixed; one task and 4p remain, precedence/resource makespans are both 4p with no delay, cumulative provisional velocity is `20p/1d`, both forecasts are `1/5d`, and `M2_FOUNDATION_ACCEPTANCE` is recommended
- SU-M2 foundation-acceptance gate: `M2_FOUNDATION_ACCEPTANCE` is complete and advanced through the cross-cutting acceptance record, all 18 TUI and TUE traces, active Contract 3/Grammar 1 rejection, target API non-export, actual installed-package checks, and 361-test full verification; cumulative velocity is `24p/1d` and no SU-M2 detail work remains; the later user-selected SU-M2R replan supersedes its then-current SU-M3/SU-M4 frontier without rewriting this history
- SU-M4 rollup and SU-M3 planning gate: the committed SU-M4 detail and its
  one macro rollup are advanced to reached `UNIT_MIGRATION_ACCEPTED`.
  `scheduling-units-m3.pert` decomposes the remaining 23p target Core into six
  tasks with 19p precedence, 23p reviewer-constrained heuristic resources,
  4p delay, inherited `24p/1d` velocity, forecasts `19/24d` and `23/24d`,
  and complete Next v3 recommendation `TEMPORAL_INPUT_PROJECTION`.
- SU-M3 temporal acceptance gate: exact calendar projection, release-aware
  precedence and heuristic resources, deadline evidence, target AnalysisResult
  v3/NextResult v4, malformed input, blocked/history qualifications,
  determinism, and Contract 3 closure are accepted across TUI/TUE through 020;
  all six tasks and 23p are done at `23p/1d`; the committed-snapshot advance
  retains only reached `DEADLINE_CAPABILITIES_ACCEPTED`, with zero makespans
  and no recommendation.
- SU-M3 macro rollup and SU-M5 planning gate: accepted 23p SU-M3 is rolled
  up once as the existing `0.958333d` macro duration and advanced; the
  resulting macro recommends only `SU_M5_INTEGRATED_ACCEPTANCE`. The new six-task
  SU-M5 detail totals 23p at `23p/1d`, with 16p precedence, 23p
  reviewer-constrained heuristic resources, 7p delay, and recommendation
  `CONTRACT4_PUBLIC_CORE`.
- `v0.8.0` release-plan acceptance: Contract 7 `project init` created the
  489-byte Grammar 6 base, and one separately confirmed goal-and-DAG atomic
  batch produced the exact 6,734-byte, six-task, 22p plan at digest
  `sha256:a26bb205f5eb4ee4bb6616bee2d74877c3162f26be090473d435a4515fadc69c`.
  Both makespans are 22p with zero delay, and complete NextResult v6 makes
  startable only `RELEASE_080_GATE_DESIGN`. Release preparation, publication,
  npm `latest`, VSIX publication, and plan advance remain separate.
- `v0.9.0` candidate acceptance: clean source commit `5cb7bc8` passed the
  complete Node.js 22 gate and produced one retained 713-file candidate at
  SHA-256 `88e51bfe...37345e7`. Its exact installed package exposes Grammar 7,
  CLI Contract 8, 53 commands, 23 schemas, 129 identical root and Node exports,
  and 45 Core exports. Four tasks and 16p are complete; 6p remain with matching
  precedence and heuristic resource makespans and zero resource delay.
  Complete NextResult v7 recommends only `RELEASE_090_PUBLISH`, but
  publication and every external write remain separately authorized.
- `v0.9.0` PUBLISH gate: release commit and peeled annotated tag target
  `3aca4f0`; Node.js 22 and 24 CI run `31670558276` passed; GitHub prerelease
  and npm `beta=0.9.0` use the same 713-file tarball at SHA-256
  `88e51bfe...37345e7`; publication retained `latest=0.8.1` and no `alpha`.
  Five tasks and 19p are complete; 3p remain with matching precedence and
  heuristic resource makespans and zero delay. Complete NextResult v7
  recommends only `RELEASE_090_ACCEPTANCE`; durable acceptance, `latest`,
  public VSIX publication, and plan advance remain separate.
- `v0.9.0` durable acceptance: independent Git, CI, GitHub, npm, artifact,
  exact and beta installation, rollback, Grammar 1 through 7, Contract 8,
  milestone-acceptance, historical, migration, export, schema, and private-
  adapter-exclusion checks passed. All six tasks and 22p are complete with
  zero makespans; complete NextResult v7 has no ready, recommended, or
  startable task. At that immutable acceptance boundary npm `latest=0.8.1`
  and absent `alpha` remained unchanged.
- `v0.9.0` post-acceptance closure: one separately authorized npm dist-tag
  mutation made `beta=latest=0.9.0` with no `alpha`; Issues #10 and #11 were
  closed with exact release evidence; and the accepted record was pushed.
  The completed plan was migrated to Grammar 7, given six artifact criteria
  and verify receipts at committed snapshot `23e1664`, and canonically
  advanced without history force. Residual digest
  `sha256:59b5fbbe...d4e71a` retains only accepted reached
  `RELEASE_090_ACCEPTED`, with zero tasks and makespans, no diagnostic, and no
  ready, recommended, or startable task.
- CI entrypoint: `npm run check` invokes `npm run check:self-use` and validates all forty-three current plans
- ADV-001 contract state: the
  [Advance History Safety Contract](../specs/advance-history-safety.md) fixes
  exact destructive records, `HEAD` and stage-0 index proof, retained-dirty
  behavior, force, result, and diagnostic boundaries. CLI enforcement,
  `Perttool.AdvanceResult.v1`, help, schema, repository, link, package, and
  installed behavior are accepted under
  [Advance History Safety Acceptance](advance-history-acceptance.md).
- ADV-002 acceptance state: the shared advance deletion-range planner removes
  only terminal-suffix separator prefixes, uses the same ranges for destructive
  records, and maps those exact current prefixes into `HEAD`. Core, real
  tracked CLI, preview/output/write byte identity, `git diff --check`,
  encoding and comment boundaries, temporary link, and installed-package
  acceptance are complete. Published packages remain unchanged and release
  selection remains separate.
- MILESTONE-ACCEPT-001 history gate: Contract 7 and older checkpoints remain
  explicitly not applicable, Grammar 7 checkpoints bind the exact migration,
  criterion, receipt, and evaluator epochs, and only one byte-identical passed
  acceptance-aware candidate becomes a canonical-advance proof. The 1,031-test
  complete gate, 37-plan self-use, and 709-file isolated package pass; the
  history task is complete before the user-requested committed migration and
  canonical plan advance, and complete NextResult v7 recommends only
  `MILESTONE_ACCEPTANCE_ADAPTERS`.
- Issue #11 release input: consecutive terminal assurance and work-event
  deletions now own disjoint separator-byte ranges in source order. One and
  multiple LF/CRLF separators, both final-newline states, Issue #9 EOF receipt
  creation, retained work events, exact destructive ranges, and tracked
  preview/output/write identity pass without weakening history or assurance
  guards. This correction and MILESTONE-ACCEPT-001 are required inputs to the
  next selected release; version selection and publication remain separate.
- HIST-DAG-001 CLI gate: `dag history` composes the bounded immutable Git
  evidence and pure linear reconstruction through a private Application/Node
  path; snapshot, proved-lineage, timeline, single-checkpoint analysis,
  `Perttool.HistoricalGraphResult.v1`, Help, Guide, strict schema, temporary
  link, and isolated-package behavior are accepted without changing the
  package-root/Node/Core catalogs or writing source or Git state. Historical
  editor protocol, VSIX presentation, three-way ancestry, semantic merge, and
  release remain separate.
- HIST-DAG-001 historical editor contract gate: the separately negotiated
  `perttool/historicalGraphView` and `perttool/historicalSource` methods,
  `Perttool.HistoricalGraphViewResult.v1` and
  `Perttool.HistoricalSourceResult.v1`, trusted local repository selection,
  exact result/blob/digest/range navigation, cancellation, staleness, limits,
  restrictive Webview input, accessibility, and no-write boundary are accepted
  as a distinct design. The later private LSP/VSIX implementation activates
  both methods for trusted local file workspaces, presents snapshot, proved-
  lineage, and timeline views with an independent four-mode analysis selector,
  and opens only verified immutable `perttool-history` documents. Current
  GraphView, public package catalogs, and workspace bytes remain unchanged;
  cross-surface final acceptance and release remain later.
- write state: Stage 3 editing commands remain preview-first. Until the
  accepted source is released, repository self-use still requires the exact
  pre-advance target snapshot in `HEAD`, the passing guard,
  diff/deletion review, expected-digest write, reanalysis, and a separate
  advance commit.
