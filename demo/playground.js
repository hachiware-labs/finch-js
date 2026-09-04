const examples = {
  deployment: `@deployment

node web "Web App" [shape=rounded]
node mobile "Mobile App" [shape=rounded]
node admin "Admin Console" [shape=rounded]

container edge "Edge Network" {
  server cdn "CDN"
  server waf "WAF"
  server lb "Load Balancer"
}

container app "Application Platform" {
  server gateway "API Gateway"
  server auth "Auth Service"
  server catalog "Catalog Service"
  server order "Order Service"
  server payment "Payment Service"
  server worker "Async Worker"
}

container data "Data Platform" {
  database users "User DB"
  database products "Product DB"
  database orders "Order DB"
  database redis "Redis Cache"
  server search "Search Index"
  server queue "Event Queue"
  server storage "Object Storage"
}

container observe "Observability" {
  server metrics "Metrics"
  server logs "Log Store"
  server traces "Tracing"
}

web -> cdn: HTTPS
mobile -> cdn: API
admin -> cdn: Admin API
cdn -> waf
waf -> lb
lb -> gateway
gateway -> auth
gateway -> catalog
gateway -> order
auth -> users
catalog -> redis
catalog -> products
catalog -> search
order -> orders
order -> payment
order -> queue
queue -> worker
worker -> storage
app --> observe: Telemetry`,
  sequence: `@sequence

actor User "User"
participant Web "Web App"
participant API "API Gateway"
participant Auth "Auth Service"
participant DB "PostgreSQL"
participant Queue "Event Queue"

User -> Web: Place order
Web -> API: POST /orders
group Authentication
API -> Auth: Verify token
Auth -> DB: Load session
DB --> Auth: Session
Auth --> API: Authorized
end
API -> DB: Create order
DB --> API: Order saved
opt Publish event
API -> Queue: OrderCreated
Queue --> API: Accepted
end
API --> Web: 201 Created
Web --> User: Confirmation`,
  flowchart: `@flowchart

start begin "Order received"
input request "Read request"
process validate "Validate order"
decision valid "Request valid?"
process reserve "Reserve inventory"
decision stock "In stock?"
process charge "Charge payment"
output confirmation "Send confirmation"
end complete "Order complete"
process reject "Record rejection"
end failed "Order rejected"

begin -> request
request -> validate
validate -> valid
valid -> reserve: Yes
valid -> reject: No
reserve -> stock
stock -> charge: Yes
stock -> reserve: Retry
charge -> confirmation
confirmation -> complete
reject -> failed`,
  state: `@state

initial start
state idle "Idle"
state processing "Processing"
state awaiting "Awaiting payment"
state completed "Completed"
state failed "Failed"
final done

start -> idle
idle -> processing: submit
processing -> awaiting: payment required
awaiting -> processing: payment confirmed
processing -> completed: success
processing -> failed: error
failed -> processing: retry
completed -> done
failed -> done: cancel`,
  er: `@er

entity users "Users" {
  id uuid pk
  email varchar(255) unique
  name varchar(160)
}

entity products "Products" {
  id uuid pk
  sku varchar(64) unique
  price decimal(12,2)
}

entity orders "Orders" {
  id uuid pk
  user_id uuid fk
  total decimal(12,2)
  status order_status
}

entity order_items "Order Items" {
  id uuid pk
  order_id uuid fk
  product_id uuid fk
  quantity integer
}

users 1 -> many orders: places
orders 1 -> many order_items: contains
products 1 -> many order_items: referenced by`,
  component: `@component

external customer "Customer"
external identity "Identity Provider"
external payments "Payment Provider"

system platform "Commerce Platform" {
  system experience "Experience" {
    component web "Web Application"
    component bff "Backend for Frontend"
  }

  system core "Core Services" {
    component api "Public API"
    component orders "Order Component"
    interface events "Order Events"
  }
}

customer -> web: uses
web -> bff: HTTPS
bff -> identity: OIDC
bff -> api: JSON API
api -> orders: commands
orders -> payments: authorize
orders -> events: publish`,
  slide: `@slide

title "Finch.js の価値" [align=center]
subtitle "テキストから、そのまま使える図へ" [align=center]

row journey [gap=76] {
  card input "簡単な記法" [badge=INPUT body="意図を短いDSLで記述"]
  arrow: Compose
  card render "自動レイアウト" [badge=LAYOUT body="構成に沿って美しく配置" tone=accent]
  arrow: Refine
  card output "高品質な図" [badge=OUTPUT body="必要な箇所だけ微調整"]
}

grid benefits [columns=3 gap=22] {
  note fast "素早く作成" [body="箱と線を揃える作業を削減"]
  note clear "一貫した見た目" [body="余白・文字・色を自動統一"]
  note editable "あとから編集" [body="ドラッグとPinで意図を保存"]
}

callout value "図を整える時間を、アイデアを磨く時間へ。" [width=680]`,
  class: `@class

interface Repository {
  +find(id: UUID): Order
  +save(order: Order): void
}

class Order {
  -id: UUID
  -status: OrderStatus
  +submit(): void
}

class LineItem {
  -quantity: int
  +subtotal(): Money
}

class OrderRepository {
  +save(order: Order): void
}

Order "1" *-- "1..N" LineItem: items
OrderRepository ..|> Repository
OrderRepository ..> Order: persists`,
  usecase: `@usecase

actor customer "Customer"
actor member "Registered Customer"
actor operator "Store Operator"

system commerce "Commerce Platform" {
  usecase browse "Browse catalog"
  usecase checkout "Checkout"
  usecase login "Authenticate"
  usecase coupon "Apply coupon"
  usecase refund "Issue refund"
}

generalize member -> customer
customer -> browse
customer -> checkout
operator -> refund
include checkout -> login
extend coupon -> checkout`,
  activity: `@activity

start begin
action validate "Validate order"
decision valid "Valid?"
fork parallel
action reserve "Reserve inventory"
action score "Run fraud checks"
object order "Order"
join prepared
action charge "Capture payment"
end done

begin -> validate
validate -> valid
valid -> parallel [valid]
parallel -> reserve
parallel -> score
reserve -> order
order -> prepared
score -> prepared
prepared -> charge
charge -> done`,
};

let instance;

function load(kind) {
  instance?.destroy();
  instance = Finch.render(examples[kind], {
    target: "#diagram",
    editor: {
      storageKey: `finch-playground:${kind}`,
      svgFilename: `${kind}.svg`,
      pngFilename: `${kind}.png`,
    },
  });
  for (const button of document.querySelectorAll(".stage .toolbar button")) {
    button.setAttribute("aria-pressed", String(button.id === kind));
  }
}

for (const kind of Object.keys(examples)) {
  document.querySelector(`#${kind}`).addEventListener("click", () => load(kind));
}

load("deployment");
