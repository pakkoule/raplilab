# Rapli Archives — sauvegarde cloud complète (PR #1)

## Périmètre de synchronisation

La sauvegarde Supabase conserve **tout l'état personnel d'Archives** : `groups` (éditions), `variants` (tuiles, références et métadonnées), `copies` (OWNED, détails de chaque exemplaire), `wishlist`, `settings` (taxonomies, couleurs, artworks et réglages), ainsi que `createdAt` et `version`.

Les images personnalisées encodées dans les données sont déposées dans le bucket privé **`rapli-archives-private`**, avec contrôle d'accès par utilisateur et téléchargement lors d'une restauration. Les visuels d'origine livrés en tant que fichiers statiques (`assets/`) restent dans le site.

Les autres modules RapliLab, Stickers Lab et Tools, restent inchangés.

## Import des informations déjà existantes

1. **Sur le navigateur qui contient déjà les modifications**, ouvrir la Deploy Preview de la PR et lancer **Rapli Archives > Sauvegardes**.
2. Avant toute manipulation, utiliser **Exporter la sauvegarde JSON** pour disposer d'une copie indépendante.
3. La sauvegarde cloud est facultative. Si elle avait déjà été activée dans la version précédente, elle se reconnecte automatiquement avec la même session locale. Sinon, cliquer **Activer la sauvegarde cloud**.
4. Si la base contient seulement une ancienne sauvegarde OWNED / wishlist (colonne `payload`, sans `archive_state`), l'application effectue un **premier import de l'état complet stocké dans ce navigateur**. Elle n'écrase pas l'état local avec une sauvegarde incomplète.
5. Si un catalogue complet existe déjà dans Supabase mais diffère de celui de l'appareil, **aucune écriture automatique** : choisir **Conserver cet appareil** ou **Restaurer le cloud**, en connaissant le sens du remplacement.
6. Attendre le statut **« Toutes les données sont synchronisées ✓ »**. Actualiser le navigateur et vérifier que les cartes et personnalisations ont été conservées.

**Important :** les données d'un navigateur ne peuvent pas être importées depuis les outils serveur seuls. Il faut ouvrir la Deploy Preview **sur l'appareil contenant l'état local**, laisser son navigateur envoyer les données et vérifier le résultat. Le déploiement GitHub, à lui seul, ne transfère aucune collection personnelle.

## Architecture et accès

- Projet Supabase RapliLab : `widiyulvmthbaypdxhbw`, et non Cotation 3000.
- Table `public.rapli_archive_collections` : `user_id`, `payload` (compatibilité ancienne version), `archive_state`, `state_revision`, `updated_at`.
- Ligne personnelle identifiée par `auth.uid()` ; règles RLS SELECT / INSERT / UPDATE / DELETE limitant l'accès à sa propre collection.
- Bucket Storage `rapli-archives-private`, non public, avec policies par chemin `user_id/...` ; taille maximale par objet 10 Mo.
- `state_revision` empêche un remplacement silencieux de l'état distant lorsqu'une autre sauvegarde s'est intercalée. En cas de conflit, aucune fusion automatique n'est effectuée.
- Aucune clé `service_role` n'est embarquée dans le navigateur. La clé utilisée est **publishable**.
- Fonctionnement **offline-first** : IndexedDB / localStorage restent la première sauvegarde sur l'appareil.

## Limites

- Connexion anonyme : sans formulaire, mais **une identité distincte par navigateur/appareil** ; un appairage sera nécessaire pour voir la même collection sur iPhone et ordinateur.
- Les images personnalisées utilisent Supabase Storage et les restaurations peuvent prendre du temps. L'upload d'un fichier image de plus de 10 Mo provoque un message d'erreur sans effacer l'original local.
- Les éditions simultanées sur plusieurs onglets ne sont pas fusionnées. En cas de divergence, privilégier un export JSON avant de choisir quelle version garder.
- Les fichiers `assets/` fournis avec le site restent gérés par GitHub/Netlify ; seuls les fichiers image incorporés dans l'état personnel sont téléchargés dans le Storage.

## Contrôles à réaliser sur Deploy Preview

- Exporter un JSON **avant** le premier import.
- Vérifier le premier import avec plusieurs tuiles personnalisées, une image et une carte OWNED.
- Modifier le titre, la rareté, la langue, l'artwork, un réglage, une édition et une quantité d'exemplaires. Vérifier le statut de synchronisation.
- Actualiser la page : les modifications doivent être conservées.
- Faire un test de conflit local/cloud, choisir explicitement la version à garder.
- Tester hors ligne puis de nouveau en ligne. Confirmer la conservation locale.
- Contrôler RLS (un utilisateur anonyme ne doit pas lire un autre `user_id`) et le caractère privé des images.

**Ne pas fusionner cette PR avant validation sur Deploy Preview.**
