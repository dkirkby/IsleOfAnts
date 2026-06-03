'use strict';

const TournamentManager = (() => {

  let _state      = null;
  let _onLoadGame = null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Distribute NR players into games of size k and k-1 (no byes).
  // G = ceil(NR/k) total games: a of size k, b of size k-1, where b = G*k - NR, a = G - b.
  // Special cases:
  //   NR <= k     → one game with all players.
  //   a < 0       → no valid split exists; one game with all players.
  //   k = 2, odd  → k-1 = 1 is unplayable; merge each size-1 slot into a size-2 game → size-3.
  function _buildRound(players, k) {
    const shuffled = _shuffle([...players]);
    const NR = shuffled.length;

    if (NR <= k) {
      return [{ players: shuffled, winner: null, status: 'pending', scores: {} }];
    }

    const G = Math.ceil(NR / k);
    const b = G * k - NR;   // games of size k-1
    const a = G - b;        // games of size k

    if (a < 0) {
      return [{ players: shuffled, winner: null, status: 'pending', scores: {} }];
    }

    const games = [];
    let idx = 0;

    if (k === 2 && b > 0) {
      // b = 1 always for odd NR; merge the size-1 remainder into one size-3 game.
      for (let i = 0; i < a - b; i++, idx += 2)
        games.push({ players: shuffled.slice(idx, idx + 2), winner: null, status: 'pending', scores: {} });
      for (let i = 0; i < b; i++, idx += 3)
        games.push({ players: shuffled.slice(idx, idx + 3), winner: null, status: 'pending', scores: {} });
    } else {
      for (let i = 0; i < a; i++, idx += k)
        games.push({ players: shuffled.slice(idx, idx + k), winner: null, status: 'pending', scores: {} });
      for (let i = 0; i < b; i++, idx += k - 1)
        games.push({ players: shuffled.slice(idx, idx + k - 1), winner: null, status: 'pending', scores: {} });
    }

    return games;
  }

  function _stripSignature(code) {
    const lines = code.split('\n');
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith('def move(')) { startIdx = i + 1; break; }
    }
    const bodyLines = lines.slice(startIdx);
    const nonEmpty = bodyLines.filter(l => l.trim().length > 0);
    const minIndent = nonEmpty.length === 0 ? 0
      : nonEmpty.reduce((m, l) => Math.min(m, l.match(/^( *)/)[1].length), Infinity);
    return bodyLines.map(l => l.slice(minIndent)).join('\n').trim();
  }

  function _validatePlayers(raw) {
    if (!Array.isArray(raw) || raw.length === 0)
      return { error: 'JSON must be a non-empty array' };
    const players = [];
    for (let i = 0; i < raw.length; i++) {
      const obj = raw[i];
      if (typeof obj !== 'object' || obj === null) return { error: `Item ${i}: not an object` };
      if (typeof obj.name !== 'string')             return { error: `Item ${i}: missing "name" string` };
      if (!('alias' in obj))                        return { error: `Item ${i}: missing "alias" key` };
      if (typeof obj.code !== 'string')             return { error: `Item ${i}: missing "code" string` };
      const name = (obj.alias && typeof obj.alias === 'string') ? obj.alias : obj.name;
      players.push({ name, code: _stripSignature(obj.code), totalScore: 0 });
    }
    if (players.length < 2) return { error: 'Need at least 2 players' };
    return { players };
  }

  // ── Public: isActive ───────────────────────────────────────────────────────

  function isActive() { return _state !== null; }

  // ── Public: recordResult ───────────────────────────────────────────────────

  function recordResult(engineState) {
    if (!_state || !_state.activeGame) return false;
    const { roundIdx, gameIdx } = _state.activeGame;
    const game = _state.rounds[roundIdx].games[gameIdx];
    if (game.status !== 'active') return false;

    // Record per-player scores and accumulate totals.
    const scores = {};
    for (const a of engineState.anteaters) scores[a.name] = a.score;
    game.scores = scores;
    game.status = 'complete';
    for (const p of game.players) p.totalScore += scores[p.name] ?? 0;

    // Determine game winner with random tiebreak (for bracket advancement).
    const maxScore   = Math.max(...Object.values(scores));
    const topPlayers = game.players.filter(p => (scores[p.name] ?? 0) === maxScore);
    game.winner      = topPlayers[Math.floor(Math.random() * topPlayers.length)];
    _state.activeGame = null;

    const round     = _state.rounds[roundIdx];
    const roundDone = round.games.every(g => g.status === 'complete');
    if (roundDone) {
      const winners = round.games.map(g => g.winner).filter(Boolean);
      if (winners.length <= 1) {
        // Final game complete: rank finalists by final-game score, then cumulative total.
        const finalGame = round.games[0];
        const ranked = [...finalGame.players].sort((x, y) => {
          const sx = finalGame.scores[x.name] ?? 0;
          const sy = finalGame.scores[y.name] ?? 0;
          if (sy !== sx) return sy - sx;
          return y.totalScore - x.totalScore;
        });
        _state.podium = ranked.slice(0, Math.min(3, ranked.length));
      } else {
        _state.currentRound++;
        _state.rounds.push({ games: _buildRound(winners, _state.k) });
      }
    }
    return true;
  }

  // ── Bracket rendering ──────────────────────────────────────────────────────

  function _renderGame(ri, gi, game) {
    const canClick = ri === _state.currentRound && game.status === 'pending' && !_state.activeGame;
    const box = document.createElement('div');
    box.className = `bracket-game bracket-game--${game.status}${canClick ? ' bracket-game--clickable' : ''}`;

    for (const p of game.players) {
      const row   = document.createElement('div');
      const isWin = game.winner && game.winner.name === p.name;
      row.className = 'bracket-player' + (isWin ? ' bracket-player--winner' : '');
      const score = game.scores[p.name];
      row.textContent = p.name + (score !== undefined ? ` — ${score}` : '');
      box.appendChild(row);
    }
    if (game.status === 'active') {
      const lbl = document.createElement('div');
      lbl.className = 'bracket-active-label';
      lbl.textContent = 'in progress';
      box.appendChild(lbl);
    }

    if (canClick) {
      box.title = 'Click to load this game';
      box.addEventListener('click', () => {
        game.status       = 'active';
        _state.activeGame = { roundIdx: ri, gameIdx: gi };
        document.getElementById('tournament-schedule-modal').classList.add('hidden');
        _onLoadGame(game.players);
      });
    }
    return box;
  }

  function _renderBracket() {
    const container = document.getElementById('tournament-bracket');
    container.innerHTML = '';
    if (!_state) return;

    const wrap = document.createElement('div');
    wrap.className = 'bracket-wrap';

    _state.rounds.forEach((round, ri) => {
      if (ri > 0) {
        const conn = document.createElement('div');
        conn.className = 'bracket-connector';
        conn.textContent = '▶';
        wrap.appendChild(conn);
      }
      const col = document.createElement('div');
      col.className = 'bracket-col';
      const lbl = document.createElement('div');
      lbl.className = 'bracket-round-label';
      lbl.textContent = `Round ${ri + 1}`;
      col.appendChild(lbl);
      round.games.forEach((game, gi) => col.appendChild(_renderGame(ri, gi, game)));
      wrap.appendChild(col);
    });

    if (_state.podium) {
      const conn = document.createElement('div');
      conn.className = 'bracket-connector';
      conn.textContent = '▶';
      wrap.appendChild(conn);

      const col = document.createElement('div');
      col.className = 'bracket-col';
      const lbl = document.createElement('div');
      lbl.className = 'bracket-round-label bracket-round-label--podium';
      lbl.textContent = 'Podium';
      col.appendChild(lbl);

      const box = document.createElement('div');
      box.className = 'bracket-game bracket-game--podium';
      const placeLabels   = ['1st', '2nd', '3rd'];
      const placeClasses  = ['bracket-player--podium-1', 'bracket-player--podium-2', 'bracket-player--podium-3'];
      const finalGame     = _state.rounds[_state.rounds.length - 1].games[0];
      _state.podium.forEach((p, i) => {
        const row   = document.createElement('div');
        row.className = `bracket-player ${placeClasses[i]}`;
        const score = finalGame.scores[p.name];
        row.textContent = `${placeLabels[i]}  ${p.name}${score !== undefined ? ` — ${score}` : ''}`;
        box.appendChild(row);
      });
      col.appendChild(box);
      wrap.appendChild(col);
    }

    container.appendChild(wrap);
  }

  // ── Public: openSchedule ───────────────────────────────────────────────────

  function openSchedule() {
    _renderBracket();
    document.getElementById('tournament-schedule-modal').classList.remove('hidden');
  }

  // ── Public: init ───────────────────────────────────────────────────────────

  function init(onLoadGame) {
    _onLoadGame = onLoadGame;

    // Setup modal
    const setupModal      = document.getElementById('tournament-setup-modal');
    const fileInput       = document.getElementById('tournament-file');
    const perGameInput    = document.getElementById('tournament-per-game');
    const startConfirmBtn = document.getElementById('tournament-start-confirm');
    const preview         = document.getElementById('tournament-player-preview');
    let loadedPlayers     = null;

    setupModal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn =>
      btn.addEventListener('click', () => setupModal.classList.add('hidden'))
    );
    setupModal.addEventListener('click', e => {
      if (e.target === setupModal) setupModal.classList.add('hidden');
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          const raw    = JSON.parse(evt.target.result);
          const result = _validatePlayers(raw);
          if (result.error) throw new Error(result.error);
          loadedPlayers = result.players;

          preview.innerHTML = '';
          const count = document.createElement('div');
          count.className = 'tournament-preview-count';
          count.textContent = `${loadedPlayers.length} player${loadedPlayers.length !== 1 ? 's' : ''} loaded`;
          preview.appendChild(count);
          const ul = document.createElement('ul');
          ul.className = 'tournament-preview-list';
          loadedPlayers.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            ul.appendChild(li);
          });
          preview.appendChild(ul);
          preview.classList.remove('hidden');
          startConfirmBtn.disabled = false;
        } catch (err) {
          preview.innerHTML = '';
          const msg = document.createElement('div');
          msg.className = 'tournament-error';
          msg.textContent = err.message;
          preview.appendChild(msg);
          preview.classList.remove('hidden');
          loadedPlayers = null;
          startConfirmBtn.disabled = true;
        }
      };
      reader.readAsText(file);
    });

    startConfirmBtn.addEventListener('click', () => {
      if (!loadedPlayers) return;
      const k = Math.max(2, parseInt(perGameInput.value, 10) || 4);
      _state = {
        k, currentRound: 0, activeGame: null, podium: null,
        rounds: [{ games: _buildRound(loadedPlayers, k) }],
      };
      setupModal.classList.add('hidden');
      document.getElementById('tournament-btn').textContent = 'Open Tournament';
      openSchedule();
    });

    // Schedule modal
    const scheduleModal = document.getElementById('tournament-schedule-modal');
    scheduleModal.querySelectorAll('.modal-close').forEach(btn =>
      btn.addEventListener('click', () => scheduleModal.classList.add('hidden'))
    );
    scheduleModal.addEventListener('click', e => {
      if (e.target === scheduleModal) scheduleModal.classList.add('hidden');
    });

    // Main button
    document.getElementById('tournament-btn').addEventListener('click', () => {
      if (_state) {
        openSchedule();
      } else {
        fileInput.value = '';
        preview.innerHTML = '';
        preview.classList.add('hidden');
        startConfirmBtn.disabled = true;
        loadedPlayers = null;
        setupModal.classList.remove('hidden');
      }
    });
  }

  return { init, isActive, recordResult, openSchedule };
})();
