# Rapli Regatta — championnat d’équipe LPDB (PR #4)

Le championnat LPDB démarre avec la prochaine course enregistrée. **Aucun import des anciens Excel** et aucune migration destructive des fiches de courses personnelles.

## Accès / navigation
- **CHAMPIONNAT** (écran principal), **COURSES D'ÉQUIPE**, **SKIPPERS**, **STATS D'ÉQUIPE**.
- Les fiches individuelles anciennes restent accessibles dans les onglets « Mes courses · archives », « Mes statistiques » et « Mon palmarès ».
- Lecture disponible aux visiteurs ; création, correction et suppression réservées à l'éditeur authentifié, selon les mêmes permissions Supabase et RLS que les courses existantes.
- Les records d'équipe sont stockés dans le même flux de synchronisation Supabase, avec des ID et types dédiés `team-member` et `team-race`, sans réinterpréter les anciens enregistrements.

## Effectif
- Maximum **50 membres actifs** à un instant donné, mais autant de skippers historiques que nécessaire.
- Pseudo unique, statut actif/ancien, dates d'entrée/sortie facultatives, modification du pseudo conservant l'ID et tout le palmarès.
- Création rapide du skipper depuis la course ; ajout individuel ou sélection de toute l'équipe.
- Un ancien membre conserve ses points et peut être réactivé.

## Résultats d'une course
- Nom, catégorie VSR (HC/VSR 1/2/3), date d'arrivée, statut « À venir / En cours / Terminée » et éventuellement groupe d'étapes.
- Position de chaque skipper saisie manuellement ; statuts « À saisir / Classé / DNF ».
- 50 participants maximum par course ; les DNF comptent dans l'effectif mais ne gagnent **aucun point**.
- Un rang invalide ou double empêche de valider la course terminée. Une course en cours ou incomplète ne produit **aucun point** au championnat.
- Participant(s), rang(s), date et VSR restent modifiables ; les calculs sont dérivés à la lecture et un bouton « Recalculer » actualise tous les classements.

## Deux barèmes indépendants
**Principal**
- HC : 300 points de base, VSR 1 : 250, VSR 2 : 200, VSR 3 : 150.
- Coefficients de participation : jusqu'à 5 ×0,75 ; 6–9 ×0,85 ; 10–14 ×1 ; 15–20 ×1,05 ; 21–30 ×1,10 ; 31–50 ×1,15.
- Paliers de prime tous les 5 participants à partir de 15 (15, 20, 25, 30, 35, 40, 45, 50), exponentiels. Le vainqueur HC à 50 participants obtient **1 000 points** exactement.
- Points classés selon l'écart proportionnel au rang ; le dernier classé conserve 40 % de la base pondérée, bonus de palier nul. Tous les points sont arrondis à l'entier.

**Historique (bonus)**
- 1er à 14e : 200, 190…70 (−10).
- 15e à 22e : 65…30 (−5).
- 23e : 28, puis 24e à 50e : 27…1 (−1).
- Aucune influence du VSR ou du nombre de participants, 0 point pour DNF.

## Périodes, classement et statistiques
- Mensuel, trimestriel, annuel, dates libres, historique complet ; rattachement **par date d'arrivée**.
- **Toutes** les épreuves terminées et validées comptent, sans limite de courses retenues.
- Un skipper avec au moins une participation figure au classement de la période même avec zéro point. Un skipper sans participation n'y apparaît pas.
- Départage : points cumulés, puis indice **60 % prestige** des épreuves terminées (HC 100, VSR 1 75, VSR 2 50, VSR 3 25) et **40 % assiduité**, puis critères sportifs (courses HC, VSR 1, participations).
- L'assiduité inclut les DNF ; les dates d'adhésion, si connues, limitent les épreuves de référence.
- Statistiques : points/course (DNF compris), points/course terminée, participations, victoires, podiums, taux de finition, record de points, prestige et assiduité.
- Les étapes sont des courses normales, indépendantes ; un groupe d'étapes peut fournir un **classement bonus** sans distribuer de nouveaux points.

## Exports PNG / LPDB
- Le logo LPDB fourni est intégré dans `regatta/assets/lpdb.webp`.
- PNG **tableau premium** pour championnat, courses, étapes et classement statistique, avec pagination à 25 lignes par image.
- PNG **social premium** avec podium et Top 10, couleur bleu pétrole/cyan/rouge et identité LPDB.
- Le barème et la période sélectionnés sont repris. Les filtres du championnat (actifs/anciens, recherche) s'appliquent aux exports.
- Aucun export PNG ne constitue une archive définitive : tous les classements restent dynamiques après correction.

## Vérifications
- Tests dans `tests/regatta-team.test.cjs` ; exécution CI avec `npm test` via `.github/workflows/regatta-team-check.yml`.
- Les anciennes données sont conservées, sans merge de la PR ni mise en production.

## Détails de course partagés entre équipe et « Mes courses »
- Une fiche de course LPDB peut rester indépendante **ou** être associée à une fiche personnelle existante (lien par identifiant, pas par pseudo/nom).
- Depuis **Courses d’équipe** : choix « Fiche Mes courses associée », bouton « Utiliser ses détails », « Ouvrir Mes courses », « Dissocier » ou « Créer ma fiche personnelle ». Une nouvelle fiche personnelle est préremplie à partir de la course d’équipe enregistrée ; le lien est créé quand cette nouvelle fiche est sauvegardée.
- Depuis **Mes courses** : le menu « … » des courses ordinaires affiche « Utiliser pour le championnat LPDB », qui ouvre la fiche d’équipe existante ou prépare une nouvelle course liée.
- La fiche personnelle devient la référence pour les **détails communs** : nom, classe de bateau, type de parcours, départ (date/heure), arrivée (date/heure), catégorie VSR, fuseau horaire et équipement. Les données se reflètent automatiquement dans la vue et les calculs LPDB à partir de la fiche personnelle, sans copier les modifications dans la base à chaque affichage.
- **Les classements personnels et les captures (gains VSR/VR, rang général Virtual Regatta, notes, photos) restent exclusivement personnels. Les résultats de chaque skipper, le statut de validation d’équipe, les points principaux/historiques et le rattachement aux périodes restent exclusivement côté équipe.**
- Une fiche personnelle supprimée laisse les derniers détails disponibles dans la fiche d’équipe, avec une mention « fiche introuvable » et une possibilité de dissocier ou réassocier. Aucune suppression en cascade.
- Seul l’éditeur authentifié peut créer ou modifier les liaisons ; les visiteurs peuvent consulter les deux vues. Aucun import rétroactif de l’ancien Excel.
