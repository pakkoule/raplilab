'use strict';

/**
 * Diagnostic météo GFS 0,25° : lecture des vecteurs du vent réel aux points
 * d'une petite grille Atlantique. Pas de simulation de route dans ce module.
 */
const SAMPLE = Object.freeze({latitude:48.5,longitude:-8,label:'Atlantique · au large de Brest'});
const SITES = Object.freeze([
  SAMPLE,
  Object.freeze({latitude:44.5,longitude:-12,label:'Golfe de Gascogne · ouest'}),
  Object.freeze({latitude:41.5,longitude:-15,label:'Atlantique · au large du Portugal'})
]);
const MS_TO_KNOTS=1.9438444924406;
const MAX_DISTANCE_KM=35;

function windFromComponents(u,v) {
  if (!Number.isFinite(u)||!Number.isFinite(v)||Math.abs(u)>100||Math.abs(v)>100)
    throw new Error('Composantes du vent invalides.');
  const speedMs=Math.hypot(u,v);
  const directionFromDeg=(Math.atan2(-u,-v)*180/Math.PI+360)%360;
  return {
    uMs:Math.round(u*100)/100,
    vMs:Math.round(v*100)/100,
    speedMs:Math.round(speedMs*100)/100,
    speedKnots:Math.round(speedMs*MS_TO_KNOTS*10)/10,
    directionFromDeg:Math.round(directionFromDeg*10)/10
  };
}

function isTenMetreWind(field,product) {
  if (Number(field.discipline)!==0||product.parameterCategory!==2||
      ![2,3].includes(product.parameterNumber)) return false;
  const s=field.section4;
  // Product Definition Template 4.0, surface 103 (10 m above ground).
  if (!s||s.length<28||s[7]!==0||s[8]!==0||s[22]!==103||s[23]===255) return false;
  const scale=s[23]&0x7f;
  const negativeScale=(s[23]&0x80)!==0;
  if (s[24]&0x80) return false;
  const raw=(s[24]&0x7f)*16777216+s[25]*65536+s[26]*256+s[27];
  const height=raw*Math.pow(10,negativeScale?scale:-scale);
  return Math.abs(height-10)<0.001;
}

function westEastLongitude(longitude) {
  return ((longitude+180)%360+360)%360-180;
}

async function decodeWindPoints(bytes,sites=SITES,decoder) {
  if (!bytes||bytes.length<40) throw new Error('Fichier GRIB2 manquant ou trop court.');
  if (!Array.isArray(sites)||sites.length<1||sites.length>8 ||
      sites.some(s=>!Number.isFinite(s.latitude)||!Number.isFinite(s.longitude)||
      !Number.isFinite(Math.abs(s.latitude))||Math.abs(s.latitude)>90||
      s.longitude < -180||s.longitude > 180)) {
    throw new Error('Coordonnées météo invalides.');
  }
  const grib=decoder||await import('@azohra/meteo.grib');
  const selected={};
  for (const message of grib.splitMessages(bytes)) {
    for (const field of grib.parseFields(message)) {
      const product=grib.parseProduct(field.section4);
      if (!isTenMetreWind(field,product)) continue;
      const key=product.parameterNumber===2?'UGRD':'VGRD';
      if (selected[key]) throw new Error('Plusieurs champs '+key+' : ambiguïté du fichier.');
      const grid=grib.parseGrid(field.section3);
      const decoded=grib.decodeFieldValues(field);
      selected[key]=sites.map(site=>{
        const nearest=grib.nearestGridpoint(grid,site.latitude,site.longitude);
        if (!nearest||!Number.isInteger(nearest.index)||
            !Number.isFinite(nearest.latitude)||!Number.isFinite(nearest.longitude)||
            !Number.isFinite(nearest.distanceKm)||nearest.distanceKm>MAX_DISTANCE_KM) {
          throw new Error('Point demandé hors de la grille NOAA sélectionnée.');
        }
        const value=decoded.values[nearest.index];
        if (!Number.isFinite(value)) throw new Error('Valeur '+key+' absente de la grille.');
        return {nearest,value};
      });
    }
  }
  if (!selected.UGRD||!selected.VGRD) throw new Error('Décodage incomplet : UGRD et VGRD à 10 m sont indispensables.');
  return sites.map((site,i)=>{
    const u=selected.UGRD[i],v=selected.VGRD[i];
    if (u.nearest.index!==v.nearest.index||
        Math.abs(u.nearest.latitude-v.nearest.latitude)>0.00001||
        Math.abs(westEastLongitude(u.nearest.longitude)-westEastLongitude(v.nearest.longitude))>0.00001) {
      throw new Error('Grilles UGRD et VGRD incompatibles.');
    }
    return {
      site:{label:site.label||'Point météo',latitude:site.latitude,longitude:site.longitude},
      nearestGridpoint:{
        latitude:u.nearest.latitude,
        longitude:westEastLongitude(u.nearest.longitude),
        distanceKm:Math.round(u.nearest.distanceKm*100)/100
      },
      ...windFromComponents(u.value,v.value),
      method:'GRIB2 décodé · plus proche point de grille',
      verifiedWind:true
    };
  });
}

async function decodeWindPoint(bytes,site=SAMPLE,decoder) {
  return (await decodeWindPoints(bytes,[site],decoder))[0];
}

module.exports={SAMPLE,SITES,MS_TO_KNOTS,MAX_DISTANCE_KM,windFromComponents,isTenMetreWind,westEastLongitude,decodeWindPoint,decodeWindPoints};
