# Rapli Regatta — journal de courses

Module autonome et seul espace actif de Rapli Lab dans la PR #4.

- Accueil : `/` ; module direct : `regatta/index.html`.
- Deploy Preview attendue : https://deploy-preview-4--raplilab.netlify.app/
- Logo fourni intégré en WebP transparent ; charte turquoise/rose ; Poppins.
- Bloc du module limité à **1 120 px**, portail limité à **1 360 px** ; 11 onglets sur une seule ligne défilante sur iPhone. Sur bureau : dégradé latéral teinté et répétitions discrètes du logo en noir et blanc.
- Affiche de course **16:9 intégrale sans rognage** ; captures de classement et de tracé indépendantes, affichées sans déformation, zoom partagé.

## Fiches de courses

- Nom de course, nom du bateau et classe (libre avec suggestions IMOCA/ULTIM/etc.). **Aucun réglage de couleur dans une fiche individuelle** : les couleurs des tags sont globales par classe, dans le menu dédié. Le champ « Édition/année » est supprimé du formulaire : l’année se déduit du départ. Les anciennes valeurs d’édition restent conservées dans les données archivées pour compatibilité.
- **Catégorie VSR** : Hors Catégorie (**pastille dorée par défaut, en gras**), VSR 1, VSR 2, VSR 3 ou non renseignée.
- **Hiérarchie VSR imposée** : Hors Catégorie > VSR 1 > VSR 2 > VSR 3. Tri facultatif « VSR · importance » sur les courses, priorité dans les rapports et graphiques ; le tri par date récente reste le tri initial.
- **Gains** : deux champs numériques entiers positifs ou nuls, Points VSR gagnés et Crédits VR gagnés, enregistrés par course et affichés dans les tuiles et les exports PNG.
- **Deux cases indépendantes mais mutuellement exclusives** : « Course en cours » (halo turquoise) et « À venir » (halo bleu).
- **Équipement unique et facultatif** : PDD, 1/2 FP ou Full Pack (cases exclusives) ; zéro choix possible.
- Les tuiles sont organisées en **deux colonnes** : visuel intégral, titre avec menu « … », dates et durée/chrono à gauche ; classe du bateau, équipement, catégorie VSR, classement général et note, quatre classements alternatifs, gains VSR/VR à droite. Les colonnes restent côte à côte sur iPhone, avec tailles adaptées. Le rendu PNG conserve son propre format d’export. ; l’ancienne année d’édition n’est plus affichée.
- Cinq classements avec **position / nombre de joueurs** (même un total supérieur à 100 000 joueurs doit tenir **sur une seule ligne**, avec ajustement dynamique de la taille), affichés avec la police sportive **Barlow Condensed ExtraBold** (tuiles, formulaire et export PNG), et non une serif type Times New Roman. Les podiums terminés affichent automatiquement **🥇 1re place / 🥈 2e / 🥉 3e** à côté du rang, sans masquer l’emoji du type de classement. Les courses en cours/à venir n’affichent pas de médaille :
  - 🏆 Général : plaque principale agrandie (police sportive blanche sur fond contrasté) ;
  - 🇫🇷 National : petite plaque ;
  - 🇨🇶 Départemental : drapeau de Sark (affichage emoji selon appareil) ;
  - 🏙️ Ville : cityscape ;
  - 🏴‍☠️ Team : drapeau pirate.
- Durée dans **quatre cases sur une ligne** : jours, heures, minutes et secondes. Police **Courier Prime**, plus douce que Courier.
- Date et heure de départ ; **date et heure d’arrivée calculées** à la seconde (lecture seule) à partir des quatre champs de durée. Calcul de durée en temps civil de la course, sans fuseau de course configuré. Prise en charge des passages de jour, mois, année et année bissextile.
- **Bloc « Notes personnelles » supprimé** du formulaire et des tuiles. Les notes déjà enregistrées restent dans les données historiques et ne sont pas écrasées lors des modifications.
- Formulaire, stockage local, restauration cloud et import/export JSON compatibles avec les anciens enregistrements : les classements « 235e / 4 250 » sont séparés en place et total ; les anciennes durées textuelles sont converties ; une date d’arrivée historique est préservée si l’heure de départ n’avait pas été enregistrée.

## Réglages globaux des couleurs

