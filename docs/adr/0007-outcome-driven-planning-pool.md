# ADR 0007: Model the planning pool as outcome-driven AoA

- Status: Accepted
- Date: 2026-08-24
- Decision owner: user
- Related backlog: [PLAN-POOL-001](../backlog.md#plan-pool-001-add-a-planning-pool-and-bounded-work-windows)
- Related issue: [GitHub Issue #12](https://github.com/mako10k/perttool/issues/12)
- Related decisions: [ADR 0001](0001-activity-on-arrow.md), [ADR 0006](0006-explicit-work-events-in-git-history.md)
- Related specification: [Milestone Outcome Acceptance](../specs/milestone-acceptance.md)

## Context

The strict execution graph models tasks as Activity-on-Arrow edges and requires
every task, gate, and milestone to reach the single `project.finish`. That
model must remain authoritative for execution, schedule, resources,
recommendation, actuals, and completion.

A planning pool needs to retain proposed, unrefined, deferred, or optional
intent without pretending that it is committed execution scope. An
action-first pool would make the proposed Do the stable planning identity. If
its premise or target no longer held, operators and agents could continue the
action merely because it remained in the plan.

The stable planning meaning is instead the intended transition from an
explicit premise condition to an explicit target condition. The selected Do
is a replaceable implementation of that transition.

## Decision

### Outcome-driven planning AoA

The canonical planning-pool topology is a non-executable Activity-on-Arrow
DAG:

```text
Planning Event -- Change Intent --> Planning Event
```

- A **Planning Event** is a node that names an explicit premise, condition, or
  desired outcome.
- A **Change Intent** is an edge that states the intended transition from its
  source Planning Event to its target Planning Event. It is not an executable
  task or a stored instruction to perform one particular action.
- Planning Events and Change Intents have stable project-owned identities.
- The topology is acyclic but may have multiple roots, multiple terminal
  events, and disconnected components.
- Planning Events and Change Intents do not need to reach `project.finish`.
- The planning topology has no PERT/CPM duration, resource schedule, critical
  path, float, task lifecycle, work event, recommendation, or start authority.

### Execution projection

A selected implementation is an explicit projection from the planning model
into the strict execution AoA:

- A Planning Event may be bound to a Milestone that represents its committed
  execution boundary.
- A Change Intent may be realized by a replaceable Task/Gate/Milestone
  subgraph whose boundary Milestones are bound to its source and target
  Planning Events.
- Projection is explicit, governed, previewable, and validated. It is never
  inferred from titles or generated automatically from a planning edge.
- Changing, splitting, merging, or replacing the Task subgraph does not change
  the Change Intent while the committed premise and target remain unchanged.
- Existing Milestones and task-only documents remain valid without Planning
  Event bindings.

Milestone is therefore not an unrelated node kind. It is the execution
projection of a Planning Event when that planning condition enters the
committed execution lifecycle:

```text
proposed Planning Event
  -> committed Milestone projection
  -> reached graph closure
  -> accepted outcome evidence
```

Graph closure and outcome acceptance remain separate facts under the existing
Milestone Outcome Acceptance contract.

### Invalidated premises and withdrawn targets

When a committed premise becomes invalid or a target is withdrawn or
superseded, the corresponding Change Intent and its execution projection
require review. The target contract must withhold automatic promotion and new
start authority until a governed replan resolves that condition.

Invalidation does not automatically delete planned tasks, stop active work,
rewrite actuals, or claim that an outcome failed. Active execution receives an
explicit attention requirement; changing, deferring, or removing its Do is a
separate governed candidate.

### Current-source and Git-history boundary

The planning pool follows the same current-source boundary as the execution
graph:

- The canonical `.pert` source contains only the latest planning and execution
  state plus unfinished future intent. It is not an append-only planning
  ledger.
- Replaced premise text, prior outcome-criterion revisions, superseded Change
  Intents, retired projections, and other former source states are recovered
  from Git history rather than accumulated in the current document.
- A command that refreshes, replaces, supersedes, contracts, or advances the
  current source must identify every destructive source range in its one exact
  preview candidate. Before a changed in-place write, it must prove that the
  exact information being removed or replaced is recoverable from the target
  path in `HEAD` and is not changed in the stage-0 index.
- An untracked target, unavailable repository proof, or staged or unstaged
  overlap with a destructive range blocks the in-place write. Unrelated dirty
  ranges that survive byte-identically in the candidate do not block merely
  because the file is dirty.
- Preview and separate-output candidates remain Git-independent, and planning
  operations never stage, commit, reset, check out, or otherwise mutate Git.
- Historical planning reconstruction is read-only and commit-bound. Mutable
  references are resolved to immutable commits before interpretation, and Git
  timestamps remain provenance rather than inferred planning facts.

The existing `--force-history-loss` option remains the narrow `dag advance`
boundary fixed by its accepted contract. No future planning-pool mutation
inherits that override implicitly; any override requires its own explicit
contract and authority decision.

## Claims and evidence

- **C1:** Outcome-driven Planning Events and Change Intents preserve the reason
  for work independently of the selected Do.
  - **E1:** The decision owner confirmed on 2026-08-24 that planning must state
    the starting condition and intended outcome and must not make Do the stable
    basis.
- **C2:** A separate non-executable AoA topology preserves the accepted
  execution model without weakening finish reachability.
  - **E2:** [ADR 0001](0001-activity-on-arrow.md) fixes Task edges, Milestone
    nodes, and AoA as the canonical execution graph.
  - **E3:** [Graph Semantics](../specs/graph-semantics.md#64-finish-reachability)
    requires every execution vertex and edge to reach `project.finish`.
- **C3:** Planning Event to Milestone projection gives the relationship a
  meaningful lifecycle without equating graph closure with accepted outcome.
  - **E4:** [Milestone Outcome Acceptance](../specs/milestone-acceptance.md#3-separate-state-axes)
    independently projects closure and acceptance.
- **C4:** Planning intent must remain distinct from actual execution evidence.
  - **E5:** [ADR 0006](0006-explicit-work-events-in-git-history.md) reserves
    `work_event` for explicit Task lifecycle evidence.
- **C5:** Planning history can remain complete without turning the current
  source into a permanent ledger when every destructive latest-state mutation
  proves recoverability before writing.
  - **E6:** The decision owner confirmed on 2026-08-24 that the canonical file
    keeps only the latest information, former states belong to Git history,
    and latest-state commands must check for information loss when the current
    state is not durably registered.
  - **E7:** [Advance History Safety](../specs/advance-history-safety.md) fixes
    exact `HEAD` and stage-0 proof for destructive in-place advance writes.
  - **E8:** [Historical DAG Reconstruction](../specs/historical-dag.md) fixes
    read-only, immutable-commit-bound reconstruction of retired topology.

## Alternatives

### Store Work Items as dependency-graph nodes

Rejected because it introduces an Activity-on-Node planning source beside the
accepted AoA execution source and makes the planning item rather than the
state transition the primary semantic unit.

### Put optional or non-goal Tasks in the execution DAG

Rejected because it weakens finish reachability and makes optional intent look
like required execution scope.

### Reuse execution Milestones directly as uncommitted planning nodes

Rejected because uncommitted intent would enter execution validation,
completion, scheduling, and advance semantics. Planning Events remain stable
and gain an explicit Milestone projection only when committed.

### Add a second schedulable pool graph

Rejected because durations, resources, critical paths, and start authority
would make the pool a competing execution plan.

## Consequences

Positive:

- Premises and desired outcomes remain visible when implementation Tasks
  change.
- Invalid premises or withdrawn targets lead to replanning instead of blind
  adherence to a stale Do.
- The live source remains bounded to current and future state while exact prior
  planning revisions remain recoverable from Git.
- Both planning and execution retain an AoA shape while keeping separate
  authority and analysis meanings.
- The existing strict DAG, `project.finish`, and current document compatibility
  remain intact.

Costs and open design work:

- The source grammar needs distinct Planning Event, Change Intent, projection,
  and invalidation records without colliding with existing `work_event`.
- Every destructive planning-pool mutation needs entity- and field-owned source
  ranges plus repository proof and race handling equivalent to the accepted
  history-safety boundary.
- A later contract must fix Planning Event and Milestone projection
  cardinality, outcome-criterion ownership, premise evidence, invalidation and
  supersession authority, promotion and deferral transactions, history and
  advance behavior, diagnostics, hard limits, and public interfaces.
- Multi-document identity and projection remain under `MULTI-001`; this
  decision covers one project document only.

## Implementation notes

This ADR accepts only the architectural direction. It does not select a source
grammar version, CLI contract, command spelling, implementation plan, release,
Issue mutation, or publication.

The first implementation-plan task must accept a normative contract and
machine-readable cases for the identities, topology, projection lifecycle,
invalidation behavior, compatibility, and the boundary with multi-document
composition before runtime work begins.

## Review

The decision owner accepted this level of design on 2026-08-24. Remaining
questions are follow-up decisions and must not be inferred as accepted by this
ADR.

## Follow-ups

1. Decide whether Planning Event or Milestone owns outcome criteria, how an
   exact criterion revision is bound across projection, and how its former
   revisions are reconstructed from Git without remaining in the latest
   source.
2. Decide projection cardinality and stable identity across split, merge,
   replacement, advance, and history reconstruction.
3. Decide premise evidence, invalidation, withdrawal, supersession, and waiver
   states and their effect on promotion, start authority, and active attention.
4. Decide the closed source, Core, CLI, result, schema, Help, Guide, migration,
   and compatibility contracts.
