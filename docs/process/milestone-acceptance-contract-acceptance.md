# Milestone Outcome Acceptance Contract Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Baseline HEAD: `6a4472344d1da2561dc10a657f0bf38d5b15b78f`
- Backlog: `MILESTONE-ACCEPT-001`
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_CONTRACT`
- Target milestone-acceptance model: 1
- Target grammar: Grammar 7
- Target CLI contract: Contract 8
- Active runtime: `perttool@0.8.0`, Grammar 6, CLI Contract 7
- Runtime status: not implemented

## 1. Decision

Accept the milestone outcome acceptance contract. It separates graph closure
from outcome acceptance, fixes complete criterion-set revision and receipt
semantics, retains Git-only superseded history, uses the existing DAG owner,
requires committed migration proof for a closed grandfather set, and guards
canonical advance without adding partial advance or a general force option.

This is contract acceptance, not runtime activation. The active runtime still
has 45 Contract 7 commands and 21 root schemas. It does not parse Grammar 7,
evaluate milestone acceptance, migrate an acceptance baseline, expose
`PTMAC-*`, or block advance on milestone outcome acceptance.

## 2. Resolved decisions

| ID | Accepted decision |
| --- | --- |
| `MACR-001` | Grammar 7 and CLI Contract 8 are one atomic compatibility boundary. |
| `MACR-002` | Closure and acceptance are independent axes; one closure computation may reach several independently evaluated milestones. |
| `MACR-003` | Each declared criterion set is complete, non-empty, and has at least one required criterion; optional criteria do not block. |
| `MACR-004` | Replacing a criterion set atomically removes its current receipts. No ID, receipt, waiver, or state continues implicitly; Git retains old revisions. |
| `MACR-005` | One criterion has at most one unrevoked terminal receipt. Changing it requires an exact explicit revoke, not source or timestamp precedence. |
| `MACR-006` | Verifier and UTC time are caller assertions only. Model 1 adds no authentication, trusted clock, or external verification service. |
| `MACR-007` | Every criterion and receipt mutation uses the pre-change effective `dag_owner`; no milestone-specific owner role is added. |
| `MACR-008` | In-place migration requires exact committed source, `HEAD`, and stage-0 proof and records only the exact pre-migration explicit reached IDs as grandfathered. |
| `MACR-009` | Migration creates no criteria, evidence, waiver, or acceptance. Missing criteria remain visible through `document check` warnings and CLI remediation. |
| `MACR-010` | Advance first creates one provisional explanatory candidate, then evaluates every affected milestone. One blocker rejects the whole candidate. |
| `MACR-011` | Acceptance cannot be bypassed by `--force-history-loss`; history safety remains an orthogonal later guard. |
| `MACR-012` | Milestone acceptance does not invalidate downstream task-plan assurance in model 1. Adapters are read-only projections and history is checkpoint-specific. |

## 3. Fixed public target

Contract 8 has 53 commands and 23 root schemas. It adds the exact seven
`milestone acceptance` paths and `document migrate --target-grammar 7`, fixes
the three Grammar 7 record identities, activates
`Perttool.CheckResult.v5`, `Perttool.AnalysisResult.v6`,
`Perttool.NextResult.v7`, `Perttool.MutationResult.v5`,
`Perttool.AdvanceResult.v3`, and adds the closed migration and acceptance-show
results. `PTMAC-101` through `PTMAC-110` own the migration, declaration,
receipt, governance, advance, proof, and race failures.

## 4. Acceptance cases and verification

[`milestone-acceptance-contract-v1.json`](../../test/fixtures/milestone-acceptance-contract-v1.json)
contains 25 dependency-ordered cases from the separate state axes through the
no-authentication and no-release boundary. It explicitly records that runtime
is not implemented, partial advance is false, and there is no general
acceptance force.

Acceptance uses:

```sh
npm run build
node --test test/milestone-acceptance-contract.test.mjs
npm run check:english
npm run check:docs
npm run check:self-use
npm run check
git diff --check
```

The focused contract test passed all five tests. The English baseline passed
over 802 text files, documentation checks passed over 226 Markdown files and
seven normative PERT examples, and read-only self-use passed all 36 plans.
The complete repository gate passed 983 tests, the same English and
documentation checks, all 36 self-use plans, isolated LSP/MCP/VSIX and
supported VS Code 1.101.0 host gates, temporary linking, and the 679-file
isolated public-package workflow. `git diff --check` also passed.

No runtime implementation, Git commit or remote write, release selection,
publication, dist-tag movement, Issue mutation, editor installation, or plan
advance is authorized by this acceptance.

## 5. Implementation handoff

After the contract task is durably completed, `MILESTONE_ACCEPTANCE_SOURCE` is
the only normal next task. It may implement only Grammar 7 source records,
validation, formatting, spans, and the committed migration baseline. The pure
evaluator, mutations, advance guard, public activation, history, and adapters
remain gated by their respective plan tasks.
