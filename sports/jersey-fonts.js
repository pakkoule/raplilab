/* Editor-only custom lettering font library, reusing Rapli Sports' logo store. */
(()=>{
 'use strict';
 const panel=document.getElementById('jerseyFontPanel');
 const bridge=window.RapliExtrasBridge,fonts=window.RapliJerseyFonts;
 if(!panel||!bridge||!fonts)return;
 const $=id=>panel.querySelector('#'+id);
 const label=$('jerseyFontLabel'),file=$('jerseyFontFile'),form=$('jerseyFontForm');
 const testName=$('jerseyFontExampleName'),testNumber=$('jerseyFontExampleNumber');
 const nameOut=$('jerseyFontNamePreview'),numberOut=$('jerseyFontNumberPreview');
 let editing='',upload=null,busy=false,sequence=0,faceId=0,lastSignature='';
 const canEdit=()=>bridge.canEdit?.()===true&&window.RapliSharedCollection?.canEdit?.()===true;
 const inform=(message,warning=false)=>{
   $('jerseyFontStatus').textContent=message;
   $('jerseyFontStatus').dataset.warning=String(warning);
 };
 const text=()=>{
   nameOut.textContent=testName.value.trim().slice(0,40)||'JOUEUR';
   numberOut.textContent=testNumber.value.trim().slice(0,3)||'10';
 };
 const fallback=()=>{
   nameOut.style.fontFamily='Poppins,system-ui,sans-serif';
   numberOut.style.fontFamily='Poppins,system-ui,sans-serif';
 };
 async function preview(data){
   const request=++sequence;fallback();
   if(!fonts.safeData(data)){inform('Police indisponible ou encore en cours de synchronisation.',true);return false;}
   if(typeof FontFace==='undefined'||!document.fonts){
     inform('Aperçu des polices personnalisées indisponible sur ce navigateur.',true);return false;
   }
   try{
     const family='RapliLetteringEditor'+(++faceId);
     const face=await new FontFace(family,'url("'+data+'")',{style:'normal',weight:'normal'}).load();
     if(request!==sequence)return false;
     document.fonts.add(face);
     nameOut.style.fontFamily='"'+family+'",Poppins,sans-serif';
     numberOut.style.fontFamily='"'+family+'",Poppins,sans-serif';
     inform('Aperçu réel chargé. Tu peux enregistrer la police.');
     return true;
   }catch(error){
     if(request===sequence)inform('Impossible de lire les caractères de cette police.',true);
     return false;
   }
 }
 function reset(){
   editing='';upload=null;label.value='';file.value='';
   testName.value='JOUEUR';testNumber.value='10';text();
   ++sequence;fallback();
   $('jerseyFontSave').textContent='IMPORTER LA POLICE';
   inform('Sélectionne un fichier de police.');
   draw(true);
 }
 function rowFor(font,editable){
   const row=document.createElement('div');row.className='jersey-font-entry';
   const meta=document.createElement('div');meta.className='jersey-font-entry-info';
   const name=document.createElement('strong');name.textContent=font.name;
   const info=document.createElement('small');info.textContent=
     font.format.toUpperCase()+' · '+Math.ceil((Number(font.size)||0)/1024)+' Ko';
   meta.append(name,info);row.append(meta);
   const actions=document.createElement('div');actions.className='jersey-font-entry-actions';
   const btn=(title,run)=>{
     const element=document.createElement('button');element.type='button';
     element.textContent=title;element.addEventListener('click',run);actions.append(element);
     return element;
   };
   btn('APERÇU',()=>{
     const saved=fonts.find(bridge.logos(),font.id);
     if(!saved)return inform('Police introuvable.',true);
     editing='';upload=null;file.value='';label.value=saved.name;
     $('jerseyFontSave').textContent='IMPORTER LA POLICE';
     void preview(saved.fontData);
   });
   if(editable){
     btn('MODIFIER',()=>{
       const saved=fonts.find(bridge.logos(),font.id);
       if(!saved)return;
       editing=font.id;upload=null;label.value=saved.name;file.value='';
       $('jerseyFontSave').textContent='ENREGISTRER LES MODIFICATIONS';
       void preview(saved.fontData);
       form.scrollIntoView?.({behavior:'smooth',block:'nearest'});
     });
     const remove=btn('SUPPRIMER',async()=>{
       if(busy||!canEdit())return inform('Modification réservée à l’administrateur synchronisé.',true);
       if(!confirm('Supprimer la police « '+font.name+' » ? Les tuiles utilisant cette police reviendront à la police par défaut.'))return;
       busy=true;draw(true);
       try{
         await bridge.removeLogo(font.id);
         if(editing===font.id)reset();
         inform('Police supprimée. Les autres logos sont inchangés.');
       }catch(error){inform('Suppression impossible : '+error.message,true);}
       finally{busy=false;draw(true);}
     });
     remove.className='jersey-font-delete';
   }
   row.append(actions);return row;
 }
 function draw(force=false){
   const all=fonts.fonts(bridge.logos()),editor=canEdit();
   const signature=all.map(f=>f.id+'|'+f.name+'|'+f.format+'|'+f.size).join('\n')+'|'+editor;
   for(const node of [label,file])node.disabled=!editor||busy;
   $('jerseyFontSave').disabled=!editor||busy;
   if(!force&&signature===lastSignature)return;
   lastSignature=signature;
   const list=$('jerseyFontList');list.replaceChildren();
   for(const f of all)list.append(rowFor(f,editor));
   if(!all.length){
     const empty=document.createElement('p');
     empty.className='jersey-font-empty';
     empty.textContent='Aucune police de flocage importée.';
     list.append(empty);
   }
   $('jerseyFontCount').textContent=String(all.length);
 }
 async function selectFile(){
   upload=null;
   const incoming=file.files?.[0];if(!incoming)return;
   try{
     const parsed=await fonts.importFile(incoming);
     const loaded=await preview(parsed.data);
     if(!loaded)return;
     upload=parsed;
     if(!label.value.trim())label.value=incoming.name.replace(/\.(woff2?|ttf|otf)$/i,'')
       .replace(/[_-]+/g,' ').slice(0,100);
   }catch(error){inform(error.message,true);file.value='';upload=null;}
 }
 async function save(event){
   event.preventDefault();
   if(busy)return;
   if(!canEdit())return inform('Connexion administrateur et synchronisation nécessaires.',true);
   const name=label.value.trim();
   if(!name||name.length>100)return inform('Indique un nom de police (100 caractères max).',true);
   const current=editing?fonts.find(bridge.logos(),editing):null;
   const chosen=upload||(current?{
     data:current.fontData,size:current.size,fileName:current.fileName,format:current.format
   }:null);
   if(!chosen||!fonts.safeData(chosen.data))
     return inform('Importe et prévisualise un fichier de police valide.',true);
   busy=true;draw(true);
   try{
     await bridge.saveLogo({
       id:editing||'jersey-font:'+crypto.randomUUID(),type:'jersey-font',
       name,format:chosen.format,fontData:chosen.data,
       fileName:String(chosen.fileName||'').slice(0,140),size:chosen.size,updatedAt:Date.now()
     });
     reset();
     inform('Police enregistrée sur cet appareil. Vérifie le statut Cloud pour la synchronisation.');
   }catch(error){inform('Enregistrement impossible : '+error.message,true);}
   finally{busy=false;draw(true);}
 }
 file.addEventListener('change',()=>{void selectFile();});
 form.addEventListener('submit',event=>{void save(event);});
 $('jerseyFontClear').addEventListener('click',reset);
 testName.addEventListener('input',text);
 testNumber.addEventListener('input',text);
 window.RapliJerseyFontsUI={
   open(){panel.hidden=false;draw(true);},
   leave(){panel.hidden=true;},
   refresh(){if(!panel.hidden)draw();}
 };
 panel.closest('dialog')?.addEventListener('close',()=>window.RapliJerseyFontsUI.leave());
 draw(true);
})();