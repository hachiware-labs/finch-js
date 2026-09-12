// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseSequence} from '../src/index';
import {rerouteGeometry} from '../src/layouts';

it('preserves the side of unknown endpoints when the arrow points left',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\napi <- ?: found\n? <- api: lost',{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;
 const [found,lost]=instance.geometry.edges;
 expect(found!.attributes?.unknownEndpoint).toBe('found');
 expect(found!.points[0]!.x).toBeGreaterThan(node.x+node.width);
 expect(lost!.attributes?.unknownEndpoint).toBe('lost');
 expect(lost!.points[1]!.x).toBeLessThan(node.x);
});

it('supports right-side inputs, left-side outputs and reversed arrows',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\napi <- ]: input\n[ <-- api: output',{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;
 const [input,output]=instance.geometry.edges;
 expect([input!.from,input!.to]).toEqual([']','api']);
 expect(input!.points[0]!.x).toBeGreaterThan(node.x+node.width);
 expect([output!.from,output!.to]).toEqual(['api','[']);
 expect(output!.dashed).toBe(true);
 expect(output!.points[1]!.x).toBeLessThan(node.x);
 node.x+=70;rerouteGeometry(instance.geometry);
 expect(input!.points[0]!.x).toBe(node.x+node.width+24);
 expect(output!.points[1]!.x).toBe(node.x-24);
});

it('distinguishes found and lost endpoints using dots without inventing lifelines',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\n? -> api: found\napi -> ?: lost',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['api']);
 expect(instance.geometry.edges.map(e=>e.attributes?.unknownEndpoint)).toEqual(['found','lost']);
 const edges=document.querySelectorAll('.finch-edge');
 expect(edges[0]?.getAttribute('marker-start')).toBe('url(#finch-message-dot)');
 expect(edges[1]?.getAttribute('marker-end')).toBe('url(#finch-message-dot)');
 expect(()=>parseSequence('@sequence\n? -> ?: invalid')).toThrow('participant');
});

it('renders incoming and outgoing messages without adding participants and reroutes after dragging',()=>{
 const source=`@sequence
participant api "API"
[ -> api: request
api -> ]: response`;
 expect(parseSequence(source).nodes.map(n=>n.id)).toEqual(['api']);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;
 expect(instance.geometry.edges).toHaveLength(2);
 const [incoming,outgoing]=instance.geometry.edges;
 expect(incoming!.points).toHaveLength(2);
 expect(incoming!.points[0]!.x).toBeLessThan(node.x);
 expect(outgoing!.points[1]!.x).toBeGreaterThan(node.x+node.width);
 node.x+=100;rerouteGeometry(instance.geometry);
 expect(incoming!.points[0]!.x).toBe(node.x-24);
 expect(outgoing!.points[1]!.x).toBe(node.x+node.width+24);
});

it('keeps lifetime checks for real participants in external messages',()=>{
 expect(()=>parseSequence('@sequence\n[ -> ]: none')).toThrow('participant');
 expect(()=>parseSequence('@sequence\nparticipant api\ndestroy api\n[ -> api: bad')).toThrow('destroyed');
 const model=parseSequence('@sequence\nparticipant api\ncreate api\n[ -> api: create');
 expect(model.connections[0]!.from).toBe('[');
});

it('attaches external creation to the header and confines messages to alternative frames',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(`@sequence
participant api
create api
[ -> api: create
alt accepted
[ ->> api: event
api --> ]: accepted
else rejected
[ ->> api: event
api --> ]: rejected
end`,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;
 const creation=instance.geometry.edges[0]!;
 expect(creation.points[1]!.x).toBe(node.x);
 const header=document.querySelector('.finch-created-header')!;
 expect(header).not.toBeNull();
 const headerY=Number(header.getAttribute('transform')!.match(/translate\([^ ]+ ([^)]+)\)/)![1]);
 expect(creation.points[1]!.y).toBe(headerY+node.height/2);
 const group=instance.geometry.groups[0]!;
 for(const edge of instance.geometry.edges.slice(1)) {
  expect(edge.points[0]!.y).toBeGreaterThan(group.y);
  expect(edge.points[0]!.y).toBeLessThan(group.y+group.height);
 }
 expect(document.querySelectorAll('.finch-activation')).toHaveLength(0);
 expect(document.querySelector('svg')?.outerHTML).not.toContain('NaN');
});
