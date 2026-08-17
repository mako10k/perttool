# Temporal Calendar Scheduler Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `71411580d2d58fad03e0607a755ca1d5702b257f`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `CALENDAR_SCHEDULER_CORE`
- Normative contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Scheduler model: `perttool.target-grammar-8-calendar-scheduler@1`
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Decision

Accept the internal calendar-aware Scheduler Core over the already accepted
Grammar 8 Source Core. It is the only owner of named-zone calendar membership,
generic effective resource capacity, working-time arithmetic, common progress,
calendar interruption, forward precedence version 2, optimal-false
parallel-SGS version 2, and exact utilization.

The slice adds no DSL and does not modify the active parser, public facade,
commands, schemas, results, CLI, LSP, VSIX, or MCP. Event-bound propagation,
required schedules, and POSTDUE must consume this scheduler rather than append
another calendar or resource-leveling implementation.

The normalized scheduler request must match the Source Core document identity
and exact offset-bearing `as_of` instant. A caller cannot substitute a wall
clock or independently selected scheduling origin.

## 2. Accepted arithmetic and capacity

All instants and work amounts use exact `Rational` seconds. Hour, day, and
Point inputs convert without display rounding; day-based relationships require
the declared exact `workday`. Forward addition and backward subtraction
consume the same ordered half-open common-progress intervals and are exact
inverses when no accepted range or horizon intervenes.

Local weekly and exception windows are expanded against the pinned 2026c zone
projection. Nonexistent local labels contribute no instant and repeated labels
contribute both occurrences. Validity is outermost; a nonoverlapping capacity
replacement may open a resource outside its weekly window, then selected
nominal capacity caps the replacement. No host zone, locale, filesystem,
network, Git, or wall clock is read.

Tasks acquire their complete generic-resource requirement sets atomically.
Calendar or capacity changes end progress segments and release every
allocation. Interrupted tasks retain resume priority over new tasks. Active
remaining work is already selected at `as_of`; simultaneous active demand that
exceeds effective capacity fails closed with all applicable task and resource
IDs.

## 3. Accepted schedules

`perttool.temporal-precedence-earliest@2` computes exact per-task calendar
availability without cross-task contention. `perttool.temporal-parallel-sgs@2`
uses the existing priority, float, duration, and stable-ID ordering after
active and interrupted priority, returns one resource-feasible construction,
and remains explicitly `optimal=false`.

Both profiles retain exact work, ordered work segments, milestone reaches,
blocked qualification, and bounded unavailable causes. Resource utilization is
the exact ratio of allocated unit-seconds to effective available unit-seconds,
not nominal elapsed span. The continuous compatibility profile is returned as
not applicable so the active legacy scheduler remains its sole owner.

## 4. Bounded outcomes and cases

The implementation retains the accepted one-million work-segment and
schedule-event limits. `no_feasible_window` is used only when the inspected
closed interval contains no progress capacity. Horizon exhaustion remains
`calendar_search_limit`; range, workday, and active-capacity failures remain
distinct.

The fourteen dependency-ordered cases are
[`temporal-calendar-scheduler-v1.json`](../../test/fixtures/temporal-calendar-scheduler-v1.json).
They are executed by
[`temporal-calendar-scheduler.test.mjs`](../../test/temporal-calendar-scheduler.test.mjs).
The [llmthink review](temporal-calendar-scheduler-review.think) reports no
warning-or-higher finding.

## 5. Verification

The accepted candidate passed:

```sh
npm run check:static
npm run build
node --test test/temporal-calendar-scheduler.test.mjs \
  test/temporal-schedule-source-core.test.mjs \
  test/temporal-schedule-contract.test.mjs \
  test/temporal-precedence-schedule.test.mjs \
  test/temporal-resource-schedule.test.mjs
npx --yes node@22 --test \
  test/temporal-calendar-scheduler.test.mjs \
  test/temporal-schedule-source-core.test.mjs \
  test/temporal-schedule-contract.test.mjs \
  test/temporal-precedence-schedule.test.mjs \
  test/temporal-resource-schedule.test.mjs \
  test/adapter-core-dependency.test.mjs \
  test/node-host-boundary.test.mjs
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:lsp-package
npm run check:mcp-package
npm run check:vsix-shell
npm run check:link
npm run check:package
llmthink dsl audit \
  docs/process/temporal-calendar-scheduler-review.think \
  --pretty --min-severity warning
git diff --check
```

The focused current-runtime gate passed 49 tests, and the direct Node.js 22
gate passed 60 tests. Static type, duplication, and complexity gates passed
without a new baseline. The English baseline covered 960 text files, the
documentation gate covered 294 Markdown files and seven PERT examples, and
read-only self-use covered all 43 plans. Isolated LSP and MCP, supported VS
Code 1.101.0 trusted/untrusted install and replacement, temporary npm linking,
and the 761-file isolated public-package workflow passed. The package root
remains closed by `exports`; the compiled internal scheduler is not an
importable public subpath.

The complete `npm test` run passed 1,133 of 1,134 tests. Its single failure is
the unchanged pre-existing `recommendation-self-use-shadow.test.mjs`
expectation for `plans/editor-mutations.pert`: the current plan selects
`EDITOR_RECOVERABLE_CONTRACT` at digest `sha256:bb9fd570...04d3b4`, while the
golden expects `EDITOR_REPAIR_ACCEPTANCE` at
`sha256:fac511d0...87af00`. Neither that plan nor its golden is modified here,
so this record does not claim a completely green aggregate test run.

## 6. Plan lifecycle

The status-only `task set` preview changed no governance scope. One in-place
write used the exact expected original digest
`sha256:7318cab57bbd0aaf64b1c0730140f24481225dd4306706c151f9593a40d73350`
and produced source digest
`sha256:c0737f10f271f93b89efbb098a7ece31d8ae9f9b59544bd970d3e9908f6401ba`.
Readback reports `CALENDAR_SCHEDULER_CORE` done and recommends and makes
startable only `CONSTRAINT_SOURCE_CORE`. The three `PTDAG-208` closure notices
through `CALENDAR_SCHEDULER_READY` remain warnings; no plan advance was
performed.

## 7. Retained boundaries

`CONSTRAINT_SOURCE_CORE` is the only next implementation frontier. It owns
earliest and latest task-start, task-finish, and milestone-reach constraints,
their source mutation, local contradiction rules, and propagation onto these
accepted calendar schedules.

Required schedules, POSTDUE and POSTDUE_FORECAST, Check/Analysis/Next
projection, public Grammar 8 and CLI Contract 9 activation, schemas, Help,
Guide, adapters, installed behavior, release selection, publication, remote
writes, Issue mutation, and plan advance remain separate tasks or decisions.
