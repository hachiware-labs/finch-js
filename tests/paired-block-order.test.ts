import {it,expect} from 'vitest';
import {orderConnectedBlocks} from '../src/paired-block-order';
import type {GeometryNode,LayoutModel,GeometryEdge} from '../src/types';
const fixture=()=>{
 const nodes:GeometryNode[]=['a','b','x','y'].map((id,i)=>({id,label:id,shape:'rect',attributes:{},x:i<2?0:200,y:(i%2)*100,width:40,height:40}));
 const model:LayoutModel={kind:'graph',direction:'right',minimumGap:24,items:nodes.map(n=>({...n,size:{width:n.width,height:n.height}})),groups:[],connections:[['a','y'],['b','x']].map(([from,to],i)=>({id:String(i),from:from!,to:to!,attributes:{},dashed:false,order:i}))};
 return {nodes,model};
};
it('uses connection-perspective orders while preserving slots and connections',()=>{
 const {nodes,model}=fixture();const seen=new Set<string>();
 const route=():GeometryEdge[]=>{
  seen.add(nodes.map(n=>n.y).join(','));
  return model.connections.map(e=>{const a=nodes.find(n=>n.id===e.from)!,b=nodes.find(n=>n.id===e.to)!;return {...e,points:[{x:a.x+40,y:a.y+20},{x:100,y:a.y+20},{x:100,y:b.y+20},{x:b.x,y:b.y+20}]};});
 };
 const connections=JSON.stringify(model.connections);orderConnectedBlocks(nodes,model,route);
 expect(seen.size).toBeLessThanOrEqual(3); // No factorial enumeration.
 expect(nodes[0]!.y).toBe(nodes[3]!.y);expect(nodes[1]!.y).toBe(nodes[2]!.y);
 expect(JSON.stringify(model.connections)).toBe(connections);
 const before=JSON.stringify(nodes);orderConnectedBlocks(nodes,model,route);expect(JSON.stringify(nodes)).toBe(before);
});
it('does not reorder explicit element order or explicit ports',()=>{
 for(const constraint of ['order','port']){const {nodes,model}=fixture();if(constraint==='order')nodes[0]!.attributes.order='1';else model.connections[0]!.attributes={fromPort:'right'};const before=JSON.stringify(nodes);let calls=0;orderConnectedBlocks(nodes,model,()=>{calls++;return [];});expect(JSON.stringify(nodes)).toBe(before);expect(calls).toBe(0);}
});

it('explores port candidates without changing source connections',()=>{
 const {nodes,model}=fixture();const before=JSON.stringify(model);let explored=false;
 const chosen=orderConnectedBlocks(nodes,model,candidate=>{
  const explicit=candidate?.connections.every(e=>e.attributes?.fromPort==='right'&&e.attributes?.toPort==='left');explored ||= Boolean(explicit);
  return [{id:'test',from:'a',to:'y',order:0,dashed:false,points:explicit?[{x:40,y:20},{x:200,y:20}]:[{x:40,y:20},{x:-60,y:20},{x:-60,y:120},{x:200,y:120}]}];
 });
 expect(explored).toBe(true);expect(chosen?.connections[0]?.attributes?.fromPort).toBe('right');expect(JSON.stringify(model)).toBe(before);
});
it('keeps ordinary readable routes without evaluating alternative candidates',()=>{
 const {nodes,model}=fixture();const before=JSON.stringify(nodes);let calls=0;
 orderConnectedBlocks(nodes,model,()=>{calls++;return [
 {id:'one',from:'a',to:'y',order:0,dashed:false,points:[{x:40,y:20},{x:200,y:20}]},
 {id:'two',from:'b',to:'x',order:1,dashed:false,points:[{x:40,y:120},{x:200,y:120}]},
 ];});
 expect(calls).toBe(1);expect(JSON.stringify(nodes)).toBe(before);
});
it('stops after same-perspective candidates resolve the difficulty',()=>{
 const {nodes,model}=fixture();let calls=0;
 orderConnectedBlocks(nodes,model,()=>{
 calls++;return [{id:'one',from:'a',to:'y',order:0,dashed:false,points:calls===1?[{x:40,y:20},{x:-60,y:20},{x:-60,y:120},{x:200,y:120}]:[{x:40,y:20},{x:200,y:20}]}];
 });
 // One initial evaluation, one perspective pair and two port variants.
 expect(calls).toBe(3);
});
