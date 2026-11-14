# Rapli Regatta — journal de courses (PR #1)

Module intégré à la PR #1 de RapliLab, non fusionnée.

- Onglet : `#regatta` ; page directe : `regatta/index.html`.
- Deploy Preview attendue : https://deploy-preview-1--raplilab.netlify.app/#regatta
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
- Sur chaque tuile, **nom de la course à gauche et tags de classe de bateau + catégorie VSR à droite**, alignés horizontalement. La ligne s’adapte à l’iPhone : le nom peut revenir à la ligne et les libellés trop longs sont tronqués sans déplacer les tags. Même alignement dans l’export PNG ; l’ancienne année d’édition n’est plus affichée.
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

- Troisième vue interne **COULEURS DES CLASSES** : choix d’une **couleur générale** (initialement turquoise), puis possibilité de personnaliser chaque classe IMOCA, ULTIM, Class40, Ocean Fifty, Mini 6.50 ou toute classe enregistrée. Sous les bateaux, gestion indépendante des couleurs des **quatre catégories VSR**, avec palette par défaut (Hors Catégorie dorée) et hiérarchie fixe.
- Changer la couleur générale **applique la nouvelle couleur à toutes les courses** et, après confirmation, réinitialise les exceptions propres aux classes. Changer une classe met à jour simultanément toutes les courses portant cette classe (en ignorant les différences de casse et de présentation).
- Les anciens champs `classColor` par course sont conservés dans les données historiques mais **ne pilotent plus l’affichage**. Les couleurs des tuiles et des exports PNG proviennent exclusivement des réglages globaux ; le contraste du texte est calculé automatiquement.
- Réglages enregistrés localement sous `rapli-regatta-class-colors-v1` et synchronisés sur Supabase via l’objet de paramètres de la collection. Les réglages par défaut ne créent pas de faux contenu dans un nouveau compte. Import/export JSON inclut les couleurs (version 2) et les anciens JSON restent importables.

## Navigation, statistiques et exports

- **Tri par défaut : date de départ récente → ancienne**, avec possibilité de classer par importance VSR (Hors Catégorie, VSR 1, VSR 2, VSR 3), puis départ récent.
- Filtres par statut, classe de bateau, **catégorie VSR** ; recherche texte.
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
- Pour une **course cochée À venir**, bouton **📅 CALENDRIER** produisant un fichier `.ics` compatible avec l’import dans Apple Calendrier : horaires de départ/arrivée si connus, journée entière si heure manquante, ou plage indicative d’une heure si durée absente. Le téléchargement ne crée pas directement un événement sans l’action d’importation de l’utilisateur.
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
