# Calendar-Aware Temporal Scheduling Contract

- Document status: Accepted design 1.0
- Accepted: 2026-08-17
- Target grammar: 8
- Target CLI contract: 9
- Implementation status: internal Source Core accepted; scheduler and public runtime inactive
- Related requirements: [../requirements.md](../requirements.md)
- Legacy calendar baseline: [temporal-calendar.md](temporal-calendar.md)
- Legacy deadline baseline: [temporal-deadline.md](temporal-deadline.md)
- Legacy temporal interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Analysis baseline: [analysis.md](analysis.md)
- Assurance baseline: [plan-assurance.md](plan-assurance.md)
- Backlog review:
  [temporal-availability-constraints-backlog-review.think](../process/temporal-availability-constraints-backlog-review.think)
- Selected plan: [../../plans/temporal-schedule.pert](../../plans/temporal-schedule.pert)
- Source Core acceptance:
  [../process/temporal-schedule-source-core-acceptance.md](../process/temporal-schedule-source-core-acceptance.md)

## 1. Decision and scope

This contract accepts one calendar-aware temporal model for `CALENDAR-001`,
`CONSTRAINT-001`, and the prerequisite semantics of `POSTDUE-001`. It keeps
the Activity-on-Arrow model unchanged: tasks remain positive-work edges,
milestones remain zero-work events, gates remain dependency-only edges, and
resource requirements remain renewable-capacity requirements rather than DAG
edges.

The accepted user-facing language adds only:

1. one reusable top-level `calendar` declaration;
2. four optional project fields that opt into one named-zone calendar profile;
3. optional calendar, validity, and capacity-override fields on every generic
   renewable resource; and
4. repeated `when` lines for task-start, task-finish, and milestone-reach
   earliest or latest event bounds.

There is no human resource kind. A person, machine, room, license, test
environment, external service, and finite booking use the same resource
fields and the same available-capacity function.

The target runtime also provides one goal-anchored required schedule and the
stable warning kinds `POSTDUE` and `POSTDUE_FORECAST`. These are analysis
projections. They do not create source declarations, actual event evidence,
or a second planning language.

## 2. Scoped supersession instead of additive temporal layers

This document is the sole normative owner of Grammar 8 calendar, constraint,
required-schedule, target-evaluation, and schedule-alert meaning. New behavior
MUST NOT be specified by appending a partially overlapping profile to each of
the three legacy temporal documents.

The supersession is scoped rather than destructive:

- Grammar 1 through 7 continue to use the exact continuous fixed-offset,
  deadline, temporal-interface, result, and authority contracts already
  accepted by the legacy documents.
- A Grammar 8 document with no calendar-profile fields uses the legacy
  continuous profile through the compatibility rules in this document.
- A Grammar 8 document that opts into the named-zone profile uses this
  document for the complete temporal meaning.
- The legacy documents remain historical and compatibility authority. They do
  not independently define a second Grammar 8 behavior.
- Public activation later marks those documents as legacy baselines without
  rewriting their accepted version-1 meaning.

When a conflict concerns a Grammar 8 result, this document wins. When a
conflict concerns a Grammar 1 through 7 result, the applicable legacy contract
wins. Requirements remain higher authority for every grammar.

This contract acceptance does not activate Grammar 8 or CLI Contract 9. The
active `perttool@0.9.4` runtime remains Grammar 7 and CLI Contract 8 until the
dependency-ordered public task completes.

## 3. Closed identities and deterministic inputs

The target algorithms are:

```text
calendar arithmetic       = perttool.calendar-projection@2
calendar profile          = perttool.calendar.named-weekly-capacity@1
working-time arithmetic   = perttool.calendar-working-time@1
temporal precedence       = perttool.temporal-precedence-earliest@2
temporal resource         = perttool.temporal-parallel-sgs@2
temporal resource optimal = false
required schedule         = perttool.required-precedence-backward@1
schedule target           = perttool.schedule-target-evaluation@1
schedule alert            = perttool.schedule-alert@1
target driver path        = perttool.target-driver-path@1
```

The named-zone profile version 1 uses exactly:

```text
zone-data authority = IANA Time Zone Database
zone-data release   = 2026c
source archive      = tzdata2026c.tar.gz
source SHA-256      = e4a178a4477f3d0ea77cc31828ff72aa38feff8d61aa13e7e99e142e9d902be4
supported instants  = 1970-01-01T00:00:00Z through 2100-01-01T00:00:00Z, end exclusive
```

The source archive identity is semantic input. A package may compile or
normalize the data, but the installed acceptance MUST prove its materialized
zone transitions and aliases equal that release throughout the supported
instant range and MUST expose both the source and materialized digests.

The exact document bytes, project snapshot, capacity overrides supplied by the
command, algorithm identities, and zone-data identity determine the result.
No algorithm in this contract reads the wall clock, process locale, host time
zone, network, Git timestamps, issue trackers, or external calendars.

