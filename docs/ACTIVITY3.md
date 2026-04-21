# Activity 3 — Chase the Nearest Ant

**Goal:** Understand the inputs your function receives each turn, then write code that uses them to move toward the nearest ant.

---

## 1. The Inputs

In Activity 2 you ignored the function signature. Now it matters. The full signature is:

```
def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
```

Every turn, the app calls your `move` function and passes in four values:

| Argument           | What it contains |
|--------------------|-----------------|
| `nearest_ant`      | A `(dx, dy)` tuple pointing from your anteater to the nearest ant |
| `nearest_anteater` | A `(dx, dy)` tuple pointing to the nearest opponent (or `None` if playing solo) |
| `nearest_shore`    | A `(dx, dy)` tuple pointing to the nearest water cell |
| `current_turn`     | An integer starting at `1` and increasing each turn |

The `(dx, dy)` values here are **relative vectors** — they tell you how far away the target is and in what direction, not where it is on the grid. For example, `nearest_ant = (-3, 2)` means the nearest ant is 3 cells to the left and 2 cells above your anteater.

---

## 2. Inspect the Inputs with Hover

Click **Init** (with your player still added from Activity 2). Now hover your mouse over each argument name in the grey function signature — `nearest_ant`, `nearest_anteater`, `nearest_shore`, `current_turn` — one at a time.

A small tooltip pops up showing the current value of that argument. This is the exact value that will be passed to your `move` function when the first turn runs. If the value is a tuple `(dx, dy)`, a corresponding vector will be displayed starting from your anteater's location while your mouse is over the argument name.

Notice:
- `nearest_ant` is a tuple like `(4, -2)` — the nearest ant is 4 cells right and 2 cells up.
- `nearest_anteater` shows `None` — you are playing solo, so there is no opponent.
- `nearest_shore` is always a tuple (there is always a shore nearby).
- `current_turn` shows `1` — the first turn hasn't run yet.

Click **Step** several times. After each step, check how the argument values have changed and that the arrows displayed when you hover your mouse make sense.

---

## 3. Chase the Nearest Ant

If you stepped through the simulation in the previous section, the code editor is now locked. Click **Init** first to reset and unlock the editor.

Now you have everything you need to write a useful strategy: move toward the nearest ant each turn.

The `nearest_ant` tuple already tells you the direction — it points from you to the ant. If you return that direction, your anteater will step toward the ant.

Replace your code with:

```python
return nearest_ant
```

Click **Init** and observe how your anteater's arrow points to the nearest ant. Click **Step** several times and notice how you move towards where the nearest ant was at the start of the turn. However, the ant will often move so, even if you were right next to it, you might not succeed in eating it and increasing your score! So chasing directly is a reasonable but imperfect strategy — you are always one step behind. At least your score increases faster with this strategy than staying still and waiting for ants to come to you.

> **How does returning a large tuple like `(-3, 2)` result in a single-cell move?** The app automatically snaps any `(dx, dy)` you return to the nearest one-cell step. So `(-3, 2)` becomes `(-1, 1)` — one cell left and one cell up — which is the diagonal direction toward the ant.

---

## Check Your Understanding

Before moving on, make sure you can answer these questions:

1. What does `nearest_ant = (-3, 2)` tell you about where the nearest ant is?
2. When is `nearest_anteater` equal to `None`, and why does that cause a problem if you try to use it without checking?
3. If your function returns `(5, -5)`, what single-cell move will the anteater actually make?
4. Why doesn't the anteater always successfully eat the ant it is chasing?

---

*Previous: [Activity 2 — Your First Move](ACTIVITY2.md)*
*Next: [Activity 4 — Debugging](ACTIVITY4.md)*
