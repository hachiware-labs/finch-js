import type {Point} from './types.js';
/** Proper perpendicular crossing; shared endpoints are connections, not crossings. */
export function crossingPoint(a:Point,b:Point,c:Point,d:Point):Point|undefined {
 if(a.x===b.x && a.y===b.y || c.x===d.x && c.y===d.y)return undefined;
 if(a.y===b.y && c.x===d.x && c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x)&&a.y>Math.min(c.y,d.y)&&a.y<Math.max(c.y,d.y))return {x:c.x,y:a.y};
 if(a.x===b.x && c.y===d.y)return crossingPoint(c,d,a,b);
 return undefined;
}
export function existingCrossings(routes:Point[][]):Point[]{
 const found=new Map<string,Point>();
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)
 for(let a=1;a<routes[i]!.length;a++)for(let b=1;b<routes[j]!.length;b++){
 const p=crossingPoint(routes[i]![a-1]!,routes[i]![a]!,routes[j]![b-1]!,routes[j]![b]!);
 if(p)found.set(`${p.x},${p.y}`,p);
 }
 return [...found.values()];
}
/** Penalize crossings close to existing bends, arrows, or another crossing. */
export function crossingRisk(a:Point,b:Point,routes:Point[][],occupied:Point[],endpoints:Point[],clearance:number):number {
 let risk=0;
 for(const route of routes)for(let i=1;i<route.length;i++){
 const p=crossingPoint(a,b,route[i-1]!,route[i]!);if(!p)continue;
 const distance=Math.min(...[...route,...occupied,...endpoints].map(q=>Math.hypot(p.x-q.x,p.y-q.y)));
 if(distance<clearance)risk+=1-distance/clearance;
 }
 return risk;
}
