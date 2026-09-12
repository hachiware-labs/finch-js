// @vitest-environment jsdom
import {rerouteGeometry} from '../src/layouts';
import {expect,it} from 'vitest';
import {exportDocument} from '../src/document-save';
import {createFinch, defaultTheme, midnightTheme} from '../src/index';
it('exports page SVGs with headers, clipping and page numbers',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nautonumber\na -> b: request\nnewpage "Processing"\nb --> a: response',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages();expect(pages).toHaveLength(2);
 const parsed=pages.map(text=>new DOMParser().parseFromString(text,'image/svg+xml'));
 expect(parsed[0]!.querySelector('parsererror')).toBeNull();
 expect(parsed[1]!.documentElement.getAttribute('aria-label')).toBe('Processing');
 for(const [index,page] of parsed.entries()){
  expect(page.documentElement.querySelectorAll(':scope > [data-node-id]')).toHaveLength(2);
  expect(page.documentElement.querySelector(':scope > svg')?.getAttribute('viewBox')).toBeTruthy();
  expect(page.documentElement.textContent).toContain(`${index+1} / 2`);
  expect(page.querySelector('[data-finch-editor-trigger]')).toBeNull();
 }
 expect(instance.exportState().source).toContain('newpage');
});

it('repeats common header, legend and footer outside each clipped body',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nheader "Production"\nfooter "Internal"\nlegend "Request and response"\na -> b: request\nnewpage "Next"\nb --> a: done',{target:'#diagram',editor:false});
 for(const svg of instance.toSvgPages()){
  const page=new DOMParser().parseFromString(svg,'image/svg+xml');
  for(const kind of ['header','legend','footer'])expect(page.documentElement.querySelectorAll(`:scope > .finch-diagram-${kind}`)).toHaveLength(1);
  const body=page.documentElement.querySelector(':scope > svg')!;
  const bottom=Number(body.getAttribute('y'))+Number(body.getAttribute('height'));
  expect(Number(page.querySelector('.finch-diagram-legend')!.getAttribute('y'))).toBeGreaterThan(bottom);
 }
});

it('repeats nested frame and active operand labels when a page starts inside them',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nalt Allowed\na -> b: first\nelse Denied\nloop Retry\na -> b: second\nnewpage "Continued"\nb --> a: last\nend\nend',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[0]!.querySelectorAll('.finch-page-continuation')).toHaveLength(0);
 const labels=[...pages[1]!.querySelectorAll('.finch-page-continuation')].map(el=>el.textContent);
 expect(labels).toHaveLength(2);
 expect(labels[0]).toContain('Denied');expect(labels[1]).toContain('Retry');
});

it('keeps long labels inside their page and excludes other pages messages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: first\nnewpage\nb --> a: A long response label with many words that needs several lines to remain readable on this narrow diagram',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[0]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 expect(pages[1]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 const body=pages[1]!.querySelector('svg > svg')!;
 const top=Number(body.getAttribute('viewBox')!.split(' ')[1]);
 const label=body.querySelector('.finch-edge-label')!;
 const first=label.querySelector('tspan') ?? label;
 expect(Number(first.getAttribute('y'))-Number(label.getAttribute('font-size'))).toBeGreaterThan(top);
 expect(pages[0]!.documentElement.textContent).not.toContain('A long response');
});

it('shows editor page previews and refreshes them after source updates',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: first\nnewpage\nb --> a: second',{target:'#diagram'});
 const button=document.querySelector<HTMLButtonElement>('[data-action=pages]')!;
 expect(button.hidden).toBe(false);button.click();
 expect(document.querySelectorAll('.finch-editor__page img')).toHaveLength(2);
 instance.update('@sequence\na -> b: changed\nnewpage\nb --> a: second\nnewpage\na -> b: third');
 expect(document.querySelectorAll('.finch-editor__page img')).toHaveLength(3);
 expect(document.querySelector<HTMLAnchorElement>('.finch-editor__page a')!.download).toBe('sequence-page-1.svg');
 instance.update('@sequence\na -> b: plain');
 expect(button.hidden).toBe(true);expect(document.querySelectorAll('.finch-editor__page')).toHaveLength(0);
 instance.destroy();expect(document.querySelector('.finch-editor__pages')).toBeNull();
});

