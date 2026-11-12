# RAPLI TRIO V3.0 — Ergonomie des onglets

Cette version part de V2.9 et conserve les trois applications et toutes les fonctions.

- **Rapli Archives** : boutons « Copier la référence » et « Télécharger l’artwork » placés dans le bas de la tuile, directement à gauche de OWNED, avec ajustements mobile.
- **Rapli Tools** : navigation des six ateliers plus compacte et **sans icônes glyphes** ; libellés et descriptions restent visibles. Suppression du header interne avec le logo en doublon ; le logo du portail suffit.
- **Portail** : indication d’onglet actif plus franche (bordure, halo subtil, barre et témoin colorés) sur les trois onglets et en responsive.
- **Accueil** : Rapli Tools est l’onglet sélectionné par défaut ; les liens directs `#archives`, `#stickers` et `#tools` restent opérationnels.

Cette mise à jour ne publie rien sur Netlify ; les données personnelles sauvegardées dans le navigateur ne sont pas exportées dans ce ZIP.

---

# RAPLI TRIO — V2.9 · EXIF intelligents et fiche technique

Mise à jour de **Rapli Tools → EXIF & Privé** sur la version V2.8, sans supprimer ni changer les autres ateliers, Rapli Archives ou Stickers Lab.

- **Détection des extensions trompeuses** à partir de la signature binaire réelle (ex. `.png` contenant un JPEG) ; avertissement visible dans la liste, dans l'inspecteur et le rapport copiable. Les fichiers nettoyés portent l'extension correspondant à leur format réel.
- **Fiche technique toujours visible**, même sans EXIF : poids, dimensions, mégapixels, proportions, orientation, compression, profondeur (bits/canal), canaux couleur, transparence, densité lorsque disponible, nom de profil ICC ou sRGB reconnu, et date de modification *du fichier* (pas date de prise de vue).
- **Interface simplifiée sans EXIF** : les 12 cases vides sur les réglages photographiques disparaissent et sont remplacées par un message explicite. Quand des EXIF sont présents, seuls les champs décodables sont affichés.
- **Format réel détecté sans croire l'extension**, même si un logiciel ou un e-mail a renommé le fichier.
- **Préservation des nettoyages existants** : JPEG, PNG, WebP ; orientation JPEG, suppression EXIF/XMP/IPTC ciblée, ZIP par lot, traitement local.

Les informations techniques indiquées comme non disponibles ne sont pas inventées. La présence d'un profil ICC ne garantit pas qu'il s'agisse de sRGB ; le nom est lu dans le profil quand il est récupérable. La date de modification est un attribut du fichier importé, pas nécessairement la date de capture.

---

# RAPLI TRIO — V2.8 · Atelier EXIF & Confidentialité

Cette version reprend **RAPLI TRIO V2.7** sans retirer les outils du convertisseur, PDF Studio, de l'éditeur photo, ni les applications **Rapli Archives** et **Rapli Stickers Lab**.

## Nouvelle rubrique Rapli Tools → EXIF & Privé

