# Activity 4 — Debugging

**Goal:** Use `print()`, the Debug Output panel, and Step to trace your code's behavior and understand error messages.

---

## 1. Add a print Statement

Starting from your Activity 3 code (`return nearest_ant`), add a `print()` call before the return:

```python
print("Turn", current_turn, "nearest_ant =", nearest_ant)
return nearest_ant
```

Click **Init**, then click **Step** several times. Watch the **Debug Output** panel below your code editor — a new line appears after each turn showing the values your function received.

> **Tip:** The Debug Output panel accumulates output across all turns. Click **Init** to clear it and start fresh.

---

## 2. Step vs. Play for Debugging

With the print statement in place, try clicking **Play** instead of Step.

The simulation runs at full speed and all the print output arrives at once. Switch back to **Step** — you can read each line one turn at a time and compare it with what you see on the grid.

Step is most useful when something is not behaving as expected: slow down, print the values you care about, and check them one turn at a time.

---

## 3. Trigger a Syntax Error

Replace your code with something that contains a Python syntax error:

```python
return !
```

Click **Init**. The simulation does not start — no island is generated, **Play** and **Step** remain disabled, and a `[SYNTAX ERROR]` message appears in the Debug Output panel identifying the problem and the line number.

Fix the code (restore `return nearest_ant`) and click **Init** again to confirm the error is gone and **Play** is now enabled.

> **Why does Init catch syntax errors?** Before generating the island, the app compiles your code. If the syntax is invalid it reports the error immediately and leaves the app in a state where you must fix the code and re-Init before you can run anything.

---

## 4. Trigger a Runtime Error

A syntax error prevents Init from completing. A **runtime error** is different — the code is syntactically valid, so Init succeeds and **Play** is enabled, but something goes wrong when the code actually runs.

Try returning the wrong type:

```python
return 0
```

Click **Init**. The island is generated and **Play** is enabled — but look at the Debug Output panel: an `[ERROR]` message has already appeared, and your anteater shows a white × instead of a directional arrow. The app called your `move()` once during Init to pre-compute the first move; that is when the bad return value was detected.

If you click **Play** or **Step**, the simulation runs but your anteater stays put every turn (defaulting to `(0, 0)`) and a new error is logged each turn.

> **The key difference:** a syntax error is static — the code is either valid or not, regardless of inputs, so Init can catch it up front and refuse to run. A runtime error is dynamic — it depends on the actual values passed to `move()` each turn, so some turns might succeed and others fail. The app therefore lets the simulation run and handles errors turn by turn rather than blocking at Init.

---

## Check Your Understanding

Before moving on, make sure you can answer these questions:

1. Where does `print()` output appear, and when is it cleared?
2. How does a syntax error affect Init differently from a runtime error?
3. Why is **Step** more useful than **Play** when debugging?
4. What does the anteater do when `move()` returns an invalid value, and at what point is this detected?

---

*Previous: [Activity 3 — Chase the Nearest Ant](ACTIVITY3.md)*
