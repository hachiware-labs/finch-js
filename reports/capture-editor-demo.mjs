// Capture actual editor actions; set PLAYWRIGHT_MODULE on other workstations.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'file:///C:/Users/naruhide/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = process.cwd();
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png' })[extname(path)] ?? 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const lang of ['en']) {
    const dir = `reports/doc-media-audit/editing-${lang}`;
    await mkdir(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/examples/readme-demo.html?lang=${lang}`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const cursor = document.createElement('div'); cursor.id = 'capture-cursor';
      cursor.innerHTML = '<svg viewBox="0 0 18 24"><path d="M1 1 L1 20 L6 15 L10 23 L14 21 L10 13 L17 13 Z" fill="#172033" stroke="white" stroke-width="1.5"/></svg>';
      document.body.append(cursor);
    });
    const frames = [];
    const shot = async duration => {
      const file = `frame-${String(frames.length).padStart(3, '0')}.png`;
      await page.screenshot({ path: `${dir}/${file}` }); frames.push({ file, duration });
    };
    const move = async (x, y) => {
      await page.mouse.move(x, y);
      await page.evaluate(({x,y}) => { const c = document.querySelector('#capture-cursor'); c.style.left = x+'px'; c.style.top = y+'px'; }, {x,y});
    };
    const caption = text => page.locator('#instruction').evaluate((el, text) => el.textContent = text, text);
    const trigger = page.locator('[data-finch-editor-trigger]');
    const box = await trigger.boundingBox();
    await move(box.x + box.width/2, box.y + box.height/2); await shot(1300);
    await trigger.click(); await shot(1100);
    assert(await page.locator('[data-source]').isVisible());
    await caption('2. Add Redis and connect it to the API server');
    const source = page.locator('[data-source]');
    const sb = await source.boundingBox(); await move(sb.x+170,sb.y+60);
    await source.focus();
    await source.evaluate(el => {const start = el.value.indexOf('}'); el.setSelectionRange(start,start);});
    await shot(900);
    await page.keyboard.insertText('  database cache "Redis cache" [icon=database tone=amber]\n');
    await page.waitForTimeout(500); await shot(1400);
    assert(await page.locator('[data-node-id="cache"]').count());
    await source.press('Control+End');
    await page.keyboard.insertText('\napi -> cache: Cache');
    await page.waitForTimeout(500); await shot(1700);
    assert((await page.locator('#diagram > svg').textContent()).includes('Cache'));
    await caption('3. Drag nodes to arrange the deployment');
    const cache = await page.locator('[data-node-id="cache"]').first().boundingBox();
    const cx = cache.x+cache.width/2, cy = cache.y+cache.height/2;
    await move(cx,cy); await shot(600); await page.mouse.down();
    await move(cx+20,cy+115); await page.mouse.up();
    await page.locator('[data-action=zoom-reset]').click(); await shot(1800);
    assert(await page.evaluate(() => JSON.parse(diagram.exportLayout()).nodes.cache.manual));
    const api = await page.locator('[data-node-id="api"]').first().boundingBox();
    const ax = api.x+api.width/2, ay = api.y+api.height/2;
    await move(ax,ay); await shot(500); await page.mouse.down();
    for (let i=1;i<=10;i++) { await move(ax-30*i/10,ay); await shot(80); }
    await page.mouse.up(); await shot(1100);
    assert(await page.evaluate(() => JSON.parse(diagram.exportLayout()).nodes.api.manual));
    await caption('Add, connect, arrange. Save as editable HTML.');
    const save = await page.locator('[data-action="save"]').boundingBox();
    await move(save.x+save.width/2,save.y+save.height/2);await shot(2200);
    assert.deepEqual(errors,[]);
    await writeFile(`${dir}/frames.json`,JSON.stringify(frames,null,2));
    console.log(`${lang}: ${frames.length} frames; actual click, drag and source edit verified`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
