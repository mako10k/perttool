# Contract 9 Public Integration WIP Handoff — 2026-08-17

## Scope and authority

This handoff stops the local `DETAIL_PUBLIC_INTEGRATION` implementation slice at the end of 2026-08-17. It records an unfinished WIP state only. It does not authorize task completion, assurance evidence, plan advance, release selection, GitHub Issue mutation, npm publication, dist-tag movement, or public VSIX publication.

## Frozen repository state

- Branch: `wip/declaration-identity-release-20260806`
- Implementation commit: `25f8b2ea39ef6e438bfa15de6357e66b40a99f4a`
- Active plan: `plans/temporal-public-contract.pert`
- Plan source digest: `sha256:001b96c03db954e916a0a7f743f63295deef83f39d4a3658ea57aa87dd08a022`
- Active task: `DETAIL_PUBLIC_INTEGRATION`
- Current public projection: Grammar 8, CLI Contract 9, 56 commands, 23 root schemas, and 129 root runtime exports

## Completed in this WIP slice

- Activated the Contract 9 Application facade across the root, Core, CLI, MCP read adapter, command discovery, Guide, and schema registry.
- Activated the seven replacement result identities: Project v5, Check v6, Analysis v7, Next v8, Mutation v6, PlanAssurance v2, and UnitMigration v4.
- Preserved AdvanceResult v3 and the existing historical release artifacts.
- Added public calendar command dispatch and Grammar 7 to Grammar 8 document migration dispatch.
- Preserved Grammar 8 temporal declarations while lifting legacy mutation and unit-migration candidates.
- Moved all seven Contract 9 schema artifacts from the staging directory to their canonical `schemas/` paths. `npm pack --dry-run` confirmed that all seven canonical paths are bundled.
- Restored the pinned complexity gate without raising its baseline by extracting milestone criterion parsing.

## Verified evidence

- `npm run build --silent`: passed.
- `npm run check:static --silent`: passed; duplication was 3.051%, and complexity passed with 4,068 functions and 170 retained legacy entries under Lizard 1.23.0.
- Focused Contract 9 and adapter gate: 61 tests passed, 0 failed.
- Real CLI `project migrate-unit plans/temporal-public-contract.pert --to-unit point --format json` returned `Perttool.UnitMigrationResult.v4` under CLI Contract 9.
- Real CLI plan reads returned `Perttool.CheckResult.v6` and `Perttool.NextResult.v8` for the frozen plan digest.
- `DETAIL_PUBLIC_INTEGRATION` remains `active`; the current Next result has no new start recommendation because the task is already active.

## Incomplete evidence and known failures

- The complete test suite is not accepted. The last completed baseline before this integration commit had 1,091 passes and 121 failures out of 1,212 tests, primarily because tests and goldens still asserted the former current Contract 8 boundary.
- A post-commit full-suite run was intentionally interrupted at shutdown and therefore has no valid aggregate count. Its observed failures again included old current-boundary names such as Contract 8 Guide/envelopes, NextResult v7, historical release-readiness tests that coupled release facts to the live runtime, and old override/recommendation wire expectations.
- The failures have not yet been classified one by one. Do not treat all of them as harmless golden drift; each must be separated into a current-boundary assertion to supersede, an immutable historical-release assertion to preserve, or a real Contract 9 regression.
- CLI implementation still contains internal Contract 8 compatibility names and literal version fields. JSON output is normalized by the Contract 9 writer, but every public path still needs a direct identity audit before acceptance.
- Milestone-acceptance mutation output and unit-migration persistence need focused in-place/out/preview replay under their replacement identities.

## Exact restart boundary

1. Verify the branch, clean worktree, local/remote SHA, active plan digest, and `DETAIL_PUBLIC_INTEGRATION=active` before editing.
2. Run the complete suite to completion and retain its machine-readable failure inventory.
3. Classify each failure as current-boundary supersession, immutable historical fact, or implementation regression. Preserve historical release claims; update only tests that intentionally assert the live current boundary.
4. Audit all 56 CLI paths for Contract 9 envelope and replacement-schema identity, including failure and write modes.
5. Run the complete static, test, self-use, adapter, temporary-link, and isolated-package gates.
6. Only after those gates pass, write the public-integration acceptance record and complete `DETAIL_PUBLIC_INTEGRATION`. Assurance evidence and plan advance remain separate confirmations.

