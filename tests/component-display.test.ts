// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch,parseDeployment} from '../src/index';
import {SvgRenderer} from '../src/renderer';
import {builtInShapes} from '../src/shapes';
import {defaultTheme} from '../src/theme';

it('shares icons and images with collection, stack and person shapes',()=>{
 for(const shape of ['collections','stack','person']){
  const source=`@deployment\n${shape} Icon "Owner" [icon=server tone=green]\n${shape} Image "Photo" [image=./avatar.png]`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(2);
  expect(instance.svg.querySelector('image')?.getAttribute('href')).toBe(new URL('./avatar.png', document.baseURI).href);
  instance.setTheme('midnight');
  expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(2);
  instance.update(source.replace('[icon=server tone=green]','[tone=green]'));
  expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(1);
  instance.destroy();
 }
});

it('attaches person self-relations to the body and head after moving',()=>{
 const instance=createFinch().render('@deployment\nperson User\nUser -> User: review',{editor:false});
 const verify=()=>{
  const node=instance.geometry.nodes[0]!,points=instance.geometry.edges[0]!.points;
  expect(points[0]).toEqual({x:node.x+node.width,y:node.y+32+(node.height-32)/2});
  expect(points[points.length-1]).toEqual({x:node.x+node.width/2,y:node.y});
 };
 verify();
 instance.importLayout({version:1,diagram:'deployment',nodes:{User:{x:360,y:240,manual:true,pinned:true}}});
 verify();instance.destroy();
});

it('places multiple usecase arrivals on the ellipse after moving',()=>{
 const source='@usecase\nactor A\nactor B\nactor C\nusecase Target\nA -> Target [toPort=left]\nB -> Target [toPort=left]\nC -> Target [toPort=left]';
 const instance=createFinch().render(source,{editor:false});
 const verify=()=>{
  const node=instance.geometry.nodes.find(n=>n.id==='Target')!;
  const points=instance.geometry.edges.map(e=>e.points[e.points.length-1]!);
  expect(new Set(points.map(p=>p.y)).size).toBe(3);
  for(const point of points){
   const x=(point.x-node.x-node.width/2)/(node.width/2),y=(point.y-node.y-node.height/2)/(node.height/2);
   expect(x*x+y*y).toBeCloseTo(1);
  }
 };
 verify();
 instance.importLayout({version:1,diagram:'usecase',nodes:{Target:{x:360,y:240,manual:true,pinned:true}}});
 verify();instance.destroy();
});

it('renders bidirectional deployment relations as one edge with two arrowheads',()=>{
 for(const arrow of ['<->','<-->']){
  const instance=createFinch().render(`@deployment\nnode A\nnode B\nA ${arrow} B: exchange`,{editor:false});
  expect(instance.model.connections).toHaveLength(1);
  expect(instance.model.connections[0]).toMatchObject({from:'A',to:'B',attributes:{bidirectional:'true'},dashed:arrow==='<-->'});
  const edge=instance.svg.querySelector('.finch-edge')!;
  expect(edge.getAttribute('marker-start')).toBe('url(#finch-open-arrow)');
  expect(edge.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  instance.destroy();
 }
});

it('combines ownership diamonds with navigability arrows in either notation direction',()=>{
 for(const symbol of ['o','*'])for(const reverse of [false,true]){
  const source=`@component\ncomponent Owner\ncomponent Part\n${reverse?`Part <--${symbol} Owner`:`Owner ${symbol}--> Part`}`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.connections[0]).toMatchObject({from:'Owner',to:'Part',dashed:false,attributes:{relation:symbol==='o'?'aggregation':'composition',navigable:'true'}});
  const edge=instance.svg.querySelector('.finch-edge')!;
  expect(edge.getAttribute('marker-start')).toBe(`url(#finch-diamond-${symbol==='o'?'open':'filled'})`);
  expect(edge.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  instance.destroy();
 }
});

it('keeps aggregation and composition diamonds at the owner in either notation direction',()=>{
 for(const symbol of ['o','*'])for(const reverse of [false,true]){
  const source=`@deployment\nnode Owner\nartifact Part\n${reverse?`Part --${symbol} Owner`:`Owner ${symbol}-- Part`}`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.connections[0]).toMatchObject({from:'Owner',to:'Part',dashed:false,attributes:{relation:symbol==='o'?'aggregation':'composition'}});
  const edge=instance.svg.querySelector('.finch-edge')!;
  expect(edge.getAttribute('marker-start')).toBe(`url(#finch-diamond-${symbol==='o'?'open':'filled'})`);
  expect(edge.hasAttribute('marker-end')).toBe(false);
  instance.destroy();
 }
});

it('distinguishes realization from inheritance with dotted triangle arrows',()=>{
 for(const reverse of [false,true]){
  const source=`@component\ncomponent Implementation\ninterface Contract\n${reverse?'Contract <|.. Implementation':'Implementation ..|> Contract'}\nnote on link: Implements`;
  const instance=createFinch().render(source,{editor:false});
  const edge=instance.model.connections[0]!;
  expect(edge).toMatchObject({from:'Implementation',to:'Contract',dashed:true,attributes:{relation:'realization'}});
  expect(instance.svg.querySelector('.finch-edge')?.getAttribute('marker-end')).toBe('url(#finch-triangle)');
  expect(instance.model.nodes.find(n=>n.label==='Implements')?.attributes.annotationTarget).toBe(edge.id);
  instance.destroy();
 }
});

it('supports standard generalization arrows in usecase and deployment diagrams',()=>{
 for(const kind of ['usecase','component','deployment'])for(const reverse of [false,true]){
  const source=`@${kind}\nactor Parent\nactor Child\n${reverse?'Parent <|-- Child':'Child --|> Parent'} [fromPort=top toPort=bottom]`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.connections[0]).toMatchObject({from:'Child',to:'Parent',dashed:false,attributes:{relation:'inheritance',fromPort:'top',toPort:'bottom'}});
  expect(instance.svg.querySelector('.finch-edge')?.getAttribute('marker-end')).toBe('url(#finch-triangle)');
  instance.destroy();
 }
});

it('keeps multiline usecase descriptions literal across business notation',()=>{
 for(const declaration of ['usecase','usecase/']){
  const source=`@usecase\n${declaration} Order [\nOrder workflow\ninclude A -> B\nhide Order\n]\nnote right: Documentation`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.nodes.find(n=>n.id==='Order')?.label).toBe('Order workflow\\ninclude A -> B\\nhide Order');
  expect(instance.model.nodes.find(n=>n.label==='Documentation')?.attributes.annotationTarget).toBe('Order');
  expect(instance.model.nodes.some(n=>n.id==='A')).toBe(false);
  expect(instance.exportState().source).toBe(source);
  expect(instance.svg.querySelectorAll('.finch-business-mark').length).toBe(declaration.endsWith('/')?1:0);
  instance.destroy();
 }
});

it('supports ports and link notes on concise usecase relations',()=>{
 for(const kind of ['include','extend','generalize']){
  const source=`@usecase\nusecase A\nusecase B\n${kind} A -> B [fromPort=right toPort=top]\nnote on link: Details`;
  const instance=createFinch().render(source,{editor:false});
  const edge=instance.model.connections[0]!;
  expect(edge.attributes).toMatchObject({fromPort:'right',toPort:'top',relation:kind==='generalize'?'inheritance':'dependency'});
  expect(instance.model.nodes.find(n=>n.label==='Details')?.attributes.annotationTarget).toBe(edge.id);
  expect(instance.exportState().source).toBe(source);
  instance.destroy();
 }
});

it('preserves explicit ports and direction on usecase dependency and inheritance relations',()=>{
 for(const relation of ['include','extend','generalize']){
  const source=`@usecase\nusecase A\nusecase B\nA -right-> B: «${relation}» [fromPort=top toPort=left]`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.connections[0]!.attributes).toMatchObject({fromPort:'top',toPort:'left',layoutDirection:'right',relation:relation==='generalize'?'inheritance':'dependency'});
  const node=instance.geometry.nodes.find(n=>n.id==='A')!;
  expect(instance.geometry.edges[0]!.points[0]!.y).toBe(node.y);
  instance.destroy();
 }
});

it('avoids actor names in vertical automatic routes and attaches explicit bottom ports to a foot',()=>{
 const source='@deployment\ntop to bottom direction\nactor User\ncomponent App\nUser -> App';
 const instance=createFinch().render(source,{editor:false});
 let node=instance.geometry.nodes.find(n=>n.id==='User')!;
 expect(instance.geometry.edges[0]!.points[0]).toEqual({x:node.x+node.width/2+16,y:node.y+40});
 instance.update(source.replace('User -> App','User -> App [fromPort=bottom]'));
 node=instance.geometry.nodes.find(n=>n.id==='User')!;
 expect(instance.geometry.edges[0]!.points[0]).toEqual({x:node.x+node.width/2+12,y:node.y+56});
 instance.destroy();
});

it('routes actor self-relations above the name before and after moving',()=>{
 for(const actor of ['actor','actor/']){
  const instance=createFinch().render(`@deployment\n${actor} User\nUser -> User: retry`,{editor:false});
  const check=()=>{
   const node=instance.geometry.nodes[0]!,points=instance.geometry.edges[0]!.points;
   expect(points[0]).toEqual({x:node.x+node.width/2+16,y:node.y+40});
   expect(points[points.length-1]).toEqual({x:node.x+node.width/2,y:node.y+2});
   expect(Math.max(...points.map(p=>p.y))).toBeLessThanOrEqual(node.y+40);
  };
  check();
  instance.importLayout({version:1,diagram:'deployment',nodes:{User:{x:280,y:220,manual:true,pinned:true}}});
  check();instance.destroy();
 }
});

it('connects normal and business actors below their arms after moving',()=>{
 for(const declaration of ['actor','actor/']){
  const source=`@deployment\n${declaration} User\ncomponent App\nUser -> App [fromPort=right]`;
  const instance=createFinch().render(source,{editor:false});
  const check=()=>{
   const node=instance.geometry.nodes.find(n=>n.id==='User')!;
   expect(instance.geometry.edges[0]!.points[0]).toEqual({x:node.x+node.width/2+16,y:node.y+40});
  };
  check();
  instance.importLayout({version:1,diagram:'deployment',nodes:{User:{x:280,y:220,manual:true,pinned:true}}});
  check();instance.destroy();
 }
});

