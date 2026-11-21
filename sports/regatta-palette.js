/* Rapli Sports — Regatta appearance controls, using the existing Regatta iframe as the only source of truth. */
(() => {
  'use strict';
  const panel=document.getElementById('regattaPalettePanel');
  if(!panel)return;
  const byId=id=>document.getElementById(id);
  const status=byId('regattaPaletteStatus');
  const classes=byId('regattaPaletteClasses');
  const vsr=byId('regattaPaletteVsr');
  const refresh=byId('regattaPaletteRefresh');
  const global=byId('regattaPaletteGlobal');
  const compact=byId('regattaPaletteCompact');
  const colorOk=value=>/^#[0-9a-f]{6}$/i.test(value||'');
  let latest=null, requestId=0, retry=null, active=false, pending=false;
  const regattaFrame=()=>{
    try{return window.parent.document.getElementById('frame-regatta');}
    catch(_){return null;}
  };
  function stopRetry(){if(retry!==null){clearTimeout(retry);retry=null;}}
  function showStatus(message,warning=false){
    status.textContent=message;status.dataset.warning=String(warning);
  }
  function request(action='read',options={}){
    if(!active)return;
    const frame=regattaFrame();
    if(!frame||!frame.contentWindow){
      showStatus('Ouvre Rapli Lab pour personnaliser Regatta.',true);return;
    }
    const message={type:'RAPLI_REGATTA_PALETTE_REQUEST',id:++requestId,action,...options};
    const send=()=>frame.contentWindow?.postMessage(message,location.origin);
    if(!frame.hasAttribute('src')&&frame.dataset.src){
      frame.addEventListener('load',send,{once:true});
      frame.src=frame.dataset.src;
      delete frame.dataset.src;
    }else send();
    if(action==='read'){
      stopRetry();
      retry=setTimeout(()=>{
        retry=null;
        if(active&&!latest?.ready)request('read');
      },1600);
    }
  }
  function colorRow(label,color,kind,key,description){
    const row=document.createElement('label');
    row.className='regatta-palette-row';
    const left=document.createElement('span');
    const chip=document.createElement('span');
    chip.className='regatta-palette-chip';
    chip.style.setProperty('--regatta-chip',color);
    chip.textContent=label;
    left.append(chip);
    if(description){
      const small=document.createElement('small');
      small.textContent=description;
      left.append(small);
    }
    const input=document.createElement('input');
    input.type='color';input.value=color;input.disabled=!latest.editable;
    input.setAttribute('aria-label','Couleur de '+label);
    input.addEventListener('change',()=>apply('update',{kind,key,value:input.value}));
    row.append(left,input);
    return row;
  }
  function draw(){
    if(!latest)return;
    const ready=latest.ready===true,editable=ready&&latest.editable===true;
    global.value=colorOk(latest.defaultColor)?latest.defaultColor:'#008fa1';
    global.disabled=!editable;compact.checked=latest.compact===true;compact.disabled=!editable;
    classes.replaceChildren();
    vsr.replaceChildren();
    if(!ready){
      showStatus('Chargement de Rapli Regatta et de ses paramètres…');
      return;
    }
    for(const item of latest.classes||[]){
      if(!colorOk(item.color))continue;
      classes.append(colorRow(item.label,item.color,'class',item.key,
        item.count+' course'+(item.count===1?'':'s')+(item.custom?' · Personnalisée':' · Couleur générale')));
    }
    const names={hc:'Hors Catégorie',vsr1:'VSR 1',vsr2:'VSR 2',vsr3:'VSR 3'};
    for(const item of latest.vsr||[]){
      if(!colorOk(item.color)||!names[item.key])continue;
      vsr.append(colorRow(names[item.key],item.color,'vsr',item.key,
        item.count+' course'+(item.count===1?'':'s')));
    }
    showStatus(editable?'Réglages liés à Regatta · sauvegarde Supabase habituelle.':
      'Lecture seule : connecte-toi comme administrateur et attends la synchronisation de Regatta.',!editable);
  }
  function apply(action,options={}){
    if(!latest?.ready||!latest?.editable||pending)return;
    pending=true;
    showStatus('Application de la personnalisation…');
    request(action,options);
  }
  window.addEventListener('message',event=>{
    const frame=regattaFrame();
    if(!active||event.origin!==location.origin||event.source!==frame?.contentWindow||
      event.data?.type!=='RAPLI_REGATTA_PALETTE_RESPONSE')return;
    if(event.data.id<requestId)return;
    pending=false;
    latest=event.data.state||null;
    draw();
    if(event.data.error)showStatus(event.data.error,true);
    if(!latest?.ready){
      stopRetry();
      retry=setTimeout(()=>{retry=null;if(active)request('read');},1600);
    }else if(!latest.editable){
      stopRetry();
      retry=setTimeout(()=>{retry=null;if(active)request('read');},3300);
    }else stopRetry();
  });
  global.addEventListener('change',()=>{
    if(!latest?.editable)return;
    if(latest.classes?.some(item=>item.custom)&&
      !confirm('Appliquer cette couleur à toutes les classes de bateaux ? Les couleurs personnalisées seront effacées.')){
      global.value=latest.defaultColor;return;
    }
    apply('update',{kind:'default',value:global.value});
  });
  compact.addEventListener('change',()=>apply('update',{kind:'compact',value:compact.checked}));
  refresh.addEventListener('click',()=>{latest=null;showStatus('Actualisation des réglages…');request('read');});
  window.RapliRegattaPalette={
    open(){
      active=true;pending=false;latest=null;
      panel.hidden=false;showStatus('Chargement des réglages de Rapli Regatta…');
      request('read');
    },
    close(){active=false;pending=false;stopRetry();panel.hidden=true;}
  };
})();
