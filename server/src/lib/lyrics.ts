import { LyricLine } from '../types/game.js';

export function parseLrc(lrcContent: string): LyricLine[] {
  if (!lrcContent) return [];

  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = regex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const totalSeconds = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) {
        result.push({ second: totalSeconds, text });
      }
    }
  }

  return result.sort((a, b) => a.second - b.second);
}

export function getLyricAtSecond(lyrics: LyricLine[], second: number): string {
  if (!lyrics || !lyrics.length) {
    return 'Letra não disponível para esta faixa';
  }

  let activeText = lyrics[0].text;
  for (let i = 0; i < lyrics.length; i++) {
    if (second >= lyrics[i].second) {
      activeText = lyrics[i].text;
    } else {
      break;
    }
  }

  return activeText;
}
