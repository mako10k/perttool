# Contract 9 Public Integration Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-18
- Workstream: `TEMPORAL_PUBLIC_CONTRACT_DETAIL`
- Task: `DETAIL_PUBLIC_INTEGRATION`
- Source grammar: Grammar 8
- CLI contract: Contract 9
- Release effect: none

## 1. Accepted scope

This record accepts the atomic source-level activation of Grammar 8 and CLI
Contract 9 across the CLI, root and Node facades, private read-only adapters,
Help, Guide, schema registry, compatibility fixtures, self-use, temporary-link,
and isolated installed-package workflows. The activation includes calendar and
availability maintenance, temporal constraints and schedules, POSTDUE
projection, source-preserving mutation, formatting, and Grammar 7 to Grammar 8
migration.

The activation does not select a release, change package version `0.9.4`,
publish a package or extension, move a dist-tag, mutate an Issue, perform a
remote write, complete the parent `TEMPORAL_PUBLIC_CONTRACT` task, run the
separate `TEMPORAL_ACCEPTANCE` task, or advance either plan.

## 2. Atomic public boundary

The accepted current boundary is one coordinated set:

- Grammar 8 and CLI Contract 9;
- 56 command paths and 23 active root schemas;
- 129 root and Node runtime exports and 45 portable Core runtime exports;
- `Perttool.ProjectResult.v5`, `Perttool.CheckResult.v6`,
  `Perttool.AnalysisResult.v7`, `Perttool.NextResult.v8`,
  `Perttool.MutationResult.v6`, `Perttool.PlanAssuranceResult.v2`, and
  `Perttool.UnitMigrationResult.v4`;
- unchanged `Perttool.AdvanceResult.v3`;
- one Contract 9 envelope across success, failure, preview, output, and
  in-place write paths; and
- retained Grammar 1 through 7 reads without presenting superseded result
  schemas as active canonical roots.

The MCP adapter resolves the replacement Analysis and Project schema
definitions locally. Guide and override validation name the active NextResult
identity, and the package inventory contains the replacement schemas without
their superseded canonical files.

## 3. Persistence and compatibility evidence

Legacy Grammar 1 through 7 formatting retains its established formatter,
while Grammar 8 uses the temporal source formatter. Legacy mutation and unit
migration planners lift one complete candidate into Grammar 8 without changing
their source-preservation boundary.

The shared CLI writer validates Grammar 8 candidates with the complete
Contract 9 checker before and after persistence. Grammar 7 keeps its milestone
acceptance validator, and Grammar 1 through 6 keep their existing target
validator. Installed-package acceptance proved that `project migrate-unit
--write` persists the same valid Grammar 8 candidate that preview produced.

The package assurance workflow separately proves sealed Grammar 6
compatibility and an unsealed Grammar 7 to Grammar 8 migration. It does not
bypass the committed Grammar 6 to Grammar 7 migration proof or the separate
plan-assurance model-2 initialization boundary.

## 4. Verification

The complete local gate passed on 2026-08-18:

- all 1,212 tests passed with zero failures;
- the static gate passed at 3.069% duplication and 4,069 functions with the
  unchanged 170-entry legacy complexity baseline;
- the English baseline checked 1,036 files and exactly three allowlisted
  lines;
- documentation checks covered 303 Markdown files and seven PERT examples;
- read-only self-use passed for all 43 plans;
- isolated LSP and MCP, the supported-host VSIX gate, temporary-link, and
  npm-link workflows passed;
- `check:package` passed the npm publication dry run and both installed-package
  Contract 9 file-first and plan-assurance compatibility workflows; and
- `git diff --check` passed.

No registry, Git remote, GitHub, Issue, or public VSIX mutation occurred.

## 5. Lifecycle and remaining boundary

The detail task lifecycle was closed once at
`2026-08-18T13:05:56+09:00`. The expected-digest in-place write changed the
detail-plan digest from
`sha256:001b96c03db954e916a0a7f743f63295deef83f39d4a3658ea57aa87dd08a022`
to
`sha256:45d20434bb13665256d8dee376c6d39d7a41d0249119e8012b1bbe1c95d8a4c7`.
Readback reports no remaining, ready, recommended, or startable detail task.

The authoritative parent task `TEMPORAL_PUBLIC_CONTRACT` and the independent
cross-surface `TEMPORAL_ACCEPTANCE` task remain separate local gates. Release
selection, release planning, candidate commitment, tag and publication
operations, dist-tag movement, Issue mutation, and plan advance remain outside
this acceptance.
