// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseSequence} from '../src/index';
const source=`@sequence
participant client
participant api
autonumber
divider "Authentication"
client -> api: login
== Persistence ==
api --> client: saved`;
it('renders dividers without numbering or arrows and preserves them across themes',()=>{
 const model=parseSequence(source);
 expect(model.nodes).toHaveLength(2);
 expect(model.connections.filter(e=>e.attributes?.messageKind!=='divider').map(e=>e.label)).toEqual(['1. login','2. saved']);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-sequence-divider')).toHaveLength(2);
 expect(document.querySelector('.finch-sequence-divider')?.textContent).toContain('Authentication');
 expect(document.querySelector('.finch-sequence-divider [marker-end]')).toBeNull();
 const edges=instance.geometry.edges;
 expect(edges[1]!.points[0]!.y).toBeGreaterThan(edges[0]!.points[0]!.y+36);
 expect(instance.toSvgString()).toContain('Persistence');
 instance.setTheme('default');
 expect(document.querySelectorAll('.finch-sequence-divider')).toHaveLength(2);
});
it('rejects a divider with no participants and cannot anchor a divider as a message',()=>{
 expect(()=>parseSequence('@sequence\ndivider "Start"')).toThrow(/participants/);
 expect(()=>parseSequence(source+'\ndivider "End"\nanchor finish')).toThrow(/must follow a message/);
 expect(()=>parseSequence('@sequence\na -> b: done\ndestroy b\ndivider "End"')).not.toThrow();
});
