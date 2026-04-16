/* js/skulkt-bridge.js — Skulkt execution bridge (Milestone 4)
 *
 * Public API:
 *   seedSkulkt(seed)                                         → Promise<void>
 *   compilePlayer(player)                                    → { ok, error? }
 *   callMove(player, nearestAnt, nearestAnteater,
 *            nearestShore, currentTurn)                      → Promise<{ dx, dy, error, output }>
 *
 * Code structure injected around the student's body:
 *   Line 1:  import math
 *   Line 2:  import random
 *   Line 3:  def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
 *   Line 4+: <student code, indented 4 spaces>
 *   (+ call line appended only for callMove, not compilePlayer)
 */

'use strict';

const _OFFSET = 3;       // wrapper lines before student code
const _TIMEOUT = 200;    // ms

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _builtinRead(x) {
  if (!Sk.builtinFiles?.files?.[x]) throw new Error('File not found: ' + x);
  return Sk.builtinFiles.files[x];
}

/**
 * Build the complete Python script.
 * argStr: Python-literal argument string for the move() call, or null for
 *         compile-check (no call appended).
 */
function _buildScript(body, argStr) {
  const indented = body.split('\n').map(l => '    ' + l).join('\n');
  let src =
    'import math\n' +
    'import random\n' +
    'def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):\n' +
    indented + '\n';
  if (argStr !== null) src += `_result = move(${argStr})\n`;
  return src;
}

/**
 * Convert a JS value to an embeddable Python literal.
 *   null/undefined          → None
 *   { dx, dy } (vector)     → (dx, dy)
 *   number                  → verbatim
 */
function _toLiteral(val) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'object' && 'dx' in val) return `(${val.dx}, ${val.dy})`;
  return String(val);
}

/**
 * Format a Skulkt exception for display, adjusting line numbers so they
 * refer to the student's code (not the wrapper).
 */
function _fmtError(e) {
  // Skulkt TimeLimitError
  if (e.tp$name === 'TimeLimitError') {
    return 'Timeout: code took too long — infinite loop?';
  }
  // JS-level timeout sentinel
  if (e.message === 'timeout') {
    return 'Timeout: code took too long — infinite loop?';
  }

  // Extract the Python error message
  let msg = '';
  if (e.args?.v?.length > 0) {
    msg = e.args.v[0]?.v ?? e.toString();
  } else {
    msg = e.message || e.toString();
  }

  // Strip Skulkt's own "on line N of <filename>" decoration — we'll reformat
  msg = msg.replace(/\s+on line \d+ of <[^>]+>/g, '').trim();

  // Adjust line number from the deepest traceback frame
  let lineNo = e.lineno ?? null;
  if (e.traceback?.length > 0) {
    lineNo = e.traceback[e.traceback.length - 1].lineno ?? lineNo;
  }

  if (lineNo !== null) {
    const studentLine = Math.max(1, lineNo - _OFFSET);
    return `Line ${studentLine}: ${msg}`;
  }
  return msg || e.toString();
}

/**
 * Validate and extract (dx, dy) from the Python _result tuple.
 * Throws a descriptive Error on any problem.
 */
function _extractResult(mod) {
  const pyResult = mod.$d['_result'];
  if (pyResult === undefined) {
    throw new Error('move() did not return a value');
  }
  if (!(pyResult instanceof Sk.builtin.tuple)) {
    throw new Error(`move() must return a tuple, got ${pyResult.tp$name ?? typeof pyResult}`);
  }
  if (pyResult.v.length !== 2) {
    throw new Error(`move() must return a 2-tuple, got ${pyResult.v.length}-tuple`);
  }

  const values = pyResult.v.map((v, i) => {
    // Accept int; also accept float that is a whole number (e.g. 1.0)
    if (v instanceof Sk.builtin.int_)   return v.v;
    if (v instanceof Sk.builtin.float_) {
      if (Number.isInteger(v.v)) return v.v;
    }
    throw new Error(`move() tuple[${i}] must be an integer, got ${v.tp$name ?? typeof v}`);
  });

  const [dx, dy] = values;
  if (![-1, 0, 1].includes(dx) || ![-1, 0, 1].includes(dy)) {
    throw new Error(`move() values must each be -1, 0, or 1 — got (${dx}, ${dy})`);
  }
  return { dx, dy };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed Skulkt's random module to match the simulation seed.
 * Must be called once after setGlobalSeed() before the first callMove().
 */
async function seedSkulkt(seed) {
  Sk.configure({ read: _builtinRead });
  await Sk.misceval.asyncToPromise(() =>
    Sk.importMainWithBody('<skulkt-seed>', false,
      `import random\nrandom.seed(${seed >>> 0})\n`, true)
  );
}

/**
 * Syntax-check a player's code without running it.
 * @param {{ cm: CodeMirror.Editor }} player
 * @returns {{ ok: boolean, error?: string }}
 */
function compilePlayer(player) {
  const body = player.cm.getValue();
  const src  = _buildScript(body, null);
  try {
    Sk.compile(src, '<player>', 'exec', false, false);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: _fmtError(e) };
  }
}

/**
 * Execute the player's move() function and return the result.
 * Never throws — errors are captured and returned in the `error` field.
 *
 * @param {{ cm: CodeMirror.Editor }}   player
 * @param {{ dx, dy } | null}  nearestAnt       null when no ants remain
 * @param {{ dx, dy } | null}  nearestAnteater  null when playing solo
 * @param {{ dx, dy }}         nearestShore
 * @param {number}             currentTurn      integer ≥ 1
 * @returns {Promise<{ dx: number, dy: number, error: string|null, output: string[] }>}
 */
async function callMove(player, nearestAnt, nearestAnteater, nearestShore, currentTurn) {
  const argStr = [
    _toLiteral(nearestAnt),
    _toLiteral(nearestAnteater),
    _toLiteral(nearestShore),
    String(currentTurn),
  ].join(', ');

  const src    = _buildScript(player.cm.getValue(), argStr);
  const output = [];

  Sk.configure({
    output: (text) => { output.push(text); },
    read:   _builtinRead,
    execLimit: _TIMEOUT,
  });

  let mod;
  try {
    const run = Sk.misceval.asyncToPromise(() =>
      Sk.importMainWithBody('<player>', false, src, true)
    );
    // Belt-and-suspenders: JS timer in case Skulkt's execLimit doesn't fire
    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), _TIMEOUT + 100)
    );
    mod = await Promise.race([run, timer]);
  } catch (e) {
    return { dx: 0, dy: 0, error: _fmtError(e), output };
  }

  try {
    const { dx, dy } = _extractResult(mod);
    return { dx, dy, error: null, output };
  } catch (e) {
    return { dx: 0, dy: 0, error: e.message, output };
  }
}
