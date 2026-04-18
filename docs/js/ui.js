/* js/ui.js — DOM wiring */

'use strict';

// ========================================================================
// Renderer bootstrap — draw the empty island on first paint
// ========================================================================
const _canvas   = document.getElementById('game-canvas');
const _renderer = new Renderer(_canvas, parseInt(document.getElementById('grid-size').value, 10) || 50);

requestAnimationFrame(() => {
  _renderer._scaleForDPR();
  _renderer.draw(null);
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
const gridSizeInput   = document.getElementById('grid-size');
const gridSizeEcho    = document.getElementById('grid-size-echo');
const maxTurnsInput   = document.getElementById('max-turns');
const antDensityInput = document.getElementById('ant-density');
const speedSlider     = document.getElementById('speed-slider');
const speedLabel      = document.getElementById('speed-label');
const showTrailsEl    = document.getElementById('show-trails');

gridSizeInput.addEventListener('input', () => {
  const n = Math.max(5, Math.min(50, parseInt(gridSizeInput.value, 10) || 20));
  gridSizeEcho.textContent = n;
  _renderer.gridSize = n;
  _configDirty = true;
  _renderer.draw(null);
  _updateHUD(null);
  _syncButtons();
});

maxTurnsInput.addEventListener('input', () => {
  _configDirty = true;
  _renderer.draw(null);
  _updateHUD(null);
  _syncButtons();
});

antDensityInput.addEventListener('input', () => {
  _configDirty = true;
  _renderer.draw(null);
  _updateHUD(null);
  _syncButtons();
});

speedSlider.addEventListener('input', () => {
  speedLabel.textContent = speedSlider.value;
  if (_running) { clearTimeout(_timer); _scheduleNext(); }
});

showTrailsEl.addEventListener('change', () => {
  if (_engine) _renderer.draw(_engine.getState(), _hoverHighlight, showTrailsEl.checked);
});

// ========================================================================
// Param hover tooltip & vector highlight
// ========================================================================
const _tooltip = document.createElement('div');
_tooltip.id = 'vector-tooltip';
_tooltip.classList.add('hidden');
document.body.appendChild(_tooltip);

let _hoverHighlight = null;   // { eaterId, param } | null

/** Format a state value (vector, number, or null) as a Python literal. */
function _fmtParamValue(value) {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'object' && 'dx' in value) return `(${value.dx}, ${value.dy})`;
  return String(value);
}

function _onParamEnter(span, card, param) {
  if (!_engine || _configDirty) return;
  const state    = _engine.getState();
  const eaterId  = card.dataset.playerId;
  const eater    = state.anteaters.find(a => a.id === eaterId);
  if (!eater) return;

  const valueMap = {
    nearest_ant:      eater.nearestAnt,
    nearest_anteater: eater.nearestAnteater,
    nearest_shore:    eater.nearestShore,
    current_turn:     state.turn + 1,
  };
  _tooltip.textContent = _fmtParamValue(valueMap[param]);
  _tooltip.classList.remove('hidden');
  _positionTooltip(span);

  if (param !== 'current_turn') {
    _hoverHighlight = { eaterId, param };
    _renderer.draw(state, _hoverHighlight, showTrailsEl.checked);
  }
}

function _onParamLeave() {
  _tooltip.classList.add('hidden');
  _hoverHighlight = null;
  if (_engine && !_configDirty) _renderer.draw(_engine.getState(), null, showTrailsEl.checked);
}

function _positionTooltip(el) {
  const r = el.getBoundingClientRect();
  _tooltip.style.left = `${r.left + r.width / 2}px`;
  _tooltip.style.top  = `${r.top - 6}px`;
}

// ========================================================================
// Player cards
// ========================================================================
document.getElementById('add-player-btn').addEventListener('click', () => {
  addPlayer(`Player ${playerCount + 1}`);
  _configDirty = true;
  _renderer.draw(null);
  _updateHUD(null);
  _syncButtons();
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
      <span class="fn"> move</span>(<span class="param" data-param="nearest_ant">nearest_ant</span>,
      <span class="param" data-param="nearest_anteater">nearest_anteater</span>,
      <span class="param" data-param="nearest_shore">nearest_shore</span>,
      <span class="param" data-param="current_turn">current_turn</span>):
    </div>
    <textarea id="cm-${id}">return (0, 0)</textarea>
    <div class="debug-label">Debug Output</div>
    <div class="debug-output" id="debug-${id}"></div>
  `;

  card.querySelector('.btn-remove').addEventListener('click', () => _removePlayer(card, id));
  document.getElementById('player-list').appendChild(card);

  // Param hover listeners
  card.querySelectorAll('.fn-signature [data-param]').forEach(span => {
    const param = span.dataset.param;
    span.addEventListener('mouseenter', () => _onParamEnter(span, card, param));
    span.addEventListener('mouseleave', _onParamLeave);
  });

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
  _configDirty = true;
  _renderer.draw(null);
  _updateHUD(null);
  _syncButtons();
}

// ========================================================================
// Simulation state
// ========================================================================
let _engine      = null;   // SimulationEngine | null
let _running     = false;  // auto-play active
let _timer       = null;   // setTimeout handle
let _busy        = false;  // awaiting engine.step()
let _configDirty = false;  // config changed after Init — Play blocked until re-Init

// ── Button references ────────────────────────────────────────────────────
const btnInit     = document.getElementById('btn-init');
const btnPlay     = document.getElementById('btn-play');
const btnStep     = document.getElementById('btn-step');
const btnPause    = document.getElementById('btn-pause');

function _syncInputs() {
  const editable = !_engine || _engine.turn === 0;
  gridSizeInput.disabled   = !editable;
  maxTurnsInput.disabled   = !editable;
  antDensityInput.disabled = !editable;
  document.getElementById('add-player-btn').disabled = !editable;
  document.querySelectorAll('.btn-remove').forEach(btn => btn.disabled = !editable);
}

function _syncEditors() {
  const editable = !_engine || _engine.turn === 0;
  document.querySelectorAll('.player-card').forEach(card => {
    if (card._cm) card._cm.setOption('readOnly', editable ? false : 'nocursor');
  });
}

function _syncButtons() {
  btnInit.disabled     = _running;
  btnPlay.disabled     = !_engine || _running || (_engine?.done ?? false) || _configDirty;
  btnStep.disabled     = !_engine || _running || (_engine?.done ?? false) || _busy || _configDirty;
  btnPause.disabled    = !_running;
}

// ── Scoreboard & result ──────────────────────────────────────────────────
function _updateScores(state) {
  for (const a of state.anteaters) {
    const td = document.querySelector(`#score-body [data-player-id="${a.id}"] .score-value`);
    if (td) td.textContent = a.score;
  }
}

function _updateHUD(state) {
  const antCount = state ? state.ants.length : null;
  const turn     = state ? state.turn        : null;
  const maxTurns = state ? state.maxTurns    : null;
  document.getElementById('stat-ants').textContent =
    antCount !== null ? `${antCount} ant${antCount !== 1 ? 's' : ''}` : '';
  document.getElementById('stat-turn').textContent =
    turn !== null ? `${turn} / ${maxTurns}` : '';
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

  _configDirty    = false;
  _hoverHighlight = null;
  const state = _engine.getState();
  _updateScores(state);
  _updateHUD(state);
  _renderer.draw(state, null, showTrailsEl.checked);
  _syncInputs();
  _syncEditors();
  _syncButtons();
}

/** Advance one turn, redraw, update scores, handle end condition. */
async function _doStep() {
  if (!_engine || _engine.done || _busy) return;
  _busy = true;
  _syncButtons();

  await _engine.step();

  const state = _engine.getState();
  _renderer.draw(state, _hoverHighlight, showTrailsEl.checked);
  _updateScores(state);
  _updateHUD(state);
  _busy = false;

  if (state.done) {
    _running = false;
    clearTimeout(_timer);
    _timer = null;
    _showResult(state.winner);
  }
  _syncInputs();
  _syncEditors();
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

// Init — validate first; stop if any errors; otherwise initialise engine
btnInit.addEventListener('click', async () => {
  if (_running) return;

  // Implicit validation before initialising
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
});

// Play — resume auto-play from current state (requires Init first)
btnPlay.addEventListener('click', () => {
  if (!_engine || _running || _engine.done) return;
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

// Pause — halt auto-play, preserve current state
btnPause.addEventListener('click', () => {
  _running = false;
  clearTimeout(_timer);
  _timer = null;
  _syncButtons();
});

// ========================================================================
// Canvas resize (drag handle)
// ========================================================================

let _canvasUserWidth = null;   // null = fill available width (CSS default)

function _rescaleAndDraw() {
  _renderer._scaleForDPR();
  const state = (_engine && !_configDirty) ? _engine.getState() : null;
  _renderer.draw(state, _hoverHighlight, showTrailsEl.checked);
  _updateHUD(state);
}

function _applyCanvasWidth(px) {
  const maxW = document.getElementById('simulation-panel').getBoundingClientRect().width;
  const w    = Math.max(120, Math.min(Math.round(px), maxW));
  _canvasUserWidth = w;
  const wrap = document.getElementById('canvas-wrap');
  wrap.style.width     = w + 'px';
  wrap.style.alignSelf = 'flex-start';
  _rescaleAndDraw();
}

window.addEventListener('resize', () => {
  if (_canvasUserWidth !== null) {
    _applyCanvasWidth(_canvasUserWidth);  // re-clamp to new max
  } else {
    requestAnimationFrame(_rescaleAndDraw);
  }
});

const _canvasResizeHandle = document.getElementById('canvas-resize-handle');
let _resizeDragging = false;
let _resizeStartX   = 0;
let _resizeStartW   = 0;

_canvasResizeHandle.addEventListener('mousedown', e => {
  e.preventDefault();
  _resizeDragging            = true;
  _resizeStartX              = e.clientX;
  _resizeStartW              = document.getElementById('canvas-wrap').getBoundingClientRect().width;
  document.body.style.cursor     = 'nwse-resize';
  document.body.style.userSelect = 'none';
});

window.addEventListener('mousemove', e => {
  if (!_resizeDragging) return;
  _applyCanvasWidth(_resizeStartW + (e.clientX - _resizeStartX));
});

window.addEventListener('mouseup', () => {
  if (!_resizeDragging) return;
  _resizeDragging                = false;
  document.body.style.cursor     = '';
  document.body.style.userSelect = '';
});

// Initial state
_syncInputs();
_syncEditors();
_syncButtons();
_applyCanvasWidth(window.innerHeight / 2);
