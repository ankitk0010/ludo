import { GameState, MoveOption, PlayerColor } from './types';
import { getLegalMoves } from './movement';

export function getCurrentPlayer(state: GameState) {
  return state.players[state.currentTurnIndex];
}

export function getLegalMoveOptionsForCurrentPlayer(state: GameState): MoveOption[] {
  const player = getCurrentPlayer(state);
  if (!state.dice.mustMove || state.dice.value === null) return [];
  return getLegalMoves(state, player.color, state.dice.value);
}

/**
 * AI Bot Logic: Chooses best legal move based on priority:
 * 1. Capture enemy token
 * 2. Enter Home Center
 * 3. Step out of Home Base (roll 6)
 * 4. Move token closest to Home Center
 * 5. Move any token
 */
export function getBestBotMove(state: GameState, color: PlayerColor, diceValue: number): MoveOption | null {
  const options = getLegalMoves(state, color, diceValue);
  if (options.length === 0) return null;

  // Priority 1: Capture
  const captureMove = options.find((o) => o.causesCapture);
  if (captureMove) return captureMove;

  // Priority 2: Finish into home
  const finishMove = options.find((o) => o.reachesHome);
  if (finishMove) return finishMove;

  // Priority 3: Move out of base
  const moveOutBase = options.find((o) => o.token.status === 'home');
  if (moveOutBase) return moveOutBase;

  // Priority 4: Furthest token
  options.sort((a, b) => b.token.stepCount - a.token.stepCount);
  return options[0];
}
