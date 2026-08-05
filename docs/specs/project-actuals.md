# Project Actuals and Git History Contract

- Status: Normative 1.0
- Actuals model: 1
- History model: 1
- Velocity observation model: 1
- Contract grammar version: 5
- Contract CLI version: 6
- Compatibility boundary: Grammar 1/2/3/4 semantics remain available; the
  published `0.4.0` package remains CLI Contract 5

## 1. Scope

This specification defines the selected post-beta design for:

- explicit task work events;
- atomic lifecycle state/event mutations;
- temporary source retention and `dag advance` ownership;
- read-only reconstruction from Git history;
- task and project actual summaries; and
- observed throughput and effort productivity.

Grammar 5 and CLI Contract 6 activated this contract atomically. The active
Grammar 6 and CLI Contract 7 source retains its behavior and adds conditional
plan assurance without redefining actuals. The independent
[`project-actuals.pert`](../../plans/project-actuals.pert) workstream retains
the contract review and implementation evidence; package publication remains
a separate release boundary. The review is recorded in
[`project-actuals-contract-review.md`](../process/project-actuals-contract-review.md).

## 2. Normative language

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative.

An **actual event time** is an explicit value supplied for a work event. A
**recorded time** is metadata from Git or another storage boundary. Recorded
time is never an actual event time.

## 3. Invariants

1. The current AoA graph remains the source of truth for the present boundary
   and unfinished work.
2. A work event is evidence associated with a task; it is not an AoA edge.
3. A lifecycle command updates task state and appends its event in one source
   candidate. It MUST NOT expose or persist only one half.
4. Core behavior is deterministic from the source, explicit request, and
   versioned algorithms. It MUST NOT read the system clock.
5. Missing actual evidence remains unknown. `as_of`, projected schedules, task
   status, and Git timestamps MUST NOT fill it.
6. Git access is optional for current-document check, analysis,
   recommendation, formatting, and mutation preview.
7. History inspection is read-only and MUST NOT change Git or source state.
8. Declared project velocity and observed velocity are distinct facts.
9. Exact Rational values, not binary floating point, are the source of truth
   for active time, effort, Points, and derived rates.

## 4. Work event model

### 4.1 Event identity and fields

Work event model 1 has the following semantic fields.

| Field | Presence | Meaning |
| --- | --- | --- |
| `id` | required | Stable event ID unique in the document and historical stream |
| `task_id` | required | Stable ID of the owning task |
| `kind` | required | `start`, `suspend`, `resume`, or `finish` |
| `occurred_at` | required | Fixed-offset ISO date-time for the actual event |
| `reason` | optional | Human explanation, primarily for suspension |
| `planned_value` | generated on `start` | Exact task expected value and project base unit at first start |
| `active_time` | optional | Explicit non-negative active execution hours |
| `effort` | optional | Explicit non-negative person-hours |

`active_time` and `effort` are separate exact quantities. Neither is inferred
from the other or from declared resource units. Their lexical form and
canonical serialization are fixed by Grammar 5 in the
[DSL Grammar specification](dsl-grammar.md).

`planned_value` occurs only on `start` and is generated from the validated task
rather than accepted as an independent CLI estimate. `active_time` and
`effort` occur only on `finish` in model 1. A reason is permitted on
`suspend`; other event kinds do not acquire hidden reason semantics.

The source representation is the Grammar 5 top-level `work_event` declaration
in the same `.pert` document. Its exact EBNF, contextual keywords, field
matrix, canonical order, version upgrade, and comment ownership are fixed by
the [DSL Grammar specification](dsl-grammar.md). Implementations MUST NOT add
aliases or accept a looser event shape.

### 4.2 Time

- `occurred_at` MUST be a date-time with an explicit numeric UTC offset.
- Date-only event values, local date-times without an offset, named time zones,
  and values obtained implicitly from the process clock are invalid.
- Comparisons use the represented instant. The original offset and accepted
  precision remain available for source preservation and projection.
- Equal instants use the kind and event-ID order in Section 5.3 for
  deterministic projection, but an equal-instant ordering MUST NOT
  manufacture positive elapsed time.

### 4.3 Event IDs and idempotence

A CLI request MAY omit an event ID. In that case, the adapter derives:

