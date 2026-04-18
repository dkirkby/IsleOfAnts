# Isle of Ants — Tutorial

A hands-on introduction for students who have completed ~3 weeks of an intro Python course.

---

## Activity 1 — Explore the Island

**Goal:** Get oriented with the app before writing any code.

- Load the page; identify the **Setup** panel across the top and the **Simulation** panel below it
- Note the scoreboard area on the left of the simulation panel, but do not click **Add Player** for this activity
- Click **Init** to generate an island populated with ants; click it several more times and notice how the island shape and ant distribution change each time
- Click **Play** and watch the ants move: each turn every ant takes one random step (up, down, left, right, or diagonal); moves that would leave the island or land on an already-occupied cell are canceled
- Play automatically stops when Max Turns is reached (default 100) or all ants have been eaten
- Enable **Show Trails** and re-run — each ant displays a short line pointing back toward the cell it just came from, showing the direction of its last move
- Click **Stop**, then use **Step** to advance exactly one turn at a time and observe individual ant movements
- Try changing **Grid** or **Max Turns** in the Setup panel (this requires a new **Init** before the changes take effect)

*Key ideas:* the island is randomly generated each Init; ants move on their own with no player input.

---

## Activity 2 — Your First Move

**Goal:** Add a player, understand the code editor, and control an anteater with a fixed return value.

- Click **Add Player**; observe the code editor appear with the read-only function signature above and the editable body (`return (0, 0)`) below. Ignore the function signature for now.
- Click on "Player 1" above the code and enter your name.
- Click **Init**; identify the anteater on the island — it is a colored circle containing a white ×.
- Click **Play** and observe that your anteater stays put while ants move around it.
- Each time an ant randomly moves onto your tile, your score (top left) increases by one.
- The code `return (0, 0)` instructs your anteater to not move. This is visually indicated by the white ×.
- You can only edit the code when there is no simulation in process: click **Pause** if necessary, then **Init**.
- Change the code to `return (1, 0)` then click **Init**. Notice the white × is replaced by an arrow pointing one cell to the right: the value `(1, 0)` means change `x` by 1 and change `y` by 0.
- Click **Step** several times and watch your anteater move right one cell per turn until it reaches the shore
- Explain the `(dx, dy)` convention: `dx` is left/right (positive = right), `dy` is up/down (positive = down)
- Try changing the return value to move in all eight possible compass directions (N,NE,E,SE,S,SW,W,NW)
- Observe that a move into the water is canceled — the anteater stays put rather than leaving the island

*Key ideas:* adding a player; `(dx, dy)` return tuple; eight directions; shore boundary; × marker for `(0, 0)`; arrow for other return values.

---

## Activity 3 — Reading the Inputs

**Goal:** Understand what the function receives each turn.

- Hover over each argument name in the function signature to see its current value after Init
- Use `print()` to display `nearest_ant`, `nearest_shore`, and `current_turn` inside `move()`
- Init and Step a few turns; watch the Debug Output panel update each turn
- Note how the values change as the anteater and ants move

*Key ideas:* the `(dx, dy)` tuple is a relative vector (direction + distance); `None` when no ants remain; `print()` for debugging.

---

## Activity 4 — Chase the Nearest Ant

**Goal:** Write code that moves toward an ant.

- Check whether `nearest_ant` is `None` before using it
- Use `nearest_ant[0]` and `nearest_ant[1]` to extract the components
- Return a move in the direction of the ant (hint: you can return `nearest_ant` directly and the app will snap it to the nearest step)
- Run and observe — does the anteater catch ants?

*Key ideas:* indexing a tuple; the `None` guard; the snap-to-direction behavior.

---

## Activity 5 — Debugging with Step

**Goal:** Use the step-by-step controls and vector overlay to trace and fix logic.

- Introduce a deliberate bug (e.g., return `nearest_ant` without the `None` check) and observe the error in Debug Output
- Use **Step** one turn at a time to watch the anteater's decision
- Enable **Show Vectors** to see the `nearest_ant` arrow and compare it to the anteater's actual move
- Fix the bug and confirm correct behavior

*Key ideas:* reading error messages; using Step + Show Vectors as a debugger.

---

## Activity 6 — Avoid the Shore

**Goal:** Use `nearest_shore` to keep the anteater away from the edge.

- Print `nearest_shore` each turn and observe what it reports when near vs. far from shore
- Write an `if` statement: if the anteater is close to shore, move away from it; otherwise chase `nearest_ant`
- Experiment with the distance threshold

*Key ideas:* Euclidean distance from a tuple; combining two conditions with `if`/`else`.

---

## Activity 7 — Strategy Over Time

**Goal:** Use `current_turn` to change behavior as the game progresses.

- In early turns, explore (e.g., move in a fixed direction); in later turns, switch to chasing
- Try printing `current_turn` to understand the timing
- Experiment: does a two-phase strategy outperform always-chase?

*Key ideas:* `current_turn` as an integer; using a turn threshold to switch strategy.

---

## Activity 8 — Two Players

**Goal:** Add a second player and introduce competition.

- Add a second player with a different (or identical) strategy
- Observe the scoreboard and turn order randomization
- Hover over `nearest_anteater` to see its value; print it each turn
- Write code that moves *away* from the opponent when they are close

*Key ideas:* `nearest_anteater` is `None` in solo play; competitive vs. cooperative strategies.

---

## Activity 9 — Using `math` and `random`

**Goal:** Explore the pre-imported standard library modules.

- Use `math.sqrt(dx**2 + dy**2)` to compute the true distance to an ant
- Use `random.choice([(1,0),(-1,0),(0,1),(0,-1)])` to add unpredictability
- Discuss: when does randomness help or hurt?

*Key ideas:* calling functions from imported modules; distance formula; trade-off between determinism and unpredictability.

---

## Activity 10 — Open Challenge

**Goal:** Design and test a complete strategy.

- Students write their best `move()` function combining lessons from all activities
- Run head-to-head matches (add 2–3 players) with the same seed; compare scores
- Change the seed and re-run — does the ranking hold?
- Discuss: what makes a strategy robust across different seeds?

*Key ideas:* reproducibility; strategy evaluation; iteration.
