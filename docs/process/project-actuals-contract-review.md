# Project Actuals Contract Acceptance Review

- Document status: Accepted 1.0
- Review date: 2026-07-28
- Baseline HEAD: `9072febeb094ee98e5485cbef99c0fe48fe35d7f`
- Plan task: `ACTUALS_CONTRACT_REVIEW`
- Target grammar: Grammar 5
- Target CLI contract: Contract 6
- Runtime status: not implemented

## 1. Decision

The project-actuals requirements, ADR, source grammar, graph and mutation
semantics, public contract, examples, and machine-readable cases form one
implementation-ready target. There are no open semantic or public-contract
findings for `ACTUALS_CONTRACT_REVIEW`.

This acceptance does not activate Grammar 5 or CLI Contract 6. The active
package remains Grammar 1 through 4 and CLI Contract 5 until the later atomic
public-contract and acceptance tasks complete.

## 2. Reviewed authority

The review used this precedence:

1. [Requirements](../requirements.md), especially Section 7.8
2. [DSL Grammar](../specs/dsl-grammar.md)
3. [Graph Semantics](../specs/graph-semantics.md)
4. [Mutation Semantics](../specs/mutation.md)
5. [Project Actuals and Git History Contract](../specs/project-actuals.md)
6. [Basic Design](../basic-design.md)
7. [Normative Project Actuals Examples](../examples/project-actuals.md)
8. [Project actuals plan](../../plans/project-actuals.pert)

[ADR 0006](../adr/0006-explicit-work-events-in-git-history.md) records the
accepted storage and durability decision. The machine-readable case authority
is
[`project-actuals-contract-v1.json`](../../test/fixtures/project-actuals-contract-v1.json).

## 3. Resolved decisions

| ID | Accepted decision |
| --- | --- |
| `PACR-001` | Grammar 5 uses task-owned top-level `work_event` records in the same document; events are evidence, not AoA edges. |
| `PACR-002` | Event model 1 fixes `model`, `task`, `kind`, numeric-offset `occurred_at`, and kind-specific exact fields with canonical order and contextual keywords. |
| `PACR-003` | Omitted event IDs use the full SHA-256 `WE-...` derivation; optional payload changes under the same identity are conflicts. |
| `PACR-004` | Start, suspend, resume, and eventful finish atomically change state and append one event; lifecycle requests are not batch members in model 1. |
| `PACR-005` | `suspended` is unfinished, releases resources, is separately classified, and makes schedules conditional on explicit resumption at relative time zero. |
| `PACR-006` | Planned value, cycle time, active time, effort, Points, and resource quantities remain distinct exact values. |
| `PACR-007` | Advance removes task-owned events only in the task-removal candidate; the committed pre-advance snapshot is the durable evidence boundary. |
| `PACR-008` | History uses an on-disk repository-relative path, an optional revision, and first-parent snapshots; it never searches other parents, reflogs, or unreachable objects. |
| `PACR-009` | Declared events and Git-recorded transitions are separate evidence classes. Git timestamps never populate actual event fields. |
| `PACR-010` | Observation returns separate declared elapsed-hour, active-date, effort-productivity, and qualified Git-recorded candidates; it never mutates declared velocity. |
| `PACR-011` | Grammar 5 and CLI Contract 6 select the complete schema table from Check v3 through new History and Velocity Observation v1 results. |
| `PACR-012` | PTACT, PTHIS, and PTOBS codes, stable causes, text ordering, and retained exits 0/1/2/3/4/5/70 are fixed before implementation. |
| `PACR-013` | Unit migration version 3 converts `work_event.planned_value`, preserves every actual-time/effort field, and retains Grammar 5. |
| `PACR-014` | Grammar 1 through 4, CLI Contract 5, old status-only finish, and existing package behavior remain unchanged until one atomic cutover. |

## 4. Case acceptance

| Case | Status | Contract evidence |
| --- | --- | --- |
| `PACT-001` | Accepted | one state/event candidate |
| `PACT-002` | Accepted | explicit time and no clock |
| `PACT-003` | Accepted | complete sequence and exact interval reduction |
| `PACT-004` | Accepted | finish-only coverage |
| `PACT-005` | Accepted | suspended classification and resource release |
| `PACT-006` | Accepted | idempotent retry and identity conflict |
| `PACT-007` | Accepted | advance ownership and history deduplication |
| `PACT-008` | Accepted | Git-recorded evidence qualification |
| `PACT-009` | Accepted | shallow-history incompleteness |
| `PACT-010` | Accepted | parallel elapsed throughput |
| `PACT-011` | Accepted | explicit effort productivity |
| `PACT-012` | Accepted | read-only observed velocity |
| `PACT-013` | Accepted | active-date availability boundary |
| `PACT-014` | Accepted | atomic compatibility boundary |

Each machine case depends only on earlier accepted IDs. The case file fixes
the target model and contract identities and contains no active-runtime claim.

## 5. Compatibility and non-goals

The accepted target has no compatibility alias and no partial activation.
Older grammars reject `work_event` and `suspended`; active help continues to
omit lifecycle/history/observation commands.

This review does not authorize runtime implementation beyond the plan's next
task selection, Git mutation, automatic velocity adoption, post-advance
correction, arbitrary branch-union reconstruction, payroll/billing,
calendars, statistical confidence, MIG-08, release publication, or dist-tag
movement.

## 6. Verification

The accepted change is checked with:

```sh
node --test test/project-actuals-design.test.mjs
npm run check:self-use
npm run check
git diff --check
```

The contract test verifies the 14-case dependency order, fixed source and
schema identities, diagnostics, compatibility boundary, active Contract 5
non-exposure, and the live project-actuals PERT frontier.

On the review date, `npm ci`, the focused contract and recommendation-shadow
tests, `npm run check:self-use`, `npm run check`, and `git diff --check`
completed successfully in the local Node.js `v25.1.0` environment. The full
check included type checking, all repository tests, documentation and link
checks, all twenty self-use plans, a temporary linked CLI, package dry-run,
and isolated installed-package Contract 5 acceptance. It performed no Git
remote write, release publication, or dist-tag change.

## 7. Implementation handoff

Implementation must use the accepted names and identities rather than
selecting syntax or schemas in code. The source Core and Git history probe are
independent after this review, while eventful finish depends on the source
Core. Re-run a complete `Perttool.NextResult.v4` after recording this task's
completion before starting either successor.

No source parser, root export, CLI command, help record, or installed behavior
is accepted by this document.
