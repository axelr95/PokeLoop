# CLAUDE.md

## Communication
- Réponses brèves, précises, à l'essentiel — pas de tour d'horizon inutile.
- Français uniquement, jamais d'anglais aléatoire.
- Économiser les tokens : pas de détails ou nuances non demandés.
- Skills `ponytail` et `caveman` actives par défaut (sauf indication contraire dans le message).

## Git
- En fin de tâche, push systématique sur `main` (seule branche testable côté utilisateur).
- Pas de branches annexes pour des sous-tâches : tout converge sur `main`, directement.
- Projet solo, pas de PR/review : en cas de bug, `git revert`/`git reset` sur le commit précédent suffit.
- Convention de commit : `type: description` en français, à l'impératif.
  Types : `feat` (ajout), `fix` (correction), `balance` (équilibrage jeu), `docs`, `refactor`, `chore`.
  Ex : `balance: rééquilibre le coût des paliers de niveau`.

## Balancing
- Le balancing va être touché en continu (nouvelles mécaniques, changements de progression
  qui ont des répercussions en cascade). Centraliser tout calcul de balance dans
  `scripts/balance.js` plutôt que du calcul jetable en terminal — le réutiliser et le faire
  évoluer à chaque changement.
- Ce script réutilise les vraies formules (`src/engine/calculations.js`) et les vraies données
  (`src/data/*.json`), jamais de valeurs recopiées à la main.
- `node scripts/balance.js` : table de balance actuelle (prod, coûts, ratios par palier).
- `node scripts/balance.js --fraction=0.10` : suggère des coûts de paliers à X% de la XP
  cumulée équipe, pour retrouver un ratio cible après un futur changement de données.

## Tests
- Pas de framework de test. Avant de livrer un changement, vérifier rapidement qu'il fonctionne
  (ex : `node -e` ciblé sur la fonction touchée, ou lancer `npm run dev` et un check ponctuel).
- Rester minimal : un check qui casse si la logique est fausse, pas une suite exhaustive.
  Pas de rapport détaillé du test dans la réponse — juste le résultat (ok/pas ok) si pertinent.

## Projet
Idle game Pokémon (JS vanilla, pas de framework), servi par `server.js` (Node natif, statique).
- `npm run dev` : lance le serveur local (port 3000).
- `src/engine/` : moteur (`game.js` état/actions, `calculations.js` formules pures).
- `src/data/*.json` : tout le contenu (Pokémon, upgrades, paliers, recrutement...), data-driven.
- `docs/game_system.md` : spec de référence du système de jeu.
- `docs/paliers_pokemon.md` : détail du système de paliers de niveau (balancing).
- Pas de tests, pas de build step.
