# Rapli Lab — synchronisation partagée

Deux espaces actifs : **Sports** et **Regatta**.

- Le stockage cloud de ces espaces repose sur `public.rapli_module_collections` (clés `sports` et `regatta`), les révisions et les politiques RLS existantes.
- Les images actives restent dans le bucket privé historique `rapli-archives-private` aux chemins `{owner}/sports/` et `{owner}/regatta/`. Le nom du bucket est hérité de l'ancien projet mais sa fonction est désormais commune : **ne pas le supprimer**.
- L'association PC/iPhone utilise la session Supabase et les tables `rapli_archive_members`, `rapli_archive_pair_codes` et `rapli_archive_pair_attempts`. Leurs noms sont historiques ; elles sont toujours nécessaires aux deux modules.
- La fonction Edge `rapli-archives-pair` reste utilisée pour l'association sécurisée ; la vérification de l'appareil principal utilise les collections Sports et Regatta, pas les données du Dragon Blanc.
- Les sauvegardes locales restent séparées ; aucune synchronisation globale ne doit effacer silencieusement des modifications locales.

## Retrait du module Dragon Blanc

L'ancien catalogue et ses données ne font plus partie du portail. Son IndexedDB et ses marqueurs locaux sont nettoyés par `shared/retired-cleanup.js` à l'ouverture de la nouvelle interface.

Le stockage de catalogue `public.rapli_archive_collections` est indépendant de `rapli_module_collections`. La migration de retrait est `shared/migrations/20261115_retire_archives.sql`. Les images de l'ancien catalogue sont à supprimer uniquement par l'API Storage, en ciblant les fichiers `{owner}/{sha256}.{png|jpg|webp|gif}` et en épargnant tous les chemins de modules actifs.
