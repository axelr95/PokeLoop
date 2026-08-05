# Game System — Idle Pokémon

## 1. Vue d'ensemble

Jeu incrémental (idle game) local, inspiré de **Realm Grinder**, avec une DA Pokémon Donjon Mystère (sprites pixel art).
Cœur de gameplay : production de ressources, upgrades, synergies, multiplicateurs, prestige.
Pas de combat pour l'instant (possible mode annexe futur : Tour de combat / Raids de boss).

**Game loop** : tick toutes les 1 seconde. Toute la production est exprimée "par seconde".

---

## 2. Ressources

- **Pokédollars** : ressource principale de départ. Seule ressource active pour le moment.
- **Gems**, **Rubis**, et autres ressources futures : à définir plus tard (probablement liées au prestige).
Chaque ressource sera définie en data (`resources.json`) avec : `id`, `nom`, `icône`.

---

## 3. Pokémon

### 3.1 Généralités
- Un Pokémon appartient à l'équipe (6 emplacements). Pour l'instant : 1 seul Pokémon actif (le starter).
- Chaque Pokémon possède **son propre niveau et sa propre XP**, indépendants des autres (comme les bâtiments de Realm Grinder).
- Chaque Pokémon a un ou plusieurs **types** (types Pokémon classiques : Feu, Eau, Plante, etc. — un Pokémon peut être mono ou double type).
- Niveau de départ variable selon le Pokémon choisi (ex : Salamèche démarre niveau 5).
- **Cap de niveau : 100** (comme les jeux Pokémon classiques). Un système de dépassement/continuation sera envisagé plus tard.
### 3.2 Production de base
- Chaque Pokémon génère **1 Pokédollar/seconde par niveau** (fixe, avant tout multiplicateur).
  - Ex : niveau 5 → 5 Pokédollars/s de base.
- Cette base est ensuite modifiée par les facteurs de production (voir section 5).
### 3.3 Expérience et niveau
- Payer X Pokédollars donne X d'XP au Pokémon choisi (ratio de départ : **1 Pokédollar = 1 XP**, ajustable).
- XP requise pour passer au niveau supérieur, courbe croissante simple :
  ```
  XP_requise(n) = base × n^facteur
  ex : XP_requise(n) = 10 × n^1.5
  ```
- Quand le seuil est atteint, le Pokémon monte de niveau, sa production de base augmente (+1/s).
---

## 4. Clic manuel

- Cliquer sur l'écran génère manuellement des Pokédollars.
- Production de base du clic : **1 Pokédollar/clic** (fixe au départ).
- Comme la production passive, cette base est soumise aux mêmes facteurs multiplicatifs/additifs (voir section 5), via des upgrades/synergies dédiées au clic.
---

## 5. Système de production : les 4 facteurs

Toute production (Pokémon ou clic manuel) suit la même formule à **4 facteurs**, dans cet ordre :


```
Prod_base        = valeur fixe (ex : 1 par niveau, ou 1 par clic)

Prod_base_finale = Prod_base
                    × (1 + somme des %additifs "base")
                    × (produit des multiplicateurs "base")

Prod_finale       = Prod_base_finale
                    × (1 + somme des %additifs "finaux")
                    × (produit des multiplicateurs "finaux")
```


