# NextResult.v3 consumer migration guide

- 対象: `Perttool.NextResult.v2`を読むCLI／library consumer
- 移行先: `Perttool.NextResult.v3`
- 公開日: 2026-07-23
- Normal authority採用日: 2026-07-23
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
  recommendation.description_registry_version !== 1 ||
  recommendation.description_locale !== "en"
) {
  throw new Error("unsupported decisive recommendation semantics");
}
if (
  recommendation.explanation_status.complete !== true ||
  recommendation.explanation_status.decisive_chain_complete !== true ||
  recommendation.explanation_status.truncated !== false ||
  Object.values(
    recommendation.explanation_status.omitted_counts,
  ).some((count) => count !== 0) ||
  result.diagnostics.some(({ code }) => code.startsWith("PTREC-"))
) {
  throw new Error("incomplete recommendation graph");
}
```

Unknown tier、decisive rule、reason code、expression nodeまたはmodel versionを既知値へ変換しない。理解していないdecisive semanticsがある場合、taskを自動開始しない。

## 3. 推奨taskを読む

`recommended_task_ids`は現在cycleで同時開始できる集合である。配列順を実行順とみなさない。Normal authorityではrecommended taskの1件以上のsubset、またはrecommended set全件を維持してresource-feasibleな`allowed` taskを1件だけ追加した集合を選べる。Allowed taskでrecommended taskを置き換える選択と、`deferred`または`discouraged`の選択はnormal authority外である。1 taskを開始したらproject stateを更新し、同じresultを再利用せず`dag next`を再実行する。

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

Perttool自身のAI開発では、5 plan shadowとMIG-07 dry-runの受け入れ後、knownかつcompleteな本JSONをnormal task selection authorityとして採用した。Macro planのrecommendationでworkstreamを選んでから対応detail planを再解析し、異なるdetail planを直接比較しない。Unknownまたはincompleteなcontractではtask IDを返さず停止する。Human override apply/auditは別gateであり、read-only artifactだけから実行済みとみなさない。

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

## 7. Read-only human override validation

`validateOverride`はsuccessfulかつcompleteな`NextResultV3`と明示requestだけを入力にし、normal recommendationを変更せず`Perttool.OverrideDecision.v1`を返す。Allowed replacement、deferred selection、将来のdiscouraged selectionだけがoverride triggerになり、normal authority内のselectionは`PTOVR-106`、non-readyは`PTOVR-103`、resource-infeasibleなreplacementは`PTOVR-104`でartifactを生成しない。

```js
import {
  canonicalOverrideArtifact,
  selectNextTasks,
  validateOverride,
} from "perttool";

const source = selectNextTasks(sourceText);
if (!source.ok || source.recommendation === null) {
  throw new Error("complete source recommendation is required");
}

const validation = validateOverride(source, {
  sourceSchemaVersion: "Perttool.NextResult.v3",
  sourceDigest: source.recommendation.sourceDigest,
  sourceResultDecisionId: source.recommendation.resultDecision.id,
  selectedTaskIds: ["DEFERRED_TASK"],
  actor: {
    kind: "human",
    id: "maintainer@example.com",
    authentication: "caller_asserted",
  },
  decidedAt: "2026-07-23T12:34:56Z",
  reasonCode: "human_priority_decision",
  reasonText: "Explicitly choose this feasible replacement now.",
  evidenceReferences: [{ kind: "issue", value: "ISSUE-123" }],
  acknowledgedNegativeFactReasonIds: [],
});

if (!validation.ok) {
  throw new Error(validation.diagnostics.map(({ code }) => code).join(","));
}
const canonicalRecord = canonicalOverrideArtifact(validation);
```

同じsourceとrequestは同じ`override_id`とcanonical recordを返す。Actorはperttool認証済みではなく`caller_asserted`であり、現在時刻を自動挿入しない。`reasonText`とevidenceへsecret、credential、tokenを含めてはならない。

これはread-only Core APIである。Task state、file、Git、networkを変更せず、overrideを適用またはaudit sinkへ保存するCLIもまだ提供しない。MIG-08より前にcanonical artifactを実行許可や適用済みauditとして扱わない。
