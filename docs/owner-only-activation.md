# Rapli Lab — activation de l’éditeur unique (PR #1)

**Adresse autorisée :** `rapharcadium@pm.me`

## Ce qui est préparé
- Consultation publique de la collection Sports, sans création obligatoire de compte.
- Lien e-mail de connexion administrateur depuis « 🔒 MODE ÉDITION » dans le footer.
- Session persistante sur PC et iPhone après connexion.
- Boutons de gestion masqués pour les visiteurs ; fonctions de modification côté client verrouillées.
- Lecture des photos Sports existantes, sans publier les images Regatta.
- Le Cloud ne sauvegarde plus les changements depuis un appareil visiteur.
- Les données existantes (54 cartes Sports + 83 logos, Regatta séparé à la date de préparation) restent dans les lignes Supabase actuelles, sans migration des enregistrements.

## Correction du callback localhost et des liens expirés

Dans Supabase **Authentication → URL Configuration** :
- Définir **Site URL** sur `https://raplilab.netlify.app/` (remplacer `http://localhost:3000`).
- Ajouter dans **Redirect URLs** :
  - `https://raplilab.netlify.app/**`
  - `https://deploy-preview-1--raplilab.netlify.app/**`
- Dans **Authentication → Email Templates → Magic Link**, vérifier que le lien utilise `{{ .ConfirmationURL }}` (celui-ci inclut la redirection demandée), et non une URL `localhost` ou un lien construit avec `{{ .SiteURL }}` incompatible avec les previews.
- Un lien qui renvoie `otp_expired` est expiré ou déjà utilisé : il n'est pas récupérable. Demander **un nouveau lien après correction des URLs**, sans multiplier les demandes tant que le quota email Supabase est atteint.

## Ordre de mise en route obligatoire
1. Vérifier dans Supabase Auth que l’envoi de liens email est actif et que **https://deploy-preview-1--raplilab.netlify.app/** et **https://raplilab.netlify.app/** sont autorisées dans **Authentication → URL Configuration → Redirect URLs**. Pendant les tests de la PR, ouvrir **https://deploy-preview-1--raplilab.netlify.app/** : le lien e-mail revient à cette preview (et non à la production qui ne possède pas encore la connexion).
2. Sur le site de test, ouvrir « MODE ÉDITION », entrer l’adresse administrateur et cliquer sur le lien reçu. Vérifier que le footer affiche « Administrateur connecté ».
3. Après avoir validé la connexion, planifier le déploiement de la version à jour **avec** l’application du script `docs/owner-only-rls.sql` au projet Supabase associé. Ce script est volontairement non appliqué dans cette PR.
4. Vérifier immédiatement l’accès visiteur depuis une fenêtre privée : voir les cartes, filtres, Rainbow et photos, mais pas de sauvegarde ni d’édition.
5. Vérifier l’éditeur sur un appareil connecté : créer puis supprimer une carte test et vérifier la synchronisation Cloud. Refaire l’essai sur mobile.
6. Tester côté Supabase qu’un jeton anonyme ne peut pas effectuer INSERT/UPDATE/DELETE sur `rapli_module_collections` ni écrire des images dans le bucket. Vérifier que la lecture des images Regatta reste privée.

## Important
Ne pas appliquer le script de sécurité en avance sur la PR : le site en production utilise encore l’ancien flux anonyme et pourrait perdre son droit de sauvegarde. À l’inverse, ne pas considérer le masquage des boutons comme une protection serveur tant que les nouvelles politiques RLS ne sont pas activées.

L’adresse e-mail est un identifiant, **pas** un mot de passe ni un secret côté navigateur. La sécurité repose sur le lien e-mail confirmé et sur les règles Supabase.
