# Adapter VSIX Shell Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `VSIX_SHELL`
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/vsix-shell-cases-v1.json](../../test/fixtures/vsix-shell-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted shell boundary

The private `perttool-vscode-private@0.0.0` workspace implements the first
read-only VS Code shell. Its manifest fixes VS Code `^1.101.0`, a Node
workspace extension, untrusted and virtual workspace support, lazy `.pert`
and Help-command activation, one presentation-only TextMate grammar, and exact
`vscode-languageclient` `9.0.1` source input.

The extension bundles the accepted language-server source and its Core closure
into one offline Node.js 22 CommonJS server entry. The client is a separate
CommonJS bundle with only the host-provided `vscode` module external. Neither
bundle searches `PATH`, resolves workspace code, downloads a server, starts a
network listener, invokes the CLI, or adds a dependency to the public root
package.

## 2. Lifecycle and Help evidence

Activation starts the exact bundled server over stdio with editor protocol
model 1 and the exact GraphView and EditorHelp schema handshakes. The custom
Help command remains unavailable unless that handshake succeeds. It validates
a closed server-issued command argument, checks the active URI and editor
version, confirms the server's URI/generation/version binding through a
`none` GraphView request, validates the closed Help result, and presents the
bundled Markdown through a read-only virtual document provider.

The client writes only to a VS Code log output channel. It has no telemetry,
custom executable path, remote endpoint, workspace file watcher, setting
mutation, or user-code hook. Deactivation stops the client and clears custom
capability availability.

## 3. Artifact evidence

`npm run check:vsix-shell` builds and packages one disposable 11-file VSIX:

- manifest, README, and MIT license;
- language configuration and TextMate grammar;
- client bundle and source map;
- pure protocol-binding bundle and source map; and
- bundled language-server entry and source map.

The inventory contains no `node_modules`, Webview, DAG asset, Marketplace
credential, or project source. The gate extracts the VSIX into a disposable
directory and drives the packaged server through initialize, diagnostics,
GraphView, shutdown, and exit. The same runtime smoke passes when the server
process uses Node.js `22.22.3`.

## 4. Machine cases

| Case | Accepted evidence |
| --- | --- |
| `VSXS-001` | private workspace and Node/VS Code runtime identity |
| `VSXS-002` | lazy `.pert` and Help-command activation |
| `VSXS-003` | presentation-only TextMate grammar |
| `VSXS-004` | exact language client and protocol handshake |
| `VSXS-005` | offline bundled server over stdio |
| `VSXS-006` | untrusted and virtual workspace declarations |
| `VSXS-007` | closed URI/generation/version-bound Help |
| `VSXS-008` | read-only virtual Help document |
| `VSXS-009` | output-channel logging and client lifecycle |
| `VSXS-010` | isolated VSIX inventory and side-effect closure |

## 5. Verification

```sh
npm run build
npm run typecheck --workspace perttool-vscode-private
node --test test/vsix-shell.test.mjs
PERTTOOL_NODE_BINARY=/home/katsumata-m/.nvm/versions/node/v22.22.3/bin/node npm run check:vsix-shell
npm run check
git diff --check
```

`VSIX_SHELL` completed at `2026-08-05T18:37:58+09:00`. The exact post-finish
source digest is
`sha256:8b6d6ed28af90495ae7937242b1197528c2ad2afdfb63fd682608f4c54e1ff9c`.
Eight tasks and 41p remain; precedence makespan is 21p and the `parallel-sgs`
version 1 heuristic resource makespan is 29p with 8p resource delay. Complete
NextResult v6 recommends and makes startable only `NODE_PORT_BOUNDARY`;
`MCP_READ_CONTRACT` and `VSIX_DAG_VIEW` are `allowed` but not selected.

## 6. Retained boundaries

- `VSIX_DAG_VIEW` owns GraphView presentation, Webview assets, CSP, accessible
  outline, mode selection, refresh, and source-navigation messages.
- `VSIX_ACCEPTANCE` owns an isolated supported VS Code host workflow,
  trusted/untrusted activation evidence, upgrade behavior, and uninstall
  cleanup.
- No editor mutation, graph mutation, public extension name, Marketplace
  publication, release selection, global install, remote write, Issue
  mutation, or plan advance is authorized by this acceptance.
