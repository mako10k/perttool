# VSIX Public Identity and Presentation Decision

- Status: Selected 1.0
- Date: 2026-08-06
- Backlog: `VSIX-REL-001`
- Parent contract: [editor-protocol.md](editor-protocol.md)
- Requirements: [../requirements.md](../requirements.md)
- Basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose and boundary

This decision selects the intended public identity, independent version line,
presentation asset, and initial local distribution sequence for the accepted
read-only perttool VS Code extension. It does not select a release candidate,
activate a public manifest, create a tag, push a remote, register a Publisher,
or publish to GitHub, Visual Studio Marketplace, or Open VSX.

The accepted private extension remains the implementation baseline until a
separate release-preparation change proves Publisher ownership and changes the
manifest, package tests, installed-host expectations, documentation, and
artifact identity atomically.

## 2. Selected identity

| Field | Selected value |
| --- | --- |
| Extension manifest `name` | `perttool-vscode` |
| Marketplace `displayName` | `perttool` |
| Intended Publisher | `mako10k` |
| Intended extension ID | `mako10k.perttool-vscode` |
| Initial extension version | `0.1.0` |
| Release tag | `vscode-v0.1.0` |
| Retained artifact name | `perttool-vscode-0.1.0.vsix` |
| Short description | `PERT plan language support and DAG visualization for VS Code` |
| License | MIT |
| Price | Free |

The manifest `name` is distinct from the root npm package `perttool`. This
keeps the extension workspace and its build-time root dependency unambiguous
while retaining the product name `perttool` in Marketplace presentation.
The effective Marketplace identity is always the exact Publisher and manifest
name pair.

`mako10k` is a selected target, not a claim that a Marketplace Publisher with
that identity is currently available or controlled by the maintainer. Release
preparation must prove both facts without changing the target silently. An
unavailable or uncontrolled Publisher is a stop condition requiring a new
identity decision.

## 3. Version and provenance

The extension owns an independent SemVer line. Extension-only presentation,
host, packaging, or Webview changes do not force an npm `perttool` release,
and npm-only CLI changes do not force a VSIX release.

Every retained VSIX candidate and release record must bind:

- the extension version;
- the exact source commit;
- the root `perttool` package version used by the bundled language server;
- the VS Code engine and language-client versions;
- the complete packaged-file inventory, byte size, and SHA-256 digest; and
- the supported-host acceptance result.

The initial public manifest cutover is `0.1.0`. It must not reuse the private
`0.0.0` installed identity or a CLI release tag.

## 4. Icon and listing presentation

The selected icon is the project-owned 1254-by-1254 RGB PNG at
`adapters/vscode/icon.png`, with SHA-256
`90daaf654be78f256a0969c61c957c11bfac0ab717184910928e764664abb075`.
Its dimensions exceed the [official 128-by-128 minimum and 256-by-256 Retina
guidance](https://code.visualstudio.com/api/references/extension-manifest) for
a VS Code extension icon. It depicts Activity-on-Arrow semantics with four
milestone nodes, five directed task edges, and one warm-amber critical path on
a dark navy field. It contains no text, third-party mark, VS Code logo, or
Microsoft logo. Cyan and blue secondary paths distinguish graph structure
without encoding additional product semantics.

The initial listing uses:

- categories `Programming Languages` and `Visualization`;
- keywords `PERT`, `DAG`, `project planning`, and `critical path`;
- the existing public repository and MIT license;
- a read-only capability statement;
- explicit no-telemetry, no-network-fetch, and no-file-write statements; and
- screenshots produced from accepted `.pert` fixtures without customer data.

The icon is included in the current fifteen-file private VSIX. This changes
only packaged presentation inventory and does not activate the selected public
identity or release.

## 5. Local-first distribution and stabilization

The first delivery is local VSIX installation only and proceeds through
separate gates:

1. prepare and accept one retained local VSIX from clean source;
2. bind its manifest identity, complete inventory, byte size, SHA-256, source
   commit, bundled perttool version, and supported-host result;
3. read the selected local VS Code installation, profile, and existing
   extension state before installing those exact bytes;
4. verify activation, diagnostics, Help, DAG modes, navigation, offline use,
   upgrade or replacement, uninstall, and rollback while source files remain
   byte-identical; and
5. record an explicit local stabilization decision after representative use.

GitHub Release, Visual Studio Marketplace, and Open VSX distribution are
deferred. They are not automatic successors of a passing local gate. A later
explicit user decision must reopen public distribution, choose its channel,
recheck Publisher ownership and registry availability, and define independent
candidate, publication, installation, update, rollback, and acceptance gates.

Local installation changes the selected editor profile and therefore requires
an exact target and separate execution authorization. No Publisher creation,
Git tag or release creation, push, asset upload, or registry publication is
authorized. An ambiguous installation result must be read back before retry.

## 6. Unchanged capability and safety boundary

Public presentation does not broaden the accepted extension. The first
release remains read-only and retains exact offline bundled-server behavior,
VS Code `^1.101.0`, untrusted and virtual workspace support, restrictive DAG
Webview CSP, source-bound navigation, no telemetry, no network fetch, no Git
access, no workspace-code execution, and no file or settings write.

Editor mutation, graph mutation, automatic update policy, Open VSX
publication, npm publication of the extension workspace, and changes to the
root npm package version remain outside this decision.
