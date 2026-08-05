# Help and Guide Consistency Acceptance

- Document status: Accepted 1.0
- Acceptance date: 2026-08-05
- Workstream: `GUIDE-CONSISTENCY-001`
- Contract: [Help and Guide Consistency](../specs/help-guide-consistency.md)
- Plan: [help-guide-consistency.pert](../../plans/help-guide-consistency.pert)
- Final pre-advance plan digest: `sha256:53acadb6ce8e31058b455b327fa2a01089534ea034982c3e90cb1ecced4846e9`
- Active source grammar: Grammar 6
- Active CLI contract: CLI Contract 7
- Public identities: unchanged

## 1. Decision

Accept the complete correction of the active Guide, command Help examples,
diagnostic navigation, diagnostic specification coverage, current-state
documentation, historical labels, and bounded related-topic symmetry. The
four plan tasks and 14p are complete and retained before advance. Precedence
and heuristic resource makespans are zero, and complete NextResult v6 has no
ready, recommended, or startable task.

This acceptance does not select or publish a release, mutate an npm dist-tag
or GitHub Issue, perform a remote write, or authorize `dag advance` on this or
any other plan.

## 2. Accepted corrections

The active Contract 7 Guide now projects exact topic-specific meaning rather
than deriving semantic versions and authority through unrestricted prose
replacement. It states `Perttool.AnalysisResult.v5`,
`Perttool.NextResult.v6`, and
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1` together. It
preserves the additive history in which Grammar 5 introduced work events and
Grammar 6 retained them while adding assurance records.

All 44 registered commands have examples that pass active registry argument
validation. The eight assurance mutation examples now include every required
operand and option. This gate is parser-only and performs no project read or
write.

The diagnostic-link gate recursively scans all TypeScript source files.
Project history and velocity observation resolve to `actuals`; Grammar 6 unit
migration resolves to `editing.unit-migration`; all other literal topics also
resolve through the active Guide. `PTCNV-210` is recorded as the stable loss
code for plan-assurance records omitted by older Mermaid profiles and is
directly triggered in compatibility tests.

README installation guidance reports the accepted current state
`beta=latest=0.7.0` while retaining the separate publication-time fact that
the release itself left `latest=0.6.0`. Requirements, normative assurance
examples and interface text, compatibility specifications, the plan index,
self-use guidance, and shared agent policy distinguish active state from
historical pins and decision-time targets.

## 3. Acceptance trace

| Case | Evidence |
| --- | --- |
| `HGC-001` | `test/guide.test.mjs` verifies exact additive Grammar, Result, and combined authority identities and rejects semantic `replaceAll` lifting in the active adapter. |
| `HGC-002` | `test/command-registry.test.mjs` tokenizes and validates every registered example against the complete Contract 7 registry; all eight assurance mutations carry exact required inputs. |
| `HGC-003` | `test/guide.test.mjs` recursively discovers every literal TypeScript `helpTopic` and resolves it with the active Guide. |
| `HGC-004` | `test/help-guide-consistency.test.mjs` traces README, requirements, normative examples and specifications, plan index, self-use procedure, AGENTS, and Copilot instructions to the accepted `0.7.0` state and explicit historical labels. |
| `HGC-005` | `docs/specs/mermaid-profile.md` specifies `PTCNV-210`, and `test/plan-assurance-compatibility.test.mjs` triggers it for both profile 1 and plain assurance loss. |
| `HGC-006` | `test/guide.test.mjs` verifies reciprocal links between `plan-assurance` and `syntax`, `analysis`, `next`, and `editing`, while every related target remains closed. |
| `HGC-007` | `test/help-guide-consistency.test.mjs` binds the seven-case contract to the valid completed plan and its final digest; focused tests and the complete Node.js 22 repository, documentation, self-use, temporary-link, and isolated-package gates pass; `git diff --check` also passes. |

## 4. Verification

The accepted verification commands are:

```sh
/home/katsumata-m/.nvm/versions/node/v22.22.3/bin/npm run check
git diff --check
```

The complete gate passed once with the acceptance task active and was repeated
after the exact completed plan, acceptance record, final self-use golden, and
shared policy updates were present. The gate includes type checking, the full
Node test suite, English and Markdown validation, all thirty-two self-use
plans, temporary linking, and the isolated installed-package workflow.

## 5. Remaining boundaries

The completed declarations intentionally remain in
`plans/help-guide-consistency.pert`. A future advance requires a fresh
assertion-free preview and separate scope-bound authorization. Release
selection, version changes, remote Git or GitHub operations, npm publication,
dist-tag movement, and Issue mutation remain outside this acceptance.
