import { Game } from "./engine/game.js";
import { xpRequise } from "./engine/calculations.js";

async function chargerJson(chemin) {
  const reponse = await fetch(chemin);
  return reponse.json();
}

async function demarrer() {
  const [resources, pokemons, upgrades] = await Promise.all([
    chargerJson("src/data/resources.json"),
    chargerJson("src/data/pokemons.json"),
    chargerJson("src/data/upgrades.json"),
  ]);

  const game = new Game({ resources, pokemons, upgrades });

  const el = {
    pokedollars: document.getElementById("pokedollars-valeur"),
    prodInfo: document.getElementById("prod-info"),
    pokemonTap: document.getElementById("pokemon-tap"),
    pokemonNom: document.getElementById("pokemon-nom"),
    pokemonNiveau: document.getElementById("pokemon-niveau"),
    xpRemplissage: document.getElementById("xp-remplissage"),
    xpTexte: document.getElementById("xp-texte"),
    btnInvestir10: document.getElementById("btn-investir-10"),
    btnInvestirTout: document.getElementById("btn-investir-tout"),
    shopListe: document.getElementById("shop-liste"),
    possedeesListe: document.getElementById("possedees-liste"),
  };

  const formatNombre = (n) => Math.floor(n).toLocaleString("fr-FR");
  let idsBoutiqueAffiches = null;

  // Valeurs qui changent chaque tick (ressource, prod, xp) : mise à jour légère, sans recréer le DOM.
  function actualiserValeurs() {
    const membre = game.state.equipe[0];
    const def = game.definitionPokemon(membre.id);

    el.pokedollars.textContent = formatNombre(game.state.pokedollars);
    el.prodInfo.textContent = `${formatNombre(game.productionParSeconde())} /s`;
    el.pokemonNom.textContent = def.nom;
    el.pokemonNiveau.textContent = membre.niveau;

    if (membre.niveau >= 100) {
      el.xpRemplissage.style.width = "100%";
      el.xpTexte.textContent = "Niveau max";
    } else {
      const seuil = xpRequise(def, membre.niveau + 1);
      el.xpRemplissage.style.width = `${Math.min(100, (membre.xp / seuil) * 100)}%`;
      el.xpTexte.textContent = `${formatNombre(membre.xp)} / ${formatNombre(seuil)} XP`;
    }

    // Boutique : seulement (dés)activer les boutons déjà présents selon les moyens du joueur.
    el.shopListe.querySelectorAll(".shop-item").forEach((li) => {
      const cout = Number(li.dataset.cout);
      li.querySelector("button").disabled = game.state.pokedollars < cout;
    });
  }

  // Recompose la liste (upgrades débloquées/achetées) : uniquement quand ça change réellement.
  function reconstruireBoutiqueSiNecessaire() {
    const disponibles = game.data.upgrades.filter((u) => game.upgradeDisponible(u));
    const idsActuels = disponibles.map((u) => u.id).join(",");
    if (idsActuels === idsBoutiqueAffiches) return;
    idsBoutiqueAffiches = idsActuels;

    el.shopListe.innerHTML = "";
    if (disponibles.length === 0) {
      el.shopListe.innerHTML = '<li class="vide">Rien à acheter pour le moment.</li>';
    }
    for (const upgrade of disponibles) {
      const li = document.createElement("li");
      li.className = "shop-item";
      li.dataset.cout = upgrade.cout.valeur;
      const abordable = game.state.pokedollars >= upgrade.cout.valeur;
      li.innerHTML = `
        <div class="shop-item-titre">${upgrade.nom}</div>
        <div class="shop-item-desc">${upgrade.description}</div>
        <div class="shop-item-footer">
          <span class="shop-item-cout">${formatNombre(upgrade.cout.valeur)} 💰</span>
          <button class="btn btn-acheter" ${abordable ? "" : "disabled"}>Acheter</button>
        </div>
      `;
      li.querySelector("button").addEventListener("click", () => {
        game.acheterUpgrade(upgrade.id);
        reconstruireBoutiqueSiNecessaire();
        reconstruirePossedees();
        actualiserValeurs();
      });
      el.shopListe.appendChild(li);
    }
  }

  function reconstruirePossedees() {
    el.possedeesListe.innerHTML = "";
    if (game.state.upgradesPossedees.length === 0) {
      el.possedeesListe.innerHTML = '<li class="vide">Aucune upgrade possédée.</li>';
    }
    for (const id of game.state.upgradesPossedees) {
      const upgrade = game.data.upgrades.find((u) => u.id === id);
      const li = document.createElement("li");
      li.className = "possedee-item";
      li.textContent = upgrade.nom;
      el.possedeesListe.appendChild(li);
    }
  }

  function rafraichirAffichage() {
    actualiserValeurs();
    reconstruireBoutiqueSiNecessaire();
  }

  el.pokemonTap.addEventListener("click", () => {
    game.clic();
    rafraichirAffichage();
  });

  el.btnInvestir10.addEventListener("click", () => {
    game.investirXp(game.state.equipe[0].id, 10);
    rafraichirAffichage();
  });

  el.btnInvestirTout.addEventListener("click", () => {
    game.investirXp(game.state.equipe[0].id, Math.floor(game.state.pokedollars));
    rafraichirAffichage();
  });

  setInterval(() => {
    game.tick();
    rafraichirAffichage();
  }, 1000);

  setInterval(() => game.sauvegarder(), 5000);
  window.addEventListener("beforeunload", () => game.sauvegarder());

  reconstruirePossedees();
  rafraichirAffichage();
}

demarrer();
