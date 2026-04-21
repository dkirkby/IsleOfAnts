/* js/engine.js — Simulation engine (Milestone 5)
 *
 * Public API:
 *   new SimulationEngine({ gridSize, maxTurns, players, seed, antDensity? })
 *   engine.init()           → Promise<void>  — reset & seed everything
 *   engine.step()           → Promise<void>  — advance one full turn
 *   engine.getState()       → StateSnapshot  — immutable snapshot for renderer
 *
 * Pure helpers (exposed for unit-testing):
 *   SimulationEngine.nearestOf(origin, targets)                   → {dx,dy} | null
 *   SimulationEngine.nearestShoreVector(pos, gridSize, isWater)   → {dx,dy}
 *
 * Depends on globals from rng.js (globalRNG, setGlobalSeed),
 * skulkt-bridge.js (callMove, seedSkulkt), and ant-ai.js (antMove).
 */

'use strict';

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
    this._antIdCounter = 0;
  }

  // -----------------------------------------------------------------------
  // init — call once before the first step() (or to restart)
  // -----------------------------------------------------------------------

  async init() {
    const { gridSize, antDensity } = this;

    // Seed JS PRNG and Skulkt random module with the same value.
    setGlobalSeed(this.seed);
    await seedSkulkt(this.seed);

    // Generate irregular island shape.
    this.islandMask = this._generateIsland();

    // Precompute shore vector for every land cell (O(landCells × gridSize²),
    // done once here so per-turn lookups are O(1) for both ants and anteaters).
    const isWater = (x, y) => this.islandMask[y][x];
    this.shoreVectors = Array.from({ length: gridSize }, (_, y) =>
      Array.from({ length: gridSize }, (_, x) =>
        isWater(x, y) ? { dx: 0, dy: 0 }
                      : SimulationEngine.nearestShoreVector({ x, y }, gridSize, isWater)
      )
    );

    // Collect all land cells.
    const landCells = [];
    for (let y = 0; y < gridSize; y++)
      for (let x = 0; x < gridSize; x++)
        if (!this.islandMask[y][x]) landCells.push({ x, y });

    // Place ants on random distinct land cells (~antDensity of land tiles).
    globalRNG.shuffle(landCells);
    const numAnts = Math.round(landCells.length * antDensity);
    this.ants = landCells.slice(0, numAnts).map(c => ({
      id: `ant-${this._antIdCounter++}`, x: c.x, y: c.y, prevX: c.x, prevY: c.y,
    }));

    // Place each anteater at a random land cell (overlaps allowed).
    this.anteaters = this.players.map(player => {
      const c = landCells[globalRNG.nextInt(landCells.length)];
      return {
        player, x: c.x, y: c.y, prevX: c.x, prevY: c.y, score: 0,
        lastNearestAnt: null, lastNearestAnteater: null, lastNearestShore: null,
        pendingMove: null,
      };
    });

    this.turn   = 0;
    this.done   = false;
    this.winner = null;

    // Pre-compute moves so arrows are visible immediately after Init.
    await this._precomputeMoves();
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
    const eaterPositions = this.anteaters.map(a => ({ x: a.x, y: a.y }));

    for (const ant of this.ants) {
      ant.prevX = ant.x;
      ant.prevY = ant.y;

      // Build context args (same API and y-up convention as anteater move()).
      const origin        = { x: ant.x, y: ant.y };
      const nearestAnt      = SimulationEngine.nearestOf(origin, this.ants.filter(a => a !== ant));
      const nearestAnteater = SimulationEngine.nearestOf(origin, eaterPositions);
      const nearestShore    = this.shoreVectors[ant.y][ant.x];
      const raw        = antMove(nearestAnt, nearestAnteater, nearestShore, this.turn + 1);
      const { dx, dy } = SimulationEngine._snapDirection(raw.dx ?? 0, raw.dy ?? 0);

      // Free this ant's cell before testing the target, so that stay-in-place
      // (0,0) and moves into a vacated cell are both handled correctly.
      occupied.delete(_key(ant.x, ant.y));
      const nx = ant.x + dx;
      const ny = ant.y - dy;   // y-up → y-down (matches anteater convention)
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize &&
          !this.islandMask[ny][nx] && !occupied.has(_key(nx, ny))) {
        ant.x = nx;
        ant.y = ny;
      }
      occupied.add(_key(ant.x, ant.y));
    }

    // ── Phase 2: Anteater movement ───────────────────────────────────────
    // Moves were pre-computed by _precomputeMoves(); apply them now.
    // Randomise execution order each turn (consumed by globalRNG for determinism).
    const order = globalRNG.shuffle([...this.anteaters]);

    for (const eater of order) {
      // Snap the pre-computed raw move to the nearest compass direction and apply.
      const { dx, dy } = eater.pendingMove
        ? SimulationEngine._snapDirection(eater.pendingMove.dx, eater.pendingMove.dy)
        : { dx: 0, dy: 0 };
      eater.prevX = eater.x;
      eater.prevY = eater.y;
      const nx = eater.x + dx;
      const ny = eater.y - dy;   // student uses y-up; grid uses y-down
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !this.islandMask[ny][nx]) {
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

    // Pre-compute the next turn's moves so arrows are ready to display.
    if (!this.done) await this._precomputeMoves();
  }

  // -----------------------------------------------------------------------
  // getState — immutable snapshot consumed by the renderer and UI
  // -----------------------------------------------------------------------

  getState() {
    return {
      ants: this.ants.map(a => ({ id: a.id, x: a.x, y: a.y, prevX: a.prevX, prevY: a.prevY })),
      anteaters: this.anteaters.map(a => ({
        x:     a.x,
        y:     a.y,
        prevX: a.prevX,
        prevY: a.prevY,
        name:  a.player.name,
        color: a.player.color,
        id:    a.player.id,
        score: a.score,
        nearestAnt:      a.lastNearestAnt,
        nearestAnteater: a.lastNearestAnteater,
        nearestShore:    a.lastNearestShore,
        pendingMove:     a.pendingMove,
      })),
      islandMask: this.islandMask,   // shared ref — read-only for renderer
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
   * Snap an arbitrary (dx, dy) vector to the nearest of the 8 compass
   * directions (including diagonals), or return (0,0) if the input is zero
   * or non-finite.  Used to interpret the student's move() return value.
   *
   * @param {number} dx
   * @param {number} dy
   * @returns {{dx,dy}}  each component in {-1, 0, 1}
   */
  static _snapDirection(dx, dy) {
    if (!isFinite(dx) || !isFinite(dy) || (dx === 0 && dy === 0)) {
      return { dx: 0, dy: 0 };
    }
    const sector  = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const snapped = sector * (Math.PI / 4);
    return {
      dx: Math.round(Math.cos(snapped)),
      dy: Math.round(Math.sin(snapped)),
    };
  }

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
   * Return the relative vector from pos to the nearest water cell,
   * using isWater(x, y) to test in-bounds cells.
   * Tie-break: lowest y first, then lowest x (reading order).
   *
   * @param {{x,y}}              pos
   * @param {number}             gridSize
   * @param {(x,y)=>boolean}     isWater
   * @returns {{dx,dy}}
   */
  static nearestShoreVector(pos, gridSize, isWater) {
    let best     = null;
    let bestDist = Infinity;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!isWater(x, y)) continue;
        const dx   = x - pos.x;
        const dy   = y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const closer = dist < bestDist;
        const tied   = dist === bestDist;
        const better = tied && (y < best.ty || (y === best.ty && x < best.tx));

        if (closer || better) {
          best     = { tx: x, ty: y, dx, dy };
          bestDist = dist;
        }
      }
    }

    return { dx: best.dx, dy: -best.dy };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Call move() for every anteater, storing the raw result in pendingMove so
   * the renderer can display arrows before the step executes.
   * Also refreshes nearest-entity vectors (the snapshot passed to move()).
   */
  async _precomputeMoves() {
    for (const eater of this.anteaters) this._computeNearest(eater);
    for (const eater of this.anteaters) {
      const result = await callMove(
        eater.player,
        eater.lastNearestAnt,
        eater.lastNearestAnteater,
        eater.lastNearestShore,
        this.turn + 1,        // 1-indexed turn this move will execute on
      );
      eater.pendingMove = { dx: result.dx, dy: result.dy };
      if (result.output.length > 0 || result.error) {
        this._appendDebug(eater.player.id, result.output, result.error);
      }
    }
  }

  /**
   * Compute and store nearest-entity vectors on eater.lastNearest*.
   * Called for every anteater as a pre-pass before the move loop in step(),
   * so all players see a consistent start-of-turn snapshot.
   * Also called at the end of init() to seed the hover tooltips.
   */
  _computeNearest(eater) {
    const { gridSize } = this;
    const origin      = { x: eater.x, y: eater.y };
    const otherEaters = this.anteaters
      .filter(a => a !== eater)
      .map(a => ({ x: a.x, y: a.y }));
    const visibleAnts = this.ants
      .filter(a => !(a.x === eater.x && a.y === eater.y));
    eater.lastNearestAnt      = SimulationEngine.nearestOf(origin, visibleAnts);
    eater.lastNearestAnteater = SimulationEngine.nearestOf(origin, otherEaters);
    eater.lastNearestShore    = this.shoreVectors[eater.y][eater.x];
  }

  /**
   * Generate an irregular island shape using smooth value noise.
   * Returns a 2-D boolean array: true = water, false = land.
   *
   * Steps:
   *   1. Two octaves of bilinearly-interpolated lattice noise give smooth,
   *      large-scale shapes (no jagged cell-by-cell boundaries).
   *   2. A radial falloff ensures water at the grid edges.
   *   3. Keep only the largest 4-connected land region.
   *   4. Fill isolated inland lakes.
   */
  _generateIsland() {
    const N = this.gridSize;

    // ── Smooth value noise ──────────────────────────────────────────────
    const smoothstep = t => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;

    // Build a bilinearly-interpolated noise function from a random lattice
    // whose points are spaced 'scale' cells apart.
    const makeNoise = (scale) => {
      const L = Math.ceil(N / scale) + 2;
      const lat = Array.from({ length: L }, () =>
        Array.from({ length: L }, () => globalRNG.nextFloat())
      );
      const clamp = v => Math.min(v, L - 1);
      const v = (ix, iy) => lat[clamp(iy)][clamp(ix)];
      return (x, y) => {
        const fx = x / scale, fy = y / scale;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = smoothstep(fx - ix), ty = smoothstep(fy - iy);
        return lerp(
          lerp(v(ix, iy),     v(ix + 1, iy    ), tx),
          lerp(v(ix, iy + 1), v(ix + 1, iy + 1), tx),
          ty
        );
      };
    };

    // Octave 1: large-scale blob shape (~1–2 features across the grid).
    // Octave 2: medium-scale coastline variation (~3–4 features).
    const n1 = makeNoise(N * 0.55);
    const n2 = makeNoise(N * 0.28);

    // ── Compute combined field for all cells ────────────────────────────
    const field = Array.from({ length: N }, (_, y) =>
      Array.from({ length: N }, (_, x) => {
        const noise = 0.65 * n1(x, y) + 0.35 * n2(x, y);
        const rx = (x / (N - 1)) * 2 - 1;
        const ry = (y / (N - 1)) * 2 - 1;
        const r  = Math.min(1, Math.sqrt(rx * rx + ry * ry));
        return noise - r * 0.48;
      })
    );

    // Pick threshold so that the target land fraction of interior cells
    // starts as land (border row/col will be forced to water regardless).
    const targetLandFraction = 0.72;
    const allValues = [];
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++)
        allValues.push(field[y][x]);
    allValues.sort((a, b) => a - b);
    const waterIdx = Math.floor(allValues.length * (1 - targetLandFraction));
    const threshold = allValues[waterIdx];

    // ── Initial land/water grid ──────────────────────────────────────────
    const g = Array.from({ length: N }, (_, y) =>
      Array.from({ length: N }, (_, x) => field[y][x] < threshold)  // true = water
    );
    // Guarantee border is water.
    for (let i = 0; i < N; i++) g[0][i] = g[N-1][i] = g[i][0] = g[i][N-1] = true;

    // ── Keep largest connected land region (4-connectivity) ───────────────
    const vis = Array.from({ length: N }, () => new Uint8Array(N));
    let bestRegion = [];

    for (let sy = 0; sy < N; sy++) {
      for (let sx = 0; sx < N; sx++) {
        if (g[sy][sx] || vis[sy][sx]) continue;
        const region = [];
        const q = [[sx, sy]];
        vis[sy][sx] = 1;
        while (q.length) {
          const [cx, cy] = q.pop();
          region.push([cx, cy]);
          for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = cx + ddx, ny = cy + ddy;
            if (nx >= 0 && nx < N && ny >= 0 && ny < N && !g[ny][nx] && !vis[ny][nx]) {
              vis[ny][nx] = 1;
              q.push([nx, ny]);
            }
          }
        }
        if (region.length > bestRegion.length) bestRegion = region;
      }
    }

    const mask = Array.from({ length: N }, () => new Array(N).fill(true));
    for (const [x, y] of bestRegion) mask[y][x] = false;

    // ── Fill inland lakes ─────────────────────────────────────────────────
    const ocean = Array.from({ length: N }, () => new Uint8Array(N));
    const q2 = [];
    const seed = (x, y) => {
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      if (mask[y][x] && !ocean[y][x]) { ocean[y][x] = 1; q2.push([x, y]); }
    };
    for (let i = 0; i < N; i++) { seed(i, 0); seed(i, N-1); seed(0, i); seed(N-1, i); }
    while (q2.length) {
      const [cx, cy] = q2.pop();
      for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) seed(cx + ddx, cy + ddy);
    }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (mask[y][x] && !ocean[y][x]) mask[y][x] = false;

    return mask;
  }

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
