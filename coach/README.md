# Rapli Coach — PR #1

Lien Preview : https://deploy-preview-1--raplilab.netlify.app/#coach
Module autonome : coach/index.html. Cahier des charges : Rapli_Coach_Cahier_des_charges_definitif_v1_1.docx (78 validations + répertoire permanent).

## Inclus
- Football : formations 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3, 11 postes fixes, gardien en bas.
- Basketball : demi-terrain vertical 1-2-2 avec postes PG, SG, SF, PF, C.
- Édition d’un poste au clic, dépose vers poste vide = déplacement, vers poste occupé = échange (souris et tactile).
- Changement de formation : joueurs conservés temporairement, réaffectation manuelle, annulation et avertissement avant retrait.
- Affichage pastilles + noms, portraits + noms, portraits seuls. Nom complet, nom court facultatif, portrait facultatif avec recadrage.
- Noms majuscules sur une ligne, cartouches anthracite. Contours personnalisables et postes vides en pointillés blancs.
- Terrain et fond opaque, tracés classiques simplifiés, couleurs et typographies personnalisables, titre Poppins Bold.
- Bibliothèque repliable sous le terrain avec recherche, filtre, ouverture, renommage, duplication et suppression.
- Sauvegarde MANUELLE des compositions, annuler/refaire, récupération locale de brouillon, confirmation avant abandon.
- Export PNG 2048 × 2048 px sans logo/filigrane ; 3 choix avant export en présence de modifications non enregistrées.
- Logo fourni intégré au portail dans coach/assets/logo.webp, optimisé en WebP. Il n’apparaît pas dans le PNG.
- Répertoire PERMANENT : valider la fiche d’un joueur l’enregistre dans le catalogue réutilisable, avec nom/nom court/photo/recadrage, SANS enregistrer la composition. Les anciennes compositions conservent leurs propres images et noms.

## Stockage et sécurité
- IndexedDB locale rapli-coach-v1 : clé saved pour compositions enregistrées et joueurs permanents ; clé draft pour secours du travail non enregistré.
- Pont Supabase partagé : clé module coach dans public.rapli_module_collections, records contenant kind=composition ou kind=player ; logos=[].
- Images privées dans le bucket rapli-archives-private sous owner/coach/, transférées en WebP et réhydratées via shared/module-cloud.js.
- Clé publishable uniquement ; connexion/session et appairage PC-iPhone dans Rapli Archives → Sauvegardes.
- Même mécanisme RLS, révision optimiste et protection des conflits que les autres modules.
- Migration déjà appliquée au projet RapliLab, conservée dans coach/migrations/20261113_add_coach_module.sql. Aucune nouvelle table.

## Vérifications réalisées
- Syntaxe de coach/app.js et shared/module-cloud.js passée.
- 11 positions uniques pour les 5 formations football ; 5 positions pour le basketball.
- Onglet, iframe, navigation et pont cloud vérifiés statiquement.
- Extension du CHECK module et RLS actif vérifiés dans Supabase.

## Tests manuels restant à réaliser sur Deploy Preview (avant fusion)
1. Accès #coach et bon affichage du logo sur PC/iPhone.
2. Créer des compositions dans chaque sport, changer les 5 formations football, vérifier le placement.
3. Ajouter des photos, recadrer et déplacer/échanger des joueurs au toucher sur iPhone.
4. Changer 4-3-3 → 4-4-2 et tester le flux de réaffectation et les confirmations.
5. Vérifier noms longs, mode portraits seuls, cercles blancs pointillés, frontières, couleurs et export PNG 2048×2048.
6. Tester annuler/refaire, vider, avertissement de sortie, brouillon, création, recherche/filtre, duplication et suppression.
7. Ajouter un joueur sans enregistrer le XI, fermer le site, créer un autre XI et retrouver le joueur avec photo + recadrage.
8. Vérifier la persistance de ce joueur et des compositions enregistrées sur deux appareils appairés, et la protection d’un conflit.
9. Vérifier les trois choix exacts de l’export avec modifications locales.
10. Tester les 8 autres onglets et la sauvegarde globale 9/9.

Statut : PR #1 ouverte en draft ; PAS de merge, PAS de déploiement de production. Les tests réels navigateur iOS, Canvas PNG et multi-appareils restent à valider.