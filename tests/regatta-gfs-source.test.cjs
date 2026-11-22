'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {
  chooseCycle, buildUrl, inspectGrib2, readLimited, probe, MAX_BYTES
} = require('../netlify/functions/gfs-source-core.cjs');

function testMessage(parameter){
  // Message GRIB2 minimal synthétique pour tester uniquement la validation
  // de l'enveloppe et des métadonnées (pas un fichier météo complet).
  const section = Buffer.alloc(11);
  section.writeUInt32BE(11, 0);
  section[4] = 4; // Section Product Definition
  section[9] = 2; // discipline 0 / category 2 = momentum
  section[10] = parameter;
  const bytes = Buffer.alloc(16 + section.length + 4);
  bytes.write('GRIB', 0, 'ascii');
  bytes[6] = 0;
  bytes[7] = 2;
  bytes.writeBigUInt64BE(BigInt(bytes.length), 8);
  section.copy(bytes, 16);
  bytes.write('7777', bytes.length - 4, 'ascii');
  return bytes;
}
const winds = () => Buffer.concat([testMessage(2), testMessage(3)]);

test('cycle de départ conservateur pour la première vérification NOAA', ()=>{
  assert.deepEqual(chooseCycle(Date.parse('2026-11-22T08:00:00Z')),{
    date:'20261122', hour:'00', iso:'2026-11-22T00:00:00.000Z'
  });
  assert.equal(chooseCycle(Date.parse('2026-11-22T14:00:00Z')).hour, '06');
  assert.equal(chooseCycle(Date.parse('2026-11-22T07:59:59Z')).hour, '18');
});

test('URL NOAA f006 : vent 10m U/V + coordonnées atlantiques bornées', ()=>{
  const url=new URL(buildUrl(chooseCycle(Date.parse('2026-11-22T08:00:00Z'))));
  assert.equal(url.hostname,'nomads.ncep.noaa.gov');
  assert.equal(url.searchParams.get('file'),'gfs.t00z.pgrb2.0p25.f006');
  assert.equal(url.searchParams.get('dir'),'/gfs.20261122/00/atmos');
  assert.equal(url.searchParams.get('var_UGRD'),'on');
  assert.equal(url.searchParams.get('var_VGRD'),'on');
  assert.equal(url.searchParams.get('lev_10_m_above_ground'),'on');
  assert.equal(url.searchParams.get('subregion'),'');
  assert.equal(url.searchParams.get('leftlon'),'-20');
  assert.equal(url.searchParams.get('rightlon'),'5');
  assert.equal(url.searchParams.get('toplat'),'52');
  assert.equal(url.searchParams.get('bottomlat'),'40');
});

test('trois échéances GFS autorisées sur le même cycle',()=>{
 const cycle=chooseCycle(Date.parse('2026-11-22T08:00:00Z'));
 for(const hour of [6,12,18]){
   const url=new URL(buildUrl(cycle,hour));
   assert.equal(url.searchParams.get('file'),
     'gfs.t00z.pgrb2.0p25.f'+String(hour).padStart(3,'0'));
   assert.equal(url.searchParams.get('var_UGRD'),'on');
   assert.equal(url.searchParams.get('lev_10_m_above_ground'),'on');
 }
 assert.throws(()=>buildUrl(cycle,0),/Échéance GFS/);
 assert.throws(()=>buildUrl(cycle,120),/Échéance GFS/);
});

test('GRIB2 : exige les deux composantes du vent sans fabriquer des vitesses', ()=>{
  assert.deepEqual(inspectGrib2(winds()),{
    edition:2, messages:2, fields:2, variables:['UGRD','VGRD']
  });
  assert.throws(()=>inspectGrib2(testMessage(2)),/UGRD\/VGRD/);
  assert.throws(()=>inspectGrib2(Buffer.from('<html>NOAA unavailable</html>')),/non reconnue comme GRIB2/);
  const truncated=winds().subarray(0,winds().length-1);
  assert.throws(()=>inspectGrib2(truncated),/invalide/);
});

test('probe retourne une vérification structurale, jamais une prévision inventée', async()=>{
  const fetched=[];
  const fakeFetch=async url=>{
    fetched.push(url);
    return new Response(winds(),{status:200,headers:{'Content-Type':'application/octet-stream'}});
  };
  const data=await probe(fakeFetch,Date.parse('2026-11-22T08:00:00Z'));
  assert.equal(fetched.length,1);
  assert.equal(data.model,'GFS 0.25°');
  assert.equal(data.validUTC,'2026-11-22T06:00:00.000Z');
  assert.equal(data.sampledWind,false);
  assert.deepEqual(data.variables,['UGRD','VGRD']);
  assert.match(data.note,/aucun routage/);
});

test('pas de validation d’une réponse NOAA en erreur', async()=>{
  await assert.rejects(
    probe(async()=>new Response('Unavailable',{status:503}),Date.parse('2026-11-22T08:00:00Z')),
    /NOAA HTTP 503/
  );
});

test('limite de taille avant chargement intégral', async()=>{
  const response=new Response('abc',{status:200,headers:{'Content-Length':String(MAX_BYTES+1)}});
  await assert.rejects(readLimited(response),/trop volumineux/);
});
