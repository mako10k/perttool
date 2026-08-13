# Protocol-neutral Document Session Core

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `DOCUMENT_SESSION_CORE`
- Session model version: 1
- Parent architecture: [adapter-platform.md](adapter-platform.md)
- Editor protocol: [editor-protocol.md](editor-protocol.md)
- Machine cases: [../../test/fixtures/document-session-cases-v1.json](../../test/fixtures/document-session-cases-v1.json)

## 1. Scope

This specification fixes and implements the platform-neutral document state
shared by stateless adapters and the later LSP server. It owns:

- immutable Grammar 6 text snapshots and their source identity;
- exact URI, open-generation, version, and SHA-256 binding;
- parser and semantic results produced once per snapshot;
- zero-based UTF-16 position and offset conversion;
- atomic incremental content-change application;
- terminal desynchronization after a lifecycle or change violation;
- analysis over the accepted snapshot without reparsing;
- completed projection caching scoped to one snapshot; and
- cancellation, close, reopen, and stale-result invalidation.

It does not own LSP JSON-RPC, MCP transport, CLI dispatch, filesystem reads,
Node hashing, Git, persistence, editor changes, GraphView wire projection, or
VSIX presentation. It does not add a root-package export, CLI command, CLI
schema, dependency, release, or publication.

## 2. Placement and dependency boundary

The implementation is `src/session/document-session.ts` and is exposed only
through `perttool/core`. The module imports neutral parser, semantic,
diagnostic, and analysis services. Its complete runtime closure has no
`node:` module, external package, Application implementation, CLI, Host,
schema-loader, history, or protocol adapter.

The session receives this synchronous inward port:

```ts
interface DocumentSnapshotOptions {
  digestText(text: string): string;
  maxDiagnostics?: number;
}
```

`digestText` MUST return lowercase `sha256:` plus exactly 64 hexadecimal
digits for the exact synchronized JavaScript string encoded as UTF-8 by the
Host. The Core validates the result shape but does not implement or discover a
hash Host. A missing, throwing, or malformed digest is unavailable source
identity. Stateless adapters provide the same port when creating one snapshot;
the later LSP composition root provides it to one connection session.

This narrow dependency does not activate the general Node Host boundary owned
by `NODE_PORT_BOUNDARY`.

## 3. Additive Core surface

The exact new runtime exports are:

```ts
analyzeDocumentSnapshot
createDocumentSession
createDocumentSnapshot
documentOffsetToPosition
documentPositionToOffset
```

The existing forty runtime exports remain unchanged and reference-identical.
The current exact `perttool/core` runtime catalog therefore has 45 names. The
package root and `perttool/node` remain exact 121-name compatibility facades
and do not re-export these new Core-only values.

The type surface additionally exports the closed snapshot, binding, position,
range, content-change, semantic-result, analysis, projection, transition, and
session contracts from the implementation module.

## 4. Snapshot model

`createDocumentSnapshot` accepts exact `uri`, `generation`, `version`, `text`,
and the snapshot options. URI and generation are non-empty strings. Version is
any safe integer; monotonicity belongs to a stateful session.

The immutable result is:

```ts
interface DocumentSnapshot {
  binding: {
    uri: string;
    generation: string;
    version: number;
    sourceDigest: `sha256:${string}`;
  };
  text: string;
  parse: ParseResult<TargetDeclarationKind>;
  semantic: {
    ok: boolean;
    diagnostics: readonly Diagnostic[];
    diagnosticsTruncated: boolean;
  };
}
```

The portable session Core's Grammar 6 parser and validator are its only syntax
and semantic owners; Contract 8 adapters prepare Grammar 7 separately. Parser
diagnostics seed semantic validation. Diagnostics use the
existing deterministic order and configured limit. `semantic.ok` is false for
any complete error set; truncation remains separately visible. Invalid DSL is
a current immutable snapshot with diagnostics, not a synchronization failure.

The snapshot, binding, parse tree, semantic result, diagnostics, declarations,
fields, trivia, and source spans are frozen before publication. A later change
creates a new snapshot and never mutates the old object or its text.

