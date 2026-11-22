'use strict';

/* Transport compact, réversible, des valeurs de grille GFS décodées.
   L'interface peut alors consulter un vent à N'IMPORTE QUEL point de la petite zone
   sans rappeler NOMADS pour chaque position du bateau. */
const {isTenMetreWind}=require('./gfs-wind-core.cjs');
const {validateGrid}=require('./gfs-spatial-core.cjs');
const MAX_GRID_POINTS=25000;

function packedValues(values,count){
  if(!values||values.length!==count||count<4||count>MAX_GRID_POINTS)
    throw Error('Nombre de valeurs météo incompatible avec la grille.');
  const out=Buffer.allocUnsafe(count*4);
  for(let i=0;i<count;i++){
    const value=values[i];
    if(typeof value!=='number'||(!Number.isFinite(value)&&!Number.isNaN(value)))
      throw Error('Valeur U/V GFS non numérique.');
    out.writeFloatLE(value,i*4);
  }
  return out.toString('base64');
}

async function decodePackedGfsGrid(bytes,decoder){
  if(!bytes||bytes.length<40)throw Error('Fichier GRIB2 manquant.');
  const grib=decoder||await import('@azohra/meteo.grib');
  const found={};
  for(const msg of grib.splitMessages(bytes)){
    for(const field of grib.parseFields(msg)){
      const product=grib.parseProduct(field.section4);
      if(!isTenMetreWind(field,product))continue;
      const variable=product.parameterNumber===2?'u':'v';
      if(found[variable])throw Error('Plusieurs champs '+variable+' : grille ambiguë.');
      const grid=grib.parseGrid(field.section3);
      validateGrid(grid);
      if(grid.numberOfDataPoints>MAX_GRID_POINTS)
        throw Error('Zone météo trop volumineuse pour ce prototype.');
      const values=grib.decodeFieldValues(field).values;
      found[variable]={grid,encoded:packedValues(values,grid.numberOfDataPoints)};
    }
  }
  if(!found.u||!found.v)throw Error('Champs UGRD/VGRD non décodés.');
  const u=found.u.grid,v=found.v.grid;
  if(u.gridKey!==v.gridKey||u.ni!==v.ni||u.nj!==v.nj||
      u.latitudeOfFirstGridPoint!==v.latitudeOfFirstGridPoint||
      u.longitudeOfFirstGridPoint!==v.longitudeOfFirstGridPoint)
    throw Error('Grilles GFS U/V différentes.');
  return {
    format:'float32le-base64',
    model:'GFS 0.25°',verifiedGrid:true,
    ni:u.ni,nj:u.nj,numberOfDataPoints:u.numberOfDataPoints,
    latitudeOfFirstGridPoint:u.latitudeOfFirstGridPoint,
    longitudeOfFirstGridPoint:u.longitudeOfFirstGridPoint,
    iDirectionIncrement:u.iDirectionIncrement,
    jDirectionIncrement:u.jDirectionIncrement,
    iScansNegatively:u.iScansNegatively,
    jScansPositively:u.jScansPositively,
    jPointsAreConsecutive:u.jPointsAreConsecutive,
    alternativeRowScanning:u.alternativeRowScanning,
    uBase64:found.u.encoded,
    vBase64:found.v.encoded
  };
}
module.exports={MAX_GRID_POINTS,packedValues,decodePackedGfsGrid};
