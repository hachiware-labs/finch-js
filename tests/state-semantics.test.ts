// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseState, validateState } from '../src/index';

it('preserves pseudostate identity and renders termination as a cross', () => {
  const model = parseState('@state\nfinal done\nterminate stop\nfork f\njoin j');
  expect(model.nodes.map(n => n.attributes.stateKind)).toEqual(['final','terminate','fork','join']);
  document.body.innerHTML = '<div id="diagram"></div>';
  createFinch().render('@state\nterminate stop', { target:'#diagram', editor:false });
  expect(document.querySelector('path[d="M3 3 L25 25 M25 3 L3 25"]')).not.toBeNull();
});

it('reports invalid structure without breaking permissive parsing, and supports strict mode', () => {
  const source = '@state\ninitial i\nstate a\nfinal f\ni -> a\ni -> f\nf -> a';
  expect(validateState(parseState(source)).map(d => d.code)).toEqual(expect.arrayContaining(['initial-degree','terminal-outgoing']));
  expect(() => parseState(source.replace('@state','@state validation=strict'))).toThrow('initial-degree');
});

it('parses transition semantics and separates local from external and internal', () => {
  const model = parseState('@state validation=strict\nstate parent {\nstate child\n}\nparent -> child: retry [count / total > 0] / reset() [kind=local]\ninternal child "tick [ready] / count()"');
  expect(model.connections[0]?.attributes).toMatchObject({transitionKind:'local',trigger:'retry',guard:'count / total > 0',effect:'reset()'});
  expect(model.connections[0]?.label).toContain('{local}');
  expect(JSON.parse(model.nodes[1]!.attributes.stateBehaviors!)).toEqual([{kind:'internal',trigger:'tick',triggerKind:'event',guard:'ready',effect:'count()'}]);
  expect(model.diagnostics).toEqual([]);
});

it('checks region ownership and pseudostate segment restrictions', () => {
  const model = parseState('@state\nstate s {\nregion r {\nregion q {\nstate a\n}\n}\n}\nfork f\nchoice c\nf -> c: event [ready]\na -> r');
  expect(model.diagnostics?.map(d => d.code)).toEqual(expect.arrayContaining(['region-owner','fork-target','pseudostate-trigger','pseudostate-guard','region-endpoint']));
  expect(() => parseState('@state\nstate s {\nregion r {\nstate a\n}\n}\nentry r "run()"')).toThrow('requires a state');
});

it('rejects invalid local targets and keeps unlabeled completion transitions triggerless', () => {
  const model = parseState('@state\nstate a\nstate b\na -> b: [kind=local]');
  expect(model.diagnostics?.map(d => d.code)).toContain('local-target');
  expect(model.connections[0]?.attributes?.trigger).toBe('');
  expect(parseState('@state validation=strict\ninitial i\nstate a\nfinal f\ni -> a\na -> f').diagnostics).toEqual([]);
});

it('keeps division and quoted slashes inside state event expressions',()=>{
 for(const trigger of ['after(timeout / 2)','when(path == "a/b")','event("] / value")']){
  const model=parseState(`@state\nstate A\nstate B\nA -> B: ${trigger} [ready] / run()`);
  expect(model.connections[0]?.attributes).toMatchObject({trigger,guard:'ready',effect:'run()'});
 }
});

it('distinguishes event argument brackets from the outer transition guard',()=>{
 for(const trigger of ['event(items[0])','event("[ready]")','when(values[0] > 1)']){
  for(const guard of ['', ' [items[1] == "]"]']){
   const model=parseState(`@state\nstate A\nstate B\nA -> B: ${trigger}${guard} / run()`);
   const attributes=model.connections[0]!.attributes!;
   expect(attributes.trigger).toBe(trigger);
   expect(attributes.guard).toBe(guard?'items[1] == "]"':undefined);
   expect(attributes.effect).toBe('run()');
  }
 }
});

it('round-trips inherited internal and external transition expressions including empty effects',()=>{
 const model=parseState(`@state
machine Base {
 state A
 state B
 internal A "after(timeout / 2) [items[0] > 0] /"
 A -> B: when(items[1] > 0) /
}
machine Derived extends Base {
}
state Use [submachine=Derived]`);
 const derived=model.stateMachines!.Derived!;
 const reparsed=parseState(derived.source);
 for(const candidate of [derived,reparsed]){
  const behavior=JSON.parse(candidate.nodes.find(n=>n.id==='A')!.attributes.stateBehaviors!)[0];
  expect(behavior).toMatchObject({trigger:'after(timeout / 2)',guard:'items[0] > 0',effect:''});
  expect(candidate.connections[0]!.attributes).toMatchObject({trigger:'when(items[1] > 0)',effect:''});
 }
});

it('preserves inherited node presentation attributes and dashed transitions in standalone source',()=>{
 const model=parseState(`@state
machine Base {
 state A [icon=server image=./avatar.png tone=green wrapWidth=150 custom=keep]
 state B
 A --> B: go [fromPort=right toPort=left]
}
machine Derived extends Base {
}
state Use [submachine=Derived]`);
 const derived=model.stateMachines!.Derived!;
 const reparsed=parseState(derived.source);
 expect(reparsed.nodes.find(n=>n.id==='A')?.attributes).toMatchObject({icon:'server',image:'./avatar.png',tone:'green',wrapWidth:'150',custom:'keep'});
 expect(reparsed.connections[0]).toMatchObject({dashed:true,attributes:{trigger:'go',fromPort:'right',toPort:'left'}});
});
