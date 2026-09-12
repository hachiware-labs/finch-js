# Finch.js diagram syntax

Use this reference to choose the directive and compose valid Finch.js DSL in a JavaScript string inside HTML. The parser implementation in `src/parser.ts` is authoritative; the advanced examples listed below are the preferred models for realistic diagrams.

## Shared rules

- The first meaningful line is exactly one diagram directive.
- Use stable IDs containing letters, digits, `_`, `-`, or `.`. Keep the human-facing text in a quoted label.
- Declare nodes before connecting them, except graph nodes and sequence participants, which Finch.js may infer from connections or messages.
- Use `->` for a solid relationship, `-->` for a dashed relationship, and `..>` where the applicable syntax supports dependency-like relationships.
- Add an edge label after `:`. Flow, state, and activity edges also accept guard/action text such as `[valid] / reserve`.
- Add attributes in brackets: `[key=value other="quoted value"]`.
- Comments can start with `'`, or follow whitespace as `#` or `//` comments.

## Pick the diagram

| Request intent | Directive | Canonical example |
| --- | --- | --- |
| Infrastructure, runtime, physical placement | `@deployment` | `examples/deployment.html` |
| General relationships without a specialized notation | `@graph` | `examples/graph.html` |
| Time-ordered calls or messages | `@sequence` | `examples/sequence.html` |
| General process or decision flow | `@flowchart` | `examples/flowchart.html` |
| Lifecycle and event-driven transitions | `@state` | `examples/state.html` |
| Tables/entities, fields, keys, cardinalities | `@er` | `examples/er.html` |
| Logical software boundaries and interfaces | `@component` | `examples/component.html` |
| Presentation narrative or data story | `@slide` | `examples/slide.html`, `examples/slide-patterns.html`, and `docs/slide-patterns_ja.md` |
| Classes, members, inheritance, composition | `@class` | `examples/class.html` |
| Actors and system goals | `@usecase` | `examples/usecase.html` |
| UML actions, control/object flow, fork and join | `@activity` | `examples/activity.html` |

## Deployment

Optional icon packs are loaded after Finch via `icon-packs/aws.js`, `azure.js`, `gcp.js`, `k8s.js`, or `simple.js` (resolve relative to the HTML). Use `icon=aws:application-auto-scaling`, `icon=simple:github`, etc. See `icon-packs/catalog.json` for exact names. Custom images use `image="./avatar.png"` or a direct image URL, optionally `imageShape=circle|rounded`; omitted shape preserves aspect ratio. `image` takes precedence over `icon`. These work across themes on the supported box shapes. SVG/PNG downloads embed images; remote URLs need CORS and local files should be served over HTTP for export. See `examples/icon-packs.html`.

Nodes can set `icon=server` or `icon=shield-check`; `tone=cyan|coral|green|amber|violet` selects a role color across themes, including `default`, `midnight`, and `prism` (`Finch.render(source, { theme: "prism" })`). Container tones inherit through nested children; an explicit child tone overrides, and `tone=none` resets to the base theme. Icons are embedded SVG with layout space reserved automatically. See `docs/icons-and-tones_ja.md` for supported shapes and icon names.

Declarations include `node`, `device`, `execution`, `artifact`, `server`, `database`, and `container`. Containers may nest with braces.

```text
@deployment
container cloud "本番環境" {
  server api "APIサーバー"
  database db "注文DB"
}
api -> db: SQL
```

Containers accept `layout=row`, `layout=column`, or `layout=grid`; a grid may set `columns`. Direct children may set `order`, `row`, and `column`. On a top-level container, `place=below` keeps the container below its predecessor rather than opening another horizontal band.

## Graph

Declare a node with only its stable ID and optional quoted label. An ID first seen in a connection creates an implicit node; a later declaration may add its label, shape, and attributes. Graphs run top to bottom by default. Add `direction=LR` to the directive for a left-to-right layout. Use brace-delimited `group` blocks to draw frames around related nodes.

```text
@graph direction=LR
customer "Customer"
group commerce "Commerce" {
  customer -> api: HTTPS
  api "Order API" [shape=rounded]
  api -> db
  db "Orders" [shape=database]
}
```

