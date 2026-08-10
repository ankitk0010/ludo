'use client';

import React, { useEffect, useReducer, useState, Suspense, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy } from 'lucide-react';
import {
  createInitialGameState,
  gameReducer,
  GameAction,
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
import { soundEngine, refreshSfxOverrides, setupAudioUnlockListener } from '@/components/sound/soundEngine';
import { AudioSettings } from '@/components/sound/AudioSettings';
import { useVoiceMic } from '@/components/sound/useVoiceMic';
import { ProfileDrawer } from '@/components/profile/ProfileDrawer';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { gameTheme } from '@/theme/tokens';
import { getCharacter } from '@/game/characters';
import { isImageAvatar } from '@/game/avatars';
import { loadProfile, saveProfile, profileName, PlayerProfile, getAuthToken, recordMatchWin, recordMatchLoss } from '@/game/profile';
import { loadSettings, GameSettings, BOARD_THEME_ACCENT } from '@/game/settings';
import { apiUpdateProfile, apiGetMe } from '@/lib/authClient';
import {
  RoomState,
  getDeviceId,
  apiCreateRoom,
  apiJoinRoom,
  apiFetchRoom,
  apiSetReady,
  apiLeaveRoom,
  apiRoomState,
  apiRoomStart,
  apiRoomAction,
  apiSendLiveVoice,
  apiPingRoom,
  subscribeRoomStream,
  RoomVoiceMessage,
} from '@/lib/roomClient';

const TURN_TIMEOUT_SECONDS = 30;
const STORAGE_PREFIX = 'ludo_save_v1_';

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

function playLiveAudioChunk(base64: string, mimeType: string) {
  try {
    const ctx = getSharedAudioContext();
    const parts = mimeType.split('/');
    const sampleRate = parts[0] === 'pcm' && parts[1] ? parseInt(parts[1], 10) : 44100;

    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
    }

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    try {
      const audio = new Audio(`data:${mimeType};base64,${base64}`);
      void audio.play();
    } catch {}
  }
}

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
  const [settings] = useState<GameSettings>(() => loadSettings());
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());

  // ---- Online room sync (mode === 'room') ----
  const deviceId = useMemo(getDeviceId, []);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const roomJoinedRef = useRef(false);
  const [roomAttempt, setRoomAttempt] = useState(0);
  const [viewProfile, setViewProfile] = useState<Player | null>(null);

  // Live microphone audio stream handler
  const handleLiveAudioChunk = useCallback(
    (base64: string, mimeType: string) => {
      if (mode === 'room' && !inLobby) {
        apiSendLiveVoice(roomCode, deviceId, base64, mimeType);
      }
    },
    [mode, inLobby, roomCode, deviceId]
  );

  const mic = useVoiceMic({ onAudioChunk: handleLiveAudioChunk });
  const meSpeaking = mic.speaking;
  const [remoteSpeakingColor, setRemoteSpeakingColor] = useState<string | null>(null);
  const remoteSpeakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [speakerMuted, setSpeakerMuted] = useState(false);
  const timerKeyRef = useRef(0);
  const [diceSettled, setDiceSettled] = useState(false);
  const fitBoard = useFitBoard();

  // Mirrors `inLobby` so the SSE callback can read it without re-subscribing.
  const inLobbyRef = useRef(inLobby);
  useEffect(() => {
    inLobbyRef.current = inLobby;
  }, [inLobby]);

  // Voice messages received from other players (via SSE / poll), deduped.
  const [incomingVoice, setIncomingVoice] = useState<RoomVoiceMessage[]>([]);
  const lastVoiceIdsRef = useRef<Set<string>>(new Set());
  const ingestVoice = useCallback((messages: RoomVoiceMessage[] = []) => {
    const fresh = messages.filter((m) => m.byDeviceId !== deviceId && !lastVoiceIdsRef.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => lastVoiceIdsRef.current.add(m.id));
    setIncomingVoice((prev) => [...prev, ...fresh].slice(-12));
  }, [deviceId]);

  // 3-2-1-GO countdown shown when the match opens.
  const [startCountdown, setStartCountdown] = useState(0);
  const beginStartCountdown = useCallback(() => {
    setStartCountdown(3);
  }, []);

  // Browser back-button guard: warn before leaving an active match.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [pingMs, setPingMs] = useState<number | null>(null);

  // Setup iOS / Safari WebAudio unlocker & load custom SFX
  useEffect(() => {
    setupAudioUnlockListener();
    void refreshSfxOverrides();
  }, []);

  // Real-time Ping Latency Monitor (probes every 3.5s in room mode)
  useEffect(() => {
    if (!mounted || mode !== 'room') return;
    const probe = () => {
      apiPingRoom()
        .then((rtt) => setPingMs(rtt))
        .catch(() => {});
    };
    probe();
    const timer = setInterval(probe, 3500);
    return () => clearInterval(timer);
  }, [mounted, mode]);

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

  // Apply the server's authoritative state without needless re-renders —
  // only when something actually changed (keeps local timers/highlights stable).
  const lastGameSig = useRef('');
  const applyServerState = useCallback(
    (state: GameState) => {
      const sig = JSON.stringify([
        state.currentTurnIndex,
        state.dice.value,
        state.dice.mustMove,
        state.winner,
        state.tokens,
        state.pendingLuckyRoll,
        state.activePowerCard,
      ]);
      if (sig === lastGameSig.current) return;
      lastGameSig.current = sig;
      setPlayers(state.players);
      dispatch({ type: 'RESTORE_GAME', state });
    },
    []
  );

  // Optimistic turn action execution: Dispatch locally immediately so the UI
  // responds in 0ms (no freezing or lag on dice rolls / token moves), while sending
  // the action to the server asynchronously.
  const doAction = useCallback(
    (action: GameAction) => {
      if (mode === 'room' && !inLobby) {
        // Optimistically dispatch token selection & power card moves locally so the goti moves in 0ms.
        // For ROLL_DICE, let the authoritative server roll the number so all room members receive the same dice value.
        if (action.type !== 'ROLL_DICE') {
          dispatch(action);
        }
        apiRoomAction(roomCode, deviceId, action)
          .then((res) => {
            if (!res.state) return;
            applyServerState(res.state);
          })
          .catch(() => {
            apiRoomState(roomCode)
              .then((s) => {
                if (s.state) applyServerState(s.state);
              })
              .catch(() => {});
          });
        return;
      }
      dispatch(action);
    },
    [mode, inLobby, roomCode, deviceId, applyServerState]
  );

  // ---- Join the online room once (host creates it, guest joins it) ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || !inLobby) return;
    if (roomJoinedRef.current) return;    roomJoinedRef.current = true;

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
              token: getAuthToken(),
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

  // ---- Real-time push: subscribe to the room SSE stream ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || roomError) return;
    const unsubscribe = subscribeRoomStream(roomCode, (event) => {
      if (event.type === 'state') {
        // The host started the match — pull in the authoritative state and join the game.
        if (event.status === 'PLAYING' && event.state && inLobbyRef.current) {
          applyServerState(event.state);
          setInLobby(false);
          beginStartCountdown();
          return;
        }
        if (!event.state) return;
        applyServerState(event.state);
      } else if (event.type === 'voice') {
        ingestVoice(event.voiceMessages);
      } else if (event.type === 'live_voice') {
        const chunk = event.chunk;
        if (chunk.byDeviceId !== deviceId && !speakerMuted) {
          setRemoteSpeakingColor(chunk.byColor);
          if (remoteSpeakingTimerRef.current) clearTimeout(remoteSpeakingTimerRef.current);
          remoteSpeakingTimerRef.current = setTimeout(() => setRemoteSpeakingColor(null), 1200);
          playLiveAudioChunk(chunk.audioBase64, chunk.mimeType);
        }
      }
    });
    return unsubscribe;
  }, [mounted, mode, roomCode, roomError, speakerMuted, deviceId, applyServerState, ingestVoice, beginStartCountdown]);

  // ---- Lobby: slow poll as a safety net / for joiners on other instances ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || !inLobby) return;
    const id = setInterval(() => {
      apiFetchRoom(roomCode)
        .then((d) => {
          setRoomState(d.room);
          setRoomError(null);
          // The host started the match — pull the authoritative state and join the game.
          if (d.room.status === 'PLAYING') {
            apiRoomState(roomCode)
              .then((s) => {
                if (!s.state) return;
                applyServerState(s.state);
                setInLobby(false);
                beginStartCountdown();
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [mounted, mode, inLobby, roomCode, applyServerState, beginStartCountdown]);

  // ---- Online rooms: slow poll fallback (SSE is the fast path) ----
  useEffect(() => {
    if (!mounted || mode !== 'room' || inLobby) return;
    const id = setInterval(() => {
      apiRoomState(roomCode)
        .then((s) => {
          if (s.voiceMessages) ingestVoice(s.voiceMessages);
          if (!s.state || s.status !== 'PLAYING') return;
          applyServerState(s.state);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [mounted, mode, inLobby, roomCode, applyServerState, ingestVoice]);

  // 3-2-1-GO start countdown ticker.
  useEffect(() => {
    if (startCountdown <= 0) return;
    const t = setTimeout(() => {
      setStartCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [startCountdown]);

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

  const myPlayerId = mode === 'room' ? deviceId : 'p1';
  const mySeat = gameState.players.find((p) => p.id === myPlayerId);
  // Seat helpers: the local player sits in their own seat (chosen color in
  // local modes, assigned seat in online rooms).
  const localColor = mySeat?.color ?? profile.characterId;
  const localPlayer = mySeat ?? gameState.players[0];

  const currentPlayer = getCurrentPlayer(gameState);
  const legalMoves = useMemo(() => getLegalMoveOptionsForCurrentPlayer(gameState), [gameState]);
  // Online rooms: only your own seat is "you" — never play a friend's turn.
  // Local modes: every human seat is playable on this device.
  const isMyTurn =
    mode === 'room' ? !currentPlayer.isBot && currentPlayer.id === myPlayerId : !currentPlayer.isBot;
  // Only show which gotis may move after the dice number has been revealed,
  // and only when it is the human player's turn.
  const visibleLegalMoves = isMyTurn && diceSettled ? legalMoves : [];

  // Auto-play: when the human has exactly ONE legal move, play it for them.
  // When they must move but nothing can move, pass automatically. Bots already
  // decide on their own, so this only ever touches the human turn.
  useEffect(() => {
    if (!isMyTurn || !diceSettled || inLobby || startCountdown > 0) return;
    if (gameState.status !== 'playing' || gameState.winner) return;

    if (legalMoves.length === 1) {
      const t = setTimeout(() => {
        doAction({ type: 'SELECT_TOKEN', targetTokenId: legalMoves[0].tokenId });
      }, 700);
      return () => clearTimeout(t);
    }
    if (legalMoves.length === 0 && gameState.dice.mustMove) {
      const t = setTimeout(() => {
        doAction({ type: 'PASS_TURN' });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isMyTurn, diceSettled, inLobby, startCountdown, legalMoves, gameState.status, gameState.winner, gameState.dice.mustMove, doAction]);

  // Finished-goti counters per color (shown on the mobile player boxes).
  const homeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const color of Object.keys(gameState.tokens)) {
      map[color] = (gameState.tokens[color as PlayerColor] || []).filter((t) => t.status === 'finished').length;
    }
    return map;
  }, [gameState.tokens]);

  const speakingSeat = meSpeaking ? localColor : remoteSpeakingColor || undefined;
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
    if (!mounted || inLobby || startCountdown > 0 || gameState.status !== 'playing' || gameState.winner) return;

    if (currentPlayer.isBot) {
      const timer = setTimeout(() => {
        if (!gameState.dice.mustMove && !gameState.dice.noLegalMove) {
          doAction({ type: 'ROLL_DICE' });
        } else if (gameState.dice.value !== null && !gameState.dice.noLegalMove) {
          const bestMove = getBestBotMove(gameState, currentPlayer.color, gameState.dice.value);
          if (bestMove) {
            soundEngine.playTokenMove();
            doAction({ type: 'SELECT_TOKEN', targetTokenId: bestMove.tokenId });
          } else {
            doAction({ type: 'PASS_TURN' });
          }
        }
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [mounted, gameState, currentPlayer, inLobby, startCountdown, doAction]);

  // ---- Auto-pass after showing the rolled dice when there are no legal moves ----
  useEffect(() => {
    if (!mounted || inLobby || startCountdown > 0 || gameState.status !== 'playing' || gameState.winner) return;
    if (mode === 'room' && !isMyTurn) return; // only the seat owner passes
    if (!gameState.dice.noLegalMove) return;

    const timer = setTimeout(() => {
      doAction({ type: 'PASS_TURN' });
    }, 1600);

    return () => clearTimeout(timer);
  }, [mounted, inLobby, startCountdown, mode, isMyTurn, gameState.dice.noLegalMove, gameState.status, gameState.winner, doAction]);

  // ---- 60s Turn Timer (human turns only): auto roll + auto move ----
  useEffect(() => {
    if (!mounted || inLobby || startCountdown > 0 || gameState.status !== 'playing' || gameState.winner) return;
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
  }, [mounted, inLobby, startCountdown, gameState.status, gameState.winner, currentPlayer, gameState.dice.mustMove, gameState.dice.noLegalMove, doAction]);

  // When timer reaches 0, act on behalf of the human player — but never while
// the dice is still spinning or before its result has been revealed.
  useEffect(() => {
    if (turnTimeLeft > 0) return;
    if (!mounted || inLobby || startCountdown > 0 || gameState.status !== 'playing' || gameState.winner) return;
    if (currentPlayer.isBot || gameState.dice.noLegalMove) return;

    // Time is up and a roll is expected — roll immediately.
    if (!gameState.dice.mustMove) {
      timerKeyRef.current += 1;
      doAction({ type: 'ROLL_DICE' });
      return;
    }

    // A roll is pending: wait until the dice animation ends and the number shows.
    if (gameState.dice.rolling || !diceSettled || gameState.dice.value === null) return;

    timerKeyRef.current += 1;
    const bestMove = getBestBotMove(gameState, currentPlayer.color, gameState.dice.value);
    if (bestMove) {
      soundEngine.playTokenMove();
      doAction({ type: 'SELECT_TOKEN', targetTokenId: bestMove.tokenId });
    } else {
      doAction({ type: 'PASS_TURN' });
    }
  }, [turnTimeLeft, diceSettled, mounted, inLobby, startCountdown, gameState, currentPlayer, doAction]);

  // Match end & victory persistence: record win/loss, update local profile, post to DB & sync stats
  const victoryRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    const winner = gameState.winner;
    if (!winner) {
      victoryRecordedRef.current = null;
      return;
    }

    const matchKey = `${roomCode || 'local'}-${winner}-${gameState.players.map((p) => p.color).join('-')}`;
    if (victoryRecordedRef.current === matchKey) return;
    victoryRecordedRef.current = matchKey;

    const myColor = gameState.players.find((p) => p.name === profileName(profile))?.color || profile.characterId;
    const isMyWin = myColor === winner;

    // 1. Instantly update local profile state in LocalStorage & component state
    const updatedProfile = isMyWin ? recordMatchWin(profile) : recordMatchLoss(profile);
    setProfile(updatedProfile);

    // 2. Play victory or defeat sound
    if (isMyWin) {
      soundEngine.playVictory();
    } else {
      soundEngine.playDefeat();
    }

    // 3. Post match record to server to update database user row (wins, games, xp, level)
    const token = getAuthToken();
    const winnerPlayer = gameState.players.find((p) => p.color === winner);
    const winnerName = winnerPlayer?.name || winner;

    fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        roomCode: roomCode || 'LOCAL',
        winnerColor: winner,
        winnerName,
        turnsCount: 1,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.user) {
          const syncedProfile: PlayerProfile = {
            username: data.user.username,
            displayName: data.user.displayName || data.user.username,
            characterId: (data.user.characterId as PlayerColor) || 'red',
            avatarUrl: isImageAvatar(data.user.avatar) ? data.user.avatar : undefined,
            email: data.user.email || undefined,
            level: data.user.level,
            wins: data.user.wins,
            games: data.user.games,
            xp: data.user.xp,
          };
          saveProfile(syncedProfile);
          setProfile(syncedProfile);
        } else if (token) {
          const me = await apiGetMe(token).catch(() => null);
          if (me) {
            const syncedProfile: PlayerProfile = {
              username: me.username,
              displayName: me.displayName || me.username,
              characterId: (me.characterId as PlayerColor) || 'red',
              avatarUrl: isImageAvatar(me.avatar) ? me.avatar : undefined,
              email: me.email || undefined,
              level: me.level,
              wins: me.wins,
              games: me.games,
              xp: me.xp,
            };
            saveProfile(syncedProfile);
            setProfile(syncedProfile);
          }
        }
      })
      .catch(() => {});
  }, [gameState.winner, gameState.players, roomCode, profile]);

  // Browser back-button guard: warn before leaving an active match.
  useEffect(() => {
    if (inLobby) return;
    window.history.pushState({ ludoTrap: true }, '');
    const onPop = () => {
      setShowLeaveConfirm(true);
      window.history.pushState({ ludoTrap: true }, '');
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (mode === 'room' && roomCode && deviceId) {
        try {
          const blob = new Blob([JSON.stringify({ code: roomCode, deviceId })], { type: 'application/json' });
          navigator.sendBeacon('/api/rooms/leave', blob);
        } catch {}
      }
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
  }, [inLobby, mode, roomCode, deviceId]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        Loading Ludo Master...
      </div>
    );
  }

  const handleRollDice = () => {
    if (startCountdown > 0) return;
    doAction({ type: 'ROLL_DICE' });
  };

  const handleSelectToken = (tokenId: string) => {
    if (startCountdown > 0) return;
    soundEngine.playTokenMove();
    doAction({ type: 'SELECT_TOKEN', targetTokenId: tokenId });
  };

  const handleUsePowerCard = (cardType: PowerCardType) => {
    if (startCountdown > 0) return;
    doAction({ type: 'USE_POWER_CARD', cardType });
  };

  const handleSelectLuckyRoll = (value: number) => {
    if (startCountdown > 0) return;
    doAction({ type: 'ROLL_DICE', overrideValue: value });
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
      // Online rooms: the server begins the match and every player then plays
      // the SAME authoritative board (guests are pulled in via the poll).
      if (!roomState || roomState.players.length < 2) return;
      apiRoomStart(roomCode, deviceId)
        .then((res) => {
          if (!res.state) return;
          applyServerState(res.state);
          setInLobby(false);
          beginStartCountdown();
        })
        .catch((e) => setRoomError(e instanceof Error ? e.message : 'Could not start the game'));
      return;
    }
    const next = buildSeats(profile, defaultSeats);
    setPlayers(next);
    dispatch({ type: 'RESTORE_GAME', state: createInitialGameState(next, roomCode) });
    setInLobby(false);
    beginStartCountdown();
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

  const isTimerVisible = !inLobby && startCountdown === 0 && !currentPlayer.isBot && gameState.status === 'playing' && !gameState.winner;
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="bg-slate-950/80 px-2 py-1 rounded-full border border-slate-800 text-[9px] font-bold text-slate-300 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="hidden sm:inline">ROOM:</span>{' '}
                    <span className="text-amber-400 font-extrabold">{roomCode}</span>
                  </div>
                  {mode === 'room' && pingMs !== null && (
                    <div
                      className="px-2 py-1 rounded-full border text-[9px] font-black flex items-center gap-1 shrink-0 bg-slate-950/90 shadow-sm"
                      style={{
                        borderColor: pingMs < 80 ? 'rgba(52, 211, 153, 0.4)' : pingMs < 160 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(248, 113, 113, 0.4)',
                        color: pingMs < 80 ? '#34d399' : pingMs < 160 ? '#fbbf24' : '#f87171',
                      }}
                      title={`Network Ping: ${pingMs} ms`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: pingMs < 80 ? '#34d399' : pingMs < 160 ? '#fbbf24' : '#f87171' }}
                      />
                      <span>{pingMs}ms</span>
                    </div>
                  )}
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

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="bg-slate-950/80 px-2 py-1 rounded-full border border-slate-800 text-[9px] font-bold text-slate-300 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">ROOM:</span>{' '}
                <span className="text-amber-400 font-extrabold">{roomCode}</span>
              </div>
              {mode === 'room' && pingMs !== null && (
                <div
                  className="px-2 py-1 rounded-full border text-[9px] font-black flex items-center gap-1 shrink-0 bg-slate-950/90 shadow-sm"
                  style={{
                    borderColor: pingMs < 80 ? 'rgba(52, 211, 153, 0.4)' : pingMs < 160 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(248, 113, 113, 0.4)',
                    color: pingMs < 80 ? '#34d399' : pingMs < 160 ? '#fbbf24' : '#f87171',
                  }}
                  title={`Network Ping: ${pingMs} ms`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: pingMs < 80 ? '#34d399' : pingMs < 160 ? '#fbbf24' : '#f87171' }}
                  />
                  <span>{pingMs}ms</span>
                </div>
              )}
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

          {/* 3-2-1-GO start countdown */}
          {!inLobby && startCountdown > 0 && (
            <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
              <motion.div
                key={`count-${startCountdown}`}
                initial={{ scale: 0.3, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                className="text-8xl font-black text-white"
                style={{ textShadow: `0 0 40px ${activeColorStyle.primary}aa` }}
              >
                {startCountdown}
              </motion.div>
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">Get Ready</div>
            </div>
          )}

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
                    onCancelLuckyRoll={() => doAction({ type: 'CANCEL_LUCKY_ROLL' })}
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
                <VoiceChat
                  players={gameState.players}
                  roomMode={mode === 'room'}
                  roomCode={mode === 'room' ? roomCode : undefined}
                  deviceId={deviceId}
                  incoming={incomingVoice}
                  onIncomingHandled={() => setIncomingVoice([])}
                />
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
                    onCancelLuckyRoll={() => doAction({ type: 'CANCEL_LUCKY_ROLL' })}
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
                doAction({ type: 'START_GAME' });
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