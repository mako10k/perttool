# perttool Mutation Semantics仕様

- 文書状態: Draft 0.1
- Mutation semantics version: 1
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- DSL文法: [dsl-grammar.md](dsl-grammar.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- CLI interface: [interfaces.md](interfaces.md)
- 対応基本設計: [../basic-design.md](../basic-design.md)

## 1. 目的とscope

本書は`.pert`文書に対するsource-preserving mutationのCore契約を定義する。Mutationは既存文書を直接書かず、局所的なUTF-16 `TextEdit`、再検査済みcandidate、digest、unified diffを返す。

Mutation semantics version 1の最初の実装scopeはtaskの`add`、`set`、`remove`、`finish`である。Milestone/resource mutation、filesystem write、`dag advance`は本書の共通不変条件を再利用する後続sliceとし、今回のtask Core実装には含めない。

## 2. 規範の優先順位

文書間に不一致がある場合は次の順で解消する。

1. `docs/requirements.md`のMust requirement
2. [DSL文法仕様](dsl-grammar.md)の構文、field、validation規則
3. [Graph Semantics仕様](graph-semantics.md)のstateとDAG規則
4. 本書のmutation request、TextEdit、comment所有規則
5. [CLI Interface仕様](interfaces.md)のcommand、option、serialization規則
6. `docs/basic-design.md`とhelp/sample

CLIは本書のCore requestへoptionを投影する。CLI adapterがtarget解決、field mutation、candidate validationを再実装してはならない。

## 3. Core API

```ts
planMutation(
  text: string,
  mutation: TaskMutation,
  options?: MutationOptions,
): MutationResult
```

`MutationOptions`は`maxDiagnostics`、`originalLabel`、`updatedLabel`を持つ。Diff labelのdefaultは`original`と`updated`である。Coreはpath、clock、process stateを参照しない。

Conceptual request model:

```ts
type TaskMutation =
  | {
      kind: "task.add";
      id: string;
      from: string;
      to: string;
      task: TaskDefinition;
    }
  | {
      kind: "task.set";
      id: string;
      from?: string;
      to?: string;
      set?: TaskFieldSet;
      clear?: TaskClearableField[];
      addTags?: string[];
      removeTags?: string[];
      upsertRequirements?: TaskRequirementInput[];
      removeRequirements?: string[];
    }
  | { kind: "task.remove"; id: string }
  | { kind: "task.finish"; id: string };
```

`TaskDefinition`は`title`と、`duration`または`estimate`のexactly oneを必須とする。Optional fieldは`description`、`status`、`priority`、`requirements`、`owner`、`tags`、`blockedReason`、`source`である。

`TaskFieldSet`は`title`、`description`、`duration`または`estimate`、`status`、`priority`、`owner`、`blockedReason`、`source`を持てる。Clear対象はCLI契約と同じ`description`、`status`、`priority`、`owner`、`blocked_reason`、`source`、`tags`、`requires`である。

`estimate`は`optimistic`、`mostLikely`、`pessimistic`をすべて持つ。Requirementは`resourceId`と`units`を持つ。Durationはsuffixを含むDSL literalとして受け取り、candidate parserとvalidatorがproject unitを検査する。

Request modelに存在しない`kind`またはfield、型の異なるfieldは`PTMUT-301`とする。JavaScript callerからの入力も例外で中断せず、同じrequest diagnostic境界で扱う。

## 4. 共通処理とresult

処理順は次で固定する。

1. original textを`checkDocument`する
2. UTF-8 byte列のSHA-256を`originalDigest`とする
3. request shapeと競合optionを検査する
4. targetをexactly one解決する
5. source spanに対するTextEditを作る
6. editを`startOffset`、`endOffset`の昇順へ正規化し、overlapを拒否する
7. editをoffset降順で適用する
8. candidateを`checkDocument`する
9. candidateがvalidな場合だけupdated text、digest、diff、editを公開する

Core result:

```ts
interface MutationResult {
  ok: boolean;
  changed: boolean;
  originalDigest: string;
  updatedDigest: string | null;
  updatedText: string | null;
  diff: string | null;
  edits: readonly TextEdit[];
  diagnostics: readonly Diagnostic[];
  diagnosticsTruncated: boolean;
}
```

Rules:

- originalがinvalidならoriginal diagnosticを返し、candidateとeditを返さない
- request/target errorなら`PTMUT-*` diagnosticを返し、candidateとeditを返さない
- candidateがinvalidならcandidate diagnosticを返し、candidateとeditを返さない
- validなno-opは`ok=true`、`changed=false`、`updatedText=original`、同じdigest、`diff=""`、`edits=[]`とする
- validな変更はcandidateのwarningを保持する。Warningだけでは`ok=false`にしない
- digest表現は`sha256:<64 lowercase hex digits>`とする
- `TextEdit`のoffsetは0-based UTF-16 code unitで、rangeは半開区間とする
- I/O、path解決、write mode、optimistic lockはCoreに含めない

Unified diffはLFでserializeし、最初に`--- <originalLabel>`、`+++ <updatedLabel>`を置く。変更領域の前後3行をcontextとする1 hunkを返す。同じ入力、request、optionからbyte-identicalなdiffを返す。

## 5. Source-preserving TextEdit

### 5.1 共通規則

- BOM、主要line ending、既存declaration順、既存field順を保持する
- 変更しないdeclaration、field、comment、blank lineをreplacementへ取り込まない
- headerの`from`/`to`は対応する`fromSpan`/`toSpan`だけを置換する
- scalar fieldは原則として`valueSpan`だけを置換する
- block textとtiming kind変更はfield span単位で置換する。既存estimate値とrequirement unitsはchild spanだけを置換する
- 新規fieldは既存fieldを並べ替えず、DSL文法仕様のcanonical field order上の位置へ挿入する
- 同じoffsetへ複数fieldを挿入する場合はcanonical field orderで1つのeditへまとめる
- candidate validationに成功しない限り、内部で作成したeditをresultへ露出しない

### 5.2 comment所有と削除

Declarationまたはfieldの直前にあり、blank lineを挟まない同一structural levelの連続commentを、そのelementのleading commentとする。

- declaration削除ではcolumn 0のleading commentを一緒に削除する
- field削除では2 spaces indentのleading commentを一緒に削除する
- leading commentより前のblank lineは削除しない
- element後のcomment、異なるindentのcomment、block text内の`#`は削除しない
- field値の変更ではleading commentを変更しない
- 新規fieldは後続fieldのleading commentより前へ挿入し、comment所有を移動しない

### 5.3 serialization

新規taskと新規fieldはDSL文法仕様のcanonical serializerに従う。

- indentationは2 spaces、nested fieldは4 spaces
- StringはJSON互換escapeを使う
- 1行textはString、改行を含むtextはblock textを使う。先頭/末尾改行をblock textで保持できない場合はescapeしたStringを使う
- duration decimalの不要なleading/trailing zeroを除く
- bare tagにできないtagはStringとしてserializeする
- task field orderは`title`、`description`、`duration|estimate`、`status`、`priority`、`requires`、`owner`、`tags`、`blocked_reason`、`source`
- estimate orderは`optimistic`、`most_likely`、`pessimistic`
- requirement orderはrequestまたは既存sourceの順を保持する

## 6. `task.add`

- original documentの全entity IDに対して追加IDが未使用であることを要求する
- task headerとrequired/optional fieldをcanonical serializeする
- 新規declarationはdocument末尾へ追加する
- 既存末尾triviaと新規declarationの間にblank lineがなければ1行追加し、末尾commentを新規taskのleading commentへ変えない
- trailing standalone commentとblank lineのtext/順序を保持する
- endpoint、resource、duration unit、blocked stateなどの正当性はcandidate全体のvalidatorで検査する

## 7. `task.set`

`task.set`は少なくとも1つの変更指定を必要とする。同じfieldを`set`と`clear`の両方へ指定してはならない。

### 7.1 durationとestimate

- `set.duration`と`set.estimate`は相互排他
- durationへ変更する場合は既存`duration`または`estimate`をduration fieldへ置換する
- estimateへ変更する場合は既存`duration`または`estimate`をestimate blockへ置換する
- timing fieldはrequiredなのでclear対象に含めない

### 7.2 tag

- `addTags`は既存順を保持して未存在tagだけをrequest順に末尾追加する
- `removeTags`は指定tagを削除し、存在しないtagはno-opとする
- 同じtagをadd/removeの両方へ指定するとrequest error
- `clear tags`とadd/removeは併用不可
- 結果がemptyなら`tags` field自体を削除する

### 7.3 requirement

- `upsertRequirements`は既存resourceのunitsをその位置で置換し、未存在resourceをrequest順に末尾追加する
- `removeRequirements`は指定resourceを削除し、存在しないresourceはno-opとする
- 同じresourceをupsert/removeの両方へ指定するとrequest error
- `clear requires`とupsert/removeは併用不可
- 結果がemptyなら`requires` field自体を削除する

Candidateの`status=blocked`と`blocked_reason`、required field、DAG、resource constraintは通常のdocument validatorで検査する。Coreはinvalidな組合せを暗黙補正しない。

## 8. `task.remove`と`task.finish`

### 8.1 remove

`task.remove`はtask declarationとそのleading commentだけを削除する。Endpoint milestone、resource、他edgeをcascade削除しない。削除後にroot、finish reachability、join、resource、その他graph ruleが不正になる場合はcandidate validation errorとしてmutation全体を拒否する。

### 8.2 finish

`task.finish`はstatusを`done`へ設定する。Status fieldがなければcanonical positionへ追加する。既存`blocked_reason`は`done`と両立しないため同じmutationで削除する。すでに`done`で`blocked_reason`がなければvalidなno-opとする。

## 9. Mutation diagnostic

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTMUT-301` | error | request shape不正、変更指定なし、相互排他違反 |
| `PTMUT-302` | error | target IDが存在しない |
| `PTMUT-303` | error | target IDは存在するがtaskではない |
| `PTMUT-304` | error | addするIDが既存entityと重複する |

`PTMUT-*`はmutation request/targetのerrorだけに使用する。Candidateのsyntax、field、graph errorを`PTMUT-*`へ包み直さず、既存`PTDSL-*`、`PTSEM-*`、`PTDAG-*`を保持する。

## 10. Acceptance invariants

最低限次を自動検査する。

1. addがcanonical taskを1つ追加し、BOM、line ending、trailing triviaを保持する
2. setがheader/scalar/estimate/tag/requirementへ非重複の局所TextEditを返す
3. clearがelement所有commentだけを削除する
4. finishがstatusをdoneにし、blocked_reasonを除去し、再実行でno-opになる
5. removeがcascadeせず、valid removalだけを受け入れる
6. missing/wrong-kind/duplicate/no-change-optionをstable `PTMUT-*`で拒否する
7. invalid originalとinvalid candidateでcandidate/editを露出しない
8. candidateのtarget fieldがrequestと一致し、無関係declaration/fieldのsemantic valueが不変である
9. TextEditがUTF-16 offsetで昇順、非重複で、適用結果が`updatedText`と一致する
10. digestとunified diffが同じinput/request/optionsから決定的に再現される
