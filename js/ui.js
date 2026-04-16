/* js/ui.js — Milestone 1: DOM wiring for setup panel shell */

// Distinct player colors (used for swatches, anteater rendering, scoreboard)
const PLAYER_COLORS = [
  '#4e9af1', // blue
  '#f178b6', // pink
  '#4ecf7a', // green
  '#f0a830', // amber
  '#c792ea', // purple
  '#f78c6c', // orange
  '#89ddff', // cyan
  '#ff5572', // red
];

let playerCount = 0;

function getColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// ---- Grid size sync --------------------------------------------------
const gridSizeInput = document.getElementById('grid-size');
const gridSizeEcho  = document.getElementById('grid-size-echo');

gridSizeInput.addEventListener('input', () => {
  gridSizeEcho.textContent = gridSizeInput.value;
});

// ---- Speed slider label sync -----------------------------------------
const speedSlider = document.getElementById('speed-slider');
const speedLabel  = document.getElementById('speed-label');

speedSlider.addEventListener('input', () => {
  speedLabel.textContent = speedSlider.value;
});

// ---- Add Player ------------------------------------------------------
document.getElementById('add-player-btn').addEventListener('click', () => {
  addPlayer(`Player ${playerCount + 1}`);
});

function addPlayer(name) {
  const index = playerCount++;
  const color = getColor(index);
  const id    = `player-${index}`;

  // ---- Player card (editor + debug together) ----
  const card = document.createElement('div');
  card.className = 'player-card';
  card.dataset.playerId = id;

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

  card.querySelector('.btn-remove').addEventListener('click', () => {
    removePlayer(card, id);
  });

  document.getElementById('player-list').appendChild(card);

  // ---- CodeMirror ----
  const cm = CodeMirror.fromTextArea(document.getElementById(`cm-${id}`), {
    mode:        'python',
    theme:       'dracula',
    lineNumbers: true,
    indentUnit:  4,
    tabSize:     4,
    indentWithTabs: false,
    extraKeys: {
      Tab:        (cm) => cm.execCommand('indentMore'),
      'Shift-Tab':(cm) => cm.execCommand('indentLess'),
    },
  });
  card._cm = cm;

  // ---- Scoreboard row ----
  const scoreBody = document.getElementById('score-body');
  const tr = document.createElement('tr');
  tr.dataset.playerId = id;
  tr.innerHTML = `
    <td><span class="score-swatch" style="background:${color}"></span>
        <span class="score-player-name">${name}</span></td>
    <td class="score-value">0</td>
  `;
  scoreBody.appendChild(tr);

  // Keep scoreboard name in sync with name input
  card.querySelector('.player-name').addEventListener('input', (e) => {
    tr.querySelector('.score-player-name').textContent = e.target.value || '(unnamed)';
  });
}

function removePlayer(card, id) {
  if (card._cm) card._cm.toTextArea();
  card.remove();

  const row = document.querySelector(`#score-body [data-player-id="${id}"]`);
  if (row) row.remove();
}
