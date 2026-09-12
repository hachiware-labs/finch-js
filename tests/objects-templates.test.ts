// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseObject, parseClass } from '../src/index';

it('keeps object slots literal, underlines the instance heading and renders links',()=>{
 const source=`@object
object user "alice : User" {
 name = "Alice"
 callback = "run()"
}
object team "platform : Team"
user -- team: member of`;
 const model=parseObject(source);
 expect(model.kind).toBe('object');
 expect(JSON.parse(model.nodes[0]!.attributes.members!)).toEqual([{text:'name = "Alice"',kind:'attribute'},{text:'callback = "run()"',kind:'attribute'}]);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelector('text[text-decoration="underline"]')?.textContent).toBe('alice : User');
 expect(instance.geometry.edges).toHaveLength(1);
});

it('preserves generic parameters independently of classifier labels and renders their compartment',()=>{
 const source='@class\nclass Repository<K, V> {\n get(key: K): V\n}\nclass Client {\n}\nClient ..> Repository';
 expect(parseClass(source).nodes[0]?.attributes.templateParameters).toBe('K, V');
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelector('.finch-template-parameters')).not.toBeNull();
 expect(document.body.textContent).toContain('K, V');
});


it('adds literal slots outside the object body and applies display rules after slot classification',()=>{
 const source=`@object
 user : callback = "run()"
 object user {
  name = Alice
 }
 user : active = true
 object other
 other : id = 42
 hide user methods`;
 const model=parseObject(source);
 const user=model.nodes.find(n=>n.id==='user')!;
 expect(JSON.parse(user.attributes.slots!)).toEqual(['name = Alice','callback = "run()"','active = true']);
 expect(JSON.parse(user.attributes.hiddenMembers!)).toEqual([]);
 expect(JSON.parse(parseObject(source+'\nhide user fields').nodes[0]!.attributes.hiddenMembers!)).toEqual([0,1,2]);
 expect(()=>parseObject('@object\nmissing : id = 1')).toThrow(/Unknown object slot target/);
});


it('preserves classifier-like literal slots and rejects ignored map or JSON slot additions',()=>{
 const model=parseObject('@object\nobject sample {\nclass value {\n}\nsample : extra = 1\nobject next');
 expect(JSON.parse(model.nodes.find(n=>n.id==='sample')!.attributes.slots!)).toEqual(['class value {','extra = 1']);
 expect(model.nodes.some(n=>n.id==='next')).toBe(true);
 for(const declaration of ['map data {\nkey => value\n}', 'json data {"key":"value"}']){
  expect(()=>parseObject(`@object\n${declaration}\ndata : extra = 1`)).toThrow(/entries must be declared in its body/);
 }
});

it('preserves dotted association, aggregation and composition with multiplicities',()=>{
 const source='@object\nobject whole\nobject part\nwhole "1" *.. "many" part: owned\nwhole o.. part: shared\nwhole .. part: related';
 const model=parseObject(source);
 expect(model.connections.map(e=>[e.attributes?.relation,e.dashed])).toEqual([['composition',true],['aggregation',true],['association',true]]);
 expect(model.connections[0]!.attributes).toMatchObject({fromCardinality:'1',toCardinality:'many'});
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.edges.every(e=>e.dashed)).toBe(true);
 const paths=[...instance.svg.querySelectorAll('.finch-edge')];
 expect(paths.map(p=>p.getAttribute('stroke-dasharray'))).toEqual(['6 5','6 5','6 5']);
 expect(paths.map(p=>p.getAttribute('marker-start'))).toEqual(['url(#finch-diamond-filled)','url(#finch-diamond-open)',null]);
 expect(instance.svg.outerHTML).toContain('many');
 instance.destroy();
});

it('normalizes reverse relations without losing endpoint multiplicities',()=>{
 for(const [operator,relation] of [['--*','composition'],['..*','composition'],['--o','aggregation'],['..o','aggregation'],['<--','directed-association'],['<..','dependency']]){
  const model=parseObject(`@object\nobject part\nobject whole\npart "many" ${operator} "1" whole: owns`);
  expect(model.connections[0]).toMatchObject({from:'whole',to:'part',label:'owns',dashed:operator!.includes('..'),attributes:{relation,fromCardinality:'1',toCardinality:'many'}});
 }
 const model=parseClass('@class\nclass Part {\n value: string\n}\nclass Whole {\n items: Part[]\n}\nPart::value --* Whole::items');
 expect(model.connections[0]).toMatchObject({from:'Whole',to:'Part',attributes:{fromMember:'items',toMember:'value',relation:'composition'}});
});

