import {expect,it} from 'vitest';
import {parseClass} from '../src/index';
it('adds fields and operations before resolving member relations and annotations',()=>{
 const model=parseClass('@class\nnamespace domain {\nOrder : +submit()\nclass Order\nOrder : -id: UUID\nclass Client\nClient --> Order::submit()\n}');
 const order=model.nodes.find(n=>n.id==='domain.Order')!;
 expect(JSON.parse(order.attributes.members!)).toEqual([{text:'+submit()',kind:'operation'},{text:'-id: UUID',kind:'attribute'}]);
 expect(model.connections[0]!.attributes?.toMemberIndex).toBe('0');
 expect(()=>parseClass('@class\nMissing : value',false)).toThrow(/Unknown classifier/);
});
it('keeps class additions distinct from object slots in a mixed diagram',()=>{
 const model=parseClass('@class\nclass User\nUser : +save()\nobject alice\nalice : name = Alice\nalice -- User');
 expect(model.nodes.find(n=>n.id==='User')!.attributes.members).toContain('save()');
 expect(model.nodes.find(n=>n.id==='alice')!.attributes.slots).toContain('name = Alice');
});

it('supports explicit member kinds and brace modifiers in bodies and external additions',()=>{
 const model=parseClass('@class\nclass A {\n{field} +callback = run()\n{method} {abstract} +execute\n}\nA : {static} {field} +instance: A');
 expect(JSON.parse(model.nodes[0]!.attributes.members!)).toEqual([
  {text:'+callback = run()',kind:'attribute'},
  {text:'+execute',kind:'operation',abstract:true},
  {text:'+instance: A',kind:'attribute',static:true},
 ]);
 for(const member of ['{field} {method} x','{static}'])expect(()=>parseClass(`@class\nclass A {\n${member}\n}`)).toThrow(/member/);
 const filtered=parseClass('@class\nclass A {\n{field} +callback = run()\n{method} +execute\n}\nhide methods');
 expect(JSON.parse(filtered.nodes[0]!.attributes.hiddenMembers!)).toEqual([1]);
});

it('keeps object slot values literal even when they look like class modifiers',()=>{
 const model=parseClass('@class\nnamespace app {\nclass User\nUser : {method} +save\nobject alice {\n{static}\n{field} {method} value\n}\nalice : {abstract}\nalice -- User\n}');
 expect(JSON.parse(model.nodes.find(n=>n.id==='app.alice')!.attributes.slots!)).toEqual(['{static}','{field} {method} value','{abstract}']);
 expect(JSON.parse(model.nodes.find(n=>n.id==='app.User')!.attributes.members!)).toEqual([{text:'+save',kind:'operation'}]);
});

it('treats compact empty bodies like multiline declarations',()=>{
 for(const declaration of ['class A','interface A<T>','abstract A "Abstract"','enum A']){
  const base=parseClass('@class\n'+declaration+' {\n}');
  const compact=parseClass('@class\n'+declaration+' {}');
  expect(compact.nodes).toEqual(base.nodes);
 }
 const model=parseClass('@class\nnamespace domain {\nclass A {}\nA : +run()\n}\nclass outside.B {}\noutside.B --> domain.A');
 expect(model.connections).toHaveLength(1);
 expect(model.nodes.find(n=>n.id==='domain.A')!.attributes.members).toContain('run()');
});

it('accepts static and abstract suffixes and the classifier alias',()=>{
 const model=parseClass('@class\nclass Service {\n +count: int {static}\n +run() {abstract}\n {classifier} +shared: Service\n +build() {classifier} {abstract}\n literal: string = "{static}"\n}\nService : +create() {classifier}');
 expect(JSON.parse(model.nodes[0]!.attributes.members!)).toEqual([
  {text:'+count: int',kind:'attribute',static:true},
  {text:'+run()',kind:'operation',abstract:true},
  {text:'+shared: Service',kind:'attribute',static:true},
  {text:'+build()',kind:'operation',static:true,abstract:true},
  {text:'literal: string = "{static}"',kind:'attribute'},
  {text:'+create()',kind:'operation',static:true},
 ]);
 for(const text of ['{classifier}','{static} {abstract}'])expect(()=>parseClass(`@class\nclass A {\n${text}\n}`)).toThrow(/member/);
});

