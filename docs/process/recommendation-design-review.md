# Recommendation設計受け入れレビュー

- 文書状態: Accepted 1.0
- 受け入れ日: 2026-07-22
- 対応Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)
- 対応plan: [../../plans/control-plane.pert](../../plans/control-plane.pert)
- 実装migration: [recommendation-migration.md](recommendation-migration.md)

## 1. 判定

Issue #1の設計を受け入れる。要件、規範仕様、基本設計、規範例、実装migrationは、実行可否と推奨度を分離した決定的かつ説明可能なrecommendation契約として横断整合している。

この判定は設計完了を意味する。現行`selectNextTasks`と`dag next`は引き続き`Perttool.NextResult.v2`であり、recommendation tier、structured explanation、override validation/applyを実装済みとはみなさない。

## 2. レビュー対象

- [要件定義](../requirements.md)のAI Project Control Plane境界と完了条件
- [Recommendation Semantics](../specs/recommendation.md)
- [Ranking Policy](../specs/recommendation-ranking.md)
- [Reason Taxonomy](../specs/recommendation-reasons.md)
- [Structured Explanation](../specs/recommendation-explanation.md)
- [Interface Contract](../specs/recommendation-interface.md)
- [Human Override Contract](../specs/recommendation-override.md)
- [Recommendation規範例](../examples/recommendation.md)
- [基本設計](../basic-design.md)
- [AI開発ガイド](ai-development.md)
- [実装・自己利用migration](recommendation-migration.md)

## 3. 受け入れmatrix

| 観点 | 確認結果 | 判定 |
| --- | --- | --- |
| 要件traceability | source of truth、global objective、determinism、explainability、human overrideを個別仕様へ追跡できる | Accepted |
| model分離 | lifecycle/eligibility、resource selection、recommendation tierを混同せず、`blocked`をtierとして再定義しない | Accepted |
| deterministic ranking | selection horizon、lexicographic rule、joint feasibility、完全tie-break、algorithm versionが固定されている | Accepted |
| reasonとexplanation | stable reason codeをtyped fact、expression、comparison、decision trace、description projectionへ機械的に接続できる | Accepted |
| interface整合 | Coreを正とし、complete JSONとsummary textを同じresultから導出し、v2からv3をatomicに公開する | Accepted |
| override境界 | normal recommendationを改変せず、feasibility、human reason、single-use audit、再解析を別authorityとして扱う | Accepted |
| 規範例 | critical対priority、unlock、gate近傍、parallel set、resource blocker、empty set、override境界を検証できる | Accepted |
| migration | fixture、Core、explanation、v3公開、shadow、normal authority、override applyをgateで分離している | Accepted |
| 現行実装境界 | v3公開前のv2 fieldをrecommendationと解釈せず、未完成resultをCLI/helpへ公開しない | Accepted |
| 実装順序 | 文法受け入れ後は操作系を優先し、recommendationとIssue #2は操作系を遅らせない場合だけ並行する | Accepted |

## 4. 実装へ送る条件

次のproduct implementationは、grammar acceptance後の`M1_ROADMAP_UPDATE`で[操作系詳細plan](../../plans/operations.pert)へ詳細化した。

1. `FORMATTER_CORE`と`MUTATION_PREVIEW`を最初の実装trackとする
2. 両方の受け入れ後に`WRITE_SAFETY`を実装する
3. safe-write後に`ADVANCE`を次の操作系taskとし、Mermaid trackとのresource順はMVP全体完了を短縮するschedule判断へ従う
4. MIG-01からMIG-07とIssue #2は共有CLI・reviewerが操作系と競合するため、`M3_SAFE_WRITE_READY`以降へ送る
5. Human override applyであるMIG-08は`M3_SAFE_WRITE_READY`より前へ出さない

この順序はrecommendation設計の不備を示すものではない。現在のread-only自己利用で不足している操作能力を先に解消するproduct priorityである。ただし、操作系内部の局所priorityを理由にMVP全体の完了予測を悪化させない。

## 5. 残事項

- [操作系詳細plan](../../plans/operations.pert)の`SAFE_WRITE_ACCEPTANCE`以降の実装と、追加完了実績によるVelocity再calibration
- MIG-01からMIG-08の実装
- Issue #2のprovider別AI Agent Guidance Registry設計・実装
- Issue #3のbacklog階層・multi-plan composition設計
- Mermaid metadata schemaと変換実装

これらは未実装または将来設計であり、Issue #1のrecommendation契約を受け入れるうえでの設計blockerではない。