it('renders business actors with aliases and notes across diagram kinds',()=>{
 for(const kind of ['deployment','component','usecase']){
  const source=`@${kind}\nactor/ "Customer" as user\nnote right: Business actor\nusecase Order\nuser -> Order`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.nodes.find(n=>n.id==='user')).toMatchObject({shape:'actor',attributes:{business:'true'}});
  expect(instance.model.nodes.find(n=>n.label==='Business actor')?.attributes.annotationTarget).toBe('user');
  expect(instance.svg.querySelectorAll('.finch-business-mark')).toHaveLength(1);
  instance.update(source.replace('actor/','actor'));
  expect(instance.svg.querySelector('.finch-business-mark')).toBeNull();
  instance.destroy();
 }
});

it('shares business usecase declarations and shorthand notes in usecase diagrams',()=>{
 const source='@usecase\nactor User\nusecase/ "Ordering" as Order\nnote right: Business workflow\nusecase Check\nUser -> Order\ninclude Order -> Check';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.kind).toBe('usecase');
 expect(instance.model.nodes.find(n=>n.label==='Business workflow')?.attributes.annotationTarget).toBe('Order');
 expect(instance.model.connections.find(e=>e.label==='«include»')?.attributes?.relation).toBe('dependency');
 expect(instance.svg.querySelector('.finch-business-mark')).not.toBeNull();
 instance.destroy();
});

it('accepts business usecase slash declarations with aliases and annotations',()=>{
 const source='@deployment\nusecase/ "Order handling" as order <<business>> [tone=green]\nnote right: Workflow\nactor User\nUser -> order';
 const model=parseDeployment(source);
 expect(model.nodes.find(n=>n.id==='order')).toMatchObject({shape:'usecase',label:'Order handling',attributes:{business:'true',stereotype:'business'}});
 expect(model.nodes.find(n=>n.label==='Workflow')?.attributes.annotationTarget).toBe('order');
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelector('.finch-business-mark')).not.toBeNull();
 instance.update(source+'\nremove usecase');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['User']);
 instance.destroy();
});

it('distinguishes business usecases without changing their semantic kind',()=>{
 const source='@deployment\nusecase Business "Order handling" [business=true]\nusecase Plain "Order handling"\nBusiness -> Plain';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelectorAll('.finch-business-mark')).toHaveLength(1);
 const [business,plain]=['Business','Plain'].map(id=>instance.geometry.nodes.find(n=>n.id===id)!);
 expect(business!.shape).toBe('usecase');
 expect(business!.width).toBeGreaterThan(plain!.width);
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-business-mark')).toHaveLength(1);
 instance.update(source.replace('[business=true]','[business=false]'));
 expect(instance.svg.querySelector('.finch-business-mark')).toBeNull();
 instance.destroy();
});

it('retains ownership when an implicit interface is refined into a component',()=>{
 const source='@component\npackage Domain {\nWorker -> Store\n}\n[Worker] -> Store';
 const model=parseDeployment(source);
 expect(model.nodes.find(n=>n.id==='Worker')).toMatchObject({shape:'component',parentId:'Domain'});
 expect(model.nodes.filter(n=>n.id==='Worker')).toHaveLength(1);
 expect(model.nodes.find(n=>n.id==='Store')).toMatchObject({shape:'uml-provided-interface',parentId:'Domain'});
 const instance=createFinch().render(source,{editor:false});
 instance.update(source+'\nremove component');
 expect(instance.geometry.nodes.some(n=>n.id==='Worker')).toBe(false);
 expect(instance.geometry.nodes.some(n=>n.id==='Store')).toBe(true);
 instance.destroy();
});

it('preserves the first implicit endpoint owner across later references',()=>{
 for(const kind of ['component','deployment']){
  const source=`@${kind}\npackage Domain {\n:Customer: -> (Order)\n}\npackage Other {\n:Customer: -> (Order)\n}\n:Customer: -> (Order)`;
  const model=parseDeployment(source);
  expect(model.nodes.find(n=>n.id==='Customer')?.parentId).toBe('Domain');
  expect(model.nodes.find(n=>n.id==='Order')?.parentId).toBe('Domain');
  expect(model.nodes.filter(n=>n.id==='Customer')).toHaveLength(1);
  expect(model.connections).toHaveLength(3);
  const explicit=parseDeployment(source+'\nactor Customer');
  expect(explicit.nodes.find(n=>n.id==='Customer')?.parentId).toBeUndefined();
 }
});

it('rejects incompatible bracketed and compact endpoints in either order',()=>{
 for(const kind of ['component','deployment'])for(const endpoint of [':Same:','(Same)']){
  for(const relation of [`[Same] -> ${endpoint}`,`${endpoint} -> [Same]`]){
   expect(()=>parseDeployment(`@${kind}\n${relation}`)).toThrow('Conflicting endpoint kinds');
  }
 }
 expect(()=>parseDeployment('@component\n[Same] -> [Other]\n[Other] -> [Same]')).not.toThrow();
});

it('rejects conflicting compact endpoint kinds regardless of declaration order',()=>{
 for(const kind of ['component','deployment']){
  expect(()=>parseDeployment(`@${kind}\n:Same: -> (Same)`)).toThrow('Conflicting endpoint kinds');
  for(const declaration of ['component Same','usecase Same'])for(const first of [true,false]){
   const lines=[declaration,':Same: -> (Other)'];
   expect(()=>parseDeployment(`@${kind}\n${(first?lines:lines.reverse()).join('\n')}`)).toThrow('Conflicting endpoint kinds');
  }
  expect(()=>parseDeployment(`@${kind}\nactor Same [shape=rectangle]\n:Same: -> (Other)`)).not.toThrow();
 }
});

it('infers actors and usecases from compact relation endpoints',()=>{
 for(const kind of ['component','deployment']){
  const source=`@${kind}\n:Customer: -> (Place order): requests\n(Place order) <- :Customer:\nnote on link: Retry`;
  const model=parseDeployment(source);
  expect(model.nodes.filter(n=>!n.attributes.annotationTarget).map(n=>[n.label,n.shape])).toEqual([['Customer','actor'],['Place order','usecase']]);
  expect(model.connections.filter(e=>e.label==='requests')).toHaveLength(1);
  expect(model.connections.slice(0,2).map(e=>e.from)).toEqual(['Customer','Customer']);
  const instance=createFinch().render(source,{editor:false});
  instance.update(source+'\nremove actor');
  expect(instance.geometry.nodes.map(n=>n.shape)).toEqual(['usecase']);
  instance.destroy();
 }
});

it('handles metadata after compact declarations while preserving literal names',()=>{
 const source='@deployment\n:Customer $literal <<name>>: as customer <<external>> $public\n(Place $literal <<name>> order) as order <<business>> $public\nnote right: Main flow\ncustomer -> order';
 const model=parseDeployment(source);
 expect(model.nodes.find(n=>n.id==='customer')).toMatchObject({label:'Customer $literal <<name>>',attributes:{stereotype:'external',tags:'["public"]'}});
 expect(model.nodes.find(n=>n.id==='order')).toMatchObject({label:'Place $literal <<name>> order',attributes:{stereotype:'business',tags:'["public"]'}});
 expect(model.nodes.find(n=>n.label==='Main flow')?.attributes.annotationTarget).toBe('order');
 const instance=createFinch().render(source,{editor:false});
 instance.update(source+'\nremove $public');
 expect(instance.geometry.nodes).toHaveLength(0);
 instance.destroy();
});

it('accepts compact actor and usecase declarations with aliases and notes',()=>{
 const source='@deployment\n:Customer name: as customer [tone=green]\nnote right: External user\n(Place order) as order\ncustomer -> order';
 const model=parseDeployment(source);
 expect(model.nodes.find(n=>n.id==='customer')).toMatchObject({shape:'actor',label:'Customer name',attributes:{tone:'green'}});
 expect(model.nodes.find(n=>n.id==='order')).toMatchObject({shape:'usecase',label:'Place order'});
 expect(model.nodes.find(n=>n.label==='External user')?.attributes.annotationTarget).toBe('customer');
 const unnamed=parseDeployment('@deployment\n:Customer:\n(Order)\nCustomer -> Order');
 expect(unnamed.nodes.map(n=>n.id)).toEqual(['Customer','Order']);
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelector('.finch-shape-actor')).not.toBeNull();
 expect(instance.svg.querySelector('.finch-shape-usecase')).not.toBeNull();
 instance.destroy();
});

it('renders person labels inside the body with aliases and display selection',()=>{
 const source='@deployment\nperson "Operations team with a long descriptive name" as user [tone=green]\ncomponent App\nuser -> App [fromPort=right]';
 const instance=createFinch().render(source,{editor:false});
 const node=instance.geometry.nodes.find(n=>n.id==='user')!;
 expect(node.shape).toBe('person');
 expect(instance.svg.querySelector('.finch-shape-person > circle')).not.toBeNull();
 expect(instance.geometry.edges[0]!.points[0]).toEqual({x:node.x+node.width,y:node.y+32+(node.height-32)/2});
 expect(instance.svg.querySelectorAll('.finch-shape-person text tspan').length).toBeGreaterThan(1);
 instance.setTheme('midnight');
 expect(instance.svg.querySelector('.finch-shape-person > rect')).not.toBeNull();
 instance.update(source+'\nremove person');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('supports agent aliases, annotations and kind selection independently of rectangles',()=>{
 const source='@deployment\npackage System {\nagent "Collector" as collector <<monitor>> [icon=server tone=green]\nnote right: Collects events\nrectangle Peer\ncollector -> Peer\n}';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.nodes.find(n=>n.id==='collector')).toMatchObject({shape:'rectangle',label:'Collector',parentId:'System',attributes:{stereotype:'monitor',tone:'green'}});
 expect(instance.model.nodes.find(n=>n.label==='Collects events')?.attributes.annotationTarget).toBe('collector');
 expect(instance.svg.querySelector('.finch-node-icon')).not.toBeNull();
 instance.update(source+'\nremove agent');
 expect(instance.geometry.nodes.map(n=>n.id).sort()).toEqual(['Peer','System']);
 instance.update(source+'\nremove agent\nrestore agent');
 expect(instance.geometry.nodes.some(n=>n.id==='collector')).toBe(true);
 instance.destroy();
});

it('preserves literal multiline deployment descriptions with metadata',()=>{
 for(const kind of ['node','folder','database','usecase','card','artifact','file','queue','cloud','rectangle','hexagon','stack','action']){
  const source=`@deployment\n${kind} Target <<service>> [\nDeployment details\nhide Target\ntitle Literal text\n] [tone=green]\ncomponent Peer\nPeer -> Target`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.nodes.find(n=>n.id==='Target')).toMatchObject({label:'Deployment details\\nhide Target\\ntitle Literal text',attributes:{stereotype:'service',tone:'green'}});
  expect(instance.geometry.nodes.some(n=>n.id==='Target')).toBe(true);
  expect(instance.exportState().source).toBe(source);
  instance.destroy();
  expect(()=>parseDeployment(`@deployment\n${kind} Broken [\nText`)).toThrow(`Unclosed ${kind} description`);
 }
});

