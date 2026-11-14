/* Rapli Regatta — race archive, private IndexedDB collection, Supabase bridge. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(v,n=150)=>String(v??'').trim().slice(0,n);
const uid=()=>crypto.randomUUID?crypto.randomUUID():'race-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const props={name:180,boatClass:100,boat:140,start:20,startTime:8,end:20,endTime:8,rank:40,rankTotal:12,rankDepartment:40,rankDepartmentTotal:12,rankNational:40,rankNationalTotal:12,rankCity:40,rankCityTotal:12,rankTeam:40,rankTeamTotal:12,duration:100,durationDays:4,durationHours:2,durationMinutes:2,durationSeconds:2,vsr:5,participantCount:12,gainPoints:9,gainCredits:9};
const imageKeys=['icon','result','route'];

/* A date and clock time represent the course's own civil time.
   UTC-based calendar arithmetic avoids differences between users' browser timezones. */
function parseRaceDuration(raw){
 const source=String(raw??'').trim().toLowerCase().replace(/\s+/g,' ');
 if(!source)return {status:'missing'};
 let text=source;
 if(/^\d{1,5}:\d{2}(?::\d{2})?$/.test(text)){
   const [h,m,sec=0]=text.split(':').map(Number);
   if(m>59||sec>59||h>87600)return {status:'invalid'};
   return {status:'valid',seconds:h*3600+m*60+sec};
 }
 // Support existing shorthand, including "8h35" and full duration with seconds.
 text=text.replace(/(\d+)\s*h\s*(\d{1,2})\s*$/,'$1h$2min');
 let seconds=0,tokens=0;
 const remaining=text.replace(/(\d+)\s*(jours?|j|heures?|h|minutes?|mins?|min|mn|m|secondes?|secs?|sec|s)(?![a-z])/g,(_match,n,unit)=>{
   const value=Number(n);
   const amount=/^(j|jour)/.test(unit)?86400:/^(h|heure)/.test(unit)?3600:/^(s|sec|seconde)/.test(unit)?1:60;
   seconds+=value*amount;tokens++;
   return ' ';
 });
 if(!tokens||remaining.trim()||!Number.isSafeInteger(seconds)||seconds>315360000)return {status:'invalid'};
 return {status:'valid',seconds};
}
function durationComponents(total){
 if(!Number.isSafeInteger(total)||total<0)return null;
 return {durationDays:String(Math.floor(total/86400)),durationHours:String(Math.floor(total%86400/3600)),durationMinutes:String(Math.floor(total%3600/60)),durationSeconds:String(total%60)};
}
function durationFromParts(r){
 const keys=['durationDays','durationHours','durationMinutes','durationSeconds'];
 const entries=keys.map(k=>String(r[k]??'').trim());
 if(entries.every(x=>x===''))return '';
 const caps=[3650,23,59,59];
 if(entries.some((v,i)=>v&&!/^\d+$/.test(v)||Number(v)>caps[i]))return null;
 const [d,h,m,sec]=entries.map(x=>Number(x||0));
 return d+' j '+h+' h '+m+' min '+sec+' s';
}
function calculateArrival(day,time,duration){
 if(!day||!time||!String(duration||'').trim())return {status:'waiting'};
 const validTime=/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
 const validDate=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 if(!validTime||!validDate)return {status:'invalid-date'};
 const [year,month,date]=validDate.slice(1).map(Number),hour=Number(validTime[1]),minute=Number(validTime[2]),second=Number(validTime[3]||0);
 const start=new Date(Date.UTC(year,month-1,date,hour,minute,second));
 if(start.getUTCFullYear()!==year||start.getUTCMonth()+1!==month||start.getUTCDate()!==date)
   return {status:'invalid-date'};
 const parsed=parseRaceDuration(duration);
 if(parsed.status!=='valid')return {status:'invalid-duration'};
 const end=new Date(start.getTime()+parsed.seconds*1000);
 if(!Number.isFinite(end.getTime())||end.getUTCFullYear()>9999)return {status:'invalid-duration'};
 const iso=end.toISOString();
 return {status:'ready',end:iso.slice(0,10),endTime:iso.slice(11,19)};
}
const dateTimeFR=(day,time)=>[dateFR(day),/^\d{2}:\d{2}(?::\d{2})?$/.test(time||'')?time:''].filter(Boolean).join(' · ');
let legacyArrival=null;
function updateArrival(){
 const date=getField('start').value,time=getField('startTime').value,duration=syncDurationInput();
 const outcome=calculateArrival(date,time,duration);
 const message=$('arrival-feedback');
 if(outcome.status==='ready'){
   getField('end').value=outcome.end;getField('endTime').value=outcome.endTime;
   message.textContent='Arrivée calculée automatiquement · '+dateTimeFR(outcome.end,outcome.endTime);
   message.dataset.state='ok';
 }else{
   const sameAsLegacy=legacyArrival&&date===legacyArrival.start&&time===legacyArrival.startTime&&
   (duration===legacyArrival.duration||(duration===''&&parseRaceDuration(legacyArrival.duration).status!=='valid'));
   getField('end').value=sameAsLegacy?legacyArrival.end:'';
   getField('endTime').value=sameAsLegacy?legacyArrival.endTime:'';
   message.dataset.state=outcome.status.startsWith('invalid')?'error':'waiting';
   if(sameAsLegacy && legacyArrival.end)
     message.textContent='Ancienne date d’arrivée conservée. Renseigne l’heure de départ et la durée pour la recalculer.';
   else if(outcome.status==='invalid-duration')
     message.textContent='Durée invalide : jours 0–3650, heures 0–23, minutes et secondes 0–59.';
   else if(outcome.status==='invalid-date')
     message.textContent='Date ou heure de départ invalide.';
   else
     message.textContent='Renseigne la date, l’heure de départ et la durée pour calculer l’arrivée.';
 }
 return outcome;
}

const equipmentModes=Object.freeze({pdd:'PDD','half-fp':'1/2 FP','full-pack':'FULL PACK'});
const validEquipment=value=>Object.prototype.hasOwnProperty.call(equipmentModes,value)?value:'';
const equipmentInputs=()=>[...document.querySelectorAll('input[name="race-equipment"]')];
const VSR=Object.freeze({hc:'HORS CATÉGORIE',vsr1:'VSR 1',vsr2:'VSR 2',vsr3:'VSR 3'});
const VSR_ORDER=Object.freeze(['hc','vsr1','vsr2','vsr3']);
const VSR_PRIORITY=value=>{const n=VSR_ORDER.indexOf(value);return n===-1?VSR_ORDER.length:n;};
const VSR_LABEL_PRIORITY=label=>{const key=VSR_ORDER.find(k=>VSR[k]===label);return key?VSR_PRIORITY(key):99;};
const DEFAULT_VSR_COLORS=Object.freeze({hc:'#d4a339',vsr1:'#dfeef5',vsr2:'#dfe8f2',vsr3:'#eaeef1'});
const moneyNumber=v=>{const raw=String(v??'').trim();return /^\d{1,9}$/.test(raw)&&Number.isSafeInteger(Number(raw))?raw:'';};
const rewardValue=v=>moneyNumber(v)?Number(v):0;
const colorSafe=v=>/^#[a-f0-9]{6}$/i.test(v||'')?v:'#008fa1';

const COLOR_SETTINGS_ID='regatta-class-colors-v1';
const COLOR_STORAGE_KEY='rapli-regatta-class-colors-v1';
const DEFAULT_TAG_COLOR='#008fa1';
const defaultClassSettings=()=>({id:COLOR_SETTINGS_ID,defaultColor:DEFAULT_TAG_COLOR,classColors:{},vsrColors:{...DEFAULT_VSR_COLORS}});
const classKey=value=>String(value||'').trim().normalize('NFKC').toLocaleUpperCase('fr').slice(0,100);
function normalizeClassSettings(input){
 const source=input&&typeof input==='object'?input:{};
 const classColors=Object.create(null);
 if(source.classColors&&typeof source.classColors==='object'&&!Array.isArray(source.classColors)){
  let count=0;
  for(const [key,value] of Object.entries(source.classColors)){
   const normalized=classKey(key);
   if(normalized&&/^#[a-f0-9]{6}$/i.test(value||'')&&count<300){
    classColors[normalized]=colorSafe(value);count++;
   }
  }
 }
 const vsrColors=Object.create(null);
 for(const key of VSR_ORDER)vsrColors[key]=/^#[a-f0-9]{6}$/i.test(source.vsrColors?.[key]||'')?colorSafe(source.vsrColors[key]):DEFAULT_VSR_COLORS[key];
 return {id:COLOR_SETTINGS_ID,defaultColor:colorSafe(source.defaultColor),classColors,vsrColors};
}
function readClassSettings(){
 try{
  const saved=localStorage.getItem(COLOR_STORAGE_KEY);
  return saved?normalizeClassSettings(JSON.parse(saved)):defaultClassSettings();
 }catch(e){console.warn('Rapli Regatta: couleurs locales indisponibles',e);return defaultClassSettings();}
}
let classSettings=readClassSettings();
function getClassTagColor(boatClass){
 const key=classKey(boatClass);
 return key&&Object.prototype.hasOwnProperty.call(classSettings.classColors,key)?
  classSettings.classColors[key]:classSettings.defaultColor;
}
function getVSRTagColor(key){return classSettings.vsrColors?.[key]||DEFAULT_VSR_COLORS[key]||'#e8f2fa';}
function settingsAreCustom(){
 return classSettings.defaultColor!==DEFAULT_TAG_COLOR||Object.keys(classSettings.classColors).length>0||
   VSR_ORDER.some(key=>getVSRTagColor(key)!==DEFAULT_VSR_COLORS[key]);
}
function colorSettingsState(){
 return settingsAreCustom()?[classSettings]:[];
}
function storeClassSettings(input,{notifyCloud=true}={}){
 classSettings=normalizeClassSettings(input);
 try{localStorage.setItem(COLOR_STORAGE_KEY,JSON.stringify(classSettings));}
 catch(e){console.warn('Rapli Regatta: impossible de mémoriser les couleurs localement',e);toast('Sauvegarde locale des couleurs indisponible',true);}
 render();
 if(notifyCloud)window.RapliModuleCloud?.changed?.();
}

const classTextColor=color=>{
 const hex=colorSafe(color).slice(1),channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255)
   .map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 const luminance=0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
 return luminance>0.30?'#132d3f':'#ffffff';
};
const intString=v=>{const raw=String(v??'').trim().replace(/\s|\u00a0/g,'');return /^\d{1,12}$/.test(raw)?String(Number(raw)):'';};
const rankPairs=[['rank','rankTotal'],['rankNational','rankNationalTotal'],['rankDepartment','rankDepartmentTotal'],['rankCity','rankCityTotal'],['rankTeam','rankTeamTotal']];
const rankDisplay=(rank,total)=>rank?rank+(total?' / '+Number(total).toLocaleString('fr-FR'):''):'';
const podiumMedalFor=(r,key,totalKey)=>{
 if(raceStatus(r)!=='finished')return '';
 const rank=rankForPodium(r,key,totalKey);
 return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'';
};
const rankHtml=(emoji,label,rank,total,kind='',medal='')=>rank?'<div class="rank-plate '+kind+'"><span class="rank-icon" aria-hidden="true">'+emoji+'</span><div class="rank-value"><span class="rank-type">'+label+'</span><div class="rank-line"><strong>'+safe(rankDisplay(rank,total))+'</strong>'+
 (medal?'<span class="rank-medal" role="img" aria-label="'+(medal==='🥇'?'Médaille d’or':medal==='🥈'?'Médaille d’argent':'Médaille de bronze')+'">'+medal+'</span>':'')+
 '</div></div></div>':'';
