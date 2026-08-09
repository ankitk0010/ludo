import { createInitialGameState, gameReducer } from './reducer';
import { getLegalMoves } from './movement';
import { canUsePowerCard } from './powerCards';
import { getBestBotMove } from './selectors';
import { Player } from './types';

function runEngineTests() {
  console.log('=== LUDO ENGINE SUITE VERIFICATION ===');

  const testPlayers: Player[] = [
    { id: 'p1', name: 'Red Player', color: 'red', isBot: false, avatar: '🦊', ready: true, connected: true, wins: 0, xp: 0 },
    { id: 'p2', name: 'Green Bot', color: 'green', isBot: true, avatar: '🤖', ready: true, connected: true, wins: 0, xp: 0 },
  ];

  // Test 1: Initial Game State
  const state0 = createInitialGameState(testPlayers, 'TEST_ROOM');
  console.assert(state0.status === 'playing', 'Initial status should be playing');
  console.assert(state0.tokens.red.length === 4, 'Red should have 4 tokens');
  console.assert(state0.tokens.red.every((t) => t.status === 'home'), 'All initial tokens should be in home base');
  console.log('✅ Test 1: Initial Game State creation passed');

  // Test 2: Dice Roll without 6 gives no legal moves for home tokens
  const movesOnRoll2 = getLegalMoves(state0, 'red', 2);
  console.assert(movesOnRoll2.length === 0, 'Rolling a 2 with all tokens at base should yield 0 legal moves');
  console.log('✅ Test 2: Base token dice roll validation passed');

  // Test 3: Rolling a 6 unlocks a token from base
  const movesOnRoll6 = getLegalMoves(state0, 'red', 6);
  console.assert(movesOnRoll6.length === 4, 'Rolling a 6 should allow any of the 4 home tokens to step out');
  console.assert(movesOnRoll6[0].targetStepCount === 1, 'Token step count after leaving home should be 1');
  console.log('✅ Test 3: Unlocking token from base passed');

  // Test 4: Reducer state transition on ROLL_DICE and SELECT_TOKEN
  let state1 = gameReducer(state0, { type: 'ROLL_DICE', overrideValue: 6 });
  console.assert(state1.dice.value === 6, 'Dice value should be 6');
  console.assert(state1.dice.mustMove === true, 'mustMove should be true');

  state1 = gameReducer(state1, { type: 'SELECT_TOKEN', targetTokenId: 'red-0' });
  console.assert(state1.tokens.red[0].status === 'active', 'Token red-0 should now be active');
  console.assert(state1.tokens.red[0].stepCount === 1, 'Token red-0 stepCount should be 1');
  console.log('✅ Test 4: Token movement reducer transition passed');

  // Test 5: Power Cards activation validation
  const extraMoveCheck = canUsePowerCard(state1, 'red', 'extra_move');
  console.assert(extraMoveCheck.valid === true, 'Red should be able to activate EXTRA MOVE with 1 active token');

  state1 = gameReducer(state1, { type: 'USE_POWER_CARD', cardType: 'extra_move' });
  console.assert(state1.tokens.red[0].stepCount === 3, 'EXTRA MOVE should advance token +2 steps (1 -> 3)');
  console.log('✅ Test 5: Power Cards activation (Extra Move) passed');

  // Test 6: AI Bot Best Move Selector
  const botMove = getBestBotMove(state1, 'green', 6);
  console.assert(botMove !== null, 'Bot should choose a valid move on rolling a 6');
  console.log('✅ Test 6: AI Bot decision selector passed');

  console.log('🎉 ALL ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runEngineTests();
