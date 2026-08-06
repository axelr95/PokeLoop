# Game System — Idle Pokémon

## 1. Vue d'ensemble

Jeu incrémental (idle game) local, inspiré de **Realm Grinder**, avec une DA Pokémon Donjon Mystère (sprites pixel art).
Cœur de gameplay : production de ressources, upgrades, spécialisation de type, multiplicateurs, prestige.
Pas de combat pour l'instant (possible mode annexe futur : Tour de combat / Raids de boss).

**Game loop** : tick toutes les 1 seconde. Toute la production est exprimée "par seconde".

---

## 2. Ressources

- **Pokédollars** : ressource principale de départ. Seule ressource active pour le moment.
- **Gems**, **Rubis**, et autres ressources futures : à définir plus tard (probablement liées au prestige).
Chaque ressource sera définie en data (`resources.json`) avec : `id`, `nom`, `icône`.

---

## 3. Pokémon

### 3.0 Pokédex disponible
- `pokemons.json` contient désormais les **151 Pokémon de la 1ère génération** (nom FR, types, courbe XP/production standard — cf. 7bis.1), pour que le moteur puisse gérer n'importe lequel d'entre eux dès qu'il rejoint l'équipe.
- Seuls certains sont *jouables* pour l'instant : les 3 starters (choix initial) et les Pokémon listés dans les paliers de `recrutement.json` (voir 3.1bis). Le reste de la Pokédex attend de futurs paliers de recrutement (emplacements 4 à 6, non définis).
### 3.1 Généralités
- Un Pokémon appartient à l'équipe (6 emplacements, dont 3 exploitables pour l'instant : starter + 2 paliers de recrutement).
- L'équipe démarre **vide** : un état de sélection s'affiche dans le panel Pokémon tant qu'aucun starter n'est choisi.
- **Choix du starter** : modale à 3 choix (Bulbizarre / Salamèche / Carapuce), chacun affichant son portrait, son nom et ses badges de type. Choix définitif pour la run (pas de retour en arrière hors reset/prestige).
- Chaque Pokémon possède **son propre niveau et sa propre XP**, indépendants des autres (comme les bâtiments de Realm Grinder).
- Chaque Pokémon a un ou plusieurs **types** (types Pokémon classiques : Feu, Eau, Plante, etc. — un Pokémon peut être mono ou double type).
- Niveau de départ variable selon le Pokémon choisi (ex : Salamèche démarre niveau 5, les recrues démarrent niveau 1).
- **Cap de niveau : 100** (comme les jeux Pokémon classiques). Un système de dépassement/continuation sera envisagé plus tard.
### 3.1bis Recrutement de coéquipiers
- Débloque l'emplacement suivant contre des Pokédollars : une case d'action apparaît dans la grille du panel Pokémon (même système que le choix du starter, cf. 3.1ter) dès qu'un palier est disponible pour la taille d'équipe actuelle.
- Chaque palier est défini en data (`recrutement.json`) : `emplacement` (taille d'équipe visée), `cout` (en Pokédollars), `choix` (liste fixe d'`id` Pokémon proposés, façon mini-starter).
- Paliers actuellement définis :
  - emplacement 2, coût 1 000 Pokédollars, choix entre Roucool / Abra / Machoc.
  - emplacement 3, coût 5 000 Pokédollars, choix entre Pikachu / Miaouss / Osselait.
- Les emplacements 4 à 6 n'ont pas encore de palier défini dans la data — cette case reste verrouillée (🔒) tant qu'aucun palier ne correspond à la taille d'équipe suivante.