## Sequence

Declare `participant` or `actor`, then write messages in order. Frame kinds are `group`, `alt`, `opt`, `loop`, `par`, `critical`, and `break`; close each frame with `end`.

```text
@sequence
actor User "利用者"
participant API "API"
User -> API: 送信
opt 成功時
  API --> User: 200 OK
end
```

## Flowchart

Node declarations are `start`, `process` or `step`, `decision`, `input`, `output`, `node`, and `end`.
Flowcharts are laid out vertically by default: ranks progress from top to bottom and branches in the same rank spread horizontally.

```text
@flowchart
start begin "開始"
decision valid "妥当?"
end done "完了"
begin -> valid
valid -> done: Yes
```

## State

Object snapshots use `@object`, `object id "instance : Type" { ... }` with literal slot lines such as `name = "Alice"`, and ordinary class-style links/packages. Use `examples/objects-templates.html` as a reference. Class/interface declarations support `<K, V>` template parameters rendered in a dashed compartment; relations reference the plain classifier ID.

Class diagrams support ordered hide/show rules: `hide members`, `show Account methods`, `hide private members`, `hide Audit`, `hide empty members`. Rules control presentation without removing semantic declarations. See `examples/class-views.html`.

Declarations are `initial`, `state`, `choice`, `junction`, `fork`, `join`, `history`, `deep-history`, `final`, and `terminate`.
Fork/join sections are arranged vertically: the fork bar sits above its parallel states, the join bar sits below them, and a single successor continues downward.
Transitions connected to a fork or join use vertical ports automatically. Override either endpoint when needed with `fromPort` and `toPort`; accepted values are `top`, `right`, `bottom`, and `left`:

```text
audit -> merged [fromPort=bottom toPort=top]
```

```text
@state
initial start
state idle "待機中"
final done
start -> idle
idle -> done: 完了
```

## ER

An entity is a brace-delimited field list. A field is `<name> <type> [flags...]`; common flags are `pk`, `fk`, and `unique`. Cardinalities accept `1`, `0..1`, `N`, `many`, and `0..N`.

```text
@er
entity users "Users" {
  id uuid pk
  email varchar(255) unique
}
entity orders "Orders" {
  id uuid pk
  user_id uuid fk
}
users 1 -> many orders: places
```

## Component

Use nested `system` blocks with `component`, `external`, `port`, `provided`, `required`, `artifact`, and `database` declarations.

```text
@component
system shop "Shop" {
  component api "API"
  provided events "Events"
}
external payment "Payment Provider"
api -> payment: authorize
api -> events: publish
```

## Slide

Use `title`, `subtitle`, `row`, `column`, or `grid`, and presentation items `card`, `note`, `callout`, `badge`, `metric`, `bar`, `quote`, and `milestone`. `arrow` connects adjacent items in the active layout block.

```text
@slide
title "今期の成果" [align=center]
grid kpis [columns=3 gap=22] {
  metric revenue "¥24M" [label="売上" delta="+18%" tone=accent]
  metric users "12K" [label="利用者"]
  metric nps "+42" [label="NPS"]
}
callout decision "次四半期は継続率を優先する"
```

## Class

Classifiers are `class`, `abstract`, `interface`, and `enum`, each with a brace-delimited member list. Relations include inheritance `--|>`, realization `..|>`, composition `*--`, aggregation `o--`, dependency `..>`, directed association `-->`, and association `--`. Put optional multiplicities in quotes beside the relation.

```text
@class
class Order {
  -id: UUID
  +submit(): void
}
class LineItem {
  -quantity: int
}
Order "1" *-- "1..N" LineItem: items
```

## Use case

Use `actor`, a brace-delimited `system`, and `usecase`. Special relations are `include`, `extend`, and `generalize`.

```text
@usecase
actor customer "顧客"
system shop "ショップ" {
  usecase checkout "購入する"
  usecase login "認証する"
}
customer -> checkout
include checkout -> login
```

## Activity

Declarations are `start`, `action` or `activity`, `decision`, `merge`, `fork`, `join`, `object`, and `end`. Use guards and optional actions on edges.

