# Rapli Jerseys — logos partagés avec Rapli Sports

## Source de vérité

La collection Sports et sa bibliothèque de logos restent la **source unique** des identités visuelles utilisées par Jerseys.

- **Équipes** : enregistrements Sports avec `type: "team"`.
- **Compétitions** : enregistrements Sports avec `type: "tag"` et `categories` comprenant `"competition"`.
- **Variantes historiques** : tableau existant `historical` du même enregistrement. Une variante `kind: "alternative"` n'est utilisée que sur sélection explicite.

Aucune image ni fiche de logo n'est répliquée dans une collection Jerseys. Les messages passent uniquement entre les iframes same-origin du portail.

## Schéma recommandé pour une future tuile enregistrée

```json
{
  "teamLogo": {"id": "sports-team-record-id", "category": "team", "variant": "auto"},
  "competitionLogo": {"id": "sports-competition-tag-id", "category": "competition", "variant": "auto"},
  "season": "2024/2025"
}
```

Les champs de la fiche maillot (photo, joueur, taille, statut, etc.) pourront être ajoutés dans un modèle indépendant, sans toucher aux cartes Sports.

`variant` accepte `"auto"` (logo historique pour la saison, sinon principal), `"main"`, ou `"variant:<id de variante>"` (choix manuel). Les logos historiques utilisent la règle Sports existante : `YYYY` ou `YYYY/YYYY+1` pour la saison, plage de début à fin inclusive.

## Flux de consultation

1. Jerseys demande uniquement les références et métadonnées au module Sports.
2. L'utilisateur sélectionne une équipe et/ou une compétition, une saison et éventuellement une variante.
3. Jerseys demande **seulement les deux images sélectionnées**, sans téléchargement supplémentaire ni copie persistante.
4. Lorsqu'un logo Sports est ajouté, modifié, supprimé ou synchronisé, Jerseys actualise son aperçu.
5. Si le logo source ou sa catégorie n'existe plus, le nom/visuel utilise un état de repli sans créer de doublon.

Le module Sports est monté en arrière-plan si l'utilisateur ouvre directement `#jerseys`, mais reste invisible. Les écritures dans la bibliothèque Sports demeurent réservées à l'administrateur via ses contrôles actuels.

## Portée de la PR

La prévisualisation de tuile est opérationnelle pour vérifier les associations. **La sauvegarde d'une collection de maillots n'est pas encore activée** ; elle nécessitera un modèle de données et des permissions indépendants. Aucune migration Supabase n'est nécessaire pour la réutilisation en lecture seule.