it('repeats only participants alive at the page boundary',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant old\nparticipant worker\na -> old: close\ndestroy old\nnewpage "Create"\ncreate worker\na -> worker: start\nnewpage "Use"\nworker --> a: ready',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 const ids=pages.map(page=>[...page.documentElement.querySelectorAll(':scope > [data-node-id]')].map(el=>el.getAttribute('data-node-id')));
 expect(ids).toEqual([['a','old'],['a'],['a','worker']]);
 expect(pages[1]!.querySelector('svg > svg .finch-nodes [data-node-id="worker"]')).not.toBeNull();
});
it('does not repeat a pending creation above its receiving message after newpage',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant worker\na -> a: prepare\ncreate worker\nnewpage "Create"\na -> worker: start\nnewpage "Use"\nworker --> a: ready',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[1]!.documentElement.querySelector(':scope > [data-node-id="worker"]')).toBeNull();
 expect(pages[1]!.querySelectorAll('svg > svg .finch-nodes [data-node-id="worker"]')).toHaveLength(1);
 expect(pages[1]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 expect(pages[1]!.querySelector('.finch-edge-label')!.textContent).toContain('start');
 expect(pages[2]!.documentElement.querySelector(':scope > [data-node-id="worker"]')).not.toBeNull();
});

it('resets participant lifetime when a page starts in another alternative',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant worker\nalt First\ncreate worker\na -> worker: start\nnewpage "Active"\nworker --> a: ready\nelse Second\nnewpage "Alternative"\ncreate worker\na -> worker: other\nend',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[1]!.documentElement.querySelector(':scope > [data-node-id="worker"]')).not.toBeNull();
 expect(pages[2]!.documentElement.querySelector(':scope > [data-node-id="worker"]')).toBeNull();
});

it('keeps reference, delay and divider boxes wholly on their own pages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant b\nref over a,b: A long reference description which wraps across multiple lines inside the reference box\nnewpage\ndelay Wait for confirmation\nnewpage\ndivider Finished',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 for(const [index,kind] of ['ref','delay','divider'].entries()){
  const page=pages[index]!;
  const boxes=page.querySelectorAll('.finch-sequence-fragments > [data-edge-id]');expect(boxes).toHaveLength(1);
  expect(boxes[0]!.classList.contains(`finch-sequence-${kind}`)).toBe(true);
  const rect=boxes[0]!.querySelector('rect')!;
  const body=page.querySelector('svg > svg')!;
  const [,top,,height]=body.getAttribute('viewBox')!.split(' ').map(Number);
  expect(Number(rect.getAttribute('y'))).toBeGreaterThanOrEqual(top!);
  expect(Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))).toBeLessThanOrEqual(top!+height!);
 }
});

it('uses the current theme for page titles, continuation frames and numbering',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nloop Retry\na -> b: first\nnewpage "Continued"\nb --> a: next\nend',{target:'#diagram',editor:false});
 for(const theme of [midnightTheme,{...defaultTheme,name:'custom',fontFamily:'Georgia, serif',labelColor:'#135724',mutedColor:'#246835',containerStroke:'#357946'}]){
  instance.setTheme(theme);
  const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
  expect(page.querySelector('.finch-page-title')!.getAttribute('fill')).toBe(theme.labelColor);
  expect(page.querySelector('.finch-page-title')!.getAttribute('font-weight')).toBe('700');
  expect(page.querySelector('.finch-page-number')!.getAttribute('fill')).toBe(theme.mutedColor);
  expect(page.querySelector('.finch-page-continuation text')!.getAttribute('fill')).toBe(theme.mutedColor);
  expect(page.querySelector('.finch-page-continuation rect')!.getAttribute('stroke')).toBe(theme.containerStroke);
  for(const text of page.querySelectorAll('.finch-page-title,.finch-page-number,.finch-page-continuation text'))expect(text.getAttribute('font-family')).toBe(theme.fontFamily);
 }
 instance.destroy();
});

it('exports leading, consecutive and trailing empty pages without clipped frame strips',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant b\nnewpage "Start"\nloop Retry\na -> b: first\nnewpage "Empty"\nnewpage "Next"\nb --> a: next\nend\nnewpage "End"',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages).toHaveLength(5);
 for(const index of [0,2,4]){
  const page=pages[index]!;
  expect(page.querySelector('parsererror')).toBeNull();
  expect(page.querySelector('svg > svg')!.getAttribute('height')).toBe('0');
  expect(page.querySelectorAll('.finch-page-continuation')).toHaveLength(0);
  expect(page.querySelectorAll('.finch-edge')).toHaveLength(0);
  expect(page.documentElement.querySelectorAll(':scope > [data-node-id]')).toHaveLength(2);
 }
 expect(pages[1]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 expect(pages[3]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 instance.destroy();
});
it('keeps participant-only pages finite when common footer bands are present',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nfooter "Internal"\nnewpage "Empty"',{target:'#diagram',editor:false});
 for(const svg of instance.toSvgPages()){
  const page=new DOMParser().parseFromString(svg,'image/svg+xml');
  const body=page.querySelector('svg > svg')!;
  expect(body.getAttribute('height')).toBe('0');
  expect(body.getAttribute('viewBox')!.split(' ').map(Number).every(Number.isFinite)).toBe(true);
  expect(page.querySelector('.finch-diagram-footer')!.textContent).toBe('Internal');
 }
 instance.destroy();
});

