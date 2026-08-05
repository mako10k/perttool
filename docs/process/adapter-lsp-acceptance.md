# Adapter Read-Only LSP Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `LSP_ACCEPTANCE`
- Implementation record: [adapter-lsp-read-core-acceptance.md](adapter-lsp-read-core-acceptance.md)
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/lsp-acceptance-cases-v1.json](../../test/fixtures/lsp-acceptance-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted artifact boundary

The private `perttool-language-server-private@0.0.0` workspace now has one
explicit installable artifact boundary. Its package contains only the 24
compiled JavaScript, declaration, and source-map files under `dist/` plus the
manifest. It pins `vscode-languageserver` `9.0.1`, declares exact
`perttool@0.7.1` as its peer, and retains `file:../..` only as a repository
development dependency.

The root `perttool` package remains a separate artifact with zero production
dependencies and no `adapters/` inventory. Neither artifact gains a public
name, release version, dist-tag, registry state, VSIX, or publication decision
from this acceptance.

## 2. Isolated execution evidence

`npm run check:lsp-package` performs the following disposable workflow:

1. build and pack the root Core and private language server separately;
2. install both tarballs together with scripts disabled in a temporary prefix;
3. start only the installed private `dist/main.js` over stdio;
4. negotiate editor protocol model 1 and the exact Help/GraphView schemas;
5. open a valid Grammar 6 document containing Unicode and block text;
6. receive versioned empty diagnostics and a complete `both` GraphView result;
7. confirm the closed capability set and heuristic resource marker; and
8. shut down and exit with no stderr.

The isolated smoke passed directly with Node.js `22.22.3`. The complete LSP
tests and isolated package gate are wired into the unchanged Node.js 22 and 24
CI matrix; a remote CI run remains part of a later authorized release gate.

## 3. Protocol and failure evidence

The implementation and acceptance suites jointly cover:

- standard-client and custom-handshake initialization;
- UTF-16 Unicode, CRLF/LF, block-text, and selection ranges;
- ordered rapid incremental versions and atomic synchronization failure;
- cancellation, stale completion, close/reopen generation, and multiple URI
  isolation;
- diagnostics, symbols, hover, edit-free completion, definition, bundled
  Help, and deterministic four-mode GraphView;
- invalid source with no semantic or graph projection;
- no rename, formatting, execute-command, workspace-symbol, or mutation edit;
  and
- no CLI subprocess, filesystem access, Git access, network listener,
  telemetry, publication, or dynamic download.

## 4. Machine cases

| Case | Accepted evidence |
| --- | --- |
| `LSPA-001` | exact private manifest and 25-file inventory |
| `LSPA-002` | standard and negotiated initialization |
| `LSPA-003` | Unicode, CRLF/LF, block text, and UTF-16 mapping |
| `LSPA-004` | rapid ordered incremental versions |
| `LSPA-005` | cancellation and stale-result rejection |
| `LSPA-006` | invalid document fails closed |
| `LSPA-007` | URI and generation isolation |
| `LSPA-008` | capability and mutation-edit closure |
| `LSPA-009` | bundled Help and byte-deterministic results |
| `LSPA-010` | isolated dual-tarball stdio lifecycle |
| `LSPA-011` | root package exclusion and compatibility |
| `LSPA-012` | complete repository and CI-matrix integration |

## 5. Verification

```sh
npm run build
node --test test/lsp-read-core.test.mjs test/lsp-acceptance.test.mjs
PERTTOOL_NODE_BINARY=/home/katsumata-m/.nvm/versions/node/v22.22.3/bin/node npm run check:lsp-package
npm run check
git diff --check
```

`LSP_ACCEPTANCE` completed at `2026-08-05T18:14:18+09:00`. The exact
post-finish source digest is
`sha256:072c05fa5b0d8e0c014fa5616bc140b3ab88bbabf7c039fef816e2c3f30d9382`.
Nine tasks and 47p remain; precedence makespan is 22p and the
`parallel-sgs` version 1 heuristic resource makespan is 36p with 14p resource
delay. Complete NextResult v6 recommends and makes startable only
`VSIX_SHELL`; `NODE_PORT_BOUNDARY` remains `deferred`, and
`MCP_READ_CONTRACT` is `allowed` but is not selected in addition to the
complete startable recommendation.

## 6. Retained boundaries

- `VSIX_SHELL` owns extension activation, TextMate syntax, LSP client launch,
  workspace trust, offline bundling, configuration, and extension lifecycle.
- `VSIX_DAG_VIEW` owns Webview presentation, CSP, accessibility, refresh, and
  source-navigation messaging.
- Node-port separation, CLI facade parity, MCP, and integration acceptance
  remain separate plan tasks.
- No editor mutation, MCP mutation, public package or extension publication,
  release selection, global install, remote write, Issue mutation, or plan
  advance is authorized by this acceptance.
