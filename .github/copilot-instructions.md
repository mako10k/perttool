# Repository Instructions

Treat `AGENTS.md` as the source of truth for repository guidance shared by Codex and GitHub Copilot. When changing durable workflows or project rules, verify this file remains aligned in the same commit.

Mandatory summary:

- English is the canonical language for tracked repository artifacts. Respond to the user in Japanese unless requested otherwise. Preserve user-authored Unicode content, and do not introduce runtime i18n or locale negotiation.
- ADR 0004 is active. Existing Japanese surfaces are migration debt in `plans/english-baseline.pert`. `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE` are complete and advanced, and `PERT_PLANS` is the current recommended detail task.
- Issue #4 is tracked in independent post-beta `plans/governance.pert`. All twelve tasks through `GOV_ACCEPTANCE` are complete and advanced. Grammar 4 source, declared/effective metadata and digest-bound snapshots, actual-change classification, caller-assertion normalization, pre-change decisions, governed direct/batch/advance planning, PTGOV diagnostics, ProjectResult v3, MutationResult v2 with GovernanceDecision v1, the Contract 5 registry/help/usage/Guide surface, authorization-before-safe-write enforcement, generated direct-edit warning, public root, CLI, and installed `0.4.0` workflow are accepted and active together. The plan has zero makespans, no remaining or recommended task, and observed velocity `45p/2d`; it remains distinct from recommendation override MIG-08. Issue #4 closure remains separately gated.
- The selected independent `plans/project-actuals.pert` workstream starts from
  accepted ADR 0006, Grammar 5 source/migration, Graph semantics 2, Mutation
  semantics 2, the Normative target 1.0 Project Actuals and Git History
  Contract, Contract 6 schemas/diagnostics, and fourteen machine-readable PACT
  cases. `ACTUALS_CONTRACT_REVIEW` is complete and advanced from its `f6e93e1`
  pre-advance snapshot. `ACTUAL_SOURCE_CORE` is complete, its exact
  pre-advance snapshot is committed at `d6d3d7f`, and the task is advanced to
  reached `ACTUAL_SOURCE_READY`. Its internal identity-checked Grammar 5
  source Core parses, validates, formats, and projects exact task-owned work
  events while the standard package root, CLI Contract 5, and Grammar 1
  through 4 remain unchanged. `ACTUAL_GIT_HISTORY_PROBE` is complete, its
  exact pre-advance snapshot is committed at `2198a0b`, and the task and
  satisfied source/history gates are advanced to reached
  `HISTORY_INPUT_READY`. Its internal read-only adapter binds SHA-1/SHA-256
  repository snapshots, first-parent path history, raw source digests, typed
  availability, linked worktrees, and source/HEAD races without changing Git
  or the active public surface. `FINISH_ACTUALS` is complete, its exact
  pre-advance snapshot is committed at `2af13c4`, and the task is advanced to
  reached `FINISH_ACTUALS_READY`. Its internal eventful-finish Core provides
  deterministic identity, exact active-time and effort input, finish-only and
  complete coverage, retry/conflict handling, governed Grammar 5 safe write,
  and task-owned advance removal while the active public surface remains
  unchanged. `PROJECT_HISTORY` is complete, its exact pre-advance snapshot is
  committed at `c0eff39`, and the task is advanced to reached
  `PROJECT_HISTORY_READY`. Its internal pure reducer reconstructs explicit
  events, advance removal, qualified legacy Git-recorded transitions, exact
  task summaries, and typed availability from the first-parent probe;
  deterministic Result v1 text/JSON remains publicly inactive.
  `WORK_LIFECYCLE` is complete; Git commit `518a59e` records its exact
  completed 7p pre-advance snapshot, and the task is advanced to reached
  `LIFECYCLE_READY`. Its internal target provides exact
  start/suspend/resume candidates, deterministic retry and refusal, resource
  release, full remaining-duration schedules, and separate AnalysisResult
  v4/NextResult v5 suspended handling without changing the active public
  surface. `VELOCITY_OBSERVATION` is complete and retained done pending its
  pre-advance commit. Its pure service derives exact elapsed-hour,
  active-date, effort-productivity, and separately qualified Git-recorded
  rates without changing declared velocity or the active public surface. Two
  tasks and 10p remain; precedence and the `parallel-sgs` version 1 heuristic
  resource makespan are both 10p with no delay. Complete NextResult v4
  recommends and starts only `ACTUALS_PUBLIC_CONTRACT`.
  Public Grammar 5/CLI Contract 6 activation, Git mutation, velocity adoption,
  MIG-08, publication, and dist-tag movement remain outside scope. The
  independent workstream does not displace `PERT_PLANS`.
