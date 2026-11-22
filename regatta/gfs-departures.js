/* LAB GFS · prototype 12 : comparaison de quatre heures de départ sur latitude témoin.
 * Franchissement 47°N uniquement, sur l'Atlantique nord-est : f006/f012, f012/f018 et f018/f024.
 * Ces calculs ne prédisent ni l'équateur ni le cap de Bonne-Espérance.
 */
(function(root,factory){
  'use strict';
  const motion=typeof module==='object'&&module.exports
    ?require('./gfs-motion.js'):root?.RapliGfsMotion;
  const api=factory(motion);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RapliGfsDepartures=api;
})(typeof window!=='undefined'?window:null,function(motion){
  'use strict';
  const DEPARTURES=Object.freeze([6,7,8,9]);
  const LATER_DEPARTURES=Object.freeze([12,13,14,15]);
  const EVENING_DEPARTURES=Object.freeze([18,19,20,21]);
  const GATE_LATITUDE=47;
  const HORIZON_HOURS=3;
  const STEP_HOURS=.5;
  const MAX_STEPS=HORIZON_HOURS/STEP_HOURS;
  const round=(n,p=1)=>Math.round(n*10**p)/10**p;
  const finite=Number.isFinite;
  const GRID_KEYS=[
    'ni','nj','latitudeOfFirstGridPoint','longitudeOfFirstGridPoint',
    'iDirectionIncrement','jDirectionIncrement','iScansNegatively',
    'jScansPositively','jPointsAreConsecutive','alternativeRowScanning'
  ];

  function compatibleFrames(a,b){
    if(!motion?.loadFrame||!motion?.windAt||!motion?.selectSouthHeading||!motion?.move)
      throw Error('Moteur météo/nav indisponible.');
    const first=motion.loadFrame(a),second=motion.loadFrame(b);
    if(first.cycle!==second.cycle||![6,12,18].includes(first.hour)||
       second.hour!==first.hour+6||
       GRID_KEYS.some(key=>first.g[key]!==second.g[key]))
      throw Error('Prévisions NOAA adjacentes incompatibles.');
    return {first,second};
  }

  function sailToGate(first,second,startHour,gateLatitude=GATE_LATITUDE){
    if(!(first.hour===6?DEPARTURES:first.hour===12?LATER_DEPARTURES:EVENING_DEPARTURES).includes(startHour)||
       !finite(gateLatitude)||gateLatitude>=motion.START.latitude||
       gateLatitude<=40)
      throw Error('Départ ou latitude témoin non autorisé.');
    const cycle=first.cycle;
    let position={...motion.START};
    let priorHeading=null;
    let changes=0;
    const steps=[];
    for(let step=0;step<MAX_STEPS;step++){
      const hour=startHour+step*STEP_HOURS;
      const wind=motion.windAt(first,second,hour,position.latitude,position.longitude);
      const selection=motion.selectSouthHeading(wind).selected;
      if(priorHeading!==null&&priorHeading!==selection.heading)changes++;
      priorHeading=selection.heading;
      const next=motion.move(position,selection.heading,selection.boatKnots,STEP_HOURS);
      // Stop before any fabricated interpolation outside the available downloaded grid.
      motion.windAt(first,second,hour+STEP_HOURS,next.latitude,next.longitude);
      steps.push({
        hour,heading:selection.heading,latitude:round(position.latitude,5),
        longitude:round(position.longitude,5),
        windKnots:round(wind.knots),boatKnots:round(selection.boatKnots)
      });
      if(next.latitude<=gateLatitude&&position.latitude>gateLatitude){
        const fraction=(position.latitude-gateLatitude)/(position.latitude-next.latitude);
        if(!finite(fraction)||fraction<0||fraction>1)
          throw Error('Franchissement de latitude incohérent.');
        const crossingHour=hour+STEP_HOURS*fraction;
        const elapsedMinutes=(crossingHour-startHour)*60;
        if(!finite(elapsedMinutes)||elapsedMinutes<=0)
          throw Error('Durée de navigation incohérente.');
        return {
          startHour,departureUTC:new Date(cycle+startHour*3600000).toISOString(),
          crossingUTC:new Date(cycle+crossingHour*3600000).toISOString(),
          crossingForecastHour:round(crossingHour,3),
          elapsedMinutes:round(elapsedMinutes,1),
          latitude:gateLatitude,changes,steps,
          valid:true,interpolatedCrossing:true
        };
      }
      position=next;
    }
    throw Error('Latitude témoin non franchie dans la fenêtre de 3 heures.');
  }

  function compareForPair(a,b,firstHour){
    const {first,second}=compatibleFrames(a,b);
    if(first.hour!==firstHour)throw Error('Échéances météo non compatibles avec cette plage de départs.');
    const departures=firstHour===6?DEPARTURES:firstHour===12?LATER_DEPARTURES:EVENING_DEPARTURES;
    const windows=departures.map(startHour=>{
      try{return sailToGate(first,second,startHour);}
      catch(error){
        return {startHour,valid:false,reason:String(error?.message||error).slice(0,150)};
      }
    });
    const valid=windows.filter(w=>w.valid);
    if(!valid.length)throw Error('Aucun départ n’atteint la latitude témoin avec les polaires provisoires.');
    const fastest=[...valid].sort((a,b)=>
      a.elapsedMinutes-b.elapsedMinutes||a.startHour-b.startHour
    )[0];
    const earliest=[...valid].sort((a,b)=>
      Date.parse(a.crossingUTC)-Date.parse(b.crossingUTC)||a.startHour-b.startHour
    )[0];
    return {
      cycleUTC:a.cycleUTC,
      sourceStartHour:firstHour,sourceEndHour:firstHour+6,
      gateLatitude:GATE_LATITUDE,
      horizonHours:HORIZON_HOURS,
      windows,validCount:valid.length,
      fastestStartHour:fastest.startHour,
      fastestElapsedMinutes:fastest.elapsedMinutes,
      earliestArrivalStartHour:earliest.startHour,
      earliestArrivalUTC:earliest.crossingUTC,
      objective:'Durée minimale de passage de 47°N sur quatre départs simulés',
      experimental:true,fullPack:false,isEquatorForecast:false,
      method:'Pilote VMG sud + GFS 0,25°, bilinéaire et interpolation temporelle; pas 30 min'
    };
  }
  function compareDepartureWindows(a,b){
    return compareForPair(a,b,6);
  }
  function compareLaterDepartureWindows(a,b){
    return compareForPair(a,b,12);
  }
  function compareEveningDepartureWindows(a,b){
    return compareForPair(a,b,18);
  }
  function compareAllDepartureWindows(a,b,c){
    const early=compareDepartureWindows(a,b);
    const late=compareLaterDepartureWindows(b,c);
    if(early.cycleUTC!==late.cycleUTC)
      throw Error('Cycles NOAA incompatibles entre les deux fenêtres.');
    const windows=[...early.windows,...late.windows];
    const valid=windows.filter(x=>x.valid);
    if(!valid.length)throw Error('Aucun départ valide sur les huit heures proposées.');
    const fastest=[...valid].sort((x,y)=>
      x.elapsedMinutes-y.elapsedMinutes||x.startHour-y.startHour)[0];
    const earliest=[...valid].sort((x,y)=>
      Date.parse(x.crossingUTC)-Date.parse(y.crossingUTC)||x.startHour-y.startHour)[0];
    return {
      cycleUTC:early.cycleUTC,
      windows,validCount:valid.length,
      fastestStartHour:fastest.startHour,
      fastestElapsedMinutes:fastest.elapsedMinutes,
      earliestArrivalStartHour:earliest.startHour,
      earliestArrivalUTC:earliest.crossingUTC,
      fullPack:false,isEquatorForecast:false,
      method:'Comparaison de deux paires NOAA f006/f012 et f012/f018, toutes du même cycle'
    };
  }
  function compareTwelveDepartureWindows(a,b,c,d){
    const early=compareAllDepartureWindows(a,b,c);
    const evening=compareEveningDepartureWindows(c,d);
    if(early.cycleUTC!==evening.cycleUTC)
      throw Error('Cycles NOAA incompatibles entre les trois fenêtres.');
    const windows=[...early.windows,...evening.windows];
    const valid=windows.filter(x=>x.valid);
    if(!valid.length)throw Error('Aucun départ valide sur les douze heures proposées.');
    const fastest=[...valid].sort((x,y)=>
      x.elapsedMinutes-y.elapsedMinutes||x.startHour-y.startHour)[0];
    const earliest=[...valid].sort((x,y)=>
      Date.parse(x.crossingUTC)-Date.parse(y.crossingUTC)||x.startHour-y.startHour)[0];
    return {
      cycleUTC:early.cycleUTC,
      windows,validCount:valid.length,
      fastestStartHour:fastest.startHour,
      fastestElapsedMinutes:fastest.elapsedMinutes,
      earliestArrivalStartHour:earliest.startHour,
      earliestArrivalUTC:earliest.crossingUTC,
      fullPack:false,isEquatorForecast:false,
      method:'Trois paires adjacentes GFS f006/f012, f012/f018 et f018/f024 d’un même cycle'
    };
  }
  return {
    DEPARTURES,LATER_DEPARTURES,EVENING_DEPARTURES,GATE_LATITUDE,HORIZON_HOURS,STEP_HOURS,
    compatibleFrames,sailToGate,compareDepartureWindows,compareLaterDepartureWindows,
    compareAllDepartureWindows,compareEveningDepartureWindows,compareTwelveDepartureWindows
  };
});
