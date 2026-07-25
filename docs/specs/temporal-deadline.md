# Temporal Deadline Semantics Specification

- Document status: Normative 1.0
- Deadline evaluation ID: `perttool.deadline-evaluation`
- Deadline evaluation version: `1`
- Temporal precedence projection ID: `perttool.temporal-precedence-earliest`
- Temporal precedence projection version: `1`
- Temporal resource projection ID: `perttool.temporal-parallel-sgs`
- Temporal resource projection version: `1`
- Created: 2026-07-25
- Related requirements: [../requirements.md](../requirements.md)
- Calendar semantics: [temporal-calendar.md](temporal-calendar.md)
- Analysis specification: [analysis.md](analysis.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Public interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose

This specification fixes the first deterministic deadline-evaluation contract
for task and milestone deadlines. It defines:

- task-finish and milestone-reach targets;
- temporal precedence and heuristic resource projections that respect
  `not_before`;
- current due and overdue state at `project.as_of`;
- exact signed forecast margin, remaining margin, and lateness;
- precedence lower-bound and heuristic resource feasibility meanings;
- a non-probabilistic `at_risk` state;
- qualifications for unresolved blocks and heuristic schedules;
- the relationship between task and destination-milestone deadlines; and
- the explicit boundary that leaves recommendation algorithm version 1
  unchanged.

This specification does not add grammar fields, select public Core or JSON
types, implement the projection algorithms, or change existing Analysis or
Next result identities. Those are ordered follow-on contracts and delivery
milestones.

## 2. Normative position

Resolve conflicts of meaning or design in the following order.

1. Must requirements in [Requirements](../requirements.md)
2. This specification
3. [Temporal Calendar Semantics](temporal-calendar.md)
4. Exact relative results and graph rules in the
   [Analysis specification](analysis.md)
5. Recommendation contracts
6. `docs/basic-design.md`, examples, tests, help, and implementation

Calendar semantics determines whether values can be compared, subtracted, or
projected. This specification consumes those exact operations and MUST NOT
make an unavailable calendar relationship successful by rounding or by
inventing a clock, offset, calendar, or unit conversion.

## 3. Identities and determinism

The accepted initial identities are:

```text
deadline_evaluation_id                 = perttool.deadline-evaluation
deadline_evaluation_version            = 1
temporal_precedence_projection_id      = perttool.temporal-precedence-earliest
temporal_precedence_projection_version = 1
temporal_resource_projection_id        = perttool.temporal-parallel-sgs
temporal_resource_projection_version   = 1
temporal_resource_projection_optimal   = false
```

The same validated document, exact analysis inputs, applied capacity,
calendar identities, and identities above MUST produce the same projections,
deadline states, margins, qualifications, and unavailable causes.

None of these algorithms reads the wall clock, Git timestamps, locale, host
time zone, or a time-zone database. `project.as_of` remains the only temporal
snapshot anchor.

An incompatible change to release-bound scheduling, deadline comparison,
state classification, feasibility meaning, block qualification, or combined
assessment requires the corresponding version to increase. Public result
schemas and CLI contracts are versioned independently.

## 4. Scope and non-goals

In scope:

- `task.deadline` as the latest desired task finish;
- `milestone.deadline` as the latest desired milestone reach;
- the deadline on `project.finish` as the project deadline without a separate
  project property;
- planned, active, blocked, done, reached, and unreached snapshot states;
- exact date and offset-bearing date-time targets;
- exact day, hour, and velocity-qualified point projections;
- separate temporal precedence and heuristic resource views;
- future `not_before` release bounds for unstarted tasks;
- current and forecast deadline assessment; and
- deterministic unavailable and not-applicable states.

Out of scope:

- treating a deadline as a dependency, hard scheduling cap, validation error,
  or automatic priority;
- actual start, finish, or milestone-reach timestamps;
- reconstructing historical compliance from `as_of`, Git, issue trackers, or
  chat;
- business calendars, named zones, shifts, holidays, or time-varying resource
  capacity;
- stochastic deadline probability, confidence, Monte Carlo analysis, or a
  learned risk score;
- automatic propagation between task and milestone deadlines;
- changing recommendation eligibility, ranking, selection horizon, tier, or
  reason taxonomy in version 1; and
- source migration between Points, days, and hours.

## 5. Deadline subjects and completion state

Every evaluation subject is exactly one task or milestone with a declared
deadline.

### 5.1 Task subject

A task deadline applies to completion of that task edge. For a planned,
blocked, or active task, the forecast completion value is its projected
finish.

An active task's declared duration or estimate is remaining work at
`project.as_of`. Its projected remaining finish is valid, but its historical
start is unknown.

For a `done` task:

- the deadline property remains declared source information;
- actual finish and actual deadline compliance are unavailable;
- current overdue and forecast states are not applicable; and
- the implementation MUST NOT substitute relative time zero as an actual
  finish.

### 5.2 Milestone subject

A milestone deadline applies to the time at which all of its incoming
conditions are satisfied under the selected temporal projection.

For an effectively reached milestone:

- actual reach and actual deadline compliance are unavailable;
- current overdue and forecast states are not applicable; and
- the implementation MUST NOT interpret its simulated time-zero satisfaction
  as an actual reach time.

The deadline on the milestone referenced by `project.finish` additionally has
the role `project_finish`. That role does not create a distinct property or
change the evaluation rules.

### 5.3 Completion-state projection

Return one of:

```text
completion_state =
  incomplete
  | complete_actual_time_unavailable
```

`complete_actual_time_unavailable` is not equivalent to on time, late, absent,
or invalid.

## 6. Temporal release bounds

For each planned or blocked task, derive an exact non-negative release bound
from `task.not_before` using Temporal Calendar Semantics section 12.

- A missing `not_before` has release bound zero.
- An active task is already running at relative time zero and does not receive
  a new release bound.
- A done task is already satisfied and does not receive a release bound.
- A release bound does not change structural `ready`.
- If the release bound is unavailable, any temporal schedule containing that
  unsatisfied task is unavailable for the affected subject. Do not silently
  use the unqualified Analysis version 1 time for deadline evaluation.

Retain the declared `not_before`, exact release bound, effective projection
unit, point-velocity identity when applicable, and any unavailable cause.

## 7. Temporal precedence earliest projection

This projection derives earliest temporal completion without changing the
ordinary precedence CPM result.

At relative time zero:

1. every current frontier milestone is satisfied at zero;
2. retained done tasks and satisfied gates propagate at zero;
3. every active task starts at zero and finishes after its exact remaining
   duration; and
4. every planned or blocked task retains its release bound.

For an unstarted task `t`:

```text
temporal_precedence_start(t) =
  max(temporal_milestone_time(src(t)), release_bound(t))

temporal_precedence_finish(t) =
  temporal_precedence_start(t) + expected_duration(t)
```

For a milestone `v` that is not initially reached:

```text
temporal_precedence_milestone_time(v) =
  max(satisfaction_time(e) for every incoming edge e)
```

A gate has zero duration and is satisfied at its source-milestone time. Apply
the all-incoming rule to a fixed point in stable graph order.

This is an earliest lower-bound projection under the modeled expected
durations and release bounds. It does not calculate new backward-pass float,
replace precedence Analysis version 1, or account for renewable-resource
contention.

## 8. Temporal heuristic resource projection

The temporal resource projection extends `parallel-sgs` version 1 only with
the accepted release bounds. It retains the same:

- renewable integer capacities and applied overrides;
- non-preemptive execution;
- active allocations fixed at zero;
- task duration, resource acquisition, release, and stable candidate order;
- all-incoming milestone closure; and
- conditional assumption that declared blocks resolve at relative time zero.

An unstarted task becomes eligible only when:

```text
source milestone is reached
and current simulated time >= release_bound(t)
and status(t) in {planned, blocked}
```

When no task is running, unfinished tasks remain, and at least one otherwise
eligible task has a future release bound, advance simulated time to the
smallest such release bound. Process a release event after completions and
milestone closure at that time and before the ordinary stable start scan.

If an affected release bound is unavailable, do not return a temporal
resource projection for that deadline subject.

The result is a constructed feasible schedule under its modeled capacities,
expected durations, release bounds, and block-resolution assumption. It is
deterministic and `optimal=false`. A late heuristic schedule is not proof that
no other resource-feasible schedule can meet the deadline.

## 9. Projected calendar values

Project every exact relative start, finish, or milestone time through
`project.as_of` using Temporal Calendar Semantics.

Every available projected value identifies:

- subject kind and ID;
- source view `precedence` or `resource`;
- relative exact value and project base unit;
- velocity qualification and identity when the base unit is point;
- calendar arithmetic and profile identities;
- temporal projection algorithm identity;
- exact tagged calendar value; and
- block and heuristic qualifications.

Do not merge the precedence and resource projections into one unqualified
timestamp. A resource projection MUST retain its scheduler identity and
`optimal=false`.

## 10. Current deadline state

Current deadline state compares an incomplete subject's declared deadline
with `project.as_of`. It does not use a forecast completion value.

When the values have the same temporal kind:

```text
not_due  if as_of < deadline
due_now if as_of == deadline
overdue if as_of > deadline
```

The deadline is inclusive. Equality is `due_now`, not overdue. For date
values, equality means the same civil-day label; no clock or end-of-day time
is invented.

For a complete subject, current state is `not_applicable` with
`complete_actual_time_unavailable`.

For a missing or incomparable relationship, current state is `unavailable`
with the exact calendar cause.

When available, also derive:

```text
current_signed_window = deadline - as_of
```

Retain the exact calendar difference. Convert it to the project base unit only
when the calendar contract and velocity permit that conversion. Current state
can remain available even when a base-unit rendering of the exact difference
is unavailable.

## 11. Forecast comparison and exact margin

Evaluate each available precedence and resource projected completion
independently.

```text
forecast_relation =
  before_deadline if projected_completion < deadline
  on_deadline     if projected_completion == deadline
  after_deadline  if projected_completion > deadline

signed_margin = deadline - projected_completion
```

The sign convention is fixed:

- positive margin means completion before the deadline;
- zero means completion exactly on the deadline; and
- negative margin means forecast lateness.

Derive exact non-negative components:

```text
remaining_margin = max(signed_margin, 0)
lateness         = max(-signed_margin, 0)
```

Retain the exact same-kind calendar difference used for comparison.

For a date difference, conversion to the project base unit is available only
through an effective day relationship. For a date-time difference, divide
exact seconds by 86400 or 3600 according to the effective projection unit.
For a point project, convert that exact day/hour value through the declared
velocity. Do not infer a date/hour relationship or reuse display-rounded
values.

If comparison is available but base-unit conversion is unavailable, retain
the comparison and calendar difference while returning the exact conversion
cause for the base-unit margin.

## 12. Per-view feasibility meaning

### 12.1 Precedence view

```text
precedence_deadline_assessment =
  lower_bound_on_time
  | lower_bound_late
  | unavailable
```

- `lower_bound_late` means even the temporal precedence earliest projection
  finishes after the deadline under modeled expected durations and release
  bounds. No resource schedule under those same inputs can meet it.
- `lower_bound_on_time` means precedence alone does not prove a miss. It does
  not prove resource feasibility.
- Completion exactly on the deadline is `lower_bound_on_time`.

### 12.2 Resource view

```text
resource_deadline_assessment =
  heuristic_on_time
  | heuristic_late
  | unavailable
```

- `heuristic_on_time` demonstrates one schedule that meets the deadline under
  the modeled assumptions.
- `heuristic_late` reports that the selected deterministic heuristic misses.
  Because `optimal=false`, it is not proof of infeasibility.
- Completion exactly on the deadline is `heuristic_on_time`.

Neither assessment is a probability or a guarantee about actual execution.

## 13. Combined deadline assessment

For an incomplete subject, derive one combined assessment in this order.

```text
if current_state == overdue:
  combined = overdue
else if precedence_deadline_assessment == lower_bound_late:
  combined = forecast_infeasible
else if resource_deadline_assessment == heuristic_late:
  combined = at_risk
else if resource_deadline_assessment == heuristic_on_time:
  combined = forecast_on_time
else if precedence_deadline_assessment == lower_bound_on_time:
  combined = not_proven_late
else:
  combined = unavailable
```

Meanings:

- `overdue`: the subject is incomplete and the snapshot anchor is already
  after its deadline.
- `forecast_infeasible`: the temporal precedence lower bound misses under the
  modeled durations and release bounds.
- `at_risk`: precedence does not prove a miss, but the selected heuristic
  resource schedule is late.
- `forecast_on_time`: the selected heuristic constructs an on-time schedule.
- `not_proven_late`: precedence is on time but no usable resource assessment
  is available.
- `unavailable`: no applicable comparison can support a stronger state.

`at_risk` is a deterministic resource-delay state, not a statistical risk
score. Do not classify a task as at risk solely because it is critical, has
zero margin, is blocked, has high variance, or has a natural-language
deadline description.

A `due_now` current state does not override forecast evaluation. Its combined
state follows the same precedence/resource rules.

For a complete subject, combined assessment is `not_applicable` with
`complete_actual_time_unavailable`.

## 14. Block qualification

Determine the unfinished predecessor cone for each deadline subject.

- For a task, include the task and every unfinished task that can affect its
  source milestone.
- For a milestone, include every unfinished task that can affect that
  milestone.

Intersect the cone with tasks whose declared status is `blocked`.

```text
conditional_on_blocks_resolved = blocked_task_ids is not empty
```

Return the stable sorted `blocked_task_ids` for both precedence and resource
deadline views.

The temporal projections assume each listed block resolves at relative time
zero because the document has no block-resolution duration. Therefore:

- retain numeric projections and deadline comparisons as conditional results;
- do not call `heuristic_on_time` an unconditional commitment;
- do not invent a block duration or automatically mark the subject late; and
- retain `overdue` when the snapshot itself is already after the deadline.

Blocked qualification is orthogonal to the heuristic qualification. A result
can be both conditional on blocks and derived from an `optimal=false`
resource schedule.

## 15. Independent task and milestone deadlines

A task deadline and its destination milestone deadline are evaluated
independently. Neither is copied, inherited, minimized, or used to rewrite the
other.

When both are present, return their exact relationship:

```text
task_deadline_before_milestone
same_deadline
task_deadline_after_milestone
unavailable
```

This relationship is descriptive. It does not add a gate, divide milestone
margin among incoming tasks, or make either deadline authoritative over the
other.

For a milestone with multiple incoming tasks, each task retains its own
deadline, while the milestone deadline evaluates the all-incoming reach time.

## 16. Recommendation boundary

Deadline evaluation version 1 is informational and does not change normal
recommendation authority.

Specifically, for recommendation algorithm
`perttool.recommendation-ranking.lexicographic-frontier` version 1:

- structural `ready` remains the ranking domain;
- deadline presence, current state, forecast relation, margin, lateness,
  combined assessment, and block qualification are not ranking keys;
- no deadline state changes the selection horizon or resource scan;
- no deadline state creates `recommended`, `allowed`, `deferred`, or
  `discouraged`;
- Recommendation Reason Taxonomy version 1.0 gains no deadline reason code;
  and
- a complete `Perttool.NextResult.v3` retains exactly its existing authority.

A later Next result may carry deadline projections as non-authoritative
context only under a new result schema selected by the interface contract.

Using deadline facts to change ranking requires, in one accepted change:

1. a new ranking algorithm version with exact rule position and tie-breaking;
2. a reason-taxonomy version containing typed deadline facts and reasons;
3. compatible explanation/expression/description contracts;
4. a new recommendation result schema and migration rule; and
5. golden cases where deadline ranking conflicts with criticality and explicit
   priority.

Humans may still cite an external deadline as a reason for an override under
the existing override contract. That does not retroactively make the normal
version 1 recommendation deadline-aware.

## 17. Availability and non-applicability

Invalid source is a validation failure. Valid source can produce absent,
not-applicable, conditional, or unavailable deadline information.

Inherit all calendar unavailable causes, including:

- `missing_temporal_anchor`;
- `incomparable_temporal_kinds`;
- `date_anchor_has_no_clock`;
- `fractional_date_projection`;
- `calendar_range_overflow`; and
- `exact_datetime_text_unavailable`.

Deadline-specific states and causes are:

| Value | Meaning |
| --- | --- |
| `deadline_absent` | The subject has no deadline; evaluation is absent, not unavailable |
| `complete_actual_time_unavailable` | The subject is complete but no actual completion timestamp exists |
| `release_bound_unavailable` | An unfinished predecessor has a `not_before` relationship that cannot enter the temporal schedule |
| `precedence_projection_unavailable` | The subject has no complete temporal precedence projection |
| `resource_projection_unavailable` | The subject has no complete temporal resource projection |
| `margin_unit_unavailable` | Comparison succeeded but exact margin cannot be represented in the project base unit |

Every wrapper cause MUST retain its underlying calendar cause and affected
task or subject ID. Do not collapse mixed kinds, missing velocity, range
overflow, and completed history into a generic unknown state.

An absent deadline does not make the temporal schedule unavailable. A complete
subject with unknown actual time does not receive a forecast result.

## 18. Version and interface boundaries

The [Temporal and Unit Interface Contract](temporal-unit-interface.md) that
publishes these semantics:

- selects new result schema identities rather than adding fields to existing
  Analysis or Next schemas;
- preserves base relative values separately from calendar values and margins;
- identifies the deadline, calendar, precedence, resource, scheduler, and
  velocity versions used;
- exposes exact numerator/denominator values and tagged units;
- keeps absent, not-applicable, unavailable, conditional, and available states
  distinct;
- exposes precedence and resource views separately;
- carries `optimal=false` and block qualifiers into text and JSON;
- preserves task/destination-milestone deadline relationships; and
- keeps the recommendation boundary in section 16 machine-verifiable.

Grammar version 2 and the mutation extension determine field syntax and
source-preserving edits. This specification does not authorize adding the
fields to grammar version 1.

## 19. Acceptance for this contract

- Task, milestone, and project-finish deadline subjects are unambiguous.
- Done tasks and reached milestones do not acquire invented actual times.
- Future `not_before` bounds enter independently versioned precedence and
  resource temporal projections.
- Current `not_due`, `due_now`, and `overdue` states are exact and inclusive.
- Forecast relation, signed margin, remaining margin, and lateness use one
  exact sign convention.
- Precedence lower-bound and heuristic resource feasibility have distinct
  meanings.
- `at_risk` is defined without implying probability or optimality.
- Blocked predecessors produce conditional results with stable IDs.
- Task and destination-milestone deadlines remain independent.
- Recommendation algorithm version 1 and Reason Taxonomy version 1.0 are
  unchanged.
- Unavailable and not-applicable causes fail closed without erasing available
  base analysis.
