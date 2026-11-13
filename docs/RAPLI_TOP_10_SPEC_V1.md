# Rapli Top 10 — Cahier des charges V1.0

> **Statut : CONCEPTION VALIDÉE — IMPLÉMENTATION PR #1 EN COURS DE TEST**  
> **Version : 1.0 · 13 novembre 2026**  
> **Périmètre : référence de conception V1.0.** Développement explicitement autorisé le 13 novembre 2026 ; consulter également `top10/SUPABASE.md` pour la réalisation.

## 1. Objectif et principes

Outil de création de classements personnels (sport, cinéma, musique, montres, jeux vidéo, collections, etc.) intégré ultérieurement au Lab de Rapli. Le nom **Top 10** est une marque, **pas une limite de dix rangs**.

- **10 positions par défaut**, nombre entièrement libre (Top 3, 25, 100, etc.).
- **Trois vues interchangeables** : CLASSIQUE, VISUEL, PODIUM.
- Une saisie unique par position, conservée lors des changements de vue ou de thème.
- **Édition directement dans l'aperçu** : résultat actualisé immédiatement, pas de page d'aperçu séparée obligatoire.
- Interface compacte et responsive, inspirée de Rapli Tiers List, avec des commandes essentielles plutôt qu'un éditeur complexe.
- Numérotation toujours calculée à partir de l'ordre actuel, jamais saisie manuellement.

## 2. Logo officiel et direction de l'interface

Le **logo officiel fourni et approuvé par l'utilisateur le 13 novembre 2026** représente :
- lettrage **« Rapli »** crème/ivoire, incliné, avec contour bleu marine profond ;
- mascotte footballeur rétro de dos, dessinée en style comics américain ;
- maillot blanc à liserés bleu/rouge, marqué **« TOP »** au-dessus du **« 10 »** ;
- composition panoramique sur fond transparent, avec mouvement graphique bleu derrière le sujet.

**Fidélité absolue au visuel transmis : ne pas redessiner ni remplacer le logo lors de l'implémentation.** Source utilisateur : `Logo Rapli Top 10 avec footballeur rétro(1).png` (2048 × 682, PNG RGBA). Le fichier source reste à importer comme asset lors de la phase de réalisation si son binaire n'est pas encore présent dans le dépôt.

L'**interface** reprend les couleurs du logo (ivoire, marine, touches de rouge), mais les **exports** respectent les palettes indépendantes des thèmes sélectionnés. Logo centré dans le header, proportions préservées, rendu correct sur mobile.

## 3. Présentations interchangeables

### CLASSIQUE
Liste ordonnée compacte ; numéros très visibles ; nom et champs secondaires ; image optionnelle plus discrète ; adaptée aux longs classements.

### VISUEL
Fiches/cartes centrées sur les images ; numéro toujours lisible ; texte et informations associés ; grille multi-colonnes.

### PODIUM
Trois premières positions distinctement valorisées, puis classement des positions restantes. En dessous de trois positions, le podium s'adapte ; le choix des colonnes s'applique principalement aux éléments **après** le podium.

**Invariant :** changer de présentation ne change ni l'ordre, ni les données, ni le nombre de positions.

## 4. Données d'une position

| Champ | Exigence |
| --- | --- |
| **Nom ou titre** | **Obligatoire** |
| Image principale | Facultative |
| Sous-titre | Facultatif |
| Description courte | Facultative |
| Petit logo secondaire | Facultatif, distinct de l'image |
| Note ou score | Facultatif ; saisie libre, p. ex. « 9,5/10 », « 98 », « A+ » |

- Aucun espace réservé inutilement aux champs laissés vides.
- Images/logo importés depuis l'appareil, associés durablement au classement.
- Un emplacement temporairement vide peut exister pendant l'édition ; à l'export, informer clairement l'utilisateur de toute position dont le nom obligatoire manque plutôt que d'exporter une carte incomplète sans avertissement.
- Le rendu des champs dépend de la présentation et du thème sans perdre leur contenu.

## 5. Éditeur essentiel — périmètre strict V1.0

Inclus :
- ajouter, éditer, supprimer une position ;
- importer/retirer/remplacer son image et son petit logo ;
- réordonner par glisser-déposer **et** par flèches accessibles (alternative tactile iPhone) ;
- modifier le nombre de positions ; renuméroter immédiatement et conserver les données des positions existantes ;
- choisir la vue et le thème avec aperçu en direct.

Non retenus en V1.0 :
- sélection multiple, actions par lots et raccourcis avancés ;
- duplication individuelle de position ;
- annuler/rétablir ;
- import massif de nombreuses images en une opération.

**Attention :** la duplication d'un **classement entier dans la bibliothèque** est, elle, bien prévue.

## 6. Thèmes et personnalisation légère

Quatre thèmes, compatibles avec **les trois présentations** :

1. **MAGAZINE** — éditorial, Serif chaleureuse, crème, noir.
2. **SPORT** — dynamique, grands numéros, bleu/blanc, Poppins.
3. **MINIMALISTE** — épuré, gris/anthracite, contrastes sobres.
4. **VINTAGE** — rétro, couleurs chaudes et effet papier.

Réglages globaux et limités : couleur principale, couleur du fond, police dans une sélection restreinte. Les marges, cadres, tailles et autres paramètres complexes sont pilotés par les thèmes, sans personnalisation du style fiche par fiche.

## 7. Colonnes et typographie automatique

