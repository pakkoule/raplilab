/* Rapli Regatta — one fast, accent-insensitive search across text displayed on course tiles.
   Pure helper to keep search independent of image data or persistent collections. */
(function(root){
 'use strict';
 const normalize=value=>String(value??'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('fr')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ').trim();
 const words=query=>normalize(query).split(' ').filter(Boolean);
 const text=(race,context={})=>{
  const r=race||{},parts=[],add=(...values)=>{
   for(const v of values)if(v!==null&&v!==undefined&&String(v).trim())parts.push(String(v));
  };
  const number=value=>{
   const raw=String(value??'').trim();
   if(!raw)return '';
   const numeric=Number(raw.replace(/[\s\u00a0\u202f]/g,''));
   return Number.isFinite(numeric)?numeric.toLocaleString('fr-FR'):raw;
  };
  const date=value=>{
   const iso=String(value??'');
   const human=/^\d{4}-\d{2}-\d{2}$/.test(iso)?
    iso.slice(8)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'';
   add(iso,human);
  };
  add(r.name,r.boat,r.boatClass,context.boatDisplay,context.status,context.routeType,context.vsr,
      context.timezone);
  add(context.kind,context.vsrCode,context.clockLabel);
  if(context.today) add('départ aujourd’hui');
  if(r.kind!=='record'){
   if(r.start){add('départ');date(r.start);add(r.startTime);}
   if(r.end&&!r.dnf){add('arrivée');date(r.end);add(r.endTime);}
   if(r.duration)add('durée',r.duration);
   if(context.equipment)add('équipement',context.equipment);
   if(String(r.gainPoints??'').trim())add('points VSR',r.gainPoints,number(r.gainPoints));
   if(String(r.gainCredits??'').trim())add('crédits VR',r.gainCredits,number(r.gainCredits));
  }
  const rankPairs=[
   ['rank','rankTotal','classement général'],
   ['rankNational','rankNationalTotal','national'],
   ['rankDepartment','rankDepartmentTotal','départemental'],
   ['rankCity','rankCityTotal','ville'],
   ['rankTeam','rankTeamTotal','team']
  ];
  if(context.ranksVisible!==false)for(const [rank,total,label] of rankPairs){
   if(String(r[rank]??'').trim()){
    const place=String(r[rank]);
    const totalValue=String(r[total]??'');
    add(label,place,number(place));
    if(totalValue)add(totalValue,number(totalValue),place+' / '+number(totalValue));
    if(normalize(context.status)==='terminee'){
     const medal={1:'podium première place médaille or',2:'podium deuxième place médaille argent',
      3:'podium troisième place médaille bronze'}[Number(place)];
     if(medal)add(medal);
    }
   }
  }
  if(context.score!==null&&context.score!==undefined&&context.score!=='')
   add('note score',context.score,'sur 100');
  if(context.scoreReason)add(context.scoreReason);
  if(r.kind==='record'){
   const attempts=Array.isArray(context.attempts)?context.attempts:[];
   add('record',context.recordSummary);
   attempts.forEach((attempt,index)=>{
    add('tentative '+(index+1),attempt.aborted?'avortée':'',
        attempt.timeText,attempt.timeLabel);
    if(attempt.startDate){add('départ');date(attempt.startDate);add(attempt.startTime);}
   });
  }
  // Visible contextual labels, but never IDs, image base64, or hidden notes.
  if(context.capture) add(context.capture);
  return normalize(parts.join(' '));
 };
 function matches(race,query,context={}){
  const tokens=words(query);
  if(!tokens.length)return true;
  const haystack=text(race,context);
  return tokens.every(token=>haystack.includes(token));
 }
 const api=Object.freeze({normalize,words,text,matches});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.RapliRegattaSearch=api;
})(typeof window!=='undefined'?window:null);
