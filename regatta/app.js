/* Rapli Regatta — race archive, private IndexedDB collection, Supabase bridge. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(v,n=150)=>String(v??'').trim().slice(0,n);
const uid=()=>crypto.randomUUID?crypto.randomUUID():'race-'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const timeEngine=window.RapliRegattaTime;
if(!timeEngine)throw Error('Moteur de fuseaux horaires non chargé.');
const searchEngine=window.RapliRegattaSearch;
if(!searchEngine)throw Error('Moteur de recherche Regatta non chargé.');
const zoneName=r=>timeEngine.ZONES[timeEngine.normalize(r?.timezone)]||timeEngine.ZONES[timeEngine.DEFAULT];
const BOAT_NAME='Rapli LPDB';
const props={name:180,boatClass:100,start:20,startTime:8,end:20,endTime:8,rank:40,rankTotal:12,rankDepartment:40,rankDepartmentTotal:12,rankNational:40,rankNationalTotal:12,rankCity:40,rankCityTotal:12,rankTeam:40,rankTeamTotal:12,duration:100,durationDays:4,durationHours:2,durationMinutes:2,durationSeconds:2,vsr:5,participantCount:12,gainPoints:9,gainCredits:9};
const imageKeys=['icon','result','route'];
const ROUTE_TYPES=Object.freeze({'tour-du-monde':'Tour du monde','transatlantique':'Transatlantique','cotier':'Côtier','etapes':'Course à étapes','record-distance':'Record de distance','autre':'Autre parcours'});
const routeType=v=>Object.prototype.hasOwnProperty.call(ROUTE_TYPES,v)?v:'';
let regattaCompact=false;try{regattaCompact=localStorage.getItem('rapli-regatta-compact-v1')==='1';}catch(_){/* stockage indisponible */}

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
function calculateArrival(day,time,duration,zone=timeEngine.DEFAULT){
 if(!day||!time||!String(duration||'').trim())return {status:'waiting'};
 const parsed=parseRaceDuration(duration);
 if(parsed.status!=='valid')return {status:'invalid-duration'};
 const start=timeEngine.fromWall(day,time,zone);
 if(start===null)return {status:'invalid-date'};
 const end=timeEngine.arrival(day,time,parsed.seconds,zone);
 if(!end)return {status:'invalid-duration'};
 return {status:'ready',end:end.date,endTime:end.time,timestamp:end.timestamp};
}
const dateTimeFR=(day,time)=>[dateFR(day),/^\d{2}:\d{2}(?::\d{2})?$/.test(time||'')?time:''].filter(Boolean).join(' · ');
let legacyArrival=null;
function updateArrival(){
 const date=getField('start').value,time=getField('startTime').value,duration=syncDurationInput();
 const outcome=calculateArrival(date,time,duration,$('race-timezone').value);
 const message=$('arrival-feedback');
 if(outcome.status==='ready'){
   getField('end').value=outcome.end;getField('endTime').value=outcome.endTime;
   message.textContent='Arrivée calculée automatiquement · '+dateTimeFR(outcome.end,outcome.endTime)+' · '+zoneName({timezone:$('race-timezone').value});
   message.dataset.state='ok';
 }else{
   const sameAsLegacy=legacyArrival&&date===legacyArrival.start&&time===legacyArrival.startTime&&timeEngine.normalize($('race-timezone').value)===legacyArrival.timezone&&
   (duration===legacyArrival.duration||(duration===''&&parseRaceDuration(legacyArrival.duration).status!=='valid'));
   getField('end').value=sameAsLegacy?legacyArrival.end:'';
   getField('endTime').value=sameAsLegacy?legacyArrival.endTime:'';
   message.dataset.state=outcome.status.startsWith('invalid')?'error':'waiting';
   if(sameAsLegacy && legacyArrival.end)
     message.textContent='Ancienne date d’arrivée conservée. Renseigne l’heure de départ et la durée pour la recalculer.';
   else if(outcome.status==='invalid-duration')
     message.textContent='Durée invalide : jours 0–3650, heures 0–23, minutes et secondes 0–59.';
   else if(outcome.status==='invalid-date')
     message.textContent='Date ou heure impossible dans le fuseau choisi (attention aux changements d’heure).';
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
const defaultClassSettings=()=>({id:COLOR_SETTINGS_ID,defaultColor:DEFAULT_TAG_COLOR,classColors:{},vsrColors:{...DEFAULT_VSR_COLORS},vsrRankingHistory:[]});
function normalizeVsrRankingHistory(value){
 if(!Array.isArray(value))return [];
 const seen=new Set(),points=[];
 for(const item of value.slice(0,5000)){
  const date=String(item?.date||'');
  const rank=Number(item?.rank),id=String(item?.id||'').slice(0,90);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isSafeInteger(rank)||rank<1||rank>99999999||!id||seen.has(id))continue;
  const ts=new Date(date);
  if(!Number.isFinite(ts.getTime())||ts.getFullYear()!==Number(date.slice(0,4))||ts.getMonth()+1!==Number(date.slice(5,7))||ts.getDate()!==Number(date.slice(8,10)))continue;
  seen.add(id);points.push({id,date,rank,note:clean(item.note,120)});
 }
 return points.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
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
 return {id:COLOR_SETTINGS_ID,defaultColor:colorSafe(source.defaultColor),classColors,vsrColors,vsrRankingHistory:normalizeVsrRankingHistory(source.vsrRankingHistory)};
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
   VSR_ORDER.some(key=>getVSRTagColor(key)!==DEFAULT_VSR_COLORS[key])||
   classSettings.vsrRankingHistory.length>0;
}
function colorSettingsState(){
 return settingsAreCustom()?[classSettings]:[];
}
function storeClassSettings(input,{notifyCloud=true}={}){
 if(notifyCloud && !window.RapliSharedCollection?.canEdit?.()){
  toast('Connexion administrateur et collection chargée nécessaires.',true);return;
 }
 classSettings=normalizeClassSettings(input);
 try{localStorage.setItem(COLOR_STORAGE_KEY,JSON.stringify(classSettings));}
 catch(e){console.warn('Rapli Regatta: impossible de mémoriser les couleurs localement',e);toast('Sauvegarde locale des couleurs indisponible',true);}
 render();
 if(notifyCloud)window.RapliSharedCollection?.changed?.();
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
function normal(x={}){const r={id:typeof x.id==='string'&&x.id.length<130?x.id:uid(),createdAt:x.createdAt||now(),updatedAt:x.updatedAt||now(),live:!!x.live&&!x.dnf,upcoming:!!x.upcoming&&!x.live&&!x.dnf,dnf:!!x.dnf,kind:['race','event','record'].includes(x.kind)?x.kind:'race',eventId:clean(x.eventId,130),eventClosed:!!x.eventClosed,recordClosed:!!x.recordClosed,joker:!!x.joker,equipment:validEquipment(x.equipment),edition:clean(x.edition,100),timezone:timeEngine.normalize(x.timezone),routeType:routeType(x.routeType)};for(const [k,n] of Object.entries(props))r[k]=clean(x[k],n);
 r.boat=BOAT_NAME;
 r.classColor=colorSafe(x.classColor);r.notes=clean(x.notes,2500);r.vsr=VSR[r.vsr]?r.vsr:'';
 r.attempts=window.RapliRegattaRecordAttempts.normalize(x.attempts);
 if(r.kind==='record'&&r.recordClosed)r.live=false;
 if(r.kind!=='record')r.recordClosed=false;
 if(r.kind==='record'){
  // Older record entries had one start date on the parent. Preserve it as the first
  // attempt's departure, never duplicate it across all attempts.
  const record=window.RapliRegattaRecordAttempts;
  if(!r.attempts.some(attempt=>attempt.startDate)&&record.validDate(r.start)){
   if(!r.attempts.length)r.attempts=[{id:uid(),seconds:null,aborted:false,startDate:'',startTime:''}];
   r.attempts[0]={...r.attempts[0],startDate:r.start,startTime:record.validTime(r.startTime)};
  }
  const first=record.earliestStart(r.attempts);
  r.start=first.date;r.startTime=first.time;
 }
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
 for(const k of imageKeys)r[k]=validImage(x[k])?x[k]:'';if(r.kind!=='record'){const arrival=calculateArrival(r.start,r.startTime,r.duration,r.timezone);if(arrival.status==='ready'){r.end=arrival.end;r.endTime=arrival.endTime;}}return r;}
let rows=[],db=null,editId='',pictures={icon:'',result:'',route:''},uploads=0,writeBusy=false,timer;
let storageRecoveryBlocked=false;
 let regattaPage=1,regattaResultsCount=0;
 const REGATTA_PAGE_SIZE=30;
 function regattaPager(total){
   const pages=Math.ceil(total/REGATTA_PAGE_SIZE);
   regattaPage=Math.max(1,Math.min(regattaPage,Math.max(1,pages)));
   if(total<=0)return '';
   const visible=[...new Set([1,pages,regattaPage-1,regattaPage,regattaPage+1]
     .filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);
   let previous=0,links='';
   for(const n of visible){
     if(n-previous>1)links+='<span class="regatta-page-ellipsis" aria-hidden="true">…</span>';
     links+='<button type="button" data-regatta-page="'+n+'" aria-label="Page '+n+' sur '+pages+'"'+
       (n===regattaPage?' aria-current="page" class="regatta-page-active"':'')+'>'+n+'</button>';
     previous=n;
   }
   const first=(regattaPage-1)*REGATTA_PAGE_SIZE+1,last=Math.min(total,regattaPage*REGATTA_PAGE_SIZE);
   return '<nav class="regatta-pagination" aria-label="Pagination des courses">'+
     '<button type="button" data-regatta-page="'+(regattaPage-1)+'" aria-label="Page précédente"'+(regattaPage===1?' disabled':'')+'>‹</button>'+
     links+
     '<button type="button" data-regatta-page="'+(regattaPage+1)+'" aria-label="Page suivante"'+(regattaPage===pages?' disabled':'')+'>›</button>'+
     '</nav>';
 }
const dialog=$('race-dialog'),getField=k=>$('race-'+({boatClass:'class',startTime:'start-time',endTime:'end-time',rankDepartment:'rank-department',rankNational:'rank-national',rankTotal:'rank-total',rankNationalTotal:'rank-national-total',rankDepartmentTotal:'rank-department-total',rankCity:'rank-city',rankCityTotal:'rank-city-total',rankTeam:'rank-team',rankTeamTotal:'rank-team-total',durationDays:'days',durationHours:'hours',durationMinutes:'minutes',durationSeconds:'seconds',gainPoints:'gain-points',gainCredits:'gain-credits',participantCount:'participant-count'}[k]||k));
function toast(t,error=false){$('notice').textContent=t;$('notice').dataset.error=String(error);clearTimeout(timer);timer=setTimeout(()=>{$('notice').textContent='';},7000);}
const req=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error||Error('IndexedDB inaccessible'));});
const done=tx=>new Promise((yes,no)=>{tx.oncomplete=yes;tx.onerror=()=>no(tx.error||Error('Sauvegarde locale impossible'));tx.onabort=()=>no(tx.error||Error('Stockage local annulé'));});
async function openDB(){if(!window.indexedDB)return;const r=indexedDB.open('rapli-regatta-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('races'))r.result.createObjectStore('races',{keyPath:'id'});};db=await req(r);}
function backup(){const raw=localStorage.getItem('rapli-regatta-v1');if(raw===null)return [];const stored=JSON.parse(raw);if(!Array.isArray(stored))throw Error('Sauvegarde Regatta invalide');return stored;}
async function load(){return db?(await req(db.transaction('races').objectStore('races').getAll())).map(normal):backup().map(normal);}
async function saveRow(row){if(!window.RapliSharedCollection?.canEdit?.())throw Error("Collection partagée non prête ou mode édition inactif.");if(storageRecoveryBlocked)throw Error('Stockage des courses inaccessible : enregistrement bloqué.');if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify([...rows.filter(x=>x.id!==row.id),row]));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').put(row);await done(tx);}
async function deleteRow(id){if(!window.RapliSharedCollection?.canEdit?.())throw Error("Collection partagée non prête ou mode édition inactif.");if(storageRecoveryBlocked)throw Error('Stockage des courses inaccessible : suppression bloquée.');if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(rows.filter(x=>x.id!==id)));return;}const tx=db.transaction('races','readwrite');tx.objectStore('races').delete(id);await done(tx);}
async function replaceRows(next){if(storageRecoveryBlocked)throw Error('Stockage des courses inaccessible : restauration bloquée.');if(!db){localStorage.setItem('rapli-regatta-v1',JSON.stringify(next));}else{const tx=db.transaction('races','readwrite'),store=tx.objectStore('races');store.clear();next.forEach(x=>store.put(x));await done(tx);}rows=next.map(normal);render();}

 function localDateTime(date,time='',zone=timeEngine.DEFAULT){
 return timeEngine.fromWall(date,time||'00:00',zone);
}
 function raceClockInfo(row){
   const st=raceStatus(row);
   const live=st==='live'||st==='record-live';
   if(!live&&st!=='planned')return null;
   const attempt=row.kind==='record'?recordEngine.latestStart(row.attempts):null;
   const date=attempt?.date||row.start,time=attempt?.time||row.startTime;
   const start=time?localDateTime(date,time,row.timezone):null;
   return {mode:live?'elapsed':'countdown',start};
 }
 function formatRaceClock(seconds){
   const sec=Math.floor(Math.max(0,seconds)),days=Math.floor(sec/86400);
   const inner=[Math.floor(sec%86400/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,'0')).join(':');
   return days?days+'j '+inner:inner;
 }
 function updateRaceClocks(){
   const now=Date.now();
   document.querySelectorAll('[data-race-clock]').forEach(el=>{
     const start=Number(el.dataset.start);
     if(!Number.isFinite(start))return;
     const delta=(el.dataset.raceClock==='countdown'?start-now:now-start)/1000;
     el.textContent=delta<0&&el.dataset.raceClock==='countdown'?'DÉPART IMMINENT':formatRaceClock(delta);
   });
 }
 function raceClockMarkup(row){
   const clock=raceClockInfo(row);
   if(!clock)return '';
   if(clock.start===null)return '<div class="race-live-clock '+(clock.mode==='countdown'?'race-live-clock--countdown':'')+
     '"><span aria-hidden="true">⏱</span><span>'+(clock.mode==='countdown'?'DÉPART À VENIR':'EN COURS')+'</span>'+
     '<strong>DÉPART À RENSEIGNER</strong></div>';
   return '<div class="race-live-clock '+(clock.mode==='countdown'?'race-live-clock--countdown':'')+'">'+
      '<span aria-hidden="true">⏱</span><span>'+(clock.mode==='countdown'?'DÉPART DANS':'EN COURSE DEPUIS')+'</span>'+
      '<strong data-race-clock="'+clock.mode+'" data-start="'+clock.start+'">'+
      formatRaceClock((clock.mode==='countdown'?clock.start-Date.now():Date.now()-clock.start)/1000)+'</strong></div>';
 }

 const raceStatus=r=>{
 if(r.kind==='record')return r.recordClosed?'record-closed':r.live?'record-live':'record';
 if(r.dnf)return 'dnf';
 if(r.kind==='event')return r.eventClosed?'finished':r.live?'live':'planned';
 if(r.upcoming)return 'planned';
 if(r.live)return 'live';
 if(rankPairs.some(([key])=>r[key]))return 'finished';
 if(!r.end)return 'planned';
 if(!r.endTime)return 'finished';
 const duration=parseRaceDuration(r.duration);
 const start=timeEngine.fromWall(r.start,r.startTime,r.timezone);
 const finish=(start!==null&&duration.status==='valid')?start+duration.seconds*1000:
    timeEngine.fromWall(r.end,r.endTime,r.timezone);
 return finish!==null&&finish<=Date.now()?'finished':'planned';
},statusTitle={live:'COURSE EN COURS',finished:'TERMINÉE',planned:'À VENIR',dnf:'DNF · ABANDON',record:'COURSE RECORD','record-live':'RECORD EN COURS','record-closed':'RECORD CLÔTURÉ'};
const dateFR=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'';
const scoreEngine=window.RapliRegattaScore;
const recordEngine=window.RapliRegattaRecordAttempts;
const scoreNow=r=>scoreEngine.scoreFor(r,rows,raceStatus);
function scoreView(r){
 if(r.kind==='record')return {available:false,reason:'Course record : notation VSR non applicable'};
 if(raceStatus(r)==='dnf')return {available:false,reason:'DNF — sans note'};
 const saved=r.scoreSnapshot;
 if(saved?.available&&raceStatus(r)==='finished')return saved.kind!==r.kind?{available:false,reason:'Type de fiche modifié — recalcul nécessaire.'}:{...saved,stored:true,stale:saved.signature!==scoreEngine.signature(r)};
 return {...scoreNow(r),stored:false,stale:false};
}
const imageTag=(src,alt)=>validImage(src)?'<img loading="lazy" draggable="false" alt="'+safe(alt)+'" src="'+safe(src)+'">':'<span class="shot-empty">PAS DE CAPTURE</span>';
function recordCardContent(r){
 const attempts=recordEngine.normalize(r.attempts),stats=recordEngine.summary(attempts);
 const line=attempts.map((item,i)=>'<div class="record-attempt-chip'+(item.aborted?' is-aborted':item.id===stats.bestId?' is-best':'')+'"><span>TENTATIVE '+(i+1)+'<small>'+safe(item.startDate?'DÉPART · '+dateTimeFR(item.startDate,item.startTime):'DÉPART À RENSEIGNER')+'</small></span><strong>'+safe(item.aborted?'AVORTÉE':item.seconds!==null?recordEngine.format(item.seconds):'EN ATTENTE')+'</strong></div>').join('');
 return '<section class="record-card" aria-label="Tentatives de record"><div class="record-card-summary"><span>'+stats.total+' TENTATIVE'+(stats.total>1?'S':'')+' · '+stats.aborted+' AVORTÉE'+(stats.aborted>1?'S':'')+'</span><strong>'+safe(stats.bestSeconds!==null?'MEILLEUR TEMPS · '+recordEngine.format(stats.bestSeconds):'AUCUN TEMPS VALIDÉ')+'</strong></div><div class="record-attempt-chips">'+line+'</div></section>';
}
function card(r){
 const status=raceStatus(r),tag=getClassTagColor(r.boatClass),vsrTag=getVSRTagColor(r.vsr),mode=VSR[r.vsr]||'';
 const today=timeEngine.wallAt(Date.now(),r.timezone)?.date;
 const recordStart=r.kind==='record'?recordEngine.latestStart(r.attempts)?.date:'';
 const departsToday=(recordStart||r.start)===today&&!!today;
 const score=scoreView(r);
 // La note n'a ni cartouche ni mention, elle est placée à droite du classement général.
 const scoreRing=score.available?
  '<button type="button" class="score-orb'+(score.value>=95?' score-epic':'')+(score.value===0?' score-zero':'')+'" style="--score-sweep:'+(Math.min(100,Math.max(0,score.value))*3.6)+'deg;--score-glow:'+(score.value/100)+'" data-action="score" aria-label="Voir le détail de la note Rapli : '+safe(score.value)+' sur 100"><span>'+safe(score.value)+'</span></button>':'';
 const showRecordRanking=r.kind==='record'&&r.recordClosed;
 const generalRank=(status==='dnf'||(r.kind==='record'&&!showRecordRanking))?'':rankHtml('🏆','CLASSEMENT GÉNÉRAL',r.rank,r.rankTotal,'rank-main',podiumMedalFor(r,'rank','rankTotal'));
 const rankBlocks=(status==='dnf'||(r.kind==='record'&&!showRecordRanking)?'':(generalRank?'<div class="rank-main-row">'+generalRank+(showRecordRanking?'':scoreRing)+'</div>':'')+
   rankHtml('🇫🇷','NATIONAL',r.rankNational,r.rankNationalTotal,'rank-national',podiumMedalFor(r,'rankNational','rankNationalTotal'))+
   rankHtml('🇨🇶','DÉPARTEMENTAL',r.rankDepartment,r.rankDepartmentTotal,'rank-department',podiumMedalFor(r,'rankDepartment','rankDepartmentTotal'))+
   rankHtml('🏙️','VILLE',r.rankCity,r.rankCityTotal,'rank-city',podiumMedalFor(r,'rankCity','rankCityTotal'))+
   rankHtml('🏴‍☠️','TEAM',r.rankTeam,r.rankTeamTotal,'rank-team',podiumMedalFor(r,'rankTeam','rankTeamTotal')));
 return '<article class="card'+((status==='live'||status==='record-live')?' live':'')+(status==='planned'&&r.upcoming?' upcoming':'')+(status==='dnf'?' dnf':'')+(r.kind==='event'?' event':'')+(r.kind==='record'?' record':'')+(showRecordRanking?' record-closed':'')+'" data-id="'+safe(r.id)+'" style="--class-tag:'+tag+';--class-ink:'+classTextColor(tag)+';--vsr-color:'+vsrTag+';--vsr-ink:'+classTextColor(vsrTag)+'">'+
 '<div class="card-top"><div class="race-icon card-photo">'+(validImage(r.icon)?imageTag(r.icon,'Affiche '+r.name):'<div class="icon-placeholder">⛵</div>')+'</div><span class="badge-status">'+statusTitle[status]+'</span>'+(departsToday?'<span class="start-today-flag" title="Départ aujourd’hui, dans le fuseau de la course">🏁 DÉPART AUJOURD’HUI</span>':'')+'</div>'+
 '<div class="card-content"><div class="card-title-row"><h2 title="'+safe(r.name)+'">'+safe(r.name)+'</h2>'+
 '<div class="card-tag-row"><span class="class-tag" title="'+safe(r.boatClass||'VIRTUAL REGATTA')+'">'+safe(r.boatClass||'VIRTUAL REGATTA')+'</span>'+
 (mode?'<span class="vsr-badge vsr-'+r.vsr+(r.vsr==='hc'?' hc':'')+'" title="Importance VSR : '+(VSR_PRIORITY(r.vsr)+1)+' sur 4">'+safe(mode)+'</span>':'')+'</div></div>'+
 '<div class="card-boat">'+safe(r.boat)+(r.routeType?' · '+safe(ROUTE_TYPES[r.routeType]):'')+(r.kind==='record'?' · COURSE RECORD':r.kind==='event'?' · COMPÉTITION':r.eventId?' · ÉTAPE'+(r.joker?' JOKER':''):'')+'</div>'+
 raceClockMarkup(r)+'<div class="card-stats"><span class="stat-chip">🌐 '+safe(zoneName(r))+'</span>'+(r.kind!=='record'&&r.start?'<span class="stat-chip">DÉPART '+safe(dateTimeFR(r.start,r.startTime))+'</span>':'')+
 (r.kind!=='record'&&status!=='dnf'&&r.end?'<span class="stat-chip arrival-chip">ARRIVÉE '+safe(dateTimeFR(r.end,r.endTime))+'</span>':'')+
 (r.kind!=='record'&&r.duration?'<span class="stat-chip duration-chip">⏱ '+safe(r.duration)+'</span>':'')+
 (r.kind!=='record'&&validEquipment(r.equipment)?'<span class="stat-chip equipment">ÉQUIPEMENT · '+safe(equipmentModes[r.equipment])+'</span>':'')+
 (r.kind!=='record'&&moneyNumber(r.gainPoints)?'<span class="stat-chip reward-points">⭐ +'+safe(Number(r.gainPoints).toLocaleString('fr-FR'))+' POINTS VSR</span>':'')+
 (r.kind!=='record'&&moneyNumber(r.gainCredits)?'<span class="stat-chip reward-credits">🪙 +'+safe(Number(r.gainCredits).toLocaleString('fr-FR'))+' CRÉDITS VR</span>':'')+'</div>'+
 (r.kind==='record'?recordCardContent(r):'')+
 (!score.available&&r.kind!=='record'&&(status==='dnf'||status==='finished')?'<p class="score-pending">'+safe(score.reason||'Note en attente')+'</p>':'')+
 (showRecordRanking&&!rankPairs.some(([key])=>r[key])?'<p class="score-pending">Record clôturé · renseigne les classements finaux avec MODIFIER.</p>':'')+
 (rankBlocks?'<div class="rank-grid">'+rankBlocks+'</div>':'')+
 '<div class="shots"><div class="shot"><label>'+(r.kind==='record'?'CAPTURE DU RECORD':'CLASSEMENT FINAL')+'</label><div class="shot-box image-preview">'+imageTag(r.result,'Classement '+r.name)+'</div></div>'+
 '<div class="shot"><label>TRACÉ</label><div class="shot-box image-preview">'+imageTag(r.route,'Tracé '+r.name)+'</div></div></div>'+
 '<div class="card-actions"><button type="button" class="btn secondary" data-action="edit">MODIFIER</button><button type="button" class="btn subtle" data-action="png">↓ PNG</button>'+
 (r.kind==='record'&&!r.recordClosed?'<button type="button" class="btn record-close-btn" data-action="record-close" title="Clôturer le record et débloquer les classements finaux">✓ CLÔTURER LE RECORD</button>':'')+
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

function raceSearchContext(r){
 const status=raceStatus(r),record=r.kind==='record',showRecordRanking=record&&r.recordClosed;
 const attempts=record?recordEngine.normalize(r.attempts):[];
 const recordStats=record?recordEngine.summary(attempts):null;
 const note=!record?scoreView(r):null;
 const ranksVisible=status!=='dnf'&&(!record||showRecordRanking);
 const scored=note?.available&&ranksVisible&&!!r.rank;
 const showReason=!record&&!note?.available&&(status==='dnf'||status==='finished');
 const first=record?recordEngine.latestStart(attempts)?.date:r.start;
 const today=timeEngine.wallAt(Date.now(),r.timezone)?.date;
 const clock=raceClockInfo(r);
 const clockLabel=!clock?'':clock.mode==='countdown'?
  (clock.start===null?'départ à venir départ à renseigner':'départ dans'):
  (clock.start===null?'en cours départ à renseigner':'en course depuis');
 return {
  status:statusTitle[status]||status,
  clockLabel,vsrCode:r.vsr,
  kind:record?'course record':r.kind==='event'?'compétition':
    r.eventId?'étape'+(r.joker?' joker':''):'',
  routeType:ROUTE_TYPES[r.routeType]||'',
  vsr:VSR[r.vsr]||'',
  timezone:zoneName(r),
  equipment:equipmentModes[r.equipment]||'',
  ranksVisible,
  score:scored?note.value:null,
  scoreReason:showReason?note.reason:'',
  today:!!today&&first===today,
  attempts:attempts.map(a=>({
   ...a,
   timeText:a.aborted?'AVORTÉE':a.seconds!==null?recordEngine.format(a.seconds):'EN ATTENTE',
   timeLabel:a.seconds!==null?'temps de course':''
  })),
  recordSummary:recordStats?
   recordStats.total+' tentatives '+recordStats.aborted+' avortées '+
   (recordStats.bestSeconds!==null?'meilleur temps '+recordEngine.format(recordStats.bestSeconds):'aucun temps validé')+
   (showRecordRanking&&!rankPairs.some(([key])=>r[key])?' record clôturé classement final':''):'',
  capture:(record?'capture du record tracé':'classement final tracé')+
   ((!validImage(r.result)||!validImage(r.route))?' pas de capture':'')
 };
}
function render({searchOnly=false}={}){
 const query=$('search').value.trim();
 const filtered=query?rows.filter(r=>searchEngine.matches(r,query,raceSearchContext(r))):rows;
 const out=[...filtered];
 const statusPriority=item=>{
  const state=raceStatus(item);
  return state==='live'||state==='record-live'?0:state==='planned'?1:2;
 };
 const chronological=r=>{const start=r.kind==='record'?recordEngine.latestStart(r.attempts):{date:r.start,time:r.startTime};return start.date?start.date+'T'+(start.time||'00:00'):r.createdAt||'';};
 out.sort((a,b)=>!query&&statusPriority(a)!==statusPriority(b)?
   statusPriority(a)-statusPriority(b):
   chronological(b).localeCompare(chronological(a))||
   b.createdAt.localeCompare(a.createdAt));
 const raceRows=rows.filter(r=>r.kind==='race');
 $('count-total').textContent=raceRows.length;$('count-live').textContent=rows.filter(r=>['live','record-live'].includes(raceStatus(r))).length;
 $('count-finished').textContent=raceRows.filter(r=>raceStatus(r)==='finished').length;
 $('count-dnf').textContent=raceRows.filter(r=>raceStatus(r)==='dnf').length;
 $('count-record').textContent=rows.filter(r=>r.kind==='record').length;
 $('result-count').textContent=out.length+' / '+rows.length;
 regattaResultsCount=out.length;
 regattaPage=Math.max(1,Math.min(regattaPage,Math.max(1,Math.ceil(out.length/REGATTA_PAGE_SIZE))));
 const pageStart=(regattaPage-1)*REGATTA_PAGE_SIZE;
 const controls=regattaPager(out.length);
 $('regatta-pagination-top').innerHTML=controls;
 $('regatta-pagination-bottom').innerHTML=controls;
 $('cards').classList.toggle('regatta-compact',regattaCompact);
  $('compact-cards').setAttribute('aria-pressed',String(regattaCompact));
  $('compact-cards').title=regattaCompact?'Afficher les fiches complètes':'Afficher les fiches compactes';
  $('cards').innerHTML=out.slice(pageStart,pageStart+REGATTA_PAGE_SIZE).map(card).join('')||
   (rows.length?'<p class="regatta-search-empty">Aucune course ne correspond à ta recherche.</p>':'');
 scheduleRankingFit();updateRaceClocks();
 $('empty').hidden=rows.length!==0;
 // Search and pagination only change the gallery, not statistics or class settings.
 // Avoid recalculating all charts while typing on iPhone.
 if(!searchOnly){renderStatistics();renderHonors();renderClassColors();}
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
function renderHonors(){
 $('honors-content').innerHTML=window.RapliRegattaHonors.render(rows,computeRaceStatistics(rows),scoreView,recordEngine);
}
function renderStatistics(){
 renderVsrRankingHistory();
 const raceRows=rows.filter(r=>r.kind==='race');
 const stats=computeRaceStatistics(raceRows);

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
 const valid=['races','stats','honors','colors'];
 if(!valid.includes(view))return;
 for(const name of valid){
  const active=name===view;
  $(name+'-panel').hidden=!active;
  const tab=$('view-'+name);
  tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
 }
 if(view==='stats')renderStatistics();
  if(view==='honors')renderHonors();
 if(view==='colors')renderClassColors();
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
  window.RapliSharedCollection?.changed?.();
  recalcDialog.close();
  toast('Notes recalculées et enregistrées ✓ ('+updates.size+')');
 }catch(error){rows=previous;render();toast('Recalcul impossible : '+(error?.message||error),true);}
 finally{$('score-recalc-confirm').disabled=false;scoreRecalcChanges=[];}
}
function preview(k){const img=$('preview-'+k),ph=$('placeholder-'+k);img.hidden=!validImage(pictures[k]);ph.hidden=validImage(pictures[k]);if(validImage(pictures[k]))img.src=pictures[k];else img.removeAttribute('src');}
function renderRecordAttempts(attempts){
 const list=$('record-attempts-list');
 list.innerHTML=recordEngine.normalize(attempts).map((a,i)=>{
  const values=recordEngine.parts(a.seconds);
  const inputs=[['days','JOURS',3650],['hours','HEURES',23],['minutes','MIN',59],['seconds','SEC',59]].map(([key,label,max])=>
   '<label>'+label+'<input type="number" min="0" max="'+max+'" inputmode="numeric" data-attempt-part="'+key+'" value="'+safe(values[key])+'" aria-label="Tentative '+(i+1)+' : '+label.toLowerCase()+'"></label>').join('');
  return '<div class="record-attempt-row'+(a.aborted?' is-aborted':'')+'" data-record-id="'+safe(a.id)+'">'+
   '<div class="record-attempt-head"><strong>TENTATIVE '+(i+1)+'</strong><button type="button" class="btn subtle tiny" data-record-remove aria-label="Supprimer tentative '+(i+1)+'">SUPPRIMER</button></div>'+
   '<div class="record-start-grid">'+
   '<label>DATE DE DÉPART<input type="date" data-attempt-start-date value="'+safe(a.startDate)+'" aria-label="Tentative '+(i+1)+' : date de départ"></label>'+
   '<label>HEURE DE DÉPART<input type="time" step="60" data-attempt-start-time value="'+safe(a.startTime)+'" aria-label="Tentative '+(i+1)+' : heure de départ"></label></div>'+
   '<div class="record-time-grid">'+inputs+'</div>'+
   '<label class="record-abort-label"><input type="checkbox" data-record-aborted '+(a.aborted?'checked':'')+'><span>TENTATIVE AVORTÉE</span></label></div>';
 }).join('');
 $('record-add-attempt').disabled=list.children.length>=recordEngine.MAX;
}
function readRecordAttempts(){
 return [...$('record-attempts-list').querySelectorAll('.record-attempt-row')].map((row,i)=>{
  const inputs={};
  for(const key of ['days','hours','minutes','seconds'])inputs[key]=row.querySelector('[data-attempt-part="'+key+'"]').value;
  const time=recordEngine.fromParts(inputs);
  if(!time.valid)throw Error('Tentative '+(i+1)+' : '+time.reason);
  const startDate=row.querySelector('[data-attempt-start-date]').value;
  const startTime=row.querySelector('[data-attempt-start-time]').value;
  if(startDate&&!recordEngine.validDate(startDate))throw Error('Tentative '+(i+1)+' : date de départ incorrecte.');
  if(startTime&&!recordEngine.validTime(startTime))throw Error('Tentative '+(i+1)+' : heure de départ incorrecte.');
  if(startTime&&!startDate)throw Error('Tentative '+(i+1)+' : renseigne la date avant l’heure de départ.');
  return {id:row.dataset.recordId,seconds:time.seconds,aborted:row.querySelector('[data-record-aborted]').checked,startDate,startTime};
 });
}
function updateKindFields(){
 const kind=$('race-kind').value,isEvent=kind==='event',isRecord=kind==='record',isClosedRecord=isRecord&&!!(rows.find(x=>x.id===editId)?.recordClosed);
 if(isEvent){$('race-live').checked=false;$('race-upcoming').checked=false;}
 if(isRecord){$('race-upcoming').checked=false;$('race-dnf').checked=false;if(isClosedRecord)$('race-live').checked=false;}
 $('race-event-id').closest('label').hidden=isEvent||isRecord;
 $('race-event-controls').hidden=!isEvent;
 $('race-joker-control').hidden=isEvent||isRecord||!$('race-event-id').value;
 $('race-live').closest('label').hidden=isEvent||isClosedRecord;
 document.querySelectorAll('.race-global-start').forEach(el=>{el.hidden=isRecord;});
 $('race-upcoming').closest('label').hidden=isEvent||isRecord;
 $('race-dnf').closest('label').hidden=isRecord;
 $('race-record-attempts').hidden=!isRecord;
 $('race-duration').closest('.duration-field').hidden=isRecord;
 for(const field of ['end','endTime'])getField(field).closest('label').hidden=isRecord;
 $('arrival-feedback').hidden=isRecord;
 $('race-participant-count').closest('label').hidden=isRecord;
 $('race-participant-help').hidden=isRecord;
 $('race-vsr').closest('label').hidden=isRecord;
 $('race-equipment-group').hidden=isRecord;
 $('race-gain-points').closest('fieldset').hidden=isRecord;
 $('race-rank').closest('fieldset').hidden=isRecord&&!isClosedRecord;
 $('record-add-attempt').hidden=isClosedRecord;
 $('record-add-attempt').disabled=isClosedRecord||$('record-attempts-list').children.length>=recordEngine.MAX;
 $('record-closed-help').hidden=!isClosedRecord;
 document.querySelectorAll('[data-record-remove]').forEach(btn=>{btn.hidden=isClosedRecord;});
}
function openEditor(r){
 editId=r?.id||'';
 const data=r||normal();
 for(const k of Object.keys(props))if(k!=='boat')getField(k).value=data[k]||'';
 $('race-timezone').value=timeEngine.normalize(data.timezone);
  $('race-route-type').value=routeType(data.routeType);
  legacyArrival={start:data.start,startTime:data.startTime,duration:data.duration,end:data.end,endTime:data.endTime,timezone:timeEngine.normalize(data.timezone)};
 updateArrival();
 $('race-live').checked=!!data.live;
 $('race-upcoming').checked=!!data.upcoming;
 $('race-dnf').checked=!!data.dnf;
 $('race-kind').value=data.kind||'race';
 $('race-kind').disabled=!!(data.kind==='record'&&data.recordClosed);
 $('race-event-closed').checked=!!data.eventClosed;
 $('race-joker').checked=!!data.joker;
 const parentSelect=$('race-event-id');
 parentSelect.innerHTML='<option value="">Aucune · course indépendante</option>'+rows.filter(x=>x.kind==='event'&&x.id!==data.id).map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+'</option>').join('');
 parentSelect.value=data.eventId||'';
 renderRecordAttempts(data.kind==='record'&&data.attempts.length?data.attempts:[{id:uid(),seconds:null,aborted:false,startDate:'',startTime:''}]);
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
 const old=rows.find(x=>x.id===editId);const r={...(old||normal()),updatedAt:now(),routeType:routeType($('race-route-type').value),timezone:timeEngine.normalize($('race-timezone').value),live:$('race-live').checked,upcoming:$('race-upcoming').checked,dnf:$('race-dnf').checked};
 if([r.live,r.upcoming,r.dnf].filter(Boolean).length>1){toast('Choisis un seul statut manuel : en cours, à venir ou DNF.',true);return;}
 r.kind=old?.kind==='record'&&old.recordClosed?'record':['event','record'].includes($('race-kind').value)?$('race-kind').value:'race';
 r.recordClosed=r.kind==='record'&&!!old?.recordClosed;
 if(r.recordClosed)r.live=false;
 r.eventId=r.kind!=='race'?'':clean($('race-event-id').value,130);
 r.eventClosed=r.kind==='event'&&$('race-event-closed').checked;
 r.joker=r.kind==='race'&&!!r.eventId&&$('race-joker').checked;
 if(r.kind==='event'&&(r.live||r.upcoming)){toast('Pour un événement, utilise le statut « Compétition clôturée ».',true);return;}
 const arrival=r.kind==='record'?{status:'waiting'}:updateArrival();if(arrival.status==='invalid-duration'||arrival.status==='invalid-date'){toast('Corrige la durée ou les horaires avant d’enregistrer.',true);getField(arrival.status==='invalid-duration'?'durationDays':'start').focus();return;}
 if(r.kind!=='record'&&syncDurationInput()==='invalid'){toast('Durée incorrecte : vérifie les jours, heures, minutes et secondes.',true);getField('durationDays').focus();return;}
 for(const k of Object.keys(props))if(k!=='boat')r[k]=clean(getField(k).value,props[k]);
 r.boat=BOAT_NAME;
 for(const key of r.kind==='record'?[]:['gainPoints','gainCredits']){
   const value=String(getField(key).value||'').trim();
   if(value&&!moneyNumber(value)){toast('Les gains doivent être des nombres entiers positifs.',true);getField(key).focus();return;}
   r[key]=moneyNumber(value);
 }
 for(const [place,total] of r.kind==='record'&&!r.recordClosed?[]:rankPairs){
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
 const chosen=r.kind==='record'?[]:equipmentInputs().filter(input=>input.checked);if(chosen.length>1){toast('Une seule méthode d’équipement est autorisée.',true);return;}
 r.equipment=validEquipment(chosen[0]?.value);
 if(!r.name){getField('name').focus();return;}for(const k of imageKeys)r[k]=pictures[k]||'';
 if(r.kind==='record'){
  try{r.attempts=recordEngine.normalize(readRecordAttempts());}catch(error){toast(error.message,true);return;}
  // Course record may stay EN COURS across several independent departures.
  r.upcoming=false;r.dnf=false;r.eventClosed=false;r.eventId='';r.joker=false;
  const earliest=recordEngine.earliestStart(r.attempts);
  r.start=earliest.date;r.startTime=earliest.time;
  r.scoreSnapshot=null;
  if(!r.recordClosed)for(const [place,total] of rankPairs){r[place]='';r[total]='';}
  for(const key of ['duration','durationDays','durationHours','durationMinutes','durationSeconds','end','endTime','vsr','gainPoints','gainCredits','participantCount'])r[key]='';
  r.equipment='';
 }else{r.attempts=[];r.recordClosed=false;}
 if(r.kind!=='record'&&!old?.scoreSnapshot){const initial=scoreEngine.scoreFor(r,[...rows.filter(x=>x.id!==r.id),r],raceStatus);if(initial.available)r.scoreSnapshot={...initial,signature:scoreEngine.signature(r),calculatedAt:now()};}
 writeBusy=true;$('save-race').disabled=true;
 try{await saveRow(r);rows=[...rows.filter(x=>x.id!==r.id),r];render();window.RapliSharedCollection?.changed?.();closeEditor();toast('Course enregistrée ✓');}
 catch(err){console.error(err);toast('Impossible de sauvegarder : '+err.message,true);}
 finally{writeBusy=false;$('save-race').disabled=false;}
}
async function closeRecord(id){
 if(writeBusy||uploads)return;
 const existing=rows.find(r=>r.id===id);
 if(!existing||existing.kind!=='record'||existing.recordClosed)return;
 if(!confirm('Clôturer définitivement « '+existing.name+' » ? Les tentatives enregistrées restent conservées. Le statut « En cours » sera retiré et les classements finaux deviendront disponibles.'))return;
 const closed=normal({...existing,recordClosed:true,live:false,upcoming:false,dnf:false,updatedAt:now()});
 writeBusy=true;
 try{
  await saveRow(closed);
  rows=rows.map(r=>r.id===id?closed:r);
  render();
  window.RapliSharedCollection?.changed?.();
  toast('Record clôturé ✓ Renseigne maintenant les classements finaux.');
  openEditor(closed);
  const rankSection=$('race-rank').closest('fieldset');
  rankSection.scrollIntoView({block:'start',behavior:'smooth'});
  getField('rank').focus({preventScroll:true});
 }catch(err){
  console.error(err);toast('Clôture impossible : '+(err?.message||err),true);
 }finally{writeBusy=false;}
}
async function deleteRace(id){
 const r=rows.find(x=>x.id===id);if(!r||!confirm('Supprimer « '+r.name+' » et ses images ?'))return;
 try{await deleteRow(id);rows=rows.filter(x=>x.id!==id);closeEditor();render();window.RapliSharedCollection?.changed?.();toast('Course supprimée ✓');}
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
  const recordEntries=r.kind==='record'?recordEngine.normalize(r.attempts):[];
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
  const INFO=r.kind==='record'?rankTop+Math.max(180,125+recordEntries.length*45+(r.recordClosed?265:0)):rankTop+256;
  const height=STRIP+PHOTO+INFO+SHOT_H;
  c.height=height;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,height);
  ctx.fillStyle='#00c6c8';ctx.fillRect(0,0,890,STRIP);
  ctx.fillStyle='#f30082';ctx.fillRect(890,0,310,STRIP);
  const posterY=STRIP;
  ctx.fillStyle='#e4f4f3';ctx.fillRect(0,posterY,W,PHOTO);
  contain(ctx,im,0,posterY,W,PHOTO);
  if(r.upcoming||r.live||r.dnf||(r.kind==='record'&&r.recordClosed)){
   ctx.fillStyle=r.kind==='record'&&r.recordClosed?'#315b61':r.dnf?'#aa4939':r.upcoming?'#176cce':'#eb007c';
   ctx.fillRect(30,posterY+22,330,43);
   ctx.font='900 19px Poppins,sans-serif';ctx.fillStyle='#fff';
   ctx.fillText(r.kind==='record'?(r.recordClosed?'RECORD CLÔTURÉ':'RECORD EN COURS'):r.dnf?'DNF · ABANDON':r.upcoming?'À VENIR':'COURSE EN COURS',44,posterY+51);
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
  if(r.kind==='record')ctx.fillText('DÉPARTS ET HORAIRES PAR TENTATIVE',left,y+datesTop,right-left);
  else if(r.start)ctx.fillText('DÉPART · '+dateTimeFR(r.start,r.startTime),left,y+datesTop,right-left);
  if(r.kind!=='record'&&!r.dnf&&r.end)ctx.fillText('ARRIVÉE · '+dateTimeFR(r.end,r.endTime),left,y+datesTop+28,530);
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

  if(r.kind==='record'){
   const stats=recordEngine.summary(recordEntries),top=y+rankTop;
   ctx.fillStyle='#193d63';ctx.fillRect(left,top,right-left,84);
   ctx.fillStyle='#b8d5eb';ctx.font='800 17px Poppins,sans-serif';
   ctx.fillText('COURSE RECORD · '+stats.total+' TENTATIVES · '+stats.aborted+' AVORTÉES',left+20,top+27,right-left-40);
   ctx.fillStyle='#fff';ctx.font='900 27px "Courier Prime",monospace';
   ctx.fillText(stats.bestSeconds!==null?'MEILLEUR TEMPS · '+recordEngine.format(stats.bestSeconds):'AUCUN TEMPS VALIDÉ',left+20,top+63,right-left-40);
   recordEntries.forEach((attempt,i)=>{
    const topRow=top+100+i*45;
    ctx.fillStyle=attempt.aborted?'#fff1ee':attempt.id===stats.bestId?'#e9f8f0':'#f1f6fa';
    ctx.fillRect(left,topRow,right-left,41);
    ctx.fillStyle='#315971';ctx.font='800 15px Poppins,sans-serif';
    ctx.fillText('TENTATIVE '+(i+1),left+12,topRow+18,250);
    ctx.font='700 12px Poppins,sans-serif';ctx.fillStyle='#6b889b';
    ctx.fillText(attempt.startDate?'DÉPART · '+dateTimeFR(attempt.startDate,attempt.startTime):'DÉPART NON RENSEIGNÉ',left+12,topRow+35,625);
    ctx.textAlign='right';ctx.fillStyle=attempt.aborted?'#a64b3b':'#1d5d7f';
    ctx.font='800 17px "Courier Prime",monospace';
    ctx.fillText(attempt.aborted?'AVORTÉE':attempt.seconds!==null?recordEngine.format(attempt.seconds):'EN ATTENTE',right-12,topRow+27,620);
    ctx.textAlign='left';
   });
   if(r.recordClosed){
    const headingTop=top+110+recordEntries.length*45;
    ctx.fillStyle='#21566a';ctx.font='900 18px Poppins,sans-serif';
    ctx.fillText('CLASSEMENTS FINAUX',left,headingTop+19);
    const labels=['GÉNÉRAL','NATIONAL','DÉPARTEMENTAL','VILLE','TEAM'];
    rankPairs.forEach(([place,total],i)=>{
     const lineTop=headingTop+34+i*39;
     ctx.fillStyle=i%2?'#edf5f7':'#f4f8fa';
     ctx.fillRect(left,lineTop,right-left,35);
     ctx.fillStyle='#5b778a';ctx.font='800 14px Poppins,sans-serif';
     ctx.fillText(labels[i],left+14,lineTop+23,320);
     ctx.fillStyle='#194c65';ctx.font='800 23px "Barlow Condensed","Arial Narrow",sans-serif';
     ctx.textAlign='right';
     ctx.fillText(rankDisplay(r[place],r[total])||'—',right-14,lineTop+24,530);
     ctx.textAlign='left';
    });
   }
  }else{
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
  }
  if(SHOT_H){
   const shotY=y+INFO;
   ctx.fillStyle='#e7f3f5';ctx.fillRect(0,shotY,W,SHOT_H);
   for(const [i,image,label] of [[0,ranking,r.kind==='record'?'CAPTURE DU RECORD':'CLASSEMENT FINAL'],[1,route,'TRACÉ DE COURSE']]){
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
function toIcsTime(date,clock='00:00',zone=timeEngine.DEFAULT){
 return timeEngine.utcIcs(timeEngine.fromWall(date,clock,zone));
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
   const startInstant=timeEngine.fromWall(r.start,startClock,r.timezone);
  start=timeEngine.utcIcs(startInstant);
  if(!start)throw Error('Heure de départ invalide ou inexistante dans le fuseau choisi.');
  const duration=parseRaceDuration(r.duration);
  if(duration.status==='valid'&&duration.seconds>0){
   finish=timeEngine.utcIcs(startInstant+duration.seconds*1000);
  }else{
   finish=timeEngine.utcIcs(startInstant+3600000);
   placeholder=true;
  }
 }else{
   allDay=true;start=r.start.replace(/-/g,'');
   const [year,month,day]=r.start.split('-').map(Number);
   const next=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
   finish=next.replace(/-/g,'');
 }
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
 const uidValue=String(r.id||'race').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)+'@regatta.raplilab';
 const times=allDay?'DTSTART;VALUE=DATE:'+start+'\r\nDTEND;VALUE=DATE:'+finish:
   'DTSTART:'+start+'\r\nDTEND:'+finish;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rapli Regatta//FR','CALSCALE:GREGORIAN',
  'BEGIN:VEVENT','UID:'+uidValue,'DTSTAMP:'+stamp,'SUMMARY:'+calendarEscape('⛵️ '+r.name),
  ...times.split('\r\n'),'LOCATION:'+calendarEscape('Virtual Regatta\n33 Avenue Émile Zola, 92100 Boulogne-Billancourt, France'),'END:VEVENT','END:VCALENDAR',''].map(foldCalendarLine).join('\r\n');
}
function exportCalendar(r){
 try{
  const ics=calendarText(r);
  download(new Blob([ics],{type:'text/calendar;charset=utf-8'}),'Rapli_Regatta_'+r.name.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,55)+'.ics');
  toast('Fichier calendrier .ics prêt : ouvre-le pour ajouter la course à Apple Calendrier.');
 }catch(error){toast(error.message||'Export calendrier indisponible',true);}
}

