# perttool DSL 文法仕様

- 文書状態: Draft 0.1
- Grammar version: 1
- 作成日: 2026-07-21
- 対応要件: [../requirements.md](../requirements.md)
- 対応基本設計: [../basic-design.md](../basic-design.md)

## 1. 目的

本書は、`.pert` 文書の字句規則、構文、block ごとの field、既定値、構文検査と意味検査の境界、source span、error recovery、formatting 契約を定義する。

本書の EBNF と field table は grammar version 1 の規範である。代表的な正規文書は次を参照する。

- [minimal.pert](../examples/minimal.pert)
- [parallel.pert](../examples/parallel.pert)

## 2. 規範の優先順位

文書間に不一致がある場合は、次の順で解消する。

1. `docs/requirements.md` の Must requirement
2. 本書の grammar、field table、validation rule
3. `docs/basic-design.md` の実装構造
4. `docs/examples/*.pert`
5. CLI/MCP help の表示内容

不一致を発見した場合は、低い順位の artifact だけを場当たり的に直さず、同じ変更で必要な artifact と test を同期する。

## 3. 設計原則

- 行ベースとする
- block は indentation で表す
- top-level declaration は `project`、`resource`、`milestone`、`task`、`gate` に限定する
- task と gate の endpoint は header に置き、edge であることを見た目で分かるようにする
- 参照には title ではなく安定 ID を使う
- field order と declaration order は意味に影響しない
- 未知の field や keyword を黙って無視しない
- 独立行 comment と blank line を CST に保持する
- inline comment は grammar version 1 に含めない
- formatter と parser が同じ grammar version を共有する

## 4. 文字とファイル

### 4.1 encoding

- file encoding は UTF-8 とする
- UTF-8 BOM は file 先頭だけで受理する
- BOM は意味を持たず、source-preserving operation では保持する
- canonical serializer は BOM を出力しない
- 不正な UTF-8 byte sequence は file read error とし、parser へ渡さない

### 4.2 line ending

- LF と CRLF を受理する
- 1 文書内で LF と CRLF が混在する場合は warning とする
- parser は最後の physical line に line ending がなくても受理する
- lexer は grammar 上の処理のため EOF 直前に仮想 `NEWLINE` を置いてよい
- 仮想 `NEWLINE` の source span は長さ 0 とする
- source-preserving formatter は既存の主要 line ending を維持する
- canonical serializer は LF と末尾 newline を使用する

### 4.3 source position

- 内部 offset、line、column は 0 始まりとする
- offset と column は UTF-16 code unit 基準とする
- CLI 表示では line と column を 1 始まりへ変換する
- span は `[start, end)` の半開区間とする
- raw file digest と file size は UTF-8 byte 列を対象にする

## 5. indentation と空白

### 5.1 structural indentation

- structural indentation は ASCII space のみを使用する
- 1 level は 2 spaces とする
- top-level declaration は column 0 から始める
- declaration field は 2 spaces indent する
- `estimate` と `requires` の子 field は 4 spaces indent する
- block text の content は、所有 field より少なくとも 2 spaces 深くする
- syntax 部分の tab は lexical error とする
- block text の共通 indent より後にある tab は text として保持できる
- 規定 level より深い、意味を持たない over-indent は error とする

### 5.2 horizontal whitespace

EBNF の `HSPACE` は1個以上の ASCII space、`OWS` は0個以上の ASCII spaceを表す。

- keyword と value の間には `HSPACE` が必要である
- task/gate header の `->` 前後には `HSPACE` が必要である
- colon の直前に space を置かない
- list の comma 前に spaceを置かない
- list の comma 後、`[` 後、`]` 前には `OWS` を置ける
- syntax line の末尾 ASCII space は受理するが warning 候補とし、formatter が除去する
- block text の末尾 space は text として保持する

### 5.3 blank line

- blank line は top-level、declaration body、estimate body に置ける
- blank line 上の space は構造に影響しない
- formatter は source-preserving mode で blank line の位置と個数を保持する

## 6. comment

### 6.1 syntax

comment は、その行の indentation の後に `#` を置く独立行とする。

```pert
# top-level comment
milestone READY:
  # field comment
  title "準備完了"
```

Rules:

