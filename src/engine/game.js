import {
  productionPokemon,
  xpRequise,
  xpRestantPourNiveau100,
  appliquerFacteurs,
  modifiersPourCible,
  conditionRemplie,
} from "./calculations.js";

const SAVE_KEY = "pokeloop_save_v1";
const OFFLINE_MAX_SECONDES = 8 * 3600; // plafond de rattrapage hors-ligne
const OFFLINE_SEUIL_SECONDES = 5; // en dessous, on ignore (simple changement d'onglet)
const BONUS_POKEDEX_PAR_DECOUVERTE = 0.1; // +10% multiplicatif final par Pokémon découvert (cf. pokedex.md)

export class Game {
  constructor({ resources, pokemons, upgrades, recrutement, specialisation, paliersPokemon }) {
    this.data = {
      resources,
      pokemons,
      upgrades,
      recrutement: recrutement || [],
      specialisation,
      paliersPokemon,
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
        // Migration : les sauvegardes antérieures aux paliers de niveau (6ter) n'ont pas
        // de champ espece_ligne — à défaut de l'historique d'évolution, l'espèce actuelle
        // est la meilleure approximation disponible (correcte pour tout membre pas encore évolué).
        for (const membre of state.equipe) {
          if (!membre.espece_ligne) membre.espece_ligne = membre.id;
        }
        // Migration : les sauvegardes antérieures au Pokédex (6quater) n'ont pas de champ
        // pokedex_decouverts — on le reconstruit à partir de l'équipe actuelle (espece_ligne,
        // l'espèce réellement recrutée) pour ne pas faire perdre leur découverte aux joueurs.
        if (!state.pokedex_decouverts) {
          state.pokedex_decouverts = [...new Set(state.equipe.map((m) => m.espece_ligne))];
        }
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
      pokedex_decouverts: [],
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
    this.state.equipe.push({ id: def.id, espece_ligne: def.id, niveau: def.niveau_depart, xp: 0 });
    this.decouvrirPokemon(def.id);
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
    this.state.equipe.push({ id: def.id, espece_ligne: def.id, niveau: def.niveau_depart, xp: 0 });
    this.decouvrirPokemon(def.id);
    return true;
  }

  definitionPokemon(id) {
    return this.data.pokemons.find((p) => p.id === id);
  }

  productionMembre(membre) {
    const def = this.definitionPokemon(membre.id);
    const base = productionPokemon(def, membre.niveau);
    // Modifiers globaux : récupérés une seule fois, indépendamment du nombre de
    // types du Pokémon. cibleCorrespond fait matcher "global" sans condition sur
    // cibleRecherchee (utile pour productionClic, qui interroge en un seul appel) —
    // il ne faut donc PAS rappeler modifiersPourCible(this.data.upgrades, ...) une
    // fois par type sous peine de compter les upgrades globales en double pour un
    // Pokémon bi-type (ex : Crustabri Eau/Glace toucherait 2x global_1/2/3).
    const modifiersGlobaux = modifiersPourCible(this.data.upgrades, this.state.upgradesPossedees, {
      type: "global",
    });
    const upgradesParType = this.data.upgrades.filter((u) => u.effet.cible.type === "type_pokemon");
    const cibles = def.types.map((t) => ({ type: "type_pokemon", valeur: t }));
    const modifiers = [
      ...modifiersGlobaux,
      ...cibles.flatMap((c) => [
        ...modifiersPourCible(upgradesParType, this.state.upgradesPossedees, c),
        ...this.modifiersSpecialisationChoix(c),
      ]),
    ];
    const cibleEspece = { type: "pokemon_id", valeur: membre.espece_ligne };
    modifiers.push(
      ...modifiersPourCible(
        this.paliersPourEspece(membre.espece_ligne),
        this.state.upgradesPossedees,
        cibleEspece
      )
    );
    modifiers.push(this.modifierPokedex());
    return appliquerFacteurs(base, modifiers);
  }

  productionParSeconde() {
    return this.state.equipe.reduce((total, membre) => total + this.productionMembre(membre), 0);
  }

  productionClic() {
    const modifiers = modifiersPourCible(
      this.data.upgrades,
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

  // Applique un gain d'XP déjà payé : montée(s) de niveau en cascade, cap à 100.
  appliquerGainXp(membre, def, montant) {
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

  // Investit jusqu'à `montantDemande` d'XP sur un Pokémon : plafonné à ce qu'il
  // faut pour atteindre pile le niveau 100 (jamais de surplus payé pour rien).
  // Le cas "plafonné" force directement niveau 100/xp 0 plutôt que de compter
  // sur la boucle de montée en niveau pour retomber pile sur zéro en flottant
  // (une longue chaîne d'additions/soustractions peut dériver de quelques
  // 1e-11 et laisser le Pokémon bloqué juste sous le seuil).
  investirXp(membreId, montantDemande) {
    const membre = this.state.equipe.find((m) => m.id === membreId);
    const def = this.definitionPokemon(membreId);
    const xpRestant = xpRestantPourNiveau100(def, membre.niveau, membre.xp);
    const atteintNiveau100 = montantDemande >= xpRestant;
    const montant = atteintNiveau100 ? xpRestant : montantDemande;
    if (!this.peutInvestir(montant)) return false;
    this.state.pokedollars -= montant;
    if (atteintNiveau100) {
      membre.niveau = 100;
      membre.xp = 0;
    } else {
      this.appliquerGainXp(membre, def, montant);
    }
    return true;
  }

  // XP exactement nécessaire pour finir le niveau en cours et passer au suivant.
  xpPourProchainNiveau(membre) {
    if (membre.niveau >= 100) return 0;
    const def = this.definitionPokemon(membre.id);
    return Math.max(0, xpRequise(def, membre.niveau + 1) - membre.xp);
  }

  investirNiveauSuivant(membreId) {
    const membre = this.state.equipe.find((m) => m.id === membreId);
    const cout = this.xpPourProchainNiveau(membre);
    if (cout <= 0 || this.state.pokedollars < cout) return false;
    const def = this.definitionPokemon(membreId);
    this.state.pokedollars -= cout;
    this.appliquerGainXp(membre, def, cout);
    return true;
  }

  // Investit `montantDemande` d'XP (chacun plafonné au niveau 100) sur TOUTE
  // l'équipe d'un coup, de façon atomique : soit tout le monde reçoit son
  // gain (si le coût total est finançable), soit rien ne se passe.
  investirXpEquipe(montantDemande) {
    const plan = this.state.equipe.map((membre) => {
      const def = this.definitionPokemon(membre.id);
      const xpRestant = xpRestantPourNiveau100(def, membre.niveau, membre.xp);
      const atteintNiveau100 = montantDemande >= xpRestant;
      const montant = atteintNiveau100 ? xpRestant : Math.max(0, montantDemande);
      return { membre, def, montant, atteintNiveau100 };
    });
    const total = plan.reduce((acc, p) => acc + p.montant, 0);
    if (total <= 0 || total > this.state.pokedollars) return false;
    this.state.pokedollars -= total;
    for (const { membre, def, montant, atteintNiveau100 } of plan) {
      if (montant <= 0) continue;
      if (atteintNiveau100) {
        membre.niveau = 100;
        membre.xp = 0;
      } else {
        this.appliquerGainXp(membre, def, montant);
      }
    }
    return true;
  }

  // Bouton ALL en mode "MAX" : répartit tous les Pokédollars possédés à parts
  // égales entre les membres de l'équipe (pas d'exigence de tous les monter à
  // 100 comme investirXpEquipe) — chaque part est plafonnée individuellement
  // au niveau 100, donc un surplus (reste de la division, ou parts non
  // utilisées par un Pokémon déjà proche de 100) reste normalement non dépensé.
  investirXpEquipeMax() {
    if (this.state.equipe.length === 0) return false;
    const montantParMembre = Math.floor(this.state.pokedollars / this.state.equipe.length);
    if (montantParMembre <= 0) return false;
    let depenseTotale = 0;
    for (const membre of this.state.equipe) {
      const def = this.definitionPokemon(membre.id);
      const xpRestant = xpRestantPourNiveau100(def, membre.niveau, membre.xp);
      const atteintNiveau100 = montantParMembre >= xpRestant;
      const montant = atteintNiveau100 ? xpRestant : montantParMembre;
      if (montant <= 0) continue;
      depenseTotale += montant;
      if (atteintNiveau100) {
        membre.niveau = 100;
        membre.xp = 0;
      } else {
        this.appliquerGainXp(membre, def, montant);
      }
    }
    if (depenseTotale <= 0) return false;
    this.state.pokedollars -= depenseTotale;
    return true;
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
    this.decouvrirPokemon(membre.id);
    return true;
  }

  // --- Pokédex (cf. docs/pokedex.md) : découverte persistante hors run, bonus global
  // permanent et cumulatif, consultation de tous les Pokémon (151) même non découverts. ---

  estDecouvert(pokemonId) {
    return this.state.pokedex_decouverts.includes(pokemonId);
  }

  decouvrirPokemon(pokemonId) {
    if (this.estDecouvert(pokemonId)) return;
    this.state.pokedex_decouverts.push(pokemonId);
  }

  // +10% de production finale par Pokémon découvert, calculé en une seule fois (somme
  // simple des %) puis appliqué comme un seul facteur multiplicatif — jamais composé
  // pokémon par pokémon (ce qui donnerait 1.1^n) ni sommé dans les additifs finaux.
  multiplicateurPokedex() {
    return 1 + BONUS_POKEDEX_PAR_DECOUVERTE * this.state.pokedex_decouverts.length;
  }

  modifierPokedex() {
    return { categorie: "multiplicatif_final", valeur: this.multiplicateurPokedex() };
  }

  // Reconstruit la chaîne évolutive complète d'une espèce (du premier au dernier palier)
  // en remontant/descendant les liens evolution.vers déjà présents dans pokemons.json —
  // aucun nouveau champ de chaînage nécessaire. Chaque étape porte le niveau requis pour
  // y accéder depuis l'étape précédente (null pour la toute première étape de la chaîne).
  ligneeComplete(pokemonId) {
    let racine = this.definitionPokemon(pokemonId);
    let predecesseur = this.data.pokemons.find((p) => p.evolution && p.evolution.vers === racine.id);
    while (predecesseur) {
      racine = predecesseur;
      predecesseur = this.data.pokemons.find((p) => p.evolution && p.evolution.vers === racine.id);
    }
    const chaine = [{ def: racine, niveauRequis: null }];
    let courant = racine;
    while (courant.evolution) {
      const suivant = this.definitionPokemon(courant.evolution.vers);
      chaine.push({ def: suivant, niveauRequis: courant.evolution.niveau });
      courant = suivant;
    }
    return chaine;
  }

  // --- Paliers de niveau par Pokémon (cf. docs/paliers_pokemon.md) : 10 upgrades
  // instanciées dynamiquement par lignée évolutive (espece_ligne), pas en dur en data. ---

  // Instancie le template des 10 paliers pour une lignée donnée. Ciblage sur
  // espece_ligne (jamais espece_actuelle/membre.id) : reste actif après évolution.
  paliersPourEspece(especeLigne) {
    const def = this.definitionPokemon(especeLigne);
    return this.data.paliersPokemon.paliers.map((p) => ({
      id: `${especeLigne}_${p.id_suffix}`,
      nom: `Palier ${p.tier_romain} — ${def.nom}`,
      tier_romain: p.tier_romain,
      niveau_requis: p.niveau_requis,
      valeur: p.valeur,
      cout: { ressource: "pokedollars", valeur: p.cout },
      spriteDossier: def.sprite_dossier,
      effet: {
        categorie: "additif_final",
        cible: { type: "pokemon_id", valeur: especeLigne },
        valeur: p.valeur,
      },
    }));
  }

  // Somme des valeurs de tous les paliers jusqu'à (et y compris) celui donné,
  // pour l'affichage de la valeur cumulée dans la popup de description.
  valeurCumuleePalier(especeLigne, palierId) {
    const paliers = this.paliersPourEspece(especeLigne);
    const index = paliers.findIndex((p) => p.id === palierId);
    return paliers.slice(0, index + 1).reduce((acc, p) => acc + p.valeur, 0);
  }

  // Le prochain palier achetable pour ce membre : le plus bas tier non encore
  // acheté dont le niveau requis est atteint (garantit un achat toujours dans
  // l'ordre, sans dépendre d'un système de prérequis séparé). null si aucun
  // (niveau < 10, ou les 10 tiers déjà achetés).
  prochainPalier(membre) {
    const paliers = this.paliersPourEspece(membre.espece_ligne);
    return (
      paliers.find(
        (p) => membre.niveau >= p.niveau_requis && !this.state.upgradesPossedees.includes(p.id)
      ) || null
    );
  }

  acheterPalier(membreId) {
    const membre = this.state.equipe.find((m) => m.id === membreId);
    if (!membre) return false;
    const palier = this.prochainPalier(membre);
    if (!palier || this.state.pokedollars < palier.cout.valeur) return false;
    this.state.pokedollars -= palier.cout.valeur;
    this.state.upgradesPossedees.push(palier.id);
    return true;
  }

  // Paliers instanciés pour toutes les lignées actuellement en équipe — sert à
  // retrouver l'objet complet d'un palier déjà acheté (affichage "Possédées").
  toutesLesUpgradesPaliers() {
    const especesLigne = [...new Set(this.state.equipe.map((m) => m.espece_ligne))];
    return especesLigne.flatMap((e) => this.paliersPourEspece(e));
  }

  variablesEtat() {
    return {
      equipe_taille: this.state.equipe.length,
      pokedollars: this.state.pokedollars,
      specialisation: this.state.specialisation,
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
    const upgrade = this.data.upgrades.find((u) => u.id === upgradeId);
    if (!upgrade || !this.upgradeDisponible(upgrade)) return false;
    if (this.state.pokedollars < upgrade.cout.valeur) return false;
    this.state.pokedollars -= upgrade.cout.valeur;
    this.state.upgradesPossedees.push(upgrade.id);
    return true;
  }

  // Bouton "BUY ALL" de la boutique : achète en boucle la moins chère des
  // upgrades/paliers actuellement abordables, jusqu'à épuisement des fonds ou
  // du contenu disponible. Réévalue la liste à chaque achat pour capter les
  // déblocages en cascade (ex : global_1 -> global_2) et le tier suivant de
  // chaque Pokémon. N'inclut pas la spécialisation de type (nécessite un choix
  // de type, pas un simple achat) — cohérent avec la case dédiée du shop.
  acheterToutDisponible() {
    let nbAchats = 0;
    for (;;) {
      const candidatsUpgrades = this.data.upgrades
        .filter((u) => this.upgradeDisponible(u))
        .map((u) => ({ cout: u.cout.valeur, acheter: () => this.acheterUpgrade(u.id) }));
      const candidatsPaliers = this.state.equipe
        .map((membre) => ({ membre, palier: this.prochainPalier(membre) }))
        .filter((c) => c.palier)
        .map(({ membre, palier }) => ({
          cout: palier.cout.valeur,
          acheter: () => this.acheterPalier(membre.id),
        }));
      const abordables = [...candidatsUpgrades, ...candidatsPaliers].filter(
        (c) => c.cout <= this.state.pokedollars
      );
      if (abordables.length === 0) break;
      abordables.sort((a, b) => a.cout - b.cout);
      abordables[0].acheter();
      nbAchats += 1;
    }
    return nbAchats;
  }
}
