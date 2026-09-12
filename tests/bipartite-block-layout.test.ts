// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
const edges=['a','b','c'].flatMap(a=>['x','y','z'].map(b=>`${a} -> ${b}: relation`)).join('\n');
for(const direction of ['', ' direction=LR'])it(`reserves a corridor between dense independent sets (${direction || 'down'})`,()=>{
 const i=createFinch().render('@graph'+direction+'\n'+edges,{editor:false});
 const sources=i.geometry.nodes.filter(n=>['a','b','c'].includes(n.id)),targets=i.geometry.nodes.filter(n=>['x','y','z'].includes(n.id));
 const gap=direction?Math.min(...targets.map(n=>n.x))-Math.max(...sources.map(n=>n.x+n.width)):Math.min(...targets.map(n=>n.y))-Math.max(...sources.map(n=>n.y+n.height));
 // Stagger may use 80 units of the 226-unit corridor; preserve usable clearance.
 expect(gap).toBeGreaterThanOrEqual(146);expect(i.geometry.edges).toHaveLength(9);
 const before=i.geometry.nodes.map(({id,x,y})=>({id,x,y}));i.autoLayout();expect(i.geometry.nodes.map(({id,x,y})=>({id,x,y}))).toEqual(before);i.destroy();
});
it('keeps pinned producer coordinates',()=>{
 const i=createFinch().render('@graph\n'+edges,{editor:false,overlay:{version:1,nodes:{a:{x:900,y:800,manual:true,pinned:true}}}});i.update('@graph\n'+edges);expect(i.geometry.nodes.find(n=>n.id==='a')).toMatchObject({x:900,y:800});i.destroy();
});


