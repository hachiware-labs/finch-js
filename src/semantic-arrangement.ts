import type {GeometryNode, LayoutModel} from './types.js';

/** Separate a shared reference/monitoring block from a directed chain. */
export function arrangeSharedBlocks(blocks:GeometryNode[],model:LayoutModel,branch:(id:string)=>string|undefined,move:(id:string,x:number,y:number)=>void,orient:(id:string,direction:'row'|'column')=>void):boolean {
  if(blocks.length<4||blocks.length>6||blocks.some(n=>n.attributes.layout||n.attributes.order||n.attributes.row||n.attributes.column||n.attributes.place)||model.connections.some(e=>e.attributes?.layoutDirection))return false;
  const links=model.connections.map(e=>({...e,from:branch(e.from),to:branch(e.to)})).filter(e=>e.from&&e.to&&e.from!==e.to);
  const candidates=blocks.filter(n=>model.kind==='class'
    ? !links.some(e=>e.from===n.id)&&new Set(links.filter(e=>e.to===n.id).map(e=>e.from)).size>=3
    : model.kind==='deployment'&&new Set(links.filter(e=>e.to===n.id&&e.dashed).map(e=>e.from)).size>=2);
  if(candidates.length!==1)return false;
  const shared=candidates[0]!,remaining=blocks.filter(n=>n!==shared),chain:GeometryNode[]=[];
  const edges=links.filter(e=>e.from!==shared.id&&e.to!==shared.id);
  while(chain.length<remaining.length){
    const rest=remaining.filter(n=>!chain.includes(n));
    const sources=rest.filter(n=>!edges.some(e=>e.to===n.id&&rest.some(r=>r.id===e.from)));
    if(sources.length===1){chain.push(sources[0]!);continue;}
    // Deployment feedback links may run back along a predominantly forward chain.
    if(model.kind!=='deployment')return false;
    const net=(n:GeometryNode)=>edges.filter(e=>e.from===n.id&&rest.some(r=>r.id===e.to)).length-edges.filter(e=>e.to===n.id&&rest.some(r=>r.id===e.from)).length;
    const sorted=rest.sort((a,b)=>net(b)-net(a));
    if(sorted.length>1&&net(sorted[0]!)===net(sorted[1]!))return false;
    chain.push(sorted[0]!);
  }
  if(chain.slice(1).some((n,i)=>!edges.some(e=>e.from===chain[i]!.id&&e.to===n.id)))return false;
  const gap=100;
  if(model.kind==='class'){
    orient(shared.id,'row');orient(chain[chain.length-1]!.id,'row');
    let y=28;for(const n of chain){move(n.id,28,y);y+=n.height+gap;}
    move(shared.id,28+Math.max(...chain.map(n=>n.width))+gap,chain[Math.floor(chain.length/2)]!.y);
    if(chain.length>=3)move(chain[0]!.id,(28+shared.x)/2,chain[0]!.y);
  }else{
    for(const n of chain)orient(n.id,'column');orient(shared.id,'row');
    let x=28;for(const n of chain){move(n.id,x,28);x+=n.width+gap;}
    move(shared.id,Math.max(28,(x-gap+28-shared.width)/2),28+Math.max(...chain.map(n=>n.height))+gap);
  }
  return true;
}

/** Arrange three mutually connected blocks without placing a block in the middle of every route. */
export function arrangeThreeBlocks(blocks:GeometryNode[], model:LayoutModel, branch:(id:string)=>string|undefined, move:(id:string,x:number,y:number)=>void):boolean {
  if(blocks.length!==3 || blocks.some(n=>n.attributes.layout || n.attributes.order || n.attributes.row || n.attributes.column || n.attributes.place))return false;
  if(model.connections.some(e=>e.attributes?.layoutDirection))return false;
  const links=model.connections.map(e=>({from:branch(e.from),to:branch(e.to)})).filter(e=>e.from&&e.to&&e.from!==e.to);
  if(!blocks.every(a=>blocks.filter(b=>a!==b).every(b=>links.some(e=>e.from===a.id&&e.to===b.id||e.to===a.id&&e.from===b.id))))return false;
  const net=(n:GeometryNode)=>links.filter(e=>e.to===n.id).length-links.filter(e=>e.from===n.id).length;
  const x=28,y=28,gap=100;
  if(model.kind==='class'){
    const sources=blocks.filter(n=>!links.some(e=>e.to===n.id));
    if(sources.length!==1)return false;
    const a=sources[0]!,rest=blocks.filter(n=>n!==a);
    const b=[...rest].sort((a,b)=>net(a)-net(b))[0]!,c=rest.find(n=>n!==b)!;
    move(a.id,x,y);move(b.id,x+a.width+gap,y);
    move(c.id,Math.max(x,x+(a.width+gap+b.width-c.width)/2),y+Math.max(a.height,b.height)+gap);
  }else if(model.kind==='deployment'){
    const sorted=[...blocks].sort((a,b)=>net(b)-net(a));
    if(net(sorted[0]!)<=0 || net(sorted[0]!)===net(sorted[1]!))return false;
    const sink=sorted[0]!,rest=blocks.filter(n=>n!==sink).sort((a,b)=>net(a)-net(b));
    const a=rest[0]!,b=rest[1]!;
    move(a.id,x,y);move(b.id,x,y+a.height+gap);
    move(sink.id,x+Math.max(a.width,b.width)+gap,Math.max(y,y+(a.height+gap+b.height-sink.height)/2));
  }else return false;
  return true;
}

