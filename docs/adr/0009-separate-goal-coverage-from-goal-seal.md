# ADR 0009: Separate goal-obligation coverage from goal-seal freshness

- Status: Proposed
- Date: 2026-08-26
- Decision owner: user
- Implementation status: Deferred until the current NonGoal Entity registration
  is complete
- Related issue: [GitHub Issue #24](https://github.com/mako10k/perttool/issues/24)
- Related decisions: [ADR 0001](0001-activity-on-arrow.md)
- Related specifications: [Plan Assurance](../specs/plan-assurance.md),
  [Milestone Outcome Acceptance](../specs/milestone-acceptance.md),
  [Governance Authority](../specs/governance-authority.md)
- Separate later scope: [GitHub Issue #3](https://github.com/mako10k/perttool/issues/3)

## Context

Issue #24 records a verified single-plan staged-delivery case in which a first
slice is locally complete but a parent-goal obligation has no registered
successor. The example states a parent goal of third-party Plugin development
and distribution, makes a bundled metadata catalog the current
`project.finish`, excludes Driver execution, third-party loading, and Public
SDK publication from the completed slice, and retains no machine-readable
successor obligation for those deferred outcomes. Current check, analysis, and
Next projections accept the local DAG because the missing parent-goal
continuity is not part of their source model.

Plan Assurance protects a different direction. A changed producer plan or
outcome changes the accepted basis of its planning descendants. Milestone
Outcome Acceptance also protects a different fact: it evaluates the current
criterion-set revision and evidence for one milestone. Its model 1 explicitly
excludes milestone criterion commitments from task-plan assurance and does not
invalidate task plans when a criterion set changes.

An inverse Plan Seal applied without another semantic model would not detect
the Issue #24 initial state. It could accept and seal the already incomplete
local slice because no explicit parent-goal obligation or successor-coverage
record exists to enter the commitment. Goal-owner authorization alone would
also be insufficient: it can govern a declared mutation, but it cannot expose
an obligation that was never declared.

The current NonGoal Entity registration is separate active work. The user has
selected completion of that work before resuming Goal Seal design. This
sequencing decision does not yet establish that a NonGoal Entity is the future
Goal Obligation representation or authorize an extension of its current
contract.

## Proposed decision

### Preserve the work order

Complete the current NonGoal Entity registration before starting the Issue #24
Goal work. Do not broaden the active NonGoal Entity contract, implementation,
acceptance, release, or publication scope merely to anticipate this ADR.

After that boundary is complete, address Issue #24 in the following semantic
order:

1. explicit parent-goal obligations;
2. explicit successor coverage and disposition;
3. read-only goal coverage and completion projection;
4. goal-governed cancellation and supersession; and
5. Goal Seal freshness over an accepted goal-coverage model.

### Establish goal obligations before Goal Seal

The first Goal contract should provide stable, machine-readable identities for
parent-goal obligations. It should not infer obligations, equivalence,
deferral, or cancellation from project, milestone, task, or NonGoal prose.

Every outstanding declared obligation should have one explicit disposition:

- retained by one or more valid successor work identities;
- retained at an explicitly owned external planning location while remaining
  unresolved until identity, coverage, and freshness are proven; or
- cancelled or superseded through a goal-owner-governed mutation.

Missing, duplicate, self-referential, cyclic, unknown, or stale coverage must
remain explicit and fail or report unavailable under the later normative
contract. Merely naming an external location is not sufficient coverage.

### Keep coverage and completion separate

Goal coverage answers whether every declared obligation has a valid current
disposition. Goal completion answers whether every required parent-goal
obligation is satisfied or has been validly cancelled or superseded.

A valid unresolved successor can make coverage structurally complete while the
parent goal remains incomplete. Completion of one slice, its Tasks, or its
Milestone acceptance must not imply completion of the parent goal.
Sequencing approval and a slice-local non-goal must not imply cancellation.

The strict Activity-on-Arrow DAG remains the execution authority. A future
normative contract should decide how the parent final Milestone, intermediate
slice Milestones, obligation identities, successor work, and acceptance
criteria relate without deriving a second executable graph.

### Add Goal Seal only as a freshness layer

After an explicit goal-obligation and coverage model exists, a separately
versioned Goal Seal may commit to its canonical accepted semantics. A changed
parent goal, obligation set, or coverage disposition can then make affected
earlier work `goal_review_required` through a reverse-DAG review projection.

This state must remain independent from Task lifecycle, actual evidence,
Milestone closure, Milestone Outcome Acceptance, and forward Plan Assurance.
It must not rewrite completed work or automatically replan, cancel, suspend, or
create Tasks. Resealing must be explicit; recomputation must never update an
accepted commitment implicitly.

The exact commitment domain, reverse-closure rule, state vocabulary, required
actions, start or acceptance authority effects, source records, commands,
results, schemas, diagnostics, migration, and historical behavior remain
pending contract decisions. This ADR assigns none of those public identities.

### Keep governance as a separate guard

Goal Seal detects freshness after a declared Goal change. Governance controls
who may persist cancellation, supersession, or another meaning-changing Goal
mutation. Neither mechanism substitutes for the other.

The later governance contract should bind any required owner assertion to the
exact source digest, candidate digest, affected scope, and one mutation. It
must not reuse an assertion for a later candidate. The design must explicitly
decide whether final-Milestone criterion replacement or waiver belongs to an
extended `goal` scope or a new versioned scope; current governance semantics
must not be widened silently.

## Alternatives

### Implement only an inverse Plan Seal

Rejected as the first step. It can detect changes only after an accepted Goal
baseline exists and therefore cannot detect the Issue #24 missing-obligation
initial state.

### Require only Goal Owner approval

Rejected as a complete solution. Authorization can protect an explicit Goal
mutation but cannot prove coverage or expose an undeclared deferred outcome.

### Infer Goal obligations from descriptions or occurrences of `non-goal`

Rejected. Free text does not provide stable identity, exact ownership,
complete coverage, or deterministic cancellation semantics. The planner and
Goal Owner must declare these facts.

### Treat slice completion as parent-goal completion

Rejected. A locally accepted slice and a completed parent outcome are separate
facts. This conflation is the Issue #24 failure mode.

## Consequences

Positive consequences:

- the initial missing-successor case becomes representable before freshness is
  considered;
- forward Plan Assurance and downstream Goal Coverage remain separate axes;
- Goal Seal can later reuse the established hash-and-review discipline without
  pretending that a hash proves completeness;
- authorized cancellation cannot be confused with sequencing or deferral; and
- single-plan semantics can be fixed before Issue #3 adds cross-plan location
  and ownership boundaries.

Costs and risks:

- the model needs stable obligation identities and explicit dispositions in
  addition to Task and Milestone records;
- broad reverse invalidation may be noisy unless the later contract defines a
  sufficiently precise obligation-to-work relationship;
- external planning coverage requires bounded identity and freshness evidence;
- backward compatibility must not report legacy documents as goal-complete
  merely because the model is absent; and
- NonGoal Entity and Goal Obligation may overlap conceptually, but premature
  unification could distort either contract.

## Implementation notes

This ADR is a saved design checkpoint, not implementation authority. It does
not authorize source grammar, CLI, package, adapter, release, remote, Issue,
or plan mutations. It also does not select whether the eventual first public
surface is document check, analysis, Next, assurance, or a separate read-only
command.

The first resumed task should be a normative, read-only, single-plan contract
and fixture for Issue #24. It should define coverage and completion before any
mutation or Goal Seal implementation. Multi-plan propagation remains under
Issue #3.

## Evidence and claims

- **E-GOAL-001:** Issue #24 records a locally valid completed slice with an
  undeclared Public SDK/runtime successor obligation and exact successful
  readback from perttool 0.10.5.
- **E-GOAL-002:** Plan Assurance model 1 derives a Task basis from its own plan
  contract and forward planning-predecessor commitments; it does not model
  parent-goal coverage.
- **E-GOAL-003:** Milestone Outcome Acceptance model 1 excludes criterion-set
  commitments from Task Plan Assurance and makes downstream task-plan
  invalidation a non-goal.
- **E-GOAL-004:** On 2026-08-26, the user selected completion of the current
  NonGoal Entity registration before moving to Goal Seal work and requested
  that the current consideration be saved.

- **C-GOAL-001 (high confidence):** Explicit goal obligations and successor
  coverage must precede Goal Seal because a freshness commitment cannot expose
  facts absent from its accepted input model. References: E-GOAL-001,
  E-GOAL-002, E-GOAL-003.
- **C-GOAL-002 (high confidence):** Goal Seal remains useful as a separate
  later freshness guard after coverage exists, while Goal governance remains a
  separate mutation-authority guard. References: E-GOAL-002, E-GOAL-003.
- **C-GOAL-003 (high confidence):** The saved sequence must not expand the
  current NonGoal Entity work. Reference: E-GOAL-004.

## Review

This ADR remains `Proposed`. The user has confirmed only the work order and the
request to retain the design checkpoint. The exact Goal model and its relation
to NonGoal Entity remain pending review after the current registration is
complete.

## Follow-ups

1. Complete and read back the current NonGoal Entity registration without
   expanding it under this ADR.
2. Reopen Issue #24 as a read-only single-plan Goal Obligation and Goal Coverage
   contract task.
3. Decide explicitly whether NonGoal Entity and Goal Obligation share an
   identity, reference one another, or remain independent.
4. Define coverage versus completion, successor and external dispositions,
   owner-governed cancellation, legacy behavior, and deterministic read output.
5. Only after those semantics are accepted, design the Goal Seal commitment,
   reverse review projection, and authority composition.
6. Move this ADR to `Accepted`, revise it, supersede it, or reject it only after
   the decision owner reviews that contract.
