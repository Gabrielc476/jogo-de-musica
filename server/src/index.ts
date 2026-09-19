import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './managers/RoomManager.js';
import { YouTubeService } from './services/youtubeService.js';
import { LyricsService } from './services/lyricsService.js';
import { ClientToServerEvents, ServerToClientEvents } from './types/game.js';

const fastify = Fastify({ logger: true });

await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
});

fastify.get('/health', async () => {
  return { status: 'ok', service: 'Vinyl Lounge Server' };
});

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const roomManager = new RoomManager();
const youtubeService = new YouTubeService();
const lyricsService = new LyricsService();

const roundTimers = new Map<string, NodeJS.Timeout>();

function clearRoomTimer(pin: string) {
  const timer = roundTimers.get(pin);
  if (timer) {
    clearTimeout(timer);
    roundTimers.delete(pin);
  }
}

function finishRound(pin: string) {
  clearRoomTimer(pin);
  const room = roomManager.getRoom(pin);
  if (!room || room.status !== 'ROUND_PLAYING') return;

  try {
    const { results } = roomManager.evaluateAndReveal(pin);
    io.to(pin).emit('round:results', results);
    io.to(pin).emit('room:sync', { room });
  } catch (err) {
    console.error(`[Round] Erro ao encerrar rodada na sala #${pin}:`, err);
  }
}

io.on('connection', (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  socket.on('room:create', ({ nickname, persistentId }) => {
    try {
      const room = roomManager.createRoom(socket.id, nickname, persistentId);
      socket.join(room.pin);
      socket.emit('room:sync', { room });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message || 'Erro ao criar sala.' });
    }
  });

  socket.on('room:join', ({ pin, nickname, persistentId }) => {
    try {
      const room = roomManager.joinRoom(pin, socket.id, nickname, persistentId);
      socket.join(room.pin);
      io.to(room.pin).emit('room:sync', { room });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message || 'Erro ao entrar na sala.' });
    }
  });

  socket.on('room:reconnect', ({ pin, persistentId }) => {
    try {
      const room = roomManager.handleReconnect(pin, socket.id, persistentId);
      if (room) {
        socket.join(room.pin);
        socket.emit('room:sync', { room });
        if (room.lastResults) {
          socket.emit('round:results', room.lastResults);
        }
      }
    } catch {
      // Ignora erro de reconexão silenciosa
    }
  });

  socket.on('room:claim_speaker', ({ pin }) => {
    try {
      const room = roomManager.claimSpeaker(pin, socket.id);
      io.to(pin).emit('room:sync', { room });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('game:start', ({ pin, totalRounds = 5 }) => {
    try {
      const room = roomManager.getRoom(pin);
      if (!room || room.hostId !== socket.id) {
        socket.emit('error:toast', { message: 'Apenas o anfitrião pode iniciar o jogo.' });
        return;
      }
      const updated = roomManager.startGame(pin, totalRounds);
      io.to(pin).emit('room:sync', { room: updated });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('youtube:search', async ({ query }, callback) => {
    try {
      const results = await youtubeService.search(query);
      if (callback) callback(results);
    } catch {
      if (callback) callback([]);
    }
  });

  socket.on('lyrics:fetch', async ({ trackName, artistName }, callback) => {
    try {
      const lyrics = await lyricsService.fetchLyrics(trackName, artistName);
      if (callback) callback(lyrics);
      socket.emit('lyrics:data', { syncedLyrics: lyrics });
    } catch {
      if (callback) callback([]);
    }
  });

  socket.on('track:select', ({ pin, snippet }) => {
    try {
      const room = roomManager.getRoom(pin);
      if (!room) return;

      const updated = roomManager.selectTrack(pin, snippet);
      io.to(pin).emit('room:sync', { room: updated });

      if (updated.speakerId) {
        io.to(updated.speakerId).emit('speaker:cue', {
          videoId: snippet.videoId,
          startSec: snippet.startSec,
          durationSec: snippet.durationSec
        });
      }
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('speaker:started', ({ pin }) => {
    try {
      const room = roomManager.getRoom(pin);
      if (!room) return;
      if (room.speakerId !== socket.id) {
        socket.emit('error:toast', { message: 'Apenas a Caixa de Som pode disparar o áudio.' });
        return;
      }

      clearRoomTimer(pin);
      const { durationSec, endsAt, bufferEndsAt } = roomManager.startRoundPlaying(pin);

      io.to(pin).emit('round:started', { endsAt, bufferEndsAt, durationSec });
      io.to(pin).emit('room:sync', { room });

      const timeoutMs = Math.max(1000, bufferEndsAt - Date.now());
      const timer = setTimeout(() => {
        finishRound(pin);
      }, timeoutMs);

      roundTimers.set(pin, timer);
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('guess:submit', ({ pin, track, artist }) => {
    try {
      const { room, allGuessed } = roomManager.submitGuess(pin, socket.id, track, artist);

      io.to(pin).emit('guess:received', { playerId: socket.id });
      io.to(pin).emit('room:sync', { room });

      if (allGuessed) {
        finishRound(pin);
      }
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('round:next', ({ pin }) => {
    try {
      const room = roomManager.getRoom(pin);
      if (!room) return;
      clearRoomTimer(pin);
      const updated = roomManager.nextRound(pin);
      io.to(pin).emit('room:sync', { room: updated });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('game:rematch', ({ pin }) => {
    try {
      const room = roomManager.getRoom(pin);
      if (!room || room.hostId !== socket.id) {
        socket.emit('error:toast', { message: 'Apenas o anfitrião pode solicitar revanche.' });
        return;
      }
      clearRoomTimer(pin);
      const updated = roomManager.rematch(pin);
      io.to(pin).emit('room:sync', { room: updated });
    } catch (err: any) {
      socket.emit('error:toast', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Desconectado: ${socket.id}`);
    const { room, pin } = roomManager.handleDisconnect(socket.id);
    if (room && pin) {
      io.to(pin).emit('room:sync', { room });
    }
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`\n🎵 [Vinyl Lounge Server] Rodando com sucesso em ${address}\n`);
});
