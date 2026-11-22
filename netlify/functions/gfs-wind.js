'use strict';

const {
  chooseCycle,buildUrl,inspectGrib2,readLimited,MAX_BYTES,FORECAST_HOURS
}=require('./gfs-source-core.cjs');
const {decodeWindPoints,SITES}=require('./gfs-wind-core.cjs');
const {decodeWindSpatialPoints,SPATIAL_SITE,TRACK_SITES}=require('./gfs-spatial-core.cjs');
const {decodePackedGfsGrid}=require('./gfs-grid-core.cjs');

// Chaque clic = une seule échéance météo, trois points échantillonnés.
// Limiter l'accès NOMADS (cache et espacement >= 10 s par instance).
const TTL_OK=15*60*1000;
const TTL_FAIL=3*60*1000;
const NOAA_MIN_INTERVAL_MS=10000;
const cache=new Map();
const pending=new Map();
let lastNoaaRequestAt=-Infinity;

function respond(statusCode,data){
  return {statusCode,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
  },body:JSON.stringify(data)};
}

function selectForecastHour(event) {
  const raw=event?.queryStringParameters?.forecastHour;
  if (raw===undefined||raw===null||raw==='') return 6;
  if (typeof raw!=='string'||!/^(6|12|18)$/.test(raw)) return null;
  const hour=Number(raw);
  return FORECAST_HOURS.includes(hour)?hour:null;
}

async function retrieveWind(cycle,forecastHour){
  const url=buildUrl(cycle,forecastHour);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{
      Accept:'application/octet-stream','User-Agent':'Rapli-Regatta-GFS-Lab/1.0'
    }});
    if(!response.ok) throw Error('Source NOAA indisponible (HTTP '+response.status+').');
    const file=await readLimited(response,MAX_BYTES);
    const metadata=inspectGrib2(file);
    const points=await decodeWindPoints(file,SITES);
    let spatial=null,trackSamples=null,spatialError=null;
    try{
      const sampled=await decodeWindSpatialPoints(file,[SPATIAL_SITE,...TRACK_SITES]);
      spatial=sampled[0];
      trackSamples=sampled.slice(1).map((sample,i)=>({
        ...sample,forecastHour:TRACK_SITES[i].forecastHour
      }));
    }catch(error){
      // Protect previously validated 3 nearest-neighbor NOAA readings.
      spatialError=String(error?.message||error).slice(0,130);
    }
    // On fournit également la grille compacte aux tests de déplacement.
    // Chaque clic reste un seul appel NOAA, même pour f018.
    let motionGrid=null,motionGridError=null;
    if(forecastHour===6||forecastHour===12||forecastHour===18){
      try{
        motionGrid=await decodePackedGfsGrid(file);
      }catch(error){
        motionGridError=String(error?.message||error).slice(0,160);
      }
    }
    return {
      source:'NOAA NOMADS',model:'GFS 0,25°',
      cycleUTC:cycle.iso,forecastHour,
      validUTC:new Date(Date.parse(cycle.iso)+forecastHour*3600000).toISOString(),
      bounds:{top:52,bottom:40,left:-20,right:5},
      fileBytes:file.length,fields:metadata.variables,messages:metadata.messages,points,spatial,trackSamples,spatialError,motionGrid,motionGridError,
      // Compatibilité des clients utilisant l'ancienne lecture au large de Brest.
      wind:points[0]
    };
  }finally{
    clearTimeout(timer);
  }
}

exports.handler=async function handler(event){
  if(event.httpMethod!=='GET') return respond(405,{ok:false,error:'Méthode non autorisée.'});
  const forecastHour=selectForecastHour(event);
  if(forecastHour===null) return respond(400,{ok:false,error:'Échéance météo non autorisée.'});
  const cycle=chooseCycle();
  const key=cycle.iso+':'+forecastHour;
  const now=Date.now();
  const cached=cache.get(key);
  if(cached&&now<cached.expiresAt) return respond(cached.statusCode,{...cached.body,cached:true});
  if(pending.has(key)){
    const shared=await pending.get(key);
    return respond(shared.statusCode,{...shared.body,cached:false});
  }
  const remaining=NOAA_MIN_INTERVAL_MS-(now-lastNoaaRequestAt);
  if(remaining>0) return respond(429,{
    ok:false,error:'NOAA : patienter '+Math.ceil(remaining/1000)+' s avant une nouvelle échéance.',
    retryAfterSeconds:Math.ceil(remaining/1000)
  });

  lastNoaaRequestAt=now;
  const task=retrieveWind(cycle,forecastHour).then(
    data=>{
      const entry={statusCode:200,body:{ok:true,...data},expiresAt:Date.now()+TTL_OK};
      cache.set(key,entry);return entry;
    },
    err=>{
      const entry={statusCode:503,body:{
        ok:false,error:'Vent GFS non vérifié : '+String(err?.message||err).slice(0,200)
      },expiresAt:Date.now()+TTL_FAIL};
      cache.set(key,entry);return entry;
    }
  ).finally(()=>pending.delete(key));
  pending.set(key,task);
  const result=await task;
  return respond(result.statusCode,{...result.body,cached:false});
};

// Fonctions de contrôle exportées pour les tests automatisés (sans requête NOAA).
exports.selectForecastHour=selectForecastHour;
