/* js/ui.js — DOM wiring (Milestones 1–2 + Milestone 7 integration) */

'use strict';

// ========================================================================
// Renderer bootstrap — draw the empty island on first paint
// ========================================================================
const _canvas   = document.getElementById('game-canvas');
const _renderer = new Renderer(_canvas, parseInt(document.getElementById('grid-size').value, 10) || 30);

requestAnimationFrame(() => {
  _renderer._scaleForDPR();
  _renderer.draw(null, false);
});

// ========================================================================
// Constants & helpers
// ========================================================================
const PLAYER_COLORS = [
  '#4e9af1', '#f178b6', '#4ecf7a', '#f0a830',
  '#c792ea', '#f78c6c', '#89ddff', '#ff5572',
];

let playerCount = 0;
const getColor = i => PLAYER_COLORS[i % PLAYER_COLORS.length];

/** Collect live player objects from the DOM. */
function getPlayers() {
  return Array.from(document.querySelectorAll('.player-card')).map(card => ({
    id:    card.dataset.playerId,
    name:  card.querySelector('.player-name').value.trim() || '(unnamed)',
    color: card.style.getPropertyValue('--player-color').trim(),
    cm:    card._cm,
  }));
}

/** speed slider value (1–10) → auto-play interval in ms (1000→50, exponential). */
const speedToDelay = v => Math.round(1000 * Math.pow(0.05, (parseInt(v, 10) - 1) / 9));

// ========================================================================
// Grid size & speed inputs
// ========================================================================
const gridSizeInput = document.getElementById('grid-size');
const gridSizeEcho  = document.getElementById('grid-size-echo');
const speedSlider   = document.getElementById('speed-slider');
const speedLabel    = document.getElementById('speed-label');
const showVectorsEl = document.getElementById('show-vectors');

gridSizeInput.addEventListener('input', () => {
  const n = Math.max(5, Math.min(50, parseInt(gridSizeInput.value, 10) || 20));
  gridSizeEcho.textContent = n;
  _renderer.gridSize = n;
  _renderer.draw(_engine ? _engine.getState() : null, showVectorsEl.checked);
});

speedSlider.addEventListener('input', () => {
  speedLabel.textContent = speedSlider.value;
  if (_running) { clearTimeout(_timer); _scheduleNext(); }
});

showVectorsEl.addEventListener('change', () => {
  if (_engine) _renderer.draw(_engine.getState(), showVectorsEl.checked);
});

// ========================================================================
// Player cards
// ========================================================================
document.getElementById('add-player-btn').addEventListener('click', () => {
  addPlayer(`Player ${playerCount + 1}`);
});

function addPlayer(name) {
  const index = playerCount++;
  const color = getColor(index);
  const id    = `player-${index}`;

  const card = document.createElement('div');
  card.className = 'player-card';
  card.dataset.playerId = id;
  card.style.setProperty('--player-color', color);

  card.innerHTML = `
    <div class="player-card-header">
      <span class="player-color-swatch" style="background:${color}"></span>
      <input type="text" class="player-name" value="${name}" placeholder="Player name">
      <button class="btn-remove" title="Remove player">×</button>
    </div>
    <div class="fn-signature">
      <span class="kw">def</span>
      <span class="fn"> move</span>(<span class="param">nearest_ant</span>,
      <span class="param">nearest_anteater</span>,
      <span class="param">nearest_shore</span>,
      <span class="param">current_turn</span>):
    </div>
    <textarea id="cm-${id}">    return (0, 0)</textarea>
    <div class="debug-label">Debug Output</div>
    <div class="debug-output" id="debug-${id}"></div>
  `;

  card.querySelector('.btn-remove').addEventListener('click', () => _removePlayer(card, id));
  document.getElementById('player-list').appendChild(card);

  const cm = CodeMirror.fromTextArea(document.getElementById(`cm-${id}`), {
    mode: 'python', theme: 'dracula', lineNumbers: true,
    indentUnit: 4, tabSize: 4, indentWithTabs: false,
    extraKeys: {
      Tab:          cm => cm.execCommand('indentMore'),
      'Shift-Tab':  cm => cm.execCommand('indentLess'),
    },
  });
  card._cm = cm;

  // Scoreboard row
  const tr = document.createElement('tr');
  tr.dataset.playerId = id;
  tr.innerHTML = `
    <td><span class="score-swatch" style="background:${color}"></span>
        <span class="score-player-name">${name}</span></td>
    <td class="score-value">0</td>
  `;
  document.getElementById('score-body').appendChild(tr);

  card.querySelector('.player-name').addEventListener('input', e => {
    tr.querySelector('.score-player-name').textContent = e.target.value || '(unnamed)';
  });
}

function _removePlayer(card, id) {
  if (card._cm) card._cm.toTextArea();
  card.remove();
  document.querySelector(`#score-body [data-player-id="${id}"]`)?.remove();
}