it('supports process declarations with aliases, nested groups and display rules',()=>{
 const source='@deployment\nprocess "Workflow" as flow {\nprocess {\nprocess "Process order" as process [icon=server]\n}\n}\ncomponent App\nApp -> process';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.nodes.find(n=>n.id==='process')?.shape).toBe('process');
 expect(instance.svg.querySelectorAll('.finch-process-outline')).toHaveLength(2);
 expect(instance.svg.querySelector('.finch-node-icon')).not.toBeNull();
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-process-outline')).toHaveLength(2);
 instance.update(source+'\nremove process');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('supports storage declarations with aliases, nested groups and display rules',()=>{
 const source='@deployment\nstorage "Workflow" as flow {\nstorage {\nstorage "Process order" as process [icon=server]\n}\n}\ncomponent App\nApp -> process';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.nodes.find(n=>n.id==='process')?.shape).toBe('storage');
 expect(instance.svg.querySelectorAll('.finch-storage-outline')).toHaveLength(2);
 expect(instance.svg.querySelector('.finch-node-icon')).not.toBeNull();
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-storage-outline')).toHaveLength(2);
 instance.update(source+'\nremove storage');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('supports action declarations with aliases, nested groups and display rules',()=>{
 const source='@deployment\naction "Workflow" as flow {\naction {\naction "Process order" as process [icon=server]\n}\n}\ncomponent App\nApp -> process';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.nodes.find(n=>n.id==='process')?.shape).toBe('rounded');
 expect(instance.svg.querySelectorAll('.finch-action-outline')).toHaveLength(2);
 expect(instance.svg.querySelector('.finch-node-icon')).not.toBeNull();
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-action-outline')).toHaveLength(2);
 instance.update(source+'\nremove action');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('shares default deployment stereotypes with display selectors without duplicate labels',()=>{
 for(const kind of ['artifact','device']){
  const source=`@deployment\n${kind} Default\n${kind} Custom <<hardware>>`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.svg.textContent?.match(new RegExp(`«${kind}»`,'g'))).toHaveLength(1);
  expect(instance.svg.textContent?.match(/«hardware»/g)).toHaveLength(1);
  instance.update(source+'\nhide stereotype');
  expect(instance.svg.textContent).not.toContain('«');
  instance.update(source+`\nremove <<${kind}>>`);
  expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['Custom']);
  instance.update(source+'\nhide stereotype\nshow Custom stereotype');
  expect(instance.svg.textContent).toContain('«hardware»');
  expect(instance.svg.textContent).not.toContain(`«${kind}»`);
  instance.destroy();
 }
});

it('renders standalone deployment nodes as cubes while preserving grouping and shape overrides',()=>{
 const source='@deployment\nnode "Cluster" as cluster {\nnode "Worker" as worker [icon=server tone=blue]\n}\nnode plain [shape=rectangle]\nworker -> plain';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.model.nodes.find(n=>n.id==='worker')).toMatchObject({shape:'uml-node',parentId:'cluster'});
 expect(instance.model.nodes.find(n=>n.id==='plain')?.shape).toBe('rectangle');
 expect(instance.svg.querySelectorAll('.finch-shape-uml-node > path')).toHaveLength(1);
 expect(instance.svg.querySelectorAll('.finch-node-outline')).toHaveLength(1);
 expect(instance.svg.textContent).not.toContain('«device»');
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-shape-uml-node > path')).toHaveLength(1);
 instance.update(source+'\nremove node');
 expect(instance.geometry.nodes).toHaveLength(0);
});

it('supports stack elements and nested stack groups',()=>{
 const source='@deployment\nstack "Work stack" as outer {\nstack {\nstack "Pending items" as pending\n}\n}';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelectorAll('.finch-stack-outline')).toHaveLength(2);
 expect(instance.svg.querySelectorAll('.finch-shape-stack > rect')).toHaveLength(3);
 const node=instance.geometry.nodes.find(n=>n.id==='pending')!;
 const parent=instance.geometry.nodes.find(n=>n.id===node.parentId)!;
 expect(node.y).toBeGreaterThanOrEqual(parent.y+parent.headerHeight!);
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-stack-outline')).toHaveLength(2);
 instance.update(source+'\nremove stack');
 expect(instance.geometry.nodes).toHaveLength(0);
 instance.destroy();
});

