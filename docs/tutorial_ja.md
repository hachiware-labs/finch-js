# Finch.js チュートリアル

[English](./tutorial.md) · [README に戻る](../README_ja.md)

テキストで手早く図を描き、ドラッグでレイアウトを整えて保存します。必要なのは2ステップです。

## 1. HTML にこれだけ書く

リポジトリのルートに `tutorial.html` を作り、次の内容を貼り付けます。このHTMLは同じリポジトリにある `dist/finch.global.js` を読み込みます。

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Finch.js</title>
    <style>
      body { min-height: 100vh; margin: 0; }
      #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <div id="diagram" aria-label="デプロイメント図"></div>

    <script src="./dist/finch.global.js"></script>
    <script>
      const deploymentSource = `
@deployment
node browser "Web ブラウザー" [shape=rounded]
server api "API サーバー"
database db "PostgreSQL"

browser -> api: HTTPS
api -> db: SQL
      `.trim();

      Finch.render(deploymentSource, {
        target: "#diagram",
        editor: { storageKey: "finch-tutorial" },
      });
    </script>
  </body>
</html>
```

`tutorial.html` をブラウザーで開くと図が生成され、SVG 内の左下にある Finch ボタンから図の直下へエディターを開けます。エディターを閉じている間、図は閲覧モードになります。

このリポジトリの外でチュートリアルを使う場合は、ローカルのランタイムを読み込むscript要素を、公開済みバージョンを固定した次のURLへ置き換えます。

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

## 2. レイアウトを整えて保存する

ノードをドラッグして配置を整えます。ダブルクリックすると位置を固定できます。Finch メニューではソース編集や Undo ができ、Save を押したときだけ source と layout を保存します。Edit ON/OFF の切り替えでは保存しません。SVG/PNG には図だけを書き出し、Finch の編集アイコンは含めません。

テキストにある `api` はノードのID、`"API サーバー"` は表示名です。表示名を変えても配置を引き継げるよう、IDは変えずに使います。

これで、図の内容は読みやすいテキストのまま保ち、人が調整した位置だけを別に保存できます。

## 環境構築は後から

`dist/finch.global.js` がまだない場合や、HTTPで配信して試したい場合は、リポジトリのルートで依存パッケージをインストールしてビルドします。

```bash
npm install
npm run build
```

続いてローカルサーバーを起動します。

```bash
python -m http.server 8000
```

ブラウザーで `http://127.0.0.1:8000/tutorial.html` を開いてください。

ほかの図を試す場合は、README の[ダイアグラムの種類](../README_ja.md#ダイアグラムの種類)または[発展例](../examples/README.md)へ進んでください。テーマや独自レイアウトを追加する方法は、[Finch.js の拡張](./extensions_ja.md)で説明しています。
