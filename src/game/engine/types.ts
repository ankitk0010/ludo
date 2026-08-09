export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type TokenStatus = 'home' | 'active' | 'finished';

export interface Token {
  id: string; // e.g. "red-0"
  color: PlayerColor;
  index: number; // 0, 1, 2, 3
  status: TokenStatus;
  position: number; // 0..51 for track, 52..56 for home path, 57 for goal
  stepCount: number; // total steps taken from start (0 to 57)
  isShielded?: boolean;
  shieldTurnsLeft?: number;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  avatar: string;
  /** Optional uploaded/preset avatar image (data URI or URL). */
  avatarUrl?: string;
  ready: boolean;
  connected: boolean;
  wins: number;
  xp: number;
}

export type PowerCardType = 'extra_move' | 'shield' | 'swap' | 'lucky_roll' | 'attack';

export interface PowerCardInfo {
  type: PowerCardType;
  name: string;
  description: string;
  icon: string;
  cost: number;
  color: string;
}

export interface DiceState {
  value: number | null;
  rolling: boolean;
  mustMove: boolean;
  consecutiveSixes: number;
  noLegalMove?: boolean;
}

export interface GameState {
  id: string;
  roomId: string;
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  players: Player[];
  currentTurnIndex: number; // 0..players.length - 1
  dice: DiceState;
  tokens: Record<PlayerColor, Token[]>;
  powerCards: Record<PlayerColor, PowerCardType[]>;
  activePowerCard?: PowerCardType | null;
  winner?: PlayerColor | null;
  turnNumber: number;
  logs: string[];
  pendingLuckyRoll?: boolean;
  selectedTokenForSwap?: Token | null;
}

export interface MoveOption {
  tokenId: string;
  token: Token;
  targetStepCount: number;
  targetGlobalPos: number;
  causesCapture: boolean;
  reachesHome: boolean;
}
