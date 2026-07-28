# Development plans

この directory は、`perttool` 自身の現在・未来の作業計画を `.pert` で管理するために使用する。

計画は粒度ごとに分離する。

- [mvp.pert](mvp.pert): MVPからbetaまでのmacro milestone、work package、resource日程
- [grammar.pert](grammar.pert): 現在のgrammar sliceを実装taskまで分解した詳細計画
- [control-plane.pert](control-plane.pert): [Issue #1](https://github.com/mako10k/perttool/issues/1)のAI工程制御設計を完了条件まで分解した詳細計画
- [operations.pert](operations.pert): formatter preview、mutation preview、safe write、advanceを実ファイル境界とnarrow testへ分解したM1-M4詳細計画
- [recommendation.pert](recommendation.pert): MIG-01からMIG-07のrecommendation実装、shadow、normal authority adoptionを分解した詳細計画
- [agent-guidance.pert](agent-guidance.pert): [Issue #2](https://github.com/mako10k/perttool/issues/2)のprovider baseline、common contract、Core、`agent help`、beta受け入れを分解した詳細計画
- [english-baseline.pert](english-baseline.pert): phased migration of repository-maintained prose, bundled help, diagnostics, current plans, and golden fixtures to the English baseline
- [governance.pert](governance.pert): independent post-beta requirements, contract, implementation, and acceptance roadmap for [Issue #4](https://github.com/mako10k/perttool/issues/4) owner-aware goal and DAG mutation governance
- [cli-surface-reset.pert](cli-surface-reset.pert): independent post-beta plan that maps the human/LLM CLI review and its eight backlog items into design, implementation, breaking migration, and file-first acceptance
- [release-0.2.0.pert](release-0.2.0.pert): independent Contract 3 beta release plan covering the version decision, local preparation, candidate gate, authorized distribution, and durable acceptance
- [release-0.3.0.pert](release-0.3.0.pert): independent Contract 4 beta release plan covering the version gate, accepted scheduling-and-units input, preparation, candidate, authorized publication, and durable acceptance
- [release-0.4.0.pert](release-0.4.0.pert): independent Contract 5 beta release plan covering the version gate, accepted governance input, preparation, candidate, separately authorized publication, and durable acceptance
- [scheduling-units.pert](scheduling-units.pert): milestone-level roadmap from refined temporal and unit-migration backlog through integrated acceptance
- [scheduling-units-m1.pert](scheduling-units-m1.pert): task-level detail required only to reach the SU-M1 temporal and unit-migration contract
- [scheduling-units-m2.pert](scheduling-units-m2.pert): completed and advanced target-only Grammar 2 temporal source and Core-foundation detail through SU-M2
- [scheduling-units-m2r.pert](scheduling-units-m2r.pert): completed and advanced exact rational Duration contract, target source, editing, version-boundary, and acceptance detail
- [scheduling-units-m3.pert](scheduling-units-m3.pert): completed and advanced target-only declared temporal input, precedence, heuristic resource, deadline, AnalysisResult v3, NextResult v4, and acceptance detail
- [scheduling-units-m4.pert](scheduling-units-m4.pert): completed and advanced internal unit-migration version 2 request, exact conversion, candidate, result, inverse, and acceptance detail
- [scheduling-units-m5.pert](scheduling-units-m5.pert): completed and advanced atomic public Contract 4 Core, migration route, registry/help, Next v4 authority, installed workflow, and acceptance detail

All nineteen plans pass the self-use gate and are used as inputs to `document check`, `dag analyze`, and `dag next`. Stage 3 permits preview-first editing and `dag advance` with an expected digest and post-write reanalysis. Detailed plans use Points as the analysis unit and velocity-converted days as forecasts. Select the macro workstream from `mvp.pert` before selecting a task from its detail plan. For the explicitly selected scheduling-and-units workstream, select a milestone work package from `scheduling-units.pert`, create and accept its milestone-detail plan when none is current, and then select a task from that detail. `cli-surface-reset.pert`, `release-0.2.0.pert`, `release-0.3.0.pert`, `release-0.4.0.pert`, `governance.pert`, and the scheduling-and-units plans are explicitly requested independent post-beta plans and are not rolled up into the completed MVP macro.

2026-07-23にRecommendation detailの`FIXTURE_BASELINE` 2p、`RANKING_CORE` 4p、`EXPLANATION_CORE` 5p、`NEXT_V3_PUBLICATION` 4p、`SELF_USE_SHADOW` 2p、`OVERRIDE_VALIDATION` 3p、`AUTHORITY_ADOPTION` 2pを完了し、累計1 active dayからrecommendation固有の暫定実測Velocityを`22p/1d`へ更新した。Detailの残りは0pである。Macro `RECOMMENDATION_IMPLEMENTATION`と`RELEASE_E2E`も完了し、MVP public alphaを受け入れた。

同日に人間overrideで前倒ししたnpm publication preflightを、normal recommendationで選ばれた`RELEASE_E2E`から実行した。`v0.1.0-alpha.2`のversion/tag、GitHub asset、npm publish、registry installを同一tarballで検証し、MVP macroを完了した。

Issue #2 was included in the first beta and accepted after all five `agent-guidance.pert` tasks, totaling 22p, completed in one active day. The measured workstream velocity is `22p/1d`, and the detail plan has no remaining work. The operations velocity, including the explicitly advanced 5p `PROJECT_METADATA_CLI` task, is `29p/2d`.

The suffix-free `v0.1.0` beta was published and [accepted](../docs/process/beta-release-acceptance.md) on 2026-07-23, then explicitly promoted so npm `beta` and `latest` both resolve to `0.1.0`. The macro plan is advanced to the reached `M8_BETA_RELEASED` frontier and has no remaining or recommended task. Issue #3, the LSP server, VSIX, and MCP server remain independent post-beta backlogs.

ADR 0004 adopts English as the canonical repository language without i18n. `SURFACE_INVENTORY` completed on 2026-07-24 and was advanced after its inventory and Unicode allowlist were recorded. The `english-baseline.pert` detail plan now contains seven remaining tasks totaling 40p. Its precedence makespan is 27p, resource makespan is 30p, first-sample velocity is `2p/1d`, and resource forecast is `15d`. `NORMATIVE_DOCS` is the current recommended task.

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

Velocityは初期見積りを固定し続けず、task完了commitのPointとAsia/Tokyoのactive date数からplanごとに再calibrationする。2026-07-22から23の実測値はgrammarが`3p/1d`、control-plane設計が`16p/1d`、操作系が`29p/2d`、recommendationが`22p/1d`、agent guidanceが`22p/1d`である。操作系以外はまだ1 active dayだけの暫定値であり、算定根拠とmacroの6 decimal day roundは[自己利用計画](../docs/process/self-use.md)を正とする。

規範仕様は `plans/` ではなく `docs/specs/` に置く。`plans/` は作業状態、Git history は過去を担当する。Macro milestoneは`mvp.pert`、現在sliceの設計・実装状態は対応する詳細planへ記録し、同じtaskを両方で個別管理しない。Stage 3のediting/advance write手順は[自己利用計画](../docs/process/self-use.md)を正とする。

[Issue #2](https://github.com/mako10k/perttool/issues/2)のAI Agent Guidance Registryは、Issue #1のrecommendation契約を各coding agentへ適用するbeta gateである。Read-only v1の範囲は`agent-guidance.pert`を正とし、audit、scaffold、hook実行、enforcementは含めない。[Issue #3](https://github.com/mako10k/perttool/issues/3)のbacklog階層・multi-plan compositionはbetaへ機能依存を追加しない独立した将来backlogとして保持する。
