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
      body { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; margin: 0; }
      textarea { padding: 16px; font: 14px/1.6 monospace; }
      #diagram { overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
    <textarea id="source" spellcheck="false">@deployment
node browser "Web ブラウザー" [shape=rounded]
server api "API サーバー"
database db "PostgreSQL"

browser -> api: HTTPS
api -> db: SQL</textarea>
    <div id="diagram"></div>

    <script src="./dist/finch.global.js"></script>
    <script>
      const source = document.querySelector("#source");
      const host = document.querySelector("#diagram");
      const layoutKey = "finch-tutorial-layout";
      const diagram = Finch.render(source.value, "#diagram");

      const savedLayout = localStorage.getItem(layoutKey);
      if (savedLayout) diagram.importLayout(savedLayout);

      source.addEventListener("input", () => {
        diagram.update(source.value);
      });

      host.addEventListener("finch:layoutchange", ({ detail }) => {
        localStorage.setItem(layoutKey, JSON.stringify(detail.overlay));
      });
    </script>
  </body>
</html>
```

`tutorial.html` をブラウザーで開くと、左のテキストから右側に図が生成されます。テキストを書き換えると図もすぐに更新されます。

## 2. レイアウトを整えて保存する

右側のノードをドラッグして配置を整えます。ダブルクリックすると位置を固定できます。変更したレイアウトはブラウザーへ自動保存されるため、ページを再読み込みしても復元されます。

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
