# Repository Guidelines

## Scope and communication

These instructions apply to the entire repository. English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English. Japanese-script content in tracked artifacts is permitted only through the exact versioned allowlist; do not translate user-authored content or intentional Unicode fixtures opportunistically.

User communication is independent from the repository baseline. Unless the user requests otherwise, respond to the user in Japanese. Preserve user-authored `.pert` content and intentional Unicode fixtures. Do not add runtime i18n, locale negotiation, translation catalogs, or a `--locale` option without a new requirement and architecture decision.

- Distinguish directly verified facts, inferences, and unverified matters.
- Verify the current checkout, normative documents, and command results before making a judgment.
- Do not infer or invent commands, files, package scripts, or operational rules that do not exist.
- Do not substitute user-provided terms or completion criteria with a different meaning merely because it is easier to implement.

## Current phase and sources of truth

perttool has accepted its TypeScript CLI MVP and the read-only AI Agent
Guidance Registry v1 from Issue #2, and has durably accepted suffix-free beta
releases through `v0.5.5`. Version `0.5.5` retains Grammar 5 and CLI Contract
6 while adding non-blocking `PTGOV-104` when an applicable preview already
carries an owner assertion. Version `0.5.4` remains the PTGOV-103,
beta-channel, and scope-guidance artifact, and `0.5.2` remains the complete
nested-schema and full/outline/detail schema-view artifact. The obsolete npm
`alpha` dist-tag is retired, while historical `0.1.0-alpha.2` remains
available by exact pin. Version `0.5.1` remains the initial schema-discovery
Contract 6 artifact, `0.5.0` remains the pre-schema Contract 6 artifact,
`0.4.0` remains the Contract 5 compatibility artifact, and `0.3.0` and
`0.2.0` remain the prior Contract 4 and Contract 3 artifacts, all available by
explicit pin. npm reports `beta=latest=0.5.5` and no `alpha`. The current
source implements Grammar 1/2/3/4/5 reads,
registry-driven Contract 6 `help`, separate Contract 6 `guide`, temporal and
governed project/task/gate/milestone/resource maintenance, exact lifecycle
events, read-only project history and velocity observation, exact
`project migrate-unit`, `Perttool.ProjectResult.v3`,
`Perttool.MutationResult.v3` with `Perttool.GovernanceDecision.v1`,
`Perttool.AdvanceResult.v1` with history-safety model 1,
`Perttool.AnalysisResult.v4`, `Perttool.NextResult.v5`,
`Perttool.UnitMigrationResult.v3`, read-only `validateOverride`,
source-preserving mutation, and authorization-before-safe-write controls. It
bundles complete artifacts for all eighteen active command-result identities
plus public library-only `Perttool.OverrideDecision.v1`, exposes the additive
read-only `schema` command and public catalog APIs, accepts Git 2.54 strict ISO
UTC `Z` commit metadata, rejects retired alpha publication, and projects
human-readable scope-bound owner-confirmation guidance. Version `0.5.5` emits
PTGOV-104 without changing its candidate, decision, default success, or
persistent authority. Issue #5 closure remains a separate decision. A
complete and known `Perttool.NextResult.v5` with a
complete temporal start-authority projection is the normal AI task-selection
authority. The macro plan is complete and has no ready task. The independent
English-baseline detail plan has completed and advanced all nine tasks through
`ENGLISH_ACCEPTANCE`; Git commit `2001cdf` records the exact completed
final-task pre-advance snapshot, `docs/process/english-baseline-acceptance.md`
records the cross-surface trace, and complete NextResult v5 has no ready,
recommended, or startable task.

The explicitly selected `ADV-001` workstream is tracked independently in
`plans/advance-history-safety.pert`. `ADV_HISTORY_CONTRACT` is complete; Git
commit `2c08618` records its exact pre-advance snapshot, and the task is
advanced to reached `ADV_HISTORY_CONTRACT_ACCEPTED`. The
accepted `docs/specs/advance-history-safety.md` fixes history-safety model 1:
entity/field-owned destructive records, exact raw-byte `HEAD` and stage-0
index proof, retained-dirty behavior, linked-worktree and complete
repository-baseline race boundaries,
the narrow `--force-history-loss` target, `Perttool.AdvanceResult.v1`,
`PTADV-101` through `PTADV-103`, human-readable modification time, byte-size
and diff context, and eighteen machine-readable acceptance cases. Its
acceptance record is
`docs/process/advance-history-contract-acceptance.md`. Published `0.5.5`
remains unchanged and does not include ADV-001. `ADV_HISTORY_PROBE` is
complete and advanced; Git commit `4265621`
records its exact completed 4p pre-advance snapshot. Its accepted internal
read-only `HEAD`/stage-0-index capture and pure destructive-range assessment
pass the complete repository gate. `ADV_HISTORY_CLI` is complete and retained
as the exact pre-advance task snapshot. The current source now exposes the
narrow `--force-history-loss` option, `Perttool.AdvanceResult.v1`, the
complete nineteenth root schema, human-readable guard facts, `PTADV-101`
through `PTADV-103`, and repository/path/`HEAD`/stage-0-index enforcement
before the existing safe write. Preview, separate output, no-op, authority
denial, and prior warning denial do not inspect Git. Retained dirty ranges are
allowed, destructive overlap and unavailable proof block, and a captured
source, `HEAD`, or index race returns exit 5 without writing. Its acceptance
record is `docs/process/advance-history-cli-acceptance.md`. Git commit
`805bdd9` records its exact completed pre-advance snapshot, and commit
`5986cab` advances the plan to reached `ADV_HISTORY_CLI_READY`.
`ADV_HISTORY_ACCEPTANCE` is complete and retained as the exact final-task
pre-advance snapshot. Its accepted eighteen-case repository, real CLI race,
linked-worktree, BOM/CRLF, help, Guide, schema, temporary-link, package-root,
and isolated installed trace is recorded in
`docs/process/advance-history-acceptance.md`. All four tasks and 14p are
complete; precedence and heuristic resource makespans are zero, and complete
NextResult v5 has no ready, recommended, or startable task. Published `0.5.5`
remains unchanged. Release selection, GitHub Issue mutation, npm publication,
dist-tag movement, and the final plan advance remain separate boundaries.

