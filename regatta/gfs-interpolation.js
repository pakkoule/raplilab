/* GFS weather-only interpolation: never mix GFS cycles or invent missing frames. */
(function(root,factory){
  'use strict';
  const engine=factory();
  if(typeof module==='object'&&module.exports)module.exports=engine;
  if(root)root.RapliGfsInterpolation=engine;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const KNOTS=1.9438444924406;
  const round=(value,digits)=>Math.round(value*10**digits)/10**digits;
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const hours=[6,12,18];
  function validateFrame(frame){
    if(!frame||frame.ok!==true||!hours.includes(frame.forecastHour)||
       typeof frame.cycleUTC!=='string'||typeof frame.validUTC!=='string'||
       !Array.isArray(frame.points)||frame.points.length!==3)throw Error('Trame GFS incomplète.');
    const cycle=Date.parse(frame.cycleUTC);
    if(!Number.isFinite(cycle)||new Date(cycle).toISOString()!==frame.cycleUTC||
       !Number.isFinite(Date.parse(frame.validUTC))||
       Date.parse(frame.validUTC)!==cycle+frame.forecastHour*3600000)
       throw Error('Horodatages GFS incohérents.');
    for(const p of frame.points){
      if(p?.verifiedWind!==true||!p.site||!finite(p.site.latitude)||
         !finite(p.site.longitude)||!finite(p.uMs)||!finite(p.vMs)||
         Math.abs(p.uMs)>100||Math.abs(p.vMs)>100)
        throw Error('Composantes U/V GFS non vérifiées.');
    }
    return cycle;
  }
  function interpolateFrames(a,b,targetHour){
    const cycleA=validateFrame(a),cycleB=validateFrame(b);
    if(cycleA!==cycleB)throw Error('Impossible de mélanger deux cycles GFS.');
    if(b.forecastHour-a.forecastHour!==6||targetHour!==(a.forecastHour+b.forecastHour)/2)
      throw Error('Interpolation réservée aux échéances GFS adjacentes.');
    const ratio=(targetHour-a.forecastHour)/(b.forecastHour-a.forecastHour);
    const points=a.points.map((left,index)=>{
      const right=b.points[index];
      if(Math.abs(left.site.latitude-right.site.latitude)>1e-7||
         Math.abs(left.site.longitude-right.site.longitude)>1e-7)
         throw Error('Points géographiques différents entre les échéances.');
      const u=left.uMs+(right.uMs-left.uMs)*ratio;
      const v=left.vMs+(right.vMs-left.vMs)*ratio;
      const speed=Math.hypot(u,v);
      const direction=(Math.atan2(-u,-v)*180/Math.PI+360)%360;
      return {
        site:{...left.site},
        uMs:round(u,3),vMs:round(v,3),
        speedKnots:round(speed*KNOTS,1),
        directionFromDeg:round(direction,1),
        interpolated:true
      };
    });
    return {
      cycleUTC:a.cycleUTC,forecastHour:targetHour,
      validUTC:new Date(cycleA+targetHour*3600000).toISOString(),
      points,interpolated:true,
      method:'Interpolation temporelle linéaire U/V entre deux échéances GFS NOAA vérifiées'
    };
  }
  function interpolateSpatialFrames(a,b,targetHour){
    const cycleA=validateFrame(a),cycleB=validateFrame(b);
    if(cycleA!==cycleB)throw Error('Impossible de mélanger deux cycles GFS.');
    if(b.forecastHour-a.forecastHour!==6||
       !finite(targetHour)||targetHour<=a.forecastHour||targetHour>=b.forecastHour)
      throw Error('Interpolation spatio-temporelle hors intervalle GFS vérifié.');
    const left=a.spatial,right=b.spatial;
    if(!left||!right||left.verifiedWind!==true||right.verifiedWind!==true||
       left.spatiallyInterpolated!==true||right.spatiallyInterpolated!==true||
       left.gridResolutionDegrees!==0.25||right.gridResolutionDegrees!==0.25||
       !left.site||!right.site||
       !finite(left.site.latitude)||!finite(left.site.longitude)||
       !finite(right.site.latitude)||!finite(right.site.longitude)||
       Math.abs(left.site.latitude-right.site.latitude)>1e-7||
       Math.abs(left.site.longitude-right.site.longitude)>1e-7||
       !finite(left.uMs)||!finite(left.vMs)||
       !finite(right.uMs)||!finite(right.vMs)||
       [left.uMs,left.vMs,right.uMs,right.vMs].some(n=>Math.abs(n)>100))
      throw Error('Échantillons spatiaux U/V incompatibles ou non vérifiés.');
    const ratio=(targetHour-a.forecastHour)/(b.forecastHour-a.forecastHour);
    const u=left.uMs+(right.uMs-left.uMs)*ratio;
    const v=left.vMs+(right.vMs-left.vMs)*ratio;
    const speed=Math.hypot(u,v);
    const direction=(Math.atan2(-u,-v)*180/Math.PI+360)%360;
    return {
      cycleUTC:a.cycleUTC,forecastHour:targetHour,
      validUTC:new Date(cycleA+targetHour*3600000).toISOString(),
      site:{...left.site},
      uMs:round(u,3),vMs:round(v,3),
      speedKnots:round(speed*KNOTS,1),
      directionFromDeg:round(direction,1),
      spatiallyInterpolated:true,
      temporallyInterpolated:true,
      gridResolutionDegrees:0.25,
      method:'Interpolation bilinéaire spatiale et linéaire temporelle des composantes U/V NOAA'
    };
  }
  function interpolateDemonstrationTrack(a,b){
    const cycleA=validateFrame(a),cycleB=validateFrame(b);
    if(cycleA!==cycleB)throw Error('Impossible de mélanger deux cycles GFS.');
    if(a.forecastHour!==6||b.forecastHour!==12)
      throw Error('Le parcours météo témoin nécessite f006 et f012 du même cycle.');
    if(!Array.isArray(a.trackSamples)||!Array.isArray(b.trackSamples)||
       a.trackSamples.length!==3||b.trackSamples.length!==3)
      throw Error('Échantillons météorologiques du parcours incomplets.');
    const expected=[
      {forecastHour:7,latitude:48.125,longitude:-8.625},
      {forecastHour:9,latitude:47.625,longitude:-9.125},
      {forecastHour:11,latitude:47.125,longitude:-9.625}
    ];
    return expected.map((site,i)=>{
      const from=a.trackSamples[i],to=b.trackSamples[i];
      const matches=sample=>
        sample&&sample.verifiedWind===true&&
        sample.spatiallyInterpolated===true&&
        sample.gridResolutionDegrees===0.25&&
        sample.forecastHour===site.forecastHour&&
        sample.site&&finite(sample.site.latitude)&&finite(sample.site.longitude)&&
        Math.abs(sample.site.latitude-site.latitude)<1e-7&&
        Math.abs(sample.site.longitude-site.longitude)<1e-7&&
        finite(sample.uMs)&&finite(sample.vMs)&&
        Math.abs(sample.uMs)<=100&&Math.abs(sample.vMs)<=100;
      if(!matches(from)||!matches(to))
        throw Error('Position ou vent du parcours non vérifié.');
      const fraction=(site.forecastHour-6)/6;
      const u=from.uMs+(to.uMs-from.uMs)*fraction;
      const v=from.vMs+(to.vMs-from.vMs)*fraction;
      const speed=Math.hypot(u,v);
      const direction=(Math.atan2(-u,-v)*180/Math.PI+360)%360;
      return {
        label:'Position témoin '+(i+1),
        cycleUTC:a.cycleUTC,
        forecastHour:site.forecastHour,
        validUTC:new Date(cycleA+site.forecastHour*3600000).toISOString(),
        latitude:site.latitude,longitude:site.longitude,
        uMs:round(u,3),vMs:round(v,3),
        speedKnots:round(speed*KNOTS,1),
        directionFromDeg:round(direction,1),
        spatiallyInterpolated:true,temporallyInterpolated:true,
        demonstrativePosition:true
      };
    });
  }
  return {validateFrame,interpolateFrames,interpolateSpatialFrames,interpolateDemonstrationTrack};
});
