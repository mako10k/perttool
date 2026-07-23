# MVP release readiness監査

- 文書状態: Not Ready 1.2
- 監査日: 2026-07-22
- 更新日: 2026-07-23
- 対象: [MVP受け入れ条件](../requirements.md#21-mvp-受け入れ条件)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)

## 1. 結論

`RELEASE_E2E`は完了扱いにしない。受け入れ条件1から15には実装・自動検査の証跡があり、条件16のranking/tier、structured explanation/invariant、public v3までは実装したが、override validation、shadow/adoptionが未実装である。

現行`selectNextTasks`と`dag next`は`Perttool.NextResult.v3`であり、complete recommendation graphと、v2由来の`active`、`ready`、`runnable_now`、`blocked_now`、`upcoming`を直交するfieldとして返す。V3はshadow受け入れ前なので、公開済みというだけでAI task selection authorityにしない。

## 2. 受け入れ証跡

| 条件 | 状態 | 主な証跡 |
| --- | --- | --- |
| 1-7 | Pass | parser/semantic/analysis/next unit、CLI、E2E-001からE2E-007 |
| 8 | Pass | mutation/formatter/write-safety unit、CLI、E2E-008からE2E-011 |
| 9 | Pass | advance unit、CLI、E2E-013 |
| 10 | Pass | Mermaid profile/export/import unit、CLI、E2E-012とE2E-014 |
| 11-12 | Pass | help registry、fixture/help link test |
| 13-15 | Pass | Core/CLI parity、normative example、Point/velocity analysis test |
| 16 | Fail | ranking/tier、structured explanation/invariant、`NextResult.v3` publication testはPass。override validation、shadow/adoptionが未実装 |

`npm run check`が成功することはrepository regressionがない証拠であるが、未実装のcondition 16を自動的にPassへ変えない。

## 3. 工程是正

監査時に[Recommendation実装plan](../../plans/recommendation.pert)へMIG-01からMIG-07を22pとして分解した。初期Velocityは、同じTypeScript Core/CLI実装に最も近い`operations.pert`の暫定実測`24p/1d`を使用した。Detail resource makespan 22pをmacroへ`0.916667d`としてroll-upし、`RECOMMENDATION_IMPLEMENTATION`を`RELEASE_READY`へ入るhard predecessorとして追加した。

2026-07-23にMIG-01 fixture baseline 2pを完了した。Recommendation固有の初回実測を`2p/1d`とし、残るresource 20pのforecast 10dをmacroへ再roll-upした。次のdetail taskは`RANKING_CORE`であり、condition 16と`RELEASE_E2E`は引き続き未完了である。

同日にMIG-02 ranking/tier Core 4pを完了し、累計実測を`6p/1d`へ更新した。残るresource 16pのforecast `8/3d`をmacroへ`2.666667d`として再roll-upした。次のdetail taskは`EXPLANATION_CORE`であり、condition 16と`RELEASE_E2E`は引き続き未完了である。

同日にMIG-03 structured explanation/invariant Core 5pを完了し、累計実測を`11p/1d`へ更新した。残るresource 11pのforecast 1dをmacroへ再roll-upした。次のdetail taskは`NEXT_V3_PUBLICATION`であり、public v3、override、shadow/adoptionが残るためcondition 16と`RELEASE_E2E`は引き続き未完了である。

同日にMIG-04 `NextResult.v3` atomic publication 4pを完了し、累計実測を`15p/1d`へ更新した。残るresource 7pのforecast `7/15d`をmacroへ`0.466667d`として再roll-upした。Detailでは`SELF_USE_SHADOW`がrecommended、`OVERRIDE_VALIDATION`はreviewer競合でdeferredである。Override validation、shadow/adoptionが残るためcondition 16と`RELEASE_E2E`は引き続き未完了である。

MIG-08のoverride apply、durable audit、Git integrationはMVP条件ではない。Read-only override validationであるMIG-05までをMVPへ含め、write authorityはMVP後も未解禁とする。

## 4. `RELEASE_E2E`再開条件

- `plans/recommendation.pert`のMIG-01からMIG-07が完了している
- `Perttool.NextResult.v3`のcomplete JSON、text summary、help、consumer migrationが公開済みである
- self-use shadowとnormal authority adoptionが受け入れ済みである
- `npm run check`がpackage-installed CLIを含め成功する
- package smokeがcheck、analyze、next v3、editing preview、advance preview、Mermaid round-tripを隔離prefixで確認する

この条件を満たしてからMVP受け入れ条件1から16を再監査し、`RELEASE_E2E`を完了する。

## 5. npm publication preparation

2026-07-23に利用者の明示overrideでnpm publication preparationだけを前倒しした。この準備は`RELEASE_E2E`のpredecessorを満たさず、task status、recommendation authority、外部publish authorityを変更しない。

確認・整備済み:

- npm registryの`perttool`は確認時点で`E404`
- maintainerのsecretを`NPM_TOKEN`へ統一し、値を表示せず`npm whoami`成功
- npm 11のdry-runで`./dist/cli.js`がpublish manifestから除去される問題を再現
- `bin.perttool`を`dist/cli.js`へcanonical化
- public npmjs registryと`alpha` dist-tagを`publishConfig`へ固定
- 同一tarball、clean worktree、local/remote tag、remote main、未公開versionを検査するfail-closed publish script
- package checkへpublish normalization dry-runを追加

未実施:

- `0.1.0-alpha.2`へのversion更新
- release commit/tag/push、GitHub prerelease asset作成
- npm registryへのexternal publish
- registryからの隔離installとrelease記録

実行順とTOKEN境界は[npm publication手順](npm-publication.md)を正とする。
