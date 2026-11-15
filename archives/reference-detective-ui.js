/* Détective de références — interface des paramètres de Rapli Archives.
   Aucun changement de fiche, aucune requête externe. */
'use strict';
let detectiveFilters={edition:'',artwork:'',rarity:'',language:''};
let detectiveResults=null;
function detectiveMemory(){
  const settings=moduleSettings();
  if(!settings.referenceDetective||!Array.isArray(settings.referenceDetective.ignored))
    settings.referenceDetective={ignored:[]};
  return settings.referenceDetective;
}
function detectiveIgnored(row){
  return detectiveMemory().ignored.some(i=>i.key===row.key&&i.fingerprint===row.fingerprint);
}
function detectiveScan(){
  if(!window.RapliReferenceDetective){toast('Moteur de recherche indisponible. Actualise la page.',true);return;}
  detectiveResults=window.RapliReferenceDetective.scan(dragonVariants(),archive.groups,detectiveFilters);
  showSettingsContent();
  toast(detectiveResults.length+' correspondance(s) potentielle(s).');
}
async function detectiveSetIgnored(index,ignore){
  const row=detectiveResults?.[index];if(!row)return;
  const memory=detectiveMemory();
  const before=memory.ignored;
  memory.ignored=before.filter(i=>i.key!==row.key);
  if(ignore)memory.ignored.push({key:row.key,fingerprint:row.fingerprint});
  const previousDraft=draftModuleSettings?.referenceDetective;
  if(draftModuleSettings)draftModuleSettings.referenceDetective=structuredClone(memory);
  if(!await save()){
    memory.ignored=before;
    if(draftModuleSettings)draftModuleSettings.referenceDetective=previousDraft;
    toast('Décision non sauvegardée.',true);
  }
  showSettingsContent();
}
function detectiveFilterOptions(field){
  const names={edition:'Édition',artwork:'Artwork',rarity:'Rareté',language:'Langue'};
  const items=[...new Set(dragonVariants().map(v=>String(
    field==='edition'?(v.edition||getGroup(v.groupId)?.name||''):(v[field]||'')
  ).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
  return '<label class="detective-filter-label">'+names[field]+
    '<select data-detective-filter="'+field+'" aria-label="Filtrer par '+names[field]+'">'+
    '<option value="">Tous</option>'+
    items.map(x=>'<option value="'+attr(x)+'"'+(detectiveFilters[field]===x?' selected':'')+'>'+h(x)+'</option>').join('')+
    '</select></label>';
}
function referenceDetectivePanel(){
  const types={exact:'Référence identique',format:'Différence de ponctuation',visuel:'Confusion O/0 ou I/1',prefixe:'Préfixe similaire'};
  const results=(detectiveResults||[]).map((row,index)=>({...row,index,ignored:detectiveIgnored(row)}));
  const active=results.filter(x=>!x.ignored), normal=results.filter(x=>x.ignored);
  function card(v){
    const edition=v.edition||getGroup(v.groupId)?.name||'—';
    return '<article class="detective-card"><strong>'+h(v.reference||'—')+'</strong>'+
      '<dl><dt>Édition</dt><dd>'+h(edition)+'</dd><dt>Artwork</dt><dd>'+h(v.artwork||'—')+
      '</dd><dt>Rareté</dt><dd>'+h(v.rarity||'—')+'</dd><dt>Langue</dt><dd>'+h(v.language||'—')+
      '</dd></dl><button class="secondary-button" type="button" data-action="detective-view" data-id="'+attr(v.id)+'">Voir la fiche</button></article>';
  }
  function rowView(x){
    return '<details class="detective-hit"><summary><span>'+h(types[x.type]||'Références similaires')+'</span>'+
      '<strong>'+h(x.a.reference)+' ⇄ '+h(x.b.reference)+'</strong>'+
      '<em>'+(x.ignored?'Normal ✓':'À examiner')+'</em></summary>'+
      '<div class="detective-hit-body"><p>Correspondance potentielle : vérifie les tirages avant toute correction.</p>'+
      '<div class="detective-compare">'+card(x.a)+card(x.b)+'</div>'+
      '<button class="secondary-button" type="button" data-action="'+(x.ignored?'detective-restore':'detective-ignore')+
      '" data-index="'+x.index+'">'+(x.ignored?'Réexaminer':'Marquer comme normal')+'</button></div></details>';
  }
  const filtered=Object.values(detectiveFilters).some(Boolean);
  return '<section class="detective-panel" aria-label="Détective des références">'+
    '<h3>Détective des références</h3>'+
    '<p class="helper">Recherche manuelle des références identiques ou très proches. Les différences connues de tirage, de rareté, d’artwork et de langue sont protégées. Aucune fiche modifiée automatiquement.</p>'+
    '<details class="detective-filters"'+(filtered?' open':'')+'><summary>Filtres facultatifs'+(filtered?' · actifs':'')+
    '</summary><div class="detective-filter-grid">'+['edition','artwork','rarity','language'].map(detectiveFilterOptions).join('')+
    '</div><button class="secondary-button" type="button" data-action="detective-clear-filters">Effacer les filtres</button></details>'+
    '<button class="primary-button detective-scan" type="button" data-action="detective-scan">⌕ Analyser les références</button>'+
    (detectiveResults===null?'<p class="detective-empty">Aucune analyse lancée.</p>':
      '<div class="detective-status" role="status"><strong>'+active.length+' à examiner</strong> · '+
      normal.length+' marquée(s) comme normales · '+results.length+' correspondance(s) au total</div>'+
      (active.length?active.map(rowView).join(''):'<p class="detective-empty">Aucune correspondance suspecte dans cette analyse.</p>')+
      (normal.length?'<details class="detective-normal"><summary>Correspondances marquées comme normales ('+
        normal.length+')</summary>'+normal.map(rowView).join('')+'</details>':''))+
    '</section>';
}
document.addEventListener('change',e=>{
  const field=e.target?.dataset?.detectiveFilter;
  if(!field||!Object.hasOwn(detectiveFilters,field))return;
  detectiveFilters[field]=e.target.value;
  detectiveResults=null;
  showSettingsContent();
});