const validImage=v=>typeof v==='string'&&/^data:image\/(png|webp|jpeg|gif);base64,[a-z0-9+/=]+$/i.test(v);

function syncDurationInput(){
 const parts={durationDays:getField('durationDays').value,durationHours:getField('durationHours').value,durationMinutes:getField('durationMinutes').value,durationSeconds:getField('durationSeconds').value};
 const value=durationFromParts(parts);
 getField('duration').value=value===null?'invalid':value;
 return getField('duration').value;
}
function normalizeRanking(r){
 for(const [key,totalKey] of rankPairs){
   const legacy=String(r[key]||'');
   const pieces=legacy.split('/');
   const place=intString(pieces[0].trim().replace(/(?:ème|eme|er|e)$/i,''));
   const total=intString(r[totalKey]||pieces[1]||'');
   if(place){r[key]=place;r[totalKey]=total;}
   else {r[key]='';r[totalKey]='';}
 }
}
function normal(x={}){const r={id:typeof x.id==='string'&&x.id.length<130?x.id:uid(),createdAt:x.createdAt||now(),updatedAt:x.updatedAt||now(),live:!!x.live&&!x.dnf,upcoming:!!x.upcoming&&!x.live&&!x.dnf,dnf:!!x.dnf,kind:x.kind==='event'?'event':'race',eventId:clean(x.eventId,130),eventClosed:!!x.eventClosed,joker:!!x.joker,equipment:validEquipment(x.equipment),edition:clean(x.edition,100)};for(const [k,n] of Object.entries(props))r[k]=clean(x[k],n);
 r.classColor=colorSafe(x.classColor);r.notes=clean(x.notes,2500);r.vsr=VSR[r.vsr]?r.vsr:'';
 r.scoreSnapshot=x.scoreSnapshot&&typeof x.scoreSnapshot==='object'&&x.scoreSnapshot.available&&Number.isFinite(x.scoreSnapshot.value)&&x.scoreSnapshot.value>=0&&x.scoreSnapshot.value<=100?clone(x.scoreSnapshot):null;
 for(const key of ['gainPoints','gainCredits'])r[key]=moneyNumber(r[key]);
 normalizeRanking(r);
 const durationKeys=['durationDays','durationHours','durationMinutes','durationSeconds'];
 if(durationKeys.every(k=>r[k]==='')){
   const old=parseRaceDuration(r.duration);
   if(old.status==='valid')Object.assign(r,durationComponents(old.seconds));
 }
 const formatted=durationFromParts(r);
 if(formatted!==null&&formatted!=='')r.duration=formatted;
 for(const k of imageKeys)r[k]=validImage(x[k])?x[k]:'';const arrival=calculateArrival(r.start,r.startTime,r.duration);if(arrival.status==='ready'){r.end=arrival.end;r.endTime=arrival.endTime;}return r;}
let rows=[],db=null,editId='',pictures={icon:'',result:'',route:''},uploads=0,writeBusy=false,timer;
const dialog=$('race-dialog'),getField=k=>$('race-'+({boatClass:'class',startTime:'start-time',endTime:'end-time',rankDepartment:'rank-department',rankNational:'rank-national',rankTotal:'rank-total',rankNationalTotal:'rank-national-total',rankDepartmentTotal:'rank-department-total',rankCity:'rank-city',rankCityTotal:'rank-city-total',rankTeam:'rank-team',rankTeamTotal:'rank-team-total',durationDays:'days',durationHours:'hours',durationMinutes:'minutes',durationSeconds:'seconds',gainPoints:'gain-points',gainCredits:'gain-credits',participantCount:'participant-count'}[k]||k));
function toast(t,error=false){$('notice').textContent=t;$('notice').dataset.error=String(error);clearTimeout(timer);timer=setTimeout(()=>{$('notice').textContent='';},7000);}
const req=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error||Error('IndexedDB inaccessible'));});
const done=tx=>new Promise((yes,no)=>{tx.oncomplete=yes;tx.onerror=()=>no(tx.error||Error('Sauvegarde locale impossible'));tx.onabort=()=>no(tx.error||Error('Stockage local annulé'));});
async function openDB(){if(!window.indexedDB)return;const r=indexedDB.open('rapli-regatta-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('races'))r.result.createObjectStore('races',{keyPath:'id'});};db=await req(r);}
function backup(){try{return JSON.parse(localStorage.getItem('rapli-regatta-v1')||'[]');}catch{return [];}}
async function load(){return db?(await req(db.transaction('races').objectStore('races').getAll())).map(normal):backup().map(normal);}
async function saveRow(row){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify([...rows.filter(x=>x.id!==row.id),row]));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').put(row);await done(tx);}
async function deleteRow(id){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(rows.filter(x=>x.id!==id)));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').delete(id);await done(tx);}
async function replaceRows(next){if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(next));}else{const tx=db.transaction('races','readwrite'),store=tx.objectStore('races');store.clear();next.forEach(x=>store.put(x));await done(tx);}rows=next.map(normal);render();}
const raceStatus=r=>{if(r.dnf)return 'dnf';if(r.kind==='event')return r.eventClosed?'finished':r.live?'live':'planned';if(r.upcoming)return 'planned';if(r.live)return 'live';if(rankPairs.some(([key])=>r[key]))return 'finished';if(!r.end)return 'planned';if(!r.endTime)return 'finished';const current=new Date();const local=[current.getFullYear(),String(current.getMonth()+1).padStart(2,'0'),String(current.getDate()).padStart(2,'0')].join('-')+'T'+String(current.getHours()).padStart(2,'0')+':'+String(current.getMinutes()).padStart(2,'0');return (r.end+'T'+r.endTime)<=local?'finished':'planned';},statusTitle={live:'COURSE EN COURS',finished:'TERMINÉE',planned:'À VENIR',dnf:'DNF · ABANDON'};
const dateFR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const scoreEngine=window.RapliRegattaScore;
const scoreNow=r=>scoreEngine.scoreFor(r,rows,raceStatus);
function scoreView(r){
 if(raceStatus(r)==='dnf')return {available:false,reason:'DNF — sans note'};
 const saved=r.scoreSnapshot;
 if(saved?.available&&raceStatus(r)==='finished')return saved.kind!==r.kind?{available:false,reason:'Type de fiche modifié — recalcul nécessaire.'}:{...saved,stored:true,stale:saved.signature!==scoreEngine.signature(r)};
 return {...scoreNow(r),stored:false,stale:false};
}
const imageTag=(src,alt)=>validImage(src)?'<img loading="lazy" draggable="false" alt="'+safe(alt)+'" src="'+safe(src)+'">':'<span class="shot-empty">PAS DE CAPTURE</span>';
function card(r){
 const status=raceStatus(r),tag=getClassTagColor(r.boatClass),vsrTag=getVSRTagColor(r.vsr),mode=VSR[r.vsr]||'';
 const score=scoreView(r);
 // La note n'a ni cartouche ni mention, elle est placée à droite du classement général.
 const scoreRing=score.available?
  '<button type="button" class="score-orb'+(score.value>=95?' score-epic':'')+(score.value===0?' score-zero':'')+'" style="--score-sweep:'+(Math.min(100,Math.max(0,score.value))*3.6)+'deg;--score-glow:'+(score.value/100)+'" data-action="score" aria-label="Voir le détail de la note Rapli : '+safe(score.value)+' sur 100"><span>'+safe(score.value)+'</span></button>':'';
 const generalRank=status==='dnf'?'':rankHtml('🏆','CLASSEMENT GÉNÉRAL',r.rank,r.rankTotal,'rank-main',podiumMedalFor(r,'rank','rankTotal'));
 const rankBlocks=(status==='dnf'?'':(generalRank?'<div class="rank-main-row">'+generalRank+scoreRing+'</div>':'')+
   rankHtml('🇫🇷','NATIONAL',r.rankNational,r.rankNationalTotal,'rank-national',podiumMedalFor(r,'rankNational','rankNationalTotal'))+
   rankHtml('🇨🇶','DÉPARTEMENTAL',r.rankDepartment,r.rankDepartmentTotal,'rank-department',podiumMedalFor(r,'rankDepartment','rankDepartmentTotal'))+
   rankHtml('🏙️','VILLE',r.rankCity,r.rankCityTotal,'rank-city',podiumMedalFor(r,'rankCity','rankCityTotal'))+
   rankHtml('🏴‍☠️','TEAM',r.rankTeam,r.rankTeamTotal,'rank-team',podiumMedalFor(r,'rankTeam','rankTeamTotal')));
 return '<article class="card'+(status==='live'?' live':'')+(status==='planned'&&r.upcoming?' upcoming':'')+(status==='dnf'?' dnf':'')+(r.kind==='event'?' event':'')+'" data-id="'+safe(r.id)+'" style="--class-tag:'+tag+';--class-ink:'+classTextColor(tag)+';--vsr-color:'+vsrTag+';--vsr-ink:'+classTextColor(vsrTag)+'">'+
 '<div class="card-top"><div class="race-icon card-photo">'+(validImage(r.icon)?imageTag(r.icon,'Affiche '+r.name):'<div class="icon-placeholder">⛵</div>')+'</div><span class="badge-status">'+statusTitle[status]+'</span></div>'+
 '<div class="card-content"><div class="card-title-row"><h2 title="'+safe(r.name)+'">'+safe(r.name)+'</h2>'+
 '<div class="card-tag-row"><span class="class-tag" title="'+safe(r.boatClass||'VIRTUAL REGATTA')+'">'+safe(r.boatClass||'VIRTUAL REGATTA')+'</span>'+
 (mode?'<span class="vsr-badge vsr-'+r.vsr+(r.vsr==='hc'?' hc':'')+'" title="Importance VSR : '+(VSR_PRIORITY(r.vsr)+1)+' sur 4">'+safe(mode)+'</span>':'')+'</div></div>'+
 '<div class="card-boat">'+safe(r.boat)+(r.kind==='event'?' · COMPÉTITION':r.eventId?' · ÉTAPE'+(r.joker?' JOKER':''):'')+'</div>'+
 '<div class="card-stats">'+(r.start?'<span class="stat-chip">DÉPART '+safe(dateTimeFR(r.start,r.startTime))+'</span>':'')+
 (status!=='dnf'&&r.end?'<span class="stat-chip arrival-chip">ARRIVÉE '+safe(dateTimeFR(r.end,r.endTime))+'</span>':'')+
 (r.duration?'<span class="stat-chip duration-chip">⏱ '+safe(r.duration)+'</span>':'')+
 (validEquipment(r.equipment)?'<span class="stat-chip equipment">ÉQUIPEMENT · '+safe(equipmentModes[r.equipment])+'</span>':'')+
 (moneyNumber(r.gainPoints)?'<span class="stat-chip reward-points">⭐ +'+safe(Number(r.gainPoints).toLocaleString('fr-FR'))+' POINTS VSR</span>':'')+
 (moneyNumber(r.gainCredits)?'<span class="stat-chip reward-credits">🪙 +'+safe(Number(r.gainCredits).toLocaleString('fr-FR'))+' CRÉDITS VR</span>':'')+'</div>'+
 (!score.available&&(status==='dnf'||status==='finished')?'<p class="score-pending">'+safe(score.reason||'Note en attente')+'</p>':'')+
 (rankBlocks?'<div class="rank-grid">'+rankBlocks+'</div>':'')+
 '<div class="shots"><div class="shot"><label>CLASSEMENT FINAL</label><div class="shot-box image-preview">'+imageTag(r.result,'Classement '+r.name)+'</div></div>'+
 '<div class="shot"><label>TRACÉ</label><div class="shot-box image-preview">'+imageTag(r.route,'Tracé '+r.name)+'</div></div></div>'+
 '<div class="card-actions"><button type="button" class="btn secondary" data-action="edit">MODIFIER</button><button type="button" class="btn subtle" data-action="png">↓ PNG</button>'+
 (r.upcoming?'<button type="button" class="btn calendar-btn" data-action="calendar" title="Ajouter cette course à Apple Calendrier">📅 CALENDRIER</button>':'')+
 '<button type="button" class="btn subtle" data-action="delete">×</button></div></div></article>';
}

