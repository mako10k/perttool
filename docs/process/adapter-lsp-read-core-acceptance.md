# Adapter Read-Only LSP Core Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `LSP_READ_CORE`
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Document session: [../specs/document-session.md](../specs/document-session.md)
- Machine cases: [../../test/fixtures/lsp-read-core-cases-v1.json](../../test/fixtures/lsp-read-core-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

`adapters/lsp` is one private Node.js `>=22` workspace with no public package
name or release implication. It pins `vscode-languageserver` `9.0.1`, whose
exact protocol dependency is 3.17.5, and imports the accepted portable
document session through the named `perttool/core` boundary. Its only runtime
composition root is local stdio.

The server advertises the contract's closed standard capability set:

- UTF-16 incremental open/change/close synchronization;
- versioned diagnostics with stable perttool codes, severity, related
  information, Help identifiers, and truncation state;
- document symbols, hover, edit-free completion, and same-document definition;
  and
- quick fixes that open bundled Help but contain no workspace or document
  edit.

A standard LSP client receives those capabilities without a perttool-specific
handshake. The custom `perttool/help` and `perttool/graphView` methods require
an exact model-1 and result-schema negotiation. Unsupported custom parameters
fail with `InvalidParams`; cancellation and stale completion use the stable
LSP request-cancelled and content-modified errors.

## 2. Snapshot and GraphView evidence

Every request resolves the current exact URI, generation, version, and source
digest from one `DocumentSession`. Diagnostics are published for the matching
version after open and change, and are cleared on close or terminal
desynchronization. Full-document changes, missing ranges, duplicate open,
invalid versions, and malformed synchronization terminally stop the
connection-owned session rather than guessing a repair.

Symbols, hover, completion, definition, Help actions, and graph navigation use
the same UTF-16 source locations as the accepted snapshot. Invalid DSL remains
diagnosable but returns no semantic navigation or graph.

`Perttool.GraphViewResult.v1` is projected for the closed `none`,
`precedence`, `resource`, and `both` modes. It retains declaration ordering,
exact rational values, task and gate kinds, residual graph structure,
mode-specific analysis, and source navigation without evaluating Mermaid or
accepting presentation input as semantics. Gates have zero duration and no
resource.

## 3. Distribution and safety evidence

| Surface | Accepted result |
| --- | --- |
| LSP workspace | private `perttool-language-server-private` in `adapters/lsp` |
| protocol SDK | exact `vscode-languageserver` `9.0.1`; protocol 3.17.5 |
| root dependencies | unchanged zero production dependencies |
| root facades | unchanged 121 root and Node runtime exports; Core remains 45 |
| CLI | unchanged Contract 7, 44 commands, and 20 root schemas |
| public tarball | private `adapters/` directory excluded |

Static and runtime evidence rejects CLI subprocesses, filesystem reads or
writes, Git access, network listeners, editor edits, telemetry, mutation,
publication, and dynamic code download. The private server is a repository
build and test input only. Package validation proves that its SDK dependencies
do not enter the public `perttool` production dependency or tarball boundary.

## 4. Machine cases

| Case | Accepted evidence |
| --- | --- |
| `LSPC-001` | private workspace, exact SDK, stable protocol, and package isolation |
| `LSPC-002` | initialization, handshake, and closed capability projection |
| `LSPC-003` | exact incremental synchronization and terminal desynchronization |
| `LSPC-004` | version-bound diagnostics and close clearing |
| `LSPC-005` | symbols, definition, and exact source ranges |
| `LSPC-006` | hover and completion without supplied edits |
| `LSPC-007` | negotiated bundled Help and read-only quick fixes |
| `LSPC-008` | exact four-mode GraphView wire projection |
| `LSPC-009` | invalid or unavailable source fails closed |
| `LSPC-010` | cancellation, stale completion, close/reopen, and multi-URI isolation |
| `LSPC-011` | child-process stdio initialize, shutdown, and exit lifecycle |
| `LSPC-012` | side-effect, public-facade, CLI, schema, and distribution compatibility |

## 5. Verification

Focused verification covers all twelve cases, the preceding document-session
contract, and an isolated stdio process. The package gate packs and installs
the public root artifact while proving that the private workspace is absent.
The repository-wide gate covers all sources, historical compatibility tests,
self-use plans, Markdown, English baseline, temporary link, and isolated
package workflows.

```sh
npm run build
node --test test/lsp-read-core.test.mjs test/document-session-core.test.mjs
npm run check:package
npm run check
git diff --check
```

The complete gate passed in the completed-task state. The exact source digest
is `sha256:35f330cfd4aa974dde4d4720435dfcddd14ade21e1084294fddb4315ffa4b8ed`.
Ten tasks and 51p remain at 26p/40p precedence/resource makespans with 14p
resource delay. Complete NextResult v6 recommends and makes startable only
`LSP_ACCEPTANCE`; `NODE_PORT_BOUNDARY` and `MCP_READ_CONTRACT` are `deferred`.

## 6. Retained boundaries

- `LSP_ACCEPTANCE` retains the independent installed/bundled language-server
  acceptance gate before VSIX implementation.
- `VSIX_SHELL` and `VSIX_DAG_VIEW` retain extension activation, TextMate,
  Webview, CSP, accessibility, and presentation behavior.
- `NODE_PORT_BOUNDARY` and `CLI_PARITY` remain separate shared-foundation
  tasks; this LSP slice does not claim their general host separation.
- MCP contract and implementation remain independent of the editor branch.
- No file, Git, editor, mutation, network, telemetry, release, publication,
  global install, remote write, Issue mutation, or plan advance is added or
  authorized.
