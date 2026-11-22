/* LPDB ratings: reuse the personal race-scoring engine without equipment.
   The four remaining criteria (35/20/10/15) are scaled to a total of 100.
   The VR overall position and VR global fleet are distinct from LPDB's team ranking. */
(function(root){
 'use strict';
 const SCALE=1.25;
 const PARTS=['relative','progress','vsr','attendance'];
 const WEIGHTS=Object.freeze({relative:43.75,progress:25,vsr:12.5,attendance:18.75});
 const round=n=>Math.round(n*100)/100;
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
   const ownHistory=historical.filter(entry=>entry.id.endsWith('::'+row.skipperId));
   if(!ownHistory.some(entry=>entry.id===current.id))ownHistory.push(current);
   const base=scoreEngine.race(current,ownHistory,status);
   if(!base.available){scores.set(row.skipperId,{available:false,reason:base.reason});continue;}
   const parts={};
   for(const key of PARTS)parts[key]=round(base.parts[key]*SCALE);
   const raw=round(PARTS.reduce((n,key)=>n+base.parts[key],0)*SCALE);
   // The score engine already handles rare overall podium bonuses and their fleet threshold.
   const value=Math.round(Math.min(100,Math.max(raw,base.bonus||0)));
   const flags=(base.flags||[]).filter(flag=>!/équipement/i.test(flag));
   const rating={available:true,value,raw,parts,weights:WEIGHTS,
    mention:scoreEngine.mention(value),provisional:flags.some(flag=>/provisoire|inconnu/i.test(flag)),
    flags,bonus:base.bonus,bonusFloor:base.bonusFloor,bonusEligible:base.bonusEligible,
    reference:base.reference,progression:base.progression,rank:row.generalRank,fleet:race.fleetTotal};
   scores.set(row.skipperId,rating);
   sum+=value;answer.rated++;
  }
  answer.average=answer.rated?round(sum/answer.rated):null;
  return answer;
 }
 const api={calculate,WEIGHTS,adapt};
 root.RapliTeamRating=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
