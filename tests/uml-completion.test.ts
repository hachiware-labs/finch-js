// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseSequence, parseState, parseActivity, parseClass } from '../src/index';
import { rerouteGeometry } from '../src/layouts';
const render = (source:string) => { document.body.innerHTML='<div id="diagram"></div>'; return createFinch().render(source,{target:'#diagram',editor:false}); };

it('isolates creation, destruction and execution in alternative operands',()=>{
 const source=`@sequence
participant a
alt first
create b
a -> b: first
activate b
b --> a: result
deactivate b
destroy b
else second
create b
a -> b: second
activate b
b --> a: result
deactivate b
destroy b
end`;
 expect(parseSequence(source).connections).toHaveLength(4);
 render(source);
 expect(document.querySelectorAll('.finch-created-header')).toHaveLength(2);
 expect(document.querySelectorAll('.finch-destruction')).toHaveLength(2);
 expect(document.querySelectorAll('.finch-activation')).toHaveLength(2);
 expect(()=>parseSequence(source+'\na -> b: invalid')).toThrow('destroyed');
});

it('does not allow a sibling operand to deactivate another operand activation',()=>{
 expect(()=>parseSequence('@sequence\nalt a\na -> b\nactivate b\nelse b\na -> b\ndeactivate b\nend')).toThrow('no explicit activation');
});

it('checks optional creation and conflicting concurrent lifetimes',()=>{
 expect(()=>parseSequence('@sequence\nopt enabled\ncreate b\na -> b\nend\na -> b')).toThrow('destroyed');
 expect(()=>parseSequence('@sequence\npar first\ncreate b\na -> b\nand second\ncreate b\na -> b\nend')).toThrow('conflicting lifetimes');
});

it('expands conditional break and continue without connecting their fallthrough',()=>{
 const model=parseActivity(`@activity
while work "more?" {
 action read
 if skip "skip?" {
  continue
 }
 if cancel "cancel?" {
  break
 }
 action save
}
end done
work.done -> done`);
 const skip=model.nodes.find(n=>n.id.includes('.continue'))!;
 const stop=model.nodes.find(n=>n.id.includes('.break'))!;
 expect(model.connections.filter(e=>e.from===skip.id).map(e=>e.to)).toEqual(['work']);
 expect(model.connections.filter(e=>e.from===stop.id).map(e=>e.to)).toEqual(['work.done']);
});

it('permits explicit loop branches to override implicit sequential connections',()=>{
 const model=parseActivity('@activity\nwhile w "more?" {\n decision d\n action a\n action b\n d -> a: [yes]\n d -> b: [no]\n}\n');
 expect(model.connections.filter(e=>e.from==='d')).toHaveLength(2);
});

it('retains time, change and deferred events and protocol conditions',()=>{
 const model=parseState('@state\nstate a\nstate b\na -> b: after(5s)\nb -> a: when(ready)\ndefer a "refresh"');
 expect(model.connections.map(e=>e.attributes?.triggerKind)).toEqual(['time','change']);
 expect(model.nodes[0]?.attributes.defer).toBe('refresh');
 const protocol=parseState('@state protocol validation=strict\nstate a\nstate b\na -> b: open [pre="ready" post="opened"]');
 expect(protocol.connections[0]?.label).toBe('[ready] open / [opened]');
 expect(()=>parseState('@state protocol validation=strict\nstate a\nentry a "run()"')).toThrow('protocol-state');
});

it('inherits machine vertices and allows stable transition IDs to be redefined',()=>{
 const model=parseState(`@state validation=strict
machine Base {
 state a
 state b
 a -> b: open [id=change]
}
machine Derived extends Base {
 a -> b: retry [id=change]
}
state use [submachine=Derived]`);
 expect(model.stateMachines?.Derived?.nodes).toHaveLength(2);
 expect(model.stateMachines?.Derived?.connections.map(e=>e.label)).toEqual(['retry']);
 expect(parseState(model.stateMachines!.Derived!.source).connections[0]?.label).toBe('retry');
});

it('accepts multiple referenced connection points with matching kinds',()=>{
 const model=parseState(`@state validation=strict
machine M {
 entryPoint a
 entryPoint b
 state x
 a -> x
 b -> x
}
state use [submachine=M]
entryPoint in [state=use ref=a,b]`);
 expect(model.diagnostics).toEqual([]);
 expect(()=>parseState(model.source.replace('ref=a,b','ref=a,missing'))).toThrow('point-reference');
});

it('renders direct relations of association classes and selects parallel relations by ID',()=>{
 const source=`@class
class A {
}
class B {
}
class Link {
}
class C {
}
A -- B [id=one]
A -- B [id=two]
association Link two
Link --> C`;
 expect(parseClass(source).nodes.find(n=>n.id==='Link')?.attributes.associationEdge).toBe('two');
 const instance=render(source); rerouteGeometry(instance.geometry);
 expect(instance.geometry.edges.some(e=>e.from==='Link' && e.to==='C')).toBe(true);
 expect(instance.geometry.nodes.filter(n=>n.id==='Link')).toHaveLength(1);
});
