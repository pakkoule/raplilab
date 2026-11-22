'use strict';

const {probe} = require('./gfs-source-core.cjs');

// Un cache en mémoire par instance évite des requêtes NOAA répétées
// à chaque visite ou rechargement de la page. Pas de boucle de polling.
const TTL_MS = 15 * 60 * 1000;
let lastSuccess = null;
let expiresAt = 0;
let inFlight = null;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, {ok: false, error: 'Méthode non autorisée.'});
  if (lastSuccess && Date.now() < expiresAt) {
    return json(200, {ok: true, cached: true, ...lastSuccess});
  }
  if (!inFlight) {
    inFlight = probe()
      .then(result => {
        lastSuccess = {checkedAt: new Date().toISOString(), ...result};
        expiresAt = Date.now() + TTL_MS;
        return lastSuccess;
      })
      .finally(() => { inFlight = null; });
  }
  try {
    return json(200, {ok: true, cached: false, ...await inFlight});
  } catch (error) {
    const message = String(error?.message || 'Échec inconnu').slice(0, 180);
    return json(503, {
      ok: false,
      error: 'La source GFS n’a pas pu être vérifiée : ' + message,
      note: 'Pas de données météo inventées : réessayer plus tard.'
    });
  }
};
