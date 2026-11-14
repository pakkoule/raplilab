/* Rapli Regatta — score éditorial /100, distinct des points officiels VSR.
   Calculs purs : les notes mémorisées ne changent que sur validation explicite. */
(function(root){
 'use strict';
 const VERSION=1;
 const prestige={hc:10,vsr1:8,vsr2:5,vsr3:2};
 const gear={pdd:20,'half-fp':12,'full-pack':5};
 const podium={hc:[100,97,95],vsr1:[95,92,90],vsr2:[90,87,85],vsr3:[85,82,80]};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const round=v=>Math.round(v*100)/100;
 const count=v=>{const s=String(v??'').replace(/[\s\u00a0\u202f]/g,'');if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)&&n>0?n:null;};
 const fleet=r=>count(r.participantCount)||count(r.rankTotal);
 const rank=r=>count(r.rank);
 const med=xs=>{const a=[...xs].sort((x,y)=>x-y),n=a.length;return !n?null:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
 const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?Date.parse(s+'T00:00:00Z'):NaN;
 const parent=r=>r.kind==='event';
 const name=s=>String(s||'').trim().toLocaleLowerCase('fr');
 const same=(a,b)=>!parent(a)&&!parent(b)&&!!a.vsr&&a.vsr===b.vsr&&!!name(a.boatClass)&&name(a.boatClass)===name(b.boatClass);
 const prior=(a,b)=>Number.isFinite(date(a.start))&&Number.isFinite(date(b.start))&&date(a.start)<date(b.start);
 const completed=(r,status)=>status(r)==='finished';
 const reason=(msg,kind='race')=>({version:VERSION,kind,available:false,reason:msg});
 const mention=n=>n>=95?'LÉGENDAIRE':n>=90?'EXCEPTIONNELLE':n>=80?'EXCELLENTE':n>=70?'BONNE':n>=55?'CORRECTE':n>=40?'DÉCEVANTE':'NAUFRAGE';
 function historical(r,all,status){
  if(!Number.isFinite(date(r.start)))return {count:0,median:null,confidence:'provisoire'};
  const min=new Date(date(r.start));min.setUTCMonth(min.getUTCMonth()-24);
  const matches=all.filter(x=>x.id!==r.id&&same(x,r)&&prior(x,r)&&date(x.start)>=min.getTime()&&
    ['finished','dnf'].includes(status(x))&&fleet(x)!==null)
    .sort((a,b)=>b.start.localeCompare(a.start)||String(b.id).localeCompare(String(a.id)));
  // Pas de plafond arbitraire à 10 références : ce point n'avait pas été validé.
  const n=matches.length;
  return {count:n,median:med(matches.map(fleet)),confidence:n<3?'provisoire':n<5?'limitée':'fiable'};
 }
 function race(r,all,status){
  if(parent(r))return reason('La compétition possède une note globale indépendante.');
  if(status(r)==='dnf')return reason('DNF — abandon : aucune note.');
  if(status(r)!=='finished')return reason('Note disponible après la fin de la course.');
  const R=rank(r),N=fleet(r);
  if(!R||!N||N<2||R>N)return reason('Classement général final et effectif définitif requis.');
  if(!Object.prototype.hasOwnProperty.call(prestige,r.vsr))return reason('Catégorie VSR manquante.');
  // Sans classe, les critères historiques restent provisoires ; la prime attend la classe.
  const relative=35*(1-(R-1)/(N-1))**3;
  const previous=all.filter(x=>x.id!==r.id&&same(x,r)&&prior(x,r)&&completed(x,status)&&rank(x)&&fleet(x)>1&&rank(x)<=fleet(x))
    .sort((a,b)=>b.start.localeCompare(a.start)||String(b.id).localeCompare(String(a.id))).slice(0,5);
  const typical=med(previous.map(x=>rank(x)/fleet(x)));
  const progress=previous.length<3?10:clamp(10+5*Math.log2(typical/(R/N)),0,20);
  const ref=historical(r,all,status);
  const attendance=ref.count<3?10:clamp(10+4*Math.log2(N/ref.median),0,15);
  const equip=Object.prototype.hasOwnProperty.call(gear,r.equipment)?gear[r.equipment]:10;
  const parts={relative:round(relative),progress:round(progress),vsr:prestige[r.vsr],attendance:round(attendance),equipment:equip};
  const raw=round(relative+progress+prestige[r.vsr]+attendance+equip);
  const floor=R<=3?podium[r.vsr][R-1]:null;
  const threshold=Math.ceil(Math.max(1000,.25*(ref.median||0)));
  const eligible=floor!==null&&N>=threshold&&!!name(r.boatClass);
  const bonus=eligible?floor:null;
  const final=Math.round(clamp(Math.max(raw,bonus||0),0,100));
  const flags=[];
  if(previous.length<3)flags.push('Progression provisoire — historique limité');
  if(ref.count<3)flags.push('Affluence provisoire — historique insuffisant');
  else if(ref.count<5)flags.push('Affluence — référence limitée');
  if(!Object.prototype.hasOwnProperty.call(gear,r.equipment))flags.push('Équipement inconnu — 10 points provisoires');
  if(floor!==null&&ref.count<3)flags.push('Prime provisoire — référence insuffisante');
  else if(floor!==null&&ref.count<5)flags.push('Prime — référence limitée');
  if(!name(r.boatClass))flags.push('Classe de bateau inconnue — références historiques indisponibles');
  if(floor!==null&&!eligible)flags.push(!name(r.boatClass)?'Prime en attente — classe de bateau manquante':'Prime non applicable — flotte trop petite');
  return {version:VERSION,kind:'race',available:true,value:final,raw,mention:mention(final),parts,
    weights:{relative:35,progress:20,vsr:10,attendance:15,equipment:20},
    bonus,bonusFloor:floor,bonusEligible:eligible,bonusThreshold:threshold,
    reference:ref,progression:{count:previous.length,medianPercentile:typical},fleet:N,rank:R,flags,
    provisional:flags.some(x=>/provisoire|inconnu/i.test(x))};
 }
 function event(r,all,status){
  if(!parent(r))return reason('Fiche compétition requise.','event');
  if(status(r)==='dnf')return reason('Compétition abandonnée.','event');
  if(!r.eventClosed)return reason('Note en attente — compétition non clôturée.','event');
  const stages=all.filter(x=>!parent(x)&&x.eventId===r.id);
  const regular=stages.filter(x=>!x.joker);
  if(!regular.length)return reason('Pas de note : aucune étape normale (Joker uniquement).','event');
  const R=rank(r),N=fleet(r);
  if(!R||!N||N<2||R>N)return reason('Classement général final et effectif final requis.','event');
  if(regular.some(x=>!['dnf','finished'].includes(status(x))))
    return reason('Note en attente — étapes normales non clôturées.','event');
  const completedStages=regular.filter(x=>completed(x,status));
  if(completedStages.some(x=>!rank(x)||!fleet(x)||fleet(x)<2||rank(x)>fleet(x)))
    return reason('Note en attente — classement/effectif final manquant sur une étape.','event');
  const overall=70*(1-(R-1)/(N-1))**2;
  const values=completedStages.map(x=>100*rank(x)/fleet(x));
  let sigma=null,regularity=0;
  if(values.length===1)regularity=5;
  if(values.length>=2){const m=values.reduce((a,b)=>a+b,0)/values.length;
    sigma=Math.sqrt(values.reduce((sum,v)=>sum+(v-m)**2,0)/values.length);
    regularity=clamp(20-.75*sigma,0,20);}
  const completion=10*completedStages.length/regular.length;
  const raw=round(overall+regularity+completion);
  const refs=all.filter(x=>x.id!==r.id&&parent(x)&&x.eventClosed&&name(x.boatClass)&&name(x.boatClass)===name(r.boatClass)&&prior(x,r)&&fleet(x))
    .filter(x=>{if(!Number.isFinite(date(r.start)))return false;const min=new Date(date(r.start));min.setUTCMonth(min.getUTCMonth()-24);return date(x.start)>=min.getTime();});
  const historicalFleet=med(refs.map(fleet));
  const threshold=Math.ceil(Math.max(1000,.25*(historicalFleet||0)));
  const floor=R<=3?[100,97,95][R-1]:null;
  const eligible=floor!==null&&!!name(r.boatClass)&&N>=threshold;
  const bonus=eligible?floor:null;
  const final=Math.round(clamp(Math.max(raw,bonus||0),0,100));
  const flags=[];
  if(completedStages.length<2)flags.push('Régularité : règle stricte pour '+completedStages.length+' étape(s)');
  if(completedStages.length===2)flags.push('Régularité — référence limitée');
  if(floor!==null&&refs.length<3)flags.push('Prime provisoire — historique insuffisant');
  else if(floor!==null&&refs.length<5)flags.push('Prime — référence limitée');
  if(floor!==null&&!eligible)flags.push(!name(r.boatClass)?'Classe de bateau inconnue pour la prime':'Prime non applicable — flotte trop petite');
  return {version:VERSION,kind:'event',available:true,value:final,raw,mention:mention(final),
    parts:{overall:round(overall),regularity:round(regularity),completion:round(completion)},
    weights:{overall:70,regularity:20,completion:10},bonus,bonusFloor:floor,bonusEligible:eligible,bonusThreshold:threshold,
    fleet:N,rank:R,reference:{count:refs.length,median:historicalFleet},
    stages:{normal:regular.length,finished:completedStages.length,joker:stages.length-regular.length,sigma},flags,
    provisional:flags.some(x=>/provisoire|inconnue/i.test(x))};
 }
 const scoreFor=(r,all,status)=>parent(r)?event(r,all,status):race(r,all,status);
 const signature=r=>JSON.stringify([r.kind,r.dnf,r.live,r.upcoming,r.eventClosed,r.rank,r.rankTotal,
   r.participantCount,r.vsr,r.boatClass,r.equipment,r.start,r.eventId,r.joker]);
 root.RapliRegattaScore={VERSION,scoreFor,race,event,mention,historical,signature};
})(typeof window!=='undefined'?window:globalThis);
