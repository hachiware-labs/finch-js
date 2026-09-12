import {chromium} from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto(pathToFileURL(path.join(out,'index.html')).href);
await page.locator('#left-img').evaluate(img=>img.decode());await page.locator('#right-img').evaluate(img=>img.decode());
await page.screenshot({path:path.join(out,'overview.png')});
let checks=0;
for(const c of ['approval','departments','long-labels'])for(const v of ['finch-default','finch-business','mermaid','d2-dagre','d2-elk']){
 await page.selectOption('#case',c);await page.selectOption('#left',v);await page.locator('#left-img').evaluate(img=>img.decode());
 if(!await page.locator('#left-img').evaluate(img=>img.naturalWidth>0))throw Error('Image failed '+c+' '+v);checks++;
}
await page.selectOption('#case','departments');await page.selectOption('#left','finch-default');await page.selectOption('#right','mermaid');await page.locator('#comparison').screenshot({path:path.join(out,'departments-comparison.png')});
await page.click('#mode');if(await page.locator('#mode').getAttribute('aria-pressed')!=='true')throw Error('Natural size toggle failed');await page.click('#mode');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png')});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw Error('Mobile page overflow');if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({imageVariantsChecked:checks,modeToggle:true,mobileOverflow:false,pageErrors:errors}));
}finally{await browser.close();}