it('renders n-ary associations with a compact diamond declaration',()=>{
 const source='@object\npackage domain {\nobject user\nobject role\nobject scope\ndiamond membership "Assignment"\nuser -- membership\nrole -- membership\nscope -- membership\n}';
 const model=parseObject(source);
 expect(model.nodes.find(n=>n.id==='membership')).toMatchObject({shape:'diamond',label:'Assignment',parentId:'domain',attributes:{kind:'association'}});
 expect(model.connections).toHaveLength(3);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.svg.querySelector('[data-node-id="membership"] polygon')).not.toBeNull();
 instance.destroy();
 expect(parseObject('@object\ndiamond join').nodes[0]!.label).toBe('');
 const scoped=parseObject('@object\nnamespace domain {\nobject user\ndiamond join\nuser -- join\n}');
 expect(scoped.connections[0]).toMatchObject({from:'domain.user',to:'domain.join'});
 expect(()=>parseObject('@object\ndiamond join\ndiamond join')).toThrow();
});

it('resolves dotted and reverse relations in their lexical namespace',()=>{
 for(const operator of ['..','*..','o..','--*','..*','--o','..o','<--','<..']){
  const model=parseObject(`@object\nnamespace outer {\nobject part\nobject whole\nnamespace inner {\nobject part\nobject whole\npart "many" ${operator} "1" whole\n}\n}`);
  const edge=model.connections[0]!;
  expect(new Set([edge.from,edge.to])).toEqual(new Set(['outer.inner.part','outer.inner.whole']));
 }
 const model=parseClass('@class\nnamespace domain {\nclass Part {\n value: string\n}\nclass Whole {\n items: Part[]\n}\nPart::value --* Whole::items\n}');
 expect(model.connections[0]).toMatchObject({from:'domain.Whole',to:'domain.Part',attributes:{fromMember:'items',toMember:'value'}});
});

it('renders navigation arrows together with composition and aggregation diamonds',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const op of ['*-->','*..>','o-->','o..>','<--*','<..*','<--o','<..o']){
  const instance=createFinch().render(`@class\nclass A\nclass B\nA ${op} B`,{target:'#diagram',editor:false});
  const edge=instance.geometry.edges[0]!;
  expect(edge.attributes?.navigable).toBe('true');
  expect(edge.from).toBe(op.startsWith('<')?'B':'A');
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('marker-start')).toBe(op.includes('*')?'url(#finch-diamond-filled)':'url(#finch-diamond-open)');
  expect(path.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  expect(edge.dashed).toBe(op.includes('..'));
  instance.destroy();
 }
});

it('renders bidirectional relations as one edge with two open arrows',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const op of ['<-->','<..>']){
  const instance=createFinch().render(`@object\nnamespace domain {\nobject a\nobject b\na "1" ${op} "many" b: peers\n}`,{target:'#diagram',editor:false});
  expect(instance.geometry.edges).toHaveLength(1);
  expect(instance.geometry.edges[0]).toMatchObject({from:'domain.a',to:'domain.b',dashed:op==='<..>',attributes:{bidirectional:'true',fromCardinality:'1',toCardinality:'many'}});
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('marker-start')).toBe('url(#finch-open-arrow)');
  expect(path.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  expect(instance.svg.querySelector('#finch-open-arrow')!.getAttribute('orient')).toBe('auto-start-reverse');
  instance.destroy();
 }
});

it('renders suffix member modifiers as underlines and italics',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@class\nclass Service {\n +shared: Service {classifier}\n +run() {abstract}\n}',{target:'#diagram',editor:false});
 expect(instance.svg.querySelector('text[text-decoration="underline"]')?.textContent).toBe('+shared: Service');
 expect(instance.svg.querySelector('text[font-style="italic"]')?.textContent).toBe('+run()');
 instance.destroy();
});

it('preserves custom compartment order and member attachment rows',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@class\nclass Service {\n .. API ..\n +run()\n -- Data --\n -value: int\n == Factory ==\n +create() {static}\n __\n}\nclass Client\nClient --> Service::run()';
 const model=parseClass(source);
 const members=JSON.parse(model.nodes[0]!.attributes.members!);
 expect(members.map((m:{kind:string})=>m.kind)).toEqual(['separator','operation','separator','attribute','separator','operation','separator']);
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes.find(n=>n.id==='Service')!,edge=instance.geometry.edges[0]!;
 const texts=[...instance.svg.querySelectorAll('[data-node-id="Service"] text')].map(n=>n.textContent);
 expect(texts.indexOf('+run()')).toBeLessThan(texts.indexOf('-value: int'));
 expect(instance.svg.querySelectorAll('.finch-compartment-separator')).toHaveLength(8);
 expect(edge.points.slice(-1)[0]!.y).toBe(node.y+46+15+23);
 instance.destroy();
 expect(()=>parseClass(source.replace('Service::run()','Service::API'))).toThrow(/member/);
 const hidden=parseClass(source+'\nhide Service fields');
 expect(JSON.parse(hidden.nodes[0]!.attributes.hiddenMembers!)).toEqual([3]);
});

