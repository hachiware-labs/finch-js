// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { createFinch, parseSequence, parseState, parseActivity, parseClass } from "../src/index";
import { rerouteGeometry } from "../src/layouts";
import { routeMidpoint } from "../src/utils";

beforeEach(() => { document.body.innerHTML = '<div id="diagram"></div>'; });
const render = (source: string) => createFinch().render(source, { target: '#diagram', editor: false });

it('renders alt and parallel operands and rejects misplaced or empty branches', () => {
 const source = `@sequence
participant a
participant b
alt yes
a -> b: request
else no
b --> a: error
end
par first
a -> b: log
and second
a -> b: notify
end`;
 const model=parseSequence(source);
 expect(model.groups[0]!.branches).toEqual([{start:1,label:'no'}]);
 const diagram=render(source);
 expect(document.querySelectorAll('.finch-sequence-divider')).toHaveLength(2);
 const group=diagram.geometry.groups[0]!;
 expect(group.branches![0]!.y).toBeGreaterThan(diagram.geometry.edges[0]!.points[0]!.y);
 expect(group.branches![0]!.y).toBeLessThan(diagram.geometry.edges[1]!.points[0]!.y);
 expect(()=>parseSequence('@sequence\nelse no')).toThrow();
 expect(()=>parseSequence('@sequence\nalt yes\na -> b\nelse no\nend')).toThrow();
});

it('lays out nested states and regions inside their boundaries', () => {
 const source=`@state
initial begin
state running {
 region left {
  initial a
  state ready
  a -> ready
 }
 region right {
  initial b
  state waiting
  b -> waiting
 }
}
final done
begin -> running
running -> done`;
 const instance=render(source);
 const find=(id:string)=>instance.geometry.nodes.find(n=>n.id===id)!;
 for(const child of instance.geometry.nodes.filter(n=>n.parentId)) {
  const parent=find(child.parentId!);
  expect(child.x).toBeGreaterThanOrEqual(parent.x);
  expect(child.y).toBeGreaterThan(parent.y);
  expect(child.x+child.width).toBeLessThanOrEqual(parent.x+parent.width);
  expect(child.y+child.height).toBeLessThanOrEqual(parent.y+parent.height);
 }
 expect(find('left').x+find('left').width).toBeLessThan(find('right').x);
 expect(find('begin').y).toBeLessThan(find('running').y);
 expect(find('running').y+find('running').height).toBeLessThan(find('done').y);
 expect(parseState('@state direction=LR\nstate a').direction).toBe('right');
 expect(()=>parseState('@state\nstate x {')).toThrow();
 expect(()=>parseState('@state\nregion x {\n}')).toThrow();
});

it('keeps swimlane ownership and shared time ranks', () => {
 const instance=render(`@activity
lane user {
 start a
 action c "Receive"
}
lane api {
 action b "Process"
}
a -> b
b -> c`);
 const find=(id:string)=>instance.geometry.nodes.find(n=>n.id===id)!;
 expect(find('a').y).toBeLessThan(find('b').y);
 expect(find('b').y).toBeLessThan(find('c').y);
 expect(find('user').y).toBe(find('api').y);
 expect(find('user').height).toBe(find('api').height);
 expect(find('b').x).toBeGreaterThan(find('api').x);
 expect(()=>parseActivity('@activity\nlane a {\nlane b {\n}\n}')).toThrow();
});

it('preserves nested package membership and cross-package relationships', () => {
 const source=`@class
package domain {
 package core {
  class Order {
   #id: UUID
  }
 }
}
package app {
 class Service {
  +execute(): void
 }
}
Service ..> Order`;
 expect(parseClass(source).nodes.find(n=>n.id==='Order')!.parentId).toBe('core');
 const instance=render(source);
 expect(instance.geometry.nodes).toHaveLength(5);
 expect(instance.geometry.edges).toHaveLength(1);
 expect(()=>parseClass('@class\npackage p {')).toThrow();
});

it('attaches notes to messages without adding sequence participants or activations', () => {
 const instance=render(`@sequence
participant a
participant b
a -> b: request
note a->b "idempotent"
constraint b "authorized"`);
 expect(document.querySelectorAll('.finch-lifeline')).toHaveLength(2);
 expect(document.querySelectorAll('.finch-activations rect')).toHaveLength(1);
 const notes=instance.geometry.nodes.filter(n=>n.attributes.annotationTarget);
 expect(notes).toHaveLength(2);
 expect(notes[1]!.label).toBe('{authorized}');
 const edge=instance.geometry.edges[0]!;
 instance.geometry.nodes.find(n=>n.id==='b')!.x+=50;
 rerouteGeometry(instance.geometry);
 const link=instance.geometry.edges.find(e=>e.to===notes[0]!.id)!;
 expect(link.points[0]).toEqual(routeMidpoint(edge.points));
 expect(()=>parseState('@state\nstate a\nnote absent "bad"')).toThrow();
});
