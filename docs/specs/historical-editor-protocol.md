# Historical Editor Protocol Contract

- Document status: Accepted 1.0
- Date: 2026-08-06
- Workstream: `HIST-DAG-001`
- Task: `HISTORICAL_EDITOR_CONTRACT`
- Historical editor protocol model version: 1
- Parent editor contract: [editor-protocol.md](editor-protocol.md)
- Historical model contract: [historical-dag.md](historical-dag.md)
- Machine cases: [../../test/fixtures/historical-editor-protocol-cases-v1.json](../../test/fixtures/historical-editor-protocol-cases-v1.json)

## 1. Scope

This contract fixes the separate local editor boundary for read-only historical
DAG reconstruction. It was accepted before LSP or VSIX implementation and
owns:

- one negotiated `perttool/historicalGraphView` request and the closed
  `Perttool.HistoricalGraphViewResult.v1` wrapper;
- one retained-result `perttool/historicalSource` request and the closed
  `Perttool.HistoricalSourceResult.v1` response;
- trusted local-workspace and repository selection;
- exact document, query, commit, blob, digest, range, and result bindings;
- snapshot, proved-lineage, and timeline presentation with an orthogonal
  analysis selector;
- cancellation, staleness, repository-race, and hard-limit behavior; and
- immutable virtual documents, Webview security, and accessibility.

Contract acceptance alone did not activate either custom method. The later
`HISTORICAL_VSIX` implementation now activates both methods only inside the
private bundled LSP and VSIX. It adds no CLI schema artifact, public package
export, command, Git write, editor write, public VSIX identity, release, or
publication.

## 2. Compatibility and ownership

The current `perttool/graphView` method and
`Perttool.GraphViewResult.v1` remain exclusively bound to one synchronized
current document. They accept no path, Git revision, historical source
binding, or historical view. The existing editor protocol model remains 1.
Historical editor protocol model 1 is negotiated independently and does not
increment or extend the current result.

The shared historical Application service owns request defaults, Git-evidence
composition, semantic reconstruction, status, causes, diagnostics, and the
semantic payload also exposed by `Perttool.HistoricalGraphResult.v1`. The LSP
adapter owns only closed JSON-RPC envelopes, local repository eligibility,
document-generation binding, cancellation, stale rejection, and immutable
source retrieval. The VSIX owns workspace-trust gating, presentation state,
virtual-document registration, layout, and accessibility. It must not parse a
`.pert` source, invoke the CLI, classify transitions, union topology, calculate
analysis, or weaken a typed unavailable result.

The implementation is private to `adapters/lsp` and `adapters/vscode`. It does
not add a public package-root, Core, or Node export and does not change the
public `NodeHostPorts.v1` object.

## 3. Negotiation and capability closure

Standard LSP and the existing custom Help and current-graph methods remain
usable under the accepted editor protocol handshake. Historical methods are
available only when initialization additionally offers both exact lists:

```ts
interface HistoricalEditorInitializationOptionsV1 {
  perttool: {
    historicalEditorProtocolModelVersions: readonly [1];
    historicalGraphViewResultSchemaVersions: readonly [
      "Perttool.HistoricalGraphViewResult.v1",
    ];
    historicalSourceResultSchemaVersions: readonly [
      "Perttool.HistoricalSourceResult.v1",
    ];
    historicalLocalRepository: {
      workspaceTrust: "trusted" | "untrusted";
      workspaceFolderUris: readonly DocumentUri[];
    };
  };
}
```

The server selects model 1 and both result versions in its experimental
capability. Missing or incompatible versions make both methods
`MethodNotFound` (`-32601`) without changing standard or existing custom
capabilities. An `untrusted` session may negotiate the identities so the UI
can explain unavailability, but no Git discovery or object read occurs.

The trust field is a client-session capability assertion, not governance,
assurance, execution, or write authority. The bundled VSIX derives it only
from the live VS Code workspace-trust API and restarts or invalidates its
historical session when trust changes. A generic local client is outside the
VSIX trust claim and cannot use initialization to grant any perttool mutation.

## 4. Trusted local repository selection

Historical access is eligible only when all of these facts hold at request
time:

