import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { Cell, CellType, } from "./cell";
import { stopRandomMovement, qTableA, qTableB, resetAgentStats, visitFreq} from "../IA/agent";

// Types

type Tool = CellType | "eraser";

interface GridState {
  cells: CellType[][];
  rows: number;
  cols: number;
}

interface AgentPos {
  row: number;
  col: number;
}

export interface GridHandle {
  moveAgent: (row: number, col: number) => void;
  stopAgent: () => void;
  getMap: () => CellType[][];
  getSize: () => { rows: number; cols: number };
  triggerStartStop: () => void;
  consumeCell: (row: number, col: number) => void;
  restoreCell: (row: number, col: number, type: CellType) => void;
}

// Constants

const DEFAULT_ROWS = 15;
const DEFAULT_COLS = 20;

const TOOLS: { tool: Tool; label: string; icon: string; hint: string }[] = [
  { tool: "wall",        label: "Mur",        icon: "█", hint: "Clic gauche pour dessiner" },
  { tool: "collectible", label: "Collectible", icon: "◈", hint: "Un item à ramasser"        },
  { tool: "exit",        label: "Sortie",      icon: "⬡", hint: "Destination de l'IA"       },
  { tool: "start",       label: "Départ",      icon: "◉", hint: "Position initiale de l'IA" },
  { tool: "eraser",      label: "Gomme",       icon: "⌫", hint: "Efface une cellule"        },
];

// helpers

function makeGrid(rows: number, cols: number): CellType[][] {
  return Array.from({ length: rows }, () => Array(cols).fill("empty") as CellType[]);
}

function findCell(cells: CellType[][], type: CellType): AgentPos | null {
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++)
      if (cells[r][c] === type) return { row: r, col: c };
  return null;
}

function bfsReachable(cells: CellType[][], start: AgentPos): Set<string> {
  const rows = cells.length;
  const cols = cells[0].length;
  const visited = new Set<string>();
  const queue: AgentPos[] = [start];
  visited.add(`${start.row},${start.col}`);

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = row + dr, nc = col + dc;
      const key = `${nr},${nc}`;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (visited.has(key) || cells[nr][nc] === "wall") continue;
      visited.add(key);
      queue.push({ row: nr, col: nc });
    }
  }
  return visited;
}

function validateMap(cells: CellType[][]): string | null {
  const start = findCell(cells, "start");
  if (!start) return "⚠️  Place un point de départ ◉ d'abord !";

  const exit = findCell(cells, "exit");
  if (!exit)  return "⚠️  Place une sortie ⬡ d'abord !";

  const reachable = bfsReachable(cells, start);
  if (!reachable.has(`${exit.row},${exit.col}`))
    return "⛔  La sortie ou le depart est isolée par des murs !";
  for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (cells[r][c] === "collectible") {
          if (!reachable.has(`${r},${c}`)) {
            return `⛔ Un collectible en [${r},${c}] est inaccessible !`;
          }
        }
      }
    }
  return null;
}

// component

