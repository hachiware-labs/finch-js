// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createFinch} from '../src/index';

it('preserves role symbols when a participant is created in alternative operands',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(`@sequence
participant client
control job "Job"
alt first
create job
client -> job: start
destroy job
else second
create job
client -> job: start
destroy job
end`,{target:'#diagram',editor:false});
 const headers=document.querySelectorAll('.finch-created-header');
 expect(headers).toHaveLength(2);
 for(const header of headers)expect(header.querySelector('.finch-sequence-control')).not.toBeNull();
});

it('distinguishes collection and queue participants',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\ncollections users "Users"\nqueue jobs "Jobs"\nusers ->> jobs: enqueue',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.shape)).toEqual(['sequence-collections','sequence-queue']);
 expect(document.querySelectorAll('.finch-sequence-collections rect')).toHaveLength(2);
 expect(document.querySelector('.finch-sequence-queue ellipse')).not.toBeNull();
 expect(instance.geometry.edges[0]?.attributes?.messageKind).toBe('async');
});

it('applies later participant declarations to implicitly introduced participants',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render('@sequence\nui -> service: request\nboundary ui "Web UI"\ncontrol service "Order service"',{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>[n.id,n.label,n.shape])).toEqual([
  ['ui','Web UI','sequence-boundary'],['service','Order service','sequence-control'],
 ]);
 expect(instance.geometry.edges).toHaveLength(1);
});

it('renders boundary, control, entity and database roles with normal lifelines',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(`@sequence
boundary ui "UI"
control service "Service"
entity model "Model"
database db "Database"
ui -> service: request
service -> model: update
model -> db: save`,{target:'#diagram',editor:false});
 expect(instance.geometry.nodes.map(n=>n.shape)).toEqual(['sequence-boundary','sequence-control','sequence-entity','database']);
 for(const role of ['boundary','control','entity'])expect(document.querySelector(`.finch-sequence-${role}`)).not.toBeNull();
 expect(document.querySelectorAll('.finch-lifeline')).toHaveLength(4);
 expect(instance.geometry.edges).toHaveLength(3);
});