const VSR_RANKING_MAX=99999999;
let vsrRankingEditingId='';
function rankDateDisplay(value){
 const [day,clock]=value.split('T');
 return day.split('-').reverse().join('/')+' · '+clock;
}
function renderVsrRankingHistory(){
 const entries=classSettings.vsrRankingHistory;
 const current=entries.at(-1),previous=entries.at(-2);
 $('vsr-ranking-current-value').textContent=current?'#'+current.rank.toLocaleString('fr-FR'):'—';
 $('vsr-ranking-change').textContent=previous?
  (previous.rank===current.rank?'Classement inchangé':
   (previous.rank>current.rank?'▲ ':'▼ ')+Math.abs(previous.rank-current.rank).toLocaleString('fr-FR')+
   ' place'+(Math.abs(previous.rank-current.rank)>1?'s':'')+(previous.rank>current.rank?' gagnée':' perdue')+(Math.abs(previous.rank-current.rank)>1?'s':'')):
  current?'Premier relevé enregistré':'Aucun relevé';
 $('vsr-ranking-count').textContent=entries.length+' relevé'+(entries.length>1?'s':'');
 $('vsr-ranking-history').innerHTML=entries.length?
  [...entries].reverse().map((entry,i)=>
   '<div class="vsr-ranking-history-row"><time datetime="'+safe(entry.date)+'">'+safe(rankDateDisplay(entry.date))+'</time>'+
   '<strong>#'+entry.rank.toLocaleString('fr-FR')+'</strong>'+
   '<span>'+safe(entry.note||'—')+'</span>'+
   '<div class="vsr-ranking-row-actions">'+
   '<button type="button" class="btn subtle tiny" data-vsr-ranking-edit="'+safe(entry.id)+'" aria-label="Modifier le relevé du '+safe(rankDateDisplay(entry.date))+'">Modifier</button>'+
   '<button type="button" class="btn subtle tiny" data-vsr-ranking-delete="'+safe(entry.id)+'" aria-label="Supprimer le relevé du '+safe(rankDateDisplay(entry.date))+'">×</button>'+
   '</div></div>').join(''):
  '<p class="vsr-ranking-empty">Aucun historique pour le moment. Ajoute ton premier classement VSR pour commencer la courbe.</p>';
 const plot=$('vsr-ranking-chart');
 if(!entries.length){plot.innerHTML='<p class="vsr-ranking-empty">Le graphique apparaîtra dès le premier relevé.</p>';return;}
 const w=820,h=310,padX=62,padTop=32,padBottom=58,plotW=w-2*padX,plotH=h-padTop-padBottom;
 const times=entries.map(e=>new Date(e.date).getTime()),tMin=Math.min(...times),tMax=Math.max(...times);
 const ranks=entries.map(e=>e.rank),min=Math.min(...ranks),max=Math.max(...ranks);
 const lower=Math.max(1,Math.floor(min-Math.max(1,(max-min)*.12)));
 const upper=Math.max(lower+1,Math.ceil(max+Math.max(1,(max-min)*.12)));
 const coords=entries.map((e,i)=>({
  x:padX+(tMax===tMin?(entries.length===1?plotW/2:plotW*i/(entries.length-1)):(times[i]-tMin)/(tMax-tMin)*plotW),
  y:padTop+(e.rank-lower)/(upper-lower)*plotH
 }));
 const path=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
 const ticks=Array.from({length:5},(_,i)=>{const value=Math.round(lower+(upper-lower)*i/4),y=padTop+plotH*i/4;return '<line x1="'+padX+'" y1="'+y+'" x2="'+(w-padX)+'" y2="'+y+'" stroke="#cbdde5" stroke-dasharray="4 5"/>'+
 '<text x="'+(padX-12)+'" y="'+(y+4)+'" text-anchor="end" fill="#6a8294" font-size="12">'+value.toLocaleString('fr-FR')+'</text>';}).join('');
 const points=coords.map((p,i)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="5" fill="#0c869b" stroke="#fff" stroke-width="2"><title>'+
 safe(rankDateDisplay(entries[i].date)+' · Rang '+entries[i].rank.toLocaleString('fr-FR')+(entries[i].note?' · '+entries[i].note:''))+
 '</title></circle>').join('');
 const firstDate=entries[0].date.slice(0,10).split('-').reverse().join('/');
 const lastDate=entries.at(-1).date.slice(0,10).split('-').reverse().join('/');
 plot.innerHTML='<svg role="img" aria-label="Courbe chronologique de classement VSR. Le rang 1 est en haut, un rang plus élevé est moins bon." viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="xMidYMid meet">'+
 '<text x="14" y="15" fill="#547689" font-size="11">MEILLEUR RANG ↑</text>'+
 ticks+'<path d="'+path+'" fill="none" stroke="#0b91a5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'+points+
 '<text x="'+padX+'" y="'+(h-12)+'" text-anchor="start" font-size="12" fill="#547689">'+safe(firstDate)+'</text>'+
 '<text x="'+(w-padX)+'" y="'+(h-12)+'" text-anchor="end" font-size="12" fill="#547689">'+safe(lastDate)+'</text>'+
 '</svg><p class="vsr-ranking-plot-caption">Classement VSR · Un rang plus faible est meilleur · '+entries.length+' relevé'+(entries.length>1?'s':'')+'</p>';
}
function resetVsrRankingForm(){
 vsrRankingEditingId='';
 $('vsr-ranking-form').reset();
 const local=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('vsr-ranking-date').value=local;
 $('vsr-ranking-save').textContent='＋ AJOUTER LE RELEVÉ';
 $('vsr-ranking-cancel').hidden=true;
}
$('vsr-ranking-form').addEventListener('submit',event=>{
 event.preventDefault();
 if(!window.RapliSharedCollection?.canEdit?.()){toast('Connecte-toi en administrateur pour modifier le classement VSR.',true);return;}
 const date=$('vsr-ranking-date').value,rank=Number($('vsr-ranking-rank').value);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isSafeInteger(rank)||rank<1||rank>VSR_RANKING_MAX){toast('Date ou classement VSR invalide.',true);return;}
 const existing=classSettings.vsrRankingHistory;
 if(existing.some(row=>row.date===date&&row.id!==vsrRankingEditingId)){toast('Un relevé existe déjà pour cette date et heure. Modifie-le plutôt.',true);return;}
 const entry={id:vsrRankingEditingId||uid(),date,rank,note:clean($('vsr-ranking-note').value,120)};
 storeClassSettings({...classSettings,vsrRankingHistory:[...existing.filter(e=>e.id!==vsrRankingEditingId),entry]});
 resetVsrRankingForm();toast('Classement VSR enregistré dans ton historique ✓');
});
$('vsr-ranking-cancel').addEventListener('click',resetVsrRankingForm);
$('vsr-ranking-history').addEventListener('click',event=>{
 const edit=event.target.closest('[data-vsr-ranking-edit]');
 const del=event.target.closest('[data-vsr-ranking-delete]');
 if(!edit&&!del)return;
 if(!window.RapliSharedCollection?.canEdit?.()){toast('Mode administrateur requis.',true);return;}
 const id=(edit||del).dataset[edit?'vsrRankingEdit':'vsrRankingDelete'];
 const row=classSettings.vsrRankingHistory.find(e=>e.id===id);
 if(!row)return;
 if(edit){
  vsrRankingEditingId=id;
  $('vsr-ranking-date').value=row.date;$('vsr-ranking-rank').value=row.rank;$('vsr-ranking-note').value=row.note||'';
  $('vsr-ranking-save').textContent='✓ ENREGISTRER LA MODIFICATION';
  $('vsr-ranking-cancel').hidden=false;
  $('vsr-ranking-form').scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }else if(confirm('Supprimer le classement du '+rankDateDisplay(row.date)+' ?')){
  storeClassSettings({...classSettings,vsrRankingHistory:classSettings.vsrRankingHistory.filter(e=>e.id!==id)});
  if(vsrRankingEditingId===id)resetVsrRankingForm();
  toast('Relevé VSR supprimé.');
 }
});
resetVsrRankingForm();
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
$('record-add-attempt').addEventListener('click',()=>{
 let attempts;
 try{attempts=readRecordAttempts();}catch(error){toast(error.message,true);return;}
 if(attempts.length>=recordEngine.MAX){toast('Maximum de '+recordEngine.MAX+' tentatives par course record.',true);return;}
 renderRecordAttempts([...attempts,{id:uid(),seconds:null,aborted:false,startDate:'',startTime:''}]);
});
$('record-attempts-list').addEventListener('click',event=>{
 if(!event.target.closest('[data-record-remove]'))return;
 try{
  const target=event.target.closest('.record-attempt-row');
  renderRecordAttempts(readRecordAttempts().filter(x=>x.id!==target.dataset.recordId));
 }catch(error){toast(error.message,true);}
});
$('record-attempts-list').addEventListener('change',event=>{
 if(event.target.matches('[data-record-aborted]'))event.target.closest('.record-attempt-row').classList.toggle('is-aborted',event.target.checked);
});
$('race-timezone').addEventListener('change',updateArrival);
$('race-kind').addEventListener('change',updateKindFields);
$('race-event-id').addEventListener('change',updateKindFields);
for(const view of ['races','stats','honors','colors'])$('view-'+view).addEventListener('click',()=>selectWorkspace(view));
// Palette des classes: disponible dans la barre d'actions de Courses, sans troisième onglet encombrant.
$('manage-class-colors').addEventListener('click',()=>selectWorkspace('colors'));
$('colors-back-races').addEventListener('click',()=>selectWorkspace('races'));
$('default-class-color').addEventListener('change',event=>changeDefaultClassColor(event.target.value));
$('class-colors-list').addEventListener('change',event=>{
 const el=event.target;
 if(el.matches?.('input[data-class-key]'))changeSpecificClassColor(el.dataset.classKey,el.value);
});
$('vsr-colors-list').addEventListener('change',event=>{
 const el=event.target;
 if(el.matches?.('input[data-vsr-key]'))changeVSRColor(el.dataset.vsrKey,el.value);
});
$('compact-cards').addEventListener('click',()=>{regattaCompact=!regattaCompact;try{localStorage.setItem('rapli-regatta-compact-v1',regattaCompact?'1':'0');}catch(_){/* mode éphémère */}render();});
$('new-race').addEventListener('click',()=>openEditor());$('empty-add').addEventListener('click',()=>openEditor());$('race-form').addEventListener('submit',saveEditor);$('delete-race').addEventListener('click',()=>{if(editId)deleteRace(editId);});
const searchInput=$('search'),clearSearch=$('regatta-search-clear');
searchInput.addEventListener('input',()=>{
 regattaPage=1;clearSearch.hidden=!searchInput.value;
 render({searchOnly:true});
});
clearSearch.addEventListener('click',()=>{
 searchInput.value='';clearSearch.hidden=true;regattaPage=1;
 render({searchOnly:true});searchInput.focus();
});
searchInput.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&searchInput.value){
  event.preventDefault();
  searchInput.value='';clearSearch.hidden=true;regattaPage=1;
  render({searchOnly:true});
 }
});
for(const id of ['regatta-pagination-top','regatta-pagination-bottom'])$(id).addEventListener('click',event=>{
 const control=event.target.closest('[data-regatta-page]');
 if(!control)return;
 const next=Number(control.dataset.regattaPage);
 const pageCount=Math.ceil(regattaResultsCount/REGATTA_PAGE_SIZE);
 if(!Number.isInteger(next)||next<1||next>pageCount)return;
 regattaPage=next;render({searchOnly:true});
 $('regatta-pagination-top').scrollIntoView?.({behavior:'smooth',block:'start'});
});
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
$('cards').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const r=rows.find(x=>x.id===btn.closest('[data-id]')?.dataset.id);if(!r)return;if(btn.dataset.action==='edit')openEditor(r);if(btn.dataset.action==='record-close')closeRecord(r.id);if(btn.dataset.action==='delete')deleteRace(r.id);if(btn.dataset.action==='png')exportPNG(r);if(btn.dataset.action==='score'&&!longPressOpened)openScoreDetail(r);if(btn.dataset.action==='score')longPressOpened=false;if(btn.dataset.action==='calendar')exportCalendar(r);});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!dialog.open){e.preventDefault();$('search').focus();}});
window.addEventListener?.('resize',scheduleRankingFit);
let regattaClockTicker=window.setInterval(updateRaceClocks,1000);
window.addEventListener('pagehide',()=>{window.clearInterval(regattaClockTicker);regattaClockTicker=null;});
window.addEventListener('pageshow',()=>{if(regattaClockTicker===null){updateRaceClocks();regattaClockTicker=window.setInterval(updateRaceClocks,1000);}});
const bridge=window.RapliModuleBridge={module:'regatta',ready:false,
 getState:()=>({records:rows,logos:colorSettingsState()}),notify:msg=>toast(msg),
 previewState:data=>{
   if(!Array.isArray(data?.records))throw Error('Collection publique invalide');
   rows=data.records.map(normal);
   classSettings=normalizeClassSettings(data.logos?.[0]||defaultClassSettings());
   render();
 },
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
(async()=>{try{await openDB();rows=await load();render();}catch(err){
 console.warn('Regatta : IndexedDB indisponible',err);db=null;
 try{
  if(localStorage.getItem('rapli-regatta-v1')===null)throw Error('Aucune sauvegarde de secours');
  rows=backup().map(normal);
  toast('IndexedDB indisponible : sauvegarde locale de secours chargée.',true);
 }catch(recoveryError){
  console.warn('Regatta : récupération locale impossible',recoveryError);
  storageRecoveryBlocked=true;rows=[];
  toast('Stockage des courses inaccessible. Modifications bloquées pour protéger tes données.',true);
 }
 render();
}bridge.ready=true;window.dispatchEvent(new Event('rapli-module-ready'));})();
})();