```text
"WE-" + lowercase_hex(
  sha256(
    utf8(
      "perttool.work-event-id.v1\0"
      + task_id + "\0"
      + kind + "\0"
      + canonical_occurred_at
    )
  )
)
```

`canonical_occurred_at` is the Grammar 5 canonical token and retains its
numeric offset. The full 64-hex digest is used. Optional reason, active-time,
and effort payloads are deliberately not identity inputs: a retry with a
different payload at the same task/kind/time resolves the same ID and exposes
an identity conflict. Repeating an identical request produces the same event
ID and a valid no-op after the target state already matches.

An existing event ID with a different payload is a conflict. Random IDs,
process IDs, current time, repository state, or source byte offsets MUST NOT be
implicit identity inputs.

### 4.4 Coverage

Each task summary reports one of:

- `complete`: a valid start-to-finish sequence is present;
- `open`: a valid sequence starts but has not finished;
- `finish_only`: a finish event is present without a preceding start;
- `unrecorded`: no explicit work event is present; or
- `unavailable`: malformed, ambiguous, or insufficient history prevents a
  trustworthy classification.

`finish_only` is valid for compatibility and late adoption. It MUST NOT imply a
start time, cycle time, or derived active time.

## 5. Lifecycle and task state

### 5.1 Stored states

Grammar 5 adds `suspended` to `planned`, `active`, `blocked`, and `done`.

| State | Meaning | Snapshot resource occupancy | New-start recommendation |
| --- | --- | --- | --- |
| `planned` | Not started | none | governed by the existing Next authority |
| `active` | Executing | declared requirements | not applicable |
| `blocked` | Cannot progress because of an external condition | none | excluded |
| `suspended` | Intentionally paused and releasable later | none | excluded |
| `done` | Work condition satisfied | none | not applicable |

`suspended` MUST NOT be normalized to `planned` or `blocked`. Public analysis
and next results require a versioned `suspended` projection before Grammar 5 is
activated.

### 5.2 Transitions

The lifecycle commands have these transitions.

| Command | Accepted source state | Target state | Appended event |
| --- | --- | --- | --- |
| `task start` | `planned` | `active` | `start` |
| `task suspend` | `active` | `suspended` | `suspend` |
| `task resume` | `suspended` | `active` | `resume` |
| eventful `task finish` | any non-`done` state | `done` | `finish` |

`task start`, `task suspend`, and `task resume` require an explicit event time.
An eventful finish requires an explicit event time and MAY include
`active_time` and `effort`. A status-only `task finish` remains available for
Grammar 1 through 4 compatibility and creates no actual event.

`task start` is a state/evidence mutation, not a new recommendation override
mechanism. Agents obey the complete `Perttool.NextResult.v5` authority.
MIG-08 and durable
authorization audit are outside this contract.

### 5.3 Sequence validation

- `start`, `suspend`, and `resume` MUST follow the transition table.
- A complete sequence alternates active and suspended intervals and ends once.
- A repeated identical event is a no-op. A second distinct finish is invalid in
  model 1.
- A finish from `planned` or `blocked` is permitted for compatibility and
  yields `finish_only` unless a valid earlier start sequence exists.
- A finish from `suspended` closes the open suspension interval at the finish
  instant. A finish from `active` closes the active interval.
- Event reduction and stored task state MUST agree when explicit coverage is
  `complete` or `open`: an unfinished sequence ending in start/resume is
  `active`, one ending in suspend is `suspended`, and a finished sequence is
  `done`.
- Source order is preserved for editing. Semantic order uses event instant,
  then `start`, `suspend`, `resume`, `finish` kind order, then event ID.
  More than one distinct event of the same kind for one task at the same
  instant is invalid. Equal-instant transitions contribute zero elapsed time.

### 5.4 Direct status maintenance

Grammar 1 through 4 retain every status-only mutation. In Grammar 5:

- a task with no work event remains a legacy task and may use `task set` for
  `planned`, `active`, `blocked`, or `done`;
- `task set` never accepts `suspended`;
- after a task has any work event, direct status changes are rejected and the
  lifecycle commands are required;
- status-only `task finish` is rejected for Grammar 5; and
- an eventful task cannot enter `blocked` in model 1. The caller uses
  `suspend --reason` for an evidenced pause, or retains a legacy no-event task
  when only the old blocked model is required.

