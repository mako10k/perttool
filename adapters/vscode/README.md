# perttool VS Code Extension (Private)

This repository-only extension bundles the accepted read-only perttool
language server for offline local or remote VS Code workspace extension hosts.
It activates for `.pert` documents, supplies presentation-only TextMate
highlighting, exposes read-only diagnostic Help, and renders the current
version-bound `Perttool.GraphViewResult.v1` through a restrictive local
Webview. The graph provides four analysis modes, accessible text details, and
binding-checked source navigation.

The extension does not parse or analyze `.pert` itself. It does not write
files, access Git, execute workspace code, use a network listener, download
code, emit telemetry, compute PERT semantics in the Webview, or grant mutation
or task-start authority. Its disposable installed gate covers trusted and
untrusted minimum-host activation, virtual and large graphs, Help/navigation,
replacement, uninstall readback, and unchanged workspace bytes. Editor
mutation, public naming, Marketplace publication, and release selection remain
separate work.

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