Issue #4 is tracked in the independent `plans/governance.pert` post-beta workstream. All twelve tasks from `GOV_REQUIREMENTS` through `GOV_ACCEPTANCE` are complete and advanced. Grammar 4 parsing, declared/effective metadata and digest-bound snapshots, formatting, project init/show/set and batch fields, unit-migration preservation, deterministic actual-change classification, caller-assertion normalization, pre-change authority decisions, PTGOV diagnostics, governed direct/batch/advance previews, ProjectResult v3, MutationResult v2, GovernanceDecision v1, the complete Contract 5 registry/help/usage projection, guarded in-place/existing-document-out persistence, the exact generated direct-edit warning, and the Contract 5 editing Guide are active through the standard package root, CLI, and installed `0.4.0` and `0.5.0` workflows. Preview, denied, invalid, and stale decisions fail closed before or within the retained safe-write gates. The plan has zero precedence and heuristic resource makespans, no remaining or recommended task, and an observed velocity of `45p/2d`. Issue #4 closure remains a separate authorization boundary. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply, durable audit, and Git integration remain unavailable until MIG-08.

The explicitly selected project-actuals workstream is tracked independently in
`plans/project-actuals.pert`. `ACTUALS_CONTRACT_REVIEW` is complete, its exact
pre-advance snapshot is committed at `f6e93e1`, and the task has been advanced
to reached `ACTUALS_CONTRACT_READY`. `ACTUAL_SOURCE_CORE` is complete, its
exact pre-advance snapshot is committed at `d6d3d7f`, and the task has been
advanced to reached `ACTUAL_SOURCE_READY`. The internal identity-checked
Grammar 5 source Core parses, validates, formats, and projects exact task-owned
work events and the target suspended state while the standard package root,
CLI Contract 5, and Grammar 1 through 4 remain unchanged. Its acceptance
record is `docs/process/project-actuals-source-core-acceptance.md`.
`ACTUAL_GIT_HISTORY_PROBE` is complete, its exact pre-advance snapshot is
committed at `2198a0b`, and the task and satisfied source/history gates are
advanced to reached `HISTORY_INPUT_READY`. Its internal read-only adapter
binds SHA-1/SHA-256 repository snapshots, first-parent path history, raw
source digests, typed incomplete/unavailable causes, linked worktrees, and
source/HEAD races without changing Git or the active public surface.
`FINISH_ACTUALS` is complete, its exact pre-advance snapshot is committed at
`2af13c4`, and the task is advanced to reached `FINISH_ACTUALS_READY`. Its
internal eventful-finish Core provides deterministic identity, exact
active-time and effort input, finish-only and complete coverage,
retry/conflict handling, governed Grammar 5 safe write, and task-owned advance
removal. Its acceptance record is
`docs/process/project-actuals-finish-acceptance.md`. `PROJECT_HISTORY` is
complete, its exact pre-advance snapshot is committed at `c0eff39`, and the
task is advanced to reached `PROJECT_HISTORY_READY`. Its internal pure reducer
reconstructs explicit events, advance removal, qualified legacy Git-recorded
transitions, exact task summaries, and typed incomplete/unavailable outcomes
from the read-only first-parent probe. Its deterministic
`Perttool.ProjectHistoryResult.v1` JSON and text target remained absent until
the later public-contract cutover; its acceptance record is
`docs/process/project-actuals-history-acceptance.md`. `WORK_LIFECYCLE` is
complete; Git commit `518a59e` records its exact completed 7p pre-advance
snapshot, and the task is advanced to reached `LIFECYCLE_READY`. Its
internal lifecycle target provides exact start/suspend/resume candidates,
deterministic retry and refusal, resource release, full remaining-duration
schedules, and separate `Perttool.AnalysisResult.v4` and
`Perttool.NextResult.v5` suspended handling without changing the active
public surface at that slice. Its acceptance record is
`docs/process/project-actuals-lifecycle-acceptance.md`.
`VELOCITY_OBSERVATION` is complete; Git commit `19b060a` records its exact
completed 5p pre-advance snapshot, and the task and satisfied integration
gates are advanced to reached `ACTUALS_INTEGRATED_INPUT`. Its pure service
derives exact elapsed-hour, active-date, effort-productivity, and separately
qualified Git-recorded rates from ProjectHistoryResult v1 without changing
declared velocity. Its acceptance record is
`docs/process/project-actuals-velocity-observation-acceptance.md`.
`ACTUALS_PUBLIC_CONTRACT` is complete; Git commit `753efea` records its exact
completed 6p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_PUBLIC_READY`. The current source atomically activates Grammar 5 and CLI Contract 6 through
the standard parser, formatter, lifecycle and advance mutations, suspended
analysis/Next results, history, observation, package root, the original
33-command cutover registry, help, Guide, result schema identities and projections, diagnostics,
examples, and isolated installed workflow. Its acceptance record is
`docs/process/project-actuals-public-contract-acceptance.md`.
`ACTUALS_ACCEPTANCE` is complete; Git commit `f994fa2` records its exact
completed 4p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_ACCEPTED`. Its complete fourteen-case trace covers requirements,
source, lifecycle, advance, real Git histories, Core, CLI, result projections,
help, package root, temporary link, and isolated installed workflows. Its
acceptance record is `docs/process/project-actuals-acceptance.md`. All nine
tasks and 47p are complete; precedence and the `parallel-sgs` version 1
heuristic resource makespan are both zero with no resource delay. Complete
NextResult v5 has no ready, recommended, or startable task.
Git mutation, automatic velocity adoption, MIG-08, release publication, and
dist-tag movement remain unauthorized. This independent workstream did not
displace the separately selected English-baseline workstream. Backlog `ACT-002` records a request-only REOPEN concept
for completed work. Its feasibility, semantics, implementation, plan, and
public-contract inclusion are all undecided.

