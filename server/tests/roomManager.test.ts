import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../src/managers/RoomManager.js';
import { TrackSnippet } from '../src/types/game.js';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('deve criar uma sala com PIN de 4 dígitos e definir o criador como Host e Mestre inicial', () => {
    const room = manager.createRoom('socket-1', 'Gabriel');
    expect(room.pin).toHaveLength(4);
    expect(room.status).toBe('LOBBY');
    expect(room.hostId).toBe('socket-1');
    expect(room.players).toHaveLength(1);
    expect(room.players[0].nickname).toBe('Gabriel');
    expect(room.players[0].isHost).toBe(true);
    expect(room.players[0].isMaster).toBe(true);
  });

  it('deve permitir que outros jogadores entrem na sala e impedir apelidos duplicados', () => {
    const room = manager.createRoom('socket-1', 'Gabriel');
    manager.joinRoom(room.pin, 'socket-2', 'Renata');

    expect(room.players).toHaveLength(2);
    expect(room.players[1].nickname).toBe('Renata');
    expect(room.players[1].isHost).toBe(false);

    expect(() => manager.joinRoom(room.pin, 'socket-3', 'renata')).toThrow(
      'já está em uso'
    );
  });

  it('deve atribuir o papel de Caixa de Som', () => {
    const room = manager.createRoom('socket-1', 'Gabriel');
    manager.joinRoom(room.pin, 'socket-2', 'Renata');

    manager.claimSpeaker(room.pin, 'socket-2');
    expect(room.speakerId).toBe('socket-2');
    expect(room.players[1].isAudioSpeaker).toBe(true);
    expect(room.players[0].isAudioSpeaker).toBe(false);
  });

  it('deve gerenciar o ciclo da rodada com Buffer de Digitação e Palpite Único', () => {
    const room = manager.createRoom('socket-1', 'Gabriel');
    manager.joinRoom(room.pin, 'socket-2', 'Renata');
    manager.joinRoom(room.pin, 'socket-3', 'Lucas');

    manager.startGame(room.pin, 3);
    expect(room.status).toBe('MASTER_CHOOSING');

    const snippet: TrackSnippet = {
      videoId: 'v123',
      title: 'Tempo Perdido',
      artist: 'Legião Urbana',
      rawTitle: 'Legião Urbana - Tempo Perdido',
      startSec: 40,
      durationSec: 15
    };

    manager.selectTrack(room.pin, snippet);
    expect(room.status).toBe('WAITING_SPEAKER_TRIGGER');

    const { endsAt, bufferEndsAt } = manager.startRoundPlaying(room.pin);
    expect(room.status).toBe('ROUND_PLAYING');
    expect(bufferEndsAt - endsAt).toBe(5000); // 5s de buffer de digitação

    // Mestre não pode palpitar
    expect(() => manager.submitGuess(room.pin, 'socket-1', 'Chute', 'Artista')).toThrow(
      'O Mestre da rodada não palpita'
    );

    // Renata envia palpite
    const { allGuessed: all1 } = manager.submitGuess(room.pin, 'socket-2', 'Tempo Perdido', 'Legião Urbana');
    expect(all1).toBe(false);

    // Tentativa de segundo palpite (Palpite Único bloqueia)
    expect(() => manager.submitGuess(room.pin, 'socket-2', 'Outro', 'Banda')).toThrow(
      'Palpite único já submetido'
    );

    // Lucas envia palpite -> agora todos adivinhadores enviaram
    const { allGuessed: all2 } = manager.submitGuess(room.pin, 'socket-3', 'Pais e Filhos', 'Legião');
    expect(all2).toBe(true);

    // Revelação e pontuação
    const { results } = manager.evaluateAndReveal(room.pin);
    expect(room.status).toBe('ROUND_REVEAL');
    expect(results.guesses).toHaveLength(2);
    expect(results.masterPoints).toBe(500); // 1 acerto de 2 adivinhadores

    // Próxima rodada rotaciona o Mestre
    manager.nextRound(room.pin);
    expect(room.round).toBe(2);
    expect(room.status).toBe('MASTER_CHOOSING');
    expect(room.players[1].isMaster).toBe(true);
    expect(room.players[0].isMaster).toBe(false);
  });

  it('deve suportar Revanche mantendo participantes e resetando placares', () => {
    const room = manager.createRoom('socket-1', 'Gabriel');
    manager.joinRoom(room.pin, 'socket-2', 'Renata');
    room.players[0].score = 1500;
    room.players[1].score = 2200;

    manager.rematch(room.pin);
    expect(room.round).toBe(1);
    expect(room.status).toBe('MASTER_CHOOSING');
    expect(room.players[0].score).toBe(0);
    expect(room.players[1].score).toBe(0);
    expect(room.players).toHaveLength(2);
  });
});
