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
  return {validateFrame,interpolateFrames,interpolateSpatialFrames};
});
