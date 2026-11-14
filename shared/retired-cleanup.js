/* RapliLab PR #1 — clear ONLY local data of modules explicitly retired.
 * Runs on each browser/device when the updated portal is opened.
 * Cloud rows are removed by the server migration; this never touches live modules. */
(()=>{
 'use strict';
 const marker='rapli-retired-workspaces-cleaned-20261114';
 const databases=['rapli-time-v1','rapli-refs-v1','rapli-tiers-v1','rapli-top10-v1','rapli-coach-v1'];
 const localKeys=['rapli-time-fallback','rapli-refs-fallback',
  'rapli-cloud-time-ack-v1','rapli-cloud-refs-ack-v1',
  'rapli-cloud-tiers-ack-v1','rapli-cloud-top10-ack-v1','rapli-cloud-coach-ack-v1'];
 try{for(const key of localKeys)localStorage.removeItem(key);}catch(e){console.warn('Rapli retire: localStorage inaccessible',e);}
 if(!('indexedDB' in window))return;
 try{if(localStorage.getItem(marker)==='1')return;}catch(_){}
 const drop=name=>new Promise(resolve=>{
  try{
   const req=indexedDB.deleteDatabase(name);
   req.onsuccess=()=>resolve(true);
   req.onerror=()=>{console.warn('Rapli retire: suppression impossible',name,req.error);resolve(false);};
   req.onblocked=()=>{console.warn('Rapli retire: fermer les anciens onglets avant de réessayer',name);resolve(false);};
  }catch(e){console.warn('Rapli retire: stockage indisponible',name,e);resolve(false);}
 });
 Promise.all(databases.map(drop)).then(results=>{
  if(results.every(Boolean))try{localStorage.setItem(marker,'1');}catch(_){}
 });
})();
