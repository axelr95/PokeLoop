import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

const typesMime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const serveur = http.createServer(async (req, res) => {
  const cheminUrl = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const cheminFichier = path.join(racine, decodeURIComponent(cheminUrl));

  try {
    const contenu = await readFile(cheminFichier);
    const ext = path.extname(cheminFichier);
    res.writeHead(200, { "Content-Type": typesMime[ext] || "application/octet-stream" });
    res.end(contenu);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 - fichier introuvable");
  }
});

serveur.listen(port, "0.0.0.0", () => {
  console.log(`PokeLoop en écoute sur http://localhost:${port} (accessible aussi depuis ton téléphone via l'IP locale du PC)`);
});