The reviewed CLI/help reset is tracked independently in `plans/cli-surface-reset.pert`. All nine tasks from `CONTRACT_V3_DESIGN` through `CLI_003_FILE_FIRST_ACCEPTANCE` are complete and advanced. Its accepted Contract 3 design introduced one typed registry for dispatch, option parsing, text help, and JSON help; separated domain guide and agent guidance; added structured usage recovery, project initialization, and direct gate maintenance; and rejected renamed Contract 2 spellings. Contract 4 retains those invariants while extending every active JSON envelope and the installed-package workflow for temporal and exact-unit behavior. The plan has no remaining or recommended task and an observed provisional `49p/1d` velocity.

The first Contract 3 package, suffix-free beta `0.2.0`, is accepted under `docs/process/0.2.0-release.md` and `docs/process/0.2.0-release-acceptance.md`. All five tasks in `plans/release-0.2.0.pert` are complete and advanced. The release commit and peeled annotated tag agree; the local, GitHub, and npm tarballs have the same SHA-256; and installed-package Contract 3 and file-first checks passed. Publication moved only npm `beta`; after acceptance, the user separately authorized one dist-tag operation that made `beta=latest=0.2.0`. The plan itself remains complete and unchanged, with no remaining or recommended task, zero precedence and heuristic resource makespans, and an observed `17p/2d` velocity.

The accepted Contract 4 release is suffix-free beta `0.3.0`.
`plans/release-0.3.0.pert` independently tracks release
gate design, accepted scheduling-and-units input, source preparation,
candidate acceptance, PUBLISH, and durable acceptance without duplicating
SU-M3/SU-M5 task state. All six release tasks from
`RELEASE_030_GATE_DESIGN` through `RELEASE_030_ACCEPTANCE` are complete and
advanced.
Release commit and peeled tag target `af44577` agree; the GitHub prerelease and
npm registry tarballs have SHA-256 `197548a4...62074`; npm
`beta=latest=0.3.0` and `alpha=0.1.0-alpha.2`. An unqualified global
installation and light Contract 4 smoke passed. The plan has zero precedence
and heuristic resource makespans, no remaining or recommended task, and
observed cumulative velocity `19p/2d`.

The accepted release is suffix-free beta `0.4.0` for the breaking
Grammar 4 and CLI Contract 5 cutover. `plans/release-0.4.0.pert`
independently tracks gate design, accepted governance input, source
preparation, candidate acceptance, PUBLISH, and durable acceptance without
restoring completed governance task state. `RELEASE_040_GATE_DESIGN` is
complete and advanced, and `RELEASE_040_CONTRACT_5_READINESS` is complete and
advanced after accepting the Contract 5 readiness record.
`RELEASE_040_PREPARATION` is complete and advanced after aligning the `0.4.0`
package identity, CHANGELOG, README, Contract 4-to-5 migration guidance,
tests, goldens, and full Node.js 22 repository and installed-package gates.
`RELEASE_040_CANDIDATE` is complete and advanced after the clean source,
version and channel identity, external availability, protected routes, and
full Node.js 22 gates were reverified. The retained 392-file candidate
tarball has SHA-256 `010af9ce...7cc4a`. `RELEASE_040_PUBLISH` is complete and advanced:
release commit and peeled `v0.4.0` target `6b341d1` agree; the candidate,
GitHub, and npm tarballs are byte-identical; npm reports `beta=0.4.0`,
`latest=0.3.0`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks
passed. `RELEASE_040_ACCEPTANCE` is complete after rechecking both public
tarballs. All six tasks and 19p are accepted over two active days and
advanced to reached `RELEASE_040_ACCEPTED`; the plan has zero makespans and no
ready or recommended task. The user separately authorized the later
`perttool@0.4.0` npm `latest` promotion; fresh registry reads and an
unqualified isolated installation confirmed `beta=latest=0.4.0`, CLI
Contract 5, and Grammar 4. Issue #4 closure remains a separate
post-acceptance decision.

