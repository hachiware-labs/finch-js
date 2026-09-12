import type {Geometry,LayoutOverlay,GeometryNode} from './types.js';

/** Conservative post-layout pass. Never move a diagram containing saved placements. */
export function expandRoutingChannels(g:Geometry,overlay:LayoutOverlay,reroute:(g:Geometry)=>void):number {
 if(g.kind!=='deployment'||overlay.frozen||Object.keys(overlay.nodes).length)return 0;
 let total=0;
 const descendant=(n:GeometryNode,id:string):boolean=>{
  let p=n.parentId;const seen=new Set<string>();
  while(p&&!seen.has(p)){if(p===id)return true;seen.add(p);p=g.nodes.find(n=>n.id===p)?.parentId;}return false;
 };
 const overlaps=(a:GeometryNode,b:GeometryNode)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 for(let pass=0;pass<2;pass++){
  let changed=false;
  const containers=g.nodes.filter(n=>n.shape==='container');
  for(const left of containers){
   for(const right of containers){
    if(left===right||left.parentId!==right.parentId)continue;
    const lo=left.x+left.width,hi=right.x,top=Math.max(left.y,right.y),bottom=Math.min(left.y+left.height,right.y+right.height);
    if(hi<lo||hi-lo>=120||bottom-top<24)continue;
    const intervals:Array<{id:string;a:number;b:number}>=[];
    for(const e of g.edges)for(let i=1;i<e.points.length;i++){
     const a=e.points[i-1]!,b=e.points[i]!;
     if(a.x!==b.x||a.x<lo||a.x>hi)continue;
     const start=Math.max(top,Math.min(a.y,b.y)),end=Math.min(bottom,Math.max(a.y,b.y));
     if(end-start>=24)intervals.push({id:e.id,a:start,b:end});
    }
    let count=0;
    for(const interval of intervals){const y=interval.a+0.01;count=Math.max(count,new Set(intervals.filter(v=>v.a<=y&&v.b>y).map(v=>v.id)).size);}
    if(count<2)continue;
    const delta=Math.min(48,96-total,36+(count-1)*12-(hi-lo));
    if(delta<=0)continue;
    const before=g.nodes.map(n=>({x:n.x,y:n.y,width:n.width,height:n.height}));
    const roots=g.nodes.filter(n=>n.parentId===right.parentId&&n.x>=right.x);
    for(const n of g.nodes)if(roots.some(r=>n.id===r.id||descendant(n,r.id)))n.x+=delta;
    let parent=right.parentId;const seen=new Set<string>();
    while(parent&&!seen.has(parent)){seen.add(parent);const n=g.nodes.find(n=>n.id===parent);if(!n)break;n.width+=delta;parent=n.parentId;}
    // Do not trade a narrow corridor for new sibling collisions elsewhere.
    const collision=g.nodes.some((a,i)=>g.nodes.slice(i+1).some(b=>a.parentId===b.parentId&&overlaps(a,b)&&!overlaps({...a,...before[i]!},{...b,...before[g.nodes.indexOf(b)]!})));
    if(collision){g.nodes.forEach((n,i)=>Object.assign(n,before[i]));continue;}
    total+=delta;reroute(g);changed=true;break;
   }
   if(changed)break;
  }
  if(!changed)break;
 }
 return total;
}
