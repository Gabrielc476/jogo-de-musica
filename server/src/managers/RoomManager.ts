import { Player, PlayerGuess, Room, TrackSnippet } from '../types/game.js';
import { evaluateRound } from '../lib/scoring.js';

export class RoomManager {
  private rooms = new Map<string, Room>();

  // Gera PIN legível de 4 dígitos (ex: 8492)
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

  public createRoom(hostSocketId: string, nickname: string): Room {
    const pin = this.generatePin();
    const host: Player = {
      id: hostSocketId,
      nickname: nickname.trim(),
      avatarSeed: Math.floor(Math.random() * 8 + 1).toString(),
      score: 0,
      isHost: true,
      isMaster: true,
      isAudioSpeaker: false,
      hasGuessed: false
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

  public joinRoom(pin: string, socketId: string, nickname: string): Room {
    const room = this.rooms.get(pin);
    if (!room) {
      throw new Error(`Sala #${pin} não encontrada.`);
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      throw new Error('Apelido inválido.');
    }

    const existingPlayer = room.players.find((p) => p.id === socketId);
    if (existingPlayer) {
      existingPlayer.nickname = trimmedNickname;
      return room;
    }

    const nameConflict = room.players.some(
      (p) => p.nickname.toLowerCase() === trimmedNickname.toLowerCase()
    );
    if (nameConflict) {
      throw new Error(`O apelido "${trimmedNickname}" já está em uso nesta sala.`);
    }

    const newPlayer: Player = {
      id: socketId,
      nickname: trimmedNickname,
      avatarSeed: Math.floor(Math.random() * 8 + 1).toString(),
      score: 0,
      isHost: false,
      isMaster: false,
      isAudioSpeaker: false,
      hasGuessed: false
    };

    room.players.push(newPlayer);
    return room;
  }

  public leaveRoom(socketId: string): { room?: Room; pin?: string } {
    for (const [pin, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socketId);
      if (playerIndex !== -1) {
        const removed = room.players.splice(playerIndex, 1)[0];

        // Se a sala esvaziou, remove
        if (room.players.length === 0) {
          this.rooms.delete(pin);
          return { pin };
        }

        // Se o anfitrião saiu, passa para o primeiro restante
        if (removed.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
          room.hostId = room.players[0].id;
        }

        // Se a Caixa de Som saiu, reseta
        if (room.speakerId === socketId) {
          room.speakerId = null;
        }

        // Reajusta masterIndex se necessário
        if (room.masterIndex >= room.players.length) {
          room.masterIndex = 0;
        }
        room.players.forEach((p, idx) => {
          p.isMaster = idx === room.masterIndex;
        });

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
    const bufferEndsAt = endsAt + 5000; // 5 segundos de buffer de digitação

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

    // O Mestre não envia palpites
    if (player.isMaster) {
      throw new Error('O Mestre da rodada não palpita.');
    }

    // Regra de Palpite Único: se já enviou, bloqueia
    if (player.hasGuessed || room.currentGuesses[socketId]) {
      throw new Error('Palpite único já submetido para esta rodada.');
    }

    room.currentGuesses[socketId] = {
      playerId: socketId,
      trackGuess: track.trim(),
      artistGuess: artist.trim(),
      isTrackCorrect: false,
      isArtistCorrect: false,
      pointsEarned: 0,
      submittedAt: Date.now()
    };

    player.hasGuessed = true;

    // Verifica se todos os adivinhadores já enviaram
    const guessers = room.players.filter((p) => !p.isMaster);
    const allGuessed = guessers.every((p) => p.hasGuessed);

    return { room, allGuessed };
  }

  public evaluateAndReveal(pin: string): {
    room: Room;
    results: {
      track: TrackSnippet;
      guesses: PlayerGuess[];
      scores: Player[];
      masterPoints: number;
    };
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

    // Salva os palpites avaliados
    for (const g of evaluatedGuesses) {
      room.currentGuesses[g.playerId] = g;
    }

    return {
      room,
      results: {
        track: room.currentTrack,
        guesses: evaluatedGuesses,
        scores: room.players,
        masterPoints
      }
    };
  }

  public nextRound(pin: string): Room {
    const room = this.rooms.get(pin);
    if (!room) throw new Error('Sala não encontrada.');

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
    room.currentGuesses = {};

    room.players.forEach((p, idx) => {
      p.score = 0;
      p.hasGuessed = false;
      p.isMaster = idx === room.masterIndex;
    });

    return room;
  }
}