- `#` から line ending 直前までを comment text とする
- comment は現在の structural level と同じ indentation に置く
- inline comment は許可しない
- quoted string 内の `#` は string content である
- block text 内の `#` は block text content である
- comment は AST の意味 model に含めず、CST trivia として保持する
- comment だけから ID、依存、状態を導出しない

### 6.2 ownership

source-preserving edit では comment の位置を維持する。

- declaration 直前の連続 comment はその declaration の leading trivia とする
- field 直前の同一 block level の連続 comment はその field の leading trivia とする
- declaration/field 後の comment はその位置の standalone trivia とする
- element 削除時の comment 所有規則は mutation 仕様で確定する

## 7. lexical token

### 7.1 Identifier

```ebnf
Identifier = ASCIIAlpha, { ASCIIAlpha | Digit | "-" | "_" } ;
ASCIIAlpha = "A" ... "Z" | "a" ... "z" ;
Digit      = "0" ... "9" ;
```

Rules:

- ID は case-sensitive とする
- Unicode normalization は行わない
- entity ID と endpoint reference には同じ lexical rule を使う
- bare tag にも同じ文字集合を使用できる
- exact lowercase の予約語は entity ID と endpoint ID に使用できない
- bare tag では予約語を使用できる

予約語:

```text
project resource milestone task gate
version title description as_of duration_unit finish
critical_epsilon target_duration state tags
duration estimate optimistic most_likely pessimistic
status priority owner blocked_reason source reason
capacity requires
planned reached active blocked done
day hour
```

### 7.2 Integer

```ebnf
Integer = Digit, { Digit } ;
```

- sign と exponent は許可しない
- grammar version 1 では `version`、resource `capacity`、task `priority`、resource requirement量に使用する
- field validatorは0..2147483647の範囲だけを受理する
- leading zero は構文上受理するが、formatter は除去する

### 7.3 Decimal

```ebnf
Decimal = Digit, { Digit }, [ ".", Digit, { Digit } ] ;
```

Valid:

- `0`
- `2`
- `0.5`
- `12.25`

Invalid:

- `.5`
- `2.`
- `+2`
- `-1`
- `1e3`
- `NaN`
- `Infinity`

Decimal は有限10進数から正確な Rational へ変換する。

### 7.4 Duration

```ebnf
Duration = Decimal, DurationSuffix ;
DurationSuffix = "d" | "h" ;
```

- suffix は必須とする
- space を Decimal と suffix の間に置かない
- `d` は `duration_unit day`、`h` は `duration_unit hour` に対応する
- `0d` と `0h` は lexical/syntax 上は有効とする
- task duration と estimate の正値条件は field validation で検査する
- 文書の project unit と異なる suffix は semantic error とする

### 7.5 String

String は JSON string literal と同じ double-quoted 形式を使う。

```ebnf
String = '"', { StringCharacter | EscapeSequence }, '"' ;
EscapeSequence = "\\\"" | "\\\\" | "\\/" | "\\b" | "\\f"
               | "\\n" | "\\r" | "\\t" | UnicodeEscape ;
UnicodeEscape  = "\\u", HexDigit, HexDigit, HexDigit, HexDigit ;
```

Rules:

- literal newline と U+0000..U+001F は string 内に直接置けない
- Unicode character は escape せず直接記述できる
- 不正な escape は lexical error とする
- unpaired surrogate になる `\uXXXX` は error とする
- decoded string は Unicode normalization しない
- canonical formatter は JSON escaping を使う

### 7.6 ISO date/date-time

```ebnf
IsoDate     = Year, "-", Month, "-", Day ;
IsoDateTime = IsoDate, "T", Hour, ":", Minute, ":", Second,
              [ Fraction ], Offset ;
Fraction    = ".", Digit, { Digit } ;
Offset      = "Z" | ( "+" | "-" ), Hour, ":", Minute ;
Year        = Digit, Digit, Digit, Digit ;
Month       = Digit, Digit ;
Day         = Digit, Digit ;
Hour        = Digit, Digit ;
Minute      = Digit, Digit ;
Second      = Digit, Digit ;
```

Rules:

- calendar 上存在しない日付や時刻は field validation error とする
- date-time は `T` と `Z` を uppercase で記述する
- timezone offset のない local date-time は許可しない
- leap second は grammar version 1 では許可しない
- `as_of` は date または date-time を取る

