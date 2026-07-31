# Advance History Safety Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-07-31
- Baseline HEAD: `9d263746df4c8917c740e59e2d0009dbf80cdcd7`
- Backlog: `ADV-001`
- Plan: [`plans/advance-history-safety.pert`](../../plans/advance-history-safety.pert)
- Plan task: `ADV_HISTORY_CONTRACT`
- Exact pre-advance snapshot: Git commit `2c08618`
- Plan state: advanced to reached `ADV_HISTORY_CONTRACT_ACCEPTED`
- Target history-safety model: 1
- Active runtime: `perttool@0.5.5`, Grammar 5, CLI Contract 6
- Runtime status: not implemented

## 1. Decision

Accept the contract for a repository-aware guard on destructive in-place
`dag advance` writes. Requirements, the normative contract, basic design,
project-actuals ownership, mutation provenance, the machine-readable
eighteen-case matrix, and the independent delivery plan are consistent.
There are no open semantic or public-contract findings for
`ADV_HISTORY_CONTRACT`.

This is contract acceptance, not runtime activation. The current
`perttool@0.5.5` source still requires the manual pre-advance commit
procedure. It does not expose `--force-history-loss`,
`Perttool.AdvanceResult.v1`, or `PTADV-*`.

## 2. Reviewed authority

The review used this precedence:

