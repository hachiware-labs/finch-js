# Finch.js リファレンス

組み込みの自動配置・テーマは既定の表示動作です。異なる配置や見た目は [layout / theme の拡張](extensions_ja.md)で実装できます。以下の配置説明は組み込み実装の対象範囲であり、独自プラグインの作図方針を制約しません。

[プラグイン開発ガイド](./plugin-development_ja.md)

[English](./reference.md) · [README に戻る](../README_ja.md)

このページには、最初のチュートリアルを終えたあとに必要になる詳細をまとめています。共通記法、エディターの挙動、保存、イベント、画像出力、レイアウト操作、公開インスタンス API を確認できます。各図法の動くソースは[発展例](../examples/README.md)を参照してください。

## 共通記法

最初の有効な行で図法を選びます。接続より先にノードを宣言し、機械が使う ID と表示名を分けます。

```text
@deployment
server billing-api "請求 API"
database ledger "台帳"
billing-api -> ledger: SQL
```

- ID には英数字、`_`、`-`、`.` を使えます。表示名を直しても配置を引き継げるよう、ID は安定させます。
- 実線は `->`、破線は `-->` です。コロンの後ろに線の表示名を付けられます。
- 属性は角括弧に書きます：`[shape=rounded fromPort=right toPort=left]`。
- 行頭の `'` は行全体のコメントです。空白の後ろにある `#` と `//` もコメントを開始します。

## 図法と宣言

| ディレクティブ | よく使う宣言 | 完成例 |
| --- | --- | --- |
| `@deployment` | `node`、`device`、`execution`、`artifact`、`server`、`database`、`container` | [deployment.html](../examples/deployment.html) |
| `@graph` | 型なしノード、接続時の暗黙ノード、`group`、`direction=LR` | [graph.html](../examples/graph.html) |
| `@sequence` | `participant`、`actor`、メッセージ、`group`、`alt`、`opt`、`loop`、`par`、`critical`、`break` | [sequence.html](../examples/sequence.html) |
| `@flowchart` | `start`、`process`、`decision`、`input`、`output`、`end` | [flowchart.html](../examples/flowchart.html) |
| `@state` | `initial`、`state`、`choice`、`fork`、`join`、`history`、`deep-history`、`final` | [state.html](../examples/state.html) |
| `@er` | `entity`、フィールド、`pk`、`fk`、`unique`、多重度 | [er.html](../examples/er.html) |
| `@component` | `system`、`component`、`port`、`provided`、`required`、`artifact`、`external` | [component.html](../examples/component.html) |
| `@slide` | `title`、`subtitle`、レイアウト、`card`、`metric`、`bar`、`quote`、`milestone`、`callout`、`arrow` | [slide.html](../examples/slide.html) |
| `@class` | `class`、`abstract`、`interface`、`enum`、メンバー、UML 関係、多重度 | [class.html](../examples/class.html) |
| `@usecase` | `actor`、`system`、`usecase`、`include`、`extend`、`generalize` | [usecase.html](../examples/usecase.html) |
| `@activity` | `action`、`decision`、`merge`、`fork`、`join`、`object`、ガード | [activity.html](../examples/activity.html) |

## 標準エディター

`Finch.render()` は、`editor: false` を指定しない限り標準エディターを追加します。SVG 左下の Finch ボタンを押すと、図の下に HTML の編集パネルが開きます。パネルを閉じている間は閲覧モードになり、開くとその編集セッションの状態へ戻ります。

```js
const diagram = Finch.render(source, { target: "#diagram" });
```

パネルには Zoom、Edit ON/OFF、Undo、Pin/Unpin、Auto layout、Reset、Fit、Width、Save、SVG、PNG、ライブ更新される Source 欄があります。Save は明示的な操作です。Edit ON/OFF を切り替えてもソースや配置は保存されません。

編集モードでは次の操作を使えます。

- ノードをドラッグすると手動位置が追加されます。
- ノードをダブルクリックすると Pin の有無が切り替わります。
- Ctrl／⌘／Shift を押しながらクリックすると複数選択し、まとめて移動できます。
- 選択したノードは `P` で固定し、`Escape` で選択を解除できます。
- Ctrl／⌘＋ホイールで拡縮し、Space／Alt＋ドラッグでパンできます。
- `autoLayout()` は固定していないノードを再配置します。
- `resetLayout()` はすべての手動位置と固定を破棄します。

閲覧モードでは、通常の左ドラッグはノード移動ではなくパンになります。Zoom は使えますが、レイアウト編集、選択、Pin、Fit は無効になります。

## 図をフリーズする