These rules prevent state edits from opening or closing an execution interval
without evidence. They do not change the meaning of an untouched legacy task.

## 6. Actual measurements

### 6.1 Task measurements

When evidence permits, history model 1 returns:

- first actual start;
- last actual finish;
- suspension intervals;
- cycle time from first start to finish;
- derived active time excluding valid suspended intervals;
- explicit active time, when supplied;
- explicit effort;
- planned base-unit value captured for the observation; and
- evidence and coverage qualifiers.

If both a complete event sequence and explicit `active_time` are present, they
MUST agree exactly. Otherwise the candidate is invalid. Effort is never
derived.

### 6.2 Planned-value baseline

The first `start` event captures the task's exact expected value in the project
base unit as its observation baseline. For a fixed duration this is the exact
duration. For a three-point estimate it is the exact PERT expected value.

A `finish_only` sample MAY use the exact task value in the last committed
pre-advance snapshot, but it is qualified as `finish_snapshot`, not
`start_baseline`. History output exposes the baseline source so estimate
changes cannot silently inflate observed throughput.

An eventless task with a Git-recorded transition to `done` MAY likewise retain
the exact task value from that transition's committed snapshot as a
`finish_snapshot` baseline. It remains `git_recorded_transition` evidence,
has no baseline event ID, and participates only in the separately qualified
Git-recorded candidate. Commit time and the snapshot baseline do not turn it
into declared actual evidence.

### 6.3 Project observations

Velocity observation model 1 provides separate measures.

| Measure | Numerator | Denominator | Meaning |
| --- | --- | --- | --- |
| elapsed-hour throughput | completed baseline Points | exact observation hours | schedule throughput |
| active-date throughput | completed baseline Points | distinct evidenced active local dates | operational Point/day sample |
| effort productivity | completed baseline Points | explicit person-hours | Point/person-hour productivity |

For declared evidence, the elapsed observation window begins at the earliest
included first start and ends at the latest included explicit finish. Only
`complete` tasks participate in elapsed-hour or active-date throughput.
Parallel task cycle times are not summed to form either denominator.

Elapsed-hour throughput is available when the selected explicit timestamps
define a positive exact instant interval. Active-date throughput is available
only when a deterministic common offset and complete active intervals permit
the included local dates to be enumerated. The contract MUST NOT silently
equate one day with 24 hours. Effort productivity is available only from
explicit effort.

### 6.4 Declared velocity

Observation returns `observed_velocity` candidates with:

- algorithm and model version;
- included and excluded task/event IDs;
- exact numerator and denominator;
- unit and qualifier;
- observation bounds;
- baseline provenance;
- coverage counts; and
- unavailability causes.

It does not mutate `project.velocity`. A declared elapsed-hour or active-date
candidate includes a reduced exact `adoptable_velocity_token` in existing
`Pp/Th` or `Pp/Td` syntax. An effort-productivity or Git-recorded candidate
has a null token. A later caller may use an explicit preview-first
`project set` request to adopt a selected compatible value.
Automatic adoption, silent rolling-window selection, confidence claims, and
team/resource statistical models are outside version 1.

## 7. Source retention and advance

- Work events remain with their owning task while that task remains in the
  current source.
- Work events do not affect reached closure, finish reachability, CPM, or
  resource-schedule duration.
- `dag advance` owns and removes every work event associated with a removed
  task. It reports the removed task and event IDs.
- A work event whose task is absent from the current document is invalid.
- The existing procedure commits the exact done/eventful pre-advance snapshot
  before the advance write.
- `ADV-001` and project history share one read-only Git adapter, repository/path
  resolution, HEAD identity, and race-safe inspection boundary. They remain
  separate application decisions: history reads evidence, while `ADV-001`
  guards a destructive write.
- The exact `ADV-001` destructive-record, `HEAD` and stage-0 index proof,
  retained-dirty, force, result, and diagnostic rules are owned by the
  [Advance History Safety Contract](advance-history-safety.md). This contract
  continues to own event and declaration source retention, not the write
  guard's public interface.

Post-advance correction is outside model 1. The history result reports this
limitation rather than suggesting that Git history was rewritten.

## 8. Git history reconstruction

