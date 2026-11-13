# Rapli Regatta — journal de courses

Intégration dans la PR #1 de RapliLab, le 13 novembre 2026.

- Onglet `#regatta` dans le portail, onzième onglet de la navigation.
- Page directe `regatta/index.html` ; prévisualisation prévue sur `https://deploy-preview-1--raplilab.netlify.app/#regatta`.
- Logo de référence fourni par l’utilisateur, optimisé en WebP transparent dans `regatta/assets/logo.webp`.
- Charte turquoise/rose, police Poppins, bloc central de **1 120 px** maximum.
- Le portail conserve sa largeur maximale **1 360 px**. Sur mobile, les onze logos restent sur une **ligne horizontale défilante** sans réduction excessive. Pas de second bandeau de logo dans le module.
- Décor latéral de bureau inspiré du logo : dégradé turquoise sombre et motifs monochromes discrets derrière le portail, sans affecter le contenu.
- Chaque course : titre, édition, classe (IMOCA, ULTIM, etc.), bateau, **date et heure de départ**, durée de course, **date et heure d’arrivée calculées automatiquement en lecture seule**, **classements général, départemental et national** (3 champs indépendants), notes et état « course en cours » (halo lumineux).
- **Calcul du temps de course** : dès que date de départ, heure de départ et durée sont renseignées, l’arrivée se recalcule immédiatement. La durée accepte `12 j 08 h 35 min`, `8h35`, `45 min` ou `01:30` (heures:minutes). Franchissement de minuit, changement de jour, mois, année et année bissextile couverts. Calcul sur l’heure civile saisie, sans interprétation implicite du fuseau horaire ; les champs d’arrivée ne sont pas modifiables manuellement. Une durée invalide avec un départ complet est refusée à l’enregistrement. Les dates d’arrivée historiques restent intactes sur les anciennes fiches tant qu’on ne modifie pas leurs paramètres de départ.
- **Équipement en course** : cases cochables **PDD / 1/2 FP / Full Pack** ; maximum une seule option cochée (cocher une autre décoche la précédente), zéro option autorisée. Choix sauvegardé localement, synchronisé dans Supabase via les enregistrements de course, visible sur la tuile et inscrit dans le PNG. Les courses existantes sans choix restent valides.
- Trois images indépendantes : **affiche principale en 16:9**, capture de classement final et capture de tracé. `object-fit: contain` préserve l’intégralité des images ; aucune découpe.
- Import d’images, suppression, compression locale WebP/JPG, aperçu et zoom partagé. HEIC/HEIF seulement lorsque le navigateur permet le décodage.
- Tuiles, filtres, recherche, tri et compteurs ; export PNG d’une course et import/export JSON de la bibliothèque.
- Sauvegarde locale **IndexedDB** `rapli-regatta-v1` et synchronisation via `RapliModuleBridge` avec la session Supabase commune, les protections RLS et le bucket d’images privé.
- Module `regatta` autorisé par la contrainte SQL existante, sans nouvelle table : `migrations/20261113_add_regatta_module.sql`. Migration appliquée et contrainte vérifiée.

## Recette avant fusion

1. Ouvrir la Deploy Preview du portail, vérifier le nouvel onglet et la présence du vrai logo.
2. Tester les largeurs 390 px (iPhone), 768 px (tablette), 1280 px et 1920 px, la navigation défilante et l’arrière-plan.
3. Ajouter une course, choisir une affiche de ratios différents, vérifier qu’elle reste entière dans le cadre **16:9** et la capture PNG.
4. Saisir un départ le `13/11/2026` à `22:35` et une durée de `1 j 02 h 35 min` : l’arrivée doit être calculée au `15/11/2026` à `01:10`. Modifier ensuite la durée et vérifier le recalcul en direct, dans la tuile et dans l’export PNG. Vérifier que les champs d’arrivée ne sont pas éditables et qu’une course ancienne sans heure de départ conserve sa date historique.
5. Cocher PDD, puis 1/2 FP et constater que PDD se décoche. Cocher Full Pack et constater que 1/2 FP se décoche. Décocher Full Pack : **aucune option** doit alors être cochée. Enregistrer, recharger et vérifier la persistance sur la tuile et dans le PNG.
5. Renseigner les classements **général**, **départemental** et **national** indépendamment ; vérifier les trois badges sur la tuile, leur conservation après rechargement et leur présence dans le PNG.
5. Ajouter les captures « classement » et « tracé », activer le halo, modifier puis enregistrer la course.
5. Rafraîchir la page, vérifier la persistance IndexedDB et tester l’export puis import JSON.
6. Sauvegarder dans Supabase puis récupérer depuis un appareil appairé ; vérifier les photos et les conflits de révision.
7. Tester les champs, le sélecteur photo, le téléchargement PNG et le zoom photo sur **Safari iOS**.

**État** : fichiers et vérifications statiques disponibles. La vérification interactive réelle dans le navigateur et le test multi-appareils restent nécessaires avant toute fusion. La PR reste en brouillon ; aucune mise en production.
