# Rapli Top 10 — implémentation PR #1

Module : `top10`. Page directe : `top10/index.html`. Intégration dans le portail racine : `#top10`.

## Périmètre V1

- Éditeur direct : liste numérotée à 10 positions initiales ; ajout, retrait, réorganisation par flèches ou glisser-déposer.
- Champs par position : nom (obligatoire à l'export), image, sous-titre, description, logo secondaire, score libre.
- Présentations Classique, Visuel et Podium ; thèmes Magazine, Sport, Minimaliste, Vintage.
- Colonnes automatiques ou manuelles ; texte replié et hauteur adaptative.
- PNG unique 1 080 px de largeur logique, résolution ×1/×2/×3/×4. Une limite prudente de **16 mégapixels** empêche les exports trop grands, particulièrement sur Safari iPhone.
- Bibliothèque avec recherche/tri, renommage, duplication de classement entier, suppression. Sauvegarde **manuelle** dans IndexedDB puis Supabase.
- Logo user-provided, transparence conservée, identité ivoire/marine.

## Supabase

La table déjà existante `public.rapli_module_collections` reste utilisée, sous les politiques RLS et le bucket privé existants.

- Nouvelle clé de module autorisée par ajout non destructif à la contrainte : `top10`.
- `shared/module-cloud.js` permet désormais `top10`, en mode **manualOnly** comme `tiers`.
- Photos et logos sont exportés en WebP lors de l'import, transférés dans `rapli-archives-private/{owner}/top10/{hash}.webp` lors de l'enregistrement.
- Pas de clé privée ni rôle service dans le navigateur.
- Les utilisateurs doivent associer leurs appareils dans Rapli Archives → Sauvegardes pour partager la même collection.

### Migration de schéma appliquée sur le projet RapliLab

```sql
ALTER TABLE public.rapli_module_collections
  DROP CONSTRAINT IF EXISTS rapli_module_collections_module_check;
ALTER TABLE public.rapli_module_collections
  ADD CONSTRAINT rapli_module_collections_module_check
  CHECK (module = ANY (ARRAY[
    'time'::text, 'sports'::text, 'refs'::text,
    'stickers'::text, 'tools'::text, 'tiers'::text,
    'top10'::text
  ]));
```

Vérification SQL effectuée : `top10` est accepté par la contrainte et RLS reste activée. Les avertissements préexistants de l'auditeur Supabase ne concernent pas une nouvelle table Top 10.

## Recette manuelle avant fusion

1. Créer un Top 10 et saisir les six champs (image + logo compris).
2. Tester réorganisation par souris, flèches et tactiles.
3. Passer entre les 3 vues et les 4 thèmes sans perte de données.
4. Modifier colonnes AUTO/1/2/3/4, compter les positions, vérifier que les titres longs sont lisibles.
5. Exporter ×1 et ×3 puis vérifier largeur, hauteur adaptative et absence de contrôles.
6. Enregistrer ; recharger et vérifier bibliothèque locale. Tester renommer, dupliquer, supprimer.
7. Enregistrer sur PC puis actualiser sur iPhone lié ; vérifier notamment la récupération des images privées et la gestion des conflits.
8. Tester un Top 100 : avertissement propre si la limite du navigateur est dépassée.
9. Vérifier l'absence de régression dans les sept autres espaces.

**État :** code proposé dans PR #1, **non fusionné et non déployé en production**.
