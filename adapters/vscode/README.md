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
or task-start authority. Editor mutation, supported-host acceptance, public
naming, Marketplace publication, and release selection remain separate work.
