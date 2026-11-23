/* LPDB personal rating, independent of the official team points and personal
   archive ratings. An exponentially curved VR position gives meaningful
   separation at the very top of even very large fleets. As each skipper
   acquires comparable history, the score transfers weight from position
   to their own improvement instead of inventing progress they haven't shown. */
(function(root){
 'use strict';
 const PARTS=['progress','relative','attendance','vsr'];
 const WEIGHTS=Object.freeze({progress:45,relative:30,attendance:15,vsr:10});
 const CURVE=Object.freeze({steepness:4.8,exponent:.62});
 const round=n=>Math.round(n*100)/100;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const positive=n=>Number.isSafeInteger(n)&&n>0;
 function adapt(r,row){
  return {
   id:r.id+'::'+row.skipperId,kind:'race',
   boatClass:r.boatClass||'',vsr:r.vsr||'',start:r.start||r.dateEnd,
   participantCount:positive(r.fleetTotal)?r.fleetTotal:null,
   rank:row.generalRank??null,
   _status:row.status==='dnf'?'dnf':r.status==='finished'&&row.status==='finished'?'finished':'live'
  };
 }
 // 1st = 100% of the rank component, last = 0%. The fractional exponent
 // amplifies small percentile changes near the front; unlike (1-p)^3,
 // 328th and 3426th of 130,000 no longer score almost identically.
 function relativeFactor(rank,fleet){
  if(!positive(rank)||!positive(fleet)||fleet<2||rank>fleet)return null;
  const fraction=(rank-1)/(fleet-1);
  const tail=Math.exp(-CURVE.steepness);
  return clamp((Math.exp(-CURVE.steepness*Math.pow(fraction,CURVE.exponent))-tail)/(1-tail),0,1);
 }
 function weightForHistory(count){
  const references=Math.max(0,Number.isFinite(count)?count:0);
  const confidence=clamp(references/3,0,1);
  return {
   progress:round(WEIGHTS.progress*confidence),
   relative:round(WEIGHTS.relative+WEIGHTS.progress*(1-confidence)),
   attendance:WEIGHTS.attendance,vsr:WEIGHTS.vsr
  };
 }
 function personalProgressFactor(reference,current){
  const median=reference?.medianPercentile;
  const currentShare=current.rank/current.participantCount;
  if(!(median>0)||!(currentShare>0))return .5;
  // Neutral at the historical median, increasing with personal improvement
  // or decreasing with regression, independently of LPDB team placement.
  return clamp(.5+.25*Math.log2(median/currentShare),0,1);
 }
 function personalParts(base,current){
  const historyCount=base.progression?.count||0;
  const weights=weightForHistory(historyCount);
  const factor=relativeFactor(current.rank,current.participantCount);
  if(factor===null)return null;
  const parts={
   progress:round(weights.progress*personalProgressFactor(base.progression,current)),
   relative:round(weights.relative*factor),
   attendance:round(clamp(base.parts.attendance||0,0,WEIGHTS.attendance)),
   vsr:round(clamp(base.parts.vsr||0,0,WEIGHTS.vsr))
  };
  return {parts,weights,historyCount,confidence:clamp(historyCount/3,0,1),relativeFactor:factor};
 }
 function calculate(race,allRaces,knownMembers,engine,scoreEngine=root.RapliRegattaScore){
  const scores=new Map();
  const answer={scores,average:null,rated:0,eligible:0,total:race?.results?.length||0};
  if(!race||!engine||!scoreEngine||race.status!=='finished'||engine.verifyRace(race,knownMembers))return answer;
  const finishers=race.results.filter(row=>row.status==='finished');
  answer.eligible=finishers.length;
  const historical=(Array.isArray(allRaces)?allRaces:[])
   .filter(r=>r?.type==='team-race')
   .flatMap(r=>(r.results||[]).map(row=>adapt(r,row)));
  const lookup=new Map(historical.map(item=>[item.id,item]));
  const status=entry=>entry._status;
  let sum=0;
  for(const row of finishers){
   const current=lookup.get(race.id+'::'+row.skipperId)||adapt(race,row);
   // Only this skipper's own results can establish a personal reference.
   const ownHistory=historical.filter(entry=>entry.id.endsWith('::'+row.skipperId));
   if(!ownHistory.some(entry=>entry.id===current.id))ownHistory.push(current);
   const base=scoreEngine.race(current,ownHistory,status);
   if(!base.available){scores.set(row.skipperId,{available:false,reason:base.reason});continue;}
   const components=personalParts(base,current);
   if(!components){scores.set(row.skipperId,{available:false,reason:'Rang VR ou flotte globale invalide.'});continue;}
   const {parts,weights,historyCount,confidence,relativeFactor:relativeIndex}=components;
   const raw=round(PARTS.reduce((total,key)=>total+parts[key],0));
   const value=Math.round(clamp(raw,0,100));
   const flags=(base.flags||[]).filter(flag=>!/équipement|prime/i.test(flag));
   const provisional=historyCount<3||flags.some(flag=>/provisoire|inconnu/i.test(flag));
   const explanation=historyCount<3?
    'Note provisoire : '+historyCount+'/3 références comparables ; classement VR '+weights.relative+' %, progression personnelle '+weights.progress+' %':
    'Note individuelle : progression 45 %, classement VR 30 % (courbe exponentielle)';
   const rating={available:true,value,raw,parts,weights,relativeIndex,confidence,historyCount,
    curve:CURVE,explanation,mention:scoreEngine.mention(value),provisional,flags,
    bonus:null,bonusFloor:null,bonusEligible:false,
    reference:base.reference,progression:base.progression,
    rank:row.generalRank,fleet:race.fleetTotal};
   scores.set(row.skipperId,rating);
   sum+=value;answer.rated++;
  }
  answer.average=answer.rated?round(sum/answer.rated):null;
  return answer;
 }
 const api={calculate,WEIGHTS,CURVE,adapt,relativeFactor,weightForHistory,personalProgressFactor,personalParts};
 root.RapliTeamRating=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
