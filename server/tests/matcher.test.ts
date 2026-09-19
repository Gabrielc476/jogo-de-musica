import { describe, it, expect } from 'vitest';
import { cleanMusicString, isMatch, levenshteinDistance } from '../src/lib/matcher.js';

describe('Matcher & String Normalization', () => {
  it('deve limpar títulos com acentos, pontuações e ruídos de clipe', () => {
    expect(cleanMusicString('Gostava Tanto de Você (Official Video)')).toBe('gostava tanto de voce');
    expect(cleanMusicString('Tempo Perdido [Remastered 2023]')).toBe('tempo perdido');
    expect(cleanMusicString('Evidências - Ao Vivo')).toBe('evidencias');
    expect(cleanMusicString('O Descobridor dos Sete Mares')).toBe('descobridor dos sete mares');
  });

  it('deve calcular distância de Levenshtein corretamente', () => {
    expect(levenshteinDistance('tim', 'tim')).toBe(0);
    expect(levenshteinDistance('tim', 'tom')).toBe(1);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('deve validar acertos com tolerância a pequenos erros de digitação (Levenshtein >= 82%)', () => {
    // Acerto exato
    expect(isMatch('Gostava Tanto de Você', 'Gostava Tanto de Você')).toBe(true);

    // Erros de digitação comuns no celular
    expect(isMatch('gostava tanto de vc', 'Gostava Tanto de Você')).toBe(true);
    expect(isMatch('bohemian rapsody', 'Bohemian Rhapsody')).toBe(true);
    expect(isMatch('descobridor dos 7 mares', 'O Descobridor dos Sete Mares')).toBe(true);

    // Chute totalmente errado
    expect(isMatch('Pais e Filhos', 'Gostava Tanto de Você')).toBe(false);
  });
});
