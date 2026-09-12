import {svgMarkupToPngBlob} from './png.js';
import type {DiagramInstance} from './instance.js';

/** Optional page preview inside the editor; exports stay user initiated. */
export function pagePreview(instance:DiagramInstance,container:HTMLElement,onError:(error:unknown)=>void):()=>void {
 const document=container.ownerDocument;
 return ()=>{
  container.replaceChildren();
  for(const [index,markup] of instance.toSvgPages().entries()){
   const section=document.createElement('section');section.className='finch-editor__page';
   const title=document.createElement('h3');title.textContent=`Page ${index+1}`;
   const image=document.createElement('img');image.alt=`Page ${index+1}`;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);image.style.cssText='max-width:100%;height:auto;display:block';
   const link=document.createElement('a');link.textContent='SVG';link.href=image.src;link.download=`sequence-page-${index+1}.svg`;
   const png=document.createElement('button');png.type='button';png.textContent='PNG';
   png.addEventListener('click',async()=>{
    png.disabled=true;
    try{
     const blob=await svgMarkupToPngBlob(markup,document);
     const url=URL.createObjectURL(blob);const download=document.createElement('a');download.href=url;download.download=`sequence-page-${index+1}.png`;download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){onError(error);}finally{png.disabled=false;}
   });
   section.append(title,image,link,png);container.append(section);
  }
 };
}
