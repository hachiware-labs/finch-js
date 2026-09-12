// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseClass, parseState } from '../src/index';
import { rerouteGeometry } from '../src/layouts';

const source=`@class
class Account {
 +save()
 -balance: Money
 +save(force: Boolean)
}
note Account::balance "Must remain nonnegative"
note Account::save() "Persist changes"`;

it('resolves fields and exact overloaded signatures, preserving references to semantic members',()=>{
 const model=parseClass(source);
 expect(model.nodes[1]!.attributes.annotationMember).toBe('1');
 expect(model.nodes[2]!.attributes.annotationMember).toBe('0');
 expect(parseClass(source+'\nnote Account::save(force: Boolean) \"Force mode\"').nodes[3]!.attributes.annotationMember).toBe('2');
 expect(()=>parseClass(source+'\nnote Account::save "Ambiguous"')).toThrow('ambiguous');
 expect(()=>parseClass(source+'\nnote Account::missing "Missing"')).toThrow('Unknown');
});

it('attaches to the rendered member row and follows a dragged class',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes.find(n=>n.id==='Account')!;
 const links=instance.geometry.edges.filter(e=>e.attributes?.annotation);
 expect(links[0]!.points[0]!.y).toBe(node.y+61);
 expect(links[1]!.points[0]!.y).toBe(node.y+85);
 node.y+=100;
 rerouteGeometry(instance.geometry);
 expect(links[0]!.points[0]!.y).toBe(node.y+61);
});

it('hides notes for hidden members while retaining the semantic annotations',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source+'\nhide fields',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.some(n=>n.attributes.annotationMember==='1')).toBe(false);
 expect(instance.geometry.nodes.some(n=>n.attributes.annotationMember==='0')).toBe(true);
 expect(parseClass(source+'\nhide fields').nodes).toHaveLength(3);
});

it('resolves language-style declarations by name without guessing between overloads',()=>{
 const source=`@class
class Worker {
 -int counter
 +void start(int timeout)
 +void start()
}
note Worker::counter "Number of attempts"
note Worker::void start(int timeout) "Bounded wait"`;
 const model=parseClass(source);
 expect(model.nodes[1]!.attributes.annotationMember).toBe('0');
 expect(model.nodes[2]!.attributes.annotationMember).toBe('1');
 expect(()=>parseClass(source+'\nnote Worker::start "Which overload?"')).toThrow('ambiguous');
});

it('matches actual SVG row positions with a wrapped generic interface heading',()=>{
 const source=`@class
interface Repository<K, V> "A very long repository interface heading that wraps over multiple lines" {
 +get(key: K): V
 -cache: Map
}
note Repository::get "Lookup contract"
hide fields`;
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const node=instance.geometry.nodes.find(n=>n.id==='Repository')!;
 const row=[...document.querySelectorAll('text')].find(t=>t.textContent==='+get(key: K): V')!;
 expect(row).toBeTruthy();
 const link=instance.geometry.edges.find(e=>e.attributes?.annotation)!;
 expect(link.points[0]!.y).toBeCloseTo(node.y+Number(row.getAttribute('y'))-5);
});

it('places explicit left notes outside the diagram and reconnects their right edge after dragging',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\na -> b: request\nnote left of a "Explanation"',{target:'#diagram',editor:false});
 const target=instance.geometry.nodes.find(node=>node.id==='a')!;
 const note=instance.geometry.nodes.find(node=>node.attributes.annotationTarget==='a')!;
 expect(note.x+note.width).toBeLessThan(target.x);
 const link=instance.geometry.edges.find(edge=>edge.to===note.id)!;
 expect(link.points[0]!.x).toBe(target.x);
 expect(link.points[1]!.x).toBe(note.x+note.width);
 note.x-=20;rerouteGeometry(instance.geometry);
 expect(link.points[1]!.x).toBe(note.x+note.width);
 expect(instance.geometry.origin!.x).toBeLessThanOrEqual(note.x+20);
 instance.destroy();
});

