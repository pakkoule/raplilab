# Évolutions de collection — PR #4

## Parcours

- Bibliothèque → Couleurs & variations : comparaison actuel/brouillon sur les mêmes cartes d’exemple, HEX validé et copiable, favoris (24 maximum), troisième couleur, angle, intensité foil et épaisseur du contour. Le contour est dessiné en surimpression, sans agrandir les cartes. Les favoris enregistrés sont aussi proposés au focus des sélecteurs de couleur des autres éditeurs de la bibliothèque.
- Menu VUE : derniers ajouts, légendaires, rookies, gradées, saisons, musée Dreamlist, véritables One of One, Printing Plates et 1/1 à vérifier. Les vues habituelles conservent leurs groupes et leur pagination. Hors musée Dreamlist, le statut OWN/Wishlist actif reste le périmètre de la vue.
- Recherche : mots dans n’importe quel ordre, suggestions d’athlètes navigables avec les flèches/Entrée, surlignage irisé, effacement, Ctrl/Cmd+K et correspondance exacte des fractions. `Maxey Topps /25` combine texte et tirage.
- Édition : suivi Wishlist, classification 1/1, couleur CMYK, photo séparée du bandeau de grading et provenance. Un grading 10 conserve son fond doré clair ; sa photo de certification s’ouvre au clic, au clavier ou au toucher.
- Rainbow : « Simuler +1 » affiche la progression obtenue avec une variante manquante, sans écriture.
- Bibliothèque → Logos historiques : sélectionner l’équipe ou le tag Compétition existant, définir une période et importer l’image. Les intervalles sont inclusifs ; les chevauchements sont refusés. Une saison complète doit être contenue dans la période. Sans correspondance, le logo principal est conservé.
- Arrivées (administrateur) : préparation manuelle à partir d’un lien ou d’une checklist, correction, alerte de doublon potentiel, ajout individuel ou des fiches cochées. Au moins athlète et marque sont nécessaires pour valider ; les lignes incomplètes restent en attente. Aucun scraping n’est exécuté.

## Compatibilité

Aucune migration. Aucun abonnement réseau ni lecture supplémentaire par recherche/navigation. Les images imbriquées et les nouveaux champs utilisent le parcours de synchronisation différentielle existant.

Champs carte ajoutés : `wishStage` (`ordered` / `shipping`), `uniqueKind` (`oneofone` / `plate`), `plateColor`, `gradePhoto`, `source`, `sourceUrl` ; les imports peuvent conserver `name` et `price`.

Les anciennes 1/1 sans classification explicite ne sont pas converties automatiquement. La vue « 1/1 à vérifier » permet de les classer ; elles restent dans leur collection et leurs Rainbows. Les compteurs One of One excluent plaques et classifications inconnues. Le compteur d’exemplaires ne compte que les cartes OWN et distingue saisons, tags, tirages, caractéristiques auto/patch et couleurs de plaque.

Les variantes historiques sont stockées dans `historical` sur le logo existant. Les fiches d’import sont des enregistrements `wishlist-inbox` indépendants de la bibliothèque de logos visible. Un identifiant de carte déterministe par fiche évite les doublons en cas de reprise après une interruption. Les brouillons terminés restent marqués comme tels pour permettre cette reprise.

## Validation

`npm test` : tests unitaires et parcours jsdom intégrant le véritable HTML et ses modules, dont recherche exacte, vues, import, accès visiteur, grading, historique des logos, conservation des champs à l’édition et simulation Rainbow sans écriture. Les tests de synchronisation différentielle existants restent inclus.

Contrôle visuel desktop et Safari iPhone restant à réaliser sur la Deploy Preview. Le lancement de Chromium local est bloqué par la restriction de sockets de l’environnement ; aucun test Safari réel n’a été exécuté. Aucun déploiement en production n’est autorisé par cette PR.
