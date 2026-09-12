// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseState } from '../src/index';
import { rerouteGeometry } from '../src/layouts';

const parallel = `@state validation=strict
state idle
fork f
state work {
 region left {
  state a
 }
 region right {
  state b
 }
}
join j
final done
idle -> f: start
f -> a
f -> b
a -> j
b -> j
j -> done`;

it('accepts orthogonal branches and rejects same-region fork/join and direct region crossing', () => {
  expect(parseState(parallel).diagnostics).toEqual([]);
  expect(() => parseState(parallel.replace('f -> b','f -> a'))).toThrow('parallel-regions');
  expect(() => parseState(parallel + '\na -> b')).toThrow('cross-region');
  document.body.innerHTML = '<div id="diagram"></div>';
  createFinch().render(parallel, {target:'#diagram',editor:false});
  expect(document.querySelectorAll('.finch-region-divider')).toHaveLength(1);
});

it('distinguishes shallow and deep history target scope and validates defaults', () => {
  const source = `@state validation=strict
state s {
 history h
 state child {
  state leaf
 }
 h -> child
}`;
  expect(parseState(source).diagnostics).toEqual([]);
  expect(() => parseState(source.replace('h -> child','h -> leaf'))).toThrow('history-target');
  expect(parseState(source.replace('history h','deep-history h').replace('h -> child','h -> leaf')).diagnostics).toEqual([]);
  expect(() => parseState(source.replace('h -> child','h -> child: [ready]'))).toThrow('history-guard');
});

const machine = `machine Payment {
 entryPoint start
 state active
 exitPoint finish
 start -> active
 active -> finish: accepted
}
state idle
state pay "Pay" [submachine=Payment]
entryPoint input [state=pay ref=start]
exitPoint output [state=pay ref=finish]
final done
idle -> input: submit
output -> done`;

it('resolves submachine definitions and typed connection point references', () => {
  const model = parseState('@state validation=strict\n' + machine);
  expect(model.stateMachines?.Payment?.nodes).toHaveLength(3);
  expect(model.diagnostics).toEqual([]);
  expect(model.nodes.find(n => n.id === 'input')?.parentId).toBe('pay');
  expect(() => parseState('@state validation=strict\n' + machine.replace('ref=start','ref=finish'))).toThrow('point-reference');
  expect(() => parseState('@state validation=strict\n' + machine.replace('submachine=Payment','submachine=Missing'))).toThrow('submachine-reference');
});

it('validates machine bodies after state behaviors and diagnoses recursive definitions', () => {
  expect(() => parseState('@state validation=strict\nmachine A {\nstate s [submachine=A]\n}\nstate use [submachine=A]')).toThrow('submachine-cycle');
  expect(() => parseState('@state validation=strict\nmachine A {\nfinal f\nstate s\nf -> s\n}\nstate use [submachine=A]')).toThrow('terminal-outgoing');
  expect(() => parseState('@state\nstate s {\nmachine A {\nstate x\n}\n}')).toThrow('top-level');
  expect(() => parseState('@state\nmachine A {\nstate x\n}\nmachine A {\nstate y\n}')).toThrow('Duplicate machine');
});

it('places referenced entry/exit points on a submachine boundary and keeps them attached on reroute', () => {
  document.body.innerHTML = '<div id="diagram"></div>';
  const instance = createFinch().render('@state validation=strict\n' + machine, {target:'#diagram',editor:false});
  const owner = instance.geometry.nodes.find(n => n.id === 'pay')!;
  const entry = instance.geometry.nodes.find(n => n.id === 'input')!;
  const exit = instance.geometry.nodes.find(n => n.id === 'output')!;
  expect(entry.y + entry.height / 2).toBe(owner.y);
  expect(exit.y + exit.height / 2).toBe(owner.y + owner.height);
  owner.x += 80; owner.y += 30; rerouteGeometry(instance.geometry);
  expect(entry.x + entry.width / 2).toBe(owner.x + owner.width / 2);
  expect(entry.y + entry.height / 2).toBe(owner.y);
  expect(document.querySelector('path[d="M5 5 L19 19 M19 5 L5 19"]')).not.toBeNull();
  expect(document.body.textContent).toContain('Pay : Payment');
});

it('accepts composite connection points and rejects reversed boundary transitions', () => {
  const source = `@state validation=strict
state idle
state s {
 entryPoint input
 state a
 exitPoint output
 input -> a
 a -> output
}
final done
idle -> input: enter
output -> done`;
  expect(parseState(source).diagnostics).toEqual([]);
  expect(() => parseState(source.replace('input -> a','input -> idle'))).toThrow('entry-direction');
  expect(() => parseState(source.replace('output -> done','output -> a'))).toThrow('exit-direction');
});