An incompatible change to a calendar membership rule, gap allocation,
event-bound propagation, required-schedule anchor, target comparison, alert
suppression, or driver-path rule requires a version increase. A zone-data
update is a new immutable zone-data release and is never silently substituted
for the source-selected release.

## 4. Grammar 8 source contract

Grammar 8 is selected only by explicit `version 8` or by the accepted
`document migrate --target-grammar 8` workflow. It retains every Grammar 7
declaration except that `not_before` is migrated to the canonical `when start
earliest` form and is not valid Grammar 8 source.

### 4.1 Lexical additions

```ebnf
Weekday       = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" ;
ClockMinute   = Hour, ":", Minute | "24:00" ;
LocalWindow   = ClockMinute, "..", ClockMinute ;
LocalWindows  = LocalWindow, { OWS, ",", OWS, LocalWindow } ;
CalendarDay   = Weekday, HSPACE, ( "off" | LocalWindows ), NEWLINE ;
CalendarExcept = "except", HSPACE, IsoDate, HSPACE,
                 ( "off" | LocalWindows ), NEWLINE ;
```

`24:00` is valid only as a window end. A window start must be less than its
end. A source window never crosses a civil-day boundary; a cross-midnight
shift is written as two windows on consecutive weekday or exception lines.
Windows on one line are strictly ordered, non-overlapping, and non-touching.
Touching windows are written as one merged window.

### 4.2 Calendar declaration

```ebnf
CalendarDecl = "calendar", HSPACE, Identifier, ":", NEWLINE,
               INDENT, CalendarEntry, { CalendarEntry }, DEDENT ;
CalendarEntry = BlockTrivia | CalendarDay | CalendarExcept ;
```

At most one line exists for each weekday and at most one `except` line exists
for each date. An omitted weekday is equivalent to `off`; canonical formatting
omits weekday `off` lines. A calendar may contain no open window and is then a
valid always-closed calendar.

Calendar IDs join the existing document-wide entity-ID namespace. They do not
become DAG vertices or edges. Declaration order has no semantic meaning.

### 4.3 Project fields

```ebnf
TimeZoneField = "time_zone", HSPACE, String, NEWLINE ;
TzdbField     = "tzdb", HSPACE, String, NEWLINE ;
CalendarField = "calendar", HSPACE, Identifier, NEWLINE ;
WorkdayField  = "workday", HSPACE, DurationV3, NEWLINE ;
```

The project fields `time_zone`, `tzdb`, and `calendar` form an all-or-none
named-zone profile selection. Version 1 accepts an IANA zone ID, the exact
string `"2026c"`, and a declared calendar ID. An unknown zone or zone-data
release is invalid; it is not replaced with a host default.

`project.as_of` MUST be an offset-bearing date-time when the named-zone
profile is selected. Its explicit offset MUST equal the selected zone's offset
at that instant. The instant MUST be inside the supported zone-data range.

`workday` is an exact positive hour Duration. It is required when calendar
work consumes a `day` project duration or Point velocity expressed per day. It
is optional for hour-based calendar work and forbidden without the named-zone
profile. It converts a work-day quantity to exact working hours; it never
means 24 elapsed hours and never authorizes day/hour source migration.

A Grammar 8 document with none of the three profile fields retains the legacy
continuous fixed-offset profile. It may use `when` only with offset-bearing
date-times and an offset-bearing `as_of`.

### 4.4 Resource fields

```ebnf
ResourceCalendarField = "calendar", HSPACE, Identifier, NEWLINE ;
AvailableFromField     = "available_from", HSPACE, IsoDateTime, NEWLINE ;
AvailableUntilField    = "available_until", HSPACE, IsoDateTime, NEWLINE ;
AvailabilityField     = "availability", HSPACE, IsoDateTime,
                        "..", IsoDateTime, HSPACE,
                        "capacity", HSPACE, Integer, NEWLINE ;
```

Each resource has zero or one `calendar`, `available_from`, and
`available_until` field and zero or more `availability` lines. These fields
require the project named-zone profile.

`available_from` is inclusive and `available_until` is exclusive. If both are
present, `available_from < available_until`. Each endpoint is an exact instant
whose written offset must match the project zone at that instant.

An `availability` line is a half-open exact-instant capacity replacement. Its
start is strictly before its end, its capacity is an integer from zero through
the resource's declared nominal capacity, and its endpoint offsets must match
the project zone. Override intervals on one resource MUST NOT overlap. They
are canonically sorted by start instant and then end instant.

### 4.5 Event-bound fields

```ebnf
TaskWhenField = "when", HSPACE,
                ( "start" | "finish" ), HSPACE,
                ( "earliest" | "latest" ), HSPACE,
                IsoDateTime, NEWLINE ;
MilestoneWhenField = "when", HSPACE, "reach", HSPACE,
                     ( "earliest" | "latest" ), HSPACE,
                     IsoDateTime, NEWLINE ;
```

