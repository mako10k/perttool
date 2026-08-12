# DAG Compact Labels and Exact Time Summary Contract

- Document status: Accepted 1.0
- Date: 2026-08-07
- Backlog: `VSIX-DAG-PRESENT-001`
- Applies to: private bundled LSP and VSIX DAG presentation

## 1. Scope

This contract makes dense current and historical DAGs scannable without
changing source identity, graph semantics, analysis, or authority. It adds
deterministic compact display IDs, bidirectional graph/detail focus, exact
residual, remaining, and task-time summaries, and qualified Point conversion.

The contract is additive to the accepted
[DAG Presentation and Focus Contract](dag-presentation.md). It does not change
Grammar 6, CLI Contract 7, `Perttool.GraphViewResult.v1`, either historical
result, public package exports, command or schema catalogs, `.pert` bytes, Git,
or mutation authority.

## 2. Compact display identity

Current presentation allocates compact IDs in validated source declaration
order over the residual GraphView entities. Milestones use `M`, tasks use `T`,
and gates use `G`. Each namespace starts at one and uses at least two decimal
digits, widening deterministically when a namespace contains 100 or more
entities. Thus the first values are `M01`, `T01`, and `G01`.

Allocation is bound to the current URI, generation, version, and source digest
through `Perttool.DagFocusResult.v1`. Redrawing, fitting, zooming, panning, or
changing analysis mode does not change the mapping for the same residual
entities. Compact IDs are presentation references only and never replace a
source ID in a semantic request, navigation binding, or result.

Historical presentation allocates the same three namespaces independently for
the selected view. Within a namespace, occurrences are ordered by exact
`occurrence_id`, so two epochs of one source ID receive distinct compact IDs.
The mapping changes only when the bound historical result or selected view
changes; it does not imply identity across occurrences or continuity gaps.

## 3. Graph and detail navigation

The graph renders only compact IDs inside milestone nodes and task/gate edge
labels. Activating a graph label opens the accessible detail disclosure and
moves keyboard focus to the row with the same compact ID. The detail row
retains the original entity or occurrence ID, title, description when
declared, semantic status and exact values, and the existing verified source
action. It also provides a keyboard action that returns focus to the same
graph occurrence.

The current summary cards may show a compact ID with its title and exact task
time. They continue to use existing GraphView and NextResult authority; a
compact ID is never accepted as a source-navigation or task-authority input.

## 4. Exact time meanings

The Webview retains exact numerator, denominator, unit, and display values in
its bound result and exposes the unrounded value as a tooltip. Its primary
time presentation is intentionally compact: values of at least 24 hours use
days rounded to at most two decimal places (`1.34d`), shorter values use
minute-rounded `h:mm` (`1:23`), and Point values retain the `p` suffix. This
24-hour display convention is presentation-only and does not change analysis,
velocity, calendar, LSP, CLI, or JSON semantics.

The current private Application projection owns these meanings:

- `residualTime` is the precedence CPM makespan of the validated residual DAG;
- `remainingTime` is the `parallel-sgs` version 1 resource-schedule makespan of
  the same residual DAG and is not claimed to be optimal; and
- `taskTime` is an unfinished task's exact PERT expected duration in the
  declared project duration unit.

These values are distinct. Total float is not residual time, the sum of task
durations is not remaining time, and none of the three is silently labelled as
an absolute projected finish date. Numerator, denominator, unit, and bounded
decimal display remain together.

When the project duration unit is `point` and an exact declared velocity yields
a conversion, the projection also returns residual, remaining, and task-time
forecasts in the declared velocity period unit (`hour` or `day`). If velocity
is absent, conversion is explicitly `unavailable`; no workday length or binary
floating-point approximation is invented. Conversion is `not_applicable` for
a project already expressed in hours or days.

Historical residual and remaining values are displayed only from the selected
checkpoint's existing exact precedence and resource projections. The current
historical result does not carry checkpoint velocity or task expected values,
so historical Point conversion and task time are labelled unavailable instead
of being reconstructed in the Webview.

## 5. Protocol and trust boundary

The private `perttool/dagFocus` method retains protocol model 1 and
`Perttool.DagFocusResult.v1` because both remain unreleased local adapter
contracts in the same selected implementation slice. Its closed focus payload
now also contains `entities` and `timeSummary`. The server validates exact
keys, compact namespaces, unique source/compact identities, exact values, and
coherent Point-conversion states before returning a current result. The VSIX
revalidates the cloned result before presentation.

The Webview allocates only historical occurrence labels from an already
validated and sanitized historical result. It does not parse PERT, calculate
PERT expected values, subtract rational values, convert units, inspect
velocity, infer readiness, or invoke Git. Current time calculation and compact
source metadata remain in Application code; source navigation remains in the
extension host.

## 6. Side effects and distribution

The feature is read-only and bundled only in the private VSIX. It adds no root
production dependency or public package export. Installing a prior accepted
local VSIX is a separately recorded local-editor operation and does not publish
or select a release. This contract authorizes no remote write, npm or
Marketplace publication, source mutation, plan advance, or Issue mutation.

## 7. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `DCP-001` | Selection | `VSIX-DAG-PRESENT-001` is selected only for local read-only presentation |
| `DCP-002` | Current IDs | source-order `Mnn`, `Tnn`, and `Gnn` namespaces; redraw stable |
| `DCP-003` | Historical IDs | view-local occurrence-ID order; repeated source epochs stay distinct |
| `DCP-004` | Graph detail | compact graph label focuses same-ID detail with original ID/title/description |
| `DCP-005` | Return/navigation | detail returns to graph; source actions retain original exact bindings |
| `DCP-006` | Exact times | precedence residual, resource remaining, and PERT task time stay distinct |
| `DCP-007` | Point conversion | exact velocity conversion or explicit unavailable; no assumed workday |
| `DCP-008` | Historical limits | existing checkpoint values only; unavailable velocity/task time is labelled |
| `DCP-009` | Closed boundary | malformed, duplicate, stale, invalid, or incomplete focus fails closed |
| `DCP-010` | No write | private VSIX only; no source, Git, release, remote, or publication mutation |