- **Nombre de colonnes ajustable** avec mode **AUTO** et réglage **manuel**.
- En AUTO, la disposition prend en compte la vue, les images, la quantité de texte, le nombre de positions et la largeur utile.
- En manuel, le système respecte le choix dans les limites d'une composition lisible ; aucune position perdue ni ordre de classement perturbé.
- En PODIUM, le podium conserve sa hiérarchie spécifique ; les colonnes concernent surtout la suite de la liste.
- **Police auto-adaptative** : les noms restent prioritaires, les autres champs suivent la hiérarchie. Réduction progressive des tailles si nécessaire, puis agrandissement vertical de la fiche ou retour à la ligne avant tout rognage.
- Pas de texte exporté coupé silencieusement. Maintenir un contraste suffisant et une bonne lecture.

## 8. Interface et responsive

- Zone centrale compacte cohérente avec les autres outils Rapli.
- Barre compacte comprenant : **NOUVEAU, BIBLIOTHÈQUE, ENREGISTRER, PRÉSENTATION, STYLE, EXPORTER PNG** ; réglages secondaires repliables.
- Classement directement éditable et rendu actualisé en temps réel.
- Compatible ordinateur et Safari iOS : commandes tactiles, flèches alternatives au drag, pas de zoom intempestif au focus, pas de débordement horizontal.
- Le zoom d'affichage de l'aperçu sur mobile ne modifie jamais la géométrie exportée.
- Indicateur discret de modifications non sauvegardées.

## 9. Export — PNG uniquement

**Aucun PDF ni JPG. Un seul fichier PNG vertical.**

- Largeur de référence **1 080 px** ; hauteur entièrement **adaptative au contenu**.
- Facteurs : **×1 (1 080 px), ×2 (2 160 px), ×3 (3 240 px — défaut), ×4 (4 320 px)**. La hauteur est multipliée proportionnellement.
- Titre du classement **toujours visible** en tête de l'export.
- Respect de la présentation, du thème, des champs visibles, du nombre de colonnes et de la typographie adaptative.
- Jamais de boutons, inputs, poignées de drag, outils ni repères d'édition dans le PNG.
- Téléchargement direct avec nom de fichier dérivé du titre, PC et Safari iPhone.
- Les listes longues (Top 50/100+) restent **sur un PNG unique**, sans découpage automatique.
- **Prévenir les dépassements des limites réelles du navigateur** (dimensions de canevas, mémoire, échec d'encodage) : ne pas produire de PNG tronqué ou vide ; proposer de diminuer le facteur de résolution et/ou le nombre de colonnes, sans toucher aux données enregistrées.
- La réduction de police ne doit pas être utilisée pour contourner un problème au prix de textes illisibles.

## 10. Bibliothèque et sauvegarde

Bibliothèque personnelle intégrant :
- nouveau classement et ouverture d'un classement existant ;
- recherche par titre, tri ;
- renommage, duplication **du classement entier**, suppression avec confirmation ;
- conservation de l'ordre, des six champs, des images/logos, de la vue, du thème, des couleurs, de la police, des colonnes.

**Sauvegarde explicitement MANUELLE** : pas d'autosave du contenu. Bouton **ENREGISTRER** avec feedback clair ; prévenir avant perte de modifications non sauvegardées.

- **Stockage local** persistant (adapté aux images).
- **Synchronisation Supabase** du classement et de ses images/logos via le service partagé lorsqu'il sera implémenté, dans l'espace autorisé de l'utilisateur et en respectant RLS/stockage privé.
- Gestion des conflits multi-appareils : jamais écraser silencieusement des modifications concurrentes.
- En cas d'échec cloud, préserver la copie locale, informer l'utilisateur et permettre une nouvelle tentative.
- Ne pas confondre l'autosynchronisation d'autres modules avec l'absence d'autosave demandée pour Top 10.

## 11. Critères de recette

- [ ] Top 10 initial ; adaptation à Top 3, 25, 100 et plus.
- [ ] Saisie/édition des 6 champs, image et logo facultatifs, validation du nom.
- [ ] Réorganisation tactile/souris/flèches ; renumérotation immédiate.
- [ ] CLASSIQUE ↔ VISUEL ↔ PODIUM sans perte de contenu.
- [ ] Les 4 thèmes fonctionnent dans chacune des 3 vues.
- [ ] Colonnes AUTO et manuel, lisibilité de la police automatique, pas de texte perdu.
- [ ] Édition et aperçu réunis, sans rafraîchissement manuel.
- [ ] PNG unique ×1/×2/×3/×4, 1 080 px de référence et hauteur adaptée, titre visible.
- [ ] Signalement des exports excédant les limites du navigateur ; pas de troncature.
- [ ] Bibliothèque : création, recherche, tri, renommage, duplication, suppression.
- [ ] Enregistrement manuel local puis Supabase ; réouverture sur PC/iPhone et résolution des conflits.
- [ ] Utilisation complète sur Safari iPhone et ordinateur.
- [ ] Aucun impact fonctionnel sur Archives, Tiers List ou les autres modules.

## 12. Gestion de projet et exclusions

**La conception est désormais accompagnée d'une implémentation de test en PR #1, suite au feu vert explicite de l'utilisateur.** Elle ne vaut **pas** autorisation de :
- mettre en production Top 10 sans recette validée ;
- fusionner la PR #1 ;
- déployer en production.

Le développement sera une étape distincte après feu vert explicite. Les décisions ci-dessus sont considérées comme validées ; les détails techniques non déterminés restent des choix d'implémentation à faire **sans contredire** ce cahier des charges.
