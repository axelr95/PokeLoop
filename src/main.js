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
    zoneDecor: document.getElementById("zone-decor"),
    decorEquipe: document.getElementById("decor-equipe"),
    panelTitre: document.getElementById("panel-titre"),
    panelPokemon: document.getElementById("panel-pokemon"),
    panelBoutique: document.getElementById("panel-boutique"),
    listePokemon: document.getElementById("liste-pokemon"),
    shopListe: document.getElementById("shop-liste"),
    possedeesListe: document.getElementById("possedees-liste"),
    tabsBtns: document.querySelectorAll(".tab-btn"),
    popupBackdrop: document.getElementById("popup-backdrop"),
    popup: document.getElementById("popup-upgrade"),
    popupTitre: document.getElementById("popup-titre"),
    popupDescription: document.getElementById("popup-description"),
    popupFooter: document.getElementById("popup-footer"),
  };

  const formatNombre = (n) => Math.floor(n).toLocaleString("fr-FR");
  const TITRES_ONGLETS = { pokemon: "Pokémon", boutique: "Boutique" };
  let idsBoutiqueAffiches = null;
  let idsPossedeesAffiches = null;

  // --- Feedback flottant "+X", ancré dans la zone décorative (seule zone cliquable) ---
  function afficherFloater(texte, xRelatif, yRelatif) {
    const floater = document.createElement("div");
    floater.className = "floater";
    floater.textContent = texte;
    floater.style.left = `${xRelatif}px`;
    floater.style.top = `${yRelatif}px`;
    el.zoneDecor.appendChild(floater);
    floater.addEventListener("animationend", () => floater.remove());
    setTimeout(() => floater.remove(), 900); // filet de sécurité si l'animation ne se déclenche pas (onglet en arrière-plan)
  }

  function floaterDepuisEvenement(evt, texte) {
    const rect = el.zoneDecor.getBoundingClientRect();
    afficherFloater(texte, evt.clientX - rect.left, evt.clientY - rect.top);
  }

  function floaterDepuisSprite(spriteEl, texte) {
    const rectZone = el.zoneDecor.getBoundingClientRect();
    const rectSprite = spriteEl.getBoundingClientRect();
    afficherFloater(
      texte,
      rectSprite.left - rectZone.left + rectSprite.width / 2,
      rectSprite.top - rectZone.top
    );
  }

  // --- Zone décorative : sprites des Pokémon (jusqu'à 6 plus tard), purement visuel ---
  function construireDecorEquipe() {
    el.decorEquipe.innerHTML = "";
    for (const membre of game.state.equipe) {
      const sprite = document.createElement("span");
      sprite.className = "decor-sprite";
      sprite.dataset.membreId = membre.id;
      sprite.textContent = "🔥";
      el.decorEquipe.appendChild(sprite);
    }
  }

  // --- Panel "Pokémon" : niveau, XP / XP max et investissement propres à chaque Pokémon ---
  function construireListePokemon() {
    el.listePokemon.innerHTML = "";
    for (const membre of game.state.equipe) {
      const ligne = document.createElement("div");
      ligne.className = "ligne-pokemon";
      ligne.dataset.membreId = membre.id;
      ligne.innerHTML = `
        <span class="lp-sprite">🔥</span>
        <div class="lp-stats">
          <div class="lp-nom-niveau">
            <span class="lp-nom"></span>
            <span class="lp-niveau"></span>
          </div>
          <div class="lp-xp"><div class="lp-xp-remplissage"></div></div>
          <div class="lp-xp-texte"></div>
        </div>
        <div class="lp-actions">
          <button class="btn-invest" data-action="10">Investir 10</button>
          <button class="btn-invest" data-action="tout">Tout investir</button>
        </div>
      `;
      const def = game.definitionPokemon(membre.id);
      ligne.querySelector(".lp-nom").textContent = def.nom;

      ligne.querySelector('[data-action="10"]').addEventListener("click", (evt) => {
        evt.stopPropagation();
        game.investirXp(membre.id, 10);
        actualiserValeurs();
      });
      ligne.querySelector('[data-action="tout"]').addEventListener("click", (evt) => {
        evt.stopPropagation();
        game.investirXp(membre.id, Math.floor(game.state.pokedollars));
        actualiserValeurs();
      });

      el.listePokemon.appendChild(ligne);
    }
  }

  function actualiserListePokemon() {
    for (const membre of game.state.equipe) {
      const def = game.definitionPokemon(membre.id);
      const ligne = el.listePokemon.querySelector(`[data-membre-id="${membre.id}"]`);
      if (!ligne) continue;
      ligne.querySelector(".lp-niveau").textContent = `Nv ${membre.niveau}`;
      const barre = ligne.querySelector(".lp-xp-remplissage");
      const texte = ligne.querySelector(".lp-xp-texte");
      if (membre.niveau >= 100) {
        barre.style.width = "100%";
        texte.textContent = "Niveau max";
      } else {
        const seuil = xpRequise(def, membre.niveau + 1);
        barre.style.width = `${Math.min(100, (membre.xp / seuil) * 100)}%`;
        texte.textContent = `${formatNombre(membre.xp)} / ${formatNombre(seuil)} XP`;
      }
    }
  }

  // --- Valeurs qui changent chaque tick : mise à jour légère, sans recréer le DOM ---
  function actualiserValeurs() {
    el.pokedollars.textContent = formatNombre(game.state.pokedollars);
    el.prodInfo.textContent = `${formatNombre(game.productionParSeconde())} /s`;
    actualiserListePokemon();

    el.shopListe.querySelectorAll(".icone-item").forEach((btn) => {
      const cout = Number(btn.dataset.cout);
      btn.classList.toggle("non-abordable", game.state.pokedollars < cout);
    });
  }

  // --- Onglets du bas : change le panel affiché ---
  function activerOnglet(nom) {
    el.panelPokemon.hidden = nom !== "pokemon";
    el.panelBoutique.hidden = nom !== "boutique";
    el.panelTitre.textContent = TITRES_ONGLETS[nom];
    el.tabsBtns.forEach((btn) => btn.classList.toggle("actif", btn.dataset.tab === nom));
  }

  el.tabsBtns.forEach((btn) => {
    btn.addEventListener("click", () => activerOnglet(btn.dataset.tab));
  });

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

  // --- Clic manuel : uniquement dans la zone décorative ---
  el.zoneDecor.addEventListener("click", (evt) => {
    game.clic();
    floaterDepuisEvenement(evt, `+${formatNombre(game.productionClic())} 💰`);
    actualiserValeurs();
  });

  setInterval(() => {
    game.tick();
    for (const membre of game.state.equipe) {
      const sprite = el.decorEquipe.querySelector(`[data-membre-id="${membre.id}"]`);
      const prod = game.productionMembre(membre);
      if (sprite && prod >= 1) floaterDepuisSprite(sprite, `+${formatNombre(prod)} 💰`);
    }
    actualiserValeurs();
  }, 1000);

  setInterval(() => game.sauvegarder(), 5000);
  window.addEventListener("beforeunload", () => game.sauvegarder());

  construireDecorEquipe();
  construireListePokemon();
  reconstruirePossedeesSiNecessaire();
  rafraichirAffichage();
}

demarrer();
