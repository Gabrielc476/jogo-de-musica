'use client';

import { useState, useEffect, useMemo } from 'react';
import { Player, Room, TrackSnippet, LyricLine } from '../types/game';

interface MasterChoosingViewProps {
  room: Room;
  currentPlayer?: Player;
  onSearchYouTube: (query: string) => Promise<any[]>;
  onFetchLyrics: (trackName: string, artistName: string) => Promise<LyricLine[]>;
  onSelectTrack: (pin: string, snippet: TrackSnippet) => void;
  onShowToast: (msg: string) => void;
}

const INITIAL_RECOMMENDED_TRACKS = [
  { videoId: 'O2aT0R1kM80', title: 'Gostava Tanto de Você', artist: 'Tim Maia', rawTitle: 'Tim Maia - Gostava Tanto de Você', durationSec: 258, color: '#7f1d1d', tag: 'TM' },
  { videoId: 'O3x_wU8p70M', title: 'Não Quero Dinheiro (Só Quero Amar)', artist: 'Tim Maia', rawTitle: 'Tim Maia - Não Quero Dinheiro', durationSec: 154, color: '#9a3412', tag: 'TM' },
  { videoId: 'qC8eK-eP89Y', title: 'Tempo Perdido', artist: 'Legião Urbana', rawTitle: 'Legião Urbana - Tempo Perdido', durationSec: 302, color: '#14532d', tag: 'LU' },
  { videoId: 'e8x8QkEwU68', title: 'Pais e Filhos', artist: 'Legião Urbana', rawTitle: 'Legião Urbana - Pais e Filhos', durationSec: 308, color: '#581c87', tag: 'LU' },
  { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', rawTitle: 'Queen - Bohemian Rhapsody', durationSec: 359, color: '#831843', tag: 'QN' },
  { videoId: 'Zi_XLOBDo_Y', title: 'Billie Jean', artist: 'Michael Jackson', rawTitle: 'Michael Jackson - Billie Jean', durationSec: 294, color: '#1e3a8a', tag: 'MJ' },
  { videoId: 'h_D3VFkatAQ', title: 'Cheia de Manias', artist: 'Raça Negra', rawTitle: 'Raça Negra - Cheia de Manias', durationSec: 220, color: '#9a3412', tag: 'RN' },
  { videoId: '7c_4fK7tWvY', title: 'Evidências', artist: 'Chitãozinho & Xororó', rawTitle: 'Chitãozinho & Xororó - Evidências', durationSec: 279, color: '#14532d', tag: 'CX' },
  { videoId: 'qO6KjW7w81M', title: 'Taj Mahal', artist: 'Jorge Ben Jor', rawTitle: 'Jorge Ben Jor - Taj Mahal', durationSec: 204, color: '#581c87', tag: 'JB' },
  { videoId: '0U6yX7w70fI', title: 'O Descobridor dos Sete Mares', artist: 'Tim Maia', rawTitle: 'Tim Maia - O Descobridor dos Sete Mares', durationSec: 262, color: '#1e3a8a', tag: 'TM' },
];

export function MasterChoosingView({
  room,
  currentPlayer,
  onSearchYouTube,
  onFetchLyrics,
  onSelectTrack,
  onShowToast
}: MasterChoosingViewProps) {
  const currentMaster = room.players[room.masterIndex];
  const isMaster = currentPlayer?.isMaster ?? false;

  const [step, setStep] = useState<'search' | 'trimmer'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchResults, setSearchResults] = useState<any[]>(INITIAL_RECOMMENDED_TRACKS);
  const [isSearching, setIsSearching] = useState(false);

  // Estado da faixa selecionada para corte
  const [selectedTrack, setSelectedTrack] = useState<{
    videoId: string;
    rawTitle: string;
    title: string;
    artist: string;
    durationSec: number;
    color: string;
    tag: string;
  } | null>(null);

  const [calibratedTitle, setCalibratedTitle] = useState('');
  const [calibratedArtist, setCalibratedArtist] = useState('');
  const [startSec, setStartSec] = useState(30);
  const [durationSec, setDurationSec] = useState<10 | 15 | 20>(15);
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) {
      setSearchResults(INITIAL_RECOMMENDED_TRACKS);
      return;
    }

    setIsSearching(true);
    try {
      const res = await onSearchYouTube(q);
      if (res && res.length > 0) {
        setSearchResults(res);
      } else {
        // Se a busca remota falhar ou der timeout, filtra as faixas recomendadas locais
        const filtered = INITIAL_RECOMMENDED_TRACKS.filter(
          (t) =>
            t.title.toLowerCase().includes(q.toLowerCase()) ||
            t.artist.toLowerCase().includes(q.toLowerCase())
        );
        setSearchResults(filtered.length > 0 ? filtered : INITIAL_RECOMMENDED_TRACKS);
        onShowToast('Exibindo sugestões do lounge.');
      }
    } catch {
      setSearchResults(INITIAL_RECOMMENDED_TRACKS);
      onShowToast('Exibindo catálogo rápido.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTrackToTrim = async (track: any) => {
    setSelectedTrack(track);
    setCalibratedTitle(track.title);
    setCalibratedArtist(track.artist);
    setStartSec(Math.min(30, Math.max(0, track.durationSec - 20)));
    setDurationSec(15);
    setStep('trimmer');

    // Busca letras sincronizadas na API LRCLIB
    setIsLoadingLyrics(true);
    try {
      const lyrics = await onFetchLyrics(track.title, track.artist);
      setSyncedLyrics(lyrics);
    } catch {
      setSyncedLyrics([]);
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  // Helper para formatar mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Letra ativa no segundo atual do slider
  const activeLyricSnippet = useMemo(() => {
    if (isLoadingLyrics) return 'Carregando letra sincronizada...';
    if (!syncedLyrics.length) return 'Letra não sincronizada (use os fones ou corte livre)';

    let active = syncedLyrics[0].text;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (startSec >= syncedLyrics[i].second) {
        active = syncedLyrics[i].text;
      } else {
        break;
      }
    }
    return active;
  }, [syncedLyrics, startSec, isLoadingLyrics]);

  const handleConfirmSnippet = () => {
    if (!selectedTrack) return;
    if (!calibratedTitle.trim()) {
      onShowToast('Informe o nome da música para validação!');
      return;
    }

    const snippet: TrackSnippet = {
      videoId: selectedTrack.videoId,
      rawTitle: selectedTrack.rawTitle,
      title: calibratedTitle.trim(),
      artist: calibratedArtist.trim(),
      startSec,
      durationSec,
      color: selectedTrack.color,
      tag: selectedTrack.tag,
      syncedLyrics
    };

    onSelectTrack(room.pin, snippet);
  };

  // Se NÃO for o Mestre da rodada: Tela de Espera Elegante
  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-6 animate-in fade-in">
        <div className="w-24 h-24 rounded-full bg-[#18181c] border-2 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center justify-center mb-6 relative">
          <span className="text-3xl animate-bounce">🎧</span>
          <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping pointer-events-none"></div>
        </div>
        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-1">
          Mestre da Rodada
        </span>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
          {currentMaster?.nickname} está escolhendo o som
        </h2>
        <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
          O DJ está cortando o trecho e acompanhando a letra. Prepare os ouvidos para adivinhar na caixinha de som!
        </p>
      </div>
    );
  }

  // TELA DO MESTRE: ETAPA 1 - BUSCA & CATÁLOGO
  if (step === 'search') {
    return (
      <div className="flex flex-col flex-1 gap-3 py-1 animate-in fade-in">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Buscar Faixa</h2>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              Você é o Mestre
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Digite o nome da música ou cole o link direto do YouTube
          </p>
        </div>

        {/* Barra de Busca com Botão Estrito */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="relative flex items-center gap-2"
        >
          <div className="relative w-full">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Ex: Tim Maia ou link do YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#242424] border border-transparent focus:border-white/20 text-white placeholder-zinc-500 rounded-xl pl-8 pr-3 py-2.5 text-xs outline-none transition-all font-medium"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs shrink-0 transition-all active:scale-95 disabled:opacity-50"
          >
            {isSearching ? '...' : 'Buscar'}
          </button>
        </form>

        {/* Pílulas de Filtro Rápido */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar text-xs font-medium py-0.5">
          {[
            { id: 'all', label: 'Todas', query: 'Tim Maia' },
            { id: 'brasil', label: 'Brasil 80', query: 'Legião Urbana' },
            { id: 'rock', label: 'Rock', query: 'Queen' },
            { id: 'pop', label: 'Pop Internacional', query: 'Michael Jackson' },
            { id: 'pagode', label: 'Pagode 90', query: 'Raça Negra' }
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => {
                setActiveFilter(chip.id);
                setSearchQuery(chip.query);
                handleSearch(chip.query);
              }}
              className={`px-3 py-1.5 rounded-full shrink-0 text-xs font-semibold transition-colors ${
                activeFilter === chip.id
                  ? 'bg-white text-black'
                  : 'bg-[#242424] text-zinc-300 hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Lista de Resultados */}
        <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pr-0.5">
          <span className="text-[11px] text-zinc-400 px-1 font-semibold">
            Resultados ({searchResults.length})
          </span>

          {searchResults.map((track) => (
            <div
              key={track.videoId}
              onClick={() => handleSelectTrackToTrim(track)}
              className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#242424] active:scale-[0.99] transition-all flex items-center gap-3 cursor-pointer border border-transparent hover:border-white/10"
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                style={{ backgroundColor: track.color }}
              >
                {track.tag}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-white truncate">{track.title}</h3>
                <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                {formatTime(track.durationSec)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // TELA DO MESTRE: ETAPA 2 - MESA DE CORTE COM LETRA E CALIBRAÇÃO
  const maxStart = selectedTrack ? Math.max(0, selectedTrack.durationSec - durationSec) : 100;

  return (
    <div className="flex flex-col justify-between flex-1 gap-2.5 py-1 animate-in fade-in">
      {/* Topo com Voltar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Ajustar Trecho</h2>
          <p className="text-[11px] text-zinc-400">Defina os segundos que irão tocar na caixinha</p>
        </div>
        <button
          onClick={() => setStep('search')}
          className="text-xs text-emerald-400 hover:underline font-medium"
        >
          ← Trocar faixa
        </button>
      </div>

      {/* Seção de Calibração de Metadados (Q1 alinhada com o usuário) */}
      <div className="bg-[#181818] p-3 rounded-2xl border border-white/5 flex flex-col gap-2 shadow-lg">
        <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">
          Respostas esperadas para pontuação
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Música</label>
            <input
              type="text"
              value={calibratedTitle}
              onChange={(e) => setCalibratedTitle(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Artista / Banda</label>
            <input
              type="text"
              value={calibratedArtist}
              onChange={(e) => setCalibratedArtist(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Mesa de Corte: Slider, Letra e Duração */}
      <div className="flex flex-col gap-3 bg-[#181818] p-3.5 rounded-2xl border border-white/5 my-auto shadow-xl">
        {/* Marcadores de Tempo */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 block font-medium uppercase tracking-wider">
              Segundo inicial
            </span>
            <span className="text-2xl font-mono font-bold text-white">
              {formatTime(startSec)}
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-300 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            até {formatTime(startSec + durationSec)}
          </span>
        </div>

        {/* Slider de Tempo */}
        <div className="py-0.5">
          <input
            type="range"
            min={0}
            max={maxStart}
            value={startSec}
            onChange={(e) => setStartSec(parseInt(e.target.value, 10))}
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
            <span>00:00</span>
            <span>{selectedTrack ? formatTime(selectedTrack.durationSec) : '00:00'}</span>
          </div>
        </div>

        {/* Caixa de Letra Sincronizada (LRCLIB) */}
        <div className="bg-[#121212] p-3 rounded-xl border border-white/5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Letra no trecho selecionado
            </span>
            <span className="text-emerald-400 font-semibold">
              {syncedLyrics.length ? 'Sincronizada' : 'Sem Letra'}
            </span>
          </div>
          <div className="text-xs text-zinc-200 italic font-medium leading-relaxed min-h-[36px] flex items-center justify-center text-center px-2">
            &ldquo;{activeLyricSnippet}&rdquo;
          </div>
        </div>

        {/* Seletor de Duração */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-xs text-zinc-300 font-medium">Duração do Som:</span>
          <div className="flex gap-1 bg-[#121212] p-1 rounded-xl border border-white/5">
            {([10, 15, 20] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDurationSec(d)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  durationSec === d
                    ? 'font-bold bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Botão de Disparo */}
      <button
        onClick={handleConfirmSnippet}
        className="w-full py-4 rounded-xl font-extrabold text-sm bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black transition-all shadow-[0_4px_25px_rgba(30,215,96,0.25)]"
      >
        Soltar Som na Caixinha
      </button>
    </div>
  );
}