/** A unique shortest start-to-final path provides an axis, not an execution priority. */
export function arrangeStateAxis(nodes:GeometryNode[],model:LayoutModel):void {

  if(model.kind!=='state'||model.direction!=='down'||nodes.some(n=>!['initial-state','final-state','uml-state','rounded'].includes(n.shape)))return;
  if(model.connections.some(e=>e.attributes?.main || e.attributes?.layoutDirection))return;
  const starts=nodes.filter(n=>n.shape==='initial-state'),ends=nodes.filter(n=>n.shape==='final-state');
  if(starts.length!==1||ends.length!==1)return;
  const start=starts[0]!.id,end=ends[0]!.id,queue=[start];
  const distance=new Map<string,number>([[start,0]]),ways=new Map<string,number>([[start,1]]),previous=new Map<string,string>();
  for(let index=0;index<queue.length;index++){
    const id=queue[index]!,nextDistance=distance.get(id)!+1;
    for(const to of new Set(model.connections.filter(e=>e.from===id).map(e=>e.to))){
      if(!distance.has(to)){distance.set(to,nextDistance);ways.set(to,ways.get(id)!);previous.set(to,id);queue.push(to);}
      else if(distance.get(to)===nextDistance)ways.set(to,Math.min(2,ways.get(to)!+ways.get(id)!));
    }
  }
  if(ways.get(end)!==1)return;
  const axis=[end];while(axis[0]!==start)axis.unshift(previous.get(axis[0]!)!);
  const side=nodes.filter(n=>!axis.includes(n.id));
  if(!side.length||side.length>4||side.some(n=>model.connections.some(e=>(e.from===n.id&&!axis.includes(e.to)&&e.to!==n.id)||(e.to===n.id&&!axis.includes(e.from)&&e.from!==n.id))))return;
  const width=Math.max(...nodes.map(n=>n.width)),gap=100,cx=28+width*1.5+gap;
  let y=28;
  for(const id of axis){const n=nodes.find(n=>n.id===id)!;n.x=cx-n.width/2;n.y=y;y+=n.height+90;}
  const bottoms=[28,28];
  side.forEach((n,index)=>{
    const attached=nodes.filter(a=>axis.includes(a.id)&&model.connections.some(e=>e.from===n.id&&e.to===a.id||e.to===n.id&&e.from===a.id));
    const lane=index%2;
    n.x=lane===0?cx+width/2+gap:28;
    n.y=Math.max(bottoms[lane]!,attached.length?attached.reduce((s,a)=>s+a.y,0)/attached.length:28);
    bottoms[lane]=n.y+n.height+70;
  });
}

