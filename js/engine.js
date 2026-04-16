/* js/engine.js — Simulation engine (Milestone 5)
 *
 * Public API:
 *   new SimulationEngine({ gridSize, maxTurns, players, seed, antDensity? })
 *   engine.init()           → Promise<void>  — reset & seed everything
 *   engine.step()           → Promise<void>  — advance one full turn
 *   engine.getState()       → StateSnapshot  — immutable snapshot for renderer
 *
 * Pure helpers (exposed for unit-testing):
 *   SimulationEngine.nearestOf(origin, targets)          → {dx,dy} | null
 *   SimulationEngine.nearestShoreVector(pos, gridSize)   → {dx,dy}
 *
 * Depends on globals from rng.js (globalRNG, setGlobalSeed) and
 * skulkt-bridge.js (callMove, seedSkulkt).
 */

'use strict';

// All 9 possible unit moves (including stay-in-place).
const _MOVES = [
  {dx:-1, dy:-1}, {dx:0, dy:-1}, {dx:1, dy:-1},
  {dx:-1, dy: 0}, {dx:0, dy: 0}, {dx:1, dy: 0},
  {dx:-1, dy: 1}, {dx:0, dy: 1}, {dx:1, dy: 1},
];

class SimulationEngine {
  /**
   * @param {{
   *   gridSize:   number,
   *   maxTurns:   number,
   *   players:    Array<{id, name, color, cm}>,
   *   seed:       number,
   *   antDensity: number   (optional, default 0.20)
   * }} opts
   */
  constructor({ gridSize, maxTurns, players, seed, antDensity = 0.20 }) {
    this.gridSize   = gridSize;
    this.maxTurns   = maxTurns;
    this.players    = players;
    this.seed       = seed;
    this.antDensity = antDensity;

    this.ants      = [];
    this.anteaters = [];
    this.turn      = 0;
    this.done      = false;
    this.winner    = null;
  }

  // -----------------------------------------------------------------------
  // init — call once before the first step() (or to restart)
  // -----------------------------------------------------------------------

  async init() {
    const { gridSize, antDensity } = this;

    // Seed JS PRNG and Skulkt random module with the same value.
    setGlobalSeed(this.seed);
    await seedSkulkt(this.seed);

    // Place ants on random distinct cells (~antDensity of the grid).
    const totalCells = gridSize * gridSize;
    const allCells = Array.from({ length: totalCells }, (_, i) => ({
      x: i % gridSize,
      y: Math.floor(i / gridSize),
    }));
    globalRNG.shuffle(allCells);
    const numAnts = Math.round(totalCells * antDensity);
    this.ants = allCells.slice(0, numAnts).map(c => ({ x: c.x, y: c.y, prevX: c.x, prevY: c.y }));

    // Place each anteater at a random cell (overlaps allowed).
    this.anteaters = this.players.map(player => ({
      player,
      x: globalRNG.nextInt(gridSize),
      y: globalRNG.nextInt(gridSize),
      score: 0,
      // Stored each turn for Dev Mode vector overlay.
      lastNearestAnt:      null,
      lastNearestAnteater: null,
      lastNearestShore:    null,
    }));

    this.turn   = 0;
    this.done   = false;
    this.winner = null;
  }

  // -----------------------------------------------------------------------
  // step — advance exactly one turn
  // -----------------------------------------------------------------------

  async step() {
    if (this.done) return;

    const { gridSize } = this;

    // ── Phase 1: Ant movement (first-come-first-served) ─────────────────
    // Track occupied cells so no two ants share a cell after moving.
    const _key = (x, y) => x * gridSize + y;
    const occupied = new Set(this.ants.map(a => _key(a.x, a.y)));

    for (const ant of this.ants) {
      ant.prevX = ant.x;
      ant.prevY = ant.y;
      const m  = _MOVES[globalRNG.nextInt(9)];
      const nx = ant.x + m.dx;
      const ny = ant.y + m.dy;
      // Free this ant's cell before testing the target, so that stay-in-place
      // (0,0) and moves into a vacated cell are both handled correctly.
      occupied.delete(_key(ant.x, ant.y));
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !occupied.has(_key(nx, ny))) {
        ant.x = nx;
        ant.y = ny;
      }
      occupied.add(_key(ant.x, ant.y));
    }

    // ── Phase 2: Anteater movement ───────────────────────────────────────
    // Randomise execution order each turn.
    const order = globalRNG.shuffle([...this.anteaters]);

