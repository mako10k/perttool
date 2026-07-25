# Normative Temporal and Unit-Migration Examples

- Document status: Normative 1.0
- Created: 2026-07-25
- Related requirements: [../requirements.md](../requirements.md)
- Calendar semantics: [../specs/temporal-calendar.md](../specs/temporal-calendar.md)
- Deadline semantics: [../specs/temporal-deadline.md](../specs/temporal-deadline.md)
- Unit migration: [../specs/unit-migration.md](../specs/unit-migration.md)
- Public interface: [../specs/temporal-unit-interface.md](../specs/temporal-unit-interface.md)
- Machine-readable baseline:
  [../../test/fixtures/temporal-units/cases.json](../../test/fixtures/temporal-units/cases.json)

## 1. Purpose and activation boundary

These examples fix the boundary observations used to transfer the accepted
SU-M1 temporal and unit-migration contract into implementation and acceptance
tests. The case IDs are stable across the normative narrative, target source
fixtures, unit tests, future Core tests, CLI JSON/text goldens, and
installed-package tests.

The examples target grammar version 2 and CLI Contract 4. They do not activate
either version. The current runtime remains grammar version 1, CLI Contract 3,
and `Perttool.NextResult.v3`; it is expected to reject these future source
fixtures until the Contract 4 cutover is accepted. README and current command
help must not present the target fixtures as runnable current-package examples.

The source fixtures under
[`test/fixtures/temporal-units/`](../../test/fixtures/temporal-units/) are
normative target inputs, not generated output. `cases.json` is the
machine-readable expected-observation baseline. It records semantic subsets,
not permission to omit any required field from a complete public result.

## 2. Common conditions

Unless a case says otherwise:

```text
grammar_version                    = 2
cli_contract_version               = 4
calendar_arithmetic                = perttool.calendar-projection@1
calendar_profile                   = perttool.calendar.continuous-fixed-offset@1
deadline_evaluation                = perttool.deadline-evaluation@1
temporal_precedence_projection     = perttool.temporal-precedence-earliest@1
temporal_resource_projection       = perttool.temporal-parallel-sgs@1
unit_migration                     = perttool.unit-migration@1
recommendation_algorithm           = perttool.recommendation-ranking.lexicographic-frontier@1
recommendation_interface           = 1
reason_taxonomy                    = 1.0
deadline_facts_used_for_ranking    = false
```

All arithmetic is exact Rational arithmetic. Human-readable decimal or ISO
text is a projection and is never reused as a semantic input. A resource
projection is deterministic and retains `optimal=false`. Stable array order
follows the public-interface contract.

## 3. Validation and calendar cases

### TUE-001 Grammar version 1 remains closed

A version 1 task containing `deadline 2026-07-25` fails ordinary validation
with `PTDSL-005`. The parser must not accept the field and then hide it from a
version 1 result. Because parsing did not produce trusted temporal values,
`CheckResult.v2.temporal_inputs` is null.

### TUE-002 A temporal field requires the explicit anchor

A version 2 document containing a milestone deadline but no `project.as_of`
fails with `PTSEM-112`. Validation does not read the wall clock or host time
zone to repair the document.

### TUE-003 Invalid calendar values remain source errors

The following tokens all fail with `PTDSL-008`.

| Token | Boundary |
| --- | --- |
| `2026-02-29` | Nonexistent Gregorian date |
| `2026-07-25T10:00:00` | Local date-time without an offset |
| `2026-07-25T10:00:60Z` | Leap second |

These are invalid inputs, not valid results with an unavailable temporal
projection.

### TUE-004 Leap-day release and inclusive date deadline

Input:
[`calendar-date-v2.pert`](../../test/fixtures/temporal-units/calendar-date-v2.pert)

The project anchor is `2028-02-28`, and `LEAP_WINDOW.not_before` is
`2028-02-29`. The exact release bound is `1d`. The task starts at relative
`1d`, finishes at relative `3d`, and projects to `2028-02-29` and
`2028-03-02`.

