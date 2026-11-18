/* Pure collection operations shared by the browser and regression tests. */
(function(root) {
  'use strict';
  const kinds = ['records', 'logos'];
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
      .filter(key => value[key] !== undefined)
      .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  const equal = (a,b) => stable(a) === stable(b);
  function changes(before, after) {
    const result=[];
    for (const kind of kinds) {
      const old=new Map(before[kind].map(row=>[row.id,row]));
      const next=new Map(after[kind].map(row=>[row.id,row]));
      for (const id of new Set([...old.keys(),...next.keys()])) {
        if (!equal(old.get(id),next.get(id))) result.push({kind,id,after:next.get(id)||null});
      }
    }
    return result;
  }
  function apply(state, edits) {
    const result={};
    for (const kind of kinds) {
      const rows=new Map(state[kind].map(row=>[row.id,row]));
      for (const edit of edits.filter(edit=>edit.kind===kind)) {
        if (edit.after === null) rows.delete(edit.id); else rows.set(edit.id,edit.after);
      }
      result[kind]=[...rows.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    }
    return result;
  }
  function mergeDelta(state, delta) {
    return apply(state, kinds.flatMap(kind=>[
      ...(delta.deleted?.[kind]||[]).map(id=>({kind,id,after:null})),
      ...(delta.changed?.[kind]||[]).map(after=>({kind,id:after.id,after}))
    ]));
  }
  root.RapliCollectionDiff={equal,changes,apply,mergeDelta};
  if(typeof module!=='undefined')module.exports=root.RapliCollectionDiff;
})(typeof window==='undefined'?globalThis:window);
