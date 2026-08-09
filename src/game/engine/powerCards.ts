import { GameState, PlayerColor, PowerCardType } from './types';

/**
 * Validates whether a player can activate a specific power card.
 */
export function canUsePowerCard(state: GameState, color: PlayerColor, cardType: PowerCardType): { valid: boolean; reason?: string } {
  const playerCards = state.powerCards[color] || [];
  if (!playerCards.includes(cardType)) {
    return { valid: false, reason: 'You do not own this card' };
  }

  const currentPlayer = state.players[state.currentTurnIndex];
  if (currentPlayer.color !== color) {
    return { valid: false, reason: 'It is not your turn' };
  }

  const playerTokens = state.tokens[color] || [];
  const activeTokens = playerTokens.filter((t) => t.status === 'active');

  switch (cardType) {
    case 'extra_move':
      if (activeTokens.length === 0) {
        return { valid: false, reason: 'You need at least 1 active token on track' };
      }
      break;
    case 'shield':
      if (activeTokens.length === 0) {
        return { valid: false, reason: 'You need at least 1 active token to shield' };
      }
      break;
    case 'swap':
      if (activeTokens.length === 0) {
        return { valid: false, reason: 'You need at least 1 active token to swap' };
      }
      // Check if there's an opponent active token on main track
      let enemyActiveCount = 0;
      for (const [c, tokens] of Object.entries(state.tokens)) {
        if (c !== color) {
          enemyActiveCount += tokens.filter((t) => t.status === 'active' && t.stepCount <= 51 && !t.isShielded).length;
        }
      }
      if (enemyActiveCount === 0) {
        return { valid: false, reason: 'No valid opponent active tokens on track to swap with' };
      }
      break;
    case 'lucky_roll':
      if (state.dice.rolling) {
        return { valid: false, reason: 'Dice is already rolling' };
      }
      break;
    case 'attack':
      let enemyTargetCount = 0;
      for (const [c, tokens] of Object.entries(state.tokens)) {
        if (c !== color) {
          enemyTargetCount += tokens.filter((t) => t.status === 'active' && t.stepCount > 3 && !t.isShielded).length;
        }
      }
      if (enemyTargetCount === 0) {
        return { valid: false, reason: 'No vulnerable enemy tokens to attack' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Deducts used power card from inventory.
 */
export function consumePowerCard(state: GameState, color: PlayerColor, cardType: PowerCardType): GameState {
  const cards = [...(state.powerCards[color] || [])];
  const idx = cards.indexOf(cardType);
  if (idx !== -1) {
    cards.splice(idx, 1);
  }
  return {
    ...state,
    powerCards: {
      ...state.powerCards,
      [color]: cards,
    },
  };
}
