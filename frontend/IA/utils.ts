import { CellType } from "../map/cell";
import { MapData } from "./agent";

// pour les data de la map 
export function parseMap(map: CellType[][]): MapData {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;

  let start: [number, number] | null = null;
  let exit: [number, number] | null = null;
  const collectibles: [number, number][] = [];
  const walls: [number, number][] = [];
  let iaposeX = 0;
  let iaposeY = 0;

  for (let r = 0; r < rows; r++)
    {
        for (let c = 0; c < cols; c++)
        {
            const cell = map[r][c];
            if (cell === "start"){ start = [r, c]; iaposeX = r; iaposeY = c;} 
            else if (cell === "exit") exit = [r, c];
            else if (cell === "collectible") collectibles.push([r, c]);
            else if (cell === "wall") walls.push([r, c]);
        }
    }
  return { start, exit, collectibles, walls, rows, cols, iaposeX, iaposeY};
}
