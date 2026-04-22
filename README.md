![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

# RLP

_This project has been created as a personal project_

_Project developed to study on autonomous agents and reinforcement learning decision-making._

# 🤖 RLP: Reinforcement Learning & Pathfinding

RLP is an experimental visualization platform for __Reinforcement Learning__ integrated into an interactive grid environment. The goal is to train an agent to collect items and reach an exit optimally using modern __AI algorithms__.

<p align="center">
  <img src="https://media.discordapp.net/attachments/1484976360974713054/1496368286567239690/RLP.png?ex=69e9a110&is=69e84f90&hm=74637000baca2e71105c826eaeeecf17883a5dc7ebe0d3a78169b812220dab7c&=&format=webp&quality=lossless&width=1180&height=891" width="600" alt="Reinforcement Learning Loop">
</p>

# 🚀 Features

- Dynamic Map Editor: Draw `walls`, place `collectibles`, and define `start` / `exit` points in real-time.

- Reinforcement Learning Engine: Full implementation of Double Q-Learning with experience replay memory.

- Hybrid Pathfinding: Uses BFS (Breadth-First Search) for distance calculation and reward optimization.

_Double Heatmap Visualization:_

- __Green__ (Q-Values): Visualizes the AI's "instinct" (what it "thinks" is the best path).

- __Red__ (Frequency): Visualizes experience (the most explored areas).

# 🧠 Learning Concepts (RL)

The agent learns through trial and error. It receives rewards (positive or negative) based on its actions.
#### 1. Double Q-Learning

- To prevent the overestimation of reward values, the project uses two Q-tables (qTableA and qTableB).

- The agent chooses an action with one table.

- It updates the value using the second table to evaluate the next state.

##### Formula used:
```bash
Qtarget ​= R + γ ⋅ Qeval​(s′ ,argmax Qupdate​(s′ ,a′))
```
#### 2. Experience Replay (Memory)

The project stores past transitions in a replayBuffer. At each step, the AI "replays" a sample of 64 past transitions to stabilize its learning and prevent forgetting older paths.
#### 3. Reward Shaping (Reward Modeling)

The reward system is finely tuned to guide the agent:

`Collection`: +300

`Exit` (if ready): +1000

`Wall Collision`: −15

`Stagnation` / `Back-and-forth`: Progressive penalties to force exploration.

# 🛤️ Pathfinding & Optimization

The AI does not simply walk at random; it utilizes graph theory algorithms to assist itself:

- BFS (Breadth-First Search): Used to pre-calculate real distances between all points of interest (Start, Collectibles, Exit) by ignoring walls.

- Nearest-Neighbor TSP: The AI calculates an optimal collection order before starting to structure its learning phases.

- Map Validation: An algorithm verifies that the exit and collectibles are not isolated by walls before launching the simulation.

# 🛠️ Technical Stack

- Frontend: React.js, TypeScript.

- Styling: CSS-in-JS with dynamic CSS variables for the heatmap.

- Build Tool: Vite.

- Environment: Docker & Nginx.

# 📖 Installation

-  __Prerequisites__

-  Docker >= 24.0
-  Docker Compose >= 2.0
-  Git

- __Configuration__ (.env)

- Create a .env file at the root of the project:
```bash
# Nginx / Domain
DOMAIN_NAME=example
```
- Clone the repository:

```Bash
git clone https://github.com/your-username/rlp.git
```
- Go to the root of the project:
```Bash
make
```
- Access: Go to http://localhost:8080.

# 🕹️ How to use?

- Draw _'walls'_ (Wall tool █).
- Place _'collectibles'_ (◈) and an _'exit'_ (⬡).
- Define the _'start'_ (◉).
- Press `START`: Watch the AI explore (Exploration phase with Epsilon-Greedy) then optimize its path as cells turn green.

# 📂 Project Structure

```text
├── frontend
│   ├── IA              # RL Logic: Agent, Experience Replay, Q-Learning
│   ├── map             # Grid components, Cell rendering, Map logic
│   ├── src             # React entry point
│   └── structure       # Dockerfile for frontend build
├── nginx               # Reverse proxy & static serving configuration
├── Makefile            # Automation for build and cleanup
└── docker-compose.yml  # Communication between Dockers 'Frontend' and 'Nginx'
```