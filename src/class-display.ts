import type { SemanticModel } from './types.js';

export function applyClassDisplay(model: SemanticModel, rules: string[]): void {
  for (const rule of rules) {
    const match = rule.match(/^(hide|show|remove|restore)\s+(.+)$/)!;
    const show = match[1] === 'show' || match[1] === 'restore';
    const tokens = match[2]!.split(/\s+/);
    if(tokens[0]==='@unlinked')tokens[0]='unlinked';
    const categories = new Set(['members','fields','attributes','methods','operations','stereotype','empty','private','protected','public','package']);
    const selector = categories.has(tokens[0]!) && !(tokens[0]==='stereotype' && tokens.length>1) ? '*' : tokens.shift()!;
    const subject = tokens.join(' ') || 'node';
    const valid = /^(node|stereotype|members|fields|attributes|methods|operations|empty (members|fields|attributes|methods|operations)|(private|protected|public|package) members)$/;
    if (!valid.test(subject)) throw new Error(`Unsupported display rule: ${rule}`);
    if(['remove','restore'].includes(match[1]!) && subject!=='node')throw new Error('remove/restore select classifiers, not member compartments.');
    const linked=new Set(model.connections.flatMap(e=>[e.from,e.to]));
    model.nodes.filter(n=>n.attributes.associationClass).forEach(n=>linked.add(n.id));
    const nodes = model.nodes.filter(n => ['uml-class','uml-instance','uml-map'].includes(n.shape) && (selector === '*' || selector.startsWith('$') && (JSON.parse(n.attributes.tags ?? '[]') as string[]).includes(selector.slice(1)) || selector === 'unlinked' && !linked.has(n.id) || n.id === selector || n.attributes.kind === selector || selector === `<<${n.attributes.stereotype}>>`));
    if (!nodes.length && selector !== '*' && selector !== 'unlinked' && !['class','abstract','interface','enum','annotation','record','dataclass','struct','protocol','exception','metaclass','stereotype','entity'].includes(selector) && !selector.startsWith('<<')) throw new Error(`Unknown display target ${selector}.`);
    for (const node of nodes) {
      if (subject === 'node') { node.attributes.hidden = String(!show); node.attributes.removed=String(match[1]==='remove'); continue; }
      if (subject === 'stereotype') { node.attributes.hideStereotype = String(!show); continue; }
      if (subject.startsWith('empty ')) {
        const compartment=subject.slice(6);
        if(['members','fields','attributes'].includes(compartment))node.attributes.hideEmptyFields=String(!show);
        if(['members','methods','operations'].includes(compartment))node.attributes.hideEmptyOperations=String(!show);
        continue;
      }
      const members = JSON.parse(node.attributes.members ?? '[]') as Array<{text:string;kind:string;visibilityEscaped?:boolean}>;
      const hidden = JSON.parse(node.attributes.hiddenMembers ?? '[]') as number[];
      const selected = new Set(hidden);
      members.forEach((member,index) => {
        const visibility = ({private:'-',protected:'#',public:'+',package:'~'} as Record<string,string>)[tokens[tokens.length-2] ?? ''];
        const matches = subject === 'members' || (visibility ? !member.visibilityEscaped && member.text.trimStart().startsWith(visibility) : ['fields','attributes'].includes(subject) ? member.kind !== 'operation' && member.kind !== 'separator' : member.kind === 'operation');
        if (matches) { if (show) selected.delete(index); else selected.add(index); }
      });
      node.attributes.hiddenMembers = JSON.stringify([...selected]);
      node.attributes.hideEmptyMembers = 'true';
    }
  }
}
