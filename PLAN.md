# Isle of Ants — Implementation Plan

## File Layout

```
index.html          # single page shell, all panels
css/style.css       # layout and visual theme
js/rng.js           # seeded PRNG (shared by engine + Skulpt bridge)
js/engine.js        # simulation state and turn logic
js/skulpt-bridge.js # code wrapping, Skulpt execution, stdout capture
js/renderer.js      # canvas drawing, Dev Mode overlays
js/ui.js            # DOM wiring: setup panel, controls, scoreboard, debug panel
```

CDN dependencies (no build step):
- Skulpt (`skulpt.min.js` + `skulpt-stdlib.js`)
- CodeMirror 5 (core + Python mode + default theme)

---

## Milestone 1 — Static Shell & Layout

**Goal:** All UI panels are present and styled; no logic yet.

### Tasks
- Create `index.html` with three top-level sections:
  - **Setup Panel** — grid size input, max turns input, "Add Player" button, player list container
  - **Simulation Panel** — `<canvas>`, playback controls bar, scoreboard, Dev Mode checkbox
  - **Debug Panel** — per-player collapsible debug output area
- Create `css/style.css` with a two-column layout (setup left, simulation right) and readable typography.
- Load CodeMirror and Skulpt via CDN in `<head>`; verify both load without console errors.

### Acceptance Criteria
- [ ] Page renders without errors in Chrome and Firefox.
- [ ] All buttons, inputs, and the canvas element are visible and labeled correctly.
- [ ] CodeMirror and Skulpt CDN scripts load (check Network tab — both 200 OK).

---

## Milestone 2 — Player Setup & CodeMirror Editors

**Goal:** Users can add/remove players; each player gets a working Python editor.

### Tasks
- Implement `ui.js`: `addPlayer(name)` dynamically injects a player card into the Setup Panel.
- Each player card contains:
  - A name text input pre-filled with the provided name.
  - Read-only styled HTML showing the function signature:
    `def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):`
  - A CodeMirror instance (Python mode, line numbers on) bound to a `<textarea>` for the function body.
  - A "Remove" button that deletes the card and its CodeMirror instance.
- Seed the editor with a minimal default body (e.g., `return (0, 0)`).

### Acceptance Criteria
- [ ] Clicking "Add Player" appends a new player card with a functional CodeMirror editor.
- [ ] Removing a player removes only that card; remaining editors are unaffected.
- [ ] Syntax highlighting and auto-indent work in the editor.
- [ ] The function signature above the editor is visually distinct (e.g., monospace, muted color) and not editable.

---

## Milestone 3 — Seeded PRNG

**Goal:** A single shared PRNG that produces deterministic, seedable sequences.

### Tasks
- Implement `js/rng.js` exporting a `SeededRNG` class using a portable algorithm (e.g., Mulberry32 or xoshiro128**).
- API: `new SeededRNG(seed)`, `.nextFloat()` → `[0,1)`, `.nextInt(n)` → `[0,n)`, `.shuffle(array)` → in-place Fisher-Yates.
- Expose a module-level `setGlobalSeed(seed)` and `globalRNG` instance used by `engine.js`.

### Acceptance Criteria
- [ ] `new SeededRNG(42).nextFloat()` returns the same value on every call, in any browser.
- [ ] Two instances with the same seed produce identical sequences.
- [ ] `shuffle` is a correct Fisher-Yates using the seeded RNG (not `Math.random`).
- [ ] Console test: 5 sequential values from seed `0` can be hardcoded and verified by inspection.

---

## Milestone 4 — Skulpt Bridge

**Goal:** Student Python code can be executed in the browser with `print()` captured and errors surfaced.

### Tasks
- Implement `js/skulpt-bridge.js` exporting `compilePlayer(playerObj)` and `callMove(playerObj, nearestAnt, nearestAnteater, nearestShore, currentTurn)`.
- `compilePlayer`:
  - Wrap body: prepend `import math\nimport random\n`, append the `def move(...)` signature, indent body by 4 spaces.
  - Run Skulpt in "compile only" mode to surface syntax errors before the simulation starts.
  - Return `{ ok: true }` or `{ ok: false, error: string }`.
- `callMove`:
  - Configure `Sk.builtinFiles`, `Sk.configure({ output: fn, ... })` to route `print()` to a caller-supplied callback.
  - Pass arguments: vectors as Python tuples; `None` for absent entities (JS `null` → `Sk.builtin.none.none$`).
  - Enforce a ~200 ms timeout using a `Promise` race.
  - Validate the return value: must be a 2-tuple of integers each in `{-1, 0, 1}`.
  - On timeout, runtime error, or invalid return → return `{ dx: 0, dy: 0, error: string }`.
- **Skulpt `random` seeding:** After establishing the global seed, call into Skulpt to set `random.seed(globalSeed)` so student code draws from the same deterministic stream.

### Acceptance Criteria
- [ ] A player with `return (1, 0)` returns `{ dx: 1, dy: 0 }`.
- [ ] `print("hello")` from student code invokes the output callback, not `console.log`.
- [ ] A syntax error in the body surfaces in `compilePlayer` with a line number referencing the student's code (not the wrapper offset).
- [ ] An infinite loop (`while True: pass`) is caught within ~200 ms and returns `{ dx: 0, dy: 0, error: "timeout" }`.
- [ ] Passing `null` for `nearestAnt` results in Python receiving `None` (verify with `print(nearest_ant is None)`).
- [ ] Invalid return `(5, 0)` is rejected and returns `{ dx: 0, dy: 0, error: ... }`.

---

## Milestone 5 — Simulation Engine

**Goal:** The core turn loop runs correctly and deterministically.

