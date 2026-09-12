import type {GeometryNode, GeometryEdge, LayoutModel} from './types.js';

/** Joint, bounded permutations of two connected blocks. Includes bounded stagger and port variants within the same search. */
export function orderConnectedBlocks(nodes:GeometryNode[], model:LayoutModel, route:(candidate?:LayoutModel)=>GeometryEdge[]):LayoutModel | undefined {
 if(!['graph','deployment'].includes(model.kind)||nodes.length>30||model.connections.length>40)return;
 if(model.connections.some(e=>e.attributes?.fromPort||e.attributes?.toPort||e.attributes?.layoutDirection||["routing","crossingCost","bendCost","lengthCost","crossingClearance"].some(k=>e.attributes?.[k]!==undefined)))return;
 const locked=(n:GeometryNode)=>['order','row','column','place'].some(k=>n.attributes[k]!==undefined);
 const groups:GeometryNode[][]=[];
 for(const parent of nodes.filter(n=>n.shape==='container')){
  const children=nodes.filter(n=>n.parentId===parent.id);
  if(children.length>=2&&children.length<=3&&children.every(n=>n.shape!=='container'&&!locked(n))&&parent.attributes.layout!=='grid')groups.push(children);
 }
 if(!nodes.some(n=>n.parentId)){
  const sources=nodes.filter(n=>!model.connections.some(e=>e.to===n.id));
  const targets=nodes.filter(n=>!model.connections.some(e=>e.from===n.id));
  if(sources.length+targets.length===nodes.length&&[sources,targets].every(g=>g.length>=2&&g.length<=3&&g.every(n=>!locked(n))))groups.push(sources,targets);
 }
 const perspectives=(group:GeometryNode[])=>{
 const patterns:Array<{keys:string[],nodes:GeometryNode[]}>=[];
 const keys=[...new Set(model.connections.map(e=>e.label?.trim() || '__connections'))];
 for(const key of keys){const ids=model.connections.filter(e=>(e.label?.trim() || '__connections')===key).flatMap(e=>[e.from,e.to]);const ordered=[...group].sort((a,b)=>{const rank=(n:GeometryNode)=>{const i=ids.indexOf(n.id);return i<0?Infinity:i;};return rank(a)-rank(b);});const existing=patterns.find(p=>p.nodes.map(n=>n.id).join(',')===ordered.map(n=>n.id).join(','));if(existing)existing.keys.push(key);else if(patterns.length<3)patterns.push({keys:[key],nodes:ordered});}
 if(!patterns.length)patterns.push({keys:['declaration'],nodes:group});return patterns;
 };
 const score=(edges:GeometryEdge[]):number[]=>{
  let shared=0,crossings=0,bends=0,length=0,reverse=0;
  const segments=edges.flatMap((e,index)=>{const source=nodes.find(n=>n.id===e.from),target=nodes.find(n=>n.id===e.to);
   if(source&&target)for(let j=1;j<e.points.length;j++){const a=e.points[j-1]!,b=e.points[j]!;const vertical=model.direction==='down';const delta=vertical?b.y-a.y:b.x-a.x;const forward=vertical?target.y-source.y:target.x-source.x;reverse+=Math.max(0,-delta*Math.sign(forward));}
   bends+=Math.max(0,e.points.length-2);return e.points.slice(1).map((b,i)=>{const a=e.points[i]!;length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);return {a,b,index};});});
  for(let i=0;i<segments.length;i++)for(const b of segments.slice(i+1)){
   const a=segments[i]!;if(a.index===b.index)continue;
   const av=a.a.x===a.b.x,bv=b.a.x===b.b.x;
   const overlap=(a:number,b:number,c:number,d:number)=>Math.max(0,Math.min(Math.max(a,b),Math.max(c,d))-Math.max(Math.min(a,b),Math.min(c,d)));
   if(av&&bv&&a.a.x===b.a.x)shared+=overlap(a.a.y,a.b.y,b.a.y,b.b.y);
   else if(!av&&!bv&&a.a.y===b.a.y)shared+=overlap(a.a.x,a.b.x,b.a.x,b.b.x);
   else if(av!==bv){const v=av?a:b,h=av?b:a;if(v.a.x>Math.min(h.a.x,h.b.x)&&v.a.x<Math.max(h.a.x,h.b.x)&&h.a.y>Math.min(v.a.y,v.b.y)&&h.a.y<Math.max(v.a.y,v.b.y))crossings++;}
  }
  // Provisional difficulty gate: a clear crossing alone is not enough.
  return [0,shared*6+reverse*12+crossings*120+bends*48+length,shared>32||reverse>24||crossings>=2?1:0];
 };
 const better=(a:number[],b:number[])=>a[0]!<b[0]!-0.01||Math.abs(a[0]!-b[0]!)<=0.01&&a[1]!<b[1]!-0.01;
 let pairs=0;
 let selectedModel=model;
 for(let i=0;i<groups.length;i++)for(const right of groups.slice(i+1)){
  const left=groups[i]!;
  if(nodes.find(n=>n.id===left[0]!.parentId)?.parentId!==nodes.find(n=>n.id===right[0]!.parentId)?.parentId)continue;
  if(!model.connections.some(e=>left.some(n=>n.id===e.from)&&right.some(n=>n.id===e.to)||right.some(n=>n.id===e.from)&&left.some(n=>n.id===e.to)))continue;
  if(++pairs>4)return selectedModel;
  const original=nodes.map(n=>({x:n.x,y:n.y}));
  let best=original.map(p=>({...p})),bestScore=score(route(selectedModel));
  if (!bestScore[2]) continue;
  let bestModel=selectedModel;
  const slots=(g:GeometryNode[])=>g.map(n=>({x:n.x+n.width/2,y:n.y+n.height/2}));
  const aSlots=slots(left),bSlots=slots(right);
  if(model.kind==='graph'&&left.length===3&&right.length===3&&!nodes.some(n=>n.parentId)){const axis=model.direction==='down'?'y':'x';for(const positions of [aSlots,bSlots]){const center=[...positions].sort((a,b)=>a[axis]-b[axis])[1]![axis];positions.forEach(p=>p[axis]=center);}}
  const variants: Array<[number,boolean]>=model.kind==='graph'&&left.length===3&&right.length===3&&!nodes.some(n=>n.parentId)?[[0,false],[1,false],[1,true]]:[[0,false],[0,true]];
  const lp=perspectives(left),rp=perspectives(right);
  const matched=lp.flatMap(a=>rp.filter(b=>a.keys.some(k=>b.keys.includes(k))).map(b=>({a:a.nodes,b:b.nodes})));
  const mixed=lp.flatMap(a=>rp.filter(b=>!a.keys.some(k=>b.keys.includes(k))).map(b=>({a:a.nodes,b:b.nodes})));
  for(const stage of [matched,mixed]) {
   if (!bestScore[2]) break;
   for(const {a,b} of stage)for(const [stagger,ports] of variants){
   nodes.forEach((n,j)=>Object.assign(n,original[j]));
   for(const [g,positions] of [[a,aSlots],[b,bSlots]] as const)g.forEach((n,j)=>{n.x=positions[j]!.x-n.width/2;n.y=positions[j]!.y-n.height/2;});
   if(stagger){const vertical=model.direction==='down';const shift=(n:GeometryNode,d:number)=>{if(vertical)n.y+=d;else n.x+=d;};shift(b[Math.floor(b.length/2)]!,stagger===1?-48:48);if(stagger===1)shift(a[a.length-1]!,32);}
   const candidateModel=ports?{...selectedModel,connections:selectedModel.connections.map(e=>{const from=nodes.find(n=>n.id===e.from)!,to=nodes.find(n=>n.id===e.to)!;if(!from||!to)return e;const vertical=model.direction==='down';const forward=vertical?to.y>from.y:to.x>from.x;return {...e,attributes:{...e.attributes,fromPort:vertical?(forward?'bottom':'top'):(forward?'right':'left'),toPort:vertical?(forward?'top':'bottom'):(forward?'left':'right')}};})}:selectedModel;
   const invalid=nodes.some((n,j)=>{
    const parent=nodes.find(p=>p.id===n.parentId);
    if(parent&&(n.x<parent.x||n.y<parent.y+(parent.headerHeight??0)||n.x+n.width>parent.x+parent.width||n.y+n.height>parent.y+parent.height))return true;
    return nodes.slice(j+1).some(m=>n.parentId===m.parentId&&n.x<m.x+m.width&&n.x+n.width>m.x&&n.y<m.y+m.height&&n.y+n.height>m.y);
   });
   if(invalid)continue;
   const candidate=score(route(candidateModel));if(better(candidate,bestScore)){bestScore=candidate;bestModel=candidateModel;best=nodes.map(n=>({x:n.x,y:n.y}));}
  }
  }
  nodes.forEach((n,j)=>Object.assign(n,best[j]));
  selectedModel=bestModel;
 }
 return selectedModel;
}
