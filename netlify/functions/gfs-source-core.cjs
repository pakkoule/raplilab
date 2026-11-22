'use strict';

/**
 * Diagnostic de transfert GRIB2 NOAA (PAS un décodeur de valeurs de vent).
 * Un seul fichier/une seule échéance par vérification pour respecter NOMADS.
 */
const SOURCE = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl';
const BOUNDS = Object.freeze({top: 52, bottom: 40, left: -20, right: 5});
const HOUR_MS = 60 * 60 * 1000;
const MAX_BYTES = 4 * 1024 * 1024;
const FORECAST_HOUR = 6;
const FORECAST_HOURS = Object.freeze([6, 12, 18, 24, 30]);

function chooseCycle(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) throw new Error('Horodatage invalide.');
  // Fichier f006 choisi sur un cycle vieux d'au moins 8 h :
  // estimation prudente pour ce test, pas un détecteur de publication.
  const slot = Math.floor((nowMs - 8 * HOUR_MS) / (6 * HOUR_MS)) * 6 * HOUR_MS;
  const date = new Date(slot);
  return {
    date: date.toISOString().slice(0, 10).replace(/-/g, ''),
    hour: date.toISOString().slice(11, 13),
    iso: date.toISOString()
  };
}

function buildUrl(cycle, forecastHour = FORECAST_HOUR) {
  if (!FORECAST_HOURS.includes(forecastHour)) throw new Error('Échéance GFS non autorisée.');
  if (!/^\d{8}$/.test(cycle.date) || !/^(00|06|12|18)$/.test(cycle.hour)) {
    throw new Error('Cycle GFS invalide.');
  }
  const params = new URLSearchParams({
    dir: '/gfs.' + cycle.date + '/' + cycle.hour + '/atmos',
    file: 'gfs.t' + cycle.hour + 'z.pgrb2.0p25.f' + String(forecastHour).padStart(3, '0'),
    var_UGRD: 'on',
    var_VGRD: 'on',
    lev_10_m_above_ground: 'on',
    subregion: '',
    toplat: String(BOUNDS.top),
    bottomlat: String(BOUNDS.bottom),
    leftlon: String(BOUNDS.left),
    rightlon: String(BOUNDS.right)
  });
  return SOURCE + '?' + params.toString();
}

function inspectGrib2(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('Le fichier GRIB doit être un Buffer.');
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'GRIB') {
    throw new Error('Réponse NOAA non reconnue comme GRIB2 (éventuellement HTML).');
  }
  const fields = [];
  let offset = 0, messages = 0;
  while (offset < bytes.length) {
    if (offset + 20 > bytes.length || bytes.toString('ascii', offset, offset + 4) !== 'GRIB' ||
        bytes[offset + 7] !== 2) throw new Error('Message GRIB2 invalide.');
    const n = Number(bytes.readBigUInt64BE(offset + 8));
    const end = offset + n;
    if (!Number.isSafeInteger(n) || n < 20 || end > bytes.length ||
        bytes.toString('ascii', end - 4, end) !== '7777') {
      throw new Error('Taille ou fin de message GRIB2 invalide.');
    }
    let cursor = offset + 16;
    while (cursor < end - 4) {
      if (cursor + 5 > end - 4) throw new Error('Section GRIB2 tronquée.');
      const len = bytes.readUInt32BE(cursor);
      if (len < 5 || cursor + len > end - 4) throw new Error('Taille de section GRIB2 invalide.');
      const section = bytes[cursor + 4];
      if (section === 4 && len >= 11 && bytes[offset + 6] === 0) {
        // GRIB2 discipline=0, catégorie 2, paramètre 2 = UGRD, 3 = VGRD.
        const category = bytes[cursor + 9], parameter = bytes[cursor + 10];
        if (category === 2 && (parameter === 2 || parameter === 3)) {
          fields.push(parameter === 2 ? 'UGRD' : 'VGRD');
        }
      }
      cursor += len;
    }
    if (cursor !== end - 4) throw new Error('Sections GRIB2 incomplètes.');
    messages += 1;
    offset = end;
  }
  const variables = [...new Set(fields)];
  if (!variables.includes('UGRD') || !variables.includes('VGRD')) {
    throw new Error('GRIB2 lisible mais paire UGRD/VGRD à 10 m non vérifiée.');
  }
  return {edition: 2, messages, fields: fields.length, variables};
}

async function readLimited(response, maxBytes = MAX_BYTES) {
  const size = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(size) && size > maxBytes) throw new Error('Fichier NOAA trop volumineux pour ce test.');
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > maxBytes) throw new Error('Fichier NOAA trop volumineux pour ce test.');
    return buf;
  }
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw new Error('Fichier NOAA trop volumineux pour ce test.');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    try { await reader.cancel(); } catch (_) { /* lecteur déjà clos */ }
  }
}

async function probe(fetcher = globalThis.fetch, nowMs = Date.now()) {
  const cycle = chooseCycle(nowMs);
  const url = buildUrl(cycle);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {Accept: 'application/octet-stream', 'User-Agent': 'Rapli-Regatta-GFS-Probe/1.0'}
    });
    if (!response.ok) throw new Error('NOAA HTTP ' + response.status);
    const data = await readLimited(response);
    const result = inspectGrib2(data);
    return {
      source: 'NOAA NOMADS',
      model: 'GFS 0.25°',
      cycleUTC: cycle.iso,
      forecastHour: FORECAST_HOUR,
      validUTC: new Date(Date.parse(cycle.iso) + FORECAST_HOUR * HOUR_MS).toISOString(),
      bounds: BOUNDS,
      fileBytes: data.length,
      ...result,
      downloadUrl: url,
      sampledWind: false,
      note: 'GRIB2 vérifié, valeurs de vent non décodées : aucun routage calculé.'
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {SOURCE, BOUNDS, MAX_BYTES, FORECAST_HOUR, FORECAST_HOURS, chooseCycle, buildUrl, inspectGrib2, readLimited, probe};