it('renders deployment collections with aliases and kind selection',()=>{
 const source='@deployment\ncollections "Order records" as records\ncomponent App\nApp -> records';
 const instance=createFinch().render(source,{editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const shape=instance.svg.querySelector('.finch-shape-collections')!;
  expect(shape.querySelectorAll(':scope > rect')).toHaveLength(3);
  expect(shape.textContent).toContain('Order records');
 }
 instance.update(source+'\nremove collections');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});
import {rerouteGeometry} from '../src/layouts';

it('spreads multiple person connections over the body after moving',()=>{
 const source='@deployment\nperson User\ncomponent A\ncomponent B\ncomponent C\nA -> User [toPort=right]\nB -> User [toPort=right]\nC -> User [toPort=right]';
 const instance=createFinch().render(source,{editor:false});
 const check=()=>{
  const node=instance.geometry.nodes.find(n=>n.id==='User')!;
  const points=instance.geometry.edges.map(e=>e.points[e.points.length-1]!);
  expect(new Set(points.map(p=>p.y)).size).toBe(3);
  for(const p of points){
   expect(p.x).toBe(node.x+node.width);
   expect(p.y).toBeGreaterThan(node.y+48);
   expect(p.y).toBeLessThan(node.y+node.height-16);
  }
 };
 check();
 instance.importLayout({version:1,diagram:'deployment',nodes:{User:{x:420,y:260,manual:true,pinned:true}}});
 check();
 instance.destroy();
});

it('keeps process connections on their outline after layout import and source update',()=>{
 for(const side of ['left','right','top','bottom']){
  const source=`@deployment\nprocess Work\ncomponent Peer\nWork -> Peer [fromPort=${side}]\nPeer -> Work [toPort=${side}]`;
  const instance=createFinch().render(source,{editor:false});
  const verify=()=>{
   const node=instance.geometry.nodes.find(n=>n.id==='Work')!;
   for(const edge of instance.geometry.edges){
    const p=edge.from==='Work'?edge.points[0]!:edge.points[edge.points.length-1]!;
    const x=p.x-node.x,y=p.y-node.y;
    if(side==='top'||side==='bottom'){
     expect(y).toBeCloseTo(side==='top'?0:node.height);
     expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(node.width-12);
    }else{
     const localX=side==='right'?x-node.width+12:x;
     expect(localX/12 + Math.abs(y-node.height/2)/(node.height/2)).toBeCloseTo(1);
    }
   }
  };
  verify();
  instance.importLayout({version:1,diagram:'deployment',nodes:{Work:{x:300,y:240,manual:true,pinned:true}}});
  verify();
  instance.update(source.replace('process Work','process Work "Longer process label"'));
  verify();
  instance.destroy();
 }
});

it('keeps cube ports on straight outline segments on every side after moving',()=>{
 for(const kind of ['node','device'])for(const side of ['left','right','top','bottom']){
  const instance=createFinch().render(`@deployment\n${kind} Host\ncomponent Peer\nHost -> Peer [fromPort=${side}]\nPeer -> Host [toPort=${side}]`,{editor:false});
  const host=instance.geometry.nodes.find(n=>n.id==='Host')!;
  const depth=kind==='device'?12:10;
  for(const moved of [false,true]){
   if(moved){host.x+=50;host.y+=35;rerouteGeometry(instance.geometry);}
   const points=instance.geometry.edges.map(edge=>edge.from==='Host'?edge.points[0]!:edge.points[edge.points.length-1]!);
   for(const p of points){
    if(side==='left'||side==='right'){
     expect(p.x).toBe(host.x+(side==='right'?host.width:0));
     expect(p.y).toBeGreaterThan(host.y+(side==='left'?depth:0));
     expect(p.y).toBeLessThan(host.y+host.height-(side==='right'?depth:0));
    }else{
     expect(p.y).toBe(host.y+(side==='bottom'?host.height:0));
     expect(p.x).toBeGreaterThan(host.x+(side==='top'?depth:0));
     expect(p.x).toBeLessThan(host.x+host.width-(side==='bottom'?depth:0));
    }
   }
  }
  instance.destroy();
 }
});

it('keeps role self-relations above their labels after moving',()=>{
 for(const role of ['boundary','control','entity']){
  const instance=createFinch().render(`@deployment\n${role} Role\nRole -> Role: retry`,{editor:false});
  const node=instance.geometry.nodes[0]!;
  for(const moved of [false,true]){
   if(moved){node.x+=75;node.y+=40;rerouteGeometry(instance.geometry);}
   const points=instance.geometry.edges[0]!.points;
   expect(points[0]).toEqual({x:node.x+node.width/2+18,y:node.y+30});
   expect(points[points.length-1]).toEqual({x:node.x+node.width/2+(role==='control'?10:0),y:node.y+(role==='control'?30-Math.sqrt(224):12)});
   expect(Math.max(...points.map(p=>p.y))).toBeLessThanOrEqual(node.y+30);
  }
  instance.destroy();
 }
});

it('connects deployment roles at their symbols rather than label bounds',()=>{
 for(const role of ['boundary','control','entity']){
  const instance=createFinch().render(`@deployment\ncomponent Client\n${role} Role\nClient -> Role [toPort=left]`,{editor:false});
  const node=instance.geometry.nodes.find(n=>n.id==='Role')!;
  const points=instance.geometry.edges[0]!.points;
  expect(points[points.length-1]).toEqual({x:node.x+node.width/2-(role==='boundary'?30:18),y:node.y+30});
  instance.update(`@deployment\n${role} Role\ncomponent Client\nRole -> Client [fromPort=right]`);
  const moved=instance.geometry.nodes.find(n=>n.id==='Role')!;
  expect(instance.geometry.edges[0]!.points[0]).toEqual({x:moved.x+moved.width/2+18,y:moved.y+30});
  instance.destroy();
 }
});

it('supports boundary, control and entity roles in deployment declarations',()=>{
 const source='@deployment\npackage System {\nboundary "Public API" as api\ncontrol Handler as handler\nentity "Order data" as orders\n}';
 const instance=createFinch().render(source,{editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  for(const [role,id] of [['boundary','api'],['control','handler'],['entity','orders']]){
   expect(instance.model.nodes.find(n=>n.id===id)).toMatchObject({shape:`sequence-${role}`,parentId:'System'});
   expect(instance.svg.querySelector(`.finch-sequence-${role} circle`)).not.toBeNull();
  }
 }
 instance.update(source+'\nremove entity');
 expect(instance.geometry.nodes.some(n=>n.id==='orders')).toBe(false);
 instance.destroy();
});

it('connects quoted JSON keys with spaces, punctuation and escapes',()=>{
 for(const key of ['接続先 URL','a:b','a"b','line\nbreak','']){
  const source=`@component\ncomponent App\njson config ${JSON.stringify({[key]:true})}\n`;
  for(const relation of [`App -> config::${JSON.stringify(key)}`,`config::${JSON.stringify(key)} <- App`]){
   const model=parseDeployment(source+relation+' : reads\nnote on link: Details');
   expect(model.connections[0]).toMatchObject({from:'App',to:'config',label:'reads',attributes:{toMapRow:'0'}});
   expect(model.nodes.find(n=>n.attributes.annotationTarget)!.attributes.annotationTarget).toBe(model.connections[0]!.id);
  }
 }
});

it('connects JSON keys by name in both arrow directions and follows reordered fields',()=>{
 const source='@component\ncomponent App\njson config {"port":5432,"host":"db"}\n';
 for(const relation of ['App -> config::host','config::host <- App']){
  const model=parseDeployment(source+relation+'\nnote on link: Host lookup');
  expect(model.connections[0]).toMatchObject({from:'App',to:'config',attributes:{toMapRow:'1'}});
  expect(model.nodes.find(n=>n.attributes.annotationTarget)!.attributes.annotationTarget).toBe(model.connections[0]!.id);
  const reordered=parseDeployment(source.replace('"port":5432,"host":"db"','"host":"db","port":5432')+relation);
  expect(reordered.connections[0]!.attributes!.toMapRow).toBe('0');
 }
 expect(()=>parseDeployment(source+'App -> config::missing')).toThrow('Unknown JSON key');
 expect(()=>parseDeployment(source+'App::host -> config')).toThrow('Unknown JSON key');
});

it('validates JSON row endpoints before layout',()=>{
 const source='@component\ncomponent App\njson data {"a":1,"b":2}\n';
 for(const row of ['-1','2','0.5','NaN','9007199254740992']){
  expect(()=>parseDeployment(source+`App -> data [toMapRow=${row}]`)).toThrow('Invalid toMapRow');
  expect(()=>parseDeployment(source+`data -> App [fromMapRow=${row}]`)).toThrow('Invalid fromMapRow');
 }
 expect(()=>parseDeployment(source+'App -> data [fromMapRow=0]')).toThrow('Invalid fromMapRow');
 expect(()=>parseDeployment(source+'App -> data [toMapRow=1]')).not.toThrow();
 expect(()=>parseDeployment('@component\njson empty {}\ncomponent App\nApp -> empty [toMapRow=0]')).toThrow('Invalid toMapRow');
});

it('attaches shorthand notes after nested JSON to the declared root',()=>{
 for(const kind of ['component','deployment'])for(const note of ['note','rnote','hnote']){
  const source=`@${kind}\njson "Settings" as config {"nested":{"ports":[1,2]}}\n${note} right: Root details\n${note} left of config__json2: Array details\ncomponent App\n${note} bottom: Application details`;
  const model=parseDeployment(source);
  expect(model.nodes.filter(n=>n.attributes.annotationTarget).map(n=>[n.label,n.attributes.annotationTarget])).toEqual([
   ['Root details','config'],['Array details','config__json2'],['Application details','App'],
  ]);
 }
});

it('resolves JSON notes through the public component renderer after JSON expansion',()=>{
 for(const kind of ['component','deployment'])for(const multiline of [false,true]){
  const value=JSON.stringify({nested:{ports:[1,2]}},null,multiline?2:undefined);
  const source=`@${kind}\ncomponent App\njson "Settings" as config ${value}\nnote top: Root details\nApp -> config::nested`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.kind).toBe(kind);
  expect(instance.model.nodes.find(n=>n.label==='Root details')?.attributes.annotationTarget).toBe('config');
 }
});

it('hides and removes nested JSON maps with their root without affecting another JSON document',()=>{
 const source='@component\njson config {"nested":{"ports":[1,2]}}\njson other {"enabled":true}';
 const instance=createFinch().render(source,{editor:false});
 instance.update(source+'\nhide config');
 expect(instance.geometry.nodes.filter(n=>n.attributes.hidden==='true').map(n=>n.id)).toEqual(['config','config__json1','config__json2']);
 expect(instance.geometry.nodes.find(n=>n.id==='other')!.attributes.hidden).not.toBe('true');
 instance.update(source+'\nremove config');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['other']);
 instance.update(source+'\nremove config\nrestore config');
 expect(instance.geometry.nodes).toHaveLength(4);
 instance.destroy();
});

it('selects JSON independently from components, including nested JSON maps',()=>{
 const source='@component\ncomponent App\njson config {"nested":{"enabled":true}}\nApp -> config\nnote on link: Reads config';
 for(const [selector,ids] of [['component',['App']],['json',['config','config__json1']]] as const){
  const model=parseDeployment(source+`\nhide ${selector}`);
  expect(model.nodes.filter(n=>n.attributes.hidden==='true').map(n=>n.id)).toEqual([...ids]);
  expect(model.nodes.find(n=>n.id==='config')!.shape).toBe('uml-map');
 }
 expect(()=>parseDeployment('@component\ncomponent App\nhide json')).not.toThrow();
 const restored=parseDeployment(source+'\nremove json\nrestore json');
 expect(restored.nodes.find(n=>n.id==='config')!.attributes.removed).toBe('false');
});

it('attaches link notes after JSON expansion to the correct relation',()=>{
 const model=parseDeployment('@component\njson settings {"nested":{"enabled":true}}\ncomponent App\nApp -> settings\nnote on link: Reads settings');
 const relation=model.connections.find(e=>e.from==='App')!;
 expect(model.nodes.find(n=>n.attributes.annotationTarget)!.attributes.annotationTarget).toBe(relation.id);
 const nested=parseDeployment('@component\njson settings {"nested":{"enabled":true}}\nnote on link: Nested data');
 expect(nested.nodes.find(n=>n.attributes.annotationTarget)!.attributes.annotationTarget).toBe(nested.connections[0]!.id);
});

it('retains allowmixing when JSON is temporarily absent during editing',()=>{
 const source='@component\nallowmixing\ncomponent App';
 const model=parseDeployment(source);
 expect(model.source).toBe(source);
 expect(model.nodes.map(n=>n.id)).toEqual(['App']);
});

it('mixes nested JSON data into component diagrams without changing the original source',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\nallowmixing\ncomponent App\njson settings {"enabled":true,"database":{"host":"localhost","ports":[5432,5433]}}\nApp -> settings';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.model.source).toBe(source);
 expect(instance.model.nodes.filter(n=>n.shape==='uml-map')).toHaveLength(3);
 expect(JSON.parse(instance.model.nodes.find(n=>n.id==='settings')!.attributes.mapEntries!)).toContainEqual({key:'enabled',value:'true'});
 expect(instance.geometry.edges.filter(e=>e.attributes?.fromMapRow!==undefined)).toHaveLength(2);
 expect(instance.svg.textContent).toContain('localhost');
 instance.setTheme('midnight');
 expect(instance.svg.textContent).toContain('5433');
 instance.update(source.replace('localhost','database.internal'));
 expect(instance.svg.textContent).toContain('database.internal');
 instance.destroy();
});

it('accepts deployment circles with aliases and connects at the circumference',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\ncircle "Processing stage" as stage <<step>>\nnote right: Stage details\ncomponent Client\nClient -> stage';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const node=instance.geometry.nodes.find(n=>n.id==='stage')!;
  expect(node.shape).toBe('circle');
  expect(node.width).toBe(node.height);
  const points=instance.geometry.edges[0]!.points,endpoint=points[points.length-1]!;
  expect(Math.hypot(endpoint.x-node.x-node.width/2,endpoint.y-node.y-node.height/2)).toBeCloseTo(node.width/2);
  expect(instance.svg.querySelector('.finch-shape-circle')!.textContent).toContain('Processing stage');
  expect(instance.model.nodes.some(n=>n.attributes.annotationTarget==='stage')).toBe(true);
 }
 instance.update(source+'\nremove circle');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['Client']);
 instance.destroy();
});

it('uses a cloud outline for standalone clouds with wrapped labels and icons',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\ncomponent Client\ncloud "Managed cloud services for customer requests" as provider [icon=server tone=green]\nClient -> provider';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const node=instance.geometry.nodes.find(n=>n.id==='provider')!;
  expect(node.shape).toBe('cloud');
  expect(node.height).toBeGreaterThanOrEqual(110);
  const shape=instance.svg.querySelector('.finch-shape-cloud')!;
  expect(shape.querySelector(':scope > path')!.getAttribute('d')).toContain('C');
  expect(shape.textContent).not.toContain('«external»');
  expect(shape.querySelector('.finch-node-icon')).not.toBeNull();
  expect(shape.querySelectorAll('text tspan').length).toBeGreaterThan(1);
 }
 instance.update(source.replace('cloud "Managed','external "Managed'));
 expect(instance.svg.querySelector('.finch-shape-external')).not.toBeNull();
 instance.destroy();
});

