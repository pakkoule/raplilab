/* Rapli Regatta — one honest summary for the GFS prototype.
 * No equator / Cape ETA is fabricated from the local 47°N test.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RapliGfsRoutingSummary=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const HOURS=Object.freeze([6,12,18,24,30,36]);
  const PAIRS=Object.freeze([
    {from:6,to:12,method:'compareDepartureWindows'},
    {from:12,to:18,method:'compareLaterDepartureWindows'},
    {from:18,to:24,method:'compareEveningDepartureWindows'},
    {from:24,to:30,method:'compareNextDayDepartureWindows'}
  ]);
  function summarize(frames,engine){
    const map=frames instanceof Map?frames:new Map();
    const loaded=HOURS.filter(hour=>map.has(hour));
    const cycles=[...new Set(loaded.map(hour=>map.get(hour)?.cycleUTC))];
    const output={
      expectedHours:HOURS.slice(),
      loadedHours:loaded,
      cycleUTC:cycles.length===1?cycles[0]:null,
      sameCycle:cycles.length<=1&&(!loaded.length||typeof cycles[0]==='string'),
      windowsEvaluated:0,
      windowsValid:0,
      best:null,
      evaluatedPairs:[],
      issues:[],
      equatorETA:null,
      capeETA:null,
      fullPack:false,
      oceanRoutingAvailable:false,
      targetLatitude:47,
      comparableHorizonHours:3
    };
    if(!output.sameCycle){
      output.issues.push('Prévisions GFS de cycles différents : comparaison refusée.');
      return output;
    }
    const valid=[];
    for(const pair of PAIRS){
      if(!map.has(pair.from)||!map.has(pair.to))continue;
      if(typeof engine?.[pair.method]!=='function'){
        output.issues.push('Comparateur de départs indisponible.');
        continue;
      }
      try{
        const result=engine[pair.method](map.get(pair.from),map.get(pair.to));
        if(!Array.isArray(result.windows)||result.windows.length!==4)
          throw Error('Réponse de comparaison incomplète.');
        output.windowsEvaluated+=4;
        output.evaluatedPairs.push([pair.from,pair.to]);
        for(const candidate of result.windows){
          if(!candidate.valid)continue;
          if(!Number.isFinite(candidate.elapsedMinutes)||candidate.elapsedMinutes<=0||
             !Number.isFinite(candidate.startHour))
            throw Error('Durée de franchissement invalide.');
          valid.push(candidate);
        }
      }catch(error){
        const reason=String(error?.message||error);
        if(reason.includes('Aucun départ n’atteint')){
          output.windowsEvaluated+=4;
          output.evaluatedPairs.push([pair.from,pair.to]);
        }else{
          output.issues.push('GFS +'+pair.from+'/'+pair.to+' h : '+reason.slice(0,140));
        }
      }
    }
    valid.sort((a,b)=>a.elapsedMinutes-b.elapsedMinutes||a.startHour-b.startHour);
    output.windowsValid=valid.length;
    if(valid.length)output.best={
      startHour:valid[0].startHour,
      elapsedMinutes:valid[0].elapsedMinutes,
      crossingUTC:valid[0].crossingUTC??null
    };
    return output;
  }
  return {HOURS,PAIRS,summarize};
});
