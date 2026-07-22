# MVP release readiness監査

- 文書状態: Not Ready 1.0
- 監査日: 2026-07-22
- 対象: [MVP受け入れ条件](../requirements.md#21-mvp-受け入れ条件)
- Macro plan: [../../plans/mvp.pert](../../plans/mvp.pert)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)

## 1. 結論

`RELEASE_E2E`は完了扱いにしない。受け入れ条件1から15には実装・自動検査の証跡があるが、条件16のrecommendation tier、recommended set、structured explanation、higher-priority comparisonは設計済み・未実装である。

現行`selectNextTasks`と`dag next`は`Perttool.NextResult.v2`であり、`active`、`ready`、`runnable_now`、`blocked_now`、`upcoming`を返す。これらをcondition 16のrecommendationとして再解釈してはならない。

## 2. 受け入れ証跡

| 条件 | 状態 | 主な証跡 |
| --- | --- | --- |
| 1-7 | Pass | parser/semantic/analysis/next unit、CLI、E2E-001からE2E-007 |
| 8 | Pass | mutation/formatter/write-safety unit、CLI、E2E-008からE2E-011 |
| 9 | Pass | advance unit、CLI、E2E-013 |
| 10 | Pass | Mermaid profile/export/import unit、CLI、E2E-012とE2E-014 |
| 11-12 | Pass | help registry、fixture/help link test |
| 13-15 | Pass | Core/CLI parity、normative example、Point/velocity analysis test |
| 16 | Fail | `NextResult.v3`、ranking/tier、structured explanation、override validation、shadow/adoptionが未実装 |

`npm run check`が成功することはrepository regressionがない証拠であるが、未実装のcondition 16を自動的にPassへ変えない。

## 3. 工程是正

[Recommendation実装plan](../../plans/recommendation.pert)へMIG-01からMIG-07を22pとして分解する。初期Velocityは、同じTypeScript Core/CLI実装に最も近い`operations.pert`の暫定実測`24p/1d`を使用する。Detail resource makespan 22pをmacroへ`0.916667d`としてroll-upし、`RECOMMENDATION_IMPLEMENTATION`を`RELEASE_READY`へ入るhard predecessorとして追加する。

MIG-08のoverride apply、durable audit、Git integrationはMVP条件ではない。Read-only override validationであるMIG-05までをMVPへ含め、write authorityはMVP後も未解禁とする。

## 4. `RELEASE_E2E`再開条件

- `plans/recommendation.pert`のMIG-01からMIG-07が完了している
- `Perttool.NextResult.v3`のcomplete JSON、text summary、help、consumer migrationが公開済みである
- self-use shadowとnormal authority adoptionが受け入れ済みである
- `npm run check`がpackage-installed CLIを含め成功する
- package smokeがcheck、analyze、next v3、editing preview、advance preview、Mermaid round-tripを隔離prefixで確認する

この条件を満たしてからMVP受け入れ条件1から16を再監査し、`RELEASE_E2E`を完了する。
