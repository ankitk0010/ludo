import { PlayerColor, Token } from './types';
import { SAFE_POSITIONS, START_POSITIONS, TOTAL_TRACK_CELLS } from './constants';

export interface GridCell {
  row: number;
  col: number;
}

// 52 Track positions in order (0..51) on a 15x15 grid
export const TRACK_GRID_COORDS: GridCell[] = [
  { row: 6, col: 1 },  // 0  (Red Start)
  { row: 6, col: 2 },  // 1
  { row: 6, col: 3 },  // 2
  { row: 6, col: 4 },  // 3
  { row: 6, col: 5 },  // 4
  { row: 5, col: 6 },  // 5
  { row: 4, col: 6 },  // 6
  { row: 3, col: 6 },  // 7
  { row: 2, col: 6 },  // 8  (Star Safe)
  { row: 1, col: 6 },  // 9
  { row: 0, col: 6 },  // 10
  { row: 0, col: 7 },  // 11
  { row: 0, col: 8 },  // 12
  { row: 1, col: 8 },  // 13 (Green Start)
  { row: 2, col: 8 },  // 14
  { row: 3, col: 8 },  // 15
  { row: 4, col: 8 },  // 16
  { row: 5, col: 8 },  // 17
  { row: 6, col: 9 },  // 18
  { row: 6, col: 10 }, // 19
  { row: 6, col: 11 }, // 20
  { row: 6, col: 12 }, // 21 (Star Safe)
  { row: 6, col: 13 }, // 22
  { row: 6, col: 14 }, // 23
  { row: 7, col: 14 }, // 24
  { row: 8, col: 14 }, // 25
  { row: 8, col: 13 }, // 26 (Yellow Start)
  { row: 8, col: 12 }, // 27
  { row: 8, col: 11 }, // 28
  { row: 8, col: 10 }, // 29
  { row: 8, col: 9 },  // 30
  { row: 9, col: 8 },  // 31
  { row: 10, col: 8 }, // 32
  { row: 11, col: 8 }, // 33
  { row: 12, col: 8 }, // 34 (Star Safe)
  { row: 13, col: 8 }, // 35
  { row: 14, col: 8 }, // 36
  { row: 14, col: 7 }, // 37
  { row: 14, col: 6 }, // 38
  { row: 13, col: 6 }, // 39 (Blue Start)
  { row: 12, col: 6 }, // 40
  { row: 11, col: 6 }, // 41
  { row: 10, col: 6 }, // 42
  { row: 9, col: 6 },  // 43
  { row: 8, col: 5 },  // 44
  { row: 8, col: 4 },  // 45
  { row: 8, col: 3 },  // 46
  { row: 8, col: 2 },  // 47 (Star Safe)
  { row: 8, col: 1 },  // 48
  { row: 8, col: 0 },  // 49
  { row: 7, col: 0 },  // 50
  { row: 6, col: 0 },  // 51
];

// Home paths for each color (steps 52..56)
export const HOME_PATH_GRID_COORDS: Record<PlayerColor, GridCell[]> = {
  red: [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  green: [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  yellow: [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  blue: [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
};

// Symmetrically centered 4 Goti Slots per Home Base.
// Each 6x6 base divides into a 2x2 grid of 3x3 sub-cells; slot centers sit
// exactly at the middle of each sub-cell (1.5 and 4.5 within the 0-5 base).
// Red base: rows 0-5, cols 0-5 → slots at (1.5,1.5), (1.5,4.5), (4.5,1.5), (4.5,4.5)
// Green base: rows 0-5, cols 9-14 → (+9 on col)
// Yellow base: rows 9-14, cols 9-14 → (+9 on both)
// Blue base: rows 9-14, cols 0-5 → (+9 on row)
export const BASE_SPOTS: Record<PlayerColor, GridCell[]> = {
  red: [
    { row: 1.5, col: 1.5 },
    { row: 1.5, col: 4.5 },
    { row: 4.5, col: 1.5 },
    { row: 4.5, col: 4.5 },
  ],
  green: [
    { row: 1.5, col: 10.5 },
    { row: 1.5, col: 13.5 },
    { row: 4.5, col: 10.5 },
    { row: 4.5, col: 13.5 },
  ],
  yellow: [
    { row: 10.5, col: 10.5 },
    { row: 10.5, col: 13.5 },
    { row: 13.5, col: 10.5 },
    { row: 13.5, col: 13.5 },
  ],
  blue: [
    { row: 10.5, col: 1.5 },
    { row: 10.5, col: 4.5 },
    { row: 13.5, col: 1.5 },
    { row: 13.5, col: 4.5 },
  ],
};

// Center finish cell — distributed within the 3x3 center goal area
// (0-indexed cell rows/cols 6-8). Each color sits in its quadrant center:
// red=top-left, green=top-right, blue=bottom-left, yellow=bottom-right.
export const GOAL_GRID_COORD: Record<PlayerColor, GridCell> = {
  red: { row: 6.6, col: 6.6 },
  green: { row: 6.6, col: 8.4 },
  yellow: { row: 8.4, col: 8.4 },
  blue: { row: 8.4, col: 6.6 },
};

/**
 * Calculates global track position (0..51) for active token based on stepCount and player color.
 */
export function getGlobalTrackPosition(color: PlayerColor, stepCount: number): number {
  if (stepCount <= 0 || stepCount >= 52) return -1;
  const startPos = START_POSITIONS[color];
  return (startPos + (stepCount - 1)) % TOTAL_TRACK_CELLS;
}

/**
 * Gets 2D Grid Cell (row, col) — CENTER coordinates — for token based on color and step count.
 * Track/home-path cells are 0-indexed top-left cells, so we add +0.5 to return the cell center
 * (matching BASE_SPOTS / GOAL_GRID_COORD which are already center coordinates).
 */
export function getStepGridCell(color: PlayerColor, index: number, stepCount: number, status: string): GridCell {
  if (status === 'home' || stepCount <= 0) {
    return BASE_SPOTS[color][index];
  }
  if (status === 'finished' || stepCount >= 57) {
    return GOAL_GRID_COORD[color];
  }
  if (stepCount >= 52 && stepCount <= 56) {
    const homeIndex = stepCount - 52;
    const cell = HOME_PATH_GRID_COORDS[color][homeIndex];
    return { row: cell.row + 0.5, col: cell.col + 0.5 };
  }
  const globalPos = getGlobalTrackPosition(color, stepCount);
  const cell = TRACK_GRID_COORDS[globalPos] || { row: 7, col: 7 };
  return { row: cell.row + 0.5, col: cell.col + 0.5 };
}

/**
 * Gets 2D Grid Cell (row, col) for rendering token on 15x15 board.
 */
export function getTokenGridCell(token: Token): GridCell {
  return getStepGridCell(token.color, token.index, token.stepCount, token.status);
}

/**
 * Checks if a global track cell is safe from capture.
 */
export function isSafeCell(globalPos: number): boolean {
  return SAFE_POSITIONS.includes(globalPos);
}
