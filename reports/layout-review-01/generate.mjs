import {writeFile} from 'node:fs/promises';
const cases=[
['01-linear','直列処理','主経路の整列と等間隔',`@flowchart
start s "開始"
process a "注文受付"
process b "在庫引当"
process c "決済確定"
end e "完了"
s -> a
a -> b
b -> c
c -> e`],
['02-branch','分岐・合流','正常経路と例外経路の区別',`@flowchart
start s "開始"
decision c "在庫あり?"
process a "出荷準備"
process b "入荷待ち"
process d "発送通知"
end e "完了"
s -> c
c -> a: Yes
c -> b: No
b -> a: 入荷
a -> d
d -> e`],
['03-retry','再試行ループ','戻り線と順方向の分離',`@flowchart
start s "受付"
process a "申請内容を検証"
decision c "承認可能?"
process r "申請者が修正"
process p "承認を登録"
end e "完了"
s -> a
a -> c
c -> p: Yes
c -> r: No
r -> a: 再申請
p -> e`],
['04-parallel','並列状態','fork・joinの上下配置',`@state
initial s
fork f
state a "在庫確保"
state b "決済認証"
state c "配送先確認"
join j
state d "注文確定"
final e
s -> f
f -> a
f -> b
f -> c
a -> j
b -> j
c -> j
j -> d
d -> e`],
['05-dense','密な依存関係','多対多接続の追跡性',`@graph direction=LR
a "注文API"
b "管理API"
c "集計API"
x "注文DB"
y "顧客DB"
z "監査DB"
a -> x: 更新
a -> y: 参照
a -> z: 記録
b -> x: 参照
b -> y: 更新
b -> z: 記録
c -> x: 集計
c -> y: 集計
c -> z: 記録`],
['06-deployment','入れ子の配置図','境界越えと共有データ接続',`@deployment
container cloud "本番環境" [layout=column] {
 container front "入口" [layout=row] {
  node cdn "CDN"
  node gw "Gateway"
 }
 container apps "アプリケーション" [layout=row] {
  server api "注文API"
  server worker "非同期Worker"
 }
 container data "データ層" [layout=row] {
  database db "注文DB"
  node queue "Queue"
 }
}
cdn -> gw: HTTPS
gw -> api: 転送
api -> db: 保存
api -> queue: 配信
queue -> worker: 購読
worker -> db: 更新`],
['07-component','共通部品への依存','枠と集中する接続の整理',`@component
system shop "注文システム" {
 component ui "注文画面"
 component api "注文API"
 component auth "認証"
 component audit "監査"
 database db "注文DB"
}
external pay "決済サービス"
ui -> api: 注文
ui -> auth: ログイン
api -> auth: 検証
api -> audit: 記録
api -> db: 保存
api -> pay: 決済
pay -> audit: 結果通知`],
['08-er','注文データモデル','多重度・関係名と表の離隔',`@er
entity customers "顧客" {
 id UUID pk
 name string
}
entity orders "注文" {
 id UUID pk
 customer_id UUID fk
}
entity items "注文明細" {
 id UUID pk
 order_id UUID fk
 product_id UUID fk
}
entity products "商品" {
 id UUID pk
 name string
}
entity payments "支払い" {
 id UUID pk
 order_id UUID fk
}
customers 1 -> many orders: 発注
orders 1 -> many items: 明細
products 1 -> many items: 対象
orders 1 -> many payments: 決済`],
['09-class','継承と関連','異なる線種と継承階層',`@class
interface Repository {
 +save(): void
}
class OrderRepository {
 +save(): void
}
class CustomerRepository {
 +save(): void
}
class Order {
 -id: UUID
 +submit(): void
}
class LineItem {
 -quantity: int
}
OrderRepository ..|> Repository
CustomerRepository ..|> Repository
OrderRepository --> Order: 保存
Order "1" *-- "1..N" LineItem: 明細`],
['10-long-label','長文の判断・経路名','ラベルの折り返しと経路識別',`@flowchart
start s "審査開始"
process a "法人顧客の申請内容と添付書類を照合する"
decision c "本人確認と利用条件の審査をすべて通過したか?"
process b "不足している証明書類の追加提出を依頼する"
process d "利用開始の案内と初回設定の手順を通知する"
end e "審査完了"
s -> a
a -> c
c -> d: すべての審査項目を通過
c -> b: 証明書類に不足がある
b -> a: 追加書類を受領して再審査
d -> e`]
];
for(const [id,title,focus,source] of cases){await writeFile(`reports/layout-review-01/${id}.html`,`<!doctype html><html lang="ja"><meta charset="utf-8"><title>${title} | Finch評価01</title><style>body{font:16px system-ui;margin:32px;color:#172b3a}a{color:#125ea5}.frame{overflow:auto;border:1px solid #dbe2e8;padding:24px;width:max-content;min-width:600px}svg{display:block}p{max-width:1000px}</style><a href="index.html">← 採点一覧</a><h1>${id} ${title}</h1><p>観察対象：${focus}。架空の評価用モデル／初期自動配置／既定テーマ・既定ルーティング。手動座標なし。</p><div class="frame" id="diagram"></div><script src="./finch.snapshot.js"></script><script>const diagramSource = \`${source}\`;window.instance=Finch.render(diagramSource,{target:'#diagram',editor:true});instance.svg.style.width=instance.geometry.width+'px';instance.svg.style.height=instance.geometry.height+'px';instance.svg.style.maxWidth='none';</script></html>`)}
await writeFile('reports/layout-review-01/cases.json',JSON.stringify(cases.map(([id,title,focus,source])=>({id,title,focus,source})),null,2));