- Palette **ÉTIQUETTES FOIL · BATEAUX & VSR** accessible avec la roue dentée : couleur principale, reflet, accent irisé, bordure, couleur du texte et libellé affiché personnalisables pour chaque classe de bateau et catégorie VSR. Les icônes vectorielles monochromes utilisent la couleur de texte choisie ; le rang réel des catégories VSR ne change jamais.
- Changer la couleur générale **applique la nouvelle couleur à toutes les courses** et, après confirmation, réinitialise les exceptions propres aux classes. Changer une classe met à jour simultanément toutes les courses portant cette classe (en ignorant les différences de casse et de présentation).
- Les anciens champs `classColor` par course restent conservés. Les réglages historiques `classColors` et `vsrColors` restent compatibles ; les nouveaux champs optionnels `classFoils` et `vsrFoils` mémorisent uniquement le style visuel (sans changer la classification des courses). Tuiles et PNG réutilisent les couleurs et libellés personnalisés.
- Réglages enregistrés localement sous `rapli-regatta-class-colors-v1` et synchronisés sur Supabase via l’objet de paramètres de la collection. Les réglages par défaut ne créent pas de faux contenu dans un nouveau compte. Import/export JSON inclut les couleurs (version 2) et les anciens JSON restent importables.

## Navigation, statistiques et exports

- **Ordre automatique** : courses en cours, puis à venir, puis autres courses ; à l'intérieur de chaque groupe, départ le plus récent d'abord. Plus de barre de filtres ou de sélecteur de tri.
- La barre de recherche, les commandes d'action et le profil sont réunis sur **une seule ligne**, y compris sur iPhone. Logo Regatta et onglets COURSES / STATISTIQUES / PALMARÈS partagent également une ligne.
- Le bouton de changement de vue compact est supprimé. Les boutons d'action adoptent un contour foil bleu/rose Virtual Regatta et des hauteurs harmonisées, sans modifier les boutons propres aux notes ni le comportement des onglets.
- Les captures de classement final et de tracé sont **consultables dans le menu « … »** uniquement sur les courses terminées, DNF ou records clôturés, si une image existe ; aucune miniature n’encombre la tuile. Elles restent masquées sur les courses à venir/en cours et les records non clôturés, sans suppression de données. L’export PNG suit les mêmes règles.
- Les courses en direct affichent un pictogramme néon clignotant (signal de diffusion) ; animation désactivée si la réduction des animations est demandée par l'appareil. L'information de fuseau « 🌐 Heure française · Paris » est masquée sur les tuiles sans changer les calculs horaires.
- **Recherche universelle** plein format : nom de course, bateau, classe, type de parcours, statut, VSR, équipement, dates/heures, fuseau, durée, rangs et effectifs, note visible, gains VSR/VR et détails des tentatives de record. Accents et casse ignorés, mots combinables, pagination et raccourci Ctrl/Cmd+K conservés. Le contenu textuel *à l'intérieur des images* n'est pas indexé.
- Onglet interne **STATISTIQUES** enrichi, calculé directement à partir des courses de la collection :
  - **Tableau de bord** : total, terminées, en cours, à venir.
  - **Palmarès** : victoires, podiums, Top 10, Top 100, taux de podiums/Top 10 parmi les courses classées, meilleur classement général, moyenne et médiane des places, meilleur et moyen « Top % » (place / participants), records nationaux, départementaux, ville et team.
  - **Podiums par type de classement** : cinq cartes compactes avec les totaux séparés 🏆 général, 🇫🇷 national, 🇨🇶 départemental, 🏙️ ville et 🏴‍☠️ team. Chaque carte affiche un compteur de podiums, la répartition des médailles 🥇/🥈/🥉 en petit histogramme, et le taux de podiums parmi les courses terminées possédant le classement concerné (anneau circulaire).
  - **Mini-graphe chronologique** : histogramme des podiums au général par année de départ (six dernières années présentes dans la collection).
  - **Temps de navigation** : durée cumulée, moyenne, course la plus courte et la plus longue ; précision à la seconde.
  - **Gains VSR et VR** : points VSR cumulés et crédits VR cumulés, gains moyens parmi les courses renseignées, records et identification de la course correspondante, histogrammes séparés points/crédits par catégorie VSR dans l’ordre d’importance. Seules les courses terminées sont comptabilisées.
  - **Évolution annuelle** : histogrammes des courses selon l’année de départ, portion terminées et décompte Top 10.
  - **Habitudes** : répartitions des courses par VSR, bateau, équipement et statut.
  - **Performances comparées** : par VSR, classe de bateau et équipement, avec nombre de courses classées, Top 10 et Top % moyen.
  - Les statistiques de performance ne comptabilisent pas les courses « À venir » ou « En cours ». Les métriques nécessitant des classements / participants affichent « — » lorsqu’il manque les données. Les moyennes de durée utilisent uniquement des courses terminées avec durée positive. Aucun nouveau champ ni migration Supabase nécessaire.