鳥のアイコンで編集メニューを開き、「フリーズ」を押します。入力中のソースと現在の配置を保存し、図を閲覧モードにします。編集メニューと鳥のアイコンは消え、読み込み後も表示されません。図の移動や Pin は使えませんが、拡大、縮小、画面のスクロールは使えます。画面からフリーズを解除する操作はありません。

「フリーズ」は保存を含む操作です。保存先はSaveと同じで、`onSave`、明示した `editor.storage`、またはHTMLファイルです。保存に失敗すると編集メニューへ戻り、エラーを表示します。ソースを直すか、保存先を確認してから、もう一度押してください。通常の Edit ON/OFF やメニューの開閉では保存しません。

図のデータには `LayoutOverlay.frozen` を追加しました。`frozen: true` は `editable: true` より優先します。`frozen` がない古いデータは、これまでどおり編集へ戻せます。JSON の保存と読み込み、`saveLayout()`、`exportMarkdown()`、`Finch.renderMarkdown()`、標準エディターの保存と読み込みで、この状態を引き継ぎます。

```js
diagram.freeze();
console.log(diagram.frozen); // true
const json = diagram.exportLayout();
```

`freeze()` は図をフリーズして同じインスタンスを返します。API から呼んだ場合は保存しないため、呼び出す側で JSON などを保存してください。`setEditable(true)` や `EditorController.open()` では編集へ戻れず、`EditorController.setSource()` も変更しません。`finch:layoutchange` は空の `changedNodeIds` と、`frozen: true` を含む overlay を通知します。

公開APIの `update()` と `setTheme()` は、呼び出す側から図を更新する用途を保ちます。更新後もフリーズは続きます。`importLayout()` は渡したデータに置き換えるため、`frozen` がないデータや `frozen: false` のデータを渡すとフリーズを解除します。フリーズは画面での編集を止める機能です。データを書き換える権限を制限する機能ではありません。

## ソース更新と安定した ID

```js
diagram.update(nextSource);
```

`update()` はソースを再解析して図を描き直します。`@graph` から `@flowchart` へ変える場合も含め、同じ ID の既存ノードは配置状態を引き継ぎ、新しいノードは自動配置へ入ります。生成済み SVG の文字列は `toSvgString()` で取得できます。

ノード名と接続ラベルは、`\n` で指定した改行を保ちます。長い行には自動折り返しも適用し、英語は可能なら単語の区切り、日本語や長い識別子は文字の区切りで折り返します。結合された絵文字は途中で分割しません。全文を表示するため、標準図形は文字量に合わせて広がり、菱形や楕円でも文字を輪郭の内側に収めます。コンテナ見出しは子要素の上に、シーケンス図のメッセージは行間に空間を確保します。スライドの文章も省略記号で切らずに要素を広げます。

日本語では利用可能な単語境界を優先し、幅に収まる `10万円` などの数値と単位をまとめます。閉じ括弧や句読点が行頭に来るのを避け、末尾の行が極端に短い場合は最後の2行を調整します。明示した改行を優先します。

属性を指定できるノード宣言では、`[wrapWidth=160]` で文字領域の折り返し幅を SVG 座標の単位で指定できます。最小値は24です。余白と図形の輪郭は別に確保するため、要素全体の幅はこれより広くなる場合があります。指定がなければ図形ごとの標準幅を使います。接続ラベルは、標準の上限幅180と経路の空間に合わせて自動で折り返します。

HTML では `String.raw` を使うと、図のソースに `\n` をそのまま渡せます。通常の JavaScript 文字列では `\\n` と書きます。

```js
const source = String.raw`
@flowchart
process review "申請内容を確認する\n添付書類も確認する" [wrapWidth=160]
process done "審査結果を送る"
review -> done: 確認が完了したら\n利用者に結果を知らせる
`;
```

保存済みの座標とピン留めは維持します。保存済みの幅や高さが現在の文字を収めるには小さすぎる場合は、必要な大きさまで広げます。[折り返しの作例](../examples/label-wrapping.html)で挙動を確認できます。

## 保存

意味を表すソースと、人が調整した layout overlay は別の情報です。overlay には、ノード位置、必要な場合のサイズ、Pin、編集モードの状態が入ります。

標準のSaveは図のソースと全ノードの配置をHTMLに埋め込んで保存します。初回は保存先を選び、同一ページのセッション中は同じファイルに保存します。API非対応時はHTMLをダウンロードします。`onSave` を指定するとホストへ保存を委譲し、`onChange` はソース編集や配置操作の確定を通知します。既存の `editor.storage` も明示指定時に使えます。優先順位は `onSave` → `editor.storage` → HTML保存です。`storageKey` は保存アダプター用です。[保存とコールバックの詳細](./saving_ja.md)を参照してください。

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

