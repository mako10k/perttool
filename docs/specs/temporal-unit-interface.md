# Temporal and Unit Interface Contract Specification

- Document status: Normative 1.0
- Interface ID: `perttool.temporal-unit-interface`
- Interface version: `1`
- Target grammar version: `2`
- Target CLI contract version: `4`
- Created: 2026-07-25
- Requirements: [../requirements.md](../requirements.md)
- Grammar: [dsl-grammar.md](dsl-grammar.md)
- Calendar semantics: [temporal-calendar.md](temporal-calendar.md)
- Deadline semantics: [temporal-deadline.md](temporal-deadline.md)
- Unit migration semantics: [unit-migration.md](unit-migration.md)
- Mutation semantics: [mutation.md](mutation.md)
- Active CLI contract: [cli-contract-3.md](cli-contract-3.md)
- Related basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose and activation boundary

This contract fixes the public surface for the first temporal and source-unit
extension. It selects:

- grammar version 2 fields and validation;
- Core request and result boundaries;
- CLI Contract 4 commands, operands, options, and effects;
- source-preserving temporal mutation and unit-migration behavior;
- exact text and JSON result projections;
- command discovery, domain guidance, and diagnostics; and
- the compatibility and authority boundary from grammar version 1, CLI
  Contract 3, and `Perttool.NextResult.v3`.

This is an implementation target, not the active runtime contract. The current
source remains CLI Contract 3 and accepts only grammar version 1. No command,
field, schema, package release, or recommendation-authority change in this
document is active until an implementation change satisfies every applicable
`TUI-*` case and performs one atomic Contract 4 cutover.

This task does not implement parsing, analysis, mutation, help, or CLI
dispatch. It also does not authorize publication.

## 2. Normative position and version matrix

Resolve conflicts in this order.

1. Must requirements in [Requirements](../requirements.md)
2. Calendar, deadline, and unit-migration semantic specifications
3. This public interface contract
4. Grammar and mutation mechanical contracts
5. Active CLI Contract 3 meanings retained by this contract
6. Basic design, examples, help, tests, and implementation

The selected identities are:

| Concern | Existing identity | Target identity |
| --- | --- | --- |
| DSL grammar | `1` | `2` |
| CLI contract | `3` | `4` |
| Check result | `Perttool.CheckResult.v1` | `Perttool.CheckResult.v2` |
| Project result | `Perttool.ProjectResult.v1` | `Perttool.ProjectResult.v2` |
| Analysis result | `Perttool.AnalysisResult.v2` | `Perttool.AnalysisResult.v3` |
| Next result | `Perttool.NextResult.v3` | `Perttool.NextResult.v4` |
| Unit migration | absent | `Perttool.UnitMigrationResult.v1` |

`Perttool.MutationResult.v1`, `Perttool.InitResult.v1`,
`Perttool.CommandHelpResult.v1`, `Perttool.GuideResult.v1`, and
`Perttool.CliError.v1` retain their payload shapes because this contract does
not add a field to those result bodies. Under Contract 4 their envelopes
report `cli_contract_version=4`.

Calendar arithmetic, calendar profile, deadline evaluation, temporal
precedence projection, temporal resource projection, unit migration,
ordinary analysis, scheduler, and recommendation identities remain the
independent versions fixed by their specifications. A CLI or schema version
does not silently increment a domain algorithm.

## 3. Grammar version 2

### 3.1 Version selection and compatibility

Grammar version 2 is selected only by an explicit project field:

```pert
project PLAN:
  version 2
```

An omitted `version` still means grammar version 1. A version 1 document
retains its existing field set, parser behavior, base analysis, and
recommendation inputs. Version 1 rejects the new fields as `PTDSL-005`.

The words `deadline` and `not_before` are contextual field keywords. They do
not become globally reserved entity IDs, so a valid version 1 document using
either spelling as an ID can move to version 2 without an unrelated rename.

### 3.2 Added fields

Grammar version 2 adds exactly these fields:

```ebnf
DeadlineField  = "deadline", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;
NotBeforeField = "not_before", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;

MilestoneFieldV2 = MilestoneFieldV1 | DeadlineField ;
TaskFieldV2      = TaskFieldV1 | NotBeforeField | DeadlineField ;
```

No temporal field is added to project, resource, gate, estimate, or requires.
`project.as_of` remains the only temporal anchor, and the project deadline is
the deadline on the milestone referenced by `project.finish`.

The added field table is:

| Entity | Field | Count | Value | Constraint |
| --- | --- | ---: | --- | --- |
| milestone | `deadline` | 0..1 | ISO date/date-time | Latest desired reach; not a dependency or hard cap |
| task | `not_before` | 0..1 | ISO date/date-time | Earliest permitted new start |
| task | `deadline` | 0..1 | ISO date/date-time | Latest desired finish; not a hard cap |

The existing calendar-validity rules for `as_of` apply without widening:
date-times require an explicit offset, local date-times and leap seconds are
invalid, and exact declared spelling is retained in the CST.

### 3.3 Validation

A version 2 document containing at least one `deadline` or `not_before`
requires `project.as_of`. Its absence is `PTSEM-112`.

Different temporal kinds remain valid source. A date `as_of` and a date-time
deadline, for example, produce the semantic unavailable cause
`incomparable_temporal_kinds`; the validator does not invent midnight and
does not convert the valid document into an error.

`not_before` on an `active` or `done` task is retained source information but
is not applicable to a new start. A deadline on a done task or reached
milestone is retained while actual compliance remains unavailable. These are
not field-validation errors.

### 3.4 Canonical order and source preservation

Grammar version 2 extends canonical order as follows:

```text
milestone:
  title, description, state, deadline, tags

task:
  title, description, duration|estimate, not_before, deadline, status,
  priority, requires, owner, tags, blocked_reason, source
```

Source-preserving formatting retains existing field order. New fields use the
canonical positions above without reordering existing fields. Unit migration
version 1 supports grammar versions 1 and 2 because version 2 adds no
base-unit-bearing field; it preserves `as_of`, `deadline`, and `not_before`
byte-for-byte.

## 4. Core boundaries

### 4.1 Shared temporal values

Public temporal results use the following conceptual records. JSON uses the
snake-case projections of these names.

```ts
type ExactInteger = string;

interface ExactFraction {
  numerator: ExactInteger;
  denominator: ExactInteger;
}

type CalendarValue =
  | {
      kind: "date";
      sourceText: string | null;
      year: number;
      month: number;
      day: number;
    }
  | {
      kind: "date_time";
      sourceText: string | null;
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: ExactFraction;
      offsetMinutes: number;
    };

interface CalendarDifference {
  kind: "calendar_days" | "si_seconds";
  exact: ExactFraction;
}

interface TemporalCause {
  cause: string;
  underlyingCause: string | null;
  subjectKind: "project" | "milestone" | "task" | null;
  subjectId: string | null;
  taskId: string | null;
}

type TemporalState = "absent" | "not_applicable" | "unavailable" | "available";
```

`source_text` is the exact declared token for a declared value. A derived
value uses an exact normalized ISO spelling when one exists and otherwise
sets it to null with `exact_datetime_text_unavailable`. Numeric components and
fractions remain authoritative; text is not used for comparison.

Relative values and base-unit margins reuse `RationalValue`, including exact
numerator, denominator, unit, and display. Calendar differences do not pretend
that SI seconds and civil days are one unit.

### 4.2 Temporal analysis

The implementation exposes one pure temporal projection service over a valid
document and an ordinary exact analysis result:

```ts
analyzeTemporal(
  document: ValidatedDocumentV2,
  analysis: AnalysisResultV2,
  options: TemporalAnalysisOptions,
): TemporalAnalysis
```

It does not read a path, clock, time zone, locale, Git repository, or previous
result. It returns the calendar, deadline, precedence, resource, scheduler,
and velocity identities used.