1. the VS Code workspace is trusted;
2. the selected synchronized document has exact `file` URI scheme;
3. its no-follow target is a regular `.pert` file below exactly one negotiated
   `file` workspace-folder root on the same extension/server host;
4. repository discovery from that exact file selects one Git worktree and one
   opaque common-object-database identity; and
5. the repository-relative path and current no-follow target binding remain
   unchanged through evidence capture.

The selected editor document chooses the repository and path. Model 1 has no
arbitrary repository picker, root-path parameter, compact `REV:path` input,
rename search, or cross-repository query. Nested repositories are selected by
the nearest containing worktree for the exact file. Linked worktrees are
supported through the historical Git evidence contract.

Untrusted workspaces, virtual workspace folders, non-`file` documents,
untitled documents, browser-only extension hosts, targets outside every
negotiated root, symlink targets, non-regular files, and non-repository files
return `unavailable` before Git traversal. Current diagnostics, Help, and
`perttool/graphView` keep their existing untrusted and virtual support.

Remote desktop workspaces whose document URI is not `file` are unavailable in
model 1. A later remote-filesystem contract may select a host-local mapping;
the server must not guess one from a URI or copy repository bytes over a new
transport.

## 5. Historical graph request

The custom method is `perttool/historicalGraphView`. Its parameters are closed:

```ts
interface HistoricalGraphViewParamsV1 {
  readonly textDocument: { readonly uri: DocumentUri };
  readonly documentVersion: integer;
  readonly requestedEndpoint: string;
  readonly lowerBoundary: string | null;
  readonly ancestryProfile: "first_parent" | "three_way";
  readonly view: "snapshot" | "lineage" | "timeline";
  readonly snapshotCommitId: string | null;
  readonly analysisMode: "none" | "precedence" | "resource" | "both";
}
```

The original model-1 VSIX values are `HEAD`, null lower boundary,
`first_parent`, `lineage`, null snapshot, and `none`. The later
[DAG Presentation and Focus Contract](dag-presentation.md) changes only the
private presentation default to `both` and progressive disclosure. All fields
are still transmitted explicitly; the server applies no hidden editor-specific
default. `snapshotCommitId` is
non-null only for `snapshot` and retains the full lower-case object-ID rule.
`three_way` remains a valid spelling that returns the historical model's
typed unsupported result before Git inspection.

Endpoint and lower-boundary values are opaque Git revision spellings, not
shell fragments. Each is at most 1,024 UTF-16 code units, non-empty when
present, and contains no NUL, CR, or LF. The Node adapter passes each value as
one argument after an option terminator and never invokes a shell. Unknown,
ambiguous, option-like, or non-commit resolution fails closed under the
historical Git contract.

The request is bound to the exact open URI, server-owned generation, supplied
version, and synchronized source digest even though the historical fold reads
committed objects. A changed, closed, reopened, moved, or differently selected
document cannot inherit an earlier historical result.

## 6. Historical graph result and semantic parity

The closed result wrapper is:

```ts
interface HistoricalGraphViewResultV1 {
  readonly schemaVersion: "Perttool.HistoricalGraphViewResult.v1";
  readonly historicalEditorProtocolModelVersion: 1;
  readonly historyResultId: `sha256:${string}`;
  readonly document: {
    readonly uri: DocumentUri;
    readonly generation: string;
    readonly version: integer;
    readonly sourceDigest: `sha256:${string}`;
  };
  readonly status: "complete" | "incomplete" | "unavailable";
  readonly complete: boolean;
  readonly diagnostics: {
    readonly items: readonly HistoricalEditorDiagnosticV1[];
    readonly truncated: boolean;
  };
  readonly historicalGraph: HistoricalGraphEditorProjectionV1 | null;
}
```

`historyResultId` is the SHA-256 of canonical model-1 JSON containing the
document binding, exact normalized request, repository/read-snapshot identity,
resolved bounds, and the semantic projection digest. It identifies one
connection-retained result; it is not a Git object, authorization token, or
persistent cache key.

`historicalGraph` is null only when no safe semantic payload can be presented.
For complete and bounded incomplete outcomes it contains exactly these
top-level members from the shared `Perttool.HistoricalGraphResult.v1`
projection, with the same snake-case field names, nullability, ordering, exact
values, status, causes, and limits:

```text
model, model_version, transition_model_version, status, request, evidence,
effective_checkpoint_id, selected_snapshot_commit_id, checkpoints, snapshot,
lineage, timeline, analysis, source_bindings, causes, limits
```

CLI-only schema/contract/tool/operation/exit fields, the host source path, and
CLI diagnostics are not embedded. LSP diagnostics use the editor wrapper. The
adapter may attach only deterministic opaque `binding_id` values beside source
bindings; it may not omit a gap, cause, retired occurrence, exact value, or
analysis fact to make a display appear complete.

`complete` is true exactly when `status` is `complete`. An incomplete timeline
or independently complete selected snapshot may be presented only as allowed
by the historical model. An unavailable lineage is never replaced by a blind
union or the newest segment.

## 7. View and analysis binding

Snapshot, lineage, and timeline retain their historical contract meanings.
The VSIX exposes one view selector and one independent analysis selector:

```text
view:     snapshot | lineage | timeline
analysis: none | precedence | resource | both
```

Changing either selector issues a new bound request and discards the preceding
presentation when that request becomes stale. It does not locally transform a
lineage into a snapshot or run analysis in the Webview.

- Snapshot presents exactly one selected valid checkpoint.
- Lineage presents only the cumulative topology proved through canonical
  advance and distinguishes current from retired occurrences.
- Timeline presents ordered commits, gaps, continuity segments, transition
  classes, graph epochs, merge provenance, and checkpoint-local graphs.
- Analysis is attached only to the one selected checkpoint fixed by the
  historical model; retired lineage occurrences and mixed epochs never gain
  current analysis fields.

Commit IDs and opaque refs are visually distinct. A label such as `HEAD` is
never displayed as if it were the resolved immutable commit. An incomplete or
unsupported result keeps its causes visible and accessible.

## 8. Cancellation, staleness, and retained results

LSP `$/cancelRequest` returns `RequestCancelled` (`-32800`) and publishes no
partial result or retained source binding. A request is stale and returns
`ContentModified` (`-32801`) when, before publication, its document closes or
changes generation/version/digest, its trusted root selection changes, or a
newer historical request supersedes it for the same presentation owner.

Repository, ref, worktree, path, object, or read-snapshot races discovered by
the bounded Git probe are historical `unavailable` outcomes with `PTHDG-105`;
they are not silently converted to document staleness. The server rechecks the
document binding after Git capture and before retaining the result.

The VSIX clears the rendered historical result immediately on an accepted
document change, close/reopen, trust loss, workspace-root change, panel target
change, or a new request. It may show a labelled loading or stale status, but
must not leave an old graph looking current. A previously opened immutable
virtual blob document remains byte-valid and commit-labelled; it grants no
permission to navigate from a stale result or refresh through a mutable ref.

Retained graph results and source bindings are connection-local and bounded.
Close, server restart, result replacement, or explicit panel disposal removes
their lookup entries. No retained result is persisted to workspace storage or
global extension state.

## 9. Immutable historical source navigation

Every semantic source binding receives an opaque `binding_id` computed from
canonical model-1 JSON containing repository ID, repository-relative path,
commit ID, blob ID, source digest, declaration kind, source ID, owner path, and
exact range. The Webview sends only `historyResultId` and `bindingId`; it never
supplies a path, commit, blob, digest, range, URI, or source text.

The extension resolves those IDs in its retained result, rechecks the current
document and panel binding, and calls `perttool/historicalSource`:

```ts
interface HistoricalSourceParamsV1 {
  readonly textDocument: { readonly uri: DocumentUri };
  readonly documentVersion: integer;
  readonly historyResultId: `sha256:${string}`;
  readonly bindingId: `sha256:${string}`;
}
```

The server requires an exact retained tuple, reloads the named blob from the
already selected repository by full blob ID, verifies the raw-byte source
digest, decodes it under the same historical source rules, verifies the owner
and UTF-16 range, and returns:

```ts
interface HistoricalSourceResultV1 {
  readonly schemaVersion: "Perttool.HistoricalSourceResult.v1";
  readonly historicalEditorProtocolModelVersion: 1;
  readonly historyResultId: `sha256:${string}`;
  readonly bindingId: `sha256:${string}`;
  readonly virtualDocument: {
    readonly uri: string;
    readonly languageId: "pert";
    readonly repositoryRelativePath: string;
    readonly commitId: string;
    readonly blobId: string;
    readonly sourceDigest: `sha256:${string}`;
    readonly text: string;
    readonly range: LspUtf16Range;
  };
}
```

