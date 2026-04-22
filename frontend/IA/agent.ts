import React from "react";
import type { GridHandle } from "../map/grid";
import { CellType } from "../map/cell";
import { parseMap } from "./utils";

// Types

export interface MapData {
  start: [number, number] | null;
  exit: [number, number] | null;
  collectibles: [number, number][];
  walls: [number, number][];
  rows: number;
  cols: number;
  iaposeX: number;
  iaposeY: number;
  qTable?: Record<string, number[]>;
}

interface Transition {
  stateKey:     string;
  action:       number;
  reward:       number;
  nextStateKey: string;
  done:         boolean;
}

// Configuration 

const ALPHA          = 0.15;
const GAMMA          = 0.95;
const EPSILON_START  = 0.4;
const EPSILON_MIN    = 0.05;
const HISTORY_SIZE   = 20;

// Experience Replay
const REPLAY_CAPACITY = 50000;// taille max du buffer
const REPLAY_BATCH    = 64;// transitions rejouées par step
const REPLAY_START    = 200;// n'apprend depuis le buffer qu'après N transitions

// etat Global 

// Double Q-learning
export let qTableA: Record<string, number[]> = {};
export let qTableB: Record<string, number[]> = {};
export let qTable  = qTableA;

let moveInterval: ReturnType<typeof setInterval> | null = null;
let count      = 0;
let totalSteps = 0;
let posHistory: string[]              = [];
export let visitFreq:  Record<string, number> = {};
const replayBuffer: Transition[] = [];

// Qtable helpers 

function makeStateKey(r: number, c: number, nextTargetIdx: number): string {
  // peut etre faire une politique de contournement de mur idk
  return `${r},${c}|t${nextTargetIdx}`;
}

function getValues(table: Record<string, number[]>, key: string): number[] {
  if (!table[key]) table[key] = [0, 0, 0, 0];
  return table[key];
}

// choix d'action, A pour choisir, B pour évaluer
function chooseAction(key: string, epsilon: number): number
{
  if (Math.random() < epsilon) return Math.floor(Math.random() * 4);
  const vals = getValues(qTableA, key);
  return vals.indexOf(Math.max(...vals));
}

// Mise à jour Double Q : on alterne aléatoirement quelle table est mise à jour
function updateQ(
  stateKey: string, action: number, reward: number,
  nextKey: string, done: boolean
) {
  // 50% chance d' up A en utilisant B pour evaluer le next state
  // 50% chance d' up B en utilisant A pour evaluer le next state
  const [updateTable, evalTable] = Math.random() < 0.5 ? [qTableA, qTableB] : [qTableB, qTableA];

  const current   = getValues(updateTable, stateKey);
  const nextEval  = getValues(evalTable,   nextKey);
  const nextAct   = getValues(updateTable, nextKey).indexOf(
    Math.max(...getValues(updateTable, nextKey))
  );

  const target = done
    ? reward
    : reward + GAMMA * nextEval[nextAct];

  current[action] += ALPHA * (target - current[action]);
}

// Experience Replay

function pushTransition(t: Transition) {
  replayBuffer.push(t);
  if (replayBuffer.length > REPLAY_CAPACITY) replayBuffer.shift();
}

function replayBatch() {
  if (replayBuffer.length < REPLAY_START) return;

  // Pioche REPLAY_BATCH transitions aléatoires
  for (let i = 0; i < REPLAY_BATCH; i++) {
    const idx = Math.floor(Math.random() * replayBuffer.length);
    const { stateKey, action, reward, nextStateKey, done } = replayBuffer[idx];
    updateQ(stateKey, action, reward, nextStateKey, done);
  }
}

// BFS avec cache

let distCache: Record<string, Record<string, number>> = {};

function bfsFromSource(map: CellType[][], srcR: number, srcC: number): Record<string, number> {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const dist: Record<string, number> = {};
  const queue: [number, number, number][] = [[srcR, srcC, 0]];
  dist[`${srcR},${srcC}`] = 0;

  while (queue.length > 0) {
    const [r, c, d] = queue.shift()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (key in dist) continue;
      if (map[nr][nc] === "wall") continue;
      dist[key] = d + 1;
      queue.push([nr, nc, d + 1]);
    }
  }
  return dist;
}

function cachedDist(
  map: CellType[][], fromR: number, fromC: number, toR: number, toC: number
): number {
  const k = `${fromR},${fromC}`;
  if (!distCache[k]) distCache[k] = bfsFromSource(map, fromR, fromC);
  return distCache[k][`${toR},${toC}`] ?? Infinity;
}

