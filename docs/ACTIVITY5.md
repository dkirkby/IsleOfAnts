# Activity 5 — Strategies

**Goal:** Use `math` and `random` to write strategies that go beyond "always chase the nearest ant," and use `current_turn` to change behavior over time.

---

## 1. Measuring Distance with `math.hypot`

The vector `nearest_ant = (dx, dy)` points toward the nearest ant, but it also tells you how far away it is. The distance in cells is:

```python
dist = math.hypot(nearest_ant[0], nearest_ant[1])
```

`math.hypot(dx, dy)` computes `sqrt(dx² + dy²)` — the straight-line (Euclidean) distance. You don't need to import `math`; it is already available in your function.

Indexing a tuple with `[0]` and `[1]` works, but Python also lets you **destructure** a tuple into named variables in one step:

```python
dx, dy = nearest_ant   # dx = nearest_ant[0], dy = nearest_ant[1]
dist = math.hypot(dx, dy)
```

The names `dx` and `dy` are just your own local variables — call them whatever makes your code clearer. Destructuring is common Python style and you will see it used throughout the rest of this activity.

Try printing the distance each turn:

```python
dx, dy = nearest_ant
dist = math.hypot(dx, dy)
print("Turn", current_turn, "— nearest ant is", round(dist, 1), "cells away")
return nearest_ant
```

Click **Init**, then **Step** a few times and watch how the distance changes as ants move around.

---

## 2. Moving Toward, Away From, and Perpendicular to a Target

Three building-block moves that come up constantly:

| Goal | Return value |
|------|-------------|
| Move **toward** `(dx, dy)` | `return (dx, dy)` |
| Move **away from** `(dx, dy)` | `return (-dx, -dy)` |
| Move **perpendicular** (left-turn) | `return (-dy, dx)` |
| Move **perpendicular** (right-turn) | `return (dy, -dx)` |

The perpendicular formulas rotate the vector 90°. Since `dy` is positive upward — the same mathematical convention used in rotation — the standard rotation formula works directly.

You can verify this in the simulator using `nearest_shore` as the target — moving away from the shore pushes you toward the center of the island, and orbiting keeps you at a roughly constant distance from the water. Try each of these one at a time:

```python
sdx, sdy = nearest_shore
return (-sdx, -sdy)   # move away from shore (toward island center)
```

```python
sdx, sdy = nearest_shore
return (-sdy, sdx)    # orbit left along the shoreline
```

Click **Init** and watch the arrow before stepping. Does it point in the direction you expected?

---

## 3. Distance-Based Decisions

Combining `math.hypot` with the move primitives above lets you switch strategies depending on proximity. For example, only chase when the ant is close:

```python
dx, dy = nearest_ant
dist = math.hypot(dx, dy)

if dist <= 3:
    return (dx, dy)       # ant is close — charge
else:
    return (-dy, dx)      # ant is far — orbit while waiting
```

You can also compare your distance to the nearest ant against your opponent's distance to the same ant. All three vectors originate from *your* anteater, so the vector from your opponent to the ant is `nearest_ant − nearest_anteater` — simple vector subtraction:

```python
# nearest_anteater is None when playing solo, so guard against that
if nearest_anteater is not None:
    my_dx, my_dy = nearest_ant
    my_dist = math.hypot(my_dx, my_dy)

    opp_dx = nearest_ant[0] - nearest_anteater[0]
    opp_dy = nearest_ant[1] - nearest_anteater[1]
    opp_dist = math.hypot(opp_dx, opp_dy)

    print("my dist:", round(my_dist, 1), "opp dist:", round(opp_dist, 1))
    if my_dist < opp_dist:
        return nearest_ant          # we're closer — go get it
    else:
        return (-my_dy, my_dx)      # opponent is closer — orbit toward a different ant
else:
    return nearest_ant
```

> **Why is vector subtraction the right formula?** `nearest_ant` is the vector **from you to the ant**. `nearest_anteater` is the vector **from you to your opponent**. To get the vector from your opponent to the ant, start with the ant's position relative to you, then subtract the opponent's position relative to you: `(ant − you) − (opponent − you) = ant − opponent`.

Add a second player, click **Init**, then **Step** a few times and check the Debug Output panel to see both distances printed each turn.

---

## 4. Random Moves and Biased Choices

The `random` module is also pre-imported. Two patterns are especially useful:

**Random direction:** pick one of the eight compass steps at random.

```python
choices = [
    (1, 0), (-1, 0), (0, 1), (0, -1),
    (1, 1), (1, -1), (-1, 1), (-1, -1)
]
return random.choice(choices)
```

**Biased coin flip:** chase the nearest ant most of the time, but occasionally wander.

```python
if random.random() < 0.8:
    return nearest_ant    # 80% of the time: chase
else:
    return random.choice([(1,0),(-1,0),(0,1),(0,-1)])  # 20%: random cardinal
```

`random.random()` returns a float uniformly distributed in `[0, 1)`. Change the threshold to make the behavior more or less random.

> **Why add randomness?** A purely deterministic chaser is predictable — if the ant's strategy tends to move in one direction, a deterministic anteater can get stuck in a pattern that always misses. A small random component breaks cycles.

---

## 5. Adapting with `current_turn`

`current_turn` starts at `1` and counts up each turn. You can use it to change behavior at specific moments in the game:

**Phase switch** — explore early, then hunt:

```python
if current_turn < 20:
    return random.choice([(1,0),(-1,0),(0,1),(0,-1)])
else:
    return nearest_ant
```

**Periodic behavior** — every 5th turn, move toward the shore (avoiding getting cornered):

```python
if current_turn % 5 == 0:
    return nearest_shore
else:
    return nearest_ant
```

**Escalating aggression** — start cautious, increase chase probability over time:

```python
chase_prob = min(0.3 + current_turn * 0.01, 0.95)
if random.random() < chase_prob:
    return nearest_ant
else:
    return (-nearest_ant[1], nearest_ant[0])   # orbit
```

Experiment by printing `chase_prob` for a few turns to see how quickly it ramps up.

---

## 6. Putting It Together

Here is a starter strategy that combines all four ideas. Read each section, predict what it will do, then run it:

```python
dx, dy = nearest_ant
dist = math.hypot(dx, dy)

# Phase 1: wander for the first 15 turns
if current_turn <= 15:
    return random.choice([(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)])

# Phase 2: if close, charge; if far, orbit
if dist <= 4:
    return (dx, dy)
else:
    if random.random() < 0.7:
        return (-dy, dx)      # orbit
    else:
        return (dx, dy)       # occasionally close the gap anyway
```

Try adjusting the phase boundary (15), the distance threshold (4), and the orbit probability (0.7). Click **Init** after each change and compare scores over several runs.

---

## Check Your Understanding

Before moving on, make sure you can answer these questions:

1. What does `math.hypot(dx, dy)` compute, and what units is the result in?
2. If `nearest_ant = (3, -4)`, what tuple would you return to move *away* from that ant?
3. What is a "biased coin flip" and how do you control the bias with `random.random()`?
4. Why might a strategy that changes behavior based on `current_turn` outperform one that does not?

---

*Previous: [Activity 4 — Debugging](ACTIVITY4.md)*
