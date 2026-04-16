/* js/renderer.js — Canvas renderer (Milestone 6)
 *
 * Public API:
 *   new Renderer(canvas, gridSize)
 *   renderer.gridSize = n          — update before draw when grid changes
 *   renderer.draw(state, showVectors)
 *     state: object from engine.getState(), or null for empty island
 *     showVectors: boolean — Dev Mode overlay
 */

'use strict';

// Colours that match the Tropical Terminal theme.
const _WATER_FILL  = '#07151f';
const _ISLAND_FILL = '#0f2518';
const _ANT_FILL    = '#d4a020';   // amber
const _ANT_GLOW    = 'rgba(212,160,32,0.45)';
const _VEC_ANT     = { line: 'rgba(212,160,32,0.55)',  dot: '#d4a020',  label: '#e8b830' };
const _VEC_SHORE   = { line: 'rgba(74,184,216,0.55)',  dot: '#4ab8d8',  label: '#5ecce8' };

class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number}            gridSize   — mutable via renderer.gridSize
   */
  constructor(canvas, gridSize) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.gridSize = gridSize;
    this._scaleForDPR();
  }

  // -----------------------------------------------------------------------
  // draw — full redraw every frame
  // -----------------------------------------------------------------------

  draw(state, showVectors = false) {
    const { ctx, canvas, gridSize } = this;
    // Use CSS logical dimensions (set by _scaleForDPR).
    // canvas.width/height are physical pixels and must NOT be used here
    // because ctx.scale(dpr,dpr) has already been applied.
    const W = this._drawW || canvas.width;
    const H = this._drawH || canvas.height;

    // Layout: a fixed-pixel water border around the island.
    const PAD  = Math.round(Math.min(W, H) * 0.05);
    const GRID = Math.min(W, H) - 2 * PAD;
    const cell = GRID / gridSize;

    // Canvas-pixel centre of grid cell (gx, gy).
    const cx = gx => PAD + (gx + 0.5) * cell;
    const cy = gy => PAD + (gy + 0.5) * cell;

    // ── 1. Water ─────────────────────────────────────────────────────────
    ctx.fillStyle = _WATER_FILL;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial shimmer on water.
    const wg = ctx.createRadialGradient(W/2, H/2, GRID * 0.3, W/2, H/2, W * 0.72);
    wg.addColorStop(0, 'rgba(14,60,80,0.0)');
    wg.addColorStop(1, 'rgba(4,20,35,0.45)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, H);

    // ── 2. Island ────────────────────────────────────────────────────────
    ctx.fillStyle = _ISLAND_FILL;
    ctx.fillRect(PAD, PAD, GRID, GRID);

    // Radial centre-brightening — makes the island feel lit from above.
    const ig = ctx.createRadialGradient(
      PAD + GRID / 2, PAD + GRID / 2, 0,
      PAD + GRID / 2, PAD + GRID / 2, GRID * 0.65
    );
    ig.addColorStop(0, 'rgba(36,68,30,0.45)');
    ig.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ig;
    ctx.fillRect(PAD, PAD, GRID, GRID);

    // ── 3. Grid lines ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= gridSize; i++) {
      const p = PAD + i * cell;
      ctx.beginPath(); ctx.moveTo(p, PAD);        ctx.lineTo(p, PAD + GRID); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, p);        ctx.lineTo(PAD + GRID, p); ctx.stroke();
    }

    if (!state) return;   // empty island drawn — nothing else to paint

    // ── 4. Ants ──────────────────────────────────────────────────────────
    const antR = Math.max(2, cell * 0.22);

    ctx.save();
    ctx.shadowColor = _ANT_GLOW;
    ctx.shadowBlur  = antR * 2.5;
    ctx.fillStyle   = _ANT_FILL;

    // Batch all ants into one path for performance.
    ctx.beginPath();
    for (const ant of state.ants) {
      const ax = cx(ant.x), ay = cy(ant.y);
      ctx.moveTo(ax + antR, ay);
      ctx.arc(ax, ay, antR, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    // ── 5. Dev Mode vector overlays (drawn before anteaters so labels sit on top) ──
    if (showVectors) {
      for (const eater of state.anteaters) {
        const ex = cx(eater.x), ey = cy(eater.y);
        if (eater.nearestAnt)   this._drawVector(ex, ey, eater.nearestAnt,   cell, _VEC_ANT);
        if (eater.nearestShore) this._drawVector(ex, ey, eater.nearestShore, cell, _VEC_SHORE);
      }
    }

    // ── 6. Anteaters ─────────────────────────────────────────────────────
    const eaterR = Math.max(4, cell * 0.38);

    for (const eater of state.anteaters) {
      const ex = cx(eater.x), ey = cy(eater.y);

      // Drop shadow.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur  = 6;
      ctx.shadowOffsetY = 2;

      // Filled body.
      ctx.beginPath();
      ctx.arc(ex, ey, eaterR, 0, Math.PI * 2);
      ctx.fillStyle = eater.color;
      ctx.fill();
      ctx.restore();

      // Dark ring outline.
      ctx.beginPath();
      ctx.arc(ex, ey, eaterR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Bright inner highlight.
      const hlg = ctx.createRadialGradient(
        ex - eaterR * 0.3, ey - eaterR * 0.35, 0,
        ex, ey, eaterR
      );
      hlg.addColorStop(0, 'rgba(255,255,255,0.30)');
      hlg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(ex, ey, eaterR, 0, Math.PI * 2);
      ctx.fillStyle = hlg;
      ctx.fill();

      // Name label (hidden at very small cell sizes).
      if (cell >= 15) {
        const fontSize = Math.min(11, Math.max(7, Math.floor(cell * 0.38)));
        ctx.font         = `600 ${fontSize}px "DM Sans", sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        const lx = ex;
        const ly = ey + eaterR + 3;
        // Shadow pass for readability on any background.
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(eater.name, lx + 1, ly + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(eater.name, lx, ly);
      }
    }

    // ── 7. HUD — ant count (bottom-left) and turn progress (bottom-right) ──
    this._drawHUD(ctx, state, W, PAD, GRID);
  }

  _drawHUD(ctx, state, W, PAD, GRID) {
    const antCount  = state.ants.length;
    const turn      = state.turn;
    const maxTurns  = state.maxTurns ?? '?';

    // Vertical centre of the bottom water border.
    const y = PAD + GRID + PAD / 2;

    ctx.font         = `500 11px "DM Sans", sans-serif`;
    ctx.textBaseline = 'middle';

    // Ant count — bottom-left
    const antText = `${antCount} ant${antCount !== 1 ? 's' : ''}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(antText, PAD + 1, y + 1);
    ctx.fillStyle = '#d4a020';
    ctx.fillText(antText, PAD, y);

    // Turn progress — bottom-right
    const turnText = `${turn} / ${maxTurns}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(turnText, PAD + GRID + 1, y + 1);
    ctx.fillStyle = '#7a9080';
    ctx.fillText(turnText, PAD + GRID, y);
  }

  // -----------------------------------------------------------------------
  // Private: draw a vector arrow with a mid-point label
  // -----------------------------------------------------------------------

  _drawVector(ox, oy, vec, cell, palette) {
    const { ctx } = this;
    const tx = ox + vec.dx * cell;
    const ty = oy + vec.dy * cell;

    // Dashed line from anteater centre to target.
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small dot at the target end.
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fillStyle = palette.dot;
    ctx.fill();

    // Tuple label at the midpoint.
    const mx   = (ox + tx) / 2;
    const my   = (oy + ty) / 2;
    const text = `(${vec.dx}, ${vec.dy})`;

    ctx.font         = '9px "JetBrains Mono", monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Pill background for legibility.
    const tw = ctx.measureText(text).width;
    const ph = 13, pw = tw + 8, pr = 3;
    const bx = mx - pw / 2, by = my - ph / 2;
    ctx.fillStyle = 'rgba(6,14,10,0.78)';
    ctx.beginPath();
    ctx.roundRect(bx, by, pw, ph, pr);
    ctx.fill();

    ctx.fillStyle = palette.label;
    ctx.fillText(text, mx, my);
  }

  // -----------------------------------------------------------------------
  // DPR scaling — crisp rendering on retina displays
  // -----------------------------------------------------------------------

  _scaleForDPR() {
    const dpr    = window.devicePixelRatio || 1;
    const canvas = this.canvas;
    const css    = canvas.getBoundingClientRect();
    if (css.width === 0) return;
    // Setting canvas.width resets the transform, so do it before ctx.scale.
    canvas.width  = Math.round(css.width  * dpr);
    canvas.height = Math.round(css.height * dpr);
    this.ctx.scale(dpr, dpr);
    // Store CSS logical dimensions: after ctx.scale, draw() must use these
    // (not canvas.width/height which are physical pixels).
    this._drawW = css.width;
    this._drawH = css.height;
  }
}
