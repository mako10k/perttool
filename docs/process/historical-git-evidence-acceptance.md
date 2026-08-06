# Historical Git Evidence Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-06
- Implementation baseline: `777f74991dae09c4550b7ed2d447b82ebb1d6d1b`
- Plan: [`plans/historical-dag.pert`](../../plans/historical-dag.pert)
- Plan task: `HISTORICAL_GIT_PROBE`
- Normative contract: [Historical DAG Reconstruction Contract](../specs/historical-dag.md)
- Internal evidence model: `Perttool.HistoricalGitEvidence.v1`
- Ancestry profile: `first_parent`
- Active public runtime: unchanged Grammar 6 and CLI Contract 7

## 1. Decision

Accept the internal bounded historical Git evidence implementation. The
Node-owned `probeHistoricalGitEvidence` function extends the existing
`src/history/git-probe.ts` boundary with exact endpoint and lower-boundary
resolution, inclusive first-parent inspection, immutable commit/blob/source
evidence, fixed input limits, linked-worktree identity, shallow completeness,
and post-capture race refusal.

This acceptance does not activate `Perttool.HistoricalGraphResult.v1`, a
command, schema, package-root/Core/Node export, public Node Host method, LSP
request, VSIX feature, MCP capability, cache, or write operation. Current
`project history`, advance-history capture/recheck, all 44 Contract 7 commands,
20 root schemas, and the exact root/Core/Node runtime catalogs remain
unchanged.

## 2. Request and immutable binding

The internal request keeps the filesystem target, opaque endpoint spelling,
and optional lower-boundary spelling separate. The omitted endpoint is `HEAD`.
Branches, tags, ancestry suffixes, and full or unambiguous abbreviated object
IDs resolve to one full commit before enumeration. Unknown, ambiguous, or
non-commit revisions fail closed with distinct typed causes.

One complete result binds:

- SHA-1 or SHA-256 object format;
- an opaque SHA-256 repository ID derived from the common Git directory without
  exposing its absolute path;
- one repository-relative target path;
- requested and resolved endpoint and lower-boundary identities;
- oldest inspected commit and ordered inspected commit IDs;
- each commit's direct parents, exact blob or absence, raw bytes, SHA-256 source
  digest, Git committer-time provenance, merge flag, endpoint flag, and
  lower-boundary flag; and
- a `git-read:sha256:*` snapshot ID over the complete ordered evidence binding.

Linked worktrees share the common repository ID but retain their exact
worktree-relative target binding. Commit time is provenance only and never
selects, sorts, or repairs a revision.

## 3. Inclusive first-parent sequence

An explicit lower boundary must be the endpoint or one commit on its
first-parent lane and must contain a regular target blob. It is always the
first input even when that blob repeats its first parent. Every later commit
that changes the path is included, and the endpoint is appended even when its
blob repeats the preceding input. Equal lower and endpoint bounds yield one
input.

Without a lower boundary, the oldest reachable target introduction begins the
sequence. An omitted shallow prefix returns an incomplete result with
`shallow_origin`; an explicit lower boundary inside the completely available
shallow lane returns complete. A merge records all direct parents and compares
only through its first-parent sequence. Side-only commits never become
inspection inputs.

Endpoint absence or a non-regular endpoint object is
`endpoint_path_missing`. Lower-boundary absence is `lower_path_missing`. A
resolved lower commit outside the first-parent lane is
`lower_not_first_parent_ancestor`. The implementation does not search renames,
other branches, reflogs, unreachable objects, or similar paths.

## 4. Limits and race closure

Production fixes these input limits:

| Input | Limit |
| --- | ---: |
| Inspected commits | 2,048 |
| Raw bytes per snapshot | 8,388,608 |
| Aggregate raw snapshot bytes | 134,217,728 |

Overflow returns `unavailable/hard_limit` and no snapshots. Dependency-only
test overrides exercise each boundary without changing the production request
or defaults.

After capture, the probe re-resolves the endpoint and lower spelling, rechecks
the resolved common Git directory, and repeats the no-follow regular-file
target capture. A changed ref, source digest, file identity, or repository
binding returns `unavailable/repository_race` and no graph. Full object reads
use frozen commit and blob IDs. The process environment disables replace
objects, optional locks, lazy fetch, prompts, and caller Git-directory
overrides.

## 5. Accepted cases