export const Grid = forwardRef<GridHandle, { onStart?: () => void }>(
  ({ onStart }, ref) => {

  const [grid, setGrid] = useState<GridState>({
    cells: makeGrid(DEFAULT_ROWS, DEFAULT_COLS),
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
  });

  const [activeTool, setActiveTool] = useState<Tool>("wall");
  const [isPainting, setIsPainting] = useState(false);
  const [isRunning, setIsRunning]   = useState(false);
  const [agentPos, setAgentPos]     = useState<AgentPos | null>(null);
  const [statusMsg, setStatusMsg]   = useState("Sélectionne un outil et clique sur la grille.");

  const frozenMap    = useRef<CellType[][] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        moveAgent(row: number, col: number) { setAgentPos({row, col}) },
        stopAgent() { isRunning == false; stopRandomMovement() },
        getMap() { return frozenMap.current ?? grid.cells; },
        getSize() { return { rows: grid.rows, cols: grid.cols }; },
        triggerStartStop() { handleStartStop(); },
        consumeCell(row: number, col: number) {
          setGrid((prev) => {
            const next = prev.cells.map((r) => [...r]);
            next[row][col] = "empty";
            return { ...prev, cells: next };
          });
          if (frozenMap.current) frozenMap.current[row][col] = "empty";
        },
        restoreCell(row: number, col: number, type: CellType) {
          setGrid((prev) => {
            const next = prev.cells.map((r) => [...r]);
            next[row][col] = type;
            return { ...prev, cells: next };
          });
          if (frozenMap.current) frozenMap.current[row][col] = type;
        },
    }));

  // edition

  const applyTool = useCallback(
    (row: number, col: number) => {
      if (isRunning) return;
      setGrid((prev) => {
        const next = prev.cells.map((r) => [...r]);
        const newType: CellType = activeTool === "eraser" ? "empty" : activeTool;
        if (newType === "start" || newType === "exit") {
          for (let r = 0; r < prev.rows; r++)
            for (let c = 0; c < prev.cols; c++)
              if (next[r][c] === newType) next[r][c] = "empty";
        }
        next[row][col] = newType;
        return { ...prev, cells: next };
      });
      setStatusMsg(`[${row},${col}] → ${activeTool}`);
    },
    [activeTool, isRunning]
  );

  const handleClick = useCallback(
    (r: number, c: number) => applyTool(r, c),
    [applyTool]
  );

  const handleRightClick = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      e.preventDefault();
      if (isRunning) return;
      setGrid((prev) => {
        const next = prev.cells.map((row) => [...row]);
        next[r][c] = "empty";
        return { ...prev, cells: next };
      });
      setStatusMsg(`[${r},${c}] effacé`);
    },
    [isRunning]
  );

  const handleMouseEnter = useCallback(
    (r: number, c: number) => { if (isPainting) applyTool(r, c); },
    [isPainting, applyTool]
  );

  //START / STOP

  const handleStartStop = () => {
    if (isRunning) {
      setIsRunning(false);
      setAgentPos(null);
      frozenMap.current = null;
      stopRandomMovement();
      setStatusMsg("Simulation stop.");
      return;
    }

    const error = validateMap(grid.cells);
    if (error) {
      setStatusMsg(error);
      return;
    }

    const startPos = findCell(grid.cells, "start")!;
    frozenMap.current = grid.cells.map((r) => [...r]);
    setAgentPos(startPos);
    setIsRunning(true);
    setStatusMsg("Agent initialisé, MLP en cours");
    if (onStart) onStart();
  };

  // Autres 

  const clearGrid = () => {
    if (isRunning) return;
    setGrid((prev) => ({ ...prev, cells: makeGrid(prev.rows, prev.cols) }));
    resetAgentStats();
    setStatusMsg("Grille effacée.");
  };

  const countOf = (type: CellType) =>
    grid.cells.flat().filter((c) => c === type).length;


