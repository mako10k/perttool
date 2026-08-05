# Adapter Editor Protocol Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `EDITOR_PROTOCOL_CONTRACT`
- Normative contract: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/editor-protocol-cases-v1.json](../../test/fixtures/editor-protocol-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

Editor protocol model 1 closes the LSP, VSIX, and DAG-view design input before
implementation. It selects stable LSP 3.17 over local stdio, UTF-16
incremental document synchronization, Node.js `>=22`, and VS Code
`^1.101.0`. LSP 3.18 is not selected while its official specification remains
upcoming and under development.

The standard LSP capability set contains versioned diagnostics, document
symbols, hover, completion without supplied edits, definition, and Help-only
quick fixes. Custom Help and graph requests require an explicit model-1
handshake. Rename, formatting, execute-command, file operations, and all
mutation edits remain absent.

The exact completed plan source digest is recorded after lifecycle completion
in section 6.

## 2. Document and request decisions

| Topic | Accepted decision |
| --- | --- |
| URI | exact synchronized `DocumentUri`; no path conversion or filesystem inference |
| Generation | open-to-close lifetime; reopen invalidates every prior result even when versions repeat |
| Version | integer and strictly increasing; gaps allowed, duplicate/lower changes terminate the desynchronized connection |
| Change sync | ordered LSP incremental edits against the previous accepted immutable snapshot |
| Change failure | reject atomically, cancel pending work, terminate, and require a new connection plus `didOpen` |
| Position | zero-based UTF-16 with surrogate, CRLF/LF, block-text, and invalid-position checks |
| Digest | SHA-256 of exact synchronized text encoded as UTF-8 |
| Cancellation | `RequestCancelled` `-32800`; no partial cache or publication |
| Staleness | `ContentModified` `-32801`; no old generation/version result reaches presentation |
| Invalid source | current diagnostics remain available; semantic symbols, definition, and graph fail closed |
| Help | one bundled shared Help registry; LSP and VSIX do not duplicate authoritative prose |

## 3. Graph and navigation decisions

The custom `perttool/graphView` request accepts only current URI, exact
document version, and one of `none`, `precedence`, `resource`, or `both`.
Malformed or unknown parameters return `InvalidParams`; the request does not
accept source text, paths, Git refs, Mermaid, scripts, layout programs, or
mutation instructions.

The closed `Perttool.GraphViewResult.v1` binds its semantic projection to URI,
generation, version, and source digest. A `current` result is complete and has
a graph. `invalid` and `unavailable` results have no graph. Cancelled and stale
requests return protocol errors rather than results. Milestones, task/gate
edges, exact values, precedence facts, and heuristic resource facts have fixed
wire fields and retain shared deterministic ordering.

Every entity carries declaration and selection ranges. The Webview sends an
entity ID rather than a caller-supplied range; the VSIX looks it up in the
retained current result and rechecks URI, open generation, and version before
revealing source.

## 4. VSIX and Webview decisions

| Topic | Accepted decision |
| --- | --- |
| Activation | lazy for `.pert` language, DAG command, or contributed view restoration |
| Placement | Node workspace extension; local or remote with the workspace |
| Browser-only host | unsupported; deterministic unavailable state, no semantic fallback |
| Server | exact bundled offline artifact launched with extension-host Node over stdio |
| Workspace trust | untrusted and virtual workspaces supported because no workspace code or configuration executes |
| Network and telemetry | absent |
| CSP | `default-src 'none'`, nonce-only script, extension-only style/image/font sources |
| Input safety | escaped text, no arbitrary HTML/SVG/Mermaid, closed message kinds and fields |
| Accessibility | keyboard/focus/theme/reduced-motion support and deterministic text outline |

The extension runs where the workspace is located and reads synchronized
editor content only. It does not discover a server on `PATH`, execute a
workspace package, download code, or treat workspace trust as authority.

## 5. Review findings

| ID | Finding | Resolution |
| --- | --- | --- |
| `EDPR-001` | The official LSP site presents 3.18 while its source still labels it upcoming | Fix stable 3.17 and reject 3.18-only capabilities in model 1 |
| `EDPR-002` | Reopen may reuse the same URI and document version | Bind results to an internal open generation as well as URI and version |
| `EDPR-003` | Generic LSP clients do not know perttool custom result versions | Keep standard LSP usable without a handshake and gate only custom methods |
| `EDPR-004` | Completion and code actions could silently become mutation channels | Supply no completion edits and permit only client-owned Help actions without edits |
| `EDPR-005` | A stale graph could remain visually plausible after rapid edits | Clear or mark it stale and recheck binding immediately before presentation |
| `EDPR-006` | Resource-view layout could be mistaken for schedule semantics | Keep schedule facts in shared results; Webview owns visual layout only |
| `EDPR-007` | Workspace trust could be misread as write or task authority | Declare safe read-only restricted-mode behavior and no authority implication |
| `EDPR-008` | Bundled Webview content could still interpolate hostile project text | Require escaped text, closed messages, minimum resource roots, and restrictive CSP |
| `EDPR-009` | A browser fallback could duplicate parser or analysis logic | Mark browser-only hosts unsupported in model 1 |
| `EDPR-010` | Contract acceptance could be mistaken for a VSIX or server release | Keep implementation, packaging, release, publication, push, and global install separate |
| `EDPR-011` | Continuing after a rejected incremental change would apply future ranges to a divergent snapshot | Make the connection terminally desynchronized and require reconnect plus fresh open |
| `EDPR-012` | URI and version can repeat after reopen | Carry and recheck the server-owned open generation in Help and Webview presentation messages |

There are no open findings within this contract task. Concrete SDK dependency
selection, document-session implementation, language-server code, TextMate
grammar, VSIX manifest, Webview implementation, and isolated editor tests
remain assigned to their later plan tasks.

## 6. Verification and lifecycle evidence

The contract has sixteen dependency-ordered `EDP-*` machine cases. Focused
verification covers the standards/runtime matrix, capability closure, custom
handshake, graph shape and fail-closed status, VSIX and Webview boundaries,
normative trace, and active-to-done plan lifecycle.

```sh
npm run build
node --test test/editor-protocol-contract.test.mjs
npm run check:docs
npm run check:english
npm run check:self-use
npm run check
git diff --check
```

The complete repository gate passed in the final completed-task state. The
completed plan source digest is
`sha256:f5966e1af251ddb8873fb3ce05536ce829493533f49f7789540ae011fdc6f6f1`.

## 7. Retained boundaries

- No LSP server, VSIX, Webview, TextMate grammar, adapter workspace, package
  dependency, root export, command, or CLI schema is added.
- No editor or graph mutation, direct file read, write, Git operation,
  workspace execution, network listener, download, or telemetry is activated.
- `DOCUMENT_SESSION_CORE`, `LSP_READ_CORE`, `VSIX_SHELL`, and
  `VSIX_DAG_VIEW` remain unstarted implementation tasks.
- Node-port work, MCP work, release selection, publication, global install,
  remote writes, Issue mutation, and plan advance remain separate decisions.