### 7.7 TagList

```ebnf
TagList = "[", OWS, [ Tag, { OWS, ",", OWS, Tag } ], OWS, "]" ;
Tag     = Identifier | String ;
```

- bare Identifier と String はどちらも decoded string へ正規化する
- 空 list `[]` を許可する
- trailing comma は許可しない
- duplicate tag は semantic error とする
- ASCII Identifier として安全な tag は canonical formatter で bare 表記にできる
- それ以外は String で出力する

## 8. block text

### 8.1 syntax

複数行 text field は `|` marker を使う。

```pert
description |
  1行目
  2行目

  4行目は空行を挟む
```

Rules:

- `|` の後は trailing space を除き何も置かない
- 次の nonblank line は所有 field より少なくとも1 level深くする
- block text は1行以上の nonblank contentを必要とする
- block内のnonblank lineの最小indentをcommon indentとする
- 各 nonblank line から common indent を除去する
- common indent より深い space/tab は content として保持する
- nonblank content 間の blank line は `\n` として保持する
- 次の structural line 直前にある blank line は、後続に block content がなければ structural trivia とする
- AST text は line を `\n` で結合し、terminal newline を保持しない
- `#`、`:`、`->`、quote は block text 内で特別な意味を持たない

### 8.2 TextValue

次の field は String または block text を取る。

- `description`
- `blocked_reason`
- `reason`

`title`、`owner`、`source` は String だけを取る。

## 9. indentation token

parser grammar は lexer が生成する次の token を使う。

- `NEWLINE`
- `INDENT`
- `DEDENT`
- `COMMENT`
- `BLOCK_TEXT`
- lexical token
- `EOF`

Rules:

- `INDENT` は structural level が1段深くなった位置で生成する
- `DEDENT` は1段戻るごとに1個生成する
- 2 levels 以上を一度に深くする indentation は error とする
- blank/comment line だけでは indent stack を変更しない
- block text mode では content indentation を structural `INDENT/DEDENT` に変換しない
- invalid indentation 後も、最も近い有効な lower level へ回復できる

## 10. 完全 EBNF

この EBNF は indentation token 化後の token stream を対象とする。keyword は case-sensitive な literal である。

