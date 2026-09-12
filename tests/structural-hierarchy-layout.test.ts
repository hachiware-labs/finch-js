// @vitest-environment jsdom
import {it, expect} from 'vitest';
import {createFinch} from '../src/index';

for (const nested of [false, true]) {
  for (const relation of ['Child --|> Parent', 'Parent <|.. Child']) {
    it(`places the parent above the child despite an earlier opposing association (${nested}, ${relation})`, () => {
      const source = `@class\n${nested ? 'package domain {\n' : ''}class Child\nclass Parent\nChild --> Parent\n${relation}\n${nested ? '}' : ''}`;
      const instance = createFinch().render(source, {editor:false});
      const parent = instance.geometry.nodes.find(n=>n.label==='Parent')!;
      const child = instance.geometry.nodes.find(n=>n.label==='Child')!;
      expect(parent.y + parent.height).toBeLessThan(child.y);
      instance.destroy();
    });
  }
}
for (const kind of ['class', 'object']) {
  for (const relation of ['Whole *-- Part', 'Part --o Whole']) {
    it(`places the whole above the part in ${kind}: ${relation}`, () => {
      const instance=createFinch().render(`@${kind}\n${kind} Part\n${kind} Whole\nPart --> Whole\n${relation}`, {editor:false});
      const n=(id:string)=>instance.geometry.nodes.find(n=>n.id===id)!;
      expect(n('Whole').y+n('Whole').height).toBeLessThan(n('Part').y);
      expect(instance.model.connections[0]).toMatchObject({from:'Part',to:'Whole'});
      instance.destroy();
    });
  }
}
it('keeps saved manual positions ahead of inferred hierarchy',()=>{
 const instance=createFinch().render('@class\nChild --|> Parent',{editor:false,overlay:{version:1,nodes:{Child:{x:90,y:20,manual:true,pinned:true}}}});
 expect(instance.geometry.nodes.find(n=>n.id==='Child')).toMatchObject({x:90,y:20});
 instance.destroy();
});
