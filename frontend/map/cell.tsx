import React from "react";

export type CellType = "empty" | "wall" | "collectible" | "exit" | "start" | "agent";

interface CellProps {
  type: CellType;
  row: number;
  col: number;
  onClick: (row: number, col: number) => void;
  onRightClick: (row: number, col: number, e: React.MouseEvent) => void;
  onMouseEnter: (row: number, col: number) => void;
  qIntensity?: number;
  visitIntensity?: number;
}

const CELL_COLORS: Record<CellType, string> = {
  empty: "var(--cell-empty)",
  wall: "var(--cell-wall)",
  collectible: "var(--cell-collectible)",
  exit: "var(--cell-exit)",
  start: "var(--cell-start)",
  agent: "var(--cell-agent)",
};

// resume : couleur de la grille
export const Cell: React.FC<CellProps> = ({
  type, row, col, onClick, onRightClick, onMouseEnter,
  qIntensity = 0,
  visitIntensity = 0,
}) => {
  const mixColor = `rgba(${visitIntensity * 255}, ${qIntensity * 255}, 0, ${Math.max(qIntensity, visitIntensity) * 0.5})`;
  return (
    <div
      className={`cell cell--${type}`}
      onClick={() => onClick(row, col)}
      onContextMenu={(e) => onRightClick(row, col, e)}
      onMouseEnter={() => onMouseEnter(row, col)}
      style={{
        backgroundColor: type === "empty" ? mixColor : CELL_COLORS[type],
        position: "relative",
        cursor: "crosshair",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 0.2s ease",
        border: "none",        
        outline: "none",     
        width: "100%",         
        height: "100%",
        boxSizing: "border-box"
      }}
      title={`[${row},${col}] Q:${qIntensity.toFixed(2)} V:${visitIntensity.toFixed(2)}`}
    >
      <span style={{ zIndex: 1, lineHeight: 1 }}>
        {type === "collectible" ? "◈" : type === "exit" ? "⬡" : type === "start" ? "◉" : type === "agent" ? "▲" : ""}
      </span>
    </div>
  );
};