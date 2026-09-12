// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch,parseDeployment} from '../src/index';
it('switches visibility icons on and off while preserving escaped member prefixes',()=>{
 const source='@class\nskinparam classAttributeIconSize 10\nclass A {\n+publicField\n-privateField\n#protectedMethod()\n~packageMethod()\n}';
 const instance=createFinch().render(source,{editor:false});
 expect(instance.svg.querySelectorAll('.finch-visibility-icon')).toHaveLength(4);
 instance.setTheme('midnight');
 expect(instance.svg.querySelectorAll('.finch-visibility-icon')).toHaveLength(4);
 instance.update(source.replace('Size 10','Size 0'));
 expect(instance.svg.querySelectorAll('.finch-visibility-icon')).toHaveLength(0);
 expect(instance.svg.textContent).toContain('+publicField');
 instance.destroy();
});
it('renders stereotype spotted characters with their specified color',()=>{
 const instance=createFinch().render('@class\nclass A <<(S,LightBlue) Service>>',{editor:false});
 expect(instance.svg.querySelector('.finch-stereotype-spot circle')?.getAttribute('fill')).toBe('LightBlue');
 expect(instance.svg.querySelector('.finch-stereotype-spot text')?.textContent).toBe('S');
 expect(instance.svg.textContent).toContain('Service');
 expect(instance.svg.textContent).not.toContain('(S,');
 instance.destroy();
});

it('supports custom namespace separators and anonymous diamond declarations',()=>{
 const instance=createFinch().render('@class\nset namespaceSeparator ::\nclass app::Service\nclass app::Store\napp::Service --> app::Store\n<>',{editor:false});
 expect(instance.model.nodes.some(n=>n.id==='app.Service')).toBe(true);
 expect(instance.model.connections[0]).toMatchObject({from:'app.Service',to:'app.Store'});
 expect(instance.model.nodes.some(n=>n.shape==='diamond'&&n.label==='')).toBe(true);
 instance.destroy();
 const plain=createFinch().render('@class\nset namespaceSeparator none\nclass app.Service',{editor:false});
 expect(plain.model.nodes.some(n=>n.shape==='container')).toBe(false);
 plain.destroy();
});

it('parses multiline display aliases including first and last lines',()=>{
 const source='@deployment\ncomponent Service as "First\nSecond\nLast"\ncomponent Client\nClient -> Service';
 const model=parseDeployment(source);
 expect(model.nodes.find(n=>n.id==='Service')?.label).toBe('First\\nSecond\\nLast');
 expect(model.connections[0]?.to).toBe('Service');
});

it('supports wildcard generic declarations and nested template substitutions',()=>{
 const instance=createFinch().render('@class\nclass Template<T, U>\nclass Concrete\nclass Wildcard<? extends Element>\nbind Concrete Template "T=Map<Key, List<Value>>, U=Pair<A, B>"',{editor:false});
 const binding=instance.model.connections.find(e=>e.attributes?.templateBinding)!;
 expect(JSON.parse(binding.attributes!.templateBinding!)).toEqual({T:'Map<Key, List<Value>>',U:'Pair<A, B>'});
 expect(instance.model.nodes.find(n=>n.id==='Wildcard')?.attributes.templateParameters).toBe('? extends Element');
 instance.destroy();
});
