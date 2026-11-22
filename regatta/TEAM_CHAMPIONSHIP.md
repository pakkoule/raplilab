# Rapli Regatta — championnat d’équipe LPDB (PR #4)

Le championnat LPDB démarre avec la prochaine course enregistrée. **Aucun import des anciens Excel** et aucune migration destructive des fiches de courses personnelles.

## Accès / navigation
- Un unique onglet principal **LPDB** regroupe quatre sous-sections internes : **CHAMPIONNAT**, **COURSES D'ÉQUIPE**, **SKIPPERS**, **STATS D'ÉQUIPE**. Cliquer sur LPDB rouvre toujours le Championnat ; les autres rubriques restent disponibles via les boutons internes.
- Les fiches individuelles anciennes restent accessibles dans les onglets « Mes courses · archives », « Mes statistiques » et « Mon palmarès ».
- Lecture disponible aux visiteurs ; création, correction et suppression réservées à l'éditeur authentifié, selon les mêmes permissions Supabase et RLS que les courses existantes.
- Les records d'équipe sont stockés dans le même flux de synchronisation Supabase, avec des ID et types dédiés `team-member` et `team-race`, sans réinterpréter les anciens enregistrements.

## Effectif
- Maximum **50 membres actifs** à un instant donné, mais autant de skippers historiques que nécessaire.
- Pseudo unique, statut actif/ancien, dates d'entrée/sortie facultatives, modification du pseudo conservant l'ID et tout le palmarès.
- Création rapide du skipper depuis la course ; ajout individuel ou sélection de toute l'équipe.
- Un ancien membre conserve ses points et peut être réactivé.

## Résultats d'une course
- Nom, catégorie VSR (HC/VSR 1/2/3), date de clôture du classement (distincte des arrivées des skippers), statut « À venir / En cours / Terminée » et éventuellement groupe d'étapes.
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
- Mensuel, trimestriel, annuel, dates libres, historique complet ; rattachement **par date de clôture du classement d'équipe** (indépendante des arrivées individuelles).
- **Toutes** les épreuves terminées et validées comptent, sans limite de courses retenues.
- Un skipper avec au moins une participation figure au classement de la période même avec zéro point. Un skipper sans participation n'y apparaît pas.
- Départage : points cumulés, puis indice **60 % prestige** des épreuves terminées (HC 100, VSR 1 75, VSR 2 50, VSR 3 25) et **40 % assiduité**, puis critères sportifs (courses HC, VSR 1, participations).
- L'assiduité inclut les DNF ; les dates d'adhésion, si connues, limitent les épreuves de référence.
- Statistiques : points/course (DNF compris), points/course terminée, participations, victoires, podiums, taux de finition, record de points, prestige et assiduité.
- Les étapes sont des courses normales, indépendantes ; un groupe d'étapes peut fournir un **classement bonus** sans distribuer de nouveaux points.

## Exports PNG / LPDB
- Le logo LPDB fourni est intégré dans `regatta/assets/lpdb.webp`.
- PNG **tableau premium sur une seule image** pour championnat, courses, étapes et statistiques : hauteur dynamique, jusqu'à 50 skippers par course, sans pagination ni fichier « page 2 ».
- PNG **social premium** (podium et Top 10) dans le thème gris perle/foil argenté, avec accents or/argent/bronze pour le podium.
- Le barème et la période sélectionnés sont repris. Les filtres du championnat (actifs/anciens, recherche) s'appliquent aux exports.
- Aucun export PNG ne constitue une archive définitive : tous les classements restent dynamiques après correction.

## Vérifications
- Tests dans `tests/regatta-team.test.cjs` ; exécution CI avec `npm test` via `.github/workflows/regatta-team-check.yml`.
- Les anciennes données sont conservées, sans merge de la PR ni mise en production.

