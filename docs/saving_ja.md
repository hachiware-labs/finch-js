# HTML保存とホスト連携

[動くサンプル](../examples/save.html) · [リファレンス](./reference_ja.md)

エディタ拡張や投稿サービスへ組み込む場合は、[プラグイン開発ガイド](./plugin-development_ja.md)を参照してください。

標準のSaveは、ページ内のFinchのソースと全ノードの位置・サイズ・Pin・編集状態をHTMLに保存します。`localStorage`への暗黙の保存・復元は行いません。

## ブラウザ内の保存

- 初回は `showSaveFilePicker()` で保存先を選びます。現在のHTML名を候補にしますが、元ファイルのフォルダは自動指定できません。
- 同じページを開いている間は、保存に成功したファイルハンドルを図同士で共有し、次のSaveで再利用します。必要に応じてブラウザの権限確認が出ます。
- 「名前を付けて保存」は別の保存先を選びます。ページを開き直した場合も保存先の選択が必要です。
- APIがない場合はHTMLをダウンロードします。ダウンロードの完了や既存ファイルの上書きをFinchから確認することはできません。
- キャンセル・書き込み失敗では未保存状態を残します。保存中の追加編集も未保存状態を保ちます。

保存時にDOMのコピーからFinchの生成したSVGと編集UIを除き、`script[type="application/json"][data-finch-document]` に状態を埋め込みます。元の初期化スクリプトが再び `Finch.render()` を呼ぶと、保存したソースと配置を読み込んで描画します。ライブのDOMは置き換えません。複数の図を区別するため、描画先には安定したIDを付けてください。

これは静的HTMLページ向けです。外部のJavaScript、CSS、画像はファイル内へ同梱せず、元の基準URLを `base` で保持します。その参照先が利用可能である必要があります。任意のWebアプリ全体をオフライン化する機能ではありません。動的にページを組み立てるアプリやMarkdownエディタでは、ホストの文書モデルを更新する `onSave` を使ってください。

## コールバック

```js
Finch.render(source, {
  target: "#diagram",
  onChange: ({ source, overlay, markdown }) => {
    host.markDirty();
    // 自動反映する場合は、対象フェンスをmarkdownで置き換えます。
  },
  onSave: async ({ source, overlay, markdown }) => {
    await host.replaceDiagramFence(markdown);
    await host.saveDocument();
  },
});
```

`host` は組み込み先で実装する処理の例です。コールバックは任意です。`onChange` は標準エディターのソース編集（既定180msの待機後）、ドラッグ完了、Pin、Undo、自動配置、Resetで呼ばれます。`update()`、`importLayout()`、初期復元では呼ばないため、ホストからの反映を再通知しません。Edit ON/OFFやメニュー開閉も変更通知の対象外です。

`onSave` はSaveまたはフリーズ操作で呼ばれます。未反映のソース入力は保存前に反映・検証します。返したPromiseの解決を保存完了とし、例外・rejectを保存失敗として表示します。`AbortError` はキャンセルとしてエラー表示を省略します。フリーズはSaveと同じ列の赤系ボタンです。保存中はメニューと鳥アイコンを表示したまま編集を一時停止し、保存成功後に非表示にします。保存するデータには先にフリーズ状態を含めるため、開き直しても編集UIは出ません。保存失敗・キャンセルでは編集できる状態へ戻ります。

引数は `{ source, overlay, markdown }` です。`overlay` は全ノードの現在の配置を持つversion 1のJSONオブジェクト、`markdown` は同じ内容のコードフェンス文字列です。`instance.exportState()` でも取得できます。

保存先の優先順位は、トップレベルの `onSave`、`editor.onSave`、明示指定した `editor.storage`、既定のHTML保存の順です。`Finch.attachEditor()` では `onSave` を直接オプションに渡せます。コールバックや保存アダプターがある場合、標準メニューの「名前を付けて保存」は非表示です。

`editor.htmlFilename` で候補名を変更できます。EditorControllerの `save()` / `saveAs()` からも保存できます。ファイル選択を伴う呼び出しは、ボタンのクリックなどユーザー操作から直接実行してください。

既存の `editor.storage` の `load(key)` / `save(key, { source, layout })` 契約は維持しています。`storageKey` だけを指定しても、以前のlocalStorage保存には戻りません。必要なら明示的に保存アダプターを渡してください。