`TemporalAnalysis` contains separate precedence and resource schedule
projections plus one deadline evaluation per declared task or milestone
deadline. A projection never replaces ordinary base analysis.

### 4.3 Unit migration

The implementation exposes a separate pure planner:

```ts
planUnitMigration(
  text: string,
  request: {
    targetUnit: "day" | "hour" | "point";
    replacementVelocity?: string;
  },
  options?: MutationOptions,
): UnitMigrationResult
```

The planner implements `perttool.unit-migration` version 1 and returns the
semantic outcome, localized UTF-16 edits, candidate, digest, and diff only
after final validation. It is not a `project.set` shortcut and does not
consume rendered analysis.

## 5. CLI Contract 4

### 5.1 Surface and registry

Contract 4 is the complete Contract 3 surface plus the command and options in
this section. Every active descriptor has `contractVersion=4`; dispatch, text
help, JSON help, examples, and usage recovery expand the same registry.
Contract 3 spellings remain unchanged and no Contract 3/4 switch or alias is
provided.

Contract 4 adds:

```text
perttool project migrate-unit <file>
  --to-unit day|hour|point
  [--replacement-velocity <velocity>]
  [--diff]
  [--write [--expect-digest <digest>] | --out <path>]
  [--max-diagnostics <integer>] [--warnings-as-errors]
  [--format text|json] [--color auto|always|never]
```

Its operation is `project.migrate-unit`, input is `document`, effect is
`preview`, document stdin is accepted for preview and rejected with
`--write`, and its only success schema is
`Perttool.UnitMigrationResult.v1`.

`--to-unit` is required. `--replacement-velocity` is explicit caller input,
not a forecast. An invalid `--to-unit` enum is a usage error; an invalid
velocity literal is a migration diagnostic. Same-unit migration with a
replacement fails rather than acting as project metadata maintenance.

### 5.2 Temporal maintenance options

Contract 4 extends the existing descriptors:

```text
perttool project init ...
  [--initial-milestone-deadline <date-or-date-time>]

perttool task add ...
  [--not-before <date-or-date-time>]
  [--deadline <date-or-date-time>]

perttool task set ...
  [--not-before <date-or-date-time>]
  [--deadline <date-or-date-time>]
  [--clear ...|not_before|deadline]

perttool milestone add ...
  [--deadline <date-or-date-time>]

perttool milestone set ...
  [--deadline <date-or-date-time>]
  [--clear ...|deadline]
```

`project init --initial-milestone-deadline` requires `--version 2` and an
explicit `--as-of`. All other temporal field acceptance is determined from
the final candidate's explicit grammar version and anchor.

`document check`, `project show`, `dag analyze`, and `dag next` gain no
temporal toggle. Contract 4 returns their new schemas for both grammar
versions so consumers never guess a payload shape from document content.

## 6. Mutation, batch, and write behavior

Temporal field options project to ordinary source-preserving mutation
requests:

```ts
TaskDefinition.notBefore?: string;
TaskDefinition.deadline?: string;
TaskFieldSet.notBefore?: string;
TaskFieldSet.deadline?: string;
TaskClearableField += "not_before" | "deadline";

MilestoneDefinition.deadline?: string;
MilestoneFieldSet.deadline?: string;
MilestoneClearableField += "deadline";
```

A batch may atomically:

- set `project.version` to 2 and add temporal fields;
- set `project.as_of` and add temporal fields;
- clear every temporal field and set `project.version` to 1; or
- update multiple temporal fields whose intermediate documents would be
  invalid.

Only the final batch candidate is parsed and validated. Clearing `as_of`
while any temporal field remains fails with `PTSEM-112`.

Automatic unit migration is deliberately not an atomic `batch.apply` member
in interface version 1. A batch containing a `project.migrate-unit` kind is
`PTMUT-301`. Callers run the dedicated migration, persist or consume its
candidate, then re-read and reanalyze before a separate mutation. A manually
authored batch can change unit-bearing fields but does not receive migration
inventory, exactness, or reversibility claims.

