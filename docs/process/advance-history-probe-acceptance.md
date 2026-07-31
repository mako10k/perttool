# Advance History Probe Acceptance

- Document status: Accepted 1.0
- Review date: 2026-07-31
- Baseline task-start commit: `f3eed2d`
- Exact completed pre-advance commit: `4265621`
- Plan: [`plans/advance-history-safety.pert`](../../plans/advance-history-safety.pert)
- Plan task: `ADV_HISTORY_PROBE`
- History-safety model: 1
- Runtime activation: none

## 1. Decision

Accept the internal read-only baseline capture and pure destructive-range
assessment for `ADV-001`. The implementation satisfies the probe slice of the
[Advance History Safety Contract](../specs/advance-history-safety.md) without
activating a public option, result identity, diagnostic, command behavior, or
write guard.

The implementation remains internal:

- `src/history/git-probe.ts` adds one current-`HEAD` and stage-0-index capture
  over the same repository, path, object-format, linked-worktree, raw-source,
  and race boundary as project history.
- `src/history/advance-history.ts` derives entity/field-owned destructive
  records without parsing unified diff text, computes deterministic model-1
  Myers raw-byte edits, and performs pure correspondence and overlap
  assessment.

The existing first-parent project-history probe and reducer are unchanged.
The new capture never stages, commits, stashes, checks out, resets, updates a
ref, or writes a repository file.

## 2. Accepted behavior

| ID | Accepted probe behavior |
| --- | --- |
| `AHP-001` | Model 1 produces deterministic insertion, deletion, and replacement ranges with deletion-first tie behavior. |
| `AHP-002` | Every binary sequence pair through length five has the minimum insert/delete cost. |
| `AHP-003` | Exact current, `HEAD`, and stage-0 destructive bytes pass. |
| `AHP-004` | Unstaged declaration or owned-comment changes block with the affected entity ID. |
| `AHP-005` | Invalid staged syntax and valid dirty source wholly outside destructive ranges remain permitted. |
| `AHP-006` | A staged destructive-range change blocks even when the working source matches `HEAD`. |
| `AHP-007` | Missing task-owned work-event correspondence fails closed; exact BOM and CRLF baselines pass. |
| `AHP-008` | Capture binds repository, relative path, object format, `HEAD`, target blob, stage-0 blob, source digest, modification time, and raw bytes without changing Git. |
| `AHP-009` | No repository, no `HEAD`, untracked paths, stale source, missing Git, symlinks, and uncommitted renames fail with stable internal causes. |
| `AHP-010` | SHA-256 repositories and linked worktrees pass; an unmerged index fails closed. |
| `AHP-011` | Source, `HEAD`, and stage-0-index changes during capture are detected before a result can be complete. |
| `AHP-012` | The active package root, CLI registry, result schemas, help, write path, and installed command surface do not expose the probe. |

## 3. Composition boundary

This slice returns evidence and a pure decision only. It does not decide
whether `dag advance` is a preview, separate output, no-op, governance
denial, warning denial, forced write, or persistent write. It does not create
`Perttool.AdvanceResult.v1` or emit `PTADV-*`.

`ADV_HISTORY_CLI` owns:

1. attaching destructive records to the active Grammar 5 advance candidate;
2. invoking the capture only for a changed destructive in-place write after
   governance and warning authorization;
3. rechecking source, `HEAD`, and the stage-0 index after assessment and
   immediately before atomic replacement;
4. the exact `--force-history-loss`, result, diagnostic, help, and schema
   surface; and
5. preserving every existing safe-write and post-write gate.

## 4. Verification

The focused implementation and adjacent history/advance regressions passed:

```sh
npm run build
node --test \
  test/advance-history-probe.test.mjs \
  test/project-actuals-git-history-probe.test.mjs \
  test/project-actuals-history.test.mjs \
  test/advance.test.mjs
```

The focused run passed 31 tests. The complete repository gate then passed:

- 688 tests;
- English-baseline validation over 517 text files;
- documentation validation over 128 Markdown files and 7 normative PERT
  examples;
- read-only `check`, `analyze`, and `next` self-use over 27 plans;
- the temporary-link workflow; and
- the 495-file isolated-package workflow and beta publication dry run.

No remote Git write, GitHub mutation, package publication, npm dist-tag
change, release, or Issue mutation is part of this acceptance.
