# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Isle of Ants" is a web-based educational programming game where students write Python code to control anteaters on a grid. It is a **multi-file static site** (HTML/CSS/JS) deployable to GitHub Pages — no backend, no build step, no server.

## Tech Stack

- **UI/rendering:** Vanilla HTML, CSS, HTML5 `<canvas>`
- **Python execution in browser:** [Skulpt](https://skulpt.org/) — a JavaScript implementation of Python
- **Code editor:** [CodeMirror](https://codemirror.net/) configured for Python syntax

## Architecture

The entire application runs client-side. Key subsystems:

1. **Setup Panel** — grid size, max turns, per-player name + CodeMirror editor
2. **Simulation Engine** (JS) — deterministic turn loop, ant movement, anteater execution via Skulpt, collision/eating resolution
3. **Renderer** (`<canvas>`) — grid, water boundary, ants, labeled anteaters, optional vector overlays
4. **Skulpt Bridge** — wraps student code, routes `print()` to Debug Panel, handles JS→Python type coercion
5. **Playback Controls** — Validate, Start, Step, Stop/Reset, Speed slider, Show Vectors toggle

## Critical Implementation Details

### Student Code Wrapping
Before passing to Skulpt, the JS engine must prepend `import math\nimport random\n`, then append the `def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):` signature, and indent the student's code block by 4 spaces.

The CodeMirror editor shows only the function body. The function signature is displayed as read-only styled HTML above the editor.

### Skulpt Configuration
- Intercept `sys.stdout` so `print()` output goes to the per-player Debug Panel, not the browser console.
- Enforce a ~200ms timeout per call to prevent infinite loops.
- Map JS `null`/`undefined` → Python `None` for `nearest_ant` (when 0 ants remain) and `nearest_anteater` (when playing solo).

### move() API
```
def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
    # returns (dx, dy) where dx, dy ∈ {-1, 0, 1}
```
- Vectors are 2-tuples of integers: `(dx, dy)` = relative position of nearest entity.
- Invalid return type/range or timeout → default to `(0, 0)`, log error to Debug Panel.

### Determinism
A fixed seed (set when `[Start]` is clicked) must control:
1. Ant random moves each turn
2. Anteater execution order each turn
3. Skulpt's `random` module inside student Python code

Re-running without code/settings changes must produce identical results.

### Nearest-Entity Calculation
- Distance: Euclidean (`sqrt(dx²+dy²)`)
- Tie-break: lowest Y first, then lowest X (reading order)

### Turn Phase Order
1. **Ant phase** — all ants move randomly; moves off-grid are canceled
2. **Anteater phase** — randomized execution order; off-grid moves canceled; eating resolved after all moves
3. **End check** — stop when max turns reached or 0 ants remain; highest score wins (ties → draw)

**Important:** `move()` is pre-computed (via `_precomputeMoves()`) at the *end* of the previous turn, after phases 1–3 complete. This means `nearest_ant` reflects ant positions from the end of the previous turn — **before** ants move in the current turn's phase 1. Moving toward `nearest_ant` does not guarantee eating that ant; it may have moved away by the time the anteater executes. This is intentional: ants are moving targets and students must anticipate their movement.

### Dev Mode ("Show Vectors")
Checkbox toggles canvas overlay: faint lines from each anteater to its `nearest_ant` and `nearest_shore`, with tuple text labels.