The task deadline is `2028-03-01`. At the snapshot it is `not_due`, with an
exact current window of two civil days. Both temporal schedule views finish
one civil day after the deadline:

```text
precedence assessment = lower_bound_late
resource assessment   = heuristic_late, optimal=false
combined assessment   = forecast_infeasible
signed margin         = -1 calendar day
```

No end-of-day time is invented. The continuous profile counts February 29 and
the following civil dates without a business-calendar exception.

### TUE-005 Equal instants retain different offsets

Input:
[`calendar-offset-v2.pert`](../../test/fixtures/temporal-units/calendar-offset-v2.pert)

The following pairs denote equal instants:

```text
as_of       2026-07-25T09:00:00+09:00
not_before  2026-07-25T00:00:00Z

task deadline       2026-07-25T02:00:00Z
milestone deadline  2026-07-25T11:00:00+09:00
```

The release bound is zero. A two-hour task finishes at
`2026-07-25T11:00:00+09:00`, exactly on both deadlines. Its task-to-destination
relationship is `same_deadline`, signed margin is zero SI seconds, and the
combined assessment is `forecast_on_time`.

Declared `source_text` retains each original offset. The derived finish uses
the anchor offset. Equality must not rewrite the task deadline from `Z` to
`+09:00`.

### TUE-006 Mixed temporal kinds are valid but not start authority

Input:
[`mixed-kind-v2.pert`](../../test/fixtures/temporal-units/mixed-kind-v2.pert)

The project uses a date anchor while `FUTURE_CLOCK.not_before` is a date-time.
The document is valid, and the task remains structurally `ready`. Normal
Recommendation version 1 may still rank it `recommended`.

The release relationship is unavailable with
`incomparable_temporal_kinds`. Therefore NextResult v4 returns:

```text
groups.ready                              = [FUTURE_CLOCK]
recommendation.recommended_task_ids       = [FUTURE_CLOCK]
groups.runnable_now                       = []
startable_recommended_task_ids            = []
unavailable_recommended_task_ids          = [FUTURE_CLOCK]
```

The task is not reclassified as `blocked`, and the unavailable release fact
does not become a Recommendation version 1 ranking fact.

### TUE-007 A date anchor does not invent a clock

Projecting an exact `1h` finish from date anchor `2026-07-25` is valid input but
an unavailable result with `date_anchor_has_no_clock`. It is not projected to
midnight plus one hour, and it is not rounded or promoted to a date-time.

### TUE-008 Current deadline comparison is inclusive

For an incomplete subject and `as_of 2026-07-25`:

| Deadline | Current state |
| --- | --- |
| `2026-07-26` | `not_due` |
| `2026-07-25` | `due_now` |
| `2026-07-24` | `overdue` |

Date equality is a civil-day equality. `due_now` does not imply an end-of-day
clock and does not suppress forecast evaluation.

## 4. Deadline qualification cases

### TUE-009 Resource lateness is at risk, not proven infeasible

Input:
[`deadline-resource-v2.pert`](../../test/fixtures/temporal-units/deadline-resource-v2.pert)

`RESOURCE_FIRST` and `DEADLINE_TASK` can both start at relative zero under
precedence, but they share capacity-one `DEV`. The higher-priority task uses
the resource first.

| View | `DEADLINE_TASK` start | Finish | Deadline relation | Assessment |
| --- | ---: | ---: | --- | --- |
| Precedence | `0h` | `2h` | on deadline | `lower_bound_on_time` |
| Resource | `2h` | `4h` | two hours late | `heuristic_late` |

The combined assessment is `at_risk`. The resource result retains
`optimal=false`, so this case is not proof that all resource-feasible schedules
miss the deadline.

### TUE-010 Blocked predecessors qualify otherwise numeric results

Input:
[`deadline-blocked-v2.pert`](../../test/fixtures/temporal-units/deadline-blocked-v2.pert)

Under the documented assumption that the external block resolves at relative
zero, `BLOCKED_INPUT` and `DELIVER` finish after one and two hours. `DELIVER`
finishes exactly on its deadline in both views.

The result retains:

