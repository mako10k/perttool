# Project Actuals and Git History Acceptance

## Decision

`ACTUALS_ACCEPTANCE` is accepted. The Grammar 5 and CLI Contract 6 source
boundary traces all fourteen normative PACT cases through executable
repository tests and the linked and isolated installed-package workflows.
The complete workstream retains explicit event time, exact active time and
effort, task-owned advance removal, read-only first-parent history, and
read-only velocity observation without adding a Git writer or automatic
declared-velocity adoption.

Git commit `f994fa2` retains the exact completed 4p pre-advance snapshot.
Canonical advance then removed the completed task and preceding reached
frontier and retained only reached `ACTUALS_ACCEPTED`.

This acceptance does not publish the source tree. The immutable
`perttool@0.4.0` release remains the separately accepted Grammar 4 and CLI
Contract 5 artifact. A future Grammar 5 and Contract 6 release requires its
own release plan and authorization.

## Reviewed authority

The acceptance uses the repository precedence order:

1. [Requirements](../requirements.md), especially Section 7.8
2. [ADR 0006](../adr/0006-explicit-work-events-in-git-history.md)
3. [DSL Grammar](../specs/dsl-grammar.md)
4. [Graph Semantics](../specs/graph-semantics.md)
5. [Mutation Semantics](../specs/mutation.md)
6. [Project Actuals and Git History Contract](../specs/project-actuals.md)
7. [Basic Design](../basic-design.md)
8. [Normative Project Actuals Examples](../examples/project-actuals.md)
9. [Project actuals plan](../../plans/project-actuals.pert)

The semantic case authority remains
[`project-actuals-contract-v1.json`](../../test/fixtures/project-actuals-contract-v1.json).
The executable evidence map is
[`project-actuals-acceptance-v1.json`](../../test/fixtures/project-actuals-acceptance-v1.json).
The repository test requires the two files to contain the same ordered set of
fourteen case IDs and resolves every evidence entry to a test declaration or
verification-script token.

## PACT trace

| Case | Accepted runtime evidence |
| --- | --- |
| `PACT-001` | Eventful finish returns one source-preserving state/event candidate; the public CLI workflow performs the same atomic transition. |
| `PACT-002` | Start, suspend, resume, and finish require explicit fixed-offset times and do not read an implicit clock. |
| `PACT-003` | A real temporary first-parent history reduces start, suspend, resume, and finish to exact 8h cycle time and 6h active time. |
| `PACT-004` | Finish-only reduction preserves the committed finish snapshot, leaves start/cycle time absent, and retains explicit effort. |
| `PACT-005` | Suspended tasks remain unfinished and separately classified, retain duration, release renewable resources, and are not reported as blocked. |
| `PACT-006` | Identical event identity and payload retry is a no-op; payload drift and invalid state or identity fail closed. |
| `PACT-007` | Advance removes only work events owned by removed tasks, while history deduplicates the pre-removal event evidence. |
| `PACT-008` | Legacy state changes are qualified as Git-recorded transitions; commit time never becomes actual occurrence time. |
| `PACT-009` | A shallow boundary returns typed incomplete history and does not guess an actual start. |
| `PACT-010` | Parallel 3p tasks share one exact 3h elapsed window and produce `2p/1h`, without double-counting elapsed time. |
| `PACT-011` | The same 6p sample with 8 person-hours produces a separate exact `3/4p/1ph` productivity rate. |
| `PACT-012` | Observation is read-only, leaves the source and declared velocity unchanged, and requires an explicit later `project set` to adopt an eligible token. |
| `PACT-013` | Active-date rates use evidenced dates, reject mixed offsets or incomplete intervals, and never equate a day with 24 hours silently. |
| `PACT-014` | Grammar 5 and Contract 6 activate atomically in source; Grammar 1 through 4 meanings and legacy status-only finish remain covered, with no Contract 5 alias. |

## Surface closure

| Layer | Accepted evidence |
| --- | --- |
| Requirements and cases | The design test binds requirements, ADR, Grammar 5, the normative contract, examples, and the fourteen ordered machine cases. |
| Source and lifecycle Core | Parser, validator, formatter, lifecycle, finish, exact reduction, and governance tests cover work-event identity and source-preserving candidates. |
| Advance | Core and safe-write tests remove only task-owned events and retain the committed pre-advance boundary. |
| Real Git histories | Temporary SHA-1 and SHA-256 repositories, first-parent snapshots, advance removal, legacy transitions, shallow history, linked worktrees, and race cases execute without changing the inspected repository. |
| Public Core and CLI | The standard root and CLI expose lifecycle, history, observation, AnalysisResult v4, NextResult v5, MutationResult v3, and UnitMigrationResult v3 without target-prefixed exports. |
| Schemas, help, and Guide | The single 33-command registry owns result schemas and usage; the nine-topic Guide includes the complete `actuals` topic. |
| Local link | `npm run check:link` links into a temporary prefix, checks Grammar 5, previews a Contract 6 start candidate, and checks the Contract 6 Guide. |
| Isolated package | `npm run check:package` creates a source tarball in a temporary directory, performs npm publication dry-run only, installs it into an isolated prefix, and executes lifecycle, real Git history, observation, migration, and file-first workflows. |
| Contract 5 record | The annotated `v0.4.0` tag and its durable release acceptance retain the immutable Grammar 4 and Contract 5 package boundary. Current source does not impersonate that released contract. |

## Side-effect boundary

The accepted perttool commands do not run `git add`, `git commit`, `git tag`,
`git push`, or another Git mutation. Tests may create commits inside
disposable repositories solely to supply history input. Lifecycle commands
write only after preview, governance, expected-digest, and safe-write gates;
history and observation never write the project source.

Observation never changes `project.velocity`. The accepted source and package
checks do not publish to npm, create or edit a GitHub Release, close an issue,
or move an npm dist-tag. `scripts/publish-npm.sh` is not invoked; package
verification reaches only npm's documented dry-run path.

MIG-08 override apply and durable audit, automatic Git recording, automatic
velocity adoption, release publication, Issue #3 deliverables, and Issue #4
closure remain outside this workstream.

## Verification

The completed pre-advance snapshot is checked with:

```sh
npm ci
node --test test/project-actuals-*.test.mjs
npm run check:link
npm run check:package
npm run check
git diff --check
```

After the exact completed snapshot is committed, canonical `dag advance`
uses its reviewed source digest. The resulting plan must have zero remaining
tasks, zero precedence and heuristic resource makespans, reached
`ACTUALS_ACCEPTED`, and no ready or recommended task.
