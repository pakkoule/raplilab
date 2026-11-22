'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {
  windFromComponents, isTenMetreWind, decodeWindPoint, SAMPLE
} = require('../netlify/functions/gfs-wind-core.cjs');

function section4(level=10) {
  const b=Buffer.alloc(34);
  b[4]=4; b[7]=0; b[8]=0;
  b[22]=103; // octet 23 : altitude au-dessus du sol
  b[23]=0;   // octet 24 : facteur d'échelle
  b.writeUInt32BE(level,24);
  return b;
}
function fakeDecoder(valuesU=[0,-5],valuesV=[0,-12]) {
  const mkField=(n,values)=>({
    discipline:0, section4:section4(10),
    section3:new Uint8Array(72), values, parameterNumber:n
  });
  const u=mkField(2,valuesU), v=mkField(3,valuesV);
  return {
    splitMessages:()=>['fake grib bytes'],
    parseFields:()=>[u,v],
    parseProduct:s=>({parameterCategory:2,parameterNumber:s===u.section4?2:3}),
    parseGrid:()=>({kind:'latlon',ni:5,nj:5}),
    nearestGridpoint:()=>({index:1,latitude:48.5,longitude:-8,distanceKm:0}),
    decodeFieldValues:f=>({values:f.values})
  };
}

test('vecteurs météo : vitesse en nœuds et direction dont vient le vent',()=>{
  assert.equal(windFromComponents(0,-10).directionFromDeg,0);
  assert.equal(windFromComponents(-10,0).directionFromDeg,90);
  assert.equal(windFromComponents(0,10).directionFromDeg,180);
  assert.equal(windFromComponents(10,0).directionFromDeg,270);
  assert.equal(windFromComponents(3,4).speedKnots,9.7);
  assert.throws(()=>windFromComponents(Number.NaN,0),/invalides/);
});

test('enveloppe NOAA : champ U/V nécessairement à 10 mètres et template 4.0',()=>{
  const field={discipline:0,section4:section4(10)};
  assert.equal(isTenMetreWind(field,{parameterCategory:2,parameterNumber:2}),true);
  assert.equal(isTenMetreWind(field,{parameterCategory:2,parameterNumber:3}),true);
  assert.equal(isTenMetreWind(field,{parameterCategory:2,parameterNumber:4}),false);
  assert.equal(isTenMetreWind({...field,section4:section4(20)},{parameterCategory:2,parameterNumber:2}),false);
  assert.equal(isTenMetreWind({...field,discipline:10},{parameterCategory:2,parameterNumber:2}),false);
  const foreign=section4(10);
  foreign[8]=1;
  assert.equal(isTenMetreWind({...field,section4:foreign},{parameterCategory:2,parameterNumber:2}),false);
});

test('une paire de champs réellement décodés produit un vent au point demandé',async()=>{
  const result=await decodeWindPoint(Buffer.alloc(40),SAMPLE,fakeDecoder());
  assert.equal(result.uMs,-5);
  assert.equal(result.vMs,-12);
  assert.equal(result.speedKnots,25.3);
  assert.equal(result.verifiedWind,true);
  assert.deepEqual(result.nearestGridpoint,{latitude:48.5,longitude:-8,distanceKm:0});
});

test('GFS convertit la longitude NOAA 352° en 8° ouest',async()=>{
  const decoder=fakeDecoder();
  decoder.nearestGridpoint=()=>({index:1,latitude:48.5,longitude:352,distanceKm:0});
  const sample=await decodeWindPoint(Buffer.alloc(40),SAMPLE,decoder);
  assert.equal(sample.nearestGridpoint.longitude,-8);
});

test('aucune valeur affichée si les champs sont absents ou corrompus',async()=>{
  const decoder=fakeDecoder();
  decoder.parseFields=()=>[];
  await assert.rejects(decodeWindPoint(Buffer.alloc(40),SAMPLE,decoder),/incomplet/);
  const nan=fakeDecoder([0,NaN],[0,-12]);
  await assert.rejects(decodeWindPoint(Buffer.alloc(40),SAMPLE,nan),/absente/);
  const distant=fakeDecoder();
  distant.nearestGridpoint=()=>({index:1,latitude:39,longitude:-8,distanceKm:1000});
  await assert.rejects(decodeWindPoint(Buffer.alloc(40),SAMPLE,distant),/hors de la grille/);
});
