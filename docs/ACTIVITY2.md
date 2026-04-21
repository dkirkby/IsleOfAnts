# Activity 2 — Your First Move

**Goal:** Add a player, understand the code editor, and control an anteater with a fixed return value.

---

## 1. Add a Player

Click **Add Player** in the scoreboard area on the left.

A code editor appears. It has two parts:

- A fixed (non-editable) declaration of the function that controls each player's anteater:
```python
def move(nearest_ant, nearest_anteater, nearest_shore, current_turn):
```
This is known as the **function signature** and specifies what the code you write will have to work with. You will learn what those function inputs mean in later activities; ignore them for now.
- The **editable body** below the signature — this is where you write your Python code. It starts with the default single line:
```python
  return (0, 0)
```
Note the gray number 1 to the left of this line. This is a code line number. Your code will eventually have multiple lines and these line numbers will help locate any code errors that are reported.

Click on the name **Player 1** above the code editor (not the scorebox) and replace it with your own name.

---

## 2. Run the Default Code

Click **Init**. Your anteater appears on the island as a colored circle with a white **×** inside it.

Click **Play** and watch what happens:

- The ants move around as before.
- Your anteater **does not move** — it stays on the same cell every turn.
- The white × is the app's visual indicator that your code returned `(0, 0)`, meaning "do not move."
- Whenever an ant randomly wanders onto the same cell as your anteater, your anteater eats it and your **score** (shown in the scoreboard) increases by one.

So even with the default do-nothing code you can score points — purely by luck, as ants stumble into you.

Click **Pause** when you are done watching.

---

## 3. Make Your First Move

You can only edit the code when no turns have been taken — the editor is locked once the simulation has started. If turns have been taken, click **Init** to reset (if the simulation is auto-playing, click **Pause** first). After editing code, you will need to click **Init** again before you can **Play** or **Step**.

Change the single line of code from:

```python
return (0, 0)
```

to:

```python
return (1, 0)
```

Click **Init**. Notice the white × on your anteater has been replaced by an **arrow pointing to the right** — this is a preview of the move your anteater will make when the next turn runs.

Click **Step** several times and watch your anteater move one cell to the right each turn, until it reaches the shore and stops.

> **Why does it stop at the shore?** A move that would take the anteater off the island into the water is canceled, just like ant moves. The anteater stays on its current cell instead of moving.

---

## 4. Understand `(dx, dy)`

The value your function returns is a **2-tuple** — a pair of numbers written in parentheses: `(dx, dy)`.

- `dx` controls **horizontal** movement: positive moves **right**, negative moves **left**, zero stays put horizontally.
- `dy` controls **vertical** movement: positive moves **up**, negative moves **down**, zero stays put vertically.

So `return (1, 0)` means "move one cell to the right and zero cells vertically" — i.e., move right.

---

## 5. Try All Eight Directions

Try each of the eight compass directions: N,NE,E,SE,S,SW,W,NW. For each one:

1. Change the return value.
2. Click **Init** to reset the anteater to its starting position.
3. Click **Step** a few times and confirm the anteater moves in the direction you expect.

A few things to look for:

- Diagonal moves work just like cardinal moves — the anteater steps one cell diagonally each turn.
- The arrow preview updates immediately after you click **Init**, before you click **Step**.
- When the anteater reaches the shore in its direction of travel it simply stops; it does not "bounce."

> **Tip:** after clicking **Init**, check the direction of the arrow on your anteater before stepping — does it match the direction you intended?

---

## Check Your Understanding

Before moving on, make sure you can answer these questions:

1. How can you edit your anteater's code?
2. What does a white × on the anteater indicate? What does an arrow indicate?
3. In `(dx, dy)`, which value controls left/right movement, and which direction does a positive value correspond to?
4. What happens when the anteater's chosen move would take it into the water?

---

*Previous: [Activity 1 — Explore the Island](ACTIVITY1.md)*
*Next: [Activity 3 — Reading the Inputs](ACTIVITY3.md)*