/* Ajustement dynamique après mise en page : une ligne même pour > 100 000 joueurs. */
function fitRankingNumbers(){
 if(!document.querySelectorAll)return;
 for(const rank of document.querySelectorAll('.rank-plate .rank-line strong')){
   const line=rank.parentElement,medal=line?.querySelector('.rank-medal');
   if(!line||!line.clientWidth)continue;
   const allowed=line.clientWidth-(medal?.getBoundingClientRect().width||0)-(medal?7:0);
   if(allowed<20)continue;
   const isMain=!!rank.closest('.rank-main');
   if(!rank.style?.setProperty)continue;
   let size=isMain?36:23;
   rank.style.setProperty('font-size',size+'px','important');
   while(rank.scrollWidth>allowed&&size>11){
     size--;rank.style.setProperty('font-size',size+'px','important');
   }
 }
}
function scheduleRankingFit(){
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(fitRankingNumbers);
}

function render(){
 const selected=$('filter-class').value;
 const classes=[...new Set(rows.map(x=>x.boatClass).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 $('filter-class').innerHTML='<option value="">Toutes les classes</option>'+classes.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join('');
 if(classes.includes(selected))$('filter-class').value=selected;
 const q=$('search').value.toLocaleLowerCase('fr').trim(),status=$('filter-status').value,cls=$('filter-class').value,vsr=$('filter-vsr').value;
 const filtered=rows.filter(r=>(!status||raceStatus(r)===status)&&(!cls||r.boatClass===cls)&&(!vsr||r.vsr===vsr)&&
   (!q||[r.name,r.boatClass,r.boat,r.rank,r.rankNational,r.rankDepartment,r.rankCity,r.rankTeam,
           r.startTime,r.end,r.endTime,VSR[r.vsr]||'',equipmentModes[r.equipment]||''].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))));
 const out=[...filtered],sort=$('sort').value;
 const chronological=r=>(r.start?r.start+'T'+(r.startTime||'00:00'):r.createdAt||'');
 out.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'fr'):
  sort==='old'?a.createdAt.localeCompare(b.createdAt):
  sort==='recent'?b.updatedAt.localeCompare(a.updatedAt):
  sort==='vsr'?VSR_PRIORITY(a.vsr)-VSR_PRIORITY(b.vsr)||chronological(b).localeCompare(chronological(a)):
  chronological(b).localeCompare(chronological(a))||b.createdAt.localeCompare(a.createdAt));
 const raceRows=rows.filter(r=>r.kind!=='event');
 $('count-total').textContent=raceRows.length;$('count-live').textContent=raceRows.filter(r=>raceStatus(r)==='live').length;
 $('count-finished').textContent=raceRows.filter(r=>raceStatus(r)==='finished').length;
 $('count-dnf').textContent=raceRows.filter(r=>raceStatus(r)==='dnf').length;
 $('result-count').textContent=out.length+' / '+rows.length;
 $('cards').innerHTML=out.map(card).join('')||(rows.length?'<p>Aucune course ne correspond aux filtres.</p>':'');
 scheduleRankingFit();
 $('empty').hidden=rows.length!==0;
 renderStatistics();renderClassColors();
}
const statInt=n=>Number(n).toLocaleString('fr-FR');
const statDecimal=(n,digits=1)=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:digits});
const statRank=r=>{
 const rank=Number(r.rank),total=Number(r.rankTotal);
 return Number.isSafeInteger(rank)&&rank>0&&(!r.rankTotal||(Number.isSafeInteger(total)&&total>=rank))?rank:null;
};
const statRelative=r=>{
 const rank=statRank(r),total=Number(r.rankTotal);
 return rank!==null&&Number.isSafeInteger(total)&&total>=rank&&total>0?100*rank/total:null;
};
const statDuration=sec=>{
 if(sec===null||!Number.isFinite(sec)||sec<0)return '—';
 const rounded=Math.round(sec),days=Math.floor(rounded/86400),hours=Math.floor((rounded%86400)/3600),minutes=Math.floor((rounded%3600)/60),seconds=rounded%60;
 return (days?statInt(days)+' j ':'')+String(hours).padStart(2,'0')+' h '+String(minutes).padStart(2,'0')+' min '+String(seconds).padStart(2,'0')+' s';
};

const podiumScopes=Object.freeze([
 {key:'rank',totalKey:'rankTotal',icon:'🏆',label:'GÉNÉRAL'},
 {key:'rankNational',totalKey:'rankNationalTotal',icon:'🇫🇷',label:'NATIONAL'},
 {key:'rankDepartment',totalKey:'rankDepartmentTotal',icon:'🇨🇶',label:'DÉPARTEMENTAL'},
 {key:'rankCity',totalKey:'rankCityTotal',icon:'🏙️',label:'VILLE'},
 {key:'rankTeam',totalKey:'rankTeamTotal',icon:'🏴‍☠️',label:'TEAM'}
]);
function rankForPodium(r,key,totalKey){
 const raw=String(r[key]??'').trim();
 if(!/^\d{1,12}$/.test(raw))return null;
 const rank=Number(raw),total=String(r[totalKey]??'').trim();
 if(!Number.isSafeInteger(rank)||rank<1)return null;
 if(total&&(!/^\d{1,12}$/.test(total)||Number(total)<rank))return null;
 return rank;
}
function countPodiumTypes(completed){
 return podiumScopes.map(scope=>{
  const ranked=completed.map(r=>rankForPodium(r,scope.key,scope.totalKey)).filter(n=>n!==null);
  const gold=ranked.filter(n=>n===1).length;
  const silver=ranked.filter(n=>n===2).length;
  const bronze=ranked.filter(n=>n===3).length;
  const podiums=gold+silver+bronze;
  return {...scope,ranked:ranked.length,gold,silver,bronze,podiums,
    share:ranked.length?100*podiums/ranked.length:null};
 });
}
function podiumHistory(completed,all){
 const years=[...new Set(all.map(r=>/^(\d{4})-\d{2}-\d{2}$/.exec(r.start||'')?.[1]).filter(Boolean))]
   .sort((a,b)=>Number(a)-Number(b)).slice(-6);
 return years.map(year=>({
  year,
  general:completed.filter(r=>r.start?.slice(0,4)===year&&[1,2,3].includes(rankForPodium(r,'rank','rankTotal'))).length
 }));
}

