import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out=path.dirname(fileURLToPath(import.meta.url));
const results={};
function sharedLength(a,b){
 let total=0;
 for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){
  const p=a[i-1],q=a[i],r=b[j-1],s=b[j];
  if(p.x===q.x&&r.x===s.x&&p.x===r.x)total+=Math.max(0,Math.min(Math.max(p.y,q.y),Math.max(r.y,s.y))-Math.max(Math.min(p.y,q.y),Math.min(r.y,s.y)));
  if(p.y===q.y&&r.y===s.y&&p.y===r.y)total+=Math.max(0,Math.min(Math.max(p.x,q.x),Math.max(r.x,s.x))-Math.max(Math.min(p.x,q.x),Math.min(r.x,s.x)));
 }
 return total;
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();
 for(const [phase,dir] of [['before',path.dirname(out)],['after',out]]){
  const geometry=JSON.parse(await fs.readFile(path.join(dir,'finch-geometry.json'),'utf8'));
  results[phase]={};
  for(const [id,g] of Object.entries(geometry)){
   const groupOverlaps=[];
   const groups=g.nodes.filter(n=>n.shape==='container');
   for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j];
    if(a.parentId===b.parentId&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)groupOverlaps.push([a.id,b.id]);
   }
   const branches=g.edges.filter(e=>e.from==='amount');
   const sharedBranchPixels=branches.length===2?sharedLength(branches[0].points,branches[1].points):0;
   const borderContacts=[];
   for(const edge of g.edges)for(const node of g.nodes.filter(n=>['rectangle','rect','rounded'].includes(n.shape))){
    const x=node.x,y=node.y,r=x+node.width,b=y+node.height;
    const length=sharedLength(edge.points,[{x,y},{x:r,y},{x:r,y:b},{x,y:b},{x,y}]);
    if(length>0)borderContacts.push({edge:edge.id,node:node.id,pixels:length});
   }
   const svg=await fs.readFile(path.join(dir,'assets',id+'.svg'),'utf8');
   await page.setContent('<meta charset="utf-8">'+svg);
   await page.evaluate(()=>document.fonts.ready);
   const diamondOverflow=await page.evaluate(nodes=>{
    const outside=[];
    for(const n of nodes.filter(n=>n.shape==='diamond')){
     const group=document.querySelector(`[data-node-id="${n.id}"]`);
     for(const text of group.querySelectorAll('text')){
      const lines=text.children.length?[...text.querySelectorAll('tspan')]:[text];
      for(const line of lines){
       if(!line.textContent)continue;
       const r=line.getBBox();
       const maxCorner=Math.max(...[r.x,r.x+r.width].flatMap(x=>[r.y,r.y+r.height].map(y=>Math.abs(x-n.width/2)/(n.width/2)+Math.abs(y-n.height/2)/(n.height/2))));
       if(maxCorner>1.01)outside.push({node:n.id,text:line.textContent,maxCorner});
      }
     }
    }
    return outside;
   },g.nodes);
   results[phase][id]={groupOverlaps,sharedBranchPixels,borderContacts,diamondOverflow};
   if(phase==='after'){
    assert.equal(groupOverlaps.length,0,id+' group overlap');
    assert.equal(sharedBranchPixels,0,id+' shared decision branch');
    assert.equal(borderContacts.length,0,id+' node border contact');
    assert.equal(diamondOverflow.length,0,id+' diamond text overflow');
   }
  }
 }
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
