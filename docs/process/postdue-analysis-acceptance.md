# POSTDUE Analysis Projection Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `d49f381`
- Plan task: `POSTDUE_ANALYSIS`
- Target identity: `Perttool.AnalysisResult.v7`
- Active identity: unchanged `Perttool.AnalysisResult.v6`

## Decision

Accept the internal target Analysis projection that composes the complete
calendar-aware precedence and optimal-false resource schedules, goal-anchored
required schedule, signed slack and feasibility classifications, shared alert
occurrences, and full applicable driver evidence.

The projection consumes accepted results and does not parse, schedule, compare
targets, or reconstruct paths. It rejects partial temporal input batches,
cross-document identities, and `not_computed` Analysis drivers. A typed
`unavailable` driver remains valid evidence and is preserved. Existing base
Analysis objects and legacy projections remain unchanged by identity.

Twelve dependency-ordered `PDA` cases cover both forward schedules, required
schedule, slack and qualification, precedence/resource/target drivers,
unavailable paths, complete binding, base identity, and public
non-activation. Focused, static, documentation, English, and self-use gates
pass before the status-only plan mutation.

The target module remains outside public exports, CLI, schemas, and adapters.
Public rendering and schema activation, release, remote writes, Issue
mutation, and plan advance remain separate.
