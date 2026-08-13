# Normative Project Actuals Examples

- Status: Normative examples 1.0
- Contract: [Project Actuals and Git History Contract](../specs/project-actuals.md)

These examples define semantic outcomes for active Grammar 5 and CLI
Contract 6. The corresponding machine-readable dependency matrix is
[`project-actuals-contract-v1.json`](../../test/fixtures/project-actuals-contract-v1.json).
The Contract 6 parser accepts these source records atomically; Grammar 1
through 4 continue to reject their contextual Grammar 5 spellings.

The canonical complete sequence has this source shape:

```pert
project ACTUALS_SAMPLE:
  version 5
  title "Actuals sample"
  as_of 2026-07-28
  duration_unit point
  velocity 4p/1d
  finish DONE

milestone NOW:
  title "Current boundary"
  state reached

milestone DONE:
  title "Finished"

task WORK NOW -> DONE:
  title "Implement work"
  duration 4p
  status done

work_event WE-start:
  model 1
  task WORK
  kind start
  occurred_at 2026-07-28T09:00:00+09:00
  planned_value 4p

work_event WE-suspend:
  model 1
  task WORK
  kind suspend
  occurred_at 2026-07-28T11:00:00+09:00
  reason "Review interruption"

work_event WE-resume:
  model 1
  task WORK
  kind resume
  occurred_at 2026-07-28T13:00:00+09:00

work_event WE-finish:
  model 1
  task WORK
  kind finish
  occurred_at 2026-07-28T17:00:00+09:00
  active_time 6h
  effort 8ph
```

The canonical lifecycle command shape is:

```text
perttool task start plan.pert WORK --at 2026-07-28T09:00:00+09:00
perttool task suspend plan.pert WORK --at 2026-07-28T11:00:00+09:00 --reason "Review interruption"
perttool task resume plan.pert WORK --at 2026-07-28T13:00:00+09:00
perttool task finish plan.pert WORK --at 2026-07-28T17:00:00+09:00 --active-time 6 --effort 8
perttool project history plan.pert --task WORK --format json
perttool project observe-velocity plan.pert --task WORK --evidence declared --format json
```

## PACT-001: Eventful finish is atomic

Given an active task and an eventful finish request at
`2026-07-28T18:00:00+09:00`, the candidate contains both `status done` and one
matching finish event. Candidate validation failure exposes neither half and a
write persists neither half.

## PACT-002: Explicit time only

A lifecycle request without `--at` fails at the request boundary. The Core does
not read the wall clock. Git author and committer times remain recording
provenance and do not fill the missing event time.

## PACT-003: Complete sequence

For start at `09:00`, suspend at `11:00`, resume at `13:00`, and finish at
`17:00`, all with offset `+09:00`, cycle time is eight hours and derived active
time is six hours. Coverage is `complete`.

## PACT-004: Standalone finish

A planned task may be finished with an explicit finish event for compatibility.
Coverage is `finish_only`; actual start, cycle time, and derived active time
are unavailable. An explicit effort value remains usable as effort evidence.

## PACT-005: Suspended is not blocked

Suspending an active task changes it to `suspended` and releases its renewable
resources. It is not ready, active, blocked, or startable-recommended. Resuming
it changes it to active and appends a resume event without creating a new AoA
edge.

## PACT-006: Idempotent retry and identity conflict

Repeating the same task, kind, canonical event time, and payload derives the
same event ID and is a no-op once state already matches. Reusing that ID with a
different event time, effort, or task fails as an identity conflict.

## PACT-007: Advance ownership

When advance removes a done task, it removes that task's work events and no
events belonging to retained tasks. The pre-advance source is committed first.
History reconstruction emits each removed event once and records the removal
commit separately.

## PACT-008: Legacy Git evidence

A legacy commit that changes `status active` to `status done` yields a
`git_recorded_transition`. Its commit time may appear as `recorded_at`, but
actual finish, cycle time, deadline compliance, and default velocity inclusion
remain unavailable.

## PACT-009: Shallow history

When the requested boundary predates the available shallow history, the result
is incomplete with a stable cause. The reader does not use the earliest
available commit as if it were the project start.

## PACT-010: Parallel throughput

Two 3p tasks both run from `09:00` to `12:00` and finish in the same
observation. Completed Points are 6p and elapsed observation time is 3h, not
6h. Elapsed-hour throughput is therefore `2p/1h`.

## PACT-011: Effort productivity

If the two tasks in PACT-010 declare total effort of 8 person-hours, effort
productivity is `3/4p/1ph`. The result does not infer that eight person-hours
equal eight elapsed hours or one working day.

## PACT-012: Observed velocity is read-only

An observation returns its exact rate, sample IDs, window, coverage, and
qualifiers. The source digest and `project.velocity` remain unchanged. Adoption
requires a separate explicit `project set` preview and write.

## PACT-013: Active-date qualification

Active-date throughput is available only when complete intervals and one
deterministic offset identify the included local dates. Mixed offsets or
incomplete intervals leave this measure unavailable; the implementation does
not silently use a 24-hour day.

## PACT-014: Compatibility boundary

Grammar 1 through 4 reject work-event declarations and `status suspended`.
The published CLI Contract 5 package continues to expose only status-based
task maintenance. The current source exposes commands and conditional result
fields only through the complete Grammar 5/CLI Contract 6 boundary.

## ACT003-001: Current declared observation correction

Given an active task whose start event is committed, `task finish --write`
adds a valid finish event without committing it. A following
`project observe-velocity --evidence declared` includes that finish, binds the
top-level `source_digest` to the current operand, and leaves
`history.source_digest` bound to the selected commit. `git-recorded` continues
to use only the selected revision, while `all` returns the current declared
and revision-bound recorded candidates separately. None of the three
observations changes the plan bytes, index, `HEAD`, or declared velocity.
