# Repository Instructions

Treat `AGENTS.md` as the source of truth for repository guidance shared by Codex and GitHub Copilot. When changing durable workflows or project rules, verify this file remains aligned in the same commit.

Mandatory summary:

- English is the canonical language for tracked repository artifacts. Respond to the user in Japanese unless requested otherwise. Preserve user-authored Unicode content, and do not introduce runtime i18n or locale negotiation.
- ADR 0004 is active. Existing Japanese surfaces are migration debt in `plans/english-baseline.pert`. `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE` are complete and advanced, and `PERT_PLANS` is the current recommended detail task.
- The CLI/help review is tracked independently in `plans/cli-surface-reset.pert`. `CONTRACT_V3_DESIGN` is complete and advanced; Contract 3 is designed but unimplemented, `project init` remains backlog `MUT-001`, and `CLI_001_COMMAND_REGISTRY` is the current recommendation.
- The TypeScript CLI MVP, recommendation MIG-01 through MIG-07, and the read-only AI Agent Guidance Registry v1 are accepted. A complete and known `Perttool.NextResult.v3` is the normal AI task-selection authority. The first suffix-free beta, `v0.1.0`, was published from one verified tarball to a GitHub prerelease and npm `beta`, then explicitly promoted to npm `latest`; both tags resolve to `0.1.0`. The macro plan is complete with no ready task. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply/audit remains unavailable until MIG-08.
- The normative precedence order is `docs/requirements.md`, `docs/specs/`, `docs/basic-design.md`, `docs/examples/`, `docs/process/`, and `plans/`.
- Before a non-trivial change, confirm the current checkout, goal, normative sources, acceptance criteria, non-goals, and verification method.
- For the “next task,” treat a known, complete, non-truncated `dag next --format json` as the authority, choose a workstream from the macro recommended work package, and then reanalyze its corresponding detail plan. Normal selection is limited to a recommended subset, or all recommended tasks plus exactly one resource-feasible allowed task. Do not start for an unknown version, incomplete trace, `PTREC-*`, or deferred/discouraged result; reanalyze after changes to task state or capacity.
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
