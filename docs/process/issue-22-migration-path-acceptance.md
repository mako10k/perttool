# Issue 22 Migration Path Acceptance

Date: 2026-08-20

## Accepted boundary

Issue #22 is corrected locally by restoring the retained repository-bound
Grammar 7 migration route to the active Contract 9 command surface.
`document migrate --target-grammar` now accepts `7` and `8`; help and JSON
discovery show both workflows and both applicable result schemas. Grammar 7
results use the active CLI Contract 9 envelope.

The selected implementation reuses the existing automatic Grammar 7 planner.
This is narrower and safer than adding a second manual construction workflow:
it already binds the committed source, repository, path, object format, HEAD,
stage-0 blob, source digest, candidate digest, and grandfathered milestones.
The general requirement still permits a manual CLI route when it shows the
complete correct target form, value provenance, and revalidation command.

## Evidence

- `llmthink dsl audit docs/process/issue-22-migration-path-rca.think --pretty
  --min-severity info`: fatal 0, error 0, warning 0; the remaining info finding
  records the intentionally separate release and external-write boundary.
- Focused Node.js 22 build and fourteen-test gate passed for Contract 9
  migration, command discovery, real repository migration, unsupported target,
  and post-migration advance reachability.
- The real CLI regression initializes and commits a Grammar 5 source, confirms
  help advertises targets 7 and 8 plus both result identities, previews and
  writes the exact Grammar 7 candidate, verifies `cli_contract_version` 9, and
  proves the following `dag advance` no longer emits `PTMAC-101`.
- The complete Node.js 22 repository gate passed: static analysis, 1,215 tests,
  English baseline, 316 Markdown documents, 44 self-use plans, isolated LSP,
  MCP, VSIX and supported VS Code 1.101.0 host, temporary link, 873-file package,
  publication dry-run, and installed Contract 9 workflows.
- `git diff --check` passed.

## Preserved boundaries

Grammar 7 and Grammar 8 migration semantics, milestone acceptance, repository
history proof, governance, safe writes, `dag advance` force behavior, all
unrelated commands, and public schema definitions remain unchanged. Version
selection, commit, push, tag, GitHub release, npm publication and dist-tag
movement, Issue mutation, and plan advance require their own release gates.
