# E1 Editor Repair WIP Handoff (2026-08-14)

## Current boundary

Work stopped after the exact current-source CLI was installed locally, the E1
editor repair activation gap was diagnosed with llmthink, the bounded Core,
Application, LSP, and supported-host implementation was accepted, and
`EDITOR_REPAIR_ACCEPTANCE` was marked done with one expected-digest
status-only write. The implementation and plan status are committed. Do not
start E2 merely because it is structurally ready: the E1 milestone criterion,
receipt, and task outcome remain three separate preview-first,
candidate-bound confirmation boundaries.

The working branch is
`wip/declaration-identity-release-20260806`. The implementation/status base
before this handoff record is
`4c504b7971fe0942ec1faf4b2059e00084919882`. Before publication of this
record, the remote branch was
`7e982e30b6dfb2a298c670d14637dc8ef8c9766f`, so the local branch contained
the following two unpublished commits:

- `58ed7a6` — `Implement E1 editor repair actions`; and
- `4c504b7` — `Complete E1 editor repair task status`.

Release selection, npm or VSIX publication, another local VSIX replacement,
GitHub Issue mutation, and plan advance were not performed by this closeout.

## Completed implementation

The finalized
[llmthink RCA](process/editor-repair-acceptance-rca.think) identified a
deliberate activation gap after contract acceptance. The existing unit
migration could already produce exact point-unit candidates, but the editor
had no E1 whole-candidate evaluator, Application composition, or edit-bearing
LSP mapping.

Commit `58ed7a6` closes only that gap:

- `src/editor/repair.ts` implements the closed
  `duration_unit_to_point` registry-v1 evaluator with complete unsealed
  before/after assurance, exact forward and inverse bytes, declaration and
  relation identity preservation, protected-record refusal, and parent hard
  limits;
- `src/application/editor-repair.ts` composes the existing Contract 8 check,
  Grammar 6/7 unit migration, assurance, and protected-evidence services;
- the private model-2 LSP exposes only a preferred Quick Fix and atomic
  `source.fixAll.perttool`, validates the complete returned binding and
  candidate again, and fails closed on cancellation, staleness, malformed
  output, or ineligible state; and
- the disposable VSIX host gate proves exact application and Undo under
  trusted and untrusted VS Code `1.101.0` workspaces without a direct file
  write.

Model 1, E0 formatting, Grammar 7, CLI Contract 8, 53 commands, 23 root
schemas, 129 root and Node exports, 45 Core exports, package version `0.9.4`,
MCP behavior, and public distribution identity are unchanged. The complete
technical record is
[E1 Editor Repair Acceptance](process/editor-repair-acceptance.md).

## Verified gates

Before the status write, the complete repository gate passed:

- 1,098 tests;
- English-baseline validation over 934 files with three allowlisted lines;
- documentation validation over 289 Markdown files and seven PERT examples;
- read-only self-use over 43 plans;
- isolated LSP and MCP packages, supported-host VSIX, temporary link, and the
  725-file public-package workflow; and
- `git diff --check`.

The pinned source static analysis also passed without increasing an allowance:

- jscpd `5.0.15`: 148 clones, 2,746 duplicated lines, 3.311 percent; and
- Lizard `1.23.0`: 3,571 functions and 170 retained legacy entries.

After the status write and documentation synchronization, the focused eight
E1 tests, documentation check, English baseline, static-analysis contract,
43-plan self-use, plan readback, and `git diff --check` passed again.

## Local development environment

The closeout environment used Node.js `v25.1.0` and npm `11.19.0`. The global
CLI resolves to:

```text
/home/katsumata-m/.nvm/versions/node/v25.1.0/bin/perttool
perttool 0.9.4
```

That CLI was packed and installed before E1 implementation, from source
revision `7e982e30b6dfb2a298c670d14637dc8ef8c9766f`. Its 717-file tarball was
2,818,514 bytes with SHA-256
`53b2f2b33d19035c6dd1728a49fa4b97fd4df14c35629bdc2e69ff102ce5c2f0`.
It can read the current Grammar 7 plan, but it is not byte-identical to the
post-E1 branch HEAD. Pack and reinstall the resumed HEAD before testing the
installed form of the new private adapter behavior.

