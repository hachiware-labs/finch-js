// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {createFinch} from '../src/index';
import {arrangeStateAxis,arrangeThreeBlocks} from '../src/semantic-arrangement';
import type {GeometryNode,LayoutModel} from '../src/types';
const sourceFor=(name:string)=>readFileSync(`tests/layout-variations/${name}.html`,'utf8').match(/const source = `([\s\S]*?)`/)![1]!;

it('keeps linked families adjacent and places their shared consumer below',()=>{
 // Deliberately interleave the declarations; labels must not determine the arrangement.
 const source=`@class
class Base
class Entity
class Part
interface Sender
class Dispatch
interface Storage
class Adapter
class Client
Entity --|> Base
Entity *-- Part
Dispatch ..|> Sender
Adapter ..|> Storage
Adapter ..> Entity
Client ..> Entity
Client ..> Sender
Client ..> Storage`;
 const i=createFinch().render(source,{editor:false});
 const check=()=>{
  const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
  const order=['Base','Storage','Sender'].sort((a,b)=>n(a).x-n(b).x);
  expect(Math.abs(order.indexOf('Base')-order.indexOf('Storage'))).toBe(1);
  expect(n('Client').y).toBeGreaterThan(Math.max(n('Adapter').y+n('Adapter').height,n('Dispatch').y+n('Dispatch').height));
  expect(i.geometry.edges).toHaveLength(8);
 };
 check();i.setTheme('midnight');check();i.update(source);check();i.importLayout(i.exportLayout());check();
 i.importLayout({version:1,nodes:{Client:{x:850,y:900,manual:true,pinned:true}}});
 i.update(source);expect(i.geometry.nodes.find(n=>n.id==='Client')).toMatchObject({x:850,y:900});i.destroy();
});

it('does not invent a preferred state path when equally short alternatives exist',()=>{
 const nodes:GeometryNode[]=['s','a','b','f'].map((id,index)=>({id,label:id,shape:index===0?'initial-state':index===3?'final-state':'rounded',attributes:{},x:index*110,y:index*70,width:80,height:40}));
 const model:LayoutModel={kind:'state',direction:'down',minimumGap:24,items:nodes.map(n=>({...n,size:{width:n.width,height:n.height}})),groups:[],connections:[['s','a'],['s','b'],['a','f'],['b','f']].map(([from,to],index)=>({id:String(index),from:from!,to:to!,attributes:{},dashed:false,order:index}))};
 const before=JSON.stringify(nodes);arrangeStateAxis(nodes,model);expect(JSON.stringify(nodes)).toBe(before);
});

it('leaves explicitly arranged blocks untouched',()=>{
 const nodes:GeometryNode[]=['one','two','three'].map((id,index)=>({id,label:id,shape:'container',attributes:index===0?{layout:'column'}:{},x:0,y:index*100,width:80,height:60}));
 const model:LayoutModel={kind:'deployment',direction:'right',minimumGap:24,items:nodes.map(n=>({...n,size:{width:n.width,height:n.height}})),groups:[],connections:[['one','two'],['one','three'],['two','three']].map(([from,to],index)=>({id:String(index),from:from!,to:to!,attributes:{},dashed:false,order:index}))};
 let moved=false;expect(arrangeThreeBlocks(nodes,model,id=>id,()=>{moved=true;})).toBe(false);expect(moved).toBe(false);
});

it('keeps sibling implementations between their common parent and consumers',()=>{
 const i=createFinch().render(sourceFor('02-fanout'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 const children=['Csv','Json','Xml','Pdf','Html'].map(n);
 expect(new Set(children.map(n=>n.y)).size).toBe(1);
 expect(n('Plugin').y+n('Plugin').height).toBeLessThan(children[0]!.y);
 expect(n('Registry').y).toBeGreaterThan(children[0]!.y+children[0]!.height);
 expect(i.geometry.edges).toHaveLength(10);i.destroy();
});

it('wraps complete families and preserves manual positions through updates',()=>{
 const source=sourceFor('05-wide-families'),i=createFinch().render(source,{editor:false});
 const check=()=>{
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 for(const id of ['A','B','C','D','E']){
  expect(n(id).x+n(id).width/2).toBe(n(id+'1').x+n(id+'1').width/2);
  expect(n(id).y+n(id).height).toBeLessThan(n(id+'1').y);
 }
 expect(n('E').y).toBeGreaterThan(n('A1').y+n('A1').height);
 expect(n('E').x).toBeGreaterThan(n('A').x);
 };
 check();i.setTheme('midnight');check();i.update(source);check();
 i.importLayout({version:1,nodes:{E1:{x:850,y:900,manual:true,pinned:true}}});
 i.update(source);expect(i.geometry.nodes.find(n=>n.id==='E1')).toMatchObject({x:850,y:900});i.destroy();
});

it('uses two dimensions for three mutually linked namespaces',()=>{
 const i=createFinch().render(sourceFor('04-namespaces'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('ui').y).toBe(n('domain').y);
 expect(n('ui').x+n('ui').width).toBeLessThan(n('domain').x);
 expect(n('storage').y).toBeGreaterThan(n('domain').y+n('domain').height);
 for(const node of i.geometry.nodes.filter(n=>n.parentId)){
  const parent=n(node.parentId!);expect(node.x).toBeGreaterThanOrEqual(parent.x);
  expect(node.x+node.width).toBeLessThanOrEqual(parent.x+parent.width);
  expect(node.y+node.height).toBeLessThanOrEqual(parent.y+parent.height);
 }i.destroy();
});

it('keeps the state axis and distinct transitions while placing return branches to its sides',()=>{
 const i=createFinch().render(sourceFor('07-state'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(new Set(['begin','idle','active','done'].map(id=>n(id).x+n(id).width/2)).size).toBe(1);
 expect(n('failed').x+n('failed').width).toBeLessThan(n('active').x);
 expect(n('paused').x).toBeGreaterThan(n('active').x+n('active').width);
 expect(i.geometry.edges).toHaveLength(9);
 expect(i.geometry.edges.filter(e=>e.from==='active'&&e.to==='active')).toHaveLength(1);i.destroy();
});

it('places a deployment receiver beside the other blocks with vertically exposed children',()=>{
 const i=createFinch().render(sourceFor('08-deployment'),{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('ops').y).toBeGreaterThan(n('app').y+n('app').height);
 expect(n('data').x).toBeGreaterThan(n('app').x+n('app').width);
 expect(n('data').x).toBeGreaterThan(n('ops').x+n('ops').width);
 expect(n('queue').x).toBe(n('db').x);
 expect(n('queue').y+n('queue').height).toBeLessThan(n('db').y);
 expect(i.geometry.edges).toHaveLength(8);i.destroy();
});
// Rendering validity only; visual quality is reviewed separately.
for(const file of readdirSync('tests/layout-variations').filter(f=>/^\d.*\.html$/.test(f))){
 it(`renders the unadjusted variation ${file}`,()=>{
 const html=readFileSync(`tests/layout-variations/${file}`,'utf8');
 const source=html.match(/const source = `([\s\S]*?)`/)![1]!;
 const i=createFinch().render(source,{editor:false});
 expect(i.geometry.nodes.length).toBeGreaterThan(0);
 for(const n of i.geometry.nodes)expect([n.x,n.y,n.width,n.height].every(Number.isFinite)).toBe(true);
 for(const e of i.geometry.edges)expect(e.points.length).toBeGreaterThanOrEqual(2);
 i.destroy();
 });
}
