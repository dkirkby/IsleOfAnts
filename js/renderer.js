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
const _ISLAND_FILL = '#c9a84c';   // sandy yellow
const _ANT_FILL    = '#1a0d04';   // dark brown, like a real ant
const _ANT_GLOW    = 'rgba(0,0,0,0.35)';
const _VEC_COLOR = 'rgba(255,255,255,0.88)';

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

  draw(state, highlight = null, showTrails = false) {
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
    ig.addColorStop(0, 'rgba(255,235,160,0.30)');
    ig.addColorStop(1, 'rgba(120,80,10,0.18)');
    ctx.fillStyle = ig;
    ctx.fillRect(PAD, PAD, GRID, GRID);

    // ── 3. Grid lines ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= gridSize; i++) {
      const p = PAD + i * cell;
      ctx.beginPath(); ctx.moveTo(p, PAD);        ctx.lineTo(p, PAD + GRID); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, p);        ctx.lineTo(PAD + GRID, p); ctx.stroke();
    }

    if (!state) return;   // empty island drawn — nothing else to paint

    // ── 4. Ants ──────────────────────────────────────────────────────────
    const antR = Math.max(1, cell * 0.11);

    // Movement trails — from current cell centre to the cell boundary in the
    // direction of the previous cell (half a cell in that direction).
    if (showTrails) {
      ctx.strokeStyle = _ANT_FILL;
      ctx.lineWidth   = Math.max(0.5, antR * 0.5);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (const ant of state.ants) {
        if (ant.prevX !== ant.x || ant.prevY !== ant.y) {
          const ddx = ant.prevX - ant.x;
          const ddy = ant.prevY - ant.y;
          ctx.moveTo(cx(ant.x),                  cy(ant.y));
          ctx.lineTo(cx(ant.x) + ddx * cell / 2, cy(ant.y) + ddy * cell / 2);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Ant dots.
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

    // ── 5. Anteaters ─────────────────────────────────────────────────────
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

    }

    // Player trails — drawn over anteater circles.
    if (showTrails) {
      ctx.strokeStyle = _ANT_FILL;
      ctx.lineWidth   = Math.max(0.5, eaterR * 0.3);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      for (const eater of state.anteaters) {
        if (eater.prevX !== eater.x || eater.prevY !== eater.y) {
          const ddx = eater.prevX - eater.x;
          const ddy = eater.prevY - eater.y;
          ctx.moveTo(cx(eater.x),                  cy(eater.y));
          ctx.lineTo(cx(eater.x) + ddx * cell / 2, cy(eater.y) + ddy * cell / 2);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── 6. Hover vector overlay (drawn over anteaters) ────────────────────
    if (highlight) {
      const eater = state.anteaters.find(a => a.id === highlight.eaterId);
      if (eater) {
        const ex = cx(eater.x), ey = cy(eater.y);
        const vecMap = {
          nearest_ant:      eater.nearestAnt,
          nearest_anteater: eater.nearestAnteater,
          nearest_shore:    eater.nearestShore,
        };
        const vec = vecMap[highlight.param];
        if (vec) this._drawVector(ex, ey, vec, cell);
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

  _drawVector(ox, oy, vec, cell) {
    const { ctx } = this;
    const tx = ox + vec.dx * cell;
    const ty = oy - vec.dy * cell;   // vec uses y-up; canvas uses y-down

    // Direction and perpendicular unit vectors.
    const ldx = tx - ox, ldy = ty - oy;
    const len = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
    const ux = ldx / len, uy = ldy / len;
    const px = -uy,       py = ux;

    // Arrowhead dimensions (scale with cell, capped so they stay tidy).
    const ah = Math.min(cell * 0.38, 13);  // head length
    const aw = ah * 0.48;                  // half-width at base

    // Base of arrowhead (line ends here so it doesn't poke through).
    const bx = tx - ux * ah, by = ty - uy * ah;

    // Solid shaft.
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = _VEC_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Filled arrowhead triangle.
    ctx.beginPath();
    ctx.moveTo(tx,           ty);
    ctx.lineTo(bx + px * aw, by + py * aw);
    ctx.lineTo(bx - px * aw, by - py * aw);
    ctx.closePath();
    ctx.fillStyle = _VEC_COLOR;
    ctx.fill();
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
