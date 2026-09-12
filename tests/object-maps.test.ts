// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseObject} from '../src/index';
import {rerouteGeometry} from '../src/layouts';
const source=`@object
map cities "Capital cities" {
 UK *-> london
 USA => Washington
 empty =>
}
object london "London : City" {
 population = 9000000
}
object visitor "Visitor"
visitor --> cities::USA: lookup`;
it('preserves map values and links to individual rows',()=>{
 const model=parseObject(source);
 expect(JSON.parse(model.nodes[0]!.attributes.mapEntries!)).toEqual([{key:'UK',value:''},{key:'USA',value:'Washington'},{key:'empty',value:''}]);
 expect(model.nodes[0]!.shape).toBe('uml-map');
 expect(model.connections.find(e=>e.from==='visitor')?.attributes?.toMapRow).toBe('1');
 expect(model.connections.find(e=>e.to==='london')?.attributes?.fromMapRow).toBe('0');
});
it('routes at the displayed row centers before and after dragging',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const check=()=>{
  const map=instance.geometry.nodes.find(n=>n.id==='cities')!;
  const outgoing=instance.geometry.edges.find(e=>e.to==='london')!;
  const incoming=instance.geometry.edges.find(e=>e.from==='visitor')!;
  expect(outgoing.points[0]!.y).toBe(map.y+56);
  expect(incoming.points[incoming.points.length-1]!.y).toBe(map.y+84);
 };
 check();
 const map=instance.geometry.nodes.find(n=>n.id==='cities')!;
 map.x+=150;map.y+=90;rerouteGeometry(instance.geometry);check();
 expect(document.body.textContent).toContain('Washington');
});
it('rejects invalid rows, duplicate keys and unresolved references',()=>{
 for(const body of ['A => 1\nA => 2','A invalid','A *-> missing'])expect(()=>parseObject(`@object\nmap m {\n${body}\n}`)).toThrow();
 expect(()=>parseObject(source+'\nvisitor --> cities::missing')).toThrow(/Unknown map entry/);
 expect(()=>parseObject('@object\nmap m {')).toThrow(/Unclosed/);
});

it('supports links between two rows of the same map',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@object\nmap m {\na => one\nb => two\n}\nm::a --> m::b',{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;const edge=instance.geometry.edges[0]!;
 expect(edge.points[0]!.y).toBe(node.y+56);
 expect(edge.points[edge.points.length-1]!.y).toBe(node.y+84);
});

it('renders compact empty maps as connected PERT endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@object\nmap kickoff "Kick off" {}\nmap finish {}\nkickoff --> finish: complete';
 const model=parseObject(source);
 expect(model.nodes.map(n=>n.shape)).toEqual(['uml-map','uml-map']);
 expect(model.nodes.map(n=>JSON.parse(n.attributes.mapEntries!))).toEqual([[],[]]);
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.edges).toHaveLength(1);
 expect(instance.svg.outerHTML).toContain('Kick off');
 instance.destroy();
 expect(()=>parseObject(source+'\nmap kickoff {}')).toThrow(/Duplicate map/);
});

it('routes reversed map relations to their original row endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const operator of ['<--','<..','--*','..*','--o','..o']){
  const instance=createFinch().render(`@object\nmap left {\n first => one\n second => two\n}\nmap right {\n first => one\n}\nleft::second ${operator} right::first`,{target:'#diagram',editor:false});
  const edge=instance.geometry.edges[0]!,left=instance.geometry.nodes.find(n=>n.id==='left')!,right=instance.geometry.nodes.find(n=>n.id==='right')!;
  expect(edge).toMatchObject({from:'right',to:'left',attributes:{fromMapRow:'0',toMapRow:'1'}});
  expect(edge.points[0]!.y).toBe(right.y+56);
  expect(edge.points.slice(-1)[0]!.y).toBe(left.y+84);
  left.y+=50;rerouteGeometry(instance.geometry);
  expect(instance.geometry.edges[0]!.points.slice(-1)[0]!.y).toBe(left.y+84);
  instance.destroy();
 }
});