The accepted release is suffix-free beta `0.5.0` for the atomic Grammar
5 and CLI Contract 6 cutover. `plans/release-0.5.0.pert` independently tracks
gate design, accepted project-actuals and English-baseline input, source
preparation, candidate acceptance, authorized PUBLISH, durable acceptance,
and the exact post-release local-install boundary. Git commit `1641a32`
records the exact completed gate-design pre-advance snapshot; the task is
advanced to reached `RELEASE_050_GATE_ACCEPTED`.
`RELEASE_050_CONTRACT_6_READINESS` is complete; Git commit `ba84cd8` records
its exact pre-advance snapshot, and the task is advanced to reached
`RELEASE_050_CONTRACT_6_READY` after accepting the reached actuals and English
inputs, active Contract 6 boundary, compatibility, safety, and installed workflows.
`RELEASE_050_PREPARATION` is complete after aligning the `0.5.0` package
identity, CHANGELOG, README, Contract 5-to-6 migration guidance, tests,
goldens, and full Node.js 22-or-later repository and installed-package gates. Git
commit `e1e7ccf` records its exact pre-advance snapshot, and the task is
advanced to reached `RELEASE_050_SOURCE_PREPARED`.
`RELEASE_050_CANDIDATE` is complete and advanced after the clean source,
version and channel identity, external availability, protected routes, and
complete repository and installed-package gates were reverified. The retained
468-file candidate tarball has SHA-256 `f3ba9b3f...2208c`.
`RELEASE_050_PUBLISH` is complete: release commit and peeled `v0.5.0` target
`af819b4` agree; the candidate, GitHub, and npm tarballs are byte-identical;
npm reports `beta=0.5.0`, `latest=0.4.0`, and `alpha=0.1.0-alpha.2`; and
isolated public-package checks passed. At the publish snapshot, three points
remained; precedence and
heuristic resource makespans are both 3p with no resource delay, observed
velocity is `16p/1d`, both forecasts are `3/16d`, and complete NextResult v5
recommends only `RELEASE_050_ACCEPTANCE`. Git commit `94a8b62` records the
exact completed PUBLISH pre-advance snapshot, and the task is advanced to
reached `RELEASE_050_PUBLISHED`. `RELEASE_050_ACCEPTANCE` is complete after
independent Git, GitHub, npm, artifact, and installed-package verification.
All six tasks and 19p are complete at `19p/1d`; both makespans are zero, and
complete NextResult v5 has no recommendation. Git commit `bacd413` records
the exact completed acceptance pre-advance snapshot, and the plan is advanced
to reached `RELEASE_050_ACCEPTED`. The exact post-acceptance global
installation resolves to registry `perttool@0.5.0` and passed Contract 6,
Grammar 5, and history smoke checks. The user's
named release authorization applies only after every predecessor gate passes.
npm `latest` promotion and Issue #4 closure remain separate decisions.

The explicitly authorized compatible `0.5.1` patch release is tracked in
`plans/release-0.5.1.pert`. `RELEASE_051_SELF_REVIEW`,
`RELEASE_051_PREPARATION`, and `RELEASE_051_CANDIDATE` are complete and
advanced after
confirming that the additive read-only schema command, bundled Draft 2020-12
artifacts, lookup APIs, and Git 2.54 UTC `Z` fix retain existing Grammar 5,
CLI Contract 6, command descriptors, result identities, payload meanings,
and package exports. The review corrected available-Git result validation
and package wildcard-export consumption coverage. Package, lockfile, CLI,
CHANGELOG, README, release guidance, tests, goldens, and the full Node.js 22
repository and 491-file isolated-package gates identify `0.5.1`. Clean
source, channel availability, protected routes, and the retained tarball with
SHA-256 `93f3e01a...1339` passed candidate acceptance.
`RELEASE_051_PUBLISH` is complete: release commit and peeled `v0.5.1` target
`31d162a` agree; Node.js 22 and 24 CI passed; candidate, GitHub, and npm
tarballs are byte-identical; npm reports `beta=0.5.1`, unchanged
`latest=0.4.0`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks
passed. `RELEASE_051_ACCEPTANCE` is complete after independent Git, GitHub,
npm, artifact, compatibility, and installed-package verification. All five
tasks and 17p are complete at `17p/1d`; both makespans are zero, and complete
NextResult v5 has no recommendation. Git commit `9ecae00` records the exact
completed acceptance pre-advance snapshot, and the plan is advanced to reached
`RELEASE_051_ACCEPTED`. The user's named
release authorization applies only after every predecessor gate passes. The
user later separately authorized one `latest` mutation; fresh registry reads
and an unqualified isolated installation confirmed `beta=latest=0.5.1`, CLI
Contract 6, Grammar 5, and all eighteen root schemas. Issue #5 closure remains
a separate decision.

