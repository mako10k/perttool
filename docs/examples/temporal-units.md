# Normative Temporal and Unit-Migration Examples

- Document status: Normative 2.0
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
temporal/unit contract and its SU-M2R exact-Duration refinement into
implementation and acceptance tests. The case IDs are stable across the
normative narrative, target source fixtures, unit tests, future Core tests,
CLI JSON/text goldens, and installed-package tests.

The examples target grammar versions 2 and 3 and CLI Contract 4. They do not
activate any target version. The current runtime remains grammar version 1,
CLI Contract 3, and `Perttool.NextResult.v3`; it is expected to reject these
future source fixtures until the Contract 4 cutover is accepted. README and
current command help must not present the target fixtures as runnable
current-package examples.

The source fixtures under
[`test/fixtures/temporal-units/`](../../test/fixtures/temporal-units/) are
normative target inputs, not generated output. `cases.json` is the
machine-readable expected-observation baseline. It records semantic subsets,
not permission to omit any required field from a complete public result.

## 2. Common conditions

The common target-interface identities are below. A case's source grammar is
explicit and independent: all file-backed fixtures in this baseline are
grammar version 2, TUE-015 upgrades its candidate to version 3, and TUE-019
and TUE-020 exercise version 3 literals directly.

```text
target_grammar_version             = 3
cli_contract_version               = 4
temporal_unit_interface            = perttool.temporal-unit-interface@2
calendar_arithmetic                = perttool.calendar-projection@1
calendar_profile                   = perttool.calendar.continuous-fixed-offset@1
deadline_evaluation                = perttool.deadline-evaluation@1
temporal_precedence_projection     = perttool.temporal-precedence-earliest@1
temporal_resource_projection       = perttool.temporal-parallel-sgs@1
unit_migration                     = perttool.unit-migration@2
unit_migration_result              = Perttool.UnitMigrationResult.v2
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

Each of milestone `deadline`, task `not_before`, and task `deadline` fails
ordinary version 1 validation with `PTDSL-005`. The parser must not accept any
of the fields and then hide it from a version 1 result. Because parsing did not
produce trusted temporal values, `CheckResult.v2.temporal_inputs` is null.

### TUE-002 A temporal field requires the explicit anchor

Each of milestone `deadline`, task `not_before`, and task `deadline` requires
an explicit `project.as_of` in version 2. Omitting the anchor fails with
`PTSEM-112`. Validation does not read the wall clock or host time zone to
repair the document.

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

The task is structurally ready and remains recommended by Recommendation
version 1, but the future release bound removes it from both `runnable_now` and
`startable_recommended_task_ids`. It appears in
`delayed_recommended_task_ids` with `not_yet_eligible` /
`not_before_future`.

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

The equal release instant is eligible. The task appears in both `runnable_now`
and `startable_recommended_task_ids` with `not_before_reached`.

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
The combined deadline assessment is also `unavailable`.

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

Forecast comparisons retain exact signed margins:

| Completion | Relation | Signed margin |
| --- | --- | ---: |
| One civil day before | `before_deadline` | `1 calendar day` |
| Same civil day | `on_deadline` | `0 calendar days` |
| One civil day after | `after_deadline` | `-1 calendar day` |

A task deadline before, equal to, or after its destination milestone deadline
is respectively `task_deadline_before_milestone`, `same_deadline`, or
`task_deadline_after_milestone`. Mixed date/date-time kinds produce
`unavailable`; an absent destination deadline produces `deadline_absent`.
Absence suppresses only that deadline evaluation, not an otherwise available
temporal schedule.

The combined-state witnesses also remain distinct: an incomplete subject
already past its deadline is `overdue`; a precedence-on-time result with an
unavailable resource relationship is `not_proven_late`; and a subject whose
forecast relationships are all unavailable is `unavailable`.

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

The retained `not_before` value is likewise not start authority for history:
time eligibility is `not_applicable` with `task_already_started`.

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

Every occurrence of `project.as_of`, both milestone deadlines, the task
`not_before`, and both task deadlines remains byte-identical. The
machine-readable case fixes the original token at each of those six field
paths. The result is `reversibility=exact`.

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
The machine-readable case fixes the retained token at all six temporal field
paths rather than treating preservation as a document-level boolean.
An inverse request retains this now-declared velocity and does not infer its
former absence; sequence-level comparison therefore retains this forward
qualification.

### TUE-014 Direction and velocity failures are distinct

| Source | Target | Effective/replacement velocity | Cause | Diagnostic |
| --- | --- | --- | --- | --- |
| Point | hour | `10p/5d` | `velocity_period_mismatch` | `PTMIG-405` |
| day | hour | `10p/5d` | `unsupported_direction` | `PTMIG-404` |
| hour | Point | `10p/5d` | `velocity_period_mismatch` | `PTMIG-405` |
| hour | hour | replacement `8p/4h` | `same_unit_velocity_change` | `PTMIG-406` |

No failure exposes a partial candidate or a partially changed velocity.

### TUE-015 A non-terminating exact value upgrades to fraction Duration

Input:
[`migration-nonrepresentable-v2.pert`](../../test/fixtures/temporal-units/migration-nonrepresentable-v2.pert)

With `3p/1d`, Point values `1p`, `2p`, and `3p` become exact `1/3d`,
`2/3d`, and `1d`. Migration version 2 succeeds with one candidate:

| Field | Canonical token |
| --- | --- |
| `project.critical_epsilon` | `1/3d` |
| `project.target_duration` | `2/3d` |
| `task.FIXED.duration` | `1/3d` |
| `task.ESTIMATED.estimate.optimistic` | `1/3d` |
| `task.ESTIMATED.estimate.most_likely` | `2/3d` |
| `task.ESTIMATED.estimate.pessimistic` | `1d` |

Because at least one token requires a Fraction, the same candidate changes
the explicit project version from 2 to 3. The result reports
`grammar_disposition=upgraded_for_exact_fraction`,
`reversibility=values_exact_metadata_changed`, and
`grammar_upgraded_for_exact_fraction`. It does not emit reserved
`PTMIG-408`.

An inverse migration restores every exact Point value but retains grammar
version 3. It reports `grammar_version_retained_on_inverse` rather than
silently downgrading the document.

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
project migrate-unit Perttool.UnitMigrationResult.v2
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

## 7. Exact Duration grammar cases

### TUE-019 Grammar 3 accepts fractions and retains Decimal compatibility

Grammar version 3 accepts `1d`, `0.5d`, `1/3d`, `4/6d`, and `0/7d` as exact
Duration tokens. Their normalized values and explicit-format results are:

| Input | Exact value | Canonical token |
| --- | --- | --- |
| `1d` | `1/1d` | `1d` |
| `0.5d` | `1/2d` | `0.5d` |
| `1/3d` | `1/3d` | `1/3d` |
| `4/6d` | `2/3d` | `2/3d` |
| `0/7d` | `0/1d` | `0d` |

No value is rounded. Grammar version 2 still rejects a Fraction Duration with
`PTDSL-007`; its accepted Decimal behavior is unchanged.

### TUE-020 Malformed fractions fail before Rational arithmetic

Each token below fails as one invalid Duration token with `PTDSL-007`:

```text
1/0d
-1/3d
1/-3d
1 /3d
1/ 3d
1.5/3d
1/3.0d
1/2/3d
```

No token reaches Rational arithmetic or produces a candidate.

## 8. Fixture mapping and implementation acceptance

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
| TUE-015 | `migration-nonrepresentable-v2.pert` | exact fraction output and atomic grammar upgrade |
| TUE-019, TUE-020 | machine baseline Duration literals | Grammar 3 parser, validator, formatter, and diagnostics |

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

## 9. Acceptance

- Fixed valid, invalid, unavailable, and not-applicable temporal boundaries.
- Fixed leap-day, inclusive date, equal-instant offset, and mixed-kind cases.
- Separated precedence proof from heuristic resource lateness and block
  qualification.
- Fixed Point-to-time and time-to-Point inventory, velocity, and exact tokens.
- Fixed unsupported, mismatched, and same-unit failures plus reserved
  migration-version-1 representability diagnostics.
- Fixed Grammar 3 Decimal-or-fraction acceptance, malformed-fraction
  rejection, canonical serialization, and atomic source-grammar upgrade.
- Fixed no-op, repetition, inverse, and lexical-normalization behavior.
- Fixed deterministic text/JSON identities, order, labels, and common-Core
  projection.
- Did not activate Grammar 2 or 3, CLI Contract 4, NextResult v4 authority,
  runtime i18n, or package publication.