it('shares a named note across multiple classifiers in a namespace',()=>{
 const source='@class\nnamespace domain {\nclass A\nclass B\nnote "Shared rule" as rule\nA .. rule\nB .. rule\n}';
 const model=parseClass(source);
 expect(model.nodes.find(n=>n.id==='domain.rule')).toMatchObject({shape:'uml-artifact',label:'Shared rule',attributes:{standaloneNote:'true'}});
 expect(model.connections.map(e=>e.to)).toEqual(['domain.rule','domain.rule']);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const note=instance.svg.querySelector('[data-node-id="domain.rule"]')!;
 expect(note.textContent).toContain('Shared rule');
 expect(note.textContent).not.toContain('artifact');
 expect(instance.geometry.edges).toHaveLength(2);
 instance.destroy();
 expect(()=>parseClass('@class\nclass rule\nnote "Duplicate" as rule')).toThrow(/duplicate/);
});

it('preserves multiline named notes and their literal directives',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['note','rnote','hnote']){
  const source=`@class\nclass A\n${kind} as N\nShared "rule"\n\ntitle literal\nhide A\nend ${kind}\nA .. N`;
  const model=parseClass(source);
  expect(model.nodes).toHaveLength(2);
  expect(model.nodes.find(n=>n.id==='A')!.attributes.hidden).not.toBe('true');
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const node=instance.svg.querySelector('[data-node-id="N"]')!;
  expect(node.textContent).toContain('Shared "rule"');
  expect(node.textContent).toContain('title literal');
  expect(node.textContent).toContain('hide A');
  expect(instance.geometry.edges).toHaveLength(1);
  instance.destroy();
  expect(()=>parseClass(`@class\n${kind} as N\nunfinished`)).toThrow(/Unclosed/);
 }
});

it('attaches shorthand notes to the preceding classifier',()=>{
 const source='@class\nnamespace domain {\nclass A\nnote right: First explanation\nrecord B {\n note left: literal member\n}\nhnote bottom: "Second explanation"\n}';
 const model=parseClass(source);
 const notes=model.nodes.filter(n=>n.attributes.annotationTarget);
 expect(notes.map(n=>[n.attributes.annotationTarget,n.attributes.annotationSide,n.label])).toEqual([['domain.A','right','First explanation'],['domain.B','bottom','Second explanation']]);
 expect(JSON.parse(model.nodes.find(n=>n.id==='domain.B')!.attributes.members!)[0].text).toBe('note left: literal member');
 expect(()=>parseClass('@class\nnote right: Missing target')).toThrow(/preceding element/);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.filter(n=>n.attributes.annotationTarget)).toHaveLength(2);
 instance.destroy();
});

it('attaches multiline shorthand notes while keeping their bodies literal',()=>{
 for(const kind of ['note','rnote','hnote']){
  const source=`@class\nclass A\n${kind} right\nShared "rule"\n\nhide A\nend ${kind}`;
  const model=parseClass(source),note=model.nodes.find(n=>n.attributes.annotationTarget)!;
  expect(note.attributes).toMatchObject({annotationTarget:'A',annotationSide:'right'});
  expect(model.nodes[0]!.attributes.hidden).not.toBe('true');
  document.body.innerHTML='<div id="diagram"></div>';
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.svg.textContent).toContain('Shared "rule"');
  expect(instance.svg.textContent).toContain('hide A');
  instance.destroy();
 }
});

it('attaches link notes to the preceding relation even between identical endpoints',()=>{
 const source='@class\nclass A\nclass B\nA --> B: first\nnote on link: First note\nA --> B: second\nhnote left on link: Second note';
 const model=parseClass(source),notes=model.nodes.filter(n=>n.attributes.annotationTarget);
 expect(notes.map(n=>n.attributes.annotationTarget)).toEqual(model.connections.map(e=>e.id));
 expect(notes[1]!.attributes.annotationSide).toBe('left');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.filter(n=>n.attributes.annotationKind==='edge')).toHaveLength(2);
 instance.destroy();
 expect(()=>parseClass('@class\nclass A\nnote on link: Missing')).toThrow(/preceding relation/);
});

it('keeps a block link note literal and attached to its reversed relation',()=>{
 const model=parseClass('@class\nclass A\nclass B\nA "many" <--* "1" B\nnote right on link\nOwnership\nhide A\nend note');
 const note=model.nodes.find(n=>n.attributes.annotationTarget)!;
 expect(note.attributes).toMatchObject({annotationTarget:model.connections[0]!.id,annotationSide:'right'});
 expect(model.connections[0]).toMatchObject({from:'B',to:'A'});
 expect(note.label).toContain('hide A');
 expect(model.nodes[0]!.attributes.hidden).not.toBe('true');
});

