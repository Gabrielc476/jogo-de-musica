import { Player, PlayerGuess, TrackSnippet } from '../types/game.js';
import { cleanMusicString, isMatch } from './matcher.js';

export interface ScoreRoundResult {
  evaluatedGuesses: PlayerGuess[];
  updatedPlayers: Player[];
  masterPoints: number;
}

export function isTrackAnswerMatch(guess: string, targetTrack: TrackSnippet): boolean {
  if (!guess || !guess.trim()) return false;

  // 1. Confere contra o título principal
  if (isMatch(guess, targetTrack.title)) return true;

  // 2. Confere contra o título original do vídeo do YouTube
  if (isMatch(guess, targetTrack.rawTitle)) return true;

  // 3. Caso o Mestre ou o parser tenham invertido Artista e Título
  if (targetTrack.artist && isMatch(guess, targetTrack.artist)) return true;

  // 4. Verificação de substring com termos normalizados
  const cleanG = cleanMusicString(guess);
  const cleanT = cleanMusicString(targetTrack.title);
  const cleanRaw = cleanMusicString(targetTrack.rawTitle);

  if (cleanG.length >= 3) {
    if (cleanT.includes(cleanG) || cleanG.includes(cleanT)) return true;
    if (cleanRaw.includes(cleanG)) return true;
  }

  return false;
}

export function isArtistAnswerMatch(guess: string, targetTrack: TrackSnippet): boolean {
  if (!guess || !guess.trim()) return false;

  // 1. Confere contra o artista calibrado
  if (targetTrack.artist && isMatch(guess, targetTrack.artist)) return true;

  // 2. Caso o artista estivesse no campo título (invertido)
  if (isMatch(guess, targetTrack.title)) return true;

  // 3. Confere se o palpite de artista está contido no título bruto do vídeo
  const cleanG = cleanMusicString(guess);
  const cleanA = cleanMusicString(targetTrack.artist);
  const cleanRaw = cleanMusicString(targetTrack.rawTitle);

  if (cleanG.length >= 3) {
    if (cleanA && (cleanA.includes(cleanG) || cleanG.includes(cleanA))) return true;
    if (cleanRaw.includes(cleanG)) return true;
  }

  return false;
}

export function evaluateRound(
  players: Player[],
  masterId: string,
  targetTrack: TrackSnippet,
  rawGuesses: Record<string, { trackGuess: string; artistGuess: string; submittedAt: number; persistentId?: string }>
): ScoreRoundResult {
  const guessers = players.filter((p) => p.id !== masterId);
  const totalGuessers = guessers.length;

  const evaluatedGuesses: PlayerGuess[] = [];
  let correctTrackCount = 0;

  // Passo 1: Avaliar correspondência de cada palpite usando bi-direcionalidade inteligente
  for (const player of guessers) {
    // Busca palpite tanto por player.id quanto por persistentId
    const raw = rawGuesses[player.id] || (player.persistentId ? rawGuesses[player.persistentId] : undefined);
    const trackGuess = raw?.trackGuess || '';
    const artistGuess = raw?.artistGuess || '';
    const submittedAt = raw?.submittedAt || Date.now();

    const isTrackCorrect = isTrackAnswerMatch(trackGuess, targetTrack);
    const isArtistCorrect = isTrackCorrect && isArtistAnswerMatch(artistGuess, targetTrack);

    if (isTrackCorrect) {
      correctTrackCount++;
    }

    evaluatedGuesses.push({
      playerId: player.id,
      persistentId: player.persistentId,
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
      masterPoints = 500; // Desafio equilibrado
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
