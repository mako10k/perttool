# Milestone Acceptance Public Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-12
- Workstream: `MILESTONE-ACCEPT-001`
- Task: `MILESTONE_ACCEPTANCE_PUBLIC`
- Source grammar: Grammar 7
- CLI contract: Contract 8
- Release effect: none

## 1. Accepted scope

This record accepts the atomic source-level activation of milestone acceptance
through the CLI, public package root, command registry, Help, Guide, JSON
Schema catalog, temporary-link workflow, and isolated installed-package
workflow. Graph closure and milestone acceptance remain separate projections.
The accepted implementation adds committed preparation-only migration,
complete criterion-set replacement, caller-asserted evidence receipts, and an
all-or-nothing acceptance guard around canonical advance.

The activation does not select a release, change package version `0.8.0`,
publish a package or extension, move a dist-tag, mutate an Issue, perform a
remote write, or advance `plans/milestone-acceptance.pert`.

## 2. Atomic public boundary

The active boundary is one coordinated set:

- Grammar 7 and CLI Contract 8;
- 53 exact command paths, including the seven three-token
  `milestone acceptance` paths and `document migrate --target-grammar 7`;
- 23 active root schemas and 22 command-result identities;
- `Perttool.CheckResult.v5`, `Perttool.AnalysisResult.v6`,
  `Perttool.NextResult.v7`, `Perttool.MutationResult.v5`, and
  `Perttool.AdvanceResult.v3`;
- `Perttool.MilestoneAcceptanceMigrationResult.v1` and
  `Perttool.MilestoneAcceptanceResult.v1`;
- 129 runtime keys in both the root and Node package facades, with the
  adapter-facing Node implementations of check, analyze, and Next retained at
  their Contract 7 semantic boundary until the separate adapter task; and
- one package-root semantic owner for Grammar 7 check, analysis, Next,
  migration, mutation, and advance composition.

The active schema catalog contains no superseded Check, Analysis, Next,
Mutation, or Advance root. Older Grammar 1 through 6 documents remain
readable under Contract 8 and project `acceptance=null`. Their canonical
advance fails with `PTMAC-101` before Git inspection, rather than silently
continuing without milestone acceptance.

## 3. Migration and mutation evidence

Migration accepts only an exact committed repository, path, `HEAD`, stage-0
blob, and source-digest proof. It creates Grammar 7 with an empty criterion
inventory and a durable grandfather record; it does not infer criteria or
evidence. The write path rechecks the captured proof and returns `PTMAC-110`
without writing when the source or repository baseline races.

`document check` emits `PTMAC-102` for a non-grandfathered milestone without a
criterion set. Criterion replacement is one complete-set revision and never
implicitly continues a prior revision. Verification, failure, unavailable,
revocation, and waiver receipts bind the exact set and criterion revision.
All writes reuse the existing DAG-owner governance boundary and the standard
preview, expected-digest, warning, and safe-write controls.

The acceptance-aware advance planner first constructs one provisional graph
candidate, identifies every affected milestone, and then either produces one
byte-identical canonical candidate or blocks the entire operation. It composes
acceptance, assurance, governance, repository-history, and final race guards;
there is no partial advance and no `--force-history-loss` bypass for the
acceptance guard.

## 4. Verification

The accepted gate is:

```sh
npm run typecheck
npm test
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:lsp-package
npm run check:mcp-package
npm run check:vsix-shell
npm run check:link
npm run check:package
npm run check
git diff --check
```

The complete gate passed on 2026-08-12. `npm test` passed 1,020 tests with no
failure, skip, or cancellation. Read-only self-use passed check, analysis, and
Next for all 37 plans. Temporary-link and isolated-package workflows exercised
Contract 8 without a registry mutation; the packed public inventory contained
705 files. Focused source, evaluator, mutation, advance, CLI, schema, Help,
Guide, package-root, compatibility, and migration-race cases also passed.

After the gate, one previewed status-only mutation completed
`MILESTONE_ACCEPTANCE_PUBLIC`. It changed the plan digest from
`sha256:199219dc...a95e3d` to `sha256:159fe5d7...e0a748`; governance was not
applicable to the lifecycle-only edit, and the expected-digest in-place write
was read back successfully. Post-write focused tests, the 37-plan self-use
gate, and `git diff --check` passed. Fresh complete NextResult v7 reports
`MILESTONE_ACCEPTANCE_HISTORY` and `MILESTONE_ACCEPTANCE_ADAPTERS` as ready,
and recommends and authorizes only `MILESTONE_ACCEPTANCE_HISTORY`.

## 5. Remaining boundary

Historical checkpoint reconstruction remains
`MILESTONE_ACCEPTANCE_HISTORY`. Read-only LSP, VSIX, and MCP acceptance
projection remains `MILESTONE_ACCEPTANCE_ADAPTERS`. Their joined repository
acceptance remains `MILESTONE_ACCEPTANCE_ACCEPTANCE`.

This record does not authorize either successor, plan advance, release
selection, Git commit or push, GitHub mutation, npm publication, dist-tag
movement, public VSIX publication, Issue mutation, external verification, or
downstream task-assurance invalidation.
