Fichiers attendus ici (fonds décoratifs selon l'heure locale, cf. `src/main.js`) :

- `matin.png` — affiché entre 6h et 12h
- `apres-midi.png` — affiché entre 12h et 18h
- `soir.png` — affiché entre 18h et 00h
- `nuit.png` — affiché entre 00h et 6h

Format portrait (même ratio que la zone décorative), la partie basse de
l'image (la "falaise" d'herbe) doit se trouver tout en bas du visuel :
la zone l'affiche en `background-size: cover` / `background-position:
center bottom`, et l'équipe de Pokémon est calée sur ce même bas.