```text
@activity
start begin
action validate "注文を検証する"
decision valid "妥当?"
action reject "却下を記録する"
end done
begin -> validate
validate -> valid
valid -> done [valid]
valid -> reject [invalid] / record reason
reject -> done
```



## Concise UML extensions

Use `note Order "Explanation"` or `constraint Item "quantity > 0"` for annotations, and `note api->stock "Idempotent"` for the first matching connection. Sequence frames accept `else condition` inside `alt` and `and description` inside `par`.

Use `state id { ... }` for composite states, `region id { ... }` for parallel regions, `lane id { ... }` for activity ownership, and `package id { ... }` for class packages. IDs remain unique across the diagram. State diagrams now flow downward by default; flat state diagrams accept `@state direction=LR`.

These features require the current repository build. See the [editable example](../../../../examples/uml-concise.html) and [syntax and limitations (Japanese)](../../../../docs/uml-concise_ja.md). Constraints are displayed, not executed. Local namespaces and nested swimlanes are not supported. Nested state layouts remain vertical.


## Practical UML notation

Sequence diagrams distinguish synchronous `->`, asynchronous `->>`, and reply `-->` messages. Use `activate` / `deactivate` for explicit execution intervals, and `create` / `destroy` for lifetimes. State bodies accept `entry`, `exit`, `do`, and `internal`. Add roles with `stereotype id "service"`; class members accept `static` and `abstract` prefixes.

Activity diagrams accept `while id "condition" { ... }` and `repeat id "condition" { ... }`, with sequential action bodies and nested loops. Use `id.done` as the exit. Class relations accept `[fromRole=owner toRole=items]`, and `association Link A->B` attaches a declared association class to the uniquely matching relationship (use [id=name] and association Link name to disambiguate).

See the [editable example](../../../../examples/uml-practical.html) and [detailed syntax and limitations (Japanese)](../../../../docs/uml-practical_ja.md). These features require the current repository build. They describe behavior and perform structural checks; they do not execute it. Explicit activations replace inference for the controlled participant. Branch-dependent lifetimes, if/else and break/continue inside loops, explicit loop edges, and direct association-class relations are supported.


## State semantics and validation

State diagrams accept `entryPoint id` / `exitPoint id` within composite states; they are placed on the boundary. Define reusable machines with top-level `machine Name { ... }` and reference one using `state id "Label" [submachine=Name]`. Reference its root connection points with `entryPoint port [state=id ref=definedEntry]` and `exitPoint port [state=id ref=definedExit]`. Machine bodies have independent node ID namespaces. Strict mode checks references, cycles, orthogonal fork/join branches, and shallow/deep history default targets. See `examples/state-advanced.html`. These are static structural checks, not execution simulation.

State diagrams retain pseudostate kinds and distinguish `terminate` (cross) from `final`. Use `[kind=local]` for a local transition; `internal` remains a state-body transition. `parseState(source).diagnostics` returns structural diagnostics; `@state validation=strict` rejects diagnosed structures. See [state semantics](../../../../docs/state-semantics_ja.md).

State extensions: after()/at()/when() events, defer/invariant commands, @state protocol with [pre=... post=...], machine Derived extends Base with stable node/edge IDs for redefinition, and comma-separated connection-point ref values. See examples/uml-complete.html and docs/uml-complete_ja.md.


## Timing diagrams

Use `@timing [end=200] [scale=3.5] [unit=ms]`. Declare `robust id "Label"`, `concise id "Label"`, `binary id`, `analog id`, or `clock id [period=40 pulse=15 offset=0]`. Set absolute time with `@40`, advance with `@+20`, and assign `id is value`. Binary values are 0/1/low/high; analog values are numeric and interpolate linearly; clock samples are automatic. Send `a -> b@+10: message` at the current time with arrival ten units later. Annotate `duration a 40 160 "120 ms"`. Time is numeric, including negative values; unit is a display suffix. Rows share the same horizontal time axis even when dragged. See `examples/timing.html`. Define named times with `@20 as :start`, reuse `@:start+5`, or use anchors in message arrival times and duration endpoints. Define anchors before use. Select a participant with `@id`, then write `0 is low` or `+20 is high`. `{low,high}` / `{Idle,Valid}` draw uncertain ranges; `{hidden}` and `{-}` hide an interval. Analog interpolation does not bridge these gaps. Date timestamps are not yet supported.


