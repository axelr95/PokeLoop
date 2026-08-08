# CLAUDE.md

## Communication
- Réponses brèves, précises, à l'essentiel — pas de tour d'horizon inutile.
- Français uniquement, jamais d'anglais aléatoire.
- Économiser les tokens : pas de détails ou nuances non demandés.
- Skills `ponytail` et `caveman` actives par défaut (sauf indication contraire dans le message).

## Git
- En fin de tâche, push systématique sur `main` (seule branche testable côté utilisateur).
- Créer les commits normalement, mais ne pas s'arrêter sur une branche de travail intermédiaire.

## Projet
Idle game Pokémon (JS vanilla, pas de framework), servi par `server.js` (Node natif, statique).
- `npm run dev` : lance le serveur local (port 3000).
- `src/engine/` : moteur (`game.js` état/actions, `calculations.js` formules pures).
- `src/data/*.json` : tout le contenu (Pokémon, upgrades, paliers, recrutement...), data-driven.
- `docs/game_system.md` : spec de référence du système de jeu.
- `docs/paliers_pokemon.md` : détail du système de paliers de niveau (balancing).
- Pas de tests, pas de build step.