it('approaches boundary points perpendicular to the frame before and after rerouting', () => {
  document.body.innerHTML = '<div id="diagram"></div>';
  const instance = createFinch().render(`@state
state session {
 state active
 exitPoint leave
 active -> leave: pause
}
state paused
leave -> paused`, {target:'#diagram',editor:false});
  const check = () => {
    const point = instance.geometry.nodes.find(n => n.id === 'leave')!;
    const edge = instance.geometry.edges.find(e => e.to === 'leave')!;
    const last = edge.points[edge.points.length - 1]!;
    const previous = edge.points[edge.points.length - 2]!;
    expect(last.x).toBe(previous.x);
    expect(last.y).toBe(point.y);
    expect(previous.y).toBeLessThan(last.y);
  };
  check();
  instance.geometry.nodes.find(n => n.id === 'active')!.x += 100;
  rerouteGeometry(instance.geometry);
  check();
});

it('routes an exit back to an external state around the composite frame', () => {
  document.body.innerHTML = '<div id="diagram"></div>';
  const instance = createFinch().render(`@state
state paused
state session {
 entryPoint enter
 state active
 exitPoint leave
 enter -> active
 active -> leave: pause
}
paused -> enter: resume
leave -> paused`, {target:'#diagram',editor:false});
  const check = () => {
    const owner = instance.geometry.nodes.find(n => n.id === 'session')!;
    const edge = instance.geometry.edges.find(e => e.from === 'leave')!;
    for (let i = 1; i < edge.points.length; i++) {
      const a = edge.points[i-1]!, b = edge.points[i]!;
      const crosses = a.x === b.x
        ? a.x > owner.x && a.x < owner.x + owner.width && Math.max(a.y,b.y) > owner.y && Math.min(a.y,b.y) < owner.y + owner.height
        : a.y > owner.y && a.y < owner.y + owner.height && Math.max(a.x,b.x) > owner.x && Math.min(a.x,b.x) < owner.x + owner.width;
      expect(crosses).toBe(false);
    }
  };
  check();
  instance.geometry.nodes.find(n => n.id === 'session')!.width += 60;
  rerouteGeometry(instance.geometry);
  check();
});


it('stacks orthogonal regions vertically without changing state semantics',()=>{
 const source=parallel.replace('state work {','state work [regions=rows] {');
 const model=parseState(source);
 expect(model.connections.map(e=>[e.from,e.to])).toEqual(parseState(parallel).connections.map(e=>[e.from,e.to]));
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const left=instance.geometry.nodes.find(n=>n.id==='left')!,right=instance.geometry.nodes.find(n=>n.id==='right')!;
 expect(left.x).toBe(right.x);
 expect(left.y+left.height).toBeLessThan(right.y);
 expect(left.width).toBe(right.width);
 expect(document.querySelector('.finch-region-divider')?.getAttribute('d')).toContain('H');
 expect(()=>parseState(parallel.replace('state work {','state work [regions=diagonal] {'))).toThrow(/regions/);
});

it('preserves region arrangement and container tone in inherited machine source',()=>{
 const source=`@state validation=strict
machine Base {
 state work "Work" [regions=rows tone=blue] {
  region one {
   state a
  }
  region two {
   state b
  }
 }
}
machine Derived extends Base {
}
state use [submachine=Derived]`;
 const model=parseState(source);
 const derived=model.stateMachines!.Derived!;
 const restored=parseState(derived.source);
 expect(restored.nodes.find(n=>n.id==='work')?.attributes).toMatchObject({regions:'rows',tone:'blue'});
 expect(restored.nodes.map(n=>[n.id,n.parentId])).toEqual(derived.nodes.map(n=>[n.id,n.parentId]));
});

it('keeps state boundary pins distinct from pseudostates and routes them on the frame',()=>{
 const source=`@state validation=strict
state outside
state session {
 inputPin incoming
 entryPoint other
 state active
 outputPin outgoing
 incoming -> active
 other -> active
 active -> outgoing
}
state done
outside -> incoming
outside -> other
outgoing -> done`;
 const model=parseState(source);
 expect(model.nodes.find(n=>n.id==='incoming')?.attributes.stateKind).toBe('inputpin');
 expect(model.connections.find(e=>e.from==='incoming')?.attributes?.transitionKind).not.toBe('local');
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const nodes=instance.geometry.nodes;
 const owner=nodes.find(n=>n.id==='session')!,pin=nodes.find(n=>n.id==='incoming')!,other=nodes.find(n=>n.id==='other')!,out=nodes.find(n=>n.id==='outgoing')!;
 expect(pin.y+pin.height/2).toBe(owner.y);
 expect(out.y+out.height/2).toBe(owner.y+owner.height);
 expect(pin.x).not.toBe(other.x);
 expect(document.querySelectorAll('.finch-state-pin')).toHaveLength(2);
 expect(()=>parseState(source+'\nactive -> incoming')).toThrow(/input\/output/);
 expect(()=>parseState('@state validation=strict\ninputPin orphan')).toThrow(/owner/);
});
