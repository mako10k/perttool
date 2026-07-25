# SU-M1 Temporal and Unit-Migration Contract Acceptance Review

- Document status: Accepted 1.0
- Acceptance date: 2026-07-25
- Backlog: [TIME-001 and UNIT-001](../backlog.md#scheduling-metadata-and-unit-migration)
- Macro plan: [../../plans/scheduling-units.pert](../../plans/scheduling-units.pert)
- Detail plan: [../../plans/scheduling-units-m1.pert](../../plans/scheduling-units-m1.pert)
- Interface acceptance IDs: `TUI-001` through `TUI-018`
- Example baseline: `Perttool.TemporalUnitExampleBaseline.v1`

## 1. Decision

Accept the SU-M1 contract for the first temporal and Point/time-unit
extensions. The requirements, four normative specifications, basic design,
normative examples, diagnostics, compatibility boundary, and implementation
sequence are mutually consistent after the resolutions in this review.

This is design acceptance, not runtime activation. The active source remains
Grammar 1, CLI Contract 3, and `Perttool.NextResult.v3`. It does not accept
temporal source fields, emit the target result schemas, expose
`project migrate-unit`, or use temporal facts as normal start authority.

No semantic blocker remains for creating and estimating the SU-M2 detail plan.
No package release, Git push, GitHub release, npm publication, or dist-tag
change is authorized by this acceptance.

## 2. Accepted identities

| Concern | Accepted identity |
| --- | --- |
| Calendar arithmetic | `perttool.calendar-projection` version 1 |
| Calendar profile | `perttool.calendar.continuous-fixed-offset` version 1 |
| Deadline evaluation | `perttool.deadline-evaluation` version 1 |
| Temporal precedence | `perttool.temporal-precedence-earliest` version 1 |
| Temporal resource schedule | `perttool.temporal-parallel-sgs` version 1 |
| Unit migration | `perttool.unit-migration` version 1 |
| Public interface | `perttool.temporal-unit-interface` version 1 |
| Target grammar | Grammar 2 |
| Target CLI | CLI Contract 4 |
| Target results | `Perttool.CheckResult.v2`, `Perttool.ProjectResult.v2`, `Perttool.AnalysisResult.v3`, `Perttool.NextResult.v4`, and `Perttool.UnitMigrationResult.v1` |

Recommendation algorithm version 1, recommendation interface version 1,
reason taxonomy version 1.0, and the base Analysis v2 result retain their
accepted meanings inside the target envelopes.

## 3. Review scope

- Temporal scope and source-migration requirements in
  [Requirements sections 7.6 and 7.7](../requirements.md#76-temporal-property-scope)
- [Temporal Calendar Semantics](../specs/temporal-calendar.md)
- [Temporal Deadline Semantics](../specs/temporal-deadline.md)
- [Point and Time-Unit Migration Semantics](../specs/unit-migration.md)
- [Temporal and Unit Interface Contract](../specs/temporal-unit-interface.md)
- [Normative Temporal and Unit-Migration Examples](../examples/temporal-units.md)
- [Basic design sections 6.7 and Post-MVP Slice 4E](../basic-design.md#67-temporal-and-unit-public-interface)
- The SU-M0 through SU-M5 refinement in [Backlog](../backlog.md#refinement-and-delivery-milestones)

## 4. Resolved review findings

| ID | Finding | Resolution | Status |
| --- | --- | --- | --- |
| `SU1-R1` | The prior SU-M2 and SU-M4 wording required public help, JSON, and installed-package acceptance before SU-M3 deadline Core and the complete migration/public cutover were available. That contradicted the one-cutover rule. | SU-M2 through SU-M4 are target-only source and Core slices. SU-M5 alone atomically activates Contract 4 schemas, registry/dispatch, help, Guide, README, installed-package workflows, and Next v4 normal authority. | Resolved |
| `SU1-R2` | Version closure and missing-anchor examples fixed only representative temporal fields. | `TUE-001` and `TUE-002` now fix milestone `deadline`, task `not_before`, and task `deadline` individually. | Resolved |
| `SU1-R3` | The examples did not completely distinguish future versus reached release authority, deadline relations and signed margins, absent deadlines, or all combined states. | `TUE-004` through `TUE-008` and `TUE-011` now fix delayed/eligible/unavailable/not-applicable start authority, before/on/after margins, destination relationships, absence, overdue, not-proven-late, and unavailable states. | Resolved |
| `SU1-R4` | Migration examples asserted temporal preservation without fixing every field occurrence. | `TUE-012` and `TUE-013` now identify the unchanged token for all six temporal field paths in each source fixture. | Resolved |

There are no open SU-M1 review findings. Business calendars, actual event
history, deadline-aware ranking, Git-integrated audit/apply, and package
publication remain explicit later or independent work, not hidden blockers.

## 5. Requirement trace

| Requirement group | Normative resolution | Boundary evidence | Delivery gate |
| --- | --- | --- | --- |
| Accepted temporal fields, anchor, kinds, readiness separation, exact projections, and unavailable causes | Requirements 7.6; Calendar sections 5 through 14; Interface sections 3 and 4 | `TUE-001` through `TUE-008` | SU-M2 source/Core, then SU-M3 temporal Core |
| Task/milestone deadline state, exact margin, feasibility, heuristic qualification, blocks, risk, and versioned recommendation effect | Requirements 7.6; Deadline sections 5 through 18; Interface sections 8.3 and 8.4 | `TUE-004` through `TUE-011` | SU-M3 target Core |
| Point/time direction, velocity, complete field inventory, exact conversion, atomic candidate, idempotence, and inverse qualification | Requirements 7.7; Migration sections 5 through 16; Interface sections 4.3, 6, and 8.5 | `TUE-012` through `TUE-017` | SU-M4 target Core |
| Schema identities, CLI operation, mutation/batch boundary, diagnostics, help, deterministic text/JSON, and authority migration | Interface sections 2 through 11 | `TUE-018` plus all semantic cases | SU-M5 atomic public cutover |

## 6. Interface acceptance trace

| ID | Normative evidence | Example and implementation gate | Decision |
| --- | --- | --- | --- |
| `TUI-001` | Interface 3.1 through 3.3 | `TUE-001`, `TUE-003`; SU-M2 parser/validator | Accepted |
| `TUI-002` | Calendar 7 and 14; Interface 3.3 | `TUE-002`, `TUE-006`, `TUE-007`; SU-M2/SU-M3 | Accepted |
| `TUI-003` | Interface 3.4, 5.2, and 10 | `TUE-001`, `TUE-002`, `TUE-018`; SU-M2 then SU-M5 help | Accepted |
| `TUI-004` | Interface 8.1 and 8.2 | `TUE-001`, `TUE-018`; SU-M2 Core then SU-M5 schemas | Accepted |
| `TUI-005` | Deadline 7 through 9; Interface 8.3 | `TUE-004`, `TUE-005`, `TUE-007`, `TUE-009`; SU-M3 then SU-M5 | Accepted |
| `TUI-006` | Deadline 10 through 15 and 17 | `TUE-006`, `TUE-008` through `TUE-011`; SU-M3 | Accepted |
| `TUI-007` | Deadline 16; Interface 8.4 and 11 | `TUE-004` through `TUE-006`, `TUE-018`; SU-M3 shadow then SU-M5 authority | Accepted |
| `TUI-008` | Calendar 12; Interface 8.4 | `TUE-004` through `TUE-006`, `TUE-011`; SU-M3 | Accepted |
| `TUI-009` | Interface 5.2 and 6 | `TUE-004`, `TUE-005`; SU-M2 mutation | Accepted |
| `TUI-010` | Interface 6 | `TUE-001`, `TUE-002`; SU-M2 final-candidate batch | Accepted |
| `TUI-011` | Migration 4 and 11; Interface 4.3 and 6 | `TUE-012` through `TUE-016`; SU-M4 then SU-M5 command | Accepted |
| `TUI-012` | Migration 14 and 15; Interface 8.5 and 10.3 | `TUE-012` through `TUE-016`; SU-M4 | Accepted |
| `TUI-013` | Migration 11; Interface 6 | `TUE-012` through `TUE-017`; SU-M2/SU-M4 safe-write reuse | Accepted |
| `TUI-014` | Interface 5 and 10.1 | `TUE-018`; SU-M5 registry/dispatch/help cutover | Accepted |
| `TUI-015` | Interface 10.1 | `TUE-018`; SU-M5 Guide cutover | Accepted |
| `TUI-016` | Interface 7 through 9 | `TUE-004` through `TUE-011`, `TUE-018`; SU-M3/SU-M5 | Accepted |
| `TUI-017` | Migration 12 and 13.3; Interface 11 | `TUE-012`, `TUE-013`, `TUE-017`; SU-M4 | Accepted |
| `TUI-018` | Interface 11 | `TUE-018`; SU-M5 activation, later publication decision | Accepted |

## 7. Implementation handoff

The next detail plans must retain these gates:

1. **SU-M2:** implement target Grammar 2 parsing and validation, formatting,
   temporal mutation/batch behavior, and declared-input Core projections.
   Keep active dispatch, public result schemas, help, and installed-package
   behavior at Contract 3.
2. **SU-M3:** implement the target calendar, deadline, temporal precedence
   and heuristic-resource projections, and Next v4 time-gated start-authority
   Core. Shadow the unchanged embedded v3 recommendation graph. Do not adopt v4
   as normal authority.
3. **SU-M4:** implement the exact migration planner, complete inventory,
   localized candidate, diff, diagnostics, idempotence, inverse qualification,
   and ordinary safe-write integration. Do not publish the Contract 4 command.
4. **SU-M5:** atomically publish Grammar 2 and CLI Contract 4 with all target
   result schemas, registry/dispatch, text/JSON help, Guide, README,
   installed-package workflow, override validation, unknown-result safe stop,
   and Next v4 normal start authority.
5. Decide Git/GitHub/npm publication only after local SU-M5 acceptance through
   a separately authorized release workstream.

Later work-package estimates in the macro plan remain provisional. Create and
estimate the SU-M2 detail plan from this accepted contract rather than
inventing task state in the macro plan.

## 8. Verification

Acceptance requires:

- exact checks for all 18 `TUI-*` rows and the contiguous 18-case `TUE-*`
  baseline;
- target fixture and field-occurrence checks;
- requirements, backlog, plan, and basic-design sequencing alignment;
- documentation and link checks;
- full repository checks; and
- review of the intended diff before recording plan completion.

The implementation gates must replace target-only structural checks with
complete Core, CLI, text/JSON golden, safe-write, shadow, authority, and
isolated installed-package tests without changing the accepted meanings.