```ebnf
Document = Trivia, ProjectDecl,
           { Trivia, Declaration }, Trivia, EOF ;

Declaration = ResourceDecl | MilestoneDecl | TaskDecl | GateDecl ;

Trivia = { NEWLINE | CommentLine } ;
BlockTrivia = NEWLINE | CommentLine ;
CommentLine = COMMENT, NEWLINE ;

ProjectDecl = "project", HSPACE, Identifier, ":", NEWLINE,
              INDENT, ProjectEntry, { ProjectEntry }, DEDENT ;
ProjectEntry = BlockTrivia | ProjectField ;
ProjectField = VersionField
             | TitleField
             | DescriptionField
             | AsOfField
             | DurationUnitField
             | FinishField
             | CriticalEpsilonField
             | TargetDurationField ;

VersionField = "version", HSPACE, Integer, NEWLINE ;
TitleField = "title", HSPACE, String, NEWLINE ;
DescriptionField = "description", HSPACE, TextValue ;
AsOfField = "as_of", HSPACE, ( IsoDateTime | IsoDate ), NEWLINE ;
DurationUnitField = "duration_unit", HSPACE, ( "day" | "hour" ), NEWLINE ;
FinishField = "finish", HSPACE, Identifier, NEWLINE ;
CriticalEpsilonField = "critical_epsilon", HSPACE, Duration, NEWLINE ;
TargetDurationField = "target_duration", HSPACE, Duration, NEWLINE ;

ResourceDecl = "resource", HSPACE, Identifier, ":", NEWLINE,
               INDENT, ResourceEntry, { ResourceEntry }, DEDENT ;
ResourceEntry = BlockTrivia | ResourceField ;
ResourceField = TitleField
              | DescriptionField
              | CapacityField
              | TagsField ;
CapacityField = "capacity", HSPACE, Integer, NEWLINE ;

MilestoneDecl = "milestone", HSPACE, Identifier, ":", NEWLINE,
                INDENT, MilestoneEntry, { MilestoneEntry }, DEDENT ;
MilestoneEntry = BlockTrivia | MilestoneField ;
MilestoneField = TitleField
               | DescriptionField
               | StateField
               | TagsField ;
StateField = "state", HSPACE, ( "planned" | "reached" ), NEWLINE ;
TagsField = "tags", HSPACE, TagList, NEWLINE ;

TaskDecl = "task", HSPACE, Identifier,
           HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
           ":", NEWLINE,
           INDENT, TaskEntry, { TaskEntry }, DEDENT ;
TaskEntry = BlockTrivia | TaskField ;
TaskField = TitleField
          | DescriptionField
          | DurationField
          | EstimateField
          | StatusField
          | PriorityField
          | RequirementsField
          | OwnerField
          | TagsField
          | BlockedReasonField
          | SourceField ;
DurationField = "duration", HSPACE, Duration, NEWLINE ;
StatusField = "status", HSPACE,
              ( "planned" | "active" | "blocked" | "done" ), NEWLINE ;
PriorityField = "priority", HSPACE, Integer, NEWLINE ;
OwnerField = "owner", HSPACE, String, NEWLINE ;
BlockedReasonField = "blocked_reason", HSPACE, TextValue ;
SourceField = "source", HSPACE, String, NEWLINE ;

EstimateField = "estimate", ":", NEWLINE,
                INDENT, EstimateEntry, { EstimateEntry }, DEDENT ;
EstimateEntry = BlockTrivia | EstimateValueField ;
EstimateValueField = OptimisticField | MostLikelyField | PessimisticField ;
OptimisticField = "optimistic", HSPACE, Duration, NEWLINE ;
MostLikelyField = "most_likely", HSPACE, Duration, NEWLINE ;
PessimisticField = "pessimistic", HSPACE, Duration, NEWLINE ;

RequirementsField = "requires", ":", NEWLINE,
                    INDENT, RequirementEntry, { RequirementEntry }, DEDENT ;
RequirementEntry = BlockTrivia | ResourceRequirement ;
ResourceRequirement = Identifier, HSPACE, Integer, NEWLINE ;

GateDecl = "gate", HSPACE, Identifier,
           HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
           ":", NEWLINE,
           INDENT, GateEntry, { GateEntry }, DEDENT ;
GateEntry = BlockTrivia | GateField ;
GateField = ReasonField ;
ReasonField = "reason", HSPACE, TextValue ;

TextValue = String, NEWLINE | "|", NEWLINE, BLOCK_TEXT ;

TagList = "[", OWS, [ Tag, { OWS, ",", OWS, Tag } ], OWS, "]" ;
Tag = Identifier | String ;

Duration = Decimal, ( "d" | "h" ) ;
Decimal = Digit, { Digit }, [ ".", Digit, { Digit } ] ;
Integer = Digit, { Digit } ;
Identifier = ASCIIAlpha, { ASCIIAlpha | Digit | "-" | "_" } ;

HSPACE = " ", { " " } ;
OWS = { " " } ;
```

`String`、`IsoDate`、`IsoDateTime`、`BLOCK_TEXT` は前節の lexical rule に従う。

## 11. document rule

### 11.1 top-level

- `project` は exactly one とする
- `project` は trivia を除く最初の declaration とする
- project 後には resource、milestone、task、gate を任意個置ける
- project を2個以上置けない
- project より前に resource/milestone/task/gate を置けない
- top-level に field や estimate を直接置けない
- include/import directive は grammar version 1 に含めない

### 11.2 declaration

- forward reference を許可する
- task/gate より後で endpoint milestone を宣言できる
- declaration order は意味に影響しない
- task/gate が同じ from/to pair を持つ parallel edge を許可する
- entity ID は project、resource、milestone、task、gate を通じて文書全体で一意とする
- endpoint は milestone ID だけを参照できる
- taskのresource requirementはresource IDだけを参照できる
- resource requirementは共有/容量制約であり、DAGのprecedence edgeには変換しない
- title と ID は別物であり、title を参照解決に使用しない

## 12. field table

### 12.1 project

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `version` | 0..1 | Integer | 省略時1。v1 parser は1だけを受理 |
| `title` | 1 | String | decoded text は nonempty |
| `description` | 0..1 | TextValue | 指定時 nonempty |
| `as_of` | 0..1 | ISO date/date-time | 実在する日時 |
| `duration_unit` | 1 | `day` or `hour` | 文書内 duration suffix と一致 |
| `finish` | 1 | Identifier | milestone を参照 |
| `critical_epsilon` | 0..1 | Duration | 省略時 project unit の0。0以上 |
| `target_duration` | 0..1 | Duration | 指定時0より大きい |