it('supports aliases in mixed object, map and classifier diagrams',()=>{
 const source='@object\nnamespace domain {\nobject "Alice : User" as alice {\n name = "Alice"\n}\nrecord "User type" as User {\n +name: string\n}\nUser : +get()\nmap "User index" as users {\n primary *-> alice\n}\nalice ..> User\n}';
 const model=parseObject(source);
 expect(model.nodes.find(n=>n.id==='domain.alice')).toMatchObject({label:'Alice : User',shape:'uml-instance'});
 expect(model.nodes.find(n=>n.id==='domain.User')).toMatchObject({label:'User type',attributes:{kind:'record'}});
 expect(model.nodes.find(n=>n.id==='domain.users')).toMatchObject({label:'User index',shape:'uml-map'});
 expect(model.connections.some(e=>e.from==='domain.users' && e.to==='domain.alice')).toBe(true);
 expect(JSON.parse(model.nodes.find(n=>n.id==='domain.User')!.attributes.members!)).toHaveLength(2);
});

it('renders and links to an escaped destructor after visibility filtering',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@class\nnamespace domain {\nclass Resource {\n\\~Resource()\n~internal()\n}\nclass Client\nClient --> Resource::~Resource()\n}\nhide package members';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.svg.textContent).toContain('~Resource()');
 expect(instance.svg.textContent).not.toContain('~internal()');
 expect(instance.geometry.edges).toHaveLength(1);
 instance.destroy();
});

it('preserves classifier visibility through aliases and namespaces',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const symbol of ['+','-','#','~']){
  const source=`@class\nnamespace domain {\n${symbol}class "Visible type" as A {\n +run()\n}\n}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const node=instance.geometry.nodes.find(n=>n.id==='domain.A')!;
  expect(node.label).toBe('Visible type');
  expect(node.attributes.visibility).toBe(symbol);
  expect(instance.svg.textContent).toContain(symbol+'Visible type');
  instance.destroy();
 }
});

it('infers classifiers in mixed class diagrams without changing explicit object slots',()=>{
 const source='@class\nnamespace domain {\nobject sample {\n name = "Alice"\n}\nService : +run()\nsample : active = true\nClient --> Service::run()\nsample ..> Service\njson config {"enabled":true}\nService --> config\n}';
 const model=parseClass(source);
 expect(model.nodes.find(n=>n.id==='domain.sample')!.shape).toBe('uml-instance');
 expect(JSON.parse(model.nodes.find(n=>n.id==='domain.sample')!.attributes.slots!)).toEqual(['name = "Alice"','active = true']);
 expect(model.nodes.find(n=>n.id==='domain.Service')!.shape).toBe('uml-class');
 expect(model.nodes.find(n=>n.id==='domain.Client')!.attributes.implicit).toBe('true');
 expect(model.connections.some(e=>e.to==='domain.Service' && e.attributes?.toMemberIndex==='0')).toBe(true);
});

it('marks non-navigable association ends with a cross',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const operator of ['x--','x..','--x','..x']){
  const instance=createFinch().render(`@class\nA ${operator} B`,{target:'#diagram',editor:false});
  const end=operator.startsWith('x')?'from':'to',path=instance.svg.querySelector('.finch-edge')!;
  expect(instance.geometry.edges[0]!.attributes).toMatchObject({relation:'association',nonNavigableEnd:end});
  expect(path.getAttribute(end==='from'?'marker-start':'marker-end')).toBe('url(#finch-non-navigable)');
  expect(path.getAttribute(end==='from'?'marker-end':'marker-start')).toBeNull();
  expect(instance.geometry.edges[0]!.dashed).toBe(operator.includes('..'));
  instance.destroy();
 }
});

it('combines non-navigable and navigable ends while preserving multiplicities',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const op of ['x-->','x..>','<--x','<..x']){
  const instance=createFinch().render(`@class\nA "1" ${op} "many" B`,{target:'#diagram',editor:false});
  const edge=instance.geometry.edges[0]!,reverse=op.startsWith('<');
  expect(edge).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B',attributes:{nonNavigableEnd:'from',navigable:'true',fromCardinality:reverse?'many':'1',toCardinality:reverse?'1':'many'}});
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('marker-start')).toBe('url(#finch-non-navigable)');
  expect(path.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  instance.destroy();
 }
});

it('keeps label reading direction separate from relation endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const op of ['--','<--']){
  const instance=createFinch().render(`@class\nA ${op} B: owns >`,{target:'#diagram',editor:false});
  const edge=instance.geometry.edges[0]!;
  expect(edge.label).toBe('owns');
  expect(edge.attributes?.labelDirection).toBe(op==='--'?'forward':'backward');
  expect(instance.svg.querySelector('.finch-edge-label')!.textContent).toMatch(/owns [▶◀▼▲]/);
  instance.destroy();
 }
 expect(parseClass('@class\nA -- B: < owned by').connections[0]).toMatchObject({label:'owned by',attributes:{labelDirection:'backward'}});
});


it('preserves special relation decorations through namespaces and theme changes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const [left,right,name] of [['#','#','square'],['}','{','crowfoot'],['+','+','circle-cross'],['^','^','triangle']]){
  for(const line of ['--','..'])for(const start of [true,false]){
   const operator=start?left+line:line+right;
   const instance=createFinch().render(`@class\nnamespace domain {\nA "1" ${operator} "many" B\n}`,{target:'#diagram',editor:false});
   const edge=instance.geometry.edges[0]!;
   expect(edge).toMatchObject({from:'domain.A',to:'domain.B',dashed:line==='..',attributes:{[start?'fromDecoration':'toDecoration']:name,fromCardinality:'1',toCardinality:'many'}});
   for(const theme of ['default','midnight']){
    if(theme==='midnight')instance.setTheme('midnight');
    const path=instance.svg.querySelector('.finch-edge')!;
    expect(path.getAttribute(start?'marker-start':'marker-end')).toBe(`url(#finch-decoration-${name})`);
    expect(path.getAttribute(start?'marker-end':'marker-start')).toBeNull();
    expect(instance.svg.querySelector(`#finch-decoration-${name} path`)).not.toBeNull();
   }
   instance.destroy();
  }
 }
});


