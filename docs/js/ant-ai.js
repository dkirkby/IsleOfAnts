/* js/ant-ai.js — Ant movement strategy
 *
 * antMove(nearestAnt, nearestAnteater, nearestShore, currentTurn) → {dx, dy}
 *
 * Called once per ant per turn before ant movement is resolved.
 * Return any {dx, dy}; the engine snaps it to the nearest compass step.
 * Vectors use y-up convention: {dx:0, dy:1} = up, {dx:0, dy:-1} = down.
 *
 *   nearestAnt      {dx,dy} | null  — relative vector to nearest other ant
 *                                     (null when this ant is the last one)
 *   nearestAnteater {dx,dy} | null  — relative vector to nearest anteater
 *                                     (null when no players have been added)
 *   nearestShore    {dx,dy}         — relative vector to nearest water cell
 *   currentTurn     number          — 1-indexed turn number
 *
 * globalRNG is available for seeded randomness (preserves determinism).
 */

const _ANT_MOVES = [
  {dx:-1, dy:-1}, {dx:0, dy:-1}, {dx:1, dy:-1},
  {dx:-1, dy: 0}, {dx:0, dy: 0}, {dx:1, dy: 0},
  {dx:-1, dy: 1}, {dx:0, dy: 1}, {dx:1, dy: 1},
];

function antMove(nearestAnt, nearestAnteater, nearestShore, currentTurn) {
  // Pick a random compass direction with a prob 0.1 + 0.9/currentTurn
  if(globalRNG.nextFloat() < 0.1 * 0.9 * currentTurn) {
    return _ANT_MOVES[globalRNG.nextInt(9)];
  }
  // If we are adjacent to an ant, move away from it.
  const ant_dist = Math.hypot(nearestAnt.dx, nearestAnt.dy);
  if(ant_dist == 1) {
    return { dx: -nearestAnt.dx, dy: -nearestAnt.dy };
  }
  // Move towards the nearest shore if we are far enough away.
  const shore_dist = Math.hypot(nearestShore.dx, nearestShore.dy);
  if(shore_dist > 3) {
    return nearestShore;
  }
  // Otherwise, move perpendicular to the shore with CW circulation.
  return { dx: nearestShore.dy, dy: -nearestShore.dy };
}