```text
combined_assessment             = forecast_on_time
conditional_on_blocks_resolved  = true
blocked_task_ids                = [BLOCKED_INPUT]
resource optimal               = false
```

The numeric result is conditional. The implementation must not invent a block
duration or describe it as an unconditional commitment.

### TUE-011 Completed history remains unknown

Input:
[`deadline-complete-v2.pert`](../../test/fixtures/temporal-units/deadline-complete-v2.pert)

The done task `HISTORICAL` and reached milestone `FINISH` retain their declared
deadlines but have `completion_state=complete_actual_time_unavailable`.
Current state, both forecast views, and combined assessment are
`not_applicable`. Relative time zero is not substituted as an actual
completion timestamp.

## 5. Unit-migration cases

### TUE-012 Point to day converts the complete inventory

Input:
[`migration-point-v2.pert`](../../test/fixtures/temporal-units/migration-point-v2.pert)

Request:

```text
target_unit          = day
effective_velocity   = 20p/10d
velocity_disposition = retained
```

Exact expected tokens, in converted-field order:

| Field | Original | Converted |
| --- | ---: | ---: |
| `project.critical_epsilon` | `0.5p` | `0.25d` |
| `project.target_duration` | `12p` | `6d` |
| `task.FIXED.duration` | `4.00p` | `2d` |
| `task.ESTIMATED.estimate.optimistic` | `2p` | `1d` |
| `task.ESTIMATED.estimate.most_likely` | `4p` | `2d` |
| `task.ESTIMATED.estimate.pessimistic` | `6p` | `3d` |

Every `as_of`, `not_before`, and deadline token remains byte-identical. The
result is `reversibility=exact`.

### TUE-013 Hour to Point inserts the caller-supplied relationship

Input:
[`migration-hour-v2.pert`](../../test/fixtures/temporal-units/migration-hour-v2.pert)

The hour project has no declared velocity. Requesting Point with replacement
`8p/4h` inserts that velocity and converts:

```text
0.5h -> 1p
4h   -> 8p
2.5h -> 5p
1h   -> 2p
2h   -> 4p
3h   -> 6p
```

The disposition is `inserted`. Exact values can invert under the effective
velocity, but original metadata did not contain that velocity, so the result
is `values_exact_metadata_changed`. Absolute temporal tokens remain unchanged.

### TUE-014 Direction and velocity failures are distinct

| Source | Target | Effective/replacement velocity | Cause | Diagnostic |
| --- | --- | --- | --- | --- |
| Point | hour | `10p/5d` | `velocity_period_mismatch` | `PTMIG-405` |
| day | hour | `10p/5d` | `unsupported_direction` | `PTMIG-404` |
| hour | Point | `10p/5d` | `velocity_period_mismatch` | `PTMIG-405` |
| hour | hour | replacement `8p/4h` | `same_unit_velocity_change` | `PTMIG-406` |

No failure exposes a partial candidate or a partially changed velocity.

### TUE-015 A non-terminating decimal rejects the whole candidate

Input:
[`migration-nonrepresentable-v2.pert`](../../test/fixtures/temporal-units/migration-nonrepresentable-v2.pert)

With `3p/1d`, Point values `1p` and `2p` become `1/3d` and `2/3d`. Migration
fails once with `nonrepresentable_decimal` / `PTMIG-408`, retaining every
affected field in source and field order:

```text
project.critical_epsilon
project.target_duration
task.FIXED.duration
task.ESTIMATED.estimate.optimistic
task.ESTIMATED.estimate.most_likely
```

The representable `3p -> 1d` field does not appear in that list. The failure
returns no candidate, updated digest, edits, diff, or velocity replacement.

### TUE-016 Same-unit and repeated requests are idempotent

A same-unit request without a replacement is a successful no-op and does not
require velocity:

```text
changed       = false
updated_text  = original source
edits         = []
diff          = ""
reversibility = not_applicable
```

After a changing-unit migration, repeating its target without a replacement
has exactly the same result and does not rescale any value.

### TUE-017 Exact inverse restores values, not lexical padding

