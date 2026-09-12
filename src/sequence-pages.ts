import {measureDiagramText} from './diagram-text.js';
import {svgElement} from './utils.js';
import {labelLayout} from './text-layout.js';
import type {Geometry, Theme} from './types.js';

export interface SequencePageRange {
 index:number; title?:string; start:number; end:number; top:number; bottom:number;
 /** Event order at the beginning of this page, used for participant lifetime. */
 serial:number;
}


function participantAlive(node:Geometry['nodes'][number],page:SequencePageRange):boolean {
   const events=JSON.parse(node.attributes.sequenceEvents ?? '[]') as Array<{kind:string;serial:number;at:number}>;
   let alive=!events.some(event=>event.kind==='create');
   const frames:Array<{base:boolean;ends:boolean[]}>=[];
   for(const event of events.filter(event=>event.serial<page.serial)){
    if(event.kind==='branch-save')frames.push({base:alive,ends:[]});
    if(event.kind==='branch-reset'||event.kind==='branch-end'){
     const frame=frames[frames.length-1];if(frame){frame.ends.push(alive);alive=event.kind==='branch-reset'?frame.base:frame.ends.every(Boolean);if(event.kind==='branch-end')frames.pop();}
    }
    // Creation takes effect at its receiving message, which may follow newpage.
    if(event.kind==='create')alive=event.at<page.start;if(event.kind==='destroy')alive=false;
   }
   return alive;
}

/** Derive page windows from current routes, so an edited layout stays authoritative. */
export function sequencePageRanges(geometry:Geometry,labelBounds:ReadonlyMap<string,{top:number;bottom:number}>=new Map()):SequencePageRange[] {
 if(geometry.kind!=='sequence')throw new Error('Sequence pages require a sequence diagram.');
 const edges=geometry.edges.filter(edge=>!edge.attributes?.annotation);
 const origin=geometry.origin?.y ?? 0;
 const bodyTop=Math.min(...geometry.groups.map(group=>group.y),...edges.map(edge=>Math.min(...edge.points.map(p=>p.y))-24),origin+geometry.height);
 const bodyBottom=origin+geometry.height-(geometry.diagramText?.bottom ?? 0);
 const cut=(at:number):number=>{
  if(at===0)return bodyTop;
  if(at>=edges.length)return bodyBottom;
  const before=Math.max(...edges[at-1]!.points.map(p=>p.y));
  const after=Math.min(...edges[at]!.points.map(p=>p.y));
  return (before+after)/2;
 };
 const starts=[{at:0,serial:0},...(geometry.pageBreaks ?? [])];
 return starts.map((start,index)=>{
  const next=starts[index+1];
  const relevant=edges.slice(start.at,next?.at ?? edges.length).flatMap(edge=>{const bounds=labelBounds.get(edge.id);return bounds ? [bounds] : [];});
  return {index,start:start.at,end:next?.at ?? edges.length,serial:start.serial,
   ...('title' in start && start.title!==undefined ? {title:start.title} : {}),
   top:Math.min(cut(start.at),...relevant.map(bounds=>bounds.top-8)),bottom:Math.max(next ? cut(next.at) : bodyBottom,...relevant.map(bounds=>bounds.bottom+8))};
 });
}

