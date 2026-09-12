// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFinch, parseTiming } from '../src/index';

it('shares an absolute time axis, resolves relative times and connects to the actual waveform',()=>{
 const source=`@timing end=100 scale=5 unit=ms
robust service "Service"
binary signal "Signal"
@0
service is Idle
signal is low
@20
service is Busy
signal is high
@+10
service -> signal@+10: request
duration service 20 40 "20ms"`;
 const model=parseTiming(source);
 expect(model.connections[0]?.attributes).toMatchObject({sent:'30',received:'40'});
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 const [service,signal]=instance.geometry.nodes;
 expect(instance.geometry.edges[0]!.points).toEqual([{x:service!.x+180+150,y:service!.y+52},{x:signal!.x+180+200,y:signal!.y+24}]);
 expect(document.body.textContent).toContain('20ms');
 expect(document.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
});

it('interpolates analog values at message times and generates phased clocks',()=>{
 const source=`@timing end=40
analog load
clock clk [period=20 pulse=5 offset=5]
@0
load is 0
@10
load -> clk: check
@20
load is 100`;
 const model=parseTiming(source);
 expect(JSON.parse(model.nodes[1]!.attributes.samples!)).toEqual([{time:0,value:'low'},{time:5,value:'high'},{time:10,value:'low'},{time:25,value:'high'},{time:30,value:'low'}]);
 document.body.innerHTML='<div id="diagram"></div>';
 const instance=createFinch().render(source,{target:'#diagram',editor:false});
 expect(instance.geometry.edges[0]!.points[0]!.y).toBe(instance.geometry.nodes[0]!.y+46);
});

it('rejects ambiguous samples, invalid values and backwards messages',()=>{
 expect(()=>parseTiming('')).toThrow('directive');
 expect(()=>parseTiming('@timing\nbinary b\nb is maybe')).toThrow('binary');
 expect(()=>parseTiming('@timing\nanalog a\na is NaN')).toThrow('number');
 expect(()=>parseTiming('@timing\nrobust a\na is One\na is Two')).toThrow('Duplicate');
 expect(()=>parseTiming('@timing\nrobust a\n@20\na -> a@10: bad')).toThrow('before');
 expect(()=>parseTiming('@timing end=10\nrobust a\n@20\na is Busy')).toThrow('range');
 expect(()=>parseTiming('@timing\nclock c [period=10 pulse=12]')).toThrow('period');
 expect(()=>parseTiming('@timing\nrobust a\na -> unknown: bad')).toThrow('Unknown');
});

it('resolves named anchors with offsets in participant blocks, messages and durations',()=>{
 const source=`@timing end=100
binary a
binary b
@10 as :start
@+40 as :done
@a
:start is low
+20 is high
@b
:start is low
:done-5 is high
@:start+20
a -> b@:done-5: ready
duration a :start :done "window"`;
 const model=parseTiming(source);
 expect(JSON.parse(model.nodes[0]!.attributes.samples!)).toEqual([{time:10,value:'low'},{time:30,value:'high'}]);
 expect(JSON.parse(model.nodes[1]!.attributes.samples!)).toEqual([{time:10,value:'low'},{time:45,value:'high'}]);
 expect(model.connections[0]!.attributes).toMatchObject({sent:'30',received:'45'});
 expect(JSON.parse(model.nodes[0]!.attributes.durations!)[0]).toMatchObject({from:10,to:50});
 expect(()=>parseTiming('@timing\nbinary b\n@:missing')).toThrow('Unknown timing anchor');
 expect(()=>parseTiming('@timing\nbinary b\n@0 as :a\n@1 as :a')).toThrow('Duplicate timing anchor');
});

it('draws uncertain ranges without inventing a level or interpolating across hidden intervals',()=>{
 const source=`@timing end=100
binary signal
analog load
@0
signal is low
load is 0
@20
signal is {low,high}
load is {10,30}
@40
signal is {hidden}
load is {-}
@60
signal is high
load is 50`;
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.querySelectorAll('.finch-timing-uncertain')).toHaveLength(2);
 expect(document.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
 expect(document.body.textContent).not.toContain('hidden');
 expect(()=>parseTiming('@timing\nbinary b\nb is {low,maybe}')).toThrow('binary');
});


it('resolves UTC dates against an explicit origin and displays date/time ticks',()=>{
 const source=`@timing origin=2026-09-01 unit=h end=2026-09-03
robust job "Job"
@2026-09-01T06:00:00Z as :start
job is running
@+6
job is done
duration job :start 2026-09-01T12:00:00Z "6h"`;
 const model=parseTiming(source);
 expect(JSON.parse(model.nodes[0]!.attributes.samples!)).toEqual([{time:6,value:'running'},{time:12,value:'done'}]);
 expect(model.nodes[0]!.attributes.timingMax).toBe('48');
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.body.textContent).toContain('2026-09-01');
 expect(document.body.textContent).toContain('00:00:00Z');
 expect(()=>parseTiming(source.replace('2026-09-01T06:00:00Z','2026-02-30'))).toThrow(/Invalid timing/);
 expect(()=>parseTiming(source.replace('origin=2026-09-01',''))).toThrow(/origin/);
});


it('normalizes explicit UTC offsets across dates, anchors and message arrivals',()=>{
 const source=`@timing origin=2026-09-02T00:00:00+09:00 unit=h end=2026-09-01T18:00:00Z
robust tokyo
robust remote
@2026-09-02T00:00:00+09:00 as :start
tokyo is working
remote is waiting
tokyo -> remote@2026-09-01T12:00:00-04:00: deliver
@2026-09-01T17:00:00Z
tokyo is done
duration tokyo :start 2026-09-01T17:00:00Z "2h"`;
 const model=parseTiming(source);
 expect(JSON.parse(model.nodes[0]!.attributes.samples!)).toEqual([{time:0,value:'working'},{time:2,value:'done'}]);
 expect(model.connections[0]!.attributes).toMatchObject({sent:'0',received:'1'});
 expect(model.nodes[0]!.attributes.timingMax).toBe('3');
 expect(()=>parseTiming(source+'\n@2026-09-02T02:00:00+09:00\ntokyo is duplicate')).toThrow(/Duplicate/);
 for(const date of ['2026-02-30T12:00:00+09:00','2026-09-01T24:00:00+09:00','2026-09-01T12:00:00+24:00','2026-09-01T12:00:00+09:60','2026-09-01T12:00:00'])expect(()=>parseTiming(source.replace('2026-09-02T00:00:00+09:00',date))).toThrow(/Invalid timing/);
 document.body.innerHTML='<div id="diagram"></div>';
 createFinch().render(source,{target:'#diagram',editor:false});
 expect(document.body.textContent).toContain('15:00:00Z');
});