The explicitly authorized compatible `0.5.2` JSON Schema patch release is
tracked in `plans/release-0.5.2.pert`. `RELEASE_052_SELF_REVIEW` is complete
after reviewing complete nested schemas, strict real-result validation,
default full lookup semantics, opt-in reference-based outline/detail views,
all 34 command descriptors, and all 116 existing runtime exports. Its
acceptance record is `docs/process/0.5.2-self-review.md`.
`RELEASE_052_PREPARATION` is complete after aligning package identity,
CHANGELOG, README, release guidance, tests, goldens, and 23-plan self-use
registration. The complete Node.js 22 gate passed 655 tests, English and
documentation checks, the temporary-link workflow, the 491-file isolated
package workflow, and npm publication normalization. After canonical advance,
`RELEASE_052_CANDIDATE` was the only recommendation and is complete after
clean Node.js 22 revalidation, absent-version/channel preflight,
protected-route verification, and isolated acceptance of the retained
491-file, 519790-byte tarball with SHA-256 `e8512f0d...54bbce`. No external
state changed during candidate acceptance. `RELEASE_052_PUBLISH` is complete:
release commit and peeled `v0.5.2` target `501d4b1` agree; Node.js 22 and 24
CI run 30517079581 passed; candidate, GitHub, and npm tarballs are
byte-identical; npm reports `beta=0.5.2`, unchanged `latest=0.5.1`, and
`alpha=0.1.0-alpha.2`; and isolated public-package checks passed.
`RELEASE_052_ACCEPTANCE` is complete after independent Git, GitHub, npm,
artifact, exact `0.5.1` compatibility, and installed full/outline/detail
verification. All five tasks and 17p are complete at `17p/1d`; both
makespans are zero, and complete NextResult v5 has no recommendation. Git
commit `3f7cc04` records the exact completed acceptance pre-advance snapshot,
and the plan is advanced to reached `RELEASE_052_ACCEPTED`. npm `latest`
promotion and Issue #5 closure remain separate decisions. After acceptance,
the user separately retired the obsolete npm `alpha` dist-tag. Registry
readback confirmed only `beta=0.5.2` and `latest=0.5.1`; historical
`0.1.0-alpha.2` remains available by exact pin.

The explicitly authorized compatible `0.5.3` governance-guidance patch is
tracked in `plans/release-0.5.3.pert`. It retains Grammar 5, CLI Contract 6,
all command, option, result, schema, and package-root identities while
publishing the beta-only channel guard and single-candidate, scope-bound,
human-readable loose owner-confirmation workflow. `RELEASE_053_SELF_REVIEW`
and `RELEASE_053_PREPARATION` are complete after the 662-test, 24-plan,
115-Markdown, temporary-link, and 491-file isolated-package gates passed.
`RELEASE_053_CANDIDATE` is complete after clean revalidation, unused-version
and channel preflight, protected-route checks, and acceptance of the retained
491-file, 520876-byte tarball. `RELEASE_053_PUBLISH` is complete: release
commit, remote main, peeled tag, GitHub prerelease, npm `beta`, and the common
tarball agree, while `latest=0.5.1` and alpha remains absent.
`RELEASE_053_ACCEPTANCE` is complete after independent Git, GitHub, npm,
artifact, and installed-package verification. All five tasks and 15p are
complete; both makespans are zero, and complete NextResult v5 has no
recommendation. Completed declarations remain in the plan until a separately
confirmed single-candidate `dag advance`. npm `latest` promotion remains a
separate decision.

The explicitly authorized compatible `0.5.4` runtime-warning patch is tracked
in `plans/release-0.5.4.pert`. Its self-review and source preparation are
complete after the 667-test, 25-plan, 119-Markdown, temporary-link, and
491-file isolated-package gates passed. Candidate acceptance repeated the
clean gates, external availability and protected-route preflight, and retained
the 521641-byte tarball with SHA-256 `d3123ef0...3c01`.
`RELEASE_054_PUBLISH` is complete: release commit `9c23510`,
peeled tag, successful Node.js 22/24 CI run `30536185188`, GitHub prerelease,
npm `beta=0.5.4`, and the common tarball agree; `latest=0.5.1` and alpha
remains absent. `RELEASE_054_ACCEPTANCE` is complete after independent Git,
GitHub, npm, artifact, installed-package, and PTGOV-103 default/strict
verification. All five tasks and 15p are complete; both makespans are zero
and complete NextResult v5 has no recommendation. The source adds the non-blocking
`PTGOV-103` warning when
a valid governance-not-applicable candidate carries a non-empty
`acceptedByOwner` set. Default write authority and every versioned result
identity remain unchanged; existing `--warnings-as-errors` prevents
persistence. This minimal runtime visibility does not add accepted scopes,
approval evidence, authentication, or cross-candidate reuse detection.
Completed declarations remain until a separately confirmed `dag advance`.
npm `latest` promotion remains a separate decision.

The explicitly authorized compatible `0.5.5` governed-preview-warning patch
is tracked in `plans/release-0.5.5.pert`. Compatibility self-review is
complete, and source preparation and candidate acceptance have passed the
complete Node.js 22 and retained-package gates. The 491-file, 522117-byte
candidate has SHA-256 `1987db1a...5452`. Durable acceptance is complete:
release commit
`04055c9`, peeled tag, Node.js 22/24 CI run `30543700217`, GitHub prerelease,
npm `beta=0.5.5`, and the common tarball agree; `latest=0.5.1` and alpha
remains absent at beta acceptance. The selected patch emits non-blocking
`PTGOV-104` when a valid applicable preview carries a non-empty
`acceptedByOwner` set. The candidate, GovernanceDecision v1, default preview,
and persistent authority remain unchanged; existing `--warnings-as-errors`
returns exit 1 while retaining the candidate and decision. All five tasks and
15p are complete with zero makespans and no recommendation. The user later
separately authorized one npm `latest` mutation and the exact displayed
advance candidate. Fresh reads and an unqualified installation confirmed
`beta=latest=0.5.5`, Contract 6, 34 commands, 18 schemas, and Grammar 5. The
governed advance used actor `codex`, owner assertion `user`, and the preview
source digest. The residual plan retains reached `RELEASE_055_ACCEPTED` and
has no diagnostics, task, recommendation, or makespan.