Temporal mutations reuse `Perttool.MutationResult.v1`. Unit migration uses
`Perttool.UnitMigrationResult.v1`. Both preview by default and share:

- complete-candidate revalidation;
- `--diff` only in preview;
- mutually exclusive `--write` and `--out`;
- `--expect-digest` only with `--write`;
- symlink and race rejection;
- exclusive `--out`;
- atomic in-place replacement; and
- post-write digest verification.

## 7. JSON envelope and stable ordering

Every Contract 4 JSON envelope includes:

```text
cli_contract_version  4
```

Document-result common fields, diagnostics, exact Rational representation,
source locations, stream behavior, and exit meanings otherwise remain those
preserved by Contract 3.

Stable order is:

- source declaration order for declared temporal inputs;
- ordinary analysis stable order for projected tasks and milestones;
- subject kind `task`, then `milestone`, each in stable graph order, for
  deadline evaluations;
- precedence before resource for all paired views; and
- unit-migration converted fields in declaration and field order.

Unavailable, absent, not-applicable, and available states are distinct. A
valid unavailable projection keeps `ok=true`; a source, request, or candidate
error returns `ok=false`.

## 8. Operation result schemas

### 8.1 `Perttool.CheckResult.v2`

Version 2 retains all CheckResult v1 fields and adds:

```text
temporal_inputs:
  anchor                 CalendarValue|null
  milestone_deadlines    [{milestone_id, deadline}]
  task_constraints       [{task_id, not_before, deadline}]
```

`not_before` and `deadline` in task constraints are nullable
`CalendarValue`. A valid version 1 document returns a null anchor when absent
and empty arrays. When parsing fails and values cannot be trusted,
`temporal_inputs=null`.

### 8.2 `Perttool.ProjectResult.v2`

Version 2 retains project identity and metadata but changes `project.as_of`
from an untyped string to `CalendarValue|null` and adds:

```text
project:
  ...
  as_of                    CalendarValue|null
  finish_deadline          CalendarValue|null
```

`finish_deadline` is read from the milestone referenced by `finish`; it is not
a project alias. An invalid document returns `project=null` and
`grammar_version=null`.

### 8.3 `Perttool.AnalysisResult.v3`

Version 3 retains every AnalysisResult v2 base field and adds the required
root:

```text
temporal:
  interface                  {id, version}
  calendar                   {arithmetic_id, arithmetic_version,
                              profile_id, profile_version}
  deadline                   {evaluation_id, evaluation_version}
  anchor                     CalendarValue|null
  precedence                 TemporalScheduleProjection
  resource                   TemporalScheduleProjection
  deadline_evaluations       DeadlineEvaluation[]
```

`TemporalScheduleProjection` is:

```text
state                       "absent"|"unavailable"|"available"
view                        "precedence"|"resource"
algorithm                   {id, version, optimal}|null
conditional_on_blocks_resolved boolean
blocked_task_ids            string[]
unavailable_causes          TemporalCause[]
tasks:
  [{task_id,
    declared_not_before,
    release_state,
    release_bound,
    start,
    finish,
    unavailable_causes}]
milestones:
  [{milestone_id, reach, unavailable_causes}]
```

The projection is `absent` only when the document has no anchor and no
temporal property. An anchor without a deadline still produces the available
calendar schedule. A valid relationship that cannot be projected is
`unavailable` with its exact causes.

`declared_not_before` is `CalendarValue|null`. `release_bound` is
`RationalValue|null`. `start`, `finish`, and `reach` are:

```text
state                       "not_applicable"|"unavailable"|"available"
relative                    RationalValue|null
calendar                    CalendarValue|null
unavailable_causes          TemporalCause[]
```

The precedence algorithm is
`perttool.temporal-precedence-earliest@1` with `optimal=null`. The resource
algorithm is `perttool.temporal-parallel-sgs@1` with `optimal=false` and also
retains the ordinary `parallel-sgs@1` scheduler identity.

`DeadlineEvaluation` is:

