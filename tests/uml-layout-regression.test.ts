// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
import {placeEdgeLabels} from '../src/edge-labels';
import type {Geometry} from '../src/types';
it('keeps UML stereotype words intact on short horizontal segments',()=>{
 const geometry:Geometry={kind:'usecase',nodes:[],groups:[],width:300,height:200,edges:[{id:'e',from:'a',to:'b',order:0,dashed:true,label:'«include»',points:[{x:50,y:80},{x:105,y:80}]}]};
 expect(placeEdgeLabels(geometry,12).labels.get('e')!.lines).toEqual(['«include»']);
});
it('enters lane actions from above and leaves below without reversing the same port',()=>{
 const instance=createFinch().render(`@activity flow
lane user "User" {
 start begin
 action submit "Submit"
}
lane system "System" {
 action validate "Validate"
}
in user
action confirm "Confirm"
in system
end done`,{editor:false});
 const check=()=>{
 const node=instance.geometry.nodes.find(n=>n.id==='validate')!;
 const incoming=instance.geometry.edges.find(e=>e.to==='validate')!.points.slice(-1)[0]!;
 const outgoing=instance.geometry.edges.find(e=>e.from==='validate')!.points[0]!;
 expect(incoming.y).toBe(node.y);expect(outgoing.y).toBe(node.y+node.height);
 };
 check();instance.setTheme('midnight');check();instance.destroy();
});

