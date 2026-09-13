# ことばから図を作るデモ

[English](generating.md) · [チュートリアル](tutorial_ja.md)

Node.js 22以降と、ログイン済みのCodex CLIを使います。初回は次を実行してください。

```sh
npm install -g @openai/codex
codex login
```

この変更を含むパッケージのリリース後は、次のコマンドで起動できます。

```sh
npx @hachiware-labs/finch-js demo
```

表示された `http://127.0.0.1:4316` を開き、定型文を選ぶか、描きたい図を自由に入力します。CodexがFinch.jsを使ったHTMLを作り、ページ内のiframeに表示します。図の左下のピンクの鳥ボタンを押すと、編集メニューが開き、ノードの配置やソースを編集できます。「別タブで開く」で生成物を単独表示できます。生成にはネット接続とCodexの利用枠が必要です。

現在のチェックアウトで試す場合は `npm ci`、`npm run build` のあとに `npm run demo` を実行します。公開済みの旧バージョンには、このコマンドはまだ含まれません。

ポートと保存先も指定できます。

```sh
npx @hachiware-labs/finch-js demo --port 4320 --output ./my-diagrams
```

生成HTMLは既定で実行フォルダーの `.finch-demo/generated/` に保存します。再起動時も同じ保存先を指定すれば、以前のURLを開けます。HTML内のライブラリ参照はこのサーバーの `/assets/` を使うため、ファイルの直接表示や別サイトでの利用には読み込み先の変更が必要です。停止はターミナルで `Ctrl+C`。サーバーはPC内の `127.0.0.1` のみで待ち受けます。

Codex CLIを標準の場所で検出できない場合は、環境変数 `CODEX_CLI_JS` に `@openai/codex/bin/codex.js` の絶対パスを指定できます。ネイティブの実行ファイルを使う場合は `CODEX_BIN` を指定します。
