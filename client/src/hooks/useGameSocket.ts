'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
  TrackSnippet,
  LyricLine,
  PlayerGuess,
  Player,
  RoundResultsPayload
} from '../types/game';

export type RoundResultsData = RoundResultsPayload;

export function useGameSocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [lastResults, setLastResults] = useState<RoundResultsData | null>(null);
  const [speakerCue, setSpeakerCue] = useState<{ videoId: string; startSec: number; durationSec: number } | null>(null);
  const [roundTiming, setRoundTiming] = useState<{ endsAt: number; bufferEndsAt: number; durationSec: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isMissingServerUrl, setIsMissingServerUrl] = useState(false);

  // Identificador de cliente único e persistente (sobrevive a quedas de Wi-Fi e reconexões)
  const [persistentId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'p_ssr';
    try {
      let id = sessionStorage.getItem('vl_persistent_id');
      if (!id) {
        id = 'p_' + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem('vl_persistent_id', id);
      }
      return id;
    } catch {
      return 'p_' + Math.random().toString(36).substring(2, 11);
    }
  });

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((curr) => (curr === message ? null : curr));
    }, 2800);
  }, []);

  useEffect(() => {
    let configuredUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim();
    const isProd =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (!configuredUrl && isProd) {
      setIsMissingServerUrl(true);
    }

    let serverUrl: string;
    if (configuredUrl) {
      serverUrl = configuredUrl.replace(/\/+$/, '');
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && serverUrl.startsWith('http://')) {
        serverUrl = serverUrl.replace(/^http:\/\//, 'https://');
      }
    } else {
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      serverUrl = `${protocol}//${hostname}:3001`;
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || null);

      // Reconecta automaticamente na sala se já havia uma sessão ativa
      try {
        const savedPin = sessionStorage.getItem('vl_room_pin');
        if (savedPin) {
          socket.emit('room:reconnect', { pin: savedPin, persistentId });
        }
      } catch {
        // Ignora erro de storage
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setSocketId(null);
    });

    socket.on('room:sync', ({ room }) => {
      setRoom(room);
      try {
        if (room?.pin) {
          sessionStorage.setItem('vl_room_pin', room.pin);
        }
      } catch {
        // Ignora erro
      }
      if (room?.lastResults) {
        setLastResults(room.lastResults);
      }
    });

    socket.on('speaker:cue', (cue) => {
      setSpeakerCue(cue);
    });

    socket.on('round:started', (timing) => {
      setRoundTiming(timing);
      setSpeakerCue(null);
    });

    socket.on('guess:received', ({ playerId }) => {
      setRoom((curr) => {
        if (!curr) return null;
        return {
          ...curr,
          players: curr.players.map((p) =>
            p.id === playerId ? { ...p, hasGuessed: true } : p
          )
        };
      });
    });

    socket.on('round:results', (results) => {
      setLastResults(results);
      setRoundTiming(null);
    });

    socket.on('error:toast', ({ message }) => {
      showToast(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [persistentId, showToast]);

  const createRoom = useCallback((nickname: string) => {
    socketRef.current?.emit('room:create', { nickname, persistentId });
  }, [persistentId]);

  const joinRoom = useCallback((pin: string, nickname: string) => {
    try {
      sessionStorage.setItem('vl_room_pin', pin);
    } catch {
      // Ignora erro
    }
    socketRef.current?.emit('room:join', { pin, nickname, persistentId });
  }, [persistentId]);

  const claimSpeaker = useCallback((pin: string) => {
    socketRef.current?.emit('room:claim_speaker', { pin });
  }, []);

  const startGame = useCallback((pin: string, totalRounds: number = 5) => {
    socketRef.current?.emit('game:start', { pin, totalRounds });
  }, []);

  const searchYouTube = useCallback((query: string): Promise<any[]> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve([]);

      // Timeout defensivo de 4.5s no cliente para nunca travar a UI
      const timer = setTimeout(() => {
        resolve([]);
      }, 4500);

      socketRef.current.emit('youtube:search', { query }, (results) => {
        clearTimeout(timer);
        resolve(results || []);
      });
    });
  }, []);

  const fetchLyrics = useCallback((trackName: string, artistName: string): Promise<LyricLine[]> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve([]);

      const timer = setTimeout(() => {
        resolve([]);
      }, 3500);

      socketRef.current.emit('lyrics:fetch', { trackName, artistName }, (lyrics) => {
        clearTimeout(timer);
        resolve(lyrics || []);
      });
    });
  }, []);

  const selectTrack = useCallback((pin: string, snippet: TrackSnippet) => {
    socketRef.current?.emit('track:select', { pin, snippet });
  }, []);

  const startSpeakerPlayback = useCallback((pin: string) => {
    socketRef.current?.emit('speaker:started', { pin });
  }, []);

  const submitGuess = useCallback((pin: string, track: string, artist: string) => {
    socketRef.current?.emit('guess:submit', { pin, track, artist });
  }, []);

  const nextRound = useCallback((pin: string) => {
    socketRef.current?.emit('round:next', { pin });
  }, []);

  const rematch = useCallback((pin: string) => {
    socketRef.current?.emit('game:rematch', { pin });
  }, []);

  // Procura jogador prioritariamente pelo persistentId (ou socketId como fallback)
  const currentPlayer = room?.players.find(
    (p) => p.persistentId === persistentId || p.id === socketId
  );

  return {
    connected,
    isMissingServerUrl,
    socketId,
    persistentId,
    room,
    currentPlayer,
    lastResults,
    speakerCue,
    roundTiming,
    toast,
    showToast,
    createRoom,
    joinRoom,
    claimSpeaker,
    startGame,
    searchYouTube,
    fetchLyrics,
    selectTrack,
    startSpeakerPlayback,
    submitGuess,
    nextRound,
    rematch
  };
}