it('reads interior modifiers while preserving quoted defaults',()=>{
 const model=parseClass(`@class
class Worker {
 +void {abstract} start(int timeout)
 +String {classifier} name
 String value = "{static}  literal"
 char value = '{abstract}'
}
Worker : +void {static} create()`);
 expect(JSON.parse(model.nodes[0]!.attributes.members!)).toEqual([
  {text:'+void start(int timeout)',kind:'operation',abstract:true},
  {text:'+String name',kind:'attribute',static:true},
  {text:'String value = "{static}  literal"',kind:'attribute'},
  {text:"char value = '{abstract}'",kind:'attribute'},
  {text:'+void create()',kind:'operation',static:true},
 ]);
});

it('supports extended classifier kinds across namespaces, notes and display rules',()=>{
 for(const kind of ['annotation','record','dataclass','struct','protocol','exception','metaclass','stereotype','entity']){
  const source=`@class\nnamespace domain {\n${kind} Value {\n +name: string\n}\nValue : +get()\nnote Value "A value"\n}\nhide ${kind} fields`;
  const model=parseClass(source),node=model.nodes.find(n=>n.id==='domain.Value')!;
  expect(node.attributes.kind).toBe(kind);
  expect(JSON.parse(node.attributes.members!).map((m:{text:string})=>m.text)).toEqual(['+name: string','+get()']);
  expect(JSON.parse(node.attributes.hiddenMembers!)).toEqual([0]);
  expect(model.nodes.find(n=>n.attributes.annotationTarget)?.attributes.annotationTarget).toBe('domain.Value');
  expect(parseClass(`@class\n${kind} Empty`).nodes[0]!.attributes.kind).toBe(kind);
 }
});

it('keeps the existing stereotype assignment command',()=>{
 const model=parseClass('@class\nclass A\nstereotype A "service"');
 expect(model.nodes.find(n=>n.id==='A')!.attributes.stereotype).toBe('service');
});

it('keeps command-looking lines inside extended classifier bodies literal',()=>{
 for(const kind of ['annotation','record','dataclass','struct','protocol','exception','metaclass','stereotype','entity']){
  const model=parseClass(`@class\n${kind} Value {\n title literal member\n note Value\n hide fields\n}\ntitle "Actual title"`);
  expect(JSON.parse(model.nodes[0]!.attributes.members!).map((m:{text:string})=>m.text)).toEqual(['title literal member','note Value','hide fields']);
  expect(model.nodes).toHaveLength(1);
 }
});

it('normalizes abstract class declarations without changing literal members',()=>{
 const source='@class\nnamespace domain {\nabstract class Base<T> {\n +load(): T\n abstract class literal member\n}\nclass Child\nChild --|> Base\n}';
 const model=parseClass(source),base=model.nodes.find(n=>n.id==='domain.Base')!;
 expect(base.attributes).toMatchObject({kind:'abstract',templateParameters:'T'});
 expect(model.connections[0]).toMatchObject({from:'domain.Child',to:'domain.Base'});
 expect(JSON.parse(base.attributes.members!)[1].text).toBe('class literal member');
 expect(parseClass('@class\nabstract class Empty {}').nodes[0]).toMatchObject({id:'Empty',attributes:{kind:'abstract'}});
});

it('resolves classifier aliases while retaining display names',()=>{
 for(const declaration of ['class "Order service" as Service','class Service as "Order service"','record "Order service" as Service']){
  const model=parseClass(`@class\nnamespace domain {\n${declaration} {\n +run()\n}\nclass Client\nClient --> Service\n}`);
  expect(model.nodes.find(n=>n.id==='domain.Service')!.label).toBe('Order service');
  expect(model.connections[0]).toMatchObject({from:'domain.Client',to:'domain.Service'});
 }
 expect(parseClass('@class\nstereotype "Service kind" as S').nodes[0]).toMatchObject({id:'S',label:'Service kind',attributes:{kind:'stereotype'}});
 const generic=parseClass('@class\nabstract class "Repository" as Repo<T> {}').nodes[0]!;
 expect(generic).toMatchObject({id:'Repo',label:'Repository',attributes:{kind:'abstract',templateParameters:'T'}});
});

