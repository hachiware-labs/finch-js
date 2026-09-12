import {chromium} from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const out='reports/layout-review-01';
const server=createServer(async(req,res)=>{try{const f=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=JSON.parse(await readFile(`${out}/cases.json`));const results=[];
try{for(const c of cases){const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/${out}/${c.id}.html`);await page.evaluate(()=>document.fonts.ready);if(await page.locator('svg').count()){const g=await page.evaluate(()=>{const g=window.instance.geometry;return {width:g.width,height:g.height,nodes:g.nodes.length,edges:g.edges.length,geometry:g};});await writeFile(`${out}/${c.id}.svg`,await page.evaluate(()=>window.instance.toSvgString()));await page.locator('#diagram').screenshot({path:`${out}/${c.id}.png`});results.push({id:c.id,errors,...g});}else results.push({id:c.id,errors});await page.close();}await writeFile(`${out}/measurements.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({geometry,...r})=>r)));}finally{await browser.close();server.close();}