## 5. UTF-16 positions and incremental changes

`DocumentPosition` is zero-based line and UTF-16 code-unit character. The
conversion functions support LF, CRLF, lone CR, a final line without a
terminator, an empty final line, and end-of-line positions.

The following are invalid and return `null`:

- negative, fractional, unsafe, or out-of-document values;
- a line or character beyond its line;
- a position or offset inside a surrogate pair; and
- an offset between CR and LF in one CRLF terminator.

The position at a line terminator maps to the end of the preceding line. The
offset after the complete terminator maps to character zero of the next line.
No conversion rounds or clamps.

A stateful `change` contains a non-empty ordered array of ranged content
changes and one strictly greater safe-integer version. Each range is resolved
against the candidate produced by all earlier changes in the same
notification. All changes apply to a temporary candidate. An empty list,
malformed range, invalid position, reversed range, missing document, or
non-increasing version commits nothing and terminally desynchronizes the
session.

## 6. Stateful lifecycle

`createDocumentSession` creates one active connection-local session. It owns a
monotonic generation counter and a map keyed by the exact URI string.

1. `open` creates generation `g1`, `g2`, and so on within that session. A
   duplicate open or invalid binding desynchronizes the complete session.
2. `change` retains the generation, advances the version, creates a new
   snapshot, and makes all older bindings stale.
3. `close` removes the current generation. Closing an unknown URI is a
   deterministic no-op. A later open of the same URI receives a new generation
   even when the version repeats.
4. `dispose` clears all documents and permanently closes the session.
5. A desynchronized session clears all documents and accepts no later open,
   change, analysis, or projection. Protocol recovery requires a new session
   and fresh opens.

Digest failure during open or change also desynchronizes because the client
has already supplied a source state that cannot receive the required exact
identity. Invalid DSL does not desynchronize.

`current(uri)` returns only the current snapshot. `resolve(binding)` compares
all four binding fields and returns `current`, `stale`, `closed`, or
`desynchronized`; it never substitutes the latest snapshot for an old binding.

## 7. Analysis projection

`analyzeDocumentSnapshot` supports `none`, `precedence`, `resource`, and
`both`. It reuses the snapshot's validated Grammar 6 document and diagnostics;
it does not parse source again.

- `none` returns a complete current projection with null analysis.
- `precedence`, `resource`, and `both` invoke the existing neutral validated-
  document analyzer with the accepted defaults and supplied exact options.
- Invalid source returns `invalid`, `complete: false`, diagnostics, and null
  analysis.
- Truncated snapshot diagnostics or an incomplete/failed analysis return
  `unavailable`, `complete: false`, diagnostics, and null analysis.
- A current analyzed projection is complete and contains only the requested
  analysis views.

Capacity overrides are snapshotted and cache keys order them by resource ID.
Mode, capacity overrides, maximum paths, precision, and diagnostic limit all
participate in the cache identity. Different option order with the same
semantic values is one cache entry; different semantic options are not.

This is a neutral analysis projection, not
`Perttool.GraphViewResult.v1`. The later LSP adapter maps only a complete
current projection and the bound snapshot into that wire contract.

## 8. Projection cache, cancellation, and stale work

`session.project` accepts the exact binding, a non-empty adapter-owned cache
key, an optional `AbortSignal`, and a projector. By default the projector is
not called for invalid or diagnostic-truncated source. Explicit flags may
permit those snapshots for safe syntax Help or diagnostic-only projections;
they never make the source semantically valid.

Only a successfully completed value for the exact current snapshot is cached.
The cache is scoped by snapshot object and is discarded naturally when a new
snapshot replaces it. It never shares a value across URI, generation, version,
or digest.

The session checks cancellation and binding before work, awaits synchronous or
asynchronous projection work, then checks cancellation and the complete
binding again before caching or returning the value.