`saveLayout(target?)` は同じ JSON を返し、`script[type="application/json"][data-finch-layout]` 要素へ書き込むこともできます。`editable` のない旧形式の overlay は、後方互換のため編集モードで復元します。

## イベント

イベントは生成された SVG からバブリングするため、ホスト要素で受け取れます。

| イベント | `detail` | 用途 |
| --- | --- | --- |
| `finch:layoutchange` | `{ overlay, changedNodeIds }` | `changedNodeIds` が空でないとき、独自編集セッションを未保存として扱う |
| `finch:editchange` | `{ editable, overlay }` | 独自の Edit 操作と状態を同期する |
| `finch:zoomchange` | `{ zoom, mode }` | Zoom 操作と表示を同期する |

標準エディターは、Save または「フリーズ」を押したときに保存します。編集モードの切り替えでは `changedNodeIds` が空になり、それだけでは保存しません。

## レイアウトの挙動

Flowchart は既定で上から下へ進み、同じ段階の分岐が横に広がります。State の fork/join も縦に読み、fork、並行する State、join、合流後の State の順に並びます。

Graph も既定では上から下へ進みます。左から右へ並べる場合は `@graph direction=LR` を使います。Graph のノードには型キーワードが不要で、接続に初出した ID は暗黙のノードになり、`group id "表示名" { ... }` で関連ノードを枠にまとめられます。

Deployment のコンテナには `layout=row`、`layout=column`、`layout=grid` を指定できます。grid には `columns`、直接の子には `order`、`row`、`column` を指定できます。トップレベルのコンテナに `place=below` を付けると、別の横方向バンドを増やさず直前要素の下へ置きます。これらは自動配置へのヒントであり、正確な手動座標は overlay に残します。

State の fork または join に接続する遷移は自動的に上下の Port を使います。必要なら `fromPort` または `toPort` で端点を上書きできます。値は `top`、`right`、`bottom`、`left` です。

組み込みの有向レイアウトでは `order` と親グループの所属を配置に反映します。フローチャート・アクティビティ図では分岐先の `[main=true]` で主経路を指定できます。指定は表示上の配置に作用し、接続の意味を変更しません。未指定時は自動選択します。


ラベルと図形の寸法に応じて自動配置が調整されます。明示したグリッドや手動位置によっては、ラベルが重なる場合があります。

Graph のグループ枠は内部要素に合わせて調整されます。更新時は保存済み位置を引き継ぎ、`autoLayout()` は標準でピン留めした位置を維持します。

組み込みルーティングは図形の回避と接続口の制約を扱い、交差・重なり・曲がり角・距離を評価します。明示した `fromPort` / `toPort` を優先します。状態図の通常状態では各遷移を独立して扱います。安全な経路を作れない場合も線は省略しません。交差や重なりが必ずゼロになる保証はありません。

SVG の表示範囲には、外側へ迂回する線、ラベル、負の座標も余白付きで含まれます。`instance.geometry.origin` が表示範囲の左上座標、`width` と `height` が全体の寸法です。ノード座標と保存済み配置は平行移動しません。ソース更新では既存の位置を引き継ぎ、`autoLayout()` は標準でピン留めしたノードを維持します。

## Zoom と画像出力

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

Zoom の既定範囲は 25〜200% です。`Finch.render()` の `minZoom` と `maxZoom` で変更できます。画面の表示倍率は、図の意味、座標、保存する overlay には影響しません。

```js
diagram.downloadSvg("system-map.svg");
await diagram.downloadPng("system-map.png", { scale: 2 });
const transparentPng = await diagram.toPngBlob({ background: null });
```

SVG と PNG には現在の手動位置を反映し、エディターボタンは含めません。

## Theme と拡張

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

独自の Diagram、Shape、Layout、Theme を登録する場合は、`createFinch()` で独立した registry を作れます。plugin の契約は[Finch.js の拡張](./extensions_ja.md)、一式を組み合わせる完成例は [extensions.html](../examples/extensions.html)を参照してください。

## インスタンス API

Markdownの文書には `Finch.parseMarkdown(markdown)` と `Finch.renderMarkdown(markdown, options?)` を使います。図と座標をまとめて保存する形式と、複数の図から選ぶ方法は[Markdown に図と座標を保存する](./markdown_ja.md)を参照してください。

