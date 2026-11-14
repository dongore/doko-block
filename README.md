# Doko-Block

A digital **Doppelkopf-Spielblock** (score pad) as an installable web app (PWA). It works offline, has a German UI, and keeps all data on the device.

## Features

- **Spielblock** in the style of a paper pad: running totals or per-game points, Spielwert column, round separators, and marks for Solo and Bock.
- **Game entry** in two modes:
  - **Rechner:** pick the Re party, Augen (for whichever pile you counted), Ansagen/Absagen, and Sonderpunkte (Fuchs, Doppelkopf, Karlchen, Gegen die Alten). The game value is computed according to the DDV Turnierspielregeln, and every point is itemised.
  - **Schnelleingabe:** Re party, winner, Spielwert. Done.
- **Bockrunden:** triggered automatically (120:120, lost Kontra, lost Re, lost Solo, Nullspiel; each switchable, by default only a lost Kontra counts, not a lost Re) and **at any time by hand**. Multiple Bock rounds can run *one after another* (×2) or *stack* (×4 …).
- **4–7 players** with automatic rotation of dealer and sit-outs (with 6/7 players: dealer + the player(s) opposite, or "the four to the dealer's left"). Players can join, leave, or change seats mid-game, and the next dealer can be corrected by hand.
- **Pflichtsolo tracking:** a P marker per player, with a reminder in the last round. After a Pflichtsolo the same dealer deals again (DDV). House rule, switchable: after a Lustsolo the soloist leads and the same dealer deals again, but only for each player's first solo in a round, and not if the soloist sat left of the dealer and would have led anyway.
- **Statistik:** score chart, win rate, Re/Kontra/Solo record, Ansagen, best and worst game.
- **Abrechnung:** cents per point, settlement *between players* (fewest possible transfers) or *into a kitty* (gap to the leader), and share the result as text.
- Edit, delete with undo, light/dark mode, keeps the screen on, backup/restore as a JSON file.

## Scoring (DDV)

| Line | Points |
|---|---|
| Gewonnen | 1 |
| Unter 90 / 60 / 30 gespielt, schwarz | 1 each |
| Re / Kontra angesagt | 2 each |
| Each Absage (keine 90 / 60 / 30 / schwarz) | 1 each |
| 120 against keine 90, 90 against keine 60, 60 against keine 30, 30 against schwarz | 1 each |
| Gegen die Alten, Fuchs, Doppelkopf, Karlchen (normal games only) | 1 each |

Re wins with 121 Augen, or with 120 if only Kontra was announced. A party that made an Absage must fulfil it. If both parties miss their Absage, nobody wins; only "unter 90/60/30", the points against Absagen and Sonderpunkte count (TSR 7.1.3). In a Solo the soloist wins or pays three times. Every game sums to zero.

## Development

```bash
npm install
npm run dev          # dev server
npm test             # unit tests (scoring, Bock, rotation, settlement)
npm run build        # PWA into dist/
npm run build:single # single self-contained HTML file in dist-single/
```

Stack: Vite, React, TypeScript, vite-plugin-pwa. Self-hosted fonts: Bricolage Grotesque, Figtree, Barlow Semi Condensed.

## Hosting

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. Then open the page on your phone and choose "Add to Home Screen".
