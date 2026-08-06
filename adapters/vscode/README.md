# perttool VS Code Extension (Private)

This repository-only extension bundles the accepted read-only perttool
language server for offline local or remote VS Code workspace extension hosts.
It activates for `.pert` documents, supplies presentation-only TextMate
highlighting, exposes read-only diagnostic Help, and renders both the current
version-bound `Perttool.GraphViewResult.v1` and the separately negotiated
historical graph result through a restrictive local Webview. Current graphs
provide four analysis modes, accessible text details, and binding-checked
source navigation. In a trusted local file workspace, historical controls add
explicit endpoint/lower-boundary, snapshot/proved-lineage/timeline, and the
same independent four-mode analysis selection. Historical source actions open
verified immutable `perttool-history` documents rather than worktree ranges.

The extension does not parse or analyze `.pert` itself. Its bundled server may
perform bounded read-only Git discovery and immutable object reads only for an
eligible trusted historical request. Neither component writes files or Git,
executes workspace code, uses a network listener, downloads code, emits
telemetry, computes PERT semantics in the Webview, or grants mutation or task-
start authority. Its disposable installed gate covers trusted and untrusted
minimum-host activation, virtual and large current graphs, historical graph
and immutable-source behavior, Help/navigation, replacement, uninstall
readback, and unchanged workspace bytes. Editor mutation, public naming,
Marketplace publication, and release selection remain separate work.

The selected future public presentation uses display name `perttool`, manifest
name `perttool-vscode`, intended Publisher `mako10k`, and independent initial
version `0.1.0`. The Activity-on-Arrow `icon.png` is already included in the
private VSIX for presentation acceptance. The active manifest remains
`perttool-private.perttool-vscode-private@0.0.0` until a separate release plan
proves Publisher ownership and performs one complete identity cutover. See the
[public identity decision](../../docs/specs/vsix-public-identity.md).

Initial delivery is a retained local VSIX followed by explicit installation
into one selected VS Code profile and representative stabilization. GitHub
Release, Visual Studio Marketplace, and Open VSX distribution are deferred and
are not implied by a passing package or local-host gate.