| 操作 | 用途 |
| --- | --- |
| `update(source)` | 再解析・再描画し、同じ ID の配置を維持する |
| `setTheme(theme)` / `setLayout(name)` | 表示を切り替える |
| `select(ids)` / `clearSelection()` | コードから選択状態を操作する |
| `pin(ids)` / `unpin(ids)` | 手動位置を固定・解除する |
| `autoLayout()` / `resetLayout()` / `undoLayout()` | 再配置する、配置情報を消す、直前の編集を戻す |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | 表示倍率を操作する |
| `setEditable(value)` / `editable` / `canUndo` | 編集モードを切り替え、Undo の可否を得る |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | 全体・幅に合わせる、または 100% へ戻す |
| `exportLayout()` / `importLayout(value)` | layout overlay を保存・復元する |
| `exportMarkdown()` | 図のソースと全ノードの座標を、一つのコードフェンスとして返す |
| `saveLayout(target?)` | overlay JSON を返し、必要なら JSON script 要素へ書き込む |
| `toSvgString()` | 現在の SVG を文字列にする |
| `downloadSvg(filename?)` | 現在の図を SVG として保存する |
| `toPngBlob(options?)` | PNG の `Blob` を作る |
| `downloadPng(filename?, options?)` | 現在の図を PNG として保存する |
| `Finch.attachEditor(instance, options?)` | 標準エディターをあとから追加する |
| `destroy()` | SVG を削除してインスタンスを終了する |

パッケージには、公開 API と plugin interface の TypeScript 宣言が含まれています。


[共通部品・include・繰り返し・関数・検証のリファレンス](preprocessing_ja.md)


## クラス・オブジェクトの関係線

`--`は関連、`-->`は方向付き関連、`..>`は依存、`*--`は合成、`o--`は集約です。`--|>`は汎化、`..|>`は実現を表します。矢印や菱形を反対側に置く場合は`<--`、`<..`、`--*`、`--o`、`<|--`、`<|..`を使います。関連・合成・集約は`..`、`*..`、`o..`（逆向きは`..*`、`..o`）で点線にできます。

```text
@object
object part
object whole
part "many" --* "1" whole: owned by
```

両端の引用符は多重度です。名前空間内ではローカル名を使用できます。`diamond membership`で多項関連の菱形、`map kickoff {}`で空のマップを宣言できます。

合成・集約に参照方向を付けるには`*-->`・`o-->`を使います。逆向きは`<--*`・`<--o`、点線版は`*..>`・`o..>`・`<..*`・`<..o`です。菱形と開いた矢印を両端に描画します。

`a <--> b`は双方向の関連、`a <..> b`は双方向の依存です。一本の線の両端に開いた矢印を表示し、多重度は記述した左右の要素に対応します。

クラスのメンバーには`+count: int {static}`、`+run() {abstract}`のように末尾にも修飾子を置けます。`{classifier}`は`{static}`と同じ意味で、先頭・末尾のどちらでも使えます。

クラス本文で`--`・`..`・`==`・`__`を区切りとして使えます。`.. API ..`のように見出しも付けられます。区切りを使うクラスでは、属性と操作を並べ替えずに記述順を維持します。

`+void {abstract} start()`のように、修飾子を型名とメンバー名の間にも置けます。引用符内の`"{static}"`などは通常の文字列として保持します。

クラス形式の宣言として`annotation`・`record`・`dataclass`・`struct`・`protocol`・`exception`・`metaclass`・`stereotype`・`entity`も使えます。種別を見出しに表示し、メンバー、名前空間、注釈、hide/showに対応します。ラベル付きのstereotype宣言は`stereotype S "Label" {}`と波括弧を付けます。`stereotype S "text"`は従来どおり属性指定です。

クラス・オブジェクト図では`note "共通の説明" as N`で独立した注釈を宣言し、`A .. N`・`B .. N`のように複数の要素へ接続できます。`rnote`・`hnote`も使えます。

名前付き注釈は複数行でも書けます。

```text
note as N
共通の制約
複数のクラスに適用する
end note
A .. N
B .. N
```

`rnote as N`・`hnote as N`も対応し、それぞれ`end rnote`・`end hnote`で閉じます。

直前の分類子への注釈は`note right: 説明`のように対象名を省略できます。left/right/top/bottomとnote/rnote/hnoteに対応します。先に要素の宣言が必要です。

クラス・オブジェクト図では、直前要素への省略形も`note right`から`end note`までのブロックで書けます。left/right/top/bottomはこの形式では方向名です。同名の要素を指定する場合は`note right of right`のように対象を明記します。

`note on link: 説明`は直前の関係線への注釈です。`note left on link`のように方向を指定でき、`end note`で閉じる複数行形式にも対応します。同じ要素間に複数の関係があっても直前の一本を選びます。

抽象クラスは`abstract Base`と`abstract class Base`のどちらでも宣言できます。テンプレート引数や本文も同じように使えます。

分類子は`class "注文サービス" as OrderService`、または`class OrderService as "注文サービス"`と別名宣言できます。関係線やメンバー追記ではOrderServiceを使います。既存の`class OrderService "注文サービス"`も使えます。