Class member notes: `note Account::balance "Nonnegative"` and `note Account::save(force: Boolean) "Force mode"` attach to specific rows. Use full signatures for overloads; ambiguous or unknown members are errors. `constraint` accepts the same targets. Hiding a member hides its attached notes without deleting the semantic model.


Inside structured activity blocks, `kill` / `detach` after an activity suppress its automatic continuation. `end id` terminates that path with a final node. Terminated paths do not merge or generate loop back edges. Top-level kill/detach are supported in `@activity flow` mode.


Activity split: `split id {` contains at least two `branch { ... }` blocks (braces on separate lines). Entry is `id`, continuation is `id.done`. It merges continuing paths without join synchronization; terminated branches do not reconnect. No done node is generated if all branches terminate. See `examples/activity-split.html`.


シーケンス採番は `autonumber 8 2 "REQ-{n:03}"` の書式に対応します。開始値8、増分2でREQ-008、REQ-010と表示します。`{n}` は通常の番号、`{n:03}` は3桁のゼロ埋めです。stop/resumeで書式も保持します。PlantUMLのDecimalFormatそのものとの構文互換ではありません。


Class namespaces: `namespace billing "Billing" { ... }` scopes class IDs as `billing.Model` while preserving short labels. Nested namespaces and forward references work. Resolve local IDs from the current namespace through its parents; use qualified IDs outside. Namespace reopening and implicit namespace creation from qualified classifier declarations are supported. See `examples/class-namespaces.html`.


クラスのタグ: `tag Service internal service` で複数タグを付け、`hide $service fields`、`remove $internal`、`restore $internal` で選択します。namespace内のtag対象はローカル名で指定できます。タグは表示ラベルに含めず、SemanticModelのtags属性に保持します。未知の対象クラスや一致するクラスのないタグ選択はエラーです。


Template binding: `bind Users Repository "K=String, V=User"` connects a declared classifier to a declared generic classifier using a dashed «bind» dependency. Named substitutions support nested generic arguments. Unknown/duplicate formals are rejected. Actual types are textual, not type-checked or expanded into member declarations. Partial bindings are allowed.


Sequence external endpoints: `[ -> api: request` receives from outside the left boundary; `api --> ]: response` sends beyond the right boundary. External endpoints do not add participants. Calls, async arrows, replies, numbering and lifetime validation still apply. Use `? -> api` for a found message and `api -> ?` for a lost message; the unknown endpoint is drawn as a filled dot. Use `api <- ]` for right-side input and `[ <-- api` for left-side output. Reversed arrows also work between ordinary participants.


シーケンス参加者は `boundary ui "UI"`、`control service "Service"`、`entity model "Model"`、`database db "Database"` を指定できます。boundary/control/entityはそれぞれ専用記号、databaseは円柱です。通常のライフライン・メッセージ接続を使います。サンプル: `examples/sequence-roles.html`。


Sequence participants also accept `collections users "Users"` and `queue jobs "Jobs"`, rendered as stacked rectangles and a horizontal queue symbol.


レーン途中切替: `lane user "User"` でレーンを宣言し、`in user` で以後のノードの担当を選びます。同じレーンに戻ることもできます。構造化ブロックの入口・合流はブロック宣言時のレーンを使います。切替はソース順に持続するため、else等で担当を変える場合も明示します。laneブロックと併用できます。ブロックを抜けると直前の担当に戻ります。サンプル: `examples/activity-lanes.html`。


`@activity flow` はトップレベルの宣言を順番に自動接続します。if/switch/split/ループと `in laneId` の途中切替も利用できます。kill/detach/end後の経路は自動で再開しません。明示接続を書いたノードは、その接続が自動接続より優先されます。通常の `@activity` の明示接続方式は維持します。


Activity `flowfinal id` draws a circle with an X and ends only that control-flow path; `end id` draws an activity final. Structured expansion does not reconnect either final to a merge or subsequent action. The semantic activityKind is preserved independently of shape overrides.