it('combines special decorations with navigation and reverses member endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const [left,right,name] of [['#','#','square'],['}','{','crowfoot'],['+','+','circle-cross'],['^','^','triangle']])for(const line of ['--','..'])for(const reverse of [false,true]){
  const op=reverse?'<'+line+right:left+line+'>';
  const instance=createFinch().render(`@class\nclass A {\n +run()\n}\nclass B {\n +accept()\n}\nA::run() "1" ${op} "many" B::accept()`,{target:'#diagram',editor:false});
  expect(instance.geometry.edges[0]).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B',dashed:line==='..',attributes:{fromDecoration:name,navigable:'true',fromMember:reverse?'accept()':'run()',toMember:reverse?'run()':'accept()',fromCardinality:reverse?'many':'1',toCardinality:reverse?'1':'many'}});
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('marker-start')).toBe(`url(#finch-decoration-${name})`);
  expect(path.getAttribute('marker-end')).toBe('url(#finch-open-arrow)');
  instance.destroy();
 }
});


it('keeps bare compartment separators distinct from adjacent text and literal object slots',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const body='first field\n..\nsecond field\n==\nthird field\n__\nfourth field\n--\nlast field';
 const model=parseClass('@class\nabstract class Record {\n'+body+'\n}');
 const members=JSON.parse(model.nodes[0]!.attributes.members!);
 expect(members.filter((m:{kind:string})=>m.kind==='separator').map((m:{text:string,separator:string})=>[m.text,m.separator])).toEqual([['','..'],['','=='],['','__'],['','--']]);
 expect(members.filter((m:{kind:string})=>m.kind==='attribute').map((m:{text:string})=>m.text)).toEqual(['first field','second field','third field','fourth field','last field']);
 const instance=createFinch().render('@class\nabstract class Record {\n'+body+'\n}',{target:'#diagram',editor:false});
 const title=[...instance.svg.querySelectorAll('[data-node-id="Record"] text')].find(t=>t.textContent==='Record')!;
 expect(title.getAttribute('font-style')).toBe('italic');
 expect(instance.svg.querySelectorAll('.finch-compartment-separator')).toHaveLength(8);
 instance.destroy();
 const object=parseObject('@object\nobject record {\n'+body+'\n}');
 expect(object.nodes[0]!.attributes.customCompartments).toBeUndefined();
 expect(JSON.parse(object.nodes[0]!.attributes.members!).map((m:{text:string})=>m.text)).toEqual(body.split('\n'));
});


it('resolves compact n-ary association declarations without rewriting literal members',()=>{
 for(const kind of ['class','object']){
  const source=`@${kind}
namespace domain {
<> link "Agreement"
note right: Shared association
${kind} A
${kind} B
${kind} C
A -- link
B -- link
C -- link
}`;
  const model=kind==='class'?parseClass(source):parseObject(source);
  expect(model.nodes.find(n=>n.id==='domain.link')).toMatchObject({label:'Agreement',shape:'diamond',attributes:{kind:'association'}});
  expect(model.connections.filter(e=>e.to==='domain.link')).toHaveLength(3);
 }
 const model=parseClass('@class\nclass Text {\n<> literal\n}');
 expect(JSON.parse(model.nodes[0]!.attributes.members!)[0].text).toBe('<> literal');
 expect(()=>parseClass('@class\n<> link\ndiamond link')).toThrow(/duplicate/i);
});


it('keeps nested template parameters separate from inline stereotypes and aliases',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const declaration of ['class Cache<Map<Key, Value>> <<service>>','class "Typed cache" as Cache<Map<Key, Value>> <<service>>']){
  const source='@class\nnamespace app {\n'+declaration+' {\n +get(): Value\n}\nClient --> Cache\n}';
  const model=parseClass(source);
  expect(model.nodes.find(n=>n.id==='app.Cache')!.attributes).toMatchObject({templateParameters:'Map<Key, Value>',stereotype:'service'});
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.svg.textContent).toContain('Map<Key, Value>');
  expect(instance.svg.textContent).toContain('«service»');
  instance.destroy();
 }
});


