# エディタ・投稿サービス向けプラグイン開発ガイド

[README](../README_ja.md) · [APIリファレンス](./reference_ja.md) · [保存の仕様](./saving_ja.md) · [動くサンプル](../examples/save.html)

FinchをMarkdownエディタ、エディタ拡張、投稿サービスに組み込むためのガイドです。まず、公開した投稿などに図を閲覧専用で表示する最小の組み込みを説明します。その後、利用者が図を編集できるサービスやエディタへ進み、変更通知と文書保存を接続します。独自のShapeやLayoutを登録する拡張は、[Finch.jsを拡張する](./extensions_ja.md)を参照してください。

このガイドは、本リポジトリの `onChange`、`onSave`、`exportState()` を含む実装を対象にしています。開発中の機能を使う場合は `npm run build` で生成した `dist/finch.js` または `dist/finch.global.js` を組み込んでください。公開済みのパッケージやCDNに同じAPIが含まれているかは、利用する版で確認してください。

## 1. まず閲覧専用で図を表示する

公開した投稿や文書に図を表示し、閲覧者には図を変更させない場合は、描画したインスタンスの `freeze()` を呼びます。`editor: false` を併記する必要はありません。

```js
const diagram = Finch.render(source, {
  target: "#diagram",
}).freeze();
```

Markdownに保存した図と配置を表示する場合も同じです。

```js
const diagram = Finch.renderMarkdown(fence, {
  target: "#diagram",
}).freeze();
```

`freeze()` はノードの移動やPinなどの編集を止め、編集メニューと鳥アイコンを非表示にします。ズームやスクロールは引き続き使えます。このAPI呼び出しでは `onSave` やファイル保存は実行されないため、投稿の元データを変更せず、閲覧画面だけをフリーズできます。

フリーズ状態そのものも文書に残したい場合は、フリーズ後の `exportState()` や `exportMarkdown()` をホスト側で保存します。保存データに `frozen: true` が含まれていれば、復元時から編集UIが非表示になります。投稿の編集画面でもその状態が復元されるため、閲覧者だけを制限したい用途では、表示時に `freeze()` を呼ぶ方式を使ってください。

`editor: false` は独自UIを使うために標準メニューを外す指定であり、それだけではノードの編集禁止にはなりません。閲覧専用化には `freeze()` を使います。投稿内容の更新権限はサービス側で管理し、フリーズを認可の代わりにしないでください。

## 2. 編集可能なサービス・エディタに組み込む

投稿の編集画面やMarkdownエディタでは、表示時の `freeze()` を省き、Finchの標準編集メニューを提供します。

**描画した図から編集メニューを開き、その場で仕上げられることはFinchの特徴です。** 通常の `Finch.render()` は、図の鳥アイコンと標準編集メニューを提供します。利用者は鳥アイコンでメニューを開き、ノードの配置、Pin、ソースを調整して保存できます。プラグイン側で編集UIを一から作らなくても、この編集体験をホストの文書保存へ接続できます。メニューは既定では閉じており、開くと編集できます。

ここからは、Finchが描画と編集を担当し、ホストが文書の変更と保存を担当する構成を説明します。

| 処理 | 担当 |
| --- | --- |
| Markdown内の対象フェンス、文書ID、編集範囲の管理 | ホスト／プラグイン |
| Finchソースと保存座標の解析、図の描画 | Finch |
| ノードのドラッグ、Pin、ソース編集 | Finchの標準エディター |
| 編集内容の通知 | `onChange(state)` |
| Save・フリーズの保存要求 | `onSave(state)` |
| 対象フェンスの置換、Undo履歴、競合処理、実際の保存 | ホスト／プラグイン |
| プレビューを閉じた際の後片付け | プラグインから `instance.destroy()` |

標準エディターを使う場合、`Finch.render()` にコールバックを渡します。`onSave` がなければ、明示した `editor.storage`、それもなければHTMLファイル保存を使います。投稿サービスの保存をブラウザのHTML保存に任せないよう、ホストの保存処理を渡してください。

## 3. Markdownから描画して、Saveで文書へ戻す

次の例は、対象のFinchフェンスを一つ受け取り、Saveでそのフェンスを更新します。`host` の関数はFinchのAPIではなく、利用するエディタやサービスに合わせてプラグイン側で実装する境界です。

```ts
import Finch from "@hachiware-labs/finch-js";

type FenceHost = {
  // 開始・終了の囲みを含む、対象のコードフェンスを返す。
  readFence(): string;
  markDirty(): void;
  // 対象フェンスを置換し、ホスト側の保存が完了するまで待つ。
  // 保存できなければrejectする。文書の他の部分は維持する。
  replaceFenceAndSave(markdown: string): Promise<void>;
};

export function mountFinch(target: HTMLElement, host: FenceHost) {
  const diagram = Finch.renderMarkdown(host.readFence(), {
    target,
    editor: { initiallyOpen: false },
    onChange: () => {
      host.markDirty();
    },
    onSave: async ({ markdown }) => {
      await host.replaceFenceAndSave(markdown);
    },
  });

  return {
    diagram,
    dispose: () => diagram.destroy(),
  };
}
```