### Tasks
- Implement `js/engine.js` exporting `SimulationEngine` class.
- Constructor accepts `{ gridSize, maxTurns, players, seed }`.
- `init()`: place ants randomly (density configurable, default ~20% of cells), place each anteater at a random grid cell, set scores to 0, reset turn counter.
- `step()`: execute one full turn:
  1. **Ant phase:** for each ant, pick random `(dx, dy)` from the 9-element set `{-1,0,1}²` using `globalRNG`; cancel moves that leave the grid.
  2. **Anteater phase:** shuffle anteaters with `globalRNG.shuffle`; for each, compute `nearestAnt`, `nearestAnteater`, `nearestShore` using Euclidean distance + reading-order tie-break; call `callMove`; validate bounds; resolve eating.
  3. Increment turn counter; check end condition.
- `nearestOf(origin, targets)`: pure function, unit-testable, returns the nearest target or `null`.
- `nearestShoreVector(pos, gridSize)`: returns vector to closest boundary cell.
- `getState()`: returns a snapshot `{ ants, anteaters, scores, turn, done, winner }` consumed by the renderer.

### Acceptance Criteria
- [ ] `step()` with a fixed seed produces identical state snapshots across multiple runs.
- [ ] Ants at the grid boundary never move off-grid.
- [ ] Anteaters at the boundary never move off-grid.
- [ ] An anteater on the same cell as 3 ants gains 3 points; those 3 ants are removed.
- [ ] Simulation ends when `turn === maxTurns` or `ants.length === 0`.
- [ ] `nearestOf` correctly returns the reading-order winner among equidistant targets (unit test with a constructed scenario).
- [ ] With 0 ants, `nearestAnt` passed to `callMove` is `null`.
- [ ] With 1 player, `nearestAnteater` passed to `callMove` is `null`.

---

## Milestone 6 — Canvas Renderer

**Goal:** The simulation state is drawn clearly on the canvas each frame.

### Tasks
- Implement `js/renderer.js` exporting `Renderer(canvas, gridSize)`.
- `draw(state, showVectors)`:
  - Fill grid background (island color).
  - Draw a water/shore border around the outer edge.
  - Draw each ant as a small filled circle (distinct color).
  - Draw each anteater as a larger filled circle in a player-assigned color with the player's name label.
  - If `showVectors` is true: for each anteater, draw a faint line + tuple label to `nearestAnt` and `nearestShore` using the vectors from `state`.
- Scale cells to fill the canvas; support non-square grids.

### Acceptance Criteria
- [ ] A 20×20 grid renders with all cells visible and no overflow.
- [ ] Ants and anteaters are visually distinguishable at default grid size.
- [ ] Each anteater is labeled with the player name.
- [ ] "Show Vectors" checkbox toggles the overlay on/off without restarting the simulation.
- [ ] Vector labels show the correct tuple string matching the value passed to `callMove` that turn.
- [ ] Canvas redraws correctly after `step()` removes ants.

---

## Milestone 7 — Playback Controls & Full Integration

**Goal:** All controls work end-to-end; the simulation can be validated, run, stepped, and reset.

### Tasks
- Wire up `ui.js` to `engine.js`, `renderer.js`, and `skulpt-bridge.js`:
  - **Validate Code:** call `compilePlayer` for each player; display errors in Debug Panel; block Start if any fail.
  - **Start:** read settings from Setup Panel; call `engine.init()`; set seed; begin `setInterval` loop calling `step()` + `renderer.draw()` at rate determined by speed slider.
  - **Step:** call `engine.step()` + `renderer.draw()` once; update scoreboard.
  - **Stop/Reset:** clear interval; call `engine.init()`; re-draw initial state; clear Debug Panels.
  - **Speed slider:** range 1–10; maps to interval delay (e.g., 1000 ms down to 50 ms).
  - **Scoreboard:** update after each step to show current scores.
  - **Debug Panel:** `callMove` output callback appends timestamped text; errors shown in red with line numbers.
  - **End state:** when `state.done`, stop the loop, display winner/draw message prominently.
- Disable Start/Step during a running simulation; disable Stop/Reset when idle.

### Acceptance Criteria
- [ ] Validate with a syntax error shows the error in the correct player's Debug Panel and disables Start.
- [ ] Start runs the simulation automatically; Stop halts it; Reset clears the board to initial positions.
- [ ] Step advances exactly one turn; clicking Step repeatedly produces the same sequence as Start at the slowest speed.
- [ ] Speed slider visibly changes animation pace.
- [ ] Scoreboard increments live during auto-play.
- [ ] `print()` output from student code appears in that player's Debug Panel during the simulation.
- [ ] At end-of-simulation, a message declares the winner or "Draw: [names]".
- [ ] Re-running (Stop/Reset → Start) without changing code or settings produces the identical sequence of board states.

---

## Milestone 8 — Polish & Edge Cases

**Goal:** Robust handling of corner cases; usable on GitHub Pages.

### Tasks
- Handle 0 players (ants move randomly until max turns; no winner declared).
- Handle grid sizes from 5×5 to 50×50 without layout breakage.
- Adjust Skulpt line-number offset: syntax/runtime error messages must reference the student's line numbers, not the wrapper's.
- Confirm CDN URLs are pinned to stable versions (no `@latest`).
- Verify all features work on GitHub Pages (no `file://` path assumptions).
- Add a brief usage note at the top of `index.html` as an HTML comment for future maintainers.

### Acceptance Criteria
- [ ] 0-player simulation runs to completion silently.
- [ ] A 5×5 grid and a 50×50 grid both render without overflow or invisible cells.
- [ ] A runtime error inside the student's `move` body (e.g., `1/0`) reports line 1, not line 4 or 5 (accounting for wrapper offset).
- [ ] Opening `index.html` directly from a GitHub Pages URL loads and runs correctly.
- [ ] No `console.error` output during a normal simulation run.
