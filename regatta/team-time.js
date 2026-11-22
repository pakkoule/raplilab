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
  if(offset&&time===null){errors.push('Ligne '+(index+1)+' : écart « '+line+' » illisible. Utilise le format « + 03h 54m 01s » (minutes et secondes inférieures à 60).');pending=null;continue;}
  if(time!==null){
   if(!pending){warnings.push('Ligne '+(index+1)+' : chrono « '+line+' » ignoré, car aucun pseudo ne le précède. Ajoute le nom du skipper juste avant cette durée.');continue;}
   if(entries.length===0&&offset){errors.push('Ligne '+(index+1)+' : « '+pending.name+' » est le premier classé, mais son temps « '+line+' » commence par +. Renseigne son temps total (par exemple 11j 16h 58m), sans +.');pending=null;continue;}
   if(entries.length===0)leaderSeconds=time;
   if(leaderSeconds===null){errors.push('Ligne '+(index+1)+' : temps total du vainqueur manquant. Le premier skipper doit posséder un chrono absolu avant les écarts + des suivants.');break;}
   const elapsedSeconds=offset?leaderSeconds+time:time,gapSeconds=elapsedSeconds-leaderSeconds;
   if(!Number.isSafeInteger(elapsedSeconds)||gapSeconds<0){errors.push('Ligne '+(index+1)+' : chrono « '+line+' » impossible pour « '+pending.name+' » ; le temps calculé doit être supérieur ou égal à celui du premier ('+formatTime(leaderSeconds)+'). Vérifie le signe + et les unités.');pending=null;continue;}
   entries.push({position:entries.length+1,name:pending.name,line:pending.line,elapsedSeconds,gapSeconds});
   pending=null;
   if(entries.length>50){errors.push('Ligne '+(index+1)+' : 51e skipper détecté (« '+entries[entries.length-1].name+' »). Une course LPDB accepte au maximum 50 participants : réduis le classement importé.');break;}
   continue;
  }
  if(pending)warnings.push('Ligne '+pending.line+' : « '+pending.name+' » ignoré : aucun chrono n’a été trouvé juste après son pseudo. Colle sa durée sur la ligne suivante.');
  const name=cleanName(line);
  if(name&&/[^\d]/u.test(name))pending={name,line:index+1};
 }
 if(pending)warnings.push('Ligne '+pending.line+' : « '+pending.name+' » ignoré : aucun chrono n’a été trouvé juste après son pseudo. Colle sa durée sur la ligne suivante.');
 if(!entries.length)errors.push('Aucun résultat lisible : colle pour chaque skipper son pseudo puis sa durée sur la ligne suivante. Commence par le chrono complet du premier (ex. 11j 16h 58m), puis les écarts précédés de +.');
 if(entries.length>50)entries.length=50;
 for(let i=1;i<entries.length;i++)if(entries[i].elapsedSeconds<entries[i-1].elapsedSeconds)
  errors.push('Ordre des temps incohérent : « '+entries[i].name+' » (rang '+(i+1)+', '+formatTime(entries[i].elapsedSeconds)+') arrive avant « '+entries[i-1].name+' » (rang '+i+', '+formatTime(entries[i-1].elapsedSeconds)+'). Corrige l’ordre ou l’écart.');
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
