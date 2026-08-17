# Temporal Required Schedule Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `ba242cb`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `REQUIRED_SCHEDULE_CORE`
- Normative contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Algorithm: `perttool.required-precedence-backward@1`
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Decision

Accept the internal goal-anchored Required Schedule Core over the accepted
Grammar 8 Source, Calendar Scheduler, and Event Constraint Cores. The slice
selects the project finish anchor, performs exact calendar-aware backward AoA
propagation, retains each driving bound or successor, and compares the result
separately with precedence-forward and optimal-false resource-forward facts.

It adds no active DSL, command, result, schema, package-root export, LSP, VSIX,
or MCP surface. It does not implement backward resource leveling, global
optimization, POSTDUE, or execution authority.

## 2. Anchor and backward semantics

The project finish `when reach latest` and advisory `deadline` remain separate
source facts. The earlier comparable instant is selected; exact equality is
recorded as `coincident`. A missing pair yields `required_anchor_absent`
instead of deriving a target from duration, current makespan, or a wall clock.

The backward projection uses the Scheduler Core's exact inverse working-time
operation. Destination milestone, task-finish latest, task-start latest, and
intermediate milestone latest values are combined only as upper bounds on the
corresponding event. A tighter task-start latest moves its task finish through
the accepted forward operation; it is not copied to either milestone. Gates
propagate only their target requirement. The implementation shares the common
temporal topology index with the Constraint Core.

## 3. Slack and qualification

Each comparable event reports `required - projected` exact seconds. Negative
precedence slack is `precedence_infeasible`. Negative resource slack is
`resource_heuristic_late` only in the separate resource comparison, which
retains `optimal=false`. A feasible projection remains `feasible`; unavailable
forward facts remain unavailable rather than guessed.

No result claims a resource-feasible required schedule, backward leveling, or
exact global optimality.

## 4. Cases and verification

The fourteen dependency-ordered cases are
[`temporal-required-schedule-v1.json`](../../test/fixtures/temporal-required-schedule-v1.json)
and are executed by
[`temporal-required-schedule.test.mjs`](../../test/temporal-required-schedule.test.mjs).
The [llmthink review](temporal-required-schedule-review.think) reports no
warning-or-higher finding.

The accepted candidate passed static type, duplication, and complexity gates;
focused Source, Scheduler, Constraint, Required Schedule, contract, and
dependency tests; direct Node.js 22 verification; English and documentation
checks; self-use; isolated LSP and MCP packages; the supported VS Code shell;
temporary npm linking; and the isolated public-package workflow. The new
modules remain unavailable through the package `exports` map.

The complete aggregate test retains only the independently known
`recommendation-self-use-shadow.test.mjs` golden drift for
`plans/editor-mutations.pert`; this slice does not modify either artifact.

## 5. Lifecycle and retained boundaries

After verification, a status-only plan mutation marks
`REQUIRED_SCHEDULE_CORE` done. `POSTDUE_CONTRACT` becomes the sole normal
frontier. No plan advance is performed.

The POSTDUE and POSTDUE_FORECAST contract and evaluator, Check, Analysis,
Next, public Grammar 8 and CLI Contract 9 activation, release, publication,
remote writes, Issue mutation, and plan advance remain separate.