A task may contain at most one line for each of the four event/direction pairs.
A milestone may contain at most one line for each of its two pairs. Every
bound is an exact instant. Under the named-zone profile, its written offset
must match the project zone at that instant. Under the continuous profile, it
is compared by the accepted fixed-offset instant rules.

Canonical order is:

```text
task:      start earliest, start latest, finish earliest, finish latest
milestone: reach earliest, reach latest
```

For Grammar 8, `not_before` is not a second spelling. Migration replaces it
with `when start earliest` without changing its exact instant. `deadline`
remains a separate advisory task-finish or milestone-reach target and is never
rewritten to `when ... latest`.

### 4.6 Complete example

```pert
project DELIVERY:
  version 8
  title "Calendar-aware delivery"
  as_of 2026-08-17T09:00:00+09:00
  duration_unit hour
  finish RELEASED
  time_zone "Asia/Tokyo"
  tzdb "2026c"
  calendar STANDARD

calendar STANDARD:
  mon 09:00..12:00, 13:00..18:00
  tue 09:00..12:00, 13:00..18:00
  wed 09:00..12:00, 13:00..18:00
  thu 09:00..12:00, 13:00..18:00
  fri 09:00..12:00, 13:00..18:00
  except 2026-09-21 off
  except 2026-09-22 10:00..16:00

milestone START:
  title "Start"
  state reached

milestone RELEASED:
  title "Released"
  deadline 2026-09-30T18:00:00+09:00
  when reach latest 2026-09-30T17:00:00+09:00

resource DEVICE:
  title "Booked device"
  capacity 2
  calendar STANDARD
  available_from 2026-08-17T09:00:00+09:00
  available_until 2026-10-01T00:00:00+09:00
  availability 2026-09-01T09:00:00+09:00..2026-09-01T18:00:00+09:00 capacity 1

task TEST START -> RELEASED:
  title "Run tests"
  duration 12h
  when start earliest 2026-08-18T09:00:00+09:00
  when finish latest 2026-09-29T18:00:00+09:00
  requires:
    DEVICE 1
```

No second calendar file, recurrence DSL, resource type, or constraint-name
catalog is required.

## 5. Calendar and available-capacity semantics

### 5.1 Local-window membership

Calendar lines describe local civil labels in the selected project zone. An
instant is open when its zone-local weekday and clock minute belong to one
weekly window, unless an exception exists for its local date. The exception
then replaces the complete weekly value for that date.

All windows are half-open. `09:00..12:00` includes 09:00 and excludes 12:00.
The exact 12:00 instant can belong to a following window only after the source
windows have been canonically merged.

Daylight-saving gaps and overlaps use instant membership, not boundary
guessing:

- a local clock label that does not occur contributes no instant;
- both occurrences of a repeated local clock label are included when that
  label is inside the window; and
- elapsed work is the exact SI-second duration of included instants.

Therefore a nominal local window can contain fewer or more elapsed seconds on
a transition day. No `earlier`, `later`, host-library, or locale default is
consulted.

### 5.2 Calendar selection

For a task with no resource requirements, the project calendar is its working
calendar.

For each required resource, the resource's declared calendar replaces the
project default for that resource. If the resource omits `calendar`, it uses
the project calendar. There is no additional task calendar and no implicit
intersection with the project calendar after an explicit resource calendar is
selected. A task-specific operating window is modeled by requiring one
dedicated calendar-backed resource.

When a document does not select the named-zone profile, resources retain the
legacy constant-capacity, continuous-time meaning.

### 5.3 Effective capacity

Let `applied_capacity(r)` be the existing command-selected nominal capacity
for resource `r`, or the declared capacity when no command override exists.
For instant `t`:

```text
if t is before available_from or at/after available_until:
  effective_capacity(r, t) = 0
else if one availability override contains t:
  effective_capacity(r, t) = min(applied_capacity(r), override.capacity)
else if selected_calendar(r) is open at t:
  effective_capacity(r, t) = applied_capacity(r)
else:
  effective_capacity(r, t) = 0
```

Validity is therefore outermost. An override may open or partially open a
resource outside a recurring calendar window, but it cannot open the resource
outside its validity interval. A capacity override supplied by `dag analyze`
does not rewrite source and cannot make a declared replacement exceed the
applied nominal capacity.

### 5.4 Common progress intervals

A task with resource requirements progresses only when every required
resource has enough unallocated effective capacity simultaneously. A task
without resources progresses only in project-calendar open time. Work amount
is not divided by capacity and no skill or substitution rule exists.

The calendar-aware task is logically non-preemptive but calendar-interruptible:

- the scheduler may not stop it arbitrarily while its complete requirement
  set remains allocatable;