const renderCell = (cellType: CellType, r: number, c: number) => {
  const cellKey = `${r},${c}`;
  const stateKeys = Object.keys(qTableA).filter(k => k.startsWith(`${cellKey}|`));
  let maxQ = 0;
  stateKeys.forEach(k => {
    maxQ = Math.max(maxQ, ...qTableA[k]);
  });
  const qIntensity = Math.min(Math.max(maxQ, 0) / 1000, 1);
  const visits = visitFreq[cellKey] || 0;
  const visitIntensity = Math.min(visits / 20, 1);

  const isAgent = agentPos?.row === r && agentPos?.col === c;

  return (
    <Cell
      key={`${r}-${c}`}
      type={isAgent ? "agent" : cellType}
      row={r}
      col={c}
      qIntensity={qIntensity}
      visitIntensity={visitIntensity}
      onClick={handleClick}
      onRightClick={handleRightClick}
      onMouseEnter={handleMouseEnter}
    />
  );
};

  // heat map
  

  // JSX

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Oxanium:wght@300;500;700&display=swap');

        :root {
          --bg:              #0a0c10;
          --surface:         #111520;
          --border:          #1e2a3a;
          --accent:          #00e5ff;
          --accent2:         #ff6b35;
          --text:            #c8d8e8;
          --text-dim:        #4a6070;
          --cell-empty:      #0f1520;
          --cell-wall:       #1e2a3a;
          --cell-collectible:#0a2020;
          --cell-exit:       #0a1a10;
          --cell-start:      #1a0a20;
          --cell-agent:      #0a1520;
          --wall-icon:       #2a4060;
          --icon-color:      #c8d8e8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); color: var(--text); font-family: 'Oxanium', monospace; min-height: 100vh; }

        .map-app { display: flex; flex-direction: column; align-items: center; padding: 24px 16px; gap: 20px; min-height: 100vh; }

        .map-header { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .map-title  { font-size: clamp(18px,3vw,32px); font-weight: 700; letter-spacing: .25em; text-transform: uppercase; color: var(--accent); text-shadow: 0 0 20px rgba(0,229,255,.4); }
        .map-subtitle { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-dim); letter-spacing: .15em; }

        .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .tool-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 14px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 6px; cursor: pointer; transition: all .15s;
          color: var(--text-dim); font-family: 'Oxanium', monospace; font-size: 11px;
          letter-spacing: .05em; min-width: 64px;
        }
        .tool-btn:hover    { border-color: var(--accent); color: var(--text); }
        .tool-btn.active   { border-color: var(--accent); color: var(--accent); background: rgba(0,229,255,.06); box-shadow: 0 0 12px rgba(0,229,255,.15); }
        .tool-btn:disabled { opacity: .35; cursor: not-allowed; }

        .tool-icon              { font-size: 18px; line-height: 1; }
        .tool-icon--wall        { color: #2a5080; }
        .tool-icon--collectible { color: #00e5b0; }
        .tool-icon--exit        { color: #50e050; }
        .tool-icon--start       { color: #c050ff; }
        .tool-icon--eraser      { color: #ff6b35; }

        .grid-wrap {
          border: 1px solid rgba(255,255,255,.55);
          border-radius: 8px; overflow: hidden;
          box-shadow: 0 0 40px rgba(25, 0, 255, 0.05);
          position: relative; transition: border-color .3s, box-shadow .3s;
        }
        .grid-wrap.running { border-color: rgba(0,229,255,.7); box-shadow: 0 0 24px rgba(0,229,255,.12); }
        .grid-wrap::before {
          content: ''; position: absolute; inset: 0;
          background:
            repeating-linear-gradient(0deg,  transparent, transparent 38px, rgba(0,229,255,.03) 39px),
            repeating-linear-gradient(90deg, transparent, transparent 38px, rgba(0,229,255,.03) 39px);
          pointer-events: none; z-index: 10;
        }

        .grid { display: grid; gap: 1px; background: rgba(0, 54, 115, 0.12); user-select: none; }
        .cell       { width: 38px; height: 38px; }
        .cell:hover { filter: brightness(1.4); z-index: 2; }
        .cell--wall        { background-color: #1e2a3a !important; }
        .cell--collectible { background-color: #051a15 !important; }
        .cell--exit        { background-color: #051510 !important; }
        .cell--start       { background-color: #150520 !important; }

        .status-bar {
          font-family: 'Share Tech Mono', monospace; font-size: 11px;
          color: var(--text-dim); letter-spacing: .1em;
          padding: 6px 14px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 4px;
          min-width: 360px; text-align: center;
        }
        .status-bar span { color: var(--accent); }

        .actions { display: flex; gap: 10px; }
        .action-btn {
          padding: 8px 20px; border-radius: 4px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text);
          font-family: 'Oxanium', monospace; font-size: 12px;
          letter-spacing: .1em; cursor: pointer; transition: all .15s;
        }
        .action-btn:hover          { border-color: var(--accent2); color: var(--accent2); }
        .action-btn--clear:hover   { border-color: #ff4444; color: #ff4444; }
        .action-btn--clear:disabled{ opacity: .35; cursor: not-allowed; }

        .action-btn--start {
          border-color: rgba(0,229,255,.4); color: var(--accent);
          display: flex; align-items: center; gap: 8px;
        }
        .action-btn--start:hover         { border-color: var(--accent); background: rgba(0,229,255,.07); color: var(--accent); }
        .action-btn--start.running       { border-color: #ff6b35; color: #ff6b35; }
        .action-btn--start.running:hover { background: rgba(255,107,53,.07); }

        .robot-icon        { font-size: 16px; display: inline-block; }
        .robot-icon.active { animation: robotBounce .6s infinite alternate; }

        @keyframes robotBounce { from { transform: translateY(0);   } to { transform: translateY(-3px); } }
        @keyframes agentPulse  { from { opacity: 1; }               to  { opacity: .4; } }

        .stats { display: flex; gap: 20px; font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--text-dim); }
        .stat { display: flex; gap: 6px; }
        .stat-val { color: var(--accent); }

        .legend { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; font-size: 11px; color: var(--text-dim); font-family: 'Share Tech Mono', monospace; }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-dot  { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

        .ia-panel {
          background: var(--surface); border: 1px dashed var(--border); border-radius: 8px;
          padding: 16px 28px; text-align: center;
          font-family: 'Share Tech Mono', monospace; font-size: 12px;
          color: var(--text-dim); letter-spacing: .08em;
        }
        .ia-panel strong { color: var(--accent); display: block; margin-bottom: 4px; font-size: 13px; }
      `}</style>

      <div className="map-app">

        <div className="map-header">
          <div className="map-title">RLP</div>
          <div className="map-subtitle">REINFORCEMENT LEARNING && PATHFINDING</div>
        </div>

        <div className="toolbar">
          {TOOLS.map(({ tool, label, icon }) => (
            <button
              key={tool}
              className={`tool-btn${activeTool === tool ? " active" : ""}`}
              onClick={() => setActiveTool(tool)}
              disabled={isRunning}
              title={TOOLS.find((t) => t.tool === tool)?.hint}
            >
              <span className={`tool-icon tool-icon--${tool}`}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <div className={`grid-wrap${isRunning ? " running" : ""}`}>
          <div
            ref={containerRef}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, 38px)`,
              gridTemplateRows:    `repeat(${grid.rows}, 38px)`,
            }}
            onMouseDown={() => setIsPainting(true)}
            onMouseUp={()   => setIsPainting(false)}
            onMouseLeave={() => setIsPainting(false)}
          >
            {grid.cells.map((row, r) =>
              row.map((cellType, c) => renderCell(cellType, r, c))
            )}
          </div>
        </div>

        <div className="status-bar">
          {isRunning
            ? <><span>🤖 SIMULATION EN COURS</span> · {statusMsg}</>
            : <>OUTIL : <span>{activeTool.toUpperCase()}</span> · G placer · D effacer · {statusMsg}</>
          }
        </div>

        <div className="stats">
          <div className="stat">MURS   <span className="stat-val">{countOf("wall")}</span></div>
          <div className="stat">ITEMS  <span className="stat-val">{countOf("collectible")}</span></div>
          <div className="stat">DÉPART <span className="stat-val">{countOf("start")}</span></div>
          <div className="stat">SORTIE <span className="stat-val">{countOf("exit")}</span></div>
          {agentPos && (
            <div className="stat">AGENT <span className="stat-val">[{agentPos.row},{agentPos.col}]</span></div>
          )}
        </div>

        <div className="actions">
          <button
            className={`action-btn action-btn--start${isRunning ? " running" : ""}`}
            onClick={handleStartStop}
          >
            <span className={`robot-icon${isRunning ? " active" : ""}`}>🤖</span>
            {isRunning ? "STOP" : "START"}
          </button>
          <button className="action-btn action-btn--clear" onClick={clearGrid} disabled={isRunning}>
            EFFACER TOUT
          </button>
        </div>

        <div className="legend">
          <div className="legend-item"><div className="legend-dot" style={{ background:"#1e2a3a", border:"1px solid #2a5080" }} />Mur</div>
          <div className="legend-item"><div className="legend-dot" style={{ background:"#051a15", border:"1px solid #00e5b0" }} />Collectible</div>
          <div className="legend-item"><div className="legend-dot" style={{ background:"#051510", border:"1px solid #50e050" }} />Sortie</div>
          <div className="legend-item"><div className="legend-dot" style={{ background:"#150520", border:"1px solid #c050ff" }} />Départ IA</div>
        </div>
        <pr></pr>
        <div className="ia-panel">
          <strong>[ NOTICE ]</strong>
          Place un point de départ ◉ et une sortie ⬡, puis l'IA itérera ici.
          <br />
          Les cellules vides afficheront une heatmap évolutive des Q-values.
        </div>

      </div>
    </>
  );
});

Grid.displayName = "Grid";
export default Grid;