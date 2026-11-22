'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const motion=require('../regatta/gfs-motion.js');
const {
  DEPARTURES,GATE_LATITUDE,HORIZON_HOURS,
  compatibleFrames,sailToGate,compareDepartureWindows
}=require('../regatta/gfs-departures.js');
const CYCLE='2026-11-22T00:00:00.000Z';
function packed(values){
  const bytes=Buffer.alloc(values.length*4);
  values.forEach((v,i)=>bytes.writeFloatLE(v,4*i));
  return bytes.toString('base64');
}
function components(degrees,knots){
  const angle=degrees*Math.PI/180,ms=knots/1.9438444924406;
  return {u:-Math.sin(angle)*ms,v:-Math.cos(angle)*ms};
}
function frame(hour,opts={}){
  const ni=17,nj=25,count=ni*nj;
  const uv=components(opts.direction??293,opts.windSpeed??29);
  const cycle=opts.cycle??CYCLE;
  return {
    ok:true,forecastHour:hour,cycleUTC:cycle,
    validUTC:new Date(Date.parse(cycle)+hour*3600000).toISOString(),
    motionGrid:{
      verifiedGrid:true,format:'float32le-base64',
      ni,nj,numberOfDataPoints:count,
      latitudeOfFirstGridPoint:50,longitudeOfFirstGridPoint:350,
      iDirectionIncrement:.25,jDirectionIncrement:.25,
      iScansNegatively:false,jScansPositively:false,
      jPointsAreConsecutive:false,alternativeRowScanning:false,
      uBase64:packed(Array(count).fill(uv.u)),
      vBase64:packed(Array(count).fill(uv.v))
    }
  };
}
test('quatre heures de départ analysées, franchissement 47°N avec ETA et durée distinctes',()=>{
  const result=compareDepartureWindows(frame(6),frame(12));
  assert.deepEqual(DEPARTURES,[6,7,8,9]);
  assert.equal(GATE_LATITUDE,47);
  assert.equal(HORIZON_HOURS,3);
  assert.equal(result.gateLatitude,47);
  assert.equal(result.windows.length,4);
  assert.equal(result.validCount,4);
  assert.equal(result.fullPack,false);
  assert.equal(result.isEquatorForecast,false);
  for(const w of result.windows){
    assert.equal(w.valid,true);
    assert.equal(w.latitude,47);
    assert.ok(w.elapsedMinutes>0&&w.elapsedMinutes<180);
    assert.equal(w.departureUTC,new Date(Date.parse(CYCLE)+w.startHour*3600000).toISOString());
    const actualDuration=(Date.parse(w.crossingUTC)-Date.parse(w.departureUTC))/60000;
    assert.ok(Math.abs(actualDuration-w.elapsedMinutes)<.1);
    assert.ok(w.crossingForecastHour>=w.startHour);
    assert.ok(w.crossingForecastHour<=w.startHour+3);
  }
  assert.equal(result.fastestElapsedMinutes,
    Math.min(...result.windows.map(w=>w.elapsedMinutes)));
  assert.equal(result.earliestArrivalUTC,
    [...result.windows].sort((a,b)=>Date.parse(a.crossingUTC)-Date.parse(b.crossingUTC))[0].crossingUTC);
});
test('un départ plus tardif peut être plus rapide en durée sans être la première arrivée',()=>{
  const result=compareDepartureWindows(frame(6,{windSpeed:21}),frame(12,{windSpeed:30}));
  assert.equal(result.validCount,4);
  assert.ok(result.fastestElapsedMinutes>0);
  assert.ok(result.windows.every(w=>w.valid&&w.crossingUTC>w.departureUTC));
  assert.ok(result.earliestArrivalStartHour<=result.fastestStartHour);
});
test('rejet des cycles ou échéances NOAA incompatibles',()=>{
  assert.throws(()=>compatibleFrames(frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'})),
    /incompatibles/);
  assert.throws(()=>compareDepartureWindows(frame(6),frame(6)),/incompatibles/);
  const malformed=frame(12);
  malformed.motionGrid.ni=16;
  assert.throws(()=>compareDepartureWindows(frame(6),malformed),/Grille NOAA/);
});
test('sans passage à la latitude dans les trois heures, aucun temps de parcours inventé',()=>{
  const {first,second}=compatibleFrames(frame(6),frame(12));
  assert.throws(()=>sailToGate(first,second,6,40.1),/non franchie/);
  assert.throws(()=>sailToGate(first,second,5,47),/non autorisé/);
  assert.throws(()=>sailToGate(first,second,9,48.125),/non autorisé/);
  assert.throws(
    ()=>compareDepartureWindows(frame(6,{windSpeed:0}),frame(12,{windSpeed:0})),
    /Aucun départ/
  );
});
