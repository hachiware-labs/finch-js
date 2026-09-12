/** Validate delimiters independently of execution, including unreachable return tails. */
export function validateSourceBlocks(source:string):void {
 const stack:Array<{kind:string;line:number;otherwise:boolean}>=[];
 const closing:Record<string,string>={endif:'if',endfor:'foreach',endwhile:'while',endprocedure:'procedure',endfunction:'function'};
 for(const [index,line] of source.split(/\r?\n/).entries()){
  const directive=line.trim().match(/^!(if|foreach|while|procedure|function|else|elseif|endif|endfor|endwhile|endprocedure|endfunction)(?:\s|$)/)?.[1];
  if(!directive)continue;
  if(['if','foreach','while','procedure','function'].includes(directive)){
   stack.push({kind:directive,line:index+1,otherwise:false});continue;
  }
  const frame=stack[stack.length-1];
  if(directive==='else'||directive==='elseif'){
   if(frame?.kind!=='if' || frame.otherwise)throw new Error(`Unexpected !${directive} at source line ${index+1}.`);
   if(directive==='else')frame.otherwise=true;
   continue;
  }
  if(frame?.kind!==closing[directive])throw new Error(`Mismatched !${directive} at source line ${index+1}.`);
  stack.pop();
 }
 const frame=stack[stack.length-1];
 if(frame)throw new Error(`Unclosed !${frame.kind} at source line ${frame.line}.`);
}
