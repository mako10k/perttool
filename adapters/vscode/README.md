# perttool VS Code Extension (Private)

This repository-only extension bundles the accepted read-only perttool
language server for offline local or remote VS Code workspace extension hosts.
It activates for `.pert` documents, supplies presentation-only TextMate
highlighting, and exposes read-only diagnostic Help through the versioned LSP
handshake.

The extension does not parse or analyze `.pert` itself. It does not write
files, access Git, execute workspace code, use a network listener, download
code, emit telemetry, or grant mutation or task-start authority. The DAG
Webview, editor mutation, public naming, Marketplace publication, and release
selection remain separate work.
