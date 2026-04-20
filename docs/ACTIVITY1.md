# Activity 1 — Explore the Island

**Goal:** Get oriented with the app before writing any code.

---

## 1. Open the App

Open [the app](https://dkirkby.github.io/IsleOfAnts/) in your web browser. You should see two main areas:

- The **Setup panel** across the top — this is where you configure the simulation before running it.
- The **Simulation panel** below — this is where the island is displayed and controlled.

Take a moment to look at the Setup panel. You will see fields for **Grid** (the size of the island) and **Max Turns** (how long the simulation runs), and a row of control buttons: **Init**, **Play**, **Step**, **Pause**. On the left side of the Simulation panel is the **scoreboard** area — ignore it for now and do not click **Add Player**.

---

## 2. Generate an Island

Click **Init**.

An island appears: the yellow cells are land; the blue surrounding area is water. Small dots scattered across the land are **ants**.

Click **Init** several more times and observe:

- The shape of the island changes each time — it is randomly generated.
- The number and positions of the ants change too.
- The ocean and land colors stay the same; only the layout varies.

You can change the size of the island display by dragging its bottom-left corner. Try this now.

> **Why does it look different every time?** Each click of Init picks a new random seed, which drives both the island shape and the initial placement of ants.

---

## 3. Watch the Ants Move

Click **Init** once to get a fresh island, then click **Play**.

The ants begin moving around the island. Watch for a few seconds, then click **Stop**.

Here is what is happening each turn:

- Every ant follows its own movement strategy — the same strategy is shared by all ants, but the details are not revealed. Part of the challenge is figuring out how the ants behave so you can write a better anteater strategy.
- If a move would take the ant off the island into the water, the move is **canceled** and the ant stays put.
- If a move would land on a cell already occupied by another ant, the move is also **canceled**.
- Otherwise the ant moves to the new cell.

Play automatically stops when **Max Turns** is reached (100 by default) or when all ants have been eaten. Since there are no players yet, the ants simply keep moving until the turn limit.

> **Tip:** Running the simulation with no players added is a good way to study ant movement patterns without your anteater interfering.

You can control the speed of play using the **SPEED** slider.

Notice the **turn counter** and **ant count** displayed below the scoreboard — these update as the simulation runs.

---

## 4. Turn on Trails

Click **Init** to reset, then check the **Show Trails** checkbox before clicking **Play** again.

Now each ant has a short line attached to it. This line points **back toward the cell the ant just came from**, so it shows you the direction of its most recent move. Ants that did not move (because their intended move was blocked) have no trail line.

Trails make it easier to see the flow of ant movement across the island, especially when many ants are close together.

---

## 5. Step Through One Turn at a Time

Click **Init** to reset, then click **Step** (instead of Play).

Each click of **Step** advances the simulation by exactly **one turn**. Use it to observe individual ant movements:

- Watch a single ant and predict where it will go next — can you tell which direction it chose?
- Step several times and notice that blocked moves happen frequently near the shore and in crowded areas.

Stepping is most useful later when you are debugging your own code, but it is worth getting familiar with it now.

---

## 6. Experiment with Settings

The simulation settings appear along the top of the window. These can only be changed when there is no (paused or running) simulation in progress. Click **Pause** if the simulation is running. Click **Init** to cancel the current simulation. Now try adjusting the settings in the Setup panel:

- Change **Grid** to a smaller value (e.g., 20) and click **Init** — the island is smaller and the ant population is lower.
- Change **Grid** to a larger value (e.g., 80) and click **Init** — more land, more ants, slower to scroll through.
- Change **Max Turns** to 20, click **Init**, then **Play** — the simulation ends much sooner.

> **Important:** changing any setting in the Setup panel will clear the display and requires a new **Init** before it takes effect, and you can **Play** or **Step** through a new simulation.

---

## Check Your Understanding

Before moving on, make sure you can answer these questions:

1. What does clicking **Init** do, and why does the island look different each time?
2. What conditions cause an ant's attempted move to be canceled?
3. What does the trail line attached to each ant represent?
4. What two conditions cause Play to stop automatically?

---

*Next: [Activity 2 — Your First Move](ACTIVITY2.md)*
