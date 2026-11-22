'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../regatta/gfs-motion.js');
const CYCLE='2026-11-22T00:00:00.000Z';
function encoded(values){
  const b=Buffer.alloc(values.length*4);
  values.forEach((x,i)=>b.writeFloatLE(x,i*4));
  return b.toString('base64');
}
function frame(hour,opts={}){
  const ni=17,nj=25,n=ni*nj;
  const u=new Array(n).fill(opts.windU??14),v=new Array(n).fill(opts.windV??-5);
  if(opts.badCell)u[5+4*ni]=NaN;
  return {
    ok:true,cycleUTC:opts.cycle||CYCLE,forecastHour:hour,
    validUTC:new Date(Date.parse(opts.cycle||CYCLE)+hour*3600000).toISOString(),
    motionGrid:{
      verifiedGrid:true,format:'float32le-base64',
      ni,nj,numberOfDataPoints:n,
      latitudeOfFirstGridPoint:50,longitudeOfFirstGridPoint:350,
      iDirectionIncrement:.25,jDirectionIncrement:.25,
      iScansNegatively:false,jScansPositively:false,
      jPointsAreConsecutive:false,alternativeRowScanning:false,
      uBase64:encoded(u),vBase64:encoded(v)
    }
  };
}
test('polaires provisoires ne sont utilisées que dans la zone TWA documentée',()=>{
  assert.equal(m.polarSpeed(30,100),41.42);
  assert.equal(m.polarSpeed(30,110),41.33);
  assert.ok(m.polarSpeed(30,105)>41.3&&m.polarSpeed(30,105)<41.5);
  assert.throws(()=>m.polarSpeed(20,85),/hors des polaires/);
  assert.throws(()=>m.polarSpeed(43,110),/hors des polaires/);
});
test('décodage compact little-endian et échantillon bilinéaire de grille',()=>{
  const a=m.loadFrame(frame(6));
  assert.equal(a.u.length,425);
  const sample=m.sampleGrid(a,48.125,-8.625);
  assert.ok(Math.abs(sample.u-14)<1e-5);
  assert.ok(Math.abs(sample.v+5)<1e-5);
  const wind=m.windAt(a,m.loadFrame(frame(12)),9,48.125,-8.625);
  assert.ok(wind.knots>28&&wind.knots<30);
  assert.ok(wind.from>285&&wind.from<295);
});
test('déplacement de bateau calculé sur vrais vecteurs météo et polaire partielle',()=>{
  const result=m.simulateMotion(frame(6),frame(12));
  assert.equal(result.steps.length,7);
  assert.equal(result.heading,180);
  assert.equal(result.provisionalPolar,true);
  assert.equal(result.optimized,false);
  assert.ok(result.distanceNm>110&&result.distanceNm<140);
  assert.ok(result.steps.at(-1).latitude<result.steps[0].latitude);
  assert.ok(result.steps.every(p=>p.boatKnots>0));
  assert.ok(result.steps.every(p=>Math.abs(p.longitude+8.625)<1e-4));
  assert.equal(result.steps[0].distanceNm,0);
  assert.equal(result.steps.at(-1).distanceNm,result.distanceNm);
});
test('rejet données NOAA manquantes, cycles mélangés et météo hors limites',()=>{
  assert.throws(()=>m.simulateMotion(frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'})),/non compatibles/);
  assert.throws(()=>m.simulateMotion(frame(6),frame(12,{windU:0,windV:0})),/polaires provisoires/);
  assert.throws(()=>m.simulateMotion(frame(6),{...frame(12),motionGrid:null}),/Grille NOAA/);
  const invalid=frame(6);
  invalid.motionGrid.latitudeOfFirstGridPoint=42;
  assert.throws(()=>m.simulateMotion(invalid,frame(12)),/non compatibles/);
});
test('refus d’extrapoler une grille hors de son domaine',()=>{
  const a=m.loadFrame(frame(6));
  assert.throws(()=>m.sampleGrid(a,51,-8.625),/zone météo/);
  assert.throws(()=>m.sampleGrid(a,48.125,-11),/zone météo/);
});
