# Rapli Time / Sports / Refs — Supabase Cloud (PR #1)

Ces trois applications conservent **trois collections distinctes**. Leurs données locales restent dans IndexedDB (avec secours localStorage) et se synchronisent avec le même projet Supabase que Rapli Archives.

## Architecture

- URL du projet : `widiyulvmthbaypdxhbw.supabase.co`, clé **publishable uniquement** dans le navigateur.
- Table `public.rapli_module_collections`, clé primaire `(owner_id,module)` ; modules autorisés : `time`, `sports`, `refs`.
- Un état `{records,logos}` par onglet, en JSONB, et un compteur `state_revision` avec mise à jour conditionnelle pour empêcher l'écrasement concurrent silencieux.
- Politiques RLS : l'utilisateur authentifié (y compris session anonyme) lit/écrit ses propres données ou celles du propriétaire auquel son appareil est associé dans `rapli_archive_members`. Suppression côté propriétaire uniquement. La table est interdite au rôle `anon` non connecté.
- Photos de fiches et logos personnalisés dans le **bucket privé existant** `rapli-archives-private`, sous `<owner_id>/<module>/<empreinte-sha256>.<extension>`. Elles sont réhydratées en data URLs pour préserver le moteur et les exports JSON locaux existants.
- Le SDK et la session d'authentification sont partagés sur la même origine entre les iframes. **Associer d'abord le PC et l'iPhone depuis Rapli Archives → Sauvegardes**, puis utiliser les nouveaux onglets sur les deux appareils.

## Fonctionnement

Dans Time, Sports et Refs :

- **☁️** : envoyer manuellement l'état complet de ce module vers Supabase.
- **↻** : vérifier la version de ce module dans Supabase et actualiser les fiches, logos et images si elle a changé.
- Les ajouts, modifications, suppressions et imports JSON sont également synchronisés automatiquement après temporisation lorsque le cloud est connecté.
- Les données locales, les sauvegardes JSON et le mode hors ligne continuent de fonctionner.
- Si l'état cloud et l'état local ont divergé, le pont protège la collection locale et demande un choix explicite avant remplacement.
- Les opérations utilisent un verrou optimiste `state_revision`. Si un autre appareil écrit entre lecture et mise à jour, l'enregistrement est rejeté sans écrasement.
- Le remplacement d'une collection locale via le cloud s'effectue dans une transaction IndexedDB qui remplace simultanément les fiches et leurs logos.

## Vérification et limites

- La table et les quatre politiques RLS ont été appliquées au projet Supabase et l'activation RLS a été vérifiée.
- Les scripts des trois applications et le module commun passent la vérification syntaxique.
- **Les données déjà présentes dans IndexedDB sur un appareil ne peuvent pas être lues à distance depuis le dépôt GitHub.** Leur premier envoi réel exige d'ouvrir l'onglet sur cet appareil avec une session Supabase valide ; à ce stade, le serveur peut donc être vide.
- Les fichiers image doivent être des PNG/JPEG/WebP/GIF de 10 Mo maximum chacun ; les images dépassant cette limite empêchent l'enregistrement cloud mais restent en local.
- Pas de test navigateur multi-appareils ni de déploiement production effectué lors de cette implémentation.

## Tests utilisateur recommandés

1. Dans **Archives → Sauvegardes**, vérifier que les deux appareils sont associés.
2. Depuis le PC, dans Time, créer une montre réelle et télécharger une image ; cliquer sur ☁️. Dans Time sur iPhone, cliquer ↻ ; vérifier la fiche et l'image.
3. Répéter dans Sports pour une carte et un logo d'équipe, puis dans Refs pour un article et un logo de marque.
4. Modifier une fiche sur iPhone hors ligne ; rétablir le réseau, puis sauvegarder. Vérifier la modification sur PC.
5. Modifier la même collection sur les deux appareils avant synchronisation ; vérifier le refus de l'écrasement sans confirmation.
6. Exporter des JSON sur chaque appareil avant le premier test de conflit.

