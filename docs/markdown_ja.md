# Markdown に図と座標を保存する

[README に戻る](../README_ja.md) · [API を調べる](./reference_ja.md)

`exportMarkdown()` は、図のソースと現在の座標を、一つの `finch` コードフェンスにまとめて返します。`Finch.renderMarkdown()` にその文字列を渡すと、保存した位置で図を描きます。このAPIを使う場合は、この変更を含む Finch.js をビルドして読み込んでください。

## 図を保存して戻す

```js
import Finch from "../dist/finch.js";

const diagram = Finch.render('@graph\napi "注文を受け取る"\napi -> db', {
  target: "#diagram",
  editor: false,
});

// ノードを動かしたあとで呼びます。
const markdown = diagram.exportMarkdown();

// markdown をファイルなどに保存し、あとで読み込んで渡します。
const restored = Finch.renderMarkdown(markdown, {
  target: "#restored",
  editor: false,
});
```

この例では、HTMLに `id="diagram"` と `id="restored"` の表示先を用意します。`exportMarkdown()` は文字列を返します。ファイルへの書き込みは、呼び出す側で行ってください。

手で動かしたノードに加えて、自動で配置したノードも保存します。保存する値は、位置、大きさ、手で動かしたかどうか、位置を固定したかどうか、編集できるかどうかです。削除したノードは含めません。線やラベルは、読み込んだソースと座標から描き直します。表示倍率、テーマ、配置方法、独自の拡張は含めないため、読み込むときも同じ設定と拡張を使ってください。

## コードフェンスの中を読む

次の例では、`@graph` から図の内容が始まり、「座標を戻す」から保存した座標が始まります。音声で修正を頼むときも、この見出しとノードのIDを使えます。

````markdown
```finch
@graph
api "注文を受け取る"
' @finch-layout 座標を戻す。ノードの位置と大きさを保存します。
' {
'   "version": 1,
'   "diagram": "graph",
'   "editable": true,
'   "nodes": {
'     "api": {
'       "x": 120.5,
'       "y": 80,
'       "width": 200,
'       "height": 46,
'       "manual": true,
'       "pinned": true
'     }
'   }
' }
' @end-finch-layout
```
````

座標は、既存の `LayoutOverlay` の version 1 と同じJSONです。各行の先頭に `' ` を付けます。`' @finch-layout` と `' @end-finch-layout` は読み込みの目印なので、そのまま残してください。開始の目印のあとにある日本語の見出しと説明は変更できます。座標の部分は、図のソースのあとに一つだけ置きます。

ノードのIDを保てば、表示名を直しても保存した座標を使えます。座標の部分がないコードフェンスも読み込めます。その場合は通常の自動配置を使います。

## 複数の図から選ぶ

```js
const diagrams = Finch.parseMarkdown(markdown);
const second = Finch.renderMarkdown(markdown, {
  target: "#diagram",
  diagramIndex: 1,
});

// 図のソースと座標を分けて、既存のAPIにも渡せます。
const first = diagrams[0];
if (first) {
  Finch.render(first.source, {
    target: "#restored",
    ...(first.overlay ? { overlay: first.overlay } : {}),
  });
}
```

`parseMarkdown()` は `{ source, overlay? }` の配列を文書の順で返します。図がなければ空の配列です。名前付きの `parseMarkdown` としても import できます。`renderMarkdown()` は、既定では最初の図を描きます。`diagramIndex` は0から始まり、指定した図がないとエラーになります。`overlay` を明示して渡した場合は、Markdownに保存した座標より、その値を優先します。

コードフェンスの言語名は `finch`、`finchjs`、`finch.js` を受け付けます。バッククォートまたはチルダを3個以上並べて囲みます。行頭の空白は3個まで扱い、閉じる記号は開始と同じ種類で、同じ数以上にします。他のコードフェンスの中にある例は読み込みません。リストや引用の中に埋めたフェンスは対象にせず、文書の本文に置いてください。

閉じていない Finch のフェンス、壊れたJSON、対応していないversion、不正な座標はエラーになります。座標を捨てて自動配置へ切り替えることはありません。

## 既存の保存方法を使う

`Finch.render()`、`Finch.parse()`、`update()` は引き続き図のソースを受け取ります。Markdownの文書は、Markdown用のAPIで読み込んでください。`exportLayout()`、`importLayout()`、`saveLayout()` は従来のレイアウトJSONを扱います。標準エディターのSaveは、`onSave`、明示した `editor.storage`、既定のHTML保存の順に保存先を選びます。

エディタ側でフェンスを書き戻す実装は、[プラグイン開発ガイド](./plugin-development_ja.md)を参照してください。

Markdownの表示ソフトが自動で図を描く機能は含みません。文書を文字列として読み込み、`Finch.renderMarkdown()` を呼ぶ側の処理が必要です。
