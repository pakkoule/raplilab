/* LPDB · transparent predictive team podium, based exclusively on validated history.
   Never predicts Virtual Regatta's global rankings or awards championship points. */
(function(root){
 'use strict';
 const day=24*60*60*1000;
 function project(race,records,engine,{limit=3}={}){
  const team=(records||[]).filter(x=>x?.type==='team-member');
  const byId=new Map(team.map(x=>[x.id,x]));
  const starters=[...new Set((race?.results||[]).map(x=>x.skipperId))]
    .filter(id=>byId.has(id)&&(race.results.find(r=>r.skipperId===id)?.status!=='dnf'));
  const before=race?.start||race?.dateEnd||'9999-12-31';
  const previous=(records||[]).filter(r=>r?.type==='team-race'&&r.id!==race?.id&&r.status==='finished'
    &&r.dateEnd&&r.dateEnd<before&&!engine.verifyRace(r,byId))
    .sort((a,b)=>b.dateEnd.localeCompare(a.dateEnd));
  const values=starters.map(id=>{
   const appearances=previous.filter(r=>r.results.some(row=>row.skipperId===id));
   const history=appearances.map(r=>{
    const row=r.results.find(x=>x.skipperId===id);
    const n=r.results.length;
    const quality=row.status==='dnf'?0:
     row.status==='finished'&&Number.isInteger(row.position)&&row.position>=1&&row.position<=n?
      (n===1?50:100*(n-row.position)/(n-1)):null;
    if(quality===null)return null;
    const elapsedDays=Math.max(0,(Date.parse(before+'T00:00:00Z')-Date.parse(r.dateEnd+'T00:00:00Z'))/day);
    const ageWeight=1/(1+elapsedDays/540);
    const categoryWeight=r.vsr===race.vsr?1.65:1;
    return {quality,weight:ageWeight*categoryWeight,vsr:r.vsr};
   }).filter(Boolean);
   if(!history.length)return null;
   const sumW=history.reduce((s,h)=>s+h.weight,0);
   const raw=history.reduce((s,h)=>s+h.quality*h.weight,0)/sumW;
   // A light neutral prior moderates predictions from a lone result.
   const index=(raw*sumW+50*.65)/(sumW+.65);
   const direct=history.filter(h=>h.vsr===race.vsr).length;
   const confidence=history.length>=6&&direct>=2?'modérée':history.length>=3?'limitée':'faible';
   return {id,name:byId.get(id).name,index:Math.round(index*10)/10,
    samples:history.length,sameVsr:direct,confidence};
  });
  const candidates=values.filter(Boolean)
   .sort((a,b)=>b.index-a.index||b.sameVsr-a.sameVsr||b.samples-a.samples||a.name.localeCompare(b.name,'fr'))
   .map((p,i)=>({...p,rank:i+1}));
  return {
   podium:candidates.slice(0,limit),
   entrants:starters.length,
   represented:candidates.length,
   unranked:starters.length-candidates.length,
   races:previous.length,
   sufficient:candidates.length>=2,
   methodology:'Indice basé sur le rang relatif aux autres LPDB, l’historique validé, la récence et la catégorie VSR. Aucune donnée Virtual Regatta en temps réel.'
  };
 }
 const api={project};
 root.RapliTeamPrediction=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
