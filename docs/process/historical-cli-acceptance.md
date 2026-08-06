# Historical CLI Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-06
- Pre-task Git baseline: `53ccafd8f35151a432d4c000a9b3adb85296ec12`
- Plan: [`plans/historical-dag.pert`](../../plans/historical-dag.pert)
- Plan task: `HISTORICAL_CLI`
- Normative contract: [Historical DAG Reconstruction Contract](../specs/historical-dag.md)
- Result: `Perttool.HistoricalGraphResult.v1`
- Active compatibility boundary: Grammar 6 and CLI Contract 7

## 1. Decision

Accept one additive read-only `dag history` command over the existing bounded
immutable Git evidence and pure historical linear reconstruction. The command
selects an inclusive endpoint and optional inclusive lower boundary, reports
the explicit `first_parent` ancestry profile, and returns exactly one of the
snapshot, proved-lineage, or ordered-timeline views. Optional precedence or
resource analysis is bound to one valid checkpoint and is never computed over
cumulative historical topology.

The command activates `Perttool.HistoricalGraphResult.v1` as the twentieth
command-result identity and twenty-first root schema. The active registry now
contains 45 commands. Grammar 6, CLI Contract 7, all prior command requests and
results, `project history`, `dag render`, the 122-name package-root/Node facade,
the 45-name portable Core facade, and zero production dependencies remain
unchanged.

## 2. Application and Node boundary

`src/application/target-historical-graph.ts` owns the request defaults, view
selection, single-checkpoint analysis, closed result projection, diagnostic
mapping, text/JSON rendering, and warning-policy input. It consumes a narrow
injected historical Git-evidence port and the existing pure reconstruction. It
does not parse Git output, mutate source, or expose the internal reconstruction
through a public package facade.

`src/node/historical-host.ts` is a private CLI composition over the accepted
`probeHistoricalGitEvidence` implementation. It is deliberately separate from
public `NodeHostPorts` model 1, so the exact public Node Host object, package
root, `perttool/node`, and `perttool/core` catalogs do not change. The CLI
constructs the existing facade with this additional private dependency.

## 3. Request, views, and analysis

The command syntax is:

```text
perttool dag history <file>
  [--rev <endpoint>] [--base <lower-boundary>]
  [--history first-parent|three-way]
  [--view snapshot|lineage|timeline]
  [--snapshot <full-commit-id>]
  [--analysis none|precedence|resource|both]
  [--format text|json]
```

Defaults are `--rev HEAD`, `--history first-parent`, `--view lineage`, and
`--analysis none`. `--snapshot` accepts only a lower-case full 40- or 64-digit
object ID and requires the snapshot view. Standard input is rejected because
repository-relative path identity is required. `three-way` is an accepted
request spelling but returns `PTHDG-106` before Git inspection.

Snapshot returns exactly the selected inspected checkpoint. Lineage returns
retired topology only through exact canonical-advance proof. Timeline returns
ordered validity, continuity-segment, transition, merge-provenance, and
topology-epoch records. The four analysis modes remain orthogonal; a requested
analysis runs only on the selected snapshot or valid endpoint checkpoint.

## 4. Result, diagnostics, and limits

The closed Draft 2020-12 schema covers the request, immutable evidence summary,
checkpoint summaries, selected view, checkpoint-bound analysis, complete
source bindings, typed causes, and all fixed input and output limits. Every
historical range is bound to repository ID, repository-relative path, commit,
blob, source digest, and exact UTF-16 range.

`complete` means the selected view and requested analysis are proved for the
explicit bounds. `incomplete` preserves available immutable evidence and emits
warnings for a gap, conflict, shallow origin, limit, or unavailable selected
view; it succeeds unless `--warnings-as-errors` is selected. `unavailable`
uses an error and exit 1. Process or filesystem failures that prevent the
result envelope use exit 3, and usage failures use exit 2. `PTHDG-101` through
`PTHDG-106` retain the categories fixed by the normative contract.

