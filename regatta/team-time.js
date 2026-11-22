/* Rapli Regatta — import of Virtual Regatta textual rankings and race clocks. */
(function(root){
'use strict';
function parseTime(raw){
 const value=String(raw??'').trim();
 if(!value||/^[+-]/u.test(value))return null;
 const regex=/(\d+)\s*(j|d|h|m|s)\b/giu,parts=[...value.matchAll(regex)];
 if(!parts.length||value.replace(regex,'').trim())return null;
 const used=new Set(),units={j:86400,d:86400,h:3600,m:60,s:1};
 let total=0;
 for(const part of parts){
  const unit=part[2].toLowerCase(),key=unit==='d'?'j':unit,n=Number(part[1]);
  if(used.has(key)||!Number.isSafeInteger(n)||(key==='m'||key==='s')&&n>=60) return null;
  used.add(key);
  total+=n*units[unit];
 }
 if(used.has('j')){
  const hours=parts.find(p=>p[2].toLowerCase()==='h');
  if(hours&&Number(hours[1])>=24)return null;
 }
 return Number.isSafeInteger(total)&&total>=0?total:null;
}
function formatTime(value){
 if(!Number.isSafeInteger(value)||value<0)return '—';
 const d=Math.floor(value/86400),h=Math.floor(value%86400/3600),m=Math.floor(value%3600/60),s=value%60;
 const pad=n=>String(n).padStart(2,'0');
 return d?pad(d)+'j '+pad(h)+'h '+pad(m)+'m '+pad(s)+'s':
  pad(Math.floor(value/3600))+'h '+pad(m)+'m '+pad(s)+'s';
}
function normalizePseudo(value){
 return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .toLocaleLowerCase('fr').replace(/\s*[-_ ]+\s*lpdb\s*$/iu,'')
  .replace(/[^a-z0-9]/gu,'');
}
function cleanName(value){
 return String(value??'').trim()
  .replace(/^\d{1,2}\s*[.)]\s*/u,'')
  .replace(/^[\s•●◦○·|*\[\]()]+/u,'')
  .trim();
}
function parseClassification(text){
 const lines=String(text??'').split(/\r\n|\n|\r/),entries=[],errors=[],warnings=[];
 let pending=null,leaderSeconds=null;
 for(let index=0;index<lines.length;index++){
  const line=lines[index].trim();
  if(!line||/^\d{1,3}[.)]?$/.test(line))continue;
  const offset=/^\+\s*(.+)$/u.exec(line);
  const time=offset?parseTime(offset[1]):parseTime(line);
  if(offset&&time===null){errors.push('Ligne '+(index+1)+' : écart invalide.');pending=null;continue;}
  if(time!==null){
   if(!pending){warnings.push('Ligne '+(index+1)+' : chrono sans pseudo.');continue;}
   if(entries.length===0&&offset){errors.push('Le premier skipper doit avoir son temps total, sans « + ».');pending=null;continue;}
   if(entries.length===0)leaderSeconds=time;
   if(leaderSeconds===null){errors.push('Temps du vainqueur introuvable.');break;}
   const elapsedSeconds=offset?leaderSeconds+time:time,gapSeconds=elapsedSeconds-leaderSeconds;
   if(!Number.isSafeInteger(elapsedSeconds)||gapSeconds<0){errors.push('Ligne '+(index+1)+' : temps incohérent.');pending=null;continue;}
   entries.push({position:entries.length+1,name:pending.name,line:pending.line,elapsedSeconds,gapSeconds});
   pending=null;
   if(entries.length>50){errors.push('Maximum de 50 skippers par course.');break;}
   continue;
  }
  if(pending)warnings.push('Ligne '+pending.line+' : '+pending.name+' sans chrono, ignoré.');
  const name=cleanName(line);
  if(name&&/[^\d]/u.test(name))pending={name,line:index+1};
 }
 if(pending)warnings.push('Ligne '+pending.line+' : '+pending.name+' sans chrono, ignoré.');
 if(!entries.length)errors.push('Aucun résultat reconnu : indique le temps total du premier skipper.');
 if(entries.length>50)entries.length=50;
 for(let i=1;i<entries.length;i++)if(entries[i].elapsedSeconds<entries[i-1].elapsedSeconds)
  errors.push('Chronos incompatibles avec le rang '+(i+1)+'.');
 return {leaderSeconds,entries,errors,warnings};
}
function matchSkippers(entries,roster){
 const lookup=new Map();
 for(const member of Array.isArray(roster)?roster:[]){
  const key=normalizePseudo(member.name);
  if(!key)continue;
  if(!lookup.has(key))lookup.set(key,[]);
  lookup.get(key).push(member);
 }
 return entries.map(entry=>{
  const options=lookup.get(normalizePseudo(entry.name))||[];
  return {...entry,skipperId:options.length===1?options[0].id:'',ambiguous:options.length>1};
 });
}
const api={parseTime,formatTime,normalizePseudo,parseClassification,matchSkippers};
root.RapliTeamTime=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