## Explicitly unchanged boundaries

- Package version remains `0.9.4`.
- No release, tag, npm, dist-tag, GitHub Release, Issue, or public VSIX mutation was performed.
- No plan task was completed or advanced in this shutdown slice.

## Continuation update (2026-08-18)

The resumed local worktree remains on
`wip/declaration-identity-release-20260806` at
`613bdec769ee2da98a1c55ef04a8578bc2565d7c` before the uncommitted continuation
changes. `DETAIL_PUBLIC_INTEGRATION` remains active; no plan mutation, external
write, release, or publication action was performed.

This continuation corrected three active-boundary test groups and one runtime
compatibility regression:

- `test/command-registry.test.mjs` and `test/command-discovery.test.mjs` now
	assert the active Contract 9 registry: 56 commands, calendar commands,
	Contract 9 discovery, and the seven replacement result identities.
- `test/cli.test.mjs` now asserts Contract 9 result identities for live check,
	guide, analysis, next, mutation, and project-show operations.
- `src/application/contract9-runtime.ts` now routes Grammar 1 through 7
	`document format` requests through the retained Contract 8 formatter while
	retaining the Grammar 8 temporal formatter. This restores legacy-format
	compatibility without changing the Contract 9 CLI envelope.

Focused verification passed:

- 16 Contract 9 registry, discovery, and public-integration tests passed;
- all 46 `test/cli.test.mjs` tests passed after the formatter correction; and
- the complete suite completed with 1,103 passes and 109 failures out of 1,212
	tests.

The full-suite failure count fell by 12 from the prior 1,091-pass / 121-fail
baseline. The remaining failures still need individual classification. The
observed groups include active-boundary expectations for Contract 8 and the
seven superseded result identities, and historical release or completed-plan
tests that currently read the live registry, schema catalog, CLI, Core, Node,
or adapter result instead of a historical artifact. Do not bulk replace those
historical assertions: preserve their released facts and make their fixtures
or installed-artifact boundaries explicit.

The same continuation then corrected the public override-validation seam.
`validateOverride` now accepts only the active `Perttool.NextResult.v8` source
identity, retains `Perttool.OverrideDecision.v1`, and rebinds the canonical
artifact digest to that source identity. The active Guide now names
`NextResult.v8` consistently for consumer safety, authority adoption, and
override validation. Static checks passed, and the focused override,
recommendation-publication, legacy scheduling, and unit-migration group passed
all 29 tests. A later complete-suite replay still failed, so public-integration
acceptance and task completion remain unavailable. The remaining observed
failures continue to include active catalog expectations and historical tests
coupled to the live 56-command registry.

## Final continuation evidence (2026-08-18)

The remaining live-boundary assertions were classified and corrected without
rewriting immutable release facts. The current schema catalog now contains the
seven Contract 9 replacement identities and no longer exposes their superseded
canonical files. The MCP adapter closes the new Analysis v7 and Project v5
schema references, and the active Guide, override validation, package scripts,
and current-runtime tests consistently project CLI Contract 9 and 56 commands.

One real persistence regression was found during the installed-package gate:
the shared CLI candidate writer sent every non-Grammar-7 candidate through the
Grammar 6 validator. `project migrate-unit --write` could therefore preview a
valid Grammar 8 candidate but rejected that same candidate before persistence.
The writer now selects the complete Contract 9 validator for Grammar 8 while
retaining the existing Grammar 7 and Grammar 1 through 6 paths. The package
assurance workflow also keeps sealed Grammar 6 compatibility separate from an
independent unsealed Grammar 7 to Grammar 8 migration; it does not bypass the
protected Grammar 6 to 7 migration or plan-assurance model-2 initialization.

Current verification is complete for this WIP implementation slice:

- the full test suite passed all 1,212 tests;
- `check:static` passed at 3.069% duplication and 4,069 functions with the
  unchanged 170-entry legacy complexity baseline;
- English, Markdown, 43-plan self-use, isolated LSP and MCP, supported-host
  VSIX, temporary-link, and npm-link gates passed; and
- `check:package` passed the npm dry run and both installed-package Contract 9
  file-first and plan-assurance compatibility workflows.

`DETAIL_PUBLIC_INTEGRATION` remains active. This record does not complete or
advance the plan and does not authorize a commit, release, remote write,
publication, dist-tag change, Issue mutation, or public VSIX operation.
