# Rapli Regatta

L'accueil du site est désormais consacré à **Rapli Regatta** uniquement.
Le portail `/` ouvre `/regatta/index.html` avec le logo existant `regatta/assets/logo.webp`.

## Fonctions conservées

Courses Virtual Regatta, étapes et tentatives, statistiques, classements VSR, palmarès, exports PNG/ICS, couleurs personnalisables des classes et synchronisation Supabase/IndexedDB.

Les interfaces Sports/Archives et Jerseys ainsi que leurs dépendances frontend sont retirées. L'édition reste réservée au compte administrateur vérifié, la consultation reste libre.

**Les anciennes données Sports/Archives restent conservées en Supabase**, sans effacement destructif. Les noms historiques des tables et du bucket `rapli-archives-private` sont des dépendances techniques conservées pour protéger Regatta.
