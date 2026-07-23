# NextResult.v3 consumer migration guide

- 対象: `Perttool.NextResult.v2`を読むCLI／library consumer
- 移行先: `Perttool.NextResult.v3`
- 公開日: 2026-07-23
- 規範仕様: [Recommendation Interface Contract](../specs/recommendation-interface.md)

## 1. Breaking change

`dag next`のdefault JSON schemaはv2からv3へ変わった。v2を同時出力するoptionはない。

v3はv2の`groups`、`tasks`、`resource_rejections`、upcoming `explanation`の意味を維持し、rootへ次を追加する。

```text
schema_version                    "Perttool.NextResult.v3"
recommendation_interface_version  1
recommendation                    complete RecommendationAnalysis
```

`groups.ready`は開始可能性、`groups.runnable_now`は既存schedulerが選んだresource-feasible subsetである。どちらもrecommendationの別名ではない。開始authorityはroot `recommendation`だけから読む。

## 2. Schemaを最初に検査する

Consumerは他fieldへ触れる前に`schema_version`を検査する。

```js
const result = JSON.parse(stdout);

if (result.schema_version !== "Perttool.NextResult.v3") {
  throw new Error(`unsupported dag next schema: ${result.schema_version}`);
}
if (result.recommendation_interface_version !== 1) {
  throw new Error("unsupported recommendation interface");
}

const recommendation = result.recommendation;
if (
  recommendation.algorithm.id !==
    "perttool.recommendation-ranking.lexicographic-frontier" ||
  recommendation.algorithm.version !== 1 ||
  recommendation.reason_taxonomy_version !== "1.0" ||
  recommendation.explanation_model_version !== 1 ||
  recommendation.expression_version !== 1 ||
  recommendation.description_registry_version !== 1
) {
  throw new Error("unsupported decisive recommendation semantics");
}
if (
  recommendation.explanation_status.complete !== true ||
  recommendation.explanation_status.truncated !== false
) {
  throw new Error("incomplete recommendation graph");
}
```

Unknown tier、decisive rule、reason code、expression nodeまたはmodel versionを既知値へ変換しない。理解していないdecisive semanticsがある場合、taskを自動開始しない。

## 3. 推奨taskを読む

`recommended_task_ids`は現在cycleで同時開始できる集合である。配列順を実行順とみなさない。1 taskを開始したらproject stateを更新し、同じresultを再利用せず`dag next`を再実行する。

Ready taskが0件でも`recommendation`、result decision、joint feasibility factは存在する。`recommended_task_ids=[]`は正常resultであり、errorではない。Ready taskが存在してもactive allocationによりrecommended setがemptyになる場合がある。

各actual ready taskには`task_decisions`がexactly one存在する。

```js
for (const decision of recommendation.task_decisions) {
  switch (decision.tier) {
    case "recommended":
      // normal start authority
      break;
    case "allowed":
      // recommended workを維持した追加workとしてのみ開始可能
      break;
    case "deferred":
    case "discouraged":
      // human overrideなしに開始しない
      break;
    default:
      throw new Error(`unknown recommendation tier: ${decision.tier}`);
  }
}
```

`algorithm.optimal=false`を省略せず、この結果をglobal optimumの証明として表示しない。

## 4. 「なぜAでBではないか」を読む

Task decisionから次の順にreferenceを辿る。

1. `summary_description_id`からcanonical English summaryを取得する
2. `primary_higher_priority_task_id`でprimary alternativeを確認する
3. `decisive_step_id`から適用ruleとexact expressionを取得する
4. `comparison_ids`からwinner、alternative、prior tie、contributing ruleを取得する
5. step／comparisonの`fact_ids`からtyped value、unit、provenanceを取得する

`descriptions[].text`は表示用projectionであり、authorityの正本ではない。欠けたruleやfactをtextから逆推論しない。Active allocationだけがresource conflictを起こす場合、comparisonのwinner／loser taskは`null`であり、ready taskを捏造しない。

## 5. TextとJSON

Text outputは4 tier sectionを持つ人間向けsummaryで、headerに`complete=false`と`--format json`導線を表示する。AutomationとAI agentはcomplete graphを持つJSONを使用する。

```sh
perttool dag next PLAN.pert --format json
```

Recommendation invariant failureは成功したv3を返さず、`PTREC-301`から`PTREC-303`とexit `70`になる。Ready task 0件やempty recommended setとは区別する。

## 6. Library consumer

`selectNextTasks`はpublic `NextResultV3`を返す。成功時の`recommendation`はcompleteで、`recommendationAnalysisToJson`がCLIと同じsnake_case wire projectionを生成する。

```js
import { recommendationAnalysisToJson, selectNextTasks } from "perttool";

const result = selectNextTasks(sourceText);
if (!result.ok || result.recommendation === null) {
  throw new Error(result.diagnostics.map(({ code }) => code).join(","));
}
const wireRecommendation = recommendationAnalysisToJson(result.recommendation);
```

Filesystem bytesのdigestをroot resultと一致させるadapterは、`NextOptions.sourceDigest`へread時の`sha256:` digestを渡す。Stringだけを渡すlibrary callではUTF-8 textから決定的にdigestを生成する。
