/* GFS source lab : validation sur demande, aucun routage ou calcul de vent fictif. */
(()=>{
  'use strict';
  const root=document.getElementById('regatta-gfs-lab');
  if(!root)return;
  const run=root.querySelector('[data-gfs-lab-run]');
  const status=root.querySelector('[data-gfs-lab-status]');
  const results=root.querySelector('[data-gfs-lab-results]');
  const cell=(name,value)=>{
    const el=root.querySelector('[data-gfs-lab-'+name+']');
    if(el)el.textContent=value;
  };
  const frenchTime=value=>{
    const dt=new Date(value);
    return Number.isNaN(dt.getTime())?'—':
      new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(dt);
  };
  run.addEventListener('click',async()=>{
    run.disabled=true;
    status.dataset.state='loading';
    status.textContent='Vérification du fichier NOAA en cours…';
    results.hidden=true;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/.netlify/functions/gfs-probe',{signal:controller.signal,cache:'no-store'});
      let body;
      try{body=await response.json();}catch(_){throw Error('Réponse serveur non lisible.');}
      if(!response.ok||!body.ok)throw Error(body.error||('Erreur HTTP '+response.status));
      if(!Array.isArray(body.variables)||!body.variables.includes('UGRD')||!body.variables.includes('VGRD')){
        throw Error('Les deux champs du vent ne sont pas confirmés.');
      }
      cell('cycle',frenchTime(body.cycleUTC));
      cell('forecast',frenchTime(body.validUTC));
      cell('grid',String(body.bounds?.top)+'°N à '+String(body.bounds?.bottom)+'°N');
      cell('size',(body.fileBytes/1024).toFixed(1)+' Ko');
      cell('fields',body.variables.join(' + '));
      cell('messages',String(body.messages)+' message(s)');
      results.hidden=false;
      status.dataset.state='success';
      status.textContent='Fichier GRIB2 GFS 0,25° vérifié · UGRD/VGRD reconnus. '+(body.cached?'Résultat mis en cache.':'');
    }catch(error){
      status.dataset.state='error';
      status.textContent='Test non validé : '+String(error.message||error)+'. Aucune donnée météo simulée.';
    }finally{
      clearTimeout(timer);
      run.disabled=false;
    }
  });

  const windRun=root.querySelector('[data-gfs-wind-run]');
  const windHour=root.querySelector('[data-gfs-wind-hour]');
  const windStatus=root.querySelector('[data-gfs-wind-status]');
  const windPoints=root.querySelector('[data-gfs-wind-points]');
  const windMeta=root.querySelector('[data-gfs-wind-meta]');
  const spatialStatus=root.querySelector('[data-gfs-spatial-status]');
  const spatialValues=root.querySelector('[data-gfs-spatial-values]');
  const showSpatial=data=>{
    spatialValues.hidden=true;
    if(!data?.spatial||data.spatial.verifiedWind!==true||
       data.spatial.spatiallyInterpolated!==true||
       !Number.isFinite(data.spatial.speedKnots)||
       !Number.isFinite(data.spatial.directionFromDeg)||
       !Number.isFinite(data.spatial.uMs)||!Number.isFinite(data.spatial.vMs)){
      spatialStatus.dataset.state='error';
      spatialStatus.textContent='Interpolation spatiale non confirmée'+
        (data?.spatialError?' : '+String(data.spatialError).slice(0,120):'.');
      return;
    }
    const wind=data.spatial;
    const assign=(selector,value)=>{
      const node=root.querySelector(selector);
      if(node)node.textContent=value;
    };
    assign('[data-gfs-spatial-speed]',wind.speedKnots.toFixed(1)+' nds');
    assign('[data-gfs-spatial-direction]',wind.directionFromDeg.toFixed(0)+'°');
    assign('[data-gfs-spatial-components]',wind.uMs.toFixed(2)+' / '+wind.vMs.toFixed(2)+' m/s');
    spatialValues.hidden=false;
    spatialStatus.dataset.state='success';
    spatialStatus.textContent='Vent bilinéaire calculé à partir de quatre coins GFS 0,25° · '+
      frenchTime(data.validUTC)+' (Paris).';
  };
  const windText=(name,value)=>{
    const node=root.querySelector('[data-gfs-'+name+']');
    if(node)node.textContent=value;
  };
  const verifiedFrames=new Map();
  const interpolationEngine=window.RapliGfsInterpolation;
  const headingStatus=root.querySelector('[data-gfs-heading-status]');
  const headingSummary=root.querySelector('[data-gfs-heading-summary]');
  const headingResults=root.querySelector('[data-gfs-heading-results]');
  const renderHeadings=()=>{
    headingResults.replaceChildren();
    headingSummary.hidden=true;
    headingResults.hidden=true;
    if(!verifiedFrames.has(6)||!verifiedFrames.has(12)){
      headingStatus.dataset.state='idle';
      headingStatus.textContent='Lis +6 h et +12 h du même cycle pour comparer les cinq caps fixes.';
      return;
    }
    const engine=window.RapliGfsMotion;
    if(!engine?.compareFixedHeadings){
      headingStatus.dataset.state='error';
      headingStatus.textContent='Comparateur de caps indisponible.';
      return;
    }
    try{
      const comparison=engine.compareFixedHeadings(verifiedFrames.get(6),verifiedFrames.get(12));
      headingSummary.querySelector('[data-gfs-heading-best]').textContent=
        'Meilleur cap calculable : '+comparison.best.heading+'° · '+
        comparison.best.southProgressNm.toFixed(1)+' milles vers le sud';
      for(const candidate of comparison.evaluated){
        const item=document.createElement('div');
        item.className='gfs-heading-option';
        if(candidate.valid&&candidate.heading===comparison.best.heading)item.dataset.best='true';
        const cap=document.createElement('strong');
        cap.textContent='Cap '+candidate.heading+'°';
        const detail=document.createElement('span');
        detail.textContent=candidate.valid
          ? candidate.southProgressNm.toFixed(1)+' M sud · '+candidate.distanceNm.toFixed(1)+' M parcourus'
          : 'Non calculable : '+candidate.reason;
        item.append(cap,detail);
        headingResults.appendChild(item);
      }
      headingSummary.hidden=false;
      headingResults.hidden=false;
      headingStatus.dataset.state='success';
      headingStatus.textContent=comparison.validCount+' cap(s) sur 5 calculable(s) sur 3 h · polaires non Full Pack.';
    }catch(error){
      headingStatus.dataset.state='error';
      headingStatus.textContent='Comparaison indisponible : '+String(error.message||error)+'. Aucun classement inventé.';
    }
  };
  const motionStatus=root.querySelector('[data-gfs-motion-status]');
  const motionSummary=root.querySelector('[data-gfs-motion-summary]');
  const motionSteps=root.querySelector('[data-gfs-motion-steps]');
  const motionEngine=window.RapliGfsMotion;
  const renderMotion=()=>{
    motionSteps.replaceChildren();
    motionSummary.hidden=true;
    motionSteps.hidden=true;
    if(!verifiedFrames.has(6)||!verifiedFrames.has(12)){
      motionStatus.dataset.state='idle';
      motionStatus.textContent='Lis +6 h puis +12 h du même cycle GFS pour simuler le déplacement à cap fixe.';
      return;
    }
    if(!motionEngine?.simulateMotion){
      motionStatus.dataset.state='error';
      motionStatus.textContent='Moteur de déplacement expérimental indisponible.';
      return;
    }
    try{
      const result=motionEngine.simulateMotion(
        verifiedFrames.get(6),verifiedFrames.get(12)
      );
      const last=result.steps[result.steps.length-1];
      root.querySelector('[data-gfs-motion-distance]').textContent=result.distanceNm.toFixed(1)+' milles';
      root.querySelector('[data-gfs-motion-final]').textContent=
        last.latitude.toFixed(3)+'°N · '+Math.abs(last.longitude).toFixed(3)+'°O';
      // Un pas de 30 min ; affichage compact à chaque heure entière.
      for(const point of result.steps.filter(step=>Number.isInteger(step.hour))){
        const row=document.createElement('div');
        row.className='gfs-motion-step';
        const heading=document.createElement('strong');
        heading.textContent='+'+point.hour+' h';
        const location=document.createElement('span');
        location.textContent=point.latitude.toFixed(3)+'°N · '+
          Math.abs(point.longitude).toFixed(3)+'°O';
        const speed=document.createElement('b');
        speed.textContent=point.boatKnots.toFixed(1)+' nds bateau';
        const wind=document.createElement('small');
        wind.textContent='Vent '+point.windKnots.toFixed(1)+' nds · '+point.windDirection.toFixed(0)+'°'+
          ' · TWA '+point.twa.toFixed(0)+'°';
        row.append(heading,location,speed,wind);
        motionSteps.appendChild(row);
      }
      motionSummary.hidden=false;
      motionSteps.hidden=false;
      motionStatus.dataset.state='success';
      motionStatus.textContent='Première trajectoire calculée · '+result.distanceNm.toFixed(1)+
        ' milles en 3 h · modèle provisoire non Full Pack.';
    }catch(error){
      motionStatus.dataset.state='error';
      motionStatus.textContent='Déplacement non calculable : '+String(error.message||error)+
        ' Aucune distance fictive affichée.';
    }
  };
  const trackStatus=root.querySelector('[data-gfs-demo-track-status]');
  const trackResults=root.querySelector('[data-gfs-demo-track-results]');
  const renderDemoTrack=()=>{
    trackResults.replaceChildren();
    if(!interpolationEngine?.interpolateDemonstrationTrack||
       !verifiedFrames.has(6)||!verifiedFrames.has(12)){
      trackResults.hidden=true;
      trackStatus.dataset.state='idle';
      trackStatus.textContent='Lis +6 h et +12 h du même cycle pour calculer le vent aux trois positions témoins.';
      return;
    }
    try{
      const track=interpolationEngine.interpolateDemonstrationTrack(
        verifiedFrames.get(6),verifiedFrames.get(12)
      );
      for(const step of track){
        const card=document.createElement('div');
        card.className='gfs-demo-track-step';
        const heading=document.createElement('strong');
        heading.textContent=step.label+' · +'+step.forecastHour+' h · '+frenchTime(step.validUTC);
        const location=document.createElement('small');
        const longitude=Math.abs(step.longitude).toFixed(3);
        location.textContent=step.latitude.toFixed(3)+'°N · '+longitude+'°O';
        const wind=document.createElement('b');
        wind.textContent=step.speedKnots.toFixed(1)+' nds · '+step.directionFromDeg.toFixed(0)+'°';
        card.append(heading,location,wind);
        trackResults.appendChild(card);
      }
      trackResults.hidden=false;
      trackStatus.dataset.state='success';
      trackStatus.textContent='3 positions et heures témoins calculées à partir des vrais vecteurs GFS du même cycle.';
    }catch(error){
      trackResults.hidden=true;
      trackStatus.dataset.state='error';
      trackStatus.textContent='Parcours météo témoin indisponible : '+String(error.message||error);
    }
  };
  const spaceTimeStatus=root.querySelector('[data-gfs-spatiotemporal-status]');
  const spaceTimeResults=root.querySelector('[data-gfs-spatiotemporal-results]');
  const renderSpaceTime=()=>{
    spaceTimeResults.replaceChildren();
    const pairs=[[6,12,9],[12,18,15]];
    const completed=[];
    let failure='';
    if(interpolationEngine?.interpolateSpatialFrames){
      for(const [from,to,middle] of pairs){
        if(!verifiedFrames.has(from)||!verifiedFrames.has(to))continue;
        try{
          completed.push(interpolationEngine.interpolateSpatialFrames(
            verifiedFrames.get(from),verifiedFrames.get(to),middle
          ));
        }catch(error){
          failure=String(error.message||error);
        }
      }
    }
    for(const wind of completed){
      const card=document.createElement('div');
      card.className='gfs-space-time-result';
      const heading=document.createElement('strong');
      heading.textContent='+'+wind.forecastHour+' h · '+frenchTime(wind.validUTC)+' · INTERPOLÉ 2D + TEMPS';
      const detail=document.createElement('span');
      detail.textContent=wind.speedKnots.toFixed(1)+' nds · '+wind.directionFromDeg.toFixed(0)+'°';
      const uv=document.createElement('small');
      uv.textContent='U/V : '+wind.uMs.toFixed(2)+' / '+wind.vMs.toFixed(2)+' m/s';
      card.append(heading,detail,uv);
      spaceTimeResults.appendChild(card);
    }
    spaceTimeResults.hidden=completed.length===0;
    const count=[...verifiedFrames.keys()].sort((a,b)=>a-b);
    if(completed.length){
      spaceTimeStatus.dataset.state='success';
      spaceTimeStatus.textContent='Vent interpolé dans l’espace ET dans le temps, à partir de '+(completed.length+1)+
        ' échéances GFS vérifiées.'+(failure?' Un autre intervalle est indisponible.':'');
    }else if(failure){
      spaceTimeStatus.dataset.state='error';
      spaceTimeStatus.textContent='Calcul spatio-temporel indisponible : '+failure;
    }else{
      spaceTimeStatus.dataset.state='idle';
      spaceTimeStatus.textContent=count.length?
        'Échéance(s) disponible(s) : '+count.map(h=>'+'+h+' h').join(', ')+
        '. Il faut deux échéances voisines du même cycle avec lecture spatiale validée.':
        'Lis +6 h et +12 h (ou +12 h et +18 h) sur le même cycle pour calculer le vent spatio-temporel.';
    }
  };
  const interpolationStatus=root.querySelector('[data-gfs-interpolation-status]');
  const interpolationResults=root.querySelector('[data-gfs-interpolation-results]');
  const renderInterpolations=()=>{
    interpolationResults.replaceChildren();
    const interpolated=[];
    if(interpolationEngine){
      for(const [from,to,middle] of [[6,12,9],[12,18,15]]){
        if(!verifiedFrames.has(from)||!verifiedFrames.has(to))continue;
        try{
          interpolated.push(interpolationEngine.interpolateFrames(
            verifiedFrames.get(from),verifiedFrames.get(to),middle
          ));
        }catch(error){
          interpolationStatus.textContent='Interpolation non disponible : '+String(error.message||error);
          interpolationResults.hidden=true;
          return;
        }
      }
    }
    if(!interpolated.length){
      interpolationResults.hidden=true;
      const loaded=[...verifiedFrames.keys()].sort((a,b)=>a-b);
      interpolationStatus.textContent=loaded.length
        ? 'Échéances réellement lues : '+loaded.map(n=>'+'+n+' h').join(', ')+
          '. Lis deux échéances voisines du même cycle (+6 et +12, ou +12 et +18).'
        : 'Lis +6 h puis +12 h sur le même cycle GFS pour calculer les vents intermédiaires à +9 h.';
      return;
    }
    for(const frame of interpolated){
      const container=document.createElement('div');
      container.className='gfs-temporal-frame';
      const header=document.createElement('strong');
      header.textContent='+'+frame.forecastHour+' h · '+frenchTime(frame.validUTC)+' · INTERPOLÉ';
      container.appendChild(header);
      for(const point of frame.points){
        const row=document.createElement('div');
        row.className='gfs-temporal-point';
        const name=document.createElement('span');
        name.textContent=point.site.label;
        const value=document.createElement('strong');
        value.textContent=point.speedKnots.toFixed(1)+' nds · '+point.directionFromDeg.toFixed(0)+'°';
        row.append(name,value);
        container.appendChild(row);
      }
      interpolationResults.appendChild(container);
    }
    interpolationResults.hidden=false;
    interpolationStatus.textContent='Calcul à partir de deux échéances NOAA réellement décodées · '+interpolated.length+
      ' horaire(s) intermédiaire(s) disponible(s).';
  };
  windHour.addEventListener('change',()=>{
    windPoints.hidden=true;
    windMeta.hidden=true;
    spatialValues.hidden=true;
    spatialStatus.dataset.state='idle';
    spatialStatus.textContent='Lis cette échéance pour calculer le vent intermédiaire.';
    windStatus.dataset.state='idle';
    windStatus.textContent='Échéance +'+windHour.value+' h sélectionnée · lance une nouvelle lecture.';
  });
  windRun.addEventListener('click',async()=>{
    const hour=windHour.value;
    if(!['6','12','18'].includes(hour))return;
    windRun.disabled=true;
    windHour.disabled=true;
    windPoints.hidden=true;
    windMeta.hidden=true;
    spatialValues.hidden=true;
    spatialStatus.dataset.state='loading';
    spatialStatus.textContent='Calcul bilinéaire en cours…';
    windStatus.dataset.state='loading';
    windStatus.textContent='Lecture GFS +'+hour+' h, trois points atlantiques…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch('/.netlify/functions/gfs-wind?forecastHour='+hour,{
        signal:controller.signal,cache:'no-store'
      });
      let result;
      try{result=await response.json();}catch(_){throw Error('Réponse météo non lisible.');}
      if(!response.ok||!result.ok)throw Error(result.error||('Lecture NOAA non confirmée (HTTP '+response.status+')'));
      if(result.forecastHour!==Number(hour)||!Array.isArray(result.points)||result.points.length!==3)
        throw Error('Réponse météo incomplète ou échéance incorrecte.');
      for(let i=0;i<result.points.length;i++){
        const wind=result.points[i];
        if(wind.verifiedWind!==true||!Number.isFinite(wind.speedKnots)||
           !Number.isFinite(wind.directionFromDeg)||
           !Number.isFinite(wind.uMs)||!Number.isFinite(wind.vMs)){
          throw Error('Lecture GFS invalide au point '+(i+1)+'.');
        }
        windText('point-'+i+'-speed',wind.speedKnots.toFixed(1)+' nds');
        windText('point-'+i+'-dir',wind.directionFromDeg.toFixed(0)+'°');
      }
      windText('wind-cycle',frenchTime(result.cycleUTC));
      windText('wind-valid',frenchTime(result.validUTC));
      windPoints.hidden=false;
      windMeta.hidden=false;
      showSpatial(result);
      // Une interpolation ne peut jamais utiliser des trames de deux cycles différents.
      for(const prior of verifiedFrames.values()){
        if(prior.cycleUTC!==result.cycleUTC){
          verifiedFrames.clear();
          break;
        }
      }
      verifiedFrames.set(result.forecastHour,result);
      renderInterpolations();
      renderSpaceTime();
      renderDemoTrack();
      renderMotion();
      renderHeadings();
      windStatus.dataset.state='success';
      windStatus.textContent='3 vents réels décodés sur le même cycle NOAA · '+
        (result.cached?'résultat en cache.':'lecture validée.');
    }catch(error){
      spatialStatus.dataset.state='error';
      spatialStatus.textContent='Interpolation spatiale indisponible (échéance non vérifiée).';
      windStatus.dataset.state='error';
      windStatus.textContent='Lecture indisponible : '+String(error.message||error)+
        ' Aucune vitesse fictive affichée.';
    }finally{
      clearTimeout(timer);
      windRun.disabled=false;
      windHour.disabled=false;
    }
  });
})();
