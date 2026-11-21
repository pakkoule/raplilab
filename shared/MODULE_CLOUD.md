# Rapli Regatta — synchronisation

Le seul module actif est **Regatta**, collection `module='regatta'` de `public.rapli_module_collections`.

- La synchronisation conserve les révisions différentielles, l'authentification administrateur et les règles RLS.
- Les photos de courses sont enregistrées dans le bucket privé historique `rapli-archives-private`, chemin `{owner}/regatta/`.
- Les paramètres globaux de couleurs et l'historique VSR restent dans la même collection.
- Les noms historiques des tables d'authentification, du bucket et des migrations ne doivent pas être renommés ou supprimés.
- Les anciens enregistrements Sports ne sont pas supprimés automatiquement pour éviter une perte irréversible.
