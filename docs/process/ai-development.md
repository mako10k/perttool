# AI Development Guide

- Document status: Active 0.5
- Created: 2026-07-21
- Updated: 2026-07-23
- Shared instructions: [../../AGENTS.md](../../AGENTS.md)
- Self-use plan: [self-use.md](self-use.md)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)
- Recommendation design review: [recommendation-design-review.md](recommendation-design-review.md)
- Agent Guidance Provider baseline: [agent-guidance-provider-baseline.md](agent-guidance-provider-baseline.md)

## 1. Purpose

Maintain a repository structure in which Codex, GitHub Copilot, and other coding agents can develop perttool by consulting the same canonical sources, work boundaries, verification commands, and Git rules.

Do not give each AI a separate product judgment. Put project-specific meaning in documents and tests, and put only tool-specific entrypoints in `AGENTS.md`, `.github/`, and `.codex/`.

### 1.1 Repository language

English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English.

This rule does not force the conversation language. Agents continue to answer the user in the language requested by the user, including Japanese, while keeping committed artifacts in English. User-authored `.pert` content and explicit Unicode round-trip fixtures are never translated automatically.

The repository does not currently implement i18n, locale negotiation, translation catalogs, or a `--locale` option. Stable codes, field names, enum values, typed facts, and schema versions are the machine contract; natural-language text is a deterministic projection. Existing Japanese content is migrated in bounded tasks from [`plans/english-baseline.pert`](../../plans/english-baseline.pert) after the first beta.

## 2. Local repositories consulted

On 2026-07-21, the checkout directories immediately below `~/` that had recent modification times and AI development entrypoints were examined.

| Repository | Extracted pattern | Adoption in perttool |
| --- | --- | --- |
| `~/kafs` | Project map, existing commands, task-start gates, PERT-based next-task selection, conservative Codex settings | Simplified and adopted in `AGENTS.md` |
| `~/power-limit-cdt` | Codex/Copilot compatibility through `AGENTS.md` as shared canonical guidance, traceability from requirements through verification, checks before remote operations | Adopted in shared instructions and Git rules |
| `~/kscr_selfhost` | Inspect the repository first, risk-first review, focused commits, proportional validation, `secdat exec` | Adopted in workflow and review rules |
| `~/secexec` | Separate agent entrypoints from project-specific hard rules and identify detailed sources of truth | Adopted as a policy to place domain invariants in canonical documents |
| `~/openai-xmpp-bot-20250923` | `.editorconfig` and a single CI entrypoint | Adopted in whitespace conventions and repository-check CI |

The following were not adopted.

- Product-specific safety rules or deployment procedures
- Many custom agents whose roles overlap at this stage
- A large-repository workflow that mandates issues, branches, worktrees, and PRs for every change
- Premature definitions of build, lint, or test commands that do not exist
- Abstract completion gates that the current perttool cannot verify

## 3. Instruction architecture

```text
AGENTS.md                         shared canonical guidance
├── .github/copilot-instructions.md  Copilot entrypoint and mandatory summary
├── .codex/config.toml               conservative project-local defaults
├── docs/process/ai-development.md   rationale and operating workflow
├── package.json                     executable repository check
│   └── npm run check                typecheck, test, docs
├── scripts/check-docs.sh            documentation sub-check
├── scripts/publish-npm.sh           npm dry-run and explicit release-tarball publish gate
└── .github/workflows/ci.yml         same npm check in CI
```

When adding a rule, prioritize a test that can detect a violation or a concrete review checkpoint. Do not lengthen `AGENTS.md` merely by adding general advice.

## 4. Standard workflow

### 4.1 Start

1. Confirm the current state with `git status --short --branch` and `git log`
2. Confirm the user's objective, type of work, and change scope
3. Read canonical sources in the priority order in `AGENTS.md`
4. Determine acceptance criteria, non-goals, and verification commands
5. Decide whether documents or implementation should change first

### 4.2 Change

- Make one coherent capability or specification decision one change
- Do not mix in unrelated cleanup
- Preserve existing contracts such as stable IDs, determinism, source spans, and loss reports
- Propagate specification changes to samples and tests
- For files with user changes, integrate with the existing diff rather than overwriting it

### 4.3 Validate and review

The common checks at this stage are:

```sh
npm ci
npm run check
git diff --check
```

Depending on the change scope, first run `npm run typecheck`, `npm test`, or `npm run check:docs` as narrow checks.

Then use `git diff -- <target-file>` to confirm the following.

- There is no contradiction among canonical sources
- No requirement or acceptance criterion is missing
- Examples actually represent the specification
- Heuristics, inferences, and exact results are not confused
- Open matters are not silently pushed into future implementation

### 4.4 Close out

