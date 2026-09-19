import { describe, it, expect } from 'vitest';
import { parseLrc, getLyricAtSecond } from '../src/lib/lyrics.js';

describe('Lyrics LRC Parser', () => {
  const sampleLrc = `
[00:05.10] (Introdução instrumental)
[00:24.50] Não sei por que você se foi
[00:28.12] Quantas saudades eu senti
[00:50.00] E de tristeza vou viver
`;

  it('deve parsear strings LRC para objetos com segundos float e texto', () => {
    const parsed = parseLrc(sampleLrc);
    expect(parsed.length).toBe(4);
    expect(parsed[0].second).toBeCloseTo(5.1);
    expect(parsed[0].text).toBe('(Introdução instrumental)');
    expect(parsed[1].second).toBeCloseTo(24.5);
    expect(parsed[1].text).toBe('Não sei por que você se foi');
  });

  it('deve retornar a letra ativa para um segundo específico na linha do tempo', () => {
    const parsed = parseLrc(sampleLrc);
    expect(getLyricAtSecond(parsed, 0)).toBe('(Introdução instrumental)');
    expect(getLyricAtSecond(parsed, 10)).toBe('(Introdução instrumental)');
    expect(getLyricAtSecond(parsed, 25)).toBe('Não sei por que você se foi');
    expect(getLyricAtSecond(parsed, 35)).toBe('Quantas saudades eu senti');
    expect(getLyricAtSecond(parsed, 55)).toBe('E de tristeza vou viver');
  });
});
