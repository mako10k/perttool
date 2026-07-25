# SU-M2 Temporal Source and Core Foundation Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-07-25
- Accepted contract:
  [SU-M1 temporal and unit-migration review](scheduling-units-m1-acceptance.md)
- Macro plan:
  [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan:
  [../../plans/scheduling-units-m2.pert](../../plans/scheduling-units-m2.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-018`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v1`

## 1. Decision

Accept the SU-M2 target Grammar 2 source and declared-input Core foundations.
The target parser, semantic validator, formatter, temporal mutation and batch
planner, safe-write adapter, CheckResult v2 Core, and ProjectResult v2 Core
implement the SU-M2-owned part of the accepted SU-M1 contract.

This is an internal target-Core acceptance, not a public activation. The
active runtime remains Grammar 1 and CLI Contract 3. The root package export,
typed command registry, dispatch, text and JSON help, Guide, and installed CLI
continue to expose the Contract 3 result identities and reject Grammar 2
temporal source. No target module is exported from the package root.

There are no open SU-M2 acceptance findings. Temporal calendar projection,
deadline evaluation, temporal precedence and resource views, and NextResult
v4 remain SU-M3 work. Exact unit migration remains SU-M4 work. Public Grammar
2, CLI Contract 4, target result schemas, help, Guide, README workflows, and
normal NextResult v4 authority remain one atomic SU-M5 cutover.

No Git push, GitHub release, npm publication, or dist-tag change is authorized
by this acceptance.

## 2. Accepted implementation boundary

| Capability | Accepted SU-M2 implementation | Public boundary |
| --- | --- | --- |
| Grammar 2 source | `parseTargetDocument` behind the exact target capability accepts only project `as_of`, milestone `deadline`, task `not_before`, and task `deadline` | `parseDocument` remains Grammar 1 |
| Temporal validation | `validateTargetDocument` requires the explicit anchor, retains valid mixed kinds and history, limits diagnostics deterministically, and reads no clock or host environment | Active validation continues to reject temporal fields |
| Formatting | `formatTargetDocument` shares the canonical field order, preserves source structure and exact calendar tokens, and is idempotent | `formatDocument` returns no candidate for Grammar 2 |
| Mutation and batch | Target-only task and milestone add/set/clear requests use localized UTF-16 edits and validate one final candidate; one batch can upgrade or downgrade Grammar and fields atomically | Contract 3 descriptors and dispatch expose no temporal mutation options |
| Safe write | Target candidates reuse the ordinary digest, diff, in-place, out, symlink, race, and post-write verification mechanics | No separate public write route is added |
| Declared-input Core | Internal CheckResult v2 and ProjectResult v2 Core projections expose exact typed anchors, milestone deadlines, nullable task constraints, and the finish-milestone deadline in source order | Active JSON stays at CheckResult v1 and ProjectResult v1 |

The target modules remain ordinary internal build artifacts so later slices can
compose them. Package `exports` still contains only `"."`, and `src/index.ts`
does not re-export any target-only capability.

## 3. Interface observation trace

| ID | SU-M2 evidence | State after SU-M2 |
| --- | --- | --- |
| `TUI-001` | Target parser and source tests accept exactly three temporal field positions while active Grammar 1 returns `PTDSL-005` | Delivered |
| `TUI-002` | Target validator requires `as_of`, accepts mixed kinds, and reads no clock or host zone | Source validation delivered; calendar projection remains SU-M3 |
| `TUI-003` | Parser, formatter, mutation, batch, diagnostics, and declared-input Core use one temporal inventory and order | Core delivered; Guide and public help remain SU-M5 |
| `TUI-004` | Internal CheckResult v2 and ProjectResult v2 Core project declared inputs without changing the active v1 identities | Target Core delivered; public schemas remain SU-M5 |
| `TUI-005` | Target source retains every deadline input needed by the accepted result | Evaluation and AnalysisResult v3 remain SU-M3 |
| `TUI-006` | Mixed, blocked, resource, and completed-history fixtures cross the source, validation, and formatting boundaries | Deadline states and qualifications remain SU-M3 |
| `TUI-007` | Target source retains `not_before` and the active Next v3 graph remains unchanged | NextResult v4 shadow remains SU-M3; authority cutover remains SU-M5 |
| `TUI-008` | Target validation does not reinterpret a future or unavailable `not_before` as a source error | Temporal runnable/start authority remains SU-M3 |
| `TUI-009` | Target task and milestone add/set/clear requests are source-preserving and final-candidate validated | Delivered |
| `TUI-010` | One target batch upgrades or downgrades version, anchor, and temporal fields without validating intermediate source | Delivered |
| `TUI-011` | Migration-shaped target batches fail closed | Migration planner remains SU-M4; public command remains SU-M5 |
| `TUI-012` | No partial migration result is exposed by SU-M2 | UnitMigrationResult v1 remains SU-M4 |
| `TUI-013` | Temporal mutation candidates reuse the ordinary preview and safe-write adapter | Temporal half delivered; migration reuse remains SU-M4 |
| `TUI-014` | The active 27-command Contract 3 registry remains the sole dispatch and command-help surface | Contract 4 registry cutover remains SU-M5 |
| `TUI-015` | The active Guide remains Contract 3 and gains no target topic or option | Contract 4 Guide cutover remains SU-M5 |
| `TUI-016` | Declared-input Core values and diagnostics have deterministic semantic order | Temporal analysis and public text/JSON remain SU-M3 and SU-M5 |
| `TUI-017` | Grammar 2 formatter and temporal mutation retain every absolute temporal token | Exact migration and inverse qualification remain SU-M4 |
| `TUI-018` | Public activation and package publication remain absent and independently gated | Boundary delivered; Contract 4 activation remains SU-M5 |

## 4. Example observation trace

| ID | SU-M2 observation | Remaining owner |
| --- | --- | --- |
| `TUE-001` | Active Grammar 1 rejects each temporal field; the target parser accepts them only under Grammar 2 | Complete for SU-M2 |
| `TUE-002` | Every temporal field without `as_of` reports field-local `PTSEM-112` | Complete for SU-M2 |
| `TUE-003` | Invalid calendar tokens fail at their exact source positions | Complete for SU-M2 |
| `TUE-004` | Leap-day source and declared inputs retain exact tagged values | Calendar and deadline results: SU-M3 |
| `TUE-005` | Equal instants retain their distinct offset-bearing source tokens | Relationship projection: SU-M3 |
| `TUE-006` | Mixed temporal kinds remain valid source and do not alter active start authority | Calendar, deadline, and Next v4 results: SU-M3 |
| `TUE-007` | Date anchor plus hour duration is valid without inventing a clock | Unavailable calendar result: SU-M3 |
| `TUE-008` | The normative comparison case remains unchanged | Deadline comparison: SU-M3 |
| `TUE-009` | The resource fixture parses, validates, and formats deterministically | Temporal resource assessment: SU-M3 |
| `TUE-010` | The blocked fixture parses, validates, and formats deterministically | Block-qualified deadline assessment: SU-M3 |
| `TUE-011` | Reached and completed temporal source is retained without inventing event history | History-unavailable deadline result: SU-M3 |
| `TUE-012` | All Point-to-day fixture temporal tokens survive format and temporal edits | Exact migration and inverse: SU-M4 |
| `TUE-013` | All hour-to-Point fixture temporal tokens survive format and temporal edits | Replacement-velocity migration: SU-M4 |
| `TUE-014` | Migration-shaped batch requests fail closed at the SU-M2 boundary | Stable migration failure results: SU-M4 |
| `TUE-015` | The non-representable fixture remains valid source with exact values | Finite-decimal migration preflight: SU-M4 |
| `TUE-016` | Target final-candidate batches are deterministic and repeatable | Migration no-op and repetition: SU-M4 |
| `TUE-017` | Exact temporal source tokens remain available to the later inverse planner | Exact inverse qualification: SU-M4 |
| `TUE-018` | Target source and declared-input arrays use deterministic semantic order | Public text/JSON order: SU-M5 |

All nine Grammar 2 source fixtures cross the target parser, validator, and
formatter. The M2-specific test suites cover malformed input,
source-preserving UTF-16 edits, final-candidate batch behavior, exact tokens,
determinism, diagnostic limits, and the active Contract 3 rejection boundary.

## 5. Verification map

| Gate | Evidence |
| --- | --- |
| Source and malformed input | `test/temporal-source-parser.test.mjs`, `test/temporal-semantic-validator.test.mjs` |
| Source preservation and formatter determinism | `test/temporal-formatter.test.mjs` |
| Mutation, batch, diff, digest, race, symlink, and post-write behavior | `test/temporal-mutation.test.mjs` |
| CheckResult v2 and ProjectResult v2 target Core | `test/temporal-declared-input.test.mjs` |
| Normative TUE baseline | `test/temporal-unit-examples.test.mjs` |
| Contract 3 registry, help, JSON identities, and rejection | `test/scheduling-units-m2-acceptance.test.mjs` and existing command/CLI tests |
| Packed public API and installed CLI boundary | `scripts/check-package.sh` |
| Documentation, plans, link, package, and repository regression | `npm run check` |

The installed-package gate checks the actual tarball rather than the source
checkout. It verifies that the package root omits target-only APIs, command
help contains no Contract 4 route, option, or target schema, and installed
document check, format, project show, analyze, and next retain their Contract
3 identities while rejecting a Grammar 2 fixture.

After SU-M2 completion, the macro frontier also provides a real orthogonality
witness from Recommendation section 10: the existing scheduler set
`L = [SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE]` differs from the preferred,
joint-feasible recommendation
`R = [SU_M4_UNIT_MIGRATION_WORK_PACKAGE]`. Both tasks are ready. This is not an
invariant failure and does not authorize replacing the recommendation with
the scheduler set. The self-use shadow gate verifies that recommendations are
a ready subset with a true joint-feasibility fact; it does not incorrectly
require `R` to be a subset of `L`.

## 6. SU-M3 handoff

SU-M3 starts only after this accepted SU-M2 detail and its macro work package
are completed and advanced from committed snapshots. Create and estimate a
new SU-M3 detail plan from the accepted target interfaces; do not hide its
task state in the macro duration.

The SU-M3 detail must compose the accepted target source and declared-input
Core into:

1. exact fixed-offset calendar projection;
2. deadline evaluation and destination relationships;
3. temporal precedence and heuristic resource views;
4. a target AnalysisResult v3 projection;
5. a target NextResult v4 that embeds the unchanged complete v3
   recommendation graph and applies time gating only to start authority; and
6. cross-boundary shadow tests that keep Contract 3 as normal authority.

SU-M3 must not expose target modules from the package root, add Contract 4
descriptors/help, make NextResult v4 normal authority, implement unit
migration, or publish a package.
