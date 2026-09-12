// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseSequence} from '../src/index';
const source=`@sequence
title "Order processing"
header "Architecture / v2"
footer "Internal use"
show footbox
a -> b: request
b --> a: accepted`;
it('preserves diagram text without adding participants or messages and exports it',()=>{
 const model=parseSequence(source);
 expect(model.diagramText).toEqual({title:'Order processing',header:'Architecture / v2',footer:'Internal use'});
 expect(model.nodes).toHaveLength(2);expect(model.connections).toHaveLength(2);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelector('.finch-diagram-title')?.textContent).toBe('Order processing');
 expect(instance.toSvgString()).toContain('Internal use');
 expect(instance.exportState().source).toBe(source);
 const titleY=Number(document.querySelector('.finch-diagram-title tspan')?.getAttribute('y'));
 expect(Math.min(...instance.geometry.nodes.map(n=>n.y))).toBeGreaterThan(titleY);
 const footerY=Number(document.querySelector('.finch-diagram-footer tspan')?.getAttribute('y'));
 for(const line of document.querySelectorAll('.finch-lifeline'))expect(Number(line.getAttribute('y2'))).toBeLessThan(footerY);
 instance.setTheme('default');
 expect(document.querySelectorAll('.finch-diagram-title')).toHaveLength(1);
 instance.update('@sequence\na -> b: plain');
 expect(document.querySelector('.finch-diagram-text')).toBeNull();
});
it('wraps long headings and treats markup as literal text',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source.replace('Order processing','A long title with enough words to wrap across several lines in the exported diagram').replace('Internal use','<script>unsafe</script>'),{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-diagram-title tspan').length).toBeGreaterThan(1);
 expect(document.querySelector('.finch-diagram-footer script')).toBeNull();
 expect(document.querySelector('.finch-diagram-footer')?.textContent).toContain('<script>');
});

it('places a multiline legend between live footboxes and the footer',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const text='Solid: request\nDashed: response';
 const instance=createFinch().render(source+'\nlegend '+JSON.stringify(text),{target:'#diagram',editor:false});
 expect(instance.model.diagramText?.legend).toBe(text);
 const legend=document.querySelector('.finch-diagram-legend-frame')!;
 const top=Number(legend.getAttribute('y')),bottom=top+Number(legend.getAttribute('height'));
 const footer=Number(document.querySelector('.finch-diagram-footer tspan')?.getAttribute('y'));
 expect(bottom).toBeLessThan(footer);
 for(const node of document.querySelectorAll('.finch-footbox')){
  const y=Number(node.getAttribute('transform')!.match(/ ([^)]+)/)![1]);
  expect(y+instance.geometry.nodes.find(n=>n.id===node.getAttribute('data-node-id'))!.height).toBeLessThan(top);
 }
 expect(document.querySelectorAll('.finch-diagram-legend tspan')).toHaveLength(2);
 expect(instance.toSvgString()).toContain('Solid: request');
});