この方式では、Save前の編集内容はFinch側にあります。プレビューを破棄する前に、未保存内容の扱いをホストで決めてください。画面の再描画のたびに `destroy()` と新規描画を繰り返すと、未保存の配置が失われます。

編集中もホスト文書へ即時反映する方式なら、`onChange` の `markdown` を使って対象フェンスを文書のメモリ上で置換します。ファイルやサーバーへの書き込みまで毎回行う必要はありません。`onSave` でも渡された内容を反映してから保存してください。フリーズ状態は、その保存要求の引数に含まれるためです。

## 4. コールバックの契約

```ts
interface DiagramState {
  source: string;
  overlay: LayoutOverlay;
  markdown: string;
}

// RenderOptionsのコールバック部分
interface PluginCallbacks {
  onChange?: (state: DiagramState) => void;
  onSave?: (state: DiagramState) => void | Promise<void>;
}
```

| フィールド | 内容 |
| --- | --- |
| `source` | Markdownの囲みや保存座標を含まない、図のDSL |
| `overlay` | version 1のレイアウト。自動配置したノードも含む位置・サイズ・manual・pinned、editable・frozenなど |
| `markdown` | `source` と `overlay` をまとめた、単一のFinchコードフェンス |

引数は編集時点／保存要求時点のスナップショットです。Markdownを保存するなら `markdown`、文書モデルが内容と配置を別々に持つなら `source` と `overlay` を使います。`instance.exportState()` でも同じ形のデータを取得できます。テーマ、ズーム倍率、登録済みの独自拡張などはこのデータに含まれません。復元時はホストから同じ描画設定を渡してください。

### 変更通知

| 操作 | `onChange` |
| --- | --- |
| 標準エディターのソース入力 | 既定180msの待機後、解析・描画に成功したとき |
| `EditorController.setSource()` | ソースを反映したとき |
| ノードのドラッグ | ドラッグ完了時。毎フレームは通知しない |
| Pin／Unpin、Undo、Auto layout、Reset | 変更対象ノードがあるとき |
| `instance.update()`、`instance.importLayout()` | 通知しない |
| 初期描画、保存データの復元 | 通知しない |
| ズーム、Edit ON/OFF、メニュー開閉 | 通知しない |
| フリーズ状態の保存 | `onSave` の引数に含む |

Pinなどのメソッドをホストから呼んだ場合も、対応する配置変更通知は発生します。「すべてのプログラム操作を無視する」という契約ではありません。外部文書の反映には `update()` と `importLayout()` を使ってください。

`onChange` のPromiseをFinchは待ちません。通常は同期的に未保存状態やホスト文書モデルを更新します。非同期処理を開始するなら、ホスト側でエラー処理と書き込み順序の管理を行ってください。

### 保存要求とフリーズ

`onSave` は標準メニューのSave・フリーズ、または `EditorController.save()` で呼ばれます。Saveは入力待機中のソースも反映・検証してから通知します。構文エラーがあれば保存コールバックは呼びません。

- 同期的に正常終了するか、返したPromiseがresolveすると保存成功です。
- 例外またはrejectで保存失敗となり、エラーを表示して未保存状態を残します。
- キャンセルは `throw new DOMException("Canceled", "AbortError")` のように、`name` が `AbortError` のErrorをthrowするか、そのErrorでPromiseをrejectします。未保存状態は残し、エラー表示は省略します。
- 保存中に追加編集があれば、保存成功後もその追加分は未保存として扱います。

フリーズでは、`overlay.frozen === true` と `overlay.editable === false` を含むスナップショットを先に `onSave` へ渡します。メニューと鳥アイコンを表示したまま編集を一時停止し、保存成功後にフリーズを確定して非表示にします。失敗・キャンセル時は元の編集可否へ戻します。

**保存には必ずコールバックの引数を使ってください。** フリーズの `onSave` 実行中は、ライブの `instance.frozen` はまだ `false` です。その場で `instance.exportState()` を取り直すと、保存すべきフリーズ状態を落としてしまいます。

`instance.freeze()` を直接呼ぶAPIは、保存を伴いません。独自UIで使う場合は、保存するデータと保存完了後の状態遷移をホスト側で管理してください。フリーズはUIの編集を止める機能であり、アクセス権限や改ざん防止機能ではありません。

## 5. ホスト文書の更新をプレビューに反映する

対象フェンスがホスト側で更新されたら、次のように内容と配置を反映できます。

