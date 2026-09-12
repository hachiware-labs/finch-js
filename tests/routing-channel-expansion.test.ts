import {it,expect} from 'vitest';
import {expandRoutingChannels} from '../src/routing-channels';
import type {Geometry} from '../src/types';
function fixture():Geometry{return {kind:'deployment',width:300,height:200,groups:[],nodes:[{id:'l',label:'L',shape:'container',attributes:{},x:0,y:0,width:100,height:200},{id:'r',label:'R',shape:'container',attributes:{},x:120,y:0,width:100,height:200},{id:'child',parentId:'r',label:'Child',shape:'rect',attributes:{},x:140,y:40,width:40,height:40}],edges:[0,1,2].map(i=>({id:String(i),from:'l',to:'r',order:i,dashed:false,points:[{x:106+i*4,y:30},{x:106+i*4,y:160}]}))};}
it('widens a corridor based on simultaneous distinct routes and moves its children together',()=>{
 const g=fixture();let calls=0;
 const moved=expandRoutingChannels(g,{version:1,nodes:{}},()=>{calls++;});
 expect(moved).toBe(40);expect(calls).toBe(1);expect(g.nodes[1]!.x).toBe(160);expect(g.nodes[2]!.x).toBe(180);
});
it('preserves manual, pinned and frozen layouts',()=>{
 for(const overlay of [{version:1 as const,nodes:{child:{x:140,y:40,manual:true,pinned:false}}},{version:1 as const,nodes:{child:{x:140,y:40,manual:false,pinned:true}}},{version:1 as const,nodes:{},frozen:true}]){
 const g=fixture(),before=JSON.stringify(g);expect(expandRoutingChannels(g,overlay,()=>{})).toBe(0);expect(JSON.stringify(g)).toBe(before);
 }
});
it('ignores perpendicular crossings and limits expansion to two bounded passes',()=>{
 const g=fixture();g.edges.forEach(e=>e.points=[{x:80,y:50},{x:140,y:50}]);expect(expandRoutingChannels(g,{version:1,nodes:{}},()=>{})).toBe(0);
 const busy=fixture();busy.edges=Array.from({length:30},(_,i)=>({...busy.edges[0]!,id:String(i)}));let calls=0;
 expect(expandRoutingChannels(busy,{version:1,nodes:{}},()=>{calls++;})).toBeLessThanOrEqual(96);expect(calls).toBeLessThanOrEqual(2);
});
