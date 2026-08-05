# Editor Protocol Contract

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `EDITOR_PROTOCOL_CONTRACT`
- Editor protocol model version: 1
- Parent contract: [adapter-platform.md](adapter-platform.md)
- Machine cases: [../../test/fixtures/editor-protocol-cases-v1.json](../../test/fixtures/editor-protocol-cases-v1.json)

## 1. Scope

This specification fixes the first read-only language-server, VS Code
extension, and DAG-view protocol before their implementation. It owns:

- the exact LSP capability set and stable protocol baseline;
- document URI, version, UTF-16, cancellation, invalid, and stale semantics;
- Help and diagnostic ownership;
- the custom `perttool/graphView` request and
  `Perttool.GraphViewResult.v1` wire identity;
- source navigation and analysis-mode selection; and
- VSIX activation, runtime, workspace-trust, server-distribution, Webview
  security, and accessibility boundaries.

It does not implement a document session, language server, extension, or
Webview. It does not add a package dependency or public distribution. Rename,
formatting, arbitrary text edits, graph-driven edits, direct filesystem reads,
workspace code execution, arbitrary Mermaid execution, and persistent writes
remain outside this contract.

## 2. Standards and runtime baseline

The server implements the stable
[Language Server Protocol 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
over JSON-RPC 2.0. LSP 3.18 is explicitly not selected because its official
[specification source](https://github.com/microsoft/language-server-protocol/blob/gh-pages/_specifications/lsp/3.18/specification.md)
still labels it upcoming and under development. An implementation MUST NOT
advertise a 3.18-only capability in protocol model 1.

The language server is ESM/ES2024 and runs on Node.js `>=22` over local stdio.
The desktop or remote VS Code extension requires `engines.vscode` value
`^1.101.0`; VS Code 1.101 moved its Node extension host to Node.js 22 as part
of the
[Electron 35 update](https://code.visualstudio.com/updates/v1_101#_web-environment-detection).
The extension has a Node `main` entry, no browser entry, and
`extensionKind: ["workspace"]`. VS Code for the Web without a remote Node
extension host is unsupported in model 1. No dependency or SDK version is
selected by this contract.

## 3. Initialization and capability closure

The client owns server process start, shutdown, and exit. The server accepts
one local stdio connection and starts no socket, HTTP endpoint, child CLI, or
network listener. Initialization succeeds when the client accepts `utf-16`
positions; omission of LSP 3.17 `general.positionEncodings` means the protocol
default of UTF-16. An explicit list that excludes `utf-16` fails
initialization.

Standard LSP clients may use the standard capability set without a perttool
custom handshake. A client requesting custom Help or graph projections sends:

```ts
interface PerttoolInitializationOptionsV1 {
  perttool: {
    editorProtocolModelVersions: [1];
    graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"];
    editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"];
  };
}
```

The server selects model 1 in its experimental capabilities. The VSIX requires
that exact selection before enabling Help actions or the DAG view. Without a
compatible selection the standard LSP features remain available, while
`perttool/help` and `perttool/graphView` return `MethodNotFound` (`-32601`).

The fixed server-capability projection is:

```ts
interface PerttoolServerCapabilitiesV1 {
  positionEncoding: "utf-16";
  textDocumentSync: {
    openClose: true;
    change: 2; // TextDocumentSyncKind.Incremental
  };
  documentSymbolProvider: true;
  hoverProvider: true;
  completionProvider: {
    resolveProvider: false;
  };
  definitionProvider: true;
  codeActionProvider: {
    codeActionKinds: ["quickfix"];
  };
  experimental: {
    perttool: {
      editorProtocolModelVersion: 1;
      graphViewResultSchemaVersion: "Perttool.GraphViewResult.v1";
      editorHelpResultSchemaVersion: "Perttool.EditorHelpResult.v1";
      graphViewAnalysisModes: ["none", "precedence", "resource", "both"];
    };
  };
}
```

The server does not advertise rename, formatting, range formatting,
on-type formatting, semantic tokens, references, workspace symbols, code
lens, inlay hints, execute-command, file operations, or workspace-folder
mutation. Dynamic registration does not expand this closed set.

## 4. Document identity, synchronization, and positions

### 4.1 URI ownership

An LSP `DocumentUri` string is the document identity within one connection.
The server does not convert it to a filesystem path, normalize it using host
filesystem rules, dereference it, or infer repository identity. Any absolute
URI synchronized with language ID `pert` is acceptable, including `file`,
`untitled`, and virtual-workspace schemes. Two byte-distinct URI strings are
distinct identities.

`textDocument/didOpen` creates one in-memory document generation.
`textDocument/didClose` removes that generation, cancels its pending work, and
publishes an empty diagnostic set for the URI. A later open of the same URI is
a new generation and cannot reuse a result from the closed generation.

### 4.2 Version rules

Every open document has the integer version provided by the client. A
`didChange` is accepted only when its version is strictly greater than the
stored version. Versions need not be consecutive. Duplicate, lower, missing,
or non-integer versions are a connection-fatal synchronization failure; their
content changes are not applied.

Incremental content changes are applied in their transmitted order to the
previous accepted snapshot. All ranges are checked against that exact
snapshot. A malformed or out-of-range change rejects the complete notification
candidate atomically. Continuing from the previous snapshot would silently
diverge from the client, so any version or change failure marks the connection
desynchronized, cancels all pending work, clears adapter-owned presentation
state, and terminates the stdio connection without serving another request.
Recovery requires a new connection and a fresh `didOpen`; a later incremental
change cannot repair the old generation. The implemented
[Document Session Core](document-session.md) owns one
immutable snapshot containing URI, generation, version, exact text, UTF-8
SHA-256 source digest, parse result, validation result, and derived caches.

### 4.3 UTF-16 mapping

LSP line and character positions and all returned ranges are zero-based UTF-16
code units. They use the same offset convention as the existing parser and
Domain diagnostics. Conversion MUST handle surrogate pairs, CRLF, LF, block
text, a final line without a terminator, and positions at end of line.

A position inside a surrogate pair, beyond the line, or outside the document
is invalid. The adapter does not round or clamp it. CLI one-based display
coordinates and UTF-8 byte offsets are not LSP coordinates.

## 5. Read-only language capabilities

Each capability maps to one shared operation and has deterministic source
ordering.

| LSP surface | Shared owner | Valid snapshot | Invalid snapshot |
| --- | --- | --- | --- |
| `publishDiagnostics` | parser, validator, and diagnostic limiter | current diagnostics and warnings | current parse/semantic errors |
| `textDocument/documentSymbol` | validated source projection | project, milestone, task, gate, resource, and assurance records | empty array |
| `textDocument/hover` | validated entity projection and Help registry | entity facts or locally rendered Help | `null` except token-level syntax Help |
| `textDocument/completion` | grammar and Help registry | context-ordered keywords and fields | safe grammar recovery suggestions |
| `textDocument/definition` | validated identity resolver | same-document declaration location | `null` |
| `textDocument/codeAction` | diagnostic Help mapping | read-only Help quick fixes | read-only Help quick fixes |
| `perttool/help` | shared Help registry | negotiated topic projection | negotiated topic projection |

Diagnostics preserve Domain code, severity, message, related locations,
truncation, and UTF-16 span. `publishDiagnostics.version` is always the exact
snapshot version. A protocol mapper may add `source: "perttool"` and stable
transport data but may not downgrade an error, discard truncation, or turn an
invalid document into a successful semantic result.

Document symbols and definition locations use the declaration range and
identifier selection range from the same snapshot. Completion items contain
`label`, `kind`, `detail`, and documentation only. They contain no `textEdit`,
`additionalTextEdits`, or command; accepting the client's default label
insertion is an explicit user editor action, not a perttool mutation preview.

The only model-1 code actions have kind `quickfix`, contain no `edit`, and use
the client-owned `perttool.openHelp` command with a closed argument containing
the current URI, generation, version, and Help topic ID. They are returned only
when custom Help was negotiated. The server does not advertise
`executeCommandProvider`; the VSIX owns this presentation command. The VSIX
rechecks the complete document binding, sends `perttool/help`, and opens the
returned read-only content.

The command argument, custom request, and result are closed:

```ts
interface OpenHelpCommandArgsV1 {
  documentUri: DocumentUri;
  documentGeneration: string;
  documentVersion: integer;
  topicId: string;
}

interface EditorHelpParamsV1 {
  topicId: string;
  level: "quick" | "detail";
}

interface EditorHelpResultV1 {
  schemaVersion: "Perttool.EditorHelpResult.v1";
  editorProtocolModelVersion: 1;
  status: "ok" | "not_found";
  topicId: string;
  level: "quick" | "detail";
  content: { kind: "markdown"; value: string } | null;
  relatedTopicIds: readonly string[];
}
```

An `ok` result has non-null content from the selected topic. A `not_found`
result echoes the requested topic ID, has null content, and has no related
topics. The server's bundled shared Help registry is the only content owner.
No remote URL, workspace file, or duplicated Help text is authoritative.

Editor Help uses escaped Markdown with no raw HTML, command link, remote
image, remote font, or executable URI. The VSIX marks it untrusted and does not
enable command URIs.

## 6. Cancellation, invalidation, and stale results

Every request captures URI, generation, version, and cancellation signal
before invoking Application or Domain logic.

- Client `$/cancelRequest` observed before completion returns JSON-RPC/LSP
  `RequestCancelled` (`-32800`). No partial value is cached or published.
- A newer accepted version, close, or reopen cancels outstanding work for the
  older snapshot. If computation nevertheless completes, the adapter discards
  it and returns `ContentModified` (`-32801`) for a request.
- Notifications never publish results for a non-current generation or
  version. The adapter silently discards such completed work.
- The server rechecks generation and version before publishing diagnostics.
  The VSIX clears dependent presentation on local change or close and rechecks
  URI, generation token, and version before presenting Help, navigation, or
  graph content.
- Cancellation and staleness are normal fail-closed outcomes and are not
  converted to an internal error or an older current result.

Unknown protocol-model or result-schema versions, incomplete results,
truncated graph projections, unavailable source bindings, and malformed
responses are unavailable to the consumer. A previous graph is cleared or
visibly marked stale; it is never retained as if current.

## 7. DAG projection request

The custom request method is `perttool/graphView`.

```ts
interface GraphViewParamsV1 {
  textDocument: { uri: DocumentUri };
  documentVersion: integer;
  analysisMode: "none" | "precedence" | "resource" | "both";
}
```

The requested version MUST equal the current open snapshot at request capture
and response publication. `none` returns validated topology and task state
without schedule analysis. `precedence`, `resource`, and `both` invoke the
same shared analysis operations and defaults as the Application layer. The
request accepts no source text, path, Git ref, capacity override, arbitrary
Mermaid, script, layout program, or mutation instruction.

An unknown analysis mode or malformed parameter returns JSON-RPC
`InvalidParams` (`-32602`) and no graph result.

Graph entity ordering is milestones followed by edges, each in the canonical
validated declaration order. Nested arrays owned by analysis retain their
existing deterministic order. The Webview may compute visual coordinates,
zoom, pan, and selection, but it may not compute reachability, readiness,
criticality, slack, resource scheduling, or PERT values.

## 8. `Perttool.GraphViewResult.v1`

The custom wire result is a closed camelCase LSP-adapter contract. It is not a
CLI Contract 7 result and is not added to the CLI schema catalog.

```ts
interface GraphViewResultV1 {
  schemaVersion: "Perttool.GraphViewResult.v1";
  editorProtocolModelVersion: 1;
  document: {
    uri: DocumentUri;
    generation: string;
    version: integer;
    sourceDigest: `sha256:${string}`;
  };
  analysisMode: "none" | "precedence" | "resource" | "both";
  status: "current" | "invalid" | "unavailable";
  complete: boolean;
  diagnostics: {
    items: readonly GraphViewDiagnosticV1[];
    truncated: boolean;
  };
  graph: GraphViewGraphV1 | null;
}
```

The nested wire records are exact:

```ts
interface GraphViewExactValueV1 {
  numerator: string;
  denominator: string;
  unit: string;
  display: string;
}

interface GraphViewDiagnosticV1 {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  range: Range | null;
  related: readonly {
    uri: DocumentUri;
    range: Range;
    message: string;
  }[];
  helpTopic: string | null;
}

interface GraphViewMilestoneV1 {
  id: string;
  title: string;
  reached: boolean;
  declarationRange: Range;
  selectionRange: Range;
  precedence: {
    earliest: GraphViewExactValueV1;
    latest: GraphViewExactValueV1;
    slack: GraphViewExactValueV1;
    critical: boolean;
  } | null;
}

interface GraphViewEdgeV1 {
  id: string;
  kind: "task" | "gate";
  sourceMilestoneId: string;
  targetMilestoneId: string;
  label: string;
  status: "planned" | "active" | "blocked" | "suspended" | "done" | null;
  declarationRange: Range;
  selectionRange: Range;
  expected: GraphViewExactValueV1;
  precedence: {
    earliestStart: GraphViewExactValueV1;
    earliestFinish: GraphViewExactValueV1;
    latestStart: GraphViewExactValueV1;
    latestFinish: GraphViewExactValueV1;
    totalFloat: GraphViewExactValueV1;
    freeFloat: GraphViewExactValueV1;
    critical: boolean;
    driving: boolean;
  } | null;
  resource: {
    scheduledStart: GraphViewExactValueV1;
    scheduledFinish: GraphViewExactValueV1;
    resourceDelay: GraphViewExactValueV1;
    scheduleCritical: boolean;
  } | null;
}

interface GraphViewGraphV1 {
  projectId: string;
  finishMilestoneId: string;
  milestones: readonly GraphViewMilestoneV1[];
  edges: readonly GraphViewEdgeV1[];
  precedence: {
    makespan: GraphViewExactValueV1;
    criticalMilestoneIds: readonly string[];
    criticalTaskIds: readonly string[];
    criticalGateIds: readonly string[];
    representativePathEdgeIds: readonly string[];
  } | null;
  resource: {
    algorithmId: "parallel-sgs";
    algorithmVersion: 1;
    optimal: false;
    makespan: GraphViewExactValueV1;
    resourceDelay: GraphViewExactValueV1;
    scheduleCriticalTaskIds: readonly string[];
  } | null;
}
```

`status: "current"` requires `complete: true`, non-truncated required data,
and a non-null graph bound to the current document. `invalid` means current
source parsing or semantic validation failed; `unavailable` means a valid
snapshot could not produce the requested complete projection. Both require
`complete: false` and `graph: null`. Cancellation and stale-version mismatch
return the protocol errors in section 6 and do not return this result.

Exact numeric records use numerator, denominator, unit, and display fields
from the shared Application result. Missing analysis is `null`, not a zero.
Graph diagnostics retain stable code, severity, message, source range, and
Help topic. Presentation labels and colors are not semantic fields.

For `none`, both analysis records and every entity analysis field are null.
For `precedence`, only precedence fields are present. For `resource`, only
resource fields are presented even though the shared scheduler uses precedence
internally. For `both`, both projections are present. Gates retain a null
status; their exact expected value is zero in the project's duration unit.
Milestone titles fall back to the milestone ID. Edge labels use task title,
gate reason, then edge ID in that order. Resource fields are null for gates.

## 9. Source navigation and presentation messages

Every graph milestone and edge carries declaration and identifier selection
ranges for its bound document. A Webview navigation message contains only:

```ts
interface RevealSourceMessageV1 {
  kind: "revealSource";
  documentUri: DocumentUri;
  documentGeneration: string;
  documentVersion: integer;
  entityKind: "milestone" | "task" | "gate";
  entityId: string;
}
```

The extension locates the entity in the retained current graph result, checks
URI, generation, and version again, then reveals its selection range. Unknown
entities, binding mismatch, inactive documents, or absent ranges do nothing
except show an accessible unavailable status. The Webview cannot send a source
range, command, URI replacement, edit, or arbitrary message for execution.

## 10. VSIX activation, trust, and distribution

The VSIX activates lazily for language ID `pert`, the DAG-view command, or
restoration of its contributed view. It does not activate for every workspace.
The extension runs where the workspace is located, launches the exact bundled
language-server entrypoint using the Node extension-host runtime, and uses
stdio. It does not search `PATH`, execute a workspace copy, download code, or
connect to a network server.

The VSIX declares:

```json
{
  "engines": { "vscode": "^1.101.0" },
  "extensionKind": ["workspace"],
  "capabilities": {
    "untrustedWorkspaces": { "supported": true },
    "virtualWorkspaces": { "supported": true }
  }
}
```

This is safe because model 1 consumes only editor-synchronized text, bundled
code, and bundled Help; it executes no workspace code, task, configuration,
binary, module, or hook and performs no workspace-filesystem or network
access. The extension does not read trust as authority. Later features that
introduce a trust-sensitive input MUST change this declaration and add
trusted/untrusted acceptance before activation.

Remote desktop configurations run the extension and server in the remote
workspace extension host. Desktop local workspaces run them locally. Pure
browser extension hosts without Node are unsupported and show a deterministic
runtime-unavailable message rather than falling back to duplicated semantics.

## 11. Webview security and accessibility

The DAG Webview receives only a cloned current `GraphViewResult.v1` semantic
projection and closed presentation messages. It uses no Node integration.
Following the official
[Webview security guidance](https://code.visualstudio.com/api/extension-guides/webview#security),
it has minimum capabilities, no workspace resource roots, and this minimum
policy shape with a per-render nonce:

```text
default-src 'none';
img-src ${webview.cspSource};
style-src ${webview.cspSource};
script-src 'nonce-${nonce}';
font-src ${webview.cspSource};
```

No `unsafe-inline`, `unsafe-eval`, remote origin, iframe, external image,
remote font, worker, or user-supplied HTML is allowed. All project titles,
IDs, diagnostics, and labels enter through text nodes or equivalent escaped
properties. `localResourceRoots` contains only the extension's immutable
Webview asset directory.

The only Webview-to-extension message shapes are:

```ts
interface ReadyMessageV1 {
  kind: "ready";
  editorProtocolModelVersion: 1;
}

interface SelectAnalysisModeMessageV1 {
  kind: "selectAnalysisMode";
  documentUri: DocumentUri;
  documentGeneration: string;
  documentVersion: integer;
  analysisMode: "none" | "precedence" | "resource" | "both";
}

type WebviewToExtensionMessageV1 =
  | ReadyMessageV1
  | SelectAnalysisModeMessageV1
  | RevealSourceMessageV1;
```

Their fields are closed and checked; a message with an unknown field, kind, or
binding is ignored as a whole. None carries source text, HTML, a command, an
executable URI, or an edit.

Keyboard navigation, visible focus, high-contrast/theme tokens, reduced-
motion behavior, and screen-reader names are required. A deterministic text
outline lists milestones, edges, state, exact values, and diagnostics in the
same semantic order as the graph. Analysis-mode controls are labelled and the
invalid, unavailable, stale, and cancelled states are announced without
leaving an old graph presented as current.

## 12. Compatibility, authority, and non-goals

- Grammar 6, CLI Contract 7, 44 commands, 20 CLI schemas, 121 root exports,
  and the accepted Core/Node source subpaths do not change.
- LSP and GraphView results are adapter contracts, not write authority,
  recommendation authority, governance evidence, or CLI result aliases.
- Workspace trust, extension activation, initialization, process identity,
  Git identity, URI scheme, and document location grant no authority.
- The server and VSIX do not invoke the CLI, access Git, write files, change
  settings, emit telemetry, fetch remote content, or publish artifacts.
- TextMate highlighting is presentation only and cannot override parser or
  semantic diagnostics.
- No arbitrary Mermaid, HTML, SVG, script, or graph layout input is executed.
- Editor mutation, graph mutation, rename, formatting, persistence, public
  package naming, release selection, publication, and plan advance remain
  separate contracts and decisions.

## 13. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `EDP-001` | Standards/runtime | stable LSP 3.17, Node `>=22`, VS Code `^1.101.0`, local stdio |
| `EDP-002` | Initialization | exact read-only capability closure and model-1 handshake |
| `EDP-003` | Document identity | exact URI, generation, strictly increasing version, atomic incremental changes, terminal desynchronization until reconnect/open |
| `EDP-004` | Positions | zero-based UTF-16 with surrogate, CRLF, block-text, and invalid-position coverage |
| `EDP-005` | Diagnostics/invalid | versioned diagnostics; no invalid semantic symbols, definition, or graph |
| `EDP-006` | Language features | symbols, hover, completion, and definition map to shared owners deterministically |
| `EDP-007` | Help/code actions | bundled Help is authoritative; quick fixes contain no edits or server command |
| `EDP-008` | Cancellation | `-32800`, no partial cache or publication |
| `EDP-009` | Staleness | changed/closed generations return or enforce `-32801` and discard old values |
| `EDP-010` | Graph request | exact URI/version and four accepted modes; no source or execution input |
| `EDP-011` | Graph result | closed `Perttool.GraphViewResult.v1`; current graph or null fail-closed outcome |
| `EDP-012` | Navigation | entity IDs resolve only through a current bound result and accepted ranges |
| `EDP-013` | VSIX distribution | lazy workspace extension, exact bundled server, offline Node stdio |
| `EDP-014` | Trust/runtime | untrusted and virtual workspace support; no browser-only fallback |
| `EDP-015` | Webview | restrictive CSP, escaped content, closed messages, accessible text outline |
| `EDP-016` | Safety/parity | read-only shared semantics; no CLI subprocess, authority, I/O, network, telemetry, or publication |

The machine fixture owns the closed capability, mode, status, message, and
case inventories. Cases are dependency ordered.

## 14. Acceptance boundary

Acceptance requires requirements, parent architecture, Basic Design, backlog,
machine cases, contract tests, documentation checks, English-baseline checks,
self-use checks, the complete repository gate, and reviewed diff agreement.
It records the exact task lifecycle in the local plan only.

Acceptance does not implement or package the server or extension, start
`DOCUMENT_SESSION_CORE`, mutate an editor document, advance the plan, select a
release, publish a VSIX or package, push a remote, or mutate an Issue.

After this contract task was accepted, `DOCUMENT_SESSION_CORE` separately
implemented only the protocol-neutral snapshot, UTF-16, analysis, cache, and
invalidation boundary. `LSP_READ_CORE` later implemented the private local-
stdio language server and GraphView wire mapping against this unchanged
contract. That later implementation does not retroactively broaden this
historical contract acceptance; VSIX packaging and editor presentation remain
separate tasks.