- when any selected calendar, validity bound, or capacity replacement makes
  the complete requirement set unavailable, the current work segment ends;
- all renewable allocations are released for that gap;
- another task may use capacity during the gap; and
- the interrupted task retains resume priority over not-yet-started tasks at
  the same scheduling event, with stable task-ID tie-breaking.

An interrupted task reacquires all requirements atomically. It never holds a
subset while waiting. A task identity, duration, status, and requirement set
remain unchanged across its work segments. The gap is not a lifecycle
suspension, actual event, or discretionary preemption.

Active tasks are considered already selected at `as_of`. Their remaining
duration advances only in common progress intervals. If simultaneous active
requirements exceed capacity at an instant where those active tasks could
otherwise progress, the resource schedule is unavailable with the exact
active task and resource IDs; task order is not used to discard an active
allocation.

## 6. Exact working-time arithmetic

Expected task work remains the exact Rational selected by the existing
duration or PERT formula. Convert it to exact working seconds as follows:

| Effective work input | Exact working seconds |
| --- | --- |
| project hour | value multiplied by 3,600 |
| project day | value multiplied by `project.workday` hours and 3,600 |
| Point with velocity per hour | exact Point-to-hour conversion, then 3,600 |
| Point with velocity per day | exact Point-to-day conversion, then `workday` hours and 3,600 |

No display-rounded value enters the schedule. Working-time addition consumes
open common-progress instants until the exact work amount is exhausted.
Working-time subtraction traverses the same capacity membership backward and
MUST be the exact inverse when no range or limit boundary intervenes.

A task finishing exactly at a window end is complete at that instant. A task
starting exactly at a window end waits until the next progress interval. Zero
work is not introduced; existing positive task-duration rules remain.

The result retains both exact work amount and ordered half-open work segments.
Elapsed gaps do not increase work amount. Utilization is derived from segment
allocations and effective capacity, never from nominal wall-clock span.

## 7. Calendar-aware forward schedules

### 7.1 Precedence projection

`perttool.temporal-precedence-earliest@2` is an exact earliest schedule that
uses individual task calendar availability and event earliest bounds but no
cross-task resource contention. For each task it finds the earliest start at
or after its source milestone that can produce one complete work schedule.

Task start-earliest directly lower-bounds start. Task finish-earliest delays
start, when necessary, so that uninterrupted logical work completes no earlier
than the bound; it does not append a resource-holding idle tail. A milestone
reach-earliest lower-bounds that milestone after all incoming conditions are
satisfied.

The projection remains a precedence lower bound. It is not resource feasible
when parallel tasks require the same finite capacity.

### 7.2 Resource projection

`perttool.temporal-parallel-sgs@2` extends the accepted stable parallel-SGS
policy with calendar events, common progress intervals, gap release/resume,
and event earliest bounds. Existing task priority and stable tie-breaking
remain unchanged after active and interrupted resume priority.

The result is one constructed resource-feasible schedule under modeled
capacity and availability. It remains `optimal=false`. A late result is not
proof that every resource-feasible schedule is late.

Blocks remain conditionally resolved at `as_of` under the legacy deadline
qualification. Work-event suspension remains separate actual-state evidence;
the forecast carries suspension IDs but does not invent a resume date.

### 7.3 Earliest start authority

Calendar and earliest constraints extend only the existing temporal start
gate. A new task is startable now only if:

- its ordinary structural, resource, recommendation, governance, assurance,
  and milestone-acceptance conditions pass;
- its complete required resource set has capacity at `as_of`;
- `as_of` is not before its start-earliest bound; and
- starting at `as_of` does not violate its finish-earliest bound under the
  accepted no-idle work rule.

An unavailable calendar or earliest relationship fails closed for start
authority without changing structural `ready`. Latest bounds, deadlines,
negative slack, POSTDUE, and POSTDUE_FORECAST do not prohibit a recovery
start and do not change Recommendation version 1 ranking.

## 8. Event constraints

### 8.1 Event model

The closed event set is:

```text
task start
task finish
milestone reach
```

Each event may have one earliest and one latest bound. Equality of the two is
a valid exact event requirement. A bound does not add an AoA edge, rewrite
duration, mark a task active or done, reach a milestone, satisfy a milestone
criterion, or create actual evidence.

Earliest bounds participate in the forward projections. Latest bounds
participate in feasibility and the required schedule. Latest bounds are hard
planning requirements but not execution locks: a missed plan remains
analyzable and recoverable.

### 8.2 Validation and infeasibility

For one event, earliest strictly after latest is invalid source and reports
`PTSCH-107`. Equal bounds are valid.

A contradiction that requires network or working-time propagation is not a
syntax or graph error. Examples include a finish-latest earlier than the
earliest possible finish and parallel incoming work that cannot all satisfy a
milestone latest bound. These produce typed `infeasible` schedule facts,
negative signed slack, and complete driver evidence when available.

