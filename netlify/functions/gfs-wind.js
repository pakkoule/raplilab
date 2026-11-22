'use strict';

const {
  chooseCycle, buildUrl, inspectGrib2, readLimited, MAX_BYTES
} = require('./gfs-source-core.cjs');
const {decodeWindPoint, SAMPLE} = require('./gfs-wind-core.cjs');

// L'analyse n'est lancée que par un clic. Aucun sondage automatique NOAA.
// Cache par instance, y compris des erreurs pour éviter les répétitions rapides.
const TTL_OK = 15 * 60 * 1000;
const TTL_FAIL = 3 * 60 * 1000;
let last = null;
let expiresAt = 0;
let pending = null;

function respond(statusCode, data) {
  return {statusCode, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
  }, body:JSON.stringify(data)};
}

async function retrieveWind() {
  const cycle = chooseCycle();
  const url = buildUrl(cycle);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal:controller.signal,
      headers:{Accept:'application/octet-stream', 'User-Agent':'Rapli-Regatta-GFS-Lab/1.0'}
    });
    if (!response.ok) throw Error('Source NOAA indisponible (HTTP ' + response.status + ').');
    const file = await readLimited(response, MAX_BYTES);
    const metadata = inspectGrib2(file);
    const wind = await decodeWindPoint(file, SAMPLE);
    return {
      source:'NOAA NOMADS', model:'GFS 0,25°',
      cycleUTC:cycle.iso, forecastHour:6,
      validUTC:new Date(Date.parse(cycle.iso) + 6*3600000).toISOString(),
      bounds:{top:52,bottom:40,left:-20,right:5},
      fileBytes:file.length, fields:metadata.variables,
      wind
    };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return respond(405,{ok:false,error:'Méthode non autorisée.'});
  }
  const current = Date.now();
  if (last && current < expiresAt) {
    return respond(last.statusCode,{...last.body,cached:true});
  }
  if (!pending) {
    pending = retrieveWind().then(
      data => {
        last = {statusCode:200,body:{ok:true,...data}};
        expiresAt = Date.now() + TTL_OK;
        return last;
      },
      err => {
        last = {
          statusCode:503,
          body:{ok:false,error:'Vent GFS non vérifié : '+String(err?.message||err).slice(0,220)}
        };
        expiresAt = Date.now() + TTL_FAIL;
        return last;
      }
    ).finally(()=>{pending=null;});
  }
  const result = await pending;
  return respond(result.statusCode,{...result.body,cached:false});
};
