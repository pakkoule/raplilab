'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {
  SPATIAL_SITE,validateGrid,cornersForSite,sampleBilinear,decodeWindSpatial
}=require('../netlify/functions/gfs-spatial-core.cjs');

function grid(overrides={}){
  return {
    kind:'latlon',gridDefinitionTemplateNumber:0,gridKey:'same-grid',
    ni:3,nj:3,numberOfDataPoints:9,scanningMode:0,
    iScansNegatively:false,jScansPositively:false,
    jPointsAreConsecutive:false,alternativeRowScanning:false,
    iDirectionIncrement:0.25,jDirectionIncrement:0.25,
    longitudeOfFirstGridPoint:350.75,latitudeOfFirstGridPoint:47.5,
    uvRelativeToGrid:false,...overrides
  };
}
function near(grid,latitude,longitude){
  const normalized=v=>((v%360)+360)%360;
  const iSign=grid.iScansNegatively?-1:1,jSign=grid.jScansPositively?1:-1;
  const col=Math.round(normalized((longitude-grid.longitudeOfFirstGridPoint)*iSign)/0.25);
  const row=Math.round((latitude-grid.latitudeOfFirstGridPoint)/(jSign*0.25));
  if(col<0||col>=grid.ni||row<0||row>=grid.nj)return null;
  const index=grid.jPointsAreConsecutive?
    col*grid.nj+(grid.alternativeRowScanning&&col%2?grid.nj-1-row:row):
    row*grid.ni+(grid.alternativeRowScanning&&row%2?grid.ni-1-col:col);
  return {index,latitude,longitude:normalized(longitude),distanceKm:0};
}
const section4=parameter=>{
  const s=Buffer.alloc(34);
  s[4]=4;s[7]=0;s[8]=0;s[9]=2;s[10]=parameter;s[22]=103;s[23]=0;s.writeUInt32BE(10,24);
  return s;
};
const mock=(g,valuesU,valuesV)=>{
  const u={discipline:0,section4:section4(2),section3:Buffer.from([3])};
  const v={discipline:0,section4:section4(3),section3:Buffer.from([3])};
  return {
    splitMessages:()=>[{}],parseFields:()=>[u,v],
    parseProduct:s=>({parameterCategory:2,parameterNumber:s===u.section4?2:3}),
    parseGrid:()=>g,nearestGridpoint:near,
    decodeFieldValues:f=>({values:f===u?valuesU:valuesV})
  };
};
test('moyenne bilinéaire des quatre coins au milieu de la maille',()=>{
  const g=grid();
  const site={latitude:47.375,longitude:-9.125};
  const corners=cornersForSite(g,site);
  assert.deepEqual(corners.map(p=>p.weight),[0.25,0.25,0.25,0.25]);
  assert.deepEqual(corners.map(p=>p.position.latitude),[47.5,47.5,47.25,47.25]);
  assert.deepEqual(corners.map(p=>p.position.longitude),[350.75,351,350.75,351]);
  assert.equal(sampleBilinear({nearestGridpoint:near},g,[0,4,8,12,16,20,24,28,32],site),8);
});
test('balayage alterné sur la ligne et direction latitudinale inversée',()=>{
  const g=grid({alternativeRowScanning:true,jScansPositively:true});
  const site={latitude:47.625,longitude:-9.125};
  // La seconde ligne est stockée en ordre inverse.
  const v=[0,4,8,20,16,12,24,28,32];
  const out=sampleBilinear({nearestGridpoint:near},g,v,site);
  assert.equal(out,8);
});
test('balayage par colonne et traversée du méridien zéro',()=>{
  const g=grid({
    longitudeOfFirstGridPoint:359.75,
    jPointsAreConsecutive:true,
    latitudeOfFirstGridPoint:47.5
  });
  // Traversée du 360° -> 0° sur la deuxième colonne.
  const site={latitude:47.375,longitude:-0.125};
  const v=[0,12,24,4,16,28,8,20,32];
  assert.equal(sampleBilinear({nearestGridpoint:near},g,v,site),8);
});
test('refuse extrapolation et structures de grilles ambiguës',()=>{
  assert.throws(()=>cornersForSite(grid(),{latitude:46.0,longitude:-9.125}),/hors de la zone/);
  assert.throws(()=>cornersForSite(grid(),{latitude:47.25,longitude:-12}),/hors de la zone/);
  assert.throws(()=>validateGrid(grid({kind:'rotated'})),/non vérifiée/);
  assert.throws(()=>validateGrid(grid({uvRelativeToGrid:true})),/non vérifiée/);
  assert.throws(()=>validateGrid(grid({numberOfDataPoints:10})),/non vérifiée/);
});
test('le décodeur renvoie un vent réel interpolé à un point entre les mailles',async()=>{
  const g=grid();
  const valuesU=[0,4,8,12,16,20,24,28,32];
  const valuesV=[0,0,0,0,0,0,0,0,0];
  const site={latitude:47.375,longitude:-9.125,label:'Au large'};
  const result=await decodeWindSpatial(Buffer.alloc(40),site,mock(g,valuesU,valuesV));
  assert.equal(result.verifiedWind,true);
  assert.equal(result.spatiallyInterpolated,true);
  assert.equal(result.uMs,8);
  assert.equal(result.vMs,0);
  assert.equal(result.speedKnots,15.6);
  assert.equal(result.directionFromDeg,270);
  assert.equal(result.gridResolutionDegrees,0.25);
});
test('refuse les données absentes à un coin et les grilles U/V incompatibles',async()=>{
  const g=grid();
  const bad=[0,NaN,8,12,16,20,24,28,32];
  const site={latitude:47.375,longitude:-9.125,label:'Au large'};
  await assert.rejects(
    decodeWindSpatial(Buffer.alloc(40),site,mock(g,bad,new Array(9).fill(0))),
    /manquant/
  );
  const dec=mock(g,new Array(9).fill(5),new Array(9).fill(-2));
  let count=0;
  dec.parseGrid=()=>({ ...g,gridKey:++count===1?'a':'b'});
  await assert.rejects(decodeWindSpatial(Buffer.alloc(40),site,dec),/Maillages U\/V incompatibles/);
});
