# Finch.js チュートリアル

[English](./tutorial.md) · [README に戻る](../README_ja.md)

このチュートリアルでは、実務的な図を生成し、手で配置を整え、その配置を失わずにソースを変更し、用途に合った方法で保存・組み込みできるところまで進みます。

## 1. 最初の図を表示する

次のページを `order-flow.html` として保存し、ブラウザーで開いてください。バージョンを固定した CDN 版を使うため、Finch.js のリポジトリ外でもインストールなしで動きます。

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>注文処理フロー</title>
    <style>
      body { margin: 0; background: #f8fafc; }
      #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <main id="diagram" aria-label="注文処理のフローチャート"></main>

    <script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
    <script>
      const orderFlowSource = `
@flowchart
start received "注文を受け付ける"
process validate "在庫を確認する"
decision available "在庫あり?"
process reserve "商品を確保する"
end confirmed "注文確定"
end backorder "入荷待ち"

received -> validate
validate -> available
available -> reserve: Yes
available -> backorder: No
reserve -> confirmed
      `.trim();

      const diagram = Finch.render(orderFlowSource, {
        target: "#diagram",
        editor: { storageKey: "order-flow" },
      });
    </script>
  </body>
</html>
```

縦に進む注文処理と、図の左下に小さな Finch ボタンが表示されれば成功です。

次は、自動生成された配置を自分の図へ仕上げます。

## 2. ドラッグして固定する

Finch ボタンを開いてください。図の下にエディターが開き、レイアウトを編集できるようになります。

次の順に操作します。

1. `入荷待ち` を正常系の経路から少し離れた場所へドラッグします。
2. そのノードをダブルクリックして固定します。Pin の印が表示されます。
3. ほかのノードも動かしますが、こちらは固定しません。
4. **Auto layout** を押します。

固定したノードは手で決めた位置に残り、固定していないノードだけが再配置の対象になります。**Undo** は直前の配置へ戻し、**Reset** は手動位置と固定をすべて破棄します。

次は、配置をやり直さずに図の意味を変更します。

## 3. 配置を保ったままソースを変える

エディターの Source 欄で、次の行を書き換えます。

```text
process validate "在庫と引当可能数を確認する"
```

少し待つと図が更新されます。表示文言は変わりますが、`validate` という ID は同じなので、手で整えた位置は変わりません。

続いて新しい副作用を追加します。`reserve` の宣言の次に、次の行を加えてください。

```text
process audit "引当結果を記録する"
```

`reserve -> confirmed` の次に、次の線を加えます。

```text
reserve --> audit: 非同期
```

新しい `audit` は自動配置へ入り、既存 ID に対応する手動位置は引き継がれます。意味が増えて余白が必要になったら、新しいノードをドラッグするか **Auto layout** で全体へなじませます。長く使う同一性は ID に、あとから変わりうる表現は表示名に持たせるのがポイントです。

次は、ソースと配置をどこへ保存するか決めます。

## 4. ソースと配置を保存する

### 標準エディターの Save

Finch エディターの **Save** を押します。現在のソースと配置が、指定した `storageKey` の `localStorage` へ保存されます。ページを再読み込みし、両方が復元されることを確認してください。Edit ON/OFF は操作モードを切り替えるだけで、暗黙には保存しません。

同じサイトに複数の図を置く場合は、図ごとに異なる `storageKey` を使います。

### アプリ独自の Save

アプリ側で UI を用意する場合は、明示的に配置を保存します。

```js
saveButton.addEventListener("click", () => {
  localStorage.setItem("order-flow-layout", diagram.exportLayout());
});

const saved = localStorage.getItem("order-flow-layout");
if (saved) diagram.importLayout(saved);
```

`finch:layoutchange` の `changedNodeIds` が空でないときだけ、未保存の配置変更として扱います。永続化するのは利用者が Save を選んだときです。

### 静的 HTML に配置を埋め込む

図の近くに JSON の script 要素を置きます。

```html
<script type="application/json" id="order-layout" data-finch-layout>
  {"version":1,"diagram":"flowchart","editable":false,"nodes":{}}
</script>
```

描画時にその内容を渡します。

```js
const overlay = document.querySelector("#order-layout").textContent;
const diagram = Finch.render(orderFlowSource, {
  target: "#diagram",
  overlay,
  editor: false,
});
```

ページを仕上げる間は `diagram.saveLayout("#order-layout")` を呼ぶと、現在の overlay をその script 要素へ書き込めます。生成された JSON を HTML にコピーしてコミットしてください。静的な文書でも、意味を表すソースと人が決めた座標を分けて管理できます。

次は、答えたい問いから図法を選びます。

## 5. 図法を選ぶ

| 読み手が知りたいこと | 最初に試す図法 | 作例 |
| --- | --- | --- |
| ソフトウェアがどこで動くか | `@deployment` | [本番サービス](../examples/deployment.html) |
| 何がどの順番で起きるか | `@sequence` | [購入処理の呼び出し](../examples/sequence.html) |
| 手順がどう分岐するか | `@flowchart` | [審査フロー](../examples/flowchart.html) |
| 状態がどう変わるか | `@state` | [ジョブのライフサイクル](../examples/state.html) |
| データがどう関係するか | `@er` | [注文データ](../examples/er.html) |
| ソフトウェアの責任境界がどこか | `@component` | [アプリケーション境界](../examples/component.html) |
| クラスがどう関係するか | `@class` | [注文ドメイン](../examples/class.html) |
| 利用者がシステムで何をしたいか | `@usecase` | [システムの目的](../examples/usecase.html) |
| UML のアクションがどう協調するか | `@activity` | [注文アクティビティ](../examples/activity.html) |
| プレゼンで何を一つ伝えるか | `@slide` | [KPI サマリー](../examples/slide-patterns.html) |

最初から全語彙を覚えず、目的に近い作例を開いてソースを変更してください。[リファレンス](./reference_ja.md)には、よく使う宣言とすべての完成例へのリンクがあります。

次は、すでに持っている情報から最初のドラフトを生成します。

## 6. Codex と使う

このリポジトリには、Finch のソースと描画コードを一つの HTML にまとめるスキルが含まれています。このチェックアウトから、次のように頼めます。

```text
$finch この注文審査仕様からアクティビティ図を HTML に作って。
ID は安定させ、正確な配置はあとで人が整えられるようにして。
```

生成された事実関係を確認し、ページを開き、人の判断が必要な数か所だけをドラッグして固定します。要件が変わったら、図を作り直さずにテキストを更新します。

ほかのワークスペースへインストールする場合は、次を実行します。

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

次は、標準エディターとは異なる UI が必要なときに Finch.js をアプリへ接続します。

## 7. アプリへ組み込む

メニューのない図にするには標準エディターを無効にします。編集を許可するタイミングをアプリ側で決める場合は、閲覧モードから始めます。

```js
const host = document.querySelector("#diagram");
const diagram = Finch.render(source, {
  target: host,
  editor: false,
  editable: false,
});

editButton.addEventListener("click", () => {
  diagram.setEditable(!diagram.editable);
});

host.addEventListener("finch:layoutchange", (event) => {
  const { overlay, changedNodeIds } = event.detail;
  if (changedNodeIds.length) markUnsaved(overlay);
});

sourceEditor.addEventListener("input", () => {
  diagram.update(sourceEditor.value);
});
```

独自の Edit 切り替えには `finch:editchange`、ズーム表示には `finch:zoomchange` を使って同期できます。画像を明示的に保存する場合は `downloadSvg()` または `downloadPng()` を呼びます。

これで、テキストから生成し、人が配置を判断し、ソースを育て、その二種類の情報を別々に保存する一連の流れを扱えるようになりました。

次は[リファレンス](./reference_ja.md)を確認するか、[発展例](../examples/README.md)を触ってみてください。独自の記法、Shape、Layout、Theme が必要になったら[Finch.js の拡張](./extensions_ja.md)へ進みます。
