// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseClass } from '../src/index';

it('selects cross-namespace classifiers and their members by tags',()=>{
 const model=parseClass(`@class
namespace sales {
 class Service {
  -secret: String
  +run()
 }
 tag Service internal service
}
namespace shipping {
 class Service {
  +run()
 }
 tag Service service
}
hide $service fields
remove $internal
restore sales.Service`);
 expect(model.nodes.find(n=>n.id==='sales.Service')?.attributes.hidden).toBe('false');
 expect(JSON.parse(model.nodes.find(n=>n.id==='sales.Service')!.attributes.hiddenMembers!)).toEqual([0]);
 expect(JSON.parse(model.nodes.find(n=>n.id==='shipping.Service')!.attributes.tags!)).toEqual(['service']);
 expect(()=>parseClass('@class\ntag Missing internal')).toThrow('tag target');
});

it('filters unlinked classifiers and restores selected nodes without deleting model data',()=>{
 const source=`@class
class Account {
}
class Store {
}
class Unused {
}
Account --> Store
hide unlinked
remove Store
restore Store`;
 const model=parseClass(source);
 expect(model.nodes.find(n=>n.id==='Unused')?.attributes.hidden).toBe('true');
 expect(model.nodes.find(n=>n.id==='Store')?.attributes.hidden).toBe('false');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.id).sort()).toEqual(['Account','Store','Unused']);
 expect(instance.geometry.edges).toHaveLength(1);
 expect(model.nodes).toHaveLength(3);
 expect(()=>parseClass(source+'\nremove Account fields')).toThrow('classifiers');
});

const source=`@class
class Account {
 -secret: String
 +name: String
 +save()
}
class Audit {
 +record()
}
Account --> Audit`;

it('applies ordered member visibility without deleting semantic members',()=>{
 const text=source+'\nhide members\nshow Account fields\nhide private members';
 const model=parseClass(text);
 expect(JSON.parse(model.nodes[0]!.attributes.members!)).toHaveLength(3);
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(text,{target:'#diagram',editor:false});
 expect(document.body.textContent).toContain('+name: String');
 expect(document.body.textContent).not.toContain('secret');
 expect(document.body.textContent).not.toContain('save()');
});

it('hides classifiers and their relationships while preserving model data',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source+'\nnote Account->Audit "Audit relation"\nhide Audit',{target:'#diagram',editor:false});
 expect(parseClass(source+'\nhide Audit').nodes).toHaveLength(2);
 expect(instance.geometry.nodes).toHaveLength(2);
 expect(instance.geometry.edges).toHaveLength(1);
 expect(document.querySelectorAll('.finch-node')).toHaveLength(1);
 expect(document.querySelector('.finch-edges')?.children).toHaveLength(0);
 expect(()=>parseClass(source+'\nhide Missing')).toThrow('Unknown display target');
});

it('lets a later show override a hide and supports classifier kind selectors',()=>{
 const model=parseClass(source+'\nhide class methods\nshow Account methods');
 expect(JSON.parse(model.nodes[0]!.attributes.hiddenMembers!)).toEqual([]);
 expect(JSON.parse(model.nodes[1]!.attributes.hiddenMembers!)).toEqual([0]);
});


it('retains hidden layout constraints while removing excluded classifiers from layout',()=>{
 const base=createFinch().render(source,{editor:false});
 const hidden=createFinch().render(source+'\nhide Audit',{editor:false});
 const removed=createFinch().render(source+'\nremove Audit',{editor:false});
 expect(hidden.geometry.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height])).toEqual(base.geometry.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height]));
 expect(removed.geometry.nodes.map(n=>n.id)).toEqual(['Account']);
 expect(removed.geometry.edges).toHaveLength(0);
 expect(parseClass(source+'\nremove Audit\nshow Audit').nodes[1]!.attributes.removed).toBe('false');
});


it('controls empty attribute and operation compartments independently',()=>{
 const source='@class\nclass Empty {\n}';
 const height=(rules:string)=>createFinch().render(source+'\n'+rules,{editor:false}).geometry.nodes[0]!.height;
 const base=height('');
 expect(height('hide empty methods')).toBe(base);
 expect(height('hide empty fields')).toBe(base-23);
 expect(height('show empty methods')).toBe(base+23);
 expect(height('hide empty members\nshow empty methods')).toBe(base);
 expect(height('show empty members\nhide empty fields')).toBe(base);
});
