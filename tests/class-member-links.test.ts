// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch,parseClass} from '../src/index';
import {resizeAncestorContainers,rerouteGeometry} from '../src/layouts';
import {annotationAnchor} from '../src/member-annotations';
const source=`@class
class Account {
 +id: String
 +save()
}
class Record {
 +key: String
}
Account::id --> Record::key: stored as`;
it('resolves member endpoints and routes to their actual rows',()=>{
 const model=parseClass(source);expect(model.connections[0]!.attributes?.fromMemberIndex).toBe('0');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const edge=instance.geometry.edges[0]!;
 expect(edge.points[0]!.y).toBe(annotationAnchor(instance.geometry.nodes.find(n=>n.id==='Account')!,'0').y);
 expect(edge.points[edge.points.length-1]!.y).toBe(annotationAnchor(instance.geometry.nodes.find(n=>n.id==='Record')!,'0').y);
 expect(()=>parseClass(source.replace('Account::id','Account::missing'))).toThrow(/member/);
});

it('resolves namespace-local members and hides edges attached to hidden fields',()=>{
 const wrapped=source.replace('@class','@class\nnamespace data {')+'\n}';
 expect(parseClass(wrapped).connections[0]!.from).toBe('data.Account');
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(wrapped+'\nhide data.Account fields',{target:'#diagram',editor:false});
 expect(document.querySelector('.finch-edges')?.children).toHaveLength(0);
});


it('distinguishes overloaded operation signatures with UML and language-style return types',()=>{
 const source=`@class
class Store {
 +load(): Record
 +load(id: String): Record
 +void save(Record record)
}
class Record {
 +id: String
}
Store::load(id: String) --> Record::id
Store::save(Record record) --> Record
note Store::load() "Default record"`;
 const model=parseClass(source);
 expect(model.connections.map(edge=>edge.attributes?.fromMemberIndex)).toEqual(['1','2']);
 expect(model.nodes.find(node=>node.label==='Default record')?.attributes.annotationMember).toBe('0');
 expect(()=>parseClass(source+'\nStore::load --> Record')).toThrow(/ambiguous/);
});


it('keeps member detours clear of package borders after layout and dragging',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source.replace('@class','@class\nnamespace data {')+'\n}',{target:'#diagram',editor:false});
 const geometry=instance.geometry;
 const frame=geometry.nodes.find(node=>node.id==='data')!;
 const check=()=>{
  for(const edge of geometry.edges)for(const point of edge.points){
   expect(point.x-frame.x).toBeGreaterThanOrEqual(20);
   expect(frame.x+frame.width-point.x).toBeGreaterThanOrEqual(20);
  }
 };
 check();
 const account=geometry.nodes.find(node=>node.id==='data.Account')!;
 account.x+=40;
 resizeAncestorContainers(geometry.nodes,[account.id]);
 rerouteGeometry(geometry);
 check();
});