it('supports inline stereotypes with namespaces, templates and display selectors',()=>{
 const model=parseClass('@class\nnamespace app {\nclass Service<T> "Service" <<application>> {\n +get(): T\n}\nrecord Value <<data>> {}\n}\nhide <<application>> methods');
 const service=model.nodes.find(n=>n.id==='app.Service')!;
 expect(service.attributes).toMatchObject({stereotype:'application',templateParameters:'T'});
 expect(JSON.parse(service.attributes.hiddenMembers!)).toEqual([0]);
 expect(model.nodes.find(n=>n.id==='app.Value')!.attributes.stereotype).toBe('data');
});

it('combines aliases and inline stereotypes in a single declaration',()=>{
 for(const declaration of ['class "Order service" as S <<application>>','class S as "Order service" <<application>>','abstract class "Order service" as S<T> <<application>>','stereotype "Order service" as S <<application>>']){
  const model=parseClass(`@class\nnamespace domain {\n${declaration}\n} `);
  expect(model.nodes.find(n=>n.id==='domain.S')).toMatchObject({label:'Order service',attributes:{stereotype:'application'}});
 }
});

it('distinguishes escaped member prefixes from visibility markers',()=>{
 const model=parseClass('@class\nclass Resource {\n\\~Resource()\n~internal()\n\\-value: int\n-private: int\n}\nhide package members\nhide private members');
 const members=JSON.parse(model.nodes[0]!.attributes.members!);
 expect(members[0]).toMatchObject({text:'~Resource()',visibilityEscaped:true});
 expect(members[2]).toMatchObject({text:'-value: int',visibilityEscaped:true});
 expect(JSON.parse(model.nodes[0]!.attributes.hiddenMembers!)).toEqual([1,3]);
});

it('infers empty classifiers from relations and prefers explicit declarations',()=>{
 const model=parseClass('@class\nnamespace domain {\nChild --|> Base\nChild --> Worker\nclass Worker {\n +run()\n}\n}');
 expect(model.nodes.find(n=>n.id==='domain.Child')).toMatchObject({shape:'uml-class',parentId:'domain',attributes:{implicit:'true'}});
 expect(model.nodes.find(n=>n.id==='domain.Base')).toMatchObject({parentId:'domain'});
 expect(model.nodes.filter(n=>n.id==='domain.Worker')).toHaveLength(1);
 expect(model.nodes.find(n=>n.id==='domain.Worker')!.attributes.implicit).toBeUndefined();
 expect(()=>parseClass('@class\nA --> B::missing')).toThrow(/member/);
});

it('infers classifiers from external members within their package scope',()=>{
 const model=parseClass('@class\nnamespace domain {\npackage services {\nService : +run()\nService : -name: string\nClient --> Service::run()\n}\n}');
 const service=model.nodes.find(n=>n.id==='domain.Service')!;
 expect(service.parentId).toBe('domain.services');
 expect(JSON.parse(service.attributes.members!).map((m:{text:string})=>m.text)).toEqual(['+run()','-name: string']);
 expect(model.connections[0]).toMatchObject({from:'domain.Client',to:'domain.Service',attributes:{toMemberIndex:'0'}});
});

it('resolves forward notes and display rules for inferred classifiers',()=>{
 const model=parseClass('@class\nnamespace domain {\nnote Service "Forward explanation"\nhide Service methods\nClient --> Service\nService : +run()\n}');
 expect(model.nodes.find(n=>n.attributes.annotationTarget)!.attributes.annotationTarget).toBe('domain.Service');
 expect(JSON.parse(model.nodes.find(n=>n.id==='domain.Service')!.attributes.hiddenMembers!)).toEqual([0]);
 expect(model.connections[0]).toMatchObject({from:'domain.Client',to:'domain.Service'});
});