1. Confirm with `git status --short` that only the target files are changed
2. Explicitly stage the target files
3. Review the staged diff and `git diff --cached --check`
4. Distinguish checks that were run from those not run
5. Perform remote writes through `secdat exec`
6. After pushing, confirm the local branch and remote tracking branch

npm publication is outside normal close out. Follow the alpha or beta release gate, verify the common tarball, remote commit/tag, and unpublished version, and inject `NPM_TOKEN` through `secdat` only after explicit user permission. Beta publication uses `beta` without moving `latest`. A later `latest` promotion is a separate, explicitly authorized dist-tag mutation. Never retry an ambiguous registry mutation before checking durable state.

## 5. Next-task selection and self-use

Before implementation, use the recommended specification work and open matters in `docs/requirements.md`. Propose the "next task" only after confirming that its hard predecessors are closed in the current checkout.

After meeting Stage 1 of `docs/process/self-use.md`, add perttool's own `.pert` plans to the canonical sources. In Stage 3, editing commands and `dag advance` may be used as canonical writers through preview-first, expected-digest, and post-write reanalysis procedures. Contract 4 extends the MIG-07 recommendation gate: task selection uses a complete, known `Perttool.NextResult.v4` and its temporal authority as follows.

1. Run `perttool document check` on `mvp.pert` and the current detail plan to confirm that the plans are valid. Use `perttool project show --format json`, rather than directly viewing the source, to inspect metadata such as project ID, as_of, duration_unit, velocity, and finish
2. Run `dag analyze` and `dag next --format json` for `mvp.pert`, confirm a known version, complete trace, temporal policy `recommendation_v1_plus_release_gate`, and no `PTREC-*`, then select a workstream from `startable_recommended_task_ids`
3. Run `dag analyze` and `dag next --format json` for the detail plan corresponding to that work package, confirm the same consumer gate, then select the detail recommended task
4. Treat as normal selection either a startable recommended subset or the startable recommended set plus exactly one time-eligible, resource-feasible `allowed` task while retaining every startable recommended task
5. Explain the decisive step, higher-priority tasks, and comparison from project facts, and confirm external blocks and available resources
6. After a task start, completion, block, or capacity change, do not reuse the result; reanalyze the detail plan and the necessary macro plan

When changing project metadata, inspect the `project set` preview or `--diff`, and use the Stage 3 `--write` procedure with an expected digest for persistence. If a project-wide unit change also requires task duration or estimate changes, combine `project.set` and the related mutations in one atomic batch. Do not depend on visual source inspection or manual editing for normal metadata viewing and editing.

Do not directly compare tasks from different detail plans without a macro decision. Do not substitute `groups.ready`, `groups.runnable_now`, the raw recommended set, or the text summary for start authority. With an unknown schema/model/temporal-policy version, incomplete or truncated trace, unknown tier, `PTREC-*`, or future or unavailable temporal eligibility, do not start a task; stop safely. Do not start `deferred` or `discouraged` work under normal authority.

The 2026-07-22 [Recommendation design acceptance](recommendation-design-review.md), grammar acceptance, formatter/mutation preview, safe write, Mermaid export/import round trip, and advance Core/CLI are complete and are in Stage 3 self-use. The missing MVP acceptance condition 16 found by the [release-readiness audit](mvp-release-readiness.md) was resolved by MIG-01 through MIG-07, totaling 22p, in the [Recommendation implementation plan](../../plans/recommendation.pert). The [five-plan shadow evaluation](recommendation-shadow-review.md), read-only override validation, normal-authority dry run, unknown-version safe stop, and shared-instruction/help synchronization are accepted. The provisional Recommendation-specific observation is `22p/1d`, and distribution of the same `v0.1.0-alpha.2` artifact through GitHub/npm and registry installation are complete.

The first suffix-free beta, `v0.1.0`, is [accepted](beta-release-acceptance.md). One tarball was verified across the GitHub prerelease, npm `beta`, and an isolated registry installation. It was then explicitly promoted to npm `latest`; both tags resolve to `0.1.0`. The macro plan is advanced to `M8_BETA_RELEASED` and has no ready or recommended task. Issue #3, the LSP server, VSIX, and MCP server remain independent post-beta backlogs.

ADR 0004 adopts English as the repository baseline immediately. The legacy-surface migration is tracked in `plans/english-baseline.pert`. The `M8_BETA_RELEASED` gate is reached. `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE` were completed and advanced through Stage 3 preview-first writes; the inventory and Unicode allowlist are recorded in `english-surface-inventory.md`, and fresh analysis now recommends `PERT_PLANS`.