it('lays out left and right notes independently while keeping notes on each side separated',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nalt Ready\na -> b: request\nend\nnote left of a "Left one"\nnote right of a "Right one"\nnote left of a "Left two"',{target:'#diagram',editor:false});
 const notes=instance.geometry.nodes.filter(node=>node.attributes.annotationTarget);
 expect(notes[0]!.y).toBe(notes[1]!.y);
 expect(notes[2]!.y).toBeGreaterThan(notes[0]!.y+notes[0]!.height);
 expect(notes[0]!.x+notes[0]!.width).toBeLessThan(instance.geometry.groups[0]!.x);
 instance.destroy();
});

it('keeps annotation-like classifier members literal while applying external notes',()=>{
 const source=`@class
class Example {
 note other "member text"
 hnote other "hex member"
 rnote other "rect member"
 stereotype other "member stereotype"
 association other source
}
note Example "Real annotation"`;
 const model=parseClass(source);
 const classifier=model.nodes.find(node=>node.id==='Example')!;
 expect(JSON.parse(classifier.attributes.members!).map((member:{text:string})=>member.text)).toEqual(['note other "member text"','hnote other "hex member"','rnote other "rect member"','stereotype other "member stereotype"','association other source']);
 expect(model.nodes.filter(node=>node.attributes.annotationTarget)).toHaveLength(1);
 expect(model.nodes.find(node=>node.attributes.annotationTarget)!.label).toBe('Real annotation');
});

it('supports multiline class notes without consuming literal member or heading text',()=>{
 const source=`@class
header
note literal
end header
class Example {
 note other
}
hnote left of Example
First line
header "literal"
end hnote`;
 const model=parseClass(source);
 expect(model.diagramText!.header).toBe('note literal');
 expect(JSON.parse(model.nodes.find(node=>node.id==='Example')!.attributes.members!)[0].text).toBe('note other');
 const note=model.nodes.find(node=>node.attributes.annotationTarget)!;
 expect(note.attributes).toMatchObject({noteShape:'hnote',annotationSide:'left',annotationTarget:'Example'});
 expect(note.label).toContain('header "literal"');
 expect(model.source).toBe(source);
});

it('keeps state transitions unchanged when adding a multiline constraint',()=>{
 const source='@state\nstate ready "Ready"\nstate done "Done"\nready -> done: finish';
 const plain=parseState(source);
 const annotated=parseState(source+'\nconstraint ready\nMust be initialized\nBefore processing\nend constraint');
 expect(annotated.connections).toEqual(plain.connections);
 expect(annotated.nodes.find(node=>node.attributes.annotationTarget)!.attributes.annotationTarget).toBe('ready');
});

it('resolves namespaced overloaded members for shaped multiline notes',()=>{
 const source=`@class
namespace domain {
 class Worker {
  +start()
  +start(int timeout)
 }
 hnote left of Worker::start(int timeout)
 Bounded wait
 Retry on timeout
 end hnote
}`;
 const model=parseClass(source);
 const note=model.nodes.find(node=>node.attributes.annotationTarget)!;
 expect(note.attributes).toMatchObject({annotationTarget:'domain.Worker',annotationKind:'member',annotationMember:'1',annotationSide:'left',noteShape:'hnote'});
 expect(()=>parseClass(source.replace('Worker::start(int timeout)','Worker::start'))).toThrow(/ambiguous/);
});

it('places top and bottom notes outside the diagram with vertical attachment points',()=>{
 document.head.innerHTML='';document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@class\nclass Account {}\nnote top of Account "Before"\nnote bottom of Account "After"',{target:'#diagram',editor:false});
 const target=instance.geometry.nodes.find(node=>node.id==='Account')!;
 for(const side of ['top','bottom']){
  const note=instance.geometry.nodes.find(node=>node.attributes.annotationSide===side)!;
  const link=instance.geometry.edges.find(edge=>edge.to===note.id)!;
  if(side==='top')expect(note.y+note.height).toBeLessThan(target.y);else expect(note.y).toBeGreaterThan(target.y+target.height);
  expect(link.points[0]).toEqual({x:target.x+target.width/2,y:target.y+(side==='bottom'?target.height:0)});
  expect(link.points[1]).toEqual({x:note.x+note.width/2,y:note.y+(side==='top'?note.height:0)});
  note.x+=30;note.y+=10;rerouteGeometry(instance.geometry);
  expect(link.points[1]).toEqual({x:note.x+note.width/2,y:note.y+(side==='top'?note.height:0)});
 }
 instance.destroy();
});
