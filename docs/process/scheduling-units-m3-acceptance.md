# SU-M3 Temporal Deadline and Next v4 Target Core Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-07-26
- Accepted contracts:
  [temporal calendar semantics](../specs/temporal-calendar.md),
  [temporal deadline semantics](../specs/temporal-deadline.md), and
  [temporal and unit interface](../specs/temporal-unit-interface.md)
- Macro plan:
  [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan:
  [../../plans/scheduling-units-m3.pert](../../plans/scheduling-units-m3.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-020`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v2`

## 1. Decision

Accept the internal SU-M3 temporal deadline and NextResult v4 target Core.
The target-only application boundary validates Grammar 1, 2, or 3 input,
projects exact calendar relationships and effective Duration values, produces
release-aware temporal precedence and deterministic heuristic resource
schedules, evaluates current and forecast deadline state, composes
`Perttool.AnalysisResult.v3`, and derives `Perttool.NextResult.v4`.

NextResult v4 embeds the unchanged complete Recommendation version 1 graph.
It applies only the accepted temporal release gate to `runnable_now`, reports
startable, delayed, and unavailable recommended members separately, and keeps
`deadline_facts_used_for_ranking=false`. A future or unavailable
`not_before` value does not change structural readiness. Deadline evidence
does not change recommendation order.

Exact Gregorian date arithmetic, fixed-offset instant comparison, Rational
Duration projection, release event ordering, resource capacity, blocked
qualification, due/overdue state, lower-bound feasibility, heuristic risk,
completed-history unavailability, malformed input, and deterministic result
composition have no open SU-M3 acceptance findings.

The accepted modules remain internal build artifacts. Active Grammar 1, CLI
Contract 3, CheckResult v1, ProjectResult v1, AnalysisResult v2, NextResult
v3 normal authority, root exports, the 27-command registry, help, Guide,
README workflows, installed behavior, and package distribution remain
unchanged. SU-M5 owns the atomic public Contract 4 cutover.

No Git push, GitHub release, npm publication, dist-tag change, or Contract 4
activation is authorized by this acceptance.

## 2. Accepted implementation boundary

| Capability | Accepted SU-M3 implementation | Public boundary |
| --- | --- | --- |
| Temporal input | Capability-checked Grammar 1/2/3 projection retains declared anchors, deadlines, release constraints, state, source order, exact velocity, and unavailable causes | Active CheckResult v1 and ProjectResult v1 remain unchanged |
| Calendar | Exact proleptic Gregorian dates and fixed-offset instants project Rational relative values without reading a clock or host timezone | No locale, timezone database, or implicit anchor is added |
| Precedence | `perttool.temporal-precedence-earliest` applies per-task release bounds to exact earliest starts and milestone reach | Existing precedence CPM remains the AnalysisResult v2 base |
| Resource schedule | `perttool.temporal-parallel-sgs` processes completion, release, and stable selection events while preserving capacity and blocked qualification | The result remains a deterministic heuristic, not an exact optimum |
| Deadlines | `perttool.deadline-evaluation` separates current state, precedence lower bound, heuristic forecast, signed margin/lateness, blocked qualification, and unavailable causes | Deadlines remain evidence, not dependency edges or hard constraints |
| Analysis v3 | The internal result retains the complete AnalysisResult v2 base and adds separate temporal input, schedule, and deadline projections | No public JSON/text adapter or root export is added |
| Next v4 | The internal result retains the complete Recommendation v1 graph and changes only release-gated `runnable_now` authority | NextResult v3 remains the normal authority until SU-M5 |
| Failure and determinism | Invalid source suppresses target analysis; unavailable calendar relationships fail closed; repeated inputs and options return equal results | Unknown or incomplete target results cannot authorize work |

## 3. Interface observation trace

| ID | SU-M3 evidence | State after SU-M3 |
| --- | --- | --- |
| `TUI-001` | Grammar 1/2/3 inputs pass through one capability-checked target validator, including exact Fraction Duration | Internal target delivered; public grammar remains SU-M5 |
| `TUI-002` | `project.as_of` is the sole explicit temporal anchor and no runtime clock or host zone is read | Delivered internally |
| `TUI-003` | Source declaration order and deterministic calendar/deadline causes are retained across projections | Delivered internally; public Guide remains SU-M5 |
| `TUI-004` | Target temporal input composes with CheckResult v2 and ProjectResult v2 without widening active v1 results | Public schema cutover remains SU-M5 |
| `TUI-005` | AnalysisResult v3 retains the complete AnalysisResult v2 base and adds distinct temporal views | Delivered internally |
| `TUI-006` | Task, milestone, and project-finish deadline evaluations distinguish current, lower-bound, heuristic, and unavailable evidence | Delivered internally |
| `TUI-007` | NextResult v4 embeds the unchanged complete Recommendation v1 graph and versioned explanation | Delivered internally; normal authority remains v3 |
| `TUI-008` | Only `not_before` release state changes `runnable_now`; structural ready and ranking remain unchanged | Delivered internally |
| `TUI-009` | Temporal analysis consumes source-preserved target fields without adding a mutation route | Mutation Core remains separately accepted |
| `TUI-010` | Analysis introduces no batch member and performs no source write | Delivered internally |
| `TUI-011` | Unit migration is not invoked and temporal results consume exact base-unit values after validation | Unit migration remains SU-M4/SU-M5 |
| `TUI-012` | UnitMigrationResult v2 is not projected or exported by SU-M3 | Public migration remains SU-M5 |
| `TUI-013` | Analysis and Next are read-only and add no safe-write surface | Delivered internally |
| `TUI-014` | The active registry remains exactly 27 Contract 3 commands | Contract 4 registry remains SU-M5 |
| `TUI-015` | Active help and Guide contain no target temporal fields, result identities, or migration workflow | Contract 4 help and Guide remain SU-M5 |
| `TUI-016` | Calendar, schedule, deadline, Analysis v3, and Next v4 values are deterministic for equal input and options | Public JSON/text adapters remain SU-M5 |
| `TUI-017` | Absolute source tokens retain their declared spelling while derived calendar text uses the anchor kind and offset | Delivered internally |
| `TUI-018` | Root exports, installed behavior, Next v3 authority, release, and publication remain closed | Activation boundary delivered |
| `TUI-019` | Grammar 3 Fraction Duration remains exact through temporal precedence, resource, and deadline arithmetic | Delivered internally |
| `TUI-020` | Malformed Fraction source exposes neither base nor temporal target result | Delivered internally |

## 4. Example observation trace

| ID | SU-M3 observation | Remaining owner |
| --- | --- | --- |
| `TUE-001` | Active Grammar 1 remains closed while internal Grammar 2/3 capability use is explicit | Public activation: SU-M5 |
| `TUE-002` | Missing temporal anchor fails validation and exposes no trusted temporal input | Complete for SU-M3 |
| `TUE-003` | Invalid calendar source exposes no temporal analysis or Next authority | Complete for SU-M3 |
| `TUE-004` | Leap-day release, exact calendar-day schedule, deadline lateness, and delayed recommendation are projected | Complete for SU-M3 |
| `TUE-005` | Equivalent fixed-offset instants compare exactly and an equal release is startable | Complete for SU-M3 |
| `TUE-006` | Mixed date/date-time source remains valid but release and forecast fail closed as unavailable | Complete for SU-M3 |
| `TUE-007` | Date anchor plus hour Duration does not invent a clock or temporal authority | Complete for SU-M3 |
| `TUE-008` | Future, equal, and past deadlines produce not-due, due-now, and overdue current states inclusively | Complete for SU-M3 |
| `TUE-009` | Resource delay produces heuristic risk while the precedence lower bound remains on time; ranking is unchanged | Complete for SU-M3 |
| `TUE-010` | Blocked predecessors retain exact conditional forecasts and explicit blocked qualification | Complete for SU-M3 |
| `TUE-011` | Done tasks and reached milestones report actual completion time unavailable rather than inventing history | Complete for SU-M3 |
| `TUE-012` | Point-based temporal input uses the declared velocity as an exact effective projection | Migration command: SU-M5 |
| `TUE-013` | Hour-based input remains exact and no Point conversion is inferred | Migration command: SU-M5 |
| `TUE-014` | Unsupported migration input is outside temporal analysis and cannot alter its authority | Migration diagnostics: SU-M4/SU-M5 |
| `TUE-015` | Non-terminating exact Duration remains Rational; derived date-time text is nullable when no finite spelling exists | Complete for SU-M3 |
| `TUE-016` | Same-unit and repeated migration semantics do not affect temporal result determinism | Migration route: SU-M5 |
| `TUE-017` | Qualified inverse migration preserves temporal tokens consumed by SU-M3 | Migration route: SU-M5 |
| `TUE-018` | Internal target results are deterministic but have no public Contract 3 JSON/text route | Public projection: SU-M5 |
| `TUE-019` | Decimal and Fraction Duration inputs remain exact through schedule and deadline calculations | Complete for SU-M3 |
| `TUE-020` | Malformed Fraction input suppresses the complete target result before calendar arithmetic | Complete for SU-M3 |

The machine-readable baseline remains contiguous through TUE-020. TUE-004
through TUE-011 are the direct temporal and deadline witnesses. TUE-012
through TUE-020 prove exact migration inputs and failures cannot weaken the
temporal result or authority boundary.

## 5. Verification map

| Gate | Evidence |
| --- | --- |
| Exact Gregorian/fixed-offset comparison and Rational projection | `test/calendar-arithmetic.test.mjs`, `test/temporal-input-projection.test.mjs` |
| Release-aware exact precedence | `test/temporal-precedence-schedule.test.mjs` |
| Release-aware heuristic resource schedule and event ordering | `test/temporal-resource-schedule.test.mjs` |
| Deadline current state, lower bounds, heuristic risk, blocking, and completed history | `test/temporal-deadline-evaluation.test.mjs` |
| AnalysisResult v3, NextResult v4, release-gated authority, malformed input, and determinism | `test/target-temporal-analysis.test.mjs` |
| Cross-layer TUI/TUE trace and Contract 3 closure | `test/scheduling-units-m3-acceptance.test.mjs` |
| Grammar 2/3 parsing, validation, Fraction exactness, and normative example baseline | `test/temporal-unit-examples.test.mjs`, `test/rational-duration-source.test.mjs` |
| Active registry, CLI result identities, help, Guide, and target source rejection | `test/cli.test.mjs`, `test/e2e.test.mjs` |
| Packed root exports and installed Contract 3 closure | `scripts/check-package.sh` |
| Documentation, all self-use plans, local link, package, and repository regression | `npm run check` |

The installed-package gate operates on the actual packed tarball. Before
SU-M5 it verifies that the root omits all target temporal APIs, Contract 3
help contains no temporal options or Result v3/v4 identities, and the
installed CLI rejects Grammar 2 temporal and Grammar 3 Fraction sources while
retaining AnalysisResult v2 and NextResult v3.

## 6. SU-M5 handoff

SU-M5 may expose the accepted temporal target Core only as part of the atomic
Contract 4 cutover. It must activate Grammar 3, target Check/Project results,
AnalysisResult v3, NextResult v4, the release-gated normal authority,
temporal JSON/text projection, descriptor dispatch, help, Guide, README, and
installed-package workflows together with the separately accepted unit
migration route.

The cutover must preserve the unchanged Recommendation version 1 graph,
`deadline_facts_used_for_ranking=false`, structural readiness, exact
Rational arithmetic, source-order determinism, unavailable causes, blocked
qualification, and the distinction between precedence lower bounds and the
non-optimal heuristic resource schedule. Unknown or incomplete NextResult v4
must fail closed.

SU-M5 must not publish only a temporal schema, only a migration command, or a
partial authority switch. External release remains governed independently by
`plans/release-0.3.0.pert` and its candidate and PUBLISH gates.
