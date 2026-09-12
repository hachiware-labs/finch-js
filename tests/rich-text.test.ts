// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
import {richRuns} from '../src/rich-text';
it('renders nested text styles and safe links through wrapping and theme changes',()=>{
 const source='@deployment\nnode A "<b>Important <i>nested words</i></b> <s>old</s> <color:red>red</color> [[https://example.com Guide]]" [wrapWidth=100]';
 const instance=createFinch().render(source,{editor:false});
 const verify=()=>{
  expect(instance.svg.querySelector('tspan[font-weight="700"]')).not.toBeNull();
  expect(instance.svg.querySelector('tspan[font-style="italic"]')).not.toBeNull();
  expect(instance.svg.querySelector('tspan[text-decoration="line-through"]')).not.toBeNull();
  expect(instance.svg.querySelector('tspan[fill="red"]')).not.toBeNull();
  expect(instance.svg.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  expect(instance.svg.textContent).not.toContain('<b>');
 };
 verify();instance.setTheme('midnight');verify();instance.update(source);verify();
 expect(instance.exportState().source).toBe(source);
 instance.destroy();
});
it('supports Creole emphasis without turning scripts into active SVG',()=>{
 expect(richRuns('**bold** //italic// --old--').map(r=>r.text).join('')).toBe('bold italic old');
 const instance=createFinch().render('@deployment\nnode A "<script>alert(1)</script> [[javascript:alert(1) Bad]]"',{editor:false});
 expect(instance.svg.querySelector('script')).toBeNull();
 expect(instance.svg.querySelector('a')).toBeNull();
 instance.destroy();
});

it('retains formatted edge labels after dragging and exporting',()=>{
 const source='@deployment\nnode A\nnode B\nA -> B: <b>send</b>';
 const instance=createFinch().render(source,{editor:false});
 instance.importLayout({version:1,diagram:'deployment',nodes:{B:{x:400,y:240,manual:true,pinned:true}}});
 expect(instance.svg.querySelector('.finch-edge-label tspan[font-weight="700"]')?.textContent).toBe('send');
 expect(instance.svg.outerHTML).toContain('font-weight="700"');
 instance.destroy();
});

it('shares edge colors between sequence, class, state and activity diagrams',()=>{
 for(const source of [
 '@sequence\nA -> B: <b>send</b> [lineColor=red]',
 '@class\nclass A\nclass B\nA --> B [lineColor=red]',
 '@state\nstate A\nstate B\nA -> B [lineColor=red]',
 '@activity\naction A\naction B\nA -> B [lineColor=red]']){
  const instance=createFinch().render(source,{editor:false});
  expect(instance.svg.querySelector('.finch-edge')?.getAttribute('stroke')).toBe('red');
  instance.destroy();
 }
});
