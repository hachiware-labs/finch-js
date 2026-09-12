# 図の共通部品と前処理

前処理は描画オプションの `preprocess` で有効になります。元のDSLは編集・保存用に保持し、展開後のソースをパースします。全図種で使えます。

```js
import Finch from '@hachiware-labs/finch-js';

const source = `@sequence
!define ENV prod
!function budget(base, attempts=2)
!return base * attempts
!endfunction
!let TIMEOUT = budget(50)
!assert TIMEOUT > 0 : "TIMEOUT must be positive"
!foreach ID in ["client", "api", "store"]
!let LABEL = upper(ID)
participant {{ID}} "{{LABEL}}"
!endfor
client -> api: request
api -> store: save
store --> api: saved
api --> client: accepted`;

const diagram = Finch.render(source, {
  target: '#diagram', // ページ内に用意した要素
  preprocess: {},
});
```

[編集できるサンプル](../examples/reusable-sequence.html)

## 変数・式・検証

- `!define NAME value` は文字列を定義し、`{{NAME}}` で置換します。`!undef NAME` で削除します。
- `!let COUNT = (BASE + 2) * 3` は式の結果を代入します。+は数値加算です。文字列結合には `concat(...)` を使います。
- `!if expression` / `!elseif expression` / `!else` / `!endif` で分岐します。
- `!assert COUNT > 0 : "COUNT={{COUNT}} must be positive"` は偽なら生成を停止します。メッセージは省略できます。

式は比較 `== != < > <= >=`、論理 `! && ||`、算術 `+ - * / %`、括弧、関数呼び出しに対応します。論理式は短絡評価します。条件の未定義変数は偽ですが、未定義値の埋め込みや代入はエラーです。現在の変数は文字列表現で保持し、等値比較も文字列表現で行います。ホストのJavaScriptは実行しません。

## 部品と関数

```text
!procedure exchange(from, to, response="ok")
{{from}} -> {{to}}: request
{{to}} --> {{from}}: {{response}}
!endprocedure
!call exchange("api", "store")
```

procedureは図の行を生成します。引数はJSONの文字列・有限数値・真偽値で、文字列内では `{{NAME}}` も使えます。functionは `!return expression` で値を返します。ifやループ内からもreturnできます。図の行はfunctionから出力できません。

どちらも使用前に定義し、既定引数は必須引数より後に置きます。呼び出し内の変数変更は呼び出し元に漏れません。関数の結果は `!let RESULT = name(...)` で受け、`{{RESULT}}` として図へ埋め込みます。

## 繰り返し

```text
!foreach ID in ["api", "worker"]
participant {{ID}}
!endfor
!let COUNT = 0
!while COUNT < 3
!let COUNT = COUNT + 1
api -> worker: attempt {{COUNT}}
!endwhile
```

foreachにはJSONスカラーの配列、または配列文字列を持つ変数名を指定します。反復変数だけは終了後に元の値へ戻り、その他のlet/defineの更新は残ります。条件分岐、include、部品呼び出し、ループの入れ子に対応します。ループ内の部品・関数定義、break/continue、JSONオブジェクト要素の参照は未対応です。

## 組み込み関数

| 用途 | 関数 |
|---|---|
| 文字列 | `upper`, `lower`, `trim`, `strlen`, `substr(text,start,length?)`, `strpos(text,search)`, `replace(text,search,replacement)`, `concat(...)`, `string` |
| 数値 | `number`, `abs`, `floor`, `ceil`, `round`, `min(...)`, `max(...)` |
| 定義確認 | `exists("NAME")` |

strlen・substr・strposはUnicodeコードポイント単位です。substrは0始まり、長さ省略時は末尾まで、strposは未発見時-1です。replaceは正規表現ではなく、文字列の全一致箇所を置換します。roundのちょうど半分は正の無限大方向です。同名のユーザー定義関数を優先します。

## 外部部品と保存

```js
Finch.render(source, {
  target: '#diagram',
  preprocess: {
    definitions: { ENV: 'prod' },
    includes: { actors: 'participant api\nparticipant store' },
    resolveInclude: (name, from) => sources[name],
  },
});
```

sourcesはホスト側で用意した資源名とソースの対応表です。DSLの `!include "actors"` で読み込みます。includesを先に検索し、なければホストのローダーを使います。fromは呼び出し元のinclude名で、ルートではundefinedです。ローダーがundefinedを返すと未解決エラーです。未選択の条件枝は取得しません。

初回描画とupdateで取得し、同じ名前・呼び出し元の組み合わせは一度だけロードします。検証・描画・HTML保存は同じ取得内容を使います。テーマ変更や再配置では取得しません。外部部品を更新したら `diagram.update(source)` で反映できます。更新が構文エラーなら直前の図を保持します。

保存HTMLには元のソース、定義、取得済み部品を同梱します。未選択で取得しなかった依存を後から使う編集には、ローダーまたはincludesの再提供が必要です。Markdown出力は取得済み部品を展開したソースになります。

非同期取得はモジュールAPIで先に準備します。

```js
import Finch, { snapshotPreprocessAsync, restorePreprocess }
  from '@hachiware-labs/finch-js';

const prepared = await snapshotPreprocessAsync(source, {
  resolveInclude: async (name, from) => loadSource(name, from),
});
Finch.render(source, {
  target: '#diagram',
  preprocess: restorePreprocess(prepared.snapshot),
});
```

