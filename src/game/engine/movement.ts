import { GameState, MoveOption, PlayerColor } from './types';
import { getGlobalTrackPosition, isSafeCell } from './board';
import { TOTAL_STEPS_TO_FINISH } from './constants';

/**
 * Returns all legal moves available for a given player based on the current dice value.
 */
export function getLegalMoves(state: GameState, color: PlayerColor, diceValue: number): MoveOption[] {
  const playerTokens = state.tokens[color] || [];
  const options: MoveOption[] = [];

  for (const token of playerTokens) {
    if (token.status === 'finished') continue;

    // Token inside home base: requires 6 to enter
    if (token.status === 'home') {
      if (diceValue === 6) {
        const startGlobalPos = getGlobalTrackPosition(color, 1);
        options.push({
          tokenId: token.id,
          token,
          targetStepCount: 1,
          targetGlobalPos: startGlobalPos,
          causesCapture: false,
          reachesHome: false,
        });
      }
      continue;
    }

    // Active token on track or home path
    const targetStepCount = token.stepCount + diceValue;

    // Cannot overshoot final home position (57)
    if (targetStepCount > TOTAL_STEPS_TO_FINISH) continue;

    const reachesHome = targetStepCount === TOTAL_STEPS_TO_FINISH;
    const targetGlobalPos = getGlobalTrackPosition(color, targetStepCount);

    let causesCapture = false;

    // Capture check: only on main track (targetStepCount <= 51) and non-safe cells
    if (targetStepCount <= 51 && targetGlobalPos !== -1 && !isSafeCell(targetGlobalPos)) {
      for (const [otherColor, otherTokens] of Object.entries(state.tokens)) {
        if (otherColor === color) continue;
        for (const enemyToken of otherTokens) {
          if (enemyToken.status === 'active' && enemyToken.stepCount <= 51) {
            const enemyGlobalPos = getGlobalTrackPosition(otherColor as PlayerColor, enemyToken.stepCount);
            if (enemyGlobalPos === targetGlobalPos && !enemyToken.isShielded) {
              causesCapture = true;
              break;
            }
          }
        }
        if (causesCapture) break;
      }
    }

    options.push({
      tokenId: token.id,
      token,
      targetStepCount,
      targetGlobalPos,
      causesCapture,
      reachesHome,
    });
  }

  return options;
}

/**
 * Checks if player has any legal moves.
 */
export function hasLegalMoves(state: GameState, color: PlayerColor, diceValue: number): boolean {
  return getLegalMoves(state, color, diceValue).length > 0;
}
