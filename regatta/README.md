# Rapli Regatta — journal de courses (PR #1)

Module intégré à la PR #1 de RapliLab, non fusionnée.

- Onglet : `#regatta` ; page directe : `regatta/index.html`.
- Deploy Preview attendue : https://deploy-preview-1--raplilab.netlify.app/#regatta
- Logo fourni intégré en WebP transparent ; charte turquoise/rose ; Poppins.
- Bloc du module limité à **1 120 px**, portail limité à **1 360 px** ; 11 onglets sur une seule ligne défilante sur iPhone. Sur bureau : dégradé latéral teinté et répétitions discrètes du logo en noir et blanc.
- Affiche de course **16:9 intégrale sans rognage** ; captures de classement et de tracé indépendantes, affichées sans déformation, zoom partagé.

## Fiches de courses

- Nom de course, nom du bateau, classe (libre avec suggestions IMOCA/ULTIM/etc.) et **couleur personnalisable du tag de classe**. Le champ « Édition/année » est supprimé du formulaire : l’année se déduit du départ. Les anciennes valeurs d’édition restent conservées dans les données archivées pour compatibilité.
- **Catégorie VSR** : Hors Catégorie (**pastille dorée et en gras**), VSR 1, VSR 2, VSR 3 ou non renseignée.
- **Deux cases indépendantes mais mutuellement exclusives** : « Course en cours » (halo turquoise) et « À venir » (halo bleu).
- **Équipement unique et facultatif** : PDD, 1/2 FP ou Full Pack (cases exclusives) ; zéro choix possible.
- Sur chaque tuile, **nom de la course à gauche et tags de classe de bateau + catégorie VSR à droite**, alignés horizontalement. La ligne s’adapte à l’iPhone : le nom peut revenir à la ligne et les libellés trop longs sont tronqués sans déplacer les tags. Même alignement dans l’export PNG ; l’ancienne année d’édition n’est plus affichée.
- Cinq classements avec **position / nombre de joueurs**, affichés avec la police sportive **Barlow Condensed ExtraBold** (tuiles, formulaire et export PNG), et non une serif type Times New Roman :
  - 🏆 Général : plaque principale agrandie (serif blanche sur fond contrasté) ;
  - 🇫🇷 National : petite plaque ;
  - 🇨🇶 Départemental : drapeau de Sark (affichage emoji selon appareil) ;
  - 🏙️ Ville : cityscape ;
  - 🏴‍☠️ Team : drapeau pirate.
- Durée dans **quatre cases sur une ligne** : jours, heures, minutes et secondes. Police **Courier Prime**, plus douce que Courier.
- Date et heure de départ ; **date et heure d’arrivée calculées** à la seconde (lecture seule) à partir des quatre champs de durée. Calcul de durée en temps civil de la course, sans fuseau de course configuré. Prise en charge des passages de jour, mois, année et année bissextile.
- Formulaire, stockage local, restauration cloud et import/export JSON compatibles avec les anciens enregistrements : les classements « 235e / 4 250 » sont séparés en place et total ; les anciennes durées textuelles sont converties ; une date d’arrivée historique est préservée si l’heure de départ n’avait pas été enregistrée.

## Navigation, statistiques et exports

- **Tri par défaut : date de départ récente → ancienne**, avec autres modes facultatifs.
- Filtres par statut, classe de bateau, **catégorie VSR** ; recherche texte.
- Onglet interne **STATISTIQUES** enrichi, calculé directement à partir des courses de la collection :
  - **Tableau de bord** : total, terminées, en cours, à venir.
  - **Palmarès** : victoires, podiums, Top 10, Top 100, taux de podiums/Top 10 parmi les courses classées, meilleur classement général, moyenne et médiane des places, meilleur et moyen « Top % » (place / participants), records nationaux, départementaux, ville et team.
  - **Temps de navigation** : durée cumulée, moyenne, course la plus courte et la plus longue ; précision à la seconde.
  - **Évolution annuelle** : histogrammes des courses selon l’année de départ, portion terminées et décompte Top 10.
  - **Habitudes** : répartitions des courses par VSR, bateau, équipement et statut.
  - **Performances comparées** : par VSR, classe de bateau et équipement, avec nombre de courses classées, Top 10 et Top % moyen.
  - Les statistiques de performance ne comptabilisent pas les courses « À venir » ou « En cours ». Les métriques nécessitant des classements / participants affichent « — » lorsqu’il manque les données. Les moyennes de durée utilisent uniquement des courses terminées avec durée positive. Aucun nouveau champ ni migration Supabase nécessaire.
- **PNG par course** : affiche 16:9, métadonnées, classe colorée, VSR, date/heure, durée en Courier Prime, **cinq classements (avec position et total)** et les deux captures.
- Pour une **course cochée À venir**, bouton **📅 CALENDRIER** produisant un fichier `.ics` compatible avec l’import dans Apple Calendrier : horaires de départ/arrivée si connus, journée entière si heure manquante, ou plage indicative d’une heure si durée absente. Le téléchargement ne crée pas directement un événement sans l’action d’importation de l’utilisateur.
- Sauvegarde locale automatique dans IndexedDB `rapli-regatta-v1` ; synchronisation Supabase via `RapliModuleBridge`, bucket privé et RLS existants. Aucune nouvelle table ; migration contrainte `regatta/migrations/20261113_add_regatta_module.sql` déjà appliquée.

## Vérifications

- Syntaxe JavaScript contrôlée, champs HTML recoupés.
- Tableau de statistiques testé avec des courses de différentes années, des courses en cours/à venir, des places sans participants et une collection vide. Les podiums et ratios excluent les courses non terminées.
- Scénario simulé de création de course : cinq classements, catégorie VSR, classe colorée, choix « À venir », durée jours/heures/minutes/secondes, calcul d’arrivée, sauvegarde et export ICS.
- Cas de durée vérifiés : `12 j 08 h 35 min`, `8h35`, `1 j 2 h 3 min 4 s`, `00 h 00 min 31 s`, `01:02:03`.
- À tester **dans la vraie Deploy Preview** avant fusion : glisser-déposer d’images, photos et rendu Canvas/PNG, iPhone Safari, ouverture du fichier ICS dans Apple Calendrier, accès Supabase PC ↔ iPhone et conflit de révision, affichage éventuel du drapeau de Sark.
- **PR en draft, non fusionnée : aucun déploiement en production.**
