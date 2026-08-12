# Development plans

This directory contains `.pert` plans for the present and future work on
`perttool` itself.

Plans are separated by level of detail.

- [mvp.pert](mvp.pert): macro milestones, work packages, and resource
  schedule from the MVP through beta
- [grammar.pert](grammar.pert): detailed plan that decomposes the current
  grammar slice into implementation tasks
- [control-plane.pert](control-plane.pert): detailed plan that decomposes the
  AI engineering-control design from [Issue #1](https://github.com/mako10k/perttool/issues/1)
  through its completion criteria
- [operations.pert](operations.pert): M1-M4 detail that decomposes formatter
  previews, mutation previews, safe write, and advance by real-file boundary
  and narrow test
- [recommendation.pert](recommendation.pert): detailed plan for the MIG-01
  through MIG-07 recommendation implementation, shadow evaluation, and normal
  authority adoption
- [agent-guidance.pert](agent-guidance.pert): detailed plan for the provider
  baseline, common contract, Core, `agent help`, and beta acceptance from
  [Issue #2](https://github.com/mako10k/perttool/issues/2)
- [adapter-platform.pert](adapter-platform.pert): selected `ADAPTER-001`
  cross-adapter foundation and read-only integration roadmap covering the
  dependency contract, Core decoupling, shared library and Node ports, CLI
  parity, document sessions, LSP, VSIX and DAG view, MCP, and integrated
  acceptance; `ADAPTER_ARCHITECTURE_CONTRACT`,
  `CORE_DEPENDENCY_CLEANUP`, `SHARED_LIBRARY_BOUNDARY`,
  `EDITOR_PROTOCOL_CONTRACT`, `DOCUMENT_SESSION_CORE`, `LSP_READ_CORE`,
  `LSP_ACCEPTANCE`, `VSIX_SHELL`, `VSIX_DAG_VIEW`, `NODE_PORT_BOUNDARY`,
  `CLI_FACADE_PARITY`, all three MCP tasks, and final integration acceptance
  are complete and retained before advance; all sixteen tasks and 91p are
  complete with zero makespans and no recommendation
- [historical-dag.pert](historical-dag.pert): selected `HIST-DAG-001`
  first-parent historical reconstruction roadmap covering the normative
  contract, shared transition model, bounded immutable Git evidence, pure
  checkpoint/lineage/timeline reconstruction, separate read-only CLI result,
  editor contract, VSIX presentation, and final acceptance; the first four
  implementation inputs are accepted, and the additive `dag history` command,
  twenty-first root schema, and isolated package path are implemented;
  `HISTORICAL_CLI` and its separately owner-confirmed exact basis-bound outcome
  are complete; the separate historical editor protocol and eighteen cases are
  accepted, and `HISTORICAL_EDITOR_CONTRACT` plus its separately owner-
  confirmed exact basis-bound outcome are complete; the private historical
  LSP/VSIX implementation, eighteen runtime cases, and status-only lifecycle
  are complete; its exact basis-bound outcome is separately owner-confirmed
  and complete, and only final cross-surface acceptance is ready, recommended,
  and startable
- [milestone-acceptance.pert](milestone-acceptance.pert): selected
  `MILESTONE-ACCEPT-001` Grammar 7 and CLI Contract 8 roadmap covering the
  normative contract, committed source migration, pure acceptance evaluator,
  governed criterion and receipt mutations, all-or-nothing advance, atomic
  public activation, historical reconstruction, read-only adapter projection,
  and final cross-surface acceptance; the contract, Grammar 7 source/migration,
  pure evaluator, governed mutation, acceptance-aware canonical advance, and
  atomic Contract 8 public activation, and historical reconstruction slices
  are complete before advance; complete NextResult v7 recommends only the
  read-only adapter projection
- [advance-history-safety.pert](advance-history-safety.pert): independent
  post-beta contract, pure probe, in-place CLI guard, and acceptance roadmap
  for `ADV-001`; all four tasks are accepted and advanced, with no remaining
  recommendation
- [english-baseline.pert](english-baseline.pert): phased migration of repository-maintained prose, bundled help, diagnostics, current plans, and golden fixtures to the English baseline
- [governance.pert](governance.pert): independent post-beta requirements, contract, implementation, and acceptance roadmap for [Issue #4](https://github.com/mako10k/perttool/issues/4) owner-aware goal and DAG mutation governance
- [project-actuals.pert](project-actuals.pert): independent post-beta design,
  implementation, public cutover, and acceptance roadmap for explicit work
  events, lifecycle transitions, read-only Git history, and observed project
  performance
- [plan-assurance.pert](plan-assurance.pert): explicitly selected ASSURE-001
  roadmap from the Grammar 6 and CLI Contract 7 interface through source and
  hash Core, governed mutation, authority, advance, compatibility, atomic
  public cutover, and installed acceptance; all 10 tasks and 59p are complete
  in the exact pre-advance state, and complete NextResult v6 has no ready,
  recommended, or startable task
- [help-guide-consistency.pert](help-guide-consistency.pert): independent
  `GUIDE-CONSISTENCY-001` correction roadmap covering the active Guide,
  command examples, diagnostic navigation, current and historical
  documentation, bounded topic symmetry, and complete acceptance; all four
  tasks and 14p are complete before advance with no recommendation
- [cli-surface-reset.pert](cli-surface-reset.pert): independent post-beta plan that maps the human/LLM CLI review and its eight backlog items into design, implementation, breaking migration, and file-first acceptance
- [release-0.2.0.pert](release-0.2.0.pert): independent Contract 3 beta release plan covering the version decision, local preparation, candidate gate, authorized distribution, and durable acceptance
- [release-0.3.0.pert](release-0.3.0.pert): independent Contract 4 beta release plan covering the version gate, accepted scheduling-and-units input, preparation, candidate, authorized publication, and durable acceptance
- [release-0.4.0.pert](release-0.4.0.pert): independent Contract 5 beta release plan covering the version gate, accepted governance input, preparation, candidate, separately authorized publication, and durable acceptance
- [release-0.5.0.pert](release-0.5.0.pert): independent Contract 6 beta release plan covering the version gate, accepted project-actuals and English-baseline input, preparation, candidate, authorized publication, durable acceptance, and the post-release exact local installation boundary
- [release-0.5.1.pert](release-0.5.1.pert): independent compatible Contract 6 patch-release plan covering self-review, preparation, candidate, authorized publication, and durable acceptance
- [release-0.5.2.pert](release-0.5.2.pert): independent compatible Contract 6 complete-schema patch-release plan covering self-review, preparation, candidate, authorized publication, and durable acceptance
- [release-0.5.3.pert](release-0.5.3.pert): completed compatible Contract 6 governance-guidance patch-release plan covering threat-model review, human-readable confirmation context, preparation, candidate, authorized publication, and durable acceptance; completed declarations remain pending separately confirmed governed advance
- [release-0.5.4.pert](release-0.5.4.pert): completed compatible Contract 6 governance-runtime-warning patch-release plan covering trigger and compatibility review, preparation, candidate, authorized publication, and durable acceptance; completed declarations remain pending separately confirmed governed advance
- [release-0.5.5.pert](release-0.5.5.pert): compatible Contract 6 governed-preview-warning patch-release plan covering compatibility review, preparation, candidate, authorized publication, and durable acceptance
- [release-0.6.0.pert](release-0.6.0.pert): selected Contract 6 advance-history-safety beta-minor plan covering result-identity and migration review, preparation, candidate, authorized publication, and durable acceptance; npm `latest`, plan advance, and Issue mutation remain separate
- [release-0.7.0.pert](release-0.7.0.pert): completed Grammar 6 and CLI Contract 7 conditional-plan-assurance beta-minor plan covering release-gate design, accepted ASSURE-001 input, preparation, candidate, separately authorized publication and `latest` promotion, and durable acceptance; all six tasks and 21p are complete with no recommendation
- [release-0.7.1.pert](release-0.7.1.pert): selected compatible Grammar 6 and
  CLI Contract 7 Help and Guide consistency patch plan; compatibility
  self-review and version-bearing preparation are complete, while candidate
  acceptance, PUBLISH, durable acceptance, `latest` promotion, and plan
  advance remain separately gated
- [scheduling-units.pert](scheduling-units.pert): milestone-level roadmap from refined temporal and unit-migration backlog through integrated acceptance
- [scheduling-units-m1.pert](scheduling-units-m1.pert): task-level detail required only to reach the SU-M1 temporal and unit-migration contract
- [scheduling-units-m2.pert](scheduling-units-m2.pert): completed and advanced target-only Grammar 2 temporal source and Core-foundation detail through SU-M2
- [scheduling-units-m2r.pert](scheduling-units-m2r.pert): completed and advanced exact rational Duration contract, target source, editing, version-boundary, and acceptance detail
- [scheduling-units-m3.pert](scheduling-units-m3.pert): completed and advanced target-only declared temporal input, precedence, heuristic resource, deadline, AnalysisResult v3, NextResult v4, and acceptance detail
- [scheduling-units-m4.pert](scheduling-units-m4.pert): completed and advanced internal unit-migration version 2 request, exact conversion, candidate, result, inverse, and acceptance detail
- [scheduling-units-m5.pert](scheduling-units-m5.pert): completed and advanced atomic public Contract 4 Core, migration route, registry/help, Next v4 authority, installed workflow, and acceptance detail

All thirty-five plans pass the self-use gate and are used as inputs to `document
check`, `dag analyze`, and `dag next`. Stage 3 permits preview-first editing
and `dag advance` with an expected digest and post-write reanalysis. Detailed
plans use Points as the analysis unit and velocity-converted days as forecasts.
Select the macro workstream from `mvp.pert` before selecting a task from its
detail plan. For the explicitly selected scheduling-and-units workstream,
select a milestone work package from `scheduling-units.pert`, create and accept
its milestone-detail plan when none is current, and then select a task from
that detail. `cli-surface-reset.pert`, `release-0.2.0.pert`,
`release-0.3.0.pert`, `release-0.4.0.pert`, `release-0.5.0.pert`,
`release-0.5.1.pert`, `release-0.5.2.pert`, `release-0.5.3.pert`,
`release-0.5.4.pert`, `release-0.5.5.pert`, `release-0.6.0.pert`,
`release-0.7.0.pert`, `release-0.7.1.pert`, `governance.pert`,
`help-guide-consistency.pert`, `adapter-platform.pert`,
`project-actuals.pert`, `plan-assurance.pert`, `historical-dag.pert`,
`advance-history-safety.pert`, and the
scheduling-and-units plans are explicitly
requested independent post-beta plans and are not rolled up into the completed
MVP macro.

On 2026-07-23, the recommendation detail completed `FIXTURE_BASELINE` 2p,
`RANKING_CORE` 4p, `EXPLANATION_CORE` 5p, `NEXT_V3_PUBLICATION` 4p,
`SELF_USE_SHADOW` 2p, `OVERRIDE_VALIDATION` 3p, and `AUTHORITY_ADOPTION` 2p.
Its provisional recommendation-specific measured velocity was updated to
`22p/1d` from the cumulative one-active-day sample, with no detail work
remaining. The macro `RECOMMENDATION_IMPLEMENTATION` and `RELEASE_E2E` also
completed, accepting the MVP public alpha.

On the same day, the npm publication preflight that a human override had
started early was executed from the normally recommended `RELEASE_E2E`.
The version and tag, GitHub asset, npm publication, and registry installation
for `v0.1.0-alpha.2` were verified from the same tarball, completing the MVP
macro.

Issue #2 was included in the first beta and accepted after all five `agent-guidance.pert` tasks, totaling 22p, completed in one active day. The measured workstream velocity is `22p/1d`, and the detail plan has no remaining work. The operations velocity, including the explicitly advanced 5p `PROJECT_METADATA_CLI` task, is `29p/2d`.

The suffix-free `v0.1.0` beta was published and [accepted](../docs/process/beta-release-acceptance.md) on 2026-07-23, then explicitly promoted so npm `beta` and `latest` both resolve to `0.1.0`. The macro plan is advanced to the reached `M8_BETA_RELEASED` frontier and has no remaining or recommended task. At that acceptance boundary, Issue #3, the LSP server, VSIX, and MCP server remained independent post-beta backlogs. The later selected `ADAPTER-001` plan now composes their shared foundation while retaining adapter-specific gates.

ADR 0004 adopts English as the canonical repository language without i18n.
`SURFACE_INVENTORY` completed on 2026-07-24 and was advanced after its
inventory and Unicode allowlist were recorded. At that snapshot,
`english-baseline.pert` contained seven remaining tasks totaling 40p. Its
precedence makespan was 27p, resource makespan was 30p, first-sample velocity
was `2p/1d`, and resource forecast was `15d`; `NORMATIVE_DOCS` was the
recommended task.

On 2026-07-29, `PERT_PLANS` migrated the six remaining `.pert` metadata
surfaces and this evidence file without changing stable plan structure or
reconstructing completed history. The
[acceptance record](../docs/process/english-pert-plans-acceptance.md) fixes
the source digests and invariant checks. Git commit `9d9fdbf` records the
exact completed pre-advance snapshot, and the task is advanced to reached
`ENGLISH_CONTENT_READY`. The residual plan has 6p remaining, matching 6p
precedence and heuristic resource makespans, measured velocity `36p/2d`, and
a complete NextResult v5 that recommends only `GOLDEN_UNICODE_AUDIT`.

`GOLDEN_UNICODE_AUDIT` then migrated the remaining repository-authored E2E and
invalid fixture prose, retained the dedicated Japanese/emoji round-trip
coverage, and added an exact counted Japanese-script allowlist to the local and
CI repository gate. The
[acceptance record](../docs/process/english-golden-unicode-acceptance.md) fixes
the pre-migration source-layout and semantic-structure evidence. The task is
complete at pre-advance digest
`sha256:9aa145806e7aeee32e7ad97ed45ec1df9a9d954100f3e96bcea8196f1be90e25`,
recorded by Git commit `81ab774`. The task is advanced to reached
`GOLDEN_UNICODE_READY`; the residual digest is
`sha256:fe7241624e95e60f5bca184f8a402e9d0ed5ded4be4f77a0e8404a6a36248d86`.
One task and 3p remain, matching precedence and heuristic resource makespans;
measured velocity is `39p/2d`, and complete NextResult v5 recommends only
`ENGLISH_ACCEPTANCE`.

`ENGLISH_ACCEPTANCE` then traced ADR 0004 through requirements, design,
runtime and diagnostics, help and usage, documentation, plans, tests and
goldens, package contents, and the shared agent entrypoints. The
[final acceptance record](../docs/process/english-baseline-acceptance.md)
also confirms the exact three-line Japanese-script allowlist and the absence
of runtime locale negotiation, translation catalogs, or a `--locale` option.
The completed pre-advance digest is
`sha256:e9b306ff0423ad8bc8114a1c1c35affae60e6cd79f1f52fa9cd997c3a7727462`,
recorded by Git commit `2001cdf`. Governed advance and the accepted-state
description sync leave residual digest
`sha256:160e1af66d7bc8c2c8ea6b7a9f62ad7b533ec74e1ae1adc3b5d9f176745362a4`.
All nine tasks and 42p are accepted and advanced over two active dates. The
completed plan has zero precedence and heuristic resource makespans, no
remaining or recommended task, and measured velocity `42p/2d`.

All nine `cli-surface-reset.pert` tasks, totaling 49p from `CONTRACT_V3_DESIGN` through `CLI_003_FILE_FIRST_ACCEPTANCE`, completed and advanced on 2026-07-24. The active Contract 3 surface uses one typed registry for dispatch and help, separates domain guidance, provides structured usage recovery, exposes project initialization and direct gate maintenance, adds the contract version to every JSON envelope, rejects renamed Contract 2 spellings, and passes the complete isolated installed-package file-first workflow. The detail plan has no remaining or recommended task, and its cumulative plan-specific velocity is `49p/1d`.

All five tasks in `release-0.2.0.pert`, totaling 17p, completed and advanced through 2026-07-25. Suffix-free beta `0.2.0` was published from one verified tarball to a GitHub prerelease and npm `beta`; release commit/tag identity, local/GitHub/npm byte parity, and installed Contract 3/file-first behavior were accepted. Publication left `latest=0.1.0` unchanged; a separately authorized post-acceptance operation then made npm `beta=latest=0.2.0`. The completed release plan was not changed by that independent dist-tag mutation and retains zero precedence and heuristic resource makespans, no remaining or recommended task, and cumulative plan-specific velocity `17p/2d`. The durable evidence is in the [`v0.2.0` acceptance record](../docs/process/0.2.0-release-acceptance.md).

The independent `release-0.3.0.pert` plan selects suffix-free beta `0.3.0` for
the breaking Contract 4 cutover without duplicating scheduling-and-units
implementation state. `RELEASE_030_GATE_DESIGN`,
`RELEASE_030_CONTRACT_4_READINESS`, `RELEASE_030_PREPARATION`,
`RELEASE_030_CANDIDATE`, `RELEASE_030_PUBLISH`, and
`RELEASE_030_ACCEPTANCE` are complete and advanced.
The [PUBLISH record](../docs/process/0.3.0-publish.md) fixes the release
commit/tag, common GitHub/npm tarball, installed Contract 4 checks, and
publication-time `beta=0.3.0` with unchanged `latest=0.2.0`. The
[acceptance record](../docs/process/0.3.0-release-acceptance.md) records the
separately authorized `beta=latest=0.3.0` promotion, unqualified global
installation, and light smoke. All six tasks and 19p completed over two
active days. The plan now has zero precedence and heuristic resource
makespans and no ready or recommended task.

The independent `release-0.4.0.pert` plan selects suffix-free beta `0.4.0`
for the breaking Grammar 4 and CLI Contract 5 cutover without duplicating
governance implementation state. `RELEASE_040_GATE_DESIGN`,
`RELEASE_040_CONTRACT_5_READINESS`, `RELEASE_040_PREPARATION`, and
`RELEASE_040_CANDIDATE` are complete and advanced after the full Node.js 22
repository and installed-package gates. Package identity, CHANGELOG, README, and the
[Contract 4-to-5 migration guide](../docs/process/cli-contract-5-migration.md)
were prepared together. `RELEASE_040_PUBLISH` is complete and advanced: release commit and
peeled `v0.4.0` target `6b341d1` agree; the retained candidate, GitHub, and npm
tarballs have common SHA-256 `010af9ce...7cc4a`; npm reports `beta=0.4.0`
with unchanged `latest=0.3.0`; and both public-package workflows passed.
Durable acceptance completed all six tasks and 19p over two active days and
advanced the plan to reached `RELEASE_040_ACCEPTED`. It has zero precedence
and heuristic resource makespans and no ready or recommended task. The user
separately authorized the post-acceptance
`perttool@0.4.0` `latest` promotion; fresh registry reads and an unqualified
isolated installation confirmed `beta=latest=0.4.0`, CLI Contract 5, and
Grammar 4. The completed plan did not change. Issue #4 closure remains
separate. The
durable evidence is in the [`v0.4.0` PUBLISH
record](../docs/process/0.4.0-publish.md) and [`v0.4.0` acceptance
record](../docs/process/0.4.0-release-acceptance.md).

The independent `release-0.5.0.pert` plan selects suffix-free beta `0.5.0`
for the breaking Grammar 5 and CLI Contract 6 cutover without duplicating the
completed project-actuals or English-baseline workstreams. The 3p
`RELEASE_050_GATE_DESIGN` task fixes Requirements 21.6, ADR 0003, Slice 4J,
the release procedure, this self-use plan, and the external authority
boundary. Git commit `1641a32` records its exact completed pre-advance
snapshot, and the task is advanced to reached `RELEASE_050_GATE_ACCEPTED`.
Git commit `ba84cd8` records the exact completed
`RELEASE_050_CONTRACT_6_READINESS` pre-advance snapshot after accepting both
reached inputs and the public Contract 6 boundary; the task is advanced to
reached `RELEASE_050_CONTRACT_6_READY`. `RELEASE_050_PREPARATION` is complete
after aligning the `0.5.0` package identity, release guidance, tests, goldens,
and full repository and isolated-package gates. Git commit `e1e7ccf` records
its exact pre-advance snapshot, and the task is advanced to reached
`RELEASE_050_SOURCE_PREPARED`. Ten points remain; precedence
and heuristic resource makespans are both 10p with no resource delay,
inherited release velocity is `19p/2d`, and both forecasts are `20/19d`.
Complete NextResult v5 recommends and starts only `RELEASE_050_CANDIDATE`.
Candidate acceptance then reverified the clean source, external identities
and availability, protected routes, full gates, and the retained 468-file
tarball with SHA-256 `f3ba9b3f...2208c`; the task is advanced to reached
`RELEASE_050_CANDIDATE_ACCEPTED`. Six points remain; precedence and heuristic
resource makespans are both 6p with no resource delay, observed release
velocity is `13p/1d`, both forecasts are `6/13d`, and complete NextResult v5
recommends and starts only `RELEASE_050_PUBLISH`.
PUBLISH then fixed release commit and peeled `v0.5.0` target `af819b4`,
byte-identical candidate/GitHub/npm tarballs at SHA-256
`f3ba9b3f...2208c`, npm `beta=0.5.0` with unchanged `latest=0.4.0`, and
complete isolated public-package checks. Git commit `94a8b62` records the
exact completed PUBLISH pre-advance snapshot, and the task is advanced to
reached `RELEASE_050_PUBLISHED`. Three points remain; precedence and
heuristic resource makespans are both 3p with no resource delay, observed
release velocity is `16p/1d`, both forecasts are `3/16d`, and complete
NextResult v5 recommends and starts only `RELEASE_050_ACCEPTANCE`.
Independent acceptance then reread both public channels and references,
reconfirmed artifact identity, and reran both public-package workflows. All
six tasks and 19p are complete at observed `19p/1d`; both makespans are zero,
and complete NextResult v5 has no ready, recommended, or startable task. Git
commit `bacd413` records the exact completed acceptance pre-advance snapshot,
and the plan is advanced to reached `RELEASE_050_ACCEPTED`. The exact
post-acceptance global installation now resolves to registry
`perttool@0.5.0` and passed Contract 6, Grammar 5, and history smoke checks.
The user's named `0.5.0`
authorization applies only after each predecessor gate passes and does not
include npm `latest` promotion or Issue #4 closure.

The independent `release-0.5.1.pert` plan selects a compatible Contract 6
patch after a complete self-review. Self-review, source preparation, and
candidate acceptance are complete and advanced. PUBLISH fixed release commit
and peeled `v0.5.1` target `31d162a`, successful Node.js 22 and 24 CI,
byte-identical candidate/GitHub/npm tarballs at SHA-256
`93f3e01a...1339`, npm `beta=0.5.1` with unchanged `latest=0.4.0`, and
complete isolated public-package checks. Durable acceptance independently
reverified Git, GitHub, npm, all three artifact copies, the additive
compatibility boundary, and both public-package workflows. All five tasks and
17p are complete at `17p/1d`; both makespans are zero, and complete NextResult
v5 has no recommendation. Git commit `9ecae00` records the exact completed
acceptance pre-advance snapshot, and the plan is advanced to reached
`RELEASE_051_ACCEPTED`. The user then separately authorized one `latest`
mutation; fresh registry reads and an unqualified isolated installation
confirmed `beta=latest=0.5.1`, CLI Contract 6, Grammar 5, and all eighteen
root schemas. Issue #5 closure remains a separate decision.

The independent `release-0.5.2.pert` plan selects the compatible complete
schema patch. Self-review, source preparation, candidate acceptance, and
PUBLISH are complete. Release commit and peeled `v0.5.2` target `501d4b1`
agree; Node.js 22 and 24 CI passed; candidate, GitHub, and npm tarballs are
byte-identical at SHA-256 `e8512f0d...54bbce`; npm reports `beta=0.5.2`
with unchanged `latest=0.5.1`; and complete isolated public-package checks
passed. Durable acceptance independently reverified Git, GitHub, npm, all
three artifact copies, exact `0.5.1` compatibility, and both public-package
workflows. All five tasks and 17p are complete at `17p/1d`; both makespans
are zero, and complete NextResult v5 has no recommendation. Git commit
`3f7cc04` records the exact completed acceptance pre-advance snapshot, and
the plan is advanced to reached `RELEASE_052_ACCEPTED`. npm `latest`
promotion and Issue #5 closure remain separate decisions.

On 2026-07-26, `TIME-001` and `UNIT-001` reached integrated acceptance.
SU-M1, SU-M2, SU-M2R, SU-M3, SU-M4, and SU-M5 are complete and advanced.
The macro rolled up every detail exactly once and retains only reached
`SCHEDULING_UNITS_ACCEPTED`; it and SU-M5 have zero makespans and no
recommendation. The accepted surface atomically exposes Grammar 1/2/3, CLI
Contract 4, temporal and deadline results, exact unit migration, help, Guide,
installed workflows, and Next v4 normal authority.

Issue #4's independent `governance.pert` workstream completed and advanced
all twelve tasks through `GOV_ACCEPTANCE`. Grammar 4, declared/effective
metadata, actual-change classification, caller-assertion normalization,
pre-change authority, governed direct/batch/advance planning and persistence,
PTGOV diagnostics, ProjectResult v3, MutationResult v2 with
GovernanceDecision v1, registry/help/Guide, generated warning, public root,
CLI, and installed-package acceptance are active together. The plan has zero
makespans and no recommendation at observed velocity `45p/2d`. Authentication,
durable audit, recommendation override apply, MIG-08, Git integration, and
Issue synchronization remain unavailable.

The independently selected `project-actuals.pert` workstream starts from
[ADR 0006](../docs/adr/0006-explicit-work-events-in-git-history.md), the accepted
[Project Actuals and Git History
Contract](../docs/specs/project-actuals.md), and fourteen normative PACT cases.
`ACTUALS_CONTRACT_REVIEW` accepted Grammar 5 source/migration, Graph semantics
2, Mutation semantics 2, Contract 6 schemas/diagnostics, and the
machine-readable case matrix. Git commit `f6e93e1` records the exact completed
4p pre-advance snapshot; the residual plan retains reached
`ACTUALS_CONTRACT_READY`. Git commit `d6d3d7f` records the exact completed 5p
`ACTUAL_SOURCE_CORE` pre-advance snapshot; the residual plan retains reached
`ACTUAL_SOURCE_READY`. The internal Grammar 5 parser, validator, formatter,
exact actuals source model, and Grammar 1 through 4 compatibility are
accepted. Git commit `2198a0b` records the exact completed 5p
`ACTUAL_GIT_HISTORY_PROBE` pre-advance snapshot; the task and satisfied
source/history gates are advanced to reached `HISTORY_INPUT_READY`. The
internal probe binds SHA-1/SHA-256 repository snapshots, first-parent path
history, raw source digests, typed availability, linked worktrees, and
source/HEAD races without changing Git or the active public surface. Git
commit `2af13c4` records the exact completed 5p `FINISH_ACTUALS` pre-advance
snapshot; the task is advanced to reached `FINISH_ACTUALS_READY`. Its internal
target implements deterministic eventful finish, exact measurements,
finish-only and complete coverage, governed Grammar 5 safe write, and
task-owned advance removal without changing the active public surface.
`PROJECT_HISTORY` is complete, its exact pre-advance snapshot is committed at
`c0eff39`, and the task is advanced to reached `PROJECT_HISTORY_READY`. Its
internal reducer reconstructs explicit events, advance removal, qualified
legacy transitions, exact task summaries, typed availability, and
deterministic Result v1 text/JSON without public activation.
`WORK_LIFECYCLE` is complete. Git commit `518a59e` records its exact
completed 7p pre-advance snapshot, and the task is advanced to reached
`LIFECYCLE_READY`. Its internal target implements exact
start/suspend/resume candidates, deterministic retry and refusal, resource
release, full remaining-duration schedules, and separate AnalysisResult
v4/NextResult v5 suspended handling without changing the active public
surface. The acceptance record is
[`project-actuals-lifecycle-acceptance.md`](../docs/process/project-actuals-lifecycle-acceptance.md).
`VELOCITY_OBSERVATION` is complete. Git commit `19b060a` records its exact
completed 5p pre-advance snapshot, and the task and satisfied integration
gates are advanced to reached `ACTUALS_INTEGRATED_INPUT`. Its pure service
derives exact elapsed-hour, qualified active-date, effort-productivity, and
separately qualified Git-recorded rates without changing declared velocity.
The
acceptance record is
[`project-actuals-velocity-observation-acceptance.md`](../docs/process/project-actuals-velocity-observation-acceptance.md).
`ACTUALS_PUBLIC_CONTRACT` is complete. Git commit `753efea` records its exact
completed 6p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_PUBLIC_READY`. The current source atomically activates Grammar 5 and CLI Contract 6 through
the standard parser, formatter, lifecycle and advance mutations, suspended
analysis/Next results, history, observation, package root, 33-command
registry, help, Guide, schemas, diagnostics, examples, and isolated installed
workflow. The acceptance record is
[`project-actuals-public-contract-acceptance.md`](../docs/process/project-actuals-public-contract-acceptance.md).
`ACTUALS_ACCEPTANCE` is complete. Git commit `f994fa2` records its exact
completed 4p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_ACCEPTED`. Its fourteen-case executable trace covers requirements,
source, lifecycle, task-owned advance removal, real first-parent Git
histories, Core, CLI, schemas, help, package root, temporary link, and
isolated installed workflows. The acceptance record is
[`project-actuals-acceptance.md`](../docs/process/project-actuals-acceptance.md).
All nine tasks and 47p are complete. Precedence and the `parallel-sgs`
version 1 heuristic resource makespan are both zero with no resource delay,
and complete NextResult v5 has no ready, recommended, or startable task. Git
mutation, automatic declared-velocity changes, MIG-08, release publication,
and dist-tag movement remain outside the authorized scope. This independent
workstream did not displace the separately selected English-baseline
workstream.

Velocity is recalibrated per plan from the points in task-completion commits
and the number of active dates in Asia/Tokyo; the initial estimate does not
remain fixed indefinitely. Measurements for 2026-07-22 through 2026-07-23
are `3p/1d` for grammar, `16p/1d` for control-plane design, `29p/2d` for
operations, `22p/1d` for recommendation, and `22p/1d` for agent guidance.
Every sample except operations still covers only one active day. The
[self-use plan](../docs/process/self-use.md) is authoritative for the
calculation basis and the macro's six-decimal day rounding.

Normative specifications belong in `docs/specs/`, not `plans/`. The plans
record work state, while Git history records the past. Record macro milestones
in `mvp.pert` and the design and implementation state of the current slice in
the corresponding detail plan; do not manage the same task independently in
both. The [self-use plan](../docs/process/self-use.md) is authoritative for the
Stage 3 editing and advance write procedure.

The AI Agent Guidance Registry from
[Issue #2](https://github.com/mako10k/perttool/issues/2) is the beta gate that
applies the Issue #1 recommendation contract to each coding agent.
`agent-guidance.pert` is authoritative for the read-only v1 scope, which
excludes audit, scaffolding, hook execution, and enforcement. The backlog
hierarchy and multi-plan composition from
[Issue #3](https://github.com/mako10k/perttool/issues/3) remain an independent
future backlog that does not add a feature dependency to beta.
