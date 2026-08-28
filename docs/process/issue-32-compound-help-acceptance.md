# Issue #32 Compound Command Help Acceptance

Document status: Accepted 1.0; owner-confirmed assurance outcome registered  
Acceptance date: 2026-08-26  
Implementation scope: local source and package candidate only

## 1. Candidate boundary

Issue #32 corrects the active Contract 10 Help lookup for compound commands.
The natural `perttool help <resource> <group> <action>` form resolves every
active three-segment path. A known incomplete prefix remains a failed lookup
and returns `PTHLP-003` with its exact sorted next path segments in both the
human message and JSON `data.available_child_actions`.

The current compound surface is closed to these nine paths:

- `milestone acceptance replace`
- `milestone acceptance verify`
- `milestone acceptance fail`
- `milestone acceptance unavailable`
- `milestone acceptance revoke`
- `milestone acceptance waive`
- `milestone acceptance show`
- `work reshape preflight`
- `work reshape apply`

Resource-only lookup, exact direct-action lookup, ordinary unknown-action
diagnostics, and the legacy structured-call form that supplies the compound
action as one argument remain compatible. Grammar 9, CLI Contract 10, the 71
commands, 29 root schemas, 139 root and Node exports, 51 portable Core exports,
package version `0.10.5`, and all mutation authority remain unchanged.

## 2. Evidence

- **E-HELP-001:** Live GitHub Issue #32 requires the natural three-segment
  lookup, preservation of resource-only and direct-action Help, child-action
  diagnosis for incomplete compounds, human and JSON tests, and review of
  every compound path.
- **E-HELP-002:** Direct CLI reproduction established that natural and legacy
  lookup already resolved exact compound commands, while `help work reshape`
  and `help milestone acceptance` returned only a generic unknown-action
  diagnostic without available children.
- **E-HELP-003:** The active Contract 10 registry contains exactly nine
  three-segment paths in two compound groups; there is no additional compound
  dispatch path outside that registry.
- **E-HELP-004:** `src/command/contract10-discovery.ts` derives exact next
  segments from the active registry only after exact lookup fails. It retains
  `PTHLP-003`, empty resource and command selections on failure, and the prior
  ordinary unknown-action branch.
- **E-HELP-005:** `test/issue-32-compound-help.test.mjs` covers all nine paths
  in natural JSON, legacy JSON, and natural human form; both incomplete groups;
  resource-only and direct-action lookup; ordinary unknown lookup; strict
  `Perttool.CommandHelpResult.v1` validation; and the read-only, no-file-effect
  Help descriptor.
- **E-HELP-006:** The 23-test focused Help, registry, usage, and Issue #32 gate
  passed with zero failure, cancellation, skip, or todo. TypeScript, the pinned
  147-clone / 2,743-line jscpd ratchet, the 5,135-function / 168-legacy-entry
  Lizard ratchet, the 1,295-file English baseline, 367-file documentation gate,
  seven PERT examples, and `git diff --check` also passed.
- **E-HELP-007:** The isolated 1,019-file `perttool@0.10.5` package passed its
  dry-run publication route, installation gate, natural compound lookup, and
  exact incomplete-prefix JSON child-action readback.
- **E-HELP-008:** `TMPDIR=/tmp npm run check` passed the complete repository
  gate on 2026-08-26: 1,327 tests, 1,296 English-baseline text files, 368
  Markdown files, seven PERT examples, 45 self-use plans, the static ratchets,
  isolated LSP/MCP/VSIX and supported VS Code 1.101.0 gates, npm link, and the
  1,019-file installed package all passed. An initial unqualified run selected
  the Windows temporary filesystem and failed only the three chmod-sensitive
  write-safety mode assertions; direct reproduction and the clean Linux
  `/tmp` rerun established that environment cause without a code change.
- **E-HELP-009:** The task finish candidate was previewed and written once
  with actor `codex`, event `EV_POOL_COMPOUND_HELP_FINISH_001`, finish time
  `2026-08-26T20:10:09+09:00`, and exact active time and effort of
  `229/720h` and `229/720ph`. Original digest
  `sha256:2761776e8ffeee2635aeb0d8c7162abe16ff991971f2e8612fcd3be0a55bcc72`
  changed to
  `sha256:cf58462110f1dedadf6f5c111178f2a344b5e3d63bf01ba7b526e0bc0aaecfe8`.
  Readback shows the matching start and finish pair and only the expected
  missing-outcome assurance cause.