The repository deliberately ignores reproducible or local-only artifacts:

- root and adapter `dist` directories;
- root and adapter `node_modules` directories;
- `.perttool/vsix/*.vsix`, whose accepted identities are already recorded in
  the corresponding process evidence; and
- `.perttool/advance-history-plan-batch.json`, an already applied historical
  batch whose semantic result is retained in the tracked plan and Git history.

These generated artifacts contain no unique current E1 source change and were
not force-added. No `.env`, private key, credential file, or tracked common
token pattern was found. This record contains secret names or values neither
directly nor by copy.

## Exact plan state

The status-only write changed
[the editor plan](../plans/editor-mutations.pert) from source digest
`sha256:fac511d01ca7bcb632203fb1e255723a82f19043cb3731a7e92f71d55987af00`
to
`sha256:bb9fd570b828c0dd9643e2739434d9963ea4c202710eed685a2d16115704d3b4`.
Only `EDITOR_REPAIR_ACCEPTANCE` gained `status done`.

Current readback is deliberately incomplete at the evidence boundary:

- `EDITOR_REPAIR_ACCEPTED` closure is `reached`;
- milestone acceptance is `not_declared`;
- `EDITOR_REPAIR_ACCEPTANCE` outcome is missing and unavailable;
- seven task assurance results are unavailable; and
- the required action is `restore_assurance_evidence` rooted at
  `EDITOR_REPAIR_ACCEPTANCE`.

`dag next` therefore shows two different facts that must not be conflated.
`EDITOR_RECOVERABLE_CONTRACT` is structurally ready and recommended, but a
start preview while E1 evidence is missing adds `PTASSURE-204` active
attention. The execution frontier is the E1 evidence sequence, not E2.

## Resume procedure

Use Node.js 22 or later from the repository root. First establish the exact
remote and local identity and rebuild generated outputs:

```sh
git fetch origin
git status --short --branch
git rev-parse HEAD
git rev-parse origin/wip/declaration-identity-release-20260806
npm ci
npm run build
```

Then read the tracked evidence and recheck the live boundary:

```sh
sed -n '1,220p' docs/process/editor-repair-acceptance.md
sed -n '1,220p' docs/process/editor-repair-acceptance-rca.think
node dist/cli.js document check plans/editor-mutations.pert --format json
node dist/cli.js milestone acceptance show plans/editor-mutations.pert \
  --format json
node dist/cli.js plan-assurance show plans/editor-mutations.pert \
  --task EDITOR_REPAIR_ACCEPTANCE --format json
node dist/cli.js dag next plans/editor-mutations.pert --format json
```

Continue only if the plan digest remains
`sha256:bb9fd570b828c0dd9643e2739434d9963ea4c202710eed685a2d16115704d3b4`
and the missing outcome remains the root cause rather than a contract or basis
mismatch.

## Next bounded slice

Prepare and present three exact candidates one at a time:

1. a complete required artifact criterion set for the reached
   `EDITOR_REPAIR_ACCEPTED` milestone;
2. after committing that accepted candidate, an evidence receipt bound to the
   exact revision containing this acceptance record; and
3. after accepting that receipt, a conformant task outcome bound to the
   current accepted basis of `EDITOR_REPAIR_ACCEPTANCE`.

Use the registered `milestone acceptance replace`, `milestone acceptance
verify`, and `task-outcome add` commands in preview mode. Freeze and report the
full candidate, source and candidate digests, commitments, evidence revision,
affected scopes, and required owner assertion before each write. A
confirmation is single-candidate and must not be reused for the next mutation.
After all three writes, require complete assurance with no unavailable task,
mismatch, replan requirement, active attention, or required action before
considering E2.

Do not advance the plan, start E2, publish a release or VSIX, change npm tags,
or mutate an Issue as part of that evidence-restoration slice.