Class namespaces may be reopened with another `namespace id { ... }` block in the same parent. They share one container and resolve forward references across blocks. Omitted labels inherit the first label; conflicting explicit labels and duplicate classifiers are rejected. Activity end/flowfinal nodes cannot have outgoing connections, even with a shape override.


Object maps: `map id "Label" {` with one `key => value` per line and a closing brace. Empty values are allowed. `key *-> objectId` references a declared object from that row. External links can use `mapId::key` as either endpoint with `-->`, `--`, or `..>`. Qualified endpoint keys use identifier characters. Rows stay attached during dragging. See examples/object-maps.html.


Object slots may be appended outside a body with `objectId : name = value`, including before the declaration. Body slots precede external slots; external slots retain source order. Slot values remain attributes even when they contain parentheses.


階層採番: `autonumber 1.1.1` は末尾を自動加算します。`autonumber inc A` は先頭、`inc B` は2番目を加算し、それより下位の番号を1に戻します。区切りは `. ; , :` を組み合わせられます。stop/resumeは階層を保持し、増分指定は末尾に適用します。`{n}` は番号全体、`{n:02}` は各階層を2桁にします。停止中のincと存在しない階層はエラーです。


### 引数付き共通部品

```text
!procedure participant(id, label)
participant {{id}} "{{label}}"
!endprocedure
@sequence
!call participant("client", "Client")
!call participant("api", "API")
client -> api: request
```

`!procedure name(parameters)` から `!endprocedure` までが部品定義です。`!call name(arguments)` で展開します。引数はJSONの文字列・数値・真偽値で、文字列内の `{{NAME}}` も解決します。部品は使用前に定義し、includeにまとめることもできます。部品から別の部品を呼べます。変数は呼び出し時の定義を参照し、部品内の変更は呼び出し元に漏れません。条件分岐も利用できます。引数の数、型、重複パラメーター、未定義の部品、32段を超える呼び出しを検出します。

戻り値付き関数・式評価・部品内の新しい部品定義は未対応です。renderの `preprocess: {}` を指定して有効化するか、モジュールのpreprocess関数を呼びます。


省略引数: `!procedure participant(id, label="{{id}}", active=true)` のように既定値を指定できます。既定値はJSONの文字列・数値・真偽値で、呼び出し時に先行パラメーターも参照できます。必須パラメーターを先、省略可能なものを後ろに置きます。`!call participant("api")` ではlabelもapiになります。明示指定は既定値より優先します。


シーケンスの時間区間: メッセージの直後に `anchor start` を置き、別のメッセージの後に `anchor end` を置きます。`duration start end "100 ms max"` は両メッセージ間の時間注記を右側に表示します。複数区間は別々の列に配置します。anchor/durationは採番・メッセージ数に含めません。未定義・重複アンカー、同じメッセージまたは逆順の区間を検出します。`anchor id send` / `anchor id receive` で送信点・受信点を選べます。省略時はsendです。自己呼び出しは折り返した受信点の高さを使用します。同一メッセージのsend→receiveも指定できます。時間制約の実行評価は行いません。サンプル: examples/sequence-external.html。回帰検証: tests/sequence-duration.test.ts。


Classifier visibility: `hide ID` keeps the node and its relationships in layout but does not draw them. `remove ID` excludes them from layout. `show ID` or `restore ID` restores visibility. The semantic model retains both hidden and removed classifiers; geometry retains hidden ones only. Related annotations are not displayed while their targets are hidden.


クラスの修飾名: `class billing.storage.Repository<T> { ... }` はbillingとstorageの名前空間を自動生成します。同じ名前空間の明示ブロックと統合し、明示された表示名を優先します。namespace内の修飾名はそのnamespaceからの相対名です。表示ラベルを省略したクラスは末尾の短い名前で表示します。


タイミング図の日時: `@timing origin=2026-09-01 unit=h end=2026-09-03` を指定し、`@2026-09-01T06:00:00Z` などで時刻を移動できます。日付のみはUTC午前0時です。数値と相対値はunitに従い、ms / s / min / h / dを利用できます。日時はアンカー、duration、メッセージの受信時刻にも指定できます。日時書式はISO日付、Z付きUTC時刻、または+09:00等のオフセット付き時刻（秒まで必須、ミリ秒省略可）です。時差なしのローカル時刻・地域名・独自日付書式は未対応です。サンプル: examples/timing-dates.html。


