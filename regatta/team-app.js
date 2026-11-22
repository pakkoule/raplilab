/* LPDB — team championship UI. The personal race archive remains independent. */
(function(root){
'use strict';
const engine=root.RapliTeamEngine,clock=root.RapliTeamTime;
if(!engine||!clock)throw Error('LPDB scoring/time engines missing');
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=v=>Number(v||0).toLocaleString('fr-FR',{maximumFractionDigits:1});
const uuid=type=>'lpdb-'+type+'-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
const stamp=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString('en-CA');
const types={month:'Mensuel',quarter:'Trimestriel',year:'Annuel',custom:'Libre',all:'Historique complet'};
let api,viewMode='main',periodType='month',periodValue='',customFrom='',customTo='',search='',filter='all',page=1,statMode='avg',draft=null,editingMember=null,notice='',bulkSaving=false,rankingImport=null;
const personal=()=>api?.personal?.()||[];
const raw=()=>engine.normalize(api?.get?.()||[]);
const all=()=>raw().map(x=>x.type==='team-race'?
 engine.resolveLinkedRace(x,personal().find(p=>p.id===x.personalRaceId)):x);
const personalById=id=>personal().find(x=>x.id===id&&x.kind==='race');
const detailInputs={boatClass:'team-race-class',routeType:'team-race-route',start:'team-race-start',
 startTime:'team-race-start-time',timezone:'team-race-timezone'};
const members=()=>all().filter(x=>x.type==='team-member');
const editorMembers=()=>[...members(),...(draft?.newMembers||[])];
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
const clockLabel=value=>Number.isSafeInteger(value)&&value>=0?clock.formatTime(value):'—';
const pngClock=value=>clockLabel(value).replace(/(\d{2})j (\d{2})h (\d{2})m (\d{2})s/u,'$1j $2:$3:$4').replace(/(\d{2})h (\d{2})m (\d{2})s/u,'$1:$2:$3');
function sortedItems(items){
 const rows=items.filter(s=>filter==='all'||s.status===filter).filter(s=>!search||s.name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
 return rows;
}
function rankTable(list,{top=false}={}){
 if(!list.length)return empty('Aucun skipper dans cette sélection.');
 const pageSize=top?10:30,limit=Math.max(1,Math.ceil(list.length/pageSize));
 page=Math.min(Math.max(1,page),limit);
 const sliced=top?list.slice(0,10):list.slice((page-1)*pageSize,page*pageSize);
 return '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>#</th><th>SKIPPER</th><th>COURSES</th><th>V.</th><th>POD.</th><th>POINTS</th><th>PTS/COURSE</th><th>CHRONO MOY.</th><th>ÉCART MOY.</th></tr></thead><tbody>'+
 sliced.map(s=>'<tr><td>'+(s.points>0?medal(s.rank):num(s.rank))+'</td><td><button class="team-skipper-link" data-team-profile="'+esc(s.id)+'">'+esc(s.name)+'</button>'+(s.status==='former'?'<small>Ancien membre</small>':'')+'</td><td>'+num(s.participations)+'</td><td>'+num(s.wins)+'</td><td>'+num(s.podiums)+'</td><td class="team-points">'+num(s.points)+'</td><td>'+num(s.avg)+'</td><td>'+clockLabel(s.avgTimeSeconds)+'</td><td>'+clockLabel(s.avgGapSeconds)+'</td></tr>').join('')+'</tbody></table></div>'+
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
function teamRaceCard(r,known){
 const p=personalById(r.personalRaceId);
 const results=engine.scoredRace(r,known);
 const checked=r.status==='finished'&&results.length>0;
 const err=r.status==='finished'&&!checked?engine.verifyRace(r,known):'';
 const state=checked?'TERMINÉE · VALIDÉE':r.status==='finished'?'RÉSULTATS À COMPLÉTER':
  r.status==='live'?'EN COURS':'À VENIR';
 const finished=r.results.filter(x=>x.status==='finished').sort((a,b)=>(a.position??999)-(b.position??999));
 const podium=checked?finished.slice(0,3):[];
 const names=new Map([...known].map(([id,m])=>[id,m.name]));
 const winner=checked?finished.find(x=>x.position===1):null;
 const main=results.reduce((n,s)=>n+s.main,0),historical=results.reduce((n,s)=>n+s.historic,0);
 const dnf=r.results.filter(x=>x.status==='dnf').length;
 const img=p&&/^data:image\/(?:png|webp|jpeg|gif);base64,/iu.test(p.icon||'')?
  '<img src="'+esc(p.icon)+'" alt="Illustration de la course '+esc(r.name)+'">':
  '<img src="assets/lpdb.webp" class="team-race-fallback-image" alt="Logo de l’équipe LPDB">';
 const menuItem=(cmd,label,danger=false)=>'<button type="button" data-team-action="'+cmd+'"'+
  (danger?' class="is-danger"':'')+'>'+label+'</button>';
 const menu='<details class="team-race-menu"><summary aria-label="Options de la course '+esc(r.name)+'" title="Options de la course">⋯</summary>'+
  '<div class="team-race-menu-popover" role="group" aria-label="Actions de '+esc(r.name)+'">'+
  menuItem('race-'+esc(r.id),'✎ Modifier la course')+
  menuItem('show-ranking-'+esc(r.id),'▤ Classement et chronos')+
  (p?menuItem('open-personal-'+esc(p.id),'↗ Ouvrir ma course'):menuItem('new-personal-'+esc(r.id),'＋ Créer ma course'))+
  '<div class="team-race-menu-divider"></div>'+
  menuItem('export-race-'+esc(r.id),'↓ Export PNG tableau')+
  menuItem('export-race-top10-'+esc(r.id),'↓ Export PNG Top 10')+
  menuItem('export-race-podium-'+esc(r.id),'↓ Export PNG podium')+
  '<div class="team-race-menu-divider"></div>'+
  menuItem('delete-race-'+esc(r.id),'× Supprimer la course',true)+'</div></details>';
 const startText=r.start?
  new Date(r.start+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})+
  (r.startTime?' · '+esc(r.startTime):''):'À renseigner';
 const statusClass=r.status==='finished'?(checked?'is-complete':'is-pending'):r.status==='live'?'is-live':'is-upcoming';
 return '<article class="team-race-card'+(r.status==='live'?' team-race-live':'')+'" data-team-race="'+esc(r.id)+'">'+
 '<div class="team-race-layout">'+
 '<section class="team-race-left" aria-label="Visuel et départ de course">'+
 '<div class="team-race-photo">'+img+'<span class="team-race-photo-mark">LPDB · RAPLI REGATTA</span></div>'+
 '<div class="team-race-intro"><h3 title="'+esc(r.name)+'">'+esc(r.name)+'</h3>'+
 (r.stageGroup?'<span class="team-race-stage">'+esc(r.stageGroup)+'</span>':'')+
 '<div class="team-race-departure"><span>DÉPART DE LA COURSE</span><strong>'+startText+'</strong></div>'+
 (r.personalRaceId?'<p class="team-race-link">'+(p?'↔ Fiche « Mes courses » associée':'⚠ Fiche personnelle introuvable')+'</p>':'')+
 '</div></section>'+
 '<section class="team-race-right" aria-label="Résultats des skippers LPDB">'+
 '<header class="team-race-topline"><div class="team-race-tags">'+
 (r.boatClass?'<span class="team-race-class">'+esc(r.boatClass)+'</span>':'')+
 '<span class="team-race-vsr '+esc(r.vsr)+'">'+esc(r.vsr==='hc'?'HC':r.vsr.toUpperCase())+'</span>'+
 '</div>'+menu+'</header>'+
 '<span class="team-race-status '+statusClass+'">'+state+'</span>'+
 (err?'<p class="team-race-alert">'+esc(err)+'</p>':'')+
 '<div class="team-race-figures">'+
 '<div><span>SKIPPERS INSCRITS</span><strong>'+num(r.results.length)+'</strong></div>'+
 '<div><span>CLASSÉS</span><strong>'+num(finished.length)+'</strong></div>'+
 '<div><span>DNF</span><strong>'+num(dnf)+'</strong></div></div>'+
 (winner?'<div class="team-race-first"><div><span>🥇 PREMIER LPDB</span><strong>'+esc(names.get(winner.skipperId)||'Skipper')+'</strong></div>'+
 (winner.elapsedSeconds!=null?'<span class="team-race-clock">'+clockLabel(winner.elapsedSeconds)+'</span>':'')+'</div>':
 '<p class="team-race-pending">'+(r.status==='live'?'Classement disponible à l’arrivée des skippers.':
 r.status==='planned'?'Résultats disponibles après le départ.':'Aucun résultat final validé.')+'</p>')+
 (podium.length>1?'<div class="team-race-podium">'+podium.slice(1).map(x=>
 '<div><span>'+medal(x.position)+'</span><strong>'+esc(names.get(x.skipperId)||'Skipper')+'</strong></div>').join('')+'</div>':'')+
 '<div class="team-race-points"><div><span>POINTS PRINCIPAUX</span><strong>'+num(main)+'</strong></div>'+
 '<div><span>POINTS HISTORIQUES</span><strong>'+num(historical)+'</strong></div></div>'+
 '</section></div></article>';
}
function renderRaces(){
 const rs=races().slice().sort((a,b)=>(b.start||b.dateEnd||b.createdAt||'').localeCompare(a.start||a.dateEnd||a.createdAt||'')||a.name.localeCompare(b.name,'fr'));
 const el=$('team-races-panel');if(!el)return;
 const known=new Map(members().map(m=>[m.id,m]));
 const groups=unique(rs.map(r=>r.stageGroup).filter(Boolean));
 el.innerHTML='<div class="team-heading"><div><span>LPDB · RÉSULTATS</span><h2>COURSES DE L’ÉQUIPE</h2><p>Des fiches inspirées de « Mes courses », avec un classement distinct pour chaque skipper.</p></div><img src="assets/lpdb.webp" class="team-emblem" alt="LPDB"></div>'+
 '<div class="team-toolbar">'+action('new-race','＋ NOUVELLE COURSE','team-primary')+'</div>'+
 (rs.length?'<div class="team-race-list">'+rs.map(r=>teamRaceCard(r,known)).join('')+'</div>':
  empty('Aucune course d’équipe. Ajoute la première épreuve du nouveau championnat.'))+
 (groups.length?'<section class="team-groups"><h3>CLASSEMENTS BONUS · ENSEMBLES D’ÉTAPES</h3><p>Somme des étapes, sans redistribuer de points.</p>'+
 groups.map(g=>'<div class="team-group-row"><strong>'+esc(g)+'</strong><div>'+action('stage-'+encodeURIComponent(g),'Voir le classement')+action('png-stage-'+encodeURIComponent(g),'↓ PNG')+'</div></div>').join('')+'</section>':'');
}
function renderMembers(){
 const ms=members().sort((a,b)=>(b.status==='active')-(a.status==='active')||a.name.localeCompare(b.name,'fr'));
 const el=$('team-skippers-panel');if(!el)return;
 el.innerHTML='<div class="team-heading"><div><span>LPDB · EFFECTIF</span><h2>LES SKIPPERS</h2><p>Jusqu’à 50 membres actifs · historique sans limite.</p></div><img class="team-emblem" src="assets/lpdb.webp" alt="LPDB"></div>'+
 statCards([['Effectif actif',num(ms.filter(active).length)+' / 50'],['Anciens membres',num(ms.filter(m=>!active(m)).length)],['Skippers historiques',num(ms.length)]])+
 '<div class="team-toolbar">'+action('new-member','＋ AJOUTER UN SKIPPER','team-primary')+action('bulk-members','＋ AJOUT PAR BLOC','team-secondary')+'</div>'+
 (ms.length?'<div class="team-member-list">'+ms.map(m=>'<div class="team-member-card"><div><strong>'+esc(m.name)+'</strong><small>'+esc(active(m)?'Membre actif':'Ancien membre')+(m.from?' · Depuis '+esc(m.from):'')+'</small></div><div class="team-toolbar">'+action('member-'+esc(m.id),'Modifier','team-secondary')+action('profile-'+esc(m.id),'Palmarès')+'</div></div>').join('')+'</div>':empty('L’effectif est vide. Ajoute les skippers pour créer des courses.'))+
 '<p class="team-footnote">Un ancien membre conserve tous ses points. Tu peux le réactiver sans perdre son identité ni son palmarès.</p>';
}
function renderStats(){
 const model=engine.standings(all(),period(),viewMode);
 const el=$('team-stats-panel');if(!el)return;
 const sortTime=(a,b,key)=>(a[key]??Infinity)-(b[key]??Infinity);
 const sorted=[...model.skippers].sort((a,b)=>statMode==='avg'?b.avg-a.avg:statMode==='finish'?b.finishRate-a.finishRate:statMode==='wins'?b.wins-a.wins:statMode==='time'?sortTime(a,b,'avgTimeSeconds'):statMode==='gap'?sortTime(a,b,'avgGapSeconds'):b.points-a.points||b.hybrid-a.hybrid);
 el.innerHTML='<div class="team-heading"><div><span>LPDB · ANALYSE</span><h2>STATISTIQUES D’ÉQUIPE</h2><p>Points par course, efficacité, assiduité, victoires et palmarès.</p></div><img class="team-emblem" src="assets/lpdb.webp" alt="LPDB"></div>'+
 selectionControls('team-stats')+statCards([['Participations',num(model.skippers.reduce((s,m)=>s+m.participations,0))],['Moyenne globale',num(model.skippers.reduce((s,m)=>s+m.points,0)/Math.max(1,model.skippers.reduce((s,m)=>s+m.participations,0)))+' pts/course'],['Fin de course',num(model.skippers.reduce((s,m)=>s+m.finished,0)/Math.max(1,model.skippers.reduce((s,m)=>s+m.participations,0))*100)+' %'],['Chronos relevés',num(model.skippers.reduce((s,m)=>s+m.timedRaces,0))]])+
 '<div class="team-subhead"><h3>COMPARATIF DE PERFORMANCE</h3><div class="team-toolbar">'+action('png-stats','↓ PNG TABLEAU')+action('png-stats-social','↓ TOP 10')+'</div></div>'+
 '<label class="team-sort-label">CRITÈRE <select id="team-stat-mode">'+opts([{value:'avg',label:'Points / course'},{value:'finish',label:'Taux de finition'},{value:'wins',label:'Victoires'},{value:'points',label:'Points totaux'},{value:'time',label:'Chrono moyen'},{value:'gap',label:'Écart moyen au vainqueur'}],statMode)+'</select></label>'+
 (sorted.length?'<div class="team-table-wrap"><table class="team-table"><thead><tr><th>#</th><th>SKIPPER</th><th>COURSES</th><th>PTS/COURSE</th><th>CHRONO MOY.</th><th>ÉCART MOY.</th><th>FINITIONS</th><th>VICT.</th><th>POINTS</th></tr></thead><tbody>'+
 sorted.map((s,i)=>'<tr><td>'+medal(i+1)+'</td><td><button class="team-skipper-link" data-team-profile="'+esc(s.id)+'">'+esc(s.name)+'</button></td><td>'+num(s.participations)+'</td><td class="team-points">'+num(s.avg)+'</td><td>'+clockLabel(s.avgTimeSeconds)+'</td><td>'+clockLabel(s.avgGapSeconds)+'</td><td>'+num(s.finishRate)+' %</td><td>'+num(s.wins)+'</td><td>'+num(s.points)+'</td></tr>').join('')+'</tbody></table></div>':empty('Les statistiques apparaîtront après la première course validée.'))+
 '<p class="team-footnote">Chronos et écarts moyens : statistiques descriptives. Comparer des parcours différents ne mesure pas directement la performance sportive.</p>';
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
function importNewName(raw){
 return String(raw||'').replace(/\s*[-_ ]+\s*LPDB\s*$/iu,'').trim();
}
function previewImport(){
 const preview=$('team-ranking-analysis'),apply=$('team-ranking-apply');
 if(!rankingImport){preview.innerHTML='<p class="team-footnote">Clique sur « Analyser le classement » après avoir collé les résultats.</p>';apply.disabled=true;return;}
 const {parsed,rows}=rankingImport,existing=editorMembers(),seen=new Set(),future=new Set(),newNames=[];
 let missing=0,duplicate=0,blocked=0;
 const selected=rows.map((item,i)=>{
  const id=item.skipperId;
  if(item.generalRank!=null&&(!Number.isSafeInteger(item.generalRank)||item.generalRank<1||item.generalRank>100000000)){
   blocked++;return {item,error:'Classement général VR invalide : entier positif ou champ vide.'};
  }
  const name=item.newName?.trim()||'';
  if(!id){missing++;blocked++;return {item,error:'Sélectionne un skipper ou crée un nouveau pseudo.'};}
  if(id==='__new__'){
   if(!name||name.length>56||/\.{2,}|…/u.test(name)){blocked++;return {item,error:'Saisis le pseudo complet (56 caractères max, sans « … »).'};}
   const key=name.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ');
   if(future.has(key)||existing.some(m=>m.name.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ')===key)){
    duplicate++;blocked++;return {item,error:'Pseudo déjà utilisé ou ajouté deux fois.'};
   }
   future.add(key);
   newNames.push(name);
  }else if(!existing.some(m=>m.id===id)||seen.has(id)){duplicate++;blocked++;return {item,error:'Skipper introuvable ou choisi plusieurs fois.'};}
  else seen.add(id);
  return {item,error:''};
 });
 const slots=Math.max(0,50-members().filter(m=>m.status==='active').length);
 const retained=(draft?.results||[]).filter(r=>r.status==='dnf').filter(r=>!seen.has(r.skipperId)).length;
 if(newNames.length>slots||rows.length+retained>50)blocked++;
 const options=existing.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(m=>({value:m.id,label:m.name+(m.status==='former'?' · ancien':'')}));
 preview.innerHTML='<div class="team-bulk-metrics">'+
 '<div><strong>'+parsed.entries.length+'</strong><span>Résultats lus</span></div>'+
 '<div><strong>'+newNames.length+'</strong><span>Nouveaux skippers</span></div>'+
 '<div><strong>'+slots+'</strong><span>Places actives</span></div></div>'+
 (parsed.errors.length?'<p class="team-bulk-error">'+parsed.errors.map(esc).join(' · ')+'</p>':'')+
 (parsed.warnings.length?'<p class="team-bulk-note">'+parsed.warnings.slice(0,6).map(esc).join(' · ')+'</p>':'')+
 '<div class="team-table-wrap"><table class="team-import-table"><thead><tr><th>#</th><th>Nom détecté / Association</th><th>Général VR</th><th>Chrono calculé</th><th>Écart</th></tr></thead><tbody>'+
 selected.map(({item,error},i)=>{
  const allowed=[{value:'',label:'Associer un skipper…'},{value:'__new__',label:'＋ Créer un skipper'},...options];
  return '<tr><td>'+item.position+'</td><td><strong>'+esc(item.name)+'</strong>'+
   '<select data-team-import-select="'+i+'" aria-label="Skipper pour le rang '+item.position+'">'+opts(allowed,item.skipperId)+'</select>'+
   (item.skipperId==='__new__'?'<input data-team-import-name="'+i+'" maxlength="56" value="'+esc(item.newName||'')+'" placeholder="Pseudo complet" aria-label="Nouveau pseudo pour le rang '+item.position+'">':'')+
   (error?'<small class="team-import-warning">'+esc(error)+'</small>':'')+'</td>'+
   '<td><input type="number" min="1" max="100000000" step="1" inputmode="numeric" data-team-import-general="'+i+'" value="'+(item.generalRank??'')+'" placeholder="Général VR" aria-label="Classement général VR de '+esc(item.name)+'"></td>'+ 
   '<td>'+clock.formatTime(item.elapsedSeconds)+'</td><td>+'+clock.formatTime(item.gapSeconds)+'</td></tr>'; 
 }).join('')+'</tbody></table></div>'+
 ((newNames.length>slots||rows.length+retained>50)?'<p class="team-bulk-error">Import impossible : maximum 50 membres actifs et 50 participants par course, DNF compris.</p>':'')+
 '<p class="team-footnote">Les DNF déjà saisis restent participants. Les autres positions seront remplacées après validation. Aucun résultat n’est enregistré avant la sauvegarde de la course.</p>';
 apply.disabled=!!parsed.errors.length||blocked>0||!rows.length;
}
function analyzeRanking(){
 if(!draft)return;
 const parsed=clock.parseClassification($('team-ranking-paste').value);
 const rows=clock.matchSkippers(parsed.entries,editorMembers()).map(item=>({
  ...item,newName:importNewName(item.name),
  generalRank:(draft.results||[]).find(r=>r.skipperId===item.skipperId)?.generalRank??null,
  skipperId:item.skipperId||(item.ambiguous||/\.{2,}|…/u.test(item.name)?'':'__new__')
 }));
 rankingImport={parsed,rows};
 previewImport();
}
function applyRanking(){
 if(!draft||!rankingImport)return;
 previewImport();
 if($('team-ranking-apply').disabled)return;
 const {rows}=rankingImport;
 const known=editorMembers(),newMembers=[],now=stamp();
 const next=rows.map(item=>{
  let id=item.skipperId;
  if(id==='__new__'){
   const newMember=engine.member({id:uuid('member'),name:item.newName.trim(),status:'active',createdAt:now,updatedAt:now});
   if(!newMember)throw Error('Pseudo invalide.');
   newMembers.push(newMember);id=newMember.id;
  }
  const previous=(draft.results||[]).find(row=>row.skipperId===id);
  return {skipperId:id,status:'finished',position:item.position,
   elapsedSeconds:item.elapsedSeconds,gapSeconds:item.gapSeconds,
   generalRank:item.generalRank??previous?.generalRank??null};
 });
 const kept=(draft.results||[]).filter(r=>r.status==='dnf'&&!next.some(row=>row.skipperId===r.skipperId));
 if(next.length+kept.length>50){notify('La course dépasserait 50 participants.',true);return;}
 if(draft.results?.some(r=>r.status==='finished'||r.status==='pending')&&!confirm('Remplacer les positions déjà saisies par le classement collé ? Les abandons DNF resteront comptabilisés.'))return;
 draft.results=[...next,...kept];
 // A previously pasted draft was not saved: replace its provisional members, too.
 draft.newMembers=[...(draft.newMembers||[]).filter(m=>next.some(r=>r.skipperId===m.id)),...newMembers];
 rankingImport=null;
 $('team-ranking-import-body').hidden=true;
 document.querySelector('[data-team-action="toggle-ranking-import"]').setAttribute('aria-expanded','false');
 $('team-ranking-paste').value='';
 choices();editorRows();
 notify(next.length+' résultat(s) importé(s), avec chronos et écarts. Enregistre puis valide la course pour le championnat.');
}
function syncEditorTimes(row,field,value){
 if(!draft||!row||row.status==='dnf')return;
 const seconds=clock.parseTime(field==='gapSeconds'?value.replace(/^\s*\+\s*/u,''):value);
 if(value.trim()&&seconds===null){notify('Format de durée invalide. Utilise par exemple 09j 15h 32m 50s.',true);editorRows();return;}
 const leader=draft.results.find(r=>r.status==='finished'&&r.position===1);
 if(field==='elapsedSeconds'){
  row.elapsedSeconds=seconds;
  row.gapSeconds=seconds!==null&&leader?.elapsedSeconds!=null?seconds-leader.elapsedSeconds:null;
  if(seconds!==null&&row.gapSeconds!==null&&row.gapSeconds<0){notify('Chrono antérieur à celui du vainqueur.',true);row.gapSeconds=null;}
  if(row===leader)for(const other of draft.results){
   if(other.status!=='finished'||other.elapsedSeconds==null)continue;
   other.gapSeconds=other.elapsedSeconds-seconds;
  }
 }else{
  row.gapSeconds=seconds;
  row.elapsedSeconds=seconds!==null&&leader?.elapsedSeconds!=null?leader.elapsedSeconds+seconds:null;
 }
 editorRows();
}
function editorRows(){
 if(!draft)return;
 const known=new Map(editorMembers().map(m=>[m.id,m]));
 $('team-participants-count').textContent=draft.results.length+' / 50 participants';
 $('team-result-rows').innerHTML=draft.results.map(row=>{
  const name=known.get(row.skipperId)?.name||'Skipper inconnu';
  const n=draft.results.length,sc=row.status==='finished'&&row.position?engine.primary(draft.vsr,n,row.position):0;
  const hc=row.status==='finished'&&row.position?engine.historical(row.position):0;
  return '<div class="team-result-row" data-team-row="'+esc(row.skipperId)+'"><span class="team-result-name" title="'+esc(name)+'">'+esc(name)+'</span>'+
   '<input type="number" min="1" max="50" step="1" inputmode="numeric" data-team-rank="'+esc(row.skipperId)+'" aria-label="Rang de '+esc(name)+'" value="'+(row.position??'')+'"'+(row.status==='dnf'?' disabled':'')+' placeholder="Rang">'+
   '<input type="number" min="1" max="100000000" step="1" inputmode="numeric" data-team-general-rank="'+esc(row.skipperId)+'" aria-label="Classement général VR de '+esc(name)+'" title="Rang général Virtual Regatta distinct du rang LPDB" value="'+(row.generalRank??'')+'"'+(row.status==='dnf'?' disabled':'')+' placeholder="Général">'+
   '<select data-team-status="'+esc(row.skipperId)+'" aria-label="Résultat de '+esc(name)+'">'+opts([{value:'pending',label:'À saisir'},{value:'finished',label:'Classé'},{value:'dnf',label:'DNF'}],row.status)+'</select>'+
   '<input type="text" data-team-elapsed="'+esc(row.skipperId)+'" aria-label="Temps total de '+esc(name)+'" placeholder="09j 15h…" value="'+(row.elapsedSeconds!=null?esc(clock.formatTime(row.elapsedSeconds)):'')+'"'+(row.status!=='finished'?' disabled':'')+'>'+
   '<input type="text" data-team-gap="'+esc(row.skipperId)+'" aria-label="Écart au vainqueur de '+esc(name)+'" placeholder="+ 03h…" value="'+(row.gapSeconds!=null?'+ '+esc(clock.formatTime(row.gapSeconds)):'')+'"'+(row.status!=='finished'?' disabled':'')+'>'+
   '<strong class="team-result-points">'+(row.status==='dnf'?'0 / 0':row.status==='finished'?num(sc)+' / '+num(hc):'—')+'</strong><button type="button" class="team-remove-row" data-team-remove="'+esc(row.skipperId)+'" title="Retirer '+esc(name)+'">×</button></div>';
 }).join('')||empty('Ajoute les participants depuis l’effectif.');
 editorSummary();
}
function editorSummary(){
 if(!draft)return;
 const known=new Map(editorMembers().map(m=>[m.id,m])),n=draft.results.length;
 const scores=draft.results.filter(x=>x.status==='finished').reduce((sum,x)=>sum+engine.primary(draft.vsr,n,x.position),0);
 const pending=draft.results.filter(x=>x.status==='pending').length;
 const error=draft.status==='finished'?engine.verifyRace({...draft,dateEnd:$('team-race-date').value},known):'';
 $('team-race-validation').textContent=error|| (pending?pending+' résultat(s) en attente':'Classement prêt à enregistrer');
 $('team-race-validation').dataset.error=error?'true':'false';
 const winner=draft.results.find(x=>x.status==='finished'&&x.position===1);
 $('team-race-preview').textContent=num(scores)+' points principaux · '+n+' participants · palier '+(engine.tier(n)*5+10)+(winner?.elapsedSeconds!=null?' · Temps du 1er : '+clock.formatTime(winner.elapsedSeconds):'');
}
function fillSharedFields(){
 if(!draft)return;
 $('team-race-name').value=draft.name||'';
 $('team-race-date').value=draft.dateEnd||'';
 $('team-race-vsr').value=draft.vsr||'vsr2';
 $('team-race-status').value=draft.status||'planned';
 $('team-race-group').value=draft.stageGroup||'';
 for(const [field,id] of Object.entries(detailInputs))$(id).value=draft[field]||'';
}
function renderPersonalLink(){
 if(!draft)return;
 const linked=personalById(draft.personalRaceId);
 const otherLinks=new Set(raw().filter(x=>x.type==='team-race'&&x.id!==draft.id).map(x=>x.personalRaceId).filter(Boolean));
 const choices=personal().filter(x=>x.kind==='race'&&(!otherLinks.has(x.id)||x.id===draft.personalRaceId));
 const selector=$('team-race-personal');
 selector.innerHTML='<option value="">Aucune · course indépendante</option>'+
  opts(choices.map(p=>({value:p.id,label:p.name+(p.end?' · '+p.end:'')})),draft.personalRaceId||'');
 selector.value=choices.some(p=>p.id===draft.personalRaceId)?draft.personalRaceId:'';
 for(const id of ['team-race-name','team-race-date','team-race-vsr',...Object.values(detailInputs)])
  $(id).disabled=!!linked;
 const help=$('team-linked-help'),photo=$('team-linked-image');
 help.textContent=linked?'↔ Détails communs synchronisés depuis « Mes courses ». Les positions, DNF et points de l’équipe restent indépendants.':
  draft.personalRaceId?'La fiche personnelle associée est introuvable. Dissocie-la pour rendre les champs modifiables.':
  'Choisis une course personnelle et clique sur « Utiliser ses détails ». Les résultats de l’équipe restent indépendants.';
 if(linked&&/^data:image\/(png|webp|jpeg|gif);base64,/i.test(linked.icon||'')){
  photo.innerHTML='<img src="'+esc(linked.icon)+'" alt="Visuel de '+esc(linked.name)+'">';
  photo.hidden=false;
 }else{photo.innerHTML='';photo.hidden=true;}
 const isSaved=raw().some(x=>x.type==='team-race'&&x.id===draft.id);
 document.querySelector('[data-team-action="new-personal"]').disabled=!!linked||!isSaved;
 document.querySelector('[data-team-action="open-personal"]').disabled=!linked;
 document.querySelector('[data-team-action="unlink-personal"]').disabled=!draft.personalRaceId;
}
function fromPersonalId(id){
 if(!canWrite())return;
 const p=personalById(id);if(!p){notify('Fiche personnelle introuvable.',true);return;}
 const existing=races().find(r=>r.personalRaceId===id);
 if(existing){api.showTeam?.();return openRace(existing.id);}
 api.showTeam?.();
 openRace(null,id);
}
function openRace(id,personalId=''){
 if(!canWrite())return;
 const existing=id?races().find(r=>r.id===id):null;
 const p=personalById(personalId);
 const base=existing?structuredClone(existing):{id:uuid('race'),type:'team-race',name:'',dateEnd:'',
  vsr:'vsr2',status:'planned',stageGroup:'',results:[],createdAt:stamp()};
 draft=p?engine.fromPersonal(p,base):base;
 draft.newMembers=[];rankingImport=null;
 $('team-ranking-import-body').hidden=true;
 $('team-ranking-paste').value='';
 document.querySelector('[data-team-action="toggle-ranking-import"]').setAttribute('aria-expanded','false');
 previewImport();
 $('team-race-dialog-title').textContent=id?'MODIFIER LA COURSE':'NOUVELLE COURSE D’ÉQUIPE';
 fillSharedFields();renderPersonalLink();
 $('team-create-member').value='';
 $('team-select-member').value='';
 choices();editorRows();$('team-race-dialog').showModal();
}
function choices(){
 const chosen=new Set(draft?.results.map(x=>x.skipperId)||[]);
 $('team-select-member').innerHTML='<option value="">Choisir un skipper…</option>'+
 opts(editorMembers().filter(m=>!chosen.has(m.id)).sort((a,b)=>a.name.localeCompare(b.name,'fr'))
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
 const linked=personalById(draft.personalRaceId);
 if(linked)draft=engine.fromPersonal(linked,draft);
 else{
  draft.name=$('team-race-name').value.trim().slice(0,160);
  draft.dateEnd=$('team-race-date').value;draft.vsr=$('team-race-vsr').value;
  for(const [field,id] of Object.entries(detailInputs))draft[field]=$(id).value;
 }
 draft.status=$('team-race-status').value;draft.stageGroup=$('team-race-group').value.trim().slice(0,100);
 if(!draft.name){notify('Renseigne le nom de la course.',true);return;}
 const invalidGeneral=draft.results.some(row=>row.generalRank!=null&&
  (!Number.isSafeInteger(row.generalRank)||row.generalRank<1||row.generalRank>100000000));
 if(invalidGeneral){notify('Classement général VR invalide : indique un rang entier positif ou laisse vide.',true);return;}
 if(draft.status==='finished'){
  const issue=engine.verifyRace(draft,new Map(editorMembers().map(m=>[m.id,m])));
  if(issue){notify(issue,true);editorSummary();return;}
 }
 const race=engine.race({...draft,updatedAt:stamp()});
 if(!race){notify('Fiche de course invalide.',true);return;}
 try{
  await api.saveRaceBundle(race,draft.newMembers||[]);
  $('team-race-dialog').close();draft=null;rankingImport=null;
  render();notify('Course et chronos enregistrés ✓');
 }catch(error){notify('Enregistrement impossible : '+(error?.message||error),true);}
}
function openBulkMembers(){
 if(!canWrite())return;
 $('team-bulk-input').value='';
 bulkSaving=false;
 renderBulkPreview();
 $('team-bulk-dialog').showModal();
 $('team-bulk-input').focus();
}
function renderBulkPreview(){
 const result=engine.prepareMemberBatch($('team-bulk-input').value,members());
 const preview=$('team-bulk-preview'),submit=$('team-bulk-submit');
 const blocked=result.invalid.length>0||result.overflow>0;
 submit.disabled=bulkSaving||blocked||!result.accepted.length;
 submit.textContent=bulkSaving?'ENREGISTREMENT…':'AJOUTER '+result.accepted.length+' SKIPPER'+(result.accepted.length>1?'S':'');
 preview.innerHTML='<div class="team-bulk-metrics">'+
  '<div><strong>'+result.accepted.length+'</strong><span>Nouveaux</span></div>'+
  '<div><strong>'+result.duplicates.length+'</strong><span>Doublons ignorés</span></div>'+
  '<div><strong>'+result.available+'</strong><span>Places disponibles</span></div></div>'+
  (result.accepted.length?'<p class="team-bulk-names"><b>À ajouter :</b> '+result.accepted.slice(0,12).map(esc).join(' · ')+(result.accepted.length>12?' · …':'')+'</p>':'')+
  (result.duplicates.length?'<p class="team-bulk-note">Déjà présents ou répétés : '+result.duplicates.slice(0,8).map(x=>esc(x.name)).join(', ')+(result.duplicates.length>8?'…':'')+'</p>':'')+
  (result.invalid.length?'<p class="team-bulk-error">Pseudo(s) invalide(s) aux lignes : '+result.invalid.slice(0,8).map(x=>x.line).join(', ')+'. Corrige la liste avant l’import.</p>':'')+
  (result.overflow?'<p class="team-bulk-error">Effectif plein : '+result.accepted.length+' nouveaux skippers pour '+result.available+' place(s). Réduis la liste pour importer en une seule fois.</p>':'')+
  (!result.accepted.length&&!result.invalid.length?'<p class="team-bulk-note">Colle les pseudos dans la zone de texte, un par ligne.</p>':'');
 return result;
}
async function submitBulkMembers(ev){
 ev.preventDefault();
 if(bulkSaving||!canWrite())return;
 const state=renderBulkPreview();
 if(!state.accepted.length||state.invalid.length||state.overflow)return;
 if(!api.saveBatch){notify('Importation groupée indisponible.',true);return;}
 const snapshot=$('team-bulk-input').value;
 const timestamp=stamp();
 const rows=state.accepted.map(name=>engine.member({
  id:uuid('member'),name,status:'active',createdAt:timestamp,updatedAt:timestamp
 }));
 bulkSaving=true;
 renderBulkPreview();
 try{
  await api.saveBatch(rows);
  $('team-bulk-dialog').close();
  $('team-bulk-input').value='';
  notify(rows.length+' skipper'+(rows.length>1?'s':'')+' ajouté'+(rows.length>1?'s':'')+' à l’effectif LPDB ✓'+
   (state.duplicates.length?' · '+state.duplicates.length+' doublon(s) ignoré(s).':''));
 }catch(error){
  $('team-bulk-input').value=snapshot;
  notify('Importation non effectuée : '+(error?.message||error),true);
 }finally{
  bulkSaving=false;
  renderBulkPreview();
 }
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
 const memberships=(editingMember?.memberships||[]).map(w=>({...w}));
 const previous=editingMember?.status;
 if(previous==='former'&&status==='active'){
  // The previous membership remains closed; a returning skipper starts a new one.
  if(memberships.length&&!memberships[memberships.length-1].until)
   memberships[memberships.length-1].until=editingMember.until||today();
  memberships.push({from:from||today(),until:''});
 }else if(memberships.length)memberships[memberships.length-1]={from,until};
 else memberships.push({from,until});
 const latest=memberships[memberships.length-1];
 const m=engine.member({id:editingMember?.id||uuid('member'),name,status,
  from:latest.from,until:latest.until,memberships,createdAt:editingMember?.createdAt||stamp(),updatedAt:stamp()});
 if(await saveEntity(m)){$('team-member-dialog').close();editingMember=null;notify('Skipper enregistré ✓');}
}
function showProfile(id){
 const m=members().find(x=>x.id===id);if(!m)return;
 const model=engine.standings(all(),period(),viewMode),s=model.skippers.find(x=>x.id===id);
 const content='<div class="team-profile-head"><h3>'+esc(m.name)+'</h3><small>'+esc(m.status==='active'?'Membre actif':'Ancien membre')+' · '+esc(labelPeriod())+'</small><small>'+esc((m.memberships||[]).filter(w=>w.from||w.until).map(w=>(w.from||'Début inconnu')+' → '+(w.until||'En cours')).join(' · '))+'</small></div>'+
 (s?statCards([['Points',num(s.points)],['Points / course',num(s.avg)],['Courses terminées',num(s.finished)],['Victoires',num(s.wins)],['Podiums',num(s.podiums)],['Assiduité',num(s.attendance)+' %'],['Prestige moyen',num(s.prestige)],['Départage hybride',num(s.hybrid)],['Courses chronométrées',num(s.timedRaces)],['Chrono moyen',clockLabel(s.avgTimeSeconds)],['Écart moyen',clockLabel(s.avgGapSeconds)],['Meilleur rang général VR',s.bestGeneralRank!=null?'#'+num(s.bestGeneralRank):'—']])+
 '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>COURSE</th><th>RANG LPDB</th><th>GÉNÉRAL VR</th><th>VSR</th><th>CHRONO</th><th>ÉCART</th><th>POINTS</th></tr></thead><tbody>'+
 s.records.slice().sort((a,b)=>b.dateEnd.localeCompare(a.dateEnd)).map(r=>'<tr><td>'+esc(r.raceName)+'<small>'+esc(r.dateEnd)+'</small></td><td>'+ (r.dnf?'DNF':r.rank)+'</td><td>'+(r.generalRank!=null?'#'+num(r.generalRank):'—')+'</td><td>'+esc(r.vsr.toUpperCase())+'</td><td>'+clockLabel(r.elapsedSeconds)+'</td><td>'+clockLabel(r.gapSeconds)+'</td><td>'+num(viewMode==='historic'?r.historic:r.main)+'</td></tr>').join('')+'</tbody></table></div>':empty('Aucune participation sur cette période.'));
 $('team-profile-body').innerHTML=content;
 $('team-profile-dialog').showModal();
}
function showRaceRanking(id){
 const r=races().find(x=>x.id===id);if(!r)return;
 const names=new Map(members().map(m=>[m.id,m.name]));
 const scored=engine.scoredRace(r,new Map(members().map(m=>[m.id,m])));
 const byId=new Map(scored.map(row=>[row.skipperId,row]));
 const rows=[...r.results].sort((a,b)=>(a.status==='dnf'?999:a.position??998)-(b.status==='dnf'?999:b.position??998));
 $('team-classification-title').textContent='CLASSEMENT · '+r.name;
 $('team-classification-body').innerHTML='<p class="team-footnote">'+esc(r.dateEnd||'Date inconnue')+' · '+esc(r.vsr.toUpperCase())+' · '+
  (r.status==='finished'&&scored.length?'Résultats validés':'Résultats non encore validés au championnat')+'</p>'+
 '<div class="team-table-wrap"><table class="team-table"><thead><tr><th>RANG LPDB</th><th>SKIPPER</th><th>GÉNÉRAL VR</th><th>CHRONO TOTAL</th><th>ÉCART AU 1ER</th><th>PRINCIPAL</th><th>HISTORIQUE</th></tr></thead><tbody>'+
 rows.map(row=>{
  const points=byId.get(row.skipperId);
  return '<tr><td>'+(row.status==='dnf'?'DNF':row.position??'—')+'</td><td>'+esc(names.get(row.skipperId)||'Skipper inconnu')+'</td>'+ 
   '<td>'+(row.generalRank!=null?'#'+num(row.generalRank):'—')+'</td>'+
   '<td>'+clockLabel(row.elapsedSeconds)+'</td><td>'+(row.gapSeconds!=null?'+ '+clockLabel(row.gapSeconds):'—')+'</td>'+
   '<td>'+num(points?.main??0)+'</td><td>'+num(points?.historic??0)+'</td></tr>';
 }).join('')+'</tbody></table></div>'+
 '<p class="team-footnote">Les chronos sont des durées de course. Les écarts restent calculés par rapport au premier skipper.</p>';
 $('team-race-classification-dialog').showModal();
}
let currentStage='';
function stageDialog(group){
 currentStage=group;
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
 const raceTimed=rows.some(r=>r.raceResult===true);
 const batch=style==='table'?25:Math.max(3,limit||10);
 const pages=Math.ceil(source.length/batch);
 for(let p=0;p<pages;p++){
  const segment=source.slice(p*batch,(p+1)*batch);
  const w=1080,isPodium=style==='social'&&limit===3,topList=style==='social'&&!isPodium;
  const unit=style==='table'?63:67,h=isPodium?1150:topList?Math.max(1390,680+unit*segment.length):Math.max(930,520+unit*segment.length);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.28,'#e8eaeb');gradient.addColorStop(.62,'#fcfcfc');gradient.addColorStop(1,'#dfe2e3');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#aab0b3';ctx.lineWidth=5;ctx.strokeRect(24,24,w-48,h-48);
  ctx.fillStyle='#8d9498';ctx.fillRect(28,28,12,h-56);
  if(img){const ratio=img.width/img.height;ctx.drawImage(img,w/2-125,42,250,250/ratio);}
  ctx.fillStyle='#30353a';ctx.textAlign='center';ctx.font='900 53px Poppins, sans-serif';ctx.fillText('RAPLI REGATTA',w/2,286);
  ctx.fillStyle='#5b6368';ctx.font='800 26px Poppins, sans-serif';ctx.fillText(title.toLocaleUpperCase('fr').slice(0,56),w/2,331);
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
    grad.addColorStop(0,'#fdfdfd');grad.addColorStop(.52,'#e4e7e8');grad.addColorStop(1,'#f9fafb');
    drawRounded(ctx,x,y,wid,h,15,grad);
    ctx.lineWidth=4;ctx.strokeStyle=colors[i];ctx.strokeRect(x+3,y+3,wid-6,h-6);
    ctx.textAlign='center';ctx.fillStyle=colors[i];ctx.font='900 80px Poppins,sans-serif';
    ctx.fillText(String(s.rank??i+1),x+wid/2,y+100);
    ctx.fillStyle='#34393e';ctx.font='850 30px Poppins,sans-serif';
    ctx.fillText(s.name.slice(0,15).toUpperCase(),x+wid/2,y+166);
    ctx.fillStyle='#3c4349';ctx.font='900 38px Poppins,sans-serif';
    ctx.fillText((s.exportValue||num(s.points)+' PTS'),x+wid/2,y+231);
    ctx.fillStyle='#656e74';ctx.font='600 18px Poppins,sans-serif';
    ctx.fillText(raceTimed?('CHRONO '+clockLabel(s.elapsedSeconds)).slice(0,28):num(s.participations)+' courses · '+num(s.wins)+' victoire(s)',x+wid/2,raceTimed?y+260:y+283);
    if(raceTimed){
     ctx.font='650 17px Poppins,sans-serif';
     ctx.fillText('ÉCART +'+clockLabel(s.gapSeconds),x+wid/2,y+284);
     ctx.fillText('GÉNÉRAL VR '+(s.generalRank!=null?'#'+num(s.generalRank):'—'),x+wid/2,y+310);
    }
   });
  }else{
   const topY=topList?640:445,headY=topList?619:427;
   if(topList&&segment[0]){
    drawRounded(ctx,65,389,w-130,180,18,'#e8eaeb');
    ctx.strokeStyle='#e7bb45';ctx.lineWidth=4;ctx.strokeRect(68,392,w-136,174);
    ctx.textAlign='left';ctx.fillStyle='#806b35';ctx.font='850 22px Poppins,sans-serif';
    ctx.fillText('CHAMPION DU CLASSEMENT',105,433);
    ctx.fillStyle='#32373c';ctx.font='900 41px Poppins,sans-serif';
    ctx.fillText(segment[0].name.slice(0,22).toUpperCase(),105,490);
    ctx.fillStyle='#796229';ctx.textAlign='right';ctx.font='900 51px Poppins,sans-serif';
    ctx.fillText(segment[0].exportValue||num(segment[0].points)+' PTS',w-105,490);
    if(raceTimed&&segment[0].generalRank!=null){
     ctx.textAlign='left';ctx.fillStyle='#626a70';ctx.font='700 18px Poppins,sans-serif';
     ctx.fillText('CLASSEMENT GÉNÉRAL VR · #'+num(segment[0].generalRank),105,534);
    }
   }
   ctx.fillStyle='#545d62';ctx.textAlign='left';ctx.font='700 22px Poppins,sans-serif';
   ctx.fillText('RANG',70,headY);ctx.fillText('SKIPPER',200,headY);
   ctx.textAlign='right';ctx.font='700 18px Poppins,sans-serif';
   if(raceTimed){
    ctx.fillText('GÉN. VR',w-550,headY);
    ctx.fillText('CHRONO',w-380,headY);
    ctx.fillText('ÉCART',w-215,headY);
   }else{
    ctx.fillText('COURSES',w-535,headY);
    ctx.fillText('CHRONO MOY.',w-345,headY);
    ctx.fillText('ÉCART MOY.',w-170,headY);
   }
   ctx.fillText('POINTS',w-75,headY);
   segment.forEach((s,i)=>{
    const y=topY+i*unit;
    drawRounded(ctx,58,y,w-116,unit-5,10,topList&&i===0?'#f5eedc':i%2?'#f8f9f9':'#ebedef');
    if(topList&&i===0){ctx.strokeStyle='#e7bd46';ctx.lineWidth=3;ctx.strokeRect(60,y+1,w-120,unit-8);}
    const rank=Number.isInteger(s.rank)?s.rank:p*batch+i+1;
    const labels=[s.dnf?'DNF':String(rank),s.name,raceTimed?pngClock(s.elapsedSeconds):String(s.participations??0),raceTimed?(s.gapSeconds!=null?'+'+pngClock(s.gapSeconds):'—'):pngClock(s.avgGapSeconds),s.exportValue||num(s.points??0)];
    ctx.textBaseline='middle';
    ctx.fillStyle=rank===1&&!s.dnf?'#f5ca63':rank===2&&!s.dnf?'#d6dce6':rank===3&&!s.dnf?'#d5a277' :'#42494f';
    ctx.textAlign='left';ctx.font='800 29px Poppins,sans-serif';ctx.fillText(labels[0],88,y+unit/2);
    ctx.fillStyle='#343b40';ctx.font='750 24px Poppins,sans-serif';ctx.fillText(labels[1].slice(0,raceTimed?13:16),200,y+unit/2);
    ctx.textAlign='right';ctx.font='650 23px Poppins,sans-serif';
    ctx.font='600 17px Poppins,sans-serif';
    if(raceTimed){
     ctx.fillText(s.generalRank!=null?'#'+num(s.generalRank):'—',w-550,y+unit/2);
     ctx.fillText(labels[2],w-380,y+unit/2);
     ctx.fillText(labels[3],w-215,y+unit/2);
    }else{
     ctx.fillText(labels[2],w-535,y+unit/2);
     ctx.fillText(pngClock(s.avgTimeSeconds),w-345,y+unit/2);
     ctx.fillText(labels[3],w-170,y+unit/2);
    }
    ctx.font='850 29px Poppins,sans-serif';ctx.fillStyle='#343a40';ctx.fillText(labels[4],w-75,y+unit/2);
   });
  }
  ctx.font='600 20px Poppins,sans-serif';ctx.textAlign='center';ctx.fillStyle='#7a8287';
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
 if(kind==='png-podium'){
  if(!list.some(s=>s.points>0)){notify('Aucun podium récompensé avant la première course classée.',true);return;}
  style='social';limit=3;
 }
 if(kind==='png-top10'){style='social';limit=10;}
 if(kind==='png-stats'||kind==='png-stats-social'){
  list=[...model.skippers].sort((a,b)=>statMode==='avg'?b.avg-a.avg:statMode==='finish'?b.finishRate-a.finishRate:statMode==='wins'?b.wins-a.wins:statMode==='time'?(a.avgTimeSeconds??Infinity)-(b.avgTimeSeconds??Infinity):statMode==='gap'?(a.avgGapSeconds??Infinity)-(b.avgGapSeconds??Infinity):b.points-a.points);
  list=list.map((s,i)=>({...s,rank:i+1,points:statMode==='avg'?s.avg:statMode==='finish'?s.finishRate:statMode==='wins'?s.wins:s.points,exportValue:null}));
  if(kind==='png-stats-social'){style='social';limit=10;}
  filename+='-stat-'+statMode;
  title=({avg:'Points par course',finish:'Taux de finition',wins:'Victoires',points:'Points cumulés',time:'Chrono moyen',gap:'Écart moyen'})[statMode]+' · '+labelPeriod();
 }
 if(kind==='race'||kind==='race-top10'||kind==='race-podium'){
  const race=races().find(x=>x.id===arg);
  if(!race)return;
  const scores=engine.scoredRace(race,new Map(members().map(m=>[m.id,m])));
  list=scores.sort((a,b)=>(a.rank??999)-(b.rank??999)).map((s,i)=>({
   name:members().find(m=>m.id===s.skipperId)?.name||'Inconnu',rank:s.rank??null,dnf:s.dnf,
   points:viewMode==='historic'?s.historic:s.main,participations:1,wins:Number(s.rank===1),raceResult:true,
   elapsedSeconds:s.elapsedSeconds??null,gapSeconds:s.gapSeconds??null,generalRank:s.generalRank??null
  }));
  if(!list.length){notify('Valide tous les résultats avant d’exporter la course.',true);return;}
  filename='lpdb-course-'+race.id;
  if(kind==='race-top10'){style='social';limit=10;}
  if(kind==='race-podium'){style='social';limit=3;}
  return exportStandings(list,race.name+' · '+race.dateEnd,{style,limit,prefix:filename});
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
 const remove=ev.target.closest('[data-team-remove]');if(remove&&draft){draft.results=draft.results.filter(x=>x.skipperId!==remove.dataset.teamRemove);draft.newMembers=(draft.newMembers||[]).filter(m=>draft.results.some(r=>r.skipperId===m.id));choices();editorRows();return;}
 const button=ev.target.closest('[data-team-action]');if(!button)return;
 const cmd=button.dataset.teamAction;
 if(button.closest('.team-race-menu'))button.closest('.team-race-menu').open=false;
 if(cmd==='new-race')return openRace();
 if(cmd.startsWith('show-ranking-'))return showRaceRanking(cmd.slice('show-ranking-'.length));
 if(cmd==='toggle-ranking-import'){
  const body=$('team-ranking-import-body'),open=body.hidden;
  body.hidden=!open;button.setAttribute('aria-expanded',String(open));
  if(open)$('team-ranking-paste').focus();
  return;
 }
 if(cmd==='analyze-ranking'){analyzeRanking();return;}
 if(cmd==='apply-ranking'){applyRanking();return;}
 if(cmd==='new-member')return openMember();
 if(cmd==='bulk-members')return openBulkMembers();
 if(cmd==='link-existing'&&draft){
  const id=$('team-race-personal').value,p=personalById(id);
  if(!p){notify('Choisis une fiche personnelle existante.',true);return;}
  const linkedElsewhere=races().some(r=>r.personalRaceId===p.id&&r.id!==draft.id);
  if(linkedElsewhere){notify('Cette fiche personnelle est déjà liée à une autre course d’équipe.',true);return;}
  draft=engine.fromPersonal(p,draft);fillSharedFields();renderPersonalLink();editorRows();return;
 }
 if(cmd==='unlink-personal'&&draft){
  draft.personalRaceId='';renderPersonalLink();notify('Liaison retirée dans le formulaire. Enregistre la course pour confirmer.');return;
 }
 if(cmd==='open-personal'){
  const linked=personalById(draft?.personalRaceId);
  if(linked){$('team-race-dialog').close();api.openPersonal?.(linked.id);}
  else notify('Aucune fiche personnelle associée.',true);
  return;
 }
 if(cmd==='new-personal'){
  if(!draft||!raw().some(r=>r.id===draft.id)){notify('Enregistre d’abord la course d’équipe.',true);return;}
  $('team-race-dialog').close();api.newPersonalFromTeam?.(draft.id);return;
 }
 if(cmd.startsWith('open-personal-')){api.openPersonal?.(cmd.slice(14));return;}
 if(cmd.startsWith('new-personal-')){api.newPersonalFromTeam?.(cmd.slice(13));return;}
 if(cmd==='recalculate'){render();notify('Tous les classements ont été recalculés ✓');return;}
 if(cmd==='select-all'&&draft){
  for(const m of members().filter(active))if(draft.results.length<50&&!draft.results.some(x=>x.skipperId===m.id))
   draft.results.push({skipperId:m.id,status:'pending',position:null});
  choices();editorRows();return;
 }
 if(cmd==='add-member'&&draft){const id=$('team-select-member').value;if(id)addMemberToDraft(id);return;}
 if(cmd==='create-member'&&draft)return void quickMember();
 if(cmd==='previous'){page=Math.max(1,page-1);if($('team-stage-dialog')?.open)stageDialog(currentStage);else renderMain();return;}
 if(cmd==='next'){page++;if($('team-stage-dialog')?.open)stageDialog(currentStage);else renderMain();return;}
 if(cmd.startsWith('show-ranking-'))return showRaceRanking(cmd.slice(13));
 if(cmd.startsWith('race-'))return openRace(cmd.slice(5));
 if(cmd.startsWith('member-'))return openMember(cmd.slice(7));
 if(cmd.startsWith('profile-'))return showProfile(cmd.slice(8));
 if(cmd.startsWith('delete-race-'))return void deleteRace(cmd.slice(12));
 if(cmd.startsWith('export-race-top10-'))return void doExport('race-top10',cmd.slice('export-race-top10-'.length));
 if(cmd.startsWith('export-race-podium-'))return void doExport('race-podium',cmd.slice('export-race-podium-'.length));
 if(cmd.startsWith('export-race-'))return void doExport('race',cmd.slice('export-race-'.length));
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
 if(el.id==='team-member-status'){
  if(el.value==='former'&&!$('team-member-until').value)$('team-member-until').value=today();
  if(el.value==='active'&&editingMember?.status==='former'){
   $('team-member-from').value=today();$('team-member-until').value='';
  }
  return;
 }
 if(['team-from','team-to','team-stats-from','team-stats-to'].includes(el.id)){if(el.id.endsWith('-from'))customFrom=el.value;else customTo=el.value;page=1;render();return;}
 if(el.id==='team-race-status'||el.id==='team-race-vsr'||el.id==='team-race-date'){
  if(draft){draft.vsr=$('team-race-vsr').value;draft.status=$('team-race-status').value;editorRows();}
 }
 if(el.dataset.teamImportGeneral!==undefined&&rankingImport){previewImport();return;}
 if(el.dataset.teamImportSelect!==undefined&&rankingImport){
  const item=rankingImport.rows[Number(el.dataset.teamImportSelect)];
  if(item){item.skipperId=el.value;previewImport();}
  return;
 }
 if(el.dataset.teamElapsed&&draft){
  syncEditorTimes(draft.results.find(r=>r.skipperId===el.dataset.teamElapsed),'elapsedSeconds',el.value);return;
 }
 if(el.dataset.teamGap&&draft){
  syncEditorTimes(draft.results.find(r=>r.skipperId===el.dataset.teamGap),'gapSeconds',el.value);return;
 }
 if(el.dataset.teamStatus&&draft){
  const row=draft.results.find(r=>r.skipperId===el.dataset.teamStatus);
  if(row){row.status=el.value;row.position=row.status==='finished'?row.position:null;if(row.status==='dnf')row.generalRank=null;editorRows();}
 }
}
function input(ev){
 const el=ev.target;
 if(el.id==='team-bulk-input'){renderBulkPreview();return;}
 if(el.dataset.teamImportGeneral!==undefined&&rankingImport){
  const item=rankingImport.rows[Number(el.dataset.teamImportGeneral)];
  if(item){item.generalRank=el.value.trim()?Number(el.value):null;
   // Keep editing focus; final validation is performed before applying the classification.
  }
  return;
 }
 if(el.dataset.teamImportName!==undefined&&rankingImport){
  const item=rankingImport.rows[Number(el.dataset.teamImportName)];
  if(item){item.newName=el.value;
   const submit=$('team-ranking-apply');
   submit.disabled=!item.newName.trim()||/\.{2,}|…/u.test(item.newName);
  }
  return;
 }
 if(el.id==='team-search'){search=el.value;page=1;renderMain();$('team-search')?.focus();$('team-search')?.setSelectionRange(search.length,search.length);return;}
 if(el.dataset.teamGeneralRank&&draft){
  const row=draft.results.find(r=>r.skipperId===el.dataset.teamGeneralRank);
  if(row){row.generalRank=el.value.trim()?Number(el.value):null;editorSummary();}
  return;
 }
 if(el.dataset.teamRank&&draft){
  const row=draft.results.find(r=>r.skipperId===el.dataset.teamRank);
  if(row){
   row.position=el.value?Number(el.value):null;
   if(row.status==='pending'&&row.position!==null){
    row.status='finished';
    const select=el.closest('.team-result-row')?.querySelector('[data-team-status]');
    if(select)select.value='finished';
    el.closest('.team-result-row')?.querySelectorAll('[data-team-elapsed],[data-team-gap]').forEach(field=>{field.disabled=false;});
   }
   const n=draft.results.length,p=el.closest('.team-result-row')?.querySelector('.team-result-points');
   if(p)p.textContent=row.status==='finished'&&row.position?num(engine.primary(draft.vsr,n,row.position))+' / '+num(engine.historical(row.position)):'—';
   editorSummary();
  }
 }
}
function init(bridge){
 api=bridge;
 document.addEventListener('click',click);
 document.addEventListener('change',change);
 document.addEventListener('input',input);
 $('team-race-form')?.addEventListener('submit',submitRace);
 $('team-member-form')?.addEventListener('submit',submitMember);
 $('team-bulk-form')?.addEventListener('submit',submitBulkMembers);
 document.querySelectorAll('[data-team-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));
 for(const id of ['team-race-dialog','team-race-classification-dialog','team-member-dialog','team-bulk-dialog','team-stage-dialog','team-profile-dialog']){
  $(id)?.addEventListener('click',ev=>{if(ev.target===ev.currentTarget)ev.currentTarget.close();});
 }
 render();
}
root.RapliTeamUI={init,render,getPeriod:period,getViewMode:()=>viewMode,openFromPersonal:fromPersonalId};
})(window);
