# Changelog

This project records its notable changes here. The format is based on [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/lang/ja/).

## [Unreleased]

## [0.5.0] - 2026-07-29

Contract 6 beta release. This version atomically publishes Grammar 5,
explicit task lifecycle evidence, read-only Git history and velocity
observation, and the English repository baseline. It intentionally changes
every CLI JSON envelope and several result identities while retaining
suffix-free `0.x.x` beta product maturity.

### Added

- Activated Grammar 5 task-owned work events and preview-first
  `task start|suspend|resume` plus eventful `task finish` with explicit event
  time, exact active time, exact person effort, deterministic event identity,
  governance, and safe-write controls.
- Added read-only first-parent `project history` and
  `project observe-velocity`, including explicit-event reconstruction,
  qualified Git-recorded transitions, exact task summaries, and separate
  elapsed-hour, active-date, effort-productivity, and recorded-evidence
  candidates.
- Added public actuals/history/observation Core exports, Contract 6 command
  discovery and Guide topics, Grammar 5 examples, and isolated installed
  lifecycle/history/observation checks.

### Changed

- Activated CLI Contract 6 in the current source. Every JSON envelope now
  reports `cli_contract_version=6`; check, analysis, next, mutation/advance,
  and unit migration use result versions 3, 4, 5, 3, and 3 respectively.
- Added suspended-state analysis and `groups.suspended`, while retaining the
  Recommendation version 1 ranking and
  `recommendation_v1_plus_release_gate` start-authority policy.
- Extended exact unit migration through Grammar 5
  `work_event.planned_value` without changing event time, active time, effort,
  or declared velocity. The prior `0.4.0` artifact remains available as the
  Grammar 4 and CLI Contract 5 compatibility pin.

### Fixed

- Merged adjacent zero-length task-status and work-event insertions so a
  lifecycle mutation can atomically start a task whose declaration ends at
  end of file.

## [0.4.0] - 2026-07-28

Contract 5 beta release. This version atomically publishes Grammar 4 and
owner-aware goal and DAG mutation governance. It intentionally changes every
CLI JSON envelope and the project and mutation result identities while
retaining suffix-free `0.x.x` beta product maturity.

### Added

- Added declared and effective goal/DAG owners and delegates, digest-bound
  pre-change governance snapshots, deterministic actual-change
  classification, normalized caller assertions, and stable pre-change
  authority decisions.
- Added owner-aware persistent direct, batch, and advance operations,
  `Perttool.GovernanceDecision.v1`, PTGOV diagnostics, generated direct-edit
  guidance, and the Contract 5 editing Guide.

### Changed

- Changed every CLI JSON envelope to `cli_contract_version=5`, project
  metadata to `Perttool.ProjectResult.v3`, and mutation and advance results to
  `Perttool.MutationResult.v2` with an embedded governance decision.
- Persistent goal or DAG changes now require `--actor`. An effective owner or
  delegate has direct authority; another actor must supply repeatable
  `--accepted-by-owner` caller assertions for every affected effective owner.
- Retained Grammar 1/2/3 compatibility through effective default owner
  `user`, the complete Contract 4 temporal/deadline/unit-migration surface,
  and NextResult v4 normal start authority.
- Accepted the `perttool@0.3.0` Contract 4 beta and promoted it to npm
  `latest` through a separate, explicitly authorized post-acceptance dist-tag
  operation. npm `beta` and `latest` now resolve to `0.3.0`; product maturity
  remains beta.

## [0.3.0] - 2026-07-26

Contract 4 beta release. This version atomically publishes temporal and
deadline-aware planning, exact unit migration, and Grammar 3. It intentionally
changes public result identities and extends the CLI surface while retaining
suffix-free `0.x.x` beta product maturity.

### Added

- Added Grammar 2 project `as_of`, milestone `deadline`, and task
  `not_before`/`deadline` fields, plus Grammar 3 exact reduced Fraction
  Durations alongside ordinary Decimals.
