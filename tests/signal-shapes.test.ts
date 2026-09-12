// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseActivity,parseState} from '../src/index';
it('connects send/receive actions in automatic activity flow and swimlanes',()=>{
 const source=`@activity flow
lane client {
 start begin
 send request "Send order"
}
lane service {
 receive accepted "Receive order"
 action handle "Handle order"
 end done
}`;
 const model=parseActivity(source);
 expect(model.nodes.find(n=>n.id==='request')?.shape).toBe('signal-send');
 expect(model.nodes.find(n=>n.id==='accepted')?.parentId).toBe('service');
 expect(model.connections.map(e=>[e.from,e.to])).toEqual([['begin','request'],['request','accepted'],['accepted','handle'],['handle','done']]);
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-shape-signal-receive polygon')).toHaveLength(1);
});
it('preserves the SDL display kind and attaches a left input to its notch',()=>{
 const source=`@state
state waiting
sdlreceive accept "Order received"
waiting -> accept: order [toPort=left]`;
 expect(parseState(source).nodes[1]!.attributes.stateKind).toBe('sdlreceive');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes.find(n=>n.id==='accept')!;
 const points=instance.geometry.edges[0]!.points;
 expect(points[points.length-1]).toEqual({x:node.x+20,y:node.y+node.height/2});
});

it('mirrors signal outlines and notch ports while preserving text and source',()=>{
 const source='@state\nstate waiting\nsdlreceive accept "Result" [facing=left]\nwaiting -> accept: result [toPort=right]';
 document.body.innerHTML='<div id="diagram"></div>';
 const i=createFinch().render(source,{target:'#diagram',editor:false});
 const check=()=>{
  const n=i.geometry.nodes.find(n=>n.id==='accept')!;
  const points=i.geometry.edges[0]!.points;
  expect(points[points.length-1]).toEqual({x:n.x+n.width-20,y:n.y+n.height/2});
  expect(document.querySelector('.finch-shape-signal-receive polygon')?.getAttribute('transform')).toContain('scale(-1 1)');
  expect(document.querySelector('.finch-shape-signal-receive text')?.getAttribute('transform')).toBeNull();
 };
 check();i.setTheme('midnight');check();i.update(source);check();i.destroy();
});
