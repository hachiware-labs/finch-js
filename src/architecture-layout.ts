import type {GeometryNode,LayoutModel} from './types.js';
/** Container-scale architecture layout; explicit opt-in, without domain-name matching. */
export function arrangeArchitecture(children:GeometryNode[],nodes:GeometryNode[],model:LayoutModel,move:(id:string,x:number,y:number)=>void):boolean {
 const groups=children.filter(n=>n.shape==='container');if(groups.length!==3)return false;
 const block=(id:string):string|undefined=>{let n=nodes.find(n=>n.id===id);const seen=new Set<string>();while(n&&!seen.has(n.id)){if(children.includes(n))return n.id;seen.add(n.id);n=nodes.find(p=>p.id===n!.parentId);}return undefined;};
 const links=model.connections.map(e=>({from:block(e.from),to:block(e.to)})).filter(e=>e.from&&e.to&&e.from!==e.to);
 const count=(a:string,b:string)=>links.filter(e=>e.from===a&&e.to===b).length;
 // Enumerate the small set of macro arrangements. Forward links favor entry -> processing -> data.
 const candidates=groups.flatMap(a=>groups.filter(b=>b!==a).map(b=>{const c=groups.find(c=>c!==a&&c!==b)!;return {a,b,c,score:2*count(a.id,b.id)+count(a.id,c.id)+count(b.id,c.id)-2*count(b.id,a.id)-2*count(c.id,a.id)-count(c.id,b.id)};})).sort((a,b)=>b.score-a.score);
 const best=candidates[0]!;if(best.score<=0)return false;
 const originX=Math.min(...children.map(n=>n.x)),originY=Math.min(...children.map(n=>n.y)),gap=72;
 const support=children.filter(n=>n.shape!=='container');
 // Keep directly related support nodes adjacent before positioning the entry group.
 const ordered:GeometryNode[]=[];
 while(ordered.length<support.length){
  const remaining=support.filter(n=>!ordered.includes(n));
  const last=ordered[ordered.length-1];
  remaining.sort((a,b)=>last ? (count(last.id,b.id)+count(b.id,last.id))-(count(last.id,a.id)+count(a.id,last.id)) : links.filter(e=>e.to===b.id).length-links.filter(e=>e.to===a.id).length);
  ordered.push(remaining[0]!);
 }
 let y=originY;for(const n of ordered){move(n.id,originX,y);y+=n.height+40;}
 const entryX=originX+(support.length?Math.max(...support.map(n=>n.width))+gap:0);
 move(best.a.id,entryX,originY);
 const branchX=entryX+best.a.width+gap;
 move(best.b.id,branchX,originY);
 move(best.c.id,branchX,originY+best.b.height+gap);
 return true;
}
