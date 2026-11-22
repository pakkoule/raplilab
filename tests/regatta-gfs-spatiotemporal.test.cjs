'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {interpolateSpatialFrames}=require('../regatta/gfs-interpolation.js');
const CYCLE='2026-11-22T00:00:00.000Z';
function frame(hour,u,v,opts={}){
  const cycle=opts.cycle||CYCLE;
  return {
    ok:true,cycleUTC:cycle,forecastHour:hour,
    validUTC:new Date(Date.parse(cycle)+hour*3600000).toISOString(),
    points:[0,1,2].map(n=>({
      verifiedWind:true,
      site:{label:'Point '+n,latitude:48-n*2,longitude:-8-n},
      uMs:u,vMs:v
    })),
    spatial:opts.spatial===false?null:{
      verifiedWind:true,spatiallyInterpolated:true,gridResolutionDegrees:0.25,
      site:{label:'Entre les mailles',latitude:47.125,longitude:-9.125},
      uMs:u,vMs:v
    }
  };
}
test('interpolation à +9 h des composantes U/V bilinéaires déjà vérifiées',()=>{
  const a=frame(6,10,0),b=frame(12,0,10);
  const result=interpolateSpatialFrames(a,b,9);
  assert.equal(result.validUTC,'2026-11-22T09:00:00.000Z');
  assert.equal(result.uMs,5);
  assert.equal(result.vMs,5);
  assert.equal(result.speedKnots,13.7);
  assert.equal(result.directionFromDeg,225);
  assert.equal(result.gridResolutionDegrees,0.25);
  assert.equal(result.spatiallyInterpolated,true);
  assert.equal(result.temporallyInterpolated,true);
});
test('interpolation à +15 h, direction calculée à partir des vecteurs (pas des angles)',()=>{
  const result=interpolateSpatialFrames(frame(12,-2,-10),frame(18,2,-10),15);
  assert.equal(result.directionFromDeg,0);
  assert.equal(result.speedKnots,19.4);
});
test('interdit le mélange des cycles et les extrapolations hors échéances',()=>{
  assert.throws(
    ()=>interpolateSpatialFrames(frame(6,10,0),frame(12,0,10,{cycle:'2026-11-22T06:00:00.000Z'}),9),
    /deux cycles/
  );
  assert.throws(()=>interpolateSpatialFrames(frame(6,10,0),frame(18,0,10),12),/hors intervalle/);
  assert.throws(()=>interpolateSpatialFrames(frame(6,10,0),frame(12,0,10),6),/hors intervalle/);
  assert.throws(()=>interpolateSpatialFrames(frame(6,10,0),frame(12,0,10),13),/hors intervalle/);
});
test('interdit les lectures spatiales absentes, incohérentes ou non vérifiées',()=>{
  const a=frame(6,10,0),b=frame(12,0,10);
  assert.throws(()=>interpolateSpatialFrames(a,frame(12,0,10,{spatial:false}),9),/incompatibles/);
  b.spatial.site.longitude=-9;
  assert.throws(()=>interpolateSpatialFrames(a,b,9),/incompatibles/);
  b.spatial.site.longitude=-9.125;
  b.spatial.verifiedWind=false;
  assert.throws(()=>interpolateSpatialFrames(a,b,9),/incompatibles/);
  b.spatial.verifiedWind=true;
  b.spatial.gridResolutionDegrees=1;
  assert.throws(()=>interpolateSpatialFrames(a,b,9),/incompatibles/);
  b.spatial.gridResolutionDegrees=0.25;
  b.spatial.uMs=NaN;
  assert.throws(()=>interpolateSpatialFrames(a,b,9),/incompatibles/);
});
test('conserve et valide la date NOAA réelle entre échéances',()=>{
  const a=frame(6,10,0),b=frame(12,0,10);
  b.validUTC='2026-11-23T12:00:00.000Z';
  assert.throws(()=>interpolateSpatialFrames(a,b,9),/Horodatages/);
});
