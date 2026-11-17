# Rapli Lab — PR #2 : collection Sports commune (sans boutons Cloud)

## Portée

- **Rapli Sports seulement** : une collection de référence unique lue depuis Supabase ; affichage public, modification réservée au compte e-mail administrateur (contrôle RLS requis).
- Référence publiée : `owner_id = 91a067ed-796a-45c0-b4b1-c04f3bfbe35e`, module `sports` ; 56 cartes, 107 logos, révision 74 au moment du choix (17 novembre 2026, 13 h Paris). La collection peut évoluer avant la mise en ligne.
- Ancienne référence `49965cdc-d361-4515-ae53-d9a5bead243e` : **conservée**, sans migration destructive.
- **Regatta** demeure masqué : ne pas retirer les fichiers, tables, photos ni données existantes. Son pont historique n'est pas modifié dans cette PR.
- Le portail ne propose plus de disquette globale, d'actualisation manuelle ni de code de liaison PC/iPhone. Les anciens identifiants de tables/bucket restent nécessaires au stockage existant ; « supprimer Cloud » ne signifie **pas** supprimer Supabase.

## Fonctionnement

- À l'ouverture, Rapli Sports lit exclusivement la ligne `(owner_id, module)` publiée.
- Un visiteur voit les cartes et logos sans autorisation d'écriture.
- L'administrateur identifié peut créer, modifier ou supprimer. Les modifications sont d'abord conservées dans IndexedDB, puis envoyées automatiquement (sauvegarde différée et réessais), avec vérification stricte de `state_revision`.
- En cas de concurrence, **aucun écrasement forcé** ; le statut affiche une erreur, et l'utilisateur doit exporter les données locales avant de reprendre.
- Les images restent dans le bucket Storage existant, sous `{owner_id}/sports/`.
- L'actualisation utilise Realtime si la publication est activée, et systématiquement un contrôle toutes les 20 s + retour à l'onglet/focus.
- Un statut discret dans le pied de page Sports indique « Collection à jour », « Modifications en attente » ou l'erreur rencontrée.

## Activation serveur obligatoire (non effectuée par la PR)

Le site actuel et les données Supabase ne sont **pas modifiés** par la préparation de cette PR. Les anciennes règles RLS sont encore en place. Il est indispensable de les remplacer au moment de la publication pour garantir la lecture publique ET le verrouillage des écritures. Sans cette étape, le nouveau client peut afficher « Collection indisponible ».

1. Avant toute migration : confirmer la connexion de l'administrateur depuis le footer (magic link) et tester une sauvegarde de secours JSON. Confirmer que `rapli_module_collections` contient toujours la référence sélectionnée (ne jamais se fier à « ligne la plus récemment modifiée » lors de la navigation).
2. Sauvegarder/exporter les **deux** lignes Sports et les métadonnées Storage ; ne supprimer aucune ligne ni aucun bucket.
3. Vérifier la syntaxe SQL et les permissions proposées dans `docs/pr2-shared-sports-rls.sql` ; exécuter **dans une fenêtre de déploiement coordonnée avec la fusion**. Ce fichier est volontairement une procédure manuelle, pas une migration appliquée par un build Netlify.
4. Valider en navigation privée (sans login) : 56+ cartes et leurs images visibles, aucune modification possible, données Regatta invisibles.
5. Valider depuis le compte admin : ajouter une carte test, attendre le statut « Enregistré pour tous », ouvrir depuis un autre navigateur et confirmer l'apparition ; supprimer la carte test, contrôler la disparition.
6. Simuler une coupure réseau pendant une modification et vérifier que les données restent locales et sont envoyées sans perte après reconnexion ; essayer deux onglets éditeurs pour tester le conflit de révision.
7. Optionnel : activer `supabase_realtime` pour la table uniquement après vérification des politiques ; sinon le polling automatique reste opérationnel.

### Limites et vigilance

- Sur Deploy Preview, **avant activation des nouvelles règles RLS**, les visiteurs anonymes peuvent ne pas voir la collection commune. Cela n'indique pas une perte de données.
- Le système local reste un cache sécurisé contre les coupures ; un conflit **n'est pas automatiquement résolu** : exporter le JSON avant tout rétablissement.
- Si les politiques de sécurité ne sont pas activées, masquer les boutons d'édition ne constitue pas une protection côté serveur.
- Les autres documents `docs/owner-only-*.sql` concernent la PR #1 ; **ne pas les appliquer** à la place du script PR #2, car ils pointent vers l'ancienne collection.
- Ce changement ne supprime pas les données historiques, le bucket ni l'ancienne collection de secours.

## Extension Regatta — 17 novembre 2026

- La collection **Regatta la plus récemment sauvegardée** est `(module=regatta, owner_id=91a067ed-796a-45c0-b4b1-c04f3bfbe35e)`, révision 1, sauvegardée le **16 novembre 2026 à 15:44:55 UTC** : **4 courses, 1 objet de réglages, 8 références d'images**.
- L'ancienne ligne Regatta `owner_id=49965cdc-d361-4515-ae53-d9a5bead243e`, révision 54, reste intacte comme archive. Aucun fusionnement ni suppression de ses dix fichiers Storage.
- **Sports et Regatta sont maintenant accessibles depuis leurs menus Profil**, par navigation `#sports` / `#regatta` dans Rapli Lab ; le compte administrateur utilise la même connexion. Le bandeau Cloud ne revient pas.
- Le fichier `shared/shared-collection.js` charge automatiquement Regatta depuis la ligne choisie, en lecture publique ou édition. Les modifications intentionnelles sont enregistrées avec vérification de révision. La base IndexedDB historique de Regatta est laissée intacte, et l'état distant affiché en mémoire évite une restauration destructive au chargement.
- Les règles Supabase permettant la lecture publique des 4 courses et des 8 images, ainsi que l'upload admin dans le dossier Regatta canonique, ont été **activées** par la migration `rapli_pr2_publish_regatta_shared`. Les contrôles SQL `SET LOCAL ROLE anon` et `authenticated` ont confirmé les deux lignes publiques (Sports et Regatta) et les huit images Regatta, sans exposer l'ancienne collection.
- Avant fusion, tester dans la Preview : consultation libre de Regatta (4 courses + images), navigation de retour vers Sports, connexion administrateur, création puis suppression d'une course test, sauvegarde automatique visible après actualisation dans une fenêtre privée, absence d'accès Regatta historique et gestion des conflits/connexion hors ligne.
- **Ne pas réappliquer** la migration initiale `docs/pr2-shared-sports-rls.sql` telle quelle sur la base actuelle : les permissions Supabase ont évolué depuis ce script initial. Toute nouvelle migration doit préserver les politiques Regatta publiées en supplément.
