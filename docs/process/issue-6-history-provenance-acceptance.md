# Issue #6 History-Provenance Acceptance

Status: Accepted locally on 2026-08-21.

## Result

Issue #6 now has a bounded command-line recovery for a path that Git classifies
as a rename even though the selected path starts a different project. Default
`automatic` behavior remains fail-closed. Explicit
`--history-provenance new-root` succeeds only with exact, readable, stable
different-project predecessor evidence and exposes that evidence in both
history and velocity results.

The implementation does not follow the predecessor, select a similarity
policy, or mutate Git, source bytes, the index, refs, or declared velocity.
Those future capabilities remain explicitly tracked in `SCM-002`.

## Verification

The complete Node.js 22 repository gate passed:

- pinned duplication and complexity ratchets, with one obsolete legacy
  complexity exception removed;
- 1,226 tests, including the twelve Issue #6 contract cases and real SHA-1,
  SHA-256, linked-worktree, shallow, race, same-project, missing-evidence, and
  unusual-path histories;
- English and 334-Markdown documentation checks;
- read-only self-use over 44 plans;
- isolated LSP, MCP, and supported VS Code 1.101.0 VSIX acceptance;
- temporary npm link acceptance;
- an isolated 876-file package, publish dry-run, installed Contract 9
  file-first workflow, and installed plan-assurance compatibility.

The installed and direct CLI paths expose the same closed option, Help, Guide,
schema, text, JSON, diagnostic, and provenance values. Project-history and
velocity-observation JSON reuse byte-identical provenance objects.

## Boundary

Grammar 8, CLI Contract 9, version `0.10.3`, 56 commands, 25 schemas, public
exports, result identities, and mutation authority are unchanged. This is a
local implementation acceptance only. Release selection, version change,
publication, remote push, GitHub Issue mutation, and plan advance remain
separate decisions.