it('renders borderless labels with aliases, notes, icons and display selection',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nlabel "Read the deployment guide" as guide [icon=server]\nnote right: Documentation\ncomponent App\nApp -> guide';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const label=instance.svg.querySelector('.finch-shape-label')!;
  expect(label.textContent).toContain('Read the deployment guide');
  expect(label.querySelector(':scope > rect')!.getAttribute('stroke')).toBe('none');
  expect(label.querySelector(':scope > rect')!.getAttribute('fill')).toBe('transparent');
  expect(label.querySelector('.finch-node-icon')).not.toBeNull();
  expect(instance.model.nodes.some(n=>n.attributes.annotationTarget==='guide')).toBe(true);
 }
 instance.update(source+'\nremove label');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('resolves unquoted deployment aliases in relations, notes and nested groups',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nnode Production as host [tone=green] {\ncomponent Order-Service as orders <<service>> $public\nnote right: Handles orders\nfile Settings.json as config\norders -> config\n}\nqueue Pending as pending\norders -> pending';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.model.nodes.find(n=>n.id==='host')).toMatchObject({label:'Production',shape:'container',attributes:{tone:'green'}});
 expect(instance.model.nodes.find(n=>n.id==='orders')).toMatchObject({label:'Order-Service',parentId:'host',attributes:{stereotype:'service'}});
 expect(instance.model.nodes.some(n=>n.attributes.annotationTarget==='orders')).toBe(true);
 expect(instance.model.nodes.find(n=>n.id==='config')!.label).toBe('Settings.json');
 expect(instance.model.connections.map(e=>[e.from,e.to])).toEqual([['orders','config'],['orders','pending']]);
 instance.update(source+'\nhide orders');
 expect(instance.svg.querySelector('[data-node-id="orders"]')).toBeNull();
 instance.update(source+'\nremove *\nrestore $public');
 expect(instance.model.nodes.find(n=>n.id==='orders')!.attributes.removed).toBe('false');
 instance.destroy();
});

it('supports hexagon groups with contained labels, aliases and icons',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nhexagon "Processing zone with descriptive heading" as zone {\nhexagon {\nhexagon "Process request" as process [icon=server]\n}\n}\ncomponent Client\nClient -> process';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  expect(instance.svg.querySelectorAll('.finch-hexagon-outline')).toHaveLength(2);
  expect(instance.svg.querySelector('.finch-shape-hexagon .finch-node-icon')).not.toBeNull();
  for(const group of instance.geometry.nodes.filter(n=>n.attributes.containerStyle==='hexagon')){
   for(const child of instance.geometry.nodes.filter(n=>n.parentId===group.id)){
    expect(child.x-group.x).toBeGreaterThanOrEqual(20);
    expect(group.x+group.width-child.x-child.width).toBeGreaterThanOrEqual(20);
    expect(child.y-group.y).toBeGreaterThanOrEqual(group.headerHeight!);
   }
  }
 }
 instance.update(source+'\nremove hexagon');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['Client']);
 instance.destroy();
});

it('supports standalone and nested card declarations with aliases and display controls',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\ncard "Work items" as board {\ncard {\ncard "Review settings" as task $work\n}\n}\ncomponent App\nApp -> task';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.svg.querySelectorAll('.finch-card-outline')).toHaveLength(2);
 expect(instance.svg.querySelector('.finch-shape-card')!.textContent).toContain('Review settings');
 expect(instance.model.nodes.find(n=>n.id==='task')!.shape).toBe('card');
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-card-outline')).toHaveLength(2);
 instance.update(source+'\nhide $work');
 expect(instance.svg.querySelector('.finch-shape-card')).toBeNull();
 instance.update(source+'\nremove card');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('hides default artifact stereotypes and avoids duplicating explicit stereotypes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nartifact Default\nartifact Custom <<executable>>\nartifact Explicit <<artifact>>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const texts=()=>[...instance.svg.querySelectorAll('.finch-shape-uml-artifact')].map(n=>n.textContent!);
 expect(texts().join(' ').match(/«artifact»/g)).toHaveLength(2);
 expect(texts().find(t=>t.includes('Custom'))).not.toContain('«artifact»');
 expect(texts().find(t=>t.includes('Custom'))).toContain('«executable»');
 instance.update(source+'\nhide stereotype');
 expect(texts().join(' ')).not.toContain('«');
 instance.setTheme('midnight');
 expect(texts().join(' ')).not.toContain('«');
 instance.update(source+'\nhide stereotype\nshow artifact stereotype');
 expect(texts().join(' ').match(/«artifact»/g)).toHaveLength(2);
 expect(texts().join(' ')).toContain('«executable»');
 instance.destroy();
});

it('groups files inside artifacts with aliases, nesting and stereotype control',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nartifact "Application bundle" as bundle {\nartifact {\nfile config "Settings.json"\n}\n}\ncomponent App\nApp -> config';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.filter(n=>n.attributes.containerStyle==='artifact')).toHaveLength(2);
 expect(instance.svg.querySelectorAll('.finch-artifact-outline')).toHaveLength(2);
 expect(instance.svg.textContent).toContain('«artifact»');
 const config=instance.geometry.nodes.find(n=>n.id==='config')!;
 const parent=instance.geometry.nodes.find(n=>n.id===config.parentId)!;
 expect(config.y-parent.y).toBeGreaterThanOrEqual(parent.headerHeight!);
 instance.update(source+'\nhide artifact stereotype');
 expect(instance.svg.textContent).not.toContain('«artifact»');
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-artifact-outline')).toHaveLength(2);
 instance.update(source+'\nremove artifact');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['App']);
 instance.destroy();
});

it('updates nonrectangular group outlines when their geometry grows and shrinks',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['file','queue','cloud','database','node','folder','frame']){
  const instance=createFinch().render(`@deployment\n${kind} group {\ncomponent Child\n}`,{target:'#diagram',editor:false});
  const geometry=instance.geometry,node=geometry.nodes.find(n=>n.id==='group')!;
  const renderer=new SvgRenderer(document,defaultTheme,name=>builtInShapes.find(shape=>shape.name===name)!,'Resize');
  renderer.draw(geometry);
  const outline=renderer.svg.querySelector(`.finch-${kind}-outline`)!;
  const initial=outline.getAttribute('d'),width=node.width,height=node.height;
  node.width+=100;node.height+=80;
  renderer.updateGeometry(geometry);
  expect(outline.getAttribute('d')).not.toBe(initial);
  const fresh=new SvgRenderer(document,defaultTheme,name=>builtInShapes.find(shape=>shape.name===name)!,'Fresh');
  fresh.draw(geometry);
  expect(outline.getAttribute('d')).toBe(fresh.svg.querySelector(`.finch-${kind}-outline`)!.getAttribute('d'));
  node.width=width;node.height=height;renderer.updateGeometry(geometry);
  expect(outline.getAttribute('d')).toBe(initial);
  instance.destroy();
 }
});

it('contains nested file groups and preserves their outline on updates',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nfile "Configuration bundle with environment settings" as bundle {\nfile {\nfile config "Settings.json"\n}\n}\ncomponent App\nApp -> config';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const groups=instance.geometry.nodes.filter(n=>n.attributes.containerStyle==='file');
  expect(groups).toHaveLength(2);
  expect(instance.svg.querySelectorAll('.finch-file-outline')).toHaveLength(2);
  expect(instance.svg.querySelectorAll('.finch-shape-uml-file')).toHaveLength(1);
  for(const group of groups)for(const child of instance.geometry.nodes.filter(n=>n.parentId===group.id)){
   expect(child.y-group.y).toBeGreaterThanOrEqual(group.headerHeight!);
   expect(child.x).toBeGreaterThan(group.x);
   expect(child.x+child.width).toBeLessThan(group.x+group.width);
  }
 }
 instance.update(source+'\nhide bundle');
 expect(instance.svg.querySelector('.finch-shape-uml-file')).toBeNull();
 instance.update(source);
 expect(instance.svg.querySelectorAll('.finch-file-outline')).toHaveLength(2);
 instance.destroy();
});

it('supports file aliases, metadata, notes and kind-based display controls',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nfile "Settings.json" as config <<document>> $public\nnote right: Application settings\ncomponent App\nApp -> config';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.model.nodes.find(n=>n.id==='config')).toMatchObject({shape:'uml-file',attributes:{stereotype:'document'}});
 expect(instance.svg.querySelector('.finch-shape-uml-file')!.textContent).toContain('Settings.json');
 expect(instance.svg.querySelector('.finch-shape-uml-file')!.textContent).not.toContain('«artifact»');
 expect(instance.model.nodes.some(n=>n.attributes.annotationTarget==='config')).toBe(true);
 instance.setTheme('midnight');
 expect(instance.svg.querySelector('.finch-shape-uml-file')).not.toBeNull();
 instance.update(source+'\nremove file');
 expect(instance.geometry.nodes.some(n=>n.id==='config')).toBe(false);
 instance.update(source+'\nremove file\nrestore $public');
 expect(instance.svg.querySelector('.finch-shape-uml-file')).not.toBeNull();
 instance.destroy();
});

it('renders nested and anonymous queue groups with room inside the cylinder ends',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\nqueue "Message pipeline" as pipeline {\nqueue {\ncomponent Worker\n}\n}\ncomponent Client\nClient -> Worker';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const groups=instance.geometry.nodes.filter(n=>n.attributes.containerStyle==='queue');
  expect(groups).toHaveLength(2);
  expect(instance.svg.querySelectorAll('.finch-queue-outline')).toHaveLength(2);
  for(const group of groups)for(const child of instance.geometry.nodes.filter(n=>n.parentId===group.id)){
   expect(child.x-group.x).toBeGreaterThanOrEqual(20);
   expect(group.x+group.width-child.x-child.width).toBeGreaterThanOrEqual(20);
   expect(child.y-group.y).toBeGreaterThanOrEqual(group.headerHeight!);
  }
 }
 instance.update(source.replace('Message pipeline','Message pipeline with a longer descriptive heading'));
 expect(instance.svg.querySelectorAll('.finch-queue-outline')).toHaveLength(2);
 instance.destroy();
});

