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
/* A linked personal race owns shared metadata; team standings own their finish status and results.
   Reconciliation is read-only and never rewrites the personal journal. */
function resolveLinkedRace(team,personal){
 const r=race(team);
 if(!r||!r.personalRaceId||!personal||personal.id!==r.personalRaceId||personal.kind!=='race')return r;
 const name=safe(personal.name,160)||r.name;
 const dateEnd=dateOk(personal.end)?personal.end:r.dateEnd;
 const vsr=BASE[personal.vsr]?personal.vsr:r.vsr;
 return {...r,name,dateEnd,vsr,
  boatClass:safe(personal.boatClass,100)||r.boatClass,
  start:dateOk(personal.start)?personal.start:r.start,
  startTime:safe(personal.startTime,8)||r.startTime,
  endTime:safe(personal.endTime,8)||r.endTime,
  routeType:safe(personal.routeType,40)||r.routeType,
  timezone:safe(personal.timezone,80)||r.timezone,
  equipment:safe(personal.equipment,30)||r.equipment};
}
function fromPersonal(personal,base={}){
 if(!personal||personal.kind!=='race')return null;
 return race({...base,personalRaceId:personal.id,
  name:safe(personal.name,160)||safe(base.name,160),
  dateEnd:dateOk(personal.end)?personal.end:base.dateEnd,
  vsr:BASE[personal.vsr]?personal.vsr:base.vsr,
  boatClass:personal.boatClass,start:personal.start,startTime:personal.startTime,
  endTime:personal.endTime,routeType:personal.routeType,timezone:personal.timezone,equipment:personal.equipment});
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
  const elapsed=int(row.elapsedSeconds),gap=int(row.gapSeconds);
  const record={skipperId,status,position:status==='finished'&&Number.isInteger(pos)&&pos>=1&&pos<=50?pos:null};
  if(status==='finished'&&Number.isSafeInteger(elapsed)&&elapsed>=0)record.elapsedSeconds=elapsed;
  if(status==='finished'&&Number.isSafeInteger(gap)&&gap>=0)record.gapSeconds=gap;
  results.push(record);
 }
 return {id,type:'team-race',name,dateEnd:dateOk(input.dateEnd)?input.dateEnd:'',
  vsr:BASE[input.vsr]?input.vsr:'vsr2',
  status:['planned','live','finished'].includes(input.status)?input.status:'planned',
  personalRaceId:safe(input.personalRaceId,130),
  boatClass:safe(input.boatClass,100),routeType:safe(input.routeType,40),
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
function verifyRace(r,knownMembers){
 const rs=r.results||[],count=rs.length;
 if(!dateOk(r.dateEnd)||!BASE[r.vsr]||count<1||count>50)return 'Renseigne une arrivée, une catégorie VSR et de 1 à 50 participants.';
 const ids=new Set(),ranks=new Set();
 for(const row of rs){
  if(!knownMembers.has(row.skipperId)||ids.has(row.skipperId))return 'Skipper inconnu ou ajouté deux fois.';
  ids.add(row.skipperId);
  if(row.status==='pending')return 'Des résultats restent à saisir.';
  if(row.status==='finished'){
   if(!validPos(row.position,count))return 'Position de classement invalide.';
   if(ranks.has(Number(row.position)))return 'Deux skippers ont la même position.';
   if(row.elapsedSeconds!=null&&(!Number.isSafeInteger(row.elapsedSeconds)||row.elapsedSeconds<0))return 'Chrono de course invalide.';
   if(row.gapSeconds!=null&&(!Number.isSafeInteger(row.gapSeconds)||row.gapSeconds<0))return 'Écart au vainqueur invalide.';
   ranks.add(Number(row.position));
  }
 }
 const leader=rs.find(row=>row.status==='finished'&&Number(row.position)===1);
 if(leader&&Number.isSafeInteger(leader.elapsedSeconds)){
  for(const row of rs.filter(r=>r.status==='finished')){
   if(row.elapsedSeconds!=null&&row.gapSeconds!=null&&
      row.elapsedSeconds!==leader.elapsedSeconds+row.gapSeconds)
    return 'Chrono et écart incohérents avec le vainqueur.';
   if(row.elapsedSeconds!=null&&row.elapsedSeconds<leader.elapsedSeconds)
    return 'Un skipper possède un temps inférieur au vainqueur.';
  }
 }
 const timed=rs.filter(row=>row.status==='finished'&&Number.isSafeInteger(row.elapsedSeconds))
  .sort((a,b)=>Number(a.position)-Number(b.position));
 for(let i=1;i<timed.length;i++)if(timed[i].elapsedSeconds<timed[i-1].elapsedSeconds)
  return 'L’ordre du classement ne correspond pas aux chronos.';
 return '';
}
function scoredRace(r,knownMembers){
 if(r.status!=='finished'||verifyRace(r,knownMembers))return [];
 const n=r.results.length;
 return r.results.map(row=>({
  skipperId:row.skipperId,rank:row.status==='finished'?Number(row.position):null,
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
  return {id,name:skipper.name,status:skipper.status,
   points,main:totalMain,historic:totalHistoric,participations:attempts,finished:finish,dnf:attempts-finish,
   wins:finished.filter(r=>r.rank===1).length,podiums:finished.filter(r=>r.rank<=3).length,
   avg:attempts?points/attempts:0,avgFinished:finish?points/finish:0,max:Math.max(0,...results.map(x=>mode==='historic'?x.historic:x.main)),
   finishRate:100*finish/attempts,prestige,attendance,hybrid,records:results,
   timedRaces:timed.length,
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
const api={BASE,PRESTIGE,factor,tier,tierValue,historical,primary,normalize,member,prepareMemberBatch,race,resolveLinkedRace,fromPersonal,verifyRace,scoredRace,inPeriod,standings,stageBonus,periods,dateOk};
root.RapliTeamEngine=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