### 12.2 resource

resource は task 実行中に占有され、完了時に返却される renewable resource を表す。

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | nonempty |
| `description` | 0..1 | TextValue | 指定時 nonempty |
| `capacity` | 1 | Integer | 1以上。`1`は排他resource |
| `tags` | 0..1 | TagList | 省略時 empty。duplicate 不可 |

### 12.3 milestone

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | nonempty |
| `description` | 0..1 | TextValue | 指定時 nonempty |
| `state` | 0..1 | `planned` or `reached` | 省略時 `planned` |
| `tags` | 0..1 | TagList | 省略時 empty。duplicate 不可 |

### 12.4 task

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `title` | 1 | String | nonempty |
| `description` | 0..1 | TextValue | 指定時 nonempty |
| `duration` | 0..1 | Duration | estimate と排他。0より大きい |
| `estimate` | 0..1 | Estimate block | duration と排他。exactly one required |
| `status` | 0..1 | task status | 省略時 `planned` |
| `priority` | 0..1 | Integer | 省略時0。大きい値をresource scheduleで優先 |
| `requires` | 0..1 | Requirements block | 省略時resource占有なし |
| `owner` | 0..1 | String | 指定時 nonempty |
| `tags` | 0..1 | TagList | 省略時 empty。duplicate 不可 |
| `blocked_reason` | 0..1 | TextValue | status=blocked なら必須、それ以外は禁止 |
| `source` | 0..1 | String | 指定時 nonempty。network accessしない |

task は `duration` または `estimate` のどちらか exactly one を持つ。

`requires` の各行は `<resource-id> <units>` とする。

```pert
requires:
  TEST_DEVICE 1
  DEVELOPERS 2
```

Rules:

- `requires` blockを記述した場合は1件以上のresource requirementを持つ
- units は1以上のInteger
- 同じresource IDを同一task内で重複指定できない
- units は参照resourceのcapacity以下でなければならない
- taskは宣言した全resourceを同時に確保できたときだけ開始できる
- taskは実行区間全体でresourceを保持し、完了時に全量を返却する
- grammar version 1 はpreemption、途中増減、consumable resourceを表現しない

### 12.5 estimate

| Field | Count | Constraint |
| --- | ---: | --- |
| `optimistic` | 1 | 0以上 |
| `most_likely` | 1 | 0以上 |
| `pessimistic` | 1 | 0以上 |

追加 constraint:

- `optimistic <= most_likely <= pessimistic`
- `pessimistic > 0`
- 3 field は同じ suffix を使う
- field order は任意

### 12.6 gate

| Field | Count | Value | Default/constraint |
| --- | ---: | --- | --- |
| `reason` | 1 | TextValue | nonempty |

gate は duration、estimate、status を持てない。

## 13. syntax と semantic validation の境界

### 13.1 parserが検出するもの

- keyword、colon、arrow、bracket、comma の不足
- block を開始しない header
- indentation level の不正
- tab indentation
- invalid Identifier/String/Decimal/Duration/date token
- unknown top-level keyword
- block に許されない unknown field
- closed enum の未知 value
- inline comment
- block text の indentation 不正

### 13.2 field validatorが検出するもの

- required field 不足
- duplicate field
- duration/estimate の排他違反
- estimate の3 field不足/重複/順序制約違反
- zero/positive constraint
- nonempty text constraint
- blocked_reason と status の不整合
- duplicate tag
- resource capacity、task priority、requirement unitsのInteger constraint
- 同一task内のduplicate resource requirement
- project unit と duration suffix の不一致
- version 不一致
- calendar 上不正な as_of

### 13.3 graph validatorへ送るもの

- duplicate entity ID
- reserved word ID
- undefined endpoint/finish
- undefined resource reference
- resource requirementがcapacityを超える状態
- endpoint kind 不一致
- self-loop
- cycle
- finish outdegree
- finish reachability
- root/reached state
- active/done task の始点 reached 条件
- reached milestone と unfinished incoming edge の矛盾