it('distinguishes queue cylinders from databases across themes and source updates',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\ncomponent Producer\nqueue "Pending order messages" as messages\ndatabase Store\nProducer -> messages\nmessages -> Store';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const node=instance.geometry.nodes.find(n=>n.id==='messages')!;
  expect(node.shape).toBe('queue');
  const cap=instance.svg.querySelector('.finch-shape-queue ellipse')!;
  expect(Number(cap.getAttribute('cy'))).toBe(node.height/2);
  expect(Number(cap.getAttribute('ry'))).toBe(node.height/2);
  expect(Number(cap.getAttribute('cx'))).toBe(node.width-10);
  expect(instance.svg.querySelector('.finch-shape-database')).not.toBeNull();
  expect(instance.geometry.edges).toHaveLength(2);
 }
 instance.update(source.replace('Pending order messages','Messages awaiting processing and downstream delivery'));
 expect(instance.svg.querySelector('.finch-shape-queue')!.textContent).toContain('Messages awaiting');
 instance.destroy();
});

it('keeps component-like text literal inside block link notes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['note','rnote','hnote'])for(const side of ['', 'left ', 'right ', 'top ', 'bottom ']){
  const source=`@component\ncomponent A\ncomponent B\nA -> B\n${kind} ${side}on link\ncomponent Example [\nThis is documentation, not a declaration\nend ${kind}\ncomponent Actual [\nReal description\n]`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const annotation=instance.model.nodes.find(n=>n.attributes.annotationTarget);
  expect(annotation!.label).toContain('component Example [');
  expect(instance.model.nodes.some(n=>n.id==='Example')).toBe(false);
  expect(instance.model.nodes.find(n=>n.id==='Actual')!.label).toBe('Real description');
  expect(instance.svg.textContent).toContain('This is documentation');
  expect(instance.model.source).toBe(source);
  instance.destroy();
 }
});

it('keeps quoted display targets distinct from kind and unlinked selectors',()=>{
 for(const selector of ['"component"','[component]','"unlinked"','[unlinked]']){
  const model=parseDeployment(`@component\ncomponent component\ncomponent unlinked\ncomponent other\nhide ${selector}`);
  const target=selector.includes('component')?'component':'unlinked';
  expect(model.nodes.filter(n=>n.attributes.hidden==='true').map(n=>n.id)).toEqual([target]);
 }
 expect(()=>parseDeployment('@component\ncomponent other\nhide "component"')).toThrow('Unknown display target');
});

it('accepts empty declaration-kind selections for reusable display rules',()=>{
 const kinds=['server','container','actor','rounded','system','external','usecase','device','execution','queue'];
 for(const kind of kinds){
  expect(()=>parseDeployment(`@deployment\ncomponent other\nhide ${kind}\nshow ${kind}\nremove ${kind}\nrestore ${kind}`)).not.toThrow();
  const model=parseDeployment(`@deployment\n${kind} target\ncomponent other\nhide ${kind}`);
  expect(model.nodes.find(n=>n.id==='target')!.attributes.hidden).toBe('true');
  expect(model.nodes.find(n=>n.id==='other')!.attributes.hidden).not.toBe('true');
 }
});

it('keeps hidden components in layout and removes selected components without losing source',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\n[A] -- [B]\ncomponent C\nhide A\nremove C';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.id)).toContain('A');
 expect(instance.geometry.nodes.map(n=>n.id)).not.toContain('C');
 expect(instance.svg.querySelector('[data-node-id="A"]')).toBeNull();
 expect(instance.geometry.edges[0]!.attributes?.hidden).toBe('true');
 instance.update(source+'\nshow A\nrestore C');
 expect(instance.svg.querySelector('[data-node-id="A"]')).not.toBeNull();
 expect(instance.geometry.nodes.map(n=>n.id)).toContain('C');
 expect(instance.geometry.edges[0]!.attributes?.hidden).not.toBe('true');
 instance.destroy();
});

it('cascades group display to descendants and removes attached notes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@deployment\npackage group {\ncomponent A\n}\ncomponent B\nA -- B\nnote right of A "Detail"';
 const instance=createFinch().render(source+'\nremove group',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['B']);
 expect(instance.geometry.edges).toHaveLength(0);
 instance.update(source+'\nhide group');
 expect(instance.geometry.nodes.find(n=>n.id==='A')!.attributes.hidden).toBe('true');
 expect(instance.svg.querySelector('[data-node-id="A"]')).toBeNull();
 instance.update(source+'\nhide group\nshow group');
 expect(instance.svg.querySelector('[data-node-id="A"]')).not.toBeNull();
 expect(instance.geometry.nodes.some(n=>n.attributes.annotationTarget==='A')).toBe(true);
 instance.destroy();
});

it('selects implicit components by kind and supports unlinked and bracket names',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\n[Order service] -- [Billing]\ncomponent Unused\nhide component\nshow [Order service]\nremove unlinked',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.label==='Order service')!.attributes.hidden).toBe('false');
 expect(instance.geometry.nodes.find(n=>n.label==='Billing')!.attributes.hidden).toBe('true');
 expect(instance.geometry.nodes.some(n=>n.id==='Unused')).toBe(false);
 instance.destroy();
 expect(()=>parseDeployment('@deployment\ncomponent A\nhide missing')).toThrow('Unknown display target');
});

it('selects tags and stereotypes after resolving declarations and preserves labels literally',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\nremove $internal\nrestore <<public>>\ntag A internal worker\ntag B internal\ncomponent A "Cost $5" [stereotype=public]\ncomponent B "Private"\nA -- B';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['A']);
 expect(instance.geometry.nodes[0]!.label).toBe('Cost $5');
 expect(JSON.parse(instance.geometry.nodes[0]!.attributes.tags!)).toEqual(['internal','worker']);
 instance.update(source+'\nrestore $internal');
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['A','B']);
 expect(instance.geometry.edges).toHaveLength(1);
 instance.destroy();
 expect(()=>parseDeployment('@deployment\ncomponent A\ntag missing internal')).toThrow('Unknown tag target');
 expect(()=>parseDeployment('@deployment\ncomponent A\nhide $absent\nremove <<absent>>')).not.toThrow();
});

it('accepts inline declaration tags and stereotypes with aliases and groups',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\npackage "Services" as group $internal {\n[Order $5 <<literal>>] as A <<public>> $internal $worker\ncomponent B as "Billing" $internal [tone=blue]\n}\nA -- B: literal $worker\nremove $worker\nrestore <<public>>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const a=instance.geometry.nodes.find(n=>n.id==='A')!;
 expect(a.label).toBe('Order $5 <<literal>>');
 expect(a.attributes.stereotype).toBe('public');
 expect(JSON.parse(a.attributes.tags!)).toEqual(['internal','worker']);
 expect(a.parentId).toBe('group');
 expect(instance.geometry.edges[0]!.label).toBe('literal $worker');
 instance.update(source+'\nremove $internal');
 expect(instance.geometry.nodes).toHaveLength(0);
 instance.destroy();
});

it('preserves multiple stereotypes and hides their text without hiding the component',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent A "Orders" <<service>> <<public>> <<service>>\nremove *\nrestore <<service>>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes).toHaveLength(1);
 expect(JSON.parse(instance.geometry.nodes[0]!.attributes.stereotypes!)).toEqual(['service','public']);
 expect(instance.svg.textContent).toContain('«service, public»');
 instance.update(source+'\nhide stereotype');
 expect(instance.svg.querySelector('[data-node-id="A"]')).not.toBeNull();
 expect(instance.svg.textContent).not.toContain('«service, public»');
 instance.update(source+'\nhide stereotype\nshow <<public>> stereotype');
 expect(instance.svg.textContent).toContain('«service, public»');
 instance.destroy();
});

it('preserves multiline descriptions with attributes and inline display metadata',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent A [tone=cyan] [\nOrder service\nremove $internal\n] <<service>> $public\nremove *\nrestore $public';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes[0]!;
 expect(node.id).toBe('A');
 expect(node.attributes.tone).toBe('cyan');
 expect(node.attributes.stereotype).toBe('service');
 expect(node.label).toContain('remove $internal');
 expect(instance.svg.textContent).toContain('Order service');
 instance.setTheme('midnight');
 expect(instance.geometry.nodes[0]!.attributes.stereotype).toBe('service');
 instance.destroy();
});

it('accepts colon notes on explicit aliases and implicitly declared components',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['note','rnote','hnote','constraint']){
  const source=`@component\n[Order service] as orders\norders -- [Billing]\n${kind} right of orders: Public API\n${kind} left of Billing: Billing API`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
  expect(notes).toHaveLength(2);
  expect(notes.map(node=>node.attributes.annotationTarget)).toEqual(['orders','Billing']);
  expect(notes.map(node=>node.label)).toEqual(kind==='constraint'?['{Public API}','{Billing API}']:['Public API','Billing API']);
  instance.update(source+'\nremove Billing');
  expect(instance.geometry.nodes.filter(node=>node.attributes.annotationTarget)).toHaveLength(1);
  instance.destroy();
 }
});

it('attaches shorthand notes to aliased component declarations inside groups',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\npackage group {\n[Order service] as orders <<service>> $public\nnote right: Orders detail\ncomponent B "Billing" [tone=cyan]\nrnote left: Billing detail\n}';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
 expect(notes.map(node=>node.attributes.annotationTarget)).toEqual(['orders','B']);
 expect(notes.map(node=>node.label)).toEqual(['Orders detail','Billing detail']);
 instance.update(source+'\nremove orders');
 expect(instance.geometry.nodes.filter(node=>node.attributes.annotationTarget).map(node=>node.label)).toEqual(['Billing detail']);
 instance.destroy();
});

