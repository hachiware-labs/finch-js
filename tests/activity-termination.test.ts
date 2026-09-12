import {expect,it} from 'vitest';
import {parseActivity} from '../src/index';

it('rejects explicit outgoing connections from final nodes independently of their shape',()=>{
 for(const final of ['end','flowfinal']) {
  expect(()=>parseActivity(`@activity\n${final} done [shape=rectangle]\naction a "A"\ndone -> a`)).toThrow('outgoing');
  const model=parseActivity(`@activity\naction a "A"\n${final} done [shape=rectangle]\na -> done`);
  expect(model.nodes.find(n=>n.id==='done')?.attributes.activityKind).toBe(final);
 }
});

it('distinguishes flow final from activity final and excludes the finished branch from merging',()=>{
 const model=parseActivity(`@activity flow
split work {
 branch {
  action audit "Audit"
  flowfinal auditDone
 }
 branch {
  action save "Save"
 }
}
end done`);
 expect(model.nodes.find(n=>n.id==='auditDone')?.shape).toBe('exit-point');
 expect(model.nodes.find(n=>n.id==='done')?.shape).toBe('final-state');
 expect(model.connections.some(e=>e.from==='auditDone')).toBe(false);
 expect(model.connections.some(e=>e.from==='save'&&e.to==='work.done')).toBe(true);
});

it('allows blank lines and comments between structured operands',()=>{
 const model=parseActivity(`@activity
if valid "Valid?" {
 action a "A"
}

' alternate route
# alternate route
else {
 switch result "Result" {

  # success case
  case "ok" {
   action b "B"
  }

  ' failure case
  case "error" {
   action c "C"
  }
 }
}`);
 expect(model.connections.some(e=>e.from==='valid'&&e.to==='result')).toBe(true);
 expect(model.connections.filter(e=>e.from==='result')).toHaveLength(2);
});

it('does not fabricate repeat test or continuation paths after unconditional termination',()=>{
 const model=parseActivity('@activity flow\nrepeat r "Again?" {\naction a "A"\ndetach\n}\naction b "B"');
 expect(model.nodes.some(n=>n.id==='r.test'||n.id==='r.done')).toBe(false);
 expect(model.connections.map(e=>[e.from,e.to])).toEqual([['r','a']]);
 const broken=parseActivity('@activity flow\nrepeat r "Again?" {\nbreak\n}\naction b "B"');
 expect(broken.nodes.some(n=>n.id==='r.test')).toBe(false);
 expect(broken.connections.some(e=>e.from==='r.done'&&e.to==='b')).toBe(true);
});

it('connects a top-level flow in source order and respects terminating operands',()=>{
 const model=parseActivity(`@activity flow
start begin
action receive "Receive"
if valid "Valid?" {
 action save "Save"
}
else {
 action reject "Reject"
 kill
}
action respond "Respond"
end done`);
 const has=(from:string,to:string)=>model.connections.some(e=>e.from===from&&e.to===to);
 expect(has('begin','receive')).toBe(true);
 expect(has('receive','valid')).toBe(true);
 expect(has('valid.done','respond')).toBe(true);
 expect(has('respond','done')).toBe(true);
 expect(model.connections.some(e=>e.from==='reject'||e.from==='done')).toBe(false);
 const stopped=parseActivity('@activity flow\naction a "A"\ndetach\naction b "B"\nend c');
 expect(stopped.connections).toHaveLength(0);
});

it('omits the if merge when both operands end and preserves it for an implicit false path',()=>{
 const source=`@activity
if valid "Valid?" {
 end accepted
}
else {
 action reject "Reject"
 detach
}`;
 const model=parseActivity(source);
 expect(model.nodes.some(n=>n.id==='valid.done')).toBe(false);
 expect(model.connections.map(e=>e.to).sort()).toEqual(['accepted','reject']);
 const optional=parseActivity('@activity\nif valid "Valid?" {\nend accepted\n}');
 expect(optional.nodes.some(n=>n.id==='valid.done')).toBe(true);
 expect(optional.connections.some(e=>e.from==='valid'&&e.to==='valid.done')).toBe(true);
});

it('does not reconnect detached branches to a merge or a loop back edge',()=>{
 const model=parseActivity(`@activity
while work "More?" {
 if valid "Valid?" {
  action accept "Accept"
 }
 else {
  action reject "Reject"
  detach
 }
 action save "Save"
}`);
 expect(model.connections.some(e=>e.from==='reject')).toBe(false);
 expect(model.connections.some(e=>e.from==='accept'&&e.to==='valid.done')).toBe(true);
 expect(model.connections.some(e=>e.from==='save'&&e.to==='work')).toBe(true);
});

it('does not revive a terminated switch or activity final through following declarations',()=>{
 const model=parseActivity(`@activity
while work "More?" {
 switch outcome "Result" {
  case "cancel" {
   action cancel "Cancel"
   kill
  }
  case "finish" {
   end finished
  }
 }
 action unreachable "Unreachable"
}`);
 expect(model.connections.some(e=>['cancel','finished','outcome.done','unreachable'].includes(e.from))).toBe(false);
 expect(()=>parseActivity('@activity\nif a "Test" {\ndetach\n}')).toThrow('preceding');
});

it('splits into independent branches and merges only continuing paths',()=>{
 const model=parseActivity(`@activity
split dispatch {
 branch {
  action email "Email"
 }
 branch {
  action audit "Audit"
  detach
 }
 branch {
  action notify "Notify"
 }
}`);
 expect(model.connections.filter(e=>e.from==='dispatch').map(e=>e.to)).toEqual(['email','audit','notify']);
 expect(model.connections.filter(e=>e.to==='dispatch.done').map(e=>e.from)).toEqual(['email','notify']);
 expect(model.nodes.find(n=>n.id==='dispatch.done')?.shape).toBe('choice-state');
 expect(model.connections.some(e=>e.from==='audit')).toBe(false);
 expect(()=>parseActivity('@activity\nsplit s {\nbranch {\naction a "A"\n}\n}')).toThrow('two');
});

it('omits the merge when every split branch terminates inside a loop',()=>{
 const model=parseActivity(`@activity
while work "More?" {
 split dispatch {
  branch {
   action audit "Audit"
   detach
  }
  branch {
   end done
  }
 }
}`);
 expect(model.nodes.some(n=>n.id==='dispatch.done')).toBe(false);
 expect(model.connections.some(e=>e.to==='work')).toBe(false);
 expect(model.connections.filter(e=>e.from==='dispatch')).toHaveLength(2);
});

it('preserves the enclosing loop targets for break and continue in split branches',()=>{
 const model=parseActivity(`@activity
while work "More?" {
 split dispatch {
  branch {
   action cancel "Cancel"
   break
  }
  branch {
   action retry "Retry"
   continue
  }
 }
}`);
 expect(model.nodes.some(n=>n.id==='dispatch.done')).toBe(false);
 expect(model.connections.some(e=>e.from.startsWith('work.break')&&e.to==='work.done')).toBe(true);
 expect(model.connections.some(e=>e.from.startsWith('work.continue')&&e.to==='work')).toBe(true);
});