```text
subject                     {kind, id, roles}
deadline                    CalendarValue
completion_state            "incomplete"|"complete_actual_time_unavailable"
current:
  state                     "not_due"|"due_now"|"overdue"|
                            "not_applicable"|"unavailable"
  signed_window             CalendarDifference|null
  base_unit_window          RationalValue|null
  unavailable_causes        TemporalCause[]
precedence                  DeadlineView
resource                    DeadlineView
combined_assessment         "overdue"|"forecast_infeasible"|"at_risk"|
                            "forecast_on_time"|"not_proven_late"|
                            "not_applicable"|"unavailable"
conditional_on_blocks_resolved boolean
blocked_task_ids            string[]
destination_relationship    {milestone_id, relation}|null
```

`roles` contains `project_finish` only for the finish milestone and otherwise
contains `task` or `milestone`. `DeadlineView` is:

```text
state                       "not_applicable"|"unavailable"|"available"
projected_completion        CalendarValue|null
forecast_relation           "before_deadline"|"on_deadline"|
                            "after_deadline"|null
signed_margin               CalendarDifference|null
base_unit_margin            RationalValue|null
remaining_margin            RationalValue|null
lateness                    RationalValue|null
assessment                  "lower_bound_on_time"|"lower_bound_late"|
                            "heuristic_on_time"|"heuristic_late"|null
optimal                     boolean|null
conditional_on_blocks_resolved boolean
blocked_task_ids            string[]
unavailable_causes          TemporalCause[]
```

For a task, `destination_relationship.relation` is
`task_deadline_before_milestone`, `same_deadline`,
`task_deadline_after_milestone`, `unavailable`, or `deadline_absent`.

### 8.4 `Perttool.NextResult.v4`

Version 4 retains every NextResult v3 field, while its major-version change
allows `runnable_now` to apply temporal eligibility. The complete
`recommendation` graph remains the same semantic projection of the same base
facts. Version 4 adds:

```text
temporal:
  authority:
    policy                    "recommendation_v1_plus_release_gate"
    recommendation_algorithm {id, version}
    deadline_facts_used_for_ranking false
    time_eligible_task_ids     string[]
    time_ineligible_task_ids   string[]
    time_eligibility_unavailable_task_ids string[]
    startable_recommended_task_ids string[]
    delayed_recommended_task_ids   string[]
    unavailable_recommended_task_ids string[]
  tasks:
    [{task_id,
      declared_not_before,
      time_eligibility,
      task_deadline,
      destination_milestone_id,
      destination_deadline,
      precedence_start,
      precedence_finish,
      resource_start,
      resource_finish,
      task_deadline_evaluation,
      destination_deadline_evaluation}]
```

`time_eligibility` is:

```text
state                       "eligible"|"not_yet_eligible"|
                            "not_applicable"|"unavailable"
release_bound               RationalValue|null
explanation:
  code                      "no_not_before"|"not_before_reached"|
                            "not_before_future"|"task_already_started"|
                            "temporal_eligibility_unavailable"
  fact_ids                  string[]
facts                       [{id, kind, value, entity_refs}]
unavailable_causes          TemporalCause[]
```

This explanation is a temporal-execution explanation, not a new Recommendation
Reason Taxonomy fact or decision-trace node. `groups.ready` remains
structural. `groups.runnable_now` excludes a ready task whose time eligibility
is not `eligible` and the temporal task record returns the rejection distinct
from `tasks[].resource_rejections`.

Recommendation algorithm version 1, interface version 1, Ranking Policy
version 1, Reason Taxonomy version 1.0, and explanation contracts do not use
deadline or `not_before` facts. Therefore raw
`recommendation.recommended_task_ids` is preference output, not sufficient
start authority in NextResult v4. Automation starts only IDs in
`startable_recommended_task_ids`. An unavailable release relationship fails
closed into `unavailable_recommended_task_ids`.

For a version 1 document, every structurally ready task is time-eligible and
`startable_recommended_task_ids` equals the existing recommended set.

### 8.5 `Perttool.UnitMigrationResult.v1`

