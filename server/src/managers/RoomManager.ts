import { Player, PlayerGuess, Room, TrackSnippet, RoundResultsPayload } from '../types/game.js';
import { evaluateRound } from '../lib/scoring.js';

export class RoomManager {
  private rooms = new Map<string, Room>();

  private generatePin(): string {
    let pin: string;
    let attempts = 0;
    do {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    } while (this.rooms.has(pin) && attempts < 100);
    return pin;
  }

  public getRoom(pin: string): Room | undefined {
    return this.rooms.get(pin);
  }

  public getRoomBySocketId(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === socketId)) {
        return room;
      }
    }
    return undefined;
  }

  public createRoom(hostSocketId: string, nickname: string, persistentId?: string): Room {
    const pin = this.generatePin();
    const pid = persistentId || hostSocketId;
    const host: Player = {
      id: hostSocketId,
      persistentId: pid,
      nickname: nickname.trim(),
      avatarSeed: Math.floor(Math.random() * 8 + 1).toString(),
      score: 0,
      isHost: true,
      isMaster: true,
      isAudioSpeaker: false,
      hasGuessed: false,
      isOnline: true
    };

    const room: Room = {
      pin,
      status: 'LOBBY',
      hostId: hostSocketId,
      speakerId: null,
      masterIndex: 0,
      players: [host],
      currentGuesses: {},
      round: 1,
      totalRounds: 5
    };

    this.rooms.set(pin, room);
    return room;
  }

  public joinRoom(pin: string, socketId: string, nickname: string, persistentId?: string): Room {
    const room = this.rooms.get(pin);
    if (!room) {
      throw new Error(`Sala #${pin} não encontrada.`);
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      throw new Error('Apelido inválido.');
    }

    // Se o jogador já existia pelo persistentId (reconexão)
    if (persistentId) {
      const existingByPersistentId = room.players.find((p) => p.persistentId === persistentId);
      if (existingByPersistentId) {
        existingByPersistentId.id = socketId;
        existingByPersistentId.nickname = trimmedNickname;
        existingByPersistentId.isOnline = true;
        if (room.hostId === existingByPersistentId.id) {
          room.hostId = socketId;
        }
        if (room.speakerId === existingByPersistentId.id) {
          room.speakerId = socketId;
        }
        return room;
      }
    }

    const nameConflict = room.players.some(
      (p) => p.nickname.toLowerCase() === trimmedNickname.toLowerCase() && (persistentId ? p.persistentId !== persistentId : true)
    );
    if (nameConflict) {
      throw new Error(`O apelido "${trimmedNickname}" já está em uso nesta sala.`);
    }

    const pid = persistentId || socketId;
    const newPlayer: Player = {
      id: socketId,
      persistentId: pid,
      nickname: trimmedNickname,
      avatarSeed: Math.floor(Math.random() * 8 + 1).toString(),
      score: 0,
      isHost: false,
      isMaster: false,
      isAudioSpeaker: false,
      hasGuessed: false,
      isOnline: true
    };

    room.players.push(newPlayer);
    return room;
  }

  public handleReconnect(pin: string, socketId: string, persistentId: string): Room | null {
    const room = this.rooms.get(pin);
    if (!room) return null;

    const player = room.players.find((p) => p.persistentId === persistentId);
    if (player) {
      const oldSocketId = player.id;
      player.id = socketId;
      player.isOnline = true;

      if (room.hostId === oldSocketId) room.hostId = socketId;
      if (room.speakerId === oldSocketId) room.speakerId = socketId;

      return room;
    }

    return null;
  }

  public leaveRoom(pin: string, socketId: string, persistentId?: string): Room | null {
    const room = this.rooms.get(pin);
    if (!room) return null;

    const playerIndex = room.players.findIndex(
      (p) => (persistentId && p.persistentId === persistentId) || p.id === socketId
    );
    if (playerIndex === -1) return room;

    const [removedPlayer] = room.players.splice(playerIndex, 1);

    // Se a sala ficou vazia, remove a sala
    if (room.players.length === 0) {
      this.rooms.delete(pin);
      return null;
    }

    // Se o jogador era o host, transfere a posse para o primeiro restante
    if (room.hostId === removedPlayer.id || (persistentId && room.hostId === removedPlayer.persistentId)) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    // Se o jogador era o mestre, recalibra o masterIndex e atualiza as flags
    if (removedPlayer.isMaster) {
      room.masterIndex = room.masterIndex % room.players.length;
      room.players.forEach((p, idx) => {
        p.isMaster = idx === room.masterIndex;
      });
    }

    // Se o jogador era a caixa de som, limpa
    if (room.speakerId === removedPlayer.id) {
      room.speakerId = null;
    }

    // Limpa palpites associados
    delete room.currentGuesses[removedPlayer.id];
    if (removedPlayer.persistentId) {
      delete room.currentGuesses[removedPlayer.persistentId];
    }

    return room;
  }

  public handleDisconnect(socketId: string): { room?: Room; pin?: string } {
    for (const [pin, room] of this.rooms.entries()) {
      const player = room.players.find((p) => p.id === socketId);
      if (player) {
        // NÃO remove o jogador imediatamente para evitar desyncs em mobile!
        player.isOnline = false;

        // Se todos os jogadores estiverem offline, agenda exclusão após 10 minutos
        const anyOnline = room.players.some((p) => p.isOnline);
        if (!anyOnline) {
          setTimeout(() => {
            const currentRoom = this.rooms.get(pin);
            if (currentRoom && !currentRoom.players.some((p) => p.isOnline)) {
              this.rooms.delete(pin);
            }
          }, 10 * 60 * 1000);
        }

        return { room, pin };
      }
    }
    return {};
  }

  public claimSpeaker(pin: string, socketId: string): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

    room.speakerId = socketId;
    room.players.forEach((p) => {
      p.isAudioSpeaker = p.id === socketId;
    });

    return room;
  }

  public startGame(pin: string, totalRounds: number = 5): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

    room.totalRounds = totalRounds;
    room.round = 1;
    room.masterIndex = 0;
    room.status = 'MASTER_CHOOSING';
    delete room.lastResults;

    room.players.forEach((p, idx) => {
      p.score = 0;
      p.hasGuessed = false;
      p.isMaster = idx === room.masterIndex;
    });

    return room;
  }

  public selectTrack(pin: string, snippet: TrackSnippet): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

    room.currentTrack = snippet;
    room.status = 'WAITING_SPEAKER_TRIGGER';
    return room;
  }

  public startRoundPlaying(pin: string): { room: Room; durationSec: number; endsAt: number; bufferEndsAt: number } {
    const room = this.rooms.get(pin);
    if (!room || !room.currentTrack) throw new Error('Sala ou faixa inválida.');

    const durationSec = room.currentTrack.durationSec || 15;
    const now = Date.now();
    const endsAt = now + durationSec * 1000;
    const bufferEndsAt = endsAt + 5000; // 5 segundos de buffer

    room.status = 'ROUND_PLAYING';
    room.roundEndsAt = endsAt;
    room.bufferEndsAt = bufferEndsAt;
    room.currentGuesses = {};

    room.players.forEach((p) => {
      p.hasGuessed = false;
    });

    return { room, durationSec, endsAt, bufferEndsAt };
  }

  public submitGuess(
    pin: string,
    socketId: string,
    track: string,
    artist: string
  ): { room: Room; allGuessed: boolean } {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');
    if (room.status !== 'ROUND_PLAYING') throw new Error('Rodada não está ativa.');

    const player = room.players.find((p) => p.id === socketId);
    if (!player) throw new Error('Jogador não encontrado.');

    if (player.isMaster) {
      throw new Error('O Mestre da rodada não palpita.');
    }

    if (player.hasGuessed || room.currentGuesses[socketId]) {
      throw new Error('Palpite único já submetido para esta rodada.');
    }

    const guess: PlayerGuess = {
      playerId: socketId,
      persistentId: player.persistentId,
      trackGuess: track.trim(),
      artistGuess: artist.trim(),
      isTrackCorrect: false,
      isArtistCorrect: false,
      pointsEarned: 0,
      submittedAt: Date.now()
    };

    room.currentGuesses[socketId] = guess;
    player.hasGuessed = true;

    // Apenas jogadores ativos e online são contados
    const activeGuessers = room.players.filter((p) => !p.isMaster && p.isOnline);
    const allGuessed = activeGuessers.length > 0 && activeGuessers.every((p) => p.hasGuessed);

    return { room, allGuessed };
  }

  public evaluateAndReveal(pin: string): {
    room: Room;
    results: RoundResultsPayload;
  } {
    const room = this.rooms.get(pin);
    if (!room || !room.currentTrack) throw new Error('Sala ou faixa ausente.');

    const currentMaster = room.players[room.masterIndex];
    const { evaluatedGuesses, updatedPlayers, masterPoints } = evaluateRound(
      room.players,
      currentMaster.id,
      room.currentTrack,
      room.currentGuesses
    );

    room.players = updatedPlayers;
    room.status = 'ROUND_REVEAL';

    for (const g of evaluatedGuesses) {
      room.currentGuesses[g.playerId] = g;
    }

    const results: RoundResultsPayload = {
      track: room.currentTrack,
      guesses: evaluatedGuesses,
      scores: room.players,
      masterPoints
    };

    // Preserva no objeto da sala para reconexões tardias
    room.lastResults = results;

    return { room, results };
  }

  public nextRound(pin: string): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

    // Previne avanço duplo acidental se a rodada já tiver sido avançada por outro jogador
    if (room.status !== 'ROUND_REVEAL') {
      return room;
    }

    // Verifica se atingiu o total de rodadas
    if (room.round >= room.totalRounds) {
      room.status = 'GAME_OVER';
      return room;
    }

    room.round += 1;
    room.masterIndex = (room.masterIndex + 1) % room.players.length;
    room.status = 'MASTER_CHOOSING';
    delete room.currentTrack;
    delete room.roundEndsAt;
    delete room.bufferEndsAt;
    delete room.lastResults;
    room.currentGuesses = {};

    room.players.forEach((p, idx) => {
      p.hasGuessed = false;
      p.isMaster = idx === room.masterIndex;
    });

    return room;
  }

  public rematch(pin: string): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

    room.round = 1;
    room.masterIndex = 0;
    room.status = 'MASTER_CHOOSING';
    delete room.currentTrack;
    delete room.roundEndsAt;
    delete room.bufferEndsAt;
    delete room.lastResults;
    room.currentGuesses = {};

    room.players.forEach((p, idx) => {
      p.score = 0;
      p.hasGuessed = false;
      p.isMaster = idx === room.masterIndex;
    });

    return room;
  }
}
