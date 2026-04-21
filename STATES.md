# Game State Machine

## States

### NeedsInit
**Invariant:** `_engine === null || _configDirty === true`

The initial state on page load, and whenever configuration has changed since the last Init. The canvas shows a blank grid (or the splash screen on first load).

- Player code editors: **editable**
- Game params (grid size, max turns, ant density, add/remove players): **editable**
- Play / Step buttons: **disabled**
- Init button: **enabled**

### ReadyToPlay
**Invariant:** `_engine !== null && !_configDirty && _engine.turn === 0`

An island has been generated and ants/anteaters placed. Pending-move arrows are visible. No turns have been taken yet.

- Player code editors: **editable**
- Game params: **editable**
- Play / Step buttons: **enabled**
- Init button: **enabled**

### Running
**Invariant:** `_engine !== null && !_configDirty && _engine.turn > 0`

At least one turn has been taken. The grid reflects actual simulation progress.

- Player code editors: **read-only**
- Game params: **read-only**
- Play / Step buttons: **enabled** (unless Finished sub-state)
- Init button: **enabled** (requires Pause first if auto-playing)

**Finished sub-state:** `_engine.done === true` — all ants eaten or max turns reached. Play and Step are additionally disabled; the result banner is shown. Editors and params remain locked.

---

## Transitions

| From | Event | To |
|---|---|---|
| NeedsInit | Init clicked (all code valid) | ReadyToPlay |
| NeedsInit | Init clicked (syntax error) | NeedsInit (engine cleared) |
| ReadyToPlay | Play or Step clicked | Running |
| ReadyToPlay | Code edited | NeedsInit (grid cleared) |
| ReadyToPlay | Game param changed | NeedsInit (grid cleared) |
| ReadyToPlay | Init clicked | ReadyToPlay (new island) |
| Running | Init clicked | ReadyToPlay |
| Running (auto-playing) | Pause, then Init clicked | ReadyToPlay |
| Running | All ants eaten / max turns | Running → Finished |
| Running (Finished) | Init clicked | ReadyToPlay |

---

## Code Tracking

State is derived from three variables in `ui.js`:

| Variable | Role |
|---|---|
| `_engine` | `null` in NeedsInit (no successful Init yet) |
| `_engine.turn` | `0` in ReadyToPlay, `> 0` in Running |
| `_configDirty` | `true` overrides to NeedsInit even if engine exists |

`_configDirty` is set to `true` by: grid-size / max-turns / ant-density input changes, add/remove player, and CodeMirror `change` events. It is reset to `false` only by a successful `_initEngine()` call.

`_syncInputs()` and `_syncEditors()` lock inputs/editors when `_engine !== null && _engine.turn > 0` (Running), regardless of `_configDirty`. `_syncButtons()` additionally gates Play/Step on `!_configDirty`.
