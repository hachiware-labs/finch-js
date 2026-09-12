import {expect,it} from 'vitest';
import {parseClass} from '../src/index';

it('isolates duplicate names and resolves forward, nested and external references',()=>{
 const source=`@class
namespace billing {
 Service --> Model
 class Service {
 }
 class Model {
  +id: String
 }
 namespace storage {
  class Repository<T> {
  }
  Repository ..> Model
 }
 note Model::id "Billing key"
}
namespace shipping {
 class Model {
 }
 Model ..> billing.Model
}`;
 const model=parseClass(source);
 expect(model.nodes.filter(n=>n.shape==='uml-class').map(n=>n.id)).toEqual(['billing.Service','billing.Model','billing.storage.Repository','shipping.Model']);
 expect(model.nodes.find(n=>n.id==='billing.storage.Repository')?.attributes.templateParameters).toBe('T');
 expect(model.connections.map(e=>[e.from,e.to])).toEqual([['billing.Service','billing.Model'],['billing.storage.Repository','billing.Model'],['shipping.Model','billing.Model']]);
 expect(model.nodes.find(n=>n.attributes.annotationMember)?.attributes.annotationTarget).toBe('billing.Model');
 expect(model.source).toBe(source);
});

it('keeps short labels and infers a distinct root classifier for unresolved short references',()=>{
 const source='@class\nnamespace billing {\nclass Model {\n}\n}\n';
 expect(parseClass(source).nodes.find(n=>n.id==='billing.Model')?.label).toBe('Model');
 const model=parseClass(source+'class Client {\n}\nClient --> Model');
 expect(model.nodes.find(n=>n.id==='Model')!.attributes.implicit).toBe('true');
 expect(model.connections[0]!.to).toBe('Model');
});

it('isolates package frame IDs without changing the namespace of their classes',()=>{
 const model=parseClass(`@class
namespace sales {
 package models {
  class Model {
  }
 }
}
namespace shipping {
 package models {
  class Model {
  }
 }
}
sales.Model ..> shipping.Model`);
 expect(model.nodes.find(n=>n.id==='sales.models')?.parentId).toBe('sales');
 expect(model.nodes.find(n=>n.id==='shipping.models')?.parentId).toBe('shipping');
 expect(model.nodes.find(n=>n.id==='sales.Model')?.parentId).toBe('sales.models');
 expect(model.nodes.find(n=>n.id==='shipping.Model')?.parentId).toBe('shipping.models');
});

it('resolves association classes and relationship annotations in their namespace',()=>{
 const model=parseClass(`@class
namespace sales {
 class Customer {
 }
 class Product {
 }
 class Purchase {
 }
 Customer -- Product [id=buys]
 association Purchase Customer->Product
 note Customer->Product "Purchase history"
}`);
 const purchase=model.nodes.find(n=>n.id==='sales.Purchase')!;
 expect(purchase.attributes.associationEdge).toBe('buys');
 expect(model.nodes.find(n=>n.label==='Purchase history')?.attributes.annotationTarget).toBe('buys');
 const explicit=parseClass(`@class
namespace sales {
 class Customer {
 }
 class Product {
 }
 class Purchase {
 }
 Customer -- Product [id=buys]
 association Purchase buys
}`);
 expect(explicit.nodes.find(n=>n.id==='sales.Purchase')?.attributes.associationEdge).toBe('buys');
});


it('reopens namespaces while preserving a single frame and resolving later declarations',()=>{
 const model=parseClass(`@class
namespace sales "Sales" {
 class Client {
 }
 namespace internal {
  class Service {
  }
 }
 Client --> internal.Service
}
namespace sales {
 namespace internal {
  class Repository {
  }
  Service --> Repository
  note Repository "Persistence"
 }
}`);
 expect(model.nodes.filter(n=>n.id==='sales')).toHaveLength(1);
 expect(model.nodes.filter(n=>n.id==='sales.internal')).toHaveLength(1);
 expect(model.nodes.find(n=>n.id==='sales')?.label).toBe('Sales');
 expect(model.nodes.find(n=>n.id==='sales.internal.Repository')?.parentId).toBe('sales.internal');
 expect(model.connections.some(e=>e.from==='sales.internal.Service' && e.to==='sales.internal.Repository')).toBe(true);
 expect(model.nodes.find(n=>n.label==='Persistence')?.attributes.annotationTarget).toBe('sales.internal.Repository');
});

it('rejects conflicting namespace labels, duplicate classes and package collisions',()=>{
 expect(()=>parseClass('@class\nnamespace a "A" {\n}\nnamespace a "B" {\n}')).toThrow(/Conflicting/);
 expect(()=>parseClass('@class\nnamespace a {\nclass C {\n}\n}\nnamespace a {\nclass C {\n}\n}')).toThrow();
 expect(()=>parseClass('@class\npackage a {\n}\nnamespace a {\n}')).toThrow();
});


it('creates namespaces from qualified classifier names and merges explicit blocks',()=>{
 const source=`@class
class billing.storage.Repository<T> {
 +load(): T
}
namespace billing "Billing" {
 class Model {
 }
}
class shipping.Model {
}
billing.storage.Repository --> billing.Model
note billing.storage.Repository "Persistence"`;
 const model=parseClass(source);
 expect(model.nodes.find(n=>n.id==='billing')?.label).toBe('Billing');
 expect(model.nodes.find(n=>n.id==='billing.storage')?.parentId).toBe('billing');
 expect(model.nodes.find(n=>n.id==='billing.storage.Repository')?.parentId).toBe('billing.storage');
 expect(model.nodes.find(n=>n.id==='billing.storage.Repository')?.label).toBe('Repository');
 expect(model.nodes.filter(n=>n.id==='billing')).toHaveLength(1);
 expect(model.nodes.find(n=>n.label==='Persistence')?.attributes.annotationTarget).toBe('billing.storage.Repository');
 expect(model.source).toBe(source);
});


it('normalizes empty classifiers before namespace and template resolution',()=>{
 const model=parseClass('@class\nnamespace domain {\nclass Order\ninterface Store<T>\nabstract Base\nenum Status\nOrder ..> Store\n}\nclass outside.Client "Client"\noutside.Client ..> domain.Order');
 expect(model.nodes.filter(n=>n.shape==='uml-class').map(n=>n.id)).toEqual(['domain.Order','domain.Store','domain.Base','domain.Status','outside.Client']);
 expect(model.nodes.find(n=>n.id==='domain.Store')!.attributes.templateParameters).toBe('T');
 expect(model.connections).toHaveLength(2);
 for(const node of model.nodes.filter(n=>n.shape==='uml-class'))expect(JSON.parse(node.attributes.members!)).toEqual([]);
 expect(()=>parseClass('@class\nclass A\nclass A')).toThrow(/duplicate/i);
});
