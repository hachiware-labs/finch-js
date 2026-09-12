import {expect,it} from 'vitest';
import {parseActivity} from '../src/index';

it('switches lanes through structured branches and returns to a previously used lane',()=>{
 const model=parseActivity(`@activity
lane user "User"
lane system "System"
in user
start begin
in system
if valid "Valid?" {
 action save "Save"
 in user
 action confirm "Confirm"
}
in system
end done
begin -> valid
valid.done -> done`);
 expect(model.nodes.find(n=>n.id==='begin')?.parentId).toBe('user');
 expect(model.nodes.find(n=>n.id==='save')?.parentId).toBe('system');
 expect(model.nodes.find(n=>n.id==='confirm')?.parentId).toBe('user');
 expect(model.nodes.find(n=>n.id==='valid.done')?.parentId).toBe('system');
 expect(model.nodes.filter(n=>n.attributes.umlBlock==='lane')).toHaveLength(2);
});

it('rejects unknown lanes and conflicting IDs',()=>{
 expect(()=>parseActivity('@activity\nin missing\naction a "A"')).toThrow('Unknown lane');
 expect(()=>parseActivity('@activity\nlane a\nin a\naction a "A"')).toThrow('conflicts');
});

it('assigns generated break and continue nodes to the currently selected lane',()=>{
 const model=parseActivity(`@activity
lane user
lane system
in system
while work "More?" {
 in user
 if cancel "Cancel?" {
  break
 }
 in system
 continue
}`);
 expect(model.nodes.find(n=>n.id==='work.break1')?.parentId).toBe('user');
 expect(model.nodes.find(n=>n.id==='work.continue2')?.parentId).toBe('system');
});


it('combines flow lane blocks with switches, loops and nodes outside lanes',()=>{
 const source=`@activity flow
start begin
lane user "User" {
 action submit "Submit"
}
lane system "System" {
 while retry "Retry?" {
  action work "Work"
  in user
  action confirm "Confirm"
 }
}
end done`;
 const model=parseActivity(source);
 expect(model.nodes.find(n=>n.id==='begin')?.parentId).toBeUndefined();
 expect(model.nodes.find(n=>n.id==='done')?.parentId).toBeUndefined();
 expect(model.nodes.find(n=>n.id==='submit')?.parentId).toBe('user');
 expect(model.nodes.find(n=>n.id==='work')?.parentId).toBe('system');
 expect(model.nodes.find(n=>n.id==='confirm')?.parentId).toBe('user');
 expect(model.nodes.find(n=>n.id==='retry.done')?.parentId).toBe('system');
 expect(model.connections.some(e=>e.from==='submit' && e.to==='retry')).toBe(true);
 expect(model.connections.some(e=>e.from==='retry.done' && e.to==='done')).toBe(true);
});
it('rejects nested and unclosed lane blocks',()=>{
 expect(()=>parseActivity('@activity flow\nlane a {\nlane b {\naction x "X"\n}\n}')).toThrow(/nested/);
 expect(()=>parseActivity('@activity flow\nlane a {\naction x "X"')).toThrow(/Unclosed lane/);
});
