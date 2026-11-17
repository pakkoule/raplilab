/* Rapli Regatta — palmarès en lecture seule, dérivé des résultats existants. */
(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const number=n=>Number(n).toLocaleString('fr-FR');
 const percent=n=>n===null||!Number.isFinite(n)?'—':n.toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
 function item(icon,label,main,detail){
  return '<article class="honors-item"><span class="honors-medal" aria-hidden="true">'+esc(icon)+'</span>'+
   '<div class="honors-item-details"><small>'+esc(label)+'</small><strong>'+esc(main)+'</strong>'+
   (detail?'<span>'+esc(detail)+'</span>':'')+'</div></article>';
 }
 function kpi(label,value,detail){
  return '<div class="honors-kpi"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';
 }
 function section(title,content,layout='honors-grid'){
  return '<section class="honors-section"><h3>'+esc(title)+'</h3><div class="'+layout+'">'+content+'</div></section>';
 }
 function render(rows,stats,scoreFor,recordEngine){
  if(!Array.isArray(rows)||!stats||!Array.isArray(stats.ranked))return '<p class="honors-empty">Palmarès indisponible.</p>';
  const records=rows.filter(r=>r.kind==='record');
  const completedRecords=records.map(r=>({race:r,summary:recordEngine.summary(recordEngine.normalize(r.attempts))}))
    .filter(x=>x.summary.bestSeconds!==null);
  const bestRecord=completedRecords.reduce((a,b)=>!a||b.summary.bestSeconds<a.summary.bestSeconds?b:a,null);
  const scored=stats.finished.map(r=>({race:r,score:scoreFor(r)}))
    .filter(x=>x.score?.available&&Number.isFinite(x.score.value));
  const bestScore=scored.reduce((a,b)=>!a||b.score.value>a.score.value?b:a,null);
  const podiums=stats.podiumTypes||[];
  const topCards=[
   kpi('🥇 VICTOIRES',number(stats.winners),'Premières places au classement général'),
   kpi('🏆 PODIUMS',number(stats.podiums),'Top 3, victoires incluses'),
   kpi('🎖️ TOP 10',number(stats.top10),'Courses terminées classées'),
   kpi('⛵ RECORDS',number(completedRecords.length),'Fiches de record avec un temps validé')
  ].join('');
  const highlights=[];
  if(stats.best)highlights.push(item('🥇','Meilleure place','#'+number(Number(stats.best.rank)),stats.best.name));
  if(stats.bestRelative)highlights.push(item('📈','Meilleur percentile','Top '+percent(stats.bestRelative.value),stats.bestRelative.race.name));
  if(bestScore)highlights.push(item('💠','Plus haute note',Math.round(bestScore.score.value)+'/100',bestScore.race.name));
  if(stats.shortest)highlights.push(item('⏱️','Course la plus rapide',recordEngine.format(stats.shortest.seconds),stats.shortest.race.name));
  if(bestRecord)highlights.push(item('🚀','Meilleure tentative de record',recordEngine.format(bestRecord.summary.bestSeconds),bestRecord.race.name));
  if(stats.maxPoints)highlights.push(item('⭐','Meilleur gain VSR','+'+number(stats.maxPoints.gainPoints)+' points',stats.maxPoints.name));
  const ranked=[...stats.ranked].sort((a,b)=>{
   const rankA=Number(a.rank),rankB=Number(b.rank);
   if(rankA!==rankB)return rankA-rankB;
   const pctA=relative(a),pctB=relative(b);
   return (pctA??Infinity)-(pctB??Infinity)||String(a.name).localeCompare(String(b.name),'fr');
  }).slice(0,8);
  function relative(r){
   const rank=Number(r.rank),fleet=Number(r.rankTotal);
   return Number.isSafeInteger(rank)&&rank>0&&Number.isSafeInteger(fleet)&&fleet>=rank?100*rank/fleet:null;
  }
  const iconic=ranked.map(r=>{
   const rank=Number(r.rank);
   const ico=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'⛵';
   const details=[r.boatClass,r.start?.slice(0,4),r.rankTotal?'Top '+percent(relative(r)):''].filter(Boolean).join(' · ');
   return '<article class="honors-achievement"><span class="honors-medal" aria-hidden="true">'+ico+'</span>'+
     '<div><strong>'+esc('#'+number(rank)+' · '+r.name)+'</strong><small>'+esc(details)+'</small></div></article>';
  }).join('');
  const medalTable=podiums.filter(p=>p.ranked>0||p.podiums>0).map(p=>item(p.icon||'🏅',p.label,
   number(p.podiums)+' podium'+(p.podiums>1?'s':''),
   number(p.gold)+' or · '+number(p.silver)+' argent · '+number(p.bronze)+' bronze')).join('');
  const yearly=[...(stats.yearly||[])].filter(y=>y.year!=='Sans date').slice(0,8).map(y=>item('📅',y.year,
   number(y.top10)+' top 10',number(y.finished)+' course'+(y.finished>1?'s':'')+' terminée'+(y.finished>1?'s':''))).join('');
  return '<div class="honors-kpis">'+topCards+'</div>'+
   (highlights.length?section('MES PERFORMANCES MARQUANTES',highlights.join('')):'<div class="honors-empty">Ajoute tes résultats de course pour découvrir tes meilleures performances.</div>')+
   (iconic?section('MES MEILLEURS CLASSEMENTS',iconic,'honors-achievements'):'')+
   (medalTable?section('DÉTAIL DES PODIUMS',medalTable):'')+
   (yearly?section('SAISONS REMARQUABLES',yearly):'');
 }
 root.RapliRegattaHonors=Object.freeze({render});
})(window);