parseまたはfield validationにerrorがある文書から、解析可能なGraphを生成してはならない。

## 14. 初期 diagnostic code

| Code | Meaning | Help topic |
| --- | --- | --- |
| `PTDSL-001` | tabをstructural indentationに使用 | `syntax.indentation` |
| `PTDSL-002` | indentation width/level不正 | `syntax.indentation` |
| `PTDSL-003` | top-level declaration不正 | `syntax.top-level` |
| `PTDSL-004` | declaration header不正 | `syntax` |
| `PTDSL-005` | unknown field | 対応する `syntax.*` |
| `PTDSL-006` | invalid string/escape | `syntax.string` |
| `PTDSL-007` | invalid duration/decimal | `syntax.duration` |
| `PTDSL-008` | invalid date/date-time | `syntax.project` |
| `PTDSL-009` | invalid list | `syntax.tags` |
| `PTDSL-010` | invalid block text | `syntax.text` |
| `PTDSL-011` | inline comment | `syntax.comments` |
| `PTDSL-012` | closed enumのunknown value | 対応する `syntax.*` |
| `PTSEM-101` | required field不足 | 対応する `syntax.*` |
| `PTSEM-102` | duplicate field | 対応する `syntax.*` |
| `PTSEM-103` | field combination不正 | 対応する `syntax.*` |
| `PTSEM-104` | duration/estimate constraint不正 | `syntax.duration` |
| `PTSEM-105` | project unit不一致 | `syntax.duration` |
| `PTSEM-106` | empty text | 対応する `syntax.*` |
| `PTSEM-107` | duplicate tag | `syntax.tags` |
| `PTSEM-108` | unsupported grammar version | `syntax.project` |
| `PTSEM-109` | resource capacity/requirement量不正 | `syntax.resource` |
| `PTSEM-110` | duplicate resource requirement | `syntax.task` |

Graph diagnostic code は `docs/specs/graph-semantics.md` で固定する。

## 15. source span

parser/CST は次の span を保持する。

- document
- declaration全体
- declaration keyword
- entity ID
- task/gate from ID
- arrow
- task/gate to ID
- field全体
- field keyword
- field value
- estimate block全体と各子field
- requirements block全体と各resource requirement
- comment
- block text markerとcontent

Rules:

- diagnostic primary span は修正すべき最小 token/field を指す
- missing token は挿入位置の zero-length span を使う
- duplicate field/ID は後の宣言を primary、先の宣言を related location とする
- invalid endpoint は endpoint token を指す
- block indentation error は先頭 whitespace を指す

## 16. error recovery

parser は1件のerrorで文書全体を捨てず、独立した問題を可能な範囲で報告する。

### 16.1 top-level recovery

- invalid top-level line は次の column 0 の既知 declaration header まで読み飛ばす
- invalid line が colon で終わる場合、その下の indented block も同じ error region として読み飛ばす
- project がない場合も、後続 declaration を recovery AST として収集できる

### 16.2 declaration recovery

- invalid field line は現在 block の次の同 level field/comment/blank lineへ同期する
- invalid field が nested block を開始した場合、その DEDENT まで読み飛ばす
- estimate/requires 内では4-space levelの次 entryまたは所有blockのDEDENTへ同期する
- block text error は所有 field の次の structural lineへ同期する

### 16.3 suppression

- lexical errorを原因とする同一 token のparser errorは重複報告しない
- headerが回復不能なdeclarationについてrequired field errorを追加しない
- invalid duration tokenについてpositive/unit mismatchを追加しない
- parse errorがある文書ではgraph diagnosticを生成しない
- callerは最大diagnostic件数を指定でき、打ち切りを明示する

## 17. formatter contract

### 17.1 source-preserving format

既存 `.pert` に対する `dsl format` は次を保持する。

- declaration order
- field order
- comment textと相対位置
- blank lineの位置と個数
- block textのdecoded content
- BOMの有無
- 主要line ending

次を正規化する。

- structural indentationを2 spacesへ統一
- token間space
- arrow前後space
- colon/comma/bracket周辺space
- syntax line末尾spaceの除去
- Decimalの不要なleading/trailing zero
- String escape
- file末尾newline

parse/field validation errorがある文書を`--write`してはならない。preview-only recovery formatを将来提供する場合は別actionとする。

