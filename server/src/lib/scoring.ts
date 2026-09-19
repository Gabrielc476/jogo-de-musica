import { Player, PlayerGuess, TrackSnippet } from '../types/game.js';
import { isMatch } from './matcher.js';

export interface ScoreRoundResult {
  evaluatedGuesses: PlayerGuess[];
  updatedPlayers: Player[];
  masterPoints: number;
}

export function evaluateRound(
  players: Player[],
  masterId: string,
  targetTrack: TrackSnippet,
  rawGuesses: Record<string, { trackGuess: string; artistGuess: string; submittedAt: number }>
): ScoreRoundResult {
  const guessers = players.filter((p) => p.id !== masterId);
  const totalGuessers = guessers.length;

  const evaluatedGuesses: PlayerGuess[] = [];
  let correctTrackCount = 0;

  // Passo 1: Avaliar correspondência de cada palpite
  for (const player of guessers) {
    const raw = rawGuesses[player.id];
    const trackGuess = raw?.trackGuess || '';
    const artistGuess = raw?.artistGuess || '';
    const submittedAt = raw?.submittedAt || Date.now();

    const isTrackCorrect = isMatch(trackGuess, targetTrack.title);
    const isArtistCorrect = isTrackCorrect && isMatch(artistGuess, targetTrack.artist);

    if (isTrackCorrect) {
      correctTrackCount++;
    }

    evaluatedGuesses.push({
      playerId: player.id,
      trackGuess,
      artistGuess,
      isTrackCorrect,
      isArtistCorrect,
      pointsEarned: 0,
      submittedAt
    });
  }

  // Passo 2: Calcular pontuação de Escassez Inversa para a faixa
  const baseTrackPoints = correctTrackCount > 0 ? Math.floor(1000 / correctTrackCount) : 0;
  const ARTIST_BONUS = 150;

  for (const guess of evaluatedGuesses) {
    if (guess.isTrackCorrect) {
      guess.pointsEarned += baseTrackPoints;
      if (guess.isArtistCorrect) {
        guess.pointsEarned += ARTIST_BONUS;
      }
    }
  }

  // Passo 3: Calcular pontuação do Dilema do Mestre
  let masterPoints = 0;
  if (totalGuessers > 0) {
    if (correctTrackCount === 0) {
      masterPoints = 0; // Muito impossível
    } else if (correctTrackCount === totalGuessers) {
      masterPoints = 200; // Óbvia demais
    } else {
      masterPoints = 500; // Desafio calibrado e justo
    }
  }

  // Passo 4: Atualizar pontuações no array de jogadores
  const guessMap = new Map(evaluatedGuesses.map((g) => [g.playerId, g.pointsEarned]));
  const updatedPlayers = players.map((p) => {
    let delta = 0;
    if (p.id === masterId) {
      delta = masterPoints;
    } else {
      delta = guessMap.get(p.id) || 0;
    }
    return {
      ...p,
      score: p.score + delta,
      hasGuessed: false
    };
  });

  return {
    evaluatedGuesses,
    updatedPlayers,
    masterPoints
  };
}
