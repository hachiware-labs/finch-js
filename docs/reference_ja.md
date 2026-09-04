# Finch.js リファレンス

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
const diagram = Finch.render(source, {
  target: "#diagram",
  editor: { storageKey: "system-map" },
});
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

## ソース更新と安定した ID

```js
diagram.update(nextSource);
```

`update()` はソースを再解析して図を描き直します。同じ ID の既存ノードは配置状態を引き継ぎ、新しいノードは自動配置へ入ります。生成済み SVG の文字列は `toSvgString()` で取得できます。

長い表示名は、可能なら単語の区切り、必要なら文字の間で折り返します。すべての行を読めるようにノードの高さも広がります。

## 保存

意味を表すソースと、人が調整した layout overlay は別の情報です。overlay には、ノード位置、必要な場合のサイズ、Pin、編集モードの状態が入ります。

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

永続化するのは、明示的な Save 操作に応じるときだけです。編集モードの切り替えでは `changedNodeIds` が空になり、それだけで保存してはいけません。

## レイアウトの挙動

Flowchart は既定で上から下へ進み、同じ段階の分岐が横に広がります。State の fork/join も縦に読み、fork、並行する State、join、合流後の State の順に並びます。

Deployment のコンテナには `layout=row`、`layout=column`、`layout=grid` を指定できます。grid には `columns`、直接の子には `order`、`row`、`column` を指定できます。トップレベルのコンテナに `place=below` を付けると、別の横方向バンドを増やさず直前要素の下へ置きます。これらは自動配置へのヒントであり、正確な手動座標は overlay に残します。

State の fork または join に接続する遷移は自動的に上下の Port を使います。必要なら `fromPort` または `toPort` で端点を上書きできます。値は `top`、`right`、`bottom`、`left` です。

組み込みルーティングは、ノードの回避、線の交差の削減、直角の曲がり角の削減、短い経路の順に優先します。ノードが重なって安全な経路を作れない場合は、線を消さず既存の基本経路を使います。

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
| `saveLayout(target?)` | overlay JSON を返し、必要なら JSON script 要素へ書き込む |
| `toSvgString()` | 現在の SVG を文字列にする |
| `downloadSvg(filename?)` | 現在の図を SVG として保存する |
| `toPngBlob(options?)` | PNG の `Blob` を作る |
| `downloadPng(filename?, options?)` | 現在の図を PNG として保存する |
| `Finch.attachEditor(instance, options?)` | 標準エディターをあとから追加する |
| `destroy()` | SVG を削除してインスタンスを終了する |

パッケージには、公開 API と plugin interface の TypeScript 宣言が含まれています。