## 5. Accepted cases

The dependency-ordered matrix is
[`historical-cli-v1.json`](../../test/fixtures/historical-cli-v1.json).

| Case | Accepted boundary |
| --- | --- |
| `HCLI-001` | Additive Contract 7 command, schema, Help, and Guide discovery |
| `HCLI-002` | Default `HEAD`, first-parent, lineage, and no-analysis request |
| `HCLI-003` | Inclusive endpoint and lower-boundary selection |
| `HCLI-004` | Exact full-object-ID snapshot selection |
| `HCLI-005` | Proved canonical-advance lineage and retired topology |
| `HCLI-006` | Ordered timeline and continuity segments |
| `HCLI-007` | Analysis against one exact checkpoint |
| `HCLI-008` | Immutable historical source bindings |
| `HCLI-009` | Typed incomplete results and warning policy |
| `HCLI-010` | Three-way refusal before Git inspection |
| `HCLI-011` | Isolated installed-package command and schema |
| `HCLI-012` | No-write proof and prior-surface compatibility |

## 6. Verification

The acceptance gate is:

```sh
npm run typecheck
npm test
npm run check
git diff --check
```

The complete Node test suite passes 943 tests, including the twelve HCLI cases,
strict real-result schema validation, current command/schema symmetry,
Application dependency direction, real first-parent repositories, exact
canonical advance, gap and warning behavior, three-way refusal, and unchanged
source and Git state. The complete repository gate additionally checks the
English baseline, documentation links, all 35 self-use plans, isolated LSP,
MCP, VSIX, temporary-link, and the isolated 674-file public-package workflow.

The supported-host VSIX step removes inherited `VSCODE_IPC_HOOK_CLI`,
`ELECTRON_RUN_AS_NODE`, and `VSCODE_ESM_ENTRYPOINT` before invoking its
downloaded disposable VS Code executable. This prevents a connected Remote
CLI from capturing the isolated extension-management request and changes no
extension or product behavior.

The status-only completion candidate inserted exactly `status done`. It was
written once without an owner assertion, with actor `codex`, source digest
`sha256:0ca50c852105de6266e962f589597fd0e10d5a03748e3615e9e64af2a6b905c6`,
and candidate digest
`sha256:ccaf594b135624913d4a1c90e02d65f0d4926f58235df8eb19adbc2fdfff8a3c`.
Governance was not applicable and readback confirms the candidate digest.

That status write intentionally did not assert task-outcome evidence. The
separate assertion-free preview appended one seven-line
`OUTCOME_HISTORICAL_CLI` record against accepted basis
`sha256:a526dada04d1c296dab1fe20c710b9850f626d86356b66eb7c32576dafe3f88e`
with reason `Accepted read-only historical CLI and twelve closed cases`. It is
bound to the status-only source digest above and candidate digest
`sha256:f74371c9dcbf30d03317abcce3b245c9439bb2e59331005f9b3c4b5bfc6ad786`.
The candidate affects only `plan_assurance` and required owner `user`. After
separate candidate-bound confirmation, it was written exactly once with actor
`codex` and the `user` owner assertion. Readback confirms the final source
digest above, complete assurance with no unavailable task, mismatch, replan
requirement, or required action, and only `HISTORICAL_EDITOR_CONTRACT` as
ready, recommended, and startable.

## 7. Handoff and non-goals

The subsequent `HISTORICAL_EDITOR_CONTRACT` task owns the separate editor
request/result, trusted local-repository selection, immutable blob navigation,
cancellation, staleness, and LSP/VSIX boundary. The separately recorded
`VSIX-DAG-PRESENT-001` backlog owns compact `M01`/`T01` labels, same-ID detail
links, and exact residual, remaining, and task-time presentation with
velocity-qualified Point conversion.

Three-way ancestry, semantic diff/patch/merge, LSP or VSIX history behavior,
MCP history, editor mutation, package release selection, publication, remote
writes, Issue mutation, and plan advance remain separate decisions.