Reached milestones and done tasks retain declared bounds but do not acquire a
simulated actual timestamp. Active tasks have an incomplete finish event but a
completed start event; if its actual start time is absent, start-bound
historical compliance is unavailable rather than inferred from `as_of`.

## 9. Goal-anchored required schedule

### 9.1 Anchor selection

The required schedule exists when the milestone referenced by
`project.finish` has at least one of:

- `when reach latest`; or
- `deadline`.

When both are comparable, use the earlier instant as the project backward
anchor. Record `latest_bound`, `advisory_deadline`, or `coincident` as the
anchor source. The use of a deadline as a planning anchor does not convert the
source deadline into a hard constraint or change deadline evaluation.

When the two target kinds are incomparable, the required schedule is
unavailable with both declarations preserved. When neither exists, the
project required schedule is absent rather than guessed from target duration,
current makespan, wall clock, or an intermediate target.

### 9.2 Backward projection

`perttool.required-precedence-backward@1` subtracts each task's exact work
through its individual common-availability calendar without cross-task
contention. It propagates the earliest applicable upper bound from the project
anchor and every task-start, task-finish, and milestone-reach latest bound.

Task-specific latest finish does not silently become destination-milestone
latest reach. A task may finish and wait for other incoming tasks. A task
start-latest requires its source milestone early enough to permit that start.
Milestone latest applies to complete incoming closure. All propagation follows
the AoA topology; bounds are never copied as source fields.

The projection returns required task starts/finishes and milestone reaches,
the bound or successor facts that drive each value, and exact working-time
subtraction segments. It is a precedence schedule, not a backward resource-
leveled schedule and has no `optimal=true` claim.

### 9.3 Slack and feasibility

For each comparable event:

```text
signed_slack = required_event_instant - forward_event_instant
```

Positive is early, zero is exactly on the requirement, and negative is late.
Return separate precedence-forward and resource-forward comparisons. A
negative precedence slack is `precedence_infeasible` under modeled durations,
individual calendars, and earliest bounds. A negative resource slack with
non-negative precedence slack is `resource_heuristic_late` and retains
`optimal=false`.

Backward resource leveling and exact global optimization are unavailable.
They require separate algorithm identities and acceptance before any result
can claim resource-feasible required dates or optimality.

## 10. Deadline and target compatibility

`deadline` remains an advisory task-finish or milestone-reach target. `when
... latest` remains a planning constraint. They are stored and evaluated
independently even when their instants are equal.

The shared `perttool.schedule-target-evaluation@1` comparison implements the
same inclusive current and forecast rules for either target kind:

```text
current:  before | due_now | after
forecast: before | on_target | after
```

Equality is never late. The deadline branch is normatively equivalent to
`perttool.deadline-evaluation@1` for legacy-compatible inputs; the new target
evaluator does not introduce a competing deadline calculation.

Existing date-only deadlines remain valid declared source. Under the
named-zone profile, whose `as_of` and projected events are exact instants, a
date-only deadline is an incomparable temporal kind and its instant forecast
is unavailable. The tool does not invent midnight or end of day. Migration
does not rewrite a date deadline.

## 11. POSTDUE schedule alerts

### 11.1 Closed kinds and subjects

The closed alert kinds are:

```text
POSTDUE
POSTDUE_FORECAST
```

Applicable targets are a deadline or latest event bound. Earliest bounds do
not emit either alert. Applicable events are an unstarted task start, an
unfinished task finish, or an unreached milestone reach.

An active or done task has a completed start event. A done task has a
completed finish event. An effectively reached milestone has a completed
reach event. A completed event without actual time receives no current or
forecast alert; historical compliance remains unavailable.

### 11.2 Current and forecast rules

Emit `POSTDUE` only when the event is incomplete, the target is comparable to
`project.as_of`, and `as_of` is strictly after the target.

Emit `POSTDUE_FORECAST` only when the same event/target does not already have
POSTDUE and one deterministic forward projection is strictly after the
target. Select proof basis in this order:

1. `precedence_infeasible` when the precedence lower bound is late;
2. `resource_heuristic_late` when precedence is not late and the selected
   resource schedule is late; or
3. no alert when the needed projection is absent or unavailable.

A deadline and latest bound are distinct targets and may produce distinct
alerts. The stable deduplication key is subject kind, subject ID, event,
target kind, and source range. Current POSTDUE suppresses only the matching
forecast key.

Each alert retains exact target, snapshot, projection, signed difference,
lateness, calendar and scheduler identities, `optimal=false` where
applicable, blocks, work-event suspensions, source digest, and source range.

### 11.3 Driver paths

Every alert has one driver state: `available`, `not_computed`, or
`unavailable`.

- A project-finish precedence alert references the existing representative
  precedence critical path.