### 8.1 Baseline

The default history query uses:

- the repository containing the target path;
- the repository-relative target path;
- `HEAD`;
- first-parent traversal; and
- semantic document snapshots in commit order.

The result binds repository identity, path, requested and resolved revision,
commit IDs, source digests, and parser/model versions. A caller may select an
explicit revision. The adapter never searches reflogs or unreachable objects.

### 8.2 Evidence classes

History emits two distinct evidence classes.

1. `declared_actual`: an explicit work event and its actual event time.
2. `git_recorded_transition`: a legacy task-state or source transition and the
   commit where it was recorded.

A commit author or committer time may be returned as `recorded_at` provenance.
It MUST NOT populate `occurred_at`, actual start/finish, cycle time, active
time, deadline compliance, or default velocity samples.

Legacy evidence MAY be included in an observation only through an explicit
option. Such a result is qualified, remains separate from declared actuals,
and is never labeled actual completion.

### 8.3 Deduplication and removal

The reader identifies explicit events by stable event ID. It retains the last
committed payload before the event disappears through advance and emits the
associated removal commit as provenance. The same event visible in many
snapshots is one event, not many.

A changed payload under the same event ID is a conflict. History model 1 does
not reinterpret it as a correction, even before advance. The result retains
the conflicting commit IDs and no selected payload for that event.

### 8.4 Incomplete or ambiguous history

History is `incomplete` or `unavailable`, with stable causes, for at least:

- a shallow repository that omits the requested boundary;
- no repository or no `HEAD`;
- an untracked target at the selected revision;
- ambiguous repository-relative path resolution;
- a task-ID replacement that cannot preserve identity;
- a rename or non-first-parent branch union not supported by history model 1;
- a source version unsupported by the installed parser; or
- conflicting event identity.

The command MUST NOT guess across these conditions. Current-document
operations remain available.

## 9. Target Core and CLI

### 9.1 Pure Core requests

The accepted public request boundary is:

```ts
type WorkEventKind = "start" | "suspend" | "resume" | "finish";

interface LifecycleEventInput {
  readonly id?: string;
  readonly occurredAt: string;
  readonly reason?: string;
  readonly activeTime?: string;
  readonly effort?: string;
}

type LifecycleMutation =
  | { readonly kind: "task.start"; readonly taskId: string;
      readonly event: LifecycleEventInput }
  | { readonly kind: "task.suspend"; readonly taskId: string;
      readonly event: LifecycleEventInput }
  | { readonly kind: "task.resume"; readonly taskId: string;
      readonly event: LifecycleEventInput }
  | { readonly kind: "task.finish.actual"; readonly taskId: string;
      readonly event: LifecycleEventInput };

planLifecycleMutation(
  text: string,
  request: LifecycleMutation,
  options?: MutationOptions,
): MutationResultV3;
```

The planner receives text and explicit input only. It validates request
shape, derives or validates the event ID, computes the start
`planned_value`, produces the state edit and event insertion as one candidate,
revalidates that candidate, and then composes the existing governance
decision. It does not read a path, clock, Git repository, or prior Next
result.

The history boundary separates adapter evidence from pure reduction:

```ts
inspectProjectHistory(
  snapshots: readonly PlanRevisionSnapshot[],
  request: HistoryRequest,
): ProjectHistoryResultV1;

observeProjectVelocity(
  history: ProjectHistoryResultV1,
  request: VelocityObservationRequest,
): VelocityObservationResultV1;
```

`HistoryRequest` contains an optional exact task-ID set. The adapter request
additionally contains a target path and optional revision. A velocity request
contains an optional task-ID set and
`evidence="declared"|"git_recorded"|"all"`. Omitted task IDs select every
recoverable task; omitted evidence selects `declared`. Request arrays reject
duplicates and are projected in ASCII task-ID order.

### 9.2 CLI surface

The public surfaces are:

```text
perttool task start <file> <task-id> --at <date-time> [--event-id <id>]
perttool task suspend <file> <task-id> --at <date-time>
  [--event-id <id>] [--reason <text>]
perttool task resume <file> <task-id> --at <date-time> [--event-id <id>]
perttool task finish <file> <task-id> --at <date-time> \
  [--event-id <id>] [--active-time <hours>] [--effort <person-hours>]
perttool project history <file> [--rev <revision>] [--task <task-id>]...
perttool project observe-velocity <file> [--rev <revision>]
  [--task <task-id>]...
  [--evidence declared|git-recorded|all]
```