## Détails de course partagés entre équipe et « Mes courses »
- Une fiche de course LPDB peut rester indépendante **ou** être associée à une fiche personnelle existante (lien par identifiant, pas par pseudo/nom).
- Depuis **Courses d’équipe** : choix « Fiche Mes courses associée », bouton « Utiliser ses détails », « Ouvrir Mes courses », « Dissocier » ou « Créer ma fiche personnelle ». Une nouvelle fiche personnelle est préremplie à partir de la course d’équipe enregistrée ; le lien est créé quand cette nouvelle fiche est sauvegardée.
- Depuis **Mes courses** : le menu « … » des courses ordinaires affiche « Utiliser pour le championnat LPDB », qui ouvre la fiche d’équipe existante ou prépare une nouvelle course liée.
- La fiche personnelle devient la référence pour les **détails communs** : nom, classe de bateau, type de parcours, départ (date/heure), catégorie VSR et fuseau horaire. La date de clôture des résultats de l'équipe est indépendante de l'arrivée personnelle. L'heure d'arrivée et l'équipement sont individuels et ne sont plus repris dans le formulaire d'équipe. Les données se reflètent automatiquement dans la vue et les calculs LPDB à partir de la fiche personnelle, sans copier les modifications dans la base à chaque affichage.
- **Les classements personnels et les captures (gains VSR/VR, rang général Virtual Regatta, notes, photos) restent exclusivement personnels. Les résultats de chaque skipper, le statut de validation d’équipe, les points principaux/historiques et le rattachement aux périodes restent exclusivement côté équipe.**
- Une fiche personnelle supprimée laisse les derniers détails disponibles dans la fiche d’équipe, avec une mention « fiche introuvable » et une possibilité de dissocier ou réassocier. Aucune suppression en cascade.
- Seul l’éditeur authentifié peut créer ou modifier les liaisons ; les visiteurs peuvent consulter les deux vues. Aucun import rétroactif de l’ancien Excel.


## Ajout de skippers par bloc
- Dans **LPDB → Skippers**, le bouton « Ajout par bloc » ouvre une grande zone de texte : **une ligne non vide = un skipper actif**. Collage direct d'une colonne Excel pris en charge.
- Prévisualisation avant enregistrement : nouveaux pseudos, doublons ignorés (y compris anciens membres), places restantes, lignes invalides et dépassement de la limite de 50 actifs.
- Les espaces inutiles autour des pseudos sont supprimés ; doublons insensibles à la casse et aux espacements répétés. Les doublons ou lignes vides sont ignorés, sans effacer les pseudos existants.
- Les noms supérieurs à 56 caractères, les caractères de contrôle et les lots qui dépassent les places disponibles bloquent l'importation entière jusqu'à correction.
- **Un seul enregistrement atomique** de tous les nouveaux membres dans IndexedDB (ou une seule écriture de secours locale), puis une notification de synchronisation Supabase ; pas d'ajout partiel, ni d'import d'Excel historique.


## Import rapide des classements et chronos (Virtual Regatta)
- Dans **LPDB → Courses d'équipe → Modifier/Nouvelle course**, « Coller un classement + chronos » accepte une copie textuelle avec un nom de skipper suivi de son **temps de course absolu** pour le premier, puis des **écarts au premier** précédés de `+` pour les suivants.
- Le parseur ignore les lignes vides, rangs isolés et puces/symboles courants ; détecte les durées en jours, heures, minutes et secondes. Il reconstitue le **temps total** de chaque participant comme `temps du premier + écart`.
- L'aperçu donne le rang, le nom détecté, le temps total et l'écart. Il rapproche les noms de l'effectif en tolérant les suffixes `- LPDB` / `_LPDB`. Les noms inconnus ou tronqués doivent être explicitement associés ou créés avec un pseudo complet. Aucun nom n'est déduit d'un texte tronqué.
- L'importation remplace les positions renseignées dans la fiche en cours après confirmation, mais **conserve les DNF** déjà saisis. Les nouveaux membres éventuels et la course sont sauvegardés ensemble en **une transaction atomique**, sans effet avant le clic d'enregistrement de la course.
- Les chronos et écarts sont modifiables individuellement dans la grille, vérifiés avant validation, affichés dans le classement de course, dans la fiche du skipper et dans les PNG de course (tableau, Top 10, podium).
- Le championnat par période affiche également le **chrono moyen** et l'**écart moyen au vainqueur** calculés à partir des courses où un temps est disponible. Les statistiques secondaires permettent de trier sur ces moyennes ; elles restent descriptives car les parcours et distances peuvent varier. Le temps de course ne modifie **pas** le barème de points.
- Les anciennes courses sans temps enregistré continuent de fonctionner, avec un tiret pour les chronos inconnus. Une course non encore validée ne produit toujours aucun point au championnat.