it('resolves circle and compact interface declarations in namespaces',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const declaration of ['circle API','() API','() "Public API" as API']){
  const source='@class\nnamespace app {\n'+declaration+'\nclass Service\nService -- API\n}';
  const model=parseClass(source);
  expect(model.nodes.find(n=>n.id==='app.API')).toMatchObject({shape:'uml-provided-interface',attributes:{kind:'interface'}});
  expect(model.connections[0]).toMatchObject({from:'app.Service',to:'app.API'});
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.svg.querySelector('[data-node-id="app.API"] circle')).not.toBeNull();
  instance.destroy();
 }
});


it('applies explicit class relation ports alongside multiplicities and roles',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const op of ['-->','<--']){
  const source=`@class\nclass A\nclass B\nA "1" ${op} "many" B: uses [fromPort=left toPort=right fromRole=owner toRole=items]`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const edge=instance.geometry.edges[0]!,from=instance.geometry.nodes.find(n=>n.id===edge.from)!,to=instance.geometry.nodes.find(n=>n.id===edge.to)!;
  expect(edge.label).toBe('uses');
  expect(edge.attributes).toMatchObject({fromPort:'left',toPort:'right',fromRole:'owner',toRole:'items'});
  expect(edge.points[0]!.x).toBe(from.x);
  expect(edge.points[edge.points.length-1]!.x).toBe(to.x+to.width);
  instance.destroy();
 }
});


it('rejects misspelled ports instead of silently choosing a different attachment',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['class','object','component','deployment'])for(const key of ['fromPort','toPort']){
  const declaration=kind==='object'?'object':kind==='class'?'class':'component';
  const arrow=kind==='class'||kind==='object'?'-->':'->';
  const source=`@${kind}\n${declaration} A\n${declaration} B\nA ${arrow} B [${key}=botom]`;
  expect(()=>createFinch().render(source,{target:'#diagram',editor:false})).toThrow(new RegExp(`Invalid ${key}`));
 }
});


it('renders undirected and reverse component links with the intended endpoints',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment'])for(const op of ['-','--','..','<-','<--','<..']){
  const instance=createFinch().render(`@${kind}\ncomponent A\ncomponent B\nA ${op} B: link`,{target:'#diagram',editor:false});
  const reverse=op.startsWith('<'),edge=instance.geometry.edges[0]!;
  expect(edge).toMatchObject({from:reverse?'B':'A',to:reverse?'A':'B',label:'link',dashed:op.includes('..')||op==='<--'});
  const path=instance.svg.querySelector('.finch-edge')!;
  expect(path.getAttribute('marker-end')).toBe(reverse?'url(#finch-arrow)':null);
  instance.destroy();
 }
});


it('preserves deployment aliases, styles and nesting',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment']){
  const instance=createFinch().render(`@${kind}\npackage "Services" as services {\ncomponent "Order service" as orders [tone=blue]\ncomponent billing as "Billing service"\norders -> billing\n}`,{target:'#diagram',editor:false});
  expect(instance.geometry.nodes.find(n=>n.id==='orders')).toMatchObject({label:'Order service',parentId:'services',attributes:{tone:'blue'}});
  expect(instance.geometry.nodes.find(n=>n.id==='billing')!.label).toBe('Billing service');
  expect(instance.geometry.edges[0]).toMatchObject({from:'orders',to:'billing'});
  instance.destroy();
 }
});


it('accepts bracketed component declarations and compact provided interfaces',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\n[Order service] as orders [tone=blue]\ncomponent [Billing] as billing\n[Worker]\n() "Public API" as api\norders -- api\norders -> billing\nWorker -> orders';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='orders')).toMatchObject({shape:'component',label:'Order service',attributes:{tone:'blue'}});
 expect(instance.geometry.nodes.find(n=>n.id==='Worker')).toMatchObject({shape:'component',label:'Worker'});
 expect(instance.geometry.nodes.find(n=>n.id==='api')).toMatchObject({shape:'uml-provided-interface',label:'Public API'});
 expect(instance.geometry.edges).toHaveLength(3);
 instance.destroy();
});


it('infers bracketed component endpoints and reuses later explicit declarations',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\n[Order service] --> [Billing service]\n[Billing service] -- [Order service]\n[Order service] [tone=blue]',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes).toHaveLength(2);
 expect(instance.geometry.nodes.find(n=>n.label==='Order service')!.attributes.tone).toBe('blue');
 expect(instance.geometry.edges[0]!.from).toBe(instance.geometry.edges[1]!.to);
 expect(instance.geometry.nodes.every(n=>n.shape==='component')).toBe(true);
 instance.destroy();
});


it('attaches inline and block notes to bracketed component names',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const note of ['note right of [Order service]: Accepts orders','note left of [Order service]\nAccepts orders\nend note']){
  const instance=createFinch().render('@component\n[Order service] -> [Billing]\n'+note,{target:'#diagram',editor:false});
  const target=instance.geometry.nodes.find(n=>n.label==='Order service')!;
  expect(instance.geometry.nodes.find(n=>n.label==='Accepts orders')!.attributes.annotationTarget).toBe(target.id);
  expect(instance.svg.textContent).toContain('Accepts orders');
  instance.destroy();
 }
});


