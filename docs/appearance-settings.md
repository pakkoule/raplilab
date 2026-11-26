# Couleurs & variations

Dans Sports, ouvrir la bibliothèque de logos en mode administrateur puis l’onglet **Couleurs & variations**, intégré dans la même fenêtre.

- Choisir un élément dans « Couleurs de base » et cocher « Personnaliser cet élément ».
- Définir texte, fond, seconde couleur, bordure et finition (uni, dégradé ou foil).
- Pour un titre uni, régler « Texte uni ». En dégradé ou foil, les deux couleurs remplissent les lettres.
- Ajouter une variation pour une condition (Rookie, OWN, Wishlist, Légendaire, 1/1, Dans mes rêves, Gradée ou Numérotée), puis son périmètre : partout, catalogue ou fenêtre Rainbow.
- Les règles actives sont appliquées dans l’ordre ; la dernière l’emporte pour un même élément. Les boutons de priorité déplacent une règle. Les règles existantes peuvent être désactivées ou supprimées.
- Les modifications sont un aperçu temporaire. **Annuler** restaure les paramètres enregistrés. Changer d’onglet conserve le brouillon jusqu’à la fermeture de la bibliothèque (croix ou Échap), qui l’abandonne. **Enregistrer** sauvegarde l’ensemble. **Couleurs d’origine**, puis Enregistrer, restaure exactement le rendu d’origine.

Les couleurs précises par sport, type d’autographe/patch, tirage et organisme restent dans les éditeurs existants. Une couleur de base activée ici est prioritaire sur ces réglages pour l’élément concerné. Les couleurs contenues dans les images de logos ne sont pas retouchées. Les exports PNG/PDF utilisent toujours leur propre mise en page.

## Données et synchronisation

Un seul enregistrement `settings:appearance`, type `appearance`, dans la bibliothèque `logos`. Il contient une configuration versionnée et aucune image. Il suit la sauvegarde IndexedDB, les exports/imports de collection et la synchronisation différentielle existante, sans abonnement ni requête additionnelle lors des changements d’aperçu. Le contrôle administrateur et les autorisations Supabase restent inchangés. Aucune migration de base requise.


## Vérification

`npm test` couvre normalisation, rejet des valeurs injectées, ordre de priorité, suppression/désactivation, aperçu/annulation sans écriture, sauvegarde/rechargement, restauration et consultation non administrateur. Les tests d’interface utilisent jsdom sans écrire dans la collection réelle.