The virtual URI uses the `perttool-history` scheme, an opaque repository token,
the binding ID, and an escaped basename. It is not parsed back into authority;
the retained binding is authoritative. The extension registers a read-only
content provider only, labels the tab with the full commit ID and
repository-relative path, opens the returned exact text, and reveals the
returned zero-based UTF-16 range. It provides no save, create, rename, delete,
or write filesystem provider.

Missing retained results, unknown bindings, blob unavailability, digest
mismatch, invalid range, or repository identity change returns a typed
unavailable error and opens nothing. A historical range is never applied to
the worktree document, a different blob, or text supplied by the Webview.

## 10. Hard limits

The editor request uses the seven exact historical model limits without
client overrides: 2,048 inspected commits, 8,388,608 raw bytes per snapshot,
134,217,728 aggregate raw bytes, 100,000 entity value epochs, 2,047
transitions, 20,000 rendered occurrences, and 100,000 source bindings. A
result that exceeds an applicable limit retains the model's unavailable or
incomplete behavior; the LSP and VSIX do not truncate a graph locally.

Endpoint and lower-boundary spellings have the 1,024-code-unit limit from
Section 5. One source retrieval returns at most the already accepted
8,388,608-byte snapshot. At most 32 retained historical results and 32 loaded
virtual documents exist per connection; least-recently-used entries may be
evicted only when not the active panel result or an open virtual document.
Eviction makes later lookup unavailable rather than recomputing through a
mutable ref.

## 11. Diagnostics and failure ownership

Historical semantic and Git diagnostics retain `PTHDG-101` through
`PTHDG-106`. The editor boundary adds:

| Code | Category |
| --- | --- |
| `PTHED-101` | Historical capability, workspace trust, URI, root, file, or repository selection unavailable |
| `PTHED-102` | Historical document, generation, version, panel, or retained-result binding is stale |
| `PTHED-103` | Retained source binding, blob, digest, decoding, or UTF-16 range verification failed |
| `PTHED-104` | Editor-specific ref, retained-result, or virtual-document limit was exceeded |
| `PTHED-105` | Closed request, result, Webview message, or negotiated identity is unsupported or malformed |

Malformed JSON-RPC parameters return `InvalidParams` (`-32602`). Unsupported
negotiation returns `MethodNotFound`; cancellation and document staleness use
the standard codes above. Expected trust, virtual, and repository
unavailability returns a closed result so the VSIX can present an accessible
reason. No failure falls back to the current graph, current worktree range,
CLI subprocess, or direct Webview Git access.

## 12. Webview messages and security

The existing restrictive CSP, extension-only immutable assets, escaped text,
no Node integration, no workspace resource roots, and no arbitrary
HTML/SVG/Mermaid/script rules remain mandatory. Historical display may reuse
the current DAG assets but receives only a presentation clone. Raw source
text, repository ID, workspace root, filesystem path, Git process output, and
virtual-document contents never enter the Webview.

The only additional Webview-to-extension message shapes are:

```ts
type HistoricalWebviewMessageV1 =
  | {
      readonly kind: "requestHistoricalGraph";
      readonly documentUri: DocumentUri;
      readonly documentGeneration: string;
      readonly documentVersion: integer;
      readonly requestedEndpoint: string;
      readonly lowerBoundary: string | null;
      readonly ancestryProfile: "first_parent" | "three_way";
      readonly view: "snapshot" | "lineage" | "timeline";
      readonly snapshotCommitId: string | null;
      readonly analysisMode: "none" | "precedence" | "resource" | "both";
    }
  | {
      readonly kind: "revealHistoricalSource";
      readonly historyResultId: `sha256:${string}`;
      readonly bindingId: `sha256:${string}`;
    };
```

Fields and kinds are exact. Unknown fields reject the complete message. The
extension rechecks URI/generation/version and all lengths before sending an
LSP request. Neither message contains a command, executable URI, source range,
source text, HTML, edit, environment value, or Git option list.

