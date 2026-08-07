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

// --- Fond décoratif selon l'heure locale de l'appareil : matin/après-midi/soir/nuit ---
const FONDS_PAR_TRANCHE = [
  { debut: 6, fin: 12, fichier: "matin" },
  { debut: 12, fin: 18, fichier: "apres-midi" },
  { debut: 18, fin: 24, fichier: "soir" },
  { debut: 0, fin: 6, fichier: "nuit" },
];
const NOMS_FONDS = FONDS_PAR_TRANCHE.map((t) => t.fichier);
const ICONES_FONDS = { matin: "🌅", "apres-midi": "☀️", soir: "🌇", nuit: "🌙" };

let indexFondDebug = null; // null = mode normal (heure réelle) ; sinon index dans NOMS_FONDS

function nomFondActuel() {
  if (indexFondDebug !== null) return NOMS_FONDS[indexFondDebug];
  const heure = new Date().getHours();
  const tranche = FONDS_PAR_TRANCHE.find((t) => heure >= t.debut && heure < t.fin);
  return tranche.fichier;
}

function appliquerFondDecor(el) {
  el.zoneDecor.style.backgroundImage = `url(assets/backgrounds/${nomFondActuel()}.png)`;
}

// --- Positionnement des 6 emplacements d'équipe, en triangle/quinconce ---
// (dx, dy en fractions de la largeur de la zone décorative, d'après le croquis
// fourni par l'utilisateur ; dy positif = vers le haut). Trois rangées : le 1
// seul en haut, 2/3 en rangée médiane, 5/4/6 en rangée basse.
const EMPLACEMENTS_EQUIPE = [
  { dx: 0, dy: 0.22 }, // 1 : haut-centre
  { dx: -0.27, dy: 0.06 }, // 2 : milieu-gauche
  { dx: 0.27, dy: 0.06 }, // 3 : milieu-droite
  { dx: 0, dy: -0.1 }, // 4 : bas-centre
  { dx: -0.27, dy: -0.1 }, // 5 : bas-gauche
  { dx: 0.27, dy: -0.1 }, // 6 : bas-droite
];

// Vers le centre de la bande d'herbe (pas encore pile sur le rebord — à affiner
// plus tard si besoin). Comme le fond est calé en largeur (background-size: 100%
// auto) et ancré en bas, sa hauteur affichée dépend de la largeur de la zone :
// on recalcule donc ce décalage depuis la largeur réelle plutôt qu'une constante fixe.
const FALAISE_FRACTION_DEPUIS_BAS = 0.14;
const RATIO_HAUTEUR_IMAGE = 576 / 256;

function decalageFalaisePx(largeurZoneDecor) {
  return FALAISE_FRACTION_DEPUIS_BAS * RATIO_HAUTEUR_IMAGE * largeurZoneDecor;
}

function positionArc(index, decalageBase, largeurZoneDecor) {
  const emplacement = EMPLACEMENTS_EQUIPE[index] || EMPLACEMENTS_EQUIPE[EMPLACEMENTS_EQUIPE.length - 1];
  return {
    x: emplacement.dx * largeurZoneDecor,
    y: decalageBase + emplacement.dy * largeurZoneDecor,
  };
}

// --- Échelle et ancrage des sprites ---
// Même échelle fixe pour tous les sprites (pas de variation par espèce) afin
// que la taille d'un pixel du sprite reste identique partout, quelle que soit
// l'espèce. Seul l'ancrage varie : les feuilles de sprites PMD ne sont pas
// toutes centrées de la même façon dans leur canevas (marges transparentes
// variables autour du dessin réel), donc le transform-origin est calculé
// dynamiquement à partir de la bbox du contenu opaque réellement dessiné
// (calculée hors-ligne par pixel-analysis alpha sur toutes les frames idle,
// cf. bbox dans chaque meta.json), pour que le bas réel du corps touche
// toujours le sol au bon endroit, quel que soit le padding du canevas source.
const ECHELLE_SPRITE = 2.4;