it('infers component interfaces while allowing later explicit and bracketed declarations',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\n[Order service] ..> HTTP\nHTTP -- billing\ncomponent billing "Billing service"\nHTTP -- worker\n[worker] -- HTTP',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes).toHaveLength(4);
 expect(instance.geometry.nodes.find(n=>n.id==='HTTP')!.shape).toBe('uml-provided-interface');
 expect(instance.geometry.nodes.find(n=>n.id==='billing')).toMatchObject({label:'Billing service',shape:'component'});
 expect(instance.geometry.nodes.find(n=>n.id==='worker')!.shape).toBe('component');
 instance.destroy();
});


it('keeps comment-like text inside bracketed component names',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\n[Order #1] -> [Audit // log] # real comment\n[Order #1] [tone=blue]\nnote right of [Audit // log]: Records events',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.label==='Order #1')!.attributes.tone).toBe('blue');
 expect(instance.geometry.nodes.some(n=>n.label==='Audit // log')).toBe(true);
 expect(instance.geometry.edges[0]!.label).toBeUndefined();
 expect(instance.svg.textContent).toContain('Records events');
 instance.destroy();
});


it('renders interface, provided and compact declarations consistently',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment'])for(const declaration of ['interface "Public API" as api','provided api "Public API"','() "Public API" as api']){
  const instance=createFinch().render(`@${kind}\n${declaration}\ncomponent service\nservice -- api`,{target:'#diagram',editor:false});
  const node=instance.geometry.nodes.find(n=>n.id==='api')!;
  expect(node).toMatchObject({shape:'uml-provided-interface',label:'Public API'});
  const circle=instance.svg.querySelector('[data-node-id="api"] circle')!;
  expect(circle.getAttribute('r')).toBe('10');
  instance.destroy();
 }
});


it('links quoted deployment names without requiring aliases',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\n() "Public API"\ncomponent "Order service"\n"Order service" -- "Public API"',{target:'#diagram',editor:false});
 const api=instance.geometry.nodes.find(n=>n.label==='Public API')!,service=instance.geometry.nodes.find(n=>n.label==='Order service')!;
 expect(api.shape).toBe('uml-provided-interface');
 expect(instance.geometry.edges[0]).toMatchObject({from:service.id,to:api.id});
 instance.destroy();
});


it('attaches notes to quoted interface names in inline and block forms',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const note of ['note right of "Public API": Contract','note left of "Public API"\nContract\nend note']){
  const instance=createFinch().render('@component\n() "Public API"\n'+note,{target:'#diagram',editor:false});
  const api=instance.geometry.nodes.find(n=>n.label==='Public API')!;
  expect(instance.geometry.nodes.find(n=>n.label==='Contract')!.attributes.annotationTarget).toBe(api.id);
  instance.destroy();
 }
});


it('shares standalone notes across component relations without inferring an interface',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment'])for(const note of ['note "Shared contract" as contract','note as contract\nShared contract\nend note']){
  const instance=createFinch().render(`@${kind}\ncomponent A\ncomponent B\nA .. contract\nB .. contract\n${note}`,{target:'#diagram',editor:false});
  const node=instance.geometry.nodes.find(n=>n.id==='contract')!;
  expect(node).toMatchObject({shape:'uml-artifact',label:'Shared contract',attributes:{standaloneNote:'true'}});
  expect(instance.geometry.nodes.filter(n=>n.id==='contract')).toHaveLength(1);
  expect(instance.geometry.edges.filter(e=>e.to==='contract')).toHaveLength(2);
  expect(instance.svg.textContent).not.toContain('«artifact»');
  instance.destroy();
 }
});


it('keeps multiline component descriptions literal',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@component\ncomponent orders [\nOrder service\ntitle is a field\nnote right of HTTP\n]\norders -> HTTP';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='orders')!.label).toBe('Order service\\ntitle is a field\\nnote right of HTTP');
 expect(instance.geometry.nodes).toHaveLength(2);
 expect(instance.svg.textContent).toContain('title is a field');
 instance.destroy();
 expect(()=>createFinch().render('@component\ncomponent orders [\nUnclosed',{target:'#diagram',editor:false})).toThrow(/Unclosed component/);
});


it('does not expand component declarations inside note bodies',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const header of ['note right of "Public API"','note as explanation']){
  const source='@component\n() "Public API"\n'+header+'\ncomponent fake [\nThis is a syntax example\n]\nend note\ncomponent real [\nActual component\n]';
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.geometry.nodes.some(n=>n.id==='fake')).toBe(false);
  expect(instance.geometry.nodes.find(n=>n.id==='real')!.label).toBe('Actual component');
  expect(instance.svg.textContent).toContain('component fake [');
  instance.destroy();
 }
});


