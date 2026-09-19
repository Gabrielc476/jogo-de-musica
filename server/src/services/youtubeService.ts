import ytSearch from 'yt-search';
import { LRUCache } from 'lru-cache';
import { cleanMusicString } from '../lib/matcher.js';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  artist: string;
  rawTitle: string;
  durationSec: number;
  color: string;
  tag: string;
  thumbnail: string;
}

const PALETTE = [
  '#7f1d1d', // Vermelho vinho
  '#9a3412', // Laranja terracota
  '#1e3a8a', // Azul meia-noite
  '#14532d', // Verde floresta
  '#581c87', // Roxo profundo
  '#831843'  // Bordô lounge
];

export class YouTubeService {
  private cache = new LRUCache<string, YouTubeSearchResult[]>({
    max: 100,
    ttl: 1000 * 60 * 60 * 6 // 6 horas
  });

  public parseDirectLink(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Caso 1: ID direto de 11 caracteres
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Caso 2: URLs do YouTube
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtube.com')) {
        const v = url.searchParams.get('v');
        if (v && v.length === 11) return v;
        const pathParts = url.pathname.split('/');
        if (pathParts[1] === 'shorts' && pathParts[2]?.length === 11) {
          return pathParts[2];
        }
      } else if (url.hostname === 'youtu.be') {
        const id = url.pathname.replace('/', '');
        if (id.length === 11) return id;
      }
    } catch {
      // Não é uma URL válida
    }

    return null;
  }

  public splitTitleArtist(rawTitle: string): { title: string; artist: string } {
    let clean = rawTitle
      .replace(/\(.*?\)|\[.*?\]/g, '') // Remove parênteses
      .replace(/\b(official video|video oficial|audio oficial|clipe oficial|hd|4k|lyric video|letra|remastered|ao vivo)\b/gi, '')
      .trim();

    // Procura por separadores comuns: "Artista - Música"
    const separators = [' - ', ' – ', ' — ', ': '];
    for (const sep of separators) {
      if (clean.includes(sep)) {
        const parts = clean.split(sep);
        const artist = parts[0].trim();
        const title = parts.slice(1).join(' ').trim();
        if (artist && title) {
          return { artist, title };
        }
      }
    }

    // Fallback: usa a string limpa como título e artista desconhecido
    return {
      title: clean || rawTitle,
      artist: ''
    };
  }

  private generateTag(text: string): string {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return (text.slice(0, 2) || 'VL').toUpperCase();
  }

  public async search(query: string): Promise<YouTubeSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cached = this.cache.get(trimmed.toLowerCase());
    if (cached) return cached;

    const directVideoId = this.parseDirectLink(trimmed);

    try {
      if (directVideoId) {
        // Busca direta por vídeo único
        const video = await ytSearch({ videoId: directVideoId });
        if (video) {
          const { title, artist } = this.splitTitleArtist(video.title);
          const item: YouTubeSearchResult = {
            videoId: video.videoId,
            title,
            artist: artist || video.author.name,
            rawTitle: video.title,
            durationSec: video.seconds || 240,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            tag: this.generateTag(artist || title),
            thumbnail: video.thumbnail || ''
          };
          this.cache.set(trimmed.toLowerCase(), [item]);
          return [item];
        }
      }

      // Busca textual ampla via yt-search (cota zero)
      const res = await ytSearch(trimmed);
      const videos = res.videos.slice(0, 8); // Top 8 resultados

      const results: YouTubeSearchResult[] = videos.map((v: any, index: number) => {
        const { title, artist } = this.splitTitleArtist(v.title);
        return {
          videoId: v.videoId,
          title,
          artist: artist || v.author.name,
          rawTitle: v.title,
          durationSec: v.seconds || 200,
          color: PALETTE[index % PALETTE.length],
          tag: this.generateTag(artist || title),
          thumbnail: v.thumbnail || ''
        };
      });

      this.cache.set(trimmed.toLowerCase(), results);
      return results;
    } catch (err) {
      console.error('[YouTubeService] Erro ao pesquisar no YouTube:', err);
      return [];
    }
  }
}
