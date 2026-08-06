# Historical DAG Reconstruction Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-06
- Baseline HEAD: `5a587e82175e4c53d894df66bf7a7d861a12bf4e`
- Backlog: `HIST-DAG-001`
- Plan: [`plans/historical-dag.pert`](../../plans/historical-dag.pert)
- Plan task: `HISTORICAL_DAG_CONTRACT`
- Target historical DAG model: 1
- Target transition model: 1
- Target ancestry profile: `first_parent`
- Active runtime: `perttool@0.7.1`, Grammar 6, CLI Contract 7
- Runtime status: not implemented

## 1. Decision

Accept the first-parent historical DAG reconstruction contract. Requirements,
the normative contract, basic design, Project Actuals ownership, canonical
advance, current GraphView separation, the twenty machine cases, the selected
plan, and the explicit `SCM-001` dependency for any later three-way profile are
consistent. There are no open normative contract findings for
`HISTORICAL_DAG_CONTRACT`.

This is contract acceptance, not runtime activation. The active source still
has 44 Contract 7 commands and 20 root schemas. It does not expose
`Perttool.HistoricalGraphResult.v1`, `PTHDG-*`, a historical editor request,
or a Git-backed historical VSIX view. Current `project history`, `dag render`,
`perttool/graphView`, and every mutation and authority boundary are unchanged.

## 2. Reviewed authority

The review used this precedence:

1. [Requirements](../requirements.md), especially Sections 2.3 and 21
2. [Historical DAG Reconstruction Contract](../specs/historical-dag.md)
3. [Project Actuals and Git History](../specs/project-actuals.md)
4. [Graph Semantics](../specs/graph-semantics.md)
5. [Mutation Semantics](../specs/mutation.md)
6. [Conditional Plan Assurance](../specs/plan-assurance.md)
7. [Analysis](../specs/analysis.md)
8. [Editor Protocol](../specs/editor-protocol.md)
9. [Basic Design](../basic-design.md)
10. [HIST-DAG-001 backlog](../backlog.md#hist-dag-001-reconstruct-and-visualize-historical-dags)
11. [Historical DAG workstream](../../plans/historical-dag.pert)
12. the superseded non-normative
    [design input](historical-dag-design.md)

The machine-readable case authority is
[`historical-dag-contract-v1.json`](../../test/fixtures/historical-dag-contract-v1.json).

## 3. Resolved decisions

| ID | Accepted decision |
| --- | --- |
| `HDGR-001` | Use distinct `Perttool.HistoricalDagModel.v1` and `Perttool.HistoricalTransitionModel.v1` identities and reserve future `Perttool.HistoricalGraphResult.v1`; do not extend the closed current history or GraphView results. |
| `HDGR-002` | Keep the file path and opaque Git endpoint separate, resolve exactly one commit, include the endpoint, and preserve requested and resolved identities. |
| `HDGR-003` | Make an explicit lower boundary inclusive, require it on the first-parent lane, include its exact blob even when unchanged there, and include every later path-changing input plus the endpoint. |
| `HDGR-004` | Require the selected path at the endpoint. Model 1 does not guess a deleted-path tombstone, rename, similar path, other branch, reflog, or unreachable object. |
| `HDGR-005` | Report `first_parent` scope explicitly. Record every merge parent but compare only the first-parent predecessor with the merge result and exclude side-only commits. |
| `HDGR-006` | Classify encoding, Grammar, syntax, semantics, assurance, evidence, and transition separately. Invalid or unavailable input creates a permanent typed continuity gap even when surrounding semantic digests are equal. |
| `HDGR-007` | Use one exact whole-document transition model with canonical Rational meanings and representation separation for the linear fold and later `SCM-001`; expose no semantic patch or merge yet. |
| `HDGR-008` | Make the structured project/kind/source-ID/introduction-commit tuple authoritative, derive full SHA-256 `HDGE-*` occurrence IDs, and derive deterministic value and `HDGT-*` topology epochs. |
| `HDGR-009` | Reuse Project Actuals event identity, payload equality, deduplication, baselines, and Git-time qualification. Freeze evidence before proved removal and select no payload after a stable-ID conflict. |
| `HDGR-010` | Rehydrate removed topology only when the complete compatible canonical advance candidate is semantically equal to the next checkpoint and has no unrelated change; never partially accept a matching deletion subset. |
| `HDGR-011` | Keep snapshot, proved lineage, and timeline distinct and orthogonal to the four current analysis modes. Run analysis on one selected valid checkpoint only and leave retired analysis fields null. |
| `HDGR-012` | Return no cumulative lineage after an affecting gap, ambiguous edit or identity reuse, contradictory frozen evidence, noncanonical removal, or union-only cycle. Retain independently valid timeline segments. |
| `HDGR-013` | Fix exact input/output hard limits and cache bindings; never label a truncated lineage or timeline complete. Bind navigation to repository, path, commit, blob, source digest, and UTF-16 range before opening immutable bytes. |
| `HDGR-014` | Fail closed with `PTHDG-106` for `three_way` until `SCM-001` accepts the normalized base/ours/theirs conflict model. Preserve no-write, governance, assurance, recommendation, history-safety, and release boundaries. |

## 4. Acceptance cases

| Case range | Accepted boundary |
| --- | --- |
| `HDG-001` through `HDG-005` | Exact endpoint, inclusive traversal bounds, explicit invalid endpoint handling, and continuity gaps |
| `HDG-006` through `HDG-009` | Frozen actual evidence, stable-ID conflict, representation-only input, and future-plan epochs |
| `HDG-010` through `HDG-013` | Exact canonical advance, noncanonical deletion refusal, identity reuse, and union-only cycle handling |
| `HDG-014` through `HDG-017` | First-parent merge scope and explicit three-way/merge-base deferral |
| `HDG-018` through `HDG-020` | View/analysis orthogonality, immutable source navigation, object formats, limits, races, and no-write proof |

Each case depends only on earlier case IDs. The fixture fixes target behavior,
identities, limits, and unchanged runtime counts but contains no
runtime-success claim.

## 5. Compatibility and result decision

Current `Perttool.ProjectHistoryResult.v1` reconstructs actuals and qualified
legacy transitions. Current `Perttool.GraphViewResult.v1` represents one open
document snapshot. Neither identity can accept ancestry bounds, checkpoints,
gaps, retired topology, epochs, or immutable blob navigation without changing
its meaning.

The later CLI task therefore owns one new closed
`Perttool.HistoricalGraphResult.v1`. Until that task accepts its command,
schema, text, JSON, Help, Guide, package, and installed boundary, the reserved
identity is not active. Grammar 6 and CLI Contract 7 do not change in this
contract task, and release version selection remains separate.

## 6. Safety and authority boundary

The modeled risk is an incorrect claim that one current or historical graph is
the complete project lineage. Fail-closed gaps, exact advance proof,
single-checkpoint analysis, immutable source bindings, explicit ancestry
scope, and hard limits prevent a consumer from obtaining a visually complete
but semantically speculative graph.

This observation does not authenticate an owner, accept an assurance seal,
prove an outcome, create execution authority, authorize a merge, or preserve
uncommitted bytes. The implementation acceptance must prove no write to source,
worktree, index, refs, Git configuration, repository objects, editor documents,
or external systems.

## 7. Implementation handoff

After the contract task is complete, the two independent inputs are ready:

1. `HISTORICAL_TRANSITION_MODEL`: implement only the shared pure normalized
   semantic projection and deterministic transition classification; and
2. `HISTORICAL_GIT_PROBE`: extend only bounded immutable endpoint, lower-bound,
   commit, parent, blob, path, object-format, limit, linked-worktree, shallow,
   and race evidence.

Neither task may expose the future result, command, editor protocol, or VSIX
view. `HISTORICAL_LINEAR_CORE` remains gated on both inputs. Three-way
reconciliation remains outside the selected workstream until `SCM-001` is
separately accepted. The accepted fresh complete `Perttool.NextResult.v6`
normally recommends and makes startable only `HISTORICAL_TRANSITION_MODEL`;
`HISTORICAL_GIT_PROBE` is ready and `allowed` with 2p total float, but is not
in the normal recommended set.

## 8. Verification

Acceptance requires:

```sh
npm run build
node --test test/historical-dag-contract.test.mjs
npm run check
git diff --check
```

The focused test fixes all fourteen decisions, the contiguous twenty-case
matrix, current runtime non-activation, the completed contract task, and the
two implementation-input frontier.

On 2026-08-06, the focused historical-DAG contract test passed all four tests,
and the 35-plan recommendation shadow passed. The complete repository check
passed under the current Node.js runtime with 913 tests, the English baseline
over 742 text files, documentation checks over 200 Markdown files and seven
normative PERT examples, all 35 self-use plans, isolated LSP/MCP/VSIX and
supported VS Code 1.101.0 host gates, temporary linking, and the 657-file
isolated public-package workflow. `git diff --check` also passed.

No Git remote write, GitHub mutation, npm publication or dist-tag change,
Marketplace or Open VSX operation, extension installation, Issue mutation,
or plan advance is part of this acceptance.
