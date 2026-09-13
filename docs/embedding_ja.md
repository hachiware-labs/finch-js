# アプリへの組み込みと保存

[English](embedding.md) · [チュートリアル](tutorial_ja.md)

このガイドは現在のリポジトリビルドを対象とします。


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


## 保存先

ホストアプリケーションへ保存する場合は、保存アダプターを差し替えます。`load` と `save` は同期関数でも非同期関数でも構いません。

```js
Finch.render(source, {
  target: "#diagram",
  editor: {
    storage: {
      load: (key) => workspace.readDiagramState(key),
      save: (key, value) => workspace.writeDiagramState(key, value),
    },
  },
});
```

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
