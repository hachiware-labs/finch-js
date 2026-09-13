import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Publish only the static examples and their dependencies, never the whole checkout.
const destination = path.resolve('_site');
await mkdir(destination, { recursive: true });
for (const folder of ['examples', 'dist', 'icon-packs', 'docs/assets']) {
  await cp(folder, path.join(destination, folder), { recursive: true });
}
for (const file of ['LICENSE', 'LUCIDE-LICENSE.txt']) {
  await cp(file, path.join(destination, file));
}
// Markdown documentation should open on GitHub instead of downloading as plain text.
for (const file of await readdir(path.join(destination, 'examples'))) {
  if (!file.endsWith('.html')) continue;
  const target = path.join(destination, 'examples', file);
  const html = (await readFile(target, 'utf8')).replace(/href=(['"])([^'"]+\.md(?:[?#][^'"]*)?)\1/g, (match, quote, href) => {
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) return match;
    const resolved = new URL(href, 'https://github.com/hachiware-labs/finch-js/blob/main/examples/');
    return `href=${quote}${resolved.href}${quote}`;
  });
  await writeFile(target, html);
}
await writeFile(path.join(destination, '.nojekyll'), '');
await writeFile(path.join(destination, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=examples/"><title>Finch.js examples</title><a href="examples/">Open Finch.js examples</a>');
console.log('Built GitHub Pages site in _site/');