条件式: `!if MODE == "prod" && (REPLICAS >= 2 || DR)` のように比較・論理演算・括弧を指定できます。`!elseif expression` は前の条件が成立しなかった場合に選択します。対応演算子は `== != < > <= >= ! && ||` です。大小比較は数値、等値比較は文字列表現で比較します。未定義の変数は単独条件では偽になります。論理演算は短絡評価し、未選択枝の数値比較を評価しません。構文は未選択枝も検証します。式内でユーザー定義関数を呼び出せます（後述）。


計算変数: `!let COUNT = (BASE + 2) * 3` で式の結果を保存し、`{{COUNT}}` や条件式で利用できます。四則演算・剰余・単項の正負・括弧に対応し、乗除算を加減算より先に評価します。0除算、非数値の算術、未定義値の代入をエラーにします。部品内のletは呼び出し元に漏れません。文字列はJSONの引用符付きリテラルで代入できますが、+は数値加算です。


送受信の間隔: `client -> api: request [delay=24]` は受信点を24描画単位下げ、斜めのメッセージ線にします。数値は0〜10000の描画間隔で、実時間への換算ではありません。自己呼び出しは既存の折り返し間隔に加算します。実行区間の開始・生成位置・時間アンカー・フレーム下端は受信位置に追従します。


オブジェクト図のJSON: `@object` 内に `json payload "Label" { ... }` を書くと、JSONオブジェクト・配列を表として展開します。入れ子は別の表への行参照、配列は添字で表示します。スカラーの文字列・数値・真偽値・nullを保持します。`payload::key` への通常リンクも使えます。JSONルートはオブジェクトか配列で、生成IDはpayload__json1等です。既存IDとの衝突はエラーになります。サンプル: examples/object-json.html。


クラス図でもobject / map / json宣言を混在できます。クラスの定義、下線見出しのインスタンス、JSONの具体例を同じ図に置き、通常の関連や `payload::key` への行接続で対応付けられます。クラス本文の属性・操作は従来通り解釈します。


flowモードのlaneブロック: `lane user "User" { ... }` の内部も自動接続に参加します。ループやif等を内部に置け、inで別の担当へ移れます。laneブロックは入れ子にできません。同じlaneは複数ブロックで使えますが、異なる表示名はエラーです。


非同期include: モジュールAPIの `preprocessAsync(source, { resolveInclude: async (name, from) => text })` は取得後の展開済みソースを返します。`snapshotPreprocessAsync` は `{ source, snapshot }` を返し、`Finch.render(originalSource, { preprocess: restorePreprocess(snapshot) })` に渡せば元ソースを保った編集・HTML保存ができます。条件分岐で選ばれた資源だけを取得し、同じ名前と呼び出し元の組をキャッシュします。`signal` でキャンセルを検出できます。fetch等の通信自体を中止する場合はローダー側にも同じsignalを渡します。render自体は同期APIのままです。


クラスのメンバー関連: `Account::id --> Record::key: stored as` のように属性・操作を端点に指定できます。通常の関連種別や多重度と併用し、namespace内の短いクラス名も解決します。曖昧なメンバー名はエラーです。対象行が非表示なら関連線も描画しません。サンプル: examples/class-member-links.html。

Member links and notes resolve operation signatures before return types: `Store::load(id: String)` matches `+load(id: String): Record`; `Store::save(Record record)` matches `+void save(Record record)`. Use the complete argument signature when a short name is overloaded. Argument names and types must match the declaration; this is not type inference.

Object, map and JSON declarations can appear inside namespaces. Their IDs and references resolve in lexical scope, including external slots (`example : id = 42`) and map references. Same short names in different namespaces are distinct, and omitted display labels remain short names.

Sequence numbering also accepts integer decimal patterns: `autonumber 8 2 "[000]"` renders `[008]`, `[010]`; `autonumber 1234 "#,##0.00"` renders `1,234.00`. Quote literal special characters with single quotes. Stop/resume preserves the format. Use `{n}` formats for hierarchical numbers. Exponents, currency, percent/per-mille, separate negative patterns and HTML styling inside numbers are not supported.

