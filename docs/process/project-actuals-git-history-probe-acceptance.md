# Project Actuals Git History Probe Acceptance

## Decision

`ACTUAL_GIT_HISTORY_PROBE` is accepted as an internal read-only Git evidence
boundary. The implementation resolves one regular target file to a
repository-relative path, binds an optional caller digest and selected
revision, and returns deterministic first-parent path snapshots without
activating project history through the standard package root or CLI Contract
5. Git commit `2198a0b` records the exact completed 5p pre-advance snapshot.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, and the shared `ADV-001` read-only inspection boundary. It
does not activate Grammar 5, CLI Contract 6, semantic history reconstruction,
or an advance enforcement decision.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Repository binding | The result binds `sha1` or `sha256`, resolved commit, repository-relative `/` path, current source digest, and optional expected source digest without exposing the absolute repository path. |
| Traversal | Only first-parent path-changing commits are inspected in commit order. Non-first-parent commits are not unioned into history; a merge snapshot retains every parent ID. |
| Snapshot | Each record contains the selected repository snapshot ID, commit and parent IDs, committer time as `recordedAt` provenance, raw bytes and digest, or null bytes and digest for a deletion. |
| Availability | Missing repository, `HEAD`, revision, selected tracked path, ambiguous path, shallow boundary, rename boundary, changed `HEAD`, and changed target have stable typed outcomes. Process, malformed-output, Git-command, and filesystem failures fail closed. |
| Race boundary | The target is opened without following a final symlink and bound by real path, device, inode, and digest. `HEAD` and the target are rechecked after snapshot inspection. |
| Compatibility | Linked worktrees and SHA-256 object repositories are supported. The probe remains absent from the active package root, CLI, help, result schemas, and installed Contract 5 workflow. |
| Git effects | Git commands run without a shell, optional locks, lazy fetch, or replace objects. Tests compare `HEAD`, refs, worktree status, and index bytes before and after repeated probes. |

Commit committer time is evidence of when a snapshot was recorded. It is not
an actual work-event time and cannot populate actual start, finish, cycle
time, active time, or velocity observations.

## Verification

The acceptance snapshot passed:

```sh
npm ci
npm run typecheck
node --test test/project-actuals-git-history-probe.test.mjs \
  test/project-actuals-design.test.mjs
npm test
npm run check
git diff --check
```

Focused Git tests use real repositories and cover repeated deterministic
inspection, raw BOM/CRLF bytes, first-parent merge handling, deletion and
restoration, explicit revisions, no repository, no `HEAD`, unknown revisions,
untracked targets, digest mismatches, symlinks, unavailable Git processes,
SHA-256 repositories, renames, shallow clones, linked worktrees, and target
and `HEAD` races. The full test run contains 604 passing tests, and the
repository check also passed all twenty self-use plans plus link and isolated
installed-package acceptance.

## Retained boundaries

This slice does not parse snapshots as supported `.pert` versions,
deduplicate event IDs, reconstruct event removal, qualify legacy transitions,
derive task summaries, observe velocity, enforce `ADV-001`, mutate Git state,
activate public commands or schemas, publish a release, or move a dist-tag.
Those remain separate residual work or authorization boundaries.
