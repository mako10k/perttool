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
