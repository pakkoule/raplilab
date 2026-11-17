# Rapli Lab — PR #1 · Sports & Regatta

## Modules actifs

**Rapli Sports** et **Rapli Regatta** sont les deux espaces conservés dans cette branche. Le portail `index.html` affiche deux onglets et une barre globale de sauvegarde et actualisation pour ces espaces exclusivement. Le logo Rapli Lab et le favicon tamarin restent en place.

- **Sports** : collection personnelle de cartes de sport, OWN / Wishlist, statistiques, logos de marques, équipes, athlètes et tags ; affichages Fiches, Vignettes, Par marque, Par équipe, Par athlète et **Par tag**.
- **Regatta** : suivi personnel de courses et tentatives Virtual Regatta, performances, export calendrier et PNG.

Les données, les fichiers et les images du catalogue Dragon Blanc et de l'ancien module **Rapli Archives** ont été retirés du code de cette branche ; aucun onglet ni iframe Archives n'est conservé.

## Synchronisation et association des appareils

- `public.rapli_module_collections` conserve uniquement les modules `sports` et `regatta` avec leurs propres révisions et contrôles de conflits.
- La session anonyme Supabase et les tables de liaison `rapli_archive_members`, `rapli_archive_pair_codes` et `rapli_archive_pair_attempts` restent **une infrastructure partagée** malgré leur nom historique. Les supprimer casserait l'association PC/iPhone des deux modules restants.
- Le service Edge d'association vérifie désormais la présence d'une collection Sports ou Regatta, et non celle d'une ancienne collection Archives.
- Le bucket privé `rapli-archives-private` est également **partagé** par Sports et Regatta : ne jamais supprimer le bucket ou les chemins `{owner}/sports/` et `{owner}/regatta/`.

## Retrait des anciennes données

Le script `shared/retired-cleanup.js` supprime localement, sur chaque navigateur qui ouvre cette version, la base IndexedDB `my-archive-v1`, la sauvegarde locale de secours et les marqueurs propres à l'ancien catalogue. Il ne touche pas à Sports ni Regatta.

La migration `shared/migrations/20261115_retire_archives.sql` cible exclusivement la table de catalogue `rapli_archive_collections`. Les images historiques `{owner}/{sha256}.{ext}` du bucket partagé doivent être supprimées par l'API Supabase Storage et jamais par SQL ; cette suppression doit conserver intactes les images des modules actifs.

## Déploiement

PR #1 conservée en brouillon ; pas de fusion ni publication volontaire des modifications front-end. Vérifier sur Netlify Preview les deux onglets, la disquette, la synchro et l'association PC/iPhone avant fusion.