function bboxSprite(meta) {
  if (!meta || !meta.idle) return null;
  const { frameWidth, frameHeight } = meta.idle;
  const bbox = meta.bbox || { minX: 0, minY: 0, maxX: frameWidth, maxY: frameHeight };
  return { ...bbox, frameWidth, frameHeight };
}

// Centre horizontal et bas réels du corps, en % du canevas de la frame :
// ce point reste fixe visuellement quand scale() est appliqué, donc ancrer le
// transform-origin dessus aligne le vrai bas du corps sur la position au sol
// (x, y) demandée, quel que soit le padding transparent du canevas source.
function origineSprite(meta) {
  const b = bboxSprite(meta);
  if (!b || !b.frameWidth || !b.frameHeight) return "50% 100%";
  const centreX = (b.minX + b.maxX) / 2;
  return `${((centreX / b.frameWidth) * 100).toFixed(2)}% ${((b.maxY / b.frameHeight) * 100).toFixed(2)}%`;
}

async function demarrer() {
  const [resources, pokemons, upgrades, types, recrutement, specialisation] = await Promise.all([
    chargerJson("src/data/resources.json"),
    chargerJson("src/data/pokemons.json"),
    chargerJson("src/data/upgrades.json"),
    chargerJson("src/data/types.json"),
    chargerJson("src/data/recrutement.json"),
    chargerJson("src/data/specialisation.json"),
  ]);

  const game = new Game({ resources, pokemons, upgrades, recrutement, specialisation });

  const el = {
    pokedollars: document.getElementById("pokedollars-valeur"),
    prodInfo: document.getElementById("prod-info"),
    zoneDecor: document.getElementById("zone-decor"),
    decorEquipe: document.getElementById("decor-equipe"),
    btnReset: document.getElementById("btn-reset"),
    btnDebugFond: document.getElementById("btn-debug-fond"),
    btnDebugArgent: document.getElementById("btn-debug-argent"),
    panelTitre: document.getElementById("panel-titre"),
    panelPokemon: document.getElementById("panel-pokemon"),
    panelBoutique: document.getElementById("panel-boutique"),
    xpHeaderActions: document.getElementById("xp-header-actions"),
    btnXpAll: document.getElementById("btn-xp-all"),
    btnXpSelect: document.getElementById("btn-xp-select"),
    xpSliderBackdrop: document.getElementById("xp-slider-backdrop"),
    xpSlider: document.getElementById("xp-slider"),
    grilleEquipe: document.getElementById("grille-equipe"),
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
    specialisationBackdrop: document.getElementById("specialisation-backdrop"),
    modalSpecialisation: document.getElementById("modal-specialisation"),
    specialisationCartes: document.getElementById("specialisation-cartes"),
    specialisationBadge: document.getElementById("specialisation-badge"),
    toastBackdrop: document.getElementById("toast-backdrop"),
    toastHorsLigne: document.getElementById("toast-hors-ligne"),
    toastHorsLigneTexte: document.getElementById("toast-hors-ligne-texte"),
    toastHorsLigneFermer: document.getElementById("toast-hors-ligne-fermer"),
  };

  const formatNombre = (n) => Math.floor(n).toLocaleString("fr-FR");
  const TITRES_ONGLETS = { pokemon: "Pokémon", boutique: "Boutique" };
  let idsBoutiqueAffiches = null;
  let idsPossedeesAffiches = null;

  // --- Valeur d'XP sélectionnée dans le header (partagée par le bouton dynamique
  // de chaque carte et le bouton ALL) : un nombre fixe, ou "max" ---
  let xpSelectionnee = 1;
  const libelleXp = (valeur) => (valeur === "max" ? "MAX" : `+${valeur} XP`);

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
  async function appliquerSpriteIdle(el2, def, x, y) {
    const meta = await obtenirMetaSprite(def);
    el2.style.transformOrigin = origineSprite(meta);
    el2.style.transform = `translate(calc(-50% + ${x}px), -${y}px) scale(${ECHELLE_SPRITE})`;
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

  // --- Zone décorative : sprites des Pokémon en arc de cercle sur la falaise ---
  function construireDecorEquipe() {
    el.decorEquipe.innerHTML = "";
    const largeurZone = el.zoneDecor.getBoundingClientRect().width;
    const decalageBase = decalageFalaisePx(largeurZone);
    game.state.equipe.forEach((membre, index) => {
      const def = game.definitionPokemon(membre.id);
      const sprite = document.createElement("div");
      sprite.className = "decor-sprite";
      sprite.dataset.membreId = membre.id;
      const { x, y } = positionArc(index, decalageBase, largeurZone);
      sprite.style.transform = `translate(calc(-50% + ${x}px), -${y}px) scale(${ECHELLE_SPRITE})`;
      el.decorEquipe.appendChild(sprite);
      appliquerSpriteIdle(sprite, def, x, y);
    });
  }

  // --- Panel "Pokémon" : grille fixe des 6 emplacements (remplis, action, ou verrouillés) ---
  const NB_EMPLACEMENTS = 6;

  function creerCarteEquipeRemplie(membre) {
    const def = game.definitionPokemon(membre.id);
    const carte = document.createElement("div");
    carte.className = "carte-equipe carte-equipe-remplie";
    carte.dataset.membreId = membre.id;
    carte.innerHTML = `
      <img class="ce-portrait" alt="" />
      <div class="ce-infos">
        <div class="ce-nom-niveau">
          <span class="ce-nom"></span>
          <span class="ce-niveau"></span>
        </div>
        <div class="ce-types-badges"></div>
        <div class="ce-normal">
          <div class="ce-xp"><div class="ce-xp-remplissage"></div></div>
          <div class="ce-actions">
            <button class="btn-mini" data-action="xp-select"></button>
            <button class="btn-mini" data-action="niveau-suivant">+1 LVL</button>
          </div>
        </div>
        <button class="btn-evoluer" hidden>Évoluer</button>
        <div class="ce-niveau-max" hidden>Niveau max</div>
      </div>
    `;
    carte.querySelector(".ce-portrait").src = `${def.sprite_dossier}portrait.png`;
    carte.querySelector(".ce-nom").textContent = def.nom;
    const typesEl = carte.querySelector(".ce-types-badges");
    for (const t of def.types) typesEl.appendChild(creerBadgeType(t, { mini: true }));
    carte.querySelector('[data-action="xp-select"]').textContent = libelleXp(xpSelectionnee);
    carte.querySelector('[data-action="xp-select"]').addEventListener("click", (evt) => {
      evt.stopPropagation();
      const montant = xpSelectionnee === "max" ? Math.floor(game.state.pokedollars) : xpSelectionnee;
      if (game.investirXp(membre.id, montant)) {
        actualiserValeurs();
        game.sauvegarder();
      }
    });
    carte.querySelector('[data-action="niveau-suivant"]').addEventListener("click", (evt) => {
      evt.stopPropagation();
      if (game.investirNiveauSuivant(membre.id)) {
        actualiserValeurs();
        game.sauvegarder();
      }
    });
    carte.querySelector(".btn-evoluer").addEventListener("click", (evt) => {
      evt.stopPropagation();
      surEvoluer(membre.id);
    });
    return carte;
  }

  function surEvoluer(membreId) {
    if (!game.evoluerPokemon(membreId)) return;
    construireDecorEquipe();
    construireGrilleEquipe();
    actualiserValeurs();
    game.sauvegarder();
  }

  function creerCarteAction(icone, texte, onClick, dataset) {
    const carte = document.createElement("button");
    carte.className = "carte-equipe carte-equipe-action";
    if (dataset) Object.assign(carte.dataset, dataset);
    carte.innerHTML = `<span class="ce-action-icone">${icone}</span><span class="ce-action-texte">${texte}</span>`;
    carte.addEventListener("click", (evt) => {
      evt.stopPropagation();
      onClick();
    });
    return carte;
  }

  function creerCarteVerrouillee() {
    const carte = document.createElement("div");
    carte.className = "carte-equipe carte-equipe-verrou";
    carte.textContent = "🔒";
    return carte;
  }

  function construireGrilleEquipe() {
    el.grilleEquipe.innerHTML = "";
    const equipe = game.state.equipe;
    const palier = game.aChoisiStarter() ? game.prochainRecrutement() : null;
    for (let index = 0; index < NB_EMPLACEMENTS; index++) {
      let carte;
      if (index < equipe.length) {
        carte = creerCarteEquipeRemplie(equipe[index]);
      } else if (index === 0 && !game.aChoisiStarter()) {
        carte = creerCarteAction("❓", "Choisir starter", ouvrirModaleStarter);
      } else if (palier && palier.emplacement === index + 1) {
        carte = creerCarteAction(
          "➕",
          `Recruter (${formatNombre(palier.cout)} 💰)`,
          ouvrirModaleRecrutement,
          { role: "recrutement" }
        );
      } else {
        carte = creerCarteVerrouillee();
      }
      el.grilleEquipe.appendChild(carte);
    }
  }

  function actualiserGrilleEquipe() {
    for (const membre of game.state.equipe) {
      const def = game.definitionPokemon(membre.id);
      const carte = el.grilleEquipe.querySelector(`[data-membre-id="${membre.id}"]`);
      if (!carte) continue;
      carte.querySelector(".ce-niveau").textContent = `Nv ${membre.niveau}`;

      const peutEvoluer = game.peutEvoluer(membre);
      const niveauMax = !peutEvoluer && membre.niveau >= 100;
      carte.querySelector(".ce-normal").hidden = peutEvoluer || niveauMax;
      carte.querySelector(".btn-evoluer").hidden = !peutEvoluer;
      carte.querySelector(".ce-niveau-max").hidden = !niveauMax;
      if (!peutEvoluer && !niveauMax) {
        const barre = carte.querySelector(".ce-xp-remplissage");
        const seuil = xpRequise(def, membre.niveau + 1);
        barre.style.width = `${Math.min(100, (membre.xp / seuil) * 100)}%`;
        const coutNiveauSuivant = game.xpPourProchainNiveau(membre);
        carte.querySelector('[data-action="niveau-suivant"]').disabled =
          coutNiveauSuivant <= 0 || game.state.pokedollars < coutNiveauSuivant;
      }
    }
    const carteRecrutement = el.grilleEquipe.querySelector('[data-role="recrutement"]');
    if (carteRecrutement) {
      const palier = game.prochainRecrutement();
      if (palier) {
        carteRecrutement.classList.toggle("non-abordable", game.state.pokedollars < palier.cout);
      }
    }
  }

  // --- Valeurs qui changent chaque tick : mise à jour légère, sans recréer le DOM ---
  function actualiserValeurs() {
    el.pokedollars.textContent = formatNombre(game.state.pokedollars);
    el.prodInfo.textContent = `${formatNombre(game.productionParSeconde())} /s`;
    actualiserGrilleEquipe();

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
    el.xpHeaderActions.hidden = nom !== "pokemon";
    el.tabsBtns.forEach((btn) => btn.classList.toggle("actif", btn.dataset.tab === nom));
  }

  el.tabsBtns.forEach((btn) => {
    btn.addEventListener("click", () => activerOnglet(btn.dataset.tab));
  });

  // --- Header Pokémon : ALL (rouge, toute l'équipe) et sélecteur d'XP (vert, slider) ---
  function actualiserLibelleXp() {
    const libelle = libelleXp(xpSelectionnee);
    el.btnXpSelect.textContent = libelle;
    el.grilleEquipe.querySelectorAll('[data-action="xp-select"]').forEach((btn) => {
      btn.textContent = libelle;
    });
  }

  function fermerSliderXp() {
    el.xpSlider.hidden = true;
    el.xpSliderBackdrop.hidden = true;
  }

  function ouvrirSliderXp() {
    const rect = el.btnXpSelect.getBoundingClientRect();
    el.xpSlider.style.left = `${rect.right}px`;
    el.xpSlider.style.top = `${rect.top - 8}px`;
    el.xpSlider.style.transform = "translate(-100%, -100%)";
    el.xpSlider.hidden = false;
    el.xpSliderBackdrop.hidden = false;
  }

  el.btnXpSelect.addEventListener("click", (evt) => {
    evt.stopPropagation();
    ouvrirSliderXp();
  });

  el.xpSliderBackdrop.addEventListener("click", fermerSliderXp);

  el.xpSlider.querySelectorAll(".xp-slider-choix").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      const v = btn.dataset.valeur;
      xpSelectionnee = v === "max" ? "max" : Number(v);
      actualiserLibelleXp();
      fermerSliderXp();
    });
  });

  el.btnXpAll.addEventListener("click", (evt) => {
    evt.stopPropagation();
    const ok =
      xpSelectionnee === "max"
        ? game.investirXpEquipeMax()
        : game.investirXpEquipe(xpSelectionnee);
    if (ok) {
      actualiserValeurs();
      game.sauvegarder();
    }
  });

  actualiserLibelleXp();

  // --- Popup de description (boutique / possédées) ---
  function fermerPopup() {
    el.popup.hidden = true;
    el.popupBackdrop.hidden = true;
  }

  function ouvrirPopupUpgrade(upgrade, ancreEl, { achetable, libelleBouton = "Acheter", onAcheter } = {}) {
    el.popupTitre.textContent = upgrade.nom;
    el.popupDescription.textContent = upgrade.description;

    if (achetable) {
      const abordable = game.state.pokedollars >= upgrade.cout.valeur;
      el.popupFooter.innerHTML = `
        <span class="popup-cout">${formatNombre(upgrade.cout.valeur)} 💰</span>
        <button class="btn-acheter" ${abordable ? "" : "disabled"}>${libelleBouton}</button>
      `;
      el.popupFooter.querySelector("button").addEventListener("click", () => {
        fermerPopup();
        if (onAcheter) {
          onAcheter();
        } else {
          game.acheterUpgrade(upgrade.id);
          reconstruireBoutiqueSiNecessaire();
          reconstruirePossedeesSiNecessaire();
          actualiserValeurs();
        }
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

  // Fond coloré (couleur du type) pour faire ressortir les upgrades liées à un type
  function colorerSelonType(btn, upgrade) {
    const cible = upgrade.effet && upgrade.effet.cible;
    if (!cible || cible.type !== "type_pokemon") return;
    const def = types[cible.valeur];
    if (def) btn.style.background = def.couleur;
  }

  // --- Boutique / possédées : icônes carrées, popup au clic ---
  function reconstruireBoutiqueSiNecessaire() {
    const disponibles = game.data.upgrades.filter((u) => game.upgradeDisponible(u));
    const specialisationDispo = !game.specialisationChoisie();
    const idsActuels = `${specialisationDispo ? "spe" : ""}|${disponibles.map((u) => u.id).join(",")}`;
    if (idsActuels === idsBoutiqueAffiches) return;
    idsBoutiqueAffiches = idsActuels;

    el.shopListe.innerHTML = "";
    if (!specialisationDispo && disponibles.length === 0) {
      el.shopListe.innerHTML = '<div class="vide">Rien à acheter.</div>';
    }
    if (specialisationDispo) {
      const cout = game.coutSpecialisation();
      const btn = document.createElement("button");
      btn.className = "icone-item";
      btn.dataset.cout = cout;
      btn.textContent = "🎯";
      btn.classList.toggle("non-abordable", game.state.pokedollars < cout);
      btn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        ouvrirPopupUpgrade(
          {
            nom: "Spécialisation de type",
            description:
              "Choisis un type, de façon définitive pour cette run : +100% production finale immédiate sur ce type, et débloque 3 upgrades supplémentaires dédiées à ce type.",
            cout: { valeur: cout },
          },
          btn,
          { achetable: true, libelleBouton: "Choisir un type", onAcheter: ouvrirModaleSpecialisation }
        );
      });
      el.shopListe.appendChild(btn);
    }
    for (const upgrade of disponibles) {
      const btn = document.createElement("button");
      btn.className = "icone-item";
      btn.dataset.cout = upgrade.cout.valeur;
      btn.textContent = upgrade.icone;
      colorerSelonType(btn, upgrade);
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
      colorerSelonType(btn, upgrade);
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

  function creerBadgeType(typeId, { mini = false } = {}) {
    const badge = document.createElement("span");
    const def = types[typeId];
    badge.className = mini ? "type-badge type-badge-mini" : "type-badge";
    badge.style.background = def.couleur;
    // En mini, l'émoji prend une largeur disproportionnée (taille quasi fixe
    // selon les polices) : on garde juste le libellé pour rester compact.
    badge.textContent = mini ? def.nom : `${def.icone} ${def.nom}`;
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
    construireDecorEquipe();
    construireGrilleEquipe();
    actualiserValeurs();
    game.sauvegarder();
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

  el.recrueBackdrop.addEventListener("click", fermerModaleRecrutement);

  // --- Spécialisation de type : choix unique et définitif, débloque 3 upgrades liées ---
  function actualiserBadgeSpecialisation() {
    if (!game.specialisationChoisie()) {
      el.specialisationBadge.style.visibility = "hidden";
      return;
    }
    const def = types[game.state.specialisation];
    el.specialisationBadge.style.visibility = "visible";
    el.specialisationBadge.style.background = def.couleur;
    el.specialisationBadge.textContent = `${def.icone} Spécialisation ${def.nom}`;
  }

  function fermerModaleSpecialisation() {
    el.modalSpecialisation.hidden = true;
    el.specialisationBackdrop.hidden = true;
  }

  function ouvrirModaleSpecialisation() {
    const cout = game.coutSpecialisation();
    const abordable = game.state.pokedollars >= cout;
    el.specialisationCartes.innerHTML = "";
    for (const [typeId, def] of Object.entries(types)) {
      const carte = document.createElement("button");
      carte.className = "type-carte";
      carte.disabled = !abordable;
      carte.style.background = def.couleur;
      carte.innerHTML = `<span class="type-carte-icone">${def.icone}</span><span class="type-carte-nom">${def.nom}</span>`;
      carte.addEventListener("click", () => {
        if (!game.choisirSpecialisation(typeId)) return;
        fermerModaleSpecialisation();
        reconstruireBoutiqueSiNecessaire();
        actualiserBadgeSpecialisation();
        actualiserValeurs();
        game.sauvegarder();
      });
      el.specialisationCartes.appendChild(carte);
    }
    el.modalSpecialisation.hidden = false;
    el.specialisationBackdrop.hidden = false;
  }

  el.specialisationBackdrop.addEventListener("click", fermerModaleSpecialisation);

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

  // --- Debug : force le fond à afficher pour tester les 4 tranches horaires ---
  el.btnDebugFond.addEventListener("click", (evt) => {
    evt.stopPropagation();
    indexFondDebug = indexFondDebug === null ? 0 : (indexFondDebug + 1) % NOMS_FONDS.length;
    appliquerFondDecor(el);
    el.btnDebugFond.textContent = ICONES_FONDS[NOMS_FONDS[indexFondDebug]];
  });

  // --- Debug : double les Pokédollars possédés, pour tester rapidement ---
  el.btnDebugArgent.addEventListener("click", (evt) => {
    evt.stopPropagation();
    game.state.pokedollars *= 2;
    actualiserValeurs();
    game.sauvegarder();
  });

  appliquerFondDecor(el);
  setInterval(() => appliquerFondDecor(el), 5 * 60 * 1000);

  construireDecorEquipe();
  construireGrilleEquipe();
  reconstruirePossedeesSiNecessaire();
  actualiserBadgeSpecialisation();
  rafraichirAffichage();
  afficherToastHorsLigne();
}

demarrer();
