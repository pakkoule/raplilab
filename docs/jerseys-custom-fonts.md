# Rapli Lab — Polices de flocage Jerseys

## Ce qui est ajouté dans la PR #4

- Bibliothèque de logos → **👕 Polices de flocage**.
- Import administrateur de polices **WOFF2, WOFF, TTF, OTF** (fichier de 5 Mo maximum) ; vérification de l’extension **et de la signature binaire**.
- Prévisualisation du nom/numéro dans la bibliothèque, modification, suppression et état vide.
- Dans JERSEYS : nom, numéro, couleur, police du nom et éventuellement police différente pour le numéro, avec prévisualisation réelle du dos du maillot.
- Lien direct depuis Jerseys vers le gestionnaire, sans créer de nouvelle collection.
- Les polices sont enregistrées comme enregistrements `jersey-font` dans la bibliothèque de Sports (ID stable), puis les binaires sont transférés dans le bucket Supabase existant et remplacés dans la collection par une référence courte.
- Jerseys demande la liste **sans les binaires** et ne reçoit qu’une police sélectionnée à la fois par message same-origin. Le fichier n’est pas copié dans une seconde bibliothèque.
- Aucune nouvelle table ni aucun changement dans les cartes, logos d’équipes/compétitions ou courses Regatta.

## Activation Supabase nécessaire avant un vrai import synchronisé

Le bucket `rapli-archives-private` accepte actuellement seulement les MIME images. La migration :

`supabase/migrations/20261121150000_allow_jersey_font_media.sql`

ajoute **font/woff2, font/woff, font/ttf, font/otf** tout en préservant les types d’images existants et les règles RLS. **Cette migration est seulement committée dans la PR ; elle n’est pas appliquée à la production**. Les aperçus Deploy Preview doivent exécuter cette migration avant de tester un import avec synchronisation cloud. Tant qu’elle n’est pas appliquée, une police peut être enregistrée localement, mais son transfert Cloud restera en attente/erreur.

La taille du bucket est de 10 Mo par fichier ; l’application restreint à 5 Mo les fonts. Les polices sont récupérées avec un MIME correct même si Storage les renvoie en `application/octet-stream`.

## Licence des polices

Les visiteurs consultent les tuiles Jerseys publiquement et leur navigateur reçoit les octets de la police utilisée dans la page. Le bucket est privé au sens Storage, **mais il existe une politique RLS de lecture publique des médias Sports**. Ne charger que des polices possédées ou sous licence permettant l’usage web / redistribution client ; ne pas uploader une police commerciale non autorisée à être intégrée à une page.

Aucune police réelle ou fichier sous licence n’est livré avec le code.

## Limites actuelles

L’onglet Jerseys est encore un **aperçu de tuile**. Le vrai formulaire d’enregistrement des maillots et l’association persistante des polices à chaque fiche sont à prévoir lors de la création du modèle Jerseys. L’interface d’import et le rendu des caractères sont préparés pour réutiliser les IDs dans les futures fiches, sans duplication. Le navigateur doit prendre en charge `FontFace` (Safari iOS moderne oui).

## Vérifications

Les fichiers JavaScript et les sélecteurs sont vérifiés. Le test unitaire `tests/jersey-fonts.test.cjs` couvre les signatures, formats, droits d’édition de l’interface et suppression. Tester sur le Deploy Preview après activation contrôlée de la migration : importer un WOFF2 puis TTF, rafraîchir / tester un second appareil et vérifier l’affichage Safari iPhone ; tester également le cas d’un fichier corrompu et une police supprimée.