`--at` is a Grammar 5 `EventDateTimeV5`. `--active-time` accepts an exact
Decimal-or-Fraction hour quantity with optional `h`; the normalized request
always includes `h`. `--effort` similarly accepts a `ph` quantity and requires
the suffix when supplied through JSON. CLI text accepts the suffix-free
number for these two named options and projects the canonical source suffix.
Repeated `--task`, repeated `--event-id`, or a duplicate selected task is a
usage error.

Lifecycle commands have the common preview/diff/write, diagnostics, JSON,
color, governance assertion, and expected-digest options from Contract 5.
History commands are read-only, require an on-disk regular file, do not accept
stdin or write options, and expose common diagnostics, precision, JSON, and
color options. The revision is an opaque nonempty Git revision spelling; an
unknown revision is a domain result, while a missing option value is usage.

All lifecycle mutations are preview-first and compose the active source digest,
governance decision, candidate validation, optimistic lock, symlink/race
rejection, and atomic safe-write controls. Adding the new source and command
surface requires an atomic Grammar 5/CLI Contract 6 activation; earlier
grammar and CLI contracts do not gain conditional fields or aliases.

### 9.3 Contract 6 result identities

Every Contract 6 JSON envelope has `cli_contract_version=6`. The atomic
cutover selects:

| Operation family | Contract 5 schema | Contract 6 schema |
| --- | --- | --- |
| check | `Perttool.CheckResult.v2` | `Perttool.CheckResult.v3` |
| project show | `Perttool.ProjectResult.v3` | unchanged v3 |
| analysis | `Perttool.AnalysisResult.v3` | `Perttool.AnalysisResult.v4` |
| next | `Perttool.NextResult.v4` | `Perttool.NextResult.v5` |
| direct, lifecycle, batch, and initial-cutover advance | `Perttool.MutationResult.v2` | `Perttool.MutationResult.v3` |
| unit migration | `Perttool.UnitMigrationResult.v2` | `Perttool.UnitMigrationResult.v3` |
| history | absent | `Perttool.ProjectHistoryResult.v1` |
| velocity observation | absent | `Perttool.VelocityObservationResult.v1` |

Format, init, command-help, Guide, agent-guidance, and conversion schemas
remain at their existing major versions because their payload shapes do not
change. Their envelopes still identify CLI Contract 6.

The later ADV-001 runtime activation retains CLI Contract 6 and changes only
`dag advance` to `Perttool.AdvanceResult.v1`. That closed result preserves the
MutationResult v3 candidate, write, governance, lifecycle, and advance fields
and adds the required nullable `history_guard`. Direct, lifecycle, and batch
mutations continue to return `Perttool.MutationResult.v3`; see the
[Advance History Safety Contract](advance-history-safety.md).

`CheckResult.v3` adds:

```text
actuals_inputs:
  model_version  1
  events:
    [{id, task_id, kind, occurred_at, planned_value,
      active_time, effort, reason}]
```

`occurred_at` uses `CalendarValue`; the three exact quantities use:

```text
ActualQuantity:
  numerator    signed decimal integer string
  denominator  positive decimal integer string
  unit         "day"|"hour"|"point"|"person_hour"
  display      decimal string
```

`AnalysisResult.v4` adds task actual coverage,
`suspended_task_ids`, and `conditional_on_suspensions_resumed` to precedence,
resource, and temporal schedule views without changing CPM edge durations.
When the set is nonempty, both schedules are explicitly conditional on those
tasks resuming at relative time zero; no resume time is inferred.
`NextResult.v5` adds
`groups.suspended`, permits `classification="suspended"`, and excludes those
IDs from ready, runnable, blocked, upcoming, raw recommendation, and temporal
start authority. Recommendation algorithm 1, interface 1, reason taxonomy
1.0, explanation model 1, locale `en`, and temporal policy
`recommendation_v1_plus_release_gate` remain unchanged.

`MutationResult.v3` retains all v2 fields and adds:

```text
lifecycle:
  null | {
    model_version,
    task_id,
    from_state,
    to_state,
    event,
    coverage
  }
```

It is non-null only for the four lifecycle operations. Ordinary mutations and
status-only Grammar 1 through 4 finish return null. `dag advance` additionally
returns `advance.removed_work_event_ids` in event-ID order.

`UnitMigrationResult.v3` adds `work_event` to converted-field entity kinds,
accepts Grammar 5, and identifies `planned_value` paths. Its unit-migration
algorithm version is 3; Grammar 1 through 4 behavior remains exact and
otherwise unchanged.

### 9.4 `Perttool.ProjectHistoryResult.v1`

The history result retains the common document envelope and adds:

```text
history:
  id                  "perttool.project-history"
  version             1
  status              "complete"|"incomplete"|"unavailable"
  traversal           "first_parent"
  repository_snapshot_id  "git:<sha1|sha256>:<resolved-commit-id>"|null
  repository_relative_path string|null
  requested_revision  string
  resolved_revision   string|null
  source_digest       string|null
  inspected_commit_ids string[]
  unavailable_causes  HistoryCause[]
events                WorkEventHistory[]
git_recorded_transitions GitRecordedTransition[]
tasks                 TaskActualSummary[]
```

The snapshot ID is not a durable repository UUID. It binds the Git object
format and resolved commit without exposing an absolute path. The
repository-relative path uses `/` separators and never begins with `/` or
contains `..`.

The operation-specific records are:

```text
WorkEventProjection:
  model_version  1
  id             string
  task_id        string
  kind           "start"|"suspend"|"resume"|"finish"
  occurred_at    CalendarValue
  planned_value  ActualQuantity|null
  active_time    ActualQuantity|null
  effort         ActualQuantity|null
  reason         string|null

WorkEventHistory:
  event                  WorkEventProjection
  evidence_class         "declared_actual"
  first_seen_commit_id   string
  last_seen_commit_id    string
  removal_commit_id      string|null
  payload_digest         string

GitRecordedTransition:
  task_id                string
  from_state             "absent"|"planned"|"active"|"blocked"|
                         "suspended"|"done"
  to_state               "absent"|"planned"|"active"|"blocked"|
                         "suspended"|"done"
  commit_id              string
  recorded_at            CalendarValue|null
  source_digest          string
  evidence_class         "git_recorded_transition"

TaskActualSummary:
  task_id                string
  coverage               "complete"|"open"|"finish_only"|
                         "unrecorded"|"unavailable"
  event_ids              string[]
  first_start            CalendarValue|null
  last_finish            CalendarValue|null
  suspension_intervals:
    [{suspend_event_id, resume_event_id, start, finish, duration}]
  cycle_time             ActualQuantity|null
  derived_active_time    ActualQuantity|null
  explicit_active_time   ActualQuantity|null
  effort                 ActualQuantity|null
  planned_value          ActualQuantity|null
  baseline_source        "start_baseline"|"finish_snapshot"|null
  baseline_event_id      string|null
  baseline_commit_id     string|null
  qualifiers             string[]
  unavailable_causes     ActualsCause[]

HistoryCause:
  cause                  "no_repository"|"no_head"|"unknown_revision"|
                         "untracked_target"|"ambiguous_path"|
                         "shallow_boundary"|"unsupported_rename"|
                         "unsupported_source_version"|
                         "task_identity_replaced"|
                         "event_payload_changed"|
                         "duplicate_event_identity"|
                         "head_changed"|"target_changed"
  commit_id              string|null
  task_id                string|null
  event_id               string|null
```

`GitRecordedTransition` deliberately has no `occurred_at`. Every absent
measurement is null with a stable cause rather than a plausible zero.
`ActualsCause.cause` is one of `missing_start`, `missing_finish`,
`open_suspension`, `missing_baseline`, `active_time_absent`,
`effort_absent`, `history_incomplete`, or `history_unavailable`, with nullable
task, event, and commit IDs.

### 9.5 `Perttool.VelocityObservationResult.v1`

The observation result retains the common envelope and adds:

```text
observation:
  id                    "perttool.velocity-observation"
  version               1
  history_model_version 1
  selected_task_ids     string[]
  evidence              "declared"|"git_recorded"|"all"
  candidates            VelocityCandidate[]
```