it('repeats spanning duration labels and omits intervals on unrelated pages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: first\nanchor start\nnewpage\nb --> a: second\nanchor end\nnewpage\na -> b: unrelated\nduration start end "100 ms"',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 for(const index of [0,1]){
  const duration=pages[index]!.querySelector('.finch-sequence-duration')!;
  expect(duration.textContent).toContain('100 ms');
  expect(duration.textContent).toContain('(continued)');
  expect(duration.getAttribute(index===0?'data-continued-after':'data-continued-before')).toBe('true');
  const [,top,,height]=pages[index]!.querySelector('svg > svg')!.getAttribute('viewBox')!.split(' ').map(Number);
  for(const text of duration.querySelectorAll('text')){
   expect(Number(text.getAttribute('y'))).toBeGreaterThan(top!);
   expect(Number(text.getAttribute('y'))).toBeLessThan(top!+height!);
  }
 }
 expect(pages[2]!.querySelector('.finch-sequence-duration')).toBeNull();
 instance.destroy();
});

it('reserves space for multiline duration labels without revealing adjacent messages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: first\nanchor start\nnewpage\nb --> a: second\nanchor end\nduration start end "A long maximum response time constraint requiring many lines to describe the complete service agreement"',{target:'#diagram',editor:false});
 for(const markup of instance.toSvgPages()){
  const page=new DOMParser().parseFromString(markup,'image/svg+xml');
  const duration=page.querySelector('.finch-sequence-duration')!;
  const layer=duration.parentElement!;
  const [,top,,height]=layer.getAttribute('viewBox')!.split(' ').map(Number);
  expect(duration.querySelectorAll('text').length).toBeGreaterThan(4);
  for(const text of duration.querySelectorAll('text')){
   expect(Number(text.getAttribute('y'))-Number(text.getAttribute('font-size'))).toBeGreaterThanOrEqual(top!);
   expect(Number(text.getAttribute('y'))+4).toBeLessThanOrEqual(top!+height!);
  }
  expect(page.querySelectorAll('.finch-edge')).toHaveLength(1);
  expect(Number(duration.querySelector('svg')!.getAttribute('height'))).toBeLessThan(Number(layer.getAttribute('height')));
 }
 instance.destroy();
});

it('fits a long duration contained in one page without marking it continued',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> a: process\nanchor sent send\nanchor received receive\nduration sent received "A long maximum processing time constraint requiring many lines to describe the complete service agreement"',{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
 const duration=page.querySelector('.finch-sequence-duration')!;
 const [,top,,height]=duration.parentElement!.getAttribute('viewBox')!.split(' ').map(Number);
 expect(duration.textContent).not.toContain('(continued)');
 expect(duration.getAttribute('data-continued-before')).toBe('false');
 expect(duration.getAttribute('data-continued-after')).toBe('false');
 for(const text of duration.querySelectorAll('text')){
  expect(Number(text.getAttribute('y'))-Number(text.getAttribute('font-size'))).toBeGreaterThanOrEqual(top!);
  expect(Number(text.getAttribute('y'))+4).toBeLessThanOrEqual(top!+height!);
 }
 instance.destroy();
});

it('renders notes on their own message-free pages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nnote a "Before"\nnewpage "Notes"\nnote a "Middle"\nnewpage\nconstraint a "After"',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 for(const [index,label] of ['Before','Middle','{After}'].entries()){
  const body=pages[index]!.querySelector('svg > svg')!;
  expect(body.textContent).toBe(label);
  expect(Number(body.getAttribute('height'))).toBeGreaterThan(0);
  expect(body.querySelectorAll('[data-node-id]')).toHaveLength(1);
 }
 instance.destroy();
});

