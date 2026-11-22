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
  const windText=(name,value)=>{
    const node=root.querySelector('[data-gfs-'+name+']');
    if(node)node.textContent=value;
  };
  const verifiedFrames=new Map();
  const interpolationEngine=window.RapliGfsInterpolation;
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
      // Une interpolation ne peut jamais utiliser des trames de deux cycles différents.
      for(const prior of verifiedFrames.values()){
        if(prior.cycleUTC!==result.cycleUTC){
          verifiedFrames.clear();
          break;
        }
      }
      verifiedFrames.set(result.forecastHour,result);
      renderInterpolations();
      windStatus.dataset.state='success';
      windStatus.textContent='3 vents réels décodés sur le même cycle NOAA · '+
        (result.cached?'résultat en cache.':'lecture validée.');
    }catch(error){
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
