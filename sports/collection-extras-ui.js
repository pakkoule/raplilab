(function(){'use strict';
const B=window.RapliExtrasBridge,E=window.RapliExtras;if(!B||!E)return;
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID(),notify=B.notify;let gradePhoto='',photoBusy=false,editGeneration=0;
function element(tag,html,cls=''){const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;}
function modal(title){const d=element('dialog','<header><h2>'+esc(title)+'</h2><button type="button" aria-label="Fermer">×</button></header><div class="extras-content"></div>','modal extras-dialog');d.querySelector('button').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d)d.close();});d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();return d;}
const extraFields=element('section',`<div class="extras-fields-heading"><span>OPTIONS DE COLLECTION</span><h3>Suivi & certification</h3></div><div class="extras-fields-grid"><div id="wishStageWrap" class="input-group"><label for="wishStage">Suivi Wishlist</label><select class="select" id="wishStage"><option value="">Aucun</option><option value="ordered">Commandée</option><option value="shipping">En attente de livraison</option></select></div><div id="uniqueKindWrap" class="input-group"><label for="uniqueKind">Classification des cartes 1/1</label><select class="select" id="uniqueKind"><option value="">À vérifier / non applicable</option><option value="oneofone">Véritable One of One</option><option value="plate">Printing Plate</option></select></div><div id="plateColorWrap" class="input-group" hidden><label for="plateColor">Couleur de plaque (facultative)</label><select class="select" id="plateColor"><option value="">Non précisée</option>${['Cyan','Magenta','Yellow','Black'].map(v=>'<option>'+v+'</option>').join('')}</select></div><div id="gradePhotoWrap" class="input-group" hidden><label for="gradePhotoFile">Photo du bandeau de grading</label><input class="input" type="file" id="gradePhotoFile" accept="image/png,image/jpeg,image/webp"><img id="gradePhotoPreview" alt="Bandeau de certification" hidden><button type="button" class="button button-ghost button-slim" id="gradePhotoRemove">Retirer le bandeau</button></div></div><small class="extras-fields-note">Les anciennes 1/1 conservent leur numéro et leur place dans les Rainbows.</small>`,'extras-fields extras-card-fields');
$('cardForm').querySelector('.form-fields').append(extraFields);
function syncFields(){
 const wish=$('statusWish').checked,one=$('cardNumbered').checked&&Number($('cardPrintRun').value)===1;
 const plate=one&&$('uniqueKind').value==='plate';
 $('wishStageWrap').hidden=!wish;
 $('uniqueKindWrap').hidden=!one;
 $('plateColorWrap').hidden=!plate;
 $('gradePhotoWrap').hidden=!$('cardGraded').checked;
 $('wishStage').disabled=!wish;
 $('uniqueKind').disabled=!one;
 $('plateColor').disabled=!plate;
}
for(const id of ['statusWish','statusOwn','cardNumbered','cardPrintRun','uniqueKind','cardGraded']){
 $(id).addEventListener('change',syncFields);
 if(id==='cardPrintRun')$(id).addEventListener('input',syncFields);
}
function paintPhoto(){const valid=/^(data:image\/|https?:\/\/)/.test(gradePhoto);$('gradePhotoPreview').hidden=!valid;if(valid)$('gradePhotoPreview').src=gradePhoto;else $('gradePhotoPreview').removeAttribute('src');}
$('gradePhotoFile').onchange=async()=>{const file=$('gradePhotoFile').files[0];if(!file)return;const generation=editGeneration;photoBusy=true;$('cardSubmitBtn').disabled=true;try{const photo=await B.readPhoto(file,1500,.86,'card');if(generation===editGeneration){gradePhoto=photo;paintPhoto();}}catch(e){notify(e.message);}finally{if(generation===editGeneration){photoBusy=false;$('cardSubmitBtn').disabled=false;}}};
$('gradePhotoRemove').onclick=()=>{gradePhoto='';paintPhoto();};
function editCard(c={}){editGeneration++;photoBusy=false;$('cardSubmitBtn').disabled=false;gradePhoto=c?.gradePhoto||'';$('wishStage').value=c?.wishStage||'';$('uniqueKind').value=c?.uniqueKind||'';$('plateColor').value=c?.plateColor||'';$('gradePhotoFile').value='';paintPhoto();syncFields();}
function cardFields(){if(photoBusy)throw Error('La photo est encore en cours de préparation.');return {wishStage:$('statusWish').checked?$('wishStage').value:'',uniqueKind:$('uniqueKind').disabled?'':$('uniqueKind').value,plateColor:$('plateColor').disabled?'':$('plateColor').value,gradePhoto};}
function showGrade(id){const c=B.cards().find(c=>c.id===id);if(!c?.gradePhoto)return;const d=modal('Bandeau de certification');const img=document.createElement('img');img.src=c.gradePhoto;img.alt='Certification '+(c.gradeOrg||'');img.className='extras-grade-zoom';img.onclick=()=>d.close();d.querySelector('.extras-content').append(img);}
document.addEventListener('click',e=>{const grade=e.target.closest('[data-grade-photo]');if(grade){e.preventDefault();e.stopPropagation();showGrade(grade.dataset.gradePhoto);}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){e.preventDefault();$('filterSearch').focus();$('filterSearch').select();}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-grade-photo]')){e.preventDefault();showGrade(e.target.dataset.gradePhoto);}});
// Local search suggestions; no requests per keystroke.
const search=$('filterSearch'),suggestions=element('div','','extras-suggestions');suggestions.id='athleteSuggestions';suggestions.setAttribute('role','listbox');suggestions.hidden=true;search.parentElement.append(suggestions);search.setAttribute('role','combobox');search.setAttribute('aria-controls',suggestions.id);search.setAttribute('aria-expanded','false');search.setAttribute('autocomplete','off');
const clear=element('button','×','extras-search-clear');clear.type='button';clear.setAttribute('aria-label','Effacer la recherche');search.parentElement.append(clear);clear.hidden=!E.norm(search.value);clear.onclick=()=>{search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();};let selected=-1;
function suggestionList(){const q=E.norm(search.value);const names=B.players().filter(n=>q&&E.norm(n).includes(q)).slice(0,8);suggestions.innerHTML=names.map((n,i)=>`<button type="button" role="option" id="athleteSuggestion${i}" aria-selected="false">${esc(n)}</button>`).join('');selected=-1;suggestions.hidden=!names.length;search.setAttribute('aria-expanded',String(!!names.length));clear.hidden=!q;}
function hideSuggestions(){suggestions.hidden=true;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');}
search.addEventListener('input',suggestionList);search.addEventListener('focus',suggestionList);search.addEventListener('blur',()=>setTimeout(hideSuggestions,150));
suggestions.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;search.value=b.textContent;search.dispatchEvent(new Event('input',{bubbles:true}));hideSuggestions();});
search.addEventListener('keydown',e=>{const list=[...suggestions.children];if(e.key==='Escape'){hideSuggestions();return;}if(suggestions.hidden||!list.length)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();selected=(selected+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;list.forEach((b,i)=>b.setAttribute('aria-selected',String(i===selected)));search.setAttribute('aria-activedescendant',list[selected].id);}if(e.key==='Enter'&&selected>=0){e.preventDefault();list[selected].click();}});
let counts=new Map(),cardIndex=new Map(),lastCards=null;
function refresh(){
 const cards=B.cards();
 if(cards!==lastCards){
  counts=new Map();cardIndex=new Map(cards.map(c=>[c.id,c]));
  for(const c of cards){if(c.status!=='own')continue;const k=E.identity(c);counts.set(k,(counts.get(k)||0)+1);}
  lastCards=cards;
 }
 // The verified account controls visibility; transient cloud hydration can only block writes.
 // B.canEdit() is false while Supabase loads photos and may not trigger a final refresh.
 const editor=window.RapliAdminAccess?.isEditor?.()===true;
 historyButton.hidden=!editor;
}
function decorate(container=document){if(!$('emptyState').classList.contains('hidden')&&search.value.trim()){const words=E.norm(search.value).split(/\s+/).filter(Boolean);const related=B.players().filter(n=>words.some(w=>E.norm(n).includes(w))).slice(0,3);$('emptyCopy').textContent=related.length?'Essaie seulement : '+related.join(' · ')+', ou retire le numéro de série.':'Essaie un nom d’athlète, une marque ou un tirage comme /25. La croix efface la recherche.';}for(const tile of container.querySelectorAll('[data-card-id]')){const c=cardIndex.get(tile.dataset.cardId);if(!c)continue;let badges=tile.querySelector('.extras-mini-badges');const labels=[];const count=counts.get(E.identity(c))||0;
 if(c.status==='own'&&count>1)labels.push('<span>×'+esc(count)+' exemplaires</span>');
 if(c.status==='wishlist'&&['ordered','shipping'].includes(c.wishStage))
  labels.push(B.labelBadge('wishlist:'+c.wishStage));
 /* Printing Plate is displayed within the 1/1 collector badge. */
 if(E.classification(c)==='review')labels.push('<span>1/1 · à vérifier</span>');
 if(!labels.length){if(badges)badges.remove();continue;}
 if(!badges){badges=element('div','','extras-mini-badges');(tile.querySelector('.card-status-badges')||tile).append(badges);}
 const html=labels.join('');if(badges.innerHTML!==html)badges.innerHTML=html;}}
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe($('cardGrid'),{childList:true,subtree:true});
// Historical variants stay inside the original logo record.
const historyButton=element('button','Logos historiques','logo-tab');
historyButton.type='button';
historyButton.dataset.historyOpen='';
historyButton.title='Gérer les logos d’équipes et de compétitions selon les saisons';
// Keep the historical editor next to "Équipes", not at the end of a long mobile tab list.
$('logoDialog').querySelector('.logo-tab[data-logo-type="team"]').after(historyButton);
// Historical logos share the original logo dialog and its complete tab navigation.
const logoDialog=$('logoDialog');
function exitHistoricalTab(){
 logoDialog.removeAttribute('data-rapli-history-mode');
 logoDialog.querySelector('#historyInlinePanel')?.remove();
}
logoDialog.querySelector('.logo-tabs').addEventListener('click',event=>{
 if(!event.target.closest('[data-history-open]'))exitHistoricalTab();
},true);
logoDialog.addEventListener('close',exitHistoricalTab);
historyButton.onclick=()=>{
 if(window.RapliAdminAccess?.isEditor?.()!==true)return;
 exitHistoricalTab();
 logoDialog.dataset.rapliHistoryMode='true';
 logoDialog.querySelectorAll('.logo-tabs .logo-tab').forEach(button=>
  button.classList.toggle('active',button===historyButton));
 const d=logoDialog;
 const content=element('section','','extras-content historical-inline-panel');
 content.id='historyInlinePanel';
 d.querySelector('.logo-tabs').after(content);
 const $=id=>content.querySelector('#'+id);
 let editing='',image='';
const choices=()=>B.logos().filter(l=>l.type==='team'||(l.type==='tag'&&B.tagCategories(l.name).includes('competition')));
content.innerHTML=`<label>Équipe ou compétition<select id="historyLogo">${choices().map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select></label><p>Les logos historiques s'appliquent automatiquement selon la saison. Les logos alternatifs ne s'affichent que lorsqu'ils sont choisis manuellement sur une carte.</p><div id="historyList"></div><div class="extras-fields"><label>Type de logo<select id="historyKind" class="select"><option value="historical">Logo historique · selon la saison</option><option value="alternative">Logo alternatif · sélection manuelle</option></select></label><div id="historyDateFields"><label>Début (année ou saison)<input id="historyFrom" placeholder="1997 ou 1997/1998"></label><label>Fin (facultative)<input id="historyTo" placeholder="2000 ou 2000/2001"></label></div><label id="historyNameWrap" hidden>Nom du logo alternatif<input id="historyName" maxlength="80" placeholder="Ex. City Edition, maillot rétro…"></label><p id="historyKindHint" class="historical-kind-hint"></p><label>Image du logo<input type="file" id="historyFile" accept="image/png,image/jpeg,image/webp"></label><img id="historyPreview" alt="Aperçu" hidden><button type="button" id="historySave">Enregistrer la variante</button><button type="button" id="historyCancel">Nouvelle variante</button></div>`;
const record=()=>B.logos().find(l=>l.id===$('historyLogo').value);
function syncKind(){
 const alt=$('historyKind').value==='alternative';
 $('historyDateFields').hidden=alt;
 $('historyNameWrap').hidden=!alt;
 $('historyKindHint').textContent=alt?
   'Aucune période : sélectionne ce logo manuellement depuis la fiche d’une carte.':
   'Une période est obligatoire et le logo correspondant s’applique automatiquement aux cartes.';
}
$('historyKind').addEventListener('change',syncKind);
function reset(){
 editing='';image='';$('historyKind').value='historical';$('historyName').value='';
 $('historyFrom').value='';$('historyTo').value='';$('historyFile').value='';
 $('historyPreview').hidden=true;$('historyPreview').removeAttribute('src');
 syncKind();
}
function variantLabel(v){return v.kind==='alternative'?
 'ALTERNATIF · '+String(v.name||'Logo alternatif'):
 'HISTORIQUE · '+String(v.from||'')+' — '+String(v.to||v.from||'');}
function render(){
 const l=record();
 $('historyList').innerHTML=(l?.historical||[]).map(v=>
  `<div class="history-row"><img src="${esc(v.image)}" alt="${esc(l.name)}"><span>${esc(variantLabel(v))}</span><button type="button" data-history-edit="${esc(v.id)}">Modifier</button><button type="button" data-history-delete="${esc(v.id)}">Supprimer</button></div>`
 ).join('');
}
$('historyLogo').onchange=()=>{reset();render();};$('historyCancel').onclick=reset;
$('historyFile').onchange=async()=>{const file=$('historyFile').__rapliHistoricalImportFile||$('historyFile').files[0];if(!file)return;$('historySave').disabled=true;try{image=await B.readPhoto(file,1000,.9,'logo');$('historyPreview').src=image;$('historyPreview').hidden=false;}catch(e){notify(e.message);}finally{$('historySave').disabled=false;}};
$('historySave').onclick=async()=>{if(!B.canEdit())return notify('Synchronisation en cours : la modification des logos est temporairement indisponible.');const l=record();if(!l)return notify('Ajoute d’abord le logo principal dans la bibliothèque.');const alt=$('historyKind').value==='alternative';
const v={id:editing||uid(),kind:alt?'alternative':'historical',
 from:alt?'':$('historyFrom').value.trim(),
 to:alt?'':$('historyTo').value.trim(),
 name:alt?$('historyName').value.trim().slice(0,80):'',image};
if(!image)return notify('Choisis une image pour le logo.');
if(alt&&!v.name)return notify('Donne un nom au logo alternatif pour pouvoir le retrouver.');
if(!E.validatePeriod(l.historical,v))
 return notify('Vérifie les années / saisons : aucune période historique ne doit se chevaucher.');try{await B.saveLogo({...l,historical:[...(l.historical||[]).filter(x=>x.id!==v.id),v],updatedAt:Date.now()});reset();render();B.render();}catch(e){notify(e.message);}};
content.onclick=async e=>{const edit=e.target.dataset.historyEdit,del=e.target.dataset.historyDelete;if(del&&!B.canEdit())return notify('Synchronisation en cours : la suppression des logos est temporairement indisponible.');if(edit){const v=record().historical.find(v=>v.id===edit);editing=v.id;image=v.image;$('historyKind').value=v.kind==='alternative'?'alternative':'historical';
$('historyName').value=v.name||'';$('historyFrom').value=v.from||'';$('historyTo').value=v.to||'';
syncKind();$('historyPreview').src=image;$('historyPreview').hidden=false;}if(del){try{await B.saveLogo({...record(),historical:record().historical.filter(v=>v.id!==del),updatedAt:Date.now()});render();B.render();}catch(err){notify(err.message);}}};render();syncKind();};

