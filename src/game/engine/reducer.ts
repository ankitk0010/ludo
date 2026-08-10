import { GameState, Player, PlayerColor, PowerCardType, Token } from './types';
import { PLAYER_COLORS, TOTAL_STEPS_TO_FINISH } from './constants';
import { getGlobalTrackPosition } from './board';
import { getLegalMoves, hasLegalMoves } from './movement';
import { consumePowerCard } from './powerCards';

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'ROLL_DICE'; overrideValue?: number }
  | { type: 'SELECT_TOKEN'; targetTokenId: string }
  | { type: 'USE_POWER_CARD'; cardType: PowerCardType }
  | { type: 'TARGET_POWER_CARD'; targetTokenId: string }
  | { type: 'PASS_TURN' }
  | { type: 'RESTORE_GAME'; state: GameState }
  | { type: 'CANCEL_LUCKY_ROLL' }
  | { type: 'ADD_LOG'; message: string };

export function createInitialTokens(): Record<PlayerColor, Token[]> {
  const tokens: Record<PlayerColor, Token[]> = {
    red: [],
    green: [],
    yellow: [],
    blue: [],
  };

  for (const color of PLAYER_COLORS) {
    tokens[color] = [0, 1, 2, 3].map((index) => ({
      id: `${color}-${index}`,
      color,
      index,
      status: 'home',
      position: -1,
      stepCount: 0,
      isShielded: false,
    }));
  }

  return tokens;
}

export function createInitialGameState(players: Player[], roomId = 'LOCAL'): GameState {
  const powerCards: Record<PlayerColor, PowerCardType[]> = {
    red: ['extra_move', 'shield', 'lucky_roll'],
    green: ['extra_move', 'shield', 'swap'],
    yellow: ['extra_move', 'attack', 'lucky_roll'],
    blue: ['extra_move', 'shield', 'attack'],
  };

  return {
    id: `game_${Date.now()}`,
    roomId,
    status: 'playing',
    players,
    currentTurnIndex: 0,
    dice: {
      value: null,
      rolling: false,
      mustMove: false,
      consecutiveSixes: 0,
    },
    tokens: createInitialTokens(),
    powerCards,
    activePowerCard: null,
    winner: null,
    turnNumber: 1,
    logs: ['Game started! Roll the dice to begin.'],
  };
}

export function checkWinner(state: GameState): PlayerColor | null {
  for (const color of PLAYER_COLORS) {
    const colorTokens = state.tokens[color] || [];
    if (colorTokens.length === 4 && colorTokens.every((t) => t.status === 'finished')) {
      return color;
    }
  }
  return null;
}

export function advanceTurn(state: GameState, extraTurn = false, logMessage?: string): GameState {
  const logs = [...state.logs];
  if (logMessage) logs.push(logMessage);

  // Decrease shield turns for current player's tokens
  const currentColor = state.players[state.currentTurnIndex].color;
  const currentTokens = state.tokens[currentColor].map((t) => {
    if (t.isShielded && t.shieldTurnsLeft) {
      const left = t.shieldTurnsLeft - 1;
      return {
        ...t,
        shieldTurnsLeft: left,
        isShielded: left > 0,
      };
    }
    return t;
  });

  const updatedTokens = {
    ...state.tokens,
    [currentColor]: currentTokens,
  };

  if (extraTurn) {
    return {
      ...state,
      tokens: updatedTokens,
      dice: {
        value: null,
        rolling: false,
        mustMove: false,
        consecutiveSixes: state.dice.consecutiveSixes,
        noLegalMove: false,
      },
      pendingLuckyRoll: false,
      logs,
    };
  }

  const nextTurnIndex = (state.currentTurnIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextTurnIndex];

  logs.push(`It is now ${nextPlayer.name}'s (${nextPlayer.color.toUpperCase()}) turn.`);

  return {
    ...state,
    tokens: updatedTokens,
    currentTurnIndex: nextTurnIndex,
    dice: {
      value: null,
      rolling: false,
      mustMove: false,
      consecutiveSixes: 0,
      noLegalMove: false,
    },
    activePowerCard: null,
    pendingLuckyRoll: false,
    turnNumber: state.turnNumber + 1,
    logs,
  };
}

/**
 * Generates a fair, cryptographically strong Ludo dice value (1-6).
 * Includes an anti-stuck (pity) mechanism: if all 4 of a player's tokens are stuck in home,
 * progressive weighting is applied after multiple non-6 rolls so players don't get locked out.
 */
