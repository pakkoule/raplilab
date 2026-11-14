# RapliLab — synchronisation cloud (PR #1)

## Espaces actifs

Le portail conserve six espaces : **Archives, Sports, Stickers Lab, Tools, LP et Regatta**.

- **Archives** conserve son système `rapli_archive_collections` et ses sauvegardes de catalogue.
- **Sports, Stickers Lab, Tools, LP et Regatta** utilisent la table `public.rapli_module_collections` avec les clés `sports`, `stickers`, `tools`, `lp` et `regatta`.
- Les images personnelles des modules actifs restent dans le bucket privé partagé `rapli-archives-private`. Elles sont chargées via le pont de synchronisation `shared/module-cloud.js`, qui utilise la session Supabase et les règles RLS existantes.
- La sauvegarde et l'actualisation globales traitent **exactement ces six espaces**. Chaque espace possède sa collection distincte, avec protection contre les écrasements concurrents.
- Les sauvegardes locales (IndexedDB, parfois localStorage) permettent une utilisation hors ligne. Plusieurs appareils nécessitent l'association de leurs sessions dans Archives.

## Espaces définitivement retirés de cette branche

Les modules `time`, `refs`, `tiers`, `top10` et `coach` ont été supprimés du portail, des fichiers de l'application et de la liste de synchronisation. La migration `shared/migrations/20261114_remove_retired_modules.sql` supprime **leurs lignes uniquement** dans `public.rapli_module_collections` et limite la contrainte SQL aux cinq clés actives. Le catalogue Archives ne se trouve pas dans cette table et n'est pas concerné.

Le script `shared/retired-cleanup.js` supprime sur chaque navigateur les **cinq** bases IndexedDB correspondantes, les deux sauvegardes locales de secours et les anciens marqueurs de synchronisation, lorsqu'il visite le nouveau portail. Un appareil jamais reconnecté peut encore posséder son ancienne copie locale.

Les objets du bucket privé sous les préfixes `{owner}/time/`, `{owner}/refs/`, `{owner}/tiers/`, `{owner}/top10/`, `{owner}/coach/` nécessitent une suppression **via l'API Storage** ou l'interface Supabase Storage, pas directement par des requêtes SQL sur `storage.objects`. Le bucket partagé et les images des modules conservés ne doivent pas être supprimés.

## Contrôles

1. Vérifier que la navigation comporte six onglets et que les anciennes URLs `#time`, `#refs`, `#tiers`, `#top10`, `#coach` reviennent sur Tools.
2. Vérifier les cinq lignes cloud absentes et la contrainte de module limitée aux espaces actifs.
3. Vérifier le nettoyage IndexedDB sur les appareils qui accèdent à la nouvelle Deploy Preview.
4. Vérifier le résultat de la suppression des images anciennes avec une requête de comptage par préfixe et le panneau Storage.
5. Vérifier que les collections, logos et visuels de tous les espaces conservés restent accessibles après synchronisation.