A candidate contains:

```text
id
measure                  "elapsed_hour_throughput"|
                         "active_date_throughput"|
                         "effort_productivity"|
                         "git_recorded_elapsed_hour_throughput"
evidence_class           "declared_actual"|"git_recorded_transition"
state                    "available"|"unavailable"
numerator                ActualQuantity|null
denominator              ActualQuantity|null
rate                     {numerator, denominator, unit}|null
adoptable_velocity_token string|null
included_task_ids        string[]
excluded                 [{task_id, causes}]
observation_start        CalendarValue|null
observation_finish       CalendarValue|null
baseline_sources         [{task_id, source, event_id, commit_id}]
qualifiers               string[]
unavailable_causes       ObservationCause[]
```

`rate.numerator` and `rate.denominator` are reduced signed and positive
decimal integer strings. Its unit is `point_per_hour`, `point_per_day`, or
`point_per_person_hour`.

`ObservationCause` has nullable task/event/commit IDs and one cause from:

```text
no_selected_tasks
no_complete_sequence
non_positive_window
mixed_offsets
incomplete_active_intervals
missing_effort
missing_baseline
history_incomplete
history_unavailable
git_recorded_start_missing
git_recorded_finish_missing
```

Candidate order is declared elapsed-hour, active-date, effort productivity,
then Git-recorded elapsed-hour. The declared measures never include
Git-recorded transitions. The Git-recorded candidate requires recorded active
and done transitions with a positive exact commit-time interval, is always
qualified `recorded_not_actual`, and never supplies an adoptable token.
`evidence=all` returns separate declared and recorded candidates; it never
mixes their numerators or denominators.

### 9.6 Text projection

History text begins with one `HISTORY` line naming status, revision, path, and
models, then stable `EVENT`, `RECORDED_TRANSITION`, and `TASK_ACTUAL` lines.
Observation text begins with `OBSERVATION`, then one `VELOCITY_CANDIDATE` line
per candidate. A null value is `-`; qualifiers and causes are comma-separated
stable IDs. Text never labels a recorded transition as actual.

### 9.7 Atomic activation

The implementation and package acceptance must version:

- project history;
- velocity observation;
- lifecycle mutation event projection;
- graph/analysis/next handling of `suspended`; and
- structured unavailable/qualification causes.

The Grammar 5 and CLI Contract 6 cutover activated the source parser, root
exports, commands, help, conditional result fields, and installed-package
checks together. The active Grammar 6 and CLI Contract 7 source retains that
atomic boundary. No release or dist-tag mutation follows from source
activation.

## 10. Diagnostics

### 10.1 Actuals and lifecycle

| Code | Message | Stable `data.cause` |
| --- | --- | --- |
| `PTACT-101` | invalid work-event model | `unsupported_event_model` |
| `PTACT-102` | invalid work-event task reference | `missing_task`, `wrong_entity_kind` |
| `PTACT-103` | invalid fields for work-event kind | `missing_field`, `forbidden_field`, `planned_value_mismatch` |
| `PTACT-104` | invalid work-event lifecycle sequence | `invalid_transition`, `duplicate_kind_at_instant`, `event_after_finish`, `state_event_mismatch` |
| `PTACT-105` | invalid lifecycle mutation request | `invalid_request`, `invalid_source_state`, `status_only_finish_not_allowed`, `eventful_task_requires_lifecycle` |
| `PTACT-106` | work-event identity conflicts with an existing payload | `event_identity_conflict` |
| `PTACT-107` | explicit active time differs from the event-derived active time | `active_time_mismatch` |
| `PTACT-108` | lifecycle activation exceeds current resource capacity | `resource_unavailable` |

Source diagnostics use the smallest event field or task status span and
related locations identify the earlier event or occupied active tasks.
Request-only diagnostics have a null span. The diagnostic `entity_id` is the
event ID when known, otherwise the task ID.

### 10.2 Git history

| Code | Severity | Meaning and stable causes |
| --- | --- | --- |
| `PTHIS-101` | error | history unavailable: `no_repository`, `no_head`, `unknown_revision`, `untracked_target`, `ambiguous_path` |
| `PTHIS-102` | warning | history incomplete: `shallow_boundary`, `unsupported_rename`, `unsupported_source_version`, `task_identity_replaced` |
| `PTHIS-103` | error | conflicting event history: `event_payload_changed`, `duplicate_event_identity` |
| `PTHIS-104` | error | repository snapshot changed during inspection: `head_changed`, `target_changed` |

