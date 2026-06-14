# Geometry Storm

A neon twin-stick arcade shooter — survive the waves, build the combo, beat the score. Built for George.

Live: https://angelakim0126.github.io/geometry-storm/

## Controls

**Desktop:** WASD or arrows to move, mouse to aim. Auto-fire — just focus on dodging.

**Mobile:** Left thumb = move stick, right thumb = aim/fire stick.

**Keys:** `P` / `Esc` pause · `B` detonate a held bomb · `M` mute.

## Enemies

| Shape | Name | Behavior |
|---|---|---|
| Hex | Drifter | Slow chaser |
| Triangle | Zoomer | Fast direct dash |
| Square | Splitter | Splits into 2 on death |
| Circle | Orbiter | Orbits at distance, shoots |
| Octagon | Tank | Slow, 4 HP |
| Star | Boss | Every 5 waves — barrages bullets |

## Power-ups

⚡ Rapid Fire · ✦ Triple Shot · 🛡 Shield (3-hit absorb) · ⏱ Slow-mo · 💣 Bomb (press B)

## Milestones

Named waves: 5 ASTEROID BELT · 10 NEBULA · 15 BLACK HOLE · 20 QUASAR · 25 SINGULARITY · 30 EVENT HORIZON · 40 COSMIC OBLIVION · 50 INFINITY.

## Tech

Pure HTML / CSS / JS. Single `<canvas>`. Web Audio for SFX. `localStorage` for high score, best wave, and total kills.

## Run locally

```bash
cd ~/code/geometry-storm
python3 -m http.server 8000
# open http://localhost:8000
```

## Storage keys

- `gs_best` — high score
- `gs_best_wave` — highest wave reached
- `gs_kills` — lifetime kills
- `gs_sound` — `"on"` or `"off"`
