/* Selected custom font is sent on demand from Sports; no duplicate font store. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),fonts=window.RapliJerseyFonts;
 if(!fonts)return;
 const nameInput=$('jerseyLetteringName'),numberInput=$('jerseyLetteringNumber');
 const nameOutput=$('jerseyLetteringNamePreview'),numberOutput=$('jerseyLetteringNumberPreview');
 const shirt=$('jerseyShirtBack'),color=$('jerseyLetteringColor');
 const namePicker=$('jerseyLetteringFont'),numberPicker=$('jerseyLetteringNumberFont');
 const notice=$('jerseysFontStatus');
 let items=[],requestId=0,retry=null,tries=0;
 const inflight=new Map(),pending=new Set(),cache=new Map();
 let faceSequence=0,hasSetInitial=false,loaded=false;
 const origin=location.origin;
 const source=()=>{
   try{return window.parent!==window?window.parent.document.getElementById('frame-sports')?.contentWindow:null;}
   catch(_){return null;}
 };
 const inform=(message,warning=false)=>{notice.textContent=message;notice.dataset.warning=String(warning);};
 function post(action,extra={}){
   const target=source();
   if(!target)return 0;
   const id=++requestId;
   if(action==='font-resolve')inflight.set(id,extra.fontId);
   target.postMessage({type:'RAPLI_JERSEYS_LOGOS_REQUEST',action,id,...extra},origin);
   return id;
 }
 function cancelRetry(){if(retry!==null){clearTimeout(retry);retry=null;}}
 function loadList(){
   if(!post('font-list'))inform('Ouvre Rapli Lab pour accéder aux polices de flocage.',true);
 }
 function retryList(){
   retry=null;
   if(loaded)return;
   if(++tries>12){inform('Bibliothèque de polices momentanément indisponible.',true);return;}
   loadList();
   retry=setTimeout(retryList,1300);
 }
 function reload(){
   loaded=false;tries=0;cancelRetry();
   loadList();retry=setTimeout(retryList,1400);
 }
 function setOptions(node,options,first){
   const previous=node.value;
   node.replaceChildren(new Option(first.label,first.value));
   for(const item of options)node.add(new Option(item.name+' · '+item.format.toUpperCase(),item.id));
   const optionsValues=[...node.options].map(x=>x.value);
   node.value=optionsValues.includes(previous)?previous:first.value;
 }
 function fontVersion(id){
   const item=items.find(x=>x.id===id);
   return item?id+'|'+item.updatedAt:'';
 }
 function setText(){
   nameOutput.textContent=nameInput.value.trim().slice(0,40)||'JOUEUR';
   numberOutput.textContent=numberInput.value.trim().slice(0,3)||'10';
 }
 function currentIds(){
   return [namePicker.value,numberPicker.value==='same'?namePicker.value:numberPicker.value];
 }
 function renderFonts(){
   const [nameId,numberId]=currentIds();
   for(const [index,id] of [nameId,numberId].entries()){
     const target=index===0?nameOutput:numberOutput;
     const key=fontVersion(id);
     target.style.fontFamily=(key&&cache.has(key))?
       '"'+cache.get(key)+'",Poppins,sans-serif':'Poppins,system-ui,sans-serif';
     if(id&&key&&!cache.has(key)&&!pending.has(key)){
       pending.add(key);
       const request=post('font-resolve',{fontId:id});
       if(!request)pending.delete(key);
     }
   }
 }
 async function handleFontResponse(message){
   const fontId=inflight.get(message.id);
   if(!fontId||fontId!==message.fontId)return;
   inflight.delete(message.id);
   const key=fontVersion(fontId);
   if(!key)return;
   pending.delete(key);
   if(!fonts.safeData(message.data)){
     inform('Police non disponible : la synchronisation est peut-être encore en cours.',true);
     return;
   }
   if(typeof FontFace==='undefined'||!document.fonts){
     inform('Ce navigateur ne prend pas en charge les polices de flocage.',true);return;
   }
   try{
     const family='RapliJerseyLetter'+(++faceSequence);
     const face=await new FontFace(family,'url("'+message.data+'")',{style:'normal',weight:'normal'}).load();
     // The user may have selected a different font while this was loading.
     if(key!==fontVersion(fontId))return;
     document.fonts.add(face);
     cache.set(key,family);
     renderFonts();
     inform('Police de flocage personnalisée appliquée.');
   }catch(error){
     inform('Ce fichier de police ne peut pas être affiché.',true);
   }
 }
 function handleList(message){
   loaded=message.ready===true;
   cancelRetry();
   const raw=Array.isArray(message.entries)?message.entries:[];
   items=raw.filter(x=>x&&typeof x.id==='string'&&x.id.startsWith('jersey-font:')&&fonts.format(x.format));
   setOptions(namePicker,items,{value:'',label:'Par défaut · Poppins'});
   setOptions(numberPicker,items,{value:'same',label:'Même police que le nom'});
   if(!hasSetInitial&&items.length&&!namePicker.value){
     namePicker.value=items[0].id;hasSetInitial=true;
   }
   if(!loaded){
     inform('Chargement des polices Sports en cours…');
     retry=setTimeout(retryList,1400);
   }else{
     inform(items.length?items.length+' police'+(items.length>1?'s':'')+' de flocage disponibles.':
       'Aucune police importée : ajoute-en une depuis la bibliothèque.',!items.length);
   }
   renderFonts();
 }
 window.addEventListener('message',event=>{
   if(event.origin!==origin||event.source!==source())return;
   const message=event.data;
   if(message?.type==='RAPLI_JERSEYS_LOGOS_UPDATED'){
     // A Sports logo/font was edited or cloud data changed.
     pending.clear();cache.clear();inflight.clear();
     reload();return;
   }
   if(message?.type!=='RAPLI_JERSEYS_LOGOS_RESPONSE')return;
   if(message.action==='font-list'){handleList(message);return;}
   if(message.action==='font-resolve'){void handleFontResponse(message);}
 });
 for(const el of [nameInput,numberInput])el.addEventListener('input',setText);
 for(const el of [namePicker,numberPicker])el.addEventListener('change',renderFonts);
 color.addEventListener('input',()=>shirt.style.setProperty('--lettering-color',color.value));
 $('jerseysLogoRefresh').addEventListener('click',reload);
 window.addEventListener('pagehide',cancelRetry);
 setText();reload();
})();