# Milestone Outcome Acceptance Final Acceptance

- Date: 2026-08-13
- Workstream: `MILESTONE-ACCEPT-001`
- Task: `MILESTONE_ACCEPTANCE_ACCEPTANCE`
- Result: Accepted locally
- Release effect: none

## Accepted result

The Grammar 7 and CLI Contract 8 milestone-outcome acceptance workstream is
accepted across its normative contract, source and committed migration,
criterion evaluator, governed mutation, all-or-nothing advance, public CLI and
schema boundary, historical reconstruction, and read-only LSP, VSIX, and MCP
projection. Graph closure, explicit reached state, criterion acceptance,
caller-asserted provenance, task-plan assurance, and canonical advance remain
separate typed facts and guards.

The final dependency-ordered `MAF-001` through `MAF-016` matrix traces the
accepted technical records into public package, temporary-link, isolated
package, private adapter, supported-host, and no-write evidence. Root and Node
retain 129 identical runtime names and values, Core remains a 45-name portable
runtime, the command registry remains 53 paths, and the root schema catalog
remains 23 identities. Private adapters remain excluded from the public npm
package.

## Complete local gate

The accepted gate was:

```sh
npm run typecheck
npm test
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:lsp-package
npm run check:mcp-package
npm run check:vsix-shell
npm run check:link
npm run check:package
git diff --check
```

Type checking passed for all four workspaces. `npm test` passed 1,040 tests
with no failure, skip, or cancellation. The English baseline passed over 845
text files with three allowlisted lines, documentation checks passed over 238
Markdown files and seven PERT examples, and read-only self-use passed all 37
plans. The isolated LSP and MCP gates passed; the private VSIX passed trusted
and untrusted install, host, replacement, and uninstall checks under VS Code
1.101.0; temporary linking passed; and the isolated 713-file public package
passed Contract 8 file-first and plan-assurance compatibility checks. The npm
publication check was dry-run only. `git diff --check` passed.

## No-write and release boundary

The gate did not change package version `0.8.0`, create a release plan, select
a release version, retain a candidate tarball, commit or push Git state, create
or move a tag, mutate GitHub or an Issue, publish npm or a VSIX, or move a
dist-tag. It did not advance `plans/milestone-acceptance.pert`.

Final task lifecycle maintenance is an ordinary local plan mutation. Declaring
and verifying acceptance criteria for newly reached milestones is a separate
DAG-owner-governed candidate. Canonical plan advance and every release action
remain separately gated.

After the complete gate, one previewed status-only mutation completed
`MILESTONE_ACCEPTANCE_ACCEPTANCE`. It changed the plan digest from
`sha256:a990cc7e...c0da2` to `sha256:aab941ed...8f1092`; governance was not
applicable, and one expected-digest in-place write was read back. Fresh
complete NextResult v7 has no ready, runnable, recommended, or startable task;
precedence and resource makespans are zero. At that gate boundary, the three
newly reached milestones remained visibly `not_declared` pending separately
confirmed DAG-owner-governed criterion and receipt candidates.

Subsequent candidate-bound owner confirmations declared and verified
`MAC_ADAPTER_R1`, then declared `MAC_INTEGRATED_R1` and `MAC_ACCEPTED_R1`.
Readback at plan digest `sha256:5c6f5c9b...5853c` shows adapter acceptance as
`accepted` and the integrated and final milestones as `pending` their explicit
`ACCEPTED` receipts. These local plan mutations do not select or authorize a
release.

The user then separately confirmed the exact `MAC_INTEGRATED_ACCEPTED` and
`MAC_FINAL_ACCEPTED` receipt candidates. Two expected-digest writes changed
the plan digest from `sha256:5c6f5c9b...5853c` through
`sha256:686323cd...80ce8` to `sha256:1c3fb5e2...26a9e`. Readback shows all five
reached milestones as `accepted`, no blocking required criterion, and no
active, ready, runnable, blocked, upcoming, suspended, recommended, or
startable task. Release selection and every publication or remote-write action
remain separate.

## Canonical plan advance

The user separately authorized a local pre-advance commit and the exact
canonical advance. Commit `c96e522316b1f15fba7ce2ae4623a759f33ea8a2`
preserves the complete accepted source before contraction. One
expected-digest in-place advance changed the plan from
`sha256:1c3fb5e2...26a9e` to `sha256:a729f5b3...e9066`; the history guard passed
against that commit and stage-0 index without force.

Readback of the 3,893-byte residual plan has no diagnostic, task,
recommendation, or startable task. It retains only the reached final milestone,
`MAC_ACCEPTED_R1`, and `MAC_FINAL_ACCEPTED`; the removed workstream and evidence
remain recoverable from the pre-advance commit. This record accompanies the
separately requested post-advance local commit. No remote or release state
changed.

The isolated public-package gate was repeated over this final plan and record
state. The current 713-file `perttool@0.8.0` package again passed Contract 8
file-first and plan-assurance compatibility checks; npm publication remained a
dry-run against tag `beta`.

## Post-advance documentation and Guide reconciliation

The user's subsequent documentation-reconciliation instruction aligns current
Guide prose, normative entry points, repository-agent policy, and the plan
index with Grammar 7, CLI Contract 8, 53 commands, 23 schemas,
`Perttool.NextResult.v7`, and the advanced residual plan. The dated
`GUIDE-CONSISTENCY-001` records remain the historical Contract 7 correction
boundary instead of being rewritten as if Contract 8 existed in 2026-08-05.

Read-only npm and GitHub readback also established the separately published
compatible `v0.8.1` Contract 7 patch and `beta=latest=0.8.1`. Current
installation guidance now uses that exact pin while explicitly retaining the
unreleased branch's `0.8.0` tool identity and the separate future release-
selection boundary. No package version, tag, Release, dist-tag, remote ref,
Issue, or plan state changed during this reconciliation.
