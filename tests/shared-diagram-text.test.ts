// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {exportDocument} from '../src/document-save';
import {expect,it} from 'vitest';
import {createFinch,parseClass,parseState,parseSlide,parseObject} from '../src/index';
it('keeps classifier body text literal and extracts top-level headings',()=>{
 const model=parseClass('@class\ntitle "Overview"\nclass A {\ntitle "member"\n}');
 expect(model.diagramText?.title).toBe('Overview');
 expect(model.nodes[0]!.attributes.members).toContain('member');
 expect(parseState('@state\nheader "System"\nstate A').diagramText?.header).toBe('System');
});
it('reserves title and legend bands without moving nodes or accumulating padding',()=>{
 document.documentElement.innerHTML='<head></head><body><div id="diagram"></div></body>';
 const instance=createFinch().render('@class\ntitle "Overview"\nlegend "Associations"\nclass A {\n}\nclass B {\n}\nA -- B',{target:'#diagram',editor:false});
 const title=document.querySelector('.finch-diagram-title tspan')!;
 expect(Number(title.getAttribute('y'))).toBeLessThan(Math.min(...instance.geometry.nodes.map(n=>n.y)));
 const height=instance.geometry.height;
 const overlay=JSON.parse(instance.exportLayout());instance.importLayout(overlay);
 expect(instance.geometry.height).toBe(height);
 expect(instance.toSvgString()).toContain('Associations');
 instance.setTheme('midnight');expect(document.querySelectorAll('.finch-diagram-title')).toHaveLength(1);
 instance.update('@class\nclass A {\n}');expect(document.querySelector('.finch-diagram-text')).toBeNull();
});


for(const kind of ['deployment','flowchart','graph','state','activity','er','component','usecase','timing','object','slide'])it(`preserves ${kind} semantics and headings across saving and theme changes`,()=>{
 const html=readFileSync(`examples/${kind==='object'?'objects-templates':kind}.html`,'utf8');
 const base=[...html.matchAll(/(?:const|let|var)\s+\w+\s*=\s*(?:String\.raw\s*)?`([^]*?)`/g)].map(m=>m[1]!.trim()).find(s=>s.startsWith('@'+kind))!;
 expect(base).toBeDefined();
 const source=base+'\nheader "Context"\n'+(kind==='slide'?'':'title "Overview"\n')+'legend "Legend text"\nfooter "Version 1"';
 const engine=createFinch(),plain=engine.parse(base),model=engine.parse(source);
 expect(model.nodes).toEqual(plain.nodes);expect(model.connections).toEqual(plain.connections);
 document.documentElement.innerHTML='<head></head><body><div id="diagram"></div></body>';
 const instance=engine.render(source,{target:'#diagram',editor:false});
 expect(instance.toSvgString()).toContain('Legend text');
 const top=Number(document.querySelector('.finch-diagram-header tspan')!.getAttribute('y'));
 expect(top).toBeLessThan(Math.min(...instance.geometry.nodes.map(n=>n.y)));
 const size=instance.geometry.height;
 instance.importLayout(JSON.parse(instance.exportLayout()));expect(instance.geometry.height).toBe(size);
 const saved=exportDocument(document);instance.destroy();
 document.documentElement.innerHTML=new DOMParser().parseFromString(saved,'text/html').documentElement.innerHTML;
 const restored=engine.render('@'+kind,{target:'#diagram',editor:false});
 expect(restored.source).toBe(source);expect(restored.model.diagramText?.footer).toBe('Version 1');
 restored.setTheme('midnight');expect(document.querySelectorAll('.finch-diagram-header')).toHaveLength(1);
 restored.destroy();
},15000);

it('retains an unadorned slide title as a slide element',()=>{
 const model=parseSlide('@slide\nheader "Context"\ntitle "My slide"\nfooter "End"');
 expect(model.nodes.find(n=>n.shape==='slide-title')?.label).toBe('My slide');
 expect(model.diagramText).toEqual({header:'Context',footer:'End'});
});

it('does not count literal member braces as nested containers',()=>{
 const source='@class\npackage domain {\nclass A {\npattern = {\n}\n}\ntitle "After body"';
 const model=parseClass(source);
 expect(model.diagramText?.title).toBe('After body');
 expect(model.nodes.find(n=>n.id==='A')!.attributes.members).toContain('pattern = {');
 const object=parseObject('@object\nobject sample {\nclass value {\n}\nfooter "After object"');
 expect(object.diagramText?.footer).toBe('After object');
 expect(object.nodes[0]!.attributes.slots).toContain('class value {');
});

it('reads multiline diagram text literally and honors later declarations',()=>{
 const engine=createFinch();
 for(const source of ['@sequence\na -> b: request','@class\nclass A {\n}']){
  const model=engine.parse(source+'\nlegend\nRequest: {payload}\n# literal comment\n\nResponse: ok\nend legend\ntitle "Old"\ntitle\nNew\nTitle\nend title');
  expect(model.diagramText).toEqual({title:'New\nTitle',legend:'Request: {payload}\n# literal comment\n\nResponse: ok'});
  expect(()=>engine.parse(source+'\nlegend\nmissing terminator')).toThrow(/Unclosed legend/);
 }
});
