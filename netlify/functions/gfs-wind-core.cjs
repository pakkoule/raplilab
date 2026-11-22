'use strict';

/**
 * Étape 2 du laboratoire GFS : décodage d'un vrai point météo sur la grille.
 * L'interface n'utilise jamais d'estimation inventée en cas d'erreur de décodage.
 */
const SAMPLE = Object.freeze({latitude: 48.5, longitude: -8, label: 'Atlantique · au large de Brest'});
const MS_TO_KNOTS = 1.9438444924406;
const MAX_DISTANCE_KM = 35;

function windFromComponents(u, v) {
  if (!Number.isFinite(u) || !Number.isFinite(v) || Math.abs(u) > 100 || Math.abs(v) > 100) {
    throw new Error('Composantes du vent invalides.');
  }
  const speedMs = Math.hypot(u, v);
  // Convention météo : angle d'où vient le vent, compté depuis le nord.
  const directionFromDeg = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  return {
    uMs: Math.round(u * 100) / 100,
    vMs: Math.round(v * 100) / 100,
    speedMs: Math.round(speedMs * 100) / 100,
    speedKnots: Math.round(speedMs * MS_TO_KNOTS * 10) / 10,
    directionFromDeg: Math.round(directionFromDeg * 10) / 10
  };
}

function isTenMetreWind(field, product) {
  if (Number(field.discipline) !== 0 || product.parameterCategory !== 2 ||
      ![2, 3].includes(product.parameterNumber)) return false;
  // Surface 103 = altitude au-dessus du sol. Template 4.0, octets 23–28.
  const s = field.section4;
  if (!s || s.length < 28 || s[22] !== 103 || s[23] === 255) return false;
  const scale = s[23] & 0x7f;
  const negativeScale = (s[23] & 0x80) !== 0;
  const raw = ((s[24] & 0x7f) * 16777216 + s[25] * 65536 + s[26] * 256 + s[27]);
  if (s[24] & 0x80) return false;
  const height = raw * Math.pow(10, negativeScale ? scale : -scale);
  return Math.abs(height - 10) < 0.001;
}

async function decodeWindPoint(bytes, site = SAMPLE, decoder) {
  if (!bytes || bytes.length < 40) throw new Error('Fichier GRIB2 manquant ou trop court.');
  const grib = decoder || await import('@azohra/meteo.grib');
  const chosen = {};
  for (const message of grib.splitMessages(bytes)) {
    for (const field of grib.parseFields(message)) {
      const product = grib.parseProduct(field.section4);
      if (!isTenMetreWind(field, product)) continue;
      const key = product.parameterNumber === 2 ? 'UGRD' : 'VGRD';
      if (chosen[key]) throw new Error('Plusieurs champs ' + key + ' : ambiguïté du fichier.');
      const grid = grib.parseGrid(field.section3);
      const nearest = grib.nearestGridpoint(grid, site.latitude, site.longitude);
      if (!nearest || !Number.isFinite(nearest.distanceKm) ||
          nearest.distanceKm > MAX_DISTANCE_KM) {
        throw new Error('Point demandé hors de la grille NOAA sélectionnée.');
      }
      const decoded = grib.decodeFieldValues(field);
      const value = decoded.values[nearest.index];
      if (!Number.isFinite(value)) throw new Error('Valeur ' + key + ' absente de la grille.');
      chosen[key] = {value, nearest, grid};
    }
  }
  if (!chosen.UGRD || !chosen.VGRD) {
    throw new Error('Décodage incomplet : UGRD et VGRD à 10 m sont indispensables.');
  }
  const u = chosen.UGRD;
  const v = chosen.VGRD;
  if (u.nearest.index !== v.nearest.index ||
      Math.abs(u.nearest.latitude - v.nearest.latitude) > 0.00001 ||
      Math.abs(u.nearest.longitude - v.nearest.longitude) > 0.00001) {
    throw new Error('Grilles UGRD et VGRD incompatibles.');
  }
  return {
    site: {label:site.label, latitude:site.latitude, longitude:site.longitude},
    nearestGridpoint: {
      latitude: u.nearest.latitude,
      longitude: u.nearest.longitude,
      distanceKm: Math.round(u.nearest.distanceKm * 100) / 100
    },
    ...windFromComponents(u.value, v.value),
    method: 'GRIB2 décodé · plus proche point de grille',
    verifiedWind: true
  };
}

module.exports = {SAMPLE, MS_TO_KNOTS, MAX_DISTANCE_KM, windFromComponents, isTenMetreWind, decodeWindPoint};