前処理の繰り返し: `!foreach ID in ["api","worker"]` ～ `!endfor` で `{{ID}}` を順に置換します。配列はJSONの文字列・有限数値・真偽値で、`!define IDS ["api","worker"]` として `in IDS` でも指定できます。配列の要素内の変数はループ開始時に置換します。反復変数は終了後に元の値へ戻りますが、他のlet/defineの更新は残ります。`!while COUNT < 3` ～ `!endwhile` は毎回条件を評価し、本文で `!let COUNT = COUNT + 1` 等を使えます。両者の入れ子、if、include、部品呼び出しに対応します。ループ内の部品定義は未対応です。各ループ10000反復、入れ子32段、展開処理100000行までとし、終了しない展開をエラーにします。空配列・未選択条件では本文を展開しません。JSONオブジェクト要素へのアクセス、break/continueは未対応です。サンプル: examples/reusable-sequence.html。

外部includeの更新: 初回描画と `instance.update(source)` で資源を取得し、その1回の取得内容を検証・描画・保存で共有します。テーマ変更・再配置では直前のスナップショットを使い、外部資源を再取得しません。外部部品を更新して反映したい場合は同じsourceでupdateします。取得結果が構文エラーの場合、直前の有効なソースとスナップショットを保持します。

タイミング図のUTCオフセット: origin、時刻、duration、受信時刻に `2026-09-02T00:00:00+09:00` などを指定できます。`2026-09-01T15:00:00Z` と同じ瞬間として計算し、異なる表記でも同一トラックの同時刻サンプル重複を検出します。日付のみはUTC午前0時、軸ラベルはUTC表示です。不正な暦日、24時、時差の時24以上・分60以上を拒否します。地域名による夏時間解決は行いません。

前処理の検証: `!assert COUNT > 0 : "COUNT={{COUNT}} must be positive"` は条件が偽なら生成を停止します。メッセージは省略でき、既存の比較・論理・算術式を使えます。include内の失敗には資源名を付けます。未選択のif枝では検証せず、成功時は図へ文字を追加しません。部品やループの内部でも利用でき、update時の失敗は直前の有効な図を保持します。メッセージはJSON形式の二重引用符付き文字列で、失敗時に変数を置換します。

戻り値付き関数: `!function budget(base, attempts=2)` ～ `!endfunction` 内の `!return base * attempts` で値を返し、`!let TIMEOUT = budget(50)` から呼べます。if・while・assertの式にも利用でき、関数呼び出しを入れ子にできます。既定引数は部品と同じJSONスカラーです。戻り値は文字列・有限数値・真偽値で、未定義値、引数不一致、returnなしの終了はエラーです。ifやループ内部からreturnでき、関数内の変数変更は呼び出し元へ漏れません。論理式の短絡評価で未選択の関数は呼びません。図の行を出力する処理にはprocedureを使い、関数は値を返す用途に限定します。関数と部品の呼び出しは合計32段までです。ソースへの埋め込みはletで変数に受けて `{{TIMEOUT}}` と記述します。サンプル: examples/reusable-sequence.html。

前処理の構造検証: if・foreach・while・procedure・functionの開始と終端、else/elseifの位置は実行前に検証します。早期returnの後や未選択の枝でも、閉じ忘れ・異なる終端・else重複はエラーになります。選択されて取得したinclude先も同じ検証を行います。未選択枝のincludeを検証のためだけに取得することはありません。

組み込み関数: 文字列用に `upper` / `lower` / `trim` / `strlen` / `substr(text,start,length?)` / `strpos(text,search)` / `replace(text,search,replacement)` / `concat(...)` / `string`、数値用に `number` / `abs` / `floor` / `ceil` / `round` / `min(...)` / `max(...)`、定義確認用に `exists("NAME")` を使えます。例: `!let LABEL = concat(upper(NAME), "-", round(VALUE))`。strlen・substr・strposの位置はUnicodeコードポイント単位（結合文字・絵文字列全体の書記素単位ではない）、substrは0始まりの非負整数で第3引数は文字数です。strposは未発見時-1、replaceは正規表現ではなく一致する文字列すべてを置換します。roundのちょうど半分は正の無限大方向へ丸めます。同名のユーザー定義関数を定義した場合はそちらを優先します。文字列結合にはconcatを使い、+は数値加算を維持します。日時・乱数・ホストへの入出力を行う組み込み関数は追加していません。

