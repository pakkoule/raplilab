/* LPDB team championship — pure, browser/Node-compatible scoring and standings. */
(function(root){
'use strict';
const BASE=Object.freeze({vsr3:150,vsr2:200,vsr1:250,hc:300});
const PRESTIGE=Object.freeze({vsr3:25,vsr2:50,vsr1:75,hc:100});
const safe=(v,max=120)=>String(v??'').trim().slice(0,max);
const cleanId=id=>safe(id,120);
const fold=s=>safe(s).normalize('NFKC').toLocaleLowerCase('fr');
const dateOk=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const int=v=>typeof v==='number'&&Number.isSafeInteger(v)?v:/^\d+$/.test(String(v??'').trim())?Number(v):NaN;
const validPos=(v,n)=>Number.isSafeInteger(int(v))&&int(v)>=1&&int(v)<=n;
const factor=n=>n<=5?.75:n<=9?.85:n<=14?1:n<=20?1.05:n<=30?1.1:1.15;
const tier=n=>Math.max(0,Math.min(8,Math.floor((n-10)/5)));
const tierValue=(n,b)=>655*(Math.pow(1.3,tier(n))-1)/(Math.pow(1.3,8)-1)*b/300;
function historical(rank){
 const r=int(rank);
 if(!Number.isSafeInteger(r)||r<1||r>50)return 0;
 if(r<=14)return 210-r*10;
 if(r<=22)return 65-5*(r-15);
 if(r===23)return 28;
 return 51-r;
}
function primary(vsr,n,rank){
 const b=BASE[vsr],r=int(rank),count=int(n);
 if(!b||!Number.isInteger(count)||count<1||count>50||!validPos(r,count))return 0;
 const t=(r-1)/Math.max(1,count-1);
 return Math.round(b*factor(count)*(1-.6*t)+tierValue(count,b)*Math.pow(1-t,1.5));
}
/* Bulk import: one pasted row = one skipper, with a shared uniqueness rule for active and former members. */
function prepareMemberBatch(text,existing=[]){
 const seen=new Set((Array.isArray(existing)?existing:[]).map(x=>fold(x?.name||x).replace(/\s+/gu,' ')).filter(Boolean));
 const accepted=[],duplicates=[],invalid=[];
 const lines=String(text??'').split(/\r\n|\n|\r/);
 for(let i=0;i<lines.length;i++){
  const name=lines[i].trim(),line=i+1;
  if(!name)continue;
  if(name.length>56||/[\t\u0000-\u001f\u007f]/u.test(name)){
   invalid.push({line,name,reason:name.length>56?'Pseudo supérieur à 56 caractères.':'Caractère non autorisé (ex. tabulation).'});
   continue;
  }
  const key=fold(name).replace(/\s+/gu,' ');
  if(seen.has(key))duplicates.push({line,name});
  else{seen.add(key);accepted.push(name);}
 }
 const activeCount=(Array.isArray(existing)?existing:[]).filter(x=>x?.status==='active').length;
 const available=Math.max(0,50-activeCount);
 return {accepted,duplicates,invalid,available,overflow:Math.max(0,accepted.length-available)};
}
function member(input){
 const id=cleanId(input?.id),name=safe(input?.name,56);
 if(!id.startsWith('lpdb-member-')||!name)return null;
 const from=dateOk(input.from)?input.from:'',until=dateOk(input.until)?input.until:'';
 const memberships=Array.isArray(input.memberships)?input.memberships.slice(0,100).map(w=>({
  from:dateOk(w?.from)?w.from:'',until:dateOk(w?.until)?w.until:''
 })).filter(w=>!w.from||!w.until||w.from<=w.until):[];
 if(!memberships.length)memberships.push({from,until});
 return {id,type:'team-member',name,status:input.status==='former'?'former':'active',
  from,until,memberships,createdAt:safe(input.createdAt,40),updatedAt:safe(input.updatedAt,40)};
}
/* Team metadata may reuse a personal race OR a multi-attempt record (Jules Verne).
   Record start date comes from its most recent attempt, never a fabricated finish date.
   The LPDB ranking/date/status/results remain wholly independent. */
function sharedPersonalStart(personal){
 if(personal.kind==='record'&&Array.isArray(personal.attempts)){
  const dates=personal.attempts.filter(a=>dateOk(a?.startDate)).sort((a,b)=>
   (b.startDate+'T'+(b.startTime||'00:00')).localeCompare(a.startDate+'T'+(a.startTime||'00:00')));
  if(dates.length)return {start:dates[0].startDate,startTime:safe(dates[0].startTime,8)};
 }
 return {start:dateOk(personal.start)?personal.start:'',startTime:safe(personal.startTime,8)};
}
function shareablePersonal(personal){
 return personal&&(personal.kind==='race'||personal.kind==='record');
}
function resolveLinkedRace(team,personal){
 const r=race(team);
 if(!r||!r.personalRaceId||!personal||personal.id!==r.personalRaceId||!shareablePersonal(personal))return r;
 const name=safe(personal.name,160)||r.name;
 const vsr=personal.kind==='record'?r.vsr:BASE[personal.vsr]?personal.vsr:r.vsr;
 const dates=sharedPersonalStart(personal);
 return {...r,name,vsr,
  boatClass:safe(personal.boatClass,100)||r.boatClass,
  start:dates.start||r.start,startTime:dates.startTime||r.startTime,
  routeType:safe(personal.routeType,40)||r.routeType,
  timezone:safe(personal.timezone,80)||r.timezone};
}
function fromPersonal(personal,base={}){
 if(!shareablePersonal(personal))return null;
 const dates=sharedPersonalStart(personal);
 return race({...base,personalRaceId:personal.id,
  name:safe(personal.name,160)||safe(base.name,160),
  vsr:personal.kind==='record'?base.vsr:BASE[personal.vsr]?personal.vsr:base.vsr,
  boatClass:personal.boatClass,start:dates.start||base.start,startTime:dates.startTime||base.startTime,
  routeType:personal.routeType,timezone:personal.timezone});
}
function race(input){
 const id=cleanId(input?.id),name=safe(input?.name,160);
 if(!id.startsWith('lpdb-race-')||!name)return null;
 const results=[],seen=new Set();
 for(const row of (Array.isArray(input.results)?input.results:[]).slice(0,50)){
  const skipperId=cleanId(row?.skipperId);
  if(!skipperId.startsWith('lpdb-member-')||seen.has(skipperId))continue;
  seen.add(skipperId);
  const status=['finished','dnf','pending'].includes(row.status)?row.status:'pending';
  const pos=int(row.position);
  const elapsed=int(row.elapsedSeconds),gap=int(row.gapSeconds),generalRank=int(row.generalRank);
  const record={skipperId,status,position:status==='finished'&&Number.isInteger(pos)&&pos>=1&&pos<=50?pos:null};
  if(status==='finished'&&Number.isSafeInteger(elapsed)&&elapsed>=0)record.elapsedSeconds=elapsed;
  if(status==='finished'&&Number.isSafeInteger(gap)&&gap>=0)record.gapSeconds=gap;
  if(status!=='dnf'&&Number.isSafeInteger(generalRank)&&generalRank>=1&&generalRank<=100000000)record.generalRank=generalRank;
  results.push(record);
 }
 return {id,type:'team-race',name,dateEnd:dateOk(input.dateEnd)?input.dateEnd:'',
  vsr:BASE[input.vsr]?input.vsr:'vsr2',
  fleetTotal:Number.isSafeInteger(int(input.fleetTotal))&&int(input.fleetTotal)>=2&&int(input.fleetTotal)<=100000000?int(input.fleetTotal):null,
  status:['planned','live','finished'].includes(input.status)?input.status:'planned',
  personalRaceId:safe(input.personalRaceId,130),
  boatClass:safe(input.boatClass,100),routeType:safe(input.routeType,40),
  icon:typeof input.icon==='string'&&/^data:image\/(?:png|webp|jpeg|gif);base64,[a-z0-9+/=]+$/iu.test(input.icon)&&input.icon.length<=9*1024*1024?input.icon:'',
  start:dateOk(input.start)?input.start:'',startTime:safe(input.startTime,8),endTime:safe(input.endTime,8),
  timezone:safe(input.timezone,80),equipment:safe(input.equipment,30),
  stageGroup:safe(input.stageGroup,100),results,
  createdAt:safe(input.createdAt,40),updatedAt:safe(input.updatedAt,40)};
}
function normalize(entities){
 const result=[],ids=new Set();
 if(!Array.isArray(entities))return result;
 for(const item of entities.slice(0,25000)){
  const record=item?.type==='team-member'?member(item):item?.type==='team-race'?race(item):null;
  if(!record||ids.has(record.id))continue;
  result.push(record);ids.add(record.id);
 }
 return result;
}
/* Collect actionable validation issues without altering data or scoring.
   Each issue may point to the exact skipper(s) and input field in the editor. */
function diagnoseRace(r,knownMembers){
 const rs=Array.isArray(r?.results)?r.results:[],count=rs.length;
 const known=knownMembers instanceof Map?knownMembers:new Map();
 const issues=[],ids=new Map(),ranks=new Map();
 const add=(code,message,skipperIds=[],field='')=>issues.push({
  code,message,skipperIds:[...new Set(skipperIds.filter(Boolean))],field
 });
 const person=(row,index)=>known.get(row?.skipperId)?.name||('identifiant '+(row?.skipperId||'absent à la ligne '+(index+1)));
 const quoted=(row,index)=>'« '+person(row,index)+' »';
 const shown=v=>v==null||v===''?'vide':String(v);
 if(!dateOk(r?.dateEnd))add('dateEnd','Date de clôture du classement manquante ou invalide : indique la date de validation (AAAA-MM-JJ). Cette date détermine le mois, trimestre et année du championnat.',[],'dateEnd');
 if(!BASE[r?.vsr])add('vsr','Catégorie VSR non reconnue : sélectionne VSR 3, VSR 2, VSR 1 ou Hors catégorie.',[],'vsr');
 if(!count)add('participants','Aucun participant dans cette course : ajoute au moins un skipper depuis l’effectif LPDB.',[],'participants');
 else if(count>50)add('participants','La course contient '+count+' participants : le maximum autorisé est de 50. Retire '+(count-50)+' participant(s).',[],'participants');
 for(let i=0;i<rs.length;i++){
  const row=rs[i]||{},id=row.skipperId||'',who=quoted(row,i),line='ligne '+(i+1);
  if(!known.has(id)){
   add('unknown-skipper','Skipper introuvable ('+line+') : '+who+'. Aucune fiche de l’effectif LPDB ne correspond à cet identifiant. Vérifie l’onglet Skippers et la synchronisation, puis réassocie ou retire cette participation.',[id],'skipperId');
  }
  if(ids.has(id)){
   add('duplicate-skipper','Skipper présent deux fois : '+who+' apparaît aux lignes '+(ids.get(id)+1)+' et '+(i+1)+'. Conserve une seule participation pour ce skipper.',[id],'skipperId');
  }else ids.set(id,i);
  if(row.status==='pending'){
   add('pending','Résultat non renseigné pour '+who+' ('+line+') : le statut est « À saisir ». Indique « Classé » et son rang LPDB, ou sélectionne « DNF ».',[id],'status');
  }else if(row.status==='finished'){
   if(!validPos(row.position,count)){
    add('position','Rang LPDB invalide pour '+who+' ('+line+') : valeur « '+shown(row.position)+' ». Entre un rang entier compris entre 1 et '+count+'.',[id],'rank');
   }else{
    const pos=int(row.position);
    if(ranks.has(pos)){
     const other=rs[ranks.get(pos)];
     add('duplicate-position','Deux skippers ont la même position LPDB #'+pos+' : '+quoted(other,ranks.get(pos))+' et '+who+'. Attribue un rang distinct à chacun.',[other.skipperId,id],'rank');
    }else ranks.set(pos,i);
   }
   if(row.generalRank!=null&&(!Number.isSafeInteger(int(row.generalRank))||int(row.generalRank)<1||int(row.generalRank)>100000000)){
    add('generalRank','Classement général VR invalide pour '+who+' : valeur « '+shown(row.generalRank)+' ». Entre un entier de 1 à 100 000 000 ou laisse le champ vide.',[id],'generalRank');
   }
   if(row.elapsedSeconds!=null&&(!Number.isSafeInteger(row.elapsedSeconds)||row.elapsedSeconds<0)){
    add('elapsedSeconds','Chrono invalide pour '+who+' : valeur enregistrée « '+shown(row.elapsedSeconds)+' » secondes. Renseigne une durée positive, par exemple 11j 16h 58m.',[id],'elapsedSeconds');
   }
   if(row.gapSeconds!=null&&(!Number.isSafeInteger(row.gapSeconds)||row.gapSeconds<0)){
    add('gapSeconds','Écart au premier invalide pour '+who+' : valeur enregistrée « '+shown(row.gapSeconds)+' » secondes. L’écart doit être positif ou nul.',[id],'gapSeconds');
   }
  }
 }
 const leaderIndex=rs.findIndex(row=>row.status==='finished'&&Number(row.position)===1);
 if(leaderIndex>=0){
  const leader=rs[leaderIndex];
  if(Number.isSafeInteger(leader.elapsedSeconds)&&leader.elapsedSeconds>=0){
   for(let i=0;i<rs.length;i++){
    const row=rs[i];if(row.status!=='finished')continue;
    if(Number.isSafeInteger(row.elapsedSeconds)&&row.elapsedSeconds>=0&&
       Number.isSafeInteger(row.gapSeconds)&&row.gapSeconds>=0&&
       row.elapsedSeconds!==leader.elapsedSeconds+row.gapSeconds){
     add('time-gap','Chrono et écart incohérents pour '+quoted(row,i)+' : chrono '+row.elapsedSeconds+' s, mais chrono du vainqueur ('+leader.elapsedSeconds+' s) + écart ('+row.gapSeconds+' s) = '+(leader.elapsedSeconds+row.gapSeconds)+' s. Corrige le chrono ou l’écart.',[row.skipperId],'gapSeconds');
    }
    if(Number.isSafeInteger(row.elapsedSeconds)&&row.elapsedSeconds>=0&&
       row.elapsedSeconds<leader.elapsedSeconds){
     add('faster-than-winner','Chrono de '+quoted(row,i)+' ('+row.elapsedSeconds+' s) inférieur à celui du skipper classé 1er ('+leader.elapsedSeconds+' s). Vérifie l’ordre des rangs LPDB.',[row.skipperId,leader.skipperId],'elapsedSeconds');
    }
   }
  }
 }
 const timed=rs.map((row,index)=>({row,index})).filter(x=>x.row.status==='finished'&&Number.isSafeInteger(x.row.elapsedSeconds)&&x.row.elapsedSeconds>=0&&validPos(x.row.position,count))
  .sort((a,b)=>Number(a.row.position)-Number(b.row.position));
 for(let i=1;i<timed.length;i++)if(timed[i].row.elapsedSeconds<timed[i-1].row.elapsedSeconds){
  const a=timed[i-1],b=timed[i];
  add('chrono-order','Ordre des chronos incohérent : '+quoted(b.row,b.index)+' (rang #'+b.row.position+') termine avant '+quoted(a.row,a.index)+' (rang #'+a.row.position+'). Vérifie les temps ou les positions.',[a.row.skipperId,b.row.skipperId],'elapsedSeconds');
 }
 return issues;
}
function verifyRace(r,knownMembers){return diagnoseRace(r,knownMembers)[0]?.message||'';}

function scoredRace(r,knownMembers){
 if(r.status!=='finished'||verifyRace(r,knownMembers))return [];
 const n=r.results.length;
 return r.results.map(row=>({
  skipperId:row.skipperId,rank:row.status==='finished'?Number(row.position):null,
  generalRank:row.status==='finished'?row.generalRank??null:null,
  dnf:row.status==='dnf',vsr:r.vsr,dateEnd:r.dateEnd,raceId:r.id,raceName:r.name,
  main:row.status==='finished'?primary(r.vsr,n,row.position):0,
  historic:row.status==='finished'?historical(row.position):0,
  elapsedSeconds:row.status==='finished'?row.elapsedSeconds??null:null,
  gapSeconds:row.status==='finished'?row.gapSeconds??null:null,n
 }));
}
function inPeriod(date,period){
 if(!dateOk(date))return false;
 if(period?.type==='month')return date.slice(0,7)===period.value;
 if(period?.type==='quarter'){
  const [year,q]=String(period.value||'').split('-Q');
  return date.slice(0,4)===year&&Math.ceil(Number(date.slice(5,7))/3)===Number(q);
 }
 if(period?.type==='year')return date.slice(0,4)===String(period.value);
 if(period?.type==='custom')return (!period.from||date>=period.from)&&(!period.to||date<=period.to);
 return true;
}
function standings(entities,period,mode='main'){
 const members=normalize(entities).filter(x=>x.type==='team-member');
 const races=normalize(entities).filter(x=>x.type==='team-race'&&inPeriod(x.dateEnd,period));
 const known=new Map(members.map(m=>[m.id,m])),records=new Map();
 const finalized=races.filter(r=>r.status==='finished'&&!verifyRace(r,known));
 for(const r of finalized){
  for(const result of scoredRace(r,known)){
   if(!records.has(result.skipperId))records.set(result.skipperId,[]);
   records.get(result.skipperId).push(result);
  }
 }
 const scored=Array.from(records,( [id,results] )=>{
  const skipper=known.get(id),finished=results.filter(r=>!r.dnf);
  const periods=skipper.memberships?.length?skipper.memberships:[{from:skipper.from,until:skipper.until}];
  const eligible=finalized.filter(r=>periods.some(w=>(!w.from||r.dateEnd>=w.from)&&(!w.until||r.dateEnd<=w.until)));
  const attempts=results.length,finish=finished.length,totalMain=results.reduce((s,r)=>s+r.main,0),totalHistoric=results.reduce((s,r)=>s+r.historic,0);
  const prestige=finish?finished.reduce((s,r)=>s+PRESTIGE[r.vsr],0)/finish:0;
  const attendance=eligible.length?Math.min(100,100*attempts/eligible.length):100;
  const hybrid=.6*prestige+.4*attendance;
  const points=mode==='historic'?totalHistoric:totalMain;
  const timed=finished.filter(r=>Number.isSafeInteger(r.elapsedSeconds)&&r.elapsedSeconds>=0);
  const gaps=timed.filter(r=>Number.isSafeInteger(r.gapSeconds)&&r.gapSeconds>=0);
  const general=finished.filter(r=>Number.isSafeInteger(r.generalRank)&&r.generalRank>=1);
  return {id,name:skipper.name,status:skipper.status,
   points,main:totalMain,historic:totalHistoric,participations:attempts,finished:finish,dnf:attempts-finish,
   wins:finished.filter(r=>r.rank===1).length,podiums:finished.filter(r=>r.rank<=3).length,
   avg:attempts?points/attempts:0,avgFinished:finish?points/finish:0,max:Math.max(0,...results.map(x=>mode==='historic'?x.historic:x.main)),
   finishRate:100*finish/attempts,prestige,attendance,hybrid,records:results,
   timedRaces:timed.length,
   generalRankedRaces:general.length,
   bestGeneralRank:general.length?Math.min(...general.map(r=>r.generalRank)):null,
   avgTimeSeconds:timed.length?Math.round(timed.reduce((sum,r)=>sum+r.elapsedSeconds,0)/timed.length):null,
   avgGapSeconds:gaps.length?Math.round(gaps.reduce((sum,r)=>sum+r.gapSeconds,0)/gaps.length):null,
   bestGapSeconds:gaps.length?Math.min(...gaps.map(r=>r.gapSeconds)):null};
 });
 scored.sort((a,b)=>b.points-a.points||b.hybrid-a.hybrid||
  b.records.filter(x=>!x.dnf&&x.vsr==='hc').length-a.records.filter(x=>!x.dnf&&x.vsr==='hc').length||
  b.records.filter(x=>!x.dnf&&x.vsr==='vsr1').length-a.records.filter(x=>!x.dnf&&x.vsr==='vsr1').length||
  b.participations-a.participations||a.name.localeCompare(b.name,'fr'));
 let last=null,rank=0;
 for(let i=0;i<scored.length;i++){
  const s=scored[i],key=[s.points,s.hybrid,s.records.filter(r=>!r.dnf&&r.vsr==='hc').length,s.records.filter(r=>!r.dnf&&r.vsr==='vsr1').length,s.participations].join('/');
  if(key!==last){rank=i+1;last=key;}
  s.rank=rank;
 }
 return {skippers:scored,races:finalized,skippersCount:scored.length,
  pointsTotal:scored.reduce((s,x)=>s+x.points,0)};
}
function stageBonus(entities,group,mode='main'){
 const data=normalize(entities),selected=data.filter(r=>r.type==='team-race'&&r.stageGroup===group);
 return standings([...data.filter(r=>r.type==='team-member'),...selected],{type:'all'},mode);
}
function periods(entities){
 const races=normalize(entities).filter(r=>r.type==='team-race'&&r.status==='finished'&&dateOk(r.dateEnd));
 const months=[...new Set(races.map(r=>r.dateEnd.slice(0,7)))].sort().reverse();
 const quarters=[...new Set(races.map(r=>r.dateEnd.slice(0,4)+'-Q'+Math.ceil(Number(r.dateEnd.slice(5,7))/3)))].sort().reverse();
 const years=[...new Set(races.map(r=>r.dateEnd.slice(0,4)))].sort().reverse();
 return {months,quarters,years};
}
const api={BASE,PRESTIGE,factor,tier,tierValue,historical,primary,normalize,member,prepareMemberBatch,race,resolveLinkedRace,fromPersonal,diagnoseRace,verifyRace,scoredRace,inPeriod,standings,stageBonus,periods,dateOk};
root.RapliTeamEngine=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