### 3.1ter Panel Pokémon : grille des 6 emplacements
- Le panel affiche une grille fixe **2 colonnes × 3 lignes**, toujours entièrement visible sans scroll (contrainte mobile).
- Chaque case correspond à un emplacement (même position que l'arc de cercle affiché dans la zone décorative, cf. section 8) et vaut :
  - un Pokémon de l'équipe (portrait en pleine hauteur, nom, niveau, badges de type, barre XP + investissement, ou bouton Évoluer — cf. 3.2bis) ;
  - la case d'action du starter (emplacement 1 tant qu'aucun n'est choisi) ou de recrutement (prochain palier disponible) ;
  - verrouillée (🔒) si l'emplacement n'est ni rempli ni actionnable pour l'instant.
### 3.2 Production de base
- Chaque Pokémon génère **X Pokédollar/seconde par niveau**, où X dépend de son palier d'évolution (voir 3.2bis) — fixe, avant tout multiplicateur.
  - Ex : Salamèche (base) niveau 5 → 5 Pokédollars/s ; Reptincel (1ère évolution, ×1.5) même niveau → 7.5/s.
- Cette base est ensuite modifiée par les facteurs de production (voir section 5).
### 3.2bis Évolutions
- Une espèce peut porter un champ `evolution: { vers, niveau }` (voir 7bis.1) : dès que le Pokémon atteint ce niveau, sa case dans la grille remplace la barre XP + les boutons d'investissement par un **gros bouton "Évoluer"** (icône, nom et niveau restent affichés).
- Au clic, le Pokémon devient l'espèce cible (`vers`) : **niveau et XP sont conservés tels quels**, seuls l'espèce (donc sprite, nom, types, production de base) changent.
- La production de base dépend de la position dans la lignée **complète** de l'espèce (pas d'un palier fixe indépendant de la longueur de la chaîne) : la forme la plus évoluée (3ème palier si la lignée en a 3, 2ème si elle n'en a que 2, ou l'espèce elle-même si elle n'évolue pas du tout) vaut toujours **×2** ; la forme juste en dessous vaut **×1.5** si elle existe (le 2ème palier d'une lignée à 3, ou la forme de base d'une lignée à 2) ; la forme de base d'une lignée à 3 paliers vaut **×1**. Ainsi une espèce sans évolution (ex : Tauros) n'est pas pénalisée face à une lignée à 3 paliers, et la forme finale d'une lignée à 2 paliers (ex : Arcanin) vaut autant que celle d'une lignée à 3 (ex : Salamèche 1 → Reptincel 1.5 → Dracaufeu 2). Valeur stockée directement dans `production_base.valeur_par_niveau` de chaque espèce (pas un multiplicateur séparé).
- Niveaux d'évolution récupérés depuis les données officielles (PokeAPI, gen 1 rouge/bleu/jaune). Pour les évolutions qui n'ont pas de niveau canonique dans les jeux (pierre ou échange, ex : Pikachu → Raichu), un **niveau par défaut est utilisé (25 pour pierre, 30 pour échange)** afin qu'elles restent jouables uniquement via le niveau, comme le reste du système.
- **Évoli n'a pas d'évolution pour l'instant** : ses 3 évolutions (pierres Feu/Eau/Foudre) forment un embranchement à choix multiple que le schéma actuel (`evolution` à cible unique) ne gère pas encore.
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
- Comme la production passive, cette base est soumise aux mêmes facteurs multiplicatifs/additifs (voir section 5), via des upgrades dédiées au clic.
---

## 4bis. Progression hors-ligne

- À chaque tick, l'horodatage courant (`dernierTick`) est stocké dans la sauvegarde.
- Au chargement, si une équipe existe déjà, le temps écoulé depuis `dernierTick` est calculé et crédité en Pokédollars au taux de production passive courant (upgrades comprises), comme si le jeu avait tourné pendant l'absence.
- **Plafonné à 8h** de rattrapage (au-delà, le surplus n'est pas compté) et **ignoré sous 5s** (simple changement d'onglet, pas une vraie absence).
- Un toast affiche la durée écoulée et le montant gagné ; le joueur doit le fermer pour reprendre la main (les valeurs affichées sont déjà à jour dessous).
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

## 6. Upgrades

- Achetées avec des Pokédollars (coût croissant, à définir par upgrade).
- Une fois achetée, une upgrade reste active en permanence (liste des upgrades actives visible, comme Realm Grinder).
- Une upgrade peut cibler :
  - Un **type** précis (ex : "+50% prod Feu" → catégorie multiplicatif final, filtré type Feu).
  - Le **clic manuel** spécifiquement.
  - Toute la prod globale (tous types confondus).
- Les upgrades de type peuvent être exclusives (ex : choix initial entre Feu / Eau / Plante) ou cumulables selon leur nature — à définir upgrade par upgrade dans la data.
- L'idée initiale de "synergies" (bonus conditionnels croisés) a été abandonnée comme mécanique séparée : c'est la **spécialisation de type** qui en tient lieu — achat unique dans la boutique, choix définitif d'un type pour la run (+100% final immédiat sur ce type), qui débloque ensuite 3 upgrades dédiées à ce type (une déclinaison par type, cf. `upgrades.json`).
### Table des types
- Utilise les types Pokémon classiques (Feu, Eau, Plante, Électrik, etc.).
- **Pas de logique d'efficacité de type (super efficace / pas très efficace) pour l'instant** — les types servent uniquement de tag pour cibler les upgrades.
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

Contient les **151 entrées de la 1ère génération** (récupérées via l'API PokeAPI pour les noms FR/types, sprites via PMDCollab). Exemple :

```json
{
  "id": "charmander",
  "dex": 4,
  "nom": "Salamèche",
  "types": ["feu"],
  "niveau_depart": 5,
  "sprite_dossier": "assets/sprites/0004_charmander/",
  "xp_courbe": { "base": 10, "facteur": 1.5 },
  "production_base": { "type": "lineaire", "valeur_par_niveau": 1 },
  "starter": true,
  "evolution": { "vers": "charmeleon", "niveau": 16 }
}
```

- `dex` : numéro national, sert aussi de préfixe (zero-paddé sur 4 chiffres) du dossier de sprites pour qu'ils restent triés sur le disque.
- `sprite_dossier` : dossier contenant les sprites façon Donjon Mystère (un dossier par Pokémon) : `portrait.png` (portrait "Normal", affiché dans le panel Pokémon et les modales de choix), `idle.png` (bande de frames de l'animation Idle, direction bas-gauche uniquement, rejouée en CSS), `sleep.png` (même principe pour l'animation Sleep, récupéré mais pas encore utilisé en jeu), `meta.json` (dimensions/nombre de frames de chaque bande, pour construire l'animation CSS).
- `starter` : présent (`true`) uniquement sur les 3 Pokémon proposés au choix initial (Bulbizarre, Salamèche, Carapuce). Absent sinon.
- `evolution` : optionnel, cf. section 3.2bis. `vers` référence un autre `id` de ce même fichier ; `niveau` est le seuil d'affichage du bouton Évoluer. Absent pour les espèces sans évolution suivante (formes finales, ou Évoli en attendant l'embranchement).
- `production_base.valeur_par_niveau` : varie selon la position de l'espèce dans sa lignée complète (1 / 1.5 / 2, cf. 3.2bis) — ce n'est donc plus une constante à 1 pour les 151 entrées comme au tour précédent.
- `xp_courbe` : **commune à tous les Pokémon pour l'instant** (même formule `base × niveau^facteur`, cf. section 3.3). On ne différencie pas encore par Pokémon/légendaire — l'écart entre types de Pokémon viendra plutôt d'upgrades qui réduisent le coût d'XP pour un type donné, créant une variation naturelle selon les runs plutôt qu'une valeur figée par Pokémon.
- `production_base` : formule paramétrée (pas un tableau de valeurs par niveau, trop lourd à maintenir). Calculée à la volée par le moteur : `production(niveau)`.
  - `type: "lineaire"` → `valeur_par_niveau × niveau` (cas standard, ex : Salamèche = 1/niveau). Tous les 151 Pokémon utilisent ce type pour l'instant.
  - `type: "exponentielle"` → `base × facteur^niveau` (réservé aux Pokémon spéciaux, ex : légendaires avec une courbe plus forte, pas encore utilisé).
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

### 7bis.3 Palier de recrutement (`recrutement.json`)

```json
[
  { "emplacement": 2, "cout": 1000, "choix": ["pidgey", "abra", "machop"] },
  { "emplacement": 3, "cout": 5000, "choix": ["pikachu", "meowth", "cubone"] }
]
```

- `emplacement` : taille d'équipe que ce palier permet d'atteindre (le moteur cherche l'entrée où `emplacement === equipe.length + 1`).
- `cout` : prix en Pokédollars pour recruter (pas de champ `ressource` ici, une seule ressource existe pour l'instant).
- `choix` : liste fixe d'`id` Pokémon (doivent exister dans `pokemons.json`) proposés dans la modale de recrutement ; le joueur en choisit un.
- Les 5 paliers (emplacements 2 à 6) sont désormais tous définis, l'équipe peut donc être complétée jusqu'à 6 Pokémon.
---

## 8. Structure data-driven (rappel architecture)

Toute la logique de contenu (upgrades, coûts, Pokémon, prestige) vit dans des fichiers de données séparés (JSON), lus génériquement par le moteur :


```
/src/data
  resources.json      → ressources (Pokédollars, futures ressources)
  pokemons.json       → Pokédex complet 151 (types, niveau de départ, sprite, starter)
  upgrades.json       → upgrades (coût, catégorie de facteur, cible type/clic/global),
                         y compris les 3 upgrades par type débloquées par la spécialisation
  specialisation.json → coût de déblocage et bonus immédiat de la spécialisation de type
  types.json          → libellé/emoji/couleur par type, pour les badges affichés en UI
  recrutement.json    → paliers de déblocage d'emplacement d'équipe (coût, choix)
  prestige.json       → trophées, règles de reset

/assets/sprites/<dex>_<id>/  → portrait.png, idle.png, sleep.png, meta.json par Pokémon
```


Le moteur (`calculations.js`) applique les 4 facteurs génériquement à partir de ces données, sans upgrade "en dur" dans le code.

### Fond décoratif jour/nuit et disposition de l'équipe

- La zone décorative affiche un fond parmi 4 (`assets/backgrounds/{matin,apres-midi,soir,nuit}.png`) selon l'heure locale de l'appareil (6-12h / 12-18h / 18-0h / 0-6h), recalculé toutes les 5 min tant que l'appli reste ouverte. Affiché en largeur pleine (`background-size: 100% auto`, ancré en bas) : les bords de l'image touchent les bords de l'écran, seul le haut (ciel) peut être rogné.
- L'équipe est positionnée en arc de cercle sur le rebord de la falaise visible sur ces fonds (~14% du bas de l'image, recalculé depuis la largeur réelle de la zone) : 6 emplacements fixes (centre, puis bas-gauche/bas-droite/haut-droite/bas-centre/haut-gauche), les mêmes positions que la grille du panel Pokémon (cf. 3.1ter).
- Un bouton debug (icône horloge, coin haut-droit de la zone décorative) permet de cycler manuellement les 4 fonds pour tester sans attendre le bon créneau horaire.

### Reset local (outil, pas une mécanique de jeu)

Un bouton (sous le bouton debug fond, coin haut-droit) efface `localStorage`/`sessionStorage`/Cache Storage/cookies du site puis recharge la page. C'est un utilitaire de test/rattrapage, pas une variante du prestige (section 7) : aucune conservation (trophées, gems…) n'est prévue, tout repart à zéro.

---

## 9. Points ouverts (à trancher plus tard)

- Système de continuation au-delà du niveau 100.
- Embranchement d'évolution à choix multiple (Évoli et ses 3 pierres) — le schéma `evolution: {vers, niveau}` ne gère qu'une cible unique pour l'instant.
- Niveaux par défaut (25 pierre / 30 échange) utilisés pour les évolutions sans seuil canonique : choix arbitraire, à retravailler si le rythme de progression ne convient pas à l'usage.
- Ressources futures (Gems, Rubis...) et leur rôle exact.
- Mode combat annexe (Tour de combat / Raids) et réintroduction de l'efficacité des types.
- Choix du starter au prestige (aléatoire vs Pokédex débloqué — les 151 sont déjà en data, reste à décider comment ils se débloquent au fil des runs).
