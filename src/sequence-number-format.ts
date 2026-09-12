/** Integer sequence formatting with DecimalFormat-style digit patterns. */
export function decimalSequenceNumber(value:number,format:string):string {
 const chars:Array<{char:string;literal:boolean}>=[];let quoted=false;
 for(let i=0;i<format.length;i++){
  const char=format[i]!;
  if(char==="'"){
   if(format[i+1]==="'"){chars.push({char,literal:true});i++;}
   else quoted=!quoted;
  }else chars.push({char,literal:quoted});
 }
 if(quoted)throw new Error('Unclosed quote in autonumber format.');
 const start=chars.findIndex(c=>!c.literal && /[0#]/.test(c.char));
 if(start<0)throw new Error('Autonumber format requires {n} or a numeric digit pattern.');
 let end=start;
 while(end<chars.length && !chars[end]!.literal && /[0#,.]/.test(chars[end]!.char))end++;
 const before=chars.slice(0,start),after=chars.slice(end);
 if([...before,...after].some(c=>!c.literal && /[0#.,;%‰¤E]/.test(c.char)))throw new Error('Unsupported autonumber format; quote literal punctuation.');
 const pattern=chars.slice(start,end).map(c=>c.char).join('');
 if(!/^#*0*(?:\.0*#*)?$/.test(pattern.replace(/,/g,'')) || !/[0#]/.test(pattern) || pattern.startsWith(',') || pattern.includes(',,') || /\.[^]*,/.test(pattern) || /,(?:\.|$)/.test(pattern))throw new Error('Invalid autonumber numeric format.');
 const [integer,fraction='']=pattern.split('.');
 const minimum=(integer!.match(/0/g) ?? []).length;
 let digits=String(value).padStart(minimum,'0');
 const comma=integer!.lastIndexOf(',');
 if(comma>=0){
  const group=integer!.length-comma-1;
  if(!group)throw new Error('Invalid autonumber grouping.');
  let grouped='';
  while(digits.length>group){grouped=','+digits.slice(-group)+grouped;digits=digits.slice(0,-group);}
  digits+=grouped;
 }
 const zeros=(fraction.match(/0/g) ?? []).length;
 const suffix=pattern.endsWith('.') || zeros ? '.'+'0'.repeat(zeros) : '';
 return before.map(c=>c.char).join('')+digits+suffix+after.map(c=>c.char).join('');
}

export interface SequenceNumber {value:number;prefix?:number[];separators?:string[];format?:string}
export function sequenceNumber(number:SequenceNumber):string {
 const values=[...(number.prefix ?? []),number.value];
 const join=(width=0)=>values.map((value,i)=>`${i ? number.separators?.[i-1] ?? '.' : ''}${String(value).padStart(width,'0')}`).join('');
 if(number.format===undefined)return join()+'.';
 if(/\{n(?::0?[1-9]\d?)?\}/.test(number.format))return number.format.replace(/\{n(?::0?([1-9]\d?))?\}/g,(_,width:string|undefined)=>join(Number(width ?? 0)));
 if(values.length>1)throw new Error('Hierarchical autonumber requires a {n} format.');
 return decimalSequenceNumber(number.value,number.format);
}
