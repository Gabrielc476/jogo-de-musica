import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/managers/RoomManager.js';
import { ClientToServerEvents, ServerToClientEvents, TrackSnippet } from '../src/types/game.js';

describe('E2E Realtime Multi-Device Game Loop', () => {
  let fastify: FastifyInstance;
  let ioServer: SocketIOServer;
  let port: number;
  let roomManager: RoomManager;

  let hostClient: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let speakerClient: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  let guesserClient: ClientSocket<ServerToClientEvents, ClientToServerEvents>;

  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(fastifyCors, { origin: '*' });

    ioServer = new SocketIOServer(fastify.server, {
      cors: { origin: '*' }
    });

    roomManager = new RoomManager();

    ioServer.on('connection', (socket) => {
      socket.on('room:create', ({ nickname }) => {
        const room = roomManager.createRoom(socket.id, nickname);
        socket.join(room.pin);
        socket.emit('room:sync', { room });
      });

      socket.on('room:join', ({ pin, nickname }) => {
        const room = roomManager.joinRoom(pin, socket.id, nickname);
        socket.join(room.pin);
        ioServer.to(room.pin).emit('room:sync', { room });
      });

      socket.on('room:claim_speaker', ({ pin }) => {
        const room = roomManager.claimSpeaker(pin, socket.id);
        ioServer.to(pin).emit('room:sync', { room });
      });

      socket.on('game:start', ({ pin, totalRounds = 3 }) => {
        const room = roomManager.startGame(pin, totalRounds);
        ioServer.to(pin).emit('room:sync', { room });
      });

      socket.on('track:select', ({ pin, snippet }) => {
        const room = roomManager.selectTrack(pin, snippet);
        ioServer.to(pin).emit('room:sync', { room });
        if (room.speakerId) {
          ioServer.to(room.speakerId).emit('speaker:cue', {
            videoId: snippet.videoId,
            startSec: snippet.startSec,
            durationSec: snippet.durationSec
          });
        }
      });

      socket.on('speaker:started', ({ pin }) => {
        const { durationSec, endsAt, bufferEndsAt, room } = roomManager.startRoundPlaying(pin);
        ioServer.to(pin).emit('round:started', { endsAt, bufferEndsAt, durationSec });
        ioServer.to(pin).emit('room:sync', { room });
      });

      socket.on('guess:submit', ({ pin, track, artist }) => {
        const { room, allGuessed } = roomManager.submitGuess(pin, socket.id, track, artist);
        ioServer.to(pin).emit('guess:received', { playerId: socket.id });
        ioServer.to(pin).emit('room:sync', { room });

        if (allGuessed) {
          const { results } = roomManager.evaluateAndReveal(pin);
          ioServer.to(pin).emit('round:results', results);
          ioServer.to(pin).emit('room:sync', { room });
        }
      });

      socket.on('round:next', ({ pin }) => {
        const room = roomManager.nextRound(pin);
        ioServer.to(pin).emit('room:sync', { room });
      });

      socket.on('game:rematch', ({ pin }) => {
        const room = roomManager.rematch(pin);
        ioServer.to(pin).emit('room:sync', { room });
      });
    });

    const address = await fastify.listen({ port: 0, host: '127.0.0.1' });
    const addr = fastify.server.address();
    port = typeof addr === 'object' && addr ? addr.port : 3001;
  });

  afterAll(async () => {
    hostClient?.disconnect();
    speakerClient?.disconnect();
    guesserClient?.disconnect();
    ioServer?.close();
    await fastify?.close();
  });

  it('deve orquestrar partida completa com 3 jogadores conectados em tempo real', async () => {
    const url = `http://127.0.0.1:${port}`;
    let roomPin = '';

    // 1. Host conecta e cria a sala
    hostClient = ClientIO(url);
    await new Promise<void>((resolve) => {
      hostClient.on('connect', () => {
        hostClient.emit('room:create', { nickname: 'Gabriel Host' });
      });
      hostClient.on('room:sync', ({ room }) => {
        if (room.pin && !roomPin) {
          roomPin = room.pin;
          resolve();
        }
      });
    });

    expect(roomPin).toHaveLength(4);

    // 2. Speaker (Renata) e Guesser (Lucas) entram na sala com o PIN
    speakerClient = ClientIO(url);
    guesserClient = ClientIO(url);

    await Promise.all([
      new Promise<void>((resolve) => {
        speakerClient.on('connect', () => {
          speakerClient.emit('room:join', { pin: roomPin, nickname: 'Renata Som' });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        guesserClient.on('connect', () => {
          guesserClient.emit('room:join', { pin: roomPin, nickname: 'Lucas' });
          resolve();
        });
      })
    ]);

    // 3. Renata assume o papel de Caixa de Som
    await new Promise<void>((resolve) => {
      speakerClient.emit('room:claim_speaker', { pin: roomPin });
      speakerClient.on('room:sync', ({ room }) => {
        if (room.speakerId === speakerClient.id) {
          resolve();
        }
      });
    });

    // 4. Host inicia a partida
    await new Promise<void>((resolve) => {
      hostClient.emit('game:start', { pin: roomPin, totalRounds: 3 });
      hostClient.on('room:sync', ({ room }) => {
        if (room.status === 'MASTER_CHOOSING') {
          resolve();
        }
      });
    });

    // 5. Host (Mestre da Rodada 1) seleciona a faixa e corte
    const targetSnippet: TrackSnippet = {
      videoId: 'v987',
      title: 'Gostava Tanto de Você',
      artist: 'Tim Maia',
      rawTitle: 'Tim Maia - Gostava Tanto de Você',
      startSec: 42,
      durationSec: 15
    };

    let speakerReceivedCue = false;
    await new Promise<void>((resolve) => {
      speakerClient.on('speaker:cue', (cue) => {
        if (cue.videoId === 'v987') {
          speakerReceivedCue = true;
          resolve();
        }
      });
      hostClient.emit('track:select', { pin: roomPin, snippet: targetSnippet });
    });

    expect(speakerReceivedCue).toBe(true);

    // 6. Renata clica em "Soltar o Som na Caixa" (Gatilho Físico)
    await new Promise<void>((resolve) => {
      guesserClient.on('round:started', ({ endsAt, bufferEndsAt }) => {
        expect(bufferEndsAt - endsAt).toBe(5000); // 5s de buffer
        resolve();
      });
      speakerClient.emit('speaker:started', { pin: roomPin });
    });

    // 7. Palpites sob Suspense Total: Renata e Lucas enviam
    let resultsReceived: any = null;
    const resultsPromise = new Promise<void>((resolve) => {
      guesserClient.on('round:results', (results) => {
        resultsReceived = results;
        resolve();
      });
    });

    // Renata acerta Música + Artista
    speakerClient.emit('guess:submit', {
      pin: roomPin,
      track: 'gostava tanto de voce',
      artist: 'tim maia'
    });

    // Lucas acerta apenas a Música
    guesserClient.emit('guess:submit', {
      pin: roomPin,
      track: 'Gostava Tanto de Você',
      artist: 'Jorge Ben'
    });

    await resultsPromise;

    expect(resultsReceived).toBeDefined();
    expect(resultsReceived.track.title).toBe('Gostava Tanto de Você');

    // 2 jogadores acertaram a faixa: 1000 / 2 = 500 base cada
    const renataResult = resultsReceived.guesses.find((g: any) => g.playerId === speakerClient.id);
    expect(renataResult.pointsEarned).toBe(500 + 150); // 500 base + 150 bônus artista

    const lucasResult = resultsReceived.guesses.find((g: any) => g.playerId === guesserClient.id);
    expect(lucasResult.pointsEarned).toBe(500); // apenas 500 base

    // Mestre pontua 500 pts no Dilema do Mestre (2 de 2 adivinhadores acertaram -> 200 pts pois todos acertaram!)
    expect(resultsReceived.masterPoints).toBe(200);

    // 8. Próxima rodada rotaciona o Mestre para Renata
    await new Promise<void>((resolve) => {
      hostClient.emit('round:next', { pin: roomPin });
      hostClient.on('room:sync', ({ room }) => {
        if (room.round === 2) {
          expect(room.players[1].isMaster).toBe(true);
          resolve();
        }
      });
    });

    // 9. Host solicita Revanche
    await new Promise<void>((resolve) => {
      hostClient.emit('game:rematch', { pin: roomPin });
      hostClient.on('room:sync', ({ room }) => {
        if (room.round === 1 && room.status === 'MASTER_CHOOSING') {
          expect(room.players[0].score).toBe(0);
          expect(room.players[1].score).toBe(0);
          expect(room.players[2].score).toBe(0);
          resolve();
        }
      });
    });
  });
});