it('connects notes on message-free pages to the repeated participant headers',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nnewpage\nnote a "Explanation"',{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
 const target=instance.geometry.nodes.find(node=>node.id==='a')!;
 const note=instance.geometry.nodes.find(node=>node.attributes.annotationTarget==='a')!;
 const header=page.documentElement.querySelector(':scope > [data-node-id="a"]')!;
 const titleHeight=Number(header.getAttribute('transform')!.match(/translate\([^ ]+ ([^)]+)\)/)![1]);
 const body=page.querySelector('svg > svg')!;
 const top=Number(body.getAttribute('viewBox')!.split(' ')[1]);
 const link=page.querySelector('.finch-page-note-link')!;
 expect(link.getAttribute('data-from')).toBe('a');
 expect(link.getAttribute('data-to')).toBe(note.id);
 expect(link.getAttribute('d')).toContain(`M ${target.x+target.width/2} ${titleHeight+target.height}`);
 expect(link.getAttribute('d')).toContain(`H ${note.x-12} V ${Number(body.getAttribute('y'))+note.y-top+note.height/2} H ${note.x}`);
 expect(link.getAttribute('marker-end')).toBeNull();
 instance.destroy();
});

it('fits notes beside messages and reconnects them to the correct message',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: first\nnewpage\na -> b: second [id=second]\nnote second "A long explanation about the second request which must remain visible in the exported page"',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[0]!.querySelector('.finch-page-notes')).toBeNull();
 const layer=pages[1]!.querySelector('.finch-page-notes')!;
 const note=instance.geometry.nodes.find(node=>node.attributes.annotationTarget==='second')!;
 const rendered=layer.querySelector('[data-node-id]')!;
 const y=Number(rendered.getAttribute('transform')!.match(/translate\([^ ]+ ([^)]+)\)/)![1]);
 const [,top,,height]=layer.getAttribute('viewBox')!.split(' ').map(Number);
 expect(y).toBeGreaterThanOrEqual(top!);
 expect(y+note.height).toBeLessThanOrEqual(top!+height!);
 expect(layer.querySelector('.finch-page-note-link')!.getAttribute('data-from')).toBe('second');
 expect(pages[1]!.querySelectorAll('.finch-edge')).toHaveLength(1);
 instance.destroy();
});

it('identifies the source page of a message referenced by a later note',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const message of ['', 'b --> a: done\n']){
  const instance=createFinch().render(`@sequence\na -> b: request [id=req]\nnewpage\n${message}note req "Explanation"`,{target:'#diagram',editor:false});
  const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
  const reference=page.querySelector('.finch-page-note-reference')!;
  expect(reference.textContent).toContain('Page 1');
  expect([...page.querySelectorAll('.finch-page-note-reference')].map(text=>text.textContent).join(' ')).toContain('request');
  expect(page.querySelector('.finch-page-note-link')).toBeNull();
  expect(Number(reference.getAttribute('y'))).toBeGreaterThan(0);
  instance.destroy();
 }
});

it('identifies notes about participants absent from the page header without reviving them',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const source of [
  '@sequence\nparticipant a\nparticipant worker "Worker"\na -> worker: close\ndestroy worker\nnewpage\nnote worker "Cleanup"',
  '@sequence\nparticipant a\nparticipant worker "Worker"\nnote worker "Not created yet"\nnewpage\ncreate worker\na -> worker: start'
 ]){
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
  const page=pages[source.includes('destroy')?1:0]!;
  expect([...page.querySelectorAll('.finch-page-note-reference')].map(text=>text.textContent).join(' ').replace(/\s+/g,' ')).toContain('Worker (worker)');
  expect(page.documentElement.querySelector(':scope > [data-node-id="worker"]')).toBeNull();
  expect(page.querySelector('.finch-page-note-link')).toBeNull();
  instance.destroy();
 }
});

it('separates reference captions from preceding notes on note-only pages',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: A long request description that needs several lines in the note reference [id=req]\nnewpage\nnote req "First"\nnote req "Second"',{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
 const body=page.querySelector('svg > svg')!;
 const [,top]=body.getAttribute('viewBox')!.split(' ').map(Number);
 const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
 const first=body.querySelector(`[data-node-id="${notes[0]!.id}"]`)!;
 const y=Number(first.getAttribute('transform')!.match(/translate\([^ ]+ ([^)]+)\)/)![1]);
 const reference=page.querySelector(`[data-note-id="${notes[1]!.id}"]`)!;
 expect(Number(reference.getAttribute('y'))-12).toBeGreaterThan(Number(body.getAttribute('y'))+y-top!+notes[0]!.height);
 instance.destroy();
});