**Important :** le bouton de rechargement ↻ ne remplace jamais silencieusement une version locale modifiée, et l'utilisation de sessions anonymes nécessite de conserver au moins un appareil principal associé.


## Synchronisation globale RapliLab — 6 espaces

La barre supérieure principale de RapliLab possède deux commandes centralisées :

- **☁️ Enregistrer tout RapliLab :** lance une sauvegarde de **Archives, Sports, Time, Refs, Stickers Lab et Tools** en un clic.
- **↻ Actualiser tout RapliLab :** recherche les nouveautés dans les six espaces, et les restaure quand aucun changement local concurrent ne risque d'être perdu.

### Détail des espaces

| Espace | Contenu synchronisé | Backend |
| --- | --- | --- |
| Archives | Catalogue Dragon Blanc, éditions, OWN, images, paramètres | \`rapli_archive_collections\` / Storage privé |
| Sports | Fiches de cartes, OWN, photos, logos | \`rapli_module_collections.module='sports'\` / Storage privé |
| Time | Montres, références, photos, logos | \`rapli_module_collections.module='time'\` / Storage privé |
| Refs | Articles, statuts, marques, photos, logos | \`rapli_module_collections.module='refs'\` / Storage privé |
| Stickers Lab | Projets de stickers, images, cartouches, réglages et polices importées | \`rapli_module_collections.module='stickers'\` / Storage privé (images) |
| Tools | **Presets photo sauvegardés uniquement** | \`rapli_module_collections.module='tools'\` |

Les fichiers PDF/JPG importés temporairement dans **Tools**, les résultats non enregistrés et l'historique d'annulation ne sont pas persistés par Tools : la synchronisation globale ne les transfère pas.

### Sécurité / fonctionnement

- Un appel depuis le portail déclenche l'opération **dans chaque iframe**, via un message \`postMessage\` vérifiant l'origine et la fenêtre parente. Le portail reçoit seulement succès/échec et statut, **jamais les données privées**.
- Le portail charge les applications non visitées pour inclure tous les modules, y compris ceux qui ne sont pas actuellement visibles.
- Les appels sont **séquentiels** : une erreur sur un module ne bloque pas les cinq autres.
- Le bilan affiche **X/6** et détaille précisément les modules en échec ou en conflit ; **pas de fausse confirmation globale**.
- Chaque module conserve ses contrôles locaux, sa sauvegarde hors ligne, le contrôle de version Supabase et sa protection contre les écrasements.
- La sauvegarde globale n'autorise pas les écrasements forcés d'une version cloud modifiée par un autre appareil. Résoudre chaque conflit manuellement dans le module concerné, après export JSON.
- Au premier lancement depuis un second appareil, associer celui-ci au propriétaire via **Archives → Sauvegardes** avant de synchroniser les six espaces.

### Tests de validation UI restant à réaliser sur la Deploy Preview

1. Préparer un exemple non démo dans chaque catalogue, une vraie création Stickers et un preset enregistré Tools.
2. Cliquer une seule fois sur ☁️ depuis le header du PC, **sans ouvrir individuellement** les six onglets : vérifier le bilan 6/6.
3. Sur iPhone associé, cliquer ↻ depuis le header : vérifier que les six modules reflètent les sauvegardes (fiches, logos, créations et presets).
4. Couper le réseau et sauvegarder : vérifier l'échec visible et la conservation locale ; réessayer en ligne.
5. Modifier une même collection sur PC et iPhone : vérifier qu'un conflit bloque l'envoi global **uniquement pour le module concerné** et apparaît dans le bilan.
6. Vérifier l'affichage de la barre sur Safari iPhone en portrait et sur ordinateur.

Cette fonctionnalité est sur la PR #1 ; **aucun déploiement production ni test réel PC/iPhone n'est revendiqué**.