it('combines row endpoints with multiplicities and reverse relations',()=>{
 const source='@object\nmap parts {\n primary => item\n}\nmap owners {\n first => one\n second => two\n}\nparts::primary "many" --* "1" owners::second: ownership [id=ownership]';
 const model=parseObject(source);
 expect(model.connections[0]).toMatchObject({id:'ownership',from:'owners',to:'parts',label:'ownership',attributes:{fromMapRow:'1',toMapRow:'0',fromCardinality:'1',toCardinality:'many'}});
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edge=instance.geometry.edges[0]!,owner=instance.geometry.nodes.find(n=>n.id==='owners')!;
 expect(edge.points[0]!.y).toBe(owner.y+84);
 expect(instance.svg.textContent).toContain('many');
 instance.destroy();
});


it('preserves destructor targets when a map row is the other endpoint',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const relation of ['registry::resource --> Resource::~Resource()','Resource::~Resource() <-- registry::resource']){
  const instance=createFinch().render('@class\nmap registry {\nresource => active\n}\nclass Resource {\n \\~Resource()\n}\n'+relation,{target:'#diagram',editor:false});
  const check=()=>{
   const edge=instance.geometry.edges[0]!;
   const map=instance.geometry.nodes.find(n=>n.id==='registry')!;
   expect(edge).toMatchObject({from:'registry',to:'Resource',attributes:{fromMapRow:'0',toMember:'~Resource()',toMemberIndex:'0'}});
   expect(edge.points[0]!.y).toBe(map.y+56);
  };
  check();
  instance.geometry.nodes.find(n=>n.id==='registry')!.y+=100;
  rerouteGeometry(instance.geometry);check();
  instance.destroy();
 }
});


it('attaches provided interfaces to their small circle after rerouting',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@class\n() API\nclass Service\nAPI -- Service',{target:'#diagram',editor:false});
 const check=()=>{
  const node=instance.geometry.nodes.find(n=>n.id==='API')!,p=instance.geometry.edges[0]!.points[0]!;
  expect(Math.hypot(p.x-node.x-node.width/2,p.y-node.y-14)).toBeCloseTo(10);
  expect(p.y).toBeLessThan(node.y+25);
 };
 check();instance.geometry.nodes.find(n=>n.id==='API')!.x+=80;rerouteGeometry(instance.geometry);check();instance.destroy();
});


it('keeps self-relations and multiple links on the provided-interface circle',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@class\n() API "Shared API"\nclass A\nclass B\nAPI -- API: recursive\nAPI -- A\nAPI -- B',{target:'#diagram',editor:false});
 const check=()=>{
  const node=instance.geometry.nodes.find(n=>n.id==='API')!;
  for(const edge of instance.geometry.edges){
   const endpoints=[edge.points[0]!,...(edge.to==='API'?[edge.points[edge.points.length-1]!]:[])];
   for(const p of endpoints)expect(Math.hypot(p.x-node.x-node.width/2,p.y-node.y-14)).toBeCloseTo(10);
  }
  const loop=instance.geometry.edges.find(e=>e.from===e.to)!;
  expect(loop.points.some(p=>p.y<node.y)).toBe(true);
  expect(loop.points.every(p=>p.y<node.y+25)).toBe(true);
 };
 check();instance.geometry.nodes.find(n=>n.id==='API')!.x+=75;rerouteGeometry(instance.geometry);check();instance.destroy();
});


it('uses the same provided-interface circle in component and deployment diagrams',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment']){
  const instance=createFinch().render(`@${kind}\nprovided api "Public API"\ncomponent service "Service"\nservice -> api`,{target:'#diagram',editor:false});
  const check=()=>{
   const node=instance.geometry.nodes.find(n=>n.id==='api')!;
   expect(node.shape).toBe('uml-provided-interface');
   const edge=instance.geometry.edges[0]!,p=edge.points[edge.points.length-1]!;
   expect(Math.hypot(p.x-node.x-node.width/2,p.y-node.y-14)).toBeCloseTo(10);
  };
  check();instance.geometry.nodes.find(n=>n.id==='api')!.y+=80;rerouteGeometry(instance.geometry);check();
  instance.setTheme('midnight');
  expect(instance.svg.querySelector('[data-node-id="api"] circle')?.getAttribute('r')).toBe('10');
  instance.destroy();
 }
});