## Navigation Championnat et tuiles d'équipe (correctif 22 novembre 2026)
- Cliquer sur **LPDB → Championnat** ouvre désormais explicitement cette rubrique, même après avoir consulté une autre rubrique LPDB ou l'onglet « Mes courses ».
- Les **tuiles de courses d'équipe** reprennent la structure **deux colonnes** des courses personnelles : à gauche l'illustration (si une fiche personnelle est liée), le titre et le **départ commun** ; à droite les tags bateau/VSR, l'état de l'épreuve, le nombre de skippers, les DNF, le premier et le podium LPDB, et les totaux des deux barèmes.
- Toutes les actions (modification, classement et chronos, aller à « Mes courses », exports PNG et suppression) sont dans un bouton **« … » en haut à droite**.
- Aucun **champ d'arrivée unique** n'est visible sur la tuile d'équipe. L'heure d'arrivée et l'équipement personnels n'apparaissent ni dans la tuile ni dans le formulaire d'équipe ; les **chronos de chaque skipper** restent consultables dans les classements.
- Le champ interne `dateEnd` est conservé sous le libellé **Date de clôture du classement** pour rattacher la course aux périodes du championnat, sans confondre cette date avec une arrivée individuelle. Les dates de clôture déjà enregistrées sont conservées.


## Interface argentée et classement général VR (PR #4)
- L'espace **LPDB** abandonne les fonds bleu pétrole : navigation, fiches de courses, tableaux, statistiques, gestion des membres et dialogues sont présentés en **gris perle très clair / foil argenté**, avec texte graphite, reflets métallisés subtils, et quelques accents réservés aux statuts et podiums. Les pages personnelles de Regatta ne changent pas de thème.
- Une nouvelle colonne facultative **Classement général VR** est disponible dans la grille de résultats de chaque course, **par skipper**, distincte du **rang LPDB**. Le rang général est enregistré en nombre entier positif et n'est pas requis pour enregistrer ou valider une course.
- Le classement général est aussi saisissable dans l'aperçu de l'import texte VR, consultable dans le classement de course et la fiche du skipper, et affiché dans les **PNG de classement et de podium** de chaque course. Les rangs déjà saisis restent conservés lors d'une actualisation par import rapide.
- Les anciennes courses sans classement général restent pleinement compatibles ; le champ est omis, ou affiché par « — ».
- La rubrique **Statistiques** des skippers conserve le meilleur rang général VR sur les courses où il est connu.
- Le **classement général VR n'affecte ni le barème principal ni le barème historique**. Il est stocké pour permettre la réutilisation ultérieure du système de notation personnelle, sans anticiper ses règles ni supposer le nombre total de concurrents.


## LPDB · notation individuelle sans équipement et classement défilant
- La mention « ↔ Fiche « Mes courses » associée » est supprimée des tuiles d'équipe. La liaison technique et les actions associées dans le menu « … » restent disponibles.
- La fenêtre « Classement d'équipe » a une hauteur bornée au viewport et un **contenu défilable verticalement**, indépendant de son en-tête. Le tableau conserve le défilement horizontal sur mobile, notamment dans Safari iOS.
- La grille « Classement d'équipe » affiche désormais une **NOTE /100 par skipper**. La fiche du skipper affiche également sa note sur les courses de la période.
- Les notes réutilisent le calcul du système personnel `regatta/score.js`, **sans le critère d'équipement**. Les poids restants sont renormalisés proportionnellement sur 100 : classement relatif **43,75**, progression personnelle **25**, difficulté VSR **12,5**, affluence relative **18,75**.
- Le nombre **global** de participants VR se renseigne sur la fiche de course d'équipe dans « Effectif global Virtual Regatta ». Les classements généraux VR sont déjà saisis **par skipper** : le rang dans l'équipe et son effectif ne remplacent jamais ces valeurs globales.
- La **moyenne des notes disponibles** est présentée sur chaque tuile de course. Le compteur `skippers notés / arrivés` accompagne la moyenne ; si aucune note n'est calculable, on affiche « — » et non une note artificielle.
- Les notes ne sont calculées que sur les épreuves terminées et dont les résultats sont validés. Un DNF n'a pas de note ; une donnée manquante (rang général ou effectif global) n'est pas imputée ; l'historique limité est marqué comme provisoire et les primes de podium personnelles demeurent sous leurs conditions habituelles.
- Les calculs de points LPDB (barèmes principal et historique) sont **strictement inchangés**. La note est un indicateur indépendant, calculé dynamiquement à partir de l'historique accessible.

