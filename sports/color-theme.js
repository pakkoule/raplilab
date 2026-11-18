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
const CONDITIONS={always:'Toutes les cartes',rookie:'Rookie',own:'OWN',wishlist:'Wishlist',legendary:'Légendaire',oneofone:'Numérotation 1/1',dream:'Dans mes rêves',graded:'Gradée',numbered:'Numérotée'};
const SCOPES={all:'Partout',catalogue:'Catalogue uniquement',rainbow:'Fenêtre des versions Rainbow'};
const fallback={color:'#284e69',start:'#edf2f9',end:'#f8fafc',border:'#a9cfcb',effect:'foil'};
const style=(start,end,border,color='#284e69')=>({...fallback,start,end,border,color});
function defaults(){return {schema:1,base:{},rules:[
 {id:'oneofone',name:'Carte 1/1 dorée',target:'tile',scope:'all',when:'oneofone',enabled:true,style:style('#f8efda','#fffaf0','#c6a765')},
 {id:'legendary',name:'Saison légendaire dorée',target:'season',scope:'all',when:'legendary',enabled:true,style:style('#f8e9aa','#e8d6ee','#c7a560','#70521b')},
 {id:'rainbow-own',name:'Rainbow · OWN vert',target:'tile',scope:'rainbow',when:'own',enabled:true,style:style('#b9e6cb','#e9fff1','#74b997')},
 {id:'rainbow-wish',name:'Rainbow · Wishlist violet',target:'tile',scope:'rainbow',when:'wishlist',enabled:true,style:style('#d3bce9','#f5edff','#ad8acb')}
]};}
function cleanStyle(value={}){const result={};for(const key of ['color','start','end','border'])result[key]=/^#[a-f0-9]{6}$/i.test(value[key]||'')?value[key]:fallback[key];result.effect=['solid','gradient','foil'].includes(value.effect)?value.effect:'foil';return result;}
function clean(value){
 if(!value||value.schema!==1)return defaults();
 const base={};for(const key of Object.keys(TARGETS))if(value.base?.[key])base[key]=cleanStyle(value.base[key]);
 const rules=(Array.isArray(value.rules)?value.rules:[]).slice(0,80).filter(r=>r&&TARGETS[r.target]?.card&&Object.hasOwn(CONDITIONS,r.when)&&Object.hasOwn(SCOPES,r.scope)).map((r,i)=>({id:'rule-'+i,name:String(r.name||'Variation').slice(0,80),target:r.target,scope:r.scope,when:r.when,enabled:r.enabled!==false,style:cleanStyle(r.style)}));
 return {schema:1,base,rules};
}
function background(s){return s.effect==='solid'?s.start:s.effect==='gradient'?`linear-gradient(125deg,${s.start},${s.end})`:`linear-gradient(112deg,transparent 12%,#ffffff80 34%,transparent 58%,#ffffff40 80%),linear-gradient(135deg,${s.start},${s.end} 55%,${s.start})`;}
function declarations(target,s){
 if(target.text)return s.effect==='solid'?`background:none!important;color:${s.color}!important;-webkit-text-fill-color:${s.color}!important;text-shadow:none!important;`:`background:${background(s)}!important;background-clip:text!important;-webkit-background-clip:text!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;`;
 return `background:${background(s)}!important;color:${s.color}!important;border-color:${s.border}!important;--collector-ink:${s.color};`;
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
  node.dataset.appearanceCard='';node.dataset.appearanceStatus=card.status;
  for(const key of ['rookie','legendary','dream','graded','numbered'])node.dataset['appearance'+key[0].toUpperCase()+key.slice(1)]=String(card[key]===true);
  node.dataset.appearanceOneofone=String(card.numbered&&Number(card.printRun)===1);
 }
}
function apply(value){sheet.textContent=value?compile(value):'';annotate();}
function refresh(){if(!draft)apply(bridge.load());}
root.RapliAppearance={refresh,open,leave};refresh();
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node!==sheet)annotate(node);}).observe(document.body,{childList:true,subtree:true});
function preview(){restoring=false;apply(draft);dirty=true;dialog.querySelector('[data-theme-state]').textContent='Aperçu temporaire · non enregistré';}
function selected(){if(selection.startsWith('base:')){const target=selection.slice(5);return {base:true,target,style:draft.base[target]||fallback};}return draft.rules[Number(selection.slice(5))];}
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
 <fieldset ${item.base&&!draft.base[item.target]?'disabled':''}><legend>Couleurs et finition</legend><label>Finition<select id="appearanceEffect"><option value="solid">Couleur unie</option><option value="gradient">Dégradé</option><option value="foil">Foil premium</option></select></label><div class="appearance-colors">${[['color','Texte uni'],['start','Couleur principale'],['end','Seconde couleur'],['border','Bordure']].map(([key,label])=>`<label>${label}<input type="color" data-theme-color="${key}" value="${item.style[key]}"></label>`).join('')}</div><p>${target.text?'Pour un titre uni, utilise « Texte uni ». En dégradé ou foil, les deux couleurs remplissent les lettres.':'La couleur principale remplit le fond ; la seconde intervient en dégradé ou foil.'}</p></fieldset>
 ${item.base?'<button type="button" data-theme-original>Rétablir cet élément</button>':'<div class="appearance-rule-actions"><button type="button" data-theme-move="-1">↑ Priorité plus basse</button><button type="button" data-theme-move="1">↓ Priorité plus haute</button><button type="button" data-theme-delete>Supprimer cette variation</button></div>'}
 </section></div>
 <section class="appearance-preview"><h3>Aperçu des cartes</h3><p>Ces exemples ne sont pas enregistrés dans ta collection.</p><div class="appearance-examples">${sample('OWN · Rookie','own',true,false)}${sample('Wishlist · Légendaire','wishlist',false,true)}</div><div class="rainbow-versions-dialog appearance-rainbow-sample"><h3>Fenêtre Rainbow</h3><div class="appearance-examples">${sample('OWN','own',true,false)}${sample('Wishlist','wishlist',false,true)}</div></div></section>
 <footer><span role="status" data-theme-state>${dirty?'Aperçu temporaire · non enregistré':'Aucun changement'}</span><button type="button" data-theme-reset>Couleurs d’origine</button><button type="button" data-theme-close>Annuler</button><button type="button" data-theme-save>Enregistrer</button></footer>`;
 dialog.querySelector('#appearanceSelection').value=selection;dialog.querySelector('#appearanceEffect').value=item.style.effect;
 if(!item.base){for(const [id,key] of [['appearanceTarget','target'],['appearanceWhen','when'],['appearanceScope','scope']])dialog.querySelector('#'+id).value=item[key];}
}
function sample(label,status,rookie,legendary){return `<article class="card-item appearance-sample" data-appearance-card data-appearance-status="${status}" data-appearance-rookie="${rookie}" data-appearance-legendary="${legendary}" data-appearance-numbered="true"><small>${label}</small><h4 class="player-primary-name">Tyrese Maxey</h4><span class="card-ref-inline">#41</span><p><span class="tag">Topps Chrome</span></p><div class="appearance-sample-badges"><span class="sport-chip">Basketball</span><span class="collector-badge--number">12 / 99</span><span class="card-season">2025/2026</span></div></article>`;}
function open(){if(!bridge.canEdit())return bridge.notify('Modification réservée à l’administrateur.');
 if(!dialog){dialog=document.getElementById('appearanceSettingsPanel');if(!dialog)return;dialog.addEventListener('click',onClick);dialog.addEventListener('change',onChange);dialog.addEventListener('input',onInput);}
 if(!draft){draft=clean(bridge.load());dirty=false;restoring=false;selection='base:athlete';}
 render();if(dirty)apply(restoring?null:draft);
}
function leave(){apply(bridge.load());}
function close(){draft=null;refresh();open();}
function discard(){draft=null;refresh();}
function onInput(event){if(!draft)return;const item=selected();if(event.target.id==='appearanceName'){item.name=event.target.value;dirty=true;return;}const key=event.target.dataset.themeColor;if(!key)return;const value=event.target.value;if(!/^#[a-f0-9]{6}$/i.test(value))return;const s={...item.style,[key]:value};if(item.base)draft.base[item.target]=s;else item.style=s;preview();}
function onChange(event){const id=event.target.id,item=selected();if(id==='appearanceSelection'){selection=event.target.value;render();return;}
 if(id==='appearanceEnabled'){if(item.base){if(event.target.checked)draft.base[item.target]={...fallback};else delete draft.base[item.target];}else item.enabled=event.target.checked;preview();render();return;}
 if(id==='appearanceEffect'){if(item.base)draft.base[item.target]={...item.style,effect:event.target.value};else item.style.effect=event.target.value;preview();return;}
 for(const [field,key] of [['appearanceTarget','target'],['appearanceWhen','when'],['appearanceScope','scope']])if(id===field){item[key]=event.target.value;preview();render();}
}
async function onClick(event){const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-theme-close'))return close();
 if(button.hasAttribute('data-theme-select')){selection='rule:'+button.dataset.themeSelect;render();return;}
 if(button.hasAttribute('data-theme-add')){if(draft.rules.length>=80)return bridge.notify('Maximum de 80 variations.');draft.rules.push({id:'new-'+Date.now(),name:'Nouvelle variation',target:'athlete',scope:'all',when:'rookie',enabled:true,style:{...fallback,effect:'solid',color:'#247a55'}});selection='rule:'+(draft.rules.length-1);preview();render();return;}
 if(button.hasAttribute('data-theme-original')){delete draft.base[selected().target];preview();render();return;}
 if(button.hasAttribute('data-theme-delete')){draft.rules.splice(Number(selection.slice(5)),1);selection='base:tile';preview();render();return;}
 if(button.hasAttribute('data-theme-move')){const index=Number(selection.slice(5)),next=index+Number(button.dataset.themeMove);if(next>=0&&next<draft.rules.length){[draft.rules[index],draft.rules[next]]=[draft.rules[next],draft.rules[index]];selection='rule:'+next;preview();render();}return;}
 if(button.hasAttribute('data-theme-reset')){draft=defaults();selection='base:athlete';restoring=true;dirty=true;apply(null);render();return;}
 if(button.hasAttribute('data-theme-save')){button.disabled=true;try{await bridge.save(restoring?null:clean(draft));draft=null;refresh();open();dialog.querySelector('[data-theme-state]').textContent='Modifications enregistrées ✓';bridge.notify('Couleurs et variations enregistrées ✓');}catch(error){bridge.notify(error.message||'Enregistrement impossible.');button.disabled=false;}}
}
document.getElementById('logoDialog')?.addEventListener('close',discard);
document.getElementById('logoDialog')?.addEventListener('cancel',discard);
})(typeof window==='undefined'?globalThis:window);
