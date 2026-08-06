import {
  productionPokemon,
  xpRequise,
  appliquerFacteurs,
  modifiersPourCible,
  conditionRemplie,
} from "./calculations.js";

const SAVE_KEY = "pokeloop_save_v1";
const OFFLINE_MAX_SECONDES = 8 * 3600; // plafond de rattrapage hors-ligne
const OFFLINE_SEUIL_SECONDES = 5; // en dessous, on ignore (simple changement d'onglet)

export class Game {
  constructor({ resources, pokemons, upgrades, recrutement, specialisation, types }) {
    this.data = {
      resources,
      pokemons,
      upgrades,
      recrutement: recrutement || [],
      specialisation,
      types: types || {},
    };
    this.gainsHorsLigne = null;
    this.state = this.chargerOuInitialiser();
  }

  chargerOuInitialiser() {
    const brut = localStorage.getItem(SAVE_KEY);
    if (brut) {
      try {
        const state = JSON.parse(brut);
        this.state = state;
        if (state.specialisation === undefined) state.specialisation = null;
        if (state.equipe.length > 0 && state.dernierTick) {
          const ecouleSec = Math.min(
            (Date.now() - state.dernierTick) / 1000,
            OFFLINE_MAX_SECONDES
          );
          if (ecouleSec > OFFLINE_SEUIL_SECONDES) {
            const gains = ecouleSec * this.productionParSeconde();
            state.pokedollars += gains;
            this.gainsHorsLigne = { montant: gains, secondes: ecouleSec };
          }
        }
        state.dernierTick = Date.now();
        return state;
      } catch {
        // save corrompue, on repart de zéro
      }
    }
    return {
      pokedollars: 0,
      equipe: [],
      upgradesPossedees: [],
      specialisation: null,
      dernierTick: Date.now(),
    };
  }

  starters() {
    return this.data.pokemons.filter((p) => p.starter);
  }

  aChoisiStarter() {
    return this.state.equipe.length > 0;
  }

  choisirStarter(pokemonId) {
    if (this.aChoisiStarter()) return false;
    const def = this.definitionPokemon(pokemonId);
    if (!def || !def.starter) return false;
    this.state.equipe.push({ id: def.id, niveau: def.niveau_depart, xp: 0 });
    return true;
  }