- A project-finish resource alert references the existing representative
  schedule critical path.
- A task or intermediate-milestone alert uses a target-scoped deterministic
  predecessor or schedule-constraint driver path ending at the applicable
  event.
- A resource path identifies both task arcs and resource-wait constraints and
  retains `optimal=false`.

The target-scoped path uses the existing exact-driving and stable
lexicographic rules restricted to the predecessor cone of the target. It does
not label an unrelated global critical path as the cause.

If a command has not computed the full path, it returns a compact prefix or
suffix plus:

```json
["perttool", "dag", "analyze", "FILE", "--schedule", "both", "--format", "json"]
```

`FILE` is the exact operand accepted by the current command. The array is
data, not shell text. Human output prints `perttool dag analyze FILE
--schedule both` only when the applicable path is not already fully shown.

### 11.4 Shared projection and authority

One pure bounded alert evaluator feeds `document check`, `dag analyze`, and
`dag next` after successful structural validation.

- Check returns compact alerts and driver evidence without a second scheduler.
- Analysis returns full applicable paths and stable alert-to-path references.
- Next returns the same alert identities, compact path evidence, and full-
  analysis argument vector.

Alerts are separate from diagnostics. They retain a valid command's success
exit and their summary/count/truncation fields remain present even when
diagnostics are truncated. They do not mutate source, change Recommendation
version 1 ranking, create override validity, grant governance authority,
accept assurance, or independently change start authority.

## 12. Unavailable, invalid, and bounded outcomes

Invalid source remains invalid. Valid source may have an absent, incomplete,
infeasible, or unavailable temporal projection. These states are not
interchangeable.

Stable causes include:

| Cause | Meaning |
| --- | --- |
| `calendar_profile_absent` | Named-zone work was requested without the complete profile group |
| `zone_data_unavailable` | The exact selected zone release is not supported |
| `zone_range_exceeded` | An input or derived instant is outside the accepted range |
| `offset_zone_mismatch` | A written offset disagrees with the selected zone at that instant |
| `workday_relationship_missing` | Day-based work lacks exact working hours per day |
| `no_feasible_window` | Complete static rules prove no future common progress interval |
| `calendar_search_limit` | A bounded search ended without proof of absence |
| `active_capacity_conflict` | Simultaneous active requirements exceed effective capacity |
| `required_anchor_absent` | No project-finish deadline or latest bound exists |
| `required_anchor_incomparable` | Project-finish target kinds cannot select one instant |
| `required_schedule_unavailable` | Working-time subtraction or propagation is unavailable |
| `complete_actual_time_unavailable` | A completed event has no actual timestamp |
| `driver_not_computed` | The command intentionally returned only compact or no path evidence |
| `driver_unavailable` | A complete path cannot be established from available schedule facts |

`no_feasible_window` is returned only from a closed calendar, expired validity,
or another complete static proof. Hitting a range, segment, or search limit is
unavailable and MUST NOT be presented as proof that no schedule exists.

## 13. Exact hard limits

The profile-1 implementation uses these non-configurable semantic limits:

| Limit | Value |
| --- | ---: |
| Calendars per document | 256 |
| Weekly windows per calendar | 64 |
| Dated exceptions per calendar | 4,096 |
| Availability overrides per resource | 4,096 |
| Aggregate calendar and capacity change instants | 100,000 |
| Work segments per schedule projection | 1,000,000 |
| Schedule alerts | 10,000 |
| Compact driver steps per alert | 64 |
| Full target-driver steps per alert | 100,000 |
| Full path enumeration | existing `--max-paths 0..1000` contract |

Input counts are preflighted before expansion. An exceeded source-structure
limit is invalid with `PTSCH-109`. A derived segment or driver limit returns
an unavailable projection with its limit name, configured value, and actual
or lower-bound count. Alert truncation retains the total count when known and
never erases the top-level alert summary.

## 14. Diagnostics