Chaque upgrade/synergie/passif se déclare dans **une seule** de ces 4 catégories :
1. Additif base
2. Multiplicatif base
3. Additif final
4. Multiplicatif final
**Exemple concret** (donné par l'utilisateur) :

```
Base = 10
+ Additif base 20%       → 10 × 1.2 = 12
× Multiplicatif base 1.5 → 12 × 1.5 = 18   (= Prod_base_finale)

+ Additifs finaux (1.2 + 1.5 + 1.2 = 3.9 → +390%) → 18 × (1 + 3.9) = 88.2
× Multiplicatifs finaux (1.3 × 1.5 × ...)          → résultat final
```


Ce système s'applique **séparément** pour :
- La production passive de chaque Pokémon (filtrée par type si l'upgrade cible un type).
- La production du clic manuel.
---

## 6. Upgrades & synergies

- Achetées avec des Pokédollars (coût croissant, à définir par upgrade).
- Une fois achetée, une upgrade reste active en permanence (liste des upgrades actives visible, comme Realm Grinder).
- Une upgrade peut cibler :
  - Un **type** précis (ex : "+50% prod Feu" → catégorie multiplicatif final, filtré type Feu).
  - Le **clic manuel** spécifiquement.
  - Toute la prod globale (tous types confondus).
- Les upgrades de type peuvent être exclusives (ex : choix initial entre Feu / Eau / Plante) ou cumulables selon leur nature — à définir upgrade par upgrade dans la data.
- **Synergies** : bonus conditionnels croisés (ex : posséder X upgrades Feu débloque un bonus supplémentaire). Mécanique à détailler plus tard, mais rentre dans le même système à 4 facteurs.
### Table des types
- Utilise les types Pokémon classiques (Feu, Eau, Plante, Électrik, etc.).
- **Pas de logique d'efficacité de type (super efficace / pas très efficace) pour l'instant** — les types servent uniquement de tag pour cibler upgrades/synergies.
- Cette logique de type sera réutilisée telle quelle si un mode annexe combat (Tour de combat, Raids de boss/légendaires) est ajouté plus tard.
---

## 7. Prestige

> **Non prioritaire — pas à coder pour le moment.** Cette section pose seulement l'intention générale pour ne pas fermer de portes dans l'architecture. Le détail sera retravaillé le moment venu.

- Reset complet de la partie : ressources, niveau/XP du/des Pokémon, upgrades achetées → tout remis à zéro.
- Retour au choix du starter (possibilité future : choix parmi les Pokémon déjà rencontrés/Pokédex).
- **Conservé après reset** :
  - **Trophées** : plutôt pensés comme des **succès à déverrouiller** (accomplissements, ex : "Atteindre niveau 50", "Faire 3 prestiges"...) qui donnent des bonus permanents pour accélérer le début des runs suivantes, plutôt que des upgrades achetées avec une ressource de prestige. **Mécanique encore à voir plus tard**, rien de figé.
  - **Gems** (et bonus liés) : mécanique à définir plus tard.
---

## 7bis. Modèles de données précis

### 7bis.1 Pokémon (`pokemons.json`)


```json
{
  "id": "charmander",
  "nom": "Salamèche",
  "types": ["feu"],
  "niveau_depart": 5,
  "sprite_dossier": "assets/sprites/charmander/",
  "xp_courbe": { "base": 10, "facteur": 1.5 },
  "production_base": { "type": "lineaire", "valeur_par_niveau": 1 }
}
```


- `sprite_dossier` : dossier contenant les sprites animés façon Donjon Mystère (un dossier par Pokémon).
- `xp_courbe` : **commune à tous les Pokémon pour l'instant** (même formule `base × niveau^facteur`, cf. section 3.3). On ne différencie pas encore par Pokémon/légendaire — l'écart entre types de Pokémon viendra plutôt d'upgrades qui réduisent le coût d'XP pour un type donné, créant une variation naturelle selon les runs plutôt qu'une valeur figée par Pokémon.
- `production_base` : formule paramétrée (pas un tableau de valeurs par niveau, trop lourd à maintenir). Calculée à la volée par le moteur : `production(niveau)`.
  - `type: "lineaire"` → `valeur_par_niveau × niveau` (cas standard, ex : Salamèche = 1/niveau).
  - `type: "exponentielle"` → `base × facteur^niveau` (réservé aux Pokémon spéciaux, ex : légendaires avec une courbe plus forte).
  - D'autres types de courbe pourront être ajoutés plus tard sans changer la structure du champ.
### 7bis.2 Upgrade (`upgrades.json`)


```json
{
  "id": "spe_feu_1",
  "nom": "Spécialisation Feu",
  "cout": { "ressource": "pokedollars", "valeur": 100 },
  "effet": {
    "categorie": "multiplicatif_final",
    "cible": { "type": "type_pokemon", "valeur": "feu" },
    "valeur": 1.5
  },
  "prerequis": [],
  "exclusif_avec": ["spe_eau_1", "spe_plante_1"]
}
```


- `effet.categorie` : une des 4 catégories de la section 5 (`additif_base`, `multiplicatif_base`, `additif_final`, `multiplicatif_final`).
- `effet.cible.type` : `"type_pokemon"` (filtré par type), `"global"` (tous les Pokémon), ou `"clic_manuel"`. Le ciblage d'un Pokémon précis n'est pas mis en place tout de suite mais la structure est prévue pour l'accueillir plus tard (`"type": "pokemon_id"`).
- `prerequis` : liste d'`id` d'upgrades à posséder avant de pouvoir acheter celle-ci. Mis en place dès maintenant pour préparer les arbres à tiers façon factions Realm Grinder (les tiers eux-mêmes viendront plus tard).
- `exclusif_avec` : liste d'`id` d'upgrades qui se retirent mutuellement du shop si l'une d'elles est achetée (ex : choix exclusif Feu / Eau / Plante).
- Toutes les upgrades sont à **achat unique** pour l'instant : une fois achetée, elle passe dans la liste des upgrades possédées (affichée comme dans Realm Grinder) et disparaît du shop.
---

## 8. Structure data-driven (rappel architecture)

Toute la logique de contenu (upgrades, synergies, coûts, Pokémon, prestige) vit dans des fichiers de données séparés (JSON), lus génériquement par le moteur :


```
/src/data
  resources.json   → ressources (Pokédollars, futures ressources)
  pokemons.json    → Pokémon (types, niveau de départ, sprite)
  upgrades.json    → upgrades (coût, catégorie de facteur, cible type/clic/global)
  synergies.json   → bonus croisés
  prestige.json    → trophées, règles de reset
```


Le moteur (`calculations.js`) applique les 4 facteurs génériquement à partir de ces données, sans upgrade "en dur" dans le code.

---

## 9. Points ouverts (à trancher plus tard)

- Système de continuation au-delà du niveau 100.
- Déblocage et gestion des 5 autres emplacements d'équipe.
- Ressources futures (Gems, Rubis...) et leur rôle exact.
- Détail des synergies (conditions de déclenchement).
- Mode combat annexe (Tour de combat / Raids) et réintroduction de l'efficacité des types.
- Choix du starter au prestige (aléatoire vs Pokédex débloqué).