直交領域の配置: 複合状態を `state running "稼働中" [regions=rows] { ... }` と宣言すると、regionを縦に積み、横の破線で区切ります。既定の `regions=columns` は横並び・縦の破線です。状態・遷移・直交領域の検証規則は同じです。サンプル: examples/state-regions.html。

シーケンスの末尾見出し: `show footbox` で末尾の参加者見出しを表示し、`hide footbox` で省略します。既定は非表示で、後の指定を優先します。末尾まで生存する参加者の役割記号・ラベルを再表示し、破棄済み、または分岐によって生存しない参加者は省略します。SVG出力にも含め、配置変更にも追従します。サンプル: examples/reusable-sequence.html。

シーケンスの図情報: `title "Order processing"`、`header "Architecture / Production"`、`footer "Internal use"` を指定できます。文字列はJSON形式の二重引用符で囲み、\nで改行できます。タイトルとヘッダーは上、フッターは下に中央配置し、長い文字列は折り返します。参加者・メッセージには数えず、図のソースとSVG/PNGへ保持します。後の指定が優先です。HTML装飾は実行せず文字として表示します。現時点ではシーケンス図に対応し、凡例はlegend指定に対応し、改ページは残件です。サンプル: examples/reusable-sequence.html。

シーケンスの凡例: `legend "Solid: request\nDashed: response"` で複数行の凡例を指定します。図の下側、末尾見出しとフッターの間に枠付きで中央配置し、SVG/PNGにも含めます。JSON形式の引用符、後勝ち、長い文字列の折り返しはtitle等と共通です。

状態図の境界ピン: 複合状態内で `inputPin id "入力"` / `outputPin id "出力"` を宣言します。四角い表示拡張としてstateKindにinputpin/outputpinを保持し、UMLのentryPoint/exitPointとは別種別です。入力は枠の上、出力は下に置き、内部接続先が一つなら横位置をそろえます。strict検証では複合状態の所有、入力の外→内、出力の内→外を確認します。submachineのrefには使えません。この拡張にトークン消費・生成や疑似状態の実行意味を付与しません。サンプル: examples/state-pins.html。

送受信図形: アクティビティの `send id "送信"` / `receive id "受信"` は専用の五角形・切り欠き形で表示します。flow、構造化ブロック、レーンと組み合わせられます。状態図は表示拡張の `sdlreceive id "受信"` に対応し、stateKind=sdlreceiveを保持します。受信図形の左ポートは切り欠きの先端に接続します。これは描画・構造の対応で、イベントキューや受信待ちの実行エンジンではありません。サンプル: examples/signal-actions.html。


### Sequence divider headings

`divider "Authentication"` or `== Authentication ==` adds a double-rule heading across the participants declared at that point. Declare participants before the first divider. Dividers reserve vertical space and wrap long labels, without consuming an autonumber value or changing participant lifetime or activation. An `anchor` must follow a message, not a divider. This is a visual section boundary, not a UML combined fragment or a page break.

Example: `examples/sequence-dividers.html`. Rendering, SVG export, theme rebuild, numbering and anchor restrictions are covered by tests.

### Deployment architecture strategy

For a parent with exactly three direct child containers, `layout=architecture` selects an entry/processing/downstream macro order from directed inter-container links, puts entry on the left, and stacks the other two on the right. Non-container support siblings go on the left with directly connected items adjacent. Choose child `layout=row|column|grid` separately; the strategy does not infer child aspect ratios or compare mirrored layouts. See `examples/deployment.html` and `docs/reference_ja.md`.

送受信記号の向きは `[facing=left]` で左右反転、`[facing=right]` または省略で標準表示です。文字は反転せず、接続ポートは輪郭に追従します。配置からの自動反転は行いません。例: `send reply "結果を送信" [facing=left]`、`receive result "結果を受信" [facing=left]`。
