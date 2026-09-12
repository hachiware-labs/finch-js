// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createFinch} from '../src/index';
it('connects vertically facing deployment frames without crossing their contents',()=>{
 const html=readFileSync('examples/deployment.html','utf8');
 const source=html.match(/String.raw`([\s\S]*?)`/)![1]!;
 const i=createFinch().render(source,{editor:false});
 const check=()=>{
  const p=i.geometry.nodes.find(n=>n.id==='platform')!;
  const o=i.geometry.nodes.find(n=>n.id==='observe')!;
  const e=i.geometry.edges.find(e=>e.from==='platform'&&e.to==='observe')!;
  expect(e.dashed).toBe(true);
  expect(e.points[0]!.y).toBe(p.y+p.height);
  expect(e.points[e.points.length-1]!.y).toBe(o.y);
  expect(new Set(e.points.map(p=>p.x)).size).toBe(1);
  expect(e.points.every(point=>point.y>=p.y+p.height&&point.y<=o.y)).toBe(true);
 };
 check();i.setTheme('midnight');check();i.destroy();
});

