import { describe, it, expect } from 'vitest';
import { evaluateRound } from '../src/lib/scoring.js';
import { Player, TrackSnippet } from '../src/types/game.js';

describe('Scoring Engine', () => {
  const targetTrack: TrackSnippet = {
    videoId: 'mock123',
    title: 'Gostava Tanto de Você',
    artist: 'Tim Maia',
    rawTitle: 'Tim Maia - Gostava Tanto de Você',
    startSec: 30,
    durationSec: 15
  };

  const createPlayers = (): Player[] => [
    { id: 'master', nickname: 'DJ Master', avatarSeed: '1', score: 0, isHost: true, isMaster: true, isAudioSpeaker: false, hasGuessed: false },
    { id: 'p1', nickname: 'Alice', avatarSeed: '2', score: 100, isHost: false, isMaster: false, isAudioSpeaker: true, hasGuessed: true },
    { id: 'p2', nickname: 'Bob', avatarSeed: '3', score: 50, isHost: false, isMaster: false, isAudioSpeaker: false, hasGuessed: true },
    { id: 'p3', nickname: 'Charlie', avatarSeed: '4', score: 200, isHost: false, isMaster: false, isAudioSpeaker: false, hasGuessed: true }
  ];

  it('deve premiar 1000 pontos se apenas 1 jogador acertar (Escassez Máxima)', () => {
    const players = createPlayers();
    const rawGuesses = {
      p1: { trackGuess: 'Gostava Tanto de Você', artistGuess: 'Tim Maia', submittedAt: 1000 },
      p2: { trackGuess: 'Pais e Filhos', artistGuess: 'Legião', submittedAt: 1200 },
      p3: { trackGuess: 'Chove Chuva', artistGuess: 'Jorge Ben', submittedAt: 1300 }
    };

    const result = evaluateRound(players, 'master', targetTrack, rawGuesses);

    // p1 ganha 1000 (música solitária) + 150 (bônus artista) = 1150
    const p1 = result.updatedPlayers.find((p) => p.id === 'p1');
    expect(p1?.score).toBe(100 + 1150);

    // Mestre ganha 500 (acerto parcial: 1 de 3)
    const master = result.updatedPlayers.find((p) => p.id === 'master');
    expect(master?.score).toBe(0 + 500);
  });

  it('deve dividir 1000 pontos igualmente entre os acertadores e dar bônus de artista condicional', () => {
    const players = createPlayers();
    const rawGuesses = {
      p1: { trackGuess: 'Gostava Tanto de Você', artistGuess: 'Tim Maia', submittedAt: 1000 },
      p2: { trackGuess: 'Gostava Tanto de Você', artistGuess: 'Roberto Carlos', submittedAt: 1100 }, // Errou artista
      p3: { trackGuess: 'Outra Música', artistGuess: 'Tim Maia', submittedAt: 1200 } // Acertou artista mas errou música -> 0
    };

    const result = evaluateRound(players, 'master', targetTrack, rawGuesses);

    // 2 acertadores de música: 1000 / 2 = 500 cada
    const p1 = result.updatedPlayers.find((p) => p.id === 'p1');
    expect(p1?.score).toBe(100 + 500 + 150); // 500 + 150 bônus

    const p2 = result.updatedPlayers.find((p) => p.id === 'p2');
    expect(p2?.score).toBe(50 + 500); // 500 sem bônus

    const p3 = result.updatedPlayers.find((p) => p.id === 'p3');
    expect(p3?.score).toBe(200); // 0 pontos

    // Mestre ganha 500 (2 de 3 acertaram)
    const master = result.updatedPlayers.find((p) => p.id === 'master');
    expect(master?.score).toBe(500);
  });

  it('deve aplicar as penalidades do Dilema do Mestre (0 pts se ninguém acertar, 200 pts se todos acertarem)', () => {
    const players = createPlayers();

    // Caso A: Ninguém acertou
    const zeroGuesses = {
      p1: { trackGuess: 'X', artistGuess: 'Y', submittedAt: 1000 },
      p2: { trackGuess: 'X', artistGuess: 'Y', submittedAt: 1000 },
      p3: { trackGuess: 'X', artistGuess: 'Y', submittedAt: 1000 }
    };
    const resA = evaluateRound(players, 'master', targetTrack, zeroGuesses);
    expect(resA.masterPoints).toBe(0);

    // Caso B: Todos acertaram
    const allGuesses = {
      p1: { trackGuess: 'Gostava Tanto de Você', artistGuess: '', submittedAt: 1000 },
      p2: { trackGuess: 'Gostava Tanto de Você', artistGuess: '', submittedAt: 1000 },
      p3: { trackGuess: 'Gostava Tanto de Você', artistGuess: '', submittedAt: 1000 }
    };
    const resB = evaluateRound(players, 'master', targetTrack, allGuesses);
    expect(resB.masterPoints).toBe(200);
  });
});
