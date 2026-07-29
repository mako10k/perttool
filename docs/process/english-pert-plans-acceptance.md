# English PERT plan migration acceptance

Status: Accepted and advanced on 2026-07-29. Git commit `9d9fdbf` records the
exact completed pre-advance snapshot.

## Scope

`PERT_PLANS` migrates repository-maintained natural-language metadata in the
current PERT plan surface to the English baseline adopted by ADR 0004. The
accepted files are:

- `plans/mvp.pert`
- `plans/grammar.pert`
- `plans/control-plane.pert`
- `plans/operations.pert`
- `plans/recommendation.pert`
- `plans/agent-guidance.pert`
- `plans/README.md`

The other fourteen self-use plans were already English-only and did not
require content changes.

## Accepted invariants

The six `.pert` files were changed through preview-first atomic `batch apply`
requests and expected-digest safe writes. Only project, resource, milestone,
task, and gate prose changed.

The migration preserves:

- project, resource, milestone, task, and gate IDs;
- task and gate endpoints and therefore graph topology;
- durations, estimates, units, velocities, and finish references;
- milestone and task state;
- priorities and resource requirements;
- declaration order, comments, and source-preserving formatting; and
- the residual-plan boundary: no completed declaration was reconstructed from
  Git history.

The existing semantic self-use goldens remain unchanged. The recommendation
shadow golden changes only source digests for the six translated plans before
the `english-baseline.pert` task-state update. A plans-scoped run of the
canonical language scanner reports no Japanese-script match.

## Source identity

| Plan | Before | Accepted translated digest |
| --- | --- | --- |
| `mvp.pert` | `sha256:689462cc4c8a3b5d860f50c9e9a8de3c42ae9caea8fea4cd293ef2076d8caf24` | `sha256:28fbec1d08405aab10f9afeb1af91c4c67dedb744cdcad455a1ace8a99de2742` |
| `agent-guidance.pert` | `sha256:c88d8f03b52a2c4e1f1f533f977343bdf033b827a0464bfc2edf2f6019662b6e` | `sha256:ca06697d12d3846f72068bbbc113e20539ba717b0c23735473290dd08bd4f7f4` |
| `grammar.pert` | `sha256:bbdeeb1636c0c3ca534d0f69b8a52c17f399a31c38aeecb2b7271f07812c909a` | `sha256:a929ccbb229db479a8168d74716dbb420885d6b190d755d45708d860d4505aca` |
| `control-plane.pert` | `sha256:21d4d8e5706031abf5c5713ed680638eef58f0f73cb49e2a3631a605b9c66c95` | `sha256:07f893384fcf79de5612450c672b2af785a64182c354b5faf9bdb526f2a1f7ef` |
| `operations.pert` | `sha256:b38d4cc751e42ef437f4a140df22ffeb94bfc2aa1f6487d34feef6618eed6b6a` | `sha256:543fa97cbc9d1ac4ab7a25b502328f9468548b55b28d876e29e2a98c0fa40574` |
| `recommendation.pert` | `sha256:b683fdacbbff39c0afd7ee20faf6cc4c05c50ece2ea350e4ce15e4a599f61464` | `sha256:92188ea4097e23901575c51450222989bc04868c2136dacdd25fd83f97e73d46` |

The expected-digest batch that set `PERT_PLANS` to `done`, changed `as_of` to
2026-07-29, and recalibrated velocity to `36p/2d` changed
`english-baseline.pert` from
`sha256:540165d6de11dde691c689ccd7d5c1f03e73f5b36557d046e49cf011c7ae8b39`
to the exact completed pre-advance digest
`sha256:46d60e078c894943fac4d42e87910f32b39aca6aa95023c1c2fef4ec89a72866`.
Git commit `9d9fdbf` records that snapshot.

Governed `dag advance` removed `PERT_PLANS`, four satisfied content gates, and
five prior frontier milestones. The operation preserved
`frontier_before=frontier_after=[ENGLISH_CONTENT_READY]` and
`ready_before=ready_after=[GOLDEN_UNICODE_AUDIT]`. The residual source digest
is
`sha256:5ef6da21733179d8d0df03bb83de0fac90257cd91dcb5300f97c9909fb924c86`.

At that snapshot, two tasks and 6p remain. Precedence and the
`parallel-sgs` version 1 heuristic resource makespans are both 6p with no
resource delay; both velocity forecasts are exactly `1/3d`. Complete,
non-truncated `Perttool.NextResult.v5` recommends and permits starting only
`GOLDEN_UNICODE_AUDIT`.

## Verification

The focused checks and the full repository gate passed:

```sh
node --test test/self-use.test.mjs \
  test/recommendation-self-use-shadow.test.mjs
npm ci
npm run check
git diff --check
```

The plans-scoped invocation of the canonical scanner from
`docs/process/english-surface-inventory.md` also passed, as did direct
`document check`, `dag analyze`, and `dag next --format json` verification of
`plans/english-baseline.pert`.

The full gate completed 638 tests, all 20 self-use plan checks, the temporary
link workflow, and the isolated release-package workflow. `git diff --check`
also passed.

## Explicit non-goals

This slice does not:

- perform the repository-wide golden and Unicode allowlist audit assigned to
  `GOLDEN_UNICODE_AUDIT`;
- translate user-authored content or intentional Unicode fixtures;
- add runtime i18n, locale negotiation, or translation catalogs;
- implement or select backlog `ACT-002` REOPEN;
- publish a package, move an npm dist-tag, mutate Git history, or close a
  GitHub issue.
