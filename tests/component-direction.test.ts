// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';

it('retains component direction and pinned coordinates through saving and forced relayout',()=>{
 for(const kind of ['component','deployment'])for(const nested of [false,true]){
  document.body.innerHTML='<div id="diagram"></div><div id="restored"></div>';
  const source=`@${kind}\ntop to bottom direction\n${nested?'package group {\n':''}component A\ncomponent B\nA -> B${nested?'\n}':''}`;
  const finch=createFinch(),instance=finch.render(source,{target:'#diagram',editor:false});
  instance.importLayout({version:1,diagram:kind,nodes:{A:{x:321,y:123,manual:true,pinned:true}}});
  instance.autoLayout();
  expect(instance.geometry.nodes.find(n=>n.id==='A')).toMatchObject({x:321,y:123});
  expect(instance.geometry.direction).toBe('down');
  const saved=instance.exportState(),layout=instance.exportLayout();
  const restored=finch.render(saved.source,{target:'#restored',editor:false});
  restored.importLayout(layout);
  expect(restored.geometry.direction).toBe('down');
  expect(restored.geometry.nodes.find(n=>n.id==='A')).toMatchObject({x:321,y:123});
  expect(restored.isPinned('A')).toBe(true);
  restored.update(saved.source.replace('top to bottom','left to right'));
  expect(restored.geometry.nodes.find(n=>n.id==='A')).toMatchObject({x:321,y:123});
  restored.autoLayout({preservePinned:false});
  const a=restored.geometry.nodes.find(n=>n.id==='A')!,b=restored.geometry.nodes.find(n=>n.id==='B')!;
  expect(restored.geometry.direction).toBe('right');
  expect(b.x).toBeGreaterThanOrEqual(a.x+a.width);
  restored.update(saved.source);restored.resetLayout();
  const va=restored.geometry.nodes.find(n=>n.id==='A')!,vb=restored.geometry.nodes.find(n=>n.id==='B')!;
  expect(restored.geometry.direction).toBe('down');
  expect(vb.y).toBeGreaterThanOrEqual(va.y+va.height);
  instance.destroy();restored.destroy();
 }
});

it('places endpoints according to directional arrows without reversing message semantics',()=>{
 for(const direction of ['left','right','up','down','l','ri','u','do'])for(const reverse of [false,true]){
  document.body.innerHTML='<div id="diagram"></div>';
  const instance=createFinch().render(`@component\ncomponent A\ncomponent B\nA ${reverse?'<-':'-'}${direction}-${reverse?'':'>'} B`,{target:'#diagram',editor:false});
  const a=instance.geometry.nodes.find(n=>n.id==='A')!,b=instance.geometry.nodes.find(n=>n.id==='B')!;
  if(direction.startsWith('l'))expect(a.x).toBeGreaterThan(b.x+b.width);
  if(direction.startsWith('r'))expect(b.x).toBeGreaterThan(a.x+a.width);
  if(direction.startsWith('u'))expect(a.y).toBeGreaterThan(b.y+b.height);
  if(direction.startsWith('d'))expect(b.y).toBeGreaterThan(a.y+a.height);
  expect(instance.geometry.edges[0]).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B'});
  instance.destroy();
 }
});

it('moves sibling groups as units for cross-group direction hints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\npackage one {\ncomponent A\ncomponent C\n}\npackage two {\ncomponent B\ncomponent D\n}\nA -left-> B';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const nodes=instance.geometry.nodes,one=nodes.find(n=>n.id==='one')!,two=nodes.find(n=>n.id==='two')!;
 expect(one.x).toBeGreaterThan(two.x+two.width);
 expect(Math.min(...nodes.map(n=>n.x))).toBe(28);
 expect(Math.min(...nodes.map(n=>n.y))).toBe(28);
 for(const node of nodes.filter(n=>n.parentId)){
  const group=nodes.find(n=>n.id===node.parentId)!;
  expect(node.x).toBeGreaterThanOrEqual(group.x);
  expect(node.x+node.width).toBeLessThanOrEqual(group.x+group.width);
 }
 const a=nodes.find(n=>n.id==='A')!;
 instance.importLayout({version:1,diagram:'component',nodes:{A:{x:a.x,y:a.y,manual:true,pinned:true}}});
 instance.autoLayout();
 expect(instance.geometry.nodes.find(n=>n.id==='A')).toMatchObject({x:a.x,y:a.y});
 instance.destroy();
});