- Added exact release-aware precedence and heuristic resource schedules,
  deterministic calendar projection, and separate task, milestone, and
  project deadline evidence in `Perttool.AnalysisResult.v3`.
- Added preview-first `project migrate-unit` with complete Duration inventory,
  exact Point/hour/day conversion, Decimal-or-Fraction output, coordinated
  grammar upgrades, velocity disposition, no-op/repeat behavior, qualified
  inverse results, and digest-locked safe writes through
  `Perttool.UnitMigrationResult.v2`.

### Changed

- Activated CLI Contract 4 through one 28-command registry that drives
  dispatch, option validation, text/JSON help, structured recovery, temporal
  entity mutation, Guide, README, and installed-package behavior.
- Replaced the public check, project, analysis, and next projections with
  their accepted Contract 4 identities. `Perttool.NextResult.v4` preserves
  Recommendation v1 ranking and adds fail-closed temporal start authority;
  temporal eligibility gates the recommended set without substituting the
  heuristic scheduler's runnable set.
- Extended the isolated installed-package file-first workflow through Grammar
  3 reads and writes, temporal/deadline analysis, complete NextResult v4,
  forward/repeated/inverse exact migration, and public Core export checks.
- Promoted the accepted `perttool@0.2.0` Contract 3 beta to npm `latest`
  through a separate, explicitly authorized post-acceptance dist-tag
  operation. Contract 4 publication itself keeps `latest` at `0.2.0`.

### Fixed

- Preserved every Contract 3 `task set --clear` value when adding temporal
  task fields to the Contract 4 descriptor.
- Preserved Recommendation set authority when its selected task differs from
  the heuristic resource scheduler's first runnable task.

## [0.2.0] - 2026-07-25

Contract 3 beta release. This version intentionally replaces the Contract 2
command names and JSON envelope while retaining suffix-free `0.x.x` beta
product maturity.

### Changed

- Activated CLI Contract 3 as one breaking source-level cutover: `document
  check|format`, `guide`, and `batch apply` replace the Contract 2 `dsl` and
  `mutation` spellings; every CLI JSON envelope now identifies contract 3;
  command dispatch, validation, and text/JSON help share the active typed
  registry; and obsolete spellings fail with structured usage recovery.
- Accepted the complete file-first Contract 3 workflow from an isolated
  installed tarball, covering initialization, direct file inspection, every
  project/task/gate/milestone/resource field, analysis, recommendation,
  completion, advance, and final validation without manual `.pert` rewriting.
- Selected suffix-free beta `0.2.0` as the first Contract 3 package target and
  added a gated release plan that separates local preparation from explicitly
  authorized Git, GitHub, and npm distribution; package, lockfile, and CLI
  identity are prepared as `0.2.0`.
- Promoted the accepted `perttool@0.1.0` beta to npm `latest` through an explicit post-release dist-tag operation. This changes the default install target without changing beta product maturity.
- Lowered the source and next-release runtime baseline from Node.js 24 to maintained Node.js 22, with CI coverage for Node.js 22 and 24.
- Reworked the root README as a user guide with `npx` and `npm exec` examples, and moved repository setup and verification to `docs/development.md`.
- Recorded the complete English-surface inventory, Unicode allowlist, CLI/LLM surface review, and the structured-help, project-init, and gate-mutation backlog.

### Added

- Public `help` command discovery, separate `guide` domain topics,
  preview-first `project init`, and direct source-preserving
  `gate add|set|remove` commands.

## [0.1.0] - 2026-07-23

First beta release. This suffix-free `0.x.x` series remains prerelease product maturity, permits intentional alpha incompatibility, and publishes through the npm `beta` dist-tag without moving `latest`.

### Added

- Read-only `agent help`, which exposes offline profiles for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity from the same Core as index/quick/detail text/JSON
- `project show`, which retrieves complete project metadata including velocity as text/JSON; preview-first `project set` for localized updates; and `project.set` for atomic batches
- An explicit independent post-first-beta backlog for an LSP server, a VSIX with syntax highlighting/LSP client, and an MCP server

