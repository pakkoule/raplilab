# Sports — évolutions validées pour la PR #1

PR ouverte et en brouillon, aucune fusion ni mise en production.

## Fonctionnalités sélectionnées

- **#4 NEW** : badge sur les cartes ajoutées depuis moins de 7 jours, hors démonstrations ; modes fiches et vignettes.
- **#21 Carte aléatoire** : bouton de découverte, tirage filtré dans OWN/Wishlist ou parmi OWN depuis Statistiques/Rainbow ; aperçu en lecture seule, nouveau tirage et modification.
- **#26 Dans mes rêves** : filtre cumulable propre à la Wishlist.
- **#42 / #44 Grading** : carte gradée, organisme facultatif (PSA, BGS, SGC, CGC, Autre), note facultative de 0,5 à 10 et badges.
- **#57 Nationalité de l’athlète** : code pays ISO alpha-2 facultatif par joueur (y compris multi-athlètes) et drapeau visible.
- **#99 Recherche tolérante** : correspondance sur un caractère erroné, ajouté, supprimé ou transposé pour les mots de cinq caractères et plus.

## Mode Rainbow 🌈

Un Rainbow est une checklist manuelle des versions parallèles d’une même carte de base.

- Onglet RAINBOW pour créer, modifier et supprimer un Rainbow ; titre, athlète, marque, référence de base et variantes attendues (80 au maximum).
- Association explicite de chaque variante à une fiche Sports existante via un sélecteur et une recherche.
- Statuts : OWN possédée, Wishlist recherchée, Manquante sans fiche associée ou fiche introuvable.
- **Taux = variantes associées à une carte OWN réelle / variantes attendues.** Wishlist, fiches démo et fiches supprimées ne comptent pas comme acquises. Une même carte ne peut pas être reliée deux fois au sein d’un Rainbow.
- La carte de base et les éditions 1/1 ne sont comptées que si elles figurent dans la checklist choisie. Aucun parallèle n’est inventé automatiquement.
- Persistance dans les enregistrements de type Rainbow de la collection de paramètres/logos existante. Synchronisation par le pont cloud du module Sports, sans migration Supabase.
- Supprimer un Rainbow n’efface aucune carte OWN/Wishlist.

## Vérifications

Tests de syntaxe JavaScript, présence des éléments HTML et calculs des taux de complétion. Restent à vérifier manuellement dans la Deploy Preview : navigation PC et iPhone Safari, création/édition/suppression, association de cartes, synchronisation PC/iPhone, affichage du grading et des drapeaux, recherche approchée et formulaire aléatoire.

PR toujours en brouillon, non fusionnée.