The machine-readable matrix is
[`historical-git-evidence-v1.json`](../../test/fixtures/historical-git-evidence-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `HGE-001` through `HGE-003` | Frozen endpoint, inclusive lower input, repeated endpoint, and equal bounds |
| `HGE-004` | First-parent merge with every direct parent and no side-lane inspection |
| `HGE-005` | Endpoint/lower path, lane, unknown, and non-commit refusal |
| `HGE-006` | SHA-1, SHA-256, linked worktrees, opaque repository identity, and no path leak |
| `HGE-007` | Omitted shallow origin versus a complete explicit available boundary |
| `HGE-008` | Commit, per-snapshot, and aggregate-byte hard limits with no partial graph |
| `HGE-009` | Target and endpoint-ref race refusal |
| `HGE-010` through `HGE-012` | Determinism, no Git mutation, unchanged public contracts, and pure-fold handoff |

## 6. Compatibility and no-write proof

The focused acceptance captures `HEAD`, every ref, porcelain worktree status,
and index digest before and after deterministic evidence reads. They remain
identical. Results contain no repository absolute path. Existing project
history, project-history reduction, advance-history probe and CLI race tests,
Node Host boundary, and CLI facade parity all pass unchanged.

The new function is available only through its internal compiled module. The
package root still exposes 122 runtime values, the command registry still has
44 commands, the schema catalog still has 20 roots, and the public Node Host
Git port retains exactly `probeHistory`, `captureAdvanceBaseline`, and
`recheckAdvanceBaseline`.

## 7. Verification

The accepted gate is:

```sh
npm run typecheck
npm run build
node --test test/historical-git-evidence.test.mjs
node --test test/project-actuals-git-history-probe.test.mjs test/project-actuals-history.test.mjs
node --test test/advance-history-probe.test.mjs test/advance-history-cli.test.mjs
node --test test/node-host-boundary.test.mjs test/cli-facade-parity.test.mjs
npm run check
git diff --check
```

The focused historical evidence gate passes eight tests over all twelve cases.
The existing project-history, advance-history, Node Host, and CLI-facade
compatibility gates also pass. The complete repository gate passes with 927
tests, the English baseline over 749 text files, documentation checks over 202
Markdown files and seven PERT examples, read-only check/analyze/next validation
for all 35 self-use plans, isolated LSP and MCP gates, the supported VS Code
1.101.0 host gate, temporary link acceptance, and the isolated 661-file public
package workflow. `git diff --check` also passes. The status-only completion
write then added exactly `status done` to `HISTORICAL_GIT_PROBE`, changing the
plan digest from
`sha256:0fbcdb6fb8da3dd9122395f54dd33b87e544b4f34db6028cefe79db10e79257c`
to
`sha256:f540a7ac0d07d4310980bd2e61c1abed594d8c508c5229552cfe2f954be887fe`.
It did not carry an owner assertion and governance was not applicable.

The task outcome was deliberately not registered by that status write. During
the separate confirmation boundary, complete NextResult v6 recommended
`HISTORICAL_LINEAR_CORE` structurally but withheld it from
`startable_recommended_task_ids`; `PTASSURE-203` identified the missing evidence
root as `HISTORICAL_GIT_PROBE`.

The separately confirmed assertion-free outcome preview was bound to source
digest
`sha256:f540a7ac0d07d4310980bd2e61c1abed594d8c508c5229552cfe2f954be887fe`.
It appended one seven-line `OUTCOME_HISTORICAL_GIT_PROBE` record against
accepted basis
`sha256:74e303429cde361891ccac977b6c1c98b492128acef630b500751cf19929a0de`,
and produced candidate digest
`sha256:fb5e0054792d7a46ff631cd19f38d54f7a788014a91c667671edc0b65f37e139`.
The exact candidate was written once with actor `codex` and the separately
confirmed, candidate-bound owner assertion `user`. It affected only
`plan_assurance`. Readback confirms complete assurance with no mismatch,
unavailable task, replan requirement, or required action. Fresh complete
NextResult v6 recommends and makes startable only `HISTORICAL_LINEAR_CORE`.

## 8. Handoff and non-goals

`HISTORICAL_LINEAR_CORE` may consume only these immutable snapshots and the
accepted transition model. It still owns source classification, continuity
segments, frozen actual evidence, canonical-advance proof, occurrence/value
epochs, topology epochs, snapshot/lineage/timeline composition, output limits,
and typed `PTHDG-*` projection.

Public CLI/schema/help activation, editor protocol, historical VSIX views,
semantic seal highlighting, MCP history, three-way ancestry, semantic patch or
merge, cache persistence, Git mutation, source mutation, release selection,
publication, remote writes, Issue mutation, and plan advance remain separate.
