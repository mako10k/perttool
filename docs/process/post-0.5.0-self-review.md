# Post-0.5.0 Consistency, Symmetry, and Completeness Review

- Document status: Complete 1.0
- Review date: 2026-07-29
- Baseline branch: `main`
- Baseline commit: `7ca094e89297476fafad427b6cffa46a761d0af4`
- Scope: current repository state, active CLI Contract 6, local backlog, and
  live GitHub Issues #1 through #5

## 1. Decision

The accepted `0.5.0` implementation remains internally coherent enough to
retain its release acceptance. No new runtime defect was found in the command,
entity-mutation, or lifecycle surfaces.

The review found five durable inventory findings:

1. current-state prose lagged completed release and scheduling state;
2. Issues #1 and #4 remained open after their repository acceptance evidence
   became complete, without a recorded disposition;
3. active result schema identifiers had no machine-readable JSON Schema
   artifacts;
4. Issue #4 lacked the documentation and enhancement labels used by the
   related design Issues; and
5. several named future workstreams had no individually addressable local
   backlog item.

Every finding is either corrected in the review change or mapped to a GitHub
Issue and local backlog ID. No Issue is closed by this review. Issue closure,
npm dist-tag changes, release publication, and new implementation remain
separate authorization boundaries.

## 2. Closed-world review inventory

The command inventory was derived from:

```sh
node dist/cli.js help --format json
```

The result was a complete `Perttool.CommandHelpResult.v1` for CLI Contract 6
with 33 descriptors:

- root reads: `help`, `guide`, and `agent help`;
- document operations: `document check` and `document format`;
- project operations: `project init`, `show`, `history`,
  `observe-velocity`, `set`, and `migrate-unit`;
- DAG operations: `dag analyze`, `next`, `advance`, `render`, and `import`;
- task maintenance: `task add`, `set`, and `remove`;
- task lifecycle: `task start`, `suspend`, `resume`, and `finish`;
- symmetric `add`, `set`, and `remove` operations for gates, milestones, and
  resources; and
- `batch apply`.

The descriptors referenced 16 unique result identities, including
`Perttool.CliError.v1`. Repository file inventory found no tracked or bundled
JSON Schema artifact that resolves those identities.

The review also covered:

- Must requirements, normative interface and project-actuals specifications,
  the basic design, current process records, and all local backlog headings;
- all twenty-one self-use `.pert` paths without changing their completed
  state;
- the `AGENTS.md` and GitHub Copilot current-state summaries; and
- live GitHub Issue number, title, state, labels, and existing comments.

Historical acceptance records and completed PERT snapshots were treated as
historical evidence, not current-state documents to be rewritten.

## 3. Consistency review

| Finding | Evidence | Disposition |
| --- | --- | --- |
| `SR-001` Current-state drift | `ACT-001`, `TIME-001`, `UNIT-001`, the `0.5.0` release summary, project map, validation summary, requirements current state, and Copilot summary retained pre-completion wording. | Corrected current-state prose in this change. `META-001` owns recurrence detection. |
| `SR-002` Issue lifecycle drift | Issues #1 and #4 were live and open while their scoped repository design/implementation acceptance evidence was complete. Their closure boundaries were not equivalent to implementation completion. | Keep both open, add inventory comments, and route recurring review through `META-001`. Closure remains a separate explicit decision. |

The review did not alter past acceptance observations such as the state at the
`RELEASE_050_PUBLISH` snapshot. Where a current summary included an
intermediate value, it was qualified as a snapshot instead of erased.

## 4. Symmetry review

| Surface | Result |
| --- | --- |
| Entity maintenance | Gates, milestones, and resources expose symmetric `add`, `set`, and `remove` descriptors. Tasks expose the same maintenance set plus lifecycle operations. |
| Lifecycle | `start`, `suspend`, `resume`, and `finish` are present and share the governed preview/write result. A reverse transition is deliberately absent; the undecided REOPEN request remains `ACT-002`. |
| Project operations | Project is intentionally file-first and singleton-scoped, so `init`, `show`, and `set` are not required to mirror entity CRUD. History, observation, and unit migration remain typed project operations. |
| Result discovery | Every descriptor declares result schema identities. No matching machine-readable JSON Schema artifact exists, breaking the intended identity-to-artifact symmetry. |
| Issue metadata | Issues #1 through #3 used documentation/enhancement classification where applicable; Issue #4 had no labels at the review read. |

