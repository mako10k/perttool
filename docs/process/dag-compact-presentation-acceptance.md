# DAG Compact Presentation Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-07
- Backlog: `VSIX-DAG-PRESENT-001`
- Contract: [../specs/dag-compact-presentation.md](../specs/dag-compact-presentation.md)
- Machine cases: [../../test/fixtures/dag-compact-presentation-cases-v1.json](../../test/fixtures/dag-compact-presentation-cases-v1.json)

## 1. Predecessor local installation

Before this item was selected, the current `DAG-UX-001` source was packaged as
the exact 18-file local artifact
`.perttool/vsix/perttool-vscode-private-0.0.0-dag-ux-current.vsix`, 2,168,268
bytes, with SHA-256
`5dff03a7438121a6090ed7610789066c97597618459e3bb9e46d4519d3aaac8e`.
It was installed exactly once with:

```sh
code --install-extension \
  /home/katsumata-m/perttool/.perttool/vsix/perttool-vscode-private-0.0.0-dag-ux-current.vsix \
  --force
```

Readback reports `perttool-private.perttool-vscode-private@0.0.0`. Installed
extension, bindings, Webview, CSS, bundled server, and third-party-notice bytes
match the VSIX entries by SHA-256. VS Code adds installation metadata to its
managed `package.json`, so that file is not claimed byte-identical. The
predecessor artifact intentionally did not contain the later compact-label
implementation accepted below.

After acceptance, the user separately authorized installation of the compact
implementation. The current source was rebuilt and packaged as the exact
18-file local artifact
`.perttool/vsix/perttool-vscode-private-0.0.0-dag-compact-current.vsix`,
2,188,896 bytes with SHA-256
`ac10f4dfe00d1154d282fb737b117a85fcaf7e23b6d2b412e4f7299bd8a812e6`.
The following command was executed exactly once:

```sh
code --install-extension \
  /home/katsumata-m/perttool/.perttool/vsix/perttool-vscode-private-0.0.0-dag-compact-current.vsix \
  --force
```

The command reported successful installation. Readback again reports
`perttool-private.perttool-vscode-private@0.0.0`; the installed extension,
bindings, bundled server, Webview JavaScript, and Webview CSS are byte-identical
to the corresponding compact VSIX entries. Installed markers include
`compactId`, `allocateHistoricalCompactIds`, and `timeSummary`.

## 2. Accepted implementation

The private current focus Application now allocates source-order compact
milestone, task, and gate IDs and projects original ID, title, description,
exact precedence residual makespan, resource remaining makespan, per-task PERT
expected duration, and exact velocity-qualified Point forecasts. The closed
LSP and VSIX parsers reject malformed entities, duplicate identities,
incoherent conversion states, and incomplete results.

The graph renders only compact IDs. Activating one opens and focuses its
same-ID accessible detail row; the row retains original identity and exact
facts, opens the existing verified source binding, and returns focus to the
same graph occurrence. Historical compact IDs are allocated independently by
view and occurrence ID, so repeated source epochs remain distinct. Missing
historical task time or velocity is labelled unavailable.

## 3. Verification

`DCP-001` through `DCP-010` trace selection, current and historical identity,
bidirectional focus, exact time semantics, Point conversion, historical limits,
closed validation, and the no-write boundary. Focused tests exercise day and
Point plans, exact rational forecasts, duplicate fail-closure, current and
historical compact-label source, accessible detail links, and unchanged
source-navigation messages.

The complete repository gate is run under Node.js 22.22.3 and includes the
full tests, English and Markdown checks, all self-use plans, isolated LSP/MCP,
minimum supported VS Code host cases, temporary linking, and isolated public
package verification. `git diff --check` is also required.

At acceptance, the complete gate passes 972 tests, 786 checked text files, 215
Markdown files, 7 PERT examples, all 35 self-use plans, isolated LSP and MCP,
the minimum VS Code 1.101.0 trusted and untrusted host workflows, temporary
linking, npm publication dry-run, and the 679-file isolated public package.
The private VSIX inventory remains sixteen extension files plus the two VSIX
container metadata entries; the root package retains zero production
dependencies.

## 4. Side-effect and release boundary

The predecessor installation and the separately authorized compact replacement
above are the only editor-profile mutations. Neither operation changes `.pert`
bytes, a Git object, ref, index, remote, npm, Marketplace, Open VSX, or Issue
state. Release selection, publication, commit, push, and plan advance remain
separate.
