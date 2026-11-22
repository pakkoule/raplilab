'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {interpolateDemonstrationTrack}=require('../regatta/gfs-interpolation.js');
const CYCLE='2026-11-22T00:00:00.000Z';
const SITES=[
  {latitude:48.125,longitude:-8.625,forecastHour:7},
  {latitude:47.625,longitude:-9.125,forecastHour:9},
  {latitude:47.125,longitude:-9.625,forecastHour:11}
];
function forecast(hour,u,v,opts={}){
  const cycle=opts.cycle||CYCLE;
  const samples=SITES.map((site,i)=>({
    site:{latitude:site.latitude,longitude:site.longitude,label:'Étape témoin '+(i+1)},
    forecastHour:site.forecastHour,verifiedWind:true,
    spatiallyInterpolated:true,gridResolutionDegrees:0.25,
    uMs:u+i,vMs:v
  }));
  return {
    ok:true,cycleUTC:cycle,forecastHour:hour,
    validUTC:new Date(Date.parse(cycle)+hour*3600000).toISOString(),
    points:[0,1,2].map(i=>({
      site:{label:'Point '+i,latitude:48-i*2,longitude:-8-i},
      verifiedWind:true,uMs:5,vMs:2
    })),
    trackSamples:opts.missing?null:samples
  };
}

test('trois positions successives reçoivent leurs propres heures et vents',()=>{
  const result=interpolateDemonstrationTrack(forecast(6,10,0),forecast(12,0,10));
  assert.equal(result.length,3);
  assert.deepEqual(result.map(p=>p.forecastHour),[7,9,11]);
  assert.deepEqual(result.map(p=>p.latitude),[48.125,47.625,47.125]);
  assert.deepEqual(result.map(p=>p.longitude),[-8.625,-9.125,-9.625]);
  assert.deepEqual(result.map(p=>p.validUTC),[
    '2026-11-22T07:00:00.000Z',
    '2026-11-22T09:00:00.000Z',
    '2026-11-22T11:00:00.000Z'
  ]);
  assert.equal(result[1].uMs,6);
  assert.equal(result[1].vMs,5);
  assert.equal(result[1].speedKnots,15.2);
  assert.equal(result[1].directionFromDeg,230.2);
  assert.ok(result.every(p=>p.demonstrativePosition===true));
});

test('refus de mélange de cycles et d’échéances non adjacentes',()=>{
  assert.throws(
    ()=>interpolateDemonstrationTrack(forecast(6,10,0),forecast(12,0,10,{cycle:'2026-11-22T06:00:00.000Z'})),
    /deux cycles/
  );
  assert.throws(()=>interpolateDemonstrationTrack(forecast(6,10,0),forecast(18,0,10)),/f006 et f012/);
});

test('refus de positions absentes ou géographiquement modifiées',()=>{
  assert.throws(
    ()=>interpolateDemonstrationTrack(forecast(6,10,0),forecast(12,0,10,{missing:true})),
    /incomplets/
  );
  const a=forecast(6,10,0),b=forecast(12,0,10);
  b.trackSamples[1].site.longitude=-12;
  assert.throws(()=>interpolateDemonstrationTrack(a,b),/non vérifié/);
  b.trackSamples[1].site.longitude=-9.125;
  b.trackSamples[1].verifiedWind=false;
  assert.throws(()=>interpolateDemonstrationTrack(a,b),/non vérifié/);
  b.trackSamples[1].verifiedWind=true;
  b.trackSamples[1].vMs=Infinity;
  assert.throws(()=>interpolateDemonstrationTrack(a,b),/non vérifié/);
});
