export function cleanMusicString(input: string): string {
  if (!input) return '';

  let cleaned = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos e acentos (ç, é, ã...)
    .replace(/\(.*?\)|\[.*?\]/g, '') // Remove conteúdo entre parênteses ou colchetes
    .replace(/\b(feat\.?|ft\.?|featuring|ao vivo|remastered|remaster|clipe oficial|video oficial|official video|official audio|audio oficial|lyric video|letra|hd|4k)\b.*/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')     // Troca pontuações por espaço
    .replace(/\s+/g, ' ')            // Unifica múltiplos espaços
    .trim();

  // Remove artigos iniciais comuns para facilitar o acerto (ex: "o descobrimento" -> "descobrimento")
  cleaned = cleaned.replace(/^(o|a|os|as|the)\s+/, '');

  return cleaned;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isMatch(userGuess: string, targetAnswer: string, tolerance: number = 0.82): boolean {
  const cleanGuess = cleanMusicString(userGuess);
  const cleanTarget = cleanMusicString(targetAnswer);

  if (!cleanGuess || !cleanTarget) return false;
  if (cleanGuess === cleanTarget) return true;

  // Se o alvo contém o palpite ou o palpite contém o alvo (ex: "gostava tanto de voce" e "gostava tanto")
  if ((cleanTarget.includes(cleanGuess) || cleanGuess.includes(cleanTarget)) && Math.min(cleanGuess.length, cleanTarget.length) >= 4) {
    return true;
  }

  const maxLen = Math.max(cleanGuess.length, cleanTarget.length);
  const dist = levenshteinDistance(cleanGuess, cleanTarget);
  const similarity = 1 - (dist / maxLen);

  return similarity >= tolerance;
}
