# Geometry Storm

A neon twin-stick arcade shooter — survive the waves, build the combo, beat the score. Built for George.

Live: https://angelakim0126.github.io/geometry-storm/

## Controls

**Desktop:** WASD or arrows to move, mouse to aim. Auto-fire — just focus on dodging.

**Mobile:** Left thumb = move stick, right thumb = aim/fire stick.

**Keys:** `P` / `Esc` pause · `B` detonate a held bomb · `M` mute.

## Enemies

| Shape | Name | From | Behavior |
|---|---|---|---|
| Hex | Drifter | 1 | Slow chaser |
| Triangle | Zoomer | 1 | Fast direct dash |
| Diamond | Weaver | 3 | Snakes toward you in an S-curve |
| Square | Splitter | 3 | Splits into 2 on death |
| Small triangle | Swarmer | 4 | Arrives in packs of 4–6 |
| Circle | Orbiter | 5 | Orbits at distance, shoots |
| Pentagon | Sniper | 6 | Laser lock-on, then a fast shot |
| Octagon | Tank | 7 | Slow, beefy |
| Triangle | Hunter | 8 | Aggressive chaser with dashes |
| 4-point star | Pulsar | 9 | Pulses out bullet rings |
| Heptagon | Blinker | 11 | Teleports next to you |
| Square | Warden | 12 | Bursts into 3 zoomers on death |
| Plus sign | Mender | 14 | Heals nearby enemies |
| Big hex | Colossus | 15 | Huge, slow, unstoppable |

**Mini-bosses** (waves 8, 13, 18, 23…; two at once from wave 28): Sentinel (spiral streams), Hive Queen (hatches swarmers), Ravager (telegraphed charges).

**Bosses** every 5 waves — rotating rings with a gap, plus aimed fans every third volley.

## Ships

Ships get strictly better with price, and the expensive ones **stack** bonuses: more damage, extra lives, multi-shot volleys, several bullet effects at once (slow, explode, burn, pierce, chain lightning, homing) and orbiting helper drones. Top of the line: Seeker → Nova → Eclipse → Omega.

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