function computeRaceStatistics(items){
 const total=items.length,finished=items.filter(r=>raceStatus(r)==='finished');
 const podiumTypes=countPodiumTypes(finished),podiumYears=podiumHistory(finished,items);
 const rewardRows=finished.filter(r=>moneyNumber(r.gainPoints)||moneyNumber(r.gainCredits));
 const totalPoints=finished.reduce((sum,r)=>sum+rewardValue(r.gainPoints),0);
 const totalCredits=finished.reduce((sum,r)=>sum+rewardValue(r.gainCredits),0);
 const pointRows=finished.filter(r=>moneyNumber(r.gainPoints)!=='');
 const creditRows=finished.filter(r=>moneyNumber(r.gainCredits)!=='');
 const maxPoints=pointRows.reduce((acc,r)=>!acc||rewardValue(r.gainPoints)>rewardValue(acc.gainPoints)?r:acc,null);
 const maxCredits=creditRows.reduce((acc,r)=>!acc||rewardValue(r.gainCredits)>rewardValue(acc.gainCredits)?r:acc,null);
 const rewardsByVSR=VSR_ORDER.map(key=>{
  const group=finished.filter(r=>r.vsr===key);
  return {key,name:VSR[key],count:group.length,
    points:group.reduce((a,r)=>a+rewardValue(r.gainPoints),0),
    credits:group.reduce((a,r)=>a+rewardValue(r.gainCredits),0)};
 });
 const rewardsUnknown=finished.filter(r=>!VSR[r.vsr]);
 if(rewardsUnknown.length)rewardsByVSR.push({key:'',name:'Non renseignée',count:rewardsUnknown.length,
   points:rewardsUnknown.reduce((a,r)=>a+rewardValue(r.gainPoints),0),
   credits:rewardsUnknown.reduce((a,r)=>a+rewardValue(r.gainCredits),0)});

 const live=items.filter(r=>raceStatus(r)==='live');
 const upcoming=items.filter(r=>raceStatus(r)==='planned');
 const dnf=items.filter(r=>raceStatus(r)==='dnf');
 const ranked=finished.filter(r=>statRank(r)!==null);
 const sortedRanks=ranked.map(r=>statRank(r)).sort((a,b)=>a-b);
 const best=ranked.reduce((acc,r)=>!acc||statRank(r)<statRank(acc)?r:acc,null);
 const relative=ranked.map(r=>({race:r,value:statRelative(r)})).filter(x=>x.value!==null);
 const bestRelative=relative.reduce((acc,x)=>!acc||x.value<acc.value?x:acc,null);
 const bestRegional=Object.fromEntries(['rankNational','rankDepartment','rankCity','rankTeam'].map(key=>{
   const valid=finished.map(r=>({r,rank:Number(r[key])}))
     .filter(x=>Number.isSafeInteger(x.rank)&&x.rank>0);
   const best=valid.reduce((acc,x)=>!acc||x.rank<acc.rank?x:acc,null);
   return [key,best];
 }));
 const durationRows=finished.map(r=>({race:r,value:parseRaceDuration(r.duration)}))
   .filter(x=>x.value.status==='valid'&&x.value.seconds>0)
   .map(x=>({race:x.race,seconds:x.value.seconds}));
 const totalSeconds=durationRows.reduce((sum,x)=>sum+x.seconds,0);
 const shortest=durationRows.reduce((acc,x)=>!acc||x.seconds<acc.seconds?x:acc,null);
 const longest=durationRows.reduce((acc,x)=>!acc||x.seconds>acc.seconds?x:acc,null);
 const years=new Map();
 for(const r of items){
   const year=/^(\d{4})-\d{2}-\d{2}$/.exec(r.start||'')?.[1]||'Sans date';
   if(!years.has(year))years.set(year,{year,count:0,finished:0,top10:0});
   const bucket=years.get(year);
   bucket.count++;
   if(raceStatus(r)==='finished'){bucket.finished++;if(statRank(r)!==null&&statRank(r)<=10)bucket.top10++;}
 }
 const yearly=[...years.values()].sort((x,y)=>
   x.year==='Sans date'?1:y.year==='Sans date'?-1:Number(y.year)-Number(x.year));
 return {
   total,finished,live,upcoming,dnf,ranked,relative,best,bestRelative,bestRegional,durationRows,totalSeconds,
   shortest,longest,yearly,podiumTypes,podiumYears,
   totalPoints,totalCredits,pointRows,creditRows,maxPoints,maxCredits,
   meanPoints:pointRows.length?totalPoints/pointRows.length:null,
   meanCredits:creditRows.length?totalCredits/creditRows.length:null,
   rewardsByVSR,rewardRows,
   winners:ranked.filter(r=>statRank(r)===1).length,
   podiums:ranked.filter(r=>statRank(r)<=3).length,
   top10:ranked.filter(r=>statRank(r)<=10).length,
   top100:ranked.filter(r=>statRank(r)<=100).length,
   meanRank:sortedRanks.length?sortedRanks.reduce((a,b)=>a+b,0)/sortedRanks.length:null,
   medianRank:sortedRanks.length?(sortedRanks[(sortedRanks.length-1)>>1]+sortedRanks[sortedRanks.length>>1])/2:null,
   meanRelative:relative.length?relative.reduce((sum,x)=>sum+x.value,0)/relative.length:null,
   meanDuration:durationRows.length?totalSeconds/durationRows.length:null
 };
}
function renderStatistics(){
 const raceRows=rows.filter(r=>r.kind!=='event');
 const stats=computeRaceStatistics(raceRows);
 const statValue=(value)=>value===null?'—':statInt(value);
 const percent=value=>value===null?'—':statDecimal(value,2)+' %';
 const blocks=[
   {title:'TABLEAU DE BORD',items:[
     ['COURSES RECENSÉES',statInt(stats.total),'Toutes les fiches'],
     ['TERMINÉES',statInt(stats.finished.length),'Selon le statut de course'],
     ['EN COURS',statInt(stats.live.length),'Halo turquoise'],
     ['À VENIR',statInt(stats.upcoming.length),'Halo bleu'],
     ['DNF · ABANDONS',statInt(stats.dnf.length),'Hors palmarès']
   ]},
   {title:'PALMARÈS',items:[
     ['VICTOIRES 🥇',statInt(stats.winners),'1re place au général'],
     ['PODIUMS 🏆',statInt(stats.podiums),'Top 3 au général, victoires incluses'],
     ['TOP 10',statInt(stats.top10),'Top 10 au général'],
     ['TOP 100',statInt(stats.top100),'Top 100 au général'],
     ['TAUX DE PODIUMS',stats.ranked.length?percent(stats.podiums/stats.ranked.length*100):'—','Podiums / courses classées'],
     ['TAUX DE TOP 10',stats.ranked.length?percent(stats.top10/stats.ranked.length*100):'—','Top 10 / courses classées'],
     ['MEILLEURE PLACE',stats.best?'#'+statInt(statRank(stats.best)):'—',stats.best?.name||'Aucun résultat enregistré'],
     ['PLACE MOYENNE',stats.meanRank===null?'—':statDecimal(stats.meanRank,1),stats.ranked.length+' courses classées'],
     ['PLACE MÉDIANE',stats.medianRank===null?'—':statDecimal(stats.medianRank,1),'Résultats au général'],
     ['MEILLEUR TOP %',stats.bestRelative?'Top '+percent(stats.bestRelative.value):'—',stats.bestRelative?stats.bestRelative.race.name:'Renseigne aussi les participants'],
     ['TOP % MOYEN',stats.meanRelative===null?'—':percent(stats.meanRelative),'Place ÷ nombre de participants'],
     ['MEILLEUR NATIONAL',stats.bestRegional.rankNational?'#'+statInt(stats.bestRegional.rankNational.rank):'—',stats.bestRegional.rankNational?.r.name||'Non renseigné'],
     ['MEILLEUR DÉPARTEMENTAL',stats.bestRegional.rankDepartment?'#'+statInt(stats.bestRegional.rankDepartment.rank):'—',stats.bestRegional.rankDepartment?.r.name||'Non renseigné'],
     ['MEILLEUR VILLE',stats.bestRegional.rankCity?'#'+statInt(stats.bestRegional.rankCity.rank):'—',stats.bestRegional.rankCity?.r.name||'Non renseigné'],
     ['MEILLEUR TEAM',stats.bestRegional.rankTeam?'#'+statInt(stats.bestRegional.rankTeam.rank):'—',stats.bestRegional.rankTeam?.r.name||'Non renseigné']
   ]},
   {title:'GAINS VSR / VR',items:[
     ['POINTS VSR CUMULÉS',statInt(stats.totalPoints),stats.pointRows.length+' courses avec points renseignés'],
     ['CRÉDITS VR CUMULÉS',statInt(stats.totalCredits),stats.creditRows.length+' courses avec crédits renseignés'],
     ['MOYENNE POINTS VSR',stats.meanPoints===null?'—':statDecimal(stats.meanPoints,1),'Par course avec points renseignés'],
     ['MOYENNE CRÉDITS VR',stats.meanCredits===null?'—':statDecimal(stats.meanCredits,1),'Par course avec crédits renseignés'],
     ['RECORD POINTS VSR',stats.maxPoints?statInt(rewardValue(stats.maxPoints.gainPoints)):'—',stats.maxPoints?.name||'Aucun gain renseigné'],
     ['RECORD CRÉDITS VR',stats.maxCredits?statInt(rewardValue(stats.maxCredits.gainCredits)):'—',stats.maxCredits?.name||'Aucun gain renseigné']
   ]},
   {title:'TEMPS DE NAVIGATION',items:[
     ['TEMPS CUMULÉ',stats.durationRows.length?statDuration(stats.totalSeconds):'—',stats.durationRows.length+' courses terminées avec durée'],
     ['DURÉE MOYENNE',statDuration(stats.meanDuration),'Courses terminées renseignées'],
     ['COURSE LA PLUS COURTE',stats.shortest?statDuration(stats.shortest.seconds):'—',stats.shortest?.race.name||'Durée indisponible'],
     ['COURSE LA PLUS LONGUE',stats.longest?statDuration(stats.longest.seconds):'—',stats.longest?.race.name||'Durée indisponible']
   ]}
 ];
 $('stats-summary').textContent=statInt(stats.total)+' courses · '+statInt(stats.ranked.length)+' classées au général';
 const counterSection=block=>
  '<section class="stats-metric-section"><h3>'+safe(block.title)+'</h3><div class="stats-metrics">'+
  block.items.map(([label,value,hint])=>
   '<div class="stats-metric"><span>'+safe(label)+'</span><strong>'+safe(value)+'</strong><small title="'+safe(hint)+'">'+safe(hint)+'</small></div>'
  ).join('')+'</div></section>';
 const distribution=(title,entries)=>{
  if(!entries.length)return '<div class="stats-breakdown"><h3>'+safe(title)+'</h3><p class="stats-empty">Aucune donnée.</p></div>';
  const max=Math.max(1,...entries.map(x=>x[1]));
  return '<div class="stats-breakdown"><h3>'+safe(title)+'</h3>'+
   entries.map(([label,count])=>
    '<div class="stat-breakdown-row"><span title="'+safe(label)+'">'+safe(label)+'</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:'+Math.round(count/max*100)+'%"></div></div><strong>'+statInt(count)+'</strong></div>'
   ).join('')+'</div>';
 };
 const group=(items,fn)=>[...items.reduce((acc,r)=>{const name=fn(r)||'Non renseigné';acc.set(name,(acc.get(name)||0)+1);return acc;},new Map()).entries()]
  .sort((a,b)=>VSR_LABEL_PRIORITY(a[0])-VSR_LABEL_PRIORITY(b[0])||b[1]-a[1]||a[0].localeCompare(b[0],'fr'));

 const maxYear=Math.max(1,...stats.yearly.map(x=>x.count));
 const annual=stats.yearly.length?
  '<div class="stats-years">'+stats.yearly.map(x=>
   '<div class="stats-year-row"><strong>'+safe(x.year)+'</strong><div class="stats-year-track"><div class="stats-year-total" style="width:'+Math.round(x.count/maxYear*100)+'%"><div class="stats-year-finished" style="width:'+Math.round(x.finished/x.count*100)+'%"></div></div></div><span>'+statInt(x.count)+' <small>('+statInt(x.finished)+' terminées, '+statInt(x.top10)+' Top 10)</small></span></div>'
  ).join('')+'</div>':'<p class="stats-empty">Ajoute des courses pour voir l’évolution annuelle.</p>';
 const performance=(name,field)=>{
  const groups=new Map();
  for(const race of stats.ranked){
   const key=field(race);if(!key)continue;
   if(!groups.has(key))groups.set(key,{label:key,count:0,top10:0,relativeSum:0,relativeCount:0});
   const entry=groups.get(key);entry.count++;
   if(statRank(race)<=10)entry.top10++;
   const relative=statRelative(race);
   if(relative!==null){entry.relativeSum+=relative;entry.relativeCount++;}
  }
  const list=[...groups.values()].sort((a,b)=>VSR_LABEL_PRIORITY(a.label)-VSR_LABEL_PRIORITY(b.label)||b.count-a.count||a.label.localeCompare(b.label,'fr'));
  return '<div class="stats-breakdown stats-performance"><h3>'+safe(name)+'</h3>'+
   (list.length?'<div class="performance-table"><div class="performance-head"><span>GROUPE</span><span>COURSES</span><span>TOP 10</span><span>TOP % MOY.</span></div>'+
    list.map(x=>'<div class="performance-row"><strong>'+safe(x.label)+'</strong><span>'+statInt(x.count)+'</span><span>'+statInt(x.top10)+'</span><span>'+(x.relativeCount?percent(x.relativeSum/x.relativeCount):'—')+'</span></div>').join('')+'</div>':
    '<p class="stats-empty">Aucun classement général enregistré pour ce groupe.</p>')+'</div>';
 };

 const podiumCard=scope=>{
  const medals=[['gold','🥇','1re',scope.gold],['silver','🥈','2e',scope.silver],['bronze','🥉','3e',scope.bronze]];
  const max=Math.max(1,scope.gold,scope.silver,scope.bronze);
  const bars=medals.map(([kind,emoji,label,count])=>
   '<div class="podium-column"><span class="podium-column-count">'+statInt(count)+'</span>'+
   '<div class="podium-column-bar '+kind+'" style="height:'+(count?Math.max(9,Math.round(count/max*49)):3)+'px" aria-hidden="true"></div>'+
   '<span class="podium-column-label">'+emoji+' '+label+'</span></div>'
  ).join('');
  const share=scope.share===null?0:Math.max(0,Math.min(100,scope.share));
  const summary=scope.share===null?'—':statDecimal(scope.share,1)+' %';
  const label=scope.icon+' '+scope.label+', '+scope.podiums+' podiums : '+scope.gold+' première place, '+scope.silver+' deuxièmes places, '+scope.bronze+' troisièmes places sur '+scope.ranked+' courses classées';
  return '<article class="podium-card" aria-label="'+safe(label)+'">'+
   '<header class="podium-card-head"><span class="podium-card-icon" aria-hidden="true">'+scope.icon+'</span>'+
     '<strong>'+safe(scope.label)+'</strong></header>'+
   '<div class="podium-card-summary"><div><strong class="podium-card-total">'+statInt(scope.podiums)+'</strong>'+
    '<small>PODIUM'+(scope.podiums===1?'':'S')+'</small></div>'+
    '<div class="podium-ring" style="--podium-share:'+Math.round(share)+'%" role="img" aria-label="'+safe(scope.share===null?'Aucun classement enregistré':summary+' de podiums parmi les courses classées')+'"><span>'+safe(summary)+'</span></div></div>'+
   '<div class="podium-columns" aria-hidden="true">'+bars+'</div>'+
   '<footer>'+statInt(scope.ranked)+' course'+(scope.ranked===1?'':'s')+' classée'+(scope.ranked===1?'':'s')+'</footer>'+
  '</article>';
 };
 const podiumMax=Math.max(1,...stats.podiumYears.map(r=>r.general));
 const yearlyPodiums=stats.podiumYears.length?
  '<div class="podium-year-bars">'+stats.podiumYears.map(({year,general})=>
   '<div class="podium-year-item" aria-label="'+general+' podiums au général en '+year+'">'+
    '<strong>'+statInt(general)+'</strong><div class="podium-year-column"><div style="height:'+(general?Math.max(10,Math.round(general/podiumMax*100)):2)+'%" aria-hidden="true"></div></div>'+
    '<span>'+safe(year)+'</span></div>'
  ).join('')+'</div>':'<p class="stats-empty">Aucune année de départ renseignée.</p>';

 const maxReward=Math.max(1,...stats.rewardsByVSR.flatMap(x=>[x.points,x.credits]));
 const rewardChart='<section class="stats-metric-section"><h3>GAINS PAR IMPORTANCE VSR</h3>'+
  '<p class="stats-caption">Sommes des courses terminées ; ordre décroissant d’importance : Hors Catégorie, VSR 1, VSR 2, VSR 3.</p>'+
  '<div class="reward-chart">'+stats.rewardsByVSR.map(group=>
   '<div class="reward-chart-row"><strong>'+safe(group.name)+'</strong>'+
    '<div class="reward-chart-bars">'+
     '<div class="reward-bar-line"><span>POINTS</span><div class="reward-track"><div class="reward-fill points" style="width:'+Math.round(group.points/maxReward*100)+'%"></div></div><b>'+statInt(group.points)+'</b></div>'+
     '<div class="reward-bar-line"><span>CRÉDITS</span><div class="reward-track"><div class="reward-fill credits" style="width:'+Math.round(group.credits/maxReward*100)+'%"></div></div><b>'+statInt(group.credits)+'</b></div>'+
    '</div></div>'
  ).join('')+'</div></section>';
 const podiumPanel='<section class="stats-metric-section"><h3>🏆 PODIUMS PAR CLASSEMENT</h3>'+
  '<p class="stats-caption">Chaque course terminée peut compter dans plusieurs classements. Un podium correspond aux places 1, 2 ou 3 ; le cercle indique le taux de podiums parmi les courses avec ce classement renseigné.</p>'+
  '<div class="podium-grid">'+stats.podiumTypes.map(podiumCard).join('')+'</div>'+
  '<div class="podium-year-panel"><h4>PODIUMS AU GÉNÉRAL PAR ANNÉE</h4>'+yearlyPodiums+'</div></section>';

 $('stats-content').innerHTML=blocks.map(counterSection).join('')+podiumPanel+rewardChart+
  '<section class="stats-metric-section"><h3>ÉVOLUTION PAR ANNÉE</h3><p class="stats-caption">Nombre de courses selon la date de départ ; la partie foncée représente les courses terminées.</p>'+annual+'</section>'+
  '<section class="stats-metric-section"><h3>MES HABITUDES DE COURSE</h3><div class="stats-breakdowns">'+
    distribution('CATÉGORIES VSR',group(raceRows,r=>VSR[r.vsr]||'Non renseignée'))+
    distribution('CLASSES DE BATEAUX',group(raceRows,r=>r.boatClass||'Non renseignée'))+
    distribution('ÉQUIPEMENTS',group(raceRows,r=>equipmentModes[r.equipment]||'Non renseigné'))+
    distribution('STATUTS',group(raceRows,r=>statusTitle[raceStatus(r)]))+
  '</div></section>'+
  '<section class="stats-metric-section"><h3>PERFORMANCES PAR TYPE DE COURSE</h3><p class="stats-caption">Sur les courses terminées avec classement général. Top % = place divisée par le nombre de participants ; plus bas signifie mieux classé. « — » lorsqu’il manque les participants.</p><div class="stats-breakdowns">'+
    performance('PAR CATÉGORIE VSR',r=>VSR[r.vsr]||'Non renseignée')+
    performance('PAR CLASSE DE BATEAU',r=>r.boatClass||'Non renseignée')+
    performance('PAR ÉQUIPEMENT',r=>equipmentModes[r.equipment]||'Non renseigné')+
  '</div></section>';
}

