# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Isle of Ants" is a web-based educational programming game where students write Python code to control anteaters on a grid. It is a **multi-file static site** (HTML/CSS/JS) deployable to GitHub Pages — no backend, no build step, no server.

## Tech Stack

- **UI/rendering:** Vanilla HTML, CSS, HTML5 `<canvas>`
- **Python execution in browser:** [Skulpt](https://skulpt.org/) — a JavaScript implementation of Python
- **Code editor:** [CodeMirror 5](https://codemirror.net/) configured for Python syntax (Dracula theme)
- **Tutorial renderer:** [marked.js](https://marked.js.org/) — client-side Markdown → HTML for `tutorial.html`

## File Structure

```
docs/
  index.html          — main game app
  tutorial.html       — tutorial shell (client-side Markdown renderer)
  css/style.css       — all styles for both pages
  js/rng.js           — SeededRNG (Mulberry32); exports globalRNG, setGlobalSeed
  js/ant-ai.js        — ant movement strategy (hidden from students); exports antMove()
  js/engine.js        — SimulationEngine class
  js/skulkt-bridge.js — Skulkt execution bridge; exports seedSkulkt, compilePlayer, callMove
  js/renderer.js      — Renderer class (canvas)
  js/ui.js            — DOM wiring, player management, button handlers
  ACTIVITY1.md        — Activity 1 content rendered by tutorial.html
  ACTIVITY2.md        — Activity 2 content
  ACTIVITY3.md        — Activity 3 content
  IsleOfAntsSplash.jpg — splash image overlaid on canvas before first Init
```

## Architecture

The entire application runs client-side. Key subsystems:

1. **Header Settings** — grid size (5–50, default 50), max turns (10–1000, default 100), ant density (5–30%, default 15%)
2. **Simulation Engine** (`engine.js`) — deterministic turn loop, island generation, ant movement, anteater execution via Skulkt, collision/eating resolution
3. **Seeded RNG** (`rng.js`) — Mulberry32 PRNG; single `globalRNG` instance shared by engine and Skulkt bridge
4. **Skulkt Bridge** (`skulkt-bridge.js`) — wraps student code, routes `print()` to per-player Debug Panel, handles JS→Python type coercion
5. **Renderer** (`renderer.js`) — draws water, island, ants, anteaters, pending-move arrows, hover vector overlays, optional trails
6. **Playback Controls** — Init, Play, Step, Pause buttons; Speed slider (1–10); Show Trails checkbox
7. **Player Cards** — dynamically added/removed; each has a name input, read-only function signature, CodeMirror editor body, and Debug Output panel
8. **Tutorial** (`tutorial.html`) — sidebar nav + client-side Markdown renderer; currently exposes Activities 1–3

## Critical Implementation Details

### Student Code Wrapping
`skulkt-bridge.js` builds the full Python script by prepending:
```python
import math
import random
def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
```
then appending the student's code body indented 4 spaces. For execution, a `_result = move(...)` call is appended; for syntax-check only (`compilePlayer`), no call is added.

The CodeMirror editor shows only the function body. The function signature is displayed as read-only styled HTML above the editor, with each parameter name as a hoverable `<span>`.

### Skulkt Configuration
- `output` callback captures `print()` text into a per-call array, which is flushed to the player's Debug Output panel.
- `execLimit: 200` (ms) enforces a per-call timeout. A belt-and-suspenders JS `setTimeout` at 300 ms also rejects the promise.
- JS `null`/`undefined` → Python `None` via `_toLiteral()`: used for `nearest_ant` (when 0 ants remain) and `nearest_anteater` (when playing solo).
- `{ dx, dy }` vectors → Python tuple literal `(dx, dy)` via `_toLiteral()`.

### move() API
```python
def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
    # return any (dx, dy) — snapped to nearest compass step
```
- Vectors passed in are 2-tuples: `(dx, dy)` = relative position of nearest entity. **`dy` is positive upward** (mathematical convention, not screen convention): `(0, 1)` means one cell above, `(0, -1)` means one cell below.
- The return value may be any `(dx, dy)` — the engine snaps it to the nearest of the 8 compass directions (including diagonals) via `_snapDirection` (atan2-based). Returning `(-3, 2)` yields move `(-1, 1)`.
- Timeout, invalid return type, or non-finite values → default to `(0, 0)`, log error to Debug Panel.
- `current_turn` is 1-indexed: the first turn's pre-computed call receives `1`.

### Determinism
A seed (`Date.now() >>> 0`) is chosen when **Init** is clicked. It is passed to both `setGlobalSeed` (JS PRNG) and `seedSkulkt` (Skulkt's `random` module). Re-clicking Init generates a new seed; re-running the same Init result is not repeatable across page loads.

The shared `globalRNG` controls:
1. Island shape generation
2. Ant random moves each turn (one `nextInt(9)` per ant)
3. Anteater execution order each turn (Fisher-Yates shuffle)

### Island Generation (`_generateIsland`)
Returns a 2-D boolean array (`true` = water, `false` = land):
1. Two octaves of bilinearly-interpolated smooth-value noise (scales ~55% and ~28% of grid size, weighted 65%/35%).
2. Radial falloff ensures water at grid edges.
3. Threshold chosen so ~72% of interior cells start as land.
4. Border row/col forced to water.
5. Keep only the largest 4-connected land region.
6. Fill enclosed inland lakes (flood-fill from border water).

### Nearest-Entity Calculation
- Distance: Euclidean (`sqrt(dx²+dy²)`)
- Tie-break: lowest Y first, then lowest X (reading order)
- `nearestOf` excludes ants occupying the same cell as the querying anteater.
- `nearestShoreVector` scans all water cells; result vector uses y-up convention (`dy: -best.dy`).

### Turn Phase Order
1. **Ant phase** — each ant calls `antMove()` (from `ant-ai.js`) with the same four args as anteaters; result snapped via `_snapDirection`; moves off-grid, into water, or onto an occupied cell are canceled (first-come-first-served with occupied-set bookkeeping)
2. **Anteater phase** — randomized execution order; pre-computed moves applied; off-grid/water moves canceled; eating resolved after **all** anteaters move
3. **End check** — stop when max turns reached or 0 ants remain; highest score wins (ties → draw)

**Important:** `move()` is pre-computed (via `_precomputeMoves()`) at the *end* of the previous turn, after phases 1–3 complete. This means `nearest_ant` reflects ant positions from the end of the previous turn — **before** ants move in the current turn's phase 1. Moving toward `nearest_ant` does not guarantee eating that ant; it may have moved away by the time the anteater executes.

### Visual Overlays
- **Pending-move arrows** — always drawn on each anteater after Init; show the move() return value (snapped to compass direction). A white × is drawn when the move is `(0, 0)` or invalid.
- **Show Trails** checkbox — draws a half-cell line from each ant/anteater back toward the cell it came from (previous position), showing direction of last move.
- **Hover tooltip + vector** — hovering over a parameter name in the read-only function signature shows a tooltip with the current value and, for vector parameters, draws a canvas arrow from the anteater in that direction.

### dy is positive upward
`(0, 1)` moves up, `(0, -1)` moves down. The engine applies `ny = eater.y - dy` to convert student y-up coordinates to screen y-down grid coordinates.