Grammar 8 reserves the single integrated family `PTSCH-101` through
`PTSCH-109`:

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTSCH-101` | error | incomplete or forbidden project calendar-profile field group |
| `PTSCH-102` | error | duplicate, unknown, or invalid calendar identity/reference |
| `PTSCH-103` | error | invalid weekday window, exception, or canonical overlap |
| `PTSCH-104` | error | invalid resource validity or availability override |
| `PTSCH-105` | error | invalid zone, release, range, or offset-zone relationship |
| `PTSCH-106` | error | invalid, duplicate, or inapplicable `when` event bound |
| `PTSCH-107` | error | earliest is strictly after latest for the same event |
| `PTSCH-108` | error | Grammar 8 contains legacy `not_before` without migration |
| `PTSCH-109` | error | a source calendar/availability hard limit is exceeded |

Network infeasibility, POSTDUE, and POSTDUE_FORECAST are typed analysis facts,
not validation errors. Human output may label alerts as warnings, but they are
not duplicated into the bounded diagnostic array.

## 15. Assurance, governance, mutation, and migration

### 15.1 Plan assurance

Grammar 8 introduces `Perttool.TaskPlanContract.v2` and plan-assurance hash
model 2. It is identical to v1 except that the canonical task field sequence
replaces `not_before` with the ordered four-value `when` record. Task bounds
therefore invalidate the task's accepted planning basis and its planning-
descendant closure.

Project calendar fields, calendar declarations, resource calendar and
availability fields, and milestone bounds are ambient scheduling inputs. They
recompute temporal authority and may fail it closed, but do not mass-change
every task-plan hash. This preserves the accepted distinction already used for
resource capacity and milestone metadata.

An assurance-enabled Grammar 8 document requires hash model 2. Migration from
model 1 is preview-first and produces a new complete initial-seal candidate;
it never reuses v1 digests as v2 acceptance. Unknown models fail unavailable.

### 15.2 Governance

Governance semantics version 2 classifies these as ordinary maintenance:

- project `time_zone`, `tzdb`, `calendar`, and `workday`;
- calendar declarations and their complete contents;
- resource calendar, validity, and availability fields; and
- task or milestone `when` fields.

`project.finish` remains a `goal` change. Adding/removing tasks, gates, or
milestones and changing endpoints remain `dag` changes. Ordinary classification
does not bypass assurance, complete candidate validation, digest, race,
history, or safe-write checks.

### 15.3 Source-preserving maintenance

CLI Contract 9 adds only `calendar add`, `calendar set`, and `calendar remove`
to the command catalog. Existing `project set`, `resource add/set`, `task
add/set`, `milestone add/set`, and `batch apply` gain the corresponding closed
fields. Repeated window, exception, availability, and when values are complete
typed option values; they are not an embedded recurrence or expression DSL.

Every mutation is preview-first, plans TextEdits against source spans,
validates the complete final Grammar 8 candidate, reports assurance and
governance impact, and uses the existing digest-bound safe-write sequence.
Removing a referenced calendar is invalid. No command reads or writes an
external calendar.

### 15.4 Migration

`document migrate --target-grammar 8` is the only automatic Grammar 8 entry.
It:

1. preserves all Grammar 7 meanings and bytes not owned by migration;
2. replaces every `not_before X` with `when start earliest X`;
3. adds no calendar profile, zone, window, exception, availability, latest
   bound, deadline, or workday by inference;
4. requires explicit user-provided profile fields when the same candidate
   adds calendar-backed source;
5. plans hash-model-2 initial sealing separately when assurance is enabled;
6. reports exact governance and assurance impacts; and
7. never downgrades automatically.

Unit migration version 4 preserves all Grammar 8 temporal source and remains
separate from calendar arithmetic. It cannot use `workday` to authorize a day
to hour source conversion.

## 16. Public and package boundary

The later `TEMPORAL_PUBLIC_CONTRACT` task atomically activates Grammar 8 and
CLI Contract 9. It may not publish a calendar-only, constraint-only, or
POSTDUE-only compatibility slice first.

The target closed result identities are:

```text
Perttool.ProjectResult.v5
Perttool.CheckResult.v6
Perttool.AnalysisResult.v7
Perttool.NextResult.v8
Perttool.MutationResult.v6
Perttool.PlanAssuranceResult.v2
Perttool.UnitMigrationResult.v4
```

`Perttool.AdvanceResult.v3` remains unchanged if the complete Grammar 8
candidate, owned-declaration removal, milestone-acceptance, assurance,
governance, and history-safety contracts can be represented without a shape
change. This contract accepts no silent field addition to v3. If implementation
evidence disproves shape compatibility, the public task must accept a new
identity before activation.

The replacement schemas keep the root schema catalog count unchanged; the
three calendar commands increase the command catalog from 53 to 56. Exact
root/Core/Node export counts are frozen by the public-contract task after the
source owners exist. Historical results, GraphView, editor protocol, MCP wire
identity, recommendation model, override decision, and milestone-acceptance
meaning remain unchanged.

The package gate MUST prove:

- one bundled, offline, digest-identified 2026c zone data set;
- no runtime network or host-zone dependency;
- complete Help, Guide, schema, text/JSON, temporary-link, and isolated-
  package behavior;
- exact legacy Grammar 1 through 7 result compatibility;
- private adapter consumption through shared Application semantics without a
  second calendar or alert evaluator; and
- no release, registry, extension-marketplace, remote, Issue, or plan-advance
  mutation.

## 17. Complexity boundary and non-goals

This contract deliberately does not copy the calendar and constraint breadth
of portfolio scheduling products. Version 1 excludes:

- human-only resource types, attendance, payroll, billing, and leave ledgers;
- task calendars, calendar inheritance trees, ignore-calendar switches, and
  organization-wide calendar pools;
- RRULE, cron, arbitrary recurrence expressions, and external holiday feeds;
- independently selected per-resource time zones;
- skills, substitution, consumables, assignment units, effort-driven
  duration, and work contours;
- arbitrary constraint names, lag/lead dependencies, and logical expressions;
- discretionary task preemption and automatic replanning;
- backward resource leveling, exact RCPSP optimization, Monte Carlo risk, and
  probabilistic due-date promises;
- inferred actuals, automatic baseline commitment, and milestone acceptance;
- external calendar synchronization or notification delivery; and
- release selection, publication, remote writes, Issue mutation, and unrelated
  plan advancement.

New evidence is required before any excluded concept expands the DSL. A later
feature should first try to compose the accepted available-capacity function,
event bounds, or dedicated-resource technique. It must not add a resource type
or product-specific constraint name merely to match another tool's UI.

## 18. Dependency-ordered acceptance cases

The machine-readable authority is
[`temporal-schedule-contract-v1.json`](../../test/fixtures/temporal-schedule-contract-v1.json).

| Case | Accepted boundary |
| --- | --- |
| `TSC-001` | Grammar 1 through 7 continuous-profile bytes, results, commands, and authority remain exact. |
| `TSC-002` | Grammar 8 has one calendar declaration and the closed project/resource/when field inventory. |
| `TSC-003` | IANA 2026c, its source digest, one project zone, explicit offset matching, and the closed range are deterministic. |
| `TSC-004` | Half-open weekly windows, split cross-midnight syntax, and DST gap/overlap instant membership are exact. |
| `TSC-005` | One dated exception replaces the complete weekly value for its local date. |
| `TSC-006` | Project default, resource replacement, and dedicated-resource task windows use no task-calendar hierarchy. |
| `TSC-007` | Validity then non-overlapping capacity replacement yields generic finite and partial availability. |
| `TSC-008` | Invalid intervals, overlaps, offset mismatch, unknown references, and source limits fail before scheduling. |
| `TSC-009` | Hour work advances by exact common working seconds and retains ordered work segments. |
| `TSC-010` | Day and Point/day work require exact `workday`; Point/hour remains exact without day/hour migration. |
| `TSC-011` | Multiple required resources advance only over their simultaneous allocatable intervals. |
| `TSC-012` | Calendar interruption releases all allocations, permits gap reuse, and resumes deterministically. |
| `TSC-013` | Active conflicts, proved no-window, search limit, and range overflow remain distinct. |
| `TSC-014` | `not_before` migrates exactly to task-start earliest and does not remain a Grammar 8 alias. |
| `TSC-015` | Task-finish earliest delays start without adding a resource-holding idle tail. |
| `TSC-016` | Milestone-reach earliest waits after complete incoming closure without changing topology. |
| `TSC-017` | Latest bounds, exact events, duplicate detection, and same-event contradiction rules are closed. |
| `TSC-018` | Project required schedule selects latest, advisory deadline, or coincident anchor explicitly. |
| `TSC-019` | Intermediate task and milestone latest bounds propagate through AoA without source copying. |
| `TSC-020` | Network contradiction produces negative slack and typed infeasibility, not invalid DAG. |
| `TSC-021` | Precedence infeasibility and late `optimal=false` resource forecast remain different proof strengths. |
| `TSC-022` | Reached, active, done, blocked, and suspended states never acquire inferred actual times or resumes. |
| `TSC-023` | POSTDUE requires an incomplete comparable event strictly before `as_of`; equality is due now. |
| `TSC-024` | POSTDUE_FORECAST prefers a late precedence lower bound and is suppressed by matching current POSTDUE. |
| `TSC-025` | Resource-only forecast lateness retains scheduler identity and `optimal=false`. |
| `TSC-026` | Deadline and latest-bound alerts remain distinct targets with stable deduplication keys. |
| `TSC-027` | Project-finish alerts bind the applicable existing precedence or schedule critical representative path. |
| `TSC-028` | Intermediate alerts bind target-scoped drivers or exact unavailable/not-computed state and argv. |
| `TSC-029` | Check, Analysis, and Next share one evaluator; alerts survive diagnostic truncation and keep success exits. |
| `TSC-030` | Calendar and earliest gating extend temporal authority while latest/alerts do not change recommendation ranking. |
| `TSC-031` | TaskPlanContract v2, ambient inputs, governance v2, migration, safe writes, and Advance v3 boundaries are exact. |
| `TSC-032` | Contract-only acceptance retains active counts; later atomic public and installed-package gates own activation. |

No runtime slice is accepted until its task traces the applicable prefix of
these cases. Complete acceptance requires all thirty-two cases across Core,
CLI, schemas, Help, Guide, adapters, self-use, temporary link, isolated
package, and installed CLI.