- **PNG par course** : affiche 16:9, métadonnées, couleurs des tags bateau **et VSR** issues du menu, date/heure, durée en Courier Prime, gains et **cinq classements (avec position, total et médailles de podium)**, plus les captures.
- **PDF global** : bouton **↓ PDF GLOBAL**, ouverture d’un formulaire de filtres cumulables (année, catégorie VSR, classe, nom de bateau, statut), tri par importance VSR ou date. Génération d’un **PDF A4 paysage** contenant synthèse (nombre de courses, podiums des cinq types, temps total, points VSR cumulés et crédits VR cumulés, répartition VSR) puis **tableaux paginés** (dates, courses, bateau, classe, VSR, classements, durée et gains). Les statistiques sont calculées sur la sélection uniquement et les gains/podiums s’appliquent aux courses terminées. Générateur navigateur via jsPDF **4.2.1** chargé à la demande ; aucune nouvelle table Supabase.
- Pour une **course ou une étape à venir**, et pour une **tentative de record future**, entrée **Ajouter au calendrier iOS** dans le menu « … » produisant un fichier `.ics` compatible avec Apple Calendrier : horaires si connus, journée entière si heure manquante, ou plage indicative d’une heure si durée absente. Le téléchargement ne crée pas directement un événement sans l’action d’importation de l’utilisateur.
- Sauvegarde locale automatique dans IndexedDB `rapli-regatta-v1` ; synchronisation Supabase via `RapliModuleBridge`, bucket privé et RLS existants. Aucune nouvelle table ; migration contrainte `regatta/migrations/20261113_add_regatta_module.sql` déjà appliquée.

## Vérifications

- Syntaxe JavaScript contrôlée, champs HTML recoupés.
- Tableau de statistiques testé avec des courses de différentes années, des courses en cours/à venir, des places sans participants et une collection vide. Les podiums et ratios excluent les courses non terminées.
- Tests complémentaires : chaque type de classement vérifié indépendamment avec ses places 1/2/3 ; position impossible (supérieure au total déclaré) écartée ; courses non terminées exclues ; taux et dénominateurs contrôlés ; cinq anneaux, quinze colonnes de médailles et barres annuelles contrôlés ; aucune donnée / aucun podium gérés.
- Réglages couleurs testés en simulation : application globale sur toutes les classes, exception IMOCA sur plusieurs courses, confirmation de réinitialisation, conservation dans la sauvegarde locale et restauration des réglages cloud ; anciennes notes préservées mais masquées. Médailles vérifiées sur les cinq classements, absentes sur les courses à venir et en cours.
- Gains VSR/VR testés : saisie, restauration et statistiques globales/moyennes/records, exclusion des courses prévues. Ordre d’importance VSR déterministe pour les tris et graphiques. Rapport PDF simulé sur 33 courses : cumul des filtres, résumé des podiums, durée et gains, pagination multi-pages et enregistrement du fichier. Contrôles d’affichage mobile et de classement sur une ligne à réaliser dans la Deploy Preview.
- Scénario simulé de création de course : cinq classements, catégorie VSR, classe colorée, choix « À venir », durée jours/heures/minutes/secondes, calcul d’arrivée, sauvegarde et export ICS.
- Cas de durée vérifiés : `12 j 08 h 35 min`, `8h35`, `1 j 2 h 3 min 4 s`, `00 h 00 min 31 s`, `01:02:03`.
- À tester **dans la vraie Deploy Preview** avant fusion : glisser-déposer d’images, photos et rendu Canvas/PNG, iPhone Safari, ouverture du fichier ICS dans Apple Calendrier, accès Supabase PC ↔ iPhone et conflit de révision, affichage éventuel du drapeau de Sark.
- **PR en draft, non fusionnée : aucun déploiement en production.**


