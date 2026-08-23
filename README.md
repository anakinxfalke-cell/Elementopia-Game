# Elementopia

A peaceful-but-competitive first-person 3D browser game. Each round,
pick one of four elements — flame, water, nature, or wind — and race
three rival collectors to gather all of it first. Built with vanilla
JS and Three.js (loaded from a CDN, no build step).

## Play locally

Requires Python 3 (already on macOS).

```
cd Elementopia
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser (Chrome/Firefox/Safari).

## How to play

- Pick an element on the start screen — that's your goal for the round.
- The three other elements are automatically assigned to three rival
  collectors who wander the field gathering their own element.
- Walk into any item matching your chosen element to collect it
  automatically. Your progress and the rivals' progress both show
  in the corners of the screen.
- Collect all of your element first and you win the round — +100
  coins, saved between visits. If a rival finishes their set first,
  the round is lost — try again with the same or a different element.

## Controls

- Click an element card to start; click the canvas to (re)lock the mouse
- W A S D — move
- Mouse — look around
- Esc — pause (opens Settings / Restart / Quit)
- ⚙️ (top-right) — Settings: mouse sensitivity, movement speed, fullscreen
- ⛶ (top-right) — toggle fullscreen directly

## Tech

- Three.js (via CDN import map, `three@0.166.0`)
- No npm/build tools — plain HTML/CSS/JS, served by Python's
  built-in http.server for local development
- Coin total persists in the browser via `localStorage`

## Credits

- Flame, water, and wave sprites (`assets/flame.svg`, `assets/water.svg`,
  `assets/wave.svg`): [Twemoji](https://github.com/jdecked/twemoji),
  licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Tornado sprite (`assets/tornado.png`): cropped from a public-domain
  [NOAA/NSSL photo](https://commons.wikimedia.org/wiki/File:Piedmont_and_Mulhall_tornadoes_-_NOAA.jpg)
  of the May 3, 1999 Piedmont–Mulhall, Oklahoma tornadoes.
