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

## Exact continuation order

1. Rerun the complete Node.js 22 gate above and record final counts in
   `historical-dag-acceptance.md`.
2. Preview and write only `status done` for `HISTORICAL_DAG_ACCEPTANCE`, then
   preview its conformant outcome against accepted basis
   `sha256:cce0e3c757a51cf09215980303509d1aad9e5bbb90d11acf48790e962a894626`.
   Apply the outcome only with the required candidate-bound `user` assertion.
3. Recheck complete assurance and confirm no ready, recommended, or startable
   historical task. Commit the final accepted workstream without advancing it.
4. Create and accept a separate `0.8.0` release plan covering the already
   accepted adapter platform, historical DAG, and declaration-identity fix.
5. Prepare and validate one immutable candidate. Freeze its source commit,
   file count, byte size, SHA-256, external destinations, and maximum writes
   before publication.
6. Publish only after the exact candidate authorization boundary. npm `latest`,
   Marketplace publication, plan advance, and Issue mutation remain separate.

No tag, GitHub Release, npm publication, dist-tag movement, Marketplace
operation, extension installation, plan status/outcome mutation, plan advance,
or Issue mutation was performed in this WIP slice.
