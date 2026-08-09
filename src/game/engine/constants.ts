import { PlayerColor, PowerCardInfo, PowerCardType } from './types';

export const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const START_POSITIONS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

export const SAFE_POSITIONS: number[] = [0, 8, 13, 21, 26, 34, 39, 47];

export const TOTAL_TRACK_CELLS = 52;
export const TOTAL_STEPS_TO_FINISH = 57;
export const HOME_PATH_LENGTH = 5; // steps 52, 53, 54, 55, 56

export const POWER_CARD_DEFINITIONS: Record<PowerCardType, PowerCardInfo> = {
  extra_move: {
    type: 'extra_move',
    name: 'Extra Move',
    description: 'Grant +2 steps to any active token',
    icon: '⚡',
    cost: 1,
    color: '#3B82F6',
  },
  shield: {
    type: 'shield',
    name: 'Shield',
    description: 'Protect a token from capture for 2 turns',
    icon: '🛡️',
    cost: 1,
    color: '#38D39F',
  },
  swap: {
    type: 'swap',
    name: 'Swap',
    description: 'Swap positions of one of your tokens with an opponent token',
    icon: '🔄',
    cost: 1,
    color: '#6C4BF4',
  },
  lucky_roll: {
    type: 'lucky_roll',
    name: 'Lucky Roll',
    description: 'Pick your dice result (1 to 6) for this turn',
    icon: '🎲',
    cost: 1,
    color: '#FFC857',
  },
  attack: {
    type: 'attack',
    name: 'Attack',
    description: 'Send an un-shielded opponent token 3 steps backwards',
    icon: '💥',
    cost: 1,
    color: '#FF6B6B',
  },
};