// Ordre optimal des collectibles (nearest-neighbor TSP) a retravailler si jamais plus tard x(

function computeOptimalOrder(
  map: CellType[][], fromR: number, fromC: number,
  keys: string[], exitR: number, exitC: number
): string[] {
  const remaining = [...keys];
  const ordered: string[] = [];
  let curR = fromR, curC = fromC;

  while (remaining.length > 0) {
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((key, idx) => {
      const [cr, cc] = key.split(",").map(Number);
      const d = cachedDist(map, curR, curC, cr, cc);
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    });
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    [curR, curC] = chosen.split(",").map(Number);
  }
  return ordered;
}

// persistance (a retravailler je vois pas comment l'implementer correctement)

export function saveSessionToLocalStorage(data: MapData): void {
  try {
    const session = {
      q_table: qTableA,
      timestamp: Date.now(),
    };
    localStorage.setItem("rl_agent_session", JSON.stringify(session));
  } catch (e) {
    console.error("Erreur de sauvegarde locale", e);
  }
}

export function loadSessionFromLocalStorage(): any {
  const saved = localStorage.getItem("rl_agent_session");
  if (!saved) return null;
  const data = JSON.parse(saved);
  qTableA = data.q_table || {};
  qTableB = { ...qTableA }; // on sync les deux tables au chargement
  return data;
}

//logique principale

