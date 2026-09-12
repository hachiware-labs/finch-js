// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseObject,parseClass} from '../src/index';

it('supports JSON aliases across object, class, component and deployment diagrams',()=>{
 for(const kind of ['object','class','component','deployment'])for(const declaration of ['json "Settings" as config','json config as "Settings"','json Settings as config']){
  const source=`@${kind}\n${declaration} {"label":"as config","nested":[true,null]}\n${kind==='object'||kind==='class'?'object':'component'} App\nApp --> config`;
  const instance=createFinch().render(source,{editor:false});
  const node=instance.model.nodes.find(n=>n.id==='config')!;
  expect(node.label).toBe('Settings');
  expect(node.shape).toBe('uml-map');
  expect(JSON.parse(node.attributes.mapEntries!)).toContainEqual({key:'label',value:'"as config"'});
  expect(instance.model.connections.some(e=>e.from==='App'&&e.to==='config')).toBe(true);
  expect(instance.model.source).toBe(source);
  instance.destroy();
 }
});
const source=`@object
json payload "Order" {
 "id": 42,
 "customer": {"name": "Alice", "active": true},
 "items": [{"sku": "A", "qty": 2}, null],
 "empty": []
}
object request "Request"
request --> payload::id`;
it('preserves JSON scalars, arrays and nested object references',()=>{
 const model=parseObject(source);
 const root=model.nodes.find(n=>n.id==='payload')!;
 expect(root.shape).toBe('uml-map');
 expect(JSON.parse(root.attributes.mapEntries!)).toEqual([{key:'id',value:'42'},{key:'customer',value:'{}'},{key:'items',value:'[]'},{key:'empty',value:'[]'}]);
 expect(model.nodes).toHaveLength(6);
 expect(model.connections).toHaveLength(5);
 expect(model.connections.find(e=>e.from==='request')?.attributes?.toMapRow).toBe('0');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='payload')!.y).toBeLessThan(instance.geometry.nodes.find(n=>n.id==='payload__json1')!.y);
 expect(instance.geometry.edges.filter(e=>e.attributes?.fromMapRow!==undefined)).toHaveLength(4);
 for(const edge of instance.geometry.edges.filter(e=>e.attributes?.fromMapRow!==undefined)){const node=instance.geometry.nodes.find(n=>n.id===edge.from)!;expect(edge.points[0]!.y).toBe(node.y+56+Number(edge.attributes!.fromMapRow)*28);}
 expect(document.body.textContent).toContain('"Alice"');
 expect(document.body.textContent).toContain('null');
});
it('parses braces in strings and rejects invalid JSON and colliding generated IDs',()=>{
 expect(parseObject('@object\njson p {"text": "} [ {"}').nodes).toHaveLength(1);
 expect(()=>parseObject('@object\njson p {"bad":}')).toThrow(/Invalid JSON/);
 expect(()=>parseObject('@object\njson p {')).toThrow(/Unclosed/);
 expect(()=>parseObject('@object\njson p {"child": {}}\nobject p__json1')).toThrow();
});


it('mixes class definitions, object instances and JSON without reinterpreting members',()=>{
 const source=`@class
class Order {
 id: Integer
 object payload
}
object example "example : Order" {
 id = 42
}
json payload {"id":42}
Order ..> example: instance
example --> payload::id`;
 const model=parseClass(source);
 expect(model.kind).toBe('class');expect(model.source).toBe(source);
 expect(model.nodes.find(n=>n.id==='Order')?.shape).toBe('uml-class');
 expect(JSON.parse(model.nodes.find(n=>n.id==='Order')!.attributes.members!).map((m:{text:string})=>m.text)).toEqual(['id: Integer','object payload']);
 expect(model.nodes.find(n=>n.id==='example')?.shape).toBe('uml-instance');
 expect(model.nodes.find(n=>n.id==='payload')?.shape).toBe('uml-map');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edge=instance.geometry.edges.find(e=>e.to==='payload')!;
 const payload=instance.geometry.nodes.find(n=>n.id==='payload')!;
 expect(edge.points[edge.points.length-1]!.y).toBe(payload.y+56);
});


it('connects class members and operations to JSON rows in either direction',()=>{
 const source=`@class
class Order {
 +id: Integer
 +load(id: String): Order
}
json payload {"id":42}
Order::id --> payload::id
payload::id --> Order::load(id: String)
Order::id --> Order::load(id: String)`;
 const model=parseClass(source);
 expect(model.connections[0]!.attributes).toMatchObject({fromMemberIndex:'0',toMapRow:'0'});
 expect(model.connections[1]!.attributes).toMatchObject({fromMapRow:'0',toMemberIndex:'1'});
 expect(model.connections[2]!.attributes).toMatchObject({fromMemberIndex:'0',toMemberIndex:'1'});
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const payload=instance.geometry.nodes.find(n=>n.id==='payload')!;
 expect(instance.geometry.edges[0]!.points[instance.geometry.edges[0]!.points.length-1]!.y).toBe(payload.y+56);
 expect(instance.geometry.edges[1]!.points[0]!.y).toBe(payload.y+56);
 expect(()=>parseClass(source.replace('payload::id','payload::missing'))).toThrow(/Unknown map entry/);
});



it('keeps namespaced instances, JSON and map references associated with canonical IDs',()=>{
 const source=`@class
namespace sales {
class Order {
 +id: Integer
}
object example {
 id = 42
}
example : status = paid
json payload {"id":42,"child":{"active":true}}
map lookup {
 order *-> example
 value => 42
}
Order::id --> payload::id
lookup::value --> example::id
}
namespace audit {
object example {
 id = 7
}
json payload {"id":7}
example::id --> payload::id
}
sales.example --> audit.example`;
 const model=parseClass(source);
 const sales=model.nodes.find(n=>n.id==='sales.example')!;
 expect(sales.shape).toBe('uml-instance');
 expect(sales.label).toBe('example');
 expect(JSON.parse(sales.attributes.slots!)).toEqual(['id = 42','status = paid']);
 expect(model.nodes.find(n=>n.id==='audit.example')?.shape).toBe('uml-instance');
 expect(model.nodes.find(n=>n.id==='sales.payload__json1')?.shape).toBe('uml-map');
 expect(model.connections.find(e=>e.from==='sales.lookup' && e.attributes?.fromMapRow==='0')?.to).toBe('sales.example');
 expect(model.connections.find(e=>e.from==='sales.Order')?.attributes).toMatchObject({fromMemberIndex:'0',toMapRow:'0'});
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='sales.example')?.parentId).toBe('sales');
});

it('preserves brackets in JSON display labels during namespace expansion',()=>{
 expect(parseObject('@object\nnamespace n {\njson data "[Payload]" {"id":1}\n}').nodes.find(n=>n.id==='n.data')?.label).toBe('[Payload]');
});

it('preserves literal members that resemble namespace expansion markers',()=>{
 const model=parseClass(`@class
class Example {
__finch_object_block_0
}
object sample
Example --> sample: __finch_object_ref_0_1`);
 expect(model.nodes.find(n=>n.id==='Example')?.shape).toBe('uml-class');
 expect(model.connections[0]!.label).toBe('__finch_object_ref_0_1');
});
