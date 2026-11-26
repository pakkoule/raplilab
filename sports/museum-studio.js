(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const range=(label,value,min,max,unit='%')=>({label,value,min,max,unit});
  const flag=(label,value=true)=>({label,value});
  const color=label=>({label,value:'',color:true});
  const finishes={none:'Aucun socle',matte:'Noir mat',aluminium:'Aluminium brossé',chrome:'Chrome argenté',gold:'Or brossé',marble:'Marbre noir',glass:'Verre fumé'};
  const sections={
    Environnement:{
      metal:flag('Aluminium brossé • interface classique'), transitions:flag('Transitions de navigation'),
      autoTint:flag('Couleurs suggérées pour les parallèles sans réglage',false),
      refraction:flag('Bordures réfractives • Fiches et Vignettes'), edge:range('Intensité de réfraction',38,0,100)
    },
    Spotlights:{
      on:flag('Projecteurs'), tint:color('Couleur du faisceau'), power:range('Intensité lumineuse',65,0,100),
      angle:range('Angle',0,-22,22,'°'), width:range('Ouverture',64,18,100,'°'),
      source:range('Hauteur depuis le haut',16,8,60,' px'), length:range('Longueur',88,20,100),
      blur:range('Diffusion des contours',5,1,18,' px'), opacity:range('Opacité',86,0,100),
      temperature:range('Température',6500,2700,9500,' K'), bulb:range('Puissance de la source',85,0,100),
      floor:range('Reflet au sol',44,0,100), x:range('Position horizontale',50,20,80)
    },
    Socles:{baseOn:flag('Socles d’exposition'),finish:{label:'Finition',value:'matte',options:finishes}},
    Ombres:{shadowOn:flag('Ombres projetées'),shadow:range('Intensité',48,0,100),softness:range('Diffusion',14,2,32,' px')},
    Halos:{haloOn:flag('Rétroéclairage'),haloColor:color('Couleur du halo'),haloPower:range('Intensité',34,0,100),
      radius:range('Rayon',66,15,100),spread:range('Diffusion',68,10,95),haloOpacity:range('Opacité',60,0,100)},
    Atmosphère:{mistOn:flag('Brume volumétrique'),mist:range('Intensité',18,0,100)}
  };
  const fields=Object.assign({},...Object.values(sections));
  const defaults=Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.value]));
  const presets={
    'Galerie classique':{},'Spotlight intense':{power:92,bulb:100,floor:62},'Lumière diffuse':{width:90,blur:15,power:48},
    'Faisceau étroit':{width:30,blur:3},'Cinématique':{angle:-9,x:60,width:55,length:98,temperature:4400},
    'Lumière froide':{temperature:9000},'Lumière chaude':{temperature:3200},'Éclairage minimaliste':{power:24,bulb:40,floor:16}
  };
  const hex=v=>typeof v==='string'&&/^#[a-f\d]{6}$/i.test(v);
  const esc=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const bridge=()=>window.RapliMuseumBridge;
  function validated(f,v){
    if(f.color)return hex(v)?v:'';
    if(f.options)return Object.hasOwn(f.options,v)?v:f.value;
    if(typeof f.value==='boolean')return typeof v==='boolean'?v:f.value;
    return Number.isFinite(v)?Math.max(f.min,Math.min(f.max,Math.round(v))):f.value;
  }
  function cleanValues(raw,schema){
    const values={};
    for(const [k,f] of Object.entries(schema))if(raw&&Object.hasOwn(raw,k))values[k]=validated(f,raw[k]);
    return values;
  }
  function read(raw){
    const overrides=Object.create(null);
    for(const [id,v] of Object.entries(raw?.overrides||{}))overrides[id]=cleanValues(v,sections.Spotlights);
    return {global:cleanValues(raw?.global,fields),overrides};
  }
  let saved,source,draft,section='Spotlights',scope='',previewSource='',saving=false;
  function refresh(){
    const raw=bridge()?.settings();
    if(!saved||source!==raw){source=raw;saved=read(raw);}
    const g={...defaults,...saved.global},root=document.documentElement;
    root.classList.toggle('museum-metal',g.metal);
    root.style.setProperty('--museum-edge',String(g.refraction?g.edge/100:0));
  }
  function scene(config,profiles,legacy){
    const profile=profiles.find(p=>Object.keys(config.overrides[p.id]||{}).length||hex(p.spotlightColor));
    const v={...defaults,...config.global,...config.overrides[profile?.id]};
    const tint=config.overrides[profile?.id]?.tint||profile?.spotlightColor||v.tint;
    const lamp=hex(tint)?tint:v.autoTint&&hex(legacy?.color)?legacy.color:'#ffffff';
    const temp=v.temperature<6500?'#ffb477':'#aacbff';
    const warmth=Math.min(40,Math.abs(v.temperature-6500)/80);
    const style={
      lamp,'beam-left':lamp,'beam-right':lamp,'lit-color':`color-mix(in srgb,${lamp},${temp} ${warmth}%)`,
      'light-x':v.x+'%','light-y':v.source+'px','beam-angle':v.angle+'deg','beam-half':v.width/2+'deg',
      'beam-length':v.length+'%','beam-blur':v.blur+'px','beam-power':v.power/100,
      'light-alpha':v.on?v.opacity/100:0,'bulb-power':v.bulb+'%','floor-power':v.floor+'%',
      'base-show':v.baseOn&&v.finish!=='none'?'block':'none','shadow-alpha':v.shadowOn?v.shadow/100:0,
      'shadow-x':(50-v.x)/4+'px','shadow-soft':v.softness+'px','halo-tint':v.haloColor||lamp,
      'halo-alpha':v.haloOn?v.haloPower*v.haloOpacity/10000:0,'halo-size':100+v.radius+'%',
      'halo-core':(100-v.spread)/2+'%','mist-alpha':v.mistOn&&v.on?v.mist*v.opacity/10000*.32:0,
      'base-surface':'var(--base-'+v.finish+')'
    };
    // Keep the legacy spectrum for explicitly configured iridescent parallels.
    if(v.autoTint&&legacy?.iris&&!tint){style['beam-left']='#a5d4d4';style['beam-right']='#ddc3df';}
    return Object.entries(style).map(([k,val])=>'--'+k+':'+val).join(';');
  }
  function style(profiles,legacy){return scene(saved||read(bridge()?.settings()),profiles,legacy);}
  const panel=()=>$('museumStudio');
  function options(entries,current){
    return entries.map(([key,label])=>'<option value="'+esc(key)+'"'+(key===current?' selected':'')+'>'+esc(label)+'</option>').join('');
  }
  function profiles(){return bridge().parallels();}
  function values(){
    const profile=profiles().find(p=>p.id===scope);
    return {...defaults,...draft.global,...(scope&&hex(profile?.spotlightColor)?{tint:profile.spotlightColor}:{}),...(scope?draft.overrides[scope]:{})};
  }
  function target(){return scope?(draft.overrides[scope]||=(Object.create(null))):draft.global;}
  function control(k,f,v){
    const id='museum-field-'+k,attr='data-setting="'+k+'"',label='<label for="'+id+'">'+f.label+'</label>';
    let input;
    if(f.color)input='<input type="color" aria-label="'+f.label+'" '+attr+' value="'+(v||'#ffffff')+'"><input id="'+id+'" '+attr+' type="text" maxlength="7" aria-label="'+f.label+' HEX" placeholder="Automatique" value="'+esc(v)+'">';
    else if(f.options)input='<select id="'+id+'" '+attr+'>'+options(Object.entries(f.options),v)+'</select>';
    else if(typeof f.value==='boolean')input='<input id="'+id+'" type="checkbox" '+attr+(v?' checked':'')+'>';
    else{
      const bounds=' min="'+f.min+'" max="'+f.max+'" step="1" value="'+v+'" '+attr;
      input='<input id="'+id+'" type="range"'+bounds+'><input aria-label="'+f.label+' en '+f.unit.trim()+'" type="number"'+bounds+'><small>'+f.unit+'</small>';
    }
    const inherited=scope&&Object.hasOwn(draft.overrides[scope]||{},k);
    return '<div class="museum-setting">'+label+'<div>'+input+(scope?'<button type="button" '+(inherited?'':'hidden')+' data-inherit="'+k+'" aria-label="Hériter du réglage global pour '+f.label+'">↶</button>':'')+'</div></div>';
  }
  function paint(){
    const sample=panel().querySelector('.museum-sample');
    const p=profiles().find(row=>row.id===scope);
    sample.style.cssText=scene(draft,p?[p]:[],null);
    sample.dataset.section=section;
    const g=values();
    sample.style.setProperty('--sample-edge',String(g.refraction?g.edge/100:0));
    sample.classList.toggle('metal-preview',g.metal);
  }
  function render(){
    const v=values(),box=panel();
    box.innerHTML='<h3>Musée</h3><div class="museum-studio-layout"><div class="museum-sample" aria-label="Aperçu de l’exposition">'+
      '<div class="museum-artwork">'+(previewSource?'<img alt="Aperçu de la carte">':'<span class="museum-sample-card">RAPLI ARCHIVES</span>')+'</div><span class="museum-air"></span><span class="museum-light"></span></div>'+
      '<div><label>Catégorie<select data-category>'+options(Object.keys(sections).map(k=>[k,k]),section)+'</select></label>'+
      (section==='Spotlights'?'<label>Appliquer à<select data-scope>'+options([['','Tout le musée'],...profiles().map(p=>[p.id,p.name])],scope)+'</select></label>'+
      '<label>Préréglage<select data-preset>'+options([['','Choisir…'],...Object.keys(presets).map(k=>[k,k])],'')+'</select></label>':'')+
      Object.entries(sections[section]).map(([k,f])=>control(k,f,v[k])).join('')+
      '<button type="button" data-reset-section>Réinitialiser cette catégorie</button></div></div>'+
      '<footer><button type="button" data-reset-all>Restaurer tous les réglages</button><button type="button" data-cancel>Annuler</button>'+
      '<button type="button" data-save>Enregistrer</button></footer>';
    const img=box.querySelector('.museum-sample img');if(img)img.src=previewSource;
    paint();
  }
  function edit(open){
    if(!open){draft=null;previewSource='';return;}
    if(!bridge().canEdit())return;
    draft=read(bridge().settings());scope='';previewSource=bridge().previewCard()?.photo||'';render();
  }
  function inputs(e){
    const node=e.target,k=node.dataset.setting;if(!k||!draft||saving)return;
    const f=fields[k],v=node.type==='checkbox'?node.checked:typeof f.value==='number'?node.valueAsNumber:node.value;
    node.setCustomValidity('');
    const invalid=f.color&&v&&!hex(v)||node.type==='number'&&(!Number.isFinite(v)||!node.validity.valid);
    node.setCustomValidity(invalid?'Valeur hors limites ou HEX invalide.':'');
    if(invalid)return;
    target()[k]=validated(f,v);
    const inherit=node.parentElement.querySelector('[data-inherit]');if(inherit)inherit.hidden=false;
    for(const sibling of panel().querySelectorAll('[data-setting="'+k+'"]')){
      if(sibling===node)continue;
      sibling.setCustomValidity('');sibling.value=f.color&&!v&&sibling.type==='color'?'#ffffff':v;
    }
    paint();
  }
  function change(e){
    if(!draft||saving)return;
    const n=e.target;
    if(n.hasAttribute('data-category')){section=n.value;scope='';}
    else if(n.hasAttribute('data-scope'))scope=n.value;
    else if(n.hasAttribute('data-preset')&&Object.hasOwn(presets,n.value)){
      for(const [k,f] of Object.entries(sections.Spotlights))target()[k]=presets[n.value][k]??f.value;
    }else return;
    render();
  }
  async function click(e){
    const b=e.target.closest('button');if(!b||!draft||saving)return;
    if(b.dataset.inherit)delete target()[b.dataset.inherit];
    else if(b.hasAttribute('data-reset-section'))for(const k of Object.keys(sections[section]))delete target()[k];
    else if(b.hasAttribute('data-reset-all')){draft=read(null);scope='';}
    else if(b.hasAttribute('data-cancel')){edit(true);return;}
    else if(b.hasAttribute('data-save')){
      if(!panel().querySelectorAll('input:invalid').length){
        saving=true;b.disabled=true;
        try{await bridge().save(read(draft));if(draft)edit(true);bridge().notify('Réglages du musée enregistrés');}
        catch(err){bridge().notify(err.message||'Enregistrement impossible');}
        finally{saving=false;b.disabled=false;}
      }else panel().querySelector('input:invalid').reportValidity();
      return;
    }else return;
    render();
  }
  let animation;
  function transition(node){
    if(!node?.animate||saved?.global.transitions===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    animation?.cancel();
    animation=node.animate([{opacity:.8,translate:'0 3px'},{opacity:1,translate:'0 0'}],{duration:180,easing:'ease-out'});
  }
  let immersive=false,native=false,oldScroll=0,position=0;
  function strip(){return $('cardGrid').querySelector('.museum-strip');}
  function changeStage(on){
    const rail=strip();if(immersive===on||!rail&&on)return;
    if(on)oldScroll=window.scrollY;
    position=rail?rail.scrollLeft/(rail.firstElementChild?.getBoundingClientRect().width||1):0;
    immersive=on;
    document.documentElement.classList.toggle('museum-immersive',on);
    try{if(window.frameElement?.id==='frame-sports')parent.document.documentElement.classList.toggle('museum-presenting',on);}catch{/* Standalone cross-origin embed. */}
    const button=$('museumFullscreen');
    button.setAttribute('aria-label',on?'Quitter le plein écran':'Ouvrir le musée en plein écran');
    button.querySelector('path').setAttribute('d',on?'M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5':'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5');
    button.title=on?'Quitter le plein écran':'Plein écran';button.setAttribute('aria-pressed',String(on));
    requestAnimationFrame(()=>{
      if(rail)rail.scrollLeft=position*(rail.firstElementChild?.getBoundingClientRect().width||1);
      if(!on)window.scrollTo(0,oldScroll);
      button.focus({preventScroll:true});
    });
  }
  async function toggle(){
    if(immersive){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});changeStage(false);return;}
    changeStage(true);
    try{if(document.fullscreenEnabled)await document.documentElement.requestFullscreen();}catch{/* CSS presentation is already active. */}
  }
  function stageAvailable(available){if(!available&&immersive)void toggle();}
  function init(){
    const box=panel();box.addEventListener('input',inputs);box.addEventListener('change',change);box.addEventListener('click',click);
    $('logoDialog').addEventListener('close',()=>edit(false));
    $('museumFullscreen').addEventListener('click',toggle);
    document.addEventListener('fullscreenchange',()=>{
      if(native&&!document.fullscreenElement)changeStage(false);
      native=!!document.fullscreenElement;
    });
    window.addEventListener('pagehide',()=>changeStage(false));
    document.addEventListener('keydown',e=>{
      if(!immersive||document.querySelector('.rapli-zoom-overlay:not([hidden]),dialog[open]'))return;
      if(e.key==='Escape'){e.preventDefault();void toggle();return;}
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();const rail=strip();rail?.scrollBy({left:(e.key==='ArrowRight'?1:-1)*(rail.firstElementChild?.clientWidth||0)});
    });
    document.addEventListener('load',e=>{
      const img=e.target;
      if(img.matches?.('.museum-artwork img')&&img.naturalHeight)
        img.parentElement.style.setProperty('--art-ratio',img.naturalWidth/img.naturalHeight);
    },true);
  }
  window.RapliMuseum={init,style,refresh,transition,edit,stageAvailable};
})();