### 17.2 canonical serializer

新規生成、Mermaid import、AST fixture生成ではcanonical serializerを使う。

field order:

```text
project:
  version, title, description, as_of, duration_unit, finish,
  critical_epsilon, target_duration

milestone:
  title, description, state, tags

resource:
  title, description, capacity, tags

task:
  title, description, duration|estimate, status, priority, requires,
  owner, tags,
  blocked_reason, source

estimate:
  optimistic, most_likely, pessimistic

gate:
  reason
```

declaration order:

1. project
2. resourceをID辞書順
3. milestoneをID辞書順
4. task/gateをedge ID辞書順

その他:

- indentationは2 spaces
- line endingはLF
- file末尾newlineあり
- top-level declaration間は1 blank line
- 空optional fieldは出力しない
- default fieldは、利用者が明示した値を保持するsource formatを除き、canonical serializerでは省略できる

### 17.3 idempotence

有効な文書 `x` について次を満たす。

```text
format(format(x)) == format(x)
AST(parse(format(x))) == AST(parse(x))
```

## 18. valid example

```pert
project SAMPLE:
  version 1
  title "サンプル"
  description |
    文法仕様の代表例。
    taskはedgeとして記述する。
  as_of 2026-07-21
  duration_unit day
  finish RELEASED
  critical_epsilon 0d
  target_duration 10d

resource DEVELOPERS:
  title "開発担当"
  capacity 2

resource TEST_DEVICE:
  title "試験機"
  capacity 1

milestone NOW:
  title "現在"
  state reached

milestone DESIGNED:
  title "設計完了"

milestone RELEASED:
  title "リリース"

task DESIGN NOW -> DESIGNED:
  title "設計する"
  estimate:
    optimistic 1d
    most_likely 2d
    pessimistic 4d
  status active
  priority 10
  requires:
    DEVELOPERS 1
  owner "team-a"
  tags [design, "重要"]

task RELEASE DESIGNED -> RELEASED:
  title "リリースする"
  duration 1d
  requires:
    DEVELOPERS 1
    TEST_DEVICE 1
```

## 19. invalid example

### 19.1 indentation

```pert
milestone BAD:
   title "3 spaces"
```

Expected: `PTDSL-002`。

### 19.2 inline comment

```pert
task BAD START -> END:
  title "inline comment"
  duration 2d # unsupported
```

Expected: `PTDSL-011`。

### 19.3 task field combination

```pert
task BAD START -> END:
  title "両方指定"
  duration 2d
  estimate:
    optimistic 1d
    most_likely 2d
    pessimistic 3d
```

Expected: `PTSEM-103`。

### 19.4 resource capacity

```pert
resource DEVICE:
  title "試験機"
  capacity 1

task BAD START -> END:
  title "同時に2台必要"
  duration 1d
  requires:
    DEVICE 2
```

Expected: `PTSEM-109`。

### 19.5 blocked reason

```pert
task BAD START -> END:
  title "理由なしblock"
  duration 1d
  status blocked
```

Expected: `PTSEM-103`。

## 20. grammar version

- version省略時はversion 1と解釈する
- version 1 parserは`version 1`だけを受理する
- より新しいversionを黙ってversion 1として解釈しない
- grammar破壊変更ではproject versionとmigration commandを用意する
- help、examples、fixtures、formatterをgrammar versionと同じ変更で更新する
- minorなfield追加でも旧parserがunknown fieldをerrorにすることを前提に、tool version compatibilityを明示する

## 21. grammar acceptance

parser実装時は最低限、次を自動検査する。

1. 本書のvalid exampleをparseできる
2. `docs/examples/minimal.pert`をparseできる
3. `docs/examples/parallel.pert`をparseできる
4. project/resource/milestone/task/gateの各fieldを単独で検査できる
5. invalid indentation/string/duration/list/dateを拒否する
6. missing/duplicate/unknown fieldを区別する
7. durationとestimateの排他を検査する
8. commentとblank lineをCST round-tripで保持する
9. block textのparagraphとcommon indentを保持する
10. source spanがUTF-16 code unit基準で一致する
11. error recoveryが独立した複数errorを返す
12. formatterがidempotentでAST同値を保つ
13. help sampleとparser fixtureのdriftを検出する
14. resource capacity、requires、priorityをparse/validateできる
