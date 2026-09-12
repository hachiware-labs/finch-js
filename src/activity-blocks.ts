/** Expand structured activity blocks into ordinary nodes and transitions. */
export function expandActivityBlocks(source: string): string {
  const automatic=/^\s*@activity\s+flow\s*(?:\r?\n|$)/.test(source);
  if (!automatic && !/^\s*(while|repeat|if|switch|split)\s+[^\n]*\{/m.test(source)) return source;
  const lines = source.split(/\r?\n/).filter(line=>line.trim() && !/^\s*['#]/.test(line));
  let cursor = 0, serial = 0;
  const output: string[] = [], generated: string[] = [], explicit: string[] = [], back: string[] = [];
  type Flow = { entry: string; exits: string[] };
  type Loop = { id: string; condition: string };
  const connect = (from: string[], to: string) => from.forEach(id => generated.push(`${id} -> ${to}`));
  const block = (loop?: Loop): Flow => {
    let entry = ''; let exits: string[] = [];
    while (cursor < lines.length && lines[cursor]!.trim() !== '}') {
      const line = lines[cursor]!.trim();
      if (!line || line.startsWith("'")) { cursor++; continue; }
      let next: Flow;
      const split=line.match(/^split\s+([\w.-]+)\s*\{$/);
      if(split) {
        cursor++;const id=split[1]!;let count=0,live=0;
        output.push(`fork ${id}`);
        while(cursor<lines.length && lines[cursor]!.trim()!=='}') {
          if(!lines[cursor]!.trim() || lines[cursor]!.trim().startsWith("'")){cursor++;continue;}
          if(!/^branch\s*\{$/.test(lines[cursor++]!.trim()))throw new Error(`Expected branch in split ${id}.`);
          const body=block(loop);
          if(lines[cursor++]?.trim()!=='}')throw new Error(`Unclosed branch in split ${id}.`);
          generated.push(`${id} -> ${body.entry}`);connect(body.exits,`${id}.done`);live+=body.exits.length;count++;
        }
        if(count<2 || lines[cursor++]?.trim()!=='}')throw new Error(`Split ${id} needs at least two closed branches.`);
        if(live)output.push(`merge ${id}.done "" [shape=choice-state]`);
        next={entry:id,exits:live ? [`${id}.done`] : []};
        if(!entry)entry=id;else {connect(exits,id);if(!exits.length)next.exits=[];}
        exits=next.exits;continue;
      }
      const selection = line.match(/^switch\s+([\w.-]+)\s+"((?:\\.|[^"])*)"\s*\{$/);
      if(selection) {
        cursor++; const id=selection[1]!; const labels=new Set<string>(); let count=0, live=0;
        output.push(`decision ${id} "${selection[2]}"`);
        while(cursor<lines.length && lines[cursor]!.trim() !== "}") {
          const branch=lines[cursor++]!.trim().match(/^case\s+"((?:\\.|[^"])*)"\s*\{$/);
          if(!branch || labels.has(branch[1]!)) throw new Error(`Invalid or duplicate case in ${id}.`);
          labels.add(branch[1]!); const body=block(loop);
          if(lines[cursor++]?.trim() !== "}") throw new Error(`Unclosed case in ${id}.`);
          generated.push(`${id} -> ${body.entry}: [${branch[1]}]`); connect(body.exits,`${id}.done`); live+=body.exits.length; count++;
        }
        if(!count || lines[cursor++]?.trim() !== "}") throw new Error(`Empty or unclosed switch ${id}.`);
        if(live)output.push(`merge ${id}.done "" [shape=choice-state]`);
        next={entry:id,exits:live ? [`${id}.done`] : []};
        if(!entry) entry=next.entry; else {connect(exits,next.entry);if(!exits.length)next.exits=[];} exits=next.exits; continue;
      }
      if (/^(kill|detach)$/.test(line)) {
        if(!entry)throw new Error(`${line} requires a preceding activity in the block.`);
        exits=[];cursor++;continue;
      }
      const header = line.match(/^(while|repeat|if)\s+([\w.-]+)\s+"((?:\\.|[^"])*)"\s*\{$/);
      if (header) {
        cursor++;
        const [,kind,id,label] = header;
        const condition = kind === 'repeat' ? `${id}.test` : id!;
        const body = block(kind === 'if' ? loop : {id:id!,condition});
        if (lines[cursor++]?.trim() !== '}') throw new Error(`Unclosed ${kind} ${id}.`);
        const testsCondition=kind!=='repeat' || body.exits.length>0 || back.some(edge=>edge.endsWith(` -> ${condition}`));
        if(testsCondition)output.push(`decision ${condition} "${label}"`);
        if (kind === 'if') {
          generated.push(`${id} -> ${body.entry} [yes]`); connect(body.exits, `${id}.done`);
          if (/^else\s*\{$/.test(lines[cursor]?.trim() ?? '')) {
            cursor++; const alternative = block(loop);
            if (lines[cursor++]?.trim() !== '}') throw new Error(`Unclosed else ${id}.`);
            generated.push(`${id} -> ${alternative.entry} [no]`); connect(alternative.exits, `${id}.done`);
            next = {entry:id!,exits:body.exits.length || alternative.exits.length ? [`${id}.done`] : []};
          } else { generated.push(`${id} -> ${id}.done [no]`); next = {entry:id!,exits:[`${id}.done`]}; }
          if(next.exits.length)output.push(`merge ${id}.done "" [shape=choice-state]`);
        } else {
          const exitsLoop=testsCondition || generated.some(edge=>edge.endsWith(` -> ${id}.done`));
          if(exitsLoop)output.push(`merge ${id}.done "" [shape=choice-state]`);
          if(testsCondition)generated.push(`${condition} -> ${id}.done [no]`);
          if (kind === 'while') { generated.push(`${condition} -> ${body.entry} [yes]`); body.exits.forEach(exit => back.push(`${exit} -> ${condition}`)); }
          else { output.push(`merge ${id} "" [shape=choice-state]`); generated.push(`${id} -> ${body.entry}`); connect(body.exits, condition); if(testsCondition)back.push(`${condition} -> ${body.entry} [yes]`); }
          next = {entry:id!,exits:exitsLoop ? [`${id}.done`] : []};
        }
      } else if (/^(break|continue)$/.test(line)) {
        if (!loop) throw new Error(`${line} requires a loop.`);
        cursor++; const id = `${loop.id}.${line}${++serial}`;
        output.push(`merge ${id} "" [shape=choice-state]`);
        (line === "continue" ? back : generated).push(`${id} -> ${line === 'break' ? `${loop.id}.done` : loop.condition}`);
        next = {entry:id,exits:[]};
      } else if (/^[\w.-]+\s+(?:--?>|\.\.>)/.test(line)) {
        explicit.push(line); cursor++; continue;
      } else {
        const node = line.match(/^(start|action|activity|send|receive|object|decision|merge|fork|join|end|flowfinal)\s+([\w.-]+)/);
        if (!node) throw new Error(`Invalid loop statement: ${line}`);
        output.push(lines[cursor++]!); next = {entry:node[2]!,exits:['end','flowfinal'].includes(node[1]!) ? [] : [node[2]!]};
      }
      if (!entry) entry = next.entry; else {connect(exits, next.entry);if(!exits.length)next.exits=[];}
      exits = next.exits;
    }
    if (!entry) throw new Error('Activity block cannot be empty.');
    return {entry,exits};
  };
  if(automatic){
    cursor=lines.findIndex(line=>line.trim().startsWith('@activity'))+1;
    output.push('@activity');block();
    if(cursor<lines.length)throw new Error('Unexpected closing brace in activity flow.');
  }
  // Wrapping one top-level loop lets the same parser handle nesting and lanes.
  while (cursor < lines.length) {
    if (/^\s*(while|repeat|if|switch|split)\s+[^\n]*\{/.test(lines[cursor]!)) {
      const begin = cursor; let depth = 0;
      do { const line = lines[cursor++]!.trim(); if (line.endsWith('{')) depth++; if (line === '}') depth--; } while (cursor < lines.length && depth);
      if (/^\s*else\s*\{$/.test(lines[cursor] ?? "")) {
        do { const line=lines[cursor++]!.trim(); if(line.endsWith("{")) depth++;if(line === "}") depth--; } while(cursor<lines.length && depth);
      }
      const end = cursor;
      lines.splice(end, 0, '}'); cursor = begin;
      block(); lines.splice(end, 1); cursor = end;
    } else output.push(lines[cursor++]!);
  }
  const overridden = new Set(explicit.map(line => line.match(/^([\w.-]+)/)![1]));
  return [...output,...generated.filter(line => !overridden.has(line.split(' ')[0]!)),...explicit,...back.filter(line => !overridden.has(line.split(' ')[0]!))].join('\n');
}
