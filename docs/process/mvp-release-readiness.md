# MVP release readiness audit

- Document status: Released 1.6
- Audit date: 2026-07-22
- Updated: 2026-07-23
- Scope: [MVP acceptance criteria](../requirements.md#21-mvp-acceptance-criteria)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)

## 1. Conclusion

`RELEASE_E2E` is complete. Acceptance criteria 1 through 16 have implementation and automated-test evidence, including condition 16 ranking/tier, structured explanation/invariant, public v3, five-plan self-use shadow, read-only override validation, normal-authority adoption, and the unknown-version safe stop.

Current `selectNextTasks` and `dag next` use `Perttool.NextResult.v3`, returning the complete recommendation graph and the v2-derived `active`, `ready`, `runnable_now`, `blocked_now`, and `upcoming` as orthogonal fields. Known, complete v3 was adopted as the normal AI task-selection authority. The same `v0.1.0-alpha.2` artifact was published to a GitHub prerelease and npm `alpha`, and a SHA-256 match and isolated installation were verified from both. All macro tasks are complete, and the next recommended task is empty.

## 2. Acceptance evidence

| Criterion | Status | Main evidence |
| --- | --- | --- |
| 1-7 | Pass | parser/semantic/analysis/next unit tests, CLI, E2E-001 through E2E-007 |
| 8 | Pass | mutation/formatter/write-safety unit tests, CLI, E2E-008 through E2E-011 |
| 9 | Pass | advance unit tests, CLI, E2E-013 |
| 10 | Pass | Mermaid profile/export/import unit tests, CLI, E2E-012 and E2E-014 |
| 11-12 | Pass | help registry, fixture/help link test |
| 13-15 | Pass | Core/CLI parity, normative example, Point/velocity analysis test |
| 16 | Pass | ranking/tier, structured explanation/invariant, `NextResult.v3` publication, five-plan shadow, read-only override validation, normal-authority adoption, unknown-version safe stop |

Condition 16 was marked Pass based on successful `npm run check` together with MIG-07 adoption evidence. `RELEASE_E2E` additionally accepted GitHub/npm distribution of the release artifact and registry installation.

## 3. Schedule remediation

At audit time, MIG-01 through MIG-07 were decomposed into 22p in the [recommendation implementation plan](../../plans/recommendation.pert). The initial velocity used the provisional observed `24p/1d` of `operations.pert`, the closest comparable TypeScript Core/CLI implementation. The 22p detail-resource makespan was rolled up to the macro plan as `0.916667d`, and `RECOMMENDATION_IMPLEMENTATION` was added as a hard predecessor of `RELEASE_READY`.

On 2026-07-23, MIG-01 fixture baseline 2p was completed. The first recommendation-specific observation was set to `2p/1d`, and the remaining-resource forecast of 20p/10d was rolled up to the macro plan again. The next detail task was `RANKING_CORE`; condition 16 and `RELEASE_E2E` remained incomplete.

On the same day, MIG-02 ranking/tier Core 4p was completed and cumulative observed velocity was updated to `6p/1d`. The forecast for the remaining 16p of resource work, `8/3d`, was rolled up again to the macro plan as `2.666667d`. The next detail task was `EXPLANATION_CORE`; condition 16 and `RELEASE_E2E` remained incomplete.

On the same day, MIG-03 structured explanation/invariant Core 5p was completed and cumulative observed velocity was updated to `11p/1d`. The one-day forecast for the remaining 11p of resource work was rolled up again to the macro plan. The next detail task was `NEXT_V3_PUBLICATION`; condition 16 and `RELEASE_E2E` remained incomplete because public v3, override, and shadow/adoption work remained.

On the same day, MIG-04 `NextResult.v3` atomic publication 4p was completed and cumulative observed velocity was updated to `15p/1d`. The forecast for the remaining 7p of resource work, `7/15d`, was rolled up again to the macro plan as `0.466667d`. In the detail plan, `SELF_USE_SHADOW` was recommended and `OVERRIDE_VALIDATION` was deferred because of reviewer contention. Condition 16 and `RELEASE_E2E` remained incomplete because override validation and shadow/adoption work remained.

On the same day, MIG-06 self-use shadow 2p was completed, accepting agreement between five-plan manual selection and v3 recommendation, the known contract, complete graph, byte determinism, joint feasibility, operational-field compatibility, and structured why-not. Cumulative observed velocity was updated to `17p/1d`, and the forecast for the remaining 5p of resource work, `5/17d`, was rolled up again to the macro plan as `0.294118d`. In the detail plan, `OVERRIDE_VALIDATION` was recommended and `AUTHORITY_ADOPTION` was deferred because of reviewer contention. Condition 16 and `RELEASE_E2E` remained incomplete because override validation and normal-authority adoption remained.

On the same day, MIG-05 read-only override validation 3p was completed. It verified pure `validateOverride`, `PTOVR-101` through `PTOVR-106`, feasible replacement, normal-trace references, caller-asserted actor, canonical evidence, capacity witness, deterministic `Perttool.OverrideDecision.v1` artifact, and the package-installed API. Cumulative observed velocity was updated to `20p/1d`, and the forecast for the remaining 2p of resource work, `1/10d`, was rolled up again to the macro plan as `0.1d`. In the detail plan, `AUTHORITY_ADOPTION` was the only recommended task. Condition 16 and `RELEASE_E2E` remained incomplete because normal-authority adoption remained.

On the same day, MIG-07 normal-authority adoption 2p was completed. The normal-selection rule was synchronized to shared instructions, the AI development guide, consumer guide, and help; it dry-ran the recommended subset, one allowed addition, override-required selection, empty recommendation, and 16 unknown/incomplete/decisive-semantics boundaries. The provisional observation for all 22p was updated to `22p/1d`, leaving 0p in the detail plan. Macro `RECOMMENDATION_IMPLEMENTATION` was also completed and condition 16 was changed to Pass. `RELEASE_E2E` was the only ready and recommended task, with a remaining makespan of 2d.

MIG-08 override apply, durable audit, and Git integration are not MVP criteria. The MVP includes MIG-05, the read-only override validation; write authority remains unavailable after the MVP.

## 4. `RELEASE_E2E` restart conditions

- MIG-01 through MIG-07 in `plans/recommendation.pert` are complete.
- Complete JSON, text summary, help, and consumer migration for `Perttool.NextResult.v3` are published.
- Self-use shadow and normal-authority adoption are accepted.
- `npm run check`, including the package-installed CLI, succeeds.
- Package smoke verifies check, analyze, next v3, editing preview, advance preview, and Mermaid round-trip in an isolated prefix.

The MIG-07 change on 2026-07-23 met these conditions; the same day's release-artifact re-audit and post-publication verification completed `RELEASE_E2E`.

## 5. npm publication preparation

On 2026-07-23, an explicit user override advanced only npm publication preparation. This preparation did not satisfy `RELEASE_E2E` predecessors and did not change task status, recommendation authority, or external publication authority.

After MIG-07 was complete and `RELEASE_E2E` became ready, the user explicitly authorized Git push and npm publication under `secdat exec`. Perform actual publication exactly once after meeting the same-artifact gate in the [npm publication procedure](npm-publication.md).

Verified and prepared:

- `perttool` in the npm registry returned `E404` at verification time.
- The maintainer secret was standardized as `NPM_TOKEN`, without displaying its value; `npm whoami` succeeded.
- An npm 11 dry run reproduced removal of `./dist/cli.js` from the publish manifest.
- `bin.perttool` was canonicalized to `dist/cli.js`.
- The public npmjs registry and `alpha` dist-tag were fixed in `publishConfig`.
- A fail-closed publication script checks the same tarball, clean worktree, local/remote tag, remote main, and unpublished version.
- A publish-normalization dry run was added to the package check.

Results:

- Release commit `dd4fc3efc01945544a2dad7e1838fdd4d06d7275` was pushed to `origin/main`, and annotated tag `v0.1.0-alpha.2` was created at that commit.
- The tarball and `SHA256SUMS` were attached to the GitHub prerelease, and published-asset SHA-256 `aadb757a5d7bb82eed677158ce5c4b0672c5695a6dde97bec6f10c438711be8a` was verified.
- The same tarball was published to npm exactly once, verifying `perttool@0.1.0-alpha.2`, the `alpha` dist-tag, registry integrity, and SHA-1 `d1bc681e68384d29b3130ba9a21c99e44605d51d`.
- The SHA-256 match between the GitHub asset and registry tarball, isolated installation of `perttool@alpha`, `--version`, and `dsl check` were verified.
- `RELEASE_E2E` was completed after verifying task-finish-preview source digest `sha256:741c027228dd13cfdf6bcdb6a4e0c0f6523848aba6f1c4f6e4d1f762433533bf` and candidate digest `sha256:47937515ecbf024bd1dd23ca7d73e526e2fb25ae6fac27cc4ff179ece45d5217`.

The [npm publication procedure](npm-publication.md) is authoritative for execution order and TOKEN boundaries.