it('retains reduced obstacle clearance when a reverse cross-group route is crowded',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\npackage frontend {\ncomponent A "Order service" <<public>>\ncomponent C "Checkout"\n}\npackage backend {\ncomponent B "Billing service"\ncomponent D "Ledger"\n}\nA -left-> B: request\nC -> D: persist',{target:'#diagram',editor:false});
 for(const edge of instance.geometry.edges){
  for(const node of instance.geometry.nodes.filter(n=>n.shape!=='container'&&n.id!==edge.from&&n.id!==edge.to)){
   for(let i=1;i<edge.points.length;i++){
    const a=edge.points[i-1]!,b=edge.points[i]!;
    const intersects=a.x===b.x
      ? a.x>node.x-5&&a.x<node.x+node.width+5&&Math.min(a.y,b.y)<node.y+node.height+5&&Math.max(a.y,b.y)>node.y-5
      : a.y>node.y-5&&a.y<node.y+node.height+5&&Math.min(a.x,b.x)<node.x+node.width+5&&Math.max(a.x,b.x)>node.x-5;
    expect(intersects).toBe(false);
   }
  }
 }
 instance.destroy();
});

it('keeps input and output ports on component boundaries after rerouting',async()=>{
 const {rerouteGeometry}=await import('../src/layouts');
 for(const vertical of [false,true]){
  document.body.innerHTML='<div id="diagram"></div>';
  const source=`@component\n${vertical?'top to bottom direction':'left to right direction'}\ncomponent system {\nportin input\nportout output\ncomponent worker\ninput -> worker\nworker -> output\n}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const check=()=>{
   const owner=instance.geometry.nodes.find(n=>n.id==='system')!;
   for(const id of ['input','output']){
    const port=instance.geometry.nodes.find(n=>n.id===id)!;
    expect(port.attributes.boundaryPort).toBe('true');
    if(vertical)expect(port.y+13).toBe(owner.y+(id==='output'?owner.height:0));
    else expect(port.x+port.width/2).toBe(owner.x+(id==='output'?owner.width:0));
   }
  };
  check();const owner=instance.geometry.nodes.find(n=>n.id==='system')!;owner.x+=80;owner.y+=40;rerouteGeometry(instance.geometry);check();
  const size={width:owner.width,height:owner.height};rerouteGeometry(instance.geometry);expect({width:owner.width,height:owner.height}).toEqual(size);
  instance.destroy();
 }
});

it('connects external and internal edges to opposite faces of a boundary port',()=>{
 for(const vertical of [false,true])for(const portKind of ['portin','portout']){
  document.body.innerHTML='<div id="diagram"></div>';
  const instance=createFinch().render(`@component\n${vertical?'top to bottom direction':'left to right direction'}\ncomponent outside\ncomponent system {\n${portKind} p\ncomponent worker\n}\noutside -> p\np -> worker`,{target:'#diagram',editor:false});
  const port=instance.geometry.nodes.find(n=>n.id==='p')!,edges=instance.geometry.edges;
  const external=edges[0]!.points[edges[0]!.points.length-1]!,internal=edges[1]!.points[0]!;
  const out=portKind==='portout';
  if(vertical){expect(external.y).toBe(port.y+(out?24:2));expect(internal.y).toBe(port.y+(out?2:24));}
  else{expect(external.x).toBe(port.x+port.width/2+(out?11:-11));expect(internal.x).toBe(port.x+port.width/2+(out?-11:11));}
  instance.destroy();
 }
});

it('renders wrapped port names while keeping connectors on the square',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ncomponent system {\nportin input "Incoming customer requests"\ncomponent worker\ninput -> worker\n}',{target:'#diagram',editor:false});
 const port=instance.geometry.nodes.find(n=>n.id==='input')!;
 expect(port.width).toBeGreaterThan(26);
 expect(instance.svg.querySelector('.finch-port-label')!.textContent).toContain('Incoming');
 const first=instance.geometry.edges[0]!.points[0]!;
 expect(first.x).toBe(port.x+port.width/2+11);
 expect(first.y).toBe(port.y+13);
 instance.destroy();
});

it('reserves enough boundary length for multiple named ports in both directions',async()=>{
 const {rerouteGeometry}=await import('../src/layouts');
 for(const vertical of [false,true]){
  document.body.innerHTML='<div id="diagram"></div>';
  const source=`@component\n${vertical?'top to bottom direction':'left to right direction'}\ncomponent outer {\ncomponent system {\n${Array.from({length:4},(_,i)=>`portin p${i} "Incoming customer requests ${i}"`).join('\n')}\ncomponent worker\n}\n}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const ports=instance.geometry.nodes.filter(n=>n.attributes.boundaryPort==='true');
  for(let i=1;i<ports.length;i++){
   const a=ports[i-1]!,b=ports[i]!;
   if(vertical)expect(b.x).toBeGreaterThan(a.x+a.width);
   else expect(b.y).toBeGreaterThan(a.y+a.height);
  }
  const system=instance.geometry.nodes.find(n=>n.id==='system')!,outer=instance.geometry.nodes.find(n=>n.id==='outer')!;
  expect(system.x+system.width).toBeLessThanOrEqual(outer.x+outer.width);
  expect(system.y+system.height).toBeLessThanOrEqual(outer.y+outer.height);
  const sizes=instance.geometry.nodes.map(n=>[n.width,n.height]);rerouteGeometry(instance.geometry);
  expect(instance.geometry.nodes.map(n=>[n.width,n.height])).toEqual(sizes);
  instance.destroy();
 }
});