// RAPLI HISTORY IMAGE LIBRARY — visually browse saved variants and select source images.
// External files are previewed only; the existing historySave button controls all writes.
historyButton.addEventListener('click',()=>{
 const d=$('logoDialog'),panel=d.querySelector('#historyInlinePanel');
 if(!panel||d.dataset.rapliHistoryMode!=='true')return;
 const get=id=>panel.querySelector('#'+id),select=get('historyLogo'),saved=get('historyList');
 let inFlight=false,searchSerial=0;
 const known=new Map();
 const presets=[
  {id:'featured:1977',team:'Philadelphia 76ers',title:'76ers · logo classique 1977–1997',
   file:'Philadelphia-76ers-Logo-1977-1996.png',from:'1977/1978',to:'1996/1997'},
  {id:'featured:2009',team:'Philadelphia 76ers',title:'76ers · logo bleu et rouge 2009–2015',
   file:'Philadelphia 76ers Logo.svg',from:'2009/2010',to:'2014/2015'}
 ];
 const sourcePage=file=>'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file);
 const previewPath=file=>'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=330';
 const selected=()=>window.RapliExtrasBridge.logos().find(r=>r.id===select.value);
 const allTeams=()=>window.RapliExtrasBridge.logos().filter(r=>r.type==='team'||(r.type==='tag'&&window.RapliExtrasBridge.tagCategories(r.name).includes('competition')));
 const savedPanel=document.createElement('details');
 savedPanel.className='historical-all-saved';
 savedPanel.innerHTML='<summary id="historyAllSummary">Tous les logos enregistrés</summary><div id="historySavedAll" class="historical-saved-list"></div>';
 saved.after(savedPanel);
 const gallery=document.createElement('section');gallery.className='historical-gallery';
 gallery.innerHTML=
  '<h3>BIBLIOTHÈQUE DE LOGOS</h3>'+
  '<p>Choisis une image parmi les propositions ou explore les archives Wikimedia Commons. Tu pourras l’enregistrer comme logo historique avec une période, ou comme logo alternatif sans saison.</p>'+
  '<div id="historyLibraryFeatured" class="historical-gallery-grid"></div>'+
  '<form id="historyLibraryForm" class="historical-library-search" autocomplete="off">'+
    '<label for="historyLibraryQuery">Chercher des logos (équipe, championnat, époque)</label>'+
    '<div><input type="search" id="historyLibraryQuery" placeholder="Ex. Philadelphia 76ers logo">'+
    '<button id="historyLibraryFetch" type="submit">Rechercher</button></div>'+
  '</form>'+
  '<p id="historyLibraryStatus" class="historical-gallery-status" role="status"></p>'+
  '<div id="historyLibraryResults" class="historical-gallery-grid"></div>'+
  '<small>Sources : Wikimedia Commons. Vérifie la licence et les droits de marque avant réutilisation. Les archives peuvent être incomplètes.</small>';
 const editor=d.querySelector('.extras-fields');
 if(editor)editor.before(gallery);else d.querySelector('.extras-content').append(gallery);
 const grid=get('historyLibraryResults'),featured=get('historyLibraryFeatured'),status=get('historyLibraryStatus');
 function cardMarkup(item){
  known.set(item.id,item);
  return '<article class="historical-library-card">'+
   '<div class="historical-library-picture"><img loading="lazy" decoding="async" src="'+esc(item.preview)+'" alt="'+esc(item.title)+'"></div>'+
   '<strong>'+esc(item.title)+'</strong>'+
   (item.from?'<small>'+esc(item.from)+' — '+esc(item.to||item.from)+'</small>':'')+
   '<div class="historical-library-card-actions">'+
   '<button type="button" data-history-use="'+esc(item.id)+'">Choisir</button>'+
   '<a href="'+esc(item.source)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>'+
   '</div></article>';
 }
 function renderSaved(){
  const variants=allTeams().flatMap(team=>(team.historical||[]).map(v=>({team,v})));
  get('historyAllSummary').textContent='Tous les logos historiques et alternatifs ('+variants.length+')';
  get('historySavedAll').innerHTML=variants.length?variants.map(row=>
   '<button type="button" class="historical-saved-choice" data-history-team="'+esc(row.team.id)+'" data-history-edit-saved="'+esc(row.v.id)+'">'+
   '<img loading="lazy" src="'+esc(row.v.image)+'" alt=""><span>'+esc(row.team.name)+
   '<small>'+(row.v.kind==='alternative'?'ALTERNATIF · '+esc(row.v.name||'Logo alternatif'):
     'HISTORIQUE · '+esc(row.v.from)+' — '+esc(row.v.to||row.v.from))+'</small></span></button>'
  ).join(''):'<p class="historical-gallery-status">Aucune variante enregistrée pour le moment.</p>';
 }
 function renderSelected(){
  searchSerial++;
  known.clear();grid.replaceChildren();
  const team=selected();
  featured.innerHTML=presets.filter(row=>team&&window.RapliExtras.norm(row.team)===window.RapliExtras.norm(team.name))
   .map(row=>cardMarkup({...row,preview:previewPath(row.file),source:sourcePage(row.file)})).join('');
  get('historyLibraryQuery').value=team?team.name+' logo':'';
  status.textContent=team?'Recherche prête pour '+team.name+'.':'Ajoute d’abord un logo principal dans Équipes.';
 }
 select.addEventListener('change',renderSelected);
 new MutationObserver(renderSaved).observe(saved,{childList:true});
 function queryURL(params){return 'https://commons.wikimedia.org/w/api.php?'+new URLSearchParams(params).toString();}
 async function resolveImage(row){
  if(!row.file)return row.download;
  const url=queryURL({action:'query',titles:'File:'+row.file,
   prop:'imageinfo',iiprop:'url|mime',iiurlwidth:'800',format:'json',origin:'*'});
  const response=await fetch(url,{mode:'cors',credentials:'omit'});
  if(!response.ok)throw Error('Source momentanément inaccessible.');
  const data=await response.json();
  const info=Object.values(data.query?.pages||{})[0]?.imageinfo?.[0];
  if(!info)throw Error('Image introuvable.');
  return info.thumburl||info.url;
 }
 async function choose(key){
  if(inFlight)return;
  const row=known.get(key),team=select.value;
  if(!row)return;
  inFlight=true;status.textContent='Préparation du logo…';
  try{
   const url=await resolveImage(row);
   if(!/^https:\/\/upload\.wikimedia\.org\//.test(url))throw Error('Hébergement de fichier non accepté.');
   const response=await fetch(url,{mode:'cors',credentials:'omit'});
   if(!response.ok)throw Error('Impossible de charger le logo.');
   const blob=await response.blob();
   if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>12*1024*1024)
    throw Error('Image non compatible : ouvre la source et récupère son PNG ou WEBP.');
   const file=new File([blob],'historical-logo.'+(blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg'),{type:blob.type});
   if(select.value!==team||d.dataset.rapliHistoryMode!=='true'||!d.querySelector('#historyInlinePanel'))return;
   if(get('historyKind').value!=='alternative'){
    if(row.from)get('historyFrom').value=row.from;
    if(row.to)get('historyTo').value=row.to;
   }else if(!get('historyName').value.trim()){
    get('historyName').value=row.title.slice(0,80);
   }
   const input=get('historyFile');
   input.__rapliHistoricalImportFile=file;
   input.dispatchEvent(new Event('change',{bubbles:true}));
   delete input.__rapliHistoricalImportFile;
   status.textContent=get('historyKind').value==='alternative'?
    'Logo prêt : confirme son nom puis enregistre-le comme alternatif.':
    'Logo sélectionné : vérifie les saisons avant de l’enregistrer.';
  }catch(error){status.textContent='Import indisponible : '+(error.message||'erreur réseau')+'. Le bouton Choisir un fichier reste disponible.';}
  finally{inFlight=false;}
 }
 gallery.addEventListener('click',event=>{
  const button=event.target.closest('[data-history-use]');
  if(button)void choose(button.dataset.historyUse);
 });
 savedPanel.addEventListener('click',event=>{
  const b=event.target.closest('[data-history-team]');if(!b)return;
  select.value=b.dataset.historyTeam;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  const edit=saved.querySelector('[data-history-edit="'+CSS.escape(b.dataset.historyEditSaved)+'"]');
  if(edit)edit.click();
 });
 get('historyLibraryForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const search=get('historyLibraryQuery').value.trim(),team=select.value;
  if(!search){status.textContent='Saisis un nom d’équipe.';return;}
  const serial=++searchSerial,button=get('historyLibraryFetch');
  button.disabled=true;status.textContent='Recherche dans les archives Wikimedia Commons…';
  grid.replaceChildren();
  try{
   const url=queryURL({action:'query',generator:'search',gsrsearch:search,
    gsrnamespace:'6',gsrlimit:'30',prop:'imageinfo',iiprop:'url|mime',
    iiurlwidth:'360',format:'json',origin:'*'});
   const response=await fetch(url,{mode:'cors',credentials:'omit'});
   if(!response.ok)throw Error('Le service ne répond pas.');
   const data=await response.json();
   if(serial!==searchSerial||team!==select.value||d.dataset.rapliHistoryMode!=='true'||!d.querySelector('#historyInlinePanel'))return;
   const items=Object.values(data.query?.pages||{}).map(page=>{
    const info=page.imageinfo?.[0],file=String(page.title||'').replace(/^File:/,'');
    if(!info||!/^image\/(?:png|jpeg|webp|svg\+xml)$/.test(info.mime||'')||
       !/logo|crest|badge|emblem|blason|escudo|écusson|wappen/i.test(file))return null;
    return {id:'commons:'+page.pageid,title:file.replace(/[_-]+/g,' ').replace(/\.(png|jpe?g|webp|svg)$/i,''),
     preview:info.thumburl||info.url,download:info.thumburl||info.url,
     source:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title)};
   }).filter(Boolean);
   grid.innerHTML=items.map(cardMarkup).join('');
   status.textContent=items.length?items.length+' résultat(s) : sélectionne un logo.':
    'Aucun logo correspondant. Essaie le nom complet de l’équipe (éventuellement en anglais).';
  }catch(error){if(serial===searchSerial)status.textContent='Recherche indisponible : '+(error.message||'erreur réseau')+'. Utilise l’import manuel si besoin.';}
  finally{button.disabled=false;}
 });
 renderSaved();renderSelected();
});
// Arrivals UI removed. Saved wishlist-inbox records are intentionally preserved.
const palette=element('div','','extras-palette');palette.hidden=true;$('logoDialog').querySelector('.modal-body').append(palette);let paletteTarget=null;
$('logoDialog').addEventListener('focusin',e=>{if(!e.target.matches('input[type="color"]')||e.target.closest('#appearanceSettingsPanel'))return;paletteTarget=e.target;const colors=window.RapliAppearanceBridge.load()?.favorites||[];palette.innerHTML='<p>Couleurs favorites</p>'+colors.map(c=>'<button type="button" data-palette="'+esc(c)+'" style="border-bottom:6px solid '+esc(c)+'">'+esc(c)+'</button>').join('');palette.hidden=!colors.length;e.target.closest('label')?.after(palette);});
palette.onclick=e=>{const color=e.target.dataset.palette;if(!color||!paletteTarget)return;paletteTarget.value=color;paletteTarget.dispatchEvent(new Event('input',{bubbles:true}));paletteTarget.dispatchEvent(new Event('change',{bubbles:true}));};
window.addEventListener('rapli-admin-access-change',refresh);
window.RapliExtrasUI={editCard,cardFields,refresh};refresh();decorate();
})();
