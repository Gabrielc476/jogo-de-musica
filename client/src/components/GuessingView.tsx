'use client';

import { useState, useEffect } from 'react';
import { Player, Room } from '../types/game';

interface GuessingViewProps {
  room: Room;
  currentPlayer?: Player;
  roundTiming: { endsAt: number; bufferEndsAt: number; durationSec: number } | null;
  onSubmitGuess: (pin: string, track: string, artist: string) => void;
  onShowToast: (msg: string) => void;
}

export function GuessingView({
  room,
  currentPlayer,
  roundTiming,
  onSubmitGuess,
  onShowToast
}: GuessingViewProps) {
  const isMaster = currentPlayer?.isMaster ?? false;
  const [trackGuess, setTrackGuess] = useState('');
  const [artistGuess, setArtistGuess] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Contagem regressiva local em segundos
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15);
  const [isInBufferPhase, setIsInBufferPhase] = useState(false);

  useEffect(() => {
    if (!roundTiming) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const totalRemainingMs = roundTiming.bufferEndsAt - now;
      const audioRemainingMs = roundTiming.endsAt - now;

      if (totalRemainingMs <= 0) {
        setSecondsRemaining(0);
        clearInterval(interval);
      } else {
        setSecondsRemaining(Math.ceil(totalRemainingMs / 1000));
        setIsInBufferPhase(audioRemainingMs <= 0);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [roundTiming]);

  // Se o jogador já tem palpite registrado no servidor
  const isGuessed = hasSubmitted || currentPlayer?.hasGuessed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackGuess.trim()) {
      onShowToast('Digite pelo menos o título da música!');
      return;
    }

    onSubmitGuess(room.pin, trackGuess, artistGuess);
    setHasSubmitted(true);
    onShowToast('✓ Palpite enviado! Segredo até o placar.');
  };

  return (
    <div className="flex flex-col justify-between flex-1 py-1 animate-in fade-in">
      {/* Centro: Cronômetro + Disco de Vinil + Equalizador */}
      <div className="flex flex-col items-center justify-center my-auto">
        {/* Cronômetro com indicação da fase de Buffer */}
        <div
          className={`mb-4 px-4 py-1 rounded-full border flex items-center gap-2 transition-all ${
            isInBufferPhase
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse'
              : 'bg-white/5 border-white/10 text-white'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isInBufferPhase ? 'bg-amber-400' : 'bg-red-500 animate-pulse'
            }`}
          ></span>
          <span className="text-xl font-mono font-bold tracking-tight">
            00:{String(secondsRemaining).padStart(2, '0')}
          </span>
          {isInBufferPhase && (
            <span className="text-[10px] uppercase font-mono font-bold ml-1 text-amber-300">
              Tempo Final
            </span>
          )}
        </div>

        {/* Disco de Vinil Preto */}
        <div
          className={`relative w-44 h-44 rounded-full bg-[#0a0a0c] border-[5px] border-[#18181c] shadow-[0_16px_40px_rgba(0,0,0,0.9)] flex items-center justify-center transition-all ${
            isInBufferPhase ? 'scale-95' : 'animate-spin-slow'
          }`}
        >
          <div className="absolute inset-2 rounded-full border border-white/[0.04]"></div>
          <div className="absolute inset-5 rounded-full border border-white/[0.05]"></div>
          <div className="absolute inset-9 rounded-full border border-white/[0.04]"></div>
          <div className="absolute inset-13 rounded-full border border-white/[0.05]"></div>

          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none"></div>

          {/* Selo Central */}
          <div className="w-14 h-14 rounded-full bg-[#831843] border border-pink-400/30 flex flex-col items-center justify-center shadow-inner">
            <span className="text-[6px] tracking-widest text-pink-200 font-bold uppercase">
              VINYL
            </span>
            <div className="w-3 h-3 my-0.5 rounded-full bg-[#121212] border border-white/20"></div>
            <span className="text-[5px] font-mono text-pink-300">33 RPM</span>
          </div>
        </div>

        {/* Equalizador Acústico em Onda */}
        <div className="flex items-end justify-center gap-1.5 h-6 mt-5">
          {!isInBufferPhase ? (
            <>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.4s' }}></span>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.5s' }}></span>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.3s' }}></span>
              <span className="w-1 bg-emerald-400 rounded-full bar-wave" style={{ animationDelay: '0.45s' }}></span>
            </>
          ) : (
            <span className="text-[11px] font-mono text-zinc-500 italic">
              (Som finalizado — digite seu palpite)
            </span>
          )}
        </div>
      </div>

      {/* Terço Inferior: Seção de Resposta Mobile */}
      {isMaster ? (
        <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 text-center shadow-xl">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
            Você é o Mestre
          </span>
          <p className="text-xs text-zinc-300">
            Você escolheu este trecho! Acompanhe o grupo adivinhar para garantir seus pontos no Dilema do Mestre.
          </p>
        </div>
      ) : isGuessed ? (
        <div className="bg-[#181818] p-4 rounded-2xl border border-emerald-500/20 text-center shadow-xl">
          <div className="text-emerald-400 text-lg mb-1">✓</div>
          <h4 className="text-xs font-bold text-white mb-1">Palpite Registrado!</h4>
          <p className="text-[11px] text-zinc-400">
            Suspense total: os acertos e pontuações serão revelados ao final da contagem.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 mt-2">
          <div className="flex flex-col gap-2 bg-[#181818] p-3 rounded-2xl border border-white/5 shadow-xl">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Qual é a música?
              </label>
              <input
                type="text"
                placeholder="Ex: Gostava Tanto de Você"
                value={trackGuess}
                onChange={(e) => setTrackGuess(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 rounded-xl px-3.5 py-2.5 text-base outline-none transition-all font-medium"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-zinc-400">
                  Artista ou Banda
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">+150 bônus</span>
              </div>
              <input
                type="text"
                placeholder="Ex: Tim Maia"
                value={artistGuess}
                onChange={(e) => setArtistGuess(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 rounded-xl px-3.5 py-2.5 text-base outline-none transition-all font-medium"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-white hover:bg-zinc-200 active:scale-[0.99] text-black transition-all shadow-lg"
          >
            Enviar Palpite
          </button>
        </form>
      )}
    </div>
  );
}