    for (const eater of order) {
      const origin = { x: eater.x, y: eater.y };

      // Vectors to nearest entities — null when none exist.
      const otherEaters = this.anteaters
        .filter(a => a !== eater)
        .map(a => ({ x: a.x, y: a.y }));

      // Exclude ants on the anteater's own cell — they will be eaten this turn.
      const visibleAnts     = this.ants.filter(a => !(a.x === eater.x && a.y === eater.y));
      const nearestAnt      = SimulationEngine.nearestOf(origin, visibleAnts);
      const nearestAnteater = SimulationEngine.nearestOf(origin, otherEaters);
      const nearestShore    = SimulationEngine.nearestShoreVector(origin, gridSize);

      // Store for Dev Mode.
      eater.lastNearestAnt      = nearestAnt;
      eater.lastNearestAnteater = nearestAnteater;
      eater.lastNearestShore    = nearestShore;

      // Run the player's Python move() function.
      const result = await callMove(
        eater.player,
        nearestAnt,       // null when ants.length === 0
        nearestAnteater,  // null when playing solo
        nearestShore,
        this.turn + 1,    // 1-indexed current turn
      );

      // Route debug output / errors to the player's panel.
      if (result.output.length > 0 || result.error) {
        this._appendDebug(eater.player.id, result.output, result.error);
      }

      // Apply move, cancelling it if it would leave the grid.
      const nx = eater.x + result.dx;
      const ny = eater.y - result.dy;   // student uses y-up; grid uses y-down
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        eater.x = nx;
        eater.y = ny;
      }
    }

    // ── Phase 3: Eating ──────────────────────────────────────────────────
    // Resolved after ALL anteaters have moved.
    for (const eater of this.anteaters) {
      const eaten = this.ants.filter(a => a.x === eater.x && a.y === eater.y);
      if (eaten.length > 0) {
        eater.score += eaten.length;
        this.ants = this.ants.filter(a => !(a.x === eater.x && a.y === eater.y));
      }
    }

    // ── End-condition check ──────────────────────────────────────────────
    this.turn++;
    if (this.turn >= this.maxTurns || this.ants.length === 0) {
      this.done = true;
      this._resolveWinner();
    }
  }

  // -----------------------------------------------------------------------
  // getState — immutable snapshot consumed by the renderer and UI
  // -----------------------------------------------------------------------

  getState() {
    return {
      ants: this.ants.map(a => ({ x: a.x, y: a.y, prevX: a.prevX, prevY: a.prevY })),
      anteaters: this.anteaters.map(a => ({
        x:     a.x,
        y:     a.y,
        name:  a.player.name,
        color: a.player.color,
        id:    a.player.id,
        score: a.score,
        nearestAnt:      a.lastNearestAnt,
        nearestAnteater: a.lastNearestAnteater,
        nearestShore:    a.lastNearestShore,
      })),
      scores:   Object.fromEntries(this.anteaters.map(a => [a.player.id, a.score])),
      turn:     this.turn,
      maxTurns: this.maxTurns,
      done:     this.done,
      winner:   this.winner,  // null | { type:'win', name } | { type:'draw', names:[] }
    };
  }

  // -----------------------------------------------------------------------
  // Pure static helpers
  // -----------------------------------------------------------------------

  /**
   * Return the relative vector {dx, dy} from origin to the nearest target,
   * using Euclidean distance with reading-order tie-breaking
   * (lowest y wins; if still tied, lowest x wins).
   *
   * @param {{x,y}}   origin
   * @param {{x,y}[]} targets
   * @returns {{dx,dy} | null}
   */
  static nearestOf(origin, targets) {
    if (!targets || targets.length === 0) return null;

    let best     = null;
    let bestDist = Infinity;

    for (const t of targets) {
      const dx   = t.x - origin.x;
      const dy   = t.y - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const closer = dist < bestDist;
      const tied   = dist === bestDist;
      const better = tied && (
        t.y < best.y ||
        (t.y === best.y && t.x < best.x)
      );

      if (closer || better) {
        best     = t;
        bestDist = dist;
      }
    }

    return { dx: best.x - origin.x, dy: -(best.y - origin.y) };
  }

  /**
   * Return the relative vector from pos to the nearest out-of-bounds
   * (shore) cell.  Shore cells are the ring just outside the grid:
   *   left  x = -1,         right  x = gridSize,
   *   top   y = -1,         bottom y = gridSize.
   *
   * Tie-break by reading order applied to the shore target coordinates.
   *
   * @param {{x,y}} pos
   * @param {number} gridSize
   * @returns {{dx,dy}}
   */
  static nearestShoreVector(pos, gridSize) {
    // Four candidate shore cells (one per cardinal direction).
    const candidates = [
      { tx: pos.x,    ty: -1,       dx: 0,                 dy: -(pos.y + 1) },
      { tx: -1,       ty: pos.y,    dx: -(pos.x + 1),      dy: 0            },
      { tx: gridSize, ty: pos.y,    dx: gridSize - pos.x,  dy: 0            },
      { tx: pos.x,    ty: gridSize, dx: 0,                 dy: gridSize - pos.y },
    ];

    let best     = null;
    let bestDist = Infinity;

    for (const c of candidates) {
      const dist = Math.sqrt(c.dx * c.dx + c.dy * c.dy);

      const closer = dist < bestDist;
      const tied   = dist === bestDist;
      const better = tied && (
        c.ty < best.ty ||
        (c.ty === best.ty && c.tx < best.tx)
      );

      if (closer || better) {
        best     = c;
        bestDist = dist;
      }
    }

    return { dx: best.dx, dy: -best.dy };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  _resolveWinner() {
    if (this.anteaters.length === 0) {
      this.winner = null;
      return;
    }
    const maxScore = Math.max(...this.anteaters.map(a => a.score));
    const winners  = this.anteaters.filter(a => a.score === maxScore);
    this.winner = winners.length === 1
      ? { type: 'win',  name:  winners[0].player.name }
      : { type: 'draw', names: winners.map(a => a.player.name) };
  }

  _appendDebug(playerId, outputLines, error) {
    const el = document.getElementById(`debug-${playerId}`);
    if (!el) return;
    if (outputLines.length > 0) el.textContent += outputLines.join('');
    if (error)                  el.textContent += `[ERROR] ${error}\n`;
    el.scrollTop = el.scrollHeight;
  }
}