A merge commit is inspected through its first parent and is not itself an
error. Branch-union reconstruction is unsupported and no non-first parent is
searched. Git process startup/read failures use `PTCLI-003`; malformed adapter
output or a violated no-mutation invariant uses `PTIO-502`.

### 10.3 Observation

`PTOBS-101` means `invalid velocity observation selection`, with cause
`duplicate_task`, `unknown_task`, or `unsupported_evidence`. Missing samples,
zero/non-positive windows, mixed offsets, finish-only coverage, and missing
effort are available result records with typed unavailability causes, not
source errors.

Diagnostics MUST:

- identify stable task/event IDs without exposing an absolute repository path;
- distinguish invalid source, unavailable Git, incomplete history, and
  qualified legacy evidence;
- never describe recorded Git time as actual time; and
- preserve existing `PTGOV-*`, digest, and safe-write failures rather than
  replacing them with a generic actuals error.

### 10.4 Exit mapping and priority

Contract 6 adds no numeric exit:

| Exit | Meaning |
| ---: | --- |
| 0 | complete or qualified/incomplete successful read; valid preview/write |
| 1 | source, lifecycle, observation-selection, history-domain, governance, or warning-policy failure |
| 2 | CLI usage error |
| 3 | document or Git process I/O/encoding error |
| 4 | retained strict conversion loss |
| 5 | write conflict or read-snapshot race |
| 70 | internal invariant or adapter-verification failure |

Priority remains `5 > 3 > 4 > 1 > 0` after usage validation. A history
warning exits 0 unless warnings-as-errors is selected. `PTHIS-101`,
`PTHIS-103`, and `PTHIS-104` do not return a trustworthy observation.

## 11. Compatibility and non-goals

### 11.1 Compatibility

- Grammar 1 through 4 reject the Grammar 5 work-event declaration and
  `suspended`.
- CLI Contract 5 retains status-only `task finish` and has no lifecycle,
  history, or observation commands.
- Existing plans require no migration until they opt into Grammar 5.
- Analysis of the same Grammar 1 through 4 source under the same active
  versions remains byte-deterministic.

### 11.2 Non-goals

- automatic Git stage, commit, stash, reset, checkout, rebase, or push;
- a permanent ledger inside the current graph;
- a multi-file sidecar transaction;
- post-advance event correction;
- arbitrary merge, rebase, rename, or branch-union reconstruction;
- payroll, billing, approval, or legal timekeeping;
- business calendars, named time zones, shifts, or attendance;
- inferring effort from resources or elapsed time;
- automatic mutation of project velocity;
- statistical confidence, forecasting-accuracy models, or optimization;
- recommendation override apply, durable authorization audit, or MIG-08; and
- release selection, publication, or dist-tag movement.

## 12. Acceptance matrix

The normative examples use the `PACT-*` case IDs in
[`examples/project-actuals.md`](../examples/project-actuals.md).

The contract review MUST demonstrate:

1. eventful finish and status transition are one candidate;
2. explicit time is required and no clock is read;
3. complete and finish-only coverage remain distinct;
4. active time and person effort remain distinct exact quantities;
5. suspend releases resources and remains distinct from block;
6. identical retry is a no-op and conflicting identity fails;
7. advance removes task-owned events only after the recoverability boundary;
8. explicit events survive reconstruction without snapshot double counting;
9. Git-recorded transitions never become actual event times;
10. incomplete and ambiguous history fail closed or remain qualified;
11. parallel cycle times are not summed for velocity;
12. observed velocity never changes declared velocity; and
13. Grammar 1 through 4 and CLI Contract 5 remain unchanged before cutover,
    and their semantics remain compatible under Contract 6;
14. source EBNF, contextual keywords, exact units, canonical order, event-ID
    derivation, and unit migration are fixed;
15. Core/CLI requests, result identities, complete JSON fields, text order,
    diagnostics, causes, and exits are fixed; and
16. every PACT case has a machine-readable fixture and explicit dependency
    trace.
