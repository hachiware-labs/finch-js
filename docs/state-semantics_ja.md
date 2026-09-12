# 状態図の構造チェックと遷移

[動作例](../examples/state-semantics.html)

`terminate` は×、`final` は二重丸で描画します。各ノードの `attributes.stateKind` はstate / region / initial / final / terminate / fork / join等を保持し、テーマやshapeの指定から独立しています。

```text
@state validation=strict
state running {
 state active
}
running -> active: retry [ready] / reset() [kind=local]
internal active "tick / count()"
```

通常の矢印はexternal遷移です。`[kind=local]` は複合状態から子孫へのlocal遷移を指定し、図にはFinchの明示ラベル `{local}` を付けます。`internal` は状態内に表示され、自己遷移の矢印は作りません。local/internalは状態を退出するexternal遷移とは意味が異なります。

接続の `attributes` に `transitionKind`、`trigger`、任意の `guard` / `effect` を保持します。状態内の動作は `attributes.stateBehaviors` にJSON配列として保持します。既存の表示用stateBodyも維持します。式を評価する機能はありません。

`parseState(source).diagnostics`、または `validateState(model)` で構造診断を取得できます。各診断はcode/messageと対象のnodeIdまたはedgeIdを返します。既定では描画を継続します。`@state validation=strict` は診断がある場合にエラーにします。診断を利用者へ表示したいホストは、この配列を画面に表示してください。

検査対象は初期状態の入出力・重複、終状態とterminateからの出力、fork/joinの本数と接続先種別、擬似状態のトリガー・ガード制約、regionの所有者と接続、履歴の重複と既定遷移数、localの接続先です。regionにentry等を設定する記述はエラーになります。

## 並行領域と履歴

forkの各接続先・joinの各接続元について、同じ直交状態の異なる領域に属するかを検証します。別領域の状態同士を直接結ぶ遷移は診断します。複合状態は実線の角丸枠、並行領域は破線の仕切りで描画します。

`history` の既定遷移先は同じ領域の状態、`deep-history` はその領域内の子孫の状態まで指定できます。既定遷移のガード・トリガーと複数出力を検出します。明示的なregionを使う状態では、通常の子状態もregion内に置いてください。

トリガーのない通常状態からの遷移は完了遷移として記述します。直交状態の完了は全領域の完了に依存します。図の検査では実行時の完了を計算しません。

## 接続点

```text
@state validation=strict
state idle
state session {
 entryPoint input
 state active
 exitPoint output
 input -> active
 active -> output: finish
}
final done
idle -> input: start
output -> done
```

entryPointは白丸、exitPointは丸の中の×です。状態の境界へ自動配置し、親状態の移動後も追従します。入口は外から中へ、出口は中から外へ接続します。機械全体の接続点はトップレベルにも宣言できます。入口からの内部側遷移は自動的にlocalとして保持します。

## サブマシン

```text
@state validation=strict
machine Payment {
 entryPoint start
 state active
 exitPoint finish
 start -> active
 active -> finish: accepted
}
state pay "決済" [submachine=Payment]
entryPoint input [state=pay ref=start]
exitPoint output [state=pay ref=finish]
state ready
final done
ready -> input: submit
output -> done
```

`machine` はトップレベルで再利用する状態機械を定義します。定義ごとにノードIDの名前空間が独立しています。`state ... [submachine=名前]` で参照し、状態名の後に `: 名前` を表示します。`state` と `ref` を指定した接続点はUMLのConnectionPointReferenceに相当し、参照先の存在と入口／出口の一致を検証します。

未定義の機械、循環参照、機械名の重複、サブマシン状態に通常の子状態を持たせる構造、接続点を逆向きに使う構造を診断します。定義の内部も検証します。解析結果の `stateMachines` に定義ごとのSemanticModelを保持します。定義は利用図に自動展開せず、必要に応じて別図として描画します。

[並行・履歴・サブマシンの動作例](../examples/state-advanced.html)

## 残る制限

今回の範囲は記法と静的な構造検証です。ガードの網羅性、イベント配送、動作実行順、履歴の実行時復元をシミュレーションする機能はありません。複数接続点の参照、プロトコル、継承・再定義は[追加対応](uml-complete_ja.md)を参照してください。診断ゼロは完全なUML適合や実行時の正しさを保証しません。

仕様確認: [Eclipse UML2 Pseudostate](https://download.eclipse.org/modeling/mdt/uml2/javadoc/5.3.0/org/eclipse/uml2/uml/Pseudostate.html)、[State](https://download.eclipse.org/modeling/mdt/uml2/javadoc/5.3.0/org/eclipse/uml2/uml/State.html)、[ConnectionPointReference](https://download.eclipse.org/modeling/mdt/uml2/javadoc/5.4.0/org/eclipse/uml2/uml/ConnectionPointReference.html)。

遷移の区切り解析では、括弧内の式や引用文字列の / を効果の開始記号として扱いません。例: after(timeout / 2) [ready] / run()。時間式・変化式・引用文字列を使うイベントで検証し、全647テスト・型検査・ビルド成功。式自体の評価は行いません。

ガードの抽出も括弧・引用符を考慮します。event(items[0]) [ready] / run() の引数とガード、ガード内の配列参照や文字列の閉じ角括弧を区別。全648テスト・型検査・ビルド成功。

継承した状態機械のソース再構成で、内部動作と通常遷移の空の効果指定 / を保持するよう修正。除算を含む時間イベント・配列参照のガード・変化イベントを含め、継承モデルと再解析結果を検証。