it('restores page references, numbering and theme from a saved HTML document',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const finch=createFinch();
 const instance=finch.render('@sequence\nautonumber\na -> b: request [id=req]\nnewpage "Notes"\nnote req "First"\nnote req "Second"',{target:'#diagram',editor:false});
 instance.setTheme('midnight');instance.pin('a');
 const state=instance.exportState(),pages=instance.toSvgPages();
 const html=exportDocument(document);instance.destroy();
 const saved=new DOMParser().parseFromString(html,'text/html');
 document.head.innerHTML=saved.head.innerHTML;document.body.innerHTML=saved.body.innerHTML;
 const restored=finch.render('@sequence\nx -> y: placeholder',{target:'#diagram',editor:false});
 expect(restored.exportState()).toEqual(state);
 expect(restored.toSvgPages()).toEqual(pages);
 restored.destroy();document.head.innerHTML='';document.body.innerHTML='';
});

it('substitutes current and total page numbers in exported headings without changing source',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\nheader "Page %page%"\nfooter "%page% / %lastpage%"\ntitle "Part %page%"\na -> b: first\nnewpage "Part %page% of %lastpage%"\nb --> a: second';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 for(const [index,page] of pages.entries()){
  expect(page.querySelector('.finch-diagram-header')!.textContent).toBe(`Page ${index+1}`);
  expect(page.querySelector('.finch-diagram-footer')!.textContent).toBe(`${index+1} / 2`);
 }
 expect(pages[1]!.documentElement.getAttribute('aria-label')).toBe('Part 2 of 2');
 expect(instance.exportState().source).toBe(source);
 instance.update(source+'\nnewpage');
 expect(new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml').querySelector('.finch-diagram-footer')!.textContent).toBe('1 / 3');
 instance.destroy();
});

it('exports one page and hides the page chooser when newpage is ignored',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\nignore newpage\nfooter "%page% / %lastpage%"\na -> b: first\nnewpage\nb --> a: second\nnote b "Details"';
 const instance=createFinch().render(source,{target:'#diagram'});
 const pages=instance.toSvgPages();expect(pages).toHaveLength(1);
 const page=new DOMParser().parseFromString(pages[0]!,'image/svg+xml');
 expect(page.querySelectorAll('.finch-edge')).toHaveLength(2);
 expect(page.querySelector('.finch-diagram-footer')!.textContent).toBe('1 / 1');
 expect(page.documentElement.textContent).toContain('Details');
 expect(document.querySelector<HTMLButtonElement>('[data-action=pages]')!.hidden).toBe(true);
 instance.update(source.replace('ignore newpage\n',''));
 expect(instance.toSvgPages()).toHaveLength(2);
 expect(document.querySelector<HTMLButtonElement>('[data-action=pages]')!.hidden).toBe(false);
 instance.destroy();
});

it('substitutes page variables before wrapping large text and preserves explicit newlines',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nheader "%lastpage%"\nfooter\n%page%\n%lastpage%\nend footer\na -> b: first\nnewpage\nb --> a: second',{target:'#diagram',editor:false,theme:{...defaultTheme,fontSize:64}});
 expect(instance.geometry.diagramText!.blocks.find(block=>block.kind==='header')!.lines.length).toBeGreaterThan(1);
 const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
 expect(page.querySelector('.finch-diagram-header')!.textContent).toBe('2');
 expect([...page.querySelectorAll('.finch-diagram-footer tspan')].map(span=>span.textContent)).toEqual(['2','2']);
 expect(instance.geometry.diagramText!.blocks.find(block=>block.kind==='header')!.text).toBe('%lastpage%');
 instance.destroy();
});

it('exports a multiline note with literal commands and blank lines on its declared page',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: request\nnewpage\nnote b\nFirst "quoted" line\n\nnewpage\nLast line\nend note',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages).toHaveLength(2);
 expect(pages[0]!.documentElement.textContent).not.toContain('quoted');
 const note=pages[1]!.querySelector('svg > svg [data-node-id]')!;
 expect(note.textContent).toContain('First "quoted" line');
 expect(note.textContent).toContain('newpage');
 expect([...note.querySelectorAll('tspan')].some(span=>span.textContent==='')).toBe(true);
 instance.destroy();
});

