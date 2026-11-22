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
  assert.throws(()=>m.simulateMotion(frame(6,{windU:0,windV:0}),frame(12,{windU:0,windV:0})),/polaires provisoires/);
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

test('comparaison limitée à cinq caps fixes, classement sur progression vers le sud',()=>{
  const first=frame(6,{windU:14,windV:-6}),second=frame(12,{windU:14,windV:-6});
  const comparison=m.compareFixedHeadings(first,second);
  assert.deepEqual(comparison.evaluated.map(x=>x.heading),[170,175,180,185,190]);
  assert.equal(comparison.comparisonOnly,true);
  assert.equal(comparison.optimized,false);
  assert.equal(comparison.provisionalPolar,true);
  assert.ok(comparison.validCount>=3);
  assert.equal(comparison.evaluated.find(x=>x.heading===170).valid,false);
  assert.ok(comparison.evaluated.some(x=>x.valid));
  const eligible=comparison.evaluated.filter(x=>x.valid);
  assert.equal(comparison.best.southProgressNm,Math.max(...eligible.map(x=>x.southProgressNm)));
  assert.ok(eligible.every(x=>x.distanceNm>0&&x.finalLatitude<m.START.latitude));
});
test('un cap interdit, une absence météo, et des polaires insuffisantes ne produisent aucun faux résultat',()=>{
  assert.throws(()=>m.simulateMotion(frame(6),frame(12),160),/hors de la sélection autorisée/);
  assert.throws(()=>m.compareFixedHeadings(frame(6,{windU:0,windV:0}),
    frame(12,{windU:0,windV:0})),/Aucun cap comparable/);
  assert.throws(()=>m.compareFixedHeadings(frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'})),
    /Aucun cap comparable/);
});

test('pilote adaptatif : six décisions météo et comparaison honnête avec le meilleur cap fixe',()=>{
  const first=frame(6,{windU:14,windV:-5});
  const second=frame(12,{windU:14,windV:-5});
  const result=m.simulateAdaptiveHeading(first,second);
  assert.equal(result.steps.length,6);
  assert.equal(result.greedy,true);
  assert.equal(result.optimized,false);
  assert.equal(result.provisionalPolar,true);
  assert.equal(result.startHour,6);
  assert.equal(result.endHour,9);
  assert.equal(result.headingChanges,0,'ne jamais forcer des changements de cap artificiels');
  assert.ok(result.steps.every(s=>m.CANDIDATE_HEADINGS.includes(s.heading)));
  assert.ok(result.steps.every(s=>s.validCount>=1&&s.boatKnots>0&&s.southVmg>0));
  assert.ok(result.distanceNm>0&&result.southProgressNm>0);
  assert.ok(Math.abs(result.deltaSouthNm-(result.southProgressNm-result.bestFixedSouthNm))<0.11);
});
test('le pilote peut réellement modifier le cap quand la direction météo évolue',()=>{
  const byDirection=(degrees,speedKnots)=>{
    const radians=degrees*Math.PI/180, speedMs=speedKnots/1.9438444924406;
    return {windU:-speedMs*Math.sin(radians),windV:-speedMs*Math.cos(radians)};
  };
  assert.equal(m.selectSouthHeading({knots:30,from:295}).selected.heading,185);
  assert.equal(m.selectSouthHeading({knots:30,from:275}).selected.heading,175);
  const result=m.simulateAdaptiveHeading(
    frame(6,byDirection(295,30)),frame(12,byDirection(255,30))
  );
  assert.ok(result.headingChanges>=1,'un changement peut être motivé par le vent');
  assert.ok(new Set(result.steps.map(s=>s.heading)).size>=2);
});
test('le pilote refuse les polaires absentes, les cycles différents et les données manquantes',()=>{
  assert.throws(()=>m.selectSouthHeading({knots:0,from:180}),/Aucun cap autorisé/);
  assert.throws(()=>m.simulateAdaptiveHeading(
    frame(6,{windU:0,windV:0}),frame(12,{windU:0,windV:0})
  ),/Aucun cap autorisé/);
  assert.throws(()=>m.simulateAdaptiveHeading(
    frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'})
  ),/non compatibles/);
  const missing=frame(12);
  missing.motionGrid=null;
  assert.throws(()=>m.simulateAdaptiveHeading(frame(6),missing),/Grille NOAA/);
});

test('lecture vectorielle de f012/f018 sans extrapolation temporelle',()=>{
  const f12=m.loadFrame(frame(12,{windU:12,windV:-5}));
  const f18=m.loadFrame(frame(18,{windU:8,windV:-1}));
  const mid=m.windAt(f12,f18,15,48.125,-8.625);
  assert.ok(Math.abs(mid.u-10)<.0001);
  assert.ok(Math.abs(mid.v+3)<.0001);
  assert.throws(()=>m.windAt(f12,f18,18.5,48.125,-8.625),/consécutives/);
  assert.throws(()=>m.windAt(f12,f18,11.5,48.125,-8.625),/consécutives/);
  const differentCycle=m.loadFrame(frame(18,{cycle:'2026-11-22T06:00:00.000Z'}));
  assert.throws(()=>m.windAt(f12,differentCycle,15,48.125,-8.625),/consécutives/);
});
