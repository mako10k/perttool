# Historical Editor Protocol Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-06
- Workstream: `HIST-DAG-001`
- Task: `HISTORICAL_EDITOR_CONTRACT`
- Normative contract: [../specs/historical-editor-protocol.md](../specs/historical-editor-protocol.md)
- Historical model: [../specs/historical-dag.md](../specs/historical-dag.md)
- Parent editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Machine cases: [../../test/fixtures/historical-editor-protocol-cases-v1.json](../../test/fixtures/historical-editor-protocol-cases-v1.json)
- Plan: [../../plans/historical-dag.pert](../../plans/historical-dag.pert)

## 1. Accepted outcome

Historical editor protocol model 1 closes the trusted local LSP/VSIX boundary
without extending the current-document GraphView. It selects the separately
negotiated `perttool/historicalGraphView` and
`perttool/historicalSource` methods and their closed
`Perttool.HistoricalGraphViewResult.v1` and
`Perttool.HistoricalSourceResult.v1` results. Neither method is active in this
contract slice.

The graph result binds one current URI, server-owned open generation, document
version and source digest to one exact historical request and one retained
repository read snapshot. Its semantic payload is a lossless bounded subset of
the active `Perttool.HistoricalGraphResult.v1` projection, excluding the CLI
envelope and host path. Snapshot, proved lineage, timeline, and the four
analysis modes retain their existing meanings.

The completed status-only plan source digest is
`sha256:3c25ba69a6b93ebcee1a583f22fa3b11ccb866161b8280e8b7aaed8740abf428`.

## 2. Trust and repository decisions

| Topic | Accepted decision |
| --- | --- |
| Workspace trust | Historical Git access requires the live trusted VS Code session; trust grants no mutation authority |
| URI | Exact synchronized `file` URI only; current virtual/untrusted GraphView support remains unchanged |
| Workspace root | Target must be below exactly one negotiated local `file` workspace root |
| Target | Regular no-follow `.pert` file; symlinks, untitled and non-regular inputs are unavailable |
| Repository | Nearest containing worktree for the selected document; no arbitrary repository picker |
| Linked worktree | Accepted through the existing common-object-database evidence binding |
| Remote/virtual | Unavailable in model 1; no guessed path or copied-repository fallback |
| Git refs | Opaque, length-bounded single arguments after an option terminator; no shell |

The server may read bounded immutable repository objects only after every
eligibility check succeeds. The request cannot select an unrelated path,
repository, index stage, or compact `REV:path` target.

## 3. Protocol and parity decisions

The graph request transmits every query field explicitly. Its initial VSIX
values are `HEAD`, no lower boundary, `first_parent`, `lineage`, no snapshot
override, and `none`. `three_way` is accepted only to return the existing typed
unsupported result before Git inspection.

The result wrapper adds only editor binding, result identity, status,
diagnostics, and the shared historical semantic payload. It does not carry the
CLI contract, operation, exit status, host source path, or CLI diagnostics.
The adapter cannot discard gaps, causes, retired occurrences, exact values, or
limits. Current `perttool/graphView`, `Perttool.GraphViewResult.v1`, editor
protocol model 1, Grammar 6, CLI Contract 7, 45 commands, 21 root schemas, and
the 122/45 Node/Core runtime catalogs remain unchanged.

Cancellation returns `-32800`. A current-document, root, trust, panel, or
superseding-request change returns or enforces `-32801` and clears the old
presentation. A repository race retains `PTHDG-105` ownership because it is an
external evidence failure, not an LSP document-version change.

## 4. Immutable navigation and presentation

Every source action begins with opaque retained result and binding IDs. The
server looks up the complete binding, reads the exact full blob ID, verifies
its digest and owner range, and returns exact text plus a zero-based UTF-16
range. The extension opens it under a read-only `perttool-history` content
provider. No caller supplies a path, commit, blob, digest, range, or source
text, and no range is applied to worktree bytes.

The Webview receives only a presentation clone and the two closed message
kinds `requestHistoricalGraph` and `revealHistoricalSource`. It receives no raw
source, repository ID, workspace path, Git output, executable URI, command, or
edit. The existing restrictive CSP and escaped-content rules remain active.

Keyboard operation, focus, themes, high contrast, reduced motion, selected
view/checkpoint state, complete/incomplete/unavailable/loading/cancelled/stale
announcement, gap and retirement labels, exact-value units, and a complete
semantic text outline are required. Compact labels and time summaries remain
owned by `VSIX-DAG-PRESENT-001`; seal highlighting remains owned by
`VSIX-ASSURE-001`.

