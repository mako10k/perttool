# Actionable POSTDUE Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `020871b`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `POSTDUE_CONTRACT`
- Normative contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Machine cases: [`postdue-contract-v1.json`](../../test/fixtures/postdue-contract-v1.json)
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Decision

Accept the focused actionable alert contract as a refinement of Section 11 of
the existing single Grammar 8 temporal specification. No second POSTDUE
specification, deadline evaluator, DSL declaration, constraint name, or
command is introduced.

The contract fixes two warning-only kinds, `POSTDUE` and
`POSTDUE_FORECAST`, one evaluator `perttool.schedule-alert@1`, stable
source-bound occurrence identity, exact proof ordering, matching-key-only
suppression, deterministic bounded ordering, and a common Check, Analysis,
and Next projection.

## 2. Current and forecast boundary

Current POSTDUE requires an incomplete comparable event and `as_of` strictly
after its deadline or latest bound. Equality is due now, not late. Completed
events without actual timestamps receive no inferred historical judgment.

Forecast selects `precedence_infeasible` first. Only when precedence is not
late may an `optimal=false` resource projection produce
`resource_heuristic_late`; this never claims infeasibility or optimality.
Deadline and latest remain independent target identities even at the same
instant. Current lateness suppresses only the matching forecast key.

## 3. Actionable paths and command projections

Project-finish occurrences reuse the applicable precedence or resource
representative critical path. Task and intermediate-milestone occurrences use
a target-scoped predecessor cone. An unrelated project path is never labeled
as the cause.

Every occurrence has an `available`, `not_computed`, or `unavailable` driver.
Incomplete evidence carries the exact JSON argv for `dag analyze --schedule
both`; the operand remains one unmodified argv element. Check and Next return
compact drivers, while Analysis owns full bounded paths and references.

Alerts remain outside diagnostics, Recommendation version 1, override,
governance, assurance, mutation, and start authority. A valid command keeps a
success exit. Summary counts remain visible through diagnostic or occurrence
truncation.

## 4. Verification and lifecycle

The eighteen dependency-ordered `PDC-001` through `PDC-018` cases cover closed
kinds and events, strict comparisons, completed history, proof strength,
suppression, target identity, both critical-path kinds, target-scoped drivers,
unavailable recovery, stable occurrence identity, ordering, limits, the three
command projections, shared evaluation, and public non-activation.

The focused test and llmthink audit pass with no warning-or-higher finding.
Static, documentation, English-baseline, and self-use gates are required
before the task status is written. The active command and root-schema counts
remain 53 and 23; package version remains `0.9.4`.

After those gates, a status-only mutation marks `POSTDUE_CONTRACT` done and
makes `POSTDUE_ALERT_CORE` the sole normal frontier. No plan advance occurs.

Evaluator implementation, Check/Analysis/Next runtime projection, atomic
Grammar 8 and CLI Contract 9 activation, release, installation replacement,
remote writes, Issue mutation, and plan advance remain separate.
