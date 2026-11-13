# Rapli LP — Collection privée de CD

Module ajouté à la **PR #1** RapliLab le 13 novembre 2026.
- Page indépendante : `lp/index.html`
- Onglet RapliLab : `#lp`
- Prévisualisation : https://deploy-preview-1--raplilab.netlify.app/#lp
- Palette : noir / gris anthracite / touches argentées, Poppins.
- Logo fourni pour Rapli LP intégré en WebP dans le portail (aucun double en-tête dans le module).

## Fonctionnalités

- Album représenté par une **pochette carrée**, même avec une photo de dimensions différentes : fond sombre, image `object-fit:contain`, **sans déformation ni recadrage destructif**.
- Zoom photo partagé avec les modules Sports, Time, Refs et Archives : clic sur l'image, pince +/−, déplacement, fermeture.
- Champs de fiche : **Artiste (obligatoire), Album (obligatoire), Note d'édition (libre), Tags d'édition (multiples)**, photo facultative.
- Tags comme Rapli Sports : saisie Entrée/virgule/point-virgule, retrait avec × et possibilité de nombreux tags.
- Statut **JE POSSÈDE / ENVIES** comme les autres modules, compteurs albums/possédés/envies.
- Recherche artiste, album, note et tags ; filtres artiste/statut ; tri récent, ancien, artiste, album.
- Ajout, modification, suppression avec confirmation ; collection vide propre.
- Formats image : PNG, JPG, WebP, GIF. Compression locale en WebP (dimension maximale 1000 px en conservant les proportions).
- Bibliothèque locale automatique dans **IndexedDB `rapli-lp-v1`**, export/import JSON sécurisé par une confirmation avant remplacement.
- Responsive PC et iPhone, bloc central compact.

## Synchronisation Supabase

- Module `lp` intégré dans **`shared/module-cloud.js`**, en mode autosync comme Sports/Refs/Time.
- Utilise la table existante `public.rapli_module_collections` avec `module='lp'` et `state={records: albums, logos: []}`.
- Appairage PC/iPhone et protections RLS/révisions déjà présents, **aucune nouvelle table**.
- Les photos sont stockées dans le bucket privé `rapli-archives-private/{owner}/lp/{hash}.webp` via le pont partagé.
- Migration SQL conservée dans `lp/migrations/20261113_add_lp_module.sql` ; appliquée dans le projet RapliLab.
- La synchronisation globale du portail inclut désormais les **10 modules**.

## Recette manuelle avant fusion

1. Ouvrir le nouvel onglet sur Deploy Preview ; vérifier logo et palette noir/anthracite.
2. Ajouter un CD en saisissant Artiste + Album ; ajouter des notes et 3 tags via Entrée, virgule et suppression ×.
3. Importer une pochette portrait, paysage et carrée, y compris WebP ; vérifier le cadre carré sans déformation.
4. Cliquer la pochette depuis une tuile et tester zoom, déplacement, fermeture sur Chrome et Safari iOS.
5. Modifier puis supprimer une fiche ; confirmer que les compteurs et filtres se mettent à jour.
6. Tester recherche, sélection d'artiste, statut et quatre tris ; vérifier les valeurs accentuées.
7. Recharger et vérifier la conservation IndexedDB ; exporter JSON puis importer sur une collection de test.
8. Appairer PC/iPhone depuis Rapli Archives, ajouter un album sur PC, le récupérer sur iPhone avec sa photo ; tester les conflits concurrents.
9. Vérifier le fonctionnement des 9 autres onglets et la synchronisation globale **10/10**.
10. Vérifier l'absence de nouvelle collecte de données ou d'accès public aux photos.

**Statut** : implémentation dans la PR #1 **en brouillon**, non fusionnée, non déployée en production. Les tests interactifs réels et la synchronisation multi-appareils sont à valider.
