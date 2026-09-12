import {withDiagramText} from './diagram-text.js';
import type { DiagramPlugin, Geometry, LayoutPlugin, SemanticModel, SemanticNode, ShapePlugin } from './types.js';
import { svgElement } from './utils.js';

type Sample = { time:number; value:string };
const hidden=(value:string)=>value==='{-}' || value==='{hidden}';
const uncertain=(value:string)=>value.startsWith('{') && value.endsWith('}') && !hidden(value);
const alternatives=(value:string)=>uncertain(value) ? value.slice(1,-1).split(',').map(v=>v.trim()) : hidden(value) ? [] : [value];
const statesOf=(samples:Sample[])=>[...new Set(samples.flatMap(s=>alternatives(s.value)))];
const data = (node:{attributes:Record<string,string>}):Sample[] => JSON.parse(node.attributes.samples ?? '[]');
const number = (value:string):number => { const n=Number(value);if(!Number.isFinite(n))throw new Error(`Invalid timing number: ${value}`);return n; };
const unquote = (text:string) => text.startsWith('"') && text.endsWith('"') ? text.slice(1,-1).replace(/\\"/g,'"') : text;

const timestamp=(text:string):number=>{
 const match=text.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|([+-])(\d{2}):(\d{2})))?$/);
 if(!match)throw new Error(`Invalid timing date: ${text}`);
 const wall=match[1]+(match[2] ? 'T'+match[2] : '');
 const local=Date.parse(wall+(match[2] ? 'Z' : ''));
 // Validate the stated calendar date before applying its UTC offset.
 if(!Number.isFinite(local) || !new Date(local).toISOString().startsWith(wall))throw new Error(`Invalid timing date: ${text}`);
 const hours=Number(match[5] ?? 0),minutes=Number(match[6] ?? 0);
 if(hours>23 || minutes>59)throw new Error(`Invalid timing date offset: ${text}`);
 const offset=(hours*60+minutes)*60000*(match[4]==='-' ? -1 : 1);
 return local-offset;
};

