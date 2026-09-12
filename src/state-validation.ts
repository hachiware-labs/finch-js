import type { SemanticModel, StateDiagnostic } from './types.js';

/** Structural diagnostics only; guards and executable behaviors are not evaluated. */
export function validateState(model: SemanticModel): StateDiagnostic[] {
  const library = model.stateMachines ?? Object.create(null) as Record<string, SemanticModel>;
  const result = validateStateStructure(model, library);
  for (const [name, machine] of Object.entries(library)) {
    result.push(...validateStateStructure(machine, library).map(d => ({ ...d, message: `${name}: ${d.message}` })));
  }
  const visit = (name: string, path: string[]) => {
    if (path.includes(name)) { result.push({ code:'submachine-cycle', message:`Recursive submachine reference: ${[...path,name].join(' -> ')}` }); return; }
    for (const node of library[name]?.nodes ?? []) if (node.attributes.submachine && library[node.attributes.submachine]) visit(node.attributes.submachine, [...path,name]);
  };
  for (const name of Object.keys(library)) visit(name, []);
  return result;
}

function validateStateStructure(model: SemanticModel, library: Record<string, SemanticModel>): StateDiagnostic[] {
  if (model.kind !== 'state') return [];
  const result: StateDiagnostic[] = [];
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const kind = (id: string) => nodes.get(id)?.attributes.stateKind;
  const descendant = (id: string, ancestor: string): boolean => {
    const seen = new Set<string>();
    let parent = nodes.get(id)?.parentId;
    while (parent && !seen.has(parent)) {
      if (parent === ancestor) return true;
      seen.add(parent); parent = nodes.get(parent)?.parentId;
    }
    return false;
  };
  const regionsOf = (id: string): Map<string, string> => {
    const regions = new Map<string, string>();
    let node = nodes.get(id); const seen = new Set<string>();
    while (node?.parentId && !seen.has(node.id)) {
      seen.add(node.id);
      const parent = nodes.get(node.parentId);
      if (parent?.attributes.stateKind === 'region' && parent.parentId) regions.set(parent.parentId, parent.id);
      node = parent;
    }
    return regions;
  };
  const orthogonal = (a: string, b: string) => {
    const ar = regionsOf(a), br = regionsOf(b);
    return [...ar].some(([owner, region]) => br.has(owner) && br.get(owner) !== region);
  };
  const add = (code: string, message: string, nodeId?: string, edgeId?: string) => result.push({ code, message, ...(nodeId ? { nodeId } : {}), ...(edgeId ? { edgeId } : {}) });
  for (const node of model.nodes) {
    const k = kind(node.id);
    if (!k) continue;
    const incoming = model.connections.filter(edge => edge.to === node.id);
    const outgoing = model.connections.filter(edge => edge.from === node.id);
    if (k === 'region' && (!node.parentId || kind(node.parentId) !== 'state')) add('region-owner', `${node.id}: region requires a state owner.`, node.id);
    if (node.parentId && !nodes.has(node.parentId)) add('state-owner', `${node.id}: unknown owner ${node.parentId}.`, node.id);
    if (model.stateMachineKind === 'protocol' && (node.attributes.stateBehaviors || node.attributes.defer || ['history','deep-history'].includes(k))) add('protocol-state', `${node.id}: protocol machines cannot define execution behaviors, deferred events, or history.`, node.id);
    if (k === 'state') {
      const children = model.nodes.filter(n => n.parentId === node.id && !n.attributes.connectionPoint);
      if (children.some(n => kind(n.id) === 'region') && children.some(n => kind(n.id) !== 'region')) add('region-mixed', `${node.id}: explicit regions cannot be mixed with directly owned vertices.`, node.id);
      if (node.attributes.submachine) {
        if (!library[node.attributes.submachine]) add('submachine-reference', `${node.id}: unknown machine ${node.attributes.submachine}.`, node.id);
        if (children.length) add('submachine-regions', `${node.id}: a submachine state cannot also own regions.`, node.id);
      }
    }
    if (['inputpin','outputpin'].includes(k)) {
      const owner=node.parentId ? nodes.get(node.parentId) : undefined;
      if(!owner || owner.attributes.stateKind!=='state' || owner.shape!=='container')add('pin-owner',`${node.id}: a state boundary pin requires a composite state owner.`,node.id);
      if(node.attributes.ref)add('pin-reference',`${node.id}: state boundary pins are not machine connection-point references.`,node.id);
      if(owner){
        const input=k==='inputpin';
        if(incoming.some(edge=>descendant(edge.from,owner.id)===input) || outgoing.some(edge=>descendant(edge.to,owner.id)!==input))add('pin-direction',`${node.id}: boundary pin connections must follow its input/output direction.`,node.id);
      }
    }
    if (['entrypoint','exitpoint'].includes(k)) {
      const owner = node.parentId ? nodes.get(node.parentId) : undefined;
      if (node.parentId && kind(node.parentId) !== 'state') add('point-owner', `${node.id}: a connection point belongs to a state or machine, not a region.`, node.id);
      if (owner?.attributes.submachine) {
        const definition = library[owner.attributes.submachine];
        const refs = (node.attributes.ref ?? "").split(",");
        const points = refs.map(ref=>definition?.nodes.find(n=>n.id === ref && !n.parentId && n.attributes.stateKind === k));
        if (new Set(refs).size !== refs.length || points.some(point=>!point)) add('point-reference', `${node.id}: ref must name a matching machine connection point.`, node.id);
      } else {
        if (node.attributes.ref) add('point-reference', `${node.id}: ref requires a submachine owner.`, node.id);
        if (owner && !model.nodes.some(n => n.parentId === owner.id && !n.attributes.connectionPoint)) add('point-composite', `${node.id}: connection points require a composite state.`, node.id);
      }
      if (k === 'entrypoint') {
        if (owner && incoming.some(e => descendant(e.from, owner.id))) add('entry-direction', `${node.id}: entry must be entered from outside its owner.`, node.id);
        if (owner?.attributes.submachine ? outgoing.length > 0 : outgoing.some(e => owner && !descendant(e.to, owner.id))) add('entry-direction', `${node.id}: entry must lead inside its owner.`, node.id);
      } else {
        if (owner?.attributes.submachine ? incoming.length > 0 : incoming.some(e => owner && !descendant(e.from, owner.id))) add('exit-direction', `${node.id}: exit must be reached from inside its owner.`, node.id);
        if (owner && outgoing.some(e => descendant(e.to, owner.id))) add('exit-direction', `${node.id}: exit must lead outside its owner.`, node.id);
      }
    }
    if (k === 'choice' && (incoming.length < 1 || outgoing.length < 1)) add('choice-degree', `${node.id}: choice requires incoming and outgoing transitions.`, node.id);
    if (k === 'junction' && (incoming.length < 1 || outgoing.length < 1)) add('junction-degree', `${node.id}: junction requires incoming and outgoing transitions.`, node.id);
    if (['entrypoint', 'exitpoint'].includes(k) && !node.attributes.ref) {
      const segments = k === 'entrypoint' ? outgoing.map(e => e.to) : incoming.map(e => e.from);
      if (segments.some((a,i) => segments.slice(i+1).some(b => !orthogonal(a,b)))) add('point-regions', `${node.id}: multiple boundary segments must belong to different orthogonal regions.`, node.id);
      if (!node.parentId && (k === 'entrypoint' ? incoming.length : outgoing.length)) add('machine-boundary', `${node.id}: machine entry/exit cannot connect in the reverse direction.`, node.id);
    }
    if (k === 'fork' || k === 'join') {
      const ends = k === 'fork' ? outgoing.map(e => e.to) : incoming.map(e => e.from);
      if (ends.some((a,i) => ends.slice(i+1).some(b => !orthogonal(a,b)))) add('parallel-regions', `${node.id}: fork/join branches must belong to different regions of an orthogonal state.`, node.id);
    }
    if (k === 'initial') {
      if (incoming.length || outgoing.length > 1) add('initial-degree', `${node.id}: initial allows no incoming and at most one outgoing transition.`, node.id);
      if (model.nodes.some(other => other.id !== node.id && other.parentId === node.parentId && kind(other.id) === 'initial')) add('initial-unique', `${node.id}: only one initial per region.`, node.id);
    }
    if (['final', 'terminate'].includes(k) && outgoing.length) add('terminal-outgoing', `${node.id}: ${k} cannot have outgoing transitions.`, node.id);
    if (k === 'fork' && (incoming.length !== 1 || outgoing.length < 2)) add('fork-degree', `${node.id}: fork requires one incoming and at least two outgoing transitions.`, node.id);
    if (k === 'join' && (incoming.length < 2 || outgoing.length !== 1)) add('join-degree', `${node.id}: join requires at least two incoming and one outgoing transition.`, node.id);
    if (['history', 'deep-history'].includes(k)) {
      for (const edge of outgoing) {
        const target = nodes.get(edge.to);
        const sameRegion = target?.parentId === node.parentId;
        const nestedRegion = !node.parentId || descendant(edge.to, node.parentId);
        if (!['state','final'].includes(kind(edge.to) ?? '') || !(k === 'history' ? sameRegion : sameRegion || nestedRegion)) add('history-target', `${node.id}: history default must target a state in its region${k === 'deep-history' ? ' or a descendant' : ''}.`, node.id, edge.id);
        if (edge.attributes?.guard !== undefined) add('history-guard', `${node.id}: history default cannot have a guard.`, node.id, edge.id);
      }
      if (outgoing.length > 1) add('history-default', `${node.id}: history permits at most one default transition.`, node.id);
      if (model.nodes.some(other => other.id !== node.id && other.parentId === node.parentId && kind(other.id) === k)) add('history-unique', `${node.id}: duplicate history kind in region.`, node.id);
    }
  }
  for (const edge of model.connections) {
    const from = kind(edge.from), to = kind(edge.to);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) add("unknown-vertex", "Unknown transition vertex.", undefined, edge.id);
    if (orthogonal(edge.from, edge.to)) add('cross-region', 'A direct transition cannot cross orthogonal regions; use fork/join or exit the composite state.', undefined, edge.id);
    if (from === 'region' || to === 'region') add('region-endpoint', 'Transitions connect vertices, not regions.', undefined, edge.id);
    if (from === 'fork' && !['state', 'final'].includes(to ?? '')) add('fork-target', 'A fork segment must target a state.', undefined, edge.id);
    if (to === 'join' && !['state', 'final'].includes(from ?? '')) add('join-source', 'A join segment must originate at a state.', undefined, edge.id);
    const attrs = edge.attributes ?? {};
    if (model.stateMachineKind === 'protocol' && attrs.effect) add('protocol-effect', 'Protocol transitions use pre/post conditions, not effects.', undefined, edge.id);
    if ((['initial', 'history', 'deep-history', 'fork', 'join', 'choice', 'junction', 'entrypoint', 'exitpoint'].includes(from ?? '') || to === 'join') && attrs.trigger) add('pseudostate-trigger', 'This transition segment cannot have a trigger.', undefined, edge.id);
    if ((['initial', 'fork'].includes(from ?? '') || to === 'join') && attrs.guard !== undefined) add('pseudostate-guard', 'This transition segment cannot have a guard.', undefined, edge.id);
    if (attrs.transitionKind === 'local' && (from === 'entrypoint' ? false : from !== 'state' || !descendant(edge.to, edge.from))) add('local-target', 'A local transition requires a composite source and a descendant target.', undefined, edge.id);
  }
  return result;
}