- observed cancellation returns `cancelled` with no value and no cache write;
- change or reopen returns `stale` with no value and no cache write;
- close or dispose returns `closed` with no value and no cache write;
- desynchronization returns `desynchronized` with no value and no cache write;
- invalid or truncated source returns `invalid` or `unavailable` with no value
  unless the caller explicitly requested a safe exceptional projection.

The projector receives the captured immutable snapshot. Cancellation cannot
force synchronous Domain code to stop mid-instruction, but a late completion
can never become a current value or populate the cache.

`session.analyze` is the closed convenience path over this projection cache.
It flattens analysis status and reports whether the completed projection came
from the current snapshot cache.

## 9. Stateless adapters

A stateless CLI or MCP adapter may call `createDocumentSnapshot` followed by
`analyzeDocumentSnapshot` without creating a stateful session. The adapter
supplies its own URI, generation identity, version, exact text, digest port,
and analysis options. This path has no ambient document map or cache and
returns the same snapshot and analysis meanings as a stateful current
generation.

The existing CLI is not migrated in this task. MCP transport and source
selection remain gated by the separate MCP contract and Node-port tasks.

## 10. Safety and compatibility

- The implementation reads and writes no file, Git state, process state,
  network, editor, configuration, or environment value.
- It invokes no CLI and starts no process, listener, timer, or worker.
- It creates no mutation candidate, TextEdit, owner assertion, authority,
  recommendation, or persistence decision.
- Invalid, stale, cancelled, closed, unavailable, or desynchronized state
  cannot return a current semantic projection.
- Grammar 6, CLI Contract 7, 44 commands, 20 CLI schemas, 121 root exports,
  governance, assurance, history, safe-write behavior, and zero production
  dependencies remain unchanged.
- LSP transport, Help mapping, symbols, hover, completion, definition,
  GraphView mapping, VSIX, MCP, Node ports, release, publication, and plan
  advance remain later boundaries.

## 11. Later editor-mutation composition

The accepted [Tiered Editor Mutation Contract](editor-mutations.md) reuses
this exact immutable snapshot, UTF-16, cancellation, and stale-result model.
It does not add mutation planning to the document session. Later model-2
services may consume a frozen snapshot and return normalized edits, but the
session still neither applies an edit nor writes a file, and a newer version
invalidates every retained candidate.

## 12. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `DSC-001` | Stateless snapshot | exact frozen binding, digest, Grammar 6 parse, semantics, and diagnostic limit |
| `DSC-002` | UTF-16 positions | LF/CRLF/CR, surrogate, line-end, final-line, and invalid conversions |
| `DSC-003` | Atomic change | ordered ranges, one new immutable snapshot, retained generation, greater version |
| `DSC-004` | Reopen | close clears current; reopen has a distinct generation even with repeated version |
| `DSC-005` | Desynchronization | lifecycle/version/range/digest failure clears all documents and is terminal |
| `DSC-006` | Invalid DSL | current diagnostic snapshot but no semantic analysis projection |
| `DSC-007` | Analysis modes | none/precedence/resource/both reuse the validated snapshot with exact options |
| `DSC-008` | Cache | completed values are snapshot-and-option scoped and repeat by reference |
| `DSC-009` | Stale work | change/close/reopen during async work returns no value and performs no cache write |
| `DSC-010` | Cancellation | pre/during/post cancellation returns no value and performs no cache write |
| `DSC-011` | Core boundary | exact 45-name catalog, 34-module portable closure, zero external imports |
| `DSC-012` | Compatibility | root/Node/CLI/schema identities and all external side-effect boundaries unchanged |

The machine fixture owns the exact runtime inventory and dependency-ordered
case list.

## 13. Acceptance boundary

Acceptance requires the twelve machine cases, focused Core tests, source and
package boundary checks, existing compatibility suites, English and document
checks, all self-use plans, temporary-link and isolated-package consumption,
the complete repository gate, and reviewed diff agreement.

Acceptance records the local task lifecycle but does not advance the plan,
start `LSP_READ_CORE`, select a release, publish, install globally, push a
remote, or mutate an Issue.