The result retains the common document envelope and mutation candidate fields:

```text
unit_migration             {id, version}
source_unit                "day"|"hour"|"point"|null
target_unit                "day"|"hour"|"point"
effective_velocity         Velocity|null
velocity_disposition       "retained"|"replaced"|"inserted"|null
changed                    boolean
converted_fields:
  [{entity_kind, entity_id, field_path,
    original, converted, canonical_token}]
reversibility              "exact"|"values_exact_metadata_changed"|
                           "not_applicable"
qualifications             string[]
unavailable_causes         MigrationCause[]
original_digest            string
updated_digest             string|null
updated_text               string|null
diff                       string|null
edits                      TextEdit[]
write                      {mode, target, written}
```

`original` and `converted` are exact `{numerator, denominator, unit}` records.
`MigrationCause` has semantic `cause`, public `diagnostic_code`, and affected
field paths. Failures expose no candidate, updated digest, diff, or edits.

## 9. Text projections

Text is human-facing; JSON is the machine contract. Contract 4 fixes these
section and label additions:

- `document check` appends
  `temporal=milestone_deadlines:<N>,task_not_before:<N>,task_deadlines:<N>` to
  the one-line success summary.
- `project show` renders tagged `AS_OF` and `FINISH_DEADLINE` values in that
  order; absent values are `-`.
- `dag analyze` retains all base sections, then renders
  `TEMPORAL PRECEDENCE`, `TEMPORAL RESOURCE`, and `DEADLINES`.
- `dag next` begins with `START AUTHORITY`, retains the existing task sections,
  and ends with `TEMPORAL CONTEXT`. It labels deadline facts
  `INFORMATIONAL FOR RANKING v1`.
- `project migrate-unit` uses the ordinary candidate preview and diff streams.
  Its stderr preview summary is
  `PREVIEW project.migrate-unit changed=<boolean> source_unit=<unit> target_unit=<unit> original_digest=<digest> updated_digest=<digest>`.

Every unavailable row prints its exact cause. Resource temporal headings
include algorithm/version and `optimal=false`; conditional block assumptions
remain visible.

## 10. Help and diagnostics

### 10.1 Registry coverage

Command help must expose the complete `project migrate-unit` descriptor and
every new temporal option. The Guide registry adds:

| Topic | Required content |
| --- | --- |
| `syntax.temporal` | grammar v2 fields, explicit anchor, date/date-time distinction |
| `analysis.temporal` | separate precedence/resource projections, deadline states, unavailable causes |
| `editing.unit-migration` | exact directions, replacement velocity, preview/write, batch exclusion, reversibility |

Existing `syntax.project`, `syntax.task`, `syntax.milestone`, `analysis`,
`next`, and `editing` topics link to these nodes. Command help remains
descriptor-driven and does not duplicate domain explanations.

README and package examples change only at Contract 4 cutover. Before cutover
they must not advertise unavailable commands or fields.

### 10.2 Temporal diagnostic

| Code | Meaning | Guide topic |
| --- | --- | --- |
| `PTSEM-112` | A v2 `deadline` or `not_before` exists without `project.as_of` | `syntax.temporal` |

Calendar and deadline unavailability in a valid document is result data, not
a diagnostic or exit 1. Invalid literals retain `PTDSL-008`.

### 10.3 Migration diagnostics

| Code | Semantic cause |
| --- | --- |
| `PTMIG-401` | `invalid_original` |
| `PTMIG-402` | `invalid_replacement_velocity` |
| `PTMIG-403` | `missing_velocity` |
| `PTMIG-404` | `unsupported_direction` |
| `PTMIG-405` | `velocity_period_mismatch` |
| `PTMIG-406` | `same_unit_velocity_change` |
| `PTMIG-407` | `unsupported_duration_field` |
| `PTMIG-408` | `nonrepresentable_decimal` |
| `PTMIG-409` | `invalid_candidate` |