function renderClassColors(){
 const defaults=['IMOCA','ULTIM','Class40','Ocean Fifty','Mini 6.50'];
 const labels=new Map();
 const addClass=name=>{
  const label=String(name||'').trim().slice(0,100),key=classKey(label);
  if(key&&!labels.has(key))labels.set(key,label);
 };
 for(const label of defaults)addClass(label);
 for(const r of rows)addClass(r.boatClass);
 for(const key of Object.keys(classSettings.classColors))addClass(key);
 const list=[...labels.entries()].sort(([a],[b])=>a.localeCompare(b,'fr'));
 $('default-class-color').value=classSettings.defaultColor;
 $('colors-class-count').textContent=list.length+' classes';
 $('class-colors-list').innerHTML=list.map(([key,label])=>{
  const selected=getClassTagColor(key);
  const count=rows.filter(r=>classKey(r.boatClass)===key).length;
  const customized=Object.prototype.hasOwnProperty.call(classSettings.classColors,key);
  return '<div class="class-color-row"><span class="class-color-preview" style="--class-tag:'+selected+';--class-ink:'+classTextColor(selected)+'">'+safe(label)+'</span>'+
   '<span class="class-color-count">'+count+' course'+(count===1?'':'s')+'</span>'+
   '<label class="class-color-control"><span class="color-control-label">'+(customized?'PERSONNALISÉE':'PAR DÉFAUT')+'</span>'+
   '<input type="color" value="'+selected+'" data-class-key="'+safe(key)+'" aria-label="Couleur de la classe '+safe(label)+'"></label></div>';
 }).join('');
 $('vsr-colors-list').innerHTML=VSR_ORDER.map((key,i)=>{
  const color=getVSRTagColor(key),count=rows.filter(r=>r.vsr===key).length;
  return '<div class="class-color-row vsr-color-row">'+
   '<span class="vsr-badge '+(key==='hc'?'hc ':'')+'vsr-'+key+'" style="--vsr-color:'+color+';--vsr-ink:'+classTextColor(color)+'" title="Priorité '+(i+1)+' sur 4">'+safe(VSR[key])+'</span>'+
   '<span class="class-color-count">'+count+' course'+(count===1?'':'s')+'</span>'+
   '<label class="class-color-control"><span class="color-control-label">PRIORITÉ '+(i+1)+'</span>'+
   '<input type="color" value="'+color+'" data-vsr-key="'+key+'" aria-label="Couleur de '+safe(VSR[key])+'"></label></div>';
 }).join('');
}
function changeDefaultClassColor(value){
 const next=colorSafe(value);
 if(next===classSettings.defaultColor&&Object.keys(classSettings.classColors).length===0)return;
 if(Object.keys(classSettings.classColors).length>0 &&
    !confirm('Appliquer cette couleur à toutes les courses ? Les couleurs personnalisées par classe seront réinitialisées.')){
   $('default-class-color').value=classSettings.defaultColor;return;
 }
 storeClassSettings({...classSettings,defaultColor:next,classColors:{}});
 toast('Couleur générale appliquée à toutes les courses ✓');
}
function changeSpecificClassColor(key,value){
 const normalized=classKey(key);
 if(!normalized)return;
 const next=colorSafe(value),colors={...classSettings.classColors};
 if(next===classSettings.defaultColor)delete colors[normalized];
 else colors[normalized]=next;
 storeClassSettings({...classSettings,classColors:colors});
 toast('Couleur de la classe '+normalized+' mise à jour sur toutes ses courses ✓');
}

