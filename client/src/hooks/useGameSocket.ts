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
  Player
} from '../types/game';

export interface RoundResultsData {
  track: TrackSnippet;
  guesses: PlayerGuess[];
  scores: Player[];
  masterPoints: number;
}

export function useGameSocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [lastResults, setLastResults] = useState<RoundResultsData | null>(null);
  const [speakerCue, setSpeakerCue] = useState<{ videoId: string; startSec: number; durationSec: number } | null>(null);
  const [roundTiming, setRoundTiming] = useState<{ endsAt: number; bufferEndsAt: number; durationSec: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((curr) => (curr === message ? null : curr));
    }, 2800);
  }, []);

  useEffect(() => {
    // Determina o endereço do backend (variável de produção ou localhost)
    const serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001`;

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setSocketId(null);
    });

    socket.on('room:sync', ({ room }) => {
      setRoom(room);
    });

    socket.on('speaker:cue', (cue) => {
      setSpeakerCue(cue);
    });

    socket.on('round:started', (timing) => {
      setRoundTiming(timing);
      setSpeakerCue(null);
    });

    socket.on('guess:received', ({ playerId }) => {
      // Notificação sutil para a sala de que alguém enviou
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
  }, [showToast]);

  const createRoom = useCallback((nickname: string) => {
    socketRef.current?.emit('room:create', { nickname });
  }, []);

  const joinRoom = useCallback((pin: string, nickname: string) => {
    socketRef.current?.emit('room:join', { pin, nickname });
  }, []);

  const claimSpeaker = useCallback((pin: string) => {
    socketRef.current?.emit('room:claim_speaker', { pin });
  }, []);

  const startGame = useCallback((pin: string, totalRounds: number = 5) => {
    socketRef.current?.emit('game:start', { pin, totalRounds });
  }, []);

  const searchYouTube = useCallback((query: string): Promise<any[]> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve([]);
      socketRef.current.emit('youtube:search', { query }, (results) => {
        resolve(results || []);
      });
    });
  }, []);

  const fetchLyrics = useCallback((trackName: string, artistName: string): Promise<LyricLine[]> => {
    return new Promise((resolve) => {
      if (!socketRef.current) return resolve([]);
      socketRef.current.emit('lyrics:fetch', { trackName, artistName }, (lyrics) => {
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

  const currentPlayer = room?.players.find((p) => p.id === socketId);

  return {
    connected,
    socketId,
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
