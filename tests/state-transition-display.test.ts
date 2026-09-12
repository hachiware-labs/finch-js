// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
it('keeps opposite state transitions on separate parallel vertical tracks',()=>{
 const i=createFinch().render('@state\nstate a\nstate b\na -> b: open\nb -> a: close',{editor:false});
 const [a,b]=i.geometry.edges;
 expect(a!.points.every(p=>p.x===a!.points[0]!.x)).toBe(true);
 expect(b!.points.every(p=>p.x===b!.points[0]!.x)).toBe(true);
 expect(Math.abs(a!.points[0]!.x-b!.points[0]!.x)).toBe(16);i.destroy();
});
it('groups only display connections and preserves transition data through updates',()=>{
 const source='@state\nstate a\nstate b\na -> b: open [ready] / begin\na -> b: resume [paused] / restore\nb -> a: close';
 const i=createFinch().render(source,{editor:false,stateTransitions:'group'});
 expect(i.model.connections).toHaveLength(3);expect(i.geometry.edges).toHaveLength(2);
 expect(i.geometry.edges[0]!.label).toContain('resume');expect(i.geometry.edges[0]!.label).toContain('open');
 expect(i.exportState().source).toBe(source);i.setTheme('midnight');i.update(source);expect(i.model.connections).toHaveLength(3);expect(i.geometry.edges).toHaveLength(2);i.destroy();
});
