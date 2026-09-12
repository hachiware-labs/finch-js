// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch} from '../src/index';
const source=`@sequence
show footbox
participant client "Client"
database db "Store"
client -> db: read
db --> client: record`;
it('repeats live participants below messages, follows moves and exports the footbox',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-footbox')).toHaveLength(2);
 expect(instance.toSvgString()).toContain('finch-footbox');
 const footer=document.querySelector('.finch-footbox')!;
 const y=Number(footer.getAttribute('transform')!.match(/ ([^)]+)/)![1]);
 expect(y).toBeGreaterThan(Math.max(...instance.geometry.edges.flatMap(edge=>edge.points.map(p=>p.y))));
 const overlay=JSON.parse(instance.exportLayout());
 const client=instance.geometry.nodes.find(n=>n.id==='client')!;
 const x=client.x+40;
 instance.importLayout({...overlay,nodes:{...overlay.nodes,client:{x,y:client.y}}});
 expect(document.querySelector('.finch-footbox[data-node-id="client"]')?.getAttribute('transform')).toContain(`translate(${x} `);
 instance.setTheme('default');
 expect(document.querySelectorAll('.finch-footbox')).toHaveLength(2);
 instance.update(source+'\nhide footbox');
 expect(document.querySelectorAll('.finch-footbox')).toHaveLength(0);
});
it('omits destroyed participants and retains newly created live participants',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(`@sequence
show footbox
participant a
participant b
participant c
a -> b: work
destroy b
create c
a -> c: start`,{target:'#diagram',editor:false});
 expect([...document.querySelectorAll('.finch-footbox')].map(n=>n.getAttribute('data-node-id'))).toEqual(['a','c']);
});

