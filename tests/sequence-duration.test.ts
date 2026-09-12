// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseSequence} from '../src/index';
import {rerouteGeometry} from '../src/layouts';
const source=`@sequence
participant a "Client"
participant b "Service"
autonumber
a -> b: request
anchor start
b --> a: response
anchor end
duration start end "100 ms max"`;
it('attaches intervals to messages without adding numbered rows',()=>{
 const model=parseSequence(source);
 expect(model.connections.map(e=>e.label)).toEqual(['1. request','2. response']);
 expect(JSON.parse(model.connections[0]!.attributes!.durations!)).toEqual([{to:model.connections[1]!.id,label:'100 ms max'}]);
 for(const suffix of ['\nanchor end','\nduration missing end "x"','\nduration end start "x"'])expect(()=>parseSequence(source+suffix)).toThrow();
 expect(()=>parseSequence('@sequence\nanchor first')).toThrow(/follow a message/);
});
it('draws duration annotations and retains them on layout updates',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelector('.finch-sequence-duration')?.textContent).toBe('100 ms max');
 const base=createFinch().render(source.replace('duration start end "100 ms max"',''),{editor:false});
 expect(instance.geometry.width).toBeGreaterThan(base.geometry.width);
 instance.update(source.replace('100 ms max','200 ms max'));
 expect(document.querySelector('.finch-sequence-duration')?.textContent).toBe('200 ms max');
});


it('anchors self-message intervals to the actual send and receive endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\na -> a: process\nanchor sent send\nanchor received receive\nduration sent received "elapsed"';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edge=instance.geometry.edges[0]!;
 const path=document.querySelector('.finch-sequence-duration path:nth-child(2)')!.getAttribute('d')!;
 expect(path).toContain(` ${edge.points[0]!.y} V ${edge.points[edge.points.length-1]!.y}`);
 expect(edge.points[edge.points.length-1]!.y).toBeGreaterThan(edge.points[0]!.y);
 expect(()=>parseSequence(source+'\nduration received sent "invalid"')).toThrow(/follow/);
});


it('rejects durations across mutually exclusive branches, including nested frames',()=>{
 const source=`@sequence
alt success
 group work
  a -> b: request
  anchor start
 end
else failure
 a -> b: fallback
 anchor end
end
duration start end "invalid"`;
 expect(()=>parseSequence(source)).toThrow(/mutually exclusive/);
 const valid=`@sequence
a -> b: request
anchor start
alt success
 b --> a: result
 anchor result
else failure
 b --> a: error
end
duration start result "conditional response time"`;
 expect(parseSequence(valid).connections).toHaveLength(3);
});


it('preserves delayed arrivals, execution starts and containing frame bounds',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\nalt ready\na -> b: request [delay=24]\nb --> a: reply\nelse unavailable\na ->> b: notify [delay=12]\nend';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edge=instance.geometry.edges[0]!;
 expect(edge.label).toBe('request');
 expect(edge.points[1]!.y-edge.points[0]!.y).toBe(24);
 expect(Number(document.querySelector('.finch-activation[data-node-id="b"]')!.getAttribute('y'))).toBe(edge.points[1]!.y);
 const group=instance.geometry.groups[0]!;
 expect(group.y+group.height).toBeGreaterThan(instance.geometry.edges[2]!.points[1]!.y);
 instance.geometry.nodes[1]!.x+=100;rerouteGeometry(instance.geometry);
 expect(instance.geometry.edges[0]!.points[1]!.y-instance.geometry.edges[0]!.points[0]!.y).toBe(24);
 expect(()=>parseSequence('@sequence\na -> b: bad [delay=-1]')).toThrow(/delay/);
});