Run `migration-point-v2.pert` from Point to day and then from day to Point
using the retained effective velocity. Every exact source value, base unit,
semantic velocity, and non-timing semantic value is restored. Absolute
temporal source tokens remain byte-identical.

Lexical identity is not promised: the original `4.00p` returns as canonical
`4p`. The result can still report `reversibility=exact`; whole-document byte
equality is false.

## 6. Deterministic projection case

### TUE-018 Text and JSON use one semantic order

Use `calendar-offset-v2.pert` for repeated Core, text, and JSON projection.

JSON identities:

```text
document check  Perttool.CheckResult.v2
project show    Perttool.ProjectResult.v2
dag analyze     Perttool.AnalysisResult.v3
dag next        Perttool.NextResult.v4
cli_contract_version = 4
```

Declared temporal inputs remain in source declaration order. Deadline subjects
are tasks before milestones, each in stable graph order. Every paired view is
precedence before resource.

Text has the following fixed additions:

```text
document check suffix:
  temporal=milestone_deadlines:1,task_not_before:1,task_deadlines:1

project show labels:
  AS_OF
  FINISH_DEADLINE

dag analyze section order:
  TEMPORAL PRECEDENCE
  TEMPORAL RESOURCE
  DEADLINES

dag next first and last sections:
  START AUTHORITY
  ...
  TEMPORAL CONTEXT
```

Next text labels deadline context `INFORMATIONAL FOR RANKING v1`. Resource
headings retain `optimal=false`. Repeating the same operation over the same
source, options, and algorithm versions produces byte-identical output. Text
and JSON are projections of the same Core result, not independently derived
semantics.

## 7. Fixture mapping and implementation acceptance

| Case | Target source fixture | Primary implementation layer |
| --- | --- | --- |
| TUE-001..003 | machine baseline literal/source cases | parser and semantic validation |
| TUE-004 | `calendar-date-v2.pert` | calendar, deadline, Analysis v3 |
| TUE-005, TUE-018 | `calendar-offset-v2.pert` | exact offset, text/JSON |
| TUE-006 | `mixed-kind-v2.pert` | unavailable projection, Next v4 authority |
| TUE-007, TUE-008 | machine baseline fact cases | calendar and deadline units |
| TUE-009 | `deadline-resource-v2.pert` | temporal SGS and risk qualification |
| TUE-010 | `deadline-blocked-v2.pert` | block qualification |
| TUE-011 | `deadline-complete-v2.pert` | history-unavailable state |
| TUE-012, TUE-017 | `migration-point-v2.pert` | Point/time migration and inverse |
| TUE-013 | `migration-hour-v2.pert` | replacement velocity insertion |
| TUE-014, TUE-016 | machine baseline request cases | migration request validation and no-op |
| TUE-015 | `migration-nonrepresentable-v2.pert` | finite-decimal preflight |

During implementation, retain the same IDs in:

- parser and semantic validation tests;
- calendar, deadline, temporal scheduler, and migration Core tests;
- complete JSON and text goldens;
- source-preserving mutation, batch, preview, diff, write, and race tests;
- Next v3-to-v4 shadow and authority-adoption tests; and
- isolated installed-package file-first acceptance.

No excerpt in this document is a complete public result. Full-result tests
must also verify schema closure, exact values, diagnostic closure, stable
ordering, unavailable causes, block qualifiers, scheduler identity, and
unknown/incomplete-result safe stop.

## 8. Acceptance

- Fixed valid, invalid, unavailable, and not-applicable temporal boundaries.
- Fixed leap-day, inclusive date, equal-instant offset, and mixed-kind cases.
- Separated precedence proof from heuristic resource lateness and block
  qualification.
- Fixed Point-to-time and time-to-Point inventory, velocity, and exact tokens.
- Fixed unsupported, mismatched, same-unit, and nonrepresentable failures.
- Fixed no-op, repetition, inverse, and lexical-normalization behavior.
- Fixed deterministic text/JSON identities, order, labels, and common-Core
  projection.
- Did not activate Grammar 2, CLI Contract 4, NextResult v4 authority, runtime
  i18n, or package publication.
