# PR #3 — cache local et synchronisation ciblée

## Comportement

- Sports et Regatta affichent leur dernier état IndexedDB avant la vérification réseau.
- Une réouverture vérifie uniquement `state_revision`. Une révision identique ne déclenche ni restauration des tuiles, ni lecture complète, ni téléchargement d'images.
- Tri, recherche, pagination et vues restent locaux.
- Fin du polling à 20 secondes et de l'abonnement Realtime permanent. Vérification au retour au premier plan, au rétablissement réseau, ou avec le bouton ↻ du pied de page. Les événements automatiques sont regroupés et limités à une vérification toutes les 15 secondes. Deux appareils laissés ouverts nécessitent un retour au premier plan ou ↻.
- Les modifications sont regroupées après 850 ms, avec une sauvegarde RPC par lot. Seules les fiches/logos modifiés et les images nouvelles sont envoyés.
- Un journal IndexedDB conserve la base reconnue par le serveur et l'état local en attente. Les modifications faites pendant un envoi restent dans le lot suivant. Reprise après rechargement/reconnexion avec délais croissants en cas d'erreur.
- La version confirmée est distincte de la version locale. Une photo déjà connue garde sa référence Storage après réouverture.
- Un conflit sur la même fiche conserve l'état local et bloque son écrasement ; les modifications de fiches distinctes sont réunies. Export local disponible pour résoudre un conflit. Les anciens ajouts non acquittés sans empreintes serveur restent protégés par un blocage explicite.

## API et compatibilité

Migration additive `supabase/migrations/20261117213033_collection_delta_sync.sql` appliquée au projet Rapli Lab.

`rapli_collection_delta` renvoie les fiches modifiées et IDs supprimés par rapport aux empreintes du client. `rapli_collection_patch` verrouille la collection, compare les empreintes des seules fiches touchées, applique le lot de façon atomique et retourne les différences. Les répétitions identiques sont idempotentes.

Les deux fonctions sont `SECURITY INVOKER`, avec `search_path` vide, privilèges explicites et RLS existantes. L'écriture exige aussi l'éditeur vérifié. Aucune politique ni donnée existante n'a été migrée, effacée ou élargie.

**Limite volontaire :** les échanges réseau sont différentiels, mais le document JSON historique reste le stockage canonique côté PostgreSQL. Le serveur parcourt/réécrit encore ce document lors des changements. Cela maintient la compatibilité avec la production et les onglets déjà ouverts ; une normalisation en lignes séparées demeure une étape possible pour de très gros volumes.

**Cache :** le premier chargement sur un appareil/origine reste complet, images comprises. Les réouvertures lisent le snapshot hydraté, sans reconversion individuelle des images. Le navigateur peut supprimer son cache en cas de manque d'espace. Production et Deploy Preview ont des caches distincts. Le cache ne remplace pas une sauvegarde/export.

## Vérification

`npm ci && npm test` (Node 18+) : sept scénarios couvrant les appels au redémarrage, la réutilisation des images, la reprise d'une file hors connexion, deux appareils, les suppressions, les conflits et les modifications pendant un envoi.

Tests SQL transactionnels avec ROLLBACK : ajout ciblé, modifications sur deux fiches, répétition idempotente, conflit, suppression, lecture publique, refus d'accès à une autre collection et absence de permission d'écriture anonyme. Les 56 cartes / 107 logos Sports et les 4 courses / 1 réglage Regatta, ainsi que leurs révisions, étaient inchangés après les tests.

Contrôle de syntaxe JS et `git diff --check` effectués. Les avis sécurité Supabase n'ont pas de nouvelle alerte après cette migration (alertes historiques inchangées).

Le navigateur Chromium local ne peut pas démarrer dans l'environnement (socket refusée). Le rendu doit donc être vérifié sur la Deploy Preview, notamment le bouton de rafraîchissement et le correctif de logos mobile conservé dans cette PR.