`object "Alice : User" as alice`や`map "ユーザー索引" as users { ... }`にも別名を使えます。クラス・オブジェクト・マップを混在させても、関係線では各IDを参照します。

`class Service <<application>>`のように宣言内へステレオタイプを書けます。引用符付き表示名・テンプレート・名前空間に対応し、`hide <<application>> methods`などの選択にも使えます。

`class "注文サービス" as S <<application>>`のように、別名とステレオタイプを併記できます。抽象クラスとテンプレート引数にも対応します。

メンバー名の先頭の記号を可視性として扱わない場合は、`\~Resource()`のようにバックスラッシュでエスケープします。表示は`~Resource()`となり、可視性による非表示指定から除外されます。`Client --> Resource::~Resource()`でデストラクターへ接続できます。

分類子自体の可視性は`+class A`（public）、`-class A`（private）、`#class A`（protected）、`~class A`（package）で指定できます。表示名の前へ記号を表示し、参照用IDは変わりません。

クラス図は`Client --> Service`だけでも書けます。関係線の未宣言の端点を空のクラスとして補い、明示宣言があればそちらを優先します。名前空間内の短い名前は現在のスコープへ補います。メンバー名は自動生成しません。`@class`ではオブジェクト・JSONとの混在時もクラスを補います。`@object`の未解決参照は引き続きエラーです。

純粋なクラス図では`Service : +run()`だけでもクラスを宣言できます。複数の追記をまとめ、名前空間・パッケージ所属を保持します。明示宣言がある場合はその本文へ追加します。

関連端の非ナビゲーション指定は`A x-- B`・`A --x B`で表します。×印を指定した端に描画します。点線版は`x..`・`..x`です。

`A x--> B`はA側を×印、B側を矢印で示します。逆向きは`A <--x B`、点線版は`x..>`・`<..x`です。

関係ラベルの読み方向は`A -- B: owns >`や`A -- B: < owned by`で指定します。端点の矢印とは独立した三角印をラベルに表示し、ラベルが載る線分に応じて上下左右を変えます。

### クラス関連の特殊端点

`A #-- B`は四角、`A }-- B`は三つ又、`A +-- B`は丸付き十字、`A ^-- B`は中抜き三角をA側に描きます。B側に置く場合は`--#`、`--{`、`--+`、`--^`を使用します。`--`を`..`にすると破線になります。通常の関連に描画記号を付ける機能であり、汎化には継承構文を使用してください。`A #--> B`のように`>`を加えるとナビゲーション矢印を併用できます。逆向きの`A <--# B`にも対応し、多重度とメンバー接続は記述した側に保持します。

クラス図・オブジェクト図では`<> link`を`diamond link`の短縮記法として使用できます。引用符付きラベルと名前空間にも対応します。

クラス図では`circle API`、`() API`、`() "Public API" as API`で円形インターフェースを宣言できます。小さな円の下にラベルを表示し、線は円に接続します。下方向の接続は側面へ回してラベルを避けます。

コンポーネント図・配置図の`provided`も、クラス図の`circle`と共通の小さな円・外側ラベルで描画します。

コンポーネント図・配置図の接続には、ラベルの後ろに`[fromPort=bottom toPort=left]`を指定できます。明示した方向は提供インターフェースのラベル回避より優先するため、ラベルを横切らない方向を選んでください。

クラス図・オブジェクト図の関連にも`[fromPort=left toPort=right]`を指定でき、多重度・関連端名と併用できます。fromRole/toRoleと同様に、矢印方向を解決した意味上の始点・終点への指定です。メンバーやマップ行への接続は行に沿った配線を優先します。

接続ポートの値は`left`・`right`・`top`・`bottom`です。無効な値は解析エラーとなり、自動接続へ黙って置き換えません。

コンポーネント図・配置図で、矢印のない実線`-`/`--`、破線`..`、逆向き矢印`<-`/`<--`/`<..`を使用できます。既存のFinch仕様では`-->`/`<--`は破線矢印です。ダッシュ数が方向・長さを示すPlantUMLとはこの点が異なります。

コンポーネント図・配置図の宣言では`component "注文サービス" as orders`、`component orders as "注文サービス"`を使用できます。末尾の属性とコンテナーの開始括弧を保持し、接続にはIDを使います。

`[注文サービス] as orders`、`component [Billing] as billing`、`[Worker]`でコンポーネントを短く宣言できます。提供インターフェースは`() "Public API" as api`です。空白を含む角括弧名でも別名を省略できます。`[注文サービス] --> [決済サービス]`のように書くと未宣言の要素を補完し、後から明示した宣言と同じ要素として扱います。

コンポーネント図・配置図の注釈では`note right of [注文サービス]: 注文を受け付ける`と書けます。`end note`で閉じる複数行形式にも対応します。