## Courses record — départs multiples et statut en cours (PR #1)

- Le type **Course record** possède une liste indépendante de tentatives (jusqu’à 100).
- **Chaque tentative** a sa propre date de départ et son heure facultative, ainsi que sa durée détaillée en jours, heures, minutes et secondes, et la case **Tentative avortée**.
- Les deux anciens champs de départ au niveau global sont masqués pour les records : ils ne doivent jamais écraser les dates différentes des tentatives.
- La case **Course en cours** reste utilisable au niveau de la course record. Une course record active reçoit le badge **RECORD EN COURS** et le halo de course active ; elle apparaît aussi dans le filtre **En cours** tout en restant dans le filtre **Courses record**.
- La fiche affiche le départ de **chaque tentative**, son temps (ou « Avortée » / « En attente »), et le meilleur temps validé. Le PNG reproduit ces dates indépendantes et le statut actif.
- La synchronisation IndexedDB / Supabase et les exports JSON conservent `attempts[].startDate`, `attempts[].startTime`, `attempts[].seconds`, `attempts[].aborted`.
- Pour les anciennes fiches record qui ne connaissaient qu’un seul départ `start/startTime`, la date et l’heure historiques sont reportées sur **la première tentative uniquement**. Le champ de départ parent devient ensuite dérivé du départ le plus ancien pour compatibilité. Les dates de toutes les autres tentatives restent indépendantes.
- Aucune note VSR /100 ni résultat de classement normal n’est généré pour une course record.


## Courses record — clôture manuelle et classements finaux (PR #1)

- Une **tentative terminée** (avec un temps) ou une tentative avortée n'a **aucun effet** sur la case **Course en cours** de la course record. Plusieurs tentatives sont donc possibles sans changement automatique de statut.
- Une course record ouverte dispose, via son menu **« … »**, de l’action **✓ CLÔTURER LE RECORD**. L'utilisateur doit confirmer la clôture ; l'action sauvegarde explicitement `recordClosed: true`, retire l'état en cours et conserve toutes les tentatives et leurs dates.
- Le statut devient **RECORD CLÔTURÉ**. Le record clôturé est visible parmi les courses record et dans le filtre « Terminées » ; il n'est plus comptabilisé « En cours ». Il ne gonfle pas les statistiques des courses VSR classiques.
- Après clôture, l'éditeur s'ouvre automatiquement et révèle les cinq classements finaux (général, national, départemental, ville, team) avec positions et effectifs. Les contrôles numériques habituels s'appliquent. Ils sont affichés dans la fiche et dans l'export PNG, après le tableau des tentatives.
- Le statut de clôture est persistant dans IndexedDB, JSON et les sauvegardes Supabase du module. Modifier ultérieurement le record ne réactive jamais « En cours », ne supprime jamais ses classements et ne le rouvre pas par accident.
- Pour éviter de rouvrir de nouvelles tentatives une fois le record clôturé, le bouton « Ajouter une tentative » et la suppression de tentatives sont désactivés ; les données de tentatives existantes peuvent encore être corrigées dans l'éditeur.
- Aucune notation Rapli /100 n'est calculée sur les records, même après clôture ; les cinq classements finaux sont conservés séparément de cette notation.


## Évolutions validées — #16 Palmarès et #17 Fuseaux horaires (15 novembre 2026)

