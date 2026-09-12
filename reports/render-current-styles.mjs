import { chromium } from 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const server = createServer(async (req, res) => {
  try {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
    const body = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({channel:'msedge', headless:true});
try {
  const page = await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:2});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const lang of ['en','ja']) {
    await page.goto(`http://127.0.0.1:${server.address().port}/examples/style-study.html`);
    await page.selectOption('#kind', 'flowchart');
    await page.addStyleTag({content: '.diagram {width:560px;height:560px;padding:24px;overflow:hidden}.diagram svg{max-height:512px;max-width:512px}.theme-card{width:560px;min-width:560px}.grid{display:block}'});
    await page.evaluate(() => document.fonts.ready);
    for (const style of ['default','business','business-shadow','precision','editorial']) {
      const name = style === 'business-shadow' ? 'business' : style;
      await page.evaluate(({lang,name,style}) => {
        let source = diagrams.flowchart;
        if (lang === 'en') for (const [ja,en] of Object.entries({'注文を受け付ける':'Order received','在庫はある？':'In stock?','出荷を手配':'Arrange shipment','入荷予定を確認':'Check restock date','顧客へ案内':'Notify customer','はい':'Yes','いいえ':'No'})) source = source.replaceAll(ja,en);
        shadowEnabled[name] = style === 'default' || style === 'business-shadow';
        renderTheme(name,source,'flowchart');
        const svg=document.querySelector('#diagram-'+name+' svg');svg.style.width='512px';svg.style.height='512px';svg.style.maxWidth='512px';svg.style.maxHeight='512px';
      }, {lang,name,style});
      await page.locator(`#diagram-${name}`).screenshot({path:`docs/assets/finch-style-${style}-${lang}.png`});
      console.log(lang,style);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); server.close(); }
