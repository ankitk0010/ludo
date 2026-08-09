import { GameState, Player, PlayerColor } from '@/game/engine/types';
import { createInitialGameState, gameReducer, GameAction } from '@/game/engine/reducer';
import { getCurrentPlayer } from '@/game/engine/selectors';

export interface RoomPlayerSeed {
  name: string;
  color: string;
  deviceId: string | null;
  avatarUrl: string | null;
}

/** Build engine seats for a room (only real players — bots never join rooms). */
export function buildRoomSeats(roomPlayers: RoomPlayerSeed[]): Player[] {
  return roomPlayers.map((m) => ({
    id: m.deviceId || `seat_${m.color}`,
    name: m.name,
    color: m.color as PlayerColor,
    isBot: false,
    avatar: '',
    avatarUrl: m.avatarUrl || undefined,
    ready: true,
    connected: true,
    wins: 0,
    xp: 0,
  }));
}

export function newRoomGameState(seats: Player[], roomId: string): GameState {
  return createInitialGameState(seats, roomId);
}

/** Actions a player may send for their own turn. */
const ALLOWED_ACTIONS = new Set([
  'ROLL_DICE',
  'SELECT_TOKEN',
  'USE_POWER_CARD',
  'TARGET_POWER_CARD',
  'PASS_TURN',
  'CANCEL_LUCKY_ROLL',
]);

/**
 * Apply a player action to the authoritative room state. Only the player whose
 * turn it is may act — this is what stops other clients from "playing" a
 * friend's turn. START_GAME is allowed from anyone for a rematch.
 */
export function applyRoomGameAction(
  state: GameState,
  action: GameAction,
  actorId: string
): { state: GameState; ok: true } | { state: GameState; ok: false; error: string } {
  if (action.type === 'START_GAME') {
    return { state: createInitialGameState(state.players, state.roomId), ok: true };
  }

  if (!ALLOWED_ACTIONS.has(action.type)) {
    return { state, ok: false, error: 'Unsupported action' };
  }

  const current = getCurrentPlayer(state);
  if (current.id !== actorId) {
    return { state, ok: false, error: 'It is not your turn' };
  }

  return { state: gameReducer(state, action), ok: true };
}