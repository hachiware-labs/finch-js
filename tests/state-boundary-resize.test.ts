// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
import {resizeAncestorContainers,rerouteGeometry} from '../src/layouts';
for(const [input,output] of [['inputPin','outputPin'],['entryPoint','exitPoint']]) {
 it(`does not repeatedly expand a frame around ${input}/${output}`,()=>{
 const i=createFinch().render(`@state\nstate session {\n${input} incoming\nstate active\n${output} outgoing\nincoming -> active\nactive -> outgoing\n}`,{editor:false});
 const g=i.geometry;
 const active=g.nodes.find(n=>n.id==='active')!;
 active.y+=15;
 resizeAncestorContainers(g.nodes,['active']);rerouteGeometry(g);
 const frame=()=>{const n=g.nodes.find(n=>n.id==='session')!;return {x:n.x,y:n.y,width:n.width,height:n.height};};
 const expected=frame();
 for(let step=0;step<50;step++){resizeAncestorContainers(g.nodes,['active','incoming','outgoing']);rerouteGeometry(g);}
 expect(frame()).toEqual(expected);i.destroy();
 });
}

{
 it('keeps nested frames stable when mixed boundary attachments follow them',()=>{
  const nodes:any[]=[
   {id:'outer',shape:'container',x:0,y:0,width:400,height:400,attributes:{}},
   {id:'inner',parentId:'outer',shape:'container',x:40,y:60,width:200,height:200,attributes:{}},
   {id:'body',parentId:'inner',shape:'rectangle',x:80,y:120,width:100,height:50,attributes:{}},
   {id:'port',parentId:'inner',shape:'rectangle',x:0,y:0,width:20,height:20,attributes:{boundaryPort:'true'}},
   {id:'point',parentId:'inner',shape:'circle',x:0,y:0,width:20,height:20,attributes:{connectionPoint:'true'}},
  ];
  const follow=()=>{const n=nodes[1];nodes[3].x=n.x+n.width-10;nodes[3].y=n.y+n.height-10;nodes[4].x=n.x-10;nodes[4].y=n.y-10;};
  follow();resizeAncestorContainers(nodes,['body','port','point']);follow();
  const frames=()=>nodes.slice(0,2).map(n=>[n.x,n.y,n.width,n.height]);
  const expected=frames();
  for(let k=0;k<50;k++){resizeAncestorContainers(nodes,['body','port','point']);follow();}
  expect(frames()).toEqual(expected);
  nodes[2].x+=100;resizeAncestorContainers(nodes,['body']);
  expect(nodes[1].x).toBeGreaterThan(expected[1]![0]!);
 });
}
