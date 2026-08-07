# Système — Paliers de niveau par Pokémon (upgrades individuelles)

## Principe

Chaque Pokémon jouable génère **10 upgrades dédiées**, une par palier de niveau (10/20/30.../100). Achat unique comme les upgrades classiques (section 6), catégorie `additif_final`, ciblant ce Pokémon précis.

- Débloquée dans le shop dès que le Pokémon **atteint** le niveau du palier (condition d'état, pas un prérequis d'upgrade classique).
- Achat = Pokédollars, courbe de coût à définir (voir plus bas).
- Une fois achetée, reste active en permanence (comme toute upgrade).

## Valeurs (fixes, mêmes pour tous les Pokémon)

Motif en vague **25% / 50% / 100%** répété 3 fois, puis un palier final renforcé à 175% :

| tier (chiffre romain) | niveau requis | valeur ajoutée (`valeur` stockée) | cumulé affiché dans la description |
|---|---|---|---|
| I | 10 | 0.25 | 25% |
| II | 20 | 0.50 | 75% |
| III | 30 | 1.00 | 175% |
| IV | 40 | 0.25 | 200% |
| V | 50 | 0.50 | 250% |
| VI | 60 | 1.00 | 350% |
| VII | 70 | 0.25 | 375% |
| VIII | 80 | 0.50 | 425% |
| IX | 90 | 1.00 | 525% |
| X | 100 | 1.75 | 700% |

**Important** : `valeur` = l'incrément individuel (ce que le moteur utilise pour le calcul additif_final, qui somme automatiquement toutes les upgrades actives). Le "cumulé affiché" est une valeur **calculée pour l'affichage uniquement** (texte de description), égale à la somme de tous les paliers jusqu'à celui-ci inclus — elle n'a pas besoin d'être stockée séparément, le moteur peut la recalculer à l'affichage (somme des `valeur` de tier 1 à tier courant pour ce Pokémon) ou la précalculer à la génération.

## Coût — première courbe (à ajuster en balancing)

Formule simple, exponentielle ×4 par palier, indépendante du Pokémon pour l'instant (v1) :

```
cout(tier) = 100 × 4^(tier - 1)
```

| tier | coût |
|---|---|
| I | 100 |
| II | 400 |
| III | 1 600 |
| IV | 6 400 |
| V | 25 600 |
| VI | 102 400 |
| VII | 409 600 |
| VIII | 1 638 400 |
| IX | 6 553 600 |
| X | 26 214 400 |

