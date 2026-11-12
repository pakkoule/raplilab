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
