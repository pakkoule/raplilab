'use strict';

/* Interpolation bilinéaire spatiale sur une grille GFS régulière 0,25°.
   Ne jamais assimiler un point NOAA voisin à une mesure au point demandé. */
const {isTenMetreWind,windFromComponents}=require('./gfs-wind-core.cjs');

const SPATIAL_SITE=Object.freeze({
  latitude:47.125,longitude:-9.125,
  label:'Golfe de Gascogne · point intermédiaire'
});
const EPS=1e-8;
const CORNER_TOLERANCE_KM=0.2;

function normalize360(value){
  return ((value%360)+360)%360;
}
function validateGrid(grid){
  if(!grid||grid.kind!=='latlon'||grid.gridDefinitionTemplateNumber!==0||
    !Number.isInteger(grid.ni)||!Number.isInteger(grid.nj)||
    grid.ni<2||grid.nj<2||grid.ni*grid.nj!==grid.numberOfDataPoints||
    !Number.isFinite(grid.latitudeOfFirstGridPoint)||
    !Number.isFinite(grid.longitudeOfFirstGridPoint)||
    Math.abs(grid.iDirectionIncrement-0.25)>1e-6||
    Math.abs(grid.jDirectionIncrement-0.25)>1e-6||
    grid.uvRelativeToGrid===true
  )throw Error('Grille GFS 0,25° régulière non vérifiée.');
}

function cornersForSite(grid,site){
  validateGrid(grid);
  if(!site||!Number.isFinite(site.latitude)||!Number.isFinite(site.longitude)||
    Math.abs(site.latitude)>90||site.longitude< -180||site.longitude>180)
    throw Error('Coordonnées spatiales invalides.');
  const iSign=grid.iScansNegatively?-1:1;
  const jSign=grid.jScansPositively?1:-1;
  const x=normalize360((site.longitude-grid.longitudeOfFirstGridPoint)*iSign)/
    grid.iDirectionIncrement;
  const y=(site.latitude-grid.latitudeOfFirstGridPoint)/(jSign*grid.jDirectionIncrement);
  if(x< -EPS||y< -EPS||x>grid.ni-1+EPS||y>grid.nj-1+EPS)
    throw Error('Interpolation hors de la zone NOAA téléchargée.');
  const xx=Math.min(grid.ni-1,Math.max(0,x));
  const yy=Math.min(grid.nj-1,Math.max(0,y));
  const c0=Math.floor(xx),c1=Math.min(grid.ni-1,c0+1);
  const r0=Math.floor(yy),r1=Math.min(grid.nj-1,r0+1);
  const fx=xx-c0,fy=yy-r0;
  const coords=(c,r)=>({
    latitude:grid.latitudeOfFirstGridPoint+r*jSign*grid.jDirectionIncrement,
    longitude:normalize360(grid.longitudeOfFirstGridPoint+c*iSign*grid.iDirectionIncrement)
  });
  return [
    {position:coords(c0,r0),weight:(1-fx)*(1-fy)},
    {position:coords(c1,r0),weight:fx*(1-fy)},
    {position:coords(c0,r1),weight:(1-fx)*fy},
    {position:coords(c1,r1),weight:fx*fy}
  ];
}

function sampleBilinear(grib,grid,values,site){
  if(!values||values.length!==grid.numberOfDataPoints)
    throw Error('Taille de grille GFS incompatible avec les données du vent.');
  let sum=0;
  const corners=cornersForSite(grid,site);
  for(const corner of corners){
    if(corner.weight===0)continue;
    const match=grib.nearestGridpoint(grid,corner.position.latitude,corner.position.longitude);
    if(!match||!Number.isInteger(match.index)||
      !Number.isFinite(match.distanceKm)||match.distanceKm>CORNER_TOLERANCE_KM)
      throw Error('Coin de maille GFS inaccessible.');
    const value=values[match.index];
    if(!Number.isFinite(value))throw Error('Vent GFS manquant dans une maille voisine.');
    sum+=corner.weight*value;
  }
  return sum;
}

async function decodeWindSpatial(bytes,site=SPATIAL_SITE,decoder){
  if(!bytes||bytes.length<40)throw Error('GRIB2 manquant ou trop court.');
  const grib=decoder||await import('@azohra/meteo.grib');
  const found={};
  for(const message of grib.splitMessages(bytes)){
    for(const field of grib.parseFields(message)){
      const product=grib.parseProduct(field.section4);
      if(!isTenMetreWind(field,product))continue;
      const key=product.parameterNumber===2?'U':'V';
      if(found[key])throw Error('Plusieurs champs GFS '+key+' : lecture ambiguë.');
      const grid=grib.parseGrid(field.section3);
      validateGrid(grid);
      const decoded=grib.decodeFieldValues(field);
      found[key]={grid,value:sampleBilinear(grib,grid,decoded.values,site)};
    }
  }
  if(!found.U||!found.V)throw Error('Champs U/V à 10 m incomplets.');
  const a=found.U.grid,b=found.V.grid;
  if(a.gridKey!==b.gridKey||
    a.ni!==b.ni||a.nj!==b.nj||
    a.latitudeOfFirstGridPoint!==b.latitudeOfFirstGridPoint||
    a.longitudeOfFirstGridPoint!==b.longitudeOfFirstGridPoint)
    throw Error('Maillages U/V incompatibles.');
  return {
    site:{label:site.label,latitude:site.latitude,longitude:site.longitude},
    ...windFromComponents(found.U.value,found.V.value),
    spatiallyInterpolated:true,verifiedWind:true,
    gridResolutionDegrees:0.25,method:'Interpolation bilinéaire spatiale U/V GFS'
  };
}

module.exports={SPATIAL_SITE,validateGrid,cornersForSite,sampleBilinear,decodeWindSpatial};