1. [Requirements](../requirements.md), especially Section 2.3
2. [Advance History Safety Contract](../specs/advance-history-safety.md)
3. [Project Actuals and Git History Contract](../specs/project-actuals.md)
4. [Mutation Semantics](../specs/mutation.md)
5. [Governance Interface Contract](../specs/governance-interface.md)
6. [CLI Interface](../specs/interfaces.md)
7. [Basic Design](../basic-design.md)
8. [ADV-001 backlog](../backlog.md#adv-001-guard-advance-writes-that-can-erase-uncommitted-history)
9. [Advance history-safety plan](../../plans/advance-history-safety.pert)

The machine-readable case authority is
[`advance-history-contract-v1.json`](../../test/fixtures/advance-history-contract-v1.json).

## 3. Resolved decisions

| ID | Accepted decision |
| --- | --- |
| `AHSR-001` | Apply the guard only to a valid, changed, destructive in-place `dag advance --write`; preview, diff, separate output, no-op, and unrelated commands remain Git-independent. |
| `AHSR-002` | Derive non-empty destructive records from advance `TextEdit` provenance, never by parsing unified diff text. |
| `AHSR-003` | Map declaration removal by entity kind/ID plus owned comments and map retained milestone replacement only to its existing state value. |
| `AHSR-004` | Require exact raw-byte equality between each current and `HEAD:<path>` destructive range and no overlapping model-1 Myers byte edit from `HEAD` to the stage-0 index; invalid staged syntax outside those ranges is permitted, and BOM and CRLF remain significant. |
| `AHSR-005` | Inspect staged and unstaged destructive changes independently while permitting dirty ranges wholly retained by the candidate. |
| `AHSR-006` | Share repository, path, `HEAD`, raw-source, worktree, and race capture with `src/history/`, but keep first-parent reduction, write assessment, and MIG-08 as separate application decisions. |
| `AHSR-007` | Fail closed for missing repository/`HEAD`, untracked or ambiguous paths, unmerged index, unavailable Git, invalid baseline, and missing or ambiguous correspondence. |
| `AHSR-008` | Do not infer an uncommitted rename through similarity; a committed rename is ordinary because the current path exists in `HEAD`. |
| `AHSR-009` | Recheck source and the complete `HEAD`/stage-0-index baseline after assessment and before atomic replacement; a binding race returns exit 5 and cannot be forced. |
| `AHSR-010` | Select exact `--force-history-loss`; it bypasses only an initial blocked assessment and remains subject to governance, warnings-as-errors, optimistic locking, and every existing safe-write gate. |
| `AHSR-011` | Select `Perttool.AdvanceResult.v1` rather than modifying the closed published MutationResult v3 artifact; other mutation commands retain v3 and CLI Contract 6 names remain unchanged. |
| `AHSR-012` | Make modification time, byte sizes, diff counts, and affected entity IDs primary human context; keep content and repository digests as supplemental machine bindings. |

## 4. Acceptance cases

| Case range | Accepted boundary |
| --- | --- |
| `AHS-001` through `AHS-003` | Non-applicable preview, separate output, and no-op behavior without Git inspection |
| `AHS-004` through `AHS-009` | Exact baseline pass, staged/unstaged overlap refusal, retained dirty changes, comments, and work events |
| `AHS-010` through `AHS-014` | Unavailable baseline, index/path ambiguity, linked worktrees, renames, BOM, and CRLF |
| `AHS-015` through `AHS-017` | Narrow force behavior and source/repository-baseline race refusal |
| `AHS-018` | Result schema, text/JSON, help, Guide, repository, package, and installed acceptance |

Each case depends only on earlier case IDs. The fixture fixes target behavior
and identities but contains no runtime-success claim.

## 5. Compatibility decision

The existing `Perttool.MutationResult.v3` Draft 2020-12 artifact rejects
unknown root and nested fields. Reusing that identity while adding
history-guard state would make the new result incompatible with its already
published schema.

The target therefore introduces one closed `Perttool.AdvanceResult.v1` root
for `dag advance`. It retains the existing mutation, governance, lifecycle,
and advance payload meanings and adds a required nullable history-guard
record. Direct, batch, and lifecycle mutations remain
`Perttool.MutationResult.v3`. Grammar 5 and CLI Contract 6 command names are
unchanged.

This result decision does not select a package version or authorize a
release.

## 6. Threat and authority boundary

The modeled failure is accidental loss of current-side source during
advance, including an uncommitted lifecycle transition, comment, declaration,
or work event. It is not malicious Git tampering, authenticated approval, or
proof that a caller is an owner.

The guard runs only after a valid candidate and persistent governance
authorization. It neither consumes nor produces recommendation override
authority. `--accepted-by-owner`, `--force-history-loss`, and MIG-08 remain
three distinct inputs with different meanings.

## 7. Implementation handoff

The next task is `ADV_HISTORY_PROBE` only after a fresh complete
`Perttool.NextResult.v5` recommends it. That task must:

1. extend the narrow read-only Git capture for exact `HEAD` and stage-0 index
   blobs without exposing a public command;
2. add pure destructive-record correspondence and raw-byte assessment;
3. test retained dirty ranges separately from destructive overlap;
4. cover unavailable Git, linked worktrees, unmerged index, renames, BOM,
   CRLF, and source/`HEAD`/index races; and
5. leave active CLI, result schemas, package exports, help, writes, and
   releases unchanged.

`ADV_HISTORY_CLI` owns public option, result, diagnostic, and write
enforcement. `ADV_HISTORY_ACCEPTANCE` owns public and installed-package
acceptance. Do not partially expose their surfaces from the probe task.

## 8. Verification

Acceptance requires:

```sh
node --test test/advance-history-contract.test.mjs
npm run check:self-use
npm run check
git diff --check
```

The focused test fixes all twelve decisions, the contiguous eighteen-case
matrix, the closed-schema compatibility decision, the runtime non-activation
boundary, and the selected plan frontier.

On 2026-07-31, the focused contract test passed all 4 tests, the self-use
check passed all 27 plans, and the complete repository check passed under
Node.js v25.1.0. The complete check included type checking, all 677 tests, the
English baseline over 514 text files, 127 Markdown files, 7 normative PERT
examples, the temporary-link workflow, and the 491-file isolated-package
workflow. `git diff --check` also passed.

No Git remote write, GitHub mutation, package publication, npm tag change, or
Issue closure was part of this acceptance.
