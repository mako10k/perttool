# Repository Guidelines

## Scope and communication

These instructions apply to the entire repository. English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English. Existing Japanese content remains explicit migration debt in `plans/english-baseline.pert`; do not translate unrelated legacy text opportunistically.

User communication is independent from the repository baseline. Unless the user requests otherwise, respond to the user in Japanese. Preserve user-authored `.pert` content and intentional Unicode fixtures. Do not add runtime i18n, locale negotiation, translation catalogs, or a `--locale` option without a new requirement and architecture decision.

- Distinguish directly verified facts, inferences, and unverified matters.
- Verify the current checkout, normative documents, and command results before making a judgment.
- Do not infer or invent commands, files, package scripts, or operational rules that do not exist.
- Do not substitute user-provided terms or completion criteria with a different meaning merely because it is easier to implement.

## Current phase and sources of truth

perttool has accepted its TypeScript CLI MVP, the read-only AI Agent Guidance Registry v1 from Issue #2, and the first suffix-free beta release, `v0.1.0`. The release was published from one verified tarball to a GitHub prerelease and npm `beta`, then explicitly promoted to npm `latest` after acceptance; both tags resolve to `0.1.0`. The implemented surface includes `dsl check`, `dsl format`, `dsl help`, read-only `agent help`, `dag analyze`, `dag next` v3, read-only `validateOverride`, `dag advance`, Mermaid export/import, source-preserving formatter and mutation Core APIs, atomic batch, safe-write I/O, editing/advance CLI write controls, project metadata CLI, and the grammar acceptance suite. A complete and known `Perttool.NextResult.v3` remains the normal AI task-selection authority. The macro plan is complete and has no ready task. The independent English-baseline detail plan has completed and advanced `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE`, and now recommends `PERT_PLANS`. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply, durable audit, and Git integration remain unavailable until MIG-08.

The reviewed CLI/help reset is tracked independently in `plans/cli-surface-reset.pert`. `CONTRACT_V3_DESIGN`, `CLI_001_COMMAND_REGISTRY`, and `HELP_001_COMMAND_DISCOVERY` are complete and advanced. The active Contract 2 surface uses one typed command registry for dispatch and option parsing, while the internal Contract 3 preview provides deterministic top-level, resource, and action text/JSON projections; public Contract 3 commands remain inactive. The plan has 31p remaining, an observed provisional `18p/1d` velocity, 18p precedence and 31p heuristic resource makespans, and recommends `MUT_002_GATE_MAINTENANCE`. `project init` remains the unimplemented `MUT-001` backlog item.

`project show`, which returns the complete project metadata including velocity, source-preserving `project set`, and atomic-batch `project.set` are also implemented. The observed operational velocity was recalibrated to `29p/2d` from a cumulative 29p over 2 active days, including 5p on 2026-07-23.

ADR 0004 adopts English as the repository baseline. `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE` are complete and advanced; `plans/english-baseline.pert` now has 9p remaining, matching 9p precedence and resource makespans, and an observed `33p/1d` velocity, and recommends `PERT_PLANS`.

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
- `docs/specs/`: normative specifications for grammar, graph semantics, analysis, mutation, and interfaces.
- `docs/adr/`: adopted architecture and runtime decisions.
- `docs/examples/`: normative parser and analysis samples.
- `docs/process/`: operating procedures for self-use and AI development.
- `plans/`: current and future work for perttool. Use `mvp.pert` as the macro roadmap through beta; use `grammar.pert`, `control-plane.pert`, `operations.pert`, `recommendation.pert`, `agent-guidance.pert`, and `english-baseline.pert` as Stage 3 preview-first detail plans; and use `cli-surface-reset.pert` as the independent post-beta review-derived workstream.
- `scripts/`: repository-local verification commands.
- `.github/workflows/`: CI using the same entry points as local verification.
- `src/`: TypeScript parser, validator, Core API, CLI, and help implementations.
- `src/command/`: immutable typed command descriptors, shared-option expansion, dispatch lookup, and deterministic text/JSON help projections.
- `src/analysis/`: residual graph, precedence CPM, and resource-schedule implementations using exact Rational values.
- `src/recommendation/`: pure Core that derives candidate facts, complete order, selection horizon, joint-feasible recommended sets, tiers, a typed explanation graph, PTREC invariants, JSON projections, read-only override validation, and canonical artifacts from actual ready tasks.
- `src/conversion/`: Mermaid profile/plain export and import, semantic metadata, projection generation, and fail-closed restoration.
- `src/editing/`: deterministic unified diff shared by formatter and mutation.
- `src/formatter/`: source-preserving formatter Core.
- `src/guidance/`: read-only pure Core that provides versioned offline AI Agent Guidance profiles, validation, queries, index/quick/detail projections, and deterministic JSON/text.
- `src/io/`: raw-byte document reads, digests, symlink/race rejection, and an atomic safe-write adapter.
- `src/mutation/`: requests for project/task/milestone/resource and atomic batch, canonical advance, source-preserving UTF-16 TextEdit generation, and application rules.
- `src/application/`: pure services for check/project metadata/analyze/next that return revalidated mutation results.
- `test/`: fixtures for the Node.js built-in test runner; analysis/next/formatter/mutation/conversion/write-safety unit tests; and CLI integration/E2E tests.
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

When the user asks for the “next task,” first present candidates based on recommended specification work in `docs/requirements.md`, unresolved matters, and the current Git state. From self-use Stage 1 onward, use the macro recommendation in `mvp.pert` to choose a workstream, then reanalyze the corresponding detail plan and choose a task from its detail recommendation. Base candidate selection on the `check`, `analyze`, and `next --format json` results for both the macro plan and the target detail plan; do not directly compare tasks from different detail plans without a macro decision.

For normal task selection, use only a known `Perttool.NextResult.v3`, recommendation interface 1, ranking algorithm 1, reason taxonomy 1.0, explanation/expression/description model 1, locale `en`, and a complete, non-truncated trace as the authority. You may choose a subset of recommended tasks, or a set retaining all recommended tasks with exactly one additional resource-feasible `allowed` task. Do not start for an unknown version, incomplete trace, `PTREC-*`, or a `deferred`/`discouraged` selection; stop safely. Reanalyze rather than reusing the same result after task start, completion, blocking, or capacity changes. Do not apply a selection requiring a human override until MIG-08; report its difference from the normal recommendation and the still-unavailable audit/apply boundary.

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

Run the repository checks from the root with Node.js 22 or later. CI verifies Node.js 22 and 24. `npm run check` includes check/analyze/next validation for the MVP, grammar, control-plane, operations, recommendation, agent-guidance, English-baseline, and CLI-surface-reset plans.

```sh
npm ci
npm run check
git diff --check
```

For narrow checks, use `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:docs`, `npm run check:link`, and `npm run check:package`. `check:link` links into a temporary user prefix to inspect the CLI and does not change the real user prefix. `check:package` creates a release tarball in a temporary directory and checks exclusion of repository-only files, npm publish normalization dry-run, and installation into an isolated prefix. `bash scripts/check-docs.sh` is the documentation-only lower-level entry point.

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
- npm publish must satisfy the alpha or beta release gate and send the explicit GitHub Release tarball to the intended dist-tag. Beta publication uses `beta` and does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicit user-selected version and permission. Inject `NPM_TOKEN` only into that process through `secdat`.
- Do not run destructive operations such as `git reset --hard`, `git clean`, force-push, or shared-history rewrites without explicit approval that identifies the target and impact.
- Do not commit secrets, credentials, local caches, or generated reports.