- **Palmarès personnel** : nouvel onglet PALMARÈS en lecture seule, calculé depuis les fiches existantes. Compteurs de victoires, podiums, top 10 et records avec temps validé ; meilleures places, meilleur percentile, meilleure note Rapli /100, course la plus courte, meilleur temps de record, meilleur gain VSR ; meilleurs classements, médailles par type de classement et saisons marquantes.
- Les courses **terminées et classées** alimentent le palmarès VSR ; les fiches record constituent une catégorie de records distincte et ne reçoivent pas de note VSR.
- Le palmarès ne crée aucune nouvelle table ni aucun nouvel enregistrement ; il se régénère après ajout, modification, suppression ou synchronisation.
- **Fuseau horaire par fiche** : champ timezone (identifiant IANA) choisi dans l'éditeur. Par défaut Europe/Paris pour les anciennes fiches, afin de préserver l'interprétation française des horaires historiquement enregistrés. Une course record utilise le même fuseau pour toutes ses tentatives.
- Les heures de départ et d'arrivée sont des **heures civiles du fuseau choisi**, et non celles du navigateur. Calcul d'arrivée sur instants UTC réels, compteurs et statut automatique basés sur ces mêmes instants. Passage à l'heure d'été : une heure locale inexistante est refusée ; en cas d'heure répétée à l'automne, c'est la première occurrence qui est utilisée (règle documentée).
- L'export **Apple Calendrier .ics** encode les courses avec heure en UTC (DTSTART/DTEND terminés par Z) pour conserver l'instant exact lors de l'ouverture sur un autre appareil ou dans un autre fuseau. Apple Calendrier affichera cet instant dans le fuseau choisi par son utilisateur. Les courses sans heure restent des événements « journée entière ».
- Aucune modification des barèmes VSR, des notes figées ou des politiques Supabase / RLS.

### Vérifications ciblées

- Syntaxe des scripts validée et présence des onglets/champs vérifiée.
- Tests logiques réussis : hiver/été Paris, changement d'heure de mars et d'octobre, heure inexistante, Guadeloupe, New York, UTC et conversion .ics.
- Cas d'export .ics validés : été français, bascules de mars/octobre, Guadeloupe, course sans heure, rejet d'une heure inexistante.
- Reste à tester manuellement : rendu et navigation dans PALMARÈS sur PC/iPhone Safari, import et affichage d'un .ics dans Apple Calendrier, synchronisation PC/iPhone avec une fiche comportant un fuseau différent.
- Modifications uniquement dans la PR #1, toujours en brouillon ; aucune fusion ni mise en production demandée.


## Évolutions sélectionnées — #14, #34 et #79 (16 novembre 2026)

- **#14 Drapeau de départ** : badge « 🏁 DÉPART AUJOURD’HUI » lorsque la date de départ correspond à la date courante dans le **fuseau de la course**, pour les courses normales et les dernières tentatives de record.
- **Organisation à deux colonnes** : unique mode d’affichage des fiches, sans bouton de bascule ; photo et chronologie à gauche, données sportives à droite ; même structure pour les fiches normales, records et étapes.
- **#79 Type de parcours** : champ facultatif parmi Tour du monde, Transatlantique, Côtier, Course à étapes, Record de distance et Autre parcours. Stockage dans la fiche existante, libellé visible sur la tuile et texte pris en compte dans la recherche.
- Aucun changement de barème VSR, d’historique de notes, de classement ou de politique Supabase.
- Tests de syntaxe et présence des contrôles réalisés ; mise en page PC/iPhone et synchronisation restent à valider sur la Deploy Preview.

## Barre d'actions et présentation des fiches (PR #4)

