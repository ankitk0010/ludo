'use client';

import React, { useEffect, useReducer, useState, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy } from 'lucide-react';
import {
  createInitialGameState,
  gameReducer,
} from '@/game/engine/reducer';
import {
  getCurrentPlayer,
  getLegalMoveOptionsForCurrentPlayer,
  getBestBotMove,
} from '@/game/engine/selectors';
import { Player, PlayerColor, PowerCardType, GameState } from '@/game/engine/types';
import { LudoBoard } from '@/components/board/LudoBoard';
import { DiceComponent } from '@/components/dice/DiceComponent';
import { PowerCardDeck } from '@/components/powerCards/PowerCardDeck';
import { VoiceChat } from '@/components/voice/VoiceChat';
import { VoiceControls } from '@/components/voice/VoiceControls';
import { PlayerCard } from '@/components/game/PlayerCard';
import { LocalPlayerDock } from '@/components/game/LocalPlayerDock';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { VictoryModal } from '@/components/modals/VictoryModal';
import { LobbyRoom } from '@/components/lobby/LobbyRoom';
import { LobbySocial } from '@/components/lobby/LobbySocial';
import { OpponentStrip } from '@/components/game/OpponentStrip';
import { OpponentProfileSheet } from '@/components/profile/OpponentProfileSheet';
import { soundEngine, refreshSfxOverrides } from '@/components/sound/soundEngine';
import { AudioSettings } from '@/components/sound/AudioSettings';
import { useVoiceMic } from '@/components/sound/useVoiceMic';
import { ProfileDrawer } from '@/components/profile/ProfileDrawer';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { gameTheme } from '@/theme/tokens';
import { getCharacter } from '@/game/characters';
import { loadProfile, saveProfile, profileName, PlayerProfile, getAuthToken } from '@/game/profile';
import { loadSettings, saveSettings, GameSettings, BOARD_THEME_ACCENT } from '@/game/settings';
import { apiUpdateProfile } from '@/lib/authClient';
import {
  RoomState,
  getDeviceId,
  apiCreateRoom,
  apiJoinRoom,
  apiFetchRoom,
  apiSetReady,
  apiLeaveRoom,
} from '@/lib/roomClient';

const TURN_TIMEOUT_SECONDS = 30;
const STORAGE_PREFIX = 'ludo_save_v1_';

/*
 * Dynamically sizes the square Ludo board to fill the available stage:
 * boardSize = min(availableWidth, availableHeight) so no empty space is left
 * above/below the board and the board never pushes anything else off-screen.
 *
 * Uses a callback ref so the observer attaches the moment the board node
 * actually mounts (the stage is only rendered after the mounted flag flips),
 * and re-measures whenever the layout changes.
 */