it('respects explicit provided-interface ports instead of applying label-avoidance defaults',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const reverse of [false,true]){
  const relation=reverse?'service -> api: uses [fromPort=left toPort=bottom]':'api -> service: serves [fromPort=bottom toPort=left]';
  const instance=createFinch().render('@component\nprovided api "API"\ncomponent service "Service"\n'+relation,{target:'#diagram',editor:false});
  const check=()=>{
   const api=instance.geometry.nodes.find(n=>n.id==='api')!,service=instance.geometry.nodes.find(n=>n.id==='service')!;
   const edge=instance.geometry.edges[0]!,first=edge.points[0]!,last=edge.points[edge.points.length-1]!;
   const circle=reverse?last:first,box=reverse?first:last;
   expect(circle).toEqual({x:api.x+api.width/2,y:api.y+24});
   expect(box.x).toBe(service.x);
  };
  check();instance.geometry.nodes.find(n=>n.id==='api')!.y+=60;rerouteGeometry(instance.geometry);check();instance.destroy();
 }
});

it('attaches required-interface links to the arc after moving and changing theme',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment'])for(const side of ['left','right','top']){
  const instance=createFinch().render(`@${kind}\ncomponent service\nrequired api "Required API" [opening=bottom]\nservice -> api [toPort=${side}]`,{target:'#diagram',editor:false});
  const check=()=>{
   const node=instance.geometry.nodes.find(n=>n.id==='api')!;
   const points=instance.geometry.edges[0]!.points,p=points[points.length-1]!;
   expect(p).toEqual({x:node.x+node.width/2+(side==='left'?-18:side==='right'?18:0),y:node.y+(side==='top'?4:22)});
  };
  check();instance.geometry.nodes.find(n=>n.id==='api')!.y+=80;rerouteGeometry(instance.geometry);check();
  instance.setTheme('midnight');check();instance.destroy();
 }
});

it('rotates a required interface when its neighbor moves and updates its SVG arc',async()=>{
 const {SvgRenderer}=await import('../src/renderer');
 const {defaultTheme}=await import('../src/theme');
 const {builtInShapes}=await import('../src/shapes');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ncomponent service\nrequired api "API"\nservice -- api',{target:'#diagram',editor:false});
 const renderer=new SvgRenderer(document,defaultTheme,name=>builtInShapes.find(shape=>shape.name===name)!,'interfaces');
 renderer.draw(instance.geometry);
 const api=instance.geometry.nodes.find(node=>node.id==='api')!,service=instance.geometry.nodes.find(node=>node.id==='service')!;
 api.x=400;api.y=200;
 for(const left of [true,false]){
  service.x=left?100:700;service.y=200;
  rerouteGeometry(instance.geometry);renderer.updateGeometry(instance.geometry);
  expect(api.attributes.interfaceOpening).toBe(left?'right':'left');
  const points=instance.geometry.edges[0]!.points,p=points[points.length-1]!;
  expect(p).toEqual({x:api.x+api.width/2+(left?-18:18),y:api.y+22});
  const arc=renderer.svg.querySelector('.finch-required-interface-arc')!;
  expect(arc.getAttribute('d')).toBe(left?`M ${api.width/2} 40 A 18 18 0 0 1 ${api.width/2} 4`:`M ${api.width/2} 4 A 18 18 0 0 1 ${api.width/2} 40`);
 }
 instance.destroy();
});

it('keeps explicit socket openings and every cardinal port on the visible semicircle',async()=>{
 const {requiredInterfacePort}=await import('../src/interface-geometry');
 document.body.innerHTML='<div id="diagram"></div>';
 for(const opening of ['left','right','top','bottom']){
  const instance=createFinch().render(`@component\nrequired api "API" [opening=${opening}]`,{target:'#diagram',editor:false});
  const node=instance.geometry.nodes[0]!;
  for(const side of ['left','right','top','bottom'] as const){
   const p=requiredInterfacePort(node,side),x=p.x-node.x-node.width/2,y=p.y-node.y-22;
   expect(Math.hypot(x,y)).toBeCloseTo(18);
   expect(opening==='left'?x>=0:opening==='right'?x<=0:opening==='top'?y>=0:y<=0).toBe(true);
  }
  instance.destroy();
 }
});