`SR-003` is filed as
[Issue #5](https://github.com/mako10k/perttool/issues/5) and mapped locally to
`SCHEMA-001`. `SR-004` requires adding the `documentation` and `enhancement`
labels to Issue #4; `META-001` owns future metadata drift checks.

## 5. Completeness review

The review used a close-world list of active commands, active result
identities, live GitHub Issues, named post-beta concepts, and current PERT
workstreams.

`SR-005` found that MIG-08, the Issue #3 multi-plan concept, and the LSP, VSIX,
and MCP adapters were named only in summary prose. This change adds
individually addressable `MIG-08`, `MULTI-001`, `LSP-001`, `VSIX-001`, and
`MCP-001` backlog entries. It also adds `META-001` for inventory alignment and
`SCHEMA-001` for Issue #5.

The review found no untracked lifecycle omission: REOPEN is already
`ACT-002`, with feasibility and semantics intentionally undecided. It found no
authority to promote npm `latest`, close Issue #4, implement MIG-08, add a
language adapter, or mutate a completed PERT plan.

## 6. GitHub Issue inventory

Issue closure remains a separate explicit decision.

| Issue | Live state at review | Repository mapping | Disposition |
| --- | --- | --- | --- |
| [#1](https://github.com/mako10k/perttool/issues/1) AI Project Control Plane design | Open; `documentation`, `enhancement`; no comment | MIG-01 through MIG-07 are accepted; `MIG-08` is independent and unscheduled. | Retain open and add a status comment. Closure requires an explicit decision. |
| [#2](https://github.com/mako10k/perttool/issues/2) AI Agent Guidance Registry | Closed; `documentation`, `enhancement`; acceptance comment present | Accepted registry v1 and completed plan. | No action; state and repository evidence align. |
| [#3](https://github.com/mako10k/perttool/issues/3) backlog hierarchy and multi-plan composition | Open; `documentation`, `enhancement`; no comment | `MULTI-001`, not selected. | Retain open and add a status comment. |
| [#4](https://github.com/mako10k/perttool/issues/4) owner-aware governance | Open; no labels; no comment | Governance plan, implementation, acceptance, and releases are complete. | Add `documentation` and `enhancement`, retain open, and add a status comment. Closure requires an explicit decision. |
| [#5](https://github.com/mako10k/perttool/issues/5) Contract 6 JSON Schemas | Open; `bug`, `documentation` | `SCHEMA-001`, not scheduled. | Retain open as the authoritative implementation gap. |

External Issue comments and label updates are performed after this review
record is committed and pushed so they can cite its durable commit. Their
readback is operational evidence; it does not change the repository finding
or authorize Issue closure.

## 7. Finding disposition

| Finding | Severity | Durable owner | Closed by this review |
| --- | --- | --- | --- |
| `SR-001` stale current-state prose | Documentation consistency | `META-001` | Yes, current prose corrected |
| `SR-002` open-Issue disposition missing | Process consistency | `META-001`; Issues #1 and #4 | Yes, inventory and comment action recorded; Issues remain open |
| `SR-003` JSON Schema artifacts absent | Must requirement / public contract | Issue #5; `SCHEMA-001` | No |
| `SR-004` Issue #4 labels absent | External metadata symmetry | `META-001`; Issue #4 | Yes after verified label update |
| `SR-005` future work only in summary prose | Backlog completeness | `MIG-08`, `MULTI-001`, `LSP-001`, `VSIX-001`, `MCP-001` | Yes |

## 8. Verification and non-effects

The acceptance gate for this record is:

```sh
node --test test/post-0.5.0-self-review.test.mjs
npm run check:english
npm run check:docs
npm run check
git diff --check
```

The gate passed on local Node.js `v25.1.0`: type checking, all 646 repository
tests, the exact English baseline, 101 Markdown and 7 normative PERT document
checks, read-only check/analyze/next for all 21 self-use plans, temporary-link
acceptance, and the 468-file isolated package workflow all succeeded.

This review makes no runtime code change, `.pert` mutation, Issue closure, Git
history rewrite, package publication, npm dist-tag change, or production
cutover.