## 5. Review findings

| ID | Finding | Resolution |
| --- | --- | --- |
| `HEDR-001` | Extending GraphView v1 would mix current document and Git identities | Select separate methods and results; leave GraphView v1 unchanged |
| `HEDR-002` | Workspace trust cannot be inferred inside a generic stdio server | Treat live VSIX trust as a session capability assertion and still scope all reads to exact roots |
| `HEDR-003` | A trusted workspace could otherwise expose arbitrary host paths | Select only the active regular `.pert` file under one negotiated root and its nearest worktree |
| `HEDR-004` | Git ref text could become shell or option input | Enforce closed length/content rules, one argument, option terminator, and no shell |
| `HEDR-005` | Historical results can remain plausible after current edits | Bind URI/generation/version/digest and clear presentation on every stale boundary |
| `HEDR-006` | Embedding the full CLI result would expose host and transport fields | Project only the closed shared semantic payload and use editor diagnostics |
| `HEDR-007` | A Webview-supplied range could navigate unrelated bytes | Accept only retained result and binding IDs; verify blob, digest, owner, and range server-side |
| `HEDR-008` | Re-resolving a mutable ref for source navigation can select new bytes | Retrieve the retained full blob ID and fail unavailable after eviction or mismatch |
| `HEDR-009` | An incomplete lineage could be made visually convenient by dropping conflicts | Preserve exact status, gaps, causes, and null lineage without local repair |
| `HEDR-010` | Current untrusted/virtual support could regress when Git is added | Make only historical requests unavailable and preserve all current-document behavior |
| `HEDR-011` | A virtual document could become a hidden editor write channel | Register a read-only content provider with no filesystem write surface |
| `HEDR-012` | Contract acceptance could be mistaken for adapter implementation or release | Keep runtime, package, installation, push, release, and publication separately gated; record the accepted contract in one local commit only after confirmation |

There are no open findings within the contract task.

## 6. Cases and verification

The contract has eighteen dependency-ordered `HED-*` machine cases. They cover
identity, negotiation, trust, repository selection, request safety, document
binding, cancellation, semantic parity, all views, analysis, result/source
identity, immutable navigation, races, limits, Webview security, accessibility,
and no-write behavior.

```sh
npm run build
node --test test/historical-editor-protocol-contract.test.mjs
npm run check:english
npm run check:docs
npm run check:self-use
npm run check
git diff --check
```

The complete repository gate passed in the completed-task state with
950 tests. The English baseline, documentation, all 35
self-use plans, isolated LSP, MCP, VSIX, temporary-link, and isolated public-
package gates passed. The adapter source inventories remained unchanged.

## 7. Lifecycle and retained boundaries

The status-only completion candidate adds exactly `status done` to
`HISTORICAL_EDITOR_CONTRACT`. It is written once without an owner assertion,
with actor `codex`, source digest
`sha256:f74371c9dcbf30d03317abcce3b245c9439bb2e59331005f9b3c4b5bfc6ad786`,
and candidate digest
`sha256:3c25ba69a6b93ebcee1a583f22fa3b11ccb866161b8280e8b7aaed8740abf428`.
Governance is not applicable and readback confirms the candidate digest.

Task-outcome evidence was a separate plan-assurance mutation requiring a
candidate-bound `user` owner assertion. The assertion-free preview appended one
seven-line `OUTCOME_HISTORICAL_EDITOR_CONTRACT` record against accepted basis
`sha256:37373a2e9cccc95d76c5d4e0174fcbcf9026e4c284233db5c0adbd58d26949e1`
with reason `Accepted historical editor protocol and eighteen closed cases`.
It was bound to the completed status-only source digest above and candidate
digest
`sha256:9be391c7e3983e2c47693f1340c8d135374caf440e82ceff1aec68d1465b8561`.

The candidate affected only `plan_assurance` and required owner `user`. After
separate candidate-bound confirmation, it was written exactly once with actor
`codex` and the `user` owner assertion. Readback confirms the final plan digest
above, complete assurance with no unavailable task, mismatch, replan
requirement, or required action, and only `HISTORICAL_VSIX` as ready,
recommended, and startable.

No LSP, VSIX, schema artifact, package, extension contribution, editor profile,
virtual document, source, Git state, remote, registry, or Issue is changed by
this contract task. The accepted contract is recorded by the following local
source commit. Implementation, local VSIX installation, plan advance, push,
release, and publication remain separate decisions.