`PTMIG-401` retains all ordinary source diagnostics. `PTMIG-408` identifies
every nonrepresentable field in stable source order. `PTMIG-409` retains
ordinary candidate diagnostics. Request or semantic failures exit 1; usage,
I/O, and write conflicts retain exits 2, 3, and 5.

## 11. Compatibility and authority migration

Contract 4 is one breaking cutover. It has no `--cli-contract`,
`--grammar-version`, legacy schema switch, or compatibility alias.

Before activation, implementation must:

1. parse and format grammar versions 1 and 2 without widening version 1;
2. publish all new Core and JSON types together;
3. update command descriptors, dispatch, text help, JSON help, Guide, README,
   installed-package E2E, and schemas together;
4. preserve base Analysis v2 and Recommendation v1 semantic results inside
   the new result envelopes;
5. add shadow comparison showing that the embedded v3 recommendation graph is
   unchanged for the same base facts;
6. update agent guidance and self-use policy to require a complete,
   non-truncated NextResult v4 and use
   `startable_recommended_task_ids` for start authority;
7. update override validation so no override can bypass an unavailable or
   future `not_before`; and
8. run an unknown-schema safe-stop exercise before adopting v4 as authority.

Until all eight conditions are accepted, a complete
`Perttool.NextResult.v3` remains the normal task-selection authority and no
NextResult v4 is authoritative. Merely implementing or emitting v4 does not
authorize self-use.

Deadline-aware ranking remains outside this contract. It requires the
coordinated algorithm, taxonomy, explanation, and result changes listed in
Temporal Deadline Semantics.

## 12. Normative acceptance cases

| ID | Required observation |
| --- | --- |
| TUI-001 | Grammar v1 rejects temporal fields and otherwise retains byte-compatible validation; grammar v2 accepts exactly the three added fields. |
| TUI-002 | Grammar v2 requires an explicit `as_of` for temporal fields, accepts mixed kinds as valid-but-unavailable, and never reads a clock or host zone. |
| TUI-003 | Parser, formatter, mutations, batch, Guide, and diagnostics use one canonical temporal field inventory and order. |
| TUI-004 | CheckResult v2 and ProjectResult v2 expose declared temporal inputs without adding fields to their previous schema identities. |
| TUI-005 | AnalysisResult v3 preserves base AnalysisResult v2 and returns separate, versioned precedence/resource temporal views with exact values and causes. |
| TUI-006 | Deadline evaluations distinguish absent, complete-history-unavailable, unavailable, conditional, and available states and preserve heuristic qualification. |
| TUI-007 | NextResult v4 retains the complete v3 recommendation graph, does not rank by temporal facts, and separates raw preference from time-gated start authority. |
| TUI-008 | A future or unavailable `not_before` removes a ready task from `runnable_now` and start authority without reclassifying it as blocked. |
| TUI-009 | Task and milestone temporal add/set/clear operations are source-preserving and final-candidate validated. |
| TUI-010 | One batch can upgrade or downgrade grammar and temporal fields without validating invalid intermediate states. |
| TUI-011 | `project migrate-unit` alone owns automatic migration guarantees and is rejected as a batch member. |
| TUI-012 | UnitMigrationResult v1 exposes exact converted fields, velocity disposition, reversibility, candidate data, and every stable failure cause. |
| TUI-013 | Preview, diff, write, out, digest, race, symlink, and post-write behavior is identical across temporal mutation and unit migration. |
| TUI-014 | The Contract 4 descriptor registry exactly matches dispatch, accepted options, text/JSON help, effects, schemas, exits, and examples. |
| TUI-015 | Guide topics cover syntax, analysis, next-task authority, and migration recovery without conflating command discovery. |
| TUI-016 | Text and JSON derive from the same Core results and expose every unavailable cause, block condition, and non-optimal scheduler identity. |
| TUI-017 | Grammar v2 unit migration preserves every absolute temporal token and supports exact inverse source values under migration version 1. |
| TUI-018 | Contract 4 activation, NextResult v4 authority adoption, and package publication remain separately gated and fail closed for unknown or incomplete results. |
