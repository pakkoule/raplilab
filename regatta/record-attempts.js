/* Rapli Regatta — record attempts, separate from VSR rankings and scores. */
(function(root){
 'use strict';
 const MAX=100, MAX_SECONDS=315360000;
 function seconds(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>0&&n<=MAX_SECONDS?n:null;
 }
 function normalize(data){
  if(!Array.isArray(data))return [];
  const ids=new Set();
  return data.slice(0,MAX).filter(x=>x&&typeof x==='object').map((x,i)=>{
   let id=typeof x.id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x.id)?x.id:'record-attempt-'+(i+1);
   if(ids.has(id))id='record-attempt-'+(i+1)+'-unique';
   ids.add(id);
   return {id,seconds:seconds(x.seconds),aborted:!!x.aborted};
  });
 }
 function summary(raw){
  const attempts=normalize(raw),valid=attempts.filter(x=>!x.aborted&&x.seconds!==null);
  const best=valid.reduce((answer,x)=>!answer||x.seconds<answer.seconds?x:answer,null);
  return {total:attempts.length,completed:valid.length,aborted:attempts.filter(x=>x.aborted).length,
   bestSeconds:best?.seconds??null,bestId:best?.id??null};
 }
 function parts(total){
  const n=seconds(total);
  if(n===null)return {days:'',hours:'',minutes:'',seconds:''};
  return {days:String(Math.floor(n/86400)),hours:String(Math.floor(n%86400/3600)),
    minutes:String(Math.floor(n%3600/60)),seconds:String(n%60)};
 }
 function fromParts(values){
  const keys=['days','hours','minutes','seconds'],caps=[3650,23,59,59];
  const entries=keys.map(k=>String(values[k]??'').trim());
  if(entries.every(x=>x===''))return {valid:true,seconds:null};
  if(entries.some((x,i)=>x!==''&&(!/^\d+$/.test(x)||Number(x)>caps[i])))
   return {valid:false,reason:'Jours 0–3650, heures 0–23, minutes/secondes 0–59.'};
  const [d,h,m,s]=entries.map(x=>Number(x||0)),total=d*86400+h*3600+m*60+s;
  if(total>MAX_SECONDS)return {valid:false,reason:'Durée de tentative trop longue.'};
  return {valid:true,seconds:total===0?null:total};
 }
 function format(total){
  const n=seconds(total);if(n===null)return '—';
  const d=Math.floor(n/86400),h=Math.floor(n%86400/3600),m=Math.floor(n%3600/60),s=n%60;
  return (d?d+' j ':'')+String(h).padStart(2,'0')+' h '+String(m).padStart(2,'0')+' min '+String(s).padStart(2,'0')+' s';
 }
 root.RapliRegattaRecordAttempts={MAX,normalize,summary,parts,fromParts,format};
})(typeof window!=='undefined'?window:globalThis);
