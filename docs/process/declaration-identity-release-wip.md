# Declaration Identity and Release WIP Handoff

- Handoff date: 2026-08-06
- Branch target: `wip/declaration-identity-release-20260806`
- Correction commit: `6b78526166a5e2d25347eaf1a8b3609ff15ccdd7`
- Worktree base before the correction: `d1578b93d3fbfc6e0ec631e068f5bb207b4a0f4d`
- Publication state: unchanged

## Completed

`DECL-ID-001` is implemented and committed. Direct task addition inserts before
assurance and actual records; task mutation and lifecycle resolve
`(kind=task, id)`; and LSP definition prefers the task over a same-ID
`plan_seal`. The focused three-case regression proves that seal and outcome
bytes remain unchanged, a valid seal-before-task source remains operable, and
definition navigation selects the task range.

Before the historical acceptance artifacts were added, one complete repository
gate passed 958 tests plus English, documentation, all 35 self-use plans,
isolated LSP/MCP/VSIX workflows, temporary linking, npm publication dry-run,
and isolated installed-package checks. The correction commit also passed a
fresh typecheck, build, focused test, English check, documentation check, and
`git diff --check`.

The uncommitted historical acceptance slice was then added and its three
focused tests passed. It composes `HDA-001` through `HDA-016`, all existing
historical component matrices, the 45-command and 21-schema source boundary,
and a real no-write `dag history` invocation. English passed over 774 files,
documentation passed over 209 Markdown files, and `git diff --check` passed.

## Interrupted verification

The exact Node.js 22.22.3 command below was started and intentionally
interrupted with SIGINT at the user's time-limit instruction:

```sh
/home/katsumata-m/.nvm/versions/node/v22.22.3/bin/npm run check
git diff --check
```

The process exited 130 while the parallel root test runner was still active.
Any test files printed as failed at that boundary were terminated processes,
not observed assertion failures. Do not accept or reject the final historical
slice from that interrupted run; rerun the complete command from a clean
continuation checkout.

## Release boundary decision

Do not publish the current source as `0.7.2`. Published `0.7.1` has 44 commands,
20 root schemas, and 121 root runtime exports. Current source additively has
`dag history`, `Perttool.HistoricalGraphResult.v1`, Core/Node subpaths, 45
commands, 21 root schemas, and 122 root runtime exports. After final historical
acceptance, the correct complete-source release candidate is a `0.8.0` beta
minor. A maintenance-branch `0.7.2` backport was considered but not selected.

## Continued state on 2026-08-07

The interrupted gate was rerun successfully. The final historical task was
then completed, its exact conformant outcome was separately confirmed and
written once with actor `codex` and candidate-bound owner assertion `user`, and
complete assurance readback reports no ready, recommended, runnable, or
startable task. The accepted basis remains
`sha256:cce0e3c757a51cf09215980303509d1aad9e5bbb90d11acf48790e962a894626`;
the final plan source digest is
`sha256:3a1b78e7e7012ebd0fba568cf10f0a0ca23d20fc33fd834f719b1681a64ea3ef`.
The plan remains intentionally retained before advance.

The subsequent `DAG-UX-001` local slice replaces the private VSIX grid renderer
with pinned Dagre, adds bounded pan, zoom, fit, and native scrolling, defaults
historical queries, progressively discloses advanced controls, and projects
the current milestone, critical path, and exact Contract 7 start authority.
Its acceptance record is [dag-presentation-acceptance.md](dag-presentation-acceptance.md).

The user then requested local installation before selecting compact DAG labels.
The exact predecessor 18-file VSIX with SHA-256
`5dff03a7438121a6090ed7610789066c97597618459e3bb9e46d4519d3aaac8e` was
installed once as `perttool-private.perttool-vscode-private@0.0.0`, with core
installed bytes verified against the artifact. The separately selected
`VSIX-DAG-PRESENT-001` implementation is accepted in
[dag-compact-presentation-acceptance.md](dag-compact-presentation-acceptance.md)
and was later separately packaged and installed once in the user's normal
profile. The 18-file compact VSIX is 2,188,896 bytes with SHA-256
`ac10f4dfe00d1154d282fb737b117a85fcaf7e23b6d2b412e4f7299bd8a812e6`.
It adds compact graph/detail identity and exact time summaries without changing
the release boundary.

Commit `2b1e12684dcf2a25faa50ff7db6ae8dc49b98288` records the final accepted
historical and DAG presentation source without advancing a plan. The user then
accepted the exact initial [`release-0.8.0.pert`](../../plans/release-0.8.0.pert)
candidate. Contract 7 `project init` created the 489-byte base, and one
separately confirmed 18-mutation atomic batch used actor `codex` and the
candidate-bound owner assertion `user` for goal and DAG scopes. The resulting
6,734-byte plan has digest
`sha256:a26bb205f5eb4ee4bb6616bee2d74877c3162f26be090473d435a4515fadc69c`,
six serial tasks totaling 22p, and makes startable only
`RELEASE_080_GATE_DESIGN`. Its exact evidence is in
[0.8.0-release-plan-acceptance.md](0.8.0-release-plan-acceptance.md).

## Remaining separately authorized order

1. Present the accepted immutable `0.8.0` candidate from source commit
   `f9be1cc`, 679 files, 2753740 bytes, and SHA-256
   `d761e2a159d2d60eb981efda403cc6b00c4eac9e31503b2e857c0b851ac00b28`
   together with the release commit, exact external destinations, bodies,
   refs, and maximum write count.
2. Publish only after that exact candidate authorization boundary. npm `latest`,
   Marketplace publication, plan advance, and Issue mutation remain separate.

No tag, GitHub Release, npm publication, dist-tag movement, Marketplace
operation, plan advance, or Issue mutation was performed in this WIP slice.
The only editor-profile mutations were the two separately authorized local
extension installations described above. Plan mutations were the separately
confirmed final historical task status and outcome writes and the exact
initial `0.8.0` release-plan write described above.
