import { LRUCache } from 'lru-cache';
import { LyricLine } from '../types/game.js';
import { parseLrc } from '../lib/lyrics.js';

export class LyricsService {
  private cache = new LRUCache<string, LyricLine[]>({
    max: 200,
    ttl: 1000 * 60 * 60 * 24 // 24 horas
  });

  public async fetchLyrics(trackName: string, artistName: string): Promise<LyricLine[]> {
    const cacheKey = `${trackName.toLowerCase().trim()}:${artistName.toLowerCase().trim()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Tentativa 1: Busca exata no endpoint /api/get
      const url = new URL('https://lrclib.net/api/get');
      url.searchParams.set('track_name', trackName);
      if (artistName) {
        url.searchParams.set('artist_name', artistName);
      }

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'VinylLoungeGame/1.0 (https://github.com)' }
      });

      if (res.ok) {
        const data = (await res.json()) as { syncedLyrics?: string };
        if (data.syncedLyrics) {
          const parsed = parseLrc(data.syncedLyrics);
          this.cache.set(cacheKey, parsed);
          return parsed;
        }
      }

      // Tentativa 2: Busca por termo amplo no endpoint /api/search
      const searchUrl = new URL('https://lrclib.net/api/search');
      searchUrl.searchParams.set('q', `${trackName} ${artistName}`.trim());

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { 'User-Agent': 'VinylLoungeGame/1.0 (https://github.com)' }
      });

      if (searchRes.ok) {
        const results = (await searchRes.json()) as Array<{ syncedLyrics?: string }>;
        for (const item of results) {
          if (item.syncedLyrics) {
            const parsed = parseLrc(item.syncedLyrics);
            this.cache.set(cacheKey, parsed);
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn(`[LyricsService] Erro ao buscar letras para "${trackName}" - "${artistName}":`, err);
    }

    return [];
  }
}
