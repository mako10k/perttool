# Issue #8 Current Velocity Observation Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-08-13
- Backlog: [`ACT-003`](../backlog.md#act-003-observe-current-declared-actuals-before-commit)
- External report: [GitHub Issue #8](https://github.com/mako10k/perttool/issues/8)
- Release status: Selected for `0.9.1`

## 1. Accepted correction

The active `project observe-velocity` command now treats its two evidence
classes as separate source bindings:

| Evidence request | Declared candidates | Git-recorded candidate | Envelope `source_digest` | `history.source_digest` |
| --- | --- | --- | --- | --- |
| `declared` | Exact current operand | Absent | Current operand | Selected revision |
| `git-recorded` | Absent | Selected first-parent revision | Selected revision | Selected revision |
| `all` | Exact current operand | Selected first-parent revision | Current operand | Selected revision |

The current operand is captured before Git inspection. Its digest is passed
to the existing Git probe so a change before or during inspection produces the
existing fail-closed target-race result. The command remains read-only.

## 2. Implementation boundary

One private Application helper reduces current declared actuals through the
established pure history reducer and removes synthetic commit provenance
before candidate composition. The target observation layer composes declared
and recorded candidates without changing the public `observeProjectVelocity`
Core. The CLI reads current bytes only for `declared` and `all`; the
`git-recorded` route retains its prior revision-bound flow.

The correction does not change Grammar 7, CLI Contract 8, command spelling,
`Perttool.VelocityObservationResult.v1`, its JSON Schema, `project history`,
the public root/Core/Node facades, adapter capabilities, or automatic velocity
adoption.

## 3. Acceptance evidence

The real-CLI regression creates a temporary Git repository, commits an active
task with a start event, writes an eventful finish through `task finish
--write`, and leaves that finish uncommitted. It proves that:

- `declared` returns an available exact 4p/8h sample from the current bytes;
- the top and nested history digests differ and match their exact inputs;
- `git-recorded` does not acquire the uncommitted finish;
- `all` returns the current declared candidate and revision-bound recorded
  candidate separately; and
- all observations preserve plan bytes and `HEAD`.

Focused TypeScript, observation, real-Git history/probe, CLI-facade, Guide,
and design tests pass under Node.js 22. The complete Node.js 22 repository gate
then passed 1,044 tests, the 861-file English baseline, 251 Markdown files, 38
self-use plans, isolated LSP and MCP packages, the supported VS Code 1.101.0
VSIX host gate, temporary npm linking, and the 713-file isolated public-package
workflow. The package gate retained Contract 8, 53 commands, 23 schemas, and
the unchanged public facade counts.

## 4. Remaining boundaries

The separately accepted [`0.9.1` release procedure](0.9.1-release.md) now
authorizes the ordered release and Issue #8 completion workflow. npm `latest`
promotion, plan advance, and unrelated backlog work remain separate.
