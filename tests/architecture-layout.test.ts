// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
const source=`@deployment
container system [layout=architecture] {
 container alpha [layout=column] {
  server a
 }
 container beta [layout=column] {
  server b
 }
 container gamma [layout=row] {
  database c
  database d
 }
 artifact release
 execution runtime
}
a -> b
b -> c
b -> d
release -> runtime`;
it('places connected container groups beside the entry and stacks their successors without relying on labels',()=>{
 const i=createFinch().render(source,{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('beta').x).toBeGreaterThan(n('alpha').x+n('alpha').width);
 expect(n('gamma').x).toBe(n('beta').x);
 expect(n('gamma').y).toBeGreaterThan(n('beta').y+n('beta').height);
 expect(n('release').x).toBe(n('runtime').x);
 expect(n('release').x).toBeLessThan(n('alpha').x);
 const before=i.geometry.nodes.map(n=>({id:n.id,x:n.x,y:n.y}));i.setTheme('midnight');
 expect(i.geometry.nodes.map(n=>({id:n.id,x:n.x,y:n.y}))).toEqual(before);i.destroy();
});
it('preserves a saved pinned position with the architecture strategy',()=>{
 const i=createFinch().render(source,{editor:false,overlay:{version:1,nodes:{a:{x:900,y:850,manual:true,pinned:true}}}});
 expect(i.geometry.nodes.find(n=>n.id==='a')).toMatchObject({x:900,y:850});i.destroy();
});
