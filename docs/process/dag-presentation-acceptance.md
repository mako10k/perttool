# DAG Presentation and Focus Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-07
- Workstream: `DAG-UX-001`
- Contract: [../specs/dag-presentation.md](../specs/dag-presentation.md)
- Machine cases: [../../test/fixtures/dag-presentation-cases-v1.json](../../test/fixtures/dag-presentation-cases-v1.json)

## 1. Accepted implementation

The private VSIX replaces its square-grid and straight-line renderer with the
exact bundled `@dagrejs/dagre` `3.1.0` layered layout. Current and historical
milestone occurrences are laid out left-to-right, parallel task and gate edges
retain unique routes and labels, and the existing immutable source-navigation
bindings remain attached to the rendered entities.

The viewport provides native scrolling, blank-space pointer panning, 30%
through 250% bounded zoom, 150%-bounded fit, pointer-centered modifier-wheel
zoom, buttons, and keyboard controls. The accessible text outline and
diagnostics remain available as secondary disclosures.

The default interface exposes only current/history scope at the top level.
Current loads `both` analysis. Selecting history immediately loads `HEAD`, no
lower bound, `first_parent`, `lineage`, no explicit snapshot, and `both`.
Analysis selection and the complete historical query remain available under
collapsed disclosures.

## 2. Semantic focus boundary

The internal `inspectEditorDagFocus` Application projection reuses the exact
Contract 7 `selectNextTasks` owner. It returns the reached unfinished milestone
frontier, active, ready, recommended, exact startable task IDs, and safe-stop
reasons. A complete finished plan returns its reached finish milestone and no
startable task.

The bundled LSP separately negotiates DAG focus model 1 and
`Perttool.DagFocusResult.v1`, exposes `perttool/dagFocus`, and binds every
result to the open URI, generation, version, and source digest. Invalid,
truncated, stale, cancelled, unavailable, malformed, or unnegotiated focus
fails closed. `Perttool.GraphViewResult.v1` and both historical result
identities remain unchanged. The Webview receives the cloned focus result and
does not import or invoke task selection, graph semantics, PERT analysis, Git,
or a CLI.

The later selected `VSIX-DAG-PRESENT-001` slice extends this unreleased private
focus payload with compact source metadata and exact time summaries. Its
separate acceptance record owns those additional fields and graph/detail
navigation without changing the authority accepted here.

## 3. Verification

`DGP-001` through `DGP-012` are dependency ordered and close engine identity,
layout, defaults, progressive disclosure, protocol negotiation, binding,
frontier meaning, NextResult v6 authority, CP ownership, viewport controls,
accessibility, CSP, private distribution, and no-write behavior.

Focused tests prove the minimal plan highlights `NOW` and exact startable task
`WORK`, while the completed historical-DAG plan highlights reached finish
`HISTORICAL_DAG_ACCEPTED` and no task. LSP tests cover exact negotiation,
closed parsing, invalid source, stale version, and method-unavailable behavior.
Existing GraphView, historical LSP/VSIX, adapter integration, Core dependency,
source-navigation, CSP, and supported-host tests remain part of the gate.

The complete gate is run under Node.js 22 so npm scripts and child processes
inherit the selected runtime:

```sh
source /home/katsumata-m/.nvm/nvm.sh
nvm exec 22.22.3 npm run check
git diff --check
```

At acceptance, the gate passes 967 tests, 782 checked text files, 213 Markdown
files, 7 PERT examples, all 35 self-use plans, the isolated
LSP and MCP packages, minimum VS Code 1.101.0 trusted and untrusted host cases,
temporary linking, and the isolated public-package workflow. Root and Node
remain 122-name facades, Core remains 45 names, the CLI remains 45 commands and
21 schemas, and the root retains zero production dependencies. The private
VSIX alone owns the pinned Dagre development dependency; its browser bundle
contains the engine in a sixteen-file VSIX with no `node_modules` directory.
Its packaged third-party notice retains the Dagre and Graphlib MIT terms. The
isolated public package contains 679 files and is 6.3 MB unpacked.

## 4. Side-effect and release boundary

Verification uses only disposable package, extension, profile, and workspace
directories and preserves tracked workspace bytes outside this implementation.
No source or Git mutation is available through the UI. No VSIX or npm package
was published, no tag or remote was changed, no plan was advanced, and no Issue
was mutated. Release selection and public extension identity remain separate.