it('attaches link notes to each preceding component relation including directional arrows',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\n[A] -right-> [B]\nnote on link: First connection\n[B] -- [C] [fromPort=right toPort=left]\nrnote on link: Second connection';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edges=instance.model.connections,notes=instance.geometry.nodes.filter(n=>n.attributes.annotationTarget);
 expect(notes.map(n=>n.attributes.annotationTarget)).toEqual(edges.map(e=>e.id));
 expect(notes.map(n=>n.label)).toEqual(['First connection','Second connection']);
 instance.update(source+'\nremove C');
 expect(instance.geometry.nodes.filter(n=>n.attributes.annotationTarget).map(n=>n.label)).toEqual(['First connection']);
 instance.destroy();
});

it('infers quoted interfaces with stable identities and allows later explicit declarations',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\npackage group {\n[Service] -- "Public API"\n"Public API" -- [Worker]\n}\nnote right of "Public API": Shared contract';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const api=instance.geometry.nodes.find(n=>n.label==='Public API')!;
 expect(api.shape).toBe('uml-provided-interface');
 expect(api.parentId).toBe('group');
 expect(instance.model.nodes.filter(n=>n.label==='Public API')).toHaveLength(1);
 expect(instance.geometry.nodes.some(n=>n.attributes.annotationTarget===api.id)).toBe(true);
 instance.update(source+'\nprovided "Public API" [tone=cyan]');
 expect(instance.geometry.nodes.find(n=>n.id===api.id)!.attributes.tone).toBe('cyan');
 instance.destroy();
 expect(()=>parseDeployment('@deployment\ncomponent service\nservice -- "Missing API"')).toThrow('unknown node');
});

it('supports anonymous nested groups without colliding with explicit node IDs',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent __anonymous_group_1\ncloud [tone=cyan] {\npackage {\n[A] -- [B]\n}\n}\nfolder {}';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const cloud=instance.geometry.nodes.find(n=>n.attributes.containerStyle==='cloud')!;
 const a=instance.geometry.nodes.find(n=>n.id==='A')!;
 const parent=instance.geometry.nodes.find(n=>n.id===a.parentId)!;
 expect(cloud.label).toBe('');
 expect(cloud.attributes.tone).toBe('cyan');
 expect(parent.parentId).toBe(cloud.id);
 expect(cloud.id).not.toBe('__anonymous_group_1');
 const ids=instance.geometry.nodes.map(n=>n.id);
 instance.update(instance.exportState().source);
 expect(instance.geometry.nodes.map(n=>n.id)).toEqual(ids);
 expect(instance.geometry.nodes.filter(n=>n.shape==='container')).toHaveLength(3);
 instance.destroy();
});

it('supports rectangle nodes and nested rectangle groups with metadata and aliases',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment']){
  const source=`@${kind}\nrectangle "Platform" as platform <<system>> {\nrectangle "Backend" as backend $internal {\ncomponent service\n}\nrectangle gateway "Gateway"\ngateway -> service\n}\nrectangle {}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.geometry.nodes.find(n=>n.id==='platform')).toMatchObject({shape:'container',label:'Platform'});
  expect(instance.geometry.nodes.find(n=>n.id==='backend')).toMatchObject({shape:'container',parentId:'platform'});
  expect(instance.geometry.nodes.find(n=>n.id==='gateway')).toMatchObject({shape:'rectangle',parentId:'platform'});
  instance.update(source+'\nremove $internal');
  expect(instance.geometry.nodes.some(n=>n.id==='service')).toBe(false);
  expect(instance.geometry.nodes.some(n=>n.id==='gateway')).toBe(true);
  instance.destroy();
 }
});

it('renders nested component boundaries and retains their component notation',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent "Platform" as platform {\ncomponent child {\ncomponent worker\n}\ncomponent gateway\ngateway -> worker\n}';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='platform')).toMatchObject({shape:'container',attributes:{containerStyle:'component'}});
 expect(instance.geometry.nodes.find(n=>n.id==='worker')!.parentId).toBe('child');
 expect(instance.svg.querySelectorAll('.finch-component-group-mark')).toHaveLength(2);
 instance.update(source+'\ncomponentStyle rectangle');
 expect(instance.svg.querySelectorAll('.finch-component-group-mark')).toHaveLength(0);
 instance.destroy();
});

it('supports the PlantUML unlinked selector across class and component diagrams',()=>{
 for(const kind of ['class','component','deployment']){
  document.body.innerHTML='<div id="diagram"></div>';
  const declaration=kind==='class'?'class':'component';
  const source=`@${kind}\n${declaration} A\n${declaration} B\n${declaration} C\nA -- B`;
  const instance=createFinch().render(source+'\nremove @unlinked',{target:'#diagram',editor:false});
  expect(instance.geometry.nodes.map(n=>n.id)).toEqual(['A','B']);
  instance.update(source+'\nhide @unlinked');
  expect(instance.geometry.nodes.find(n=>n.id==='C')!.attributes.hidden).toBe('true');
  instance.update(source+'\nremove @unlinked\nrestore @unlinked');
  expect(instance.svg.querySelector('[data-node-id="C"]')).not.toBeNull();
  instance.destroy();
 }
});

it('switches enclosing component notation between UML1, UML2, and rectangle',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent parent {\ncomponent child\n}';
 const instance=createFinch().render(source+'\ncomponentStyle uml1',{target:'#diagram',editor:false});
 const mark=()=>instance.svg.querySelector('.finch-component-group-mark');
 expect(mark()!.getAttribute('transform')).toBe('translate(0 0)');
 expect(mark()!.querySelectorAll('rect')).toHaveLength(2);
 expect(mark()!.querySelector('rect')!.getAttribute('x')).toBe('-6');
 instance.setTheme('midnight');
 expect(mark()!.querySelectorAll('rect')).toHaveLength(2);
 instance.update(source+'\ncomponentStyle uml2');
 expect(mark()!.querySelectorAll('rect')).toHaveLength(3);
 instance.update(source+'\ncomponentStyle rectangle');
 expect(mark()).toBeNull();
 instance.destroy();
});

it('accepts compact component arrows without splitting hyphenated IDs',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const operator of ['->','-->','--','..>','<-','<--','-left->']){
  const instance=createFinch().render(`@component\ncomponent order-api\ncomponent billing-api\norder-api${operator}billing-api: request\nnote on link: Contract`,{target:'#diagram',editor:false});
  const edge=instance.model.connections[0]!;
  expect([edge.from,edge.to].sort()).toEqual(['billing-api','order-api']);
  expect(instance.model.nodes.filter(n=>!n.attributes.annotationTarget)).toHaveLength(2);
  expect(instance.geometry.nodes.some(n=>n.attributes.annotationTarget===edge.id)).toBe(true);
  instance.destroy();
 }
 const instance=createFinch().render('@component\n[Order service]->"Public API"',{target:'#diagram',editor:false});
 expect(instance.model.nodes.map(n=>n.label).sort()).toEqual(['Order service','Public API']);
 instance.destroy();
});

it('does not mistake direction words inside IDs for a directional relation',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const word of ['left','right','up','down','l','r','u','d']){
  const id=`order-${word}-api`;
  const instance=createFinch().render(`@component\ncomponent ${id}\ncomponent billing-api\n${id}--billing-api\nnote on link: Contract`,{target:'#diagram',editor:false});
  expect(instance.model.connections[0]).toMatchObject({from:id,to:'billing-api'});
  expect(instance.model.connections[0]!.attributes?.layoutDirection).toBeUndefined();
  expect(instance.model.nodes.filter(n=>!n.attributes.annotationTarget)).toHaveLength(2);
  instance.destroy();
 }
});

it('rejects cyclic containment and non-container parents before layout',()=>{
 expect(()=>parseDeployment('@deployment\npackage a {}\na inside a')).toThrow('Containment cycle');
 expect(()=>parseDeployment('@deployment\npackage a {}\npackage b {}\na inside b\nb inside a')).toThrow('Containment cycle');
 expect(()=>parseDeployment('@deployment\ncomponent a\ncomponent b\na inside b')).toThrow('not a group');
 const model=parseDeployment('@deployment\ncomponent a\npackage b {}\na inside b');
 expect(model.nodes.find(n=>n.id==='a')!.parentId).toBe('b');
});

it('ignores trailing comments when resolving shorthand element and link notes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\n[Order #1] as orders // declaration\nnote right: Details\ncomponent worker\norders -> worker # relation\nnote on link: First link\nworker -> orders [fromPort=left] // reverse\nrnote on link: Second link';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const notes=instance.geometry.nodes.filter(n=>n.attributes.annotationTarget);
 expect(notes.map(n=>n.attributes.annotationTarget)).toEqual(['orders',...instance.model.connections.map(e=>e.id)]);
 expect(instance.model.nodes.find(n=>n.id==='orders')!.label).toBe('Order #1');
 expect(notes.map(n=>n.label)).toEqual(['Details','First link','Second link']);
 instance.destroy();
});

it('honors explicit self-relation ports and keeps the route outside the node after moving',()=>{
 const sides=['top','right','bottom','left'] as const;
 for(const shape of ['rectangle','person','actor']){
  for(const from of sides)for(const to of sides){
   if(from===to && shape==='actor')continue;
   const instance=createFinch().render(`@deployment\n${shape} User\nUser -> User [fromPort=${from} toPort=${to}]`,{editor:false});
   const verify=()=>{
    const node=instance.geometry.nodes[0]!,p=instance.geometry.edges[0]!.points;
    const direction={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
    const first=p[0]!,next=p[1]!,last=p[p.length-1]!,prev=p[p.length-2]!;
    expect((next.x-first.x)*direction[from].x+(next.y-first.y)*direction[from].y).toBeGreaterThan(0);
    expect((prev.x-last.x)*direction[to].x+(prev.y-last.y)*direction[to].y).toBeGreaterThan(0);
    for(let i=1;i<p.length;i++)expect(p[i]!.x===p[i-1]!.x || p[i]!.y===p[i-1]!.y).toBe(true);
    // Every middle segment stays outside the full label-bearing bounds.
    for(let i=2;i<p.length-1;i++){
     const a=p[i-1]!,b=p[i]!;
     expect(Math.max(a.x,b.x)<=node.x || Math.min(a.x,b.x)>=node.x+node.width ||
      Math.max(a.y,b.y)<=node.y || Math.min(a.y,b.y)>=node.y+node.height).toBe(true);
    }
   };
   verify();
   instance.importLayout({version:1,diagram:'deployment',nodes:{User:{x:360,y:240,manual:true,pinned:true}}});
   verify();instance.destroy();
  }
 }
});

it('separates same-side person loop endpoints on the head circumference',()=>{
 const instance=createFinch().render('@deployment\nperson User\nUser -> User [fromPort=top toPort=top]',{editor:false});
 const n=instance.geometry.nodes[0]!,p=instance.geometry.edges[0]!.points;
 expect(p[0]!.x).not.toBe(p[p.length-1]!.x);
 for(const q of [p[0]!,p[p.length-1]!]){
  expect((q.x-n.x-n.width/2)**2+(q.y-n.y-16)**2).toBeCloseTo(256);
 }
 instance.destroy();
});

it('reads relation attributes without requiring port attributes and preserves bracket endpoints',()=>{
 for(const kind of ['component','deployment','usecase']){
  const instance=createFinch().render(`@${kind}\ncomponent A\ncomponent B\nA -> B [relation=realization custom="text ] detail"]\nnote on link: Contract`,{editor:false});
  expect(instance.model.connections[0]!.attributes).toMatchObject({relation:'realization',custom:'text ] detail'});
  expect(instance.svg.querySelector('[marker-end="url(#finch-triangle)"]')).not.toBeNull();
  instance.destroy();
 }
 const model=parseDeployment('@deployment\n[A] -> [key=value]');
 expect(model.nodes.some(n=>n.label==='key=value')).toBe(true);
});

it('keeps explicit semantic relation kinds consistent with line styles',()=>{
 for(const kind of ['component','deployment','usecase']){
  for(const relation of ['realization','dependency','inheritance','aggregation','composition','association']){
   for(const arrow of ['->','..>','--']){
    const instance=createFinch().render(`@${kind}\ncomponent A\ncomponent B\nA ${arrow} B [relation=${relation}]`,{editor:false});
    const edge=instance.model.connections[0]!;
    expect(edge.attributes?.relation).toBe(relation);
    expect(edge.dashed).toBe(['realization','dependency'].includes(relation));
    instance.destroy();
   }
  }
 }
 expect(parseDeployment('@deployment\ncomponent A\ncomponent B\nA ..|> B [relation=association]').connections[0]).toMatchObject({dashed:true,attributes:{relation:'realization'}});
});

it('preserves dotted ownership lines, navigation and notes in both directions',()=>{
 for(const kind of ['component','deployment','usecase'])for(const symbol of ['o','*'])for(const reverse of [false,true])for(const navigation of [false,true]){
  const link=reverse ? `Part ${navigation?'<':''}..${symbol} Owner` : `Owner ${symbol}..${navigation?'>':''} Part`;
  const source=`@${kind}\ncomponent Owner\ncomponent Part\n${link} [fromPort=right]\nnote on link: Contains`;
  const instance=createFinch().render(source,{editor:false});
  const verify=()=>{
   const edge=instance.model.connections[0]!;
   expect(edge).toMatchObject({from:'Owner',to:'Part',dashed:true,attributes:{relation:symbol==='o'?'aggregation':'composition',fromPort:'right'}});
   const path=instance.svg.querySelector('.finch-edge')!;
   expect(path.getAttribute('marker-start')).toBe(`url(#finch-diamond-${symbol==='o'?'open':'filled'})`);
   expect(path.getAttribute('marker-end')).toBe(navigation?'url(#finch-open-arrow)':null);
   expect(path.hasAttribute('stroke-dasharray')).toBe(true);
   expect(instance.model.nodes.find(n=>n.label==='Contains')?.attributes.annotationTarget).toBe(edge.id);
  };
  verify();instance.setTheme('midnight');verify();instance.destroy();
 }
});

