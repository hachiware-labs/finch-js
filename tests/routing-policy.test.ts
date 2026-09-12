// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {compareRoutingCost,routingPolicy} from '../src/routing-policy';
import {rerouteGeometry} from '../src/layouts';
import {createFinch} from '../src/index';
import type {Geometry} from '../src/types';
it('trades a clear crossing against bend and distance costs with deterministic ties',()=>{
 const straight={crossings:1,bends:0,length:220,congestion:0,branchCongestion:0};
 const detour={...straight,crossings:0,bends:4,length:600};
 expect(compareRoutingCost(straight,detour,routingPolicy())).toBeLessThan(0);
 expect(compareRoutingCost(straight,detour,routingPolicy({routing:'avoid-crossings'}))).toBeGreaterThan(0);
 expect(compareRoutingCost(straight,detour,routingPolicy({crossingCost:'1000'}))).toBeGreaterThan(0);
 expect(compareRoutingCost({...straight,congestion:20},detour,routingPolicy())).toBeGreaterThan(0);
 for(const value of ['0','-1','Infinity','NaN','10001'])expect(()=>routingPolicy({bendCost:value})).toThrow();
 expect(()=>routingPolicy({routing:'unknown'})).toThrow();
});
it('changes actual routes by policy and preserves the selected policy on rerouting',()=>{
 const make=(routing:string):Geometry=>({kind:'deployment',width:400,height:340,groups:[],nodes:[['l',0,120],['r',320,120],['t',150,0],['b',150,260]].map(([id,x,y])=>({id:String(id),label:String(id),x:Number(x),y:Number(y),width:40,height:40,shape:'rect',attributes:{}})),edges:[{id:'h',from:'l',to:'r',order:0,dashed:false,points:[]},{id:'v',from:'t',to:'b',order:1,dashed:false,points:[],attributes:{routing}}]});
 const balanced=make('balanced'),avoid=make('avoid-crossings');rerouteGeometry(balanced);rerouteGeometry(avoid);
 expect(balanced.edges[1]!.points.every(p=>p.x===170)).toBe(true);
 expect(avoid.edges[1]!.points.some(p=>p.x!==170)).toBe(true);
 const before=JSON.stringify(avoid.edges);rerouteGeometry(avoid);expect(JSON.stringify(avoid.edges)).toBe(before);
});
it('retains routing attributes through source updates and theme changes',()=>{
 const source='@deployment\nnode A\nnode B\nA -> B [routing=avoid-crossings crossingCost=240 bendCost=48 lengthCost=1]';
 const i=createFinch().render(source,{editor:false});i.setTheme('midnight');i.update(i.exportState().source);
 expect(i.geometry.edges[0]!.attributes).toMatchObject({routing:'avoid-crossings',crossingCost:'240'});i.destroy();
});