  sauvegarder() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  }

  prochainRecrutement() {
    const prochainEmplacement = this.state.equipe.length + 1;
    return this.data.recrutement.find((r) => r.emplacement === prochainEmplacement) || null;
  }

  recruterPokemon(pokemonId) {
    const palier = this.prochainRecrutement();
    if (!palier || !palier.choix.includes(pokemonId)) return false;
    if (this.state.pokedollars < palier.cout) return false;
    const def = this.definitionPokemon(pokemonId);
    this.state.pokedollars -= palier.cout;
    this.state.equipe.push({ id: def.id, niveau: def.niveau_depart, xp: 0 });
    return true;
  }

  definitionPokemon(id) {
    return this.data.pokemons.find((p) => p.id === id);
  }

  productionMembre(membre) {
    const def = this.definitionPokemon(membre.id);
    const base = productionPokemon(def, membre.niveau);
    const cibles = def.types.map((t) => ({ type: "type_pokemon", valeur: t }));
    const modifiers = cibles.flatMap((c) => [
      ...modifiersPourCible(this.toutesUpgrades(), this.state.upgradesPossedees, c),
      ...this.modifiersSpecialisationChoix(c),
    ]);
    return appliquerFacteurs(base, modifiers);
  }

  productionParSeconde() {
    return this.state.equipe.reduce((total, membre) => total + this.productionMembre(membre), 0);
  }

  productionClic() {
    const modifiers = modifiersPourCible(
      this.toutesUpgrades(),
      this.state.upgradesPossedees,
      { type: "clic_manuel" }
    );
    return appliquerFacteurs(1, modifiers);
  }

  // --- Spécialisation de type : choix unique et définitif pour la run (cf. docs) ---
  specialisationChoisie() {
    return Boolean(this.state.specialisation);
  }

  coutSpecialisation() {
    return this.data.specialisation.cout_deblocage;
  }

  choisirSpecialisation(typeId) {
    if (this.specialisationChoisie()) return false;
    const cout = this.coutSpecialisation();
    if (this.state.pokedollars < cout) return false;
    this.state.pokedollars -= cout;
    this.state.specialisation = typeId;
    return true;
  }

  // Bonus immédiat au choix (+100% final par défaut), appliqué automatiquement
  // tant qu'aucune upgrade "possédée" ne le représente.
  modifiersSpecialisationChoix(cible) {
    if (cible.type !== "type_pokemon") return [];
    if (!this.specialisationChoisie() || cible.valeur !== this.state.specialisation) return [];
    const { categorie, valeur } = this.data.specialisation.bonus_choix;
    return [{ categorie, valeur }];
  }

  // 3 upgrades liées au type choisi, générées à la volée depuis specialisation.json
  // (id `<type>_<id_suffix>`, tiers chaînés par prérequis) — une déclinaison par
  // type existe donc bien dans le jeu, mais sans dupliquer 18 fois la même donnée :
  // seul le type choisi pour la run produit ses 3 upgrades.
  upgradesSpecialisationGenerees() {
    if (!this.specialisationChoisie()) return [];
    const type = this.state.specialisation;
    const typeNom = (this.data.types[type] || {}).nom || type;
    const CHIFFRES_ROMAINS = ["I", "II", "III"];
    const ICONES = ["⭐", "🌟", "💫"];
    let prerequisPrecedent = [];
    return this.data.specialisation.upgrades_liees.map((tier, index) => {
      const id = `${type}_${tier.id_suffix}`;
      const chiffre = CHIFFRES_ROMAINS[index] || String(index + 1);
      const upgrade = {
        id,
        nom: `Spécialisation ${typeNom} ${chiffre}`,
        icone: ICONES[index] || "✨",
        description: `+${Math.round(tier.valeur * 100)}% production finale supplémentaire pour les Pokémon de type ${typeNom}`,
        cout: { ressource: "pokedollars", valeur: tier.cout },
        effet: {
          categorie: tier.categorie,
          cible: { type: "type_pokemon", valeur: type },
          valeur: tier.valeur,
        },
        prerequis: [...prerequisPrecedent],
        exclusif_avec: [],
      };
      prerequisPrecedent = [id];
      return upgrade;
    });
  }

  // Upgrades achetables : celles de la data + celles générées par la spécialisation.
  toutesUpgrades() {
    return [...this.data.upgrades, ...this.upgradesSpecialisationGenerees()];
  }

  tick() {
    this.state.pokedollars += this.productionParSeconde();
    this.state.dernierTick = Date.now();
  }

  clic() {
    this.state.pokedollars += this.productionClic();
  }

  peutInvestir(montant) {
    return montant > 0 && montant <= this.state.pokedollars;
  }

  investirXp(membreId, montant) {
    if (!this.peutInvestir(montant)) return;
    const membre = this.state.equipe.find((m) => m.id === membreId);
    const def = this.definitionPokemon(membreId);
    this.state.pokedollars -= montant;
    membre.xp += montant;

    let seuil = xpRequise(def, membre.niveau + 1);
    while (membre.niveau < 100 && membre.xp >= seuil) {
      membre.xp -= seuil;
      membre.niveau += 1;
      seuil = xpRequise(def, membre.niveau + 1);
    }
    if (membre.niveau >= 100) {
      membre.niveau = 100;
      membre.xp = 0;
    }
  }

  peutEvoluer(membre) {
    const def = this.definitionPokemon(membre.id);
    return Boolean(def.evolution) && membre.niveau >= def.evolution.niveau;
  }

  evoluerPokemon(membreId) {
    const membre = this.state.equipe.find((m) => m.id === membreId);
    if (!membre || !this.peutEvoluer(membre)) return false;
    const def = this.definitionPokemon(membre.id);
    membre.id = def.evolution.vers;
    return true;
  }

  variablesEtat() {
    return {
      equipe_taille: this.state.equipe.length,
      pokedollars: this.state.pokedollars,
    };
  }

  upgradeDisponible(upgrade) {
    if (this.state.upgradesPossedees.includes(upgrade.id)) return false;
    const prerequisOk = upgrade.prerequis.every((id) =>
      this.state.upgradesPossedees.includes(id)
    );
    const exclueParPossedee = upgrade.exclusif_avec.some((id) =>
      this.state.upgradesPossedees.includes(id)
    );
    const conditionOk = conditionRemplie(upgrade.condition_deblocage, this.variablesEtat());
    return prerequisOk && !exclueParPossedee && conditionOk;
  }

  acheterUpgrade(upgradeId) {
    const upgrade = this.toutesUpgrades().find((u) => u.id === upgradeId);
    if (!upgrade || !this.upgradeDisponible(upgrade)) return false;
    if (this.state.pokedollars < upgrade.cout.valeur) return false;
    this.state.pokedollars -= upgrade.cout.valeur;
    this.state.upgradesPossedees.push(upgrade.id);
    return true;
  }
}