The explicitly selected `TIME-001` and `UNIT-001` workstream is tracked by the milestone-level `plans/scheduling-units.pert` and its milestone details. SU-M1, SU-M2, SU-M2R, SU-M3, SU-M4, and SU-M5 are complete, rolled up once, and advanced. SU-M4's final acceptance snapshot is committed at `bc75b37`; all six detail tasks and 25p are accepted at `25p/1d`. SU-M3's acceptance snapshot is committed at `9c61bac`; all six detail tasks and 23p are accepted at `23p/1d`. SU-M5's atomic Contract 4 acceptance is committed at `81b4828`; all six detail tasks and 23p are accepted at `23p/1d`, the detail is advanced to reached `CONTRACT4_ACCEPTED` at `f15a7ac`, and the macro rolled it up once and advanced to reached `SCHEDULING_UNITS_ACCEPTED` at `507fbb8`. Both plans now have zero precedence and heuristic resource makespans and no recommendation. The accepted public surface includes Grammar 1/2/3, CLI Contract 4, public result schema identities and root exports, help, Guide, installed behavior, exact unit migration, and Next v4 normal start authority.

`project show`, which returns the complete project metadata including velocity, source-preserving `project set`, and atomic-batch `project.set` are also implemented. The observed operational velocity was recalibrated to `29p/2d` from a cumulative 29p over 2 active days, including 5p on 2026-07-23.

ADR 0004 adopts English as the repository baseline. All nine tasks in `plans/english-baseline.pert` are accepted and advanced, the final cross-surface trace is recorded in `docs/process/english-baseline-acceptance.md`, and the plan has zero precedence and heuristic resource makespans, no remaining or recommended task, and an observed `42p/2d` velocity.

When meaning or design conflicts, use the following order of precedence by default.

1. Must requirements in `docs/requirements.md`
2. Normative specifications in `docs/specs/`
3. `docs/basic-design.md`
4. Normative samples in `docs/examples/`
5. Development and operational procedures in `docs/process/`
6. Current and future work state in `plans/`
7. Guidance in `README.md`

Do not conceal an inconsistency by changing only a lower-precedence document. For a requirements change, update the affected specifications, design, samples, tests, and help in the same logical change. Do not restore past plans or completion states to current documents; refer to Git history instead.

## Project map