- Le premier bouton **↻** de la barre des courses déclenche une synchronisation manuelle Supabase (envoi des modifications locales en attente pour l'administrateur, ou récupération des nouveautés). Le bouton **calculatrice** distinct ouvre le recalcul des notes ; il n'est pas lié à la synchronisation.
- Les messages Cloud apparaissent en **surimpression translucide** sur tous les onglets ; disparition automatique après environ 3,6 secondes pour une confirmation, 4,8 secondes pour un chargement et 6,5 secondes pour une erreur. Aucun statut permanent ni deuxième bouton ↻ sous la recherche.
- Les dates **Départ**, **Arrivée** (ou **En cours / À venir**) et la **durée totale / chrono / compte à rebours** sont désormais présentées verticalement dans la colonne gauche. Le chrono existant utilise les dates, heures et fuseaux sauvegardés, pour les courses, étapes et records.
- Les tags horaires, équipements, gains et les cinq classements utilisent un **foil clair premium** en reprenant leurs couleurs existantes (bleu pétrole, bleu, menthe, lavande, champagne, or et vert). La note circulaire reste indépendante.
- Suppression du titre « MES COURSES / RACE ARCHIVE », mais conservation du nombre de résultats et de la pagination.

## Disposition des tuiles : deux colonnes (PR #4)

- **Gauche** : illustration 16:10 non recadrée (zoom au clic), puis menu **« … »** juste avant le titre, date/heure de départ, arrivée ou libellé **En cours / À venir**, durée totale pour les courses achevées ou minuteur précis mis à jour toutes les secondes. Un record clôturé présente le meilleur temps validé ; un record en cours utilise le départ de la dernière tentative.
- **Droite** : classe de bateau, équipement et VSR en tags foil, classement général avec note circulaire lorsqu’elle est applicable, quatre classements complémentaires, gains VSR et crédits VR. Les records ne reçoivent ni note ni gains fictifs, mais gardent leurs tentatives et classements de clôture. Les étapes restent évaluées selon leur règle de notation existante.
- **Menu « … »** : capture finale, tracé (si disponibles et autorisés par le statut), modifier, exporter PNG, ajouter au calendrier iOS si le départ est futur, clôturer le record si ouvert, supprimer. Un seul menu à la fois ; fermeture au clic extérieur ou avec Échap. Les captures s’ouvrent dans la visionneuse existante.
- Les photos, courses, classements, gains, préférences foil et sauvegardes Supabase/IndexedDB ne changent pas de format. Seule leur **présentation** est remaniée.

## Indicateur météo GFS (PR #4)

Les tuiles de course ou de record avec le statut **En cours** affichent automatiquement un mini-bloc météo GFS **dans la colonne de droite, à la place du classement non disponible**. Les courses **À venir** (et les records avec une prochaine tentative future) affichent un **briefing météo pré-départ** dans cette même zone, sans classements prématurés. Les tuiles terminées, DNF et records clôturés gardent leur vue de résultats. Aucun champ n'est enregistré et aucune donnée des courses n'est modifiée.

- Cycles de premières données estimés à **03h40, 09h40, 15h40 et 21h40 UTC**, d'après [l'assistance Virtual Regatta Offshore](https://virtualregatta.zendesk.com/hc/fr/articles/115001441254-Pr%C3%A9visions-M%C3%A9t%C3%A9orologiques-et-Mise-%C3%A0-Jour).
- Heure de prochaine actualisation présentée dans le fuseau **Europe/Paris**, automatiquement adaptée à CET/CEST, y compris lors des changements d'heure.
- Compte à rebours **HH:MM:SS**, recalculé à chaque seconde, et estimation de progression de **0 à 100 %** sur une fenêtre indicative de 80 minutes après le début d'un cycle. Message « Intégration estimée » pendant les 30 premières minutes, « Consultation pertinente » de 30 à 80 minutes, puis « Météo à consulter ».
- **Aucune API météo Virtual Regatta n'est consultée** : l'avancement et le conseil sont exclusivement des **estimations horaires**. Les données affichées dans Virtual Regatta font foi ; retards et durées de diffusion peuvent différer. L'interface précise « estimation » et son infobulle rappelle la limite.
- Le rafraîchissement se fait **en place** sur le texte et la barre de progression ; aucune recréation de tuile ou de photo. Reprise immédiate au retour sur l'onglet, sans écriture Supabase/IndexedDB.
- Le **briefing d'avant-course** affiche le dernier GFS estimé exploitable avant le départ (avec horaire indicatif de consultation, +80 minutes), le cycle suivant et son rapport avec l'heure de départ (chargement éventuellement en cours). Un fin bandeau de conseil de routage occupe l'espace libre. Les dates/heures sont calculées depuis le départ de la course dans son fuseau, puis converties en Europe/Paris avec changement été/hiver automatique. Si l'heure de départ manque, il invite à la renseigner. Le statut « À préparer / À consulter » suit le cycle sans recharger les photos. Le statut À venir ne montre pas les points/crédits encore non acquis.


Tests : `tests/regatta-gfs.test.cjs` (cycles UTC, hiver/été, bascules DST, compte à rebours, progression, statut, préservation du nœud image).

### Préparation avancée : routage et classement théorique (PR #4)

- Sous le briefing GFS des **courses à venir**, un module compact affiche (1) un compte à rebours jusqu'au **dernier routage conseillé** selon le cycle GFS théoriquement exploitable, (2) l'**historique personnel des courses terminées dans la même classe**, et (3) une **projection de classement théorique**.
- Le champ **Participants au départ** (`startParticipantCount`) est distinct de l'**effectif final** (`participantCount`) et des totaux de classements (`rankTotal`, etc.). La saisie du premier est facultative, manuelle, sauvegardée avec la fiche et conservée après clôture ; aucune copie automatique depuis l'effectif final n'est effectuée. Les anciennes courses restent compatibles (champ vide).
- Pour chaque course passée **terminée**, dans la **même classe**, dotée d'un rang général et d'un effectif final cohérents, on calcule `rang / effectif final`. La **médiane** de ces Top % historiques est appliquée à l'effectif au départ de la nouvelle course : `rang théorique ≈ arrondi(médiane × participants au départ)` (borné entre 1 et le nombre de partants).
- Une fourchette basée sur les quartiles historiques (25e et 75e percentile) apparaît uniquement à partir de **trois** courses comparables. Sinon l'estimation reste explicitement indicative. L'historique présente le nombre de courses terminées et le meilleur rang absolu. Les événements et records ne contaminent pas la projection.
- La projection n'est **pas un classement Virtual Regatta officiel ni une promesse de performance** ; elle utilise les proportions de classements finaux passés et ne préjuge ni de l'effectif final futur ni de la force du plateau. Sans historique comparable ou sans participants au départ, aucun rang n'est inventé.
- Les chronos de routage évoluent à l'écran chaque seconde sans recharger la tuile ou ses images. Les courses en cours continuent d'afficher le bloc météo GFS actif ; les courses terminées continuent d'afficher les classements.
- Tests de calcul, de saisie distincte, de rendu et du compteur : `tests/regatta-prestart-insights.test.cjs`.


## Laboratoire GFS NOAA 0,25° (PR #4 · prototype 1)

Un bloc `LAB GFS 0,25°`, repliable et séparé des tuiles de course, permet de tester **manuellement** la source NOAA depuis l'aperçu Netlify. Aucun téléchargement n'a lieu lors du chargement de la page.

- Endpoint Netlify : `/.netlify/functions/gfs-probe`. Il accède uniquement à `nomads.ncep.noaa.gov`, sans URL arbitraire fournie par le navigateur.
- Fichier NOAA : GFS 0,25° `f006`, cycle UTC 00/06/12/18Z choisi avec **8 h de marge** pour éviter une échéance encore non publiée. Cette méthode reste une estimation de disponibilité : elle n'atteste pas la complétude du cycle.
- Paramètres : `UGRD`, `VGRD`, niveau `10 m above ground`, sous-région 40–52°N / -20°–5°E. Une seule échéance, volontairement limitée pour éviter une surcharge NOAA.
- Contrôles : réponse HTTP correcte, signature `GRIB`, édition GRIB2, sections cohérentes et identification des deux composantes U/V. La réponse retourne taille du fichier, cycle et variables effectivement détectées.
- Protections : timeout de 12 s, plafond de 4 Mio, cache 15 min par instance Netlify et requête uniquement sur clic. Message d'erreur explicite si le serveur NOAA refuse ou change de format.
- **Ne décode pas encore les valeurs U/V de la grille** (encodages GRIB2 potentiellement complexes), ne calcule ni vent local ni route ni passage à l'Équateur/Bonne-Espérance. Aucun chiffre fictif n'est affiché.
- Aucun changement de collection, Supabase ou des widgets météo existants. Les polaires Ultim BP XI fournies précédemment restent une source provisoire, non Full Pack.

Tests structurels : `tests/regatta-gfs-source.test.cjs` (sélection du cycle, URL, paires de champs U/V, rejet HTML/GRIB tronqué, erreurs NOAA et limite de taille). **Un test en production sur la preview Netlify reste nécessaire** pour confirmer que NOMADS répond dans son environnement.


## Laboratoire GFS : décodage des vents (PR #4 · prototype 2)

Le panneau `LAB GFS 0,25°` affiche désormais deux boutons indépendants :

- `TESTER LES DONNÉES NOAA` : contrôle de signature/sections GRIB2 et présence UGRD/VGRD (prototype 1).
- `MESURER LE VENT RÉEL` : récupère un fichier GFS `f006` sur la même zone Atlantique Nord-Est, décode les deux composantes du vent à 10 mètres et lit le point de grille le plus proche de **48,50°N, 8,00°O** (au large de Brest). La force est calculée en nœuds et la direction affichée est la provenance météorologique (0° = nord).

Le décodeur `@azohra/meteo.grib@0.1.4` est déclaré comme dépendance de production (Node 22 minimum). Il gère la compression GRIB2 5.3 utilisée par GFS, contrairement au contrôle structurel du prototype 1. Les champs sont contrôlés sur la discipline météo, la catégorie du vent, le type de surface et la hauteur 10 mètres (template produit 4.0). Le décodage refuse les points hors-grille, les valeurs non finies et les métadonnées ambiguës.

Le chargement reste **déclenché uniquement sur clic**, avec cache temporaire par instance Netlify (15 min pour réussite, 3 min pour échec), timeout et limite de taille. Ni sauvegarde de course, ni écriture Supabase, ni tâche planifiée. En cas d'échec NOAA, le widget indique une erreur et n'affiche pas de valeurs fictives.

Les horaires de cycle et de validité sont affichés en heure française, automatiquement adaptée à l'heure d'été/hiver. Le fichier `f006` sélectionné est un cycle suffisamment ancien pour le test, **pas nécessairement le plus récent**. L'étape suivante sera de récupérer plusieurs échéances et de produire un champ de vent interpolable pour le routage à l'équateur.

Tests automatisés `tests/regatta-gfs-wind.test.cjs` et `tests/regatta-gfs-source.test.cjs`. Un **test réel du bouton** sur la Deploy Preview Netlify reste indispensable avant de considérer le décodage NOAA comme confirmé en exploitation.


## GFS 0,25° · lecture multi-points / échéances (PR #4 · prototype 3)

Suite à la validation sur iPhone du vent NOAA réel à 48,5°N / 8°O (27,9 nds, 289° sur le cycle 00Z / f006 du 22 novembre 2026), le LAB GFS permet à présent de sélectionner **f006, f012 ou f018** sur un même cycle et d'afficher simultanément **trois points de vent** :

- 48,50°N / 8,00°O : large de Brest
- 44,50°N / 12,00°O : ouest du golfe de Gascogne
- 41,50°N / 15,00°O : large du Portugal

Un seul fichier GRIB2 est demandé par clic : chaque composante UGRD/VGRD est décodée une fois, puis les valeurs sont lues aux trois points de grille les plus proches. Toutes les mesures sont des **prévisions** du GFS, pas des observations. La lecture ne simule pas encore de mouvement de bateau ni de temps de passage à l'équateur.

Protection NOAA : liste fermée des échéances, un seul appel manuel à la fois dans l'interface, cache serveur par échéance, espacement minimal de 10 secondes entre appels NOAA par instance Netlify et aucune tâche automatique. Les erreurs restent visibles sans valeur météo fictive.

Les polaires Ultim BP XI fournies par captures sont encore provisoires (non Full Pack). La grille actuelle est volontairement limitée à l'Atlantique nord-est ; ce premier affichage **n'est pas encore le routage**. L'étape suivante consiste à élargir la zone et à interpoler le vent dans l'espace et le temps, puis à lancer un premier moteur de trajectoire sous contraintes.

Les textes obsolètes indiquant « aucun décodage des vitesses » ont été corrigés, puisque le décodage est désormais effectif.


## GFS 0,25° · interpolation temporelle (PR #4 · prototype 4)

Après lecture **réussie** de deux échéances voisines (+6 et +12, ou +12 et +18 heures) du **même cycle NOAA**, le LAB GFS affiche respectivement un vent intermédiaire à **+9 h** ou **+15 h** pour chacun des trois points atlantiques.

- Méthode : interpolation temporelle linéaire des **composantes vectorielles U/V**, puis recalcul de la force (nœuds) et de la direction météorologique. Ne pas interpoler directement les directions en degrés (difficulté du passage 359° → 1°).
- Les trames météo sont mémorisées **uniquement dans la page ouverte**, sans Supabase, IndexedDB ni requête supplémentaire. Une trame d'un nouveau cycle vide les anciennes pour interdire les mélanges.
- Les interpolations sont refusées lorsque les cycles, échéances, dates de validité, points ou vecteurs sont incohérents ou incomplets. L'écran distingue clairement **INTERPOLÉ** des prévisions réelles NOAA.
- L'interpolation **spatiale** n'est pas encore implémentée : les trois sites restent des lectures au nœud de grille le plus proche. Aucun calcul de trajectoire, départ optimal, équateur ou cap de Bonne-Espérance n'est affiché.

Tests : `tests/regatta-gfs-interpolation.test.cjs`. Le déploiement reste strictement limité à la PR #4.
