# Adapter VSIX Supported-Host Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `VSIX_ACCEPTANCE`
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/vsix-acceptance-cases-v1.json](../../test/fixtures/vsix-acceptance-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted installed boundary

The private fourteen-file VSIX now passes one disposable installed Extension
Host workflow at the selected minimum VS Code `1.101.0`. The gate uses exact
`@vscode/test-electron` `3.1.0`, keeps the downloaded host cache outside the
repository by default, and creates independent extension, profile, and
workspace directories for each run.

The exact VSIX is installed through the VS Code CLI, listed as
`perttool-private.perttool-vscode-private@0.0.0`, activated from the installed
artifact, force-replaced once, activated again, uninstalled, and independently
confirmed absent from the extension registry. The entire disposable root is
then removed. No global extension installation, Marketplace request,
publication, tag, dist-tag, Git mutation, or user-profile mutation occurs.

## 2. Extension Host evidence

The first host disables workspace trust and proves a clean trusted workspace.
The second uses a fresh trust-enabled profile with no trusted locations and
proves `workspace.isTrusted === false`. Both hosts verify the exact VS Code
identity, Node.js 22-or-later Extension Host, extension activation, registered
commands, offline bundled-server startup, document symbols, same-document
definition navigation, diagnostics, and clean deactivation.

The same installed extension accepts file and virtual `.pert` documents. It
opens the DAG view for ordinary, empty, 128-task, rapidly edited, and invalid
inputs. The prior implementation cases remain the executable detail evidence
for all four analysis modes, generation/version binding, cancellation and
stale clearing, deterministic layout, responsive SVG, closed Webview messages,
source selection, restrictive CSP, arbitrary-content rejection, keyboard and
high-contrast behavior, reduced motion, live status, and the exact-value
accessible outline.

An invalid virtual document produces server diagnostics and a read-only Help
code action. Executing that action opens the version-bound
`perttool-help` virtual document. Neither the source plan nor its workspace
inventory changes across either host run, and the fixed profile settings remain
byte-identical.

## 3. Machine-readable cases

`VSXA-001` through `VSXA-012` fix the dependency order from exact package
inventory through supported runtime identity, trusted and untrusted
activation, virtual input, offline LSP behavior, DAG modes and size states,
rapid edits, Webview security and accessibility, replacement/uninstall, and
side-effect closure.

The downloaded standalone Linux desktop host warns that it is not the normal
WSL installation path. On WSL only, its `1.101.0` CLI may report successful
uninstall and then abort during its own post-operation shutdown. The gate
accepts that signal only after the exact success message and still requires an
independent empty extension-registry readback. Native Linux CI accepts only a
zero exit.

## 4. Verification

```sh
npm run typecheck --workspace perttool-vscode-private
node --test test/vsix-shell.test.mjs test/vsix-dag-view.test.mjs test/vsix-acceptance.test.mjs
PERTTOOL_VSCODE_CACHE=/tmp/perttool-vscode-test-cache npm run check:vsix-shell
npm run check
git diff --check
```

The assertion-free start preview was governance-not-applicable and was written
without `--accepted-by-owner`. The start event is
`WE-e091d3f8d771278f1c3b97d6870e404d5bca6322b3cac1f7bf582e07d1788b51`
at `2026-08-05T21:30:33+09:00`.

The assertion-free finish preview was likewise governance-not-applicable and
was written without an owner assertion. The finish event is
`WE-c3701dd563e124a896c56c563f698a20acd8be7092b1719d731b7d34fbb27409`
at `2026-08-05T21:46:31+09:00`. The source records exact `479/1800h` active
time and `479/1800ph` effort. The completed source digest is
`sha256:976c06df80666e06ee438e9559e1f618699a42c8706746c37fdbba4d5e3c6833`.

## 5. Remaining plan and authority

After completion, only `ADAPTER_INTEGRATION_ACCEPTANCE` and 5p remain.
Precedence and heuristic resource makespans are both 5p with zero resource
delay. Inherited `29p/2d` velocity produces equal `10/29d` forecasts. Complete
NextResult v6 recommends and makes startable only
`ADAPTER_INTEGRATION_ACCEPTANCE`.

Cross-adapter acceptance, release selection, publication, public extension
identity, remote writes, Issue mutation, editor mutation, MCP mutation, and
plan advance remain separate boundaries.
