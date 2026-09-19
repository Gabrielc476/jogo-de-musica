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

// Catálogo curado instantâneo (resposta imediata em 0ms sem depender de scraping externo)
export const INSTANT_CATALOG: YouTubeSearchResult[] = [
  {
    videoId: 'O2aT0R1kM80',
    title: 'Gostava Tanto de Você',
    artist: 'Tim Maia',
    rawTitle: 'Tim Maia - Gostava Tanto de Você',
    durationSec: 258,
    color: '#7f1d1d',
    tag: 'TM',
    thumbnail: 'https://i.ytimg.com/vi/O2aT0R1kM80/hqdefault.jpg'
  },
  {
    videoId: 'O3x_wU8p70M',
    title: 'Não Quero Dinheiro (Só Quero Amar)',
    artist: 'Tim Maia',
    rawTitle: 'Tim Maia - Não Quero Dinheiro',
    durationSec: 154,
    color: '#9a3412',
    tag: 'TM',
    thumbnail: 'https://i.ytimg.com/vi/O3x_wU8p70M/hqdefault.jpg'
  },
  {
    videoId: '0U6yX7w70fI',
    title: 'O Descobridor dos Sete Mares',
    artist: 'Tim Maia',
    rawTitle: 'Tim Maia - O Descobridor dos Sete Mares',
    durationSec: 262,
    color: '#1e3a8a',
    tag: 'TM',
    thumbnail: 'https://i.ytimg.com/vi/0U6yX7w70fI/hqdefault.jpg'
  },
  {
    videoId: 'qC8eK-eP89Y',
    title: 'Tempo Perdido',
    artist: 'Legião Urbana',
    rawTitle: 'Legião Urbana - Tempo Perdido',
    durationSec: 302,
    color: '#14532d',
    tag: 'LU',
    thumbnail: 'https://i.ytimg.com/vi/qC8eK-eP89Y/hqdefault.jpg'
  },
  {
    videoId: 'e8x8QkEwU68',
    title: 'Pais e Filhos',
    artist: 'Legião Urbana',
    rawTitle: 'Legião Urbana - Pais e Filhos',
    durationSec: 308,
    color: '#581c87',
    tag: 'LU',
    thumbnail: 'https://i.ytimg.com/vi/e8x8QkEwU68/hqdefault.jpg'
  },
  {
    videoId: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    rawTitle: 'Queen - Bohemian Rhapsody',
    durationSec: 359,
    color: '#831843',
    tag: 'QN',
    thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg'
  },
  {
    videoId: 'rY0WxgSXdEE',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    rawTitle: 'Queen - Another One Bites the Dust',
    durationSec: 215,
    color: '#7f1d1d',
    tag: 'QN',
    thumbnail: 'https://i.ytimg.com/vi/rY0WxgSXdEE/hqdefault.jpg'
  },
  {
    videoId: 'Zi_XLOBDo_Y',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    rawTitle: 'Michael Jackson - Billie Jean',
    durationSec: 294,
    color: '#1e3a8a',
    tag: 'MJ',
    thumbnail: 'https://i.ytimg.com/vi/Zi_XLOBDo_Y/hqdefault.jpg'
  },
  {
    videoId: 'h_D3VFkatAQ',
    title: 'Cheia de Manias',
    artist: 'Raça Negra',
    rawTitle: 'Raça Negra - Cheia de Manias',
    durationSec: 220,
    color: '#9a3412',
    tag: 'RN',
    thumbnail: 'https://i.ytimg.com/vi/h_D3VFkatAQ/hqdefault.jpg'
  },
  {
    videoId: '7c_4fK7tWvY',
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    rawTitle: 'Chitãozinho & Xororó - Evidências',
    durationSec: 279,
    color: '#14532d',
    tag: 'CX',
    thumbnail: 'https://i.ytimg.com/vi/7c_4fK7tWvY/hqdefault.jpg'
  },
  {
    videoId: 'qO6KjW7w81M',
    title: 'Taj Mahal',
    artist: 'Jorge Ben Jor',
    rawTitle: 'Jorge Ben Jor - Taj Mahal',
    durationSec: 204,
    color: '#581c87',
    tag: 'JB',
    thumbnail: 'https://i.ytimg.com/vi/qO6KjW7w81M/hqdefault.jpg'
  },
  {
    videoId: 'v1k8Q8tW9pM',
    title: 'Maniac',
    artist: 'Michael Sembello',
    rawTitle: 'Michael Sembello - Maniac',
    durationSec: 244,
    color: '#831843',
    tag: 'MS',
    thumbnail: 'https://i.ytimg.com/vi/v1k8Q8tW9pM/hqdefault.jpg'
  }
];

