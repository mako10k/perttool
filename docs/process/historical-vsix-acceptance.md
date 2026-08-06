# Historical LSP and VSIX Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-06
- Workstream: `HIST-DAG-001`
- Task: `HISTORICAL_VSIX`
- Pre-task Git baseline: `cda8936f4165612a12255efa32c0d7eb8a4aaec5`
- Normative contract: [../specs/historical-editor-protocol.md](../specs/historical-editor-protocol.md)
- Historical model: [../specs/historical-dag.md](../specs/historical-dag.md)
- Machine cases: [../../test/fixtures/historical-editor-runtime-cases-v1.json](../../test/fixtures/historical-editor-runtime-cases-v1.json)
- Plan: [../../plans/historical-dag.pert](../../plans/historical-dag.pert)

## 1. Accepted implementation boundary

The private bundled language server now negotiates
`perttool/historicalGraphView` and `perttool/historicalSource` independently
from current-document GraphView. The graph method binds the synchronized URI,
server-owned generation, supplied version, and SHA-256 source digest to one
closed historical request. It invokes the historical Application service
directly, preserves its complete semantic projection, and retains at most 32
connection-local result and source-binding sets.

The bundled runtime selects only a regular no-follow `.pert` file below
exactly one negotiated trusted local `file` workspace root. Repository
discovery chooses the nearest worktree and preserves the existing linked-
worktree common-object identity. Revisions are length-bounded opaque arguments,
Git is invoked without a shell, and untrusted, virtual, out-of-root, symlink,
non-file, non-repository, unsupported, stale, or malformed requests fail
closed. Untrusted initialization returns `PTHED-101` without Git discovery or
object access.

The current `perttool/graphView` request, `Perttool.GraphViewResult.v1`,
document diagnostics, symbols, definition, Help, and virtual-workspace support
remain unchanged. The implementation adds no CLI command or schema, public
package-root/Core/Node export, public Node Host port, production dependency,
or public extension identity.

## 2. Historical presentation

The VSIX adds an explicit current/history scope and transmits every historical
field: endpoint, optional inclusive lower boundary, ancestry profile,
snapshot/proved-lineage/timeline view, optional full snapshot commit, and one
of `none`, `precedence`, `resource`, or `both`. Changing a selector issues a
new request; edits, close/reopen, trust loss, workspace-root change, panel
retargeting, cancellation, and result replacement clear the old presentation.

The Webview renders only a sanitized presentation clone. It receives no raw
source, repository ID, repository-relative path, filesystem root, Git output,
or virtual-document content. Current and retired occurrences are distinct,
timeline continuity and causes remain visible, exact analysis values remain
checkpoint-bound, and the semantic outline retains accessible labels, focus,
theme/high-contrast tokens, and reduced-motion behavior. The Webview can send
only the closed history request and opaque source-reveal messages.

Compact `M01`/`T01` labels and exact time summaries remain owned by
`VSIX-DAG-PRESENT-001`. Unsealed, sealed-and-consistent, and broken-seal
presentation remains owned by `VSIX-ASSURE-001`.

## 3. Immutable source navigation

A source action carries only `historyResultId` and `bindingId`. The server
looks up the retained repository/commit/blob/digest/owner/range tuple, rechecks
repository and tree identity, loads the exact blob, verifies its raw SHA-256,
decodes strict UTF-8, and validates the zero-based UTF-16 range against the
accepted owner.

The extension registers only a `perttool-history` read-only content provider,
opens the exact returned text, labels it with the full immutable commit and
repository-relative path, and reveals the returned range. It registers no
write filesystem provider and cannot save, create, rename, delete, stage, or
refresh that document through a mutable ref. Loaded documents are bounded to
32 entries and an open immutable document is not evicted.

## 4. Accepted machine cases

`HVI-001` through `HVI-018` are dependency ordered and cover:

1. private direct Application composition and independent negotiation;
2. trusted target, nearest repository, linked worktree, and safe ref handling;
3. closed requests and exact document/result/source bindings;
4. cancellation, staleness, replacement, limits, and fail-closed errors;
5. snapshot, proved-lineage, timeline, and four orthogonal analysis modes;
6. canonical result/binding IDs and verified immutable virtual source; and
7. closed Webview data/messages, accessible presentation, and no-write
   installed behavior.

The focused server tests exercise independent negotiation, untrusted no-read,
closed parameter rejection, cancellation, result replacement, immutable source
retrieval, result parsing, and Webview sanitization. The isolated LSP package
smoke uses the real `plans/historical-dag.pert` Git history. The supported VS
Code `1.101.0` host installs the exact private VSIX into disposable trusted and
untrusted profiles, proves the trusted historical graph and immutable source,
proves untrusted unavailability, force-replaces the artifact, and confirms
uninstall by readback.

## 5. Verification and side effects

The acceptance gate is:

```sh
npm run typecheck
npm test
npm run check
git diff --check
```

The complete gate covers English and documentation checks, all self-use plans,
isolated LSP/MCP/VSIX packages, the supported editor host, temporary linking,
and the isolated public package. It retains current GraphView behavior and
proves that historical requests do not write source, Git, editor profiles,
remote state, or publication state. Disposable profiles, extensions, and
workspaces are removed after verification.

The completed-task gate passes 955 tests, the 769-file English baseline, 207
Markdown documents, all 35 self-use plans, the isolated LSP and MCP packages,
the trusted/untrusted VSIX host workflow, temporary linking, and the isolated
674-file public package.

## 6. Authority and handoff

Implementation acceptance grants no editor mutation, Git mutation, task-start
authority, governance assertion, public VSIX installation, release selection,
Marketplace publication, package publication, remote write, Issue mutation,
plan advance, or three-way ancestry. `HISTORICAL_DAG_ACCEPTANCE` separately
owns cross-surface model, CLI, LSP, VSIX, SHA-1/SHA-256, linked-worktree,
temporary-link, isolated-package, and no-write closure.

The status-only task mutation inserted exactly `status done`. It was written
once without an owner assertion because governance was not applicable, using
actor `codex`, source digest
`sha256:9be391c7e3983e2c47693f1340c8d135374caf440e82ceff1aec68d1465b8561`,
and candidate digest
`sha256:6b89163ca566d4267f47572cdc2d829e42d14f50b9dd77f998c6d16b0078dec9`.
Readback confirms the exact candidate.

The separate assertion-free outcome preview appends one seven-line
`OUTCOME_HISTORICAL_VSIX` record against accepted basis
`sha256:7edcde41483bb18ff3923bc6f2b9de8148e482195f266b42a1e3a0f51c03657d`
with reason
`Accepted historical LSP and VSIX implementation and eighteen closed cases`.
It is bound to the completed source digest above and candidate digest
`sha256:a89ef57c89379f589070d2a1eeb46a31583552aa001cd1a3e7e337760d8ead1e`.
The candidate affects only `plan_assurance` and requires owner `user`. After
separate candidate-bound confirmation, it was written exactly once with actor
`codex` and the `user` owner assertion. Readback confirms source digest
`sha256:a89ef57c89379f589070d2a1eeb46a31583552aa001cd1a3e7e337760d8ead1e`,
`HISTORICAL_VSIX` as `verified` and `conformant`, and no mismatch, replan,
active-attention, or required action.

Complete NextResult v6 now recommends and makes startable only
`HISTORICAL_DAG_ACCEPTANCE`. Its cross-surface work, status, outcome, plan
advance, commit, push, release, and publication remain separate boundaries.
