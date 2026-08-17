# Temporal Calendar Semantics Specification

- Document status: Normative 1.0
- Calendar arithmetic ID: `perttool.calendar-projection`
- Calendar arithmetic version: `1`
- Calendar profile ID: `perttool.calendar.continuous-fixed-offset`
- Calendar profile version: `1`
- Created: 2026-07-25
- Related requirements: [../requirements.md](../requirements.md)
- Grammar specification: [dsl-grammar.md](dsl-grammar.md)
- Analysis specification: [analysis.md](analysis.md)
- Deadline semantics: [temporal-deadline.md](temporal-deadline.md)
- Unit migration semantics: [unit-migration.md](unit-migration.md)
- Public interface: [temporal-unit-interface.md](temporal-unit-interface.md)
- Grammar 8 scoped successor: [Calendar-Aware Temporal Scheduling Contract](temporal-schedule.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose

This specification fixes the deterministic calendar and snapshot semantics
used by the first temporal extension. It defines:

- the distinct meanings of an ISO date and an offset-bearing date-time;
- comparison and subtraction within each temporal kind;
- `project.as_of` as the only mapping from relative schedule time zero;
- projection of exact day, hour, and velocity-derived point values;
- fixed-offset preservation and exact derived values;
- the initial continuous-calendar boundary;
- temporal start eligibility from `task.not_before`; and
- unavailable-result boundaries that prevent invented time zones, clocks, or
  unit conversions.

This specification does not add fields to grammar version 1, define deadline
status, choose public result schemas, or authorize source migration between
Points and time units. Those are dependency-ordered follow-on contracts.

## 2. Normative position

Resolve conflicts of meaning or design in the following order.

1. Must requirements in [Requirements](../requirements.md)
2. This specification
3. Exact relative values from the [Analysis specification](analysis.md)
4. Literal acceptance from the [DSL Grammar specification](dsl-grammar.md)
5. `docs/basic-design.md`, examples, tests, help, and implementation

The grammar determines whether a declared literal is syntactically and
calendar-valid. This specification receives validated values and determines
their temporal meaning. It MUST NOT make an invalid literal successful by
returning an unavailable projection.

## 3. Scope and non-goals

In scope:

- valid four-digit-year proleptic Gregorian dates;
- valid date-times with an explicit numeric offset or `Z`;
- exact comparisons and signed differences;
- date-only and fixed-offset date-time projection;
- exact point-to-day or point-to-hour projection through project velocity;
- future `not_before` release bounds relative to `as_of`;
- separate projection of precedence and heuristic resource schedules; and
- deterministic unavailability when the accepted calendar relationship is
  insufficient.

Out of scope:

- named time zones or a time-zone database;
- local date-times without an offset;
- daylight-saving transitions;
- business days, holidays, weekends-as-nonworking-days, shifts, or working
  hours;
- per-task or per-resource calendars;
- leap seconds;
- actual task start, task finish, or milestone reach times;
- reading the system clock, locale, operating-system time zone, or Git time;
- changing resource capacity by calendar time;
- converting a source document between `day`, `hour`, and `point`; and
- deadline feasibility, margin, lateness, overdue, risk, or recommendation
  ranking.

## 4. Version identity and determinism

The accepted initial identity is:

```text
calendar_arithmetic_id       = perttool.calendar-projection
calendar_arithmetic_version  = 1
calendar_profile_id          = perttool.calendar.continuous-fixed-offset
calendar_profile_version     = 1
```

The same validated document, exact relative result, and version identities
MUST produce the same calendar values and availability states.

Implementations MUST NOT use `Date.now`, the process-local time zone, locale
formatting, or time-zone-database rules as semantic inputs. A host date library
may be used only when its result is checked against the rules in this
specification and cannot introduce a wider year, leap-second, offset, or
rounding policy.

An incompatible change to comparison, calendar arithmetic, availability, or
the profile boundary requires a version increase. A later interface may
version its result schema independently.

## 5. Calendar value model

Every declared or derived calendar value has one of two tagged kinds.

```text
CalendarValue =
  DateValue
  | DateTimeValue
```

The two kinds are not implicit precision variants of one value. A date has no
clock or offset, and a date-time denotes an exact instant. No operation may
silently promote a date to midnight or truncate a date-time to a date.

### 5.1 Date value

A date consists of a valid Gregorian year, month, and day accepted by the
applicable grammar.

Use the proleptic Gregorian leap-year rule.

```text
leap(y) = y divisible by 4
          and (y not divisible by 100 or y divisible by 400)
```

Map a date to an integer `civil_day_number` that increases by exactly one for
each successive Gregorian date. The epoch chosen for that integer is internal;
comparison, subtraction, and addition MUST be independent of the chosen epoch.

A date:

- denotes a civil-day label;
- does not denote midnight;
- has no UTC instant;
- has no time-zone offset; and
- retains only day precision.

### 5.2 Offset-bearing date-time value

A date-time consists of:

- a valid Gregorian date;
- hour, minute, and second components;
- an exact finite decimal fractional second, or zero when omitted; and
- an explicit fixed offset.

Convert it to an exact comparison key as follows.

```text
local_seconds =
  civil_day_number * 86400
  + hour * 3600
  + minute * 60
  + second
  + fractional_second

instant_key = local_seconds - offset_minutes * 60
```

`fractional_second` is an exact Rational derived from its decimal digits.
`offset_minutes` is signed and exact. `Z` has offset zero.

`instant_key` is an exact Rational number of SI seconds. Implementations MUST
NOT round it to milliseconds or binary floating point.

The declared offset spelling and fractional-second precision remain source
information. Equality and ordering depend on `instant_key`, not that spelling.

## 6. Comparison and subtraction

### 6.1 Same-kind comparison

Compare two dates by `civil_day_number`.

Compare two date-times by `instant_key`. Therefore, two date-times with
different declared offsets can compare equal.

Comparison returns exactly one of:

```text
less
equal
greater
```

### 6.2 Same-kind difference

Subtract two dates as an exact signed integer number of calendar days.

Subtract two date-times as an exact signed Rational number of SI seconds using
their `instant_key` values.

No display-rounded value participates in comparison or subtraction.

### 6.3 Mixed-kind boundary

A date and a date-time are `incomparable_temporal_kinds`.

This is an unavailable temporal relationship, not permission to assume
midnight, UTC, the project offset, or the host time zone. The later interface
contract MUST preserve this distinction from invalid input and from an absent
temporal property.

## 7. Snapshot anchor

`project.as_of` is the only temporal anchor. Relative schedule time zero maps
to its declared calendar value.

- A date `as_of` selects date mode for projection from that anchor, but does
  not supply a clock or offset.
- A date-time `as_of` selects fixed-offset date-time mode. Its declared offset
  remains the projection offset.
- Commands MUST NOT substitute the current date or time when `as_of` is
  absent.
- Re-analysis of the same snapshot MUST NOT change merely because wall-clock
  time passed.
- `as_of` is not an actual start, finish, or reach timestamp.
- An `active` task has remaining work at relative time zero. Its remaining
  finish may be projected, but its historical start time is unknown.
- A `done` task or reached milestone has no inferred actual completion time.

The selected [Project Actuals and Git History
Contract](project-actuals.md) defines a separate future evidence model for
explicit task work-event times. It does not reinterpret `as_of`, projected
calendar values, or Git timestamps. The first temporal-extension behavior in
this specification remains unchanged until that later contract is activated.

Temporal properties require `as_of` as fixed by Requirements. A request for a
calendar projection of a document without an anchor returns
`missing_temporal_anchor`; it does not mutate the document or read the clock.

## 8. Effective projection unit and velocity

Calendar projection consumes exact relative values without changing the base
analysis.

Determine the effective projection unit as follows.

| Project base unit | Effective projection unit | Exact value |
| --- | --- | --- |
| `day` | `day` | the base Rational |
| `hour` | `hour` | the base Rational |
| `point` with `Pp/Td` | `day` | `x * T / P` |
| `point` with `Pp/Th` | `hour` | `x * T / P` |

For a point project, `P` and `T` are the exact positive velocity quantities and
`x` is the exact point value. The converted value retains the
`velocity_forecast` qualifier and the velocity identity.

For a day or hour project, calendar projection uses the base value. An
optional velocity that forecasts Points does not replace or mediate that
value.

Velocity conversion for calendar projection:

- is exact Rational arithmetic;
- does not change PERT/CPM, float, resource, or variance values;
- does not authorize source rewriting;
- does not establish a relationship between `day` and `hour`; and
- does not use a point display value as input.

## 9. Projection matrix

After resolving the effective projection unit, apply exactly this matrix.

| Anchor kind | Effective unit | Availability | Rule |
| --- | --- | --- | --- |
| `date` | `day` | available only for an integer value | add the signed integer to `civil_day_number` |
| `date` | `hour` | unavailable | `date_anchor_has_no_clock` |
| `date-time` | `day` | available | add the exact Rational value multiplied by 86400 SI seconds |
| `date-time` | `hour` | available | add the exact Rational value multiplied by 3600 SI seconds |

A non-integer day value projected from a date anchor is
`fractional_date_projection`. It MUST NOT be rounded, truncated, promoted to a
date-time, or assigned a time zone.

For date-time projection:

```text
projected_instant_key =
  anchor_instant_key + exact_relative_seconds
```

Normalize the derived local representation at the anchor's fixed offset. The
derived value retains:

- the exact `projected_instant_key`;
- the anchor offset;
- a normalized Gregorian date and time; and
- an exact Rational fractional second when needed.

The constants 86400 and 3600 are calendar-projection scalars for the already
selected effective unit. They MUST NOT be exposed as a general `day <-> hour`
conversion, used by unit migration, or used to rewrite source literals.

Projection beyond the year range accepted by the applicable calendar grammar
is `calendar_range_overflow`; it does not wrap or clamp.

## 10. Offset and representation preservation

Declared date-times retain their exact source value and offset. Comparison may
normalize to `instant_key`, but stored or echoed metadata MUST NOT silently
replace an offset with `Z`, the anchor offset, or the process-local offset.

A derived date-time is expressed at the `as_of` fixed offset. It does not adopt
the offset of a deadline or `not_before` value.

Derived fractional seconds remain exact Rational values. Text and JSON
projections specified later MUST represent them losslessly or expose that an
ISO spelling is unavailable. They MUST NOT round a non-terminating result to a
plausible timestamp and then use that timestamp for comparison.

Human-readable date/time strings are projections. `civil_day_number`,
`instant_key`, exact relative values, and exact differences are the semantic
inputs.

## 11. Continuous-calendar profile boundary

Calendar profile version 1 is continuous and fixed-offset.

- Every successive Gregorian date is one calendar day, including Saturdays,
  Sundays, and holidays.
- Date-time arithmetic is continuous SI-second arithmetic at the declared
  fixed offset.
- No daylight-saving gap or overlap exists because a fixed offset is not a
  named time zone.
- A task may span any date or time without a working-hours boundary.
- Resource capacities remain constant; this profile does not add availability
  windows.
- The profile is implicit in calendar arithmetic version 1 and is not a
  project-selectable calendar.

Adding business calendars, named zones, shifts, working hours, or
time-varying capacity requires new requirements and an independently versioned
calendar profile. Such a profile MUST NOT silently change version 1 results.

## 12. `not_before` release bound

`not_before` applies only to a new start for a planned task. It does not change
structural `ready`, create a dependency edge, or reconstruct an active task's
historical start.

When `not_before` and `as_of` have the same kind:

1. Compare them exactly.
2. If `not_before <= as_of`, the temporal release bound is zero.
3. If it is future, subtract `as_of` from `not_before`.
4. Express the difference in the effective projection unit:
   - date difference is already an integer day value;
   - date-time seconds divide exactly by 86400 for day or 3600 for hour;
   - for a point project, convert the day/hour difference to Points as
     `difference * P / T`.
5. Retain the exact non-negative Rational result.

A date difference cannot be converted to an hour effective unit. That
relationship is `date_anchor_has_no_clock`, even when the number of dates could
be multiplied by 24.

Mixed kinds are `incomparable_temporal_kinds`. When a release bound is
unavailable, automation MUST fail closed: it cannot include the task in a set
asserted to be startable now. The task remains structurally `ready`, not
`blocked`.

Applying release bounds to a future resource schedule requires a separately
versioned temporal scheduling rule. The unqualified precedence CPM and
Analysis version 1 resource result remain available and unchanged.

## 13. Composition with analysis

Calendar projection is a pure layer over exact relative results.

- Project precedence starts/finishes and milestone reaches separately.
- Project heuristic resource starts/finishes and milestone reaches separately.
- Identify which source schedule produced every projected value.
- Preserve `conditional_on_blocks_resolved` from the source schedule.
- Preserve the heuristic and non-optimal qualification of a resource result.
- Do not combine precedence and resource values into one unqualified
  projection.
- Do not add calendar fields to existing Analysis version 1 result identities.

Deadline evaluation may later consume the exact projected value, a declared
deadline, comparison, and signed difference. This specification does not name
the resulting deadline states or change recommendation ranking.

## 14. Availability and failure boundaries

Invalid source remains a validation failure. A valid base analysis can still
have an unavailable calendar projection.

Version 1 semantic unavailable causes are:

| Cause | Meaning |
| --- | --- |
| `missing_temporal_anchor` | No declared `project.as_of` maps relative zero |
| `incomparable_temporal_kinds` | An operation would compare or subtract a date and a date-time |
| `date_anchor_has_no_clock` | Date mode was asked to project or derive an hour value |
| `fractional_date_projection` | Date mode received a non-integer day value |
| `calendar_range_overflow` | Exact arithmetic leaves the accepted calendar year range |
| `exact_datetime_text_unavailable` | A later text format cannot spell an exact derived fractional second without loss |

The interface contract may assign schema fields and diagnostics, but it MUST
preserve these meanings and MUST distinguish:

- invalid input;
- unavailable derivation;
- absent or not-applicable temporal data; and
- an available exact result.

## 15. Follow-on contract boundaries

The [Temporal Deadline Semantics specification](temporal-deadline.md) receives:

- same-kind comparison;
- signed exact date or instant difference;
- separate precedence/resource projections;
- block and heuristic qualifications; and
- unavailable causes.

It defines feasibility, margin, lateness, overdue, and risk states; release
scheduling; and the unchanged recommendation-version boundary.

The [Unit Migration Semantics specification](unit-migration.md) receives only
the project velocity relationship. It MUST NOT use calendar-projection
scalars, a date difference, an offset, or `as_of` to invent a `day <-> hour`
source migration.

The [Temporal and Unit Interface Contract](temporal-unit-interface.md)
selects:

- grammar-version fields and validation;
- Core types and result-schema identities;
- exact JSON and text representation;
- CLI options and command identity;
- help, guide, and diagnostic projection; and
- preview-first mutations and batch behavior.

## 16. Acceptance

The calendar observations are fixed by
[TUE-003 through TUE-008](../examples/temporal-units.md#3-validation-and-calendar-cases)
and the shared machine-readable baseline.

This slice is accepted only when tests and review establish all of the
following.

1. Date and date-time remain distinct tagged kinds.
2. Date comparison uses Gregorian day order without midnight inference.
3. Date-time comparison uses exact offset-normalized instants.
4. Declared offsets are preserved while equal instants can have different
   offsets.
5. Relative zero comes only from `project.as_of`.
6. Day, hour, and point/velocity projections follow the exact matrix.
7. Date-mode fractional days and hours fail unavailable without rounding.
8. `not_before` retains structural readiness and fails closed when its release
   bound is unavailable.
9. Calendar projection does not alter base analysis or authorize unit
   migration.
10. The continuous profile has no locale, wall-clock, named-zone, DST,
    business-calendar, or time-varying-capacity input.
11. Existing grammar version 1 and Analysis version 1 identities remain
    unchanged.
12. Deadline and source-migration semantics plus the public interface remain
    separately versioned, the boundary examples are fixed, and design review
    remains explicit follow-on work.
