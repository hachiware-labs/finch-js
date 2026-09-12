// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createFinch, parseSequence, parseState, parseActivity, parseClass } from '../src/index';
import { rerouteGeometry } from '../src/layouts';
import { routeMidpoint } from '../src/utils';

beforeEach(()=>{document.body.innerHTML='<div id="diagram"></div>';});
const render=(source:string)=>createFinch().render(source,{target:'#diagram',editor:false});

it('distinguishes calls, asynchronous notifications and replies',()=>{
 const source='@sequence\na -> b: call\nb --> a: response\na ->> c: event';
 expect(parseSequence(source).connections.map(edge=>edge.attributes?.messageKind)).toEqual(['call','reply','async']);
 const instance=render(source);
 const paths=document.querySelectorAll('.finch-edge');
 expect(paths[0]!.getAttribute('marker-end')).toBe('url(#finch-arrow)');
 expect(paths[1]!.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
 expect(paths[2]!.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
 expect(document.querySelectorAll('.finch-activation[data-node-id="c"]')).toHaveLength(0);
 expect(instance.geometry.edges[2]!.dashed).toBe(false);
});

it('renders explicitly nested activations and participant creation and destruction',()=>{
 const source=`@sequence
participant a
create b "Worker"
a -> b: create
activate b
b -> b: work
activate b
b --> b: result
deactivate b
b --> a: done
deactivate b
destroy b`;
 const instance=render(source);
 const b=instance.geometry.nodes.find(node=>node.id==='b')!;
 const events=JSON.parse(b.attributes.sequencePositions!);
 const created=events.find((event:{kind:string})=>event.kind==='create');
 const destroyed=events.find((event:{kind:string})=>event.kind==='destroy');
 expect(b.y+b.height/2).toBe(created.y);
 expect(instance.geometry.edges[0]!.points[1]!.x).toBe(b.x);
 expect(document.querySelectorAll('.finch-activation[data-node-id="b"]')).toHaveLength(2);
 expect(Number(document.querySelector('.finch-lifeline[data-node-id="b"]')!.getAttribute('y2'))).toBe(destroyed.y);
 expect(document.querySelectorAll('.finch-destruction')).toHaveLength(1);
 b.x+=80;rerouteGeometry(instance.geometry);
 expect(instance.geometry.edges[0]!.points[1]!.x).toBe(b.x);
});

it('rejects unmatched deactivation and invalid lifetimes',()=>{
 expect(()=>parseSequence('@sequence\ndeactivate a')).toThrow();
 expect(()=>parseSequence('@sequence\na -> b\ncreate b')).toThrow();
 expect(()=>parseSequence('@sequence\na -> b\ndestroy b\na -> b')).toThrow();
 expect(()=>parseSequence('@sequence\ncreate b\na -> c')).toThrow();
});

it('preserves protected members with modifiers',()=>{
 const model=parseClass('@class\nclass A {\n static #count: int\n abstract #run(): void\n}');
 const members=JSON.parse(model.nodes[0]!.attributes.members!);
 expect(members[0]).toMatchObject({static:true,text:'#count: int'});
 expect(members[1]).toMatchObject({abstract:true,text:'#run(): void'});
});

it('preserves state entry, exit, do and internal actions without self transitions',()=>{
 const source=`@state
state running
entry running "start timer"
do running "process jobs"
internal running "refresh / reload"
exit running "stop timer"
stereotype running "worker"`;
 const model=parseState(source);
 expect(model.connections).toHaveLength(0);
 expect(JSON.parse(model.nodes[0]!.attributes.stateBody!)).toEqual(['entry / start timer','do / process jobs','refresh / reload','exit / stop timer']);
 render(source);
 expect(document.querySelector('.finch-nodes')!.textContent).toContain('refresh / reload');
 expect(document.querySelector('.finch-nodes')!.textContent).toContain('«worker»');
 expect(()=>parseState('@state\ninitial x\nentry x "invalid"')).toThrow();
});

it('expands nested pre-test and post-test loops with forward ranks and stable exits',()=>{
 const source=`@activity
start begin
while items "more?" {
 action load "load"
 repeat retry "retry?" {
  action send "send"
 }
 action save "save"
}
end done
begin -> items
items.done -> done`;
 const model=parseActivity(source);
 expect(model.source).toBe(source);
 const has=(from:string,to:string)=>model.connections.some(edge=>edge.from===from&&edge.to===to);
 expect(has('items','load')).toBe(true);
 expect(has('retry','send')).toBe(true);
 expect(has('send','retry.test')).toBe(true);
 expect(has('retry.test','send')).toBe(true);
 expect(has('save','items')).toBe(true);
 const instance=render(source);
 const y=(id:string)=>instance.geometry.nodes.find(node=>node.id===id)!.y;
 expect(y('begin')).toBeLessThan(y('items'));
 expect(y('items')).toBeLessThan(y('send'));
 expect(y('send')).toBeLessThan(y('retry.test'));
 expect(()=>parseActivity('@activity\nwhile x "yes" {\n}')).toThrow();
});

it('renders static and abstract members plus semantic endpoint roles',()=>{
 const source=`@class
class A {
 static +count: int
 abstract +run(): void
}
class B {
 -id: UUID
}
A "1" -- "*" B [fromRole=owner toRole=items]
stereotype A "service"`;
 const model=parseClass(source);
 expect(model.connections[0]!.attributes).toMatchObject({fromRole:'owner',toRole:'items'});
 const members=JSON.parse(model.nodes[0]!.attributes.members!);
 expect(members[0]).toMatchObject({static:true,text:'+count: int'});
 expect(members[1]).toMatchObject({abstract:true,text:'+run(): void'});
 render(source);
 expect(document.querySelector('text[text-decoration="underline"]')!.textContent).toBe('+count: int');
 expect(document.querySelector('text[font-style="italic"]')!.textContent).toBe('+run(): void');
 expect(document.querySelector('.finch-nodes')!.textContent).toContain('«service»');
 expect([...document.querySelectorAll('.finch-cardinality')].map(el=>el.textContent)).toEqual(['owner [1]','items [*]']);
});

it('connects an association class to the midpoint of the relationship',()=>{
 const instance=render(`@class
class A {
}
class B {
}
class Link {
 -role: String
}
A -- B
association Link A->B`);
 const relationship=instance.geometry.edges.find(edge=>edge.from==='A'&&edge.to==='B')!;
 const link=instance.geometry.edges.find(edge=>edge.to==='Link')!;
 expect(link.points[0]).toEqual(routeMidpoint(relationship.points));
 expect(document.querySelector('[data-edge-id="Link-link"]')!.getAttribute('marker-end')).toBeNull();
 const a=instance.geometry.nodes.find(node=>node.id==='A')!;a.x+=50;
 rerouteGeometry(instance.geometry);
 expect(instance.geometry.edges.find(edge=>edge.to==='Link')!.points[0]).toEqual(routeMidpoint(instance.geometry.edges.find(edge=>edge.from==='A'&&edge.to==='B')!.points));
});