it('switches component notation globally with per-node overrides',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\ncomponentStyle uml1\ncomponent A\ncomponent B [componentStyle=rectangle]\nA -- B',{target:'#diagram',editor:false});
 expect(instance.svg.querySelectorAll('[data-node-id="A"] .finch-component-tab')).toHaveLength(2);
 expect(instance.svg.querySelectorAll('[data-node-id="B"] rect')).toHaveLength(1);
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-component-tab')).toHaveLength(2);
 instance.destroy();
 expect(()=>createFinch().render('@component\ncomponentStyle invalid',{target:'#diagram',editor:false})).toThrow(/Unknown component style/);
});


it('groups nested components in folder and frame notation',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@component\nfolder "Services" as services {\nframe processing "Processing" {\n[Worker]\n}\n[API]\n}\n[API] -> [Worker]',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.find(n=>n.id==='processing')).toMatchObject({shape:'container',parentId:'services',attributes:{containerStyle:'frame'}});
 expect(instance.geometry.nodes.find(n=>n.id==='Worker')!.parentId).toBe('processing');
 expect(instance.svg.querySelector('.finch-folder-outline')).not.toBeNull();
 expect(instance.svg.querySelector('.finch-frame-outline')).not.toBeNull();
 instance.destroy();
});


it('supports nested deployment nodes with standalone cube declarations',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@deployment\nnode "Cluster" as cluster {\nnode host "Host" {\ncomponent worker\n}\n}\nnode external\nexternal -> worker',{target:'#diagram',editor:false});
 const nodes=instance.geometry.nodes,host=nodes.find(n=>n.id==='host')!,worker=nodes.find(n=>n.id==='worker')!;
 expect(host).toMatchObject({shape:'container',parentId:'cluster',attributes:{containerStyle:'node'}});
 expect(worker.parentId).toBe('host');
 expect(worker.x).toBeGreaterThan(host.x);
 expect(worker.x+worker.width).toBeLessThan(host.x+host.width);
 expect(nodes.find(n=>n.id==='external')!.shape).toBe('uml-node');
 expect(instance.svg.querySelectorAll('.finch-node-outline')).toHaveLength(2);
 instance.destroy();
});


it('supports database groups with contained components and external links',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@deployment\ndatabase "Storage" as storage {\ncomponent tables "Tables"\n}\ncomponent app\napp -> tables',{target:'#diagram',editor:false});
 const group=instance.geometry.nodes.find(n=>n.id==='storage')!,child=instance.geometry.nodes.find(n=>n.id==='tables')!;
 expect(group).toMatchObject({shape:'container',attributes:{containerStyle:'database'}});
 expect(child.parentId).toBe('storage');
 expect(child.y).toBeGreaterThan(group.y+20);
 expect(child.y+child.height).toBeLessThan(group.y+group.height-10);
 expect(instance.svg.querySelector('.finch-database-outline')).not.toBeNull();
 instance.destroy();
});


it('accepts compact empty deployment groups and keeps their identity on update',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['package','folder','frame','node','database','cloud']){
  const source=`@deployment\n${kind} "Group" as group {}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  expect(instance.geometry.nodes[0]).toMatchObject({id:'group',shape:'container',label:'Group'});
  instance.update(source.replace('{}','{\ncomponent child\n}'));
  expect(instance.geometry.nodes.find(n=>n.id==='child')!.parentId).toBe('group');
  expect(instance.geometry.nodes.find(n=>n.id==='group')!.label).toBe('Group');
  instance.destroy();
 }
});


it('contains components inside cloud groups with a dedicated outline',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@deployment\ncloud "Public cloud" as cloud {\ncomponent service\n}\ncomponent client\nclient -> service',{target:'#diagram',editor:false});
 const group=instance.geometry.nodes.find(n=>n.id==='cloud')!,child=instance.geometry.nodes.find(n=>n.id==='service')!;
 expect(group.attributes.containerStyle).toBe('cloud');
 expect(child.parentId).toBe('cloud');
 expect(child.y).toBeGreaterThan(group.y+43);
 expect(instance.svg.querySelector('.finch-cloud-outline')).not.toBeNull();
 instance.destroy();
});


it('applies global component direction to flat and nested diagrams',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 for(const kind of ['component','deployment'])for(const nested of [false,true])for(const direction of ['left to right','top to bottom']){
  const source=`@${kind}\n${direction} direction\n${nested?'package system {\n':''}component A\ncomponent B\nA -> B${nested?'\n}':''}`;
  const instance=createFinch().render(source,{target:'#diagram',editor:false});
  const a=instance.geometry.nodes.find(n=>n.id==='A')!,b=instance.geometry.nodes.find(n=>n.id==='B')!;
  expect(instance.geometry.direction).toBe(direction==='top to bottom'?'down':'right');
  if(direction==='top to bottom')expect(b.y).toBeGreaterThanOrEqual(a.y+a.height);
  else expect(b.x).toBeGreaterThanOrEqual(a.x+a.width);
  instance.destroy();
 }
});