コンポーネント図では`[注文サービス] ..> HTTP`のように、未宣言の裸の端点を提供インターフェースとして補完します。明示宣言を優先し、角括弧の端点はコンポーネントとして扱います。配置図の未宣言の裸のIDは従来どおりエラーです。

`() "公開 API"`や`component "注文サービス"`のように、引用名だけでも宣言できます。接続は`"注文サービス" -- "公開 API"`と記述します。`as`で別名を付けた場合は、その別名で参照してください。

引用名には`note right of "公開 API": 契約`で注釈を付けられます。`end note`で閉じる複数行形式も使用できます。

コンポーネント図・配置図では`note "共通の契約" as contract`で独立した注釈を作り、`A .. contract`で接続できます。`note as contract`から`end note`までの複数行形式にも対応し、複数の要素から同じ注釈を共有できます。

`component orders [`から単独行の`]`までに、複数行のコンポーネント説明を書けます。本文中の`title`や`note`も説明の文字列として保持します。

コンポーネント図・配置図では`componentStyle uml1`・`componentStyle uml2`（既定）・`componentStyle rectangle`で表示形式を切り替えられます。`skinparam componentStyle ...`も受け付けます。ノードの`[componentStyle=rectangle]`は全体指定より優先します。

`folder services "Services" { ... }`・`frame processing "Processing" { ... }`で、それぞれフォルダー形・フレーム形のグループを作れます。引用名の別名と入れ子にも対応します。

`node host "Host" { ... }`で立体的な外枠の配置ノードグループを作れます。入れ子やコンポーネントの格納に対応します。単独の`node host`は従来の矩形表示を維持します。

`database storage "Storage" { ... }`で、円筒形のデータベース外枠の中に要素をまとめられます。見出しは上部の楕円の下に配置します。

空のグループは`node "Host" as host {}`のように1行で書けます。package・folder・frame・node・databaseで、後から本文を追加しても同じIDと表示名を保持します。

`cloud environment "Cloud" { ... }`で雲形の外枠に要素をまとめられます。グループの入れ子、別名、空の`{}`形式にも対応します。

コンポーネント図・配置図で`top to bottom direction`・`left to right direction`（既定）を指定できます。階層配置では、通常の図と入れ子のグループ内の配置に反映します。

要求インターフェースの半円は接続側に背を向けます。`required api "API" [opening=left]`で開口方向を固定できます（left/right/top/bottom）。複数接続では最初の自己接続以外の辺を自動方向の基準にします。

コンポーネント図・配置図でも `hide A`（配置領域を保持）、`remove A`（配置から除外）、`show A` / `restore A`（再表示）を使えます。ID、角括弧名、宣言種別、`*`、`unlinked`で選択します。グループの指定は子孫にも反映され、接続線・付属注釈も追従します。宣言解決後にソースの順で適用します。

コンポーネント図・配置図では `tag A internal worker` でタグを付け、`remove $internal` などで選択できます。`restore <<public>>` は `[stereotype=public]` の要素を選択します。タグ指定・表示ルールは宣言より前にも置けます。選択対象がないタグ・ステレオタイプは何も変更せず、存在しないノードへのタグ付与はエラーになります。

コンポーネント図・配置図では `[Order service] as orders <<public>> $api $production` のように宣言へ直接メタデータを書けます。属性指定やグループ開始の `{` と併用できます。引用ラベル・角括弧名に含まれる同じ記号は文字として保持します。

`component A <<service>> <<public>>` のような複数ステレオタイプを保持し、それぞれで選択できます。`hide stereotype` はステレオタイプ文字だけを隠し、`show A stereotype` や `show <<public>> stereotype` で戻せます。要素と接続線は表示を維持します。

コンポーネント図・配置図の方向を変更しても手動・固定座標は保持されます。`autoLayout()` は固定を保って再配置し、`autoLayout({preservePinned:false})` または `resetLayout()` は全座標を再計算します。方向と手動座標を復元するには、ソースとexportLayoutの両方を保存します。

コンポーネント図・配置図の注釈は `note right of orders: Public API` と簡潔に書けます。別名IDや宣言省略された対象にも使え、rnote/hnote/constraintでも同じ指定が可能です。

コンポーネント図・配置図の宣言直後には `note right: 詳細` と書けば、IDを繰り返さず直前の要素に注釈を付けられます。rnote/hnoteも同様で、グループ内の別名付き宣言にも対応します。

コンポーネント図・配置図で `note on link: 詳細` を直前の関係線に付けられます。rnote/hnoteにも対応し、方向付き矢印や明示ポート指定でも同じ関係線を対象にします。

`@component` では `[Service] -- "Public API"` だけで提供インターフェースを補完します。同名参照は同じ要素となり、後から明示宣言できます。`@deployment` ではこれらの端点の明示宣言が必要です。

