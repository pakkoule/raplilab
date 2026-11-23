/* Rapli Archives — Détective de références (analyse locale, sans effet de bord).
   Une référence consécutive n'est pas un doublon : les suffixes numériques
   doivent coïncider, sauf confusion visuelle explicite O/0 ou I/1.
*/
(function (root) {
  'use strict';
  const normalize = value => String(value == null ? '' : value).normalize('NFKC').trim().toUpperCase();
  const compact = value => normalize(value).replace(/[^A-Z0-9]/g, '');
  const visual = value => compact(value).replace(/O/g, '0').replace(/I/g, '1');
  const normMeta = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, ' ');
  const identityFields = ['rarity', 'artwork', 'language', 'market', 'nameColor', 'editionStatus', 'sourceDate'];
  function editDistanceAtMostOne(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, mistakes = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++mistakes > 1) return false;
      if (a.length >= b.length) i++;
      if (a.length <= b.length) j++;
    }
    return mistakes + (a.length - i) + (b.length - j) <= 1;
  }
  function relation(a, b) {
    const x = compact(a), y = compact(b);
    if (!x || !y) return null;
    if (x === y) return normalize(a) === normalize(b) ? 'exact' : 'format';
    if (x.length >= 4 && y.length >= 4 && visual(x) === visual(y)) return 'visuel';
    // Prefix typo only, with the SAME numerical suffix. This deliberately
    // excludes SDK-001 vs SDK-002 and other ordinary adjacent cards.
    const p = /^([A-Z][A-Z0-9]*?[A-Z])(\d+[A-Z]?)$/.exec(x);
    const q = /^([A-Z][A-Z0-9]*?[A-Z])(\d+[A-Z]?)$/.exec(y);
    if (p && q && p[2] === q[2] &&
        Math.min(p[1].length, q[1].length) >= 3 &&
        p[1].slice(0, 2) === q[1].slice(0, 2) &&
        editDistanceAtMostOne(p[1], q[1])) return 'prefixe';
    return null;
  }
  function scan(variants, groups, filters) {
    const groupNames = new Map((groups || []).map(g => [String(g.id), String(g.name || '')]));
    const edition = v => v.edition || groupNames.get(String(v.groupId)) || '';
    const rows = (variants || []).filter(v => v && v.id != null && compact(v.reference));
    const selected = v => Object.entries(filters || {}).every(([key, value]) =>
      !value || normMeta(key === 'edition' ? edition(v) : v[key]) === normMeta(value));
    const matches = [];
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        if (String(a.id) === String(b.id)) continue;
        if (!selected(a) && !selected(b)) continue;
        const type = relation(a.reference, b.reference);
        if (!type) continue;
        // Two explicitly different printings are valid variants, not duplicates.
        if (normMeta(edition(a)) && normMeta(edition(b)) && normMeta(edition(a)) !== normMeta(edition(b))) continue;
        if (identityFields.some(key => normMeta(a[key]) && normMeta(b[key]) && normMeta(a[key]) !== normMeta(b[key]))) continue;
        const ordered = [a, b].sort((u, v) => String(u.id).localeCompare(String(v.id)));
        const fingerprint = JSON.stringify(ordered.map(v => [
          String(v.id), compact(v.reference), normMeta(edition(v)),
          ...identityFields.map(key => normMeta(v[key]))
        ]));
        matches.push({
          key: ordered.map(v => String(v.id)).join('||'), a, b, type, fingerprint
        });
      }
    }
    const order = {exact: 0, format: 1, visuel: 2, prefixe: 3};
    matches.sort((a, b) => order[a.type] - order[b.type] ||
      String(a.a.reference).localeCompare(String(b.a.reference), 'fr', {numeric: true}));
    return matches;
  }
  root.RapliReferenceDetective = Object.freeze({scan});
})(typeof window === 'undefined' ? globalThis : window);
