# 💀 Skull

Adaptation web du jeu de bluff et d'enchères **Skull** (3 à 6 joueurs).

- **Local** : partie tour par tour sur un seul appareil.
- **Multijoueur** : créer/rejoindre une partie via un code, synchronisée en temps réel (WebSocket).

En ligne : https://skull.once.florent.cc

## Règles

Chaque joueur a 4 disques (3 fleurs + 1 crâne). À son tour : poser un disque
face cachée, ou lancer un défi (annoncer un nombre de fleurs à retourner). Les
autres surenchérissent ou passent. Le plus offrant (le Challenger) retourne les
disques en commençant par les siens : que des fleurs → défi réussi, un crâne →
échec et perte d'un disque. Premier à réussir 2 défis gagne.

## Stack

- React 19 + Vite + TypeScript
- Moteur de jeu pur (`src/game`) testé avec Vitest
- Serveur Bun (statique + API REST + WebSocket), persistance SQLite

## Développement

```bash
npm install
npm run dev                                   # front sur :5173
PORT=3001 STORAGE_DIR=./storage npm run server # serveur sur :3001
npm test                                       # tests du moteur
```

## Production

Image Docker auto-publiée sur GHCR par la CI. Le serveur écoute sur le port 80,
la base SQLite est stockée dans le volume `/storage`, health check sur `/up`.
