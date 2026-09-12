// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createFinch} from '../src/index';
import {rerouteGeometry} from '../src/layouts';
it('keeps Order relations on distinct ports across rendering and rerouting',()=>{
 const html=readFileSync('examples/class.html','utf8');
 const source=html.match(/(?:String.raw)?`([\s\S]*?)`/)![1]!;
 const i=createFinch().render(source,{editor:false});
 const check=()=>{
  const points=i.geometry.edges.filter(e=>e.from==='Order'||e.to==='Order').map(e=>e.from==='Order'?e.points[0]!:e.points[e.points.length-1]!);
  expect(points.length).toBeGreaterThan(3);
  expect(new Set(points.map(p=>`${p.x},${p.y}`)).size).toBe(points.length);
 };
 check();rerouteGeometry(i.geometry);check();i.setTheme('midnight');check();i.update(source);check();i.destroy();
});

it('separates structural families without depending on domain names',()=>{
 const source=`@class
class Base
class Entity
class Part
interface Contract
class Adapter
class Coordinator
interface Remote
Entity --|> Base
Entity *-- Part
Adapter ..|> Contract
Adapter ..> Entity
Coordinator ..> Contract
Coordinator ..> Remote
Coordinator ..> Entity`;
 const i=createFinch().render(source,{editor:false});
 const check=()=>{
  const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
  const cx=(id:string)=>n(id).x+n(id).width/2;
  expect(cx('Base')).toBe(cx('Entity'));
  expect(cx('Entity')).toBe(cx('Part'));
  expect(cx('Contract')).toBe(cx('Adapter'));
  expect(n('Adapter').x+n('Adapter').width).toBeLessThan(n('Entity').x);
  expect(n('Entity').x+n('Entity').width).toBeLessThan(n('Coordinator').x);
  expect(n('Base').y+n('Base').height).toBeLessThan(n('Entity').y);
  expect(n('Entity').y+n('Entity').height).toBeLessThan(n('Part').y);
 };
 check();i.setTheme('midnight');check();i.update(source);check();
 const saved=i.exportLayout();i.importLayout(saved);check();i.destroy();
 const pinned=createFinch().render(source,{editor:false,overlay:{version:1,nodes:{Entity:{x:800,y:700,manual:true,pinned:true}}}});
 expect(pinned.geometry.nodes.find(n=>n.id==='Entity')).toMatchObject({x:800,y:700});pinned.destroy();
});