## 13. Accessibility and presentation

Snapshot, lineage, and timeline selectors are keyboard accessible and expose
selected state. Focus is visible, motion respects reduced-motion settings,
colors use theme and high-contrast tokens, and no meaning depends only on
color, geometry, animation, or hover.

The deterministic text outline exposes, in semantic order:

- requested and resolved endpoints and optional lower boundary;
- ancestry profile, selected view, selected checkpoint, and analysis mode;
- complete, incomplete, unavailable, loading, cancelled, and stale state;
- causes, diagnostics, gaps, continuity segments, and merge provenance;
- current and retired occurrences, source IDs, and commit IDs;
- exact analysis values and their units; and
- an accessible source-navigation action only for verified bindings.

Timeline controls announce the selected checkpoint and never imply that a
union-only path existed at one commit. Retired topology is labelled as retired.
The separately selected `VSIX-DAG-PRESENT-001` contract owns compact
`M01`/`T01`/`G01` labels and residual/remaining/task-time summaries without
changing this historical result. The separate `VSIX-ASSURE-001` backlog owns
seal semantic highlighting; it is not activated by this contract.

## 14. Side-effect boundary

Historical graph and source requests may perform bounded read-only repository
discovery and Git object reads. They do not write a source or virtual source,
invoke a shell, stage, commit, checkout, merge, reset, update a ref or index,
change Git configuration, run a workspace binary, download content, emit
telemetry, change editor settings, or persist a cache.

Workspace trust, a successful read, a commit, a plan seal, or an owner
assertion does not grant mutation authority. Editor mutation, semantic merge,
three-way ancestry, MCP history, remote-filesystem history, VSIX release,
Marketplace publication, package publication, remote writes, Issue mutation,
and plan advance remain separate decisions.

## 15. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `HED-001` | Identity/compatibility | separate model-1 methods and results; current GraphView v1 unchanged |
| `HED-002` | Negotiation | exact version lists; no historical method without selection |
| `HED-003` | Trust/root | trusted local `file` workspace and exact containing root only |
| `HED-004` | Repository/path | nearest repository, regular no-follow file, linked-worktree support |
| `HED-005` | Request | closed explicit query, safe opaque refs, first-parent default |
| `HED-006` | Document binding | exact URI/generation/version/digest; change, close, reopen, and retarget invalidate |
| `HED-007` | Cancellation/staleness | `-32800`/`-32801`, no partial or old graph presentation |
| `HED-008` | Result/parity | closed wrapper and lossless shared historical semantic payload |
| `HED-009` | Snapshot | one exact valid checkpoint and immutable navigation bindings |
| `HED-010` | Lineage | only proved canonical-advance topology; current/retired distinction |
| `HED-011` | Timeline | ordered epochs, gaps, segments, transitions, and merge provenance |
| `HED-012` | Analysis | four modes remain orthogonal and bind to one checkpoint |
| `HED-013` | Source IDs | result and binding digests bind exact repository/commit/blob/source/range facts |
| `HED-014` | Virtual source | retained lookup, exact blob/digest/range verification, read-only URI |
| `HED-015` | Races/limits | typed repository races and exact model/editor limits without truncation |
| `HED-016` | Webview/CSP | presentation clone, closed messages, no raw source/path/command input |
| `HED-017` | Accessibility | keyboard, focus, themes, reduced motion, complete semantic outline |
| `HED-018` | Safety | read-only direct Application composition; no CLI, Git/editor write, release, or publication |

The machine fixture owns the closed identity, request, result, trust, status,
limit, message, and case inventories. Cases are dependency ordered.

## 16. Acceptance boundary

Acceptance requires the parent contracts, requirements, Basic Design,
backlog, selected plan, machine cases, contract tests, English/documentation/
self-use checks, complete repository gate, and reviewed diff to agree.

Acceptance records only the contract task's local lifecycle. The following
`HISTORICAL_VSIX` task owns the now-present LSP and VSIX implementation, SDK
mapping, private package changes, supported-host installation evidence, and
runtime no-write proof. Its implementation record is
[Historical LSP and VSIX Acceptance](../process/historical-vsix-acceptance.md).
Task-outcome acceptance, plan advance, commit, push, release, public VSIX
installation, and publication remain separately gated.