export class YouTubeService {
  private cache = new LRUCache<string, YouTubeSearchResult[]>({
    max: 150,
    ttl: 1000 * 60 * 60 * 12 // 12 horas
  });

  public parseDirectLink(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

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
      // Ignora erro de parsing
    }

    return null;
  }

  public splitTitleArtist(rawTitle: string): { title: string; artist: string } {
    let clean = rawTitle
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .replace(/\b(official video|video oficial|audio oficial|clipe oficial|hd|4k|lyric video|letra|remastered|ao vivo)\b/gi, '')
      .trim();

    const separators = [' - ', ' – ', ' — ', ': '];
    for (const sep of separators) {
      if (clean.includes(sep)) {
        const parts = clean.split(sep);
        const p1 = parts[0].trim();
        const p2 = parts.slice(1).join(' ').trim();
        if (p1 && p2) {
          return { artist: p1, title: p2 };
        }
      }
    }

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

  // Busca ultra-rápida de vídeo por oEmbed da Google/YouTube (sem quota e sem scraping)
  private async fetchVideoViaOEmbed(videoId: string): Promise<YouTubeSearchResult | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as { title?: string; author_name?: string };
        const rawTitle = data.title || 'Música do YouTube';
        const { title, artist } = this.splitTitleArtist(rawTitle);

        return {
          videoId,
          title: title || rawTitle,
          artist: artist || data.author_name || '',
          rawTitle,
          durationSec: 210, // Duração padrão estimada para oEmbed
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
          tag: this.generateTag(artist || title),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        };
      }
    } catch {
      // Fallback abaixo
    }
    return null;
  }

  public async search(query: string): Promise<YouTubeSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return INSTANT_CATALOG.slice(0, 8);
    }

    const cached = this.cache.get(trimmed.toLowerCase());
    if (cached) return cached;

    // 1. Verifica se é Link Direto ou Video ID de 11 caracteres
    const directVideoId = this.parseDirectLink(trimmed);
    if (directVideoId) {
      // Primeiro verifica no catálogo instantâneo
      const inCatalog = INSTANT_CATALOG.find((c) => c.videoId === directVideoId);
      if (inCatalog) return [inCatalog];

      // Tenta resolver rapidamente via oEmbed (100ms)
      const oembedResult = await this.fetchVideoViaOEmbed(directVideoId);
      if (oembedResult) {
        this.cache.set(trimmed.toLowerCase(), [oembedResult]);
        return [oembedResult];
      }

      // Fallback para ID direto
      const fallbackItem: YouTubeSearchResult = {
        videoId: directVideoId,
        title: 'Música Selecionada',
        artist: 'Artista',
        rawTitle: 'Música do YouTube',
        durationSec: 240,
        color: PALETTE[0],
        tag: 'YT',
        thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`
      };
      return [fallbackItem];
    }

    // 2. Busca no catálogo instantâneo primeiro (match de 0ms)
    const cleanQ = cleanMusicString(trimmed);
    const catalogMatches = INSTANT_CATALOG.filter((item) => {
      const titleMatch = cleanMusicString(item.title).includes(cleanQ);
      const artistMatch = cleanMusicString(item.artist).includes(cleanQ);
      return titleMatch || artistMatch;
    });

    if (catalogMatches.length >= 2) {
      this.cache.set(trimmed.toLowerCase(), catalogMatches);
      return catalogMatches;
    }

    // 3. Busca textual externa via yt-search com TIMEOUT de 10 segundos
    try {
      const searchPromise = ytSearch(trimmed);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      const res = (await Promise.race([searchPromise, timeoutPromise])) as any;

      if (res && res.videos && res.videos.length > 0) {
        const results: YouTubeSearchResult[] = res.videos.slice(0, 8).map((v: any, index: number) => {
          const { title, artist } = this.splitTitleArtist(v.title);
          return {
            videoId: v.videoId,
            title,
            artist: artist || v.author.name,
            rawTitle: v.title,
            durationSec: v.seconds || 210,
            color: PALETTE[index % PALETTE.length],
            tag: this.generateTag(artist || title),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
          };
        });

        this.cache.set(trimmed.toLowerCase(), results);
        return results;
      }
    } catch (err) {
      console.warn('[YouTubeService] Busca externa lenta/bloqueada, usando catálogo fallback.');
    }

    // 4. Se a busca externa falhou ou deu timeout: retorna catálogo curado
    return catalogMatches.length > 0 ? catalogMatches : INSTANT_CATALOG.slice(0, 6);
  }
}