export function startMovement(
  gridRef: React.RefObject<GridHandle>,
  maxRows: number,
  maxCols: number,
  startX: number,
  startY: number
) {
  if (moveInterval) clearInterval(moveInterval);

  const initialMap = gridRef.current!.getMap();
  const collectiblesList: string[] = [];
  let exitR = -1, exitC = -1;

  initialMap.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell === "collectible") collectiblesList.push(`${r},${c}`);
      if (cell === "exit") { exitR = r; exitC = c; }
    })
  );

  const totalCollectibles = collectiblesList.length;

  //   precalcul BFS
  distCache = {};
  console.log("[IA] Précalcul BFS...");
  const sources: [number, number][] = [
    [startX, startY],
    ...collectiblesList.map(k => k.split(",").map(Number) as [number, number]),
    [exitR, exitC],
  ];
  sources.forEach(([r, c]) => {
    const key = `${r},${c}`;
    if (!distCache[key]) distCache[key] = bfsFromSource(initialMap, r, c);
  });
  console.log(`[IA] BFS précalculé pour ${sources.length} points.`);

  //ordre optimal
  const optimalOrder = computeOptimalOrder(
    initialMap, startX, startY, [...collectiblesList], exitR, exitC
  );
  console.log("[IA] Ordre optimal :", optimalOrder);

  // Reset Q-tables et buffer pour neww map
  qTableA = {}; qTableB = {};
  replayBuffer.length = 0;
  totalSteps = 0;

  // Init episode
  let curX = startX, curY = startY;
  let prevX = startX, prevY = startY;
  let picked         = new Set<string>();
  let currentEpsilon = EPSILON_START;
  let exitSeen       = false;
  posHistory = [];
  visitFreq  = {};

  moveInterval = setInterval(() => {
    if (!gridRef.current) return;
    const map = gridRef.current.getMap();

    // index du prochain collectible cible dans l'ordre optimal
    const nextTargetIdx = optimalOrder.findIndex(k => !picked.has(k));
    // -1 si tous ramassés
    const targetPhase   = nextTargetIdx === -1 ? totalCollectibles : nextTargetIdx;
    const stateKey      = makeStateKey(curX, curY, targetPhase);

    // 1 Choix de l'action
    const action = chooseAction(stateKey, currentEpsilon);

    let nr = curX, nc = curY;
    if (action === 0) nr--;
    if (action === 1) nr++;
    if (action === 2) nc--;
    if (action === 3) nc++;

    // 2 recompense
    let reward = -1;
    const targetCell = map[nr]?.[nc];
    const nextPicked = new Set(picked);
    let done = false;

    if (!targetCell || targetCell === "wall") {
      reward = -15;
      nr = curX; nc = curY;

    } else if (targetCell === "collectible") {
      const cellKey = `${nr},${nc}`;
      if (!picked.has(cellKey)) {
        reward = 300;
        nextPicked.add(cellKey);
        gridRef.current!.consumeCell(nr, nc);
      }

    } else if (targetCell === "exit") {
      if (picked.size === totalCollectibles) {
        reward = 1000;
        done   = true;
      } else {
        reward = -100;
      }
    }

    // 3 reward shaping
    if (nr !== curX || nc !== curY) {
      if (nextTargetIdx !== -1) {
        // Phase collecte : guider vers le prochain dans l'ordre optimal
        const [tr, tc] = optimalOrder[nextTargetIdx].split(",").map(Number);
        const db = distCache[`${curX},${curY}`]?.[`${tr},${tc}`] ?? Infinity;
        const da = distCache[`${nr},${nc}`]?.[`${tr},${tc}`] ?? Infinity;
        if (db !== Infinity && da !== Infinity) reward += (db - da) * 4;

        // Signal faible vers la sortie si déjà vue
        if (exitSeen && exitR >= 0) {
          const db2 = distCache[`${curX},${curY}`]?.[`${exitR},${exitC}`] ?? Infinity;
          const da2 = distCache[`${nr},${nc}`]?.[`${exitR},${exitC}`] ?? Infinity;
          if (db2 !== Infinity && da2 !== Infinity) reward += (db2 - da2) * 1;
        }
      } else if (exitR >= 0) {
        // Phase sortie : signal fort
        const db = distCache[`${curX},${curY}`]?.[`${exitR},${exitC}`] ?? Infinity;
        const da = distCache[`${nr},${nc}`]?.[`${exitR},${exitC}`] ?? Infinity;
        if (db !== Infinity && da !== Infinity) reward += (db - da) * 6;
      }
    }

    //memoire sortie
    if (targetCell === "exit" && !exitSeen) {
      exitSeen = true;
      console.log(`[IA] Sortie mémorisée en [${exitR},${exitC}]`);
    }
    //  4 Anti-cycle
    
    // aller-retour
    if (nr === prevX && nc === prevY) {
      reward -= 60; 
    }
    const posKey = `${nr},${nc}`;
    // petites boucles
    const recentCount = posHistory.filter(p => p === posKey).length;
    if (recentCount >= 2) {
      reward -= 20 * recentCount; 
    }

    //stagnation
    visitFreq[posKey] = (visitFreq[posKey] ?? 0) + 1;
    if (visitFreq[posKey] > 4)
    {
      reward -= 5 * visitFreq[posKey]; 
    }

    posHistory.push(posKey);
    if (posHistory.length > HISTORY_SIZE) posHistory.shift();

    // apprentissage
    const nextPhase    = nextPicked.size === totalCollectibles ? totalCollectibles
                       : optimalOrder.findIndex(k => !nextPicked.has(k));
    const nextStateKey = makeStateKey(nr, nc, nextPhase === -1 ? totalCollectibles : nextPhase);
    updateQ(stateKey, action, reward, nextStateKey, done);
    pushTransition({ stateKey, action, reward, nextStateKey, done });
    replayBatch();

    // 6 maj detat
    prevX  = curX; // 👈 3. On enregistre d'où on vient
    prevY  = curY;
    curX   = nr;
    curY   = nc;
    picked = nextPicked;
    gridRef.current.moveAgent(curX, curY);
    totalSteps++;

    // 7 enleve du rng
    if (currentEpsilon > EPSILON_MIN) currentEpsilon *= 0.9998;

    // 8 reset episode
    if (done)
    {
      count++;
      console.log(`Épisode ${count} | Epsilon : ${currentEpsilon.toFixed(3)} | Buffer : ${replayBuffer.length}`);

      curX   = startX; curY = startY;
      picked = new Set<string>();
      posHistory = []; visitFreq = {};
      exitSeen = true;

      collectiblesList.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        gridRef.current!.restoreCell(r, c, "collectible");
      });
      gridRef.current.moveAgent(startX, startY);
    }
  }, 0);
}

export function stopRandomMovement()
{
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }
}

export async function runAgent(gridRef: React.RefObject<GridHandle>)
{
  if (!gridRef.current) return;
  const map  = gridRef.current.getMap();
  const data = parseMap(map);
  if (!data.start) return;
  const [startRow, startCol] = data.start;
  loadSessionFromLocalStorage();
  startMovement(gridRef, data.rows, data.cols, startRow, startCol);
  saveSessionToLocalStorage(data);
}

export function resetAgentStats()
{
  visitFreq = {};      
  posHistory = [];     
  qTableA = {}; 
  qTableB = {};
}