The human/LLM CLI surface review and its eight backlog items are also tracked
as an independent post-beta workstream in
[`plans/cli-surface-reset.pert`](../../plans/cli-surface-reset.pert).
`CONTRACT_V3_DESIGN`, `CLI_001_COMMAND_REGISTRY`,
`HELP_001_COMMAND_DISCOVERY`, `HELP_002_DOMAIN_GUIDE_SPLIT`,
`HELP_003_USAGE_RECOVERY`, `MUT_001_PROJECT_INIT`, and
`MUT_002_GATE_MAINTENANCE` are complete and advanced.
`CLI_002_CONTRACT_V3_CUTOVER` then activated hierarchical command
help, the separate domain-guide projection, registry-scoped usage recovery,
project initialization, gate maintenance, all renamed commands, and Contract 3
JSON envelopes in one source change. `CLI_003_FILE_FIRST_ACCEPTANCE` completed
the installed-package initialize/read/change/analyze/select/advance/validate
workflow using typed mutations for every entity field. The detail plan is now
complete with no recommendation. The published `0.1.0` artifact remains
Contract 2 until a separately authorized release.

The user then selected suffix-free beta `0.2.0` as the first Contract 3 package
target. The independent [`release-0.2.0.pert`](../../plans/release-0.2.0.pert)
workstream and [`v0.2.0` procedure](0.2.0-release.md) separate normative gate
design, local source preparation, clean-candidate acceptance, explicitly
authorized distribution, and durable release acceptance.
All five `RELEASE_020_*` tasks are complete and advanced. Version `0.2.0` was
published from one verified tarball to a GitHub prerelease and npm `beta`;
local, GitHub, and registry bytes match; and installed Contract 3 and
file-first checks passed. Publication moved only `beta`; after acceptance, a
separately authorized dist-tag operation made npm `beta=latest=0.2.0`. The
plan remains unchanged with no remaining or recommended task at `17p/2d`.
The durable [acceptance record](0.2.0-release-acceptance.md) contains the
release identity, artifact digests, dist-tags, and verification commands.

The next public target is suffix-free beta `0.3.0` for the atomic Contract 4
cutover. The independent
[`release-0.3.0.pert`](../../plans/release-0.3.0.pert) plan verifies the
accepted scheduling-and-units finish, then separates source preparation,
candidate acceptance, the authorized Git/GitHub/npm `beta` PUBLISH operation,
and durable acceptance. `RELEASE_030_GATE_DESIGN` is complete and advanced;
complete Next v3 recommends `RELEASE_030_CONTRACT_4_READINESS`, which waits
for the accepted scheduling-and-units finish. The current authorization stops
after PUBLISH and does not include npm `latest` promotion.

### 5.1 Adopted Recommendation authority

MIG-07 established Recommendation version 1 authority. The atomic Contract 4
cutover adds the temporal release gate without changing ranking. Because
`AGENTS.md`, `.github/copilot-instructions.md`, help, and safe-stop tests move
together, normal task selection uses the following as authority.

1. Select a work package from the macro plan's complete JSON recommendation
2. Reanalyze the selected work package's detail plan and select a task from its complete JSON recommendation
3. Start only IDs exposed by `startable_recommended_task_ids`; under normal
   authority, select only a subset of that set or retain it and add one
   time-eligible, resource-feasible allowed task
4. Confirm the decisive step, higher-priority tasks, and comparison, and explain the selection from project facts
5. Stop automatic selection for an unknown schema/version or temporal policy,
   incomplete trace, `PTREC-*`, or future or unavailable temporal eligibility
6. Reanalyze the detail plan after a detail-task start, completion, block, or capacity change; also reanalyze the macro plan if macro work-package status, roll-up duration, or capacity changes

Human instructions to select `deferred` or `discouraged` are distinct from normal recommendations. Until the override-apply gate is met, do not fabricate an applied artifact; AI presents the difference and the not-yet-enabled audit/apply boundary. Provider-specific prompts, skills, agents, and hooks reach the same rules through the Issue #2 guide and do not add provider-specific priority rules.

Tool output is evidence for selection, not independent evidence of task completion. Confirm completion through the corresponding specification, code, and test results.

## 6. Parallel-agent workflow using isolated worktrees

Use sub-agents, delegation, or parallel agent work only when the user explicitly requests it or an effective runtime policy permits it. A `dag next` result that returns several `runnable_now` tasks means those tasks can run concurrently in the process; it does not itself authorize using agents.

### 6.1 Applicability conditions

Consider parallel work only when all of the following hold.

- Macro/detail plan checks and analysis succeed, and the target tasks can run concurrently under hard-predecessor and resource conditions
- The current main worktree is clean, and all agents can be pinned to the same base commit
- File ownership can be exclusively separated, or a boundary can be created where only the integration owner changes shared files
- Each task's acceptance criteria, non-goals, narrow validation, and commit condition can be written independently
- Shared external side effects such as deploys, pushes, and issue updates are not performed in parallel by agents

Do not parallelize edits to the same canonical file, an unresolved single semantic decision, serial dependencies, or work overlapping the user's uncommitted changes. Do not assume semantic independence merely because files differ.

