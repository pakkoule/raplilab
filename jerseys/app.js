/* Jerseys preview: references Sports identities instead of storing duplicate logos.
   Future saved Jersey tiles can persist {teamLogo:{id,category:'team',variant},
   competitionLogo:{id,category:'competition',variant},season}. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const library=window.RapliJerseysLogos;
 if(!library)return;
 const team=$('jerseyTeam'),competition=$('jerseyCompetition');
 const teamVariant=$('jerseyTeamVariant'),competitionVariant=$('jerseyCompetitionVariant');
 const season=$('jerseySeason'),status=$('jerseysLogoStatus'),refresh=$('jerseysLogoRefresh');
 const imageTargets={
   team:{img:$('jerseyTeamLogo'),fallback:$('jerseyTeamFallback'),label:$('jerseyTeamLabel')},
   competition:{img:$('jerseyCompetitionLogo'),fallback:$('jerseyCompetitionFallback'),label:$('jerseyCompetitionLabel')}
 };
 let entries=[],counter=0,activeRequests={list:0,resolve:0};
 let attempts=0,retry=null,lastSynced=false,loaded=false;
 const source=()=>{
   try{return window.parent!==window?window.parent.document.getElementById('frame-sports')?.contentWindow:null;}
   catch(_){return null;}
 };
 const clearRetry=()=>{if(retry!==null){clearTimeout(retry);retry=null;}};
 function request(action,payload={}){
   const target=source();
   if(!target){setStatus('Bibliothèque Sports accessible depuis Rapli Lab uniquement.',true);return;}
   const id=++counter;activeRequests[action]=id;
   try{target.postMessage({type:'RAPLI_JERSEYS_LOGOS_REQUEST',id,action,...payload},location.origin);}
   catch(_){setStatus('Impossible de joindre la bibliothèque Sports.',true);}
 }
 function setStatus(message,warning=false){
   status.textContent=message;
   status.dataset.warning=String(warning);
 }
 function fillSelect(node,items,placeholder){
   const previous=node.value;
   node.replaceChildren(new Option(placeholder,''));
   for(const item of items)node.add(new Option(item.name,item.id));
   if(items.some(item=>item.id===previous))node.value=previous;
   else node.value='';
 }
 function selection(kind){const select=kind==='team'?team:competition;return entries.find(entry=>entry.id===select.value&&entry.category===kind);}
 function updateVariants(kind){
   const node=kind==='team'?teamVariant:competitionVariant;
   const value=node.value;
   const entry=selection(kind);
   node.replaceChildren();
   for(const option of library.options(entry))node.add(new Option(option.label,option.value));
   if([...node.options].some(option=>option.value===value))node.value=value;
   node.disabled=!entry;
 }
 function clearImage(kind,label=''){
   const target=imageTargets[kind];
   target.img.removeAttribute('src');
   target.img.hidden=true;
   target.fallback.hidden=false;
   target.fallback.textContent=label?.trim()?.slice(0,2).toUpperCase()||'—';
   target.label.textContent=label|| (kind==='team'?'ÉQUIPE':'COMPÉTITION');
 }
 function updateReferencePreview(){
   const selectedTeam=selection('team'),selectedCompetition=selection('competition');
   $('jerseyPreviewTeam').textContent=selectedTeam?.name||'Équipe à sélectionner';
   $('jerseyPreviewCompetition').textContent=selectedCompetition?.name||'Compétition à sélectionner';
   $('jerseyPreviewSeason').textContent=season.value.trim()||'SAISON À DÉFINIR';
   clearImage('team',selectedTeam?.name||'');
   clearImage('competition',selectedCompetition?.name||'');
   request('resolve',{references:[
     {id:selectedTeam?.id||'',category:'team',season:season.value.trim(),variant:teamVariant.value},
     {id:selectedCompetition?.id||'',category:'competition',season:season.value.trim(),variant:competitionVariant.value}
   ]});
 }
 function applyResolved(values){
   for(const [index,kind] of ['team','competition'].entries()){
     const result=values?.[index]||{},target=imageTargets[kind];
     const expected=selection(kind);
     if(!expected||expected.id!==result.id){clearImage(kind,expected?.name||'');continue;}
     target.label.textContent=expected.name;
     if(library.imageSafe(result.image)){
       target.img.src=result.image;
       target.img.alt='Logo '+expected.name;
       target.img.hidden=false;target.fallback.hidden=true;
     }else clearImage(kind,expected.name);
   }
 }
 function reload(){
   attempts=0;loaded=false;
   clearRetry();setStatus('Recherche des logos Sports…');
   request('list');
   retry=setTimeout(retryList,1200);
 }
 function retryList(){
   retry=null;
   if(!loaded&&attempts++<12){
     request('list');
     retry=setTimeout(retryList,1400);
   }else if(!loaded)setStatus('Bibliothèque indisponible : réessaie avec Actualiser.',true);
 }
 function receiveList(data){
   loaded=true;clearRetry();
   lastSynced=data.synced===true;
   entries=(Array.isArray(data.entries)?data.entries:[]).filter(entry=>
     entry&&typeof entry.id==='string'&&['team','competition'].includes(entry.category));
   fillSelect(team,entries.filter(x=>x.category==='team'),'Sélectionner une équipe…');
   fillSelect(competition,entries.filter(x=>x.category==='competition'),'Sélectionner une compétition…');
   updateVariants('team');updateVariants('competition');
   updateReferencePreview();
   const count=entries.length;
   if(!data.ready){
     loaded=false;setStatus('Chargement des logos dans Rapli Sports…');
     retry=setTimeout(retryList,1300);
   }else if(!lastSynced){
     setStatus('Logos disponibles · synchronisation Sports en cours.',false);
   }else{
     setStatus(count?'Bibliothèque partagée · '+count+' identité'+(count>1?'s':'')+' disponibles.':
       'Aucun logo équipe ou compétition enregistré dans Sports.',!count);
   }
 }
 let updateTimer=null;
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==source())return;
   const message=event.data;
   if(message?.type==='RAPLI_JERSEYS_LOGOS_UPDATED'){
     if(updateTimer!==null)clearTimeout(updateTimer);
     updateTimer=setTimeout(()=>{updateTimer=null;request('list');},180);
     return;
   }
   if(message?.type!=='RAPLI_JERSEYS_LOGOS_RESPONSE')return;
   if(message.id!==activeRequests[message.action])return;
   if(message.action==='list')receiveList(message);
   else if(message.action==='resolve')applyResolved(message.values);
 });
 for(const kind of ['team','competition']){
   const node=kind==='team'?team:competition;
   node.addEventListener('change',()=>{updateVariants(kind);updateReferencePreview();});
   (kind==='team'?teamVariant:competitionVariant).addEventListener('change',updateReferencePreview);
 }
 let seasonTimer=null;
 season.addEventListener('input',()=>{
   if(seasonTimer!==null)clearTimeout(seasonTimer);
   seasonTimer=setTimeout(updateReferencePreview,180);
 });
 refresh.addEventListener('click',reload);
 window.addEventListener('pagehide',()=>{clearRetry();if(updateTimer!==null)clearTimeout(updateTimer);if(seasonTimer!==null)clearTimeout(seasonTimer);});
 reload();
})();
