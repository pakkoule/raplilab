/* LPDB — team championship UI. The personal race archive remains independent. */
(function(root){
'use strict';
const engine=root.RapliTeamEngine;
if(!engine)throw Error('LPDB scoring engine missing');
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=v=>Number(v||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
const uuid=type=>'lpdb-'+type+'-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
const stamp=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString('en-CA');
const types={month:'Mensuel',quarter:'Trimestriel',year:'Annuel',custom:'Libre',all:'Historique complet'};
let api,viewMode='main',periodType='month',periodValue='',customFrom='',customTo='',search='',filter='all',page=1,statMode='avg',draft=null,editingMember=null,notice='';
const all=()=>engine.normalize(api?.get?.()||[]);
const members=()=>all().filter(x=>x.type==='team-member');
const races=()=>all().filter(x=>x.type==='team-race');
const unique=(values)=>[...new Set(values)];
const active=m=>m.status==='active';
const opts=(options,value)=>options.map(x=>'<option value="'+esc(x.value)+'"'+(x.value===value?' selected':'')+'>'+esc(x.label)+'</option>').join('');
function period(){
 if(periodType==='custom')return {type:'custom',from:customFrom,to:customTo};
 if(periodType==='all')return {type:'all'};
 return {type:periodType,value:periodValue};
}
function preset(){
 const p=engine.periods(all()),current=today();
 const list=periodType==='month'?p.months:periodType==='quarter'?p.quarters:p.years;
 if(!periodValue||!list.includes(periodValue)){
  periodValue=list[0]||(periodType==='month'?current.slice(0,7):periodType==='quarter'?current.slice(0,4)+'-Q'+Math.ceil(Number(current.slice(5,7))/3):current.slice(0,4));
 }
}
const labelPeriod=()=>{
 if(periodType==='custom')return (customFrom||'Début')+' — '+(customTo||'Fin');
 if(periodType==='all')return 'Toutes les périodes';
 if(periodType==='quarter'){const [y,q]=periodValue.split('-Q');return 'T'+q+' '+y;}
 if(periodType==='month'){
  const [y,m]=periodValue.split('-');
  return new Date(Number(y),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 }
 return periodValue;
};
function selectionControls(prefix='team'){
 preset();
 const data=engine.periods(all());
 const vals=periodType==='month'?data.months:periodType==='quarter'?data.quarters:data.years;
 const extras=vals.includes(periodValue)?vals:[periodValue,...vals];
 const pretty=v=>periodType==='month'?new Date(Number(v.slice(0,4)),Number(v.slice(5,7))-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}):v;
 return '<div class="team-selector">'+
 '<label>BARÈME<select id="'+prefix+'-mode"><option value="main"'+(viewMode==='main'?' selected':'')+'>Principal · VSR & primes</option><option value="historic"'+(viewMode==='historic'?' selected':'')+'>Historique · 200 à 1</option></select></label>'+
 '<label>PÉRIODE<select id="'+prefix+'-period-type">'+opts(Object.entries(types).map(([value,label])=>({value,label})),periodType)+'</select></label>'+
 ((periodType==='month'||periodType==='quarter'||periodType==='year')?
 '<label>CHOISIR<select id="'+prefix+'-period-value">'+opts(extras.map(v=>({value:v,label:pretty(v)})),periodValue)+'</select></label>':'')+
 (periodType==='custom'?'<label>DU<input type="date" id="'+prefix+'-from" value="'+esc(customFrom)+'"></label><label>AU<input type="date" id="'+prefix+'-to" value="'+esc(customTo)+'"></label>':'')+
 '</div>';
}
function statCards(items){return '<div class="team-stats-grid">'+items.map(([k,v])=>'<div class="team-stat"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div>';}
const action=(cmd,label,cls='')=>'<button type="button" class="team-action '+cls+'" data-team-action="'+cmd+'">'+label+'</button>';
const empty=message=>'<div class="team-empty">'+esc(message)+'</div>';
const medal=r=>r===1?'🥇':r===2?'🥈':r===3?'🥉':num(r);
function sortedItems(items){
 const rows=items.filter(s=>filter==='all'||s.status===filter).filter(s=>!search||s.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
 return rows;
}
function rankTable(list,{top=false}={}){
 if(!list.length)return empty('Aucun skipper dans cette sélection.');
 const pageSize=top?10:30,limit=Math.max(1,Math.ceil(list.length/pageSize));
 page=Math.min(Math.max(1,page),limit);
 const sliced=top?list.slice(0,10):list.slice((page-1)*pageSize,page*pageSize);
 return '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>#</th><th>SKIPPER</th><th>COURSES</th><th>V.</th><th>POD.</th><th>POINTS</th><th>PTS/COURSE</th></tr></thead><tbody>'+
 sliced.map(s=>'<tr><td>'+medal(s.rank)+'</td><td><button class="team-skipper-link" data-team-profile="'+esc(s.id)+'">'+esc(s.name)+'</button>'+(s.status==='former'?'<small>Ancien membre</small>':'')+'</td><td>'+num(s.participations)+'</td><td>'+num(s.wins)+'</td><td>'+num(s.podiums)+'</td><td class="team-points">'+num(s.points)+'</td><td>'+num(s.avg)+'</td></tr>').join('')+'</tbody></table></div>'+
 (!top&&limit>1?'<nav class="team-pages">'+action('previous','← Précédent','team-secondary')+'<span>Page '+page+' / '+limit+'</span>'+action('next','Suivant →','team-secondary')+'</nav>':'');
}
function renderMain(){
 const model=engine.standings(all(),period(),viewMode);
 const p=labelPeriod(),list=sortedItems(model.skippers);
 const el=$('team-panel');if(!el)return;
 el.innerHTML='<div class="team-heading"><div><span>LPDB · RAPLI REGATTA</span><h2>CHAMPIONNAT DE L’ÉQUIPE</h2><p>Classement officiel et barème historique, automatiquement recalculés.</p></div><img src="assets/lpdb.webp" alt="LPDB" class="team-emblem"></div>'+
 selectionControls('team')+statCards([['Épreuves validées',num(model.races.length)],['Skippers classés',num(model.skippersCount)],['Points distribués',num(model.pointsTotal)]])+
 '<div class="team-subhead"><div><h3>CLASSEMENT · '+esc(p.toLocaleUpperCase('fr'))+'</h3><p>'+esc(viewMode==='main'?'Barème principal VSR et primes':'Barème historique bonus')+' · '+esc(String(list.length))+' skippers affichés</p></div><div class="team-toolbar">'+action('recalculate','↻ RECALCULER')+action('png-table','↓ PNG TABLEAU')+action('png-podium','↓ PODIUM')+action('png-top10','↓ TOP 10')+'</div></div>'+
 '<div class="team-filters"><input id="team-search" type="search" aria-label="Rechercher un skipper" placeholder="Rechercher un skipper…" value="'+esc(search)+'">'+
 '<select id="team-filter" aria-label="Filtrer les skippers">'+opts([{value:'all',label:'Tous les skippers'},{value:'active',label:'Membres actifs'},{value:'former',label:'Anciens membres'}],filter)+'</select></div>'+
 rankTable(list)+'<p class="team-footnote">Le filtre ne modifie pas les rangs officiels. Les DNF comptent comme participations, avec 0 point. Les anciennes périodes restent recalculables.</p>';
}
function renderRaces(){
 const rs=races().sort((a,b)=>b.dateEnd.localeCompare(a.dateEnd)||a.name.localeCompare(b.name,'fr'));
 const el=$('team-races-panel');if(!el)return;
 const team=all(),known=new Map(members().map(m=>[m.id,m]));
 const groups=unique(rs.map(r=>r.stageGroup).filter(Boolean));
 el.innerHTML='<div class="team-heading"><div><span>LPDB · RÉSULTATS</span><h2>COURSES DE L’ÉQUIPE</h2><p>Chaque étape est une course indépendante, sans point provisoire.</p></div><img src="assets/lpdb.webp" class="team-emblem" alt="LPDB"></div>'+
 '<div class="team-toolbar">'+action('new-race','＋ NOUVELLE COURSE','team-primary')+'</div>'+
 (rs.length?'<div class="team-race-list">'+rs.map(r=>{
 const error=engine.verifyRace(r,known),scored=r.status==='finished'&&!error;
 const total=engine.scoredRace(r,known).reduce((s,x)=>s+(viewMode==='main'?x.main:x.historic),0);
 return '<article class="team-race-card"><div><small>'+esc(r.dateEnd||'Arrivée inconnue')+' · '+esc(r.vsr.toUpperCase())+(r.stageGroup?' · '+esc(r.stageGroup):'')+'</small><h3>'+esc(r.name)+'</h3><p>'+r.results.length+' participant(s) · '+(r.status==='finished'?(error?'À compléter : '+esc(error):'Terminée · validée'):r.status==='live'?'En cours':'À venir')+'</p></div><div class="team-race-score"><strong>'+num(total)+'</strong><small>pts distribués</small></div><div class="team-toolbar">'+action('race-'+esc(r.id),'Modifier','team-secondary')+action('export-race-'+esc(r.id),'↓ PNG')+action('delete-race-'+esc(r.id),'Supprimer','team-danger')+'</div></article>';
 }).join('')+'</div>':empty('Aucune course d’équipe. Ajoute la première épreuve du nouveau championnat.'))+
 (groups.length?'<section class="team-groups"><h3>CLASSEMENTS BONUS · ENSEMBLES D’ÉTAPES</h3><p>Somme des étapes, sans redistribuer de points.</p>'+groups.map(g=>'<div class="team-group-row"><strong>'+esc(g)+'</strong><div>'+action('stage-'+encodeURIComponent(g),'Voir le classement')+action('png-stage-'+encodeURIComponent(g),'↓ PNG')+'</div></div>').join('')+'</section>':'');
}
function renderMembers(){
 const ms=members().sort((a,b)=>(b.status==='active')-(a.status==='active')||a.name.localeCompare(b.name,'fr'));
 const el=$('team-skippers-panel');if(!el)return;
 el.innerHTML='<div class="team-heading"><div><span>LPDB · EFFECTIF</span><h2>LES SKIPPERS</h2><p>Jusqu’à 50 membres actifs · historique sans limite.</p></div><img class="team-emblem" src="assets/lpdb.webp" alt="LPDB"></div>'+
 statCards([['Effectif actif',num(ms.filter(active).length)+' / 50'],['Anciens membres',num(ms.filter(m=>!active(m)).length)],['Skippers historiques',num(ms.length)]])+
 '<div class="team-toolbar">'+action('new-member','＋ AJOUTER UN SKIPPER','team-primary')+'</div>'+
 (ms.length?'<div class="team-member-list">'+ms.map(m=>'<div class="team-member-card"><div><strong>'+esc(m.name)+'</strong><small>'+esc(active(m)?'Membre actif':'Ancien membre')+(m.from?' · Depuis '+esc(m.from):'')+'</small></div><div class="team-toolbar">'+action('member-'+esc(m.id),'Modifier','team-secondary')+action('profile-'+esc(m.id),'Palmarès')+'</div></div>').join('')+'</div>':empty('L’effectif est vide. Ajoute les skippers pour créer des courses.'))+
 '<p class="team-footnote">Un ancien membre conserve tous ses points. Tu peux le réactiver sans perdre son identité ni son palmarès.</p>';
}
function renderStats(){
 const model=engine.standings(all(),period(),viewMode);
 const el=$('team-stats-panel');if(!el)return;
 const sorted=[...model.skippers].sort((a,b)=>statMode==='avg'?b.avg-a.avg:statMode==='finish'?b.finishRate-a.finishRate:statMode==='wins'?b.wins-a.wins:b.points-a.points||b.hybrid-a.hybrid);
 el.innerHTML='<div class="team-heading"><div><span>LPDB · ANALYSE</span><h2>STATISTIQUES D’ÉQUIPE</h2><p>Points par course, efficacité, assiduité, victoires et palmarès.</p></div><img class="team-emblem" src="assets/lpdb.webp" alt="LPDB"></div>'+
 selectionControls('team-stats')+statCards([['Participations',num(model.skippers.reduce((s,m)=>s+m.participations,0))],['Moyenne globale',num(model.skippers.reduce((s,m)=>s+m.points,0)/Math.max(1,model.skippers.reduce((s,m)=>s+m.participations,0)))+' pts/course'],['Fin de course',num(model.skippers.reduce((s,m)=>s+m.finished,0)/Math.max(1,model.skippers.reduce((s,m)=>s+m.participations,0))*100)+' %']])+
 '<div class="team-subhead"><h3>COMPARATIF DE PERFORMANCE</h3><div class="team-toolbar">'+action('png-stats','↓ PNG TABLEAU')+action('png-stats-social','↓ TOP 10')+'</div></div>'+
 '<label class="team-sort-label">CRITÈRE <select id="team-stat-mode">'+opts([{value:'avg',label:'Points / course'},{value:'finish',label:'Taux de finition'},{value:'wins',label:'Victoires'},{value:'points',label:'Points totaux'}],statMode)+'</select></label>'+
 (sorted.length?'<div class="team-table-wrap"><table class="team-table"><thead><tr><th>#</th><th>SKIPPER</th><th>COURSES</th><th>PTS/COURSE</th><th>FINITIONS</th><th>VICT.</th><th>POINTS</th></tr></thead><tbody>'+
 sorted.map((s,i)=>'<tr><td>'+medal(i+1)+'</td><td><button class="team-skipper-link" data-team-profile="'+esc(s.id)+'">'+esc(s.name)+'</button></td><td>'+num(s.participations)+'</td><td class="team-points">'+num(s.avg)+'</td><td>'+num(s.finishRate)+' %</td><td>'+num(s.wins)+'</td><td>'+num(s.points)+'</td></tr>').join('')+'</tbody></table></div>':empty('Les statistiques apparaîtront après la première course validée.'));
}
function render(){
 if(!api)return;
 preset();renderMain();renderRaces();renderMembers();renderStats();
}
function notify(message,error=false){notice=message;api.notify?.(message,error);}
function canWrite(){if(!api.canEdit?.()){notify('Connexion administrateur et synchronisation nécessaires pour modifier le championnat.',true);return false;}return true;}
async function saveEntity(entity){
 if(!canWrite())return false;
 try{await api.save(entity);render();return true;}
 catch(e){notify('Enregistrement impossible : '+e.message,true);return false;}
}
async function removeEntity(id){
 if(!canWrite())return false;
 try{await api.remove(id);render();return true;}catch(e){notify('Suppression impossible : '+e.message,true);return false;}
}
function editorRows(){
 if(!draft)return;
 const known=new Map(members().map(m=>[m.id,m]));
 $('team-participants-count').textContent=draft.results.length+' / 50 participants';
 $('team-result-rows').innerHTML=draft.results.map(row=>{
  const name=known.get(row.skipperId)?.name||'Skipper inconnu';
  const n=draft.results.length,sc=row.status==='finished'&&row.position?engine.primary(draft.vsr,n,row.position):0;
  const hc=row.status==='finished'&&row.position?engine.historical(row.position):0;
  return '<div class="team-result-row" data-team-row="'+esc(row.skipperId)+'"><span class="team-result-name" title="'+esc(name)+'">'+esc(name)+'</span>'+
   '<input type="number" min="1" max="50" step="1" inputmode="numeric" data-team-rank="'+esc(row.skipperId)+'" aria-label="Rang de '+esc(name)+'" value="'+(row.position??'')+'"'+(row.status!=='finished'?' disabled':'')+' placeholder="Rang">'+
   '<select data-team-status="'+esc(row.skipperId)+'" aria-label="Résultat de '+esc(name)+'">'+opts([{value:'pending',label:'À saisir'},{value:'finished',label:'Classé'},{value:'dnf',label:'DNF'}],row.status)+'</select>'+
   '<strong class="team-result-points">'+(row.status==='dnf'?'0 / 0':row.status==='finished'?num(sc)+' / '+num(hc):'—')+'</strong><button type="button" class="team-remove-row" data-team-remove="'+esc(row.skipperId)+'" title="Retirer '+esc(name)+'">×</button></div>';
 }).join('')||empty('Ajoute les participants depuis l’effectif.');
 editorSummary();
}
function editorSummary(){
 if(!draft)return;
 const known=new Map(members().map(m=>[m.id,m])),n=draft.results.length;
 const scores=draft.results.filter(x=>x.status==='finished').reduce((sum,x)=>sum+engine.primary(draft.vsr,n,x.position),0);
 const pending=draft.results.filter(x=>x.status==='pending').length;
 const error=draft.status==='finished'?engine.verifyRace({...draft,dateEnd:$('team-race-date').value},known):'';
 $('team-race-validation').textContent=error|| (pending?pending+' résultat(s) en attente':'Classement prêt à enregistrer');
 $('team-race-validation').dataset.error=error?'true':'false';
 $('team-race-preview').textContent=num(scores)+' points principaux · '+n+' participants · palier '+(engine.tier(n)*5+10);
}
function openRace(id){
 if(!canWrite())return;
 draft=id?races().find(r=>r.id===id):null;
 draft=draft?structuredClone(draft):{id:uuid('race'),type:'team-race',name:'',dateEnd:'',vsr:'vsr2',status:'planned',stageGroup:'',results:[],createdAt:stamp()};
 $('team-race-dialog-title').textContent=id?'MODIFIER LA COURSE':'NOUVELLE COURSE D’ÉQUIPE';
 $('team-race-name').value=draft.name;
 $('team-race-date').value=draft.dateEnd;
 $('team-race-vsr').value=draft.vsr;
 $('team-race-status').value=draft.status;
 $('team-race-group').value=draft.stageGroup;
 $('team-create-member').value='';
 $('team-select-member').value='';
 choices();editorRows();$('team-race-dialog').showModal();
}
function choices(){
 const chosen=new Set(draft?.results.map(x=>x.skipperId)||[]);
 $('team-select-member').innerHTML='<option value="">Choisir un skipper…</option>'+
 opts(members().filter(m=>!chosen.has(m.id)).sort((a,b)=>a.name.localeCompare(b.name,'fr'))
   .map(m=>({value:m.id,label:m.name+(m.status==='former'?' · ancien':'')})),'');
}
function addMemberToDraft(id){
 if(!draft||draft.results.some(r=>r.skipperId===id))return;
 if(draft.results.length>=50){notify('Maximum 50 participants par course.',true);return;}
 draft.results.push({skipperId:id,status:'pending',position:null});choices();editorRows();
}
async function quickMember(){
 if(!canWrite()||!draft)return;
 const name=$('team-create-member').value.trim().slice(0,56);
 if(!name){notify('Saisis un pseudo.',true);return;}
 const already=members().find(m=>m.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr'));
 if(already){addMemberToDraft(already.id);$('team-create-member').value='';return;}
 if(members().filter(active).length>=50){notify('Effectif actif complet (50 skippers).',true);return;}
 const m=engine.member({id:uuid('member'),name,status:'active',createdAt:stamp(),updatedAt:stamp()});
 if(await saveEntity(m)){
  addMemberToDraft(m.id);$('team-create-member').value='';
 }
}
async function submitRace(ev){
 ev.preventDefault();if(!canWrite()||!draft)return;
 draft.name=$('team-race-name').value.trim().slice(0,160);
 draft.dateEnd=$('team-race-date').value;draft.status=$('team-race-status').value;
 draft.vsr=$('team-race-vsr').value;draft.stageGroup=$('team-race-group').value.trim().slice(0,100);
 if(!draft.name){notify('Renseigne le nom de la course.',true);return;}
 if(draft.status==='finished'){
  const issue=engine.verifyRace(draft,new Map(members().map(m=>[m.id,m])));
  if(issue){notify(issue,true);editorSummary();return;}
 }
 draft.updatedAt=stamp();
 if(await saveEntity(engine.race(draft))){$('team-race-dialog').close();draft=null;notify('Course d’équipe enregistrée ✓');}
}
function openMember(id){
 if(!canWrite())return;
 editingMember=id?members().find(m=>m.id===id):null;
 $('team-member-dialog-title').textContent=id?'MODIFIER UN SKIPPER':'AJOUTER UN SKIPPER';
 $('team-member-name').value=editingMember?.name||'';
 $('team-member-status').value=editingMember?.status||'active';
 $('team-member-from').value=editingMember?.from||'';
 $('team-member-until').value=editingMember?.until||'';
 $('team-member-dialog').showModal();
}
async function submitMember(ev){
 ev.preventDefault();if(!canWrite())return;
 const name=$('team-member-name').value.trim().slice(0,56),status=$('team-member-status').value,
  from=$('team-member-from').value,until=$('team-member-until').value;
 if(!name||members().some(m=>m.name.toLocaleLowerCase('fr')===name.toLocaleLowerCase('fr')&&m.id!==editingMember?.id)){notify('Pseudo vide ou déjà utilisé.',true);return;}
 if(from&&until&&until<from){notify('La date de sortie doit suivre l’entrée.',true);return;}
 if(status==='active'&&!active(editingMember||{})&&members().filter(active).length>=50){notify('Maximum 50 membres actifs.',true);return;}
 const m=engine.member({id:editingMember?.id||uuid('member'),name,status,from,until,createdAt:editingMember?.createdAt||stamp(),updatedAt:stamp()});
 if(await saveEntity(m)){$('team-member-dialog').close();editingMember=null;notify('Skipper enregistré ✓');}
}
function showProfile(id){
 const m=members().find(x=>x.id===id);if(!m)return;
 const model=engine.standings(all(),period(),viewMode),s=model.skippers.find(x=>x.id===id);
 const content='<div class="team-profile-head"><h3>'+esc(m.name)+'</h3><small>'+esc(m.status==='active'?'Membre actif':'Ancien membre')+' · '+esc(labelPeriod())+'</small></div>'+
 (s?statCards([['Points',num(s.points)],['Points / course',num(s.avg)],['Courses terminées',num(s.finished)],['Victoires',num(s.wins)],['Podiums',num(s.podiums)],['Assiduité',num(s.attendance)+' %'],['Prestige moyen',num(s.prestige)],['Départage hybride',num(s.hybrid)]])+
 '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>COURSE</th><th>RANG</th><th>VSR</th><th>POINTS</th></tr></thead><tbody>'+
 s.records.slice().sort((a,b)=>b.dateEnd.localeCompare(a.dateEnd)).map(r=>'<tr><td>'+esc(r.raceName)+'<small>'+esc(r.dateEnd)+'</small></td><td>'+ (r.dnf?'DNF':r.rank)+'</td><td>'+esc(r.vsr.toUpperCase())+'</td><td>'+num(viewMode==='historic'?r.historic:r.main)+'</td></tr>').join('')+'</tbody></table></div>':empty('Aucune participation sur cette période.'));
 $('team-profile-body').innerHTML=content;
 $('team-profile-dialog').showModal();
}
function stageDialog(group){
 const data=engine.stageBonus(all(),group,viewMode);
 $('team-stage-title').textContent=group.toLocaleUpperCase('fr');
 $('team-stage-body').innerHTML='<p>Classement bonus des étapes, sans nouveau point attribué au championnat.</p>'+rankTable(data.skippers,{top:false});
 $('team-stage-dialog').showModal();
}
function drawRounded(ctx,x,y,w,h,r,fill){
 ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function canvasRow(ctx,cols,y,index,w,height=63){
 drawRounded(ctx,58,y,w-116,height-4,10,index%2?'#122d3b':'#193c4b');
 cols.forEach((col,i)=>{
  ctx.fillStyle=i===0&&index<3?['#f7d06b','#cad8dd','#dd9f70'][index]:'#f7fcff';
  ctx.font=i===0?'800 27px Poppins, sans-serif':'650 24px Poppins, sans-serif';
  ctx.textAlign=i===1?'left':'right';
  ctx.fillText(col,[110,230,w-520,w-315,w-85][i]||w-85,y+40);
 });
}
async function logoImage(){
 return new Promise(resolve=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
  img.src='assets/lpdb.webp';
 });
}
async function exportStandings(rows,title,{style='table',limit=0,prefix='lpdb-classement'}={}){
 if(!rows.length){notify('Aucun classement à exporter.',true);return;}
 const img=await logoImage();
 const source=limit?rows.slice(0,limit):rows;
 const batch=style==='table'?25:Math.max(3,limit||10);
 const pages=Math.ceil(source.length/batch);
 for(let p=0;p<pages;p++){
  const segment=source.slice(p*batch,(p+1)*batch);
  const w=1080,isPodium=style==='social'&&limit===3,topList=style==='social'&&!isPodium;
  const unit=style==='table'?63:67,h=isPodium?1150:topList?Math.max(1390,680+unit*segment.length):Math.max(930,520+unit*segment.length);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#05151f');gradient.addColorStop(.6,'#113746');gradient.addColorStop(1,'#071722');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#04d4d9';ctx.lineWidth=5;ctx.strokeRect(24,24,w-48,h-48);
  ctx.fillStyle='#d52537';ctx.fillRect(28,28,12,h-56);
  if(img){const ratio=img.width/img.height;ctx.drawImage(img,w/2-125,42,250,250/ratio);}
  ctx.fillStyle='#f8fcff';ctx.textAlign='center';ctx.font='900 53px Poppins, sans-serif';ctx.fillText('RAPLI REGATTA',w/2,286);
  ctx.fillStyle='#66e9e9';ctx.font='800 26px Poppins, sans-serif';ctx.fillText(title.toLocaleUpperCase('fr').slice(0,56),w/2,331);
  if(pages>1){ctx.font='600 19px Poppins,sans-serif';ctx.fillText('PAGE '+(p+1)+' / '+pages,w/2,365);}
  if(isPodium){
   ctx.fillStyle='#f9e2a0';ctx.textAlign='center';ctx.font='900 33px Poppins,sans-serif';
   ctx.fillText('LE PODIUM LPDB',w/2,420);
   const order=[segment[1],segment[0],segment[2]];
   const colors=['#cbd8e7','#f7d36a','#cf976c'],heights=[385,485,340],tops=[590,490,635];
   order.forEach((s,i)=>{
    if(!s)return;
    const x=65+i*340,y=tops[i],h=heights[i],wid=305;
    const grad=ctx.createLinearGradient(x,y,x+wid,y+h);
    grad.addColorStop(0,'#19435a');grad.addColorStop(1,'#071f2b');
    drawRounded(ctx,x,y,wid,h,15,grad);
    ctx.lineWidth=4;ctx.strokeStyle=colors[i];ctx.strokeRect(x+3,y+3,wid-6,h-6);
    ctx.textAlign='center';ctx.fillStyle=colors[i];ctx.font='900 80px Poppins,sans-serif';
    ctx.fillText(String(s.rank??i+1),x+wid/2,y+100);
    ctx.fillStyle='#faffff';ctx.font='850 30px Poppins,sans-serif';
    ctx.fillText(s.name.slice(0,15).toUpperCase(),x+wid/2,y+166);
    ctx.fillStyle='#72fffa';ctx.font='900 38px Poppins,sans-serif';
    ctx.fillText(num(s.points)+' PTS',x+wid/2,y+231);
    ctx.fillStyle='#afdae3';ctx.font='600 18px Poppins,sans-serif';
    ctx.fillText(num(s.participations)+' courses · '+num(s.wins)+' victoire(s)',x+wid/2,y+283);
   });
  }else{
   const topY=topList?640:445,headY=topList?619:427;
   if(topList&&segment[0]){
    drawRounded(ctx,65,389,w-130,180,18,'#164d59');
    ctx.strokeStyle='#e7bb45';ctx.lineWidth=4;ctx.strokeRect(68,392,w-136,174);
    ctx.textAlign='left';ctx.fillStyle='#ffdd84';ctx.font='850 22px Poppins,sans-serif';
    ctx.fillText('CHAMPION DU CLASSEMENT',105,433);
    ctx.fillStyle='#fff';ctx.font='900 41px Poppins,sans-serif';
    ctx.fillText(segment[0].name.slice(0,22).toUpperCase(),105,490);
    ctx.fillStyle='#ffde7c';ctx.textAlign='right';ctx.font='900 51px Poppins,sans-serif';
    ctx.fillText(num(segment[0].points)+' PTS',w-105,490);
   }
   ctx.fillStyle='#bdedf1';ctx.textAlign='left';ctx.font='700 22px Poppins,sans-serif';
   ctx.fillText('RANG',70,headY);ctx.fillText('SKIPPER',200,headY);
   ctx.textAlign='right';ctx.fillText('COURSES',w-520,headY);ctx.fillText('VICT.',w-315,headY);ctx.fillText('POINTS',w-85,headY);
   segment.forEach((s,i)=>{
    const y=topY+i*unit;
    drawRounded(ctx,58,y,w-116,unit-5,10,topList&&i===0?'#244d50':i%2?'#0a2432':'#183846');
    if(topList&&i===0){ctx.strokeStyle='#e7bd46';ctx.lineWidth=3;ctx.strokeRect(60,y+1,w-120,unit-8);}
    const rank=Number.isInteger(s.rank)?s.rank:p*batch+i+1;
    const labels=[s.dnf?'DNF':String(rank),s.name,String(s.participations??0),String(s.wins??0),num(s.points??0)];
    ctx.textBaseline='middle';
    ctx.fillStyle=rank===1&&!s.dnf?'#f5ca63':rank===2&&!s.dnf?'#d6dce6':rank===3&&!s.dnf?'#d5a277':'#f5f8fa';
    ctx.textAlign='left';ctx.font='800 29px Poppins,sans-serif';ctx.fillText(labels[0],88,y+unit/2);
    ctx.fillStyle='#f8ffff';ctx.font='750 24px Poppins,sans-serif';ctx.fillText(labels[1].slice(0,20),200,y+unit/2);
    ctx.textAlign='right';ctx.font='650 23px Poppins,sans-serif';
    ctx.fillText(labels[2],w-520,y+unit/2);ctx.fillText(labels[3],w-315,y+unit/2);
    ctx.font='850 29px Poppins,sans-serif';ctx.fillStyle='#69f3ed';ctx.fillText(labels[4],w-85,y+unit/2);
   });
  }
  ctx.font='600 20px Poppins,sans-serif';ctx.textAlign='center';ctx.fillStyle='#8db8c2';
  ctx.fillText('LPDB · CHAMPIONNAT DE L’ÉQUIPE',w/2,h-70);
  const file=prefix+'-'+String(p+1).padStart(2,'0')+'.png';
  try{
   await new Promise((resolve,reject)=>canvas.toBlob(blob=>{
    if(!blob){reject(Error('PNG impossible'));return;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=file;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);resolve();
   },'image/png'));
  }catch(e){notify('Export PNG indisponible : '+e.message,true);return;}
 }
 notify(pages===1?'Export PNG lancé ✓':pages+' PNG générés · vérifie les téléchargements autorisés par le navigateur.');
}
function doExport(kind,arg){
 const p=period(),data=all();
 const model=engine.standings(data,p,viewMode);
 let title=(viewMode==='main'?'Principal':'Historique')+' · '+labelPeriod();
 let list=sortedItems(model.skippers),style='table',limit=0,filename='lpdb-'+viewMode+'-'+periodType;
 if(kind==='png-podium'){style='social';limit=3;}
 if(kind==='png-top10'){style='social';limit=10;}
 if(kind==='png-stats'||kind==='png-stats-social'){
  list=[...model.skippers].sort((a,b)=>statMode==='avg'?b.avg-a.avg:statMode==='finish'?b.finishRate-a.finishRate:statMode==='wins'?b.wins-a.wins:b.points-a.points);
  list=list.map((s,i)=>({...s,rank:i+1,points:statMode==='avg'?s.avg:statMode==='finish'?s.finishRate:statMode==='wins'?s.wins:s.points}));
  if(kind==='png-stats-social'){style='social';limit=10;}
  filename+='-stat-'+statMode;
  title=({avg:'Points par course',finish:'Taux de finition',wins:'Victoires',points:'Points cumulés'})[statMode]+' · '+labelPeriod();
 }
 if(kind==='race'){
  const race=races().find(x=>x.id===arg);
  if(!race)return;
  const scores=engine.scoredRace(race,new Map(members().map(m=>[m.id,m])));
  list=scores.sort((a,b)=>(a.rank??999)-(b.rank??999)).map((s,i)=>({
   name:members().find(m=>m.id===s.skipperId)?.name||'Inconnu',rank:s.rank??null,dnf:s.dnf,
   points:viewMode==='historic'?s.historic:s.main,participations:1,wins:Number(s.rank===1)
  }));
  if(!list.length){notify('Valide tous les résultats avant d’exporter la course.',true);return;}
  filename='lpdb-course-'+race.id;return exportStandings(list,race.name+' · '+race.dateEnd,{style,prefix:filename});
 }
 if(kind==='stage'){
  const group=arg;
  list=engine.stageBonus(data,group,viewMode).skippers;
  filename='lpdb-etapes-'+encodeURIComponent(group).slice(0,35);
  return exportStandings(list,'Étapes · '+group,{style,prefix:filename});
 }
 return exportStandings(list,title,{style,limit,prefix:filename});
}
async function deleteRace(id){
 if(!canWrite())return;
 const r=races().find(x=>x.id===id);
 if(!r||!confirm('Supprimer la course « '+r.name+' » ? Les classements seront recalculés.'))return;
 if(await removeEntity(id))notify('Course supprimée · classement recalculé.');
}
async function click(ev){
 const profile=ev.target.closest('[data-team-profile]');if(profile){showProfile(profile.dataset.teamProfile);return;}
 const remove=ev.target.closest('[data-team-remove]');if(remove&&draft){draft.results=draft.results.filter(x=>x.skipperId!==remove.dataset.teamRemove);choices();editorRows();return;}
 const button=ev.target.closest('[data-team-action]');if(!button)return;
 const cmd=button.dataset.teamAction;
 if(cmd==='new-race')return openRace();
 if(cmd==='new-member')return openMember();
 if(cmd==='recalculate'){render();notify('Tous les classements ont été recalculés ✓');return;}
 if(cmd==='select-all'&&draft){
  for(const m of members().filter(active))if(draft.results.length<50&&!draft.results.some(x=>x.skipperId===m.id))
   draft.results.push({skipperId:m.id,status:'pending',position:null});
  choices();editorRows();return;
 }
 if(cmd==='add-member'&&draft){const id=$('team-select-member').value;if(id)addMemberToDraft(id);return;}
 if(cmd==='create-member'&&draft)return void quickMember();
 if(cmd==='previous'){page=Math.max(1,page-1);renderMain();return;}
 if(cmd==='next'){page++;renderMain();return;}
 if(cmd.startsWith('race-'))return openRace(cmd.slice(5));
 if(cmd.startsWith('member-'))return openMember(cmd.slice(7));
 if(cmd.startsWith('profile-'))return showProfile(cmd.slice(8));
 if(cmd.startsWith('delete-race-'))return void deleteRace(cmd.slice(12));
 if(cmd.startsWith('export-race-'))return void doExport('race',cmd.slice(12));
 if(cmd.startsWith('stage-'))return stageDialog(decodeURIComponent(cmd.slice(6)));
 if(cmd.startsWith('png-stage-'))return void doExport('stage',decodeURIComponent(cmd.slice(10)));
 if(cmd.startsWith('png-'))return void doExport(cmd);
}
function change(ev){
 const el=ev.target;
 if(el.id==='team-mode'||el.id==='team-stats-mode'){viewMode=el.value;page=1;render();return;}
 if(el.id==='team-period-type'||el.id==='team-stats-period-type'){periodType=el.value;periodValue='';page=1;render();return;}
 if(el.id==='team-period-value'||el.id==='team-stats-period-value'){periodValue=el.value;page=1;render();return;}
 if(el.id==='team-filter'){filter=el.value;page=1;renderMain();return;}
 if(el.id==='team-stat-mode'){statMode=el.value;renderStats();return;}
 if(['team-from','team-to','team-stats-from','team-stats-to'].includes(el.id)){if(el.id.endsWith('-from'))customFrom=el.value;else customTo=el.value;page=1;render();return;}
 if(el.id==='team-race-status'||el.id==='team-race-vsr'||el.id==='team-race-date'){
  if(draft){draft.vsr=$('team-race-vsr').value;draft.status=$('team-race-status').value;editorRows();}
 }
 if(el.dataset.teamStatus&&draft){
  const row=draft.results.find(r=>r.skipperId===el.dataset.teamStatus);
  if(row){row.status=el.value;row.position=row.status==='finished'?row.position:null;editorRows();}
 }
}
function input(ev){
 const el=ev.target;
 if(el.id==='team-search'){search=el.value;page=1;renderMain();$('team-search')?.focus();$('team-search')?.setSelectionRange(search.length,search.length);return;}
 if(el.dataset.teamRank&&draft){
  const row=draft.results.find(r=>r.skipperId===el.dataset.teamRank);
  if(row){row.position=el.value?Number(el.value):null;editorSummary();}
 }
}
function init(bridge){
 api=bridge;
 document.addEventListener('click',click);
 document.addEventListener('change',change);
 document.addEventListener('input',input);
 $('team-race-form')?.addEventListener('submit',submitRace);
 $('team-member-form')?.addEventListener('submit',submitMember);
 document.querySelectorAll('[data-team-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));
 for(const id of ['team-race-dialog','team-member-dialog','team-stage-dialog','team-profile-dialog']){
  $(id)?.addEventListener('click',ev=>{if(ev.target===ev.currentTarget)ev.currentTarget.close();});
 }
 render();
}
root.RapliTeamUI={init,render,getPeriod:period,getViewMode:()=>viewMode};
})(window);
