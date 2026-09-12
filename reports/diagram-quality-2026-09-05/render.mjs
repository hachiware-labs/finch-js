import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out=process.argv[2] ? path.resolve(process.argv[2]) : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
const scratch='C:/Users/naruhide/AppData/Local/Temp/finch-quality-20260905';
const server=http.createServer(async(req,res)=>{try{const u=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const base=u.startsWith('/vendor/')?scratch+'/node_modules':out;const file=path.join(base,u.replace(/^\/vendor\//,'/'));const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.json')?'application/json':'text/html');res.end(data);}catch(e){res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>console.log('PAGEERROR',String(e)));
 await page.goto(base+'/fixtures.html');await page.waitForFunction(()=>window.done,{timeout:60000});
 const result=await page.evaluate(()=>window.result);console.log('renders',Object.keys(result));
 for(const[id,r]of Object.entries(result)){if(r.error)throw new Error(id+': '+r.error);await fs.writeFile(path.join(out,'assets',id+'.svg'),r.svg);}
 const cases=JSON.parse(await fs.readFile(path.join(out,'cases.json'),'utf8'));
 const variants=['finch-default','finch-business','mermaid','d2-dagre','d2-elk'];
 const metrics={};
 for(const c of cases)for(const variant of variants){
  const id=c.id+'-'+variant;const svg=await fs.readFile(path.join(out,'assets',id+'.svg'),'utf8');
  await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:white}#frame{padding:24px;display:inline-block}#frame>svg{display:block;max-width:none!important}</style><div id="frame">'+svg+'</div>');
  await page.evaluate(()=>document.fonts.ready);
  metrics[id]=await page.evaluate(()=>{
   const svg=document.querySelector('svg');const vb=svg.viewBox.baseVal;const width=vb.width||parseFloat(svg.getAttribute('width'));const height=vb.height||parseFloat(svg.getAttribute('height'));
   const scale=Math.min(1,1000/width);svg.style.width=width*scale+'px';svg.style.height=height*scale+'px';svg.setAttribute('width',width*scale);svg.setAttribute('height',height*scale);
   const texts=[...svg.querySelectorAll('text,foreignObject')].map(el=>{const r=el.getBoundingClientRect();return{text:el.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,font:parseFloat(getComputedStyle(el).fontSize)};});
   const r=svg.getBoundingClientRect();const outside=texts.filter(t=>t.text&&(t.x<r.x-1||t.y<r.y-1||t.x+t.w>r.right+1||t.y+t.h>r.bottom+1));
   return{width,height,scaleAt1000:scale,textOutsideViewport:outside,texts};
  });
  await page.locator('#frame').screenshot({path:path.join(out,'assets',id+'.png'),timeout:30000});
 }
 await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));
 await fs.writeFile(path.join(out,'finch-geometry.json'),JSON.stringify(Object.fromEntries(Object.entries(result).filter(([id])=>id.includes('finch')).map(([id,r])=>[id,r.geometry])),null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([id,m])=>[id,{width:m.width,height:m.height,scale:m.scaleAt1000,outside:m.textOutsideViewport}]))));
}finally{await browser?.close();server.close();}