/** Keep a mutually reachable state cluster together, and put its exit chain beside it. */
export function arrangeStateCycles(nodes:GeometryNode[],model:LayoutModel):void {

  if(model.kind!=='state'||model.direction!=='down'||nodes.length>30||nodes.some(n=>!['initial-state','final-state','rounded','uml-state'].includes(n.shape))||model.connections.some(e=>e.attributes?.main||e.attributes?.layoutDirection))return;
  const successors=(id:string)=>[...new Set(model.connections.filter(e=>e.from===id&&e.to!==id).map(e=>e.to))];
  const reach=(id:string)=>{const seen=new Set<string>(),todo=[id];while(todo.length){const next=todo.pop()!;if(seen.has(next))continue;seen.add(next);todo.push(...successors(next));}return seen;};
  const reachable=new Map(nodes.map(n=>[n.id,reach(n.id)]));
  const clusters:GeometryNode[][]=[];const used=new Set<string>();
  for(const n of nodes){if(used.has(n.id))continue;const group=nodes.filter(m=>reachable.get(n.id)!.has(m.id)&&reachable.get(m.id)!.has(n.id));group.forEach(m=>used.add(m.id));if(group.length>1)clusters.push(group);}
  if(clusters.length!==1||clusters[0]!.length<3||clusters[0]!.length>6)return;
  const core=clusters[0]!,ids=new Set(core.map(n=>n.id));
  const before=nodes.filter(n=>!ids.has(n.id)&&core.some(c=>reachable.get(n.id)!.has(c.id)));
  const after=nodes.filter(n=>!ids.has(n.id)&&core.some(c=>reachable.get(c.id)!.has(n.id)));
  if(before.length+after.length+core.length!==nodes.length||!before.some(n=>n.shape==='initial-state')||!after.some(n=>n.shape==='final-state'))return;
  const linear=(list:GeometryNode[])=>list.every(n=>successors(n.id).filter(id=>list.some(m=>m.id===id)).length<=1&&model.connections.filter(e=>e.to===n.id&&list.some(m=>m.id===e.from)).length<=1);
  if(!linear(before)||!linear(after))return;
  const ordered=(list:GeometryNode[])=>[...list].sort((a,b)=>reachable.get(a.id)!.has(b.id)?-1:reachable.get(b.id)!.has(a.id)?1:0);
  const exits=core.filter(n=>successors(n.id).some(id=>after.some(a=>a.id===id)));
  if(exits.length<2)return;
  const width=Math.max(...nodes.map(n=>n.width)),gap=110,cx=28+width+gap;
  let y=28;for(const n of ordered(before)){n.x=cx+(width-n.width)/2;n.y=y;y+=n.height+80;}
  const coreTop=y;
  for(const n of exits){n.x=cx+(width-n.width)/2;n.y=y;y+=n.height+90;}
  let sideY=coreTop;for(const n of core.filter(n=>!exits.includes(n))){n.x=28;n.y=sideY;sideY+=n.height+90;}
  y=coreTop;for(const n of ordered(after)){n.x=cx+width+gap+50+(width-n.width)/2;n.y=y;y+=n.height+90;}
}

/** Reserve space between two unambiguous producer/consumer sets, preserving direction.
 * The sets are inferred from connectivity, never domain labels or saved coordinates.
 */
export function arrangeBipartiteBlocks(nodes:GeometryNode[],model:LayoutModel):void {
 if(model.kind!=='graph'||nodes.length>24||nodes.some(n=>n.parentId||n.shape==='container'))return;
 if(nodes.some(n=>['order','row','column','place','layout'].some(k=>n.attributes[k]!==undefined)))return;
 if(model.connections.some(e=>e.attributes?.fromPort||e.attributes?.toPort||e.attributes?.layoutDirection))return;
 const sources=nodes.filter(n=>!model.connections.some(e=>e.to===n.id));
 const targets=nodes.filter(n=>!model.connections.some(e=>e.from===n.id));
 if(sources.length<2||targets.length<2||sources.length+targets.length!==nodes.length)return;
 if(!model.connections.every(e=>sources.some(n=>n.id===e.from)&&targets.some(n=>n.id===e.to)))return;
 const pairs=new Set(model.connections.map(e=>JSON.stringify([e.from,e.to])));
 if(pairs.size<sources.length*targets.length*0.75)return;
 const horizontal=model.direction==='right';
 if(!horizontal&&model.direction!=='down')return;
 // Distinct relation bundles need room both along the ports and across the gap.
 const gap=Math.max(model.minimumGap,64);
 const corridor=100+Math.min(12,model.connections.length)*14;
 const crossSize=(n:GeometryNode)=>horizontal?n.height:n.width;
 const length=(set:GeometryNode[])=>set.reduce((sum,n)=>sum+crossSize(n),0)+(set.length-1)*gap;
 const span=Math.max(length(sources),length(targets));
 const depth=Math.max(...sources.map(n=>horizontal?n.width:n.height));
 for(const [index,set] of [sources,targets].entries()){
  let offset=28+(span-length(set))/2;
  for(const n of set){if(horizontal){n.x=28+index*(depth+corridor);n.y=offset;}else{n.x=offset;n.y=28+index*(depth+corridor);}offset+=crossSize(n)+gap;}
 }
}
