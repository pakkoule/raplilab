/* LAB GFS · prototype 12 : comparaison de quatre heures de départ sur latitude témoin.
 * Franchissement 47°N uniquement, sur l'Atlantique nord-est, de f006/f012 jusqu'à f024/f030.
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
  const NEXT_DAY_DEPARTURES=Object.freeze([24,25,26,27]);
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
    if(first.cycle!==second.cycle||![6,12,18,24,30].includes(first.hour)||
       second.hour!==first.hour+6||
       GRID_KEYS.some(key=>first.g[key]!==second.g[key]))
      throw Error('Prévisions NOAA adjacentes incompatibles.');
    return {first,second};
  }

  function sailToGate(first,second,startHour,gateLatitude=GATE_LATITUDE){
    if(!(first.hour===6?DEPARTURES:first.hour===12?LATER_DEPARTURES:
         first.hour===18?EVENING_DEPARTURES:NEXT_DAY_DEPARTURES).includes(startHour)||
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

  // Test 16 — observe the *first* obstacle on each rejected departure.
  // This does not estimate boat speed outside the supplied partial polar.
  function diagnoseDeparture(first,second,startHour){
    const allowed=first.hour===6?DEPARTURES:first.hour===12?LATER_DEPARTURES:
      first.hour===18?EVENING_DEPARTURES:NEXT_DAY_DEPARTURES;
    if(!allowed.includes(startHour))
      throw Error('Départ non autorisé pour le diagnostic.');
    let position={...motion.START};
    let lastWind=null;
    for(let step=0;step<MAX_STEPS;step++){
      const hour=startHour+step*STEP_HOURS;
      let wind;
      try{
        wind=motion.windAt(first,second,hour,position.latitude,position.longitude);
      }catch(error){
        return {startHour,forecastHour:hour,type:'GFS_UNAVAILABLE',
          reason:String(error?.message||error).slice(0,130)};
      }
      const twas=motion.CANDIDATE_HEADINGS.map(heading=>
        Math.abs(((wind.from-heading+540)%360)-180)
      );
      const twaMin=Math.min(...twas),twaMax=Math.max(...twas);
      const base={
        startHour,forecastHour:hour,
        windKnots:round(wind.knots),windDirection:Math.round(wind.from),
        twaMin:round(twaMin),twaMax:round(twaMax),
        allowedTwaMin:Math.min(...motion.ANGLES),
        allowedTwaMax:Math.max(...motion.ANGLES),
        allowedWindMin:Math.min(...motion.TWS),
        allowedWindMax:Math.max(...motion.TWS)
      };
      lastWind=base;
      if(wind.knots<motion.TWS[0])
        return {...base,type:'WIND_TOO_LOW'};
      if(wind.knots>motion.TWS[motion.TWS.length-1])
        return {...base,type:'WIND_TOO_HIGH'};
      if(!twas.some(twa=>twa>=base.allowedTwaMin&&twa<=base.allowedTwaMax))
        return {...base,type:'ANGLE_OUTSIDE_POLAR'};
      let choice;
      try{choice=motion.selectSouthHeading(wind).selected;}
      catch(error){
        return {...base,type:'POLAR_NOT_AVAILABLE',reason:String(error?.message||error).slice(0,130)};
      }
      const next=motion.move(position,choice.heading,choice.boatKnots,STEP_HOURS);
      try{motion.windAt(first,second,hour+STEP_HOURS,next.latitude,next.longitude);}
      catch(error){
        return {...base,type:'GFS_UNAVAILABLE',reason:String(error?.message||error).slice(0,130)};
      }
      if(next.latitude<=GATE_LATITUDE)
        return {...base,type:'CROSSING_UNEXPECTED'};
      position=next;
    }
    return {
      ...lastWind,
      startHour,
      type:'GATE_NOT_REACHED',
      elapsedHours:HORIZON_HOURS,
      finalLatitude:round(position.latitude,5),
      distanceRemainingNm:round((position.latitude-GATE_LATITUDE)*60,1)
    };
  }

  function compareForPair(a,b,firstHour,allowEmpty=false){
    const {first,second}=compatibleFrames(a,b);
    if(first.hour!==firstHour)throw Error('Échéances météo non compatibles avec cette plage de départs.');
    const departures=firstHour===6?DEPARTURES:firstHour===12?LATER_DEPARTURES:
      firstHour===18?EVENING_DEPARTURES:NEXT_DAY_DEPARTURES;
    const windows=departures.map(startHour=>{
      try{return sailToGate(first,second,startHour);}
      catch(error){
        let diagnostic=null;
        try{diagnostic=diagnoseDeparture(first,second,startHour);}
        catch(_){/* Preserve the original failure, never invent a polar diagnosis. */}
        return {startHour,valid:false,
          reason:String(error?.message||error).slice(0,150),diagnostic};
      }
    });
    const valid=windows.filter(w=>w.valid);
    if(!valid.length&&!allowEmpty)throw Error('Aucun départ n’atteint la latitude témoin avec les polaires provisoires.');
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
      fastestStartHour:fastest?.startHour??null,
      fastestElapsedMinutes:fastest?.elapsedMinutes??null,
      earliestArrivalStartHour:earliest?.startHour??null,
      earliestArrivalUTC:earliest?.crossingUTC??null,
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
  function compareNextDayDepartureWindows(a,b){
    // All four can be out of temporary polars; still report zero and preserve previous comparisons.
    return compareForPair(a,b,24,true);
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
  function compareSixteenDepartureWindows(a,b,c,d,e){
    const firstTwelve=compareTwelveDepartureWindows(a,b,c,d);
    const nextDay=compareNextDayDepartureWindows(d,e);
    if(firstTwelve.cycleUTC!==nextDay.cycleUTC)
      throw Error('Cycles NOAA incompatibles entre les quatre fenêtres.');
    const windows=[...firstTwelve.windows,...nextDay.windows];
    const valid=windows.filter(x=>x.valid);
    if(!valid.length)throw Error('Aucun départ valide sur les seize créneaux.');
    const fastest=[...valid].sort((x,y)=>
      x.elapsedMinutes-y.elapsedMinutes||x.startHour-y.startHour)[0];
    const earliest=[...valid].sort((x,y)=>
      Date.parse(x.crossingUTC)-Date.parse(y.crossingUTC)||x.startHour-y.startHour)[0];
    return {
      cycleUTC:firstTwelve.cycleUTC,
      windows,validCount:valid.length,
      fastestStartHour:fastest.startHour,
      fastestElapsedMinutes:fastest.elapsedMinutes,
      earliestArrivalStartHour:earliest.startHour,
      earliestArrivalUTC:earliest.crossingUTC,
      fullPack:false,isEquatorForecast:false,
      method:'Quatre paires NOAA f006/f012, f012/f018, f018/f024, f024/f030 du même cycle'
    };
  }
  // Test 18 — continue exactly the four +24...+27 start times using two verified,
  // adjacent NOAA pairs. No extrapolation, route optimization or synthetic polar data.
  function compareExtendedNextDayDepartures(frame24,frame30,frame36){
    const pair1=compatibleFrames(frame24,frame30);
    const pair2=compatibleFrames(frame30,frame36);
    if(pair1.first.hour!==24||pair1.second.hour!==30||
       pair2.first.hour!==30||pair2.second.hour!==36||
       pair1.first.cycle!==pair2.first.cycle||
       GRID_KEYS.some(key=>pair1.first.g[key]!==pair2.first.g[key]))
      throw Error('Trois échéances NOAA +24/+30/+36 du même cycle sont nécessaires.');

    const windows=NEXT_DAY_DEPARTURES.map(startHour=>{
      let position={...motion.START};
      let priorHeading=null;
      let changes=0;
      const steps=[];
      let lastWind=null;
      for(let step=0;step<12;step++){
        const hour=startHour+step*STEP_HOURS;
        const pair=hour<30?pair1:pair2;
        let wind,selection,next;
        try{
          wind=motion.windAt(pair.first,pair.second,hour,position.latitude,position.longitude);
          const angles=motion.CANDIDATE_HEADINGS.map(heading=>
            Math.abs(((wind.from-heading+540)%360)-180));
          lastWind={
            windKnots:round(wind.knots),windDirection:Math.round(wind.from),
            twaMin:round(Math.min(...angles)),twaMax:round(Math.max(...angles))
          };
          selection=motion.selectSouthHeading(wind).selected;
          next=motion.move(position,selection.heading,selection.boatKnots,STEP_HOURS);
          motion.windAt(pair.first,pair.second,hour+STEP_HOURS,next.latitude,next.longitude);
        }catch(error){
          const failure=String(error?.message||error);
          const type=failure.includes('polaires')||failure.includes('cap autorisé')
            ?'POLAR_UNAVAILABLE':'GFS_UNAVAILABLE';
          return {
            startHour,valid:false,reason:failure.slice(0,160),
            failureType:type,failureForecastHour:hour,
            elapsedHours:round(step*STEP_HOURS),
            finalLatitude:round(position.latitude,5),
            distanceRemainingNm:round(Math.max(0,(position.latitude-GATE_LATITUDE)*60),1),
            lastWind,steps
          };
        }
        if(priorHeading!==null&&priorHeading!==selection.heading)changes++;
        priorHeading=selection.heading;
        steps.push({
          forecastHour:hour,heading:selection.heading,
          boatKnots:round(selection.boatKnots),windKnots:round(wind.knots),
          windDirection:Math.round(wind.from)
        });
        if(next.latitude<=GATE_LATITUDE&&position.latitude>GATE_LATITUDE){
          const fraction=(position.latitude-GATE_LATITUDE)/(position.latitude-next.latitude);
          if(!finite(fraction)||fraction<0||fraction>1)throw Error('Passage de porte incohérent.');
          const crossingHour=hour+STEP_HOURS*fraction;
          const elapsedMinutes=round((crossingHour-startHour)*60);
          return {
            startHour,valid:true,extended:true,
            departureUTC:new Date(pair1.first.cycle+startHour*3600000).toISOString(),
            crossingUTC:new Date(pair1.first.cycle+crossingHour*3600000).toISOString(),
            crossingForecastHour:round(crossingHour,3),
            elapsedMinutes,changes,steps,
            latitude:GATE_LATITUDE,
            interpolatedCrossing:true
          };
        }
        position=next;
      }
      return {
        startHour,valid:false,
        failureType:'GATE_NOT_REACHED',
        reason:'Latitude 47°N non atteinte dans les 6 heures de simulation.',
        elapsedHours:6,
        finalLatitude:round(position.latitude,5),
        distanceRemainingNm:round(Math.max(0,(position.latitude-GATE_LATITUDE)*60),1),
        lastWind,steps
      };
    });
    const valid=windows.filter(w=>w.valid);
    const fastest=[...valid].sort((x,y)=>
      x.elapsedMinutes-y.elapsedMinutes||x.startHour-y.startHour)[0];
    return {
      cycleUTC:frame24.cycleUTC,windows,validCount:valid.length,
      fastestStartHour:fastest?.startHour??null,
      fastestElapsedMinutes:fastest?.elapsedMinutes??null,
      horizonHours:6,gateLatitude:GATE_LATITUDE,
      fullPack:false,isEquatorForecast:false,
      method:'Même pilote VMG sud; GFS +24/+30/+36 du même cycle, pas 30 minutes, horizon 6 heures'
    };
  }
  return {
    DEPARTURES,LATER_DEPARTURES,EVENING_DEPARTURES,NEXT_DAY_DEPARTURES,GATE_LATITUDE,HORIZON_HOURS,STEP_HOURS,
    compatibleFrames,sailToGate,compareDepartureWindows,compareLaterDepartureWindows,
    compareAllDepartureWindows,compareEveningDepartureWindows,compareTwelveDepartureWindows,
    compareNextDayDepartureWindows,compareSixteenDepartureWindows,diagnoseDeparture,compareExtendedNextDayDepartures
  };
});
