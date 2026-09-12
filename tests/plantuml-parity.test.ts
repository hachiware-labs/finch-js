// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseSequence, parseActivity } from '../src/index';

it('numbers messages while reference and delay rows remain non-message fragments',()=>{
 const source=`@sequence
participant a
participant b
autonumber 10 5
a -> b: request
ref over a,b: Authentication
delay 2 seconds
autonumber stop
b --> a: ignored
autonumber resume
a -> b: next`;
 const model=parseSequence(source);
 expect(model.connections.map(e=>e.label)).toEqual(['10. request',undefined,undefined,'ignored','15. next']);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-sequence-ref')).toHaveLength(1);
 expect(document.querySelectorAll('.finch-sequence-delay')).toHaveLength(1);
 expect(document.querySelectorAll('.finch-edge')).toHaveLength(3);
 expect(instance.geometry.edges[3]!.points[0]!.y).toBeGreaterThan(instance.geometry.edges[2]!.points[0]!.y+36);
});

it('supports standalone if/else and switch/case with explicit block endpoints',()=>{
 const model=parseActivity(`@activity
start start
if access "Allowed?" {
 action accept
}
else {
 action reject
}
switch route "Kind" {
 case "fast" {
  action quick
 }
 case "else" {
  action normal
 }
}
end done
start -> access
access.done -> route
route.done -> done`);
 expect(model.connections.filter(e=>e.from==='access').map(e=>e.to)).toEqual(['accept','reject']);
 expect(model.connections.filter(e=>e.from==='route').map(e=>e.to)).toEqual(['quick','normal']);
 expect(()=>parseActivity('@activity\nswitch s "x" {\n}')).toThrow('Empty');
});