function useFitBoard() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (el) {
      const update = () => {
        const r = el.getBoundingClientRect();
        setSize({ w: r.width, h: r.height });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      roRef.current = ro;
    }
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  const boardSize = Math.max(0, Math.floor(Math.min(size.w, size.h)));
  const stagePad = size.h > boardSize ? Math.max(0, (size.h - boardSize) / 2) : 0;
  return { ref, boardSize, stagePad };
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const mode = searchParams.get('mode') || 'bots';
  const roomCode = searchParams.get('code') || 'LUDO12';
  // For bots / pass-play you are always the host (you can start the lobby).
  const isHost = searchParams.get('host') === 'true' || mode !== 'room';
  const storageKey = `${STORAGE_PREFIX}${roomCode}`;

  const [inLobby, setInLobby] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showPowerCards, setShowPowerCards] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const [saveInitialized, setSaveInitialized] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIMEOUT_SECONDS);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const mic = useVoiceMic();
  const meSpeaking = mic.speaking;
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const timerKeyRef = useRef(0);
  const [diceSettled, setDiceSettled] = useState(false);
  const fitBoard = useFitBoard();

  // ---- Online room sync (mode === 'room') ----
  const deviceId = useMemo(getDeviceId, []);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const roomJoinedRef = useRef(false);
  const [roomAttempt, setRoomAttempt] = useState(0);
  const [viewProfile, setViewProfile] = useState<Player | null>(null);

  // Browser back-button guard: warn before leaving an active match.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Load the admin-managed custom SFX audio (if any).
  useEffect(() => {
    void refreshSfxOverrides();
  }, []);

  const handleSpeakerToggle = () => setSpeakerMuted((m) => !m);

  // Seat order — your chosen character takes its own color seat (not always Red).
  const SEAT_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  const defaultSeats: Player[] = [
    { id: 'p2', name: mode === 'pass' ? 'Player 2' : 'Bot Alex', color: 'green', isBot: mode !== 'pass', avatar: '🤖', ready: true, connected: true, wins: 8, xp: 320 },
    { id: 'p3', name: mode === 'pass' ? 'Player 3' : 'Bot Maya', color: 'yellow', isBot: mode !== 'pass', avatar: '🐱', ready: true, connected: true, wins: 15, xp: 600 },
    { id: 'p4', name: mode === 'pass' ? 'Player 4' : 'Bot Sam', color: 'blue', isBot: mode !== 'pass', avatar: '🦁', ready: true, connected: true, wins: 5, xp: 210 },
  ];

  const [players, setPlayers] = useState<Player[]>(() => buildSeats(profile, defaultSeats));
  const [gameState, dispatch] = useReducer(gameReducer, null, () =>
    createInitialGameState(buildSeats(profile, defaultSeats), roomCode)
  );

  // Build the ordered roster (red→green→yellow→blue) with YOU sitting in the
  // color seat of the chosen character, so your gotis are that character.
  function buildSeats(prof: PlayerProfile, others: Player[]): Player[] {
    const chosen = prof.characterId;
    const you: Player = {
      id: 'p1',
      name: profileName(prof),
      color: chosen,
      isBot: false,
      avatar: getCharacter(chosen).emoji,
      avatarUrl: prof.avatarUrl,
      ready: true,
      connected: true,
      wins: prof.wins,
      xp: prof.xp,
    };
    const otherColors = SEAT_COLORS.filter((c) => c !== chosen);
    return SEAT_COLORS.map((color) => {
      if (color === chosen) return you;
      const base = others[otherColors.indexOf(color)];
      return {
        ...base,
        color,
        name: base.name.replace(/ \(.*\)$/, ` (${color.toUpperCase()})`),
      };
    });
  }

  // Build engine seats from a synced online room (all real human players).
  function roomSeats(room: RoomState): Player[] {
    return room.players.map((m) => ({
      id: m.deviceId || m.id,
      name: m.name,
      color: m.color as PlayerColor,
      isBot: false,
      avatar: getCharacter(m.color as PlayerColor).emoji,
      avatarUrl: m.avatarUrl || undefined,
      ready: true,
      connected: true,
      wins: 0,
      xp: 0,
    }));
  }

  // ---- Join the online room once (host creates it, guest joins it) ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || !inLobby) return;
    if (roomJoinedRef.current) return;
    roomJoinedRef.current = true;

    const myName = profileName(profile) || (isHost ? 'Host' : 'Player');
    const join = async () => {
      try {
        const res = isHost
          ? await apiCreateRoom({
              code: roomCode,
              hostName: myName,
              characterId: profile.characterId,
              avatarUrl: profile.avatarUrl,
              deviceId,
            })
          : await apiJoinRoom({
              code: roomCode,
              name: myName,
              characterId: profile.characterId,
              avatarUrl: profile.avatarUrl,
              deviceId,
            });
        setRoomState(res.room);
        setRoomError(null);
      } catch (e) {
        setRoomError(e instanceof Error ? e.message : 'Could not connect to the room');
        roomJoinedRef.current = false; // allow retry
      }
    };
    void join();
  }, [mounted, mode, inLobby, isHost, roomCode, profile, deviceId, roomAttempt]);

  // ---- Poll the room so new joiners / ready states appear live ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || !inLobby) return;
    const id = setInterval(() => {
      apiFetchRoom(roomCode)
        .then((d) => {
          setRoomState(d.room);
          setRoomError(null);
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(id);
  }, [mounted, mode, inLobby, roomCode]);

  // ---- Dice reveal gate: only show legal-move hints / auto-move AFTER the
  //      dice finishes its spinning animation (so the number is revealed first).
  useEffect(() => {
    if (gameState.dice.value === null) {
      const t = setTimeout(() => setDiceSettled(false), 0);
      return () => clearTimeout(t);
    }
    // Reset to hidden, then reveal after the ~1.15s roll animation.
    const reset = setTimeout(() => setDiceSettled(false), 0);
    const t = setTimeout(() => setDiceSettled(true), 1250);
    return () => {
      clearTimeout(reset);
      clearTimeout(t);
    };
  }, [gameState.dice.value, gameState.dice.rolling]);

  const currentPlayer = getCurrentPlayer(gameState);
  const legalMoves = useMemo(() => getLegalMoveOptionsForCurrentPlayer(gameState), [gameState]);
  const isMyTurn = !currentPlayer.isBot;
  // Only show which gotis may move after the dice number has been revealed,
  // and only when it is the human player's turn.
  const visibleLegalMoves = isMyTurn && diceSettled ? legalMoves : [];

  // Auto-play: when the human has exactly ONE legal move, play it for them.
  // When they must move but nothing can move, pass automatically. Bots already
  // decide on their own, so this only ever touches the human turn.
  useEffect(() => {
    if (!isMyTurn || !diceSettled || inLobby) return;
    if (gameState.status !== 'playing' || gameState.winner) return;

    if (legalMoves.length === 1) {
      const t = setTimeout(() => {
        dispatch({ type: 'SELECT_TOKEN', targetTokenId: legalMoves[0].tokenId });
      }, 700);
      return () => clearTimeout(t);
    }
    if (legalMoves.length === 0 && gameState.dice.mustMove) {
      const t = setTimeout(() => {
        dispatch({ type: 'PASS_TURN' });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isMyTurn, diceSettled, inLobby, legalMoves, gameState.status, gameState.winner, gameState.dice.mustMove]);

  // Finished-goti counters per color (shown on the mobile player boxes).
  const homeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const color of Object.keys(gameState.tokens)) {
      map[color] = (gameState.tokens[color as PlayerColor] || []).filter((t) => t.status === 'finished').length;
    }
    return map;
  }, [gameState.tokens]);

  // Which player is "speaking" right now (your mic dot).
  const myPlayerId = mode === 'room' ? deviceId : 'p1';
  const mySeat = gameState.players.find((p) => p.id === myPlayerId);

  // Seat helpers: the local player sits in their own seat (chosen color in
  // local modes, assigned seat in online rooms).
  const localColor = mySeat?.color ?? profile.characterId;
  const localPlayer = mySeat ?? gameState.players[0];
  const speakingSeat = meSpeaking ? localColor : undefined;
  const opponents = gameState.players.filter((p) => p.id !== myPlayerId);

  // Room invite link used by the lobby share button and player profile sheets.
  const roomInviteLink =
    mode === 'room'
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/game?mode=room&code=${roomCode}&host=false`
      : undefined;
  const openProfileSheet = (p: Player) => setViewProfile(p);

  // Players shown in the lobby — the live synced roster for online rooms.
  const lobbyPlayers: Player[] =
    mode === 'room' && roomState
      ? roomState.players.map((m) => {
          const isMe = m.deviceId === deviceId;
          return {
            id: m.deviceId || m.id,
            // The local player's own seat always shows the current profile
            // (name/avatar may have just been edited in the profile sheet).
            name: isMe ? profileName(profile) : m.name,
            color: m.color as PlayerColor,
            isBot: false,
            avatar: getCharacter(m.color as PlayerColor).emoji,
            avatarUrl: isMe ? profile.avatarUrl || undefined : m.avatarUrl || undefined,
            ready: m.ready,
            connected: true,
            wins: 0,
            xp: 0,
          };
        })
      : players;

  // ---- Reconnect: offer to resume a saved in-progress game ----
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved: GameState = JSON.parse(raw);
          if (saved && saved.status === 'playing' && !saved.winner) {
            setShowReconnect(true);
            return;
          }
        }
      } catch {
        /* ignore corrupt save */
      }
      setSaveInitialized(true);
    }, 0);
    return () => clearTimeout(t);
  }, [mounted, storageKey]);

  const handleSettingsChange = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  // ---- Persist game state whenever it changes while playing ----
  useEffect(() => {
    if (!mounted || inLobby || !saveInitialized) return;
    if (gameState.status !== 'playing') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(gameState));
    } catch {
      /* storage may be full/unavailable */
    }
  }, [mounted, inLobby, saveInitialized, gameState, storageKey]);

  const handleResumeGame = () => {
    setShowReconnect(false);
    setSaveInitialized(true);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: GameState = JSON.parse(raw);
        setPlayers(saved.players);
        dispatch({ type: 'RESTORE_GAME', state: saved });
        setInLobby(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setInLobby(false);
  };

  const handleNewGame = () => {
    setShowReconnect(false);
    setSaveInitialized(true);
    localStorage.removeItem(storageKey);
    const next = buildSeats(profile, defaultSeats);
    setPlayers(next);
    dispatch({ type: 'RESTORE_GAME', state: createInitialGameState(next, roomCode) });
    setInLobby(false);
  };

  // ---- AI Bot Automatic Turn Logic ----
  useEffect(() => {
    if (!mounted || inLobby || gameState.status !== 'playing' || gameState.winner) return;

    if (currentPlayer.isBot) {
      const timer = setTimeout(() => {
        if (!gameState.dice.mustMove && !gameState.dice.noLegalMove) {
          dispatch({ type: 'ROLL_DICE' });
        } else if (gameState.dice.value !== null && !gameState.dice.noLegalMove) {
          const bestMove = getBestBotMove(gameState, currentPlayer.color, gameState.dice.value);
          if (bestMove) {
            soundEngine.playTokenMove();
            dispatch({ type: 'SELECT_TOKEN', targetTokenId: bestMove.tokenId });
          } else {
            dispatch({ type: 'PASS_TURN' });
          }
        }
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [mounted, gameState, currentPlayer, inLobby]);

  // ---- Auto-pass after showing the rolled dice when there are no legal moves ----
  useEffect(() => {
    if (!mounted || inLobby || gameState.status !== 'playing' || gameState.winner) return;
    if (!gameState.dice.noLegalMove) return;

    const timer = setTimeout(() => {
      dispatch({ type: 'PASS_TURN' });
    }, 1600);

    return () => clearTimeout(timer);
  }, [mounted, inLobby, gameState.dice.noLegalMove, gameState.status, gameState.winner]);

  // ---- 60s Turn Timer (human turns only): auto roll + auto move ----
  useEffect(() => {
    if (!mounted || inLobby || gameState.status !== 'playing' || gameState.winner) return;
    if (currentPlayer.isBot) return;

    timerKeyRef.current += 1;
    const key = timerKeyRef.current;

    // Defer the reset out of the effect body (avoids cascading renders)
    const resetT = setTimeout(() => {
      if (key !== timerKeyRef.current) return;
      setTurnTimeLeft(TURN_TIMEOUT_SECONDS);
    }, 0);

    const interval = setInterval(() => {
      if (key !== timerKeyRef.current) return;
      setTurnTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    return () => {
      clearTimeout(resetT);
      clearInterval(interval);
    };
  }, [mounted, inLobby, gameState.status, gameState.winner, currentPlayer, gameState.dice.mustMove, gameState.dice.noLegalMove]);

  // When timer reaches 0, act on behalf of the human player — but never while
// the dice is still spinning or before its result has been revealed.
  useEffect(() => {
    if (turnTimeLeft > 0) return;
    if (!mounted || inLobby || gameState.status !== 'playing' || gameState.winner) return;
    if (currentPlayer.isBot || gameState.dice.noLegalMove) return;

    // Time is up and a roll is expected — roll immediately.
    if (!gameState.dice.mustMove) {
      timerKeyRef.current += 1;
      dispatch({ type: 'ROLL_DICE' });
      return;
    }

    // A roll is pending: wait until the dice animation ends and the number shows.
    if (gameState.dice.rolling || !diceSettled || gameState.dice.value === null) return;

    timerKeyRef.current += 1;
    const bestMove = getBestBotMove(gameState, currentPlayer.color, gameState.dice.value);
    if (bestMove) {
      soundEngine.playTokenMove();
      dispatch({ type: 'SELECT_TOKEN', targetTokenId: bestMove.tokenId });
    } else {
      dispatch({ type: 'PASS_TURN' });
    }
  }, [turnTimeLeft, diceSettled, mounted, inLobby, gameState, currentPlayer]);

  // Browser back-button guard: warn before leaving an active match.
  useEffect(() => {
    if (inLobby) return;
    window.history.pushState({ ludoTrap: true }, '');
    const onPop = () => {
      setShowLeaveConfirm(true);
      window.history.pushState({ ludoTrap: true }, '');
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!inLobby) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [inLobby]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        Loading Ludo Master...
      </div>
    );
  }

  const handleRollDice = () => {
    dispatch({ type: 'ROLL_DICE' });
  };

  const handleSelectToken = (tokenId: string) => {
    soundEngine.playTokenMove();
    dispatch({ type: 'SELECT_TOKEN', targetTokenId: tokenId });
  };

  const handleUsePowerCard = (cardType: PowerCardType) => {
    dispatch({ type: 'USE_POWER_CARD', cardType });
  };

  const handleSelectLuckyRoll = (value: number) => {
    dispatch({ type: 'ROLL_DICE', overrideValue: value });
  };

  const handleAddBotInLobby = () => {
    const availableColors: PlayerColor[] = ['green', 'yellow', 'blue'];
    const filledColors = players.map((p) => p.color);
    const nextColor = availableColors.find((c) => !filledColors.includes(c));
    if (!nextColor) return;

    const newBot: Player = {
      id: `bot_${Date.now()}`,
      name: `Bot ${nextColor.toUpperCase()}`,
      color: nextColor,
      isBot: true,
      avatar: '🤖',
      ready: true,
      connected: true,
      wins: 0,
      xp: 100,
    };
    setPlayers([...players, newBot]);
  };

  const handleStartFromLobby = () => {
    localStorage.removeItem(storageKey);
    if (mode === 'room') {
      // Online rooms never start with bots — require a synced real roster.
      if (!roomState || roomState.players.length < 2) return;
      const seats = roomSeats(roomState);
      setPlayers(seats);
      dispatch({ type: 'RESTORE_GAME', state: createInitialGameState(seats, roomCode) });
      setInLobby(false);
      return;
    }
    const next = buildSeats(profile, defaultSeats);
    setPlayers(next);
    dispatch({ type: 'RESTORE_GAME', state: createInitialGameState(next, roomCode) });
    setInLobby(false);
  };

  const handleCharacterChange = async (characterId: PlayerColor) => {
    // A color already claimed by another human player is locked (room mode).
    if (mode === 'room' && roomState) {
      const taken = roomState.players.filter((m) => m.deviceId !== deviceId).map((m) => m.color);
      if (taken.includes(characterId)) return;
    } else if (mode !== 'pass') {
      const taken = players.filter((p) => p.id !== 'p1' && !p.isBot).map((p) => p.color);
      if (taken.includes(characterId)) return;
    }
    const nextProfile = { ...profile, characterId };
    saveProfile(nextProfile);
    setProfile(nextProfile);

    if (mode === 'room') {
      // Rejoin with the new color so the server updates your seat (if free).
      try {
        const res = await apiJoinRoom({
          code: roomCode,
          name: profileName(nextProfile) || 'Player',
          characterId,
          avatarUrl: nextProfile.avatarUrl,
          deviceId,
        });
        setRoomState(res.room);
      } catch (e) {
        setRoomError(e instanceof Error ? e.message : 'Could not update your color');
      }
      return;
    }
    // Move YOU to that character's seat so the lobby shows your real color.
    setPlayers(buildSeats(nextProfile, defaultSeats));
  };

  const handleLeaveRoom = () => {
    // Warn before abandoning an active match (the in-match back arrow + browser back).
    if (!inLobby && gameState.status === 'playing' && !gameState.winner) {
      setShowLeaveConfirm(true);
      return;
    }
    if (mode === 'room' && roomState) {
      void apiLeaveRoom({ code: roomCode, deviceId });
    }
    localStorage.removeItem(storageKey);
    router.push('/');
  };

  const handleToggleReady = async () => {
    if (mode === 'room' && roomState) {
      const me = roomState.players.find((m) => m.deviceId === deviceId);
      if (!me) return;
      try {
        const res = await apiSetReady({ code: roomCode, deviceId, ready: !me.ready });
        setRoomState(res.room);
      } catch (e) {
        setRoomError(e instanceof Error ? e.message : 'Failed to update readiness');
      }
      return;
    }
    setPlayers((ps) => ps.map((p) => (p.id === 'p1' ? { ...p, ready: !p.ready } : p)));
  };

  const confirmLeaveMatch = () => {
    setShowLeaveConfirm(false);
    localStorage.removeItem(storageKey);
    router.replace('/');
  };

  const isTimerVisible = !inLobby && !currentPlayer.isBot && gameState.status === 'playing' && !gameState.winner;
  const activePlayer = gameState.players[gameState.currentTurnIndex];
  const activeColorStyle = activePlayer ? gameTheme.players[activePlayer.color] : gameTheme.players.red;

  // Render the board immediately even before the first ResizeObserver tick,
  // then let the observer refine the exact size. Never a blank stage.
  const fallbackBoardSize =
    typeof window !== 'undefined'
      ? Math.max(200, Math.min(window.innerWidth - 24, window.innerHeight - (window.innerWidth < 640 ? 230 : 320)))
      : 0;
  const boardRenderSize = fitBoard.boardSize > 0 ? fitBoard.boardSize : fallbackBoardSize;

  // Desktop profiles hug the board — each card sits beside its color zone,
// positioned relative to the board itself (20% / 80% of the board height).
  const seatOf = (color: PlayerColor) => gameState.players.find((p) => p.color === color);
  const seatCard = (color: PlayerColor) => {
    const player = seatOf(color);
    if (!player) return null;
    const isLocalSeat = player.color === localColor;
    return {
      player,
      currentColor: currentPlayer.color,
      speakingColor: speakingSeat,
      homeCount: homeCounts[player.color] ?? 0,
      micOn: isLocalSeat && mic.micOn,
      speakerMuted: isLocalSeat && speakerMuted,
      isLocal: isLocalSeat,
      avatarImage: isLocalSeat ? profile.avatarUrl : undefined,
      onClick: isLocalSeat ? () => setShowProfileSheet(true) : () => openProfileSheet(player),
    };
  };
  const redCard = seatCard('red');
  const blueCard = seatCard('blue');
  const greenCard = seatCard('green');
  const yellowCard = seatCard('yellow');

  return (
    <main className="game-room h-[100dvh] w-full overflow-hidden flex flex-col justify-between p-2 pb-0 select-none relative text-white">

      {/* Reconnect Modal */}
      <AnimatePresence>
        {showReconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4"
            >
              <div className="text-4xl">🔌</div>
              <h2 className="text-lg font-black text-white">Game in Progress</h2>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                We found an in-progress match in room <span className="text-amber-400 font-bold">{roomCode}</span>.
                Would you like to reconnect and continue playing?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleResumeGame}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase transition-colors"
                >
                  🔄 Reconnect &amp; Continue
                </button>
                <button
                  onClick={handleNewGame}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors"
                >
                  Start a New Game
                </button>
              </div>
            </motion.div>
          </motion.div>
            )}
          </AnimatePresence>

      {inLobby ? (
        <div className="flex-1 min-h-0 overflow-y-auto py-3 no-scrollbar">
          <div className="min-h-full flex items-center justify-center px-1">
            <div className="w-full max-w-lg mx-auto">
              {/* Lobby header with profile access */}
              <header className="relative z-[70] flex items-center justify-between mb-3 px-2 h-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    onClick={handleLeaveRoom}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors shrink-0"
                    aria-label="Leave lobby"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-lg leading-none">🎲</span>
                  <span className="font-extrabold text-[11px] tracking-tight hidden sm:inline">LUDO</span>
                </div>
                <div className="bg-slate-950/80 px-2 py-1 rounded-full border border-slate-800 text-[9px] font-bold text-slate-300 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">ROOM:</span>{' '}
                  <span className="text-amber-400 font-extrabold">{roomCode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowLeaderboard(true)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-amber-300 hover:text-amber-200 flex items-center justify-center transition-colors"
                    aria-label="Leaderboard"
                  >
                    <Trophy className="w-4 h-4" />
                  </button>
                  <div className="p-0.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors shrink-0">
                    <CharacterAvatar
                      color={profile.characterId}
                      image={profile.avatarUrl}
                      onClick={() => setShowProfileSheet(true)}
                      aria-label="Open player profile"
                      className="w-7 h-7"
                    />
                  </div>
                </div>
              </header>
              {mode === 'room' && !roomState ? (
                <div className="mx-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
                  {roomError ? (
                    <div className="space-y-3">
                      <div className="text-3xl">📡</div>
                      <div className="text-sm font-extrabold text-red-300">Could not join room {roomCode}</div>
                      <p className="text-[11px] text-slate-400 font-semibold">{roomError}</p>
                      <button
                        onClick={() => setRoomAttempt((a) => a + 1)}
                        className="mt-1 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs tracking-wider"
                      >
                        RETRY
                      </button>
                      <button
                        onClick={handleLeaveRoom}
                        className="block mx-auto mt-2 text-[11px] font-bold text-slate-500 hover:text-white"
                      >
                        ← Back to home
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <div className="text-sm font-extrabold text-white">Joining room {roomCode}…</div>
                      <p className="text-[11px] text-slate-500 font-semibold">Syncing your profile with the lobby.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {roomError && mode === 'room' && (
                    <div className="mb-3 mx-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-[11px] font-bold text-red-300 text-center">
                      ⚠️ {roomError}
                    </div>
                  )}
                  <LobbyRoom
                    roomCode={roomCode}
                    players={lobbyPlayers}
                    isHost={isHost}
                    onAddBot={mode === 'room' ? undefined : handleAddBotInLobby}
                    onToggleReady={handleToggleReady}
                    onStartGame={handleStartFromLobby}
                    onLeaveRoom={handleLeaveRoom}
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    characterId={profile.characterId}
                    onCharacterChange={handleCharacterChange}
                    takenColors={
                      mode === 'room' && roomState
                        ? (roomState.players.filter((m) => m.deviceId !== deviceId).map((m) => m.color) as PlayerColor[])
                        : mode !== 'pass'
                          ? (players.filter((p) => p.id !== 'p1' && !p.isBot).map((p) => p.color) as PlayerColor[])
                          : []
                    }
                    localPlayerId={mode === 'room' ? deviceId : 'p1'}
                    inviteLink={roomInviteLink}
                    roomMode={mode === 'room'}
                    onViewProfile={openProfileSheet}
                  />
                  {mode === 'room' && (
                    <LobbySocial
                      roomCode={roomCode}
                      deviceId={deviceId}
                      profile={profile}
                      roomPlayerNames={roomState ? roomState.players.map((m) => m.name) : []}
                      variant="full"
                      className="mt-4"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Bar Navigation — compact game header */}
          <header className="relative z-[70] flex items-center justify-between max-w-[1400px] mx-auto w-full h-11 px-2 sm:px-3 bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-lg flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={handleLeaveRoom}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors shrink-0"
                aria-label="Leave game"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-lg leading-none">🎲</span>
                <span className="font-extrabold text-[11px] tracking-tight hidden sm:inline">LUDO</span>
              </div>
            </div>

            <div className="bg-slate-950/80 px-2 py-1 rounded-full border border-slate-800 text-[9px] font-bold text-slate-300 flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">ROOM:</span>{' '}
              <span className="text-amber-400 font-extrabold">{roomCode}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowLeaderboard(true)}
                className="w-8 h-8 rounded-full bg-slate-800 text-amber-300 hover:text-amber-200 flex items-center justify-center transition-colors"
                aria-label="Leaderboard"
              >
                <Trophy className="w-4 h-4" />
              </button>
              <div className="p-0.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors shrink-0">
                <CharacterAvatar
                  color={profile.characterId}
                  image={profile.avatarUrl}
                  onClick={() => setShowProfileSheet(true)}
                  aria-label="Open player profile"
                  className="w-7 h-7"
                />
              </div>
              <AudioSettings />
            </div>
          </header>

          {/* Game Stage — the board fills the whole stage; mobile info floats on top */}
          <div className="relative z-10 flex-1 min-h-0 min-w-0 w-full mx-auto flex items-stretch max-w-[1600px]">
            {/* Desktop: soft “table felt” backdrop that frames board + profiles */}
            <div
              className="absolute inset-x-4 -top-1 -bottom-1 hidden lg:block rounded-[2.2rem] pointer-events-none"
              style={{
                background: 'radial-gradient(130% 140% at 50% 0%, rgba(148,163,184,0.06) 0%, rgba(2,6,23,0.55) 78%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.05), inset -1px 0 0 rgba(255,255,255,0.03),' +
                  ' inset 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.5),' +
                  ' inset 0 0 110px rgba(0,0,0,0.38), 0 32px 70px -44px rgba(0,0,0,0.9)',
                border: '1px solid rgba(148,163,184,0.08)',
              }}
            />

            {/* Board stage — board sized to the full stage on every viewport */}
            <div ref={fitBoard.ref} className="relative flex-1 min-h-0 min-w-0 w-full flex items-center justify-center">
              {boardRenderSize > 0 && (
                <div className="relative" style={{ width: boardRenderSize, height: boardRenderSize }}>
                  {/* Desktop profiles hug the board beside their color zones */}
                  <div className="hidden lg:block absolute right-full top-0 bottom-0" style={{ width: 232, marginRight: 14 }}>
                    {redCard && (
                      <div className="absolute right-0 -translate-y-1/2 w-full" style={{ top: '20%' }}>
                        <PlayerCard {...redCard} />
                      </div>
                    )}
                    {blueCard && (
                      <div className="absolute right-0 -translate-y-1/2 w-full" style={{ top: '80%' }}>
                        <PlayerCard {...blueCard} />
                      </div>
                    )}
                  </div>

                  <div className="hidden lg:block absolute left-full top-0 bottom-0" style={{ width: 232, marginLeft: 14 }}>
                    {greenCard && (
                      <div className="absolute left-0 -translate-y-1/2 w-full" style={{ top: '20%' }}>
                        <PlayerCard {...greenCard} />
                      </div>
                    )}
                    {yellowCard && (
                      <div className="absolute left-0 -translate-y-1/2 w-full" style={{ top: '80%' }}>
                        <PlayerCard {...yellowCard} />
                      </div>
                    )}
                  </div>

                  <LudoBoard
                    gameState={gameState}
                    legalMoves={visibleLegalMoves}
                    onSelectToken={handleSelectToken}
                    gotiShape={settings.gotiShape}
                    theme={settings.theme}
                  />
                </div>
              )}

              {/* Mobile overlay: opponents — scrollable, non-collapsing chips you can tap to view the profile */}
              <div className="lg:hidden absolute top-1.5 inset-x-1 flex justify-center z-20">
                {opponents.length > 0 && (
                  <div className="w-full max-w-[min(100%,520px)] rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md px-1 py-1 shadow-lg">
                    <OpponentStrip
                      players={opponents}
                      currentColor={currentPlayer.color}
                      speakingColor={speakingSeat}
                      finishedCounts={homeCounts}
                      onSelect={openProfileSheet}
                    />
                  </div>
                )}
              </div>

              {/* Mobile overlay: local player dock — compact profile + voice, floats over the board */}
              <div className="lg:hidden absolute bottom-1.5 inset-x-2 flex justify-center z-20">
                <LocalPlayerDock
                  player={localPlayer}
                  currentColor={currentPlayer.color}
                  speakingColor={speakingSeat}
                  homeCount={homeCounts[localPlayer.color] ?? 0}
                  mic={mic}
                  speakerMuted={speakerMuted}
                  onSpeakerToggle={handleSpeakerToggle}
                  avatarImage={profile.avatarUrl}
                  onOpenProfile={() => setShowProfileSheet(true)}
                  className="w-full max-w-[min(100%,460px)]"
                />
              </div>
            </div>
          </div>

          {/* Bottom action bar — dice primary, power & voice secondary */}
          <footer
            className="relative z-[70] w-full max-w-3xl mx-auto mt-1 sm:mt-2 px-2 sm:px-0 pb-[max(0.45rem,env(safe-area-inset-bottom))] flex-shrink-0"
          >
            <div
              className="flex items-center justify-between gap-2 sm:gap-3 rounded-2xl px-2 sm:px-4 py-1 sm:py-1.5 bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 shadow-xl"
              style={{ borderColor: `${settings.theme ? BOARD_THEME_ACCENT[settings.theme] : '#334155'}44` }}
            >
              {/* Power cards — collapsed chip (mobile) / inline deck (desktop) */}
              <div className="flex-1 min-w-0 flex items-center justify-start gap-1.5">
                <button
                  onClick={() => setShowPowerCards(true)}
                  disabled={!isMyTurn}
                  aria-label="Power cards"
                  className="sm:hidden w-11 h-11 rounded-2xl bg-slate-900 border border-purple-500/40 flex items-center justify-center text-xl relative transition-all active:scale-95 disabled:opacity-50"
                >
                  🃏
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center border border-white/30"
                    style={{ background: gameTheme.players[currentPlayer.color].primary }}
                  >
                    {gameState.powerCards[currentPlayer.color]?.length ?? 0}
                  </span>
                </button>
                <div className="hidden sm:block sm:w-[250px]">
                  <PowerCardDeck
                    availableCards={gameState.powerCards[currentPlayer.color] || []}
                    isMyTurn={isMyTurn}
                    onUseCard={handleUsePowerCard}
                    onSelectLuckyRoll={handleSelectLuckyRoll}
                    onCancelLuckyRoll={() => dispatch({ type: 'CANCEL_LUCKY_ROLL' })}
                    pendingLuckyRoll={gameState.pendingLuckyRoll}
                  />
                </div>
              </div>

              {/* Dice pod — compact, primary and connected to the active player */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div
                  className="relative rounded-xl px-1 py-0.5 sm:px-2 sm:py-1.5 border flex items-center justify-center"
                  style={{
                    background: `radial-gradient(130% 150% at 50% 0%, ${activeColorStyle.primary}30 0%, rgba(9,13,26,0.96) 80%)`,
                    borderColor: `${activeColorStyle.primary}50`,
                    boxShadow: `0 8px 22px -10px rgba(0,0,0,0.7), 0 0 18px ${activeColorStyle.primary}1f, inset 0 1px 0 rgba(255,255,255,0.1)`,
                  }}
                >
                  <div
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full blur-lg pointer-events-none"
                    style={{ background: `${activeColorStyle.primary}55` }}
                  />
                  <div className="scale-[0.66] origin-center sm:scale-[0.85]">
                    <DiceComponent
                      diceState={gameState.dice}
                      activeColor={currentPlayer.color}
                      isMyTurn={isMyTurn}
                      onRoll={handleRollDice}
                      turnTimeLeft={isTimerVisible ? turnTimeLeft : undefined}
                      turnTimeout={TURN_TIMEOUT_SECONDS}
                    />
                  </div>
                </div>

                {/* Active turn chip */}
                <div
                  className="hidden sm:flex items-center gap-1 rounded-full px-2 py-0.5 border"
                  style={{ borderColor: `${activeColorStyle.primary}50`, background: `${activeColorStyle.primary}12` }}
                >
                  <CharacterAvatar color={activePlayer.color} className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase tracking-wide" style={{ color: activeColorStyle.primary }}>
                    {activePlayer.color}
                  </span>
                  {isMyTurn && (
                    <motion.span
                      animate={{ opacity: [1, 0.45, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="text-[7px] font-black text-emerald-300"
                    >
                      • YOUR TURN
                    </motion.span>
                  )}
                </div>
              </div>

              {/* Voice zone — quick voice lines (all) + mic/speaker (desktop) */}
              <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                <div className="hidden sm:flex">
                  <VoiceControls
                    mic={mic}
                    speakerMuted={speakerMuted}
                    onSpeakerToggle={handleSpeakerToggle}
                  />
                </div>
                <VoiceChat players={gameState.players} />
              </div>
            </div>
          </footer>

          {/* Mobile power-cards popup */}
          <AnimatePresence>
            {showPowerCards && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPowerCards(false)}
                className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.92, y: 16 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.92, y: 16 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-900 border-2 border-purple-500/40 rounded-3xl p-5 w-full max-w-xs shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-white tracking-wider">🃏 POWER CARDS</span>
                    <button
                      onClick={() => setShowPowerCards(false)}
                      className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                      aria-label="Close power cards"
                    >
                      ✕
                    </button>
                  </div>
                  <PowerCardDeck
                    availableCards={gameState.powerCards[currentPlayer.color] || []}
                    isMyTurn={isMyTurn}
                    onUseCard={(card) => {
                      setShowPowerCards(false);
                      handleUsePowerCard(card);
                    }}
                    onSelectLuckyRoll={handleSelectLuckyRoll}
                    onCancelLuckyRoll={() => dispatch({ type: 'CANCEL_LUCKY_ROLL' })}
                    pendingLuckyRoll={gameState.pendingLuckyRoll}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

{/* Leaderboard */}
          <Leaderboard
            isOpen={showLeaderboard}
            onClose={() => setShowLeaderboard(false)}
            players={gameState.players}
          />

          {/* Pre-loaded voice chat (BGMI-style quick lines) — docked in the footer, no overlap */}

          {/* Victory Modal */}
          {gameState.winner && (
            <VictoryModal
              winnerColor={gameState.winner}
              players={gameState.players}
              onPlayAgain={() => {
                localStorage.removeItem(storageKey);
                dispatch({ type: 'START_GAME' });
              }}
              onReturnHome={handleLeaveRoom}
            />
          )}

          {/* Profile bottom sheet */}
          <ProfileDrawer
            isOpen={showProfileSheet}
            onClose={() => setShowProfileSheet(false)}
            username={profile.username || 'Player'}
            profile={profile}
            mic={mic}
            onUpdateProfile={(p) => {
              saveProfile(p);
              setProfile(p);
              const authToken = getAuthToken();
              if (authToken) {
                apiUpdateProfile(authToken, {
                  characterId: p.characterId,
                  displayName: p.displayName,
                  avatar: p.avatarUrl,
                }).catch(() => {});
              }
            }}
            onLogout={handleLeaveRoom}
          />

          {/* Leave-match confirmation — shown when the browser back button is pressed */}
          <AnimatePresence>
            {showLeaveConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 10 }}
                  className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
                >
                  <h3 className="text-lg font-black text-white text-center">LEAVE MATCH?</h3>
                  <p className="text-xs text-slate-400 text-center">
                    You are still in an active match. Leaving now will abandon the game and your progress will be lost.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="w-1/2 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 text-sm hover:bg-slate-700"
                    >
                      STAY
                    </button>
                    <button
                      onClick={confirmLeaveMatch}
                      className="w-1/2 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-extrabold text-white text-sm"
                    >
                      LEAVE
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* View-other-profiles sheet — works from the lobby and in-game opponent chips */}
      <OpponentProfileSheet
        open={!!viewProfile}
        player={viewProfile}
        onClose={() => setViewProfile(null)}
        inviteLink={roomInviteLink}
        roomCode={mode === 'room' ? roomCode : undefined}
        ownName={profileName(profile)}
        homeCount={viewProfile ? homeCounts[viewProfile.color] ?? 0 : 0}
        localPlay={mode !== 'room'}
        friendable={mode === 'room'}
      />
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">Loading Ludo Master...</div>}>
      <GameContent />
    </Suspense>
  );
}