# CLI Contract 5-to-6 Migration

- Document status: Source migration guidance 1.0
- Source contract: CLI Contract 5 and Grammar 1/2/3/4
- Target contract: CLI Contract 6 and Grammar 1/2/3/4/5
- Published package boundary: `perttool@0.4.0` remains Contract 5
- Release status: not authorized by this document

## 1. Purpose

CLI Contract 6 activates the complete Project Actuals and Git History
Contract. It does not provide a compatibility switch or partially add
actuals fields to Contract 5. A consumer selects one exact installed artifact,
checks its envelope and result schema, and fails closed on an unknown version.

This source migration does not publish a package, move an npm dist-tag, mutate
Git, or adopt an observed velocity.

## 2. Atomic boundary

Every Contract 6 JSON result has `cli_contract_version=6`. The changed result
identities are:

| Operation | Contract 5 | Contract 6 |
| --- | --- | --- |
| `document check` | `Perttool.CheckResult.v2` | `Perttool.CheckResult.v3` |
| `project show` | `Perttool.ProjectResult.v3` | unchanged v3 |
| `dag analyze` | `Perttool.AnalysisResult.v3` | `Perttool.AnalysisResult.v4` |
| `dag next` | `Perttool.NextResult.v4` | `Perttool.NextResult.v5` |
| mutation and advance | `Perttool.MutationResult.v2` | `Perttool.MutationResult.v3` |
| `project migrate-unit` | `Perttool.UnitMigrationResult.v2` | `Perttool.UnitMigrationResult.v3` |
| `project history` | absent | `Perttool.ProjectHistoryResult.v1` |
| `project observe-velocity` | absent | `Perttool.VelocityObservationResult.v1` |

Format, init, command-help, Guide, agent-guidance, and conversion result schema
majors remain unchanged, but their envelopes identify Contract 6.

The command registry adds:

```text
task start
task suspend
task resume
project history
project observe-velocity
```

Eventful `task finish` adds `--at`, `--event-id`, `--active-time`, and
`--effort`. All lifecycle commands retain preview/diff/write, digest, and
governance controls. History and observation are read-only and require an
on-disk file in a Git worktree.

## 3. Source compatibility

Grammar 1 through 4 remain readable, formattable, analyzable, and
source-preserving. Contract 6 still returns its new envelope and
actuals-affected result identities for those sources.

Grammar 5 is opt-in through explicit `project.version 5`. It adds top-level
task-owned `work_event` declarations and `status suspended`. Grammar 1 through
4 reject those spellings. Contract 6 does not automatically upgrade an
untouched plan.

Status-only `task finish` remains available for Grammar 1 through 4 and
returns `lifecycle=null`. Grammar 5 requires eventful finish with `--at`.
Direct `task set --status suspended` is never accepted.

## 4. Consumer migration

1. Require `cli_contract_version == 6` before reading a current-source result.
2. Require the exact operation-specific schema from Section 2.
3. Update Next consumers to require complete, non-truncated
   `Perttool.NextResult.v5` with the unchanged recommendation interface,
   algorithm, taxonomy, description locale, and temporal authority policy.
4. Treat `groups.suspended` as disjoint from active, ready, runnable, blocked,
   and upcoming. Resume it only through an explicit lifecycle action.
5. Treat `task_actuals`, `actuals_inputs`, `lifecycle`, and
   `removed_work_event_ids` as versioned evidence, not optional Contract 5
   fields.
6. Keep history's `git_recorded_transition` distinct from
   `declared_actual`; Git recorded time is not actual event time.
7. Treat observed velocity tokens as read-only candidates. A separate reviewed
   `project set --velocity` mutation is required for adoption.
8. Re-run command discovery and Guide goldens from the same installed
   artifact.

Consumers that cannot migrate atomically must remain pinned to
`perttool@0.4.0` Contract 5. There is no `--cli-contract 5` alias on a Contract
6 runtime.

## 5. Operator migration

Before enabling lifecycle writes:

- create or explicitly upgrade one reviewed plan to Grammar 5;
- preview each transition and inspect its state change and work event;
- supply event time explicitly;
- retain the ordinary owner assertions and expected digest for persistence;
- commit the resulting source through the operator's existing Git workflow;
  perttool does not commit automatically; and
- run `project history` only after the intended evidence is durable in Git.

Before `dag advance --write`, preserve the completed eventful source in Git.
Advance removes a completed task and its task-owned events from the residual
plan; project history reconstructs them from first-parent snapshots.

## 6. Verification

From a clean checkout with Node.js 22 or later:

```sh
npm ci
npm run check
git diff --check
```

The package check installs the locally packed artifact into an isolated prefix
and exercises Contract 6 help, Grammar 1 through 5 compatibility, lifecycle
writes, suspended NextResult v5, read-only history, observation, exact unit
migration, and package-root exports. It does not publish the tarball.
