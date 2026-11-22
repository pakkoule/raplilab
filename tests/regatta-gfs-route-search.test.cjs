'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const motion=require('../regatta/gfs-motion.js');
const {searchHeadingSequences,STEP_COUNT,MAX_EXPANDED}
  =require('../regatta/gfs-route-search.js');

const CYCLE='2026-11-22T00:00:00.000Z';
function packed(values){
 const b=Buffer.alloc(values.length*4);
 values.forEach((value,i)=>b.writeFloatLE(value,4*i));
 return b.toString('base64');
}
function components(direction,speedKnots){
 const rad=direction*Math.PI/180,ms=speedKnots/1.9438444924406;
 return {u:-Math.sin(rad)*ms,v:-Math.cos(rad)*ms};
}
function frame(hour,config={}){
 const ni=17,nj=25,count=ni*nj;
 const a=components(config.direction??293,config.windSpeed??29);
 const cycle=config.cycle??CYCLE;
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
     uBase64:packed(Array(count).fill(a.u)),
     vBase64:packed(Array(count).fill(a.v))
   }
 };
}
test('le test 11 explore exactement six décisions et reste borné',()=>{
 const result=searchHeadingSequences(frame(6),frame(12));
 assert.equal(STEP_COUNT,6);
 assert.equal(result.exhaustiveWithinDiscreteSet,true);
 assert.equal(result.isOceanRouting,false);
 assert.equal(result.fullPack,false);
 assert.ok(result.expanded<=MAX_EXPANDED);
 assert.ok(result.completed>=1&&result.completed<=5**6);
 assert.equal(result.steps.length,6);
 assert.equal(result.headings.length,6);
 assert.ok(result.headings.every(h=>motion.CANDIDATE_HEADINGS.includes(h)));
 assert.ok(result.southProgressNm>=result.greedySouthNm-0.11);
 assert.ok(result.southProgressNm>=result.fixedSouthNm-0.11);
 assert.ok(result.distanceNm>0);
 assert.ok(result.finalLatitude<motion.START.latitude);
});
test('le test 11 n’invente aucun avantage : résultats reproductibles',()=>{
 const a=frame(6,{direction:285}),b=frame(12,{direction:275});
 const first=searchHeadingSequences(a,b);
 const second=searchHeadingSequences(a,b);
 assert.deepEqual(first.headings,second.headings);
 assert.equal(first.southProgressNm,second.southProgressNm);
 assert.ok(first.gainVsGreedyNm>=-0.11);
 assert.ok(first.gainVsFixedNm>=-0.11);
});
test('refus si le cycle, les polaires ou les grilles ne permettent aucune route',()=>{
 assert.throws(
   ()=>searchHeadingSequences(frame(6),frame(12,{cycle:'2026-11-22T06:00:00.000Z'})),
   /grilles GFS/
 );
 assert.throws(()=>searchHeadingSequences(frame(6,{windSpeed:0}),frame(12,{windSpeed:0})),
   /Aucune route|Aucune séquence/);
 const corrupt=frame(12);
 corrupt.motionGrid.ni=16;
 assert.throws(()=>searchHeadingSequences(frame(6),corrupt),/Grille NOAA|grilles GFS/);
});