- `docs/requirements.md`: product requirements and MVP boundary.
- `docs/basic-design.md`: architecture, module boundaries, and implementation slices.
- `docs/specs/`: normative specifications for grammar, graph semantics, analysis, mutation, interfaces, and the accepted project-actuals/history target.
- `docs/adr/`: adopted architecture and runtime decisions.
- `docs/examples/`: normative parser and analysis samples.
- `docs/process/`: operating procedures for self-use and AI development.
- `plans/`: current and future work for perttool. Use `mvp.pert` as the completed macro roadmap through the first beta; use `grammar.pert`, `control-plane.pert`, `operations.pert`, `recommendation.pert`, `agent-guidance.pert`, and `governance.pert` as Stage 3 preview-first detail plans; use `english-baseline.pert`, `cli-surface-reset.pert`, `project-actuals.pert`, `advance-history-safety.pert`, and `release-0.2.0.pert` through `release-0.5.5.pert` as independent post-beta workstreams; and use `scheduling-units.pert` plus completed `scheduling-units-m1.pert` through `scheduling-units-m5.pert` as the accepted milestone/detail records for `TIME-001` and `UNIT-001`.
- `scripts/`: repository-local verification commands.
- `.github/workflows/`: CI using the same entry points as local verification.
- `src/`: TypeScript parser, validator, Core API, CLI, and help implementations.
- `src/actuals/`: active Grammar 5 source projection, deterministic event identity, exact lifecycle reduction, exact measurements, and stored-state validation for task-owned work-event records.
- `src/command/`: immutable typed Contract 6 command descriptors, shared-option expansion, dispatch lookup, deterministic text/JSON help projections, and structured usage-error recovery.
- `src/help/`: the structured domain HelpNode registry, retained Core help data, and the active Contract 6 editing and actuals Guide.
- `src/analysis/`: residual graph, precedence CPM, resource-schedule implementations, internal release-aware temporal precedence and resource schedulers, and exact deadline evaluation using Rational values.
- `src/recommendation/`: pure Core that derives candidate facts, complete order, selection horizon, joint-feasible recommended sets, tiers, a typed explanation graph, PTREC invariants, JSON projections, read-only override validation, and canonical artifacts from actual ready tasks.
- `src/schema/`: closed Contract 6 result-schema catalog, local bundled-artifact resolution, `Perttool.SchemaResult.v1`, and deterministic JSON/text projections.
- `schemas/`: bundled Draft 2020-12 root artifacts for every active command result and the public OverrideDecision result, plus shared local definitions.
- `src/conversion/`: Mermaid profile/plain export and import, semantic metadata, projection generation, and fail-closed restoration.
- `src/editing/`: deterministic unified diff shared by formatter and mutation.
- `src/formatter/`: the active Grammar 1/2/3/4/5 source-preserving formatter Core; exact values use canonical Decimal-or-Fraction serialization.
- `src/guidance/`: read-only pure Core that provides versioned offline AI Agent Guidance profiles, validation, queries, index/quick/detail projections, and deterministic JSON/text.
- `src/governance/`: Grammar 4/5 declared/effective governance metadata, the exact generated direct-edit warning, and one pure actual-change classifier, caller-assertion normalizer, pre-change authority evaluator, and PTGOV diagnostic projection used by the active Contract 6 package surface.
- `src/history/`: active read-only Git probe, pure semantic reducer, and pure velocity observation Core for SHA-1/SHA-256 repository/path/revision binding, first-parent raw snapshots, declared-event deduplication/removal, qualified legacy transitions, exact task summaries and rates, typed availability, linked worktrees, and race detection; plus the active ADV-001 current-HEAD/stage-0 capture, destructive-range assessment, and pre-write baseline recheck.
- `src/io/`: raw-byte document reads, digests, symlink/race rejection, atomic safe-write mechanics, guarded existing-document output creation, and separate internal Grammar 2/3/4/5 target-validation adapters.
- `src/migration/`: exact unit-migration request validation, velocity selection, stable causes, complete Duration inventory, preserved-temporal snapshots, exact Rational conversion records, canonical target tokens, and exact-Duration grammar selection, compatibility, reversibility, and localized version-upgrade inputs.
- `src/model/`: shared syntax/CST records, diagnostics, exact Rational arithmetic, units, internal declared calendar values plus exact Gregorian/fixed-offset comparison and projection, additive exact Duration Fraction values, and exact Decimal-or-Fraction source serialization.
- `src/parser/`: the active Grammar 1/2/3/4/5 parser with identity-checked task-owned work-event source.
- `src/semantic/`: active Grammar 1/2/3/4/5 validated-document boundaries, task-owned event validation, exact cross-form Duration constraints, temporal-anchor validation, and duplicate-principal validation.
- `src/mutation/`: active Grammar 1/2/3/4/5 requests for project/task/gate/milestone/resource, lifecycle, and atomic batch; governance project fields; exact changed-field Duration generation; canonical advance and task-owned event removal; source-preserving UTF-16 TextEdit generation; and application rules.
- `src/application/`: pure services for active Contract 6 check/project initialization/project metadata/analyze/next, lifecycle, history, observation, declared temporal input, AnalysisResult v4, release-gated NextResult v5 composition, exact unit migration and Result v3 projection, Grammar 1/2/3/4/5 mutation planning, governed direct/batch/advance planning, AdvanceResult v1 history-guard composition, Contract 6 result projections, and authorization-before-safe-write orchestration.
- `test/`: fixtures for the Node.js built-in test runner; analysis/next/formatter/mutation/conversion/write-safety and target-governance Core unit tests; and CLI integration/E2E tests.
- `package.json`: Node.js 22 or later, npm scripts, and binary/library entrypoints.

When adding an implementation, update this map to match its actual directories and commands.

## Work start and task selection

Before a non-trivial change, briefly confirm the following.

1. current branch, HEAD, and worktree state
2. the user's goal and the scope of this change
3. the normative documents read and the validity of inherited assumptions
4. acceptance criteria and explicit non-goals
5. verification to run and planned external side effects

For metadata such as Project ID, as_of, duration_unit, velocity, and finish, normally use `project show --format json` rather than inspecting the source file directly. Apply changes through `project set` preview/diff and the Stage 3 safe-write procedure, not by manual editing.

Treat `--accepted-by-owner` as a single-candidate, scope-bound caller assertion, never as workstream or session authority. Start each candidate with an assertion-free preview. If governance is not applicable, persist without the assertion. `PTGOV-103` warns about an assertion on a not-applicable candidate, and `PTGOV-104` warns about one on a governed preview. If a non-direct governed write needs confirmation, present the operation, target, affected scopes, required owners, available modification time, byte size before and after, diff counts, and semantic candidate summary. Keep source and candidate digests as supplemental machine identity rather than the primary human explanation. Use the assertion only when the current user instruction explicitly covers that mutation. Do not copy it to later maintenance, a changed candidate, or the next `dag advance`, and do not chain preview and confirmation-dependent write without a user-response boundary. Follow `docs/process/governance-assertion-scope-experiment.md`.

When the user asks for the “next task,” first present candidates based on recommended specification work in `docs/requirements.md`, unresolved matters, and the current Git state. From self-use Stage 1 onward, use the macro recommendation in `mvp.pert` to choose a workstream, then reanalyze the corresponding detail plan and choose a task from its detail recommendation. Base candidate selection on the `check`, `analyze`, and `next --format json` results for both the macro plan and the target detail plan; do not directly compare tasks from different detail plans without a macro decision.

For the explicitly selected scheduling-and-units workstream, use `scheduling-units.pert` as its macro authority and the current `scheduling-units-m*.pert` as its detail authority. When a detail finish is reached, roll it up once to the matching macro work package, re-estimate later provisional packages, and create only the next milestone-detail plan from accepted semantics.