export function parseTiming(source:string):SemanticModel {
 const decorated=withDiagramText(source,parseTiming);if(decorated)return decorated;
  const nodes:SemanticNode[]=[], connections:SemanticModel['connections']=[];
  const header=source.split(/\r?\n/).map(line=>line.trim()).find(line=>line && !/^[#']/.test(line)) ?? '';
  const options=Object.fromEntries([...header.matchAll(/(scale|end|unit|origin)=([^\s]+)/g)].map(m=>[m[1],m[2]!]));
  const origin=options.origin===undefined ? undefined : timestamp(options.origin);
  const unitMillis=({ms:1,s:1000,min:60000,h:3600000,d:86400000} as Record<string,number>)[options.unit ?? 'ms'];
  if(origin!==undefined && unitMillis===undefined)throw new Error('Date timing unit must be ms, s, min, h or d.');
  let time=0;
  const anchors=new Map<string,number>();
  let participant:string|undefined;
  const resolveTime=(expression:string):number=>{
    if(/^\d{4}-\d{2}-\d{2}/.test(expression)){
      if(origin===undefined)throw new Error('Date timing requires origin=ISO-date.');
      return (timestamp(expression)-origin)/unitMillis!;
    }
    const anchor=expression.match(/^:([A-Za-z_]\w*)([+-]\d+(?:\.\d+)?)?$/);
    if(anchor){const base=anchors.get(anchor[1]!);if(base===undefined)throw new Error(`Unknown timing anchor ${anchor[1]}.`);return base+Number(anchor[2] ?? 0);}
    if(!/^[+-]?\d+(?:\.\d+)?$/.test(expression))throw new Error(`Invalid timing expression: ${expression}`);
    return expression.startsWith('+') ? time+number(expression) : number(expression);
  };
  const times=[0];
  const lines=source.split(/\r?\n/).map(s=>s.trim()).filter(s=>s && !s.startsWith("'") && !s.startsWith('#'));
  if(!/^@timing(?:\s|$)/.test(lines[0] ?? ''))throw new Error('Expected @timing directive.');
  for(let line of lines.slice(1)) {
    const declaration=line.match(/^(robust|concise|binary|analog|clock)\s+([\w.-]+)(?:\s+"([^"]*)")?(?:\s+\[([^\]]+)\])?$/);
    if(declaration) {
      if(nodes.some(n=>n.id===declaration[2]))throw new Error(`Duplicate timing participant ${declaration[2]}.`);
      const attrs=Object.fromEntries([...(declaration[4] ?? '').matchAll(/(period|pulse|offset)=([^\s]+)/g)].map(m=>[m[1]!,m[2]!]));
      nodes.push({id:declaration[2]!,label:declaration[3] ?? declaration[2]!,shape:'timing-track',attributes:{...attrs,timingKind:declaration[1]!,samples:'[]'}});continue;
    }
    const select=line.match(/^@([\w.-]+)$/);
    if(select && nodes.some(n=>n.id===select[1])) {participant=select[1]!;continue;}
    const tick=line.match(/^@(\S+)(?:\s+as\s+:([A-Za-z_]\w*))?$/);
    if(tick) {
      time=resolveTime(tick[1]!);times.push(time);
      if(tick[2]){if(anchors.has(tick[2]))throw new Error(`Duplicate timing anchor ${tick[2]}.`);anchors.set(tick[2],time);}
      continue;
    }
    const timedSample=line.match(/^([+:\d-]\S*)\s+is\s+(.+)$/);
    if(timedSample && participant){time=resolveTime(timedSample[1]!);times.push(time);line=`${participant} is ${timedSample[2]}`;}
    const sample=line.match(/^([\w.-]+)\s+is\s+(.+)$/);
    if(sample) {
      const node=nodes.find(n=>n.id===sample[1]);if(!node)throw new Error(`Unknown timing participant ${sample[1]}.`);
      const value=unquote(sample[2]!);
      if(node.attributes.timingKind==='clock')throw new Error('Clock values are generated from period/pulse/offset.');
      if(node.attributes.timingKind==='binary' && alternatives(value).some(v=>!['0','1','low','high'].includes(v)))throw new Error(`Invalid binary value ${value}.`);
      if(node.attributes.timingKind==='analog' && !hidden(value))alternatives(value).forEach(number);
      if(uncertain(value) && alternatives(value).some(v=>!v))throw new Error('Empty timing state alternative.');
      const values=data(node);if(values.some(v=>v.time===time))throw new Error(`Duplicate timing sample ${node.id} at ${time}.`);
      values.push({time,value});node.attributes.samples=JSON.stringify(values);continue;
    }
    const duration=line.match(/^duration\s+([\w.-]+)\s+(\S+)\s+(\S+)\s+"([^"]+)"$/);
    if(duration) {
      const node=nodes.find(n=>n.id===duration[1]);if(!node)throw new Error(`Unknown duration participant ${duration[1]}.`);
      const from=resolveTime(duration[2]!),to=resolveTime(duration[3]!);if(to<from)throw new Error('Duration end must not precede start.');
      const values=JSON.parse(node.attributes.durations ?? '[]');values.push({from,to,label:duration[4]});node.attributes.durations=JSON.stringify(values);times.push(from,to);continue;
    }
    const message=line.match(/^([\w.-]+)\s+->\s+([\w.-]+)(?:@([^\s]+))?\s*:\s*(.+)$/);
    if(message) {
      const end=message[3] ? resolveTime(message[3]) : time;
      if(end<time)throw new Error('A timing message cannot arrive before it is sent.');
      connections.push({id:`timing-${connections.length}`,from:message[1]!,to:message[2]!,label:message[4]!,dashed:false,order:connections.length,attributes:{sent:String(time),received:String(end)}});times.push(end);continue;
    }
    throw new Error(`Invalid timing statement: ${line}`);
  }
  if(!nodes.length)throw new Error('A timing diagram needs participants.');
  const min=Math.min(...times), last=Math.max(...times);
  const max=options.end ? resolveTime(options.end) : last+Math.max(1,(last-min)*0.1);
  const scale=options.scale ? number(options.scale) : 640/Math.max(1,max-min);
  if(max<=min || max<last || scale<=0)throw new Error('Invalid timing range or scale.');
  for(const node of nodes) {
    if(node.attributes.timingKind==='clock') {
      const period=number(node.attributes.period ?? '10'), pulse=number(node.attributes.pulse ?? String(period/2)), offset=number(node.attributes.offset ?? '0');
      if(period<=0 || pulse<=0 || pulse>=period || (max-min)/period>5000)throw new Error('Invalid or excessive clock period/pulse.');
      const values:Sample[]=[];
      const phase=((min-offset)%period+period)%period;
      values.push({time:min,value:phase<pulse ? 'high' : 'low'});
      for(let t=offset+Math.floor((min-offset)/period)*period;t<=max;t+=period) {
        if(t>min)values.push({time:t,value:'high'});
        if(t+pulse>min && t+pulse<=max)values.push({time:t+pulse,value:'low'});
      }
      node.attributes.samples=JSON.stringify(values);
    } else node.attributes.samples=JSON.stringify(data(node).sort((a,b)=>a.time-b.time));
    node.attributes.timingMin=String(min);node.attributes.timingMax=String(max);node.attributes.timingScale=String(scale);node.attributes.timingUnit=options.unit ?? '';
    if(origin!==undefined){node.attributes.timingOrigin=String(origin);node.attributes.timingUnitMillis=String(unitMillis);}
  }
  for(const edge of connections)if(!nodes.some(n=>n.id===edge.from)||!nodes.some(n=>n.id===edge.to))throw new Error('Unknown timing message participant.');
  return {kind:'timing',nodes,connections,groups:[],source};
}

const sampleY=(samples:Sample[],kind:string|undefined,value:string):number => {
  if(hidden(value))return 43;
  if(uncertain(value)){const positions=alternatives(value).map(v=>sampleY(samples,kind,v));return (Math.min(...positions)+Math.max(...positions))/2;}
  if(kind==='concise')return 43;
  if(kind==='binary'||kind==='clock')return value==='1'||value==='high' ? 24 : 62;
  if(kind==='analog') {
    const values=samples.flatMap(s=>alternatives(s.value).map(Number)),lo=Math.min(...values),hi=Math.max(...values);
    return 28+(1-(Number(value)-lo)/(hi-lo || 1))*36;
  }
  return 26+statesOf(samples).indexOf(value)*26;
};
const yAt=(node:{y:number;attributes:Record<string,string>},time:number):number => {
  const samples=data(node),kind=node.attributes.timingKind;
  let index=-1;
  samples.forEach((s,i)=>{if(s.time<=time)index=i;});
  const sample=samples[index];
  if(!sample) return node.y+38;
  const next=samples[index+1];
  const value=kind==='analog' && next && !hidden(next.value) && !uncertain(next.value) && !hidden(sample.value) && !uncertain(sample.value) ? String(Number(sample.value)+(Number(next.value)-Number(sample.value))*(time-sample.time)/(next.time-sample.time)) : sample.value;
  return node.y+sampleY(samples,kind,value);
};
const xAt=(node:{x:number;attributes:Record<string,string>},time:number) => node.x+180+(time-Number(node.attributes.timingMin))*Number(node.attributes.timingScale);
export function rerouteTiming(geometry:Geometry):void {
  for(const node of geometry.nodes)node.x=28;
  for(const edge of geometry.edges) {
    const from=geometry.nodes.find(n=>n.id===edge.from)!,to=geometry.nodes.find(n=>n.id===edge.to)!;
    edge.points=[{x:xAt(from,Number(edge.attributes!.sent)),y:yAt(from,Number(edge.attributes!.sent))},{x:xAt(to,Number(edge.attributes!.received)),y:yAt(to,Number(edge.attributes!.received))}];
  }
}

export const timingLayout:LayoutPlugin={name:'timing',layout(model,context){
  let y=28;
  const nodes=model.items.map(item=>{const saved=context.overlay.nodes[item.id];const node={...item,...item.size,x:28,y:saved && (!context.force || (context.preservePinned && saved.pinned)) ? saved.y : y};y+=item.size.height+24;return node;});
  const geometry:Geometry={kind:'timing',nodes,edges:model.connections.map(edge=>({...edge,points:[]})),groups:[],width:Math.max(...nodes.map(n=>n.width))+56,height:Math.max(...nodes.map(n=>n.y+n.height))+28};
  rerouteTiming(geometry);return geometry;
}};

export const timingShape:ShapePlugin={name:'timing-track',measure({attributes}){
  const values=data({attributes});const states=new Set(statesOf(values));
  return {width:200+(Number(attributes.timingMax)-Number(attributes.timingMin))*Number(attributes.timingScale),height:Math.max(126,attributes.timingKind==='robust' ? states.size*26+76 : 126)+(attributes.timingOrigin===undefined?0:20)+JSON.parse(attributes.durations ?? '[]').length*24};
},render({node,theme,document}){
  const group=svgElement(document,'g',{transform:`translate(${node.x} ${node.y})`});
  const text=(label:string,x:number,y:number,anchor='start')=>{const el=svgElement(document,'text',{x,y,'text-anchor':anchor,fill:theme.labelColor,'font-size':12,'font-family':theme.fontFamily});el.textContent=label;group.append(el);};
  const path=(d:string,stroke=theme.accentColor,dash?:string)=>group.append(svgElement(document,'path',{d,fill:'none',stroke,'stroke-width':1.5,...(dash ? {'stroke-dasharray':dash} : {})}));
  const min=Number(node.attributes.timingMin),max=Number(node.attributes.timingMax),scale=Number(node.attributes.timingScale),x=(t:number)=>180+(t-min)*scale;
  const samples=data(node),kind=node.attributes.timingKind;
  const states=statesOf(samples);
  const waveformHeight=kind==='robust' ? Math.max(36,states.length*26) : 46;
  text(node.label,8,22);path(`M180 12 V${waveformHeight+42}`,theme.nodeStroke);
  for(let i=0;i<=5;i++){const t=min+(max-min)*i/5;path(`M${x(t)} 12 V${waveformHeight+42}`,theme.nodeStroke,'3 5');if(node.attributes.timingOrigin!==undefined){
    const date=new Date(Number(node.attributes.timingOrigin)+t*Number(node.attributes.timingUnitMillis)).toISOString();
    text(date.slice(0,10),x(t),waveformHeight+60,'middle');text(date.slice(11,19)+'Z',x(t),waveformHeight+74,'middle');
  }else text(`${Number(t.toFixed(3))}${node.attributes.timingUnit}`,x(t),waveformHeight+60,'middle');}
  const valueY=(value:string)=>sampleY(samples,kind,value);
  if(kind==='binary'||kind==='clock'){text('1',170,28,'end');text('0',170,66,'end');}
  if(kind==='analog' && states.length){const values=samples.flatMap(s=>alternatives(s.value).map(Number));text(String(Math.max(...values)),170,32,'end');text(String(Math.min(...values)),170,68,'end');}
  if(kind==='robust')states.forEach(state=>text(state,170,valueY(state)+4,'end'));
  samples.forEach((sample,index)=>{
    const end=samples[index+1]?.time ?? max;
    if(hidden(sample.value))return;
    if(uncertain(sample.value)) {
      const positions=alternatives(sample.value).map(valueY),top=Math.min(...positions)-4,bottom=Math.max(...positions)+4;
      group.append(svgElement(document,'rect',{class:'finch-timing-uncertain',x:x(sample.time),y:top,width:Math.max(0,x(end)-x(sample.time)),height:bottom-top,fill:theme.accentColor,'fill-opacity':0.15,stroke:theme.accentColor,'stroke-dasharray':'3 3'}));
      return;
    }
    if(kind==='concise') {
      group.append(svgElement(document,'rect',{x:x(sample.time),y:28,width:Math.max(0,x(end)-x(sample.time)),height:30,fill:theme.nodeFill,stroke:theme.nodeStroke}));
      if(x(end)-x(sample.time)>sample.value.length*7)text(sample.value,(x(sample.time)+x(end))/2,48,'middle');
    } else {
      const next=samples[index+1];
      path(`M${x(sample.time)} ${valueY(sample.value)} L${x(end)} ${kind==='analog' && next && !hidden(next.value) && !uncertain(next.value) && !hidden(sample.value) && !uncertain(sample.value) ? valueY(next.value) : valueY(sample.value)}${kind!=='analog' && next && !hidden(next.value) && !uncertain(next.value) ? ` V${valueY(next.value)}` : ''}`);
    }
  });
  const durations=JSON.parse(node.attributes.durations ?? '[]') as Array<{from:number;to:number;label:string}>;
  durations.forEach((d,index)=>{const y=waveformHeight+80+(node.attributes.timingOrigin===undefined?0:20)+index*24;path(`M${x(d.from)} ${y-5} V${y+5} M${x(d.from)} ${y} H${x(d.to)} M${x(d.to)} ${y-5} V${y+5}`,theme.edgeColor);text(d.label,(x(d.from)+x(d.to))/2,y-6,'middle');});
  return group;
}};

export const timingDiagram:DiagramPlugin={name:'timing',defaultLayout:'timing',parse:parseTiming,toLayoutModel(model,context){return {kind:'timing',items:model.nodes.map(n=>({...n,size:context.measure(n.shape,n.label,n.attributes)})),connections:model.connections,groups:[],direction:'right',minimumGap:24};}};