loadSourceはホスト側で実装します。`signal` でキャンセルを検出できます。通信自体の中止にはローダーにも同じsignalを渡します。展開済み文字列だけが必要なら `preprocess` / `preprocessAsync` を使えます。ブラウザのグローバルFinchではrenderのpreprocessオプションを使い、独立した前処理関数はモジュールからimportします。

## 検証と上限

開始・終端の対応は実行前に検証し、早期returnの後の閉じ忘れも検出します。includeは32段、関数と部品の呼び出しは合計32段、ループは32段・各10000反復、展開処理は100000行が上限です。非同期取得は1000資源までです。

これはFinchの構文です。PlantUMLソースとの互換性や、PlantUMLの組み込み関数・標準ライブラリ全体への対応を意味しません。[対応差分](reference_ja.md)も参照してください。


### 数値の検証

算術演算と大小比較は有限の数値を要求します。空文字や空白だけの文字列を暗黙に `0` として比較しません。数値リテラル自体が表現可能範囲を超える場合もエラーです。`==` / `!=` の文字列比較は維持し、`&&` / `||` で短絡された式の数値評価は実行しません。


### JSONから値を取り出す

```text
!define CONFIG {"services":["api","worker"],"retry":3}
!let IDS = json_get(CONFIG, "services")
!assert json_get(CONFIG, "retry") > 0
!foreach ID in IDS
participant {{ID}}
!endfor
```

`json_get(JSON, key)` はオブジェクトのキーまたは配列の添字を参照します。配列の添字は0始まりの非負整数です。入れ子は `json_get(json_get(CONFIG, "limits"), "retry")` と書けます。

`json_has(JSON, key)` はキーの存在、`json_keys(JSON)` はキーのJSON配列、`json_size(JSON)` は配列の長さまたはオブジェクトのキー数、`json_type(JSON)` はJSON値の種類を返します。継承されたプロパティは参照しません。未知のキー、不正なJSON、不正な配列添字はエラーです。

取得した文字列・数値・真偽値は式の値として返します。オブジェクト・配列・nullはJSON文字列として返すため、さらにJSON関数に渡せます。nullは文字列 `"null"` として保持されます。変数は従来どおり文字列保存なので、元のJSON文字列値 `"null"` と区別したい場合は元データを保持してください。オブジェクト配列のforeachにも対応します。各要素はJSON文字列として反復変数へ渡し、json_getでフィールドを取り出します。入れ子配列とnullも扱えます。オブジェクト内の文字列の変数置換はJSONとして再エンコードするため、置換値に引用符を含んでも構造を壊しません。JSONの更新は下記の関数を使います。


### JSONの型を保った取得と更新

- `json_at(JSON, key)` は取得値をJSONとして返します。`json_get`と異なり、文字列にはJSONの引用符を残すため、文字列 `"null"` とnull、数値と数値文字列を区別できます。
- `json_encode(value)` は式の文字列・数値・真偽値をJSONへ変換します。
- `json_set(JSON, key, encodedValue)` はJSON形式の値を追加・置換し、新しいJSONを返します。元の変数は変わりません。配列には既存添字か末尾の添字だけを指定でき、穴を作る更新はエラーです。
- `json_remove(JSON, key)` はキーを削除します。配列では後続要素を詰めます。未知のキーはエラーです。

```text
!define CONFIG {"retry":3,"label":"API"}
!let CONFIG = json_set(CONFIG, "retry", "5")
!let CONFIG = json_set(CONFIG, "label", json_encode("Public API"))
!let LABEL_JSON = json_at(CONFIG, "label")
!assert json_type(LABEL_JSON) == "string"
```

入れ子の更新は内側のJSONを取得・更新してから親のキーへ設定します。変数自体の型は従来どおり文字列ですが、json_atとJSON形式の更新値を使えばJSONの型を失わず受け渡せます。JSON解析は入れ子も含め非有限数を拒否します。


[JSONからシーケンスを生成するサンプル](../examples/json-sequence.html)では、環境名の更新とオブジェクト配列の反復を組み合わせています。HTML保存・復元後もJSONを含む元のソースを編集できます。


### 共通部品を一度だけ読み込む

`!include_once "common"` は、その展開でまだ読み込んでいない名前だけを展開します。複数の部品が同じcommonを参照しても重複しません。先行する通常のincludeで読み込んだ名前も対象です。通常の `!include` は従来どおり毎回展開します。

判定単位は変数置換後の資源名です。ホストのloaderが同じ名前を呼び出し元別の別ファイルへ解決する場合は、異なる資源名を付けてください。未選択のif内では読み込み済みにしません。新たな展開やupdateでは判定をリセットします。include_onceによる自己参照は再展開を省き、通常includeによる循環はエラーです。非同期loaderと保存した依存関係からの復元にも同じ規則を適用します。


### foreachへ式を直接渡す

```text
!foreach ACTOR in json_get(CONFIG, "actors")
!let ID = json_get(ACTOR, "id")
!let LABEL = json_at(ACTOR, "label")
participant {{ID}} {{LABEL}}
!endfor
```

対象には配列リテラル、配列を保持した変数、JSON配列を返す関数式を指定できます。対象の式は開始時に一度だけ評価するため、本文で元の設定を変更しても現在の反復対象は変わりません。未選択の条件分岐では対象の式も評価しません。