For normal task selection, use only a known `Perttool.NextResult.v5`, recommendation interface 1, ranking algorithm 1, reason taxonomy 1.0, explanation/expression/description model 1, locale `en`, temporal authority policy `recommendation_v1_plus_release_gate`, and a complete, non-truncated trace as the authority. Start only tasks listed in `startable_recommended_task_ids`. You may choose a subset of that set, or retain the complete startable set with exactly one additional resource-feasible, time-eligible `allowed` task. Do not start for an unknown version or temporal policy, incomplete trace, `PTREC-*`, future or unavailable release eligibility, or a `deferred`/`discouraged` selection; stop safely. Reanalyze rather than reusing the same result after task start, completion, blocking, time, or capacity changes. Do not apply a selection requiring a human override until MIG-08; report its difference from the normal recommendation and the still-unavailable audit/apply boundary.

For changes affecting correctness, proceed in the order of requirements/specification, design, implementation, and verification by default. If an implementation reveals a gap in a specification, do not encode an assumption only in code; update the applicable normative document first or in the same change.

## Domain invariants

- Use Activity-on-Arrow: a task is an edge, a milestone is a node, and a gate is a zero-duration dependency edge.
- A resource requirement is not a dependency edge. Do not automatically convert shared resources into ordering in the normative DAG.
- Distinguish the precedence critical path from the schedule critical path in a resource-constrained schedule.
- Do not present a heuristic resource-schedule result as an exact optimum.
- Return the same analysis result for the same input, options, and algorithm version.
- Do not use binary floating point as the source of truth for duration and PERT calculations.
- `.pert` represents the present and future; track the past through Git history.
- Do not use incomplete perttool as the writer of record before meeting the gates in `docs/process/self-use.md`.

## Validation

Run the repository checks from the root with Node.js 22 or later. CI verifies Node.js 22 and 24. `npm run check` includes check/analyze/next validation for all twenty-seven self-use plans, including advance-history safety, the selected `0.5.5` and completed `0.5.4`, `0.5.3`, `0.5.2`, `0.5.1`, and `0.5.0` release plans, project-actuals, owner-aware governance, scheduling-and-units macro, SU-M1/SU-M2/SU-M2R/SU-M3/SU-M4/SU-M5 detail, `0.3.0`, and `0.4.0` plans.

```sh
npm ci
npm run check
git diff --check
```

For narrow checks, use `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:english`, `npm run check:docs`, `npm run check:link`, and `npm run check:package`. `check:english` scans tracked and non-ignored untracked text files and permits Japanese-script content only through the exact versioned allowlist. `check:link` links into a temporary user prefix to inspect the CLI and does not change the real user prefix. `check:package` creates a release tarball in a temporary directory; checks exclusion of repository-only files and npm publish normalization dry-run; installs into an isolated prefix; and runs the complete installed-package file-first workflow. `bash scripts/check-docs.sh` is the documentation-only lower-level entry point.

- Even for documentation-only changes, run bootstrap checks for the local link, Markdown fences, and normative `.pert` samples.
- For grammar changes, check valid/invalid examples, field tables, EBNF, diagnostics, and formatter contracts together.
- For analysis changes, use a small golden graph and verify precedence results and resource-schedule results separately.
- After adding an implementation, run existing narrow tests first and progress to the broader suite only if shared core is touched.
- Do not report tests not run as successful. State failures or environment deficiencies together with their commands.
- The package/runtime baseline is defined by `docs/adr/0005-node-22-runtime-baseline.md`. When commands change, update this section, `docs/process/ai-development.md`, and CI in the same logical change.

## Review and durable guidance

Before committing, inspect the intended diff by file or hunk and look for bugs, regressions, specification inconsistencies, and missing tests before writing a summary. If a superficial symptom fix leaves the same cause, confirm the control path and root cause before fixing it. Mark temporary workarounds as temporary and retain remaining work in the normative backlog or plan.

Do not leave reusable lessons only in chat; reflect them in `AGENTS.md`, the applicable specification, tests, or process documentation. When changing shared policy in `AGENTS.md` and `.github/copilot-instructions.md`, verify both remain aligned in the same commit.

## AI tool compatibility

- Treat `AGENTS.md` as the source of truth for shared policy for Codex and other coding agents.
- Ensure GitHub Copilot can reach the same mandatory policy from `.github/copilot-instructions.md`.
- Put project-local Codex defaults in `.codex/config.toml`; do not copy global configuration into the repository.
- Add custom agents or skills only after a recurring, clear role and verifiable exit criteria arise.
- Use sub-agents, delegation, or parallel agent work only when the user explicitly requests it or an active runtime policy explicitly permits it.

## Git and remote operations

- Check `git status --short --branch` at the start of work and before staging.
- Preserve the user's uncommitted changes and explicitly stage only files within this task's scope.
- Make each commit one coherent change with a concise imperative subject.
- Check remote configuration before pushing. For this repository, use `secdat exec git push ...` for remote writes and `secdat exec gh ...` for GitHub operations.
- npm publish must satisfy the beta release gate and send the explicit GitHub Release tarball to the `beta` dist-tag. The retired `alpha` channel must not be recreated without a new release-policy decision and separate authorization. Beta publication does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicit user-selected version and permission. Inject `NPM_TOKEN` only into that process through `secdat`.
- Do not run destructive operations such as `git reset --hard`, `git clean`, force-push, or shared-history rewrites without explicit approval that identifies the target and impact.
- Do not commit secrets, credentials, local caches, or generated reports.
