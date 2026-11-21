/* Reuse Rapli Sports' published, hydrated team and competition logos in Jerseys.
 * Only reference metadata is listed. Images are sent on demand for selected IDs.
 * Read-only; image ownership, historical periods and Supabase sync stay in Sports. */
(()=>{
 'use strict';
 const library=window.RapliJerseysLogos;
 const bridge=window.RapliExtrasBridge;
 if(!library||!bridge)return;
 const allowedOrigin=location.origin;
 const sourceFrame=()=>{
   try{return window.parent!==window?window.parent.document.getElementById('frame-jerseys'):null;}
   catch(_){return null;}
 };
 const isJerseys=event=>event.origin===allowedOrigin&&event.source===sourceFrame()?.contentWindow;
 const send=(message)=>{
   const frame=sourceFrame();
   try{if(frame?.contentWindow&&frame.src)frame.contentWindow.postMessage(message,allowedOrigin);}
   catch(_){/* Jerseys frame may be navigating. */}
 };
 const state=()=>{
   const raw=bridge.logos();
   const status=window.RapliSharedCollection?.getStatus?.();
   return {entries:library.list(raw),ready:window.RapliModuleBridge?.ready===true,
     synced:status?.initialized===true && status?.busyLoading!==true};
 };
 let timer=null;
 const notify=()=>{
   if(timer!==null)clearTimeout(timer);
   timer=setTimeout(()=>{
     timer=null;
     send({type:'RAPLI_JERSEYS_LOGOS_UPDATED'});
   },300);
 };
 window.RapliJerseysLogoService={notify};
 window.addEventListener('message',event=>{
   if(!isJerseys(event)||event.data?.type!=='RAPLI_JERSEYS_LOGOS_REQUEST')return;
   const id=event.data.id;
   if(!Number.isSafeInteger(id)||id<1)return;
   const action=event.data.action;
   if(action==='font-list'){
     const fonts=window.RapliJerseyFonts;
     const current=state();
     send({type:'RAPLI_JERSEYS_LOGOS_RESPONSE',id,action,
       entries:fonts?.metadata?.(bridge.logos())||[],ready:current.ready,synced:current.synced});
     return;
   }
   if(action==='font-resolve'){
     const fonts=window.RapliJerseyFonts;
     const requested=String(event.data.fontId||'').slice(0,180);
     const selected=fonts?.find?.(bridge.logos(),requested);
     send({type:'RAPLI_JERSEYS_LOGOS_RESPONSE',id,action,
       fontId:requested,format:selected?.format||'',
       data:fonts?.safeData?.(selected?.fontData)?selected.fontData:'',
       ready:state().ready});
     return;
   }
   if(action==='list'){
     const current=state();
     send({type:'RAPLI_JERSEYS_LOGOS_RESPONSE',id,action,entries:current.entries,
       ready:current.ready,synced:current.synced});
     return;
   }
   if(action==='resolve'){
     const values=Array.isArray(event.data.references)?event.data.references:[];
     if(values.length>2)return;
     const references=values.map(ref=>({
       id:String(ref?.id||'').slice(0,180),
       category:['team','competition'].includes(ref?.category)?ref.category:'',
       season:String(ref?.season||'').slice(0,12),
       variant:String(ref?.variant||'auto').slice(0,190)
     }));
     send({type:'RAPLI_JERSEYS_LOGOS_RESPONSE',id,action,
       values:references.map(ref=>library.resolve(bridge.logos(),ref)),
       ready:state().ready});
   }
 });
 window.addEventListener('rapli-module-ready',notify);
})();
