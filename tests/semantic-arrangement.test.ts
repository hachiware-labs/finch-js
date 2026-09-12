// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createFinch} from '../src/index';
import {rerouteGeometry} from '../src/layouts';
import type {GeometryNode,Point} from '../src/types';
const source=(name:string)=>readFileSync(`tests/layout-variations/${name}.html`,'utf8').match(/const source = `([\s\S]*?)`/)![1]!;

const crosses=(a:Point,b:Point,n:GeometryNode)=>a.x===b.x
 ? a.x>n.x&&a.x<n.x+n.width&&Math.max(a.y,b.y)>n.y&&Math.min(a.y,b.y)<n.y+n.height
 : a.y===b.y&&a.y>n.y&&a.y<n.y+n.height&&Math.max(a.x,b.x)>n.x&&Math.min(a.x,b.x)<n.x+n.width;

it('routes an external transition outside an unrelated composite even after manual placement',()=>{
 const text=source('13-state-regions'),i=createFinch().render(text,{editor:false});
 const check=()=>{
  const owner=i.geometry.nodes.find(n=>n.id==='session')!;
  const edge=i.geometry.edges.find(e=>e.from==='suspended'&&e.to==='ready')!;
  expect(edge.points.slice(1).some((b,k)=>crosses(edge.points[k]!,b,owner))).toBe(false);
  expect(i.geometry.edges.filter(e=>e.from==='suspended'&&e.to==='session')).toHaveLength(1);
  expect(i.geometry.edges.filter(e=>e.from==='session'&&e.to==='suspended')).toHaveLength(1);
 };
 check();
 const owner=i.geometry.nodes.find(n=>n.id==='session')!;
 i.importLayout({version:1,nodes:{suspended:{x:owner.x+owner.width/2-50,y:owner.y+owner.height+120,manual:true,pinned:true}}});
 check();rerouteGeometry(i.geometry);check();i.setTheme('midnight');check();i.update(text);check();i.destroy();
});

it('allows internal transitions inside their own composite',()=>{
 const i=createFinch().render(source('13-state-regions'),{editor:false});
 const owner=i.geometry.nodes.find(n=>n.id==='session')!;
 for(const edge of i.geometry.edges.filter(e=>['editing','validating','saving'].includes(e.from)&&['editing','validating','saving'].includes(e.to))){
  expect(edge.points.every(p=>p.x>=owner.x&&p.x<=owner.x+owner.width&&p.y>=owner.y&&p.y<=owner.y+owner.height)).toBe(true);
 }i.destroy();
});

it('separates shared model references and preserves containment after theme and overlay round trips',()=>{
 const text=source('11-four-namespaces'),i=createFinch().render(text,{editor:false});
 const check=()=>{
  const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
  expect(n('model').x).toBeGreaterThan(n('application').x+n('application').width);
  expect(n('persistence').y).toBeGreaterThan(n('application').y+n('application').height);
  for(const child of i.geometry.nodes.filter(n=>n.parentId)){
   const p=n(child.parentId!);expect(child.x).toBeGreaterThanOrEqual(p.x);expect(child.x+child.width).toBeLessThanOrEqual(p.x+p.width);
   expect(child.y).toBeGreaterThanOrEqual(p.y);expect(child.y+child.height).toBeLessThanOrEqual(p.y+p.height);
  }
  expect(i.geometry.edges).toHaveLength(10);
 };
 check();i.setTheme('midnight');check();i.importLayout(i.exportLayout());check();i.update(text);check();i.destroy();
});

it('keeps cyclic states together and moves their exit chain beside them without deleting transitions',()=>{
 const i=createFinch().render(source('12-state-branches'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('stopped').x).toBeGreaterThan(n('online').x+n('online').width);
 expect(n('online').x).toBe(n('offline').x);
 expect(i.geometry.edges).toHaveLength(11);
 expect(i.geometry.edges.filter(e=>e.from==='online'&&e.to==='online')).toHaveLength(1);i.destroy();
});

it('uses orientation candidates for shared consumers without changing relation endpoints',()=>{
 const text=source('09-consumers'),i=createFinch().render(text,{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('Document').y).toBe(n('Report').y);expect(n('Report').y).toBe(n('Page').y);
 expect(n('Checkout').x).not.toBe(n('ExportJob').x);
 expect(i.geometry.edges).toHaveLength(11);
 expect(i.geometry.edges.some(e=>e.from==='Report'&&e.to==='Document')).toBe(true);
 expect(i.geometry.edges.some(e=>e.from==='SqlStore'&&e.to==='Store')).toBe(true);
 i.importLayout({version:1,nodes:{ExportJob:{x:950,y:900,manual:true,pinned:true}}});i.update(text);
 expect(n('ExportJob')).toMatchObject({x:950,y:900});i.destroy();
});

it('places shared monitoring beside the main deployment chain and keeps every edge',()=>{
 const i=createFinch().render(source('14-four-domains'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('ingress').x+n('ingress').width).toBeLessThan(n('app').x);
 expect(n('app').x+n('app').width).toBeLessThan(n('data').x);
 expect(n('ops').y).toBeGreaterThan(Math.max(...['ingress','app','data'].map(id=>n(id).y+n(id).height)));
 expect(i.geometry.edges).toHaveLength(12);i.destroy();
});
