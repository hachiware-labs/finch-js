import {chromium} from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(pathToFileURL(path.join(out,'index.html')).href);
 let images=0;
 for(const c of ['approval','departments','long-labels'])for(const theme of ['finch-default','finch-business']){
  await page.selectOption('#case',c);await page.selectOption('#theme',theme);
  for(const phase of ['before','after']){
   await page.locator('#'+phase+'-img').evaluate(image=>image.decode());
   assert.ok(await page.locator('#'+phase+'-img').evaluate(image=>image.naturalWidth>0));images++;
  }
  const scales=await page.locator('.canvas img').evaluateAll(images=>images.map(image=>{
   const svg=new DOMParser().parseFromString(atob(image.src.split(',')[1]),'image/svg+xml').documentElement;
   return image.getBoundingClientRect().width/Number(svg.getAttribute('viewBox').split(/[\s,]+/)[2]);
  }));
  assert.ok(Math.abs(scales[0]-scales[1])<0.002,'Equal scale');
  assert.ok((await page.locator('#source').textContent()).startsWith('@'));
 }
 await page.screenshot({path:path.join(out,'overview.png')});
 await page.click('#size');assert.equal(await page.locator('#size').getAttribute('aria-pressed'),'true');
 await page.click('#size');assert.equal(await page.locator('#size').getAttribute('aria-pressed'),'false');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'mobile.png')});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.click('#size');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({imagesChecked:images,equalScale:true,sizeToggle:true,mobileOverflow:false,pageErrors:errors}));
}finally{await browser.close();}