`cloud { ... }`、`package { ... }`、`folder {}` のようにグループ名を省略できます。開始波括弧の前に属性も指定できます。匿名グループの内部IDは宣言順なので、挿入・並べ替え後も同一性を保ちたい場合は明示名を付けてください。

コンポーネント図・配置図で `rectangle gateway "Gateway"` は矩形ノード、`rectangle "Platform" as platform { ... }` はグループになります。別名・タグ・ステレオタイプ・無名の `rectangle {}` にも対応します。

`component platform { ... }` でコンポーネント内に要素を含められます。境界にコンポーネント記号を表示し、`componentStyle rectangle` で省略できます。入れ子と別名にも対応します。

グループ内の `portin input`・`portout output` は境界へ配置します。横配置では左右、縦配置では上下です。再配線時に所有グループへ追従します。中立ポートの自動側面選択とラベル配置は未完了です。

中立の `port` は所有グループ外への最初の接続から配置側を選びます。外部→ポートなら入力側、ポート→外部なら出力側です。外部接続がなければ入力側とします。`portin`・`portout` は明示指定を維持します。

クラス図・コンポーネント図・配置図の表示制御では、PlantUML形式の `@unlinked` と従来の `unlinked` の両方を使えます。関係線の端点に登場しない要素を選びます。

コンポーネント図・配置図の矢印前後は空白を省略できます（`[A]->[B]`、`order-api->billing-api`、`A-left->B`）。裸ID同士の単一ハイフン接続はID内のハイフンと区別するため `A - B` と空白を入れます。

方向付き破線も `A.right.>B`、`A<.left.B`、`A .down. B` と指定できます。破線の線種を保持して、配置方向を反映します。

### キューのグループ

component/deployment図の queue は横向きの円筒です。queue "表示名" as ID { ... } で内部に要素を配置できます。匿名の queue { ... } と入れ子にも対応します。単独の queue ID "表示名" も使えます。

### ファイル

component/deployment図では file "表示名" as ID または file ID "表示名" でファイルを宣言できます。file "表示名" as ID { ... } は包含グループになり、匿名の file { ... } や入れ子にも対応します。

artifact "表示名" as ID { ... } は成果物の包含グループです。内部にfileや他の成果物を配置でき、匿名の artifact { ... } も使えます。グループの既定ステレオタイプはartifactで、hide artifact stereotypeで非表示にできます。

配置図とコンポーネント図では node Production as host のように、空白のない表示名の引用符を省略できます。この書式の左側が表示名、右側が接続や注釈に使うIDです。

### 枠なしラベル

label "説明文" as ID は枠のない文字要素です。component/deployment図で使用でき、接続・注釈・icon/image・hide/remove labelに対応します。

JSONの行へは App -> config::host のようにキー名で接続できます。項目の順番を変えてもキー名で再解決します。空白や日本語などを含むキーは config::"接続先 URL" のように引用符で指定できます。fromMapRow/toMapRowの行番号指定も使えます。

配置図・コンポーネント図の単独nodeは立体ノードとして描画します。node Host { ... }は包含ノードです。長方形を指定する場合はrectangle Host、またはnode Host [shape=rectangle]を使います。単独nodeにもicon/image/toneを指定できます。

### 追加の配置要素

以下は `@deployment` と `@component` で使えます。別名は `種類 "表示名" as ID`、接続は `ID -> Other` です。

| 宣言 | 表示 | `{ ... }` による包含 |
|---|---|---|
| `node` | 立体ノード | 可 |
| `action` | 角丸の処理要素 | 可 |
| `storage` | 大きな角丸の記憶領域 | 可 |
| `process` | 左側が凹んだ右向きの処理要素 | 可 |
| `stack` | 重なった矩形 | 可 |
| `collections` | 集合を表す重なった矩形 | 不可 |
| `agent` | 矩形 | 不可 |
| `person` | 頭部と、ラベルを収める胴体 | 不可 |
| `boundary` / `control` / `entity` | 境界・制御・データの役割記号 | 不可 |

`hide person`、`remove agent` のように宣言の種類で選択できます。`agent` は矩形表示でも `rectangle` とは別の種類です。`device` と `artifact` の既定ステレオタイプは `hide stereotype` で隠せます。独自の `<<分類>>` は既定値を置き換えます。

### 配置要素の複数行説明

```text
@deployment
node Worker [
注文処理サービス
キューから要求を取得
] [tone=green icon=server]
component API
API -> Worker
```

本文全体をラベルにします。本文の `hide` や `title` は命令として実行しません。`component/node/folder/database/usecase/card/artifact/file/queue/cloud/rectangle/hexagon/stack/action/storage/process` で使えます。閉じる `]` は独立した行に置き、属性を続けられます。HTML・Creole装飾の解釈は未対応です。