function changeVSRColor(key,value){
 if(!VSR[key]||!/^#[a-f0-9]{6}$/i.test(value||''))return;
 const next={...classSettings.vsrColors,[key]:colorSafe(value)};
 storeClassSettings({...classSettings,vsrColors:next});
 toast('Couleur '+VSR[key]+' appliquée à toutes les courses correspondantes ✓');
}
function selectWorkspace(view){
 const valid=['races','stats','colors'];
 if(!valid.includes(view))return;
 for(const name of valid){
  const active=name===view;
  $(name+'-panel').hidden=!active;
  const tab=$('view-'+name);
  tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
 }
 if(view==='stats')renderStatistics();
 if(view==='colors')renderClassColors();
}

/* PDF collection : filtres cumulables et export A4 paysage. */
const pdfDialog=$('pdf-dialog'),pdfFilterIds=['pdf-year','pdf-vsr','pdf-class','pdf-boat','pdf-status','pdf-order'];
const pdfValues=()=>({
 year:$('pdf-year').value,vsr:$('pdf-vsr').value,
 boatClass:$('pdf-class').value,boat:$('pdf-boat').value,
 status:$('pdf-status').value,order:$('pdf-order').value
});
const reportRace=r=>{
 const parsed=parseRaceDuration(r.duration);
 return {...r,reportStatus:raceStatus(r),durationSecondsTotal:parsed.status==='valid'?parsed.seconds:0};
};
function pdfMatches(r,v){
 return (!v.year||r.start?.slice(0,4)===v.year)&&(!v.vsr||r.vsr===v.vsr)&&
  (!v.boatClass||r.boatClass===v.boatClass)&&(!v.boat||r.boat===v.boat)&&
  (!v.status||raceStatus(r)===v.status);
}
function updatePdfCount(){
 const v=pdfValues(),count=rows.filter(r=>r.kind!=='event'&&pdfMatches(r,v)).length;
 $('pdf-match-count').textContent=count;
 $('pdf-generate').disabled=count===0;
}
function setPdfSelect(id,values,label){
 const el=$(id),selected=el.value;
 el.innerHTML='<option value="">'+label+'</option>'+
  values.map(value=>'<option value="'+safe(value)+'">'+safe(value)+'</option>').join('');
 if(values.includes(selected))el.value=selected;
}
function openPdfDialog(){
 const unique=values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const raceRows=rows.filter(r=>r.kind!=='event');
 setPdfSelect('pdf-year',unique(raceRows.map(r=>r.start?.slice(0,4))).sort((a,b)=>b.localeCompare(a)),'Toutes les années');
 setPdfSelect('pdf-class',unique(raceRows.map(r=>r.boatClass)),'Toutes les classes');
 setPdfSelect('pdf-boat',unique(raceRows.map(r=>r.boat)),'Tous les bateaux');
 updatePdfCount();
 if(!pdfDialog.open)pdfDialog.showModal();
}
function closePdfDialog(){if(pdfDialog.open)pdfDialog.close();}
async function exportGeneralPdf(event){
 event.preventDefault();
 if($('pdf-generate').disabled)return;
 const button=$('pdf-generate'),label=button.textContent;
 button.disabled=true;button.textContent='CRÉATION DU PDF…';
 try{
  const report=await import('./report.js');
  const selection=rows.filter(r=>r.kind!=='event').map(reportRace);
  const result=await report.generateGeneralPDF({races:selection,filters:pdfValues(),settings:classSettings});
  closePdfDialog();toast('Rapport PDF téléchargé : '+result.count+' courses, '+result.pages+' pages ✓');
 }catch(error){console.error(error);toast('Export PDF impossible : '+(error?.message||error),true);}
 finally{button.textContent=label;updatePdfCount();}
}

const scoreDialog=$('score-dialog'),recalcDialog=$('score-recalc-dialog');
function scoreText(score,kind){
 const rows=kind==='event'?
  [['Classement général', 'overall',70],['Régularité des étapes','regularity',20],['Étapes terminées','completion',10]]:
  [['Classement relatif','relative',35],['Progression personnelle','progress',20],['Difficulté VSR','vsr',10],['Affluence relative','attendance',15],['Équipement utilisé','equipment',20]];
 const value=x=>x===null||x===undefined||x===''?'—':Number.isFinite(Number(x))?Number(x).toLocaleString('fr-FR',{maximumFractionDigits:2}):'—';
 return '<div class="score-dialog-total">'+value(score.value)+'/100</div>'+
  '<div class="score-dialog-mention">'+safe(score.mention)+(score.provisional?' · PROVISOIRE':'')+'</div>'+
  '<p class="score-note">Note éditoriale Rapli, indépendante du classement officiel Virtual Regatta.</p>'+
  (score.stale?'<p class="score-flag">Données modifiées : la note reste figée jusqu’à recalcul volontaire.</p>':'')+
  (!score.stored?'<p class="score-flag">Aperçu : note non encore enregistrée. Utilise « Recalculer notes » pour la figer.</p>':'')+
  '<div class="score-rows">'+rows.map(([label,key,max])=>'<div class="score-row"><span>'+safe(label)+'</span><strong>'+value(score.parts?.[key])+' / '+max+'</strong></div>').join('')+'</div>'+
  '<div class="score-row"><span>Total brut</span><strong>'+value(score.raw)+' / 100</strong></div>'+
  '<div class="score-row"><span>Prime d’exploit</span><strong>'+safe(score.bonus!==null&&score.bonus!==undefined?value(score.bonus)+'/100':'Aucune prime appliquée')+'</strong></div>'+
  (score.bonusFloor!==null&&score.bonusFloor!==undefined?'<p class="score-note">Plancher de podium '+value(score.bonusFloor)+'/100 · effectif requis : '+value(score.bonusThreshold)+'</p>':'')+
  (score.reference?'<p class="score-note">Référence historique : '+value(score.reference.count)+' course(s) · médiane '+value(score.reference.median)+' participant(s).</p>':'')+
  (score.stages?'<p class="score-note">Étapes normales : '+value(score.stages.finished)+' / '+value(score.stages.normal)+' · Joker exclues : '+value(score.stages.joker)+'</p>':'')+
  (score.flags||[]).map(flag=>'<p class="score-flag">'+safe(flag)+'</p>').join('');
}
function openScoreDetail(r){
 const score=scoreView(r);
 if(!score.available){toast(score.reason||'Note non disponible',true);return;}
 $('score-dialog-title').textContent='NOTE · '+r.name;
 $('score-dialog-body').innerHTML=scoreText(score,r.kind);
 if(!scoreDialog.open)scoreDialog.showModal();
}
let scoreRecalcChanges=[],scoreRecalcGuard='';
const scoreComparison=s=>s?.available?JSON.stringify([s.value,s.raw,s.parts,s.bonus,s.bonusThreshold,s.flags,s.reference,s.stages]):'none';
function openScoreRecalc(){
 scoreRecalcChanges=rows.map(row=>{
  const before=row.scoreSnapshot;
  const after=scoreNow(row);
  return {row,before,after};
 }).filter(({before,after})=>(before?.available||after.available)&&scoreComparison(before)!==scoreComparison(after));
 if(!scoreRecalcChanges.length){toast('Aucune note à recalculer ✓');return;}
 scoreRecalcGuard=JSON.stringify(rows.map(x=>[x.id,x.updatedAt,x.scoreSnapshot?.calculatedAt||'']));
 $('score-recalc-body').innerHTML='<p class="score-note">Aucune note n’est modifiée avant validation. Seules les fiches concernées sont listées.</p>'+
  scoreRecalcChanges.map(({row,before,after})=>'<div class="score-recalc-line"><div><span>'+safe(row.name)+'</span><small>'+safe(after.available?after.mention:after.reason||'Indisponible')+'</small></div><strong>'+safe(before?.available?before.value+'/100':'—')+' → '+safe(after.available?after.value+'/100':'—')+'</strong></div>').join('');
 $('score-recalc-confirm').disabled=false;
 if(!recalcDialog.open)recalcDialog.showModal();
}
async function confirmScoreRecalc(){
 if(!scoreRecalcChanges.length)return;
 if(JSON.stringify(rows.map(x=>[x.id,x.updatedAt,x.scoreSnapshot?.calculatedAt||'']))!==scoreRecalcGuard){
  toast('La collection a changé. Relance le recalcul.',true);recalcDialog.close();return;
 }
 const updates=new Map(scoreRecalcChanges.map(({row,after})=>[row.id,after.available?{...after,signature:scoreEngine.signature(row),calculatedAt:now()}:null]));
 const previous=rows;
 const revised=rows.map(row=>updates.has(row.id)?{...row,scoreSnapshot:updates.get(row.id)}:row);
 $('score-recalc-confirm').disabled=true;
 try{
  await replaceRows(revised);
  window.RapliModuleCloud?.changed?.();
  recalcDialog.close();
  toast('Notes recalculées et enregistrées ✓ ('+updates.size+')');
 }catch(error){rows=previous;render();toast('Recalcul impossible : '+(error?.message||error),true);}
 finally{$('score-recalc-confirm').disabled=false;scoreRecalcChanges=[];}
}
function preview(k){const img=$('preview-'+k),ph=$('placeholder-'+k);img.hidden=!validImage(pictures[k]);ph.hidden=validImage(pictures[k]);if(validImage(pictures[k]))img.src=pictures[k];else img.removeAttribute('src');}
function updateKindFields(){
 const isEvent=$('race-kind').value==='event';
 if(isEvent){$('race-live').checked=false;$('race-upcoming').checked=false;}
 $('race-event-id').closest('label').hidden=isEvent;
 $('race-event-controls').hidden=!isEvent;
 $('race-joker-control').hidden=isEvent||!$('race-event-id').value;
 $('race-live').closest('label').hidden=isEvent;
 $('race-upcoming').closest('label').hidden=isEvent;
}
function openEditor(r){
 editId=r?.id||'';
 const data=r||normal();
 for(const k of Object.keys(props))getField(k).value=data[k]||'';
 legacyArrival={start:data.start,startTime:data.startTime,duration:data.duration,end:data.end,endTime:data.endTime};
 updateArrival();
 $('race-live').checked=!!data.live;
 $('race-upcoming').checked=!!data.upcoming;
 $('race-dnf').checked=!!data.dnf;
 $('race-kind').value=data.kind||'race';
 $('race-event-closed').checked=!!data.eventClosed;
 $('race-joker').checked=!!data.joker;
 const parentSelect=$('race-event-id');
 parentSelect.innerHTML='<option value="">Aucune · course indépendante</option>'+rows.filter(x=>x.kind==='event'&&x.id!==data.id).map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+'</option>').join('');
 parentSelect.value=data.eventId||'';
 updateKindFields();
 equipmentInputs().forEach(input=>{input.checked=input.value===validEquipment(data.equipment);});
 for(const k of imageKeys){pictures[k]=data[k]||'';preview(k);}
 $('dialog-title').textContent=editId?'MODIFIER LA COURSE':'AJOUTER UNE COURSE';
 $('delete-race').hidden=!editId;
 if(!dialog.open)dialog.showModal();
 document.body.style.overflow='hidden';dialog.querySelector('.dialog-scroll').scrollTop=0;
 getField('name').focus({preventScroll:true});
}
const closeEditor=()=>{if(dialog.open)dialog.close();};
dialog.addEventListener('close',()=>{document.body.style.overflow='';editId='';});dialog.addEventListener('click',e=>{if(e.target===dialog)closeEditor();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeEditor));
async function saveEditor(e){
 e.preventDefault();if(writeBusy||uploads)return;
 const old=rows.find(x=>x.id===editId);const r={...(old||normal()),updatedAt:now(),live:$('race-live').checked,upcoming:$('race-upcoming').checked,dnf:$('race-dnf').checked};
 if([r.live,r.upcoming,r.dnf].filter(Boolean).length>1){toast('Choisis un seul statut manuel : en cours, à venir ou DNF.',true);return;}
 r.kind=$('race-kind').value==='event'?'event':'race';
 r.eventId=r.kind==='event'?'':clean($('race-event-id').value,130);
 r.eventClosed=r.kind==='event'&&$('race-event-closed').checked;
 r.joker=r.kind!=='event'&&!!r.eventId&&$('race-joker').checked;
 if(r.kind==='event'&&(r.live||r.upcoming)){toast('Pour un événement, utilise le statut « Compétition clôturée ».',true);return;}
 const arrival=updateArrival();if(arrival.status==='invalid-duration'||arrival.status==='invalid-date'){toast('Corrige la durée ou les horaires avant d’enregistrer.',true);getField(arrival.status==='invalid-duration'?'durationDays':'start').focus();return;}
 if(syncDurationInput()==='invalid'){toast('Durée incorrecte : vérifie les jours, heures, minutes et secondes.',true);getField('durationDays').focus();return;}
 for(const k of Object.keys(props))r[k]=clean(getField(k).value,props[k]);
 for(const key of ['gainPoints','gainCredits']){
   const value=String(getField(key).value||'').trim();
   if(value&&!moneyNumber(value)){toast('Les gains doivent être des nombres entiers positifs.',true);getField(key).focus();return;}
   r[key]=moneyNumber(value);
 }
 for(const [place,total] of rankPairs){
   const input=getField(place),run=getField(total);
   const placeText=input.value.trim(),totalText=run.value.trim();
   if(placeText&&!intString(placeText)){toast('Classement invalide : saisis une position numérique.',true);input.focus();return;}
   if(totalText&&!intString(totalText)){toast('Nombre de joueurs invalide.',true);run.focus();return;}
   if(totalText&&!placeText){toast('Renseigne aussi la position du classement.',true);input.focus();return;}
   if(placeText&&totalText&&Number(intString(placeText))>Number(intString(totalText))){toast('La position ne peut pas dépasser le nombre de joueurs.',true);input.focus();return;}
   r[place]=intString(placeText);r[total]=intString(totalText);
 }
 r.vsr=VSR[r.vsr]?r.vsr:'';
 if(arrival.status==='ready'){r.end=arrival.end;r.endTime=arrival.endTime;}
 const chosen=equipmentInputs().filter(input=>input.checked);if(chosen.length>1){toast('Une seule méthode d’équipement est autorisée.',true);return;}
 r.equipment=validEquipment(chosen[0]?.value);
 if(!r.name){getField('name').focus();return;}for(const k of imageKeys)r[k]=pictures[k]||'';
 if(!old?.scoreSnapshot){const initial=scoreEngine.scoreFor(r,[...rows.filter(x=>x.id!==r.id),r],raceStatus);if(initial.available)r.scoreSnapshot={...initial,signature:scoreEngine.signature(r),calculatedAt:now()};}
 writeBusy=true;$('save-race').disabled=true;
 try{await saveRow(r);rows=[...rows.filter(x=>x.id!==r.id),r];render();window.RapliModuleCloud?.changed?.();closeEditor();toast('Course enregistrée ✓');}
 catch(err){console.error(err);toast('Impossible de sauvegarder : '+err.message,true);}
 finally{writeBusy=false;$('save-race').disabled=false;}
}
async function deleteRace(id){
 const r=rows.find(x=>x.id===id);if(!r||!confirm('Supprimer « '+r.name+' » et ses images ?'))return;
 try{await deleteRow(id);rows=rows.filter(x=>x.id!==id);closeEditor();render();window.RapliModuleCloud?.changed?.();toast('Course supprimée ✓');}
 catch(err){toast('Suppression impossible : '+err.message,true);}
}
async function fileData(file,key){
 if(!file)return;
 uploads++;$('save-race').disabled=true;
 try{
  if(file.size>18*1024*1024||(!file.type.startsWith('image/')&&!/\.(heic|heif)$/i.test(file.name)))throw Error('Image non compatible ou supérieure à 18 Mo.');
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await new Promise((yes,no)=>{image.onload=yes;image.onerror=()=>no(Error('Ce navigateur ne peut pas décoder cette image. Essaie JPG ou PNG.'));});
   const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
   let data=canvas.toDataURL('image/webp',.82);if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',.82);
   if(data.length>12*1024*1024)throw Error('Image trop volumineuse.');pictures[key]=data;preview(key);toast('Image ajoutée ✓');
  }finally{URL.revokeObjectURL(url);}
 }catch(err){toast(err.message,true);}finally{uploads--;$('save-race').disabled=uploads>0;}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4500);}
