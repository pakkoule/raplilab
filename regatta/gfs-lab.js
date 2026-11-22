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
  const windStatus=root.querySelector('[data-gfs-wind-status]');
  const windValues=root.querySelector('[data-gfs-wind-values]');
  const windText=(name,value)=>{
    const cell=root.querySelector('[data-gfs-wind-'+name+']');
    if(cell)cell.textContent=value;
  };
  windRun.addEventListener('click',async()=>{
    windRun.disabled=true;
    windValues.hidden=true;
    windStatus.dataset.state='loading';
    windStatus.textContent='Décodage du GRIB2 NOAA et lecture du vent en cours…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch('/.netlify/functions/gfs-wind',{
        signal:controller.signal,cache:'no-store'
      });
      let result;
      try{result=await response.json();}catch(_){throw Error('Réponse météo non lisible.');}
      if(!response.ok||!result.ok||result.wind?.verifiedWind!==true){
        throw Error(result.error||('Lecture NOAA non confirmée (HTTP '+response.status+')'));
      }
      const wind=result.wind;
      if(!Number.isFinite(wind.speedKnots)||!Number.isFinite(wind.directionFromDeg)||
         !Number.isFinite(wind.uMs)||!Number.isFinite(wind.vMs))throw Error('Valeurs décodées invalides.');
      windText('speed',wind.speedKnots.toFixed(1)+' nds');
      windText('direction',wind.directionFromDeg.toFixed(0)+'°');
      windText('components',wind.uMs.toFixed(2)+' / '+wind.vMs.toFixed(2)+' m/s');
      windText('valid',frenchTime(result.validUTC));
      windValues.hidden=false;
      windStatus.dataset.state='success';
      windStatus.textContent='Vent NOAA décodé et validé · '+(result.cached?'lecture en cache · ':'')+
        'point de grille à '+wind.nearestGridpoint.distanceKm.toFixed(1)+' km.';
    }catch(error){
      windStatus.dataset.state='error';
      windStatus.textContent='Aucune mesure confirmée : '+String(error.message||error);
    }finally{
      clearTimeout(timer);
      windRun.disabled=false;
    }
  });
})();