it('supports multiline descriptions on additional deployment symbols',()=>{
 for(const shape of ['agent','person','collections','actor','actor/','boundary','control','entity','label']){
  const source=`@deployment\n${shape} Owner [\nOperations\nhide component\n] [tone=green]\ncomponent Peer\nOwner -> Peer`;
  const instance=createFinch().render(source,{editor:false});
  const verify=()=>{
   const owner=instance.model.nodes.find(n=>n.id==='Owner')!;
   expect(owner.label).toBe('Operations\\nhide component');
   expect(owner.attributes.tone).toBe('green');
   expect(instance.model.nodes.some(n=>n.id==='Peer')).toBe(true);
   expect(instance.svg.textContent).toContain('hide component');
  };
  verify();instance.setTheme('midnight');verify();
  expect(instance.exportState().source).toBe(source);
  instance.destroy();
 }
});

it('keeps bracket-leading prose inside descriptions while recognizing decorated closing lines',()=>{
 for(const suffix of ['', ' [tone=green]', ' <<service>> $backend', ' // end', ' # end']){
  const source=`@deployment\ncomponent A [\n] is a bracket\n] ordinary prose [x=y]\nDone\n]${suffix}\ncomponent B\nA -> B`;
  const model=parseDeployment(source);
  expect(model.nodes.find(n=>n.id==='A')?.label).toBe('] is a bracket\\n] ordinary prose [x=y]\\nDone');
  expect(model.nodes.some(n=>n.id==='B')).toBe(true);
  expect(model.connections).toHaveLength(1);
 }
});

it('renders bold deployment links and arrows across themes and source updates',()=>{
 for(const operator of ['==','==>','<==','<==>']){
  const source=`@deployment\nnode A\nnode B\nA ${operator} B\nnote on link: Transport`;
  const instance=createFinch().render(source,{editor:false});
  expect(instance.model.connections[0]).toMatchObject({from:operator==='<=='?'B':'A',to:operator==='<=='?'A':'B',dashed:false,attributes:{lineStyle:'bold'}});
  for(const theme of ['default','midnight']){
   if(theme==='midnight')instance.setTheme(theme);
   const width=Number(instance.svg.querySelector('.finch-edge')!.getAttribute('stroke-width'));
   instance.update(source.replace(operator,'->'));
   expect(Number(instance.svg.querySelector('.finch-edge')!.getAttribute('stroke-width'))).toBe(width/2);
   instance.update(source);
  }
  expect(instance.model.nodes.some(n=>n.label==='Transport')).toBe(true);
  instance.destroy();
 }
});

it('overrides the line pattern while preserving UML relation markers',()=>{
 for(const operator of ['..|>','o-->','*-->']){
  for(const style of ['plain','dashed','dotted']){
   const source=`@deployment\ncomponent A\ncomponent B\nA ${operator} B [lineStyle=${style}]`;
   const instance=createFinch().render(source,{editor:false});
   const verify=()=>{
    const path=instance.svg.querySelector('.finch-edge')!;
    expect(path.getAttribute('stroke-dasharray')).toBe(style==='plain'?null:style==='dotted'?'1 5':'6 5');
    if(operator==='..|>')expect(path.getAttribute('marker-end')).toBe('url(#finch-triangle)');
    else expect(path.getAttribute('marker-start')).toBe(`url(#finch-diamond-${operator[0]==='o'?'open':'filled'})`);
   };
   verify();instance.setTheme('midnight');verify();instance.update(source);verify();instance.destroy();
  }
 }
});

it('accepts bracketed arrow styles without interpreting style names as directions',()=>{
 for(const style of ['bold','dashed','dotted','plain'])for(const reverse of [false,true]){
  const source=`@component\n[A] ${reverse?'<':''}-[${style}]-${reverse?'':'>'} [B]\nnote on link: Styled`;
  const instance=createFinch().render(source,{editor:false});
  const edge=instance.model.connections[0]!;
  expect(edge).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B',attributes:{lineStyle:style}});
  expect(edge.attributes?.layoutDirection).toBeUndefined();
  expect(instance.model.nodes.find(n=>n.label==='Styled')?.attributes.annotationTarget).toBe(edge.id);
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('stroke-dasharray')).toBe(['plain','bold'].includes(style)?null:style==='dotted'?'1 5':'6 5');
  expect(instance.exportState().source).toBe(source);
  instance.destroy();
 }
});

it('supports numeric arrow thickness combined with line styles',()=>{
 for(const style of ['thickness=4','dotted,thickness=2.5','thickness=3, bold']){
  const instance=createFinch().render(`@deployment\nnode A\nnode B\nA -[${style}]-> B\nnote on link: Width`,{editor:false});
  for(const theme of ['default','midnight']){
   if(theme==='midnight')instance.setTheme(theme);
   const path=instance.svg.querySelector('.finch-edge')!;
   expect(Number(path.getAttribute('stroke-width'))).toBe(Number(style.match(/thickness=([\d.]+)/)![1]));
   expect(path.getAttribute('stroke-dasharray')).toBe(style.includes('dotted')?'1 5':null);
  }
  instance.destroy();
 }
 for(const value of ['0','-1','NaN','Infinity'])expect(()=>parseDeployment(`@deployment\nnode A\nnode B\nA -[thickness=${value}]-> B`)).toThrow('positive finite');
});

it('validates trailing thickness attributes and preserves valid widths on update',()=>{
 for(const value of ['0','-2','NaN','Infinity','" "','oops']){
  expect(()=>parseDeployment(`@deployment\nnode A\nnode B\nA -> B [thickness=${value}]`)).toThrow('positive finite');
 }
 const source='@deployment\nnode A\nnode B\nA -> B [thickness=2.5]';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelector('.finch-edge')?.getAttribute('stroke-width')).toBe('2.5');
 instance.update(source.replace('2.5','5'));
 expect(instance.svg.querySelector('.finch-edge')?.getAttribute('stroke-width')).toBe('5');
 instance.destroy();
});

it('colors lines and ownership markers consistently across themes',()=>{
 const instance=createFinch().render('@deployment\nnode A\nnode B\nA *--> B [lineColor=red]\nB -[#336699,dotted,thickness=3]-> A',{editor:false});
 for(const theme of ['default','midnight']){
  if(theme==='midnight')instance.setTheme(theme);
  const paths=instance.svg.querySelectorAll('.finch-edge');
  expect(paths[0]!.getAttribute('stroke')).toBe('red');
  const ref=paths[0]!.getAttribute('marker-start')!;
  expect(instance.svg.querySelector(ref.slice(4,-1)+' path')?.getAttribute('fill')).toBe('red');
  expect(paths[1]!.getAttribute('stroke')).toBe('#336699');
 }
 instance.destroy();
});
