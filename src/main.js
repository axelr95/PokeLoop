import { Game } from "./engine/game.js";
import { xpRequise } from "./engine/calculations.js";

async function chargerJson(chemin) {
  const reponse = await fetch(chemin);
  return reponse.json();
}

const metaSpriteCache = new Map();
async function obtenirMetaSprite(def) {
  if (metaSpriteCache.has(def.id)) return metaSpriteCache.get(def.id);
  const promesse = chargerJson(`${def.sprite_dossier}meta.json`).catch(() => null);
  metaSpriteCache.set(def.id, promesse);
  return promesse;
}

async function demarrer() {
  const [resources, pokemons, upgrades, types, recrutement] = await Promise.all([
    chargerJson("src/data/resources.json"),
    chargerJson("src/data/pokemons.json"),
    chargerJson("src/data/upgrades.json"),
    chargerJson("src/data/types.json"),
    chargerJson("src/data/recrutement.json"),
  ]);

  const game = new Game({ resources, pokemons, upgrades, recrutement });

  const el = {
    pokedollars: document.getElementById("pokedollars-valeur"),
    prodInfo: document.getElementById("prod-info"),
    zoneDecor: document.getElementById("zone-decor"),
    decorEquipe: document.getElementById("decor-equipe"),
    btnReset: document.getElementById("btn-reset"),
    panelTitre: document.getElementById("panel-titre"),
    panelPokemon: document.getElementById("panel-pokemon"),
    panelBoutique: document.getElementById("panel-boutique"),
    listePokemon: document.getElementById("liste-pokemon"),
    selectionStarter: document.getElementById("selection-starter"),
    recrutementCta: document.getElementById("recrutement-cta"),
    recrutementCtaTexte: document.getElementById("recrutement-cta-texte"),
    shopListe: document.getElementById("shop-liste"),
    possedeesListe: document.getElementById("possedees-liste"),
    tabsBtns: document.querySelectorAll(".tab-btn"),
    popupBackdrop: document.getElementById("popup-backdrop"),
    popup: document.getElementById("popup-upgrade"),
    popupTitre: document.getElementById("popup-titre"),
    popupDescription: document.getElementById("popup-description"),
    popupFooter: document.getElementById("popup-footer"),
    starterBackdrop: document.getElementById("starter-backdrop"),
    modalStarter: document.getElementById("modal-starter"),
    starterCartes: document.getElementById("starter-cartes"),
    recrueBackdrop: document.getElementById("recrue-backdrop"),
    modalRecrue: document.getElementById("modal-recrue"),
    recrueTitre: document.getElementById("recrue-titre"),
    recrueCartes: document.getElementById("recrue-cartes"),
    toastBackdrop: document.getElementById("toast-backdrop"),
    toastHorsLigne: document.getElementById("toast-hors-ligne"),
    toastHorsLigneTexte: document.getElementById("toast-hors-ligne-texte"),
    toastHorsLigneFermer: document.getElementById("toast-hors-ligne-fermer"),
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

  // --- Applique l'animation idle (bas-gauche, 3 frames en moyenne) sur un élément donné ---
  async function appliquerSpriteIdle(el2, def) {
    const meta = await obtenirMetaSprite(def);
    if (!meta || !meta.idle) return;
    const { frameWidth, frameHeight, frameCount } = meta.idle;
    el2.style.width = `${frameWidth}px`;
    el2.style.height = `${frameHeight}px`;
    el2.style.backgroundImage = `url(${def.sprite_dossier}idle.png)`;
    el2.style.backgroundSize = `${frameWidth * frameCount}px ${frameHeight}px`;
    el2.style.setProperty("--largeur-frame", `${frameWidth}px`);
    el2.style.setProperty("--nb-frames", frameCount);
    el2.style.animation = `cycle-sprite ${(frameCount * 0.15).toFixed(2)}s steps(${frameCount}) infinite`;
  }

  // --- Zone décorative : sprites des Pokémon (jusqu'à 6 plus tard), purement visuel ---
  function construireDecorEquipe() {
    el.decorEquipe.innerHTML = "";
    for (const membre of game.state.equipe) {
      const def = game.definitionPokemon(membre.id);
      const sprite = document.createElement("div");
      sprite.className = "decor-sprite";
      sprite.dataset.membreId = membre.id;
      el.decorEquipe.appendChild(sprite);
      appliquerSpriteIdle(sprite, def);
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
        <img class="lp-sprite" alt="" />
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
      ligne.querySelector(".lp-sprite").src = `${def.sprite_dossier}portrait.png`;

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

    if (!el.recrutementCta.hidden) {
      const palier = game.prochainRecrutement();
      if (palier) {
        el.recrutementCta.classList.toggle("non-abordable", game.state.pokedollars < palier.cout);
      }
    }
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

  function creerBadgeType(typeId) {
    const badge = document.createElement("span");
    const def = types[typeId];
    badge.className = "type-badge";
    badge.style.background = def.couleur;
    badge.textContent = `${def.icone} ${def.nom}`;
    return badge;
  }

  // --- Carte de choix réutilisée par la modale starter et la modale de recrutement ---
  function creerCarteChoixPokemon(def, { abordable = true, onClick }) {
    const carte = document.createElement("button");
    carte.className = "starter-carte";
    carte.disabled = !abordable;
    carte.innerHTML = `
      <img class="starter-carte-portrait" alt="" />
      <div class="starter-carte-infos">
        <span class="starter-carte-nom"></span>
        <div class="starter-carte-types"></div>
      </div>
    `;
    carte.querySelector(".starter-carte-portrait").src = `${def.sprite_dossier}portrait.png`;
    carte.querySelector(".starter-carte-nom").textContent = def.nom;
    const typesEl = carte.querySelector(".starter-carte-types");
    for (const t of def.types) typesEl.appendChild(creerBadgeType(t));
    carte.addEventListener("click", onClick);
    return carte;
  }

  function apresChangementEquipe() {
    actualiserEtatsPanel();
    construireDecorEquipe();
    construireListePokemon();
    actualiserValeurs();
    game.sauvegarder();
  }

  // --- État du panel Pokémon : sélection du starter, puis proposition de recrutement ---
  function actualiserEtatsPanel() {
    el.selectionStarter.hidden = game.aChoisiStarter();
    const palier = game.aChoisiStarter() ? game.prochainRecrutement() : null;
    el.recrutementCta.hidden = !palier;
    if (palier) {
      el.recrutementCtaTexte.textContent = `Recruter un compagnon (${formatNombre(palier.cout)} 💰)`;
    }
  }

  function fermerModaleStarter() {
    el.modalStarter.hidden = true;
    el.starterBackdrop.hidden = true;
  }

  function ouvrirModaleStarter() {
    el.starterCartes.innerHTML = "";
    for (const def of game.starters()) {
      const carte = creerCarteChoixPokemon(def, {
        onClick: () => {
          game.choisirStarter(def.id);
          fermerModaleStarter();
          apresChangementEquipe();
        },
      });
      el.starterCartes.appendChild(carte);
    }
    el.modalStarter.hidden = false;
    el.starterBackdrop.hidden = false;
  }

  el.selectionStarter.addEventListener("click", ouvrirModaleStarter);
  el.starterBackdrop.addEventListener("click", fermerModaleStarter);

  // --- Recrutement d'un 2e Pokémon (et suivants) : choix fixe défini en data ---
  function fermerModaleRecrutement() {
    el.modalRecrue.hidden = true;
    el.recrueBackdrop.hidden = true;
  }

  function ouvrirModaleRecrutement() {
    const palier = game.prochainRecrutement();
    if (!palier) return;
    const abordable = game.state.pokedollars >= palier.cout;
    el.recrueTitre.textContent = `Recruter un compagnon — ${formatNombre(palier.cout)} 💰`;
    el.recrueCartes.innerHTML = "";
    for (const id of palier.choix) {
      const def = game.definitionPokemon(id);
      const carte = creerCarteChoixPokemon(def, {
        abordable,
        onClick: () => {
          if (!game.recruterPokemon(def.id)) return;
          fermerModaleRecrutement();
          apresChangementEquipe();
        },
      });
      el.recrueCartes.appendChild(carte);
    }
    el.modalRecrue.hidden = false;
    el.recrueBackdrop.hidden = false;
  }

  el.recrutementCta.addEventListener("click", ouvrirModaleRecrutement);
  el.recrueBackdrop.addEventListener("click", fermerModaleRecrutement);

  // --- Toast de progression hors-ligne, affiché une fois au chargement si applicable ---
  function afficherToastHorsLigne() {
    const gains = game.gainsHorsLigne;
    if (!gains) return;
    const heures = Math.floor(gains.secondes / 3600);
    const minutes = Math.floor((gains.secondes % 3600) / 60);
    const duree = heures > 0 ? `${heures}h ${minutes}min` : `${minutes}min`;
    el.toastHorsLigneTexte.textContent = `${duree} écoulées : +${formatNombre(gains.montant)} 💰`;
    el.toastHorsLigne.hidden = false;
    el.toastBackdrop.hidden = false;
  }

  function fermerToastHorsLigne() {
    el.toastHorsLigne.hidden = true;
    el.toastBackdrop.hidden = true;
    actualiserValeurs();
  }

  el.toastHorsLigneFermer.addEventListener("click", fermerToastHorsLigne);
  el.toastBackdrop.addEventListener("click", fermerToastHorsLigne);

  // --- Clic manuel : uniquement dans la zone décorative ---
  el.zoneDecor.addEventListener("click", (evt) => {
    game.clic();
    floaterDepuisEvenement(evt, `+${formatNombre(game.productionClic())} 💰`);
    actualiserValeurs();
  });

  const idIntervalleTick = setInterval(() => {
    game.tick();
    for (const membre of game.state.equipe) {
      const sprite = el.decorEquipe.querySelector(`[data-membre-id="${membre.id}"]`);
      const prod = game.productionMembre(membre);
      if (sprite && prod >= 1) floaterDepuisSprite(sprite, `+${formatNombre(prod)} 💰`);
    }
    actualiserValeurs();
  }, 1000);

  const idIntervalleSauvegarde = setInterval(() => game.sauvegarder(), 5000);
  const sauvegarderAvantFermeture = () => game.sauvegarder();
  window.addEventListener("beforeunload", sauvegarderAvantFermeture);

  // --- Bouton Reset : efface complètement la partie (storage + caches + cookies du site) ---
  async function reinitialiserJeu() {
    clearInterval(idIntervalleTick);
    clearInterval(idIntervalleSauvegarde);
    window.removeEventListener("beforeunload", sauvegarderAvantFermeture);

    localStorage.clear();
    sessionStorage.clear();
    if (window.caches) {
      const cles = await caches.keys();
      await Promise.all(cles.map((c) => caches.delete(c)));
    }
    document.cookie.split(";").forEach((c) => {
      const nom = c.split("=")[0].trim();
      if (nom) document.cookie = `${nom}=;expires=${new Date(0).toUTCString()};path=/`;
    });

    location.reload();
  }

  el.btnReset.addEventListener("click", (evt) => {
    evt.stopPropagation();
    if (window.confirm("Réinitialiser complètement la partie ? Cette action est irréversible.")) {
      reinitialiserJeu();
    }
  });

  construireDecorEquipe();
  construireListePokemon();
  reconstruirePossedeesSiNecessaire();
  rafraichirAffichage();
  actualiserEtatsPanel();
  afficherToastHorsLigne();
}

demarrer();
