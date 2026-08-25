# Planning Pool Public Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-25
- Accepted candidate parent: `59c5d0b8bdedbc36f4d9f200112195af63168e62`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_PUBLIC_CONTRACT`
- Accepted basis: `sha256:7f1b36fcadfbf07048c59316342b9ba4c76a9712ccf11fb5757692a1d5515a9b`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Active source boundary: Grammar 9 and CLI Contract 10
- Published package boundary: unchanged `perttool@0.10.5`

## 1. Decision

Accept the atomic public Grammar 9 and CLI Contract 10 planning-pool source
boundary. The active source adds Work, project-owned Event and Activity AoA,
persisted Window, Work order, normalized reshape, current and historical
observation, planning-aware advance cleanup, and exact migration while
retaining the strict DAG as the sole Task and Milestone execution authority.

The public command registry has 67 commands and the schema catalog has 26 root
artifacts. Root and Node expose 139 runtime values each, and the portable Core
exposes 51. The new planning commands are eleven closed operations under
`work` and `window`; existing command meanings, Grammar 1 through 8 reads,
governance, plan assurance, milestone acceptance, actuals, velocity,
historical DAG, and safe-write rules remain compatible.

Every planning mutation remains preview first, source-digest bound,
governance checked, plan-assurance checked, and safely persisted. Canonical
planning destruction has an independent exact Git baseline guard. A reshape
apply additionally requires the normalized preflight hash and an opaque,
single-use, expiring token whose store retains only token digests. LLM
self-review is not persisted.

This source acceptance does not publish a package, move an npm dist-tag,
activate editor or MCP mutation, write a remote, mutate an Issue, register the
task outcome, accept a reached milestone, or advance the plan.

## 2. Evidence chain

### C-POOL-PUBLIC-001 `high`, accepted

Claim: Grammar 9 and CLI Contract 10 can activate the accepted Planning Pool
model atomically without weakening strict DAG authority, duplicating execution
facts, or bypassing governance, assurance, Git history, and safe persistence.

Evidence:

- `E-POOL-PUBLIC-001`: the accepted planning-pool contract fixes Work as the
  temporary non-DAG meaning owner, Event and Activity as project-owned AoA,
  Task and Milestone as strict-DAG projection targets, Window as a persisted
  observation contract, and Git as the owner of retired history.
- `E-POOL-PUBLIC-002`: the active Grammar 9 parser, formatter, migration, and
  Contract 10 Application composition retain Grammar 1 through 8 behavior and
  expose the accepted planning semantics through one source-bound runtime.
- `E-POOL-PUBLIC-003`: the registry, Help, Guide, CLI dispatcher, root and Node
  facades, portable Core, and strict schemas agree on 67 commands, 26 root
  schemas, 139 root exports, 139 Node exports, and 51 Core exports.
- `E-POOL-PUBLIC-004`: the real CLI acceptance performs Work and Window reads,
  current observation, Window mutation, preflight and token-bound reshape
  apply, Grammar 8 to 9 migration, one-based planning spans, and strict schema
  validation of every returned planning result.
- `E-POOL-PUBLIC-005`: planning-aware `dag advance` removes only links owned by
  removed Task and Milestone declarations, optionally archives only an already
  empty and unreferenced Work, and protects canonical planning ranges with an
  exact current, `HEAD`, and stage-0 Git baseline.
- `E-POOL-PUBLIC-006`: the complete repository, static, documentation,
  self-use, adapter, temporary-link, and isolated-package gates pass without a
  new complexity or duplication exception.

Action:

- `A-POOL-PUBLIC-001`, implementation permitted, executed: activate Grammar 9
  and CLI Contract 10, the eleven planning commands, five replacement or new
  result identities, strict schema artifacts, Help and Guide, public Core,
  root and Node facades, Application and CLI composition, safe persistence,
  history guard, migration, compatibility checks, installed workflows, and
  this acceptance record.

## 3. Active public contract

The eleven new commands are:

```text
work list
work show
work observe
work reshape preflight
work reshape apply
window list
window show
window observe
window add
window set
window close
```

Their public result identities are
`Perttool.PlanningPoolResult.v1`,
`Perttool.PlanningReshapePreflightResult.v1`, and
`Perttool.PlanningMutationResult.v1`. Contract 10 also replaces
`Perttool.AdvanceResult.v3` with `Perttool.AdvanceResult.v4` and
`Perttool.UnitMigrationResult.v4` with `Perttool.UnitMigrationResult.v5`.
The old active schema files are not retained beside their replacements.

`document migrate --target-grammar 9` performs the explicit Grammar 8 to 9
migration. `project migrate-unit` uses result model 5 and includes Activity
duration and three-point fields in the exact source inventory. The migration
result schema is a closed union for project unit migration and document
grammar migration rather than a permissive shared object.

The public portable Core exposes Planning Pool read, observation, reshape
preflight, reshape apply preparation, Window audit, and the token registry.
The token registry uses an OS temporary, per-user store for CLI process
continuity; it persists only digests and bounded metadata, never the opaque
token value. The Node-only Git and persistence composition remains outside the
portable Core.

Historical observation reuses the accepted immutable first-parent Git
evidence and Planning Pool History Core. Current valid source remains
authoritative and historical identity alone cannot establish continuous
association or projection meaning.

## 4. Mutation and history boundary

Work reshape follows one normalized semantic accounting plan: enumerate every
pre-reconstruction element, record its origin and destination or explicit
discard, enumerate the post-reconstruction elements, and audit the final
candidate. Preflight returns the canonical normalized input, audit facts,
candidate binding, SHA-256 hash, and opaque token. Apply requires both exact
values, revalidates the current source and request, and consumes the token once.

Window add, set, and close retain the accepted advisory planning semantics.
Close contracts only the selected Window and carries Work only when explicitly
requested. Planning projections never create another Task, Milestone, actual,
or outcome authority.

In-place canonical destruction captures the existing raw-byte source, `HEAD`,
stage-0 index, repository snapshot, and path binding before write and rechecks
the baseline immediately before persistence. Preview, separate output, no-op,
denied, and noncanonical-only operations do not require that destructive Git
proof. The force option remains explicit in the result and does not weaken any
independent governance or plan-assurance decision.

## 5. Verification

The accepted candidate passed:

- the complete 1,296-test repository regression gate under Node.js 25.1.0;
- 50 focused Planning Pool public, history, projection, reshape, Window, and
  document-session tests after the responsibility decomposition;
- strict Draft 2020-12 compilation and real-result validation for all 26 root
  schemas, including every planning result and both unit-migration branches;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 at 147 clones, 2,743 duplicated lines, and 2.718%, below
  the unchanged 148-clone and 2,746-line ratchet;
- pinned Lizard 1.23.0 across 4,994 functions with no new violation and the
  unchanged 168-entry legacy baseline;
- English-baseline checks across 1,246 text files with three exact allowlisted
  lines, 354 Markdown files, and seven PERT examples;
- read-only self-use checks across 45 plans;
- isolated LSP and MCP package acceptance;
- trusted and untrusted VS Code 1.101.0 install, host, replacement, and
  uninstall acceptance plus the isolated VSIX shell and DAG gate;
- the temporary npm-link installed workflow; and
- one 1,004-file, 3.2 MB package dry run plus installed file-first,
  plan-assurance, schema, guidance, compatibility, and planning-boundary
  replays.

The desktop process supplied `TEMP` and `TMP` on Windows DrvFs, whose POSIX
mode projection made three permission-only safe-write assertions fail during
the first ambient run. The unchanged tests passed with Linux
`TMPDIR=/tmp`, `TMP=/tmp`, and `TEMP=/tmp`; the final complete repository and
all isolated package gates used that supported POSIX temporary root. No
product behavior or test expectation was weakened for the rerun.

## 6. Deferred boundaries

This acceptance does not complete `PLANNING_POOL_ACCEPTANCE`. That task still
owns the end-to-end trace across every normative use case and final acceptance
boundary. Editor mutation, MCP mutation, public VSIX publication, package
release selection, npm publication or dist-tag movement, remote writes, Issue
mutation, task-outcome registration, reached-milestone evidence, and canonical
plan advance remain separate.

`PLANNING_POOL_PUBLIC_CONTRACT` may be marked complete in its exact
pre-advance plan. Its conformant outcome remains a separate candidate-bound
owner-confirmed mutation after the implementation commit.