- Import de plusieurs images **JPEG/JPG, PNG et WebP** (jusqu'à 30 fichiers de 100 Mo chacun, dans la limite de la mémoire disponible).
- Inspection locale sans téléversement : nom et taille du fichier, dimensions lorsque disponibles, fabricant, modèle d'appareil, objectif, date, ISO, ouverture, vitesse, focale, orientation et coordonnées GPS lorsqu'elles sont présentes et correctement formées.
- Inventaire détaillé des balises EXIF lisibles. Comptage des blocs XMP, IPTC, commentaires et textes intégrés ; signalement visuel des coordonnées GPS et des informations sensibles associées.
- Nettoyage individuel ou par lot. Suppression des blocs **EXIF, XMP et IPTC** ciblés ainsi que des commentaires JPEG et métadonnées textuelles PNG. Contrôle par réinspection avant le téléchargement.
- Nettoyage **sans réencodage** des données image JPEG, PNG et WebP pour les photos normalement orientées ; les profils colorimétriques ICC utiles au rendu sont conservés.
- Option cochée par défaut « Préserver l'orientation visuelle » : si un JPEG dépend d'une rotation EXIF (orientation 2 à 8), l'image est exceptionnellement réencodée en JPEG de haute qualité (97 %) pour la maintenir dans le bon sens.
- Téléchargement de chaque image nettoyée ou de tous les résultats dans un **ZIP généré dans le navigateur** sans moteur tiers ni connexion réseau.
- Copie du rapport (si le navigateur autorise le presse-papiers), retrait des fichiers, interface compacte et responsive.

### Précisions techniques

Le nettoyage enlève les catégories de métadonnées explicitement listées, pas absolument tous les champs propriétaires ou blocs techniques possibles dans chaque format. Les profils ICC et certains champs indispensables au décodage / au rendu sont volontairement préservés. Cela ne garantit pas la suppression d'informations sensibles **visibles dans les pixels**. Le fichier d'origine ne change jamais.

HEIC, HEIF, AVIF, TIFF et fichiers RAW ne sont **pas** pris en charge dans cet atelier (leur conversion éventuelle est une fonctionnalité séparée). La réorientation JPEG est un traitement par Canvas et peut légèrement modifier le rendu des pixels. Sur les fichiers dépassant la mémoire disponible de Safari, réduire le nombre de photos traitées simultanément.

### Vérifications effectuées

- Images de test comportant des champs EXIF Canon / date / ISO en JPEG, PNG et WebP : identification des données puis retrait confirmé par une seconde inspection.
- Exemple contenant une position GPS en degrés/minutes/secondes : coordonnées correctement calculées et absentes du résultat.
- Fichiers nettoyés ouverts avec Pillow, mêmes dimensions et rendu de pixels pour les cas sans réencodage.
- JPEG avec orientation EXIF 6 : résultat orienté visuellement (68×100 au lieu de 100×68) et EXIF supprimé.
- Test de l'interface via Chromium sur 320, 393, 768 et 1440 pixels sans débordement horizontal ni erreur JavaScript ; changement d'onglet et téléchargement d'un fichier vérifiés.
- ZIP généré sans dépendance et ouvert par l'outil ZIP de Python (contrôle CRC réussi).

Tests à confirmer sur Safari iOS réel. Aucune mise en production effectuée.

---

# RAPLI TRIO — V2.7 · Convertisseur multi-format

Mise à jour réalisée **sur la V2.6 Performance globale**, en conservant Rapli Archives, Rapli Stickers Lab et tous les autres ateliers Rapli Tools.

## Nouveau convertisseur, inspiré du parcours Convertio

- Parcours simple « **Ajouter → choisir le format → convertir → télécharger** », file d'attente avec vignettes, statut par fichier et conversion par lots.
- Catégories : **Images**, **PDF**, **Documents** et **Audio** (le sélecteur propose les types pris en charge pour chaque catégorie).
- Choix de sortie **individuel par fichier**, ou application d'un format global aux seuls fichiers compatibles.
- Retrait individuel, remise à zéro, barre de progression, annulation entre traitements, téléchargement individuel, ZIP des conversions réussies.
- Réglages : dimensions maximales, qualité d'encodage, couleur de fond des images avec transparence, définition des pages PDF.
- **Images** : JPG/JPEG, PNG, WebP, AVIF, GIF (première image fixe), BMP, SVG et HEIC/HEIF (lecture dépendant de l'appareil) vers PNG, JPG, WebP, AVIF (encodage dépendant du navigateur) ou PDF.
- **PDF** : extraction des pages en PNG/JPG (ZIP si plusieurs pages) et extraction du texte sélectionnable en TXT. Les PDF scannés sans couche texte doivent passer par l'outil OCR existant.
- **Documents texte** : TXT, Markdown et HTML vers TXT/MD/HTML ; CSV ↔ JSON, avec export TXT/MD/HTML de ces données. Conversion de Markdown en HTML : sous-ensemble des syntaxes simples, pas un moteur Markdown complet.
- **Audio** : décodage local de WAV, MP3, OGG, M4A, FLAC ou WebM (selon les codecs du navigateur), puis sortie en WAV PCM 16 bits (non compressé, potentiellement volumineux).
- Conversion locale dans le navigateur sans téléversement de fichiers. Les bibliothèques PDF et ZIP déjà employées dans la V2.6 sont chargées depuis leur CDN et nécessitent une connexion à leur première utilisation.

## Limites à connaître

Le convertisseur **n'est pas un moteur cloud de 300 formats** et n'effectue pas de conversion vidéo, DOCX, PPTX, XLSX, vectorisation image → SVG, conversion audio → MP3 ou OCR automatique. Les sorties AVIF et certains fichiers HEIC/FLAC dépendent du navigateur ; une erreur explicite est affichée si un codec est absent. Les PDF de plus de 120 pages sont à diviser dans PDF Studio. Taille import : 100 Mo par fichier, 60 fichiers maximum. La prise en charge de fichiers personnels reste conditionnée à la mémoire de l'appareil, surtout sur iOS Safari.

## Tests réalisés

- Contrôle de syntaxe JavaScript (Node), ouverture de l'onglet, du panneau avancé et des sélecteurs.
- Conversion effective JPG → WebP, CSV → JSON et Markdown → HTML dans Chromium.
- Responsive en 320 et 393 px, sans défilement horizontal constaté sur les contrôles du convertisseur.
- Tests PDF, audio et Safari iOS complets restant à confirmer en environnement utilisateur réel.

---

# RAPLI TRIO — V2.6 Performance globale

Cette livraison part directement de **RAPLI TRIO V2.5**. Les fonctionnalités, données initiales, apparences et trois applications sont conservées. Aucune migration ni suppression des données personnelles n'est effectuée.

## Optimisations de la V2.6

### Rapli Archives
- Extraction des images géantes intégrées dans `index.html` vers des ressources indépendantes. Le compteur 0–9 et son vortex réutilisent les fichiers identiques déjà présents dans `assets` : aucun changement de visuel du compteur.
- Logo principal converti au format WebP haute qualité avec transparence préservée pour réduire la taille et le décodage initial de la page.
- Catalogue : recherche légèrement différée (90 ms) lors de la saisie, ce qui évite de reconstruire 60 tuiles à chaque frappe. Navigation, recherches, filtres, compteur, propriété et sauvegardes inchangés.
- Décodage asynchrone des miniatures concernées.

### Rapli Stickers Lab
- Logo chargé depuis une ressource externe au lieu d'une longue chaîne dans le HTML.
- Les miniatures de la bibliothèque ne sont préparées que lorsqu'elles arrivent à proximité de l'écran (IntersectionObserver ; repli automatique si indisponible).
- Cache d'images borné à 48 ressources pour éviter la rétention illimitée des anciennes images importées ; rechargement possible à la demande.
- Vérification des polices déjà chargées : n'attend plus inutilement la disponibilité de la même police à chaque rendu.
- Rendu des miniatures et Canvas non urgents mis en pause pendant que l'onglet principal est inactif, puis repris automatiquement.
- Résolution complète et qualité de l'export des stickers inchangées.

### Rapli Tools
- Logo et icône extraits du HTML ; logo converti en WebP haute qualité.
- Prévisualisation photo adaptative : 720 px de côté maximum sur téléphone, 1 080 px sur écran large, avec un plafond d'actualisation d'environ 10/20 images/s lors des changements de réglages. La taille et le format d'export photo ne changent pas.
- Calculs d'aperçu différés tant que l'onglet Tools n'est pas actif. L'état et l'historique des retouches restent conservés lors du passage entre les trois applications.
- Outils PDF, OCR, convertisseur, caviardage, watermark, textures et autres fonctions de V2.5 conservés.

### Portail / hébergement
- Chargement des iframes à leur première ouverture, en conservant leur état à chaque changement d'onglet.
- Signal d'activité aux éditeurs pour éviter du travail Canvas en arrière-plan.
- Fichier `_headers` Netlify : ressources média aux noms versionnés et immuables mises en cache 1 an ; HTML revalidé pour préserver la mise à jour du site.

## Mesures et limites

Taille du fichier HTML principal, sans compter les images séparées : Archives 3 715 280 → 184 893 octets ; Stickers Lab 577 991 → 484 951 octets ; Tools 976 933 → 217 044 octets avant retouches ultérieures du JavaScript. Ces données sont des **tailles de fichiers**, pas des chronométrages de chargement utilisateur. Les optimisations s'appliquent à la V2.5 existante et ne changent pas la qualité de rendu exportée. Les logos WebP à qualité élevée peuvent présenter une différence imperceptible par rapport aux PNG précédents. Les bibliothèques IA/OCR et le réseau peuvent toujours limiter le temps d'exécution, surtout sur les appareils peu puissants.

---

# RAPLI TRIO · V2.5

Projet statique intégrant **Rapli Archives**, **Rapli Stickers Lab** et **Rapli Tools**. Site d’entrée : `index.html` ; utilisable comme site Netlify statique.

## V2.4 — Ajout direct sur Rapli Tools

**1. Rapli Tools · Étalonnage photo professionnel**
- Courbes de tonalité RVB, rouge, vert, bleu à trois points mobiles (édition à la souris ou au doigt).
- HSL sélectif sur huit gammes colorées ; contrôle de protection des tons chair.
- Color grading distinct des ombres et des hautes lumières.

**3. Stickers Lab · Finitions Chrome et holographiques**
- Chrome Pro, Holo Foil et Prisme, avec boutons de démarrage rapide.
- Calques indépendants : activation, intensité, opacité et ordre ; même moteur pour l’aperçu et les fichiers exportés.

**4. Rapli Tools · Presets personnels**
- Sauvegarde de profils de retouche sur le navigateur de cet appareil (localStorage), réutilisation et suppression.
- Si le stockage navigateur est indisponible, les presets restent uniquement en mémoire jusqu’à la fermeture de la page.

**5. Rapli Tools · Intensité du filtre**
- Curseur 0 à 100 % sur les presets d’origine ; l’édition d’un réglage manuel passe en mode personnalisé.

**7. Textures premium**
- Papier ancien, fibres de papier, trame offset, poussières argentiques et balayage VHS dans Stickers Lab, en complément du Grain & Bruit de Tools.

**10. Optimisations ciblées**
- Les onglets lourds du portail ne sont chargés qu’à leur première ouverture.
- L’aperçu de retouche photo est limité à 850 px sur mobile pour conserver la réactivité ; l’export peut toujours employer la résolution de la photo (sous les limites de l’appareil).
- Boucles de texture bornées pour réduire les ralentissements lors du dessin.

## Notes et limites

- Les textures Chrome/Holo et les retouches ne sont pas des simulations physiques de foil imprimé. Leur rendu dépend du contenu de l’image, de l’écran et de l’imprimante.
- Les traitements avancés d’IA du détourage et de l’upscale exigent toujours les bibliothèques et modèles externes. Il n’y a pas de moteur serveur ajouté.
- Archives et ses 625 entrées sont conservées ; les données personnelles ne sont pas migrées automatiquement entre différents domaines ou stockages.
- Les tests automatiques de l’interface Stickers complète sont limités par le navigateur de test. L’intégrité JavaScript et les effets Canvas ont été testés séparément.
- Aucune mise en production n’a été effectuée.


## Ajout V2.4 — Sujet couleur / fond traité

- Nouveau bloc **Sujet & arrière-plan** dans l'éditeur photo.
- Modes sélectifs : **fond noir et blanc**, **fond noir**, **fond sombre**.
- Réglages dédiés : taille du sujet protégé, douceur du contour, désaturation, assombrissement, contraste du fond et halo autour du sujet.
- Nouveau **pinceau local** : peindre en noir et blanc, gomme couleur, taille et opacité réglables, dessin directement sur l'aperçu, effacement du pinceau, export intégré au même moteur Canvas.


## V2.5 — Atelier photo, PDF et conversion

Nouvelle version de `tools/index.html`, compatible avec le portail RAPLI TRIO existant.
Archives et Stickers Lab sont inchangés.

### Création photo : 12 réglages, 1 pinceau, 1 générateur
- **03 Bokeh du fond** : flou extérieur au masque sujet.
- **04 Correcteur doux** : troisième outil de pinceau pour atténuer localement des imperfections par lissage (pas de remplissage génératif).
- **12 RGB Split / Glitch** : décalage des canaux et bandes numériques.
- **13 Halftone** : trame de points inspirée de l'impression vintage.
- **14 Flou de mouvement** : flou directionnel, avec choix de l'angle.
- **16 Infrarouge** : simulation de couleurs infrarouges.
- **17 Thermique** : fausse palette de caméra thermique, non destinée aux mesures de température.
- **18 Néon** : détection de contours colorés et lueur.
- **19 Effets d'objectif** : aberration chromatique et lens flare.
- **20 Affiche sportive** : réduction des niveaux et contraste marqué.
- **21 Générateur de textures Holo/Refractor** : holographique, Chrome, Prisme et Foil doré ; export PNG 1 024 ou 2 048 px.
- **23 Contour de sujet** : contour coloré, utilisant un masque PNG transparent si importé.

Les intensités sont indépendantes et incluses dans l'historique Annuler/Rétablir, l'aperçu et les exports. Le masque automatique de départ reste une approximation centrale : pour des contours précis, fournir une image du sujet sur fond transparent au champ « Masque PNG ».

### PDF Studio
- **Filigranes PDF** (texte ou image PNG/JPG, position, répétition, opacité, taille, couleur du texte et angle) ; plusieurs PDF peuvent être exportés ensemble en ZIP.
- **OCR** : PDF scanné vers TXT ou PDF contenant un calque de texte recherché. Chargement local de Tesseract.js au premier usage. L'alignement et la reconnaissance ne sont pas garantis sur les documents peu lisibles.
- **Caviardage définitif** : dessin de rectangles sur les pages, export d'un PDF entièrement rasterisé dans un nouveau fichier, sans conserver le texte ni les objets du PDF source. Les liens, signatures, sélections de texte et autres informations interactives du PDF original sont perdus. Vérifier visuellement le PDF produit avant partage.

### Convertisseur d'images
- Nouvel onglet **CONVERTISSEUR** : PNG, JPG, WebP et AVIF si le navigateur le prend en charge ; qualité, redimensionnement et choix du fond opaque pour JPEG.
- Export en fichier individuel ou ZIP pour plusieurs images.

### Contraintes connues
- Certains outils PDF et OCR chargent des bibliothèques depuis CDN et demandent une connexion au premier usage.
- Les effets infrarouge, thermique, holographique et néon sont des simulations créatives, pas des transformations scientifiques ou une métallisation physique de la surface imprimée.
- Les effets locaux sur grandes images peuvent nécessiter beaucoup de mémoire vive, notamment sur mobile.
- Aucune mise en production n'a été effectuée.
