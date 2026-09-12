import {it,expect} from 'vitest';
import {crossingPoint,crossingRisk,existingCrossings} from '../src/crossing-quality';
import {compareRoutingCost,routingPolicy} from '../src/routing-policy';
const p=(x:number,y:number)=>({x,y});
it('distinguishes proper crossings, shared endpoints and zero-length segments',()=>{
 expect(crossingPoint(p(0,50),p(100,50),p(50,0),p(50,100))).toEqual(p(50,50));
 expect(crossingPoint(p(0,50),p(50,50),p(50,0),p(50,100))).toBeUndefined();
 expect(crossingPoint(p(0,0),p(0,0),p(0,0),p(0,0))).toBeUndefined();
});
it('penalizes crossings near existing ends and corners with a configurable distance',()=>{
 const routes=[[p(0,50),p(100,50),p(100,100)]];
 expect(crossingRisk(p(10,0),p(10,90),routes,[],[],18)).toBeGreaterThan(0);
 expect(crossingRisk(p(90,0),p(90,90),routes,[],[],18)).toBeGreaterThan(0);
 expect(crossingRisk(p(50,0),p(50,90),routes,[],[],18)).toBe(0);
 expect(crossingRisk(p(10,0),p(10,90),routes,[],[],5)).toBe(0);
});
it('penalizes a new crossing beside an existing crossing before comparing detour cost',()=>{
 const routes=[[p(0,50),p(100,50)],[p(50,0),p(50,100)]];
 const occupied=existingCrossings(routes);expect(occupied).toEqual([p(50,50)]);
 expect(crossingRisk(p(58,0),p(58,100),routes,occupied,[],18)).toBeGreaterThan(0);
 const base={crossings:1,bends:0,length:100,congestion:0,branchCongestion:0};
 expect(compareRoutingCost({...base,crossingRisk:0.5},{...base,crossingRisk:0,length:400},routingPolicy())).toBeGreaterThan(0);
});
