# Adapter VS Code DAG View Implementation Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `VSIX_DAG_VIEW`
- Normative contract: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Machine cases: [../../test/fixtures/vsix-dag-view-cases-v1.json](../../test/fixtures/vsix-dag-view-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted implementation

The private `adapters/vscode` workspace now contributes the lazy
`perttool.dag` Explorer Webview and `perttool.showDag` command. The extension
requests only `perttool/graphView` for the active `.pert` document's exact URI
and version, validates the complete closed `Perttool.GraphViewResult.v1`, and
publishes no graph unless the result is current, complete, and bound to the
same editor version.

The implementation provides:

- `none`, `precedence`, `resource`, and `both` analysis modes without
  recalculating semantic values in the extension or Webview;
- deterministic declaration-order visual placement for milestones and edges;
- task state, precedence-critical, driving, and schedule-critical styling from
  the accepted LSP projection only;
- a same-order accessible text outline with exact numerator, denominator,
  display, and unit values;
- keyboard-operable entities, visible focus, theme/high-contrast tokens,
  reduced-motion behavior, and live status announcements;
- closed ready, mode-selection, and source-reveal messages;
- URI, generation, version, entity-kind, and entity-ID revalidation before
  revealing an existing LSP-owned selection range; and
- explicit graph clearing for loading, invalid, unavailable, stale, cancelled,
  closed-document, and incompatible-handshake states.

## 2. Security and side-effect boundary

The Webview enables scripts only for one generated local bundle and fixes a
per-render nonce under `default-src 'none'`. Its resource roots contain only
`dist/webview`; no inline/evaluated script, remote origin, iframe, worker,
workspace asset, or arbitrary Mermaid is accepted. Semantic strings enter the
DOM through `textContent` or button text only.

The extension and Webview contain no filesystem, Git, network, process,
workspace-command, configuration-write, source-edit, or task-execution path.
Workspace trust, document location, and Webview messages grant no perttool
authority. The public `perttool` package, Grammar 6, CLI Contract 7, 44
commands, 20 schemas, and root/Core/Node facades remain unchanged.

## 3. Executable evidence

The twelve dependency-ordered `VDV-001` through `VDV-012` cases cover the
manifest, complete result validation, binding, all four modes, fail-closed
states, layout, styling, navigation, messages, CSP, content safety,
accessibility, and side-effect closure. Tests pass all four real LSP
GraphView projections plus a current invalid-document projection through the
VSIX parser and reject open fields, bad digests, mixed modes, gate state, and
unknown messages.

The disposable VSIX inventory contains fourteen files: the client, bundled
server, bindings, source maps, language and TextMate files, and the generated
local DAG script and stylesheet. Its existing isolated bundled-server smoke
continues to pass. The complete repository gate passed in the completed-task
state, including root/LSP/VSIX/MCP type checks, all task-scope Node tests plus
the unrelated task-refinement tests in the shared dirty worktree, English and
documentation checks, all 34 self-use plans, isolated LSP and VSIX gates,
temporary npm linking, the 653-file public package, and isolated installed
Contract 7 and plan-assurance workflows. `git diff --check` also passed.

## 4. Lifecycle evidence

The assertion-free start preview was governance-not-applicable and was written
without `--accepted-by-owner`. The start event is
`WE-63b3bcf32301fec90e3180bfc216ad4b86149baac39a0696adb6b4306b63ccd0`
at `2026-08-05T20:33:00+09:00`.

The assertion-free finish preview was likewise governance-not-applicable and
was written without an owner assertion. The finish event is
`WE-330a1dfb80ee57a9ebdc9fafbc1702827eeebdc7f9b3b31bc806c4de872c20fd`
at `2026-08-05T20:43:00+09:00`. The source records exact `1/6h` active time
and `1/6ph` effort. The completed source digest is
`sha256:80d34add38f0365a292bb3620111087c62d1c2bec78be9bd9748de04ffc26cce`.

## 5. Remaining plan and authority

After completion, four tasks and 18p remain. The precedence makespan is 10p.
The `parallel-sgs` version 1 heuristic resource makespan is 18p with 8p
resource delay. Inherited `29p/2d` velocity produces `20/29d` and `36/29d`
forecasts.

The complete, non-truncated `Perttool.NextResult.v6` uses recommendation
interface 1 and authority policy
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1`. It recommends
and makes startable only `CLI_FACADE_PARITY`. `MCP_ACCEPTANCE` and
`VSIX_ACCEPTANCE` are ready but deferred by the current resource-feasible
selection.

Supported-host and uninstall acceptance, CLI parity, MCP acceptance,
cross-surface integration, release selection, publication, remote writes,
Issue mutation, and plan advance remain separate boundaries.
