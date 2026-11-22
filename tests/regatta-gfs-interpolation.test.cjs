'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../regatta/gfs-interpolation.js');

const cycle='2026-11-22T00:00:00.000Z';
function frame(hour,opts={}){
  const actualCycle=opts.cycle||cycle;
  return {
    ok:true,
    cycleUTC:actualCycle,
    forecastHour:hour,
    validUTC:new Date(Date.parse(actualCycle)+hour*3600000).toISOString(),
    points:[0,1,2].map((n)=>({
      verifiedWind:true,
      site:{label:'Zone '+n,latitude:48-n*2,longitude:-8-n*2},
      uMs:(opts.u??10)+n,
      vMs:opts.v??0
    }))
  };
}
test('interpolation vectorielle NOAA : les valeurs à +9 h sont entre +6 et +12 h',()=>{
  const result=engine.interpolateFrames(frame(6,{u:10,v:0}),frame(12,{u:0,v:10}),9);
  assert.equal(result.interpolated,true);
  assert.equal(result.forecastHour,9);
  assert.equal(result.validUTC,'2026-11-22T09:00:00.000Z');
  assert.equal(result.points.length,3);
  assert.equal(result.points[0].uMs,5);
  assert.equal(result.points[0].vMs,5);
  assert.equal(result.points[0].speedKnots,13.7);
  assert.equal(result.points[0].directionFromDeg,225);
});
test('les directions météo sont interpolées en U/V, pas en degrés autour de 360°',()=>{
  const midpoint=engine.interpolateFrames(frame(12,{u:-2,v:-10}),frame(18,{u:2,v:-10}),15);
  assert.equal(midpoint.points[0].directionFromDeg,0);
  assert.equal(midpoint.points[0].speedKnots,19.4);
});
test('interdire cycles différents, mauvais ordre ou extrapolation',()=>{
  assert.throws(
    ()=>engine.interpolateFrames(frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'}),9),
    /deux cycles/
  );
  assert.throws(()=>engine.interpolateFrames(frame(6),frame(18),12),/adjacentes/);
  assert.throws(()=>engine.interpolateFrames(frame(12),frame(6),9),/adjacentes/);
  assert.throws(()=>engine.interpolateFrames(frame(6),frame(12),10),/adjacentes/);
});
test('interdire points différents et composantes manquantes',()=>{
  const b=frame(12);
  b.points[0].site.longitude=-7;
  assert.throws(()=>engine.interpolateFrames(frame(6),b,9),/géographiques/);
  const broken=frame(12);
  broken.points[0].uMs=NaN;
  assert.throws(()=>engine.interpolateFrames(frame(6),broken,9),/non vérifiées/);
  const missing=frame(12);
  missing.points.pop();
  assert.throws(()=>engine.interpolateFrames(frame(6),missing,9),/incomplète/);
  const untrusted=frame(12);
  untrusted.points[0].verifiedWind=false;
  assert.throws(()=>engine.interpolateFrames(frame(6),untrusted,9),/non vérifiées/);
  const outOfDate=frame(12);
  outOfDate.validUTC='2026-11-23T12:00:00.000Z';
  assert.throws(()=>engine.interpolateFrames(frame(6),outOfDate,9),/Horodatages/);
});