```js
function applyHostFence(diagram, fence) {
  const entries = Finch.parseMarkdown(fence);
  if (entries.length !== 1) {
    throw new Error("対象のFinchフェンスを一つ渡してください。");
  }
  const entry = entries[0];
  diagram.update(entry.source);
  diagram.importLayout(entry.overlay ?? { version: 1, nodes: {} });
}
```

この例はホスト文書を正として扱い、座標のないフェンスでは以前の配置もクリアします。ラベルなどソースだけを変更し、現在の配置を維持したい場合は `update(source)` だけを呼びます。ノードIDを維持すると、同じノードの配置を引き継ぎます。

`onChange` は再通知されませんが、`finch:render` などのDOMイベントは発生します。ホスト自身が書き戻した変更の通知は、ホストのトランザクションIDや更新元の印で識別してください。非同期の `onSave` がまだ完了していない間に、その書き戻しを外部変更としてプレビューへ返すことも避けます。

Finchの未保存編集と外部文書の編集が重なった場合の競合解決はホストの担当です。古い読み込み結果で新しい編集を上書きしないよう、文書の版番号と更新順序を管理してください。

## 6. 複数フェンスとMarkdownの編集範囲

`parseMarkdown()` は図を文書順に返し、`renderMarkdown()` の `diagramIndex` は0始まりです。ただし、返り値にフェンスの文字範囲や永続的なブロックIDは含まれません。フェンスの並べ替えが起こる文書で、配列の番号だけを保存先の識別子にしないでください。

ホストのMarkdownパーサーやエディタAPIで対象ブロックとその編集範囲を管理し、最新の文書上の範囲を置換します。単純な全文の文字列置換では、同じ内容の別の図やコード例まで書き換える可能性があります。本文、別のフェンス、Undo履歴、改行形式を保つ処理はホスト側に実装します。

FinchのMarkdown APIは、本文直下の `finch`、`finchjs`、`finch.js` フェンスを扱います。リスト・引用内のフェンスは直接の解析対象ではありません。ホストがそれらを扱う場合は、ホスト側でインデントや引用記号を除いて単一フェンスとして渡し、書き戻すときに必要な囲みを復元します。[Markdown形式の詳細](./markdown_ja.md)も参照してください。

## 7. 標準UIを使わない場合と保存アダプター

`editor: false` は標準メニューを作りません。その場合、トップレベルに `onSave` を渡すだけではホストの保存ボタンと接続されません。ホストのボタンから `instance.exportState()` を取得して保存するか、必要なときに `Finch.attachEditor()` を使います。

```js
const diagram = Finch.render(source, { target, editor: false, onChange });
const editor = Finch.attachEditor(diagram, { onSave });

// ホストの保存コマンドから呼ぶ例。Promiseと例外はホストで処理します。
async function saveFromHost() {
  await editor.save();
}
```

`onChange` は `render` のオプション、`onSave` はこの例では `attachEditor` のオプションです。すでに標準エディターを付けた図に、さらに `attachEditor()` を呼ばないでください。ホスト独自のソース入力は `update()` で反映でき、その操作の変更通知はホスト自身が管理します。

既存の `editor.storage` も利用できます。`load(key)` / `save(key, { source, layout })` は同期・非同期のどちらにも対応します。この旧アダプター形式ではフィールド名が `layout`、コールバック形式では `overlay` である点に注意してください。

保存先の優先順位は `render` の `onSave` → `editor.onSave` → `editor.storage` → HTML保存です。`onSave` を指定した場合、標準エディターは `editor.storage.load()` も呼びません。初期データはホストが読み込み、`source` と `overlay` またはMarkdownとして渡してください。`storageKey` だけを指定してもlocalStorage保存にはなりません。

## 8. プラグイン側で確認すること

1. 編集後のSaveで、対象フェンスだけが更新される。
2. 文書を閉じて開き直しても、内容・全ノードの配置・Pin・フリーズ状態が戻る。
3. ホストからのソース／座標反映で、変更通知が循環しない。
4. 保存失敗・キャンセルでは未保存状態と編集UIが残る。
5. フリーズの保存中はUIが残り、保存成功後に非表示になる。
6. 保存中の追加編集、外部変更、複数フェンスの並べ替えで新しい内容を失わない。
7. プレビュー破棄時にインスタンスとホスト側の購読を解除する。
8. 閲覧画面の `freeze()` では保存処理を呼ばず、編集メニュー・鳥アイコン・ノード編集を利用できなくなる。

実装例の入口は [save.html](../examples/save.html)、APIの契約は [types.ts](../src/types.ts)、保存・通知の回帰テストは [document-save.test.ts](../tests/document-save.test.ts) と [freeze.test.ts](../tests/freeze.test.ts) にあります。このガイドには特定のエディタSDKや完成済みのプラグインは含みません。