/** Export clipped page bodies with repeated participant headers. */
export function sequencePageSvgs(source:SVGSVGElement,geometry:Geometry,theme:Theme):string[] {
 const document=source.ownerDocument;
 const labelBounds=new Map<string,{top:number;bottom:number}>();
 for(const element of source.querySelectorAll<SVGTextElement>('.finch-edge-label')){
  const id=element.getAttribute('data-edge-id');if(!id)continue;
  const font=Number(element.getAttribute('font-size') ?? 12);
  const ys=[...element.querySelectorAll('tspan')].map(span=>Number(span.getAttribute('y')));
  if(!ys.length)ys.push(Number(element.getAttribute('y')));
  labelBounds.set(id,{top:Math.min(...ys)-font,bottom:Math.max(...ys)+font*.3});
 }
 for(const element of source.querySelectorAll<SVGGElement>('.finch-sequence-fragments > [data-edge-id]')){
  const rect=element.querySelector('rect');if(!rect)continue;
  const top=Number(rect.getAttribute('y')),height=Number(rect.getAttribute('height'));
  labelBounds.set(element.getAttribute('data-edge-id')!,{top,bottom:top+height});
 }
 const pages=sequencePageRanges(geometry,labelBounds);
 return pages.map(page=>{
  const notes=geometry.nodes.filter(node=>node.attributes.annotationTarget && Number(node.attributes.sequencePage ?? 0)===page.index);
  const messages=geometry.edges.filter(edge=>!edge.attributes?.annotation);
  const references=new Map(notes.flatMap(note=>{
   const index=messages.findIndex(edge=>edge.id===note.attributes.annotationTarget);
   let label:string;
   if(index<0){
    const target=geometry.nodes.find(node=>node.id===note.attributes.annotationTarget);
    if(!target || participantAlive(target,page))return [];
    label=`Participant: ${target.label}${target.label===target.id ? '' : ` (${target.id})`}`;
   }else{
    if(index>=page.start && index<page.end)return [];
    const target=messages[index]!;
    const owner=pages.find(candidate=>index>=candidate.start && index<candidate.end)!;
    label=`Page ${owner.index+1} · ${target.from} → ${target.to}: ${target.label ?? target.id}`;
   }
   const lines=labelLayout(label,note.width,12,theme.fontFamily,400).lines;
   return [[note.id,{lines,height:lines.length*16+8}] as const];
  }));
  const noteIds=new Set(notes.map(node=>node.id));
  const placedNotes=notes.map(note=>({...note,y:page.start<page.end ? Math.max(note.y,page.top+8+(references.get(note.id)?.height ?? 0)) : note.y}));
  for(let index=0;index<placedNotes.length;index++){
   const note=placedNotes[index]!;
   for(const previous of placedNotes.slice(0,index))if(note.x<previous.x+previous.width && note.x+note.width>previous.x && note.y-(references.get(note.id)?.height ?? 0)<previous.y+previous.height+12)note.y=previous.y+previous.height+12+(references.get(note.id)?.height ?? 0);
  }
  if(page.start===page.end && notes.length){page.top=Math.min(...placedNotes.map(node=>node.y-(references.get(node.id)?.height ?? 0)))-8;page.bottom=Math.max(...placedNotes.map(node=>node.y+node.height))+8;}

  const width=geometry.width,left=geometry.origin?.x ?? 0;
  const pageText=(value:string)=>value.replace(/%page%/g,String(page.index+1)).replace(/%lastpage%/g,String(pages.length));
  const pageHeadings=measureDiagramText(Object.fromEntries((geometry.diagramText?.blocks ?? []).map(block=>[block.kind,pageText(block.text ?? block.lines.join('\n'))])),theme.fontSize-1,theme.fontFamily);
  const title=pageText(page.title ?? pageHeadings.blocks.find(block=>block.kind==='title')?.text ?? '');
  const commonHeader=pageHeadings.blocks.find(block=>block.kind==='header');
  const commonHeaderHeight=commonHeader ? commonHeader.lines.length*commonHeader.lineHeight+16 : 0;
  const bottomHeight=pageHeadings.bottom;
  const lines=labelLayout(title,Math.max(40,width-48),18,theme.fontFamily,700).lines;
  const titleHeight=commonHeaderHeight+(title ? lines.length*24+20 : 16);
  const nodeHeight=Math.max(0,...geometry.nodes.filter(n=>!n.attributes.annotationTarget).map(n=>n.height));
  const continuations=geometry.groups.filter(group=>page.start<page.end && group.y<page.top && group.y+group.height>page.top).map(group=>{
   const branch=[...(group.branches ?? [])].reverse().find(branch=>branch.y<=page.top);
   const label=`${group.kind ?? 'group'} · ${group.label}${branch ? ` / ${branch.label}` : ''} (continued)`;
   const lines=labelLayout(label,Math.max(40,group.width-20),12,theme.fontFamily,400).lines;
   return {group,lines,height:lines.length*16+12};
  });
  const headerHeight=titleHeight+nodeHeight+24+continuations.reduce((sum,item)=>sum+item.height,0);
  // A zero-message interval must not expose a one-pixel slice of adjacent frames.
  const clipHeight=page.start===page.end && !notes.length ? 0 : Math.max(1,page.bottom-page.top);
  const durationLabels=[...source.querySelectorAll<SVGGElement>('.finch-sequence-duration')].filter(duration=>clipHeight>0 && Number(duration.getAttribute('data-end-y'))>=page.top && Number(duration.getAttribute('data-start-y'))<=page.bottom);
  const bodyHeight=Math.max(clipHeight,...placedNotes.map(note=>note.y+note.height+8-page.top),...durationLabels.map(duration=>(duration.querySelectorAll('text').length+1)*16+24));
  const height=headerHeight+bodyHeight+bottomHeight+32;
  const svg=svgElement(document,'svg',{viewBox:`${left} 0 ${width} ${height}`,width,height,role:'img','aria-label':title || `Page ${page.index+1}`});
  svg.style.background=source.style.background;
  for(const element of source.querySelectorAll(':scope > defs, :scope > style'))svg.append(element.cloneNode(true));
  lines.forEach((line,index)=>{const text=svgElement(document,'text',{x:left+width/2,y:commonHeaderHeight+24+index*24,'text-anchor':'middle',class:'finch-page-title','font-size':18,'font-weight':700,'font-family':theme.fontFamily,fill:theme.labelColor});text.textContent=line;svg.append(text);});
  for(const block of pageHeadings.blocks){
   if(block.kind==='title')continue;
   const original=source.querySelector(`.finch-diagram-${block.kind}`);
   if(!original)continue;
   const offset=block.kind==='header' ? 0 : headerHeight+bodyHeight;
   const y=offset+block.y;
   if(block.kind==='legend'){
    const originalFrame=source.querySelector('.finch-diagram-legend-frame');
    if(originalFrame){const frame=originalFrame.cloneNode(true) as SVGElement;frame.setAttribute('y',String(y-block.fontSize-8));frame.setAttribute('height',String(block.lines.length*block.lineHeight+20));svg.append(frame);}
   }
   const text=original.cloneNode(true) as SVGElement;text.setAttribute('y',String(y));
   text.replaceChildren(...block.lines.map((line,index)=>{const span=svgElement(document,'tspan',{x:Number(text.getAttribute('x')),y:y+index*block.lineHeight});span.textContent=line;return span;}));
   svg.append(text);
  }
  for(const node of geometry.nodes){
   if(node.attributes.annotationTarget)continue;
   if(!participantAlive(node,page))continue;
   const original=[...source.querySelectorAll('.finch-nodes > [data-node-id], .finch-created-header')].find(el=>el.getAttribute('data-node-id')===node.id);
   if(original){const header=original.cloneNode(true) as SVGElement;header.setAttribute('transform',`translate(${node.x} ${titleHeight})`);svg.append(header);}
  }
  {
   const headers=new Set([...svg.children].map(element=>element.getAttribute('data-node-id')).filter(Boolean));
   for(const note of placedNotes){
    const target=geometry.nodes.find(node=>node.id===note.attributes.annotationTarget);
    if(!target || !headers.has(target.id))continue;
    const fromX=target.x+target.width/2,fromY=titleHeight+target.height;
    const left=note.x+note.width/2<fromX;
    const toX=left?note.x+note.width:note.x,toY=headerHeight+note.y-page.top+note.height/2;
    const approachX=toX+(left?12:-12);
    const bendY=titleHeight+nodeHeight+12;
    svg.append(svgElement(document,'path',{class:'finch-page-note-link','data-from':target.id,'data-to':note.id,d:`M ${fromX} ${fromY} V ${bendY} H ${approachX} V ${toY} H ${toX}`,fill:'none',stroke:theme.mutedColor,'stroke-dasharray':'4 4'}));
   }
  }
  for(const note of placedNotes){
   const reference=references.get(note.id);if(!reference)continue;
   reference.lines.forEach((line,index)=>{
    const text=svgElement(document,'text',{class:'finch-page-note-reference','data-note-id':note.id,x:note.x,y:headerHeight+note.y-page.top-reference.height+12+index*16,fill:theme.mutedColor,'font-size':12,'font-family':theme.fontFamily});
    text.textContent=line;svg.append(text);
   });
  }
  let continuationY=titleHeight+nodeHeight+24;
  const frameStroke=theme.containerStroke;
  const frameText=theme.mutedColor;
  for(const item of continuations){
   const group=svgElement(document,'g',{class:'finch-page-continuation','data-group-id':item.group.id});
   group.append(svgElement(document,'rect',{x:item.group.x,y:continuationY,width:item.group.width,height:item.height,fill:'none',stroke:frameStroke,'stroke-dasharray':'5 4'}));
   item.lines.forEach((line,index)=>{const text=svgElement(document,'text',{x:item.group.x+10,y:continuationY+16+index*16,'font-size':12,'font-family':theme.fontFamily,fill:frameText});text.textContent=line;group.append(text);});
   svg.append(group);continuationY+=item.height;
  }
  const body=source.cloneNode(true) as SVGSVGElement;
  for(const element of body.querySelectorAll('[data-finch-editor-trigger],.finch-diagram-text,defs,style'))element.remove();
  const allowed=new Set(geometry.edges.filter(edge=>!edge.attributes?.annotation).slice(page.start,page.end).map(edge=>edge.id));
  for(const edge of geometry.edges)if(edge.attributes?.annotation && noteIds.has(edge.to))allowed.add(edge.id);
  for(const node of geometry.nodes.filter(node=>node.attributes.annotationTarget && !noteIds.has(node.id)))for(const element of body.querySelectorAll('[data-node-id]'))if(element.getAttribute('data-node-id')===node.id)element.remove();
  if(page.start===page.end){
   const keep=[...body.querySelectorAll('.finch-nodes > [data-node-id]')].filter(element=>noteIds.has(element.getAttribute('data-node-id')!));
   for(const element of keep){const note=placedNotes.find(note=>note.id===element.getAttribute('data-node-id'))!;element.setAttribute('transform',`translate(${note.x} ${note.y})`);}
   body.replaceChildren(...keep);
  }
  for(const element of body.querySelectorAll('[data-edge-id]'))if(!allowed.has(element.getAttribute('data-edge-id')!))element.remove();
  const noteLayer=svgElement(document,'svg',{class:'finch-page-notes',x:left,y:headerHeight,width,height:bodyHeight,viewBox:`${left} ${page.top} ${width} ${bodyHeight}`});
  if(page.start<page.end){
   for(const note of placedNotes){
    const original=[...body.querySelectorAll('.finch-nodes > [data-node-id]')].find(element=>element.getAttribute('data-node-id')===note.id);
    if(original){original.setAttribute('transform',`translate(${note.x} ${note.y})`);noteLayer.append(original);}
    const link=geometry.edges.find(edge=>edge.attributes?.annotation && edge.to===note.id);
    if(link){
     for(const element of body.querySelectorAll('[data-edge-id]'))if(element.getAttribute('data-edge-id')===link.id)element.remove();
     if(allowed.has(note.attributes.annotationTarget!)){
      const point=link.points[0]!;
      noteLayer.prepend(svgElement(document,'path',{class:'finch-page-note-link','data-from':note.attributes.annotationTarget!,'data-to':note.id,d:`M ${point.x} ${point.y} L ${note.x+(note.attributes.annotationSide==='left'?note.width:0)} ${note.y+note.height/2}`,fill:'none',stroke:theme.mutedColor,'stroke-dasharray':'4 4'}));
     }
    }
   }
  }
  const durationLayer=svgElement(document,'svg',{x:left,y:headerHeight,width,height:bodyHeight,viewBox:`${left} ${page.top} ${width} ${bodyHeight}`});
  durationLayer.style.overflow='hidden';
  for(const duration of body.querySelectorAll<SVGGElement>('.finch-sequence-duration')){
   const start=Number(duration.getAttribute('data-start-y')),end=Number(duration.getAttribute('data-end-y'));
   if(bodyHeight===0 || end<page.top || start>page.bottom){duration.remove();continue;}
   const continuedBefore=start<page.top,continuedAfter=end>page.bottom;
   const paths=svgElement(document,'svg',{x:left,y:page.top,width,height:clipHeight,viewBox:`${left} ${page.top} ${width} ${clipHeight}`});
   paths.style.overflow='hidden';
   for(const path of duration.querySelectorAll('path'))paths.append(path);
   duration.prepend(paths);durationLayer.append(duration);
   const continued=continuedBefore || continuedAfter;
   duration.setAttribute('data-continued-before',String(continuedBefore));
   duration.setAttribute('data-continued-after',String(continuedAfter));
   const texts=[...duration.querySelectorAll('text')];
   const desired=(Math.max(start,page.top)+Math.min(end,page.bottom))/2;
   const intervals=texts.length-1+Number(continued);
   const half=intervals*8;
   const middle=Math.max(page.top+half+16,Math.min(page.top+bodyHeight-half-4,desired));
   texts.forEach((text,index)=>text.setAttribute('y',String(middle+(index-intervals/2)*16)));
   // Repeat the interval's label on every intersected page; clipped endpoints
   // remain open so they cannot be mistaken for a new duration measurement.
   const last=texts[texts.length-1];
   if(last && continued){const hint=last.cloneNode(false) as SVGTextElement;hint.setAttribute('y',String(middle+intervals/2*16));hint.textContent='(continued)';duration.append(hint);}
  }
  body.removeAttribute('xmlns');
  body.setAttribute('x',String(left));body.setAttribute('y',String(headerHeight));body.setAttribute('width',String(width));body.setAttribute('height',String(clipHeight));body.setAttribute('viewBox',`${left} ${page.top} ${width} ${clipHeight}`);body.style.aspectRatio='';body.style.overflow='hidden';
  svg.append(body);
  if(noteLayer.childElementCount)svg.append(noteLayer);
  if(durationLayer.childElementCount)svg.append(durationLayer);
  const number=svgElement(document,'text',{x:left+width/2,y:height-10,'text-anchor':'middle',class:'finch-page-number','font-size':12,'font-family':theme.fontFamily,fill:theme.mutedColor});number.textContent=`${page.index+1} / ${pages.length}`;svg.append(number);
  return new XMLSerializer().serializeToString(svg);
 });
}