### 6.2 Responsibilities of the integration owner and agents

The integration owner alone manages the following.

- Base commit, branch name, and absolute worktree paths
- Each agent's exclusive files, readable canonical sources, and prohibited files
- Integration of shared requirements, parent specifications, plan status, golden files, and process documents
- Review order for agent commits, semantic adjustment after integration, and whole-repository verification

Each agent changes no worktree other than the assigned one and makes one coherent commit containing only its exclusive files. Agents do not mark tasks in a shared plan `done`, push remotely, or cherry-pick from another branch. Completion reports include the commit hash, changed files, verification, and unresolved matters.

### 6.3 Worktree setup

Before creation, use read-only commands to confirm that main status, the base commit, existing worktrees, branches, and target paths do not conflict.

```sh
git status --short --branch
git worktree list --porcelain
git branch --list 'agent/<task-id>'
git worktree add -b agent/<task-id> <validated-absolute-path> <base-commit>
git -C <validated-absolute-path> status --short --branch
```

Use an explicit absolute path for each task as the target path. Do not use `~`, `$HOME`, the workspace root, or unresolved globs as creation/removal targets. Each agent prompt states the worktree path, branch, base, exclusive files, canonical sources to consult, acceptance, validation, and remote prohibition.

### 6.4 Review and integration

For each agent, perform the following in order.

1. Confirm that the target worktree is clean, the branch is as planned, and the commit descends directly from the base
2. Review exclusive-file boundaries, specifications, and missing tests with `git show --stat <commit>` and the actual diff
3. Reconfirm that main is clean and cherry-pick one commit at a time
4. After integrating every agent commit, have the integration owner update shared canonical sources and plans/golden files as one logical change
5. Run `npm run check` and `git diff --check`, then reconfirm macro/detail plan check/analyze/next results

The absence of a cherry-pick conflict does not prove semantic consistency. The integration owner reviews across both agents to ensure they have not fixed the same terms, versions, or invariants to different meanings. If they conflict, do not mechanically adopt both; resolve the shared decision on main.

### 6.5 Success, failure, and cleanup

A parallel trial succeeds only if all of the following hold.

- Each agent commits only exclusive files and its narrow validation succeeds
- Individual integration into main produces no unintended diff
- Cross-specification review and shared-canonical-source adjustment are complete
- The full repository check and post-reanalysis plan golden files succeed
- Commit history preserves logical units for agent results and the integration change

If an agent fails, times out, or exceeds scope, retain the target worktree and branch and inspect status/diff. Do not force-remove, force-delete, or automatically integrate an unreviewed commit. Even after success, before cleanup confirm that the worktree is clean and its branch commit is integrated into main; use only `git worktree remove` on a validated absolute path and ordinary `git branch -d`. Because the commit hash changes after cherry-picking, do not rely only on ancestor checks: confirm that the relevant commit from `git cherry main agent/<task-id>` is `-`, and inspect the actual main-side diff to verify patch equivalence. In that case ordinary `git branch -d` can refuse deletion because the branch is unmerged in ancestry. Do not automatically switch to `-D`; retain the source branch without explicit deletion permission.

### 6.6 2026-07-22 trial

`RANKING_POLICY` and `REASON_CODE_TAXONOMY` were confirmed to be both ready and `runnable_now` in `plans/control-plane.pert`, then separated into different branches/worktrees from commit `aaabd83`. Each agent committed only one new specification file, and they were integrated into main as `7333a12` and `9eb47cb` without conflict.

The integration owner made causal ranking reasons mandatory for recommended tasks in the reason taxonomy, and reconciled canonical references, requirements, basic design, plans, and golden files across both specifications. `npm run check` succeeded with 90 tests, 21 Markdown files, three self-use plans, and link/package checks.

This trial confirmed that main and other worktrees can remain clean and file conflicts can be avoided even when agents complete at different times. After confirming patch equivalence and clean status, the two worktrees were removed. The source branches were retained without force-deletion because ordinary deletion was refused as unmerged in ancestry after cherry-picking. Semantic consistency between specifications, shared traceability, and plan updates are not resolved automatically; they remain the sole responsibility of the integration owner.

## 7. Evolution rule

The TypeScript scaffold fixes the following.

- Node.js 22 or later, npm, ESM, and TypeScript 7.0
- `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:link`, `npm run check:package`, and `npm run check`
- CI runs `npm run check` on Node.js 22 and 24
- Sources are in `src/`, tests/fixtures are in `test/`, and generated artifacts are in `dist/`
- `node_modules/`, `dist/`, coverage, and tsbuildinfo are not tracked by Git
- Runtime dependencies are currently zero; add them only when required

Do not let AI configuration become more complex before the implementation workflow does.
