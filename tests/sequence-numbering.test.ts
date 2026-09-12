import {expect,it} from 'vitest';
import {parseSequence} from '../src/index';

it('formats and pads numbers, retaining the format through stop and resume',()=>{
 const model=parseSequence(`@sequence
autonumber 8 2 "REQ-{n:03}"
a -> b: first
autonumber stop
a -> b: unnumbered
autonumber resume
a -> b: next
autonumber 1 "[{n}]"
a -> b: reset`);
 expect(model.connections.map(e=>e.label)).toEqual(['REQ-008 first','unnumbered','REQ-010 next','[1] reset']);
});

it('rejects formats without a number placeholder',()=>{
 expect(()=>parseSequence('@sequence\nautonumber "REQ"\na -> b: test')).toThrow('format');
});

it('changes the resumed step without resetting the counter and tolerates repeated stops',()=>{
 const model=parseSequence(`@sequence
autonumber 8 2
a -> b: first
autonumber stop
autonumber stop
autonumber resume 5 "[{n:03}]"
a -> b: second
autonumber resume
a -> b: third`);
 expect(model.connections.map(e=>e.label)).toEqual(['8. first','[010] second','[015] third']);
 expect(()=>parseSequence('@sequence\nautonumber stop 2')).toThrow('arguments');
 expect(()=>parseSequence('@sequence\nautonumber resume 0')).toThrow('step');
});


it('increments hierarchy levels and preserves delimiters through stop and resume',()=>{
 const model=parseSequence(`@sequence
 autonumber 1.1:1
 a -> b: one
 a -> b: two
 autonumber inc A
 a -> b: chapter
 autonumber inc B
 a -> b: section
 autonumber stop
 a -> b: skipped
 autonumber resume 2 "[{n:02}]"
 a -> b: resumed
 a -> b: continued`);
 expect(model.connections.map(e=>e.label)).toEqual(['1.1:1. one','1.1:2. two','2.1:1. chapter','2.2:1. section','skipped','[02.02:02] resumed','[02.02:04] continued']);
 expect(()=>parseSequence('@sequence\nautonumber inc A')).toThrow(/active/);
 expect(()=>parseSequence('@sequence\nautonumber 1.1\nautonumber inc C')).toThrow(/range/);
 expect(()=>parseSequence('@sequence\nautonumber 9007199254740992.1')).toThrow(/Invalid/);
});


it('supports decimal digit patterns, grouping and quoted literal affixes',()=>{
 const model=parseSequence(`@sequence
 autonumber 8 2 "[000]"
 a -> b: first
 autonumber stop
 a -> b: skipped
 autonumber resume
 a -> b: next
 autonumber 1234 "'REQ-'#,##0.00"
 a -> b: grouped
 autonumber 0 "##"
 a -> b: zero
 autonumber 5 "'v1.0 #'000"
 a -> b: literal`);
 expect(model.connections.map(e=>e.label)).toEqual(['[008] first','skipped','[010] next','REQ-1,234.00 grouped','0 zero','v1.0 #005 literal']);
 for(const format of ['0,','0#','0.0.0',"'open0",'0%'])expect(()=>parseSequence(`@sequence\nautonumber "${format}"\na -> b`)).toThrow(/format|grouping/);
 expect(()=>parseSequence('@sequence\nautonumber 1.1 "000"\na -> b')).toThrow(/Hierarchical/);
});


it('groups mandatory padded integer digits using the final grouping interval',()=>{
 const labels=(format:string,start=12)=>parseSequence(`@sequence\nautonumber ${start} "${format}"\na -> b: request`).connections.map(e=>e.label);
 expect(labels('000,000')).toEqual(['000,012 request']);
 expect(labels('00,00,000',1234)).toEqual(['0,001,234 request']);
 expect(labels('#,000,000.00')).toEqual(['000,012.00 request']);
 expect(labels('000,000',1234567)).toEqual(['1,234,567 request']);
 expect(labels("'batch,'000,000','")).toEqual(['batch,000,012, request']);
 for(const format of ['00,#00','0,0#','0,,000','0,.00','0.0,0'])expect(()=>labels(format)).toThrow(/format/);
});