## Exports PNG premium à image unique (22 novembre 2026)
- **Une seule image PNG par export**, tableau de classement complet (y compris plus de 25 skippers), avec hauteur automatiquement calculée selon le nombre de skippers et la longueur de leurs pseudos. L'enregistrement produit un seul fichier, pas de pagination 1/2.
- Les **pseudos restent complets** : ajustement typographique et retours à la ligne mesurés, y compris pour les noms longs sans espaces. Même principe pour les cartes podium.
- La course peut reprendre l'**illustration de la fiche personnelle liée**, sinon le logo LPDB sert de visuel. Le bandeau comprend logo LPDB, nom de la course, **type de bateau, catégorie VSR**, date de clôture et indicateurs (classés, DNF, note moyenne).
- Tableau de course : **rang LPDB, pseudo intégral, classement général VR, chrono, écart au vainqueur, note /100 de chaque skipper et points du barème choisi**. Une note absente reste « — » ; les DNF conservent 0 point.
- Les exports **tableau, Top 10 et podium** partagent une identité argentée premium et des titres visuels, sans faux remplissage des données. Les classements mensuels, trimestriels, annuels et statistiques réutilisent également le nouveau rendu à image unique.
- Code dans `regatta/team-export.js` ; tests dans `tests/regatta-team.test.cjs` pour le cas réel de 26 skippers, jusqu'à 50 skippers, pseudonymes longs, récupération du visuel, metadata du bateau et VSR, notes et absence de pagination.


## Courses d’équipe à venir / en cours et puces bateau réutilisées
- Les tuiles **LPDB → Courses d'équipe** réutilisent les mêmes fonctions et le même rafraîchissement que les tuiles **Mes courses** : un seul calcul des horaires GFS, un seul minuteur de décompte/chrono et les mêmes couleurs de puces.
- **À venir** : le départ et l'heure de la course restent affichés, avec un **compte à rebours dynamique à la seconde** et le **briefing météo GFS pré-départ** (dernier cycle exploitable, prochain cycle et recommandations horaires). L’estimation est fondée sur les heures de publication GFS, pas sur une connexion en direct à Virtual Regatta.
- **En cours** : voyant animé identique à celui des courses personnelles, **chrono écoulé depuis le départ** et widget **Météo GFS** (phase de renouvellement estimée, progression, heure et décompte du prochain cycle). Les horaires utilisent la date, l'heure et le fuseau de départ de la fiche d'équipe / fiche personnelle liée.
- Les écrans LPDB masquent les tuiles « Points », « Note moyenne », « Podium », « Classés » et « DNF » encore vides pour une course à venir ou en cours, et affichent à la place l'effectif inscrit et les widgets utiles. Une course terminée conserve tous ses résultats, points et notes, sans widget météo d'avant-course.
- Les **puces bateau** et VSR reproduisent le **même composant foil et les mêmes couleurs personnalisées** que « Mes courses » ; une mise à jour des couleurs depuis la bibliothèque est immédiatement visible sur les deux vues. La déclinaison LPDB conserve la palette gris perle argenté avec des accents issus des couleurs sélectionnées.
- La logique partagée est exposée par `window.RapliRegattaSharedCards` dans `regatta/app.js`, réutilisée par `regatta/team-app.js`. Aucun enregistrement de données météo supplémentaires, aucune fusion des classements personnels et d'équipe.


## Réutilisation des fiches Records (Trophée Jules Verne)
- Les fiches personnelles de type `record`, dont le **Trophée Jules Verne**, sont désormais listées dans le sélecteur « Fiche Mes courses associée » des nouvelles courses LPDB (préfixe **RECORD ·**). Les fiches de type `race` restent disponibles.
- Le lien reprend le nom, l'illustration, le bateau et les informations communes. Pour un record à plusieurs tentatives, la **date et l'heure de départ de la dernière tentative datée** servent de référence aux widgets météo, au compte à rebours et au chrono, sans écraser l'historique des tentatives du record.
- **Les classements, les résultats des skippers et la date de clôture LPDB restent indépendants**. La date de clôture du classement reste modifiable même lorsqu'une fiche personnelle est liée. Pour une fiche de type Record, la catégorie VSR du championnat reste également réglable séparément.
- Une fiche Record peut être ouverte depuis le menu de course LPDB et le menu « … » de la fiche personnelle propose dorénavant **Utiliser pour le championnat LPDB**. Les dossiers de type `event` ne sont pas proposés.
- La liaison d'une fiche n'affecte pas ses résultats personnels, ses tentatives, ses durées ou son statut ; elle ne présume pas non plus que les arrivées d'équipe sont identiques.


