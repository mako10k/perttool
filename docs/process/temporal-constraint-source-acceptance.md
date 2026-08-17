# Temporal Constraint Source Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `d17ae792f41a7bb2b2bda48bb07910763297d25a`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `CONSTRAINT_SOURCE_CORE`
- Normative contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Constraint model: `perttool.target-grammar-8-temporal-constraints@1`
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Decision

Accept the internal event-constraint Core over the accepted Grammar 8 Source
and Calendar Scheduler Cores. The slice normalizes task-start, task-finish, and
milestone-reach bounds, applies earliest bounds to an exact calendar-aware
precedence projection, and reports propagated latest-bound violations as typed
network infeasibility with negative signed slack.

The implementation adds no active DSL, command, schema, result, package-root
export, LSP, VSIX, or MCP surface. It neither adds AoA edges nor rewrites task
duration, status, milestone state, deadline meaning, or actual evidence.

## 2. Source and forward semantics

The existing Source Core remains the sole owner of `when` parsing, canonical
ordering, exact instants, duplicate rejection, zone checks, and local
`PTSCH-107` contradiction diagnostics. The new capability accepts only that
identity-checked source model and the exact scheduler document and `as_of`
binding.

Task-start earliest lower-bounds eligibility. Task-finish earliest uses the
accepted inverse working-time operation to find the delayed start and then
replays the forward operation, so no resource-holding idle tail is introduced.
Milestone-reach earliest applies only after all incoming conditions complete;
it changes neither topology nor incoming task duration.

Latest bounds do not move the forward projection or prohibit recovery starts.
An exceeded task-start, task-finish, or milestone-reach latest bound produces
an `infeasible` profile with the exact required and projected instants and
negative signed slack. Equality is feasible. Calendar-range and bounded-search
failures retain the Scheduler Core's typed unavailable causes.

## 3. Migration and retained authority

The internal migration planner changes Grammar 7 to Grammar 8 and replaces
each task-owned `not_before X` with `when start earliest X`. It validates the
complete candidate and returns no candidate on failure. Task endpoints,
duration, deadlines, and unrelated bytes are preserved; no calendar, latest
bound, or deadline conversion is inferred.

This slice provides an internal pure candidate only. Public `document migrate
--target-grammar 8`, source maintenance commands, governance projection, and
hash-model-2 activation remain owned by `TEMPORAL_PUBLIC_CONTRACT`.

## 4. Cases and verification

The fourteen dependency-ordered cases are
[`temporal-constraint-source-v1.json`](../../test/fixtures/temporal-constraint-source-v1.json).
They are executed by
[`temporal-constraint-source.test.mjs`](../../test/temporal-constraint-source.test.mjs).
The [llmthink review](temporal-constraint-source-review.think) reports no
warning-or-higher finding.

The accepted candidate passed the static type, duplication, and complexity
gates, the focused Source/Scheduler/Constraint suite, the direct Node.js 22
suite, English and documentation validation, all self-use plans, isolated LSP
and MCP packaging, supported VS Code shell validation, temporary npm linking,
and the isolated public-package workflow. The internal constraint modules are
not importable through the package `exports` map.

The complete `npm test` run passed 1,137 of 1,138 tests. Its single failure is
the unchanged pre-existing `recommendation-self-use-shadow.test.mjs` golden
for `plans/editor-mutations.pert`: the live plan selects
`EDITOR_RECOVERABLE_CONTRACT` at digest `sha256:bb9fd570...04d3b4`, while the
golden retains `EDITOR_REPAIR_ACCEPTANCE` at
`sha256:fac511d0...87af00`. Neither that plan nor its golden is modified by
this slice.

## 5. Plan lifecycle and retained boundaries

After verification, the status-only `task set` operation marks only
`CONSTRAINT_SOURCE_CORE` done. `REQUIRED_SCHEDULE_CORE` becomes the sole normal
frontier. No plan advance is performed.

Goal-anchored backward required scheduling, intermediate latest propagation,
forward-versus-required comparison, POSTDUE and POSTDUE_FORECAST, Check,
Analysis, Next, public Grammar 8 and CLI Contract 9 activation, release,
publication, remote writes, Issue mutation, and plan advance remain separate.