- The CLI/help review is tracked independently in `plans/cli-surface-reset.pert`. All nine tasks through `CLI_003_FILE_FIRST_ACCEPTANCE` are complete and advanced. Its accepted registry-driven design separates command help, domain guide, and agent guidance, includes project initialization and gate maintenance, and rejects renamed Contract 2 spellings. Contract 4 retains those invariants while extending every active JSON envelope and installed-package workflow for temporal and exact-unit behavior. The completed plan has no recommendation at `49p/1d`.
- The first Contract 3 package, suffix-free beta `0.2.0`, is accepted under `plans/release-0.2.0.pert`, `docs/process/0.2.0-release.md`, and its acceptance record. All five release tasks are complete and advanced; release commit/tag identity, common local/GitHub/npm tarball bytes, and installed Contract 3/file-first behavior are verified. Publication moved only `beta`; a separately authorized post-acceptance dist-tag operation then made npm `beta=latest=0.2.0`. The completed release plan remains unchanged with no recommendation at `17p/2d`.
- The suffix-free Contract 4 beta `0.3.0` is accepted. All six release tasks through `RELEASE_030_ACCEPTANCE` are complete and advanced. Release commit and peeled `v0.3.0` target `af44577` agree; the GitHub prerelease and npm registry tarballs have SHA-256 `197548a4...62074`; a separately authorized post-acceptance operation made npm `beta=latest=0.3.0`, while `alpha=0.1.0-alpha.2`. An unqualified global installation and light Contract 4 smoke passed. The plan has zero makespans, no recommendation, and observed cumulative velocity `19p/2d`.
- The accepted suffix-free beta `0.4.0` publishes the breaking Grammar 4 and Contract 5 cutover. `plans/release-0.4.0.pert` keeps completed governance implementation state separate. The release commit and peeled `v0.4.0` target `6b341d1` agree, the candidate/GitHub/npm tarballs have common SHA-256 `010af9ce...7cc4a`, and npm reported `beta=0.4.0`, unchanged `latest=0.3.0`, and `alpha=0.1.0-alpha.2` at acceptance. Public-package checks and a registry install passed. All six tasks and 19p are complete and advanced to reached `RELEASE_040_ACCEPTED`; the plan has zero makespans and no recommendation. A separately authorized post-acceptance operation made npm `beta=latest=0.4.0`; an unqualified isolated installation confirmed CLI Contract 5 and Grammar 4. Issue #4 closure remains separate.
- `TIME-001` and `UNIT-001` are accepted through SU-M5. SU-M5's 23p atomic Contract 4 acceptance is committed at `81b4828`, the detail is advanced to reached `CONTRACT4_ACCEPTED` at `f15a7ac`, and the macro rolled it up once and advanced to reached `SCHEDULING_UNITS_ACCEPTED` at `507fbb8`. Both plans have zero makespans and no recommendation. The accepted surface includes Grammar 1/2/3, CLI Contract 4, public result schemas, help, Guide, installed behavior, exact unit migration, and Next v4 normal start authority.
- The TypeScript CLI MVP, recommendation MIG-01 through MIG-07, and the read-only AI Agent Guidance Registry v1 are accepted. The current source and npm `beta=latest=0.4.0` implement CLI Contract 5 with Grammar 1/2/3/4, owner-aware governed maintenance, exact unit migration, AnalysisResult v3, UnitMigrationResult v2, and a complete known NextResult v4 as normal start authority. Contract 4 `0.3.0` and Contract 3 `0.2.0` remain available by pin. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply/audit remains unavailable until MIG-08.
- The normative precedence order is `docs/requirements.md`, `docs/specs/`, `docs/basic-design.md`, `docs/examples/`, `docs/process/`, and `plans/`.
- Before a non-trivial change, confirm the current checkout, goal, normative sources, acceptance criteria, non-goals, and verification method.
- For the “next task,” treat a known, complete, non-truncated `Perttool.NextResult.v4` with temporal policy `recommendation_v1_plus_release_gate` as the authority, choose a workstream from the macro startable recommended work package, and then reanalyze its corresponding detail plan. Start only `startable_recommended_task_ids`; normal selection is limited to a subset of that set, or the complete set plus exactly one resource-feasible, time-eligible allowed task. Do not start for an unknown version/policy, incomplete trace, `PTREC-*`, future/unavailable release eligibility, or deferred/discouraged result; reanalyze after changes to task state, time, or capacity.
- Maintain traceability across requirements/specification, design, implementation, and verification.
- Maintain task=edge, milestone=node, and gate=zero-duration dependency edge; do not convert shared resources into DAG dependencies.
- Distinguish the precedence critical path from the schedule critical path in a resource schedule.
- `docs/process/self-use.md` is authorized through Stage 3. Editing/advance writes require preview, review of the diff and removal list, expected digest, and post-write reanalysis.
- Confirm metadata such as Project ID, as_of, duration_unit, velocity, and finish with `project show --format json`; make changes through `project set` preview/diff and the Stage 3 safe-write procedure. Do not rely on visual source-file inspection or manual editing for the normal workflow.
- Run repository checks on Node.js 22 or later with `npm ci`, `npm run check`, and `git diff --check`; CI covers Node.js 22 and 24.
- Before staging, inspect the diff and status, and do not include unrelated user changes.
- Use `secdat exec` for remote writes and GitHub operations, and obtain explicit permission for destructive Git operations.
- Beta publication uses `beta` and does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicitly selected version and user permission. Use the release gates, the GitHub-identical tarball for publication, process-limited `NPM_TOKEN`, and the repository `secdat` route.
- Use sub-agents or parallel agent work only with an explicit user request or explicit permission in an active runtime policy.

Follow `AGENTS.md` for the detailed project map, domain invariants, validation, and Git rules.
