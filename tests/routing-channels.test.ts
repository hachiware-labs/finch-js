// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {rerouteGeometry} from '../src/layouts';
import type {Geometry,GeometryNode} from '../src/types';
const node=(id:string,x:number,y:number,width=40,height=40):GeometryNode=>({id,label:id,x,y,width,height,shape:'rect',attributes:{}});
it('keeps a deployment route off a parallel frame side while allowing frame crossings',()=>{
 const g:Geometry={kind:'deployment',width:400,height:400,groups:[],nodes:[{...node('frame',100,0,200,360),shape:'container'},node('a',80,40),node('b',80,260)],edges:[{id:'e',from:'a',to:'b',order:0,dashed:false,points:[],attributes:{fromPort:'bottom',toPort:'top'}}]};
 rerouteGeometry(g);
 const points=g.edges[0]!.points;
 expect(points.some(p=>Math.abs(p.x-100)>=12)).toBe(true);
 const longOnFrame=points.slice(1).some((p,i)=>p.x===100&&points[i]!.x===100&&Math.abs(p.y-points[i]!.y)>32);
 expect(longOnFrame).toBe(false);
 const before=JSON.stringify(points);rerouteGeometry(g);expect(JSON.stringify(g.edges[0]!.points)).toBe(before);
});
it('separates long class relations sharing a target beyond their endpoint approaches',()=>{
 const g:Geometry={kind:'class',width:500,height:500,groups:[],nodes:[node('a',0,0),node('b',0,150),node('c',300,320)],edges:[{id:'ac',from:'a',to:'c',order:0,dashed:false,points:[]},{id:'bc',from:'b',to:'c',order:1,dashed:false,points:[]}]};
 rerouteGeometry(g);
 let overlap=0;
 const [a,b]=g.edges;
 for(let i=1;i<a!.points.length;i++)for(let j=1;j<b!.points.length;j++){
 const p=a!.points[i-1]!,q=a!.points[i]!,r=b!.points[j-1]!,s=b!.points[j]!;
 if(p.x===q.x&&r.x===s.x&&p.x===r.x)overlap+=Math.max(0,Math.min(Math.max(p.y,q.y),Math.max(r.y,s.y))-Math.max(Math.min(p.y,q.y),Math.min(r.y,s.y)));
 if(p.y===q.y&&r.y===s.y&&p.y===r.y)overlap+=Math.max(0,Math.min(Math.max(p.x,q.x),Math.max(r.x,s.x))-Math.max(Math.min(p.x,q.x),Math.min(r.x,s.x)));
 }
 expect(overlap).toBeLessThanOrEqual(32);
});