### UML関係線と業務用記号

以下は配置図・コンポーネント図・ユースケース図で使用できます。

| 記述 | 意味 |
|---|---|
| `Child --\|> Parent` | 汎化。親側に白抜き三角、実線 |
| `Implementation ..\|> Contract` | 実現。契約側に白抜き三角、破線 |
| `Owner o-- Part` | 集約。所有側に白抜き菱形 |
| `Owner *-- Part` | 合成。所有側に塗りつぶし菱形 |
| `Owner *--> Part` | 合成に参照方向の矢印を追加。`o-->` も可 |
| `A <-> B` | 双方向の実線 |
| `A <--> B` | 双方向の破線（Finchの線種規則） |

逆記法も使えます。`Parent <|-- Child`、`Contract <|.. Implementation`、`Part --o Owner`、`Part <--* Owner` はそれぞれ所有・継承の意味を保ちます。集約・合成の記号前後には空白を入れます。Finchの通常矢印 `-->` は破線であり、PlantUMLの同じ文字列とは線種が異なります。

`actor/ Customer` と `usecase/ Order` は業務用の斜線付き記号です。`actor Customer [business=true]`、`usecase Order [business=true]` でも指定できます。

`@usecase` では `include A -> B`、`extend A -> B`、`generalize Child -> Parent` と短く書けます。末尾に `[fromPort=right toPort=top]` を付けられ、次行の `note on link: 説明` はその関係へ付きます。

`:Customer: -> (Order)` はアクターとユースケースの宣言を省略する書式です。同名の端点は再利用します。種類が競合する場合は別のIDを使って明示宣言してください。

collections・stack・person でも、テーマに依存しない共通の `icon`／`image` 属性を利用できます。

component・deployment・usecase の関係末尾の属性ブロックは、fromPort/toPort がなくても利用できます。例: A -> B [bidirectional=true]。属性は完全な接続記述の後に置きます。

明示した relation 属性は線種にも反映されます。realization/dependency は破線、inheritance/aggregation/composition/association は実線です。専用の UML 関係記号がある場合、その意味を relation 属性より優先します。

破線の集約・合成も利用できます: Owner o.. Part、Owner *..> Part。逆向きは Part ..o Owner／Part <..* Owner です。これらの関係記号の前後には空白が必要です。

agent・person・collections・actor・actor/・boundary・control・entity・label でも、開始行を「種類 ID [」、終了行を「]」とする複数行説明が使えます。終了行の後ろにスタイル属性も指定できます。

component・deployment・usecase の太い関係線は ==、==>、<==、<==> で指定します。線幅はテーマの通常線の2倍です。他の関係記号には [lineStyle=bold] を指定できます。

component・deployment・usecase では A -[bold]-> B、A -[dashed]-> B、A -[dotted]-> B、A -[plain]-> B と逆向き矢印が使えます。末尾の [lineStyle=plain/dashed/dotted]（いずれか1値）でも、関係マーカーを保って線種を上書きできます。

A -[thickness=4]-> B で線幅を指定できます。A -[dotted,thickness=2.5]-> B のように線種と併用できます。線幅は正の有限数で、テーマの線幅やboldより優先されます。

[継承ソース・個別の線色・文字修飾の指定方法](uml-three-features_ja.md)

[UML追加6項目の記法・検証範囲](reference_ja.md)

[配置とルーティングの設定](#配置とルーティングの設定)


## 配置とルーティングの設定

- 接続線の `routing=balanced|avoid-crossings` で経路評価を選択できます。既定は `balanced` です。
- `crossingCost=120`、`bendCost=48`、`lengthCost=1`、`crossingClearance=18` が既定値です。指定値は0より大きく10000以下。距離はSVG座標で、最小間隔の保証ではありません。
- 配備図の親コンテナの `layout=architecture` は直下に3つの子コンテナがある場合に対応します。内部の配置は `layout=row|column|grid` で指定できます。
- `Finch.render(source, { expandRoutingChannels: false })` で配備図の自動通路拡張を無効化できます。保存済みノード位置がある場合とフリーズ中は拡張しません。
- 状態図の表示は `stateTransitions: "separate"` が既定です。`"group"` は同方向・同じ表示属性・ラベルありの遷移を表示上集約します。元ソースは保持します。自己遷移と注釈を含む図は対象外です。
- 枠は内部要素に合わせて伸縮します。境界ピン・ポートは枠に追従し、枠を広げる内部要素として扱いません。
- クラス・オブジェクト図は継承・実現の親、集約・合成の全体を上側へ優先配置します。保存済みの手動位置は優先します。
