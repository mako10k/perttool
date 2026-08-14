# E0 Editor Format Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-14
- Workstream: `EDITOR-MUTATION-001`
- Task: `EDITOR_FORMAT_ACCEPTANCE`
- Plan: [../../plans/editor-mutations.pert](../../plans/editor-mutations.pert)
- Contract: [../specs/editor-mutations.md](../specs/editor-mutations.md)
- Core acceptance:
  [editor-format-core-acceptance.md](editor-format-core-acceptance.md)
- Machine cases:
  [../../test/fixtures/editor-format-acceptance-v1.json](../../test/fixtures/editor-format-acceptance-v1.json)
- Implementation revision:
  `a5729f73d41daf7cdcfe9b4263135df5f1813d0a`

## 1. Accepted integration

The private VSIX now offers the exact ordered Editor Protocol list `[2, 1]`.
The bundled private LSP selects model 2, advertises only standard whole-
document formatting, and retains model 1 as a read-only fallback. Existing
model-1 GraphView and Help result identities remain unchanged.

The VSIX uses the standard language-client formatting feature. One middleware
gate forwards a request only after the initialization result confirms model 2
and the accepted GraphView and Help schema identities. It does not register a
private formatting command or reimplement formatting. The existing E0 Core
continues to own candidate generation, complete semantic-fingerprint equality,
exact normalized edits, validation, idempotence, cancellation, and staleness.

`editor.formatOnSave` and the default formatter remain user-owned VS Code
settings. The extension neither contributes, enables, nor changes a setting.
When the user enables format-on-save, VS Code requests the same standard E0
formatting operation and applies the returned buffer edits.

## 2. Installed-host acceptance

The disposable gate packages the private VSIX, installs it into isolated
extension and profile directories, and runs the exact supported VS Code
`1.101.0` host under both trusted and untrusted workspace modes. Each host
proves:

- standard Format Document returns the exact Core-owned candidate;
- user-enabled format-on-save applies only the returned editor edit;
- repeated formatting is a no-op;
- a local UTF-8 BOM and CRLF document preserves its BOM, line endings, comment,
  and `Café Ω` Unicode text while canonicalizing formatter-owned spelling;
- an untitled virtual `.pert` document receives and applies the same standard
  edit without filesystem persistence;
- invalid input exposes no formatting edit;
- range formatting has no provider;
- the trusted and untrusted target files are independent, the tracked
  non-target plan remains byte-identical, and profile settings retain their
  original digest; and
- replacement and uninstall readback leave no installed extension in the
  disposable profile.

The earlier Core and LSP cases retain cancellation, rapid-edit staleness,
post-format invalidity, hard limits, malformed edit, exact UTF-16, and model-1
failure closure. The supported-host gate composes those accepted semantics
instead of duplicating them in the extension.

## 3. Closed capability and side-effect boundary

The active editor mutation surface is exactly `E0` whole-document formatting.
Range formatting, on-type formatting, rename, execute command, E1 repair, E2
recoverable edits, E3 authority-sensitive edits, and MCP mutation remain
unavailable. The extension has no direct filesystem, Git, CLI, network,
publication, governance, assurance, or advance owner. VS Code alone applies an
explicit Format Document or user-enabled save-time edit to the selected buffer.

The private identity remains
`perttool-private.perttool-vscode-private@0.0.0`; no persistent local VSIX
replacement, public VSIX identity, release selection, GitHub mutation, remote
write, publication, or plan advance is part of this acceptance.

## 4. Verification and plan boundary

The focused Core, LSP, VSIX shell, prior VSIX acceptance, and new E0 integration
suite passed 23 tests. The isolated VSIX package and supported-host gate passed
trusted and untrusted install, activation, formatting, DAG, Help, historical
read, replacement, and uninstall checks under VS Code `1.101.0`.

Implementation revision `a5729f73d41daf7cdcfe9b4263135df5f1813d0a`
records the private client, binding, host, fixture, tests, and README boundary.
The subsequent complete repository gate passed before any task-status write.
`EDITOR_FORMAT_ACCEPTANCE` plan completion, reached-milestone acceptance, and
its plan-assurance outcome remain distinct preview-first mutations. E1 through
E3, release, public VSIX publication, remote writes, Issue mutation, and plan
advance remain separate.