// ========================================================================
// Simulation state
// ========================================================================
let _engine  = null;   // SimulationEngine | null
let _running = false;  // auto-play active
let _timer   = null;   // setTimeout handle
let _busy    = false;  // awaiting engine.step()

// ── Button references ────────────────────────────────────────────────────
const btnValidate = document.getElementById('btn-validate');
const btnStart    = document.getElementById('btn-start');
const btnStep     = document.getElementById('btn-step');
const btnReset    = document.getElementById('btn-reset');

function _syncButtons() {
  btnValidate.disabled = _running;
  btnStart.disabled    = _running || (_engine?.done ?? false);
  btnStep.disabled     = _running || (_engine?.done ?? false) || _busy;
  btnReset.disabled    = !_engine;
}

// ── Scoreboard & result ──────────────────────────────────────────────────
function _updateScores(state) {
  for (const a of state.anteaters) {
    const td = document.querySelector(`#score-body [data-player-id="${a.id}"] .score-value`);
    if (td) td.textContent = a.score;
  }
}

function _showResult(winner) {
  const el = document.getElementById('result-message');
  el.className = '';
  if (!winner) { el.className = 'hidden'; return; }
  el.classList.remove('hidden');
  if (winner.type === 'win') {
    el.textContent = `Winner: ${winner.name}`;
    el.classList.add('win');
  } else {
    el.textContent = `Draw — ${winner.names.join(', ')}`;
    el.classList.add('draw');
  }
}

function _clearDebug() {
  document.querySelectorAll('.debug-output').forEach(el => el.textContent = '');
}

// ── Engine lifecycle ─────────────────────────────────────────────────────
async function _initEngine() {
  const players    = getPlayers();
  const gridSize   = Math.max(5,  Math.min(50,   parseInt(gridSizeInput.value, 10) || 30));
  const maxTurns   = Math.max(10, Math.min(1000, parseInt(document.getElementById('max-turns').value,  10) || 100));
  const antDensity = Math.max(10, Math.min(100,  parseInt(document.getElementById('ant-density').value, 10) || 30)) / 100;
  const seed       = Date.now() >>> 0;

  _clearDebug();
  document.getElementById('result-message').className = 'hidden';

  _engine = new SimulationEngine({ gridSize, maxTurns, antDensity, players, seed });
  _renderer.gridSize = gridSize;

  await _engine.init();

  const state = _engine.getState();
  _updateScores(state);
  _renderer.draw(state, showVectorsEl.checked);
  _syncButtons();
}

/** Advance one turn, redraw, update scores, handle end condition. */
async function _doStep() {
  if (!_engine || _engine.done || _busy) return;
  _busy = true;
  _syncButtons();

  await _engine.step();

  const state = _engine.getState();
  _renderer.draw(state, showVectorsEl.checked);
  _updateScores(state);
  _busy = false;

  if (state.done) {
    _running = false;
    clearTimeout(_timer);
    _timer = null;
    _showResult(state.winner);
  }
  _syncButtons();
}

function _scheduleNext() {
  if (!_running) return;
  _timer = setTimeout(async () => {
    if (!_running) return;
    await _doStep();
    if (_running && !(_engine?.done)) _scheduleNext();
  }, speedToDelay(speedSlider.value));
}

// ========================================================================
// Button handlers
// ========================================================================

// Validate — syntax-check all players, surface errors in debug panels
btnValidate.addEventListener('click', () => {
  _clearDebug();
  const players = getPlayers();
  let allOk = true;

  for (const p of players) {
    const res = compilePlayer(p);
    if (!res.ok) {
      const el = document.getElementById(`debug-${p.id}`);
      if (el) el.textContent = `[SYNTAX ERROR] ${res.error}\n`;
      allOk = false;
    }
  }

  if (allOk && players.length > 0) {
    const orig = btnValidate.textContent;
    btnValidate.textContent = 'Validate Code ✓';
    setTimeout(() => { btnValidate.textContent = orig; }, 1800);
  }
  _syncButtons();
});

// Start — validate first; stop if any errors; otherwise init + auto-play
btnStart.addEventListener('click', async () => {
  if (_running) return;

  // Implicit validation before starting
  const players = getPlayers();
  _clearDebug();
  let valid = true;
  for (const p of players) {
    const res = compilePlayer(p);
    if (!res.ok) {
      const el = document.getElementById(`debug-${p.id}`);
      if (el) el.textContent = `[SYNTAX ERROR] ${res.error}\n`;
      valid = false;
    }
  }
  if (!valid) return;

  await _initEngine();
  _running = true;
  _syncButtons();
  _scheduleNext();
});

// Step — init on first click (shows placement), then advance one turn per click
btnStep.addEventListener('click', async () => {
  if (_busy || _running) return;
  if (!_engine) {
    await _initEngine();  // show initial placement; user clicks again to advance
    return;
  }
  await _doStep();
});

// Stop / Reset — halt auto-play and reinitialise
btnReset.addEventListener('click', async () => {
  _running = false;
  clearTimeout(_timer);
  _timer = null;
  await _initEngine();
});

// Initial button state
_syncButtons();