## Recalcul manuel des notes (PR #4)
- Dans **LPDB → Courses d'équipe**, le bouton **« ↻ RECALCULER LES NOTES »** est situé à côté de « Nouvelle course ».
- Il reprend les résultats les plus récents de chaque course terminée, les classements généraux VR, les effectifs globaux, les catégories et l'historique, puis **réévalue les notes individuelles et les moyennes** des tuiles.
- Une confirmation indique le nombre de skippers notés, de courses évaluées, les notes indisponibles et les notes provisoires. Une absence de course terminée produit un message explicite.
- Ce recalcul est **en lecture seule** : aucune écriture ni nouvelle validation, aucun changement des rangs, des points LPDB, des fiches personnelles ou des historiques. Les notes sont de toute façon recalculées dynamiquement à partir des données en mémoire ; le bouton fournit un déclenchement manuel et son bilan.


## Regatta exclusivement LPDB (PR #4)
- **LPDB est désormais l'unique espace visible** de Rapli Regatta, ouvert directement sur le **Championnat** : les quatre onglets **Championnat**, **Courses d'équipe**, **Skippers** et **Stats d'équipe** sont regroupés dans le header, à la place des onglets personnels. Les onglets de niveau supérieur « Mes courses », « Mes statistiques » et « Mon palmarès » sont supprimés.
- Les anciens panneaux personnels sont masqués et rendus **inertes** ; leurs données locales et cloud ne sont **pas supprimées**, pour préserver les illustrations, les métadonnées (Trophée Jules Verne inclus) et les données nécessaires aux courses LPDB déjà associées.
- Le formulaire d'équipe peut toujours **réutiliser les détails d'une ancienne fiche ou d'un record**, sans proposer d'accéder au journal personnel, de créer une nouvelle course personnelle ou de supprimer les archives. Les actions « Ouvrir ma course » / « Créer ma course » ont disparu du menu « … ».
- Les **réglages des puces foil bateau et VSR** restent accessibles par le bouton **⚙ PUCES BATEAUX** dans « Courses d'équipe ». Le bouton Retour revient directement aux courses d'équipe.
- Les anciennes routes de navigation vers les courses personnelles, leurs statistiques ou leur palmarès ne sont plus accessibles par l'interface, y compris par des appels directs au sélecteur de vues. Les mécanismes de stockage et de synchronisation conservent leur compatibilité.


## Header LPDB, recherche globale et boutons d'action (PR #4)
- La navigation des **4 onglets LPDB** est dans le **header**, à côté du logo Rapli Regatta. Les anciens « Mes courses », « Mes statistiques » et « Mon palmarès » restent retirés de la navigation visible.
- Sous le header, la grande **barre de recherche** retrouve son emplacement d'origine et sa présentation argentée, accompagnée des boutons d'action compacts et du menu Profil/administrateur (rétabli hors des archives masquées).
- **Recherche contextuelle et persistante** : Championnat et Stats → skipper ; Courses d'équipe → course, bateau, catégorie VSR, statut et participants ; Skippers → pseudo ou statut. Recherche accent-insensible ; effacement via × ou Échap, sans retirer le focus pendant la saisie.
- **Boutons contextuels** de la barre : Championnat → recalcul des classements ; Courses d'équipe → recalcul des notes, nouvelle course et personnalisation des puces bateaux ; Skippers → ajout individuel ou par bloc. Synchronisation cloud disponible dans toutes les rubriques ; droits d'édition respectés.
- Sur mobile : onglets en **grille 2×2 dans le header**, puis recherche pleine largeur et barre compacte des icônes/profil. Sur desktop : onglets alignés dans le header et recherche + icônes + profil sur la même ligne.
- Suppression des boutons d'ajout et de recalcul en double dans les panneaux Courses d'équipe et Skippers ; les exports PNG propres au Championnat et aux Stats restent dans leurs rubriques. Les réglages de foil sont toujours accessibles depuis les commandes du header LPDB.
