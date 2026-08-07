# DAG Presentation and Focus Contract

- Document status: Accepted 1.0
- Date: 2026-08-07
- Workstream: `DAG-UX-001`
- Applies to: private bundled LSP and VSIX DAG presentation

## 1. Scope

This contract makes the current and historical DAG useful without requiring a
user to configure a query before seeing the plan. It selects one deterministic
layout engine, adds bounded viewport navigation, and gives first-class visual
priority to the current milestone frontier, critical path, and exact tasks that
currently have start authority.

The change remains read-only. It does not change Grammar 6, CLI Contract 7,
`Perttool.GraphViewResult.v1`, either historical result, the public package
facades, command or schema catalogs, source bytes, Git state, editor state, or
task authority.

## 2. Layout engine

The private VSIX pins and bundles `@dagrejs/dagre` `3.1.0`. Dagre is selected
because its directed layered layout returns deterministic node positions,
edge routes, and label positions while leaving SVG rendering, navigation, and
accessibility under perttool control. It is used only on the already validated
current or historical topology.

The rejected alternatives are:

- Cytoscape.js plus a Dagre extension, which supplies a complete interactive
  graph renderer but adds a substantially broader rendering abstraction and
  package footprint than this Activity-on-Arrow view needs; and
- elkjs, which offers a larger layout portfolio but is a layout-only package
  with a materially larger bundle and unnecessary worker/configuration surface
  for this bounded DAG.

The Webview must not use Dagre, coordinates, edge crossings, or visual order to
derive reachability, readiness, criticality, scheduling, or start authority.

## 3. Default presentation

Opening the DAG shows the current synchronized document with analysis mode
`both`. The persistent top-level control is only the current/history scope.
Analysis selection is under `View options`.

Selecting history immediately issues the existing closed historical request
with these defaults:

- requested endpoint `HEAD`;
- no lower boundary;
- ancestry profile `first_parent`;
- view `lineage`;
- no explicit snapshot commit; and
- analysis mode `both`.

Endpoint, lower boundary, ancestry, view, snapshot commit, and manual reload
remain available under the collapsed `Advanced history query` disclosure. A
user does not need to open it for the default historical view.

## 4. Exact current focus

The private LSP separately negotiates DAG focus protocol model 1 and
`Perttool.DagFocusResult.v1`. Its read-only method is `perttool/dagFocus` and
accepts only the current open document URI and integer document version.

The result is bound to URI, open generation, version, and source digest. A
complete result contains:

- `frontierMilestoneIds`: topological-order reached milestones with an
  outgoing unfinished edge whose target is not reached, or the reached finish
  milestone when no such frontier remains;
- active and ready task IDs from `Perttool.NextResult.v6`;
- recommended task IDs from its recommendation result;
- startable task IDs only from
  `temporal.authority.startableRecommendedTaskIds`; and
- exact safe-stop reasons from the same authority.

The separately selected
[compact presentation contract](dag-compact-presentation.md) extends this same
unreleased private result with closed source-order display metadata and exact
time summaries. It does not change start-authority meaning.

The internal Application projection invokes the existing Contract 7 task
selection owner. The LSP and Webview do not reimplement that decision. Invalid,
truncated, stale, cancelled, incomplete, or unknown results fail closed and do
not highlight a task as startable.

## 5. Visual hierarchy

Four summary cards precede the graph: Current milestone, Critical path, Next
to start, and Exact time. Summary entity actions use exact current source
bindings. The critical-path card uses the existing GraphView precedence
representative path. The graph uses the same semantic identifiers for styles
while the selected compact presentation renders only presentation IDs:

- current frontier milestones have a distinct current outline;
- critical-path edges and milestones retain critical styling;
- ready edges have a readiness outline; and
- only exact startable task edges receive the stronger next-task treatment.

The default layout is left-to-right. Milestones are fixed-size labelled nodes;
tasks and gates remain labelled edges. Critical edges receive a greater Dagre
layout weight so the representative path stays visually coherent, without
changing semantic order or results. Retired historical occurrences remain
visibly retired.

## 6. Viewport and accessibility

The graph is inside a bounded native scroll viewport. It supports zoom out,
zoom in, fit, `Ctrl`/`Command` plus wheel zoom at the pointer, ordinary wheel
and scrollbar movement, blank-space pointer panning, and keyboard `+`, `-`,
and `0`. Scale is clamped from 30% through 250%. Fit never enlarges beyond
150%.

The accessible outline and diagnostics remain deterministic text and are
collapsed secondary disclosures. Every graph entity and summary identifier
retains keyboard source navigation. Status and zoom changes are announced,
focus is visible, reduced motion is respected, and current/critical/next
meaning is labelled rather than conveyed only through color.

## 7. Security, distribution, and side effects

Dagre and Graphlib are bundled into the immutable browser asset. The Webview
retains the existing restrictive CSP and performs no network, filesystem, Git,
workspace, CLI, parser, or Application call. It receives only closed cloned
results and sends only the existing version-bound navigation, selector, and
historical-query messages.

`@dagrejs/dagre` is a private VSIX development dependency. It does not become a
root production dependency or public package export. The packaged extension
includes the Dagre and Graphlib MIT notice. This work does not
publish a VSIX or package, select a release, change a remote, advance a plan,
or mutate an Issue.

## 8. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `DGP-001` | Engine | exact bundled Dagre 3.1.0; no Mermaid or Webview semantic analysis |
| `DGP-002` | Direction | deterministic left-to-right milestone and routed-edge layout |
| `DGP-003` | Defaults | current/both initially; one-step HEAD first-parent lineage history |
| `DGP-004` | Progressive disclosure | detailed history query and analysis controls are collapsed |
| `DGP-005` | Focus identity | separately negotiated model 1 and closed result identity |
| `DGP-006` | Binding | exact URI, generation, version, and digest; stale fails closed |
| `DGP-007` | Current frontier | reached unfinished boundary, or reached finish after completion |
| `DGP-008` | Next authority | exact NextResult v6 startable IDs and safe-stop reasons only |
| `DGP-009` | CP | existing current or historical single-checkpoint analysis only |
| `DGP-010` | Navigation | zoom, fit, native scroll, pan, and keyboard controls are bounded |
| `DGP-011` | Accessibility/security | labelled focus, text outline, escaped content, restrictive CSP |
| `DGP-012` | Distribution/no write | private bundle, zero root production dependencies, no mutation |
