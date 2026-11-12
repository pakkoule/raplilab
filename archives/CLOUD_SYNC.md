# Rapli Archives — sauvegarde cloud des collections (PR 1)

## Portée

Le catalogue encyclopédique et les autres outils RapliLab ne changent pas.

La sauvegarde synchronise uniquement `archive.copies` (OWNED, exemplaires, état, prix, notes) et `archive.wishlist`. Les références de catalogue, les créations photo et les images ne sont pas envoyées.

## Mise en service

1. Dans le projet Supabase RapliLab, ouvrir **Authentication > Sign In / Providers** et activer **Anonymous Sign-Ins**. Sans cette option, l'application conserve les données localement et indique que la connexion cloud est indisponible.
2. Ouvrir Rapli Archives > **Données & sauvegardes**, puis cliquer sur **Activer la sauvegarde cloud**.
3. Si une version existe déjà dans le cloud, choisir explicitement entre **Garder cette collection** et **Restaurer la version cloud** lorsqu'elles diffèrent.
4. Tester l'ajout / retrait d'une carte OWNED, puis **Synchroniser maintenant**. Vérifier le statut « Collection synchronisée ✓ ».
5. Avant tout test, exporter une **sauvegarde JSON** avec les outils existants.

La base Supabase `public.rapli_archive_collections` est déjà créée avec **RLS** et quatre policies limitées à `auth.uid() = user_id`. La clé utilisée par le navigateur est **publishable**, jamais une clé de service.

## Limites connues

- **Pas de formulaire de connexion** : la connexion anonyme fonctionne sans identifiant, mais **ne permet pas de retrouver la même identité sur un autre téléphone / ordinateur**. Une liaison explicite sera nécessaire pour le vrai multi-appareils.
- Le stockage local est prioritaire en mode hors ligne. Quand deux versions différentes existent à la première connexion, l'utilisateur décide laquelle garder. En cas d'édition simultanée sur plusieurs onglets/appareils, la dernière sauvegarde distante gagne : il n'y a pas encore de fusion exemplaire par exemplaire.
- Les références créées localement et leurs images personnelles ne sont pas synchronisées dans cette première étape ; elles restent dans le navigateur et dans les exports JSON. Les lignes OWNED contenant des identifiants inconnus sont conservées dans le nuage, mais ne s'affichent pas tant que la référence n'existe pas localement.
- Supabase est chargé à la demande, une fois le cloud activé. Les fonctions d'Archives restent utilisables si le SDK ou le réseau sont indisponibles.

## Tests manuels avant fusion

- Démarrage sans activation : aucun dialogue de connexion, aucune perte de données.
- Activer le cloud, attendre l'indicateur « Collection synchronisée ».
- Ajouter puis retirer OWNED, inspecter les exemplaires et confirmer la mise à jour.
- Couper puis restaurer le réseau ; confirmer la conservation locale et le rattrapage.
- Créer un conflit entre le local et le cloud et tester séparément les deux choix.
- Vérifier via Supabase que RLS interdit l'accès à la collection d'une autre session anonyme.

Ne pas fusionner avant validation sur Deploy Preview.
