// Moteur générique du système de production à 4 facteurs (cf. docs/game_system.md section 5)

export function productionPokemon(pokemon, niveau) {
  const { type, valeur_par_niveau, base, facteur } = pokemon.production_base;
  if (type === "lineaire") return valeur_par_niveau * niveau;
  if (type === "exponentielle") return base * Math.pow(facteur, niveau);
  throw new Error(`Type de production inconnu: ${type}`);
}

export function xpRequise(pokemon, niveau) {
  const { base, facteur } = pokemon.xp_courbe;
  return base * Math.pow(niveau, facteur);
}

// modifiers: liste de { categorie, valeur } déjà filtrée pour la cible concernée
export function appliquerFacteurs(base, modifiers) {
  const somme = (cat) =>
    modifiers.filter((m) => m.categorie === cat).reduce((acc, m) => acc + m.valeur, 0);
  const produit = (cat) =>
    modifiers.filter((m) => m.categorie === cat).reduce((acc, m) => acc * m.valeur, 1);

  const prodBaseFinale = base * (1 + somme("additif_base")) * produit("multiplicatif_base");
  const prodFinale =
    prodBaseFinale * (1 + somme("additif_final")) * produit("multiplicatif_final");

  return prodFinale;
}

// Collecte les modifiers actifs pour une cible donnée (type Pokémon / clic manuel / global)
// à partir des upgrades possédées.
export function modifiersPourCible(upgrades, upgradesPossedeesIds, cible) {
  return upgrades
    .filter((u) => upgradesPossedeesIds.includes(u.id))
    .filter((u) => cibleCorrespond(u.effet.cible, cible))
    .map((u) => ({ categorie: u.effet.categorie, valeur: u.effet.valeur }));
}

function cibleCorrespond(cibleUpgrade, cibleRecherchee) {
  if (cibleUpgrade.type === "global") return true;
  if (cibleUpgrade.type === "type_pokemon" && cibleRecherchee.type === "type_pokemon") {
    return cibleUpgrade.valeur === cibleRecherchee.valeur;
  }
  if (cibleUpgrade.type === "clic_manuel" && cibleRecherchee.type === "clic_manuel") {
    return true;
  }
  return false;
}
