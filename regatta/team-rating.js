/* LPDB personal performance rating (separate from official LPDB points).
   The score is an individual's result against their own previous comparable
   VR races — never their position in the LPDB team classification.
   Reuse the established historical reference and progress curves from score.js,
   but apply the personal LPDB weights and NO automatic overall-podium floor. */
(function(root){
 'use strict';
 const PARTS=['progress','relative','attendance','vsr'];
 const WEIGHTS=Object.freeze({progress:45,relative:30,attendance:15,vsr:10});
 const BASE_MAX=Object.freeze({progress:20,relative:35,attendance:15,vsr:10});
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
 function personalParts(base){
  // The shared engine returns component points on its original 35/20/15/10
  // scales. Rescale each component to the personal weighting, not the total.
  return Object.fromEntries(PARTS.map(key=>[
   key,round(Math.max(0,Math.min(WEIGHTS[key],(base.parts[key]||0)*WEIGHTS[key]/BASE_MAX[key])))
  ]));
 }
 function calculate(race,allRaces,knownMembers,engine,scoreEngine=root.RapliRegattaScore){
  const scores=new Map();
  const answer={scores,average:null,rated:0,eligible:0,total:race?.results?.length||0};
  if(!race||!engine||!scoreEngine||race.status!=='finished'||engine.verifyRace(race,knownMembers))return answer;
  const finishers=race.results.filter(row=>row.status==='finished');
  answer.eligible=finishers.length;
  // Same boat class and VSR, previous 5 completed races per individual;
  // history of other LPDB members never contributes to their own progress.
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
   const parts=personalParts(base);
   const raw=round(PARTS.reduce((sum,key)=>sum+parts[key],0));
   // A first / second / third place in VR must not override one's personal
   // performance rating: no podium minimum and no equipment criterion.
   const value=Math.round(Math.min(100,Math.max(0,raw)));
   const flags=(base.flags||[]).filter(flag=>!/équipement|prime/i.test(flag));
   const priorCount=base.progression?.count||0;
   const rating={available:true,value,raw,parts,weights:WEIGHTS,
    mention:scoreEngine.mention(value),
    provisional:priorCount<3||flags.some(flag=>/provisoire|inconnu/i.test(flag)),
    flags,bonus:null,bonusFloor:null,bonusEligible:false,
    reference:base.reference,progression:base.progression,
    rank:row.generalRank,fleet:race.fleetTotal};
   scores.set(row.skipperId,rating);
   sum+=value;answer.rated++;
  }
  answer.average=answer.rated?round(sum/answer.rated):null;
  return answer;
 }
 const api={calculate,WEIGHTS,adapt,personalParts};
 root.RapliTeamRating=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
