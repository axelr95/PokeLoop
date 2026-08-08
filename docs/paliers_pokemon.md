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

## Coût — indexé sur le coût XP cumulé (v3, suit la courbe XP exponentielle)

Coût (par Pokémon) = **10% du coût XP cumulé de l'équipe entière** (6 membres) pour atteindre le
niveau requis du palier, arrondi à un chiffre lisible. Basé sur l'équipe et non sur un seul
Pokémon : c'est la vraie masse de Pokédollars que le joueur a dû produire pour arriver à ce
niveau (une seule ressource, un seul pool de production).

Recalculé après le passage à la courbe XP exponentielle (section 3.3, `xp_courbe.type:
"exponentielle"`) — le cumul XP est désormais concentré sur les 20-30 derniers niveaux, donc les
paliers bas coûtent beaucoup moins qu'avec l'ancienne courbe (loi puissance), et les hauts
beaucoup plus (jusqu'à ×7,7 sur le palier X) :

```
xpRequise(n)            = 8.5705 × 1.1107^n            (section 3.3)
cumulXP_equipe(niveau)  = 6 × Σ xpRequise(n) pour n de 2 à niveau
cout(tier)               ≈ round_lisible(0.10 × cumulXP_equipe(niveau_requis))
```

| tier | niveau requis | coût brut (10%) | coût arrondi |
|---|---|---|---|
| I | 10 | 90 | 100 |
| II | 20 | 364 | 350 |
| III | 30 | 1 146 | 1 150 |
| IV | 40 | 3 382 | 3 400 |
| V | 50 | 9 770 | 9 750 |
| VI | 60 | 28 024 | 28 000 |
| VII | 70 | 80 181 | 80 000 |
| VIII | 80 | 229 213 | 230 000 |
| IX | 90 | 655 055 | 655 000 |
| X | 100 | 1 871 847 | 1 870 000 |

Toujours uniforme par tier (indépendant du Pokémon) ; la différenciation starter/recrue tardive
reste une piste ouverte.

## Data model : template générique (pas 1510 entrées en dur)

Comme `specialisation.json`, un **template unique** instancié dynamiquement par le moteur pour chaque Pokémon jouable (starters + recrues débloquées) :

```json
{
  "paliers": [
    { "id_suffix": "palier_1", "tier_romain": "I",   "niveau_requis": 10,  "valeur": 0.25, "cout": 100 },
    { "id_suffix": "palier_2", "tier_romain": "II",  "niveau_requis": 20,  "valeur": 0.50, "cout": 350 },
    { "id_suffix": "palier_3", "tier_romain": "III", "niveau_requis": 30,  "valeur": 1.00, "cout": 1150 },
    { "id_suffix": "palier_4", "tier_romain": "IV",  "niveau_requis": 40,  "valeur": 0.25, "cout": 3400 },
    { "id_suffix": "palier_5", "tier_romain": "V",   "niveau_requis": 50,  "valeur": 0.50, "cout": 9750 },
    { "id_suffix": "palier_6", "tier_romain": "VI",  "niveau_requis": 60,  "valeur": 1.00, "cout": 28000 },
    { "id_suffix": "palier_7", "tier_romain": "VII", "niveau_requis": 70,  "valeur": 0.25, "cout": 80000 },
    { "id_suffix": "palier_8", "tier_romain": "VIII","niveau_requis": 80,  "valeur": 0.50, "cout": 230000 },
    { "id_suffix": "palier_9", "tier_romain": "IX",  "niveau_requis": 90,  "valeur": 1.00, "cout": 655000 },
    { "id_suffix": "palier_10","tier_romain": "X",   "niveau_requis": 100, "valeur": 1.75, "cout": 1870000 }
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