### Changed

- Defined the first beta as suffix-free `0.1.0` and subsequent `0.x.x` releases as beta, removing strict compatibility from alpha and additional soak time from the beta gate
- Added the read-only AI Agent Guidance Registry from Issue #2 to beta acceptance criteria and macro/detail plans
- Adopted English as the canonical repository language without i18n and added a phased, post-beta migration plan for legacy Japanese surfaces

## [0.1.0-alpha.2] - 2026-07-23

Second public development preview. Adds safe editing and advance operations, Mermaid round trips, and explainable task recommendations, and distributes the same artifact to GitHub Releases and npm's `alpha` tag.

### Added

- `dsl format`; atomic `--write` for task/milestone/resource/batch mutation; exclusive `--out`; and `--expect-digest`
- Semantic records, integrity digests, fail-closed import design contracts, and normative artifacts for `Perttool.MermaidProfile.v1`
- `exportMermaid` Core and lossless/plain profiles, analysis annotations, strict loss, and exclusive `--out` for `dag render --to mermaid`
- `importMermaid` Core and fail-closed profile restoration, plain loss reports, strict loss, and exclusive `--out` for `dag import --from mermaid`
- Pure `planAdvance` Core guaranteeing canonical keep/remove sets, partial joins, and idempotence, plus preview-first `dag advance` CLI
- Complete recommendation graph with exact typed facts, comparisons, decision traces, and canonical descriptions, plus the public `NextResultV3` Core type
- Recommendation shadow gate and golden tests that inspect the v3 contract, byte determinism, operational compatibility, and structured why-not across five self-use plans
- Read-only `validateOverride` Core returning feasible replacements, `PTOVR-101` through `PTOVR-106`, caller-asserted human reasons, normal-trace references, and deterministic `Perttool.OverrideDecision.v1`
- Shared instructions, help, and unknown-version safe-stop dry run that adopt complete, known `NextResult.v3` as the normal AI task-selection authority
- Package preflight that checks npm publish normalization, a maintainer script that fail-closed publishes the identical tarball, and fixed `alpha` dist-tag

### Changed

- Changed the default `dag next` JSON from `Perttool.NextResult.v2` to `Perttool.NextResult.v3` as a pre-release breaking change, publishing Core, CLI JSON/text, help, and package atomically
- Corrected `bin.perttool` to canonical `dist/cli.js` so npm does not remove the CLI entry point

## [0.1.0-alpha.1] - 2026-07-21

First public development preview. Intended to evaluate the DSL and CLI, read-only plan checking and analysis, and next-task selection. It is not a stable MVP and may include incompatible changes.

### Added

- Activity-on-Arrow DSL parser, semantic/graph validation, and multiple-error recovery
- PERT/CPM precedence analysis and critical-path enumeration using exact Rational values
- Deterministic `parallel-sgs` heuristic schedule handling renewable resource capacity
- Mechanical determination of `active`, `ready`, `runnable_now`, `blocked_now`, and `upcoming`
- Day/hour forecasts from point estimates and project-wide velocity
- Text/JSON CLI, structured help, stable diagnostic codes, and source spans
- CLI installation through `npm link` and GitHub Release tarballs

### Known limitations

- `dsl format`, task/milestone/resource mutation, and `dag advance` are unimplemented
- Mermaid import/export is unimplemented
- The resource schedule is a heuristic with `optimal=false`, not an exact optimum
- Not published to the npm registry; use the GitHub Release asset
- Requires Node.js 24 or later

[Unreleased]: https://github.com/mako10k/perttool/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/mako10k/perttool/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mako10k/perttool/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mako10k/perttool/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mako10k/perttool/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mako10k/perttool/compare/v0.1.0-alpha.2...v0.1.0
[0.1.0-alpha.2]: https://github.com/mako10k/perttool/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/mako10k/perttool/releases/tag/v0.1.0-alpha.1
