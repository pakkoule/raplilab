/* Appearance settings are one small logo-library record; never image data or CSS input. */
(function(root){
'use strict';
const TARGETS={
 page:{label:'Fond de la page',selector:'body',global:true},
 heading:{label:'Titres des fenêtres et sections',selector:'.modal-title, .modal h2, .modal h3, .rainbow-versions-dialog h2, .rainbow-versions-dialog h3',global:true,text:true},
 tabs:{label:'Onglets de collection',selector:'.section-nav .tab',global:true},
 activeTab:{label:'Onglet actif',selector:'.section-nav .tab.active',global:true},
 menus:{label:'Menus des vues et du tri',selector:'#sportsViewSelect, #sortSelect',global:true},
 counter:{label:'Compteur de cartes',selector:'#resultsLabel',global:true},
 buttons:{label:'Boutons d’action',selector:'.button, .card-export-actions button',global:true},
 search:{label:'Champ de recherche',selector:'#filterSearch',global:true},
 groupTitle:{label:'Titres des groupes',selector:'.sports-gallery-caption strong, .sports-gallery-breadcrumb',global:true,text:true},
 groupTile:{label:'Tuiles des groupes',selector:'.sports-gallery-group',global:true},
 rainbowTitle:{label:'Titre des Rainbows',selector:'.sports-rainbow-group h3',global:true,text:true},
 rainbowProgress:{label:'Progression des Rainbows',selector:'.sports-rainbow-track > span',global:true},
 tile:{label:'Fond et bordure des cartes',selector:'',card:true},
 athlete:{label:'Nom de l’athlète',selector:'.player-primary-name, .player-extra-names, .sports-gallery-athlete-foil',card:true,text:true},
 reference:{label:'Référence',selector:'.card-ref-inline:not(.is-copied)',card:true},
 brand:{label:'Texte de marque et d’équipe',selector:'.brand-lockup, .team-identity',card:true,text:true},
 tag:{label:'Tags sans logo',selector:'.tag',card:true},
 sport:{label:'Badge sport',selector:'.sport-chip',card:true},
 serial:{label:'Numérotation',selector:'.collector-badge--number',card:true},
 season:{label:'Saison',selector:'.card-season',card:true},
 grading:{label:'Grading',selector:'.grading-plate, .grading-score',card:true},
 auto:{label:'Autographe',selector:'.player-trait--auto',card:true},
 patch:{label:'Patch',selector:'.player-trait--patch',card:true},
 newBadge:{label:'Badge NEW',selector:'.sports-new-flag',card:true},
 dreamBadge:{label:'Badge Dans mes rêves',selector:'.card-dream-badge',card:true}
};
const CONDITIONS={always:'Toutes les cartes',rookie:'Rookie',own:'OWN',wishlist:'Wishlist',legendary:'Légendaire',oneofone:'Véritable One of One',plate:'Printing Plate',review:'1/1 à vérifier',dream:'Dans mes rêves',graded:'Gradée',numbered:'Numérotée'};
const SCOPES={all:'Partout',catalogue:'Catalogue uniquement',rainbow:'Fenêtre des versions Rainbow'};
const fallback={color:'#284e69',start:'#edf2f9',end:'#f8fafc',border:'#a9cfcb',effect:'foil',middle:'#e6edf4',third:false,angle:125,intensity:50,borderWidth:2};
const style=(start,end,border,color='#284e69')=>({...fallback,start,end,border,color});
function defaults(){return {schema:1,base:{},rules:[
 {id:'oneofone',name:'Carte 1/1 dorée',target:'tile',scope:'all',when:'oneofone',enabled:true,style:style('#f8efda','#fffaf0','#c6a765')},
 {id:'legendary',name:'Saison légendaire dorée',target:'season',scope:'all',when:'legendary',enabled:true,style:style('#f8e9aa','#e8d6ee','#c7a560','#70521b')},
 {id:'rainbow-own',name:'Rainbow · OWN vert',target:'tile',scope:'rainbow',when:'own',enabled:true,style:style('#b9e6cb','#e9fff1','#74b997')},
 {id:'rainbow-wish',name:'Rainbow · Wishlist violet',target:'tile',scope:'rainbow',when:'wishlist',enabled:true,style:style('#d3bce9','#f5edff','#ad8acb')}
]};}
function cleanStyle(value={}){const result={};for(const key of ['color','start','end','middle','border'])result[key]=/^#[a-f0-9]{6}$/i.test(value[key]||'')?value[key]:fallback[key];result.effect=['solid','gradient','foil'].includes(value.effect)?value.effect:'foil';result.third=value.third===true;for(const [key,min,max] of [['angle',0,360],['intensity',0,100],['borderWidth',0,6]])result[key]=Number.isFinite(Number(value[key]))?Math.min(max,Math.max(min,Number(value[key]))):fallback[key];return result;}
function clean(value){
 if(!value||value.schema!==1)return defaults();
 const base={};for(const key of Object.keys(TARGETS))if(value.base?.[key])base[key]=cleanStyle(value.base[key]);
 const rules=(Array.isArray(value.rules)?value.rules:[]).slice(0,80).filter(r=>r&&TARGETS[r.target]?.card&&Object.hasOwn(CONDITIONS,r.when)&&Object.hasOwn(SCOPES,r.scope)).map((r,i)=>({id:'rule-'+i,name:String(r.name||'Variation').slice(0,80),target:r.target,scope:r.scope,when:r.when,enabled:r.enabled!==false,style:cleanStyle(r.style)}));
 return {schema:1,base,rules,favorites:[...new Set((Array.isArray(value.favorites)?value.favorites:[]).filter(c=>/^#[a-f0-9]{6}$/i.test(c)).map(c=>c.toLowerCase()))].slice(0,24)};
}
function background(input){const s=cleanStyle(input),stops=s.third?`${s.start},${s.middle} 50%,${s.end}`:`${s.start},${s.end}`,alpha=Math.round(s.intensity*2.55).toString(16).padStart(2,'0');return s.effect==='solid'?s.start:s.effect==='gradient'?`linear-gradient(${s.angle}deg,${stops})`:`linear-gradient(${s.angle-13}deg,transparent 12%,#ffffff${alpha} 34%,transparent 58%,#ffffff${alpha} 80%),linear-gradient(${s.angle}deg,${stops})`;}

function declarations(target,s){
 if(target.text)return s.effect==='solid'?`background:none!important;color:${s.color}!important;-webkit-text-fill-color:${s.color}!important;text-shadow:none!important;`:`background:${background(s)}!important;background-clip:text!important;-webkit-background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;`;
 return `background:${background(s)}!important;color:${s.color}!important;border-color:${s.border}!important;--collector-ink:${s.color};${target===TARGETS.tile?'--appearance-edge-width:'+s.borderWidth+'px;':''}`;
}
function selectors(key,scope='all',when='always'){
 const target=TARGETS[key];if(!target.card)return target.selector;
 const prefix=scope==='rainbow'?'.rainbow-versions-dialog ':scope==='catalogue'?'#cardGrid ':'';
 const condition=when==='always'?'':when==='own'||when==='wishlist'?`[data-appearance-status="${when}"]`:`[data-appearance-${when}="true"]`;
 const node=`${prefix}[data-appearance-card]${condition}`;
 return target.selector?target.selector.split(',').map(s=>node+' '+s.trim()).join(','):node;
}
function compile(value){
 const config=clean(value),rules=[];
 // Neutral baselines replace built-in conditional colours when their rules are deleted.
 for(const key of ['tile','season'])rules.push(`${selectors(key)}{${declarations(TARGETS[key],config.base[key]||fallback)}}`);
 for(const [key,s] of Object.entries(config.base))rules.push(`${selectors(key)}{${declarations(TARGETS[key],s)}}`);
 for(const rule of config.rules)if(rule.enabled)rules.push(`${selectors(rule.target,rule.scope,rule.when)}{${declarations(TARGETS[rule.target],rule.style)}}`);
 return rules.map(rule=>rule.replace(/^([^{}]+)\{/,(_,selectors)=>selectors.split(',').map(selector=>'html:not(#appearance-specificity-a):not(#appearance-specificity-b) '+selector.trim()).join(',')+'{')).join('\n');
}
if(typeof module!=='undefined'&&module.exports){module.exports={TARGETS,defaults,clean,compile};return;}
const bridge=root.RapliAppearanceBridge;if(!bridge)return;
let sheet=document.createElement('style');sheet.id='rapli-appearance-overrides';document.head.append(sheet);
let draft=null,dialog=null,selection='base:athlete',dirty=false,restoring=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function annotate(container=document){
 const nodes=[...(container.matches?.('[data-card-id]')?[container]:[]),...container.querySelectorAll('[data-card-id]')];
 for(const node of nodes){if(!node.matches('.card-item,.sports-gallery-tile'))continue;const card=bridge.card(node.dataset.cardId);if(!card)continue;
  const set=(key,value)=>{if(node.dataset[key]!==value)node.dataset[key]=value;};
  set('appearanceCard','');set('appearanceStatus',card.status);
  for(const key of ['rookie','legendary','dream','graded','numbered'])
    set('appearance'+key[0].toUpperCase()+key.slice(1),String(card[key]===true));
  set('appearancePlate',String(card.numbered&&Number(card.printRun)===1&&card.uniqueKind==='plate'));
  set('appearanceReview',String(card.numbered&&Number(card.printRun)===1&&!['plate','oneofone'].includes(card.uniqueKind)));
  set('appearanceOneofone',String(card.numbered&&Number(card.printRun)===1&&card.uniqueKind==='oneofone'));
 }
}
let lastAppliedCss='';
function apply(value){
 const nextCss=value?compile(value):'';
 // Rewriting an identical stylesheet repaints iOS Safari photo layers.
 if(nextCss!==lastAppliedCss){sheet.textContent=nextCss;lastAppliedCss=nextCss;}
 annotate();
}
function refresh(){if(!draft)apply(bridge.load());}
root.RapliAppearance={refresh,open,leave};refresh();
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node!==sheet)annotate(node);}).observe(document.body,{childList:true,subtree:true});
function preview(){restoring=false;apply(draft);dirty=true;renderComparison();dialog.querySelector('[data-theme-state]').textContent='Aperçu temporaire · non enregistré';}
function selected(){if(selection.startsWith('base:')){const target=selection.slice(5);return {base:true,target,style:cleanStyle(draft.base[target]||fallback)};}const rule=draft.rules[Number(selection.slice(5))];if(rule)rule.style=cleanStyle(rule.style);return rule;}
function render(){
 const item=selected();if(!item){selection='base:athlete';return render();}
 const target=TARGETS[item.target];
 dialog.innerHTML=`<header><div><small>BIBLIOTHÈQUE / APPARENCE</small><h2>Couleurs & variations</h2></div></header>
 <p>Les couleurs de base s’appliquent aux éléments choisis. Les variations les remplacent selon la carte. En cas de conflit, la dernière variation de la liste l’emporte.</p>
 <div class="appearance-workspace"><aside><label>Élément ou variation<select id="appearanceSelection"><optgroup label="Couleurs de base">${Object.entries(TARGETS).map(([key,t])=>`<option value="base:${key}">${esc(t.label)}${draft.base[key]?' · personnalisé':''}</option>`).join('')}</optgroup><optgroup label="Variations conditionnelles">${draft.rules.map((r,i)=>`<option value="rule:${i}">${r.enabled?'●':'○'} ${esc(r.name)}</option>`).join('')}</optgroup></select></label><button type="button" data-theme-add>＋ Ajouter une variation</button>
 <p>Les couleurs spécifiques par sport, autographe, patch, tirage ou organisme restent accessibles dans « Étiquettes », « Style des badges » et « Organismes de grading ».</p>
 <ol>${draft.rules.map((r,i)=>`<li><button type="button" data-theme-select="${i}">${r.enabled?'●':'○'} ${esc(r.name)}</button></li>`).join('')}</ol></aside>
 <section class="appearance-fields"><h3>${item.base?esc(target.label):'Modifier la variation'}</h3>
 ${item.base?`<label class="appearance-check"><input id="appearanceEnabled" type="checkbox" ${draft.base[item.target]?'checked':''}> Personnaliser cet élément</label>`:`<label>Nom<input id="appearanceName" maxlength="80" value="${esc(item.name)}"></label><label class="appearance-check"><input id="appearanceEnabled" type="checkbox" ${item.enabled?'checked':''}> Variation active</label><label>Élément<select id="appearanceTarget">${Object.entries(TARGETS).filter(([,t])=>t.card).map(([key,t])=>`<option value="${key}">${esc(t.label)}</option>`).join('')}</select></label><label>Condition<select id="appearanceWhen">${Object.entries(CONDITIONS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Où appliquer<select id="appearanceScope">${Object.entries(SCOPES).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>`}
 <fieldset ${item.base&&!draft.base[item.target]?'disabled':''}><legend>Couleurs et finition</legend><label>Finition<select id="appearanceEffect"><option value="solid">Couleur unie</option><option value="gradient">Dégradé</option><option value="foil">Foil premium</option></select></label><div class="appearance-colors">${[['color','Texte uni'],['start','Couleur principale'],['end','Seconde couleur'],['middle','Troisième couleur'],['border','Bordure']].map(([key,label])=>`<label>${label}<input type="color" data-theme-color="${key}" value="${item.style[key]||fallback[key]}"><input aria-label="${label} en HEX" data-theme-hex="${key}" value="${item.style[key]||fallback[key]}" pattern="#[a-fA-F0-9]{6}" maxlength="7"><span><button type="button" data-theme-copy="${key}">Copier HEX</button><button type="button" data-theme-favorite="${key}" aria-label="Ajouter aux favoris">☆</button></span></label>`).join('')}</div><label class="appearance-check"><input type="checkbox" id="appearanceThird" ${item.style.third?'checked':''}> Utiliser trois couleurs</label><label>Orientation du dégradé <input type="range" data-theme-number="angle" min="0" max="360" value="${item.style.angle??125}"><output>${item.style.angle??125}°</output></label><label>Intensité du foil<input type="range" data-theme-number="intensity" min="0" max="100" value="${item.style.intensity??50}"><output>${item.style.intensity??50} %</output></label>${item.target==='tile'?`<label>Épaisseur de bordure<input type="range" data-theme-number="borderWidth" min="0" max="6" step="0.5" value="${item.style.borderWidth??2}"><output>${item.style.borderWidth??2} px</output></label>`:''}<div class="appearance-favorites"><p>Couleurs favorites · choisir un champ puis une couleur</p><select id="favoriteTarget">${['color','start','end','middle','border'].map(k=>`<option value="${k}">${({color:'Texte',start:'Principale',end:'Seconde',middle:'Troisième',border:'Bordure'})[k]}</option>`).join('')}</select>${(draft.favorites||[]).map(c=>`<span><button type="button" data-theme-use="${c}" style="border-bottom:6px solid ${c}">${c}</button><button type="button" data-theme-unfavorite="${c}" aria-label="Retirer ${c}">×</button></span>`).join('')}</div><p>${target.text?'Pour un titre uni, utilise « Texte uni ». En dégradé ou foil, les deux couleurs remplissent les lettres.':'La couleur principale remplit le fond ; la seconde intervient en dégradé ou foil.'}</p></fieldset>
 ${item.base?'<button type="button" data-theme-original>Rétablir cet élément</button>':'<div class="appearance-rule-actions"><button type="button" data-theme-move="-1">↑ Priorité plus basse</button><button type="button" data-theme-move="1">↓ Priorité plus haute</button><button type="button" data-theme-delete>Supprimer cette variation</button></div>'}
 </section></div>
 <section class="appearance-preview"><h3>Comparer les thèmes</h3><p>Mêmes exemples pour le thème enregistré et le brouillon. Aucune carte réelle n’est modifiée.</p><div class="appearance-comparison"><section><h3>Actuel</h3><iframe title="Thème actuel" id="appearanceCurrent" sandbox="allow-same-origin"></iframe></section><section><h3>Nouveau</h3><iframe title="Nouveau thème" id="appearanceNext" sandbox="allow-same-origin"></iframe></section></div></section>
 <footer><span role="status" data-theme-state>${dirty?'Aperçu temporaire · non enregistré':'Aucun changement'}</span><button type="button" data-theme-reset>Couleurs d’origine</button><button type="button" data-theme-close>Annuler</button><button type="button" data-theme-save>Enregistrer</button></footer>`;
 dialog.querySelector('#appearanceSelection').value=selection;dialog.querySelector('#appearanceEffect').value=item.style.effect;
 renderComparison();
 if(!item.base){for(const [id,key] of [['appearanceTarget','target'],['appearanceWhen','when'],['appearanceScope','scope']])dialog.querySelector('#'+id).value=item[key];}
}
function renderComparison(){if(!dialog)return;const body='<div id="cardGrid">'+sample('OWN · Rookie','own',true,false)+sample('Wishlist · Légendaire','wishlist',false,true)+'</div><div class="rainbow-versions-dialog"><h3>Rainbow</h3>'+sample('OWN','own',true,false)+sample('Wishlist','wishlist',false,true)+'</div>';const base='body{margin:10px;font:13px Poppins,sans-serif;color:#284e69;background:#f3f6f9}.appearance-sample{position:relative;padding:14px;margin:12px 0;border:2px solid #adc9cb;border-radius:16px;background:linear-gradient(125deg,#edf2f9,#fff)}.appearance-sample h4{font-size:19px;margin:8px 0}.appearance-sample-badges{display:flex;gap:6px;flex-wrap:wrap}.appearance-sample-badges>span,.tag{padding:5px;border:1px solid #cad8e0;border-radius:6px}.card-season{background:#e1eaf4}[data-appearance-legendary="true"] .card-season{background:linear-gradient(125deg,#f8e9aa,#e8d6ee)}.appearance-sample::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:var(--appearance-edge-width,0px);pointer-events:none;background:linear-gradient(128deg,#77cdb7,#294fa0,#db7e69,#283439,#ecf3f8,#558ad9,#77cdb7);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude}.rainbow-versions-dialog [data-appearance-status="own"]{background:linear-gradient(125deg,#b9e6cb,#e9fff1)}.rainbow-versions-dialog [data-appearance-status="wishlist"]{background:linear-gradient(125deg,#d3bce9,#f5edff)}';for(const [id,value] of [['appearanceCurrent',bridge.load()],['appearanceNext',restoring?null:dirty?draft:bridge.load()]]){const frame=dialog.querySelector('#'+id);if(frame)frame.srcdoc='<html><head><style>'+base+(value?compile(value):'')+'</style></head><body>'+body+'</body></html>';}}
function sample(label,status,rookie,legendary){return `<article class="card-item appearance-sample" data-appearance-card data-appearance-status="${status}" data-appearance-rookie="${rookie}" data-appearance-legendary="${legendary}" data-appearance-numbered="true"><small>${label}</small><h4 class="player-primary-name">Tyrese Maxey</h4><span class="card-ref-inline">#41</span><p><span class="tag">Topps Chrome</span></p><div class="appearance-sample-badges"><span class="sport-chip">Basketball</span><span class="collector-badge--number">12 / 99</span><span class="card-season">2025/2026</span></div></article>`;}
function open(){if(!bridge.canEdit())return bridge.notify('Modification réservée à l’administrateur.');
 if(!dialog){dialog=document.getElementById('appearanceSettingsPanel');if(!dialog)return;dialog.addEventListener('click',onClick);dialog.addEventListener('change',onChange);dialog.addEventListener('input',onInput);}
 if(!draft){draft=clean(bridge.load());dirty=false;restoring=false;selection='base:athlete';}
 render();if(dirty)apply(restoring?null:draft);
}
function leave(){apply(bridge.load());}
function close(){draft=null;refresh();open();}
function discard(){draft=null;refresh();}
function onInput(event){if(!draft)return;const item=selected();const numeric=event.target.dataset.themeNumber;if(numeric){const value=Number(event.target.value),s=cleanStyle({...item.style,[numeric]:value});if(item.base)draft.base[item.target]=s;else item.style=s;event.target.nextElementSibling.textContent=value+(numeric==='angle'?'°':numeric==='intensity'?' %':' px');preview();return;}if(event.target.id==='appearanceName'){item.name=event.target.value;dirty=true;return;}const key=event.target.dataset.themeColor||event.target.dataset.themeHex;if(!key)return;const value=event.target.value;if(!/^#[a-f0-9]{6}$/i.test(value)){event.target.setCustomValidity('Saisis un code HEX de 6 chiffres précédé de #.');event.target.setAttribute('aria-invalid','true');return;}event.target.setCustomValidity('');event.target.removeAttribute('aria-invalid');for(const input of dialog.querySelectorAll('[data-theme-color="'+key+'"],[data-theme-hex="'+key+'"]'))input.value=value;const s={...item.style,[key]:value};if(item.base)draft.base[item.target]=s;else item.style=s;preview();}
function onChange(event){const id=event.target.id,item=selected();if(id==='appearanceSelection'){selection=event.target.value;render();return;}
 if(id==='appearanceThird'){const s={...item.style,third:event.target.checked};if(item.base)draft.base[item.target]=s;else item.style=s;preview();return;}
 if(id==='appearanceEnabled'){if(item.base){if(event.target.checked)draft.base[item.target]={...fallback};else delete draft.base[item.target];}else item.enabled=event.target.checked;preview();render();return;}
 if(id==='appearanceEffect'){if(item.base)draft.base[item.target]={...item.style,effect:event.target.value};else item.style.effect=event.target.value;preview();return;}
 for(const [field,key] of [['appearanceTarget','target'],['appearanceWhen','when'],['appearanceScope','scope']])if(id===field){item[key]=event.target.value;preview();render();}
}
async function onClick(event){const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-theme-copy')){try{await navigator.clipboard.writeText(selected().style[button.dataset.themeCopy]);button.textContent='✓';setTimeout(()=>button.textContent='Copier HEX',1200);}catch(_){bridge.notify('Copie indisponible : sélectionne le code HEX.');}return;}
 if(button.hasAttribute('data-theme-favorite')){draft.favorites=[...new Set([...(draft.favorites||[]),selected().style[button.dataset.themeFavorite].toLowerCase()])].slice(0,24);dirty=true;render();return;}
 if(button.hasAttribute('data-theme-unfavorite')){draft.favorites=(draft.favorites||[]).filter(c=>c!==button.dataset.themeUnfavorite);dirty=true;render();return;}
 if(button.hasAttribute('data-theme-use')){const input=dialog.querySelector('[data-theme-color="'+dialog.querySelector('#favoriteTarget').value+'"]');input.value=button.dataset.themeUse;input.dispatchEvent(new Event('input',{bubbles:true}));return;}
 if(button.hasAttribute('data-theme-close'))return close();
 if(button.hasAttribute('data-theme-select')){selection='rule:'+button.dataset.themeSelect;render();return;}
 if(button.hasAttribute('data-theme-add')){if(draft.rules.length>=80)return bridge.notify('Maximum de 80 variations.');draft.rules.push({id:'new-'+Date.now(),name:'Nouvelle variation',target:'athlete',scope:'all',when:'rookie',enabled:true,style:{...fallback,effect:'solid',color:'#247a55'}});selection='rule:'+(draft.rules.length-1);preview();render();return;}
 if(button.hasAttribute('data-theme-original')){delete draft.base[selected().target];preview();render();return;}
 if(button.hasAttribute('data-theme-delete')){draft.rules.splice(Number(selection.slice(5)),1);selection='base:tile';preview();render();return;}
 if(button.hasAttribute('data-theme-move')){const index=Number(selection.slice(5)),next=index+Number(button.dataset.themeMove);if(next>=0&&next<draft.rules.length){[draft.rules[index],draft.rules[next]]=[draft.rules[next],draft.rules[index]];selection='rule:'+next;preview();render();}return;}
 if(button.hasAttribute('data-theme-reset')){draft=defaults();selection='base:athlete';restoring=true;dirty=true;apply(null);render();return;}
 if(button.hasAttribute('data-theme-save')){if(!dialog.reportValidity?.()&&dialog.querySelector('[aria-invalid="true"]'))return bridge.notify('Corrige le code HEX avant de sauvegarder.');button.disabled=true;try{await bridge.save(restoring?null:clean(draft));draft=null;refresh();open();dialog.querySelector('[data-theme-state]').textContent='Modifications enregistrées ✓';bridge.notify('Couleurs et variations enregistrées ✓');}catch(error){bridge.notify(error.message||'Enregistrement impossible.');button.disabled=false;}}
}
document.getElementById('logoDialog')?.addEventListener('close',discard);
document.getElementById('logoDialog')?.addEventListener('cancel',discard);
})(typeof window==='undefined'?globalThis:window);
