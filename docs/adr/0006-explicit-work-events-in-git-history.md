# ADR 0006: Record explicit work events in the pre-advance Git history

- Status: Accepted
- Date: 2026-07-28
- Related requirements: [Project actuals requirements](../requirements.md#78-project-actuals-and-work-lifecycle)
- Related specification: [Project Actuals and Git History Contract](../specs/project-actuals.md)

## Context

The current `.pert` document represents the present work boundary and its
unfinished future. A completed task can remain as `done` only while it is
needed to determine the frontier, and `dag advance` later removes that
historical subgraph. The self-use procedure therefore commits the exact
pre-advance snapshot before advancing it.

Git can show when a status-changing snapshot was recorded, but a commit
timestamp does not prove when work actually started, stopped, resumed, or
finished. It also cannot recover person effort, active execution time, or the
operator's intended event time. Inferring these values would turn repository
mechanics into unsupported project facts.

Permanent work history inside the live graph would conflict with the
present-and-future document boundary. A separate append-only history file would
avoid that conflict, but one `task finish` operation would then need to update
two files atomically. The existing safe-write contract provides atomic
replacement for one source document and does not provide a recoverable
multi-file transaction.

## Decision

- Introduce versioned, explicit work events associated with stable task IDs.
  The first event kinds are `start`, `suspend`, `resume`, and `finish`.
- Use the Grammar 5 top-level `work_event` declaration and keep its ID in the
  global document namespace without making the record a graph edge.
- Retain work events in the same `.pert` source as their task until the task is
  removed by `dag advance`. The source mutation and task-state transition are
  therefore one previewable, source-preserving, atomically writable candidate.
- Treat work events as operational evidence, not graph edges. They do not
  create precedence, gates, resource requirements, or recommendation priority.
- Require an explicit fixed-offset event time. Core operations never read the
  wall clock. Git author and committer timestamps are recording metadata only;
  they are never substituted for an event time.
- Keep `blocked` and `suspended` distinct. `blocked` means work cannot progress
  because of an external condition. `suspended` means execution was
  intentionally paused and its renewable resources are released.
- Let `dag advance` remove work events owned by a removed task. The exact
  pre-advance snapshot remains the durable source record and is protected by
  the existing self-use commit procedure and the planned `ADV-001` history
  guard.
- Add a read-only, first-parent Git history adapter that reconstructs explicit
  work events and legacy task-state transitions for one repository-relative
  plan path. Legacy transitions remain qualified as Git-recorded facts and are
  not promoted to actual event times.
- Derive observations such as cycle time, active time, completed planned
  Points, elapsed-hour throughput, active-date throughput, and effort
  productivity only when their required evidence is complete. Unknown values
  remain unknown.
- Report observed velocity separately from the declared project velocity.
  Observation never rewrites `project.velocity`; adopting a suggested value is
  a later explicit preview-first project mutation.
- Report legacy Git-recorded throughput as a separate qualified candidate. It
  is never labeled actual and has no direct velocity-adoption token.
- Keep Git inspection read-only. The feature never stages, commits, rebases,
  checks out, resets, or otherwise changes repository state.

## Consequences

- The source grammar, formatter, semantic validator, mutation model, advance
  model, result schemas, command registry, help, and installed workflow require
  one coordinated breaking contract. Grammar versions 1 through 4 and CLI
  Contract 5 remain unchanged until that cutover is accepted.
- Grammar 5, CLI Contract 6, actuals model 1, history model 1, and velocity
  observation model 1 fix that target boundary before implementation.
- A task can carry several event records, so event identity, ordering,
  transition validity, idempotence, and correction behavior must be normative
  rather than inferred from source order.
- `suspended` adds a stored task state and a derived next-task group. It does
  not silently reuse `blocked` or `planned`, and it requires versioned graph,
  analysis, recommendation, and public-result handling.
- A standalone eventful finish remains possible for migrated or partially
  observed work, but its history coverage is explicitly `finish_only`; cycle
  and active time are unavailable unless separately supported by evidence.
- Event records disappear from the current source after advance, so the Git
  reader is necessary for project-wide historical reporting. A repository
  without adequate history can still check, analyze, and mutate the current
  plan, but its history result is unavailable or explicitly incomplete.
- Post-advance correction, arbitrary branch-union history, payroll or billing
  semantics, business calendars, and automatic velocity adoption remain
  outside the first contract.

## Rejected alternatives

### Treat commit time as completion time

Rejected because a commit may be delayed, rebased, authored elsewhere, or
contain several changes. It proves only when Git recorded a snapshot under a
particular history.

### Keep all completed tasks and actuals permanently in `.pert`

Rejected because it would mix an unbounded historical ledger into the current
AoA graph and reverse the accepted advance model.

### Write an append-only sidecar during every lifecycle mutation

Rejected for the first contract because the current safe-write boundary cannot
atomically commit both the plan and a companion ledger. A later durable ledger
may be designed with an explicit transaction and recovery protocol.

### Infer effort from elapsed or resource allocation

Rejected because elapsed time, active time, renewable-resource units, and
person effort have different meanings. Effort is an explicit observation.
