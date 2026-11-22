'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {packedValues,decodePackedGfsGrid,MAX_GRID_POINTS}
  =require('../netlify/functions/gfs-grid-core.cjs');
const {decodeBase64Float32}=require('../regatta/gfs-motion.js');
function product(parameter){
 const s=Buffer.alloc(34);
 s[4]=4;s[7]=0;s[8]=0;s[9]=2;s[10]=parameter;
 s[22]=103;s[23]=0;s.writeUInt32BE(10,24);
 return s;
}
test('grille GFS U/V encodée Float32LE et décodée sans altérer les valeurs',async()=>{
 const a=product(2),b=product(3);
 const u=[2.5,3.5,-2,0],v=[-1,-2,-3,-4];
 const grid={kind:'latlon',gridDefinitionTemplateNumber:0,gridKey:'gfs',
   ni:2,nj:2,numberOfDataPoints:4,
   latitudeOfFirstGridPoint:48.5,longitudeOfFirstGridPoint:352,
   iDirectionIncrement:.25,jDirectionIncrement:.25,
   iScansNegatively:false,jScansPositively:false,
   jPointsAreConsecutive:false,alternativeRowScanning:false,uvRelativeToGrid:false
 };
 const fields=[{discipline:0,section4:a,section3:Buffer.from([3])},
   {discipline:0,section4:b,section3:Buffer.from([3])}];
 const decoder={
   splitMessages:()=>[Buffer.alloc(40)],
   parseFields:()=>fields,
   parseProduct:s=>({parameterCategory:2,parameterNumber:s===a?2:3}),
   parseGrid:()=>grid,
   decodeFieldValues:f=>({values:f===fields[0]?u:v})
 };
 const data=await decodePackedGfsGrid(Buffer.alloc(40),decoder);
 assert.equal(data.verifiedGrid,true);
 assert.equal(data.format,'float32le-base64');
 assert.deepEqual([...decodeBase64Float32(data.uBase64,4)],u);
 assert.deepEqual([...decodeBase64Float32(data.vBase64,4)],v);
 assert.equal(data.ni,2);
 assert.equal(data.longitudeOfFirstGridPoint,352);
});
test('refuse des données de taille incohérente ou infinies',()=>{
 assert.throws(()=>packedValues([1,2,3],4),/nombre de valeurs/i);
 assert.throws(()=>packedValues([1,Infinity,2,3],4),/non numérique/);
 assert.throws(()=>packedValues(new Array(MAX_GRID_POINTS+1).fill(0),MAX_GRID_POINTS+1),/nombre de valeurs/i);
});