À affiner une fois testé en jeu (probablement en pondérant par la position du Pokémon dans sa lignée d'évolution, ou par son coût de recrutement, pour différencier starters/recrues tardives).

## Data model : template générique (pas 1510 entrées en dur)

Comme `specialisation.json`, un **template unique** instancié dynamiquement par le moteur pour chaque Pokémon jouable (starters + recrues débloquées) :

```json
{
  "paliers": [
    { "id_suffix": "palier_1", "tier_romain": "I",   "niveau_requis": 10,  "valeur": 0.25, "cout": 100 },
    { "id_suffix": "palier_2", "tier_romain": "II",  "niveau_requis": 20,  "valeur": 0.50, "cout": 400 },
    { "id_suffix": "palier_3", "tier_romain": "III", "niveau_requis": 30,  "valeur": 1.00, "cout": 1600 },
    { "id_suffix": "palier_4", "tier_romain": "IV",  "niveau_requis": 40,  "valeur": 0.25, "cout": 6400 },
    { "id_suffix": "palier_5", "tier_romain": "V",   "niveau_requis": 50,  "valeur": 0.50, "cout": 25600 },
    { "id_suffix": "palier_6", "tier_romain": "VI",  "niveau_requis": 60,  "valeur": 1.00, "cout": 102400 },
    { "id_suffix": "palier_7", "tier_romain": "VII", "niveau_requis": 70,  "valeur": 0.25, "cout": 409600 },
    { "id_suffix": "palier_8", "tier_romain": "VIII","niveau_requis": 80,  "valeur": 0.50, "cout": 1638400 },
    { "id_suffix": "palier_9", "tier_romain": "IX",  "niveau_requis": 90,  "valeur": 1.00, "cout": 6553600 },
    { "id_suffix": "palier_10","tier_romain": "X",   "niveau_requis": 100, "valeur": 1.75, "cout": 26214400 }
  ]
}
```

Ids générés en jeu : `<pokemon_id>_<id_suffix>` (ex : `charmander_palier_3`).

Effet appliqué par le moteur pour chaque instance :
```json
{
  "categorie": "additif_final",
  "cible": { "type": "pokemon_id", "valeur": "<pokemon_id>" },
  "valeur": 0.25
}
```
(cible `pokemon_id` déjà prévue dans le schéma upgrade, cf. `game_system.md` 7bis.2 — juste jamais utilisée jusqu'ici.)

`condition_deblocage` : `"pokemon.<pokemon_id>.niveau >= <niveau_requis>"` (nouveau pattern de condition, à ajouter à l'évaluateur déjà prévu pour `equipe_taille >= 3`).

## ⚠️ Ciblage par lignée d'origine, pas par espèce courante

Problème : à l'évolution (3.2bis), l'`id` du Pokémon **change** (`charmander` → `charmeleon` → `charizard`). Si l'effet cible `cible.valeur: "charmander"`, il cesse de s'appliquer dès l'évolution — pas juste un souci visuel, un bug de calcul.

**Solution** : nouveau champ sur l'**instance équipe** (pas dans `pokemons.json`, qui reste la donnée générique par espèce) :
- `espece_actuelle` : détermine sprite/prod de base/types affichés — change à l'évolution (existant).
- `espece_ligne` : figée à l'espèce choisie au recrutement/starter, **ne change jamais**, même après évolution complète.

Les upgrades de palier ciblent `espece_ligne` (donc `charmander_palier_X` reste actif même une fois le Pokémon devenu Dracaufeu).

## Icône dans le shop

- Réutilise `portrait.png` de **`espece_ligne`** (pas `espece_actuelle`) — un Dracaufeu affichera toujours le portrait Salamèche sur ses upgrades, façon PokeRogue (le starter reste l'identité visuelle de la lignée).
- Overlay : chiffre romain (I à X) en bas à droite de l'icône, correspondant au tier — **généré côté UI**, pas stocké en data (dérivable du numéro de tier).

## Règle d'affichage — 1 slot par Pokémon, pas 10

Dans la liste du shop, **un seul emplacement visible par Pokémon** pour ce système de paliers (pas 10 lignes séparées) :

- Affiche le **prochain tier disponible/achetable** (le plus bas tier non encore acheté dont la condition de niveau est remplie).
- Une fois acheté, l'emplacement se met à jour pour afficher le tier suivant (remplace visuellement, pas d'ajout de ligne).
- Si aucun tier n'est encore débloqué (Pokémon < niveau 10), l'emplacement n'apparaît pas du tout dans le shop.
- Au clic/hover sur l'emplacement : la description affiche la **valeur cumulée** (tableau ci-dessus), pas juste l'incrément de ce palier seul.

## Volume de contenu

Le template s'instancie **par lignée évolutive**, pas par espèce individuelle : Bulbizarre/Herbizarre/Florizarre ne génèrent qu'**un seul** set de 10 paliers (ciblé sur `espece_ligne: "bulbasaur"`), pas trois. Le nombre réel de sets dépend donc du nombre de lignées distinctes dans `pokemons.json` (une espèce sans évolution = sa propre lignée à elle seule), et non des 151 entrées brutes.

En pratique, seules les lignées des Pokémon **jouables** (starters + recrues débloquées, cf. `recrutement.json`) sont instanciées dans une run donnée — max 6 lignées simultanées → 60 upgrades, quel que soit le nombre total de lignées existant dans la Pokédex complète.
