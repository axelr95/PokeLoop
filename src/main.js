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
    zoneJeu: document.getElementById("zone-jeu"),
    equipe: document.getElementById("equipe"),
    btnInvestir10: document.getElementById("btn-investir-10"),
    btnInvestirTout: document.getElementById("btn-investir-tout"),
    shopListe: document.getElementById("shop-liste"),
    possedeesListe: document.getElementById("possedees-liste"),
    popupBackdrop: document.getElementById("popup-backdrop"),
    popup: document.getElementById("popup-upgrade"),
    popupTitre: document.getElementById("popup-titre"),
    popupDescription: document.getElementById("popup-description"),
    popupFooter: document.getElementById("popup-footer"),
  };

  const formatNombre = (n) => Math.floor(n).toLocaleString("fr-FR");
  let idsBoutiqueAffiches = null;
  let idsPossedeesAffiches = null;

  // --- Feedback flottant "+X" ---
  function afficherFloater(texte, xRelatif, yRelatif) {
    const floater = document.createElement("div");
    floater.className = "floater";
    floater.textContent = texte;
    floater.style.left = `${xRelatif}px`;
    floater.style.top = `${yRelatif}px`;
    el.zoneJeu.appendChild(floater);
    floater.addEventListener("animationend", () => floater.remove());
    setTimeout(() => floater.remove(), 900); // filet de sécurité si l'animation ne se déclenche pas (onglet en arrière-plan)
  }

  function floaterDepuisEvenement(evt, texte) {
    const rect = el.zoneJeu.getBoundingClientRect();
    afficherFloater(texte, evt.clientX - rect.left, evt.clientY - rect.top);
  }

  function floaterDepuisCarte(carteEl, texte) {
    const rectZone = el.zoneJeu.getBoundingClientRect();
    const rectCarte = carteEl.getBoundingClientRect();
    afficherFloater(
      texte,
      rectCarte.left - rectZone.left + rectCarte.width / 2,
      rectCarte.top - rectZone.top
    );
  }

  // --- Rendu équipe (petits encarts, jusqu'à 6 emplacements plus tard) ---
  function construireEquipe() {
    el.equipe.innerHTML = "";
    for (const membre of game.state.equipe) {
      const carte = document.createElement("div");
      carte.className = "carte-pokemon";
      carte.dataset.membreId = membre.id;
      carte.innerHTML = `
        <span class="cp-sprite">🔥</span>
        <span class="cp-niveau">Nv ${membre.niveau}</span>
        <div class="cp-xp"><div class="cp-xp-remplissage"></div></div>
      `;
      el.equipe.appendChild(carte);
    }
  }

  function actualiserEquipe() {
    for (const membre of game.state.equipe) {
      const def = game.definitionPokemon(membre.id);
      const carte = el.equipe.querySelector(`[data-membre-id="${membre.id}"]`);
      if (!carte) continue;
      carte.querySelector(".cp-niveau").textContent = `Nv ${membre.niveau}`;
      const barre = carte.querySelector(".cp-xp-remplissage");
      if (membre.niveau >= 100) {
        barre.style.width = "100%";
      } else {
        const seuil = xpRequise(def, membre.niveau + 1);
        barre.style.width = `${Math.min(100, (membre.xp / seuil) * 100)}%`;
      }
    }
  }

  // --- Valeurs qui changent chaque tick : mise à jour légère, sans recréer le DOM ---
  function actualiserValeurs() {
    el.pokedollars.textContent = formatNombre(game.state.pokedollars);
    el.prodInfo.textContent = `${formatNombre(game.productionParSeconde())} /s`;
    actualiserEquipe();

    el.shopListe.querySelectorAll(".icone-item").forEach((btn) => {
      const cout = Number(btn.dataset.cout);
      btn.classList.toggle("non-abordable", game.state.pokedollars < cout);
    });
  }

  // --- Popup de description (boutique / possédées) ---
  function fermerPopup() {
    el.popup.hidden = true;
    el.popupBackdrop.hidden = true;
  }

  function ouvrirPopupUpgrade(upgrade, ancreEl, { achetable }) {
    el.popupTitre.textContent = upgrade.nom;
    el.popupDescription.textContent = upgrade.description;

    if (achetable) {
      const abordable = game.state.pokedollars >= upgrade.cout.valeur;
      el.popupFooter.innerHTML = `
        <span class="popup-cout">${formatNombre(upgrade.cout.valeur)} 💰</span>
        <button class="btn-acheter" ${abordable ? "" : "disabled"}>Acheter</button>
      `;
      el.popupFooter.querySelector("button").addEventListener("click", () => {
        game.acheterUpgrade(upgrade.id);
        fermerPopup();
        reconstruireBoutiqueSiNecessaire();
        reconstruirePossedeesSiNecessaire();
        actualiserValeurs();
      });
    } else {
      el.popupFooter.innerHTML = "";
    }

    el.popup.hidden = false;
    el.popupBackdrop.hidden = false;

    const rect = ancreEl.getBoundingClientRect();
    el.popup.style.left = `${Math.min(
      Math.max(rect.left + rect.width / 2, 118),
      window.innerWidth - 118
    )}px`;
    el.popup.style.top = `${rect.top - 8}px`;
    el.popup.style.transform = "translate(-50%, -100%)";

    // Si ça dépasse en haut de l'écran, on l'affiche plutôt en dessous.
    requestAnimationFrame(() => {
      const popRect = el.popup.getBoundingClientRect();
      if (popRect.top < 4) {
        el.popup.style.top = `${rect.bottom + 8}px`;
        el.popup.style.transform = "translate(-50%, 0)";
      }
    });
  }

  el.popupBackdrop.addEventListener("click", fermerPopup);

  // --- Boutique / possédées : icônes carrées, popup au clic ---
  function reconstruireBoutiqueSiNecessaire() {
    const disponibles = game.data.upgrades.filter((u) => game.upgradeDisponible(u));
    const idsActuels = disponibles.map((u) => u.id).join(",");
    if (idsActuels === idsBoutiqueAffiches) return;
    idsBoutiqueAffiches = idsActuels;

    el.shopListe.innerHTML = "";
    if (disponibles.length === 0) {
      el.shopListe.innerHTML = '<div class="vide">Rien à acheter.</div>';
    }
    for (const upgrade of disponibles) {
      const btn = document.createElement("button");
      btn.className = "icone-item";
      btn.dataset.cout = upgrade.cout.valeur;
      btn.textContent = upgrade.icone;
      const abordable = game.state.pokedollars >= upgrade.cout.valeur;
      btn.classList.toggle("non-abordable", !abordable);
      btn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        ouvrirPopupUpgrade(upgrade, btn, { achetable: true });
      });
      el.shopListe.appendChild(btn);
    }
  }

  function reconstruirePossedeesSiNecessaire() {
    const ids = game.state.upgradesPossedees.join(",");
    if (ids === idsPossedeesAffiches) return;
    idsPossedeesAffiches = ids;

    el.possedeesListe.innerHTML = "";
    if (game.state.upgradesPossedees.length === 0) {
      el.possedeesListe.innerHTML = '<div class="vide">Aucune.</div>';
    }
    for (const id of game.state.upgradesPossedees) {
      const upgrade = game.data.upgrades.find((u) => u.id === id);
      const btn = document.createElement("button");
      btn.className = "icone-item possedee";
      btn.textContent = upgrade.icone;
      btn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        ouvrirPopupUpgrade(upgrade, btn, { achetable: false });
      });
      el.possedeesListe.appendChild(btn);
    }
  }

  function rafraichirAffichage() {
    actualiserValeurs();
    reconstruireBoutiqueSiNecessaire();
  }

  // --- Clic manuel : partout dans la zone de jeu (équipe incluse), pas dans la boutique ---
  el.zoneJeu.addEventListener("click", (evt) => {
    game.clic();
    floaterDepuisEvenement(evt, `+${formatNombre(game.productionClic())} 💰`);
    actualiserValeurs();
  });

  el.btnInvestir10.addEventListener("click", (evt) => {
    evt.stopPropagation();
    game.investirXp(game.state.equipe[0].id, 10);
    actualiserValeurs();
  });

  el.btnInvestirTout.addEventListener("click", (evt) => {
    evt.stopPropagation();
    game.investirXp(game.state.equipe[0].id, Math.floor(game.state.pokedollars));
    actualiserValeurs();
  });

  setInterval(() => {
    game.tick();
    for (const membre of game.state.equipe) {
      const carte = el.equipe.querySelector(`[data-membre-id="${membre.id}"]`);
      const prod = game.productionMembre(membre);
      if (carte && prod >= 1) floaterDepuisCarte(carte, `+${formatNombre(prod)} 💰`);
    }
    actualiserValeurs();
  }, 1000);

  setInterval(() => game.sauvegarder(), 5000);
  window.addEventListener("beforeunload", () => game.sauvegarder());

  construireEquipe();
  reconstruirePossedeesSiNecessaire();
  rafraichirAffichage();
}

demarrer();