export function generateLudoDiceValue(state: GameState, color: PlayerColor): number {
  // Cryptographic random float in [0, 1)
  let rand = Math.random();
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    rand = array[0] / (0xffffffff + 1);
  }

  const colorTokens = state.tokens[color] || [];
  const allInHome = colorTokens.length > 0 && colorTokens.every((t) => t.status === 'home');

  if (allInHome) {
    // Count recent rolls by this color without getting a 6
    let consecutiveNoSix = 0;
    const playerLogPattern = `${color.toUpperCase()})`;
    for (let i = state.logs.length - 1; i >= 0; i--) {
      const log = state.logs[i];
      if (log.includes(playerLogPattern) || log.toLowerCase().includes(color)) {
        if (log.includes('rolled a 6')) {
          break;
        }
        if (log.includes('rolled a ')) {
          consecutiveNoSix++;
        }
      }
    }

    // Apply pity boost if stuck at home for 3+ rolls
    if (consecutiveNoSix >= 5) {
      // 50% chance of 6 if stuck 5+ turns
      if (rand < 0.5) return 6;
      rand = (rand - 0.5) * 2;
    } else if (consecutiveNoSix >= 3) {
      // 35% chance of 6 if stuck 3-4 turns
      if (rand < 0.35) return 6;
      rand = (rand - 0.35) / 0.65;
    }
  }

  // Standard uniform distribution across 1 to 6
  return Math.floor(rand * 6) + 1;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.winner) return state;

  const currentPlayer = state.players[state.currentTurnIndex];
  const currentColor = currentPlayer.color;

  switch (action.type) {
    case 'START_GAME':
      return createInitialGameState(state.players, state.roomId);

    case 'ROLL_DICE': {
      if (state.dice.mustMove) return state; // Must make move first

      const rolledValue = action.overrideValue || generateLudoDiceValue(state, currentColor);
      const isSix = rolledValue === 6;
      const consecutiveSixes = isSix ? state.dice.consecutiveSixes + 1 : 0;

      const logs = [...state.logs, `${currentPlayer.name} rolled a ${rolledValue}!` + (isSix ? ' 🎲 (Bonus Roll!)' : '')];

      // Rule: 3 consecutive 6s lose turn (show the dice first, auto-pass after)
      if (consecutiveSixes >= 3) {
        logs.push(`${currentPlayer.name} rolled three 6s in a row! Turn forfeited.`);
        return {
          ...state,
          dice: {
            value: rolledValue,
            rolling: false,
            mustMove: false,
            consecutiveSixes: 0,
            noLegalMove: true,
          },
          pendingLuckyRoll: false,
          logs,
        };
      }

      const canMove = hasLegalMoves(state, currentColor, rolledValue);

      // No legal moves: still show the rolled dice value, auto-pass after
      if (!canMove) {
        logs.push(`${currentPlayer.name} has no legal moves.`);
        return {
          ...state,
          dice: {
            value: rolledValue,
            rolling: false,
            mustMove: false,
            consecutiveSixes,
            noLegalMove: true,
          },
          pendingLuckyRoll: false,
          logs,
        };
      }

      return {
        ...state,
        dice: {
          value: rolledValue,
          rolling: false,
          mustMove: true,
          consecutiveSixes,
          noLegalMove: false,
        },
        pendingLuckyRoll: false,
        logs,
      };
    }

    case 'SELECT_TOKEN': {
      if (!state.dice.mustMove || state.dice.value === null) return state;

      const diceValue = state.dice.value;
      const legalMoves = getLegalMoves(state, currentColor, diceValue);
      const chosenMove = legalMoves.find((m) => m.tokenId === action.targetTokenId);

      if (!chosenMove) return state; // Invalid selection

      const tokenToMove = chosenMove.token;
      let newStepCount = chosenMove.targetStepCount;
      let newStatus = tokenToMove.status;

      if (newStepCount === 1) {
        newStatus = 'active';
      } else if (newStepCount >= TOTAL_STEPS_TO_FINISH) {
        newStatus = 'finished';
        newStepCount = TOTAL_STEPS_TO_FINISH;
      }

      let capturedEnemyToken: Token | null = null;
      let capturedEnemyColor: PlayerColor | null = null;

      // Handle capture on main track
      const targetGlobalPos = chosenMove.targetGlobalPos;
      const newTokensState: Record<PlayerColor, Token[]> = { ...state.tokens };

      if (chosenMove.causesCapture && targetGlobalPos !== -1) {
        for (const [otherColor, tokens] of Object.entries(state.tokens)) {
          if (otherColor === currentColor) continue;
          const matchIdx = tokens.findIndex(
            (t) =>
              t.status === 'active' &&
              t.stepCount <= 51 &&
              getGlobalTrackPosition(otherColor as PlayerColor, t.stepCount) === targetGlobalPos &&
              !t.isShielded
          );
          if (matchIdx !== -1) {
            capturedEnemyToken = tokens[matchIdx];
            capturedEnemyColor = otherColor as PlayerColor;
            // Send enemy token back to home base!
            const updatedEnemyTokens = [...tokens];
            updatedEnemyTokens[matchIdx] = {
              ...capturedEnemyToken,
              status: 'home',
              stepCount: 0,
              position: -1,
            };
            newTokensState[capturedEnemyColor] = updatedEnemyTokens;
            break;
          }
        }
      }

      // Update current player's token
      const updatedCurrentTokens = newTokensState[currentColor].map((t) =>
        t.id === tokenToMove.id
          ? {
              ...t,
              status: newStatus,
              stepCount: newStepCount,
              position: newStepCount <= 51 ? targetGlobalPos : -1,
            }
          : t
      );
      newTokensState[currentColor] = updatedCurrentTokens;

      const extraTurn = diceValue === 6 || !!capturedEnemyToken || newStatus === 'finished';

      let logMsg = `${currentPlayer.name} moved token ${tokenToMove.index + 1}.`;
      if (capturedEnemyToken && capturedEnemyColor) {
        logMsg += ` ⚔️ Captured ${capturedEnemyColor.toUpperCase()}'s token!`;
      }
      if (newStatus === 'finished') {
        logMsg += ` 🏆 Token reached Home Center!`;
      }

      const tempState: GameState = {
        ...state,
        tokens: newTokensState,
      };

      const winner = checkWinner(tempState);
      if (winner) {
        return {
          ...tempState,
          status: 'finished',
          winner,
          logs: [...state.logs, logMsg, `🎉 ${currentPlayer.name} HAS WON THE GAME! 🎉`],
        };
      }

      return advanceTurn(tempState, extraTurn, logMsg);
    }

    case 'USE_POWER_CARD': {
      const cardType = action.cardType;

      if (cardType === 'extra_move') {
        // Move any active token +2 steps
        const activeTokens = state.tokens[currentColor].filter((t) => t.status === 'active');
        if (activeTokens.length === 0) return state;

        const target = activeTokens[0];
        const newSteps = Math.min(TOTAL_STEPS_TO_FINISH, target.stepCount + 2);
        const newStatus = newSteps === TOTAL_STEPS_TO_FINISH ? 'finished' : 'active';

        const updated = state.tokens[currentColor].map((t) =>
          t.id === target.id
            ? {
                ...t,
                stepCount: newSteps,
                status: newStatus,
              }
            : t
        );

        const consumedState = consumePowerCard(state, currentColor, cardType);
        return {
          ...consumedState,
          tokens: {
            ...consumedState.tokens,
            [currentColor]: updated,
          },
          logs: [...consumedState.logs, `⚡ ${currentPlayer.name} used EXTRA MOVE (+2 steps)!`],
        };
      }

      if (cardType === 'shield') {
        const activeTokens = state.tokens[currentColor].filter((t) => t.status === 'active');
        if (activeTokens.length === 0) return state;

        const target = activeTokens[0];
        const updated = state.tokens[currentColor].map((t) =>
          t.id === target.id
            ? {
                ...t,
                isShielded: true,
                shieldTurnsLeft: 2,
              }
            : t
        );

        const consumedState = consumePowerCard(state, currentColor, cardType);
        return {
          ...consumedState,
          tokens: {
            ...consumedState.tokens,
            [currentColor]: updated,
          },
          logs: [...consumedState.logs, `🛡️ ${currentPlayer.name} SHIELDED token ${target.index + 1}!`],
        };
      }

      if (cardType === 'lucky_roll') {
        const consumedState = consumePowerCard(state, currentColor, cardType);
        return {
          ...consumedState,
          pendingLuckyRoll: true,
          logs: [...consumedState.logs, `🎲 ${currentPlayer.name} activated LUCKY ROLL! Choose dice value.`],
        };
      }

      if (cardType === 'attack') {
        // Find an enemy token to attack
        for (const [otherColor, tokens] of Object.entries(state.tokens)) {
          if (otherColor === currentColor) continue;
          const targetIdx = tokens.findIndex((t) => t.status === 'active' && t.stepCount > 3 && !t.isShielded);
          if (targetIdx !== -1) {
            const enemyToken = tokens[targetIdx];
            const newSteps = Math.max(1, enemyToken.stepCount - 3);
            const updatedEnemyTokens = [...tokens];
            updatedEnemyTokens[targetIdx] = {
              ...enemyToken,
              stepCount: newSteps,
            };

            const consumedState = consumePowerCard(state, currentColor, cardType);
            return {
              ...consumedState,
              tokens: {
                ...consumedState.tokens,
                [otherColor as PlayerColor]: updatedEnemyTokens,
              },
              logs: [...consumedState.logs, `💥 ${currentPlayer.name} ATTACKED ${otherColor.toUpperCase()}'s token (-3 steps)!`],
            };
          }
        }
        return state;
      }

      return state;
    }

    case 'PASS_TURN':
      return advanceTurn(state, false, `${currentPlayer.name} passed their turn.`);

    case 'RESTORE_GAME':
      return action.state;

    case 'CANCEL_LUCKY_ROLL':
      return {
        ...state,
        pendingLuckyRoll: false,
        activePowerCard: null,
      };

    case 'ADD_LOG':
      return {
        ...state,
        logs: [...state.logs, action.message],
      };

    default:
      return state;
  }
}
