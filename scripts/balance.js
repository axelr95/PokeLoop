// Calculs de balancing réutilisables : production, coûts XP, coûts paliers, ratios.
// Réutilise les vraies formules du moteur (src/engine/calculations.js) et les vraies
// données (src/data/*.json) — jamais de valeurs recopiées à la main, donc toujours
// synchro avec le jeu réel après un changement de data.
//
// Usage :
//   node scripts/balance.js                  → table de balance actuelle
//   node scripts/balance.js --fraction=0.10   → suggère des coûts de paliers à X%
//                                                de la XP cumulée équipe (pour retrouver
//                                                cette proportion après un futur changement)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { xpRequise, appliquerFacteurs } from "../src/engine/calculations.js";

const racine = path.dirname(fileURLToPath(import.meta.url));
const lireJson = (p) => JSON.parse(readFileSync(path.join(racine, "..", p), "utf8"));

const pokemons = lireJson("src/data/pokemons.json");
const upgrades = lireJson("src/data/upgrades.json");
const paliers = lireJson("src/data/paliers_pokemon.json").paliers;

const TAILLE_EQUIPE = 6;
const XP_COURBE = pokemons[0].xp_courbe; // commune à tous les Pokémon pour l'instant
const V_FORME_FINALE = 2; // valeur_par_niveau d'un Pokémon en forme finale (cf. game_system.md 3.2bis)

// Modifiers globaux actifs en jeu normal : toutes les upgrades globales achetées
// (peu chères, achetées tôt), équipe complète (final_boost_1 débloqué dès 3 membres).
// Exclut la Maîtrise (7bis.6, coûts 100k/1M) : pas une hypothèse d'early-game valide.
const modifiersGlobaux = upgrades
  .filter((u) => u.effet.cible.type === "global" && !u.id.includes("_maitrise"))
  .map((u) => ({ categorie: u.effet.categorie, valeur: u.effet.valeur, type: u.effet.type }));

function xpCumuleUnMon(niveau) {
  let total = 0;
  for (let n = 2; n <= niveau; n++) total += xpRequise({ xp_courbe: XP_COURBE }, n);
  return total;
}

function xpCumuleEquipe(niveau) {
  return xpCumuleUnMon(niveau) * TAILLE_EQUIPE;
}

// Production d'un Pokémon en forme finale à `niveau`, avec les upgrades globales
// et les paliers déjà achetés en dessous de `tierIndex` (0 = aucun palier encore).
function productionMon(niveau, tierIndex) {
  const base = V_FORME_FINALE * niveau;
  const palierSum = paliers.slice(0, tierIndex).reduce((acc, p) => acc + p.valeur, 0);
  const modifiers = [...modifiersGlobaux, { categorie: "additif_final", valeur: palierSum }];
  return appliquerFacteurs(base, modifiers);
}

function tableBalanceActuelle() {
  console.log(
    "tier | niveau | prod/mon (avant achat) | prod équipe | coût/mon | coût équipe | temps épargne | XP cumulée équipe | ratio coût/XP"
  );
  paliers.forEach((p, i) => {
    const prodMon = productionMon(p.niveau_requis, i);
    const prodEquipe = prodMon * TAILLE_EQUIPE;
    const coutEquipe = p.cout * TAILLE_EQUIPE;
    const secs = coutEquipe / prodEquipe;
    const xpEquipe = xpCumuleEquipe(p.niveau_requis);
    const ratio = ((coutEquipe / xpEquipe) * 100).toFixed(1);
    console.log(
      `${p.tier_romain.padEnd(4)} | ${String(p.niveau_requis).padEnd(6)} | ${prodMon.toFixed(0).padEnd(23)} | ${prodEquipe.toFixed(0).padEnd(11)} | ${String(p.cout).padEnd(8)} | ${String(coutEquipe).padEnd(11)} | ${secs.toFixed(0).padEnd(4)}s | ${xpEquipe.toFixed(0).padEnd(18)} | ${ratio}%`
    );
  });
}

function tableSuggestionCouts(fraction) {
  console.log(`Suggestion de coûts à ${(fraction * 100).toFixed(0)}% de la XP cumulée équipe :`);
  console.log("tier | niveau | coût suggéré (brut) | coût actuel");
  paliers.forEach((p) => {
    const suggere = Math.round(fraction * xpCumuleEquipe(p.niveau_requis));
    console.log(`${p.tier_romain.padEnd(4)} | ${String(p.niveau_requis).padEnd(6)} | ${String(suggere).padEnd(20)} | ${p.cout}`);
  });
}

const argFraction = process.argv.find((a) => a.startsWith("--fraction="));
if (argFraction) {
  tableSuggestionCouts(Number(argFraction.split("=")[1]));
} else {
  tableBalanceActuelle();
}