- **E-HELP-010:** The exact assertion-free conformant outcome preview has
  candidate digest
  `sha256:63e6cdd3e4044d10206f66e263d0b5abd4e6ac472f182ad1794343ab4517a59c`,
  accepted and computed basis
  `sha256:cce44b0aa0b042d60a41035e39f9cb4c4b3489348c9f4f307f62f402503c1c8d`,
  reason `Accepted compound command Help and complete nine-path regression`,
  affected scope `plan_assurance`, required owner `user`, and
  `write_authorized: false`. Its projected after-state has complete assurance
  with no unavailable task, direct or inherited mismatch, or replan.
- **E-HELP-011:** A read-only independent Subagent returned
  `ACCEPT_WITH_NOTES` with no P0, P1, or P2 finding after checking the live
  Issue, all nine compound paths, incomplete-prefix behavior, compatibility,
  read-only authority, start/finish evidence, package assertion, and exact
  assertion-free outcome. Its one nonblocking P3 notes that lexical child
  order renders `apply, preflight`, which a nontechnical reader could mistake
  for execution order. The result is explicitly a choice list, and reshape
  apply still requires a bound preflight token; no semantic or authority defect
  was found. The reviewer changed no file, PERT, Git, GitHub, npm, or external
  state.
- **E-HELP-012:** The user separately confirmed the exact reviewed outcome
  candidate. It was written once with actor `codex`, the candidate-bound owner
  assertion `user`, original digest
  `sha256:cf58462110f1dedadf6f5c111178f2a344b5e3d63bf01ba7b526e0bc0aaecfe8`,
  and final digest
  `sha256:63e6cdd3e4044d10206f66e263d0b5abd4e6ac472f182ad1794343ab4517a59c`.
  Readback reports `POOL_COMPOUND_HELP` as verified and conformant with
  accepted, computed, and exported basis
  `sha256:cce44b0aa0b042d60a41035e39f9cb4c4b3489348c9f4f307f62f402503c1c8d`,
  complete assurance, and no unavailable task, mismatch, replan, active
  attention, or required action.

## 3. Claims and reasoning

- **C-HELP-001 `high`, candidate:** A human can copy a three-segment command
  path directly into `perttool help` without shell-specific quoting.
  References: E-HELP-001 through E-HELP-005.
- **C-HELP-002 `high`, candidate:** An incomplete known compound prefix now
  gives the next valid choices without treating the prefix as a successful
  command or inventing a command outside the registry. References: E-HELP-001,
  E-HELP-003 through E-HELP-005.
- **C-HELP-003 `high`, candidate:** The correction preserves current discovery
  compatibility and adds no command, schema, file effect, mutation, governance,
  release, or execution authority. References: E-HELP-003 through E-HELP-007.

## 4. Actions

- **A-HELP-001 `implementation permitted`, executed:** derive and project
  sorted child actions for a known incomplete Contract 10 prefix. Reference:
  C-HELP-002.
- **A-HELP-002 `implementation permitted`, executed:** add all-path human and
  JSON regression, strict schema validation, installed-package readback, and
  aligned user documentation. References: C-HELP-001 through C-HELP-003.
- **A-HELP-003 `implementation prohibited`, not executed:** do not add a group
  pseudo-command, partial-success result, write option, new catalog identity,
  or mutation authority. References: C-HELP-002, C-HELP-003.

## 5. Independent review disposition

The independent review reproduced source digest
`sha256:cf58462110f1dedadf6f5c111178f2a344b5e3d63bf01ba7b526e0bc0aaecfe8`,
candidate digest
`sha256:63e6cdd3e4044d10206f66e263d0b5abd4e6ac472f182ad1794343ab4517a59c`,
and accepted, computed, and exported basis
`sha256:cce44b0aa0b042d60a41035e39f9cb4c4b3489348c9f4f307f62f402503c1c8d`.
It confirmed `plan_assurance`, required owner `user`, no owner assertion,
`write_authorized: false`, and a projected after-state with zero unavailable
task, mismatch, replan, active-attention requirement, or required action.

The reviewer reran the three focused Issue tests and inspected the installed-
package assertion rather than repeating the parent's complete gate. The
lexical choice-list ordering note is retained as P3 and does not authorize a
separate behavioral or Issue mutation in this slice.

## 6. Retained boundaries

The complete repository gate, PERT task finish, independent review, owner
confirmation, and exact outcome write are complete. This acceptance does not
authorize or perform a commit, push, Issue mutation, release selection, tag,
GitHub Release, npm publication or dist-tag movement, Planning Pool plan
advance, or a successor-task start.