function picture(src){return new Promise(yes=>{if(!validImage(src))return yes(null);const im=new Image();im.onload=()=>yes(im);im.onerror=()=>yes(null);im.src=src;});}
function contain(ctx,im,x,y,w,h){if(!im)return;const scale=Math.min(w/im.width,h/im.height),iw=im.width*scale,ih=im.height*scale;ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
function wrap(ctx,text,width,n){let result=[],line='';for(const word of String(text).split(/\s+/)){const test=(line?line+' ':'')+word;if(ctx.measureText(test).width>width&&line){result.push(line);line=word;}else line=test;if(result.length>=n)break;}if(line&&result.length<n)result.push(line);return result;}
async function exportPNG(r){
 try{
  if(document.fonts?.ready)await document.fonts.ready;
  const [im,ranking,route]=await Promise.all(imageKeys.map(k=>picture(r[k])));
  // Compact editorial export: only the colour strip, poster and race information.
  // Images keep their own ratio; the main artwork stays inside a 16:9 area.
  const W=1200,STRIP=8,PHOTO=675,SHOT_H=(ranking||route)?434:0;
  const c=document.createElement('canvas');
  c.width=W;
  const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas indisponible');
  const left=46,right=1154;
  // Exporter la même note que sur la tuile (snapshot figé si disponible).
  const pngScore=scoreView(r),pngHasScore=pngScore.available&&!!r.rank;
  const tag=getClassTagColor(r.boatClass);
  const boatLabel=(r.boatClass||'VIRTUAL REGATTA').toUpperCase().slice(0,28);
  ctx.font='800 18px Poppins,sans-serif';
  const tagWidth=Math.min(295,Math.max(110,ctx.measureText(boatLabel).width+28));
  let vsrWidth=0;
  if(VSR[r.vsr]){
   ctx.font='900 16px Poppins,sans-serif';
   vsrWidth=Math.min(230,Math.max(80,ctx.measureText(VSR[r.vsr]).width+29));
  }
  const tagsWidth=tagWidth+(vsrWidth?10+vsrWidth:0);
  // Place class + VSR immediately next to a short title. Longer titles wrap
  // without being squashed, and their labels move to a second compact line.
  ctx.font='900 39px Poppins,sans-serif';
  const titleLines=wrap(ctx,r.name||'Course sans nom',right-left,2);
  const titleBase=57,titleStep=48;
  const lastTitleY=titleBase+titleStep*(titleLines.length-1);
  const lastTitleWidth=ctx.measureText(titleLines[titleLines.length-1]||'').width;
  const inlineTags=lastTitleWidth+tagsWidth+18<=right-left;
  const tagsX=inlineTags?Math.round(left+lastTitleWidth+18):left;
  const tagsTop=inlineTags?lastTitleY-34:lastTitleY+12;
  const infoLead=Math.max(lastTitleY+11,tagsTop+39)+9;
  const boatY=infoLead+17;
  const datesTop=infoLead+(r.boat?44:24);
  const rankTop=datesTop+81;
  // The ranking section is directly below the data, with a small fixed gutter.
  const INFO=rankTop+256;
  const height=STRIP+PHOTO+INFO+SHOT_H;
  c.height=height;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,height);
  ctx.fillStyle='#00c6c8';ctx.fillRect(0,0,890,STRIP);
  ctx.fillStyle='#f30082';ctx.fillRect(890,0,310,STRIP);
  const posterY=STRIP;
  ctx.fillStyle='#e4f4f3';ctx.fillRect(0,posterY,W,PHOTO);
  contain(ctx,im,0,posterY,W,PHOTO);
  if(r.upcoming||r.live||r.dnf){
   ctx.fillStyle=r.dnf?'#aa4939':r.upcoming?'#176cce':'#eb007c';
   ctx.fillRect(30,posterY+22,330,43);
   ctx.font='900 19px Poppins,sans-serif';ctx.fillStyle='#fff';
   ctx.fillText(r.dnf?'DNF · ABANDON':r.upcoming?'À VENIR':'COURSE EN COURS',44,posterY+51);
  }
  const y=STRIP+PHOTO;
  ctx.fillStyle='#123648';ctx.font='900 39px Poppins,sans-serif';
  titleLines.forEach((line,i)=>ctx.fillText(line,left,y+titleBase+i*titleStep,right-left));
  ctx.fillStyle=tag;ctx.fillRect(tagsX,y+tagsTop,tagWidth,39);
  ctx.fillStyle=classTextColor(tag);ctx.font='800 18px Poppins,sans-serif';
  ctx.fillText(boatLabel,tagsX+12,y+tagsTop+26,tagWidth-24);
  if(vsrWidth){
   const vsrLabel=VSR[r.vsr],vsrX=tagsX+tagWidth+10;
   const vsrColor=getVSRTagColor(r.vsr);
   ctx.fillStyle=vsrColor;ctx.fillRect(vsrX,y+tagsTop,vsrWidth,39);
   ctx.fillStyle=classTextColor(vsrColor);ctx.font='900 16px Poppins,sans-serif';
   ctx.fillText(vsrLabel,vsrX+12,y+tagsTop+26,vsrWidth-23);
  }
  if(r.boat){
   ctx.fillStyle='#728995';ctx.font='700 18px Poppins,sans-serif';
   wrap(ctx,r.boat,right-left,1).forEach(t=>ctx.fillText(t,left,y+boatY));
  }
  ctx.fillStyle='#245c6c';ctx.font='800 17px Poppins,sans-serif';
  if(r.start)ctx.fillText('DÉPART · '+dateTimeFR(r.start,r.startTime),left,y+datesTop,right-left);
  if(!r.dnf&&r.end)ctx.fillText('ARRIVÉE · '+dateTimeFR(r.end,r.endTime),left,y+datesTop+28,530);
  if(r.duration){
   ctx.font='700 21px "Courier Prime","American Typewriter",monospace';ctx.fillStyle='#1a5368';
   ctx.fillText('DURÉE · '+r.duration,618,y+datesTop+28,515);
  }
  ctx.font='800 17px Poppins,sans-serif';ctx.fillStyle='#987021';
  if(moneyNumber(r.gainPoints))
   ctx.fillText('POINTS VSR : +'+Number(r.gainPoints).toLocaleString('fr-FR'),left,y+datesTop+55,510);
  ctx.fillStyle='#377c56';
  if(moneyNumber(r.gainCredits))
   ctx.fillText('CRÉDITS VR : +'+Number(r.gainCredits).toLocaleString('fr-FR'),618,y+datesTop+55,515);

  const ranks=[
   ['🏆','CLASSEMENT GÉNÉRAL',r.rank,r.rankTotal,podiumMedalFor(r,'rank','rankTotal')],
   ['🇫🇷','NATIONAL',r.rankNational,r.rankNationalTotal,podiumMedalFor(r,'rankNational','rankNationalTotal')],
   ['🇨🇶','DÉPARTEMENTAL',r.rankDepartment,r.rankDepartmentTotal,podiumMedalFor(r,'rankDepartment','rankDepartmentTotal')],
   ['🏙️','VILLE',r.rankCity,r.rankCityTotal,podiumMedalFor(r,'rankCity','rankCityTotal')],
   ['🏴‍☠️','TEAM',r.rankTeam,r.rankTeamTotal,podiumMedalFor(r,'rankTeam','rankTeamTotal')]
  ];
  const drawRank=(i,x,top,width,h)=>{
   const [emoji,label,place,total,medal]=ranks[i];
   ctx.fillStyle=i===0?'#135772':i===1?'#eef5fc':i===2?'#edf9f5':i===3?'#f7f3f9':'#f7f4ef';
   ctx.fillRect(x,top,width,h);
   ctx.strokeStyle=i===0?'#0f7690':'#d1e3e6';ctx.lineWidth=2;ctx.strokeRect(x,top,width,h);
   ctx.font='24px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
   ctx.fillStyle=i===0?'#fff':'#244b5e';ctx.fillText(emoji,x+13,top+33);
   ctx.fillStyle=i===0?'#b1e6ef':'#7d929e';
   ctx.font='800 14px Poppins,sans-serif';ctx.fillText(label,x+56,top+28);
   ctx.font=(i===0?'800 39px':'800 34px')+' "Barlow Condensed","Arial Narrow",sans-serif';
   ctx.fillStyle=i===0?'#fff':'#193e57';
   let value=r.dnf?(i===0?'DNF':'—'):(rankDisplay(place,total)||'—');
   const available=width-75-(medal?42:0);
   while(ctx.measureText(value).width>available&&value.length>2)value=value.slice(0,-2)+'…';
   ctx.fillText(value,x+56,top+h-14,available);
   if(medal){
    ctx.font='27px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.fillText(medal,x+width-40,top+h-14);
   }
  };
  // Le classement général se réduit pour accueillir le cercle de notation à droite.
  drawRank(0,left,y+rankTop,right-left-(pngHasScore?112:0),80);
  if(pngHasScore){
   const cx=right-43,cy=y+rankTop+40,outerRadius=39,ratio=Math.max(0,Math.min(1,pngScore.value/100));
   ctx.save();
   ctx.beginPath();ctx.arc(cx,cy,outerRadius,0,Math.PI*2);
   ctx.fillStyle='#142a50';ctx.fill();
   // Note 0 : aucun arc. Note 100 : cercle complet.
   if(ratio>0){
    const gradient=ctx.createLinearGradient(cx-outerRadius,cy-outerRadius,cx+outerRadius,cy+outerRadius);
    gradient.addColorStop(0,'#268fe4');gradient.addColorStop(1,'#d73e9a');
    ctx.beginPath();ctx.arc(cx,cy,outerRadius-4,-Math.PI/2,-Math.PI/2+2*Math.PI*ratio,false);
    ctx.lineWidth=8;ctx.lineCap=ratio===1?'butt':'round';
    ctx.strokeStyle=gradient;ctx.shadowColor=ratio>=.95?'#cc3c96':'#4d80d1';
    ctx.shadowBlur=ratio>=.95?18:Math.round(3+10*ratio);ctx.stroke();
   }
   ctx.shadowBlur=0;ctx.fillStyle='#fff';
   ctx.font='900 30px Poppins,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(pngScore.value),cx,cy+1);
   ctx.restore();
  }
  for(let i=1;i<5;i++){
   const x=left+(i%2===0?565:0),row=Math.floor((i-1)/2);
   drawRank(i,x,y+rankTop+90+row*80,543,70);
  }
  if(SHOT_H){
   const shotY=y+INFO;
   ctx.fillStyle='#e7f3f5';ctx.fillRect(0,shotY,W,SHOT_H);
   for(const [i,image,label] of [[0,ranking,'CLASSEMENT FINAL'],[1,route,'TRACÉ DE COURSE']]){
    const x=30+i*582;
    ctx.fillStyle='#244b5e';ctx.font='800 20px Poppins,sans-serif';
    ctx.fillText(label,x,shotY+29);
    ctx.fillStyle='#d0e5e7';ctx.fillRect(x,shotY+42,556,377);
    contain(ctx,image,x,shotY+42,556,377);
   }
  }
  const blob=await new Promise((yes,no)=>c.toBlob(b=>b?yes(b):no(Error('Export PNG impossible')),'image/png'));
  download(blob,'Rapli_Regatta_'+r.name.replace(/[^a-z0-9-]+/gi,'_').slice(0,65)+'.png');
  toast('PNG compact exporté ✓');
 }catch(err){console.error(err);toast('Export PNG : '+err.message,true);}
}
function calendarEscape(input){
 return String(input??'').replace(/\r\n?/g,'\n').replace(/\\/g,'\\\\')
   .replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').slice(0,6000);
}
function toIcsTime(date,clock='00:00'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock))return '';
 return date.replace(/-/g,'')+'T'+clock.replace(/:/g,'').padEnd(6,'0');
}
function foldCalendarLine(line){
 const encoder=new TextEncoder();
 let result='',bytes=0;
 for(const ch of line){
   const size=encoder.encode(ch).length;
   if(bytes+size>75){result+='\r\n ';bytes=1;}
   result+=ch;bytes+=size;
 }
 return result;
}
function calendarText(r){
 if(!r.upcoming)throw Error('Disponible uniquement pour une course à venir.');
 if(!r.start)throw Error('Renseigne la date de départ pour exporter dans Calendrier.');
 const startClock=r.startTime||'';
 let start='',finish='',allDay=false,placeholder=false;
 if(startClock){
   start=toIcsTime(r.start,startClock);
   if(!start)throw Error('Heure de départ invalide.');
   const end=calculateArrival(r.start,startClock,r.duration);
   if(end.status==='ready'&&parseRaceDuration(r.duration).seconds>0){
     finish=toIcsTime(end.end,end.endTime);
   }else{
     const [year,month,day]=r.start.split('-').map(Number);
     const [h,m,sec=0]=startClock.split(':').map(Number);
     const next=new Date(Date.UTC(year,month-1,day,h+1,m,sec)).toISOString();
     finish=next.slice(0,10).replace(/-/g,'')+'T'+next.slice(11,19).replace(/:/g,'');
     placeholder=true;
   }
 }else{
   allDay=true;start=r.start.replace(/-/g,'');
   const [year,month,day]=r.start.split('-').map(Number);
   const next=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
   finish=next.replace(/-/g,'');
 }
 const descriptions=[
   'Bateau : '+(r.boat||'Non renseigné'),
   'Classe : '+(r.boatClass||'Non renseignée'),
   'Catégorie VSR : '+(VSR[r.vsr]||'Non renseignée'),
   'Équipement : '+(equipmentModes[r.equipment]||'Non renseigné'),
   'Durée : '+(r.duration||'Non renseignée'),
   placeholder?'Plage de calendrier indicative : 1 heure après le départ.':'',
 ].filter(Boolean).join('\n');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
 const uidValue=String(r.id||'race').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)+'@regatta.raplilab';
 const times=allDay?'DTSTART;VALUE=DATE:'+start+'\r\nDTEND;VALUE=DATE:'+finish:
   'DTSTART:'+start+'\r\nDTEND:'+finish;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rapli Regatta//FR','CALSCALE:GREGORIAN',
  'BEGIN:VEVENT','UID:'+uidValue,'DTSTAMP:'+stamp,'SUMMARY:'+calendarEscape(r.name),
  ...times.split('\r\n'),'DESCRIPTION:'+calendarEscape(descriptions),'END:VEVENT','END:VCALENDAR',''].map(foldCalendarLine).join('\r\n');
}
function exportCalendar(r){
 try{
  const ics=calendarText(r);
  download(new Blob([ics],{type:'text/calendar;charset=utf-8'}),'Rapli_Regatta_'+r.name.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)+'.ics');
  toast('Fichier calendrier .ics prêt : ouvre-le pour ajouter la course à Apple Calendrier.');
 }catch(error){toast(error.message||'Export calendrier indisponible',true);}
}