it('preserves literal backslashes in block notes without turning path segments into newlines',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const source=String.raw`@sequence
participant a
note a
C:\new\reports\file.txt
Literal \n sequence
end note`;
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
 const texts=[...page.querySelectorAll('svg > svg [data-node-id] tspan')].map(span=>span.textContent).join('');
 expect(texts).toContain(String.raw`C:\new\reports\file.txt`);
 expect(texts).toContain(String.raw`Literal \n sequence`);
 expect(instance.exportState().source).toBe(source);
 instance.destroy();
});

it('routes lower-note header connectors outside the note column',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: request\nnote left of a "Upper"\nnote left of a "Lower"',{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
 const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
 const lower=notes[1]!;
 const link=page.querySelector(`.finch-page-note-link[data-to="${lower.id}"]`)!;
 const gutter=lower.x+lower.width+12;
 expect(gutter).toBeGreaterThan(notes[0]!.x+notes[0]!.width);
 expect(link.getAttribute('d')).toContain(`H ${gutter} V `);
 expect(link.getAttribute('d')!.endsWith(`H ${lower.x+lower.width}`)).toBe(true);
 instance.destroy();
});

it('renders rectangular and hexagonal notes with the shared page and side rules',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nrnote left of a "Rectangle"\nnewpage\nhnote a\nHexagonal\nNote\nend hnote',{target:'#diagram',editor:false});
 const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
 expect(notes.map(note=>note.attributes.noteShape)).toEqual(['rnote','hnote']);
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[0]!.querySelector(`svg > svg [data-node-id="${notes[0]!.id}"] > rect`)).not.toBeNull();
 const polygon=pages[1]!.querySelector(`svg > svg [data-node-id="${notes[1]!.id}"] > polygon`)!;
 expect(polygon.getAttribute('points')!.split(' ')).toHaveLength(6);
 expect(pages[1]!.documentElement.textContent).toContain('Hexagonal');
 instance.destroy();
});

it('exports spanning notes as full boxes only on their own page',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: request\nnewpage\nnote over a,b: Both participants must agree on the transaction result before processing resumes\nnewpage\nb --> a: result',{target:'#diagram',editor:false});
 const pages=instance.toSvgPages().map(svg=>new DOMParser().parseFromString(svg,'image/svg+xml'));
 expect(pages[0]!.querySelector('.finch-sequence-note')).toBeNull();
 expect(pages[2]!.querySelector('.finch-sequence-note')).toBeNull();
 const note=pages[1]!.querySelector('.finch-sequence-note')!;
 expect(note.textContent).toContain('Both participants');
 expect(pages[1]!.querySelector('.finch-edge')).toBeNull();
 const rect=note.querySelector('rect')!;
 const [,top,,height]=pages[1]!.querySelector('svg > svg')!.getAttribute('viewBox')!.split(' ').map(Number);
 expect(Number(rect.getAttribute('y'))).toBeGreaterThanOrEqual(top!);
 expect(Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))).toBeLessThanOrEqual(top!+height!);
 instance.destroy();
});

it('preserves multiline spanning-note content without interpreting embedded directives',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\na -> b: first\nnewpage\nnote over a, b\nFirst "quoted" line\n\nnewpage\nignore newpage\nend note';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.toSvgPages()).toHaveLength(2);
 const page=new DOMParser().parseFromString(instance.toSvgPages()[1]!,'image/svg+xml');
 const note=page.querySelector('.finch-sequence-note')!;
 const lines=[...note.querySelectorAll('text')].map(text=>text.textContent);
 expect(lines).toContain('First "quoted" line');
 expect(lines).toContain('');
 expect(lines).toContain('newpage');
 expect(lines).toContain('ignore newpage');
 expect(instance.exportState().source).toBe(source);
 instance.destroy();
});

it('draws folded, rectangular and hexagonal spanning notes in single and block syntax',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 for(const [kind,selector,count] of [['note','path',2],['rnote','rect',1],['hnote','polygon',1]] as const){
  const instance=createFinch().render(`@sequence\nparticipant a\nparticipant b\n${kind} over a,b\nShared condition\nend ${kind}`,{target:'#diagram',editor:false});
  const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
  expect(page.querySelectorAll(`.finch-sequence-note > ${selector}`)).toHaveLength(count);
  expect(instance.model.connections[0]!.attributes!.noteShape).toBe(kind);
  instance.destroy();
 }
});