it('infers neutral port sides from external connections and follows source updates',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent outside\ncomponent system {\nport p\ncomponent nested {\ncomponent worker\n}\np -> worker\n}\n';
 const instance=createFinch().render(source+'outside -> p',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='p')!.attributes.resolvedPortDirection).toBe('in');
 instance.update(source+'p -> outside');
 const port=instance.geometry.nodes.find(n=>n.id==='p')!,owner=instance.geometry.nodes.find(n=>n.id==='system')!;
 expect(port.attributes.resolvedPortDirection).toBe('out');
 expect(port.x+port.width/2).toBe(owner.x+owner.width);
 instance.destroy();
});

it('separates neighboring groups after port labels enlarge their boundary',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ntop to bottom direction\ncomponent ports {\nportin a "Customer request input"\nportin b "Account request input"\nportin c "Payment request input"\ncomponent worker\n}\ncomponent other {\ncomponent service\n}';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const check=()=>{
  const a=instance.geometry.nodes.find(n=>n.id==='ports')!,b=instance.geometry.nodes.find(n=>n.id==='other')!;
  expect(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y).toBe(true);
 };
 check();instance.autoLayout();check();instance.setTheme('midnight');check();
 instance.destroy();
});

it('combines dashed relations with directional placement and reverse arrows',()=>{
 for(const reverse of [false,true])for(const direction of ['left','right','up','down']){
  document.body.innerHTML='<div id="diagram"></div>';
  const instance=createFinch().render(`@component\ncomponent A\ncomponent B\nA${reverse?'<.':'.'}${direction}.${reverse?'':'>'}B: depends\nnote on link: Dependency`,{target:'#diagram',editor:false});
  const edge=instance.model.connections[0]!;
  expect(edge).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B',dashed:true,attributes:{layoutDirection:direction}});
  expect(instance.geometry.nodes.some(n=>n.attributes.annotationTarget===edge.id)).toBe(true);
  const a=instance.geometry.nodes.find(n=>n.id==='A')!,b=instance.geometry.nodes.find(n=>n.id==='B')!;
  if(direction==='left')expect(a.x).toBeGreaterThan(b.x+b.width);
  if(direction==='right')expect(b.x).toBeGreaterThan(a.x+a.width);
  if(direction==='up')expect(a.y).toBeGreaterThan(b.y+b.height);
  if(direction==='down')expect(b.y).toBeGreaterThan(a.y+a.height);
  instance.destroy();
 }
});

it('places vertical port labels beside the connector instead of across its line',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ntop to bottom direction\ncomponent system {\nportin input "Incoming customer requests awaiting validation"\ncomponent worker\ninput -> worker\n}',{target:'#diagram',editor:false});
 const port=instance.geometry.nodes.find(n=>n.id==='input')!,label=instance.svg.querySelector('.finch-port-label')!;
 expect(label.getAttribute('text-anchor')).toBe('end');
 expect(Number(label.getAttribute('y'))).toBeGreaterThan(24);
 expect(Number(label.getAttribute('x'))).toBeLessThan(port.width/2-11);
 expect(instance.geometry.edges[0]!.points[0]!.x).toBe(port.x+port.width/2);
 expect(instance.geometry.nodes.find(n=>n.id==='worker')!.y).toBeGreaterThan(port.y+port.height);
 instance.destroy();
});

it('does not detour past a nearby output port when straight approaches share a short gap',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ntop to bottom direction\ncomponent system {\nportin input "Incoming customer requests awaiting authentication and validation"\nportout output "Completed results"\ncomponent worker\ninput -> worker\nworker -> output\n}',{target:'#diagram',editor:false});
 const edge=instance.geometry.edges.find(e=>e.to==='output')!,start=edge.points[0]!,end=edge.points[edge.points.length-1]!;
 expect(edge.points.every(p=>p.y>=start.y && p.y<=end.y)).toBe(true);
 instance.destroy();
});

it('uses a single clear elbow for perpendicular ports without a short backtrack',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ncomponent A\ncomponent B\nA -> B [fromPort=right toPort=top]',{target:'#diagram',editor:false});
 const a=instance.geometry.nodes.find(n=>n.id==='A')!,b=instance.geometry.nodes.find(n=>n.id==='B')!;
 instance.importLayout({version:1,diagram:'component',nodes:{A:{x:100,y:100,manual:true,pinned:false},B:{x:100+a.width+20-b.width/2,y:230,manual:true,pinned:false}}});
 const points=instance.geometry.edges[0]!.points;
 expect(points).toHaveLength(3);
 expect(points[1]).toEqual({x:points[2]!.x,y:points[0]!.y});
 expect(points[1]!.x).toBeGreaterThan(points[0]!.x);
 instance.destroy();
});