function exportJSON(){download(new Blob([JSON.stringify({app:'Rapli Regatta',version:2,exportedAt:now(),races:rows,settings:classSettings},null,2)],{type:'application/json'}),'Rapli_Regatta_'+now().slice(0,10)+'.json');toast('JSON exporté ✓');}
async function importJSON(file){if(!file)return;try{if(file.size>120e6)throw Error('Fichier trop volumineux');const obj=JSON.parse(await file.text());if(obj.app!=='Rapli Regatta'||!Array.isArray(obj.races)||obj.races.length>20000)throw Error('Fichier de sauvegarde invalide');const next=obj.races.map(normal);if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('IDs dupliqués');if(!confirm('Importer '+next.length+' courses et remplacer la collection locale ?'))return;await replaceRows(next);if(obj.settings)storeClassSettings(obj.settings,{notifyCloud:false});window.RapliModuleCloud?.changed?.();toast('Collection importée ✓');}catch(err){toast(err.message,true);}finally{$('import-json').value='';}}
$('race-equipment-group').addEventListener('change',event=>{
 const selected=event.target.closest('input[name="race-equipment"]');
 if(!selected||!selected.checked)return;
 equipmentInputs().forEach(input=>{if(input!==selected)input.checked=false;});
});
for(const key of ['start','startTime','durationDays','durationHours','durationMinutes','durationSeconds'])
  getField(key).addEventListener('input',updateArrival);
for(const key of ['start','startTime','durationDays','durationHours','durationMinutes','durationSeconds'])
  getField(key).addEventListener('change',updateArrival);
for(const [selected,others] of [['race-live',['race-upcoming','race-dnf']],['race-upcoming',['race-live','race-dnf']],['race-dnf',['race-live','race-upcoming']]]){
 $(selected).addEventListener('change',event=>{if(event.target.checked)others.forEach(id=>$(id).checked=false);});
}
$('race-kind').addEventListener('change',updateKindFields);
$('race-event-id').addEventListener('change',updateKindFields);
for(const view of ['races','stats','colors'])$('view-'+view).addEventListener('click',()=>selectWorkspace(view));
$('default-class-color').addEventListener('change',event=>changeDefaultClassColor(event.target.value));
$('class-colors-list').addEventListener('change',event=>{
 const el=event.target;
 if(el.matches?.('input[data-class-key]'))changeSpecificClassColor(el.dataset.classKey,el.value);
});
$('vsr-colors-list').addEventListener('change',event=>{
 const el=event.target;
 if(el.matches?.('input[data-vsr-key]'))changeVSRColor(el.dataset.vsrKey,el.value);
});
$('export-general-pdf').addEventListener('click',openPdfDialog);
$('pdf-form').addEventListener('submit',exportGeneralPdf);
document.querySelectorAll('[data-pdf-close]').forEach(button=>button.addEventListener('click',closePdfDialog));
pdfDialog.addEventListener('click',event=>{if(event.target===pdfDialog)closePdfDialog();});
for(const id of pdfFilterIds)$(id).addEventListener('change',updatePdfCount);
$('new-race').addEventListener('click',()=>openEditor());$('empty-add').addEventListener('click',()=>openEditor());$('race-form').addEventListener('submit',saveEditor);$('delete-race').addEventListener('click',()=>{if(editId)deleteRace(editId);});
for(const id of ['search','filter-status','filter-vsr','filter-class','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
$('recalculate-scores').addEventListener('click',openScoreRecalc);
$('score-recalc-confirm').addEventListener('click',confirmScoreRecalc);
document.querySelectorAll('[data-score-close]').forEach(x=>x.addEventListener('click',()=>scoreDialog.close()));
document.querySelectorAll('[data-recalc-close]').forEach(x=>x.addEventListener('click',()=>recalcDialog.close()));
for(const modal of [scoreDialog,recalcDialog])modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
const cardContainer=$('cards');
cardContainer.addEventListener('contextmenu',event=>{
 const orb=event.target.closest('.score-orb');if(!orb)return;
 event.preventDefault();
 const r=rows.find(x=>x.id===orb.closest('[data-id]')?.dataset.id);if(r)openScoreDetail(r);
});
let longPress=null,longPressOpened=false;
function clearLongPress(){if(longPress!==null){clearTimeout(longPress);longPress=null;}}
cardContainer.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='touch')return;
 const orb=event.target.closest('.score-orb');if(!orb)return;
 longPressOpened=false;clearLongPress();
 longPress=setTimeout(()=>{longPressOpened=true;const r=rows.find(x=>x.id===orb.closest('[data-id]')?.dataset.id);if(r)openScoreDetail(r);},600);
});
for(const name of ['pointerup','pointercancel','pointermove'])cardContainer.addEventListener(name,clearLongPress);
for(const key of imageKeys){$('image-'+key).addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';fileData(f,key);});document.querySelector('[data-remove="'+key+'"]').addEventListener('click',()=>{pictures[key]='';preview(key);});const zone=document.querySelector('[data-image="'+key+'"] .upload-preview');zone.addEventListener('dragover',e=>{e.preventDefault();});zone.addEventListener('drop',e=>{e.preventDefault();fileData(e.dataTransfer?.files[0],key);});}
$('cards').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const r=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!r)return;if(btn.dataset.action==='edit')openEditor(r);if(btn.dataset.action==='delete')deleteRace(r.id);if(btn.dataset.action==='png')exportPNG(r);if(btn.dataset.action==='score'&&!longPressOpened)openScoreDetail(r);if(btn.dataset.action==='score')longPressOpened=false;if(btn.dataset.action==='calendar')exportCalendar(r);});
$('export-json').addEventListener('click',exportJSON);$('import-json').addEventListener('change',e=>importJSON(e.target.files[0]));document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dialog.open){e.preventDefault();$('search').focus();}});
window.addEventListener?.('resize',scheduleRankingFit);
const bridge=window.RapliModuleBridge={module:'regatta',ready:false,
 getState:()=>({records:rows,logos:colorSettingsState()}),notify:msg=>toast(msg),
 replaceState:async data=>{
  if(!Array.isArray(data?.records)||!Array.isArray(data?.logos)||data.records.length>20000||data.logos.length>1||
     (data.logos.length===1&&data.logos[0]?.id!==COLOR_SETTINGS_ID))
    throw Error('Collection Regatta cloud invalide');
  const next=data.records.map(normal);
  if(new Set(next.map(r=>r.id)).size!==next.length)throw Error('Doublons cloud');
  await replaceRows(next);
  storeClassSettings(data.logos[0]||defaultClassSettings(),{notifyCloud:false});
 }};
window.RapliRegatta={getCount:()=>rows.length};
(async()=>{try{await openDB();rows=await load();render();}catch(err){console.warn(err);rows=[];render();toast('Stockage local indisponible',true);}bridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));})();
})();