it('gives single-participant spanning notes enough width and includes it in export bounds',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nhnote over a: Explanation',{target:'#diagram',editor:false});
 const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
 const note=page.querySelector('.finch-sequence-note')!,rect=note.querySelector('rect')!;
 expect(Number(rect.getAttribute('width'))).toBeGreaterThan(instance.geometry.nodes[0]!.width);
 expect([...note.querySelectorAll('text')].map(text=>text.textContent)).toEqual(['Explanation']);
 const [left,,width]=page.documentElement.getAttribute('viewBox')!.split(' ').map(Number);
 expect(Number(rect.getAttribute('x'))).toBeGreaterThanOrEqual(left!);
 expect(Number(rect.getAttribute('x'))+Number(rect.getAttribute('width'))).toBeLessThanOrEqual(left!+width!);
 instance.destroy();
});

it('encloses a widened note inside deeply nested sequence frames',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nloop One\nloop Two\nloop Three\nloop Four\nhnote over a: Explanation\nend\nend\nend\nend',{target:'#diagram',editor:false});
 const rect=instance.svg.querySelector('.finch-sequence-note > rect')!;
 const x=Number(rect.getAttribute('x')),width=Number(rect.getAttribute('width'));
 for(const group of instance.geometry.groups){
  expect(group.x).toBeLessThan(x);
  expect(group.x+group.width).toBeGreaterThan(x+width);
 }
 const groups=instance.geometry.groups;
 for(let index=1;index<groups.length;index++)expect(groups[index]!.x).toBeGreaterThan(groups[index-1]!.x);
 instance.destroy();
});

it('updates frame SVGs and page exports after a participant is moved',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nloop Retry\na -> b: request\nhnote over a,b: Shared constraint\nend',{target:'#diagram',editor:false});
 const overlay=JSON.parse(instance.exportLayout());overlay.nodes.b={x:620,y:28,manual:true,pinned:true};
 instance.importLayout(overlay);
 const group=instance.geometry.groups[0]!;
 expect(group.x+group.width).toBeGreaterThan(620+instance.geometry.nodes.find(node=>node.id==='b')!.width);
 const frame=instance.svg.querySelector('.finch-groups > rect')!;
 expect(Number(frame.getAttribute('width'))).toBe(group.width);
 const page=new DOMParser().parseFromString(instance.toSvgPages()[0]!,'image/svg+xml');
 expect(Number(page.querySelector('.finch-groups > rect')!.getAttribute('width'))).toBe(group.width);
 instance.destroy();
});

it('redraws sequence frame bounds during pointer dragging',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nloop Retry\na -> b: request\nhnote over a,b: Shared condition\nend',{target:'#diagram',editor:false});
 instance.setEditable(true);
 const svg=instance.svg;
 Object.defineProperty(svg,'createSVGPoint',{value:()=>({x:0,y:0})});
 Object.defineProperty(svg,'getScreenCTM',{value:()=>null});
 Object.defineProperty(svg,'setPointerCapture',{value:()=>{}});
 Object.defineProperty(svg,'getBoundingClientRect',{value:()=>({left:0,top:0,width:instance.geometry.width,height:instance.geometry.height})});
 const event=(type:string,x:number)=>{const e=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:50});Object.defineProperty(e,'pointerId',{value:1});return e;};
 const before=instance.geometry.groups[0]!.width;
 svg.querySelector('[data-node-id="b"]')!.dispatchEvent(event('pointerdown',100));
 svg.dispatchEvent(event('pointermove',500));
 expect(instance.geometry.groups[0]!.width).toBeGreaterThan(before);
 expect(Number(svg.querySelector('.finch-groups > rect')!.getAttribute('width'))).toBe(instance.geometry.groups[0]!.width);
 instance.destroy();
});

it('moves later messages and frame boundaries down when a fragment becomes taller',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nloop Retry\na -> b: first\nnote over a,b: A detailed condition describing a shared processing requirement that must remain readable after participants move closer together\nb --> a: second\nend',{target:'#diagram',editor:false});
 const geometry=instance.geometry;
 const note=geometry.edges[1]!,next=geometry.edges[2]!;
 const before=next.points[0]!.y,oldHeight=Number(note.attributes!.fragmentHeight),frameHeight=geometry.groups[0]!.height;
 const originalX=geometry.nodes.find(node=>node.id==='b')!.x;
 geometry.nodes.find(node=>node.id==='b')!.x=geometry.nodes.find(node=>node.id==='a')!.x+12;
 rerouteGeometry(geometry);
 const growth=Number(note.attributes!.fragmentHeight)-oldHeight;
 expect(growth).toBeGreaterThan(0);
 expect(next.points[0]!.y).toBe(before+growth);
 expect(geometry.groups[0]!.height).toBe(frameHeight+growth);
 rerouteGeometry(geometry);
 expect(next.points[0]!.y).toBe(before+growth);
 geometry.nodes.find(node=>node.id==='b')!.x=originalX;
 rerouteGeometry(geometry);
 expect(Number(note.attributes!.fragmentHeight)).toBe(oldHeight);
 expect(next.points[0]!.y).toBe(before);
 expect(geometry.groups[0]!.height).toBe(frameHeight);
 instance.destroy();
});

it('keeps created participant headers attached to arrivals through fragment reflow',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nparticipant a\nparticipant b\nnote over a,b: A detailed condition describing a shared processing requirement that must remain readable after participants move closer together\ncreate c\na -> c: start\nc -> b: work\ndestroy c',{target:'#diagram',editor:false});
 const geometry=instance.geometry,b=geometry.nodes.find(node=>node.id==='b')!,c=geometry.nodes.find(node=>node.id==='c')!;
 const originalX=b.x,originalY=c.y;
 const positions=()=>JSON.parse(c.attributes.sequencePositions!) as Array<{kind:string;y:number}>;
 const originalDestroy=positions().find(event=>event.kind==='destroy')!.y;
 b.x=geometry.nodes.find(node=>node.id==='a')!.x+12;
 rerouteGeometry(geometry);
 const growth=c.y-originalY;
 expect(growth).toBeGreaterThan(0);
 expect(c.y+c.height/2).toBe(geometry.edges[1]!.points.slice(-1)[0]!.y);
 expect(positions().find(event=>event.kind==='destroy')!.y).toBe(originalDestroy+growth);
 b.x=originalX;
 rerouteGeometry(geometry);
 expect(c.y).toBe(originalY);
 expect(positions().find(event=>event.kind==='destroy')!.y).toBe(originalDestroy);
 instance.destroy();
});

it('reflows both alternative lifetimes and their rendered headers during dragging',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(`@sequence
participant a
participant b
control job
alt first
note over a,b: A detailed condition describing the first processing requirement before creating a temporary worker
create job
a -> job: start
job --> a: done
destroy job
else second
note over a,b: A detailed condition describing the second processing requirement before creating another temporary worker
create job
b -> job: start
job --> b: done
destroy job
end`,{target:'#diagram',editor:false});
 instance.setEditable(true);
 const svg=instance.svg,geometry=instance.geometry;
 Object.defineProperty(svg,'createSVGPoint',{value:()=>({x:0,y:0})});
 Object.defineProperty(svg,'getScreenCTM',{value:()=>null});
 Object.defineProperty(svg,'setPointerCapture',{value:()=>{}});
 Object.defineProperty(svg,'getBoundingClientRect',{value:()=>({left:0,top:0,width:geometry.width,height:geometry.height})});
 const event=(type:string,x:number)=>{const e=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:50});Object.defineProperty(e,'pointerId',{value:1});return e;};
 const a=geometry.nodes.find(n=>n.id==='a')!,b=geometry.nodes.find(n=>n.id==='b')!,job=geometry.nodes.find(n=>n.id==='job')!;
 const original=JSON.parse(job.attributes.sequencePositions!),frameHeight=geometry.groups[0]!.height;
 const verify=()=>{
  const positions=JSON.parse(job.attributes.sequencePositions!) as Array<{kind:string;y:number}>;
  const creates=positions.filter(e=>e.kind==='create');
  const headers=[...svg.querySelectorAll('.finch-created-header[data-node-id="job"]')];
  expect(headers).toHaveLength(2);
  headers.forEach((header,index)=>expect(header.getAttribute('transform')).toBe(`translate(${job.x} ${creates[index]!.y-job.height/2})`));
  expect(svg.querySelectorAll('.finch-destruction[data-node-id="job"]')).toHaveLength(2);
  expect(Number(svg.querySelector('.finch-groups > rect')!.getAttribute('height'))).toBe(geometry.groups[0]!.height);
 };
 svg.querySelector('.finch-nodes [data-node-id="b"]')!.dispatchEvent(event('pointerdown',b.x));
 const originalX=b.x;
 svg.dispatchEvent(event('pointermove',a.x+12));
 expect(geometry.groups[0]!.height).toBeGreaterThan(frameHeight);
 verify();
 svg.dispatchEvent(event('pointermove',originalX));
 verify();
 expect(JSON.parse(job.attributes.sequencePositions!)).toEqual(original);
 expect(geometry.groups[0]!.height).toBe(frameHeight);
 instance.destroy();
});
