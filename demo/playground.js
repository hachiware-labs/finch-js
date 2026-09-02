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

title "Tit.js の価値" [align=center]
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

const source = document.querySelector("#source");
const error = document.querySelector("#error");
let instance;
let timer;

function updateZoomReadout() {
  const readout = document.querySelector("#zoom-value");
  if (readout && instance) readout.textContent = `${Math.round(instance.zoom * 100)}%`;
}

function render(value, restore = false) {
  try {
    if (instance) instance.update(value);
    else instance = Tit.render(value, { target: "#diagram" });
    if (restore) {
      const saved = localStorage.getItem(`tit-layout:${instance.model.kind}`);
      if (saved) instance.importLayout(saved);
    }
    error.style.display = "none";
    updateZoomReadout();
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    error.style.display = "inline";
  }
}

function load(kind) {
  source.value = examples[kind];
  if (instance && instance.model.kind !== kind) instance.destroy();
  instance = undefined;
  render(source.value, true);
}

source.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => render(source.value), 180);
});
document.querySelector("#deployment").addEventListener("click", () => load("deployment"));
document.querySelector("#sequence").addEventListener("click", () => load("sequence"));
document.querySelector("#flowchart").addEventListener("click", () => load("flowchart"));
document.querySelector("#state").addEventListener("click", () => load("state"));
document.querySelector("#er").addEventListener("click", () => load("er"));
document.querySelector("#component").addEventListener("click", () => load("component"));
document.querySelector("#slide").addEventListener("click", () => load("slide"));
document.querySelector("#class").addEventListener("click", () => load("class"));
document.querySelector("#usecase").addEventListener("click", () => load("usecase"));
document.querySelector("#activity").addEventListener("click", () => load("activity"));
document.querySelector("#zoom-out").addEventListener("click", () => { instance?.zoomOut(); updateZoomReadout(); });
document.querySelector("#zoom-in").addEventListener("click", () => { instance?.zoomIn(); updateZoomReadout(); });
document.querySelector("#zoom-value").addEventListener("click", () => { instance?.resetZoom(); updateZoomReadout(); });
document.querySelector("#fit-diagram").addEventListener("click", () => { instance?.fit("diagram"); updateZoomReadout(); });
document.querySelector("#fit-width").addEventListener("click", () => { instance?.fit("width"); updateZoomReadout(); });
document.querySelector("#diagram").addEventListener("tit:zoomchange", updateZoomReadout);
document.querySelector("#layout").addEventListener("click", () => instance?.autoLayout());
document.querySelector("#pin").addEventListener("click", () => {
  if (!instance?.selection.length) return;
  for (const id of instance.selection) instance.isPinned(id) ? instance.unpin(id) : instance.pin(id);
});
document.querySelector("#save").addEventListener("click", () => {
  if (!instance) return;
  localStorage.setItem(`tit-layout:${instance.model.kind}`, instance.exportLayout());
});

load("deployment");
