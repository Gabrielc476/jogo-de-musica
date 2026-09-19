'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Player, Room } from '../types/game';

interface GameOverViewProps {
  room: Room;
  currentPlayer?: Player;
  onRematch: (pin: string) => void;
}

export function GameOverView({
  room,
  currentPlayer,
  onRematch
}: GameOverViewProps) {
  const isHost = currentPlayer?.isHost ?? false;

  // Dispara confetes na montagem do pódio
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Confetti opcional
    }
  }, []);

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const first = sortedPlayers[0];
  const second = sortedPlayers[1];
  const third = sortedPlayers[2];

  return (
    <div className="flex flex-col justify-between flex-1 py-1 gap-3 animate-in fade-in">
      {/* Cabeçalho do Pódio */}
      <div className="text-center mt-2">
        <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold block mb-1">
          Fim de Partida
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Pódio Vinyl Lounge 🏆
        </h1>
      </div>

      {/* Pódio dos 3 Primeiros Colocados */}
      <div className="flex items-end justify-center gap-2 my-auto pt-4 px-2">
        {/* 2º Lugar */}
        {second && (
          <div className="flex flex-col items-center flex-1">
            <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[80px] mb-1">
              {second.nickname}
            </span>
            <div className="w-full bg-[#1e293b] border border-slate-400/30 rounded-t-2xl flex flex-col items-center justify-center py-4 shadow-lg">
              <span className="text-lg font-extrabold text-slate-300 font-mono">2º</span>
              <span className="text-[10px] font-mono text-zinc-400 mt-1">{second.score} pts</span>
            </div>
          </div>
        )}

        {/* 1º Lugar (Destaque Ouro) */}
        {first && (
          <div className="flex flex-col items-center flex-1 -mt-4">
            <span className="text-xl mb-0.5">👑</span>
            <span className="text-xs font-extrabold text-amber-300 truncate max-w-[90px] mb-1">
              {first.nickname}
            </span>
            <div className="w-full bg-gradient-to-b from-amber-500/20 to-amber-900/30 border-2 border-amber-400/50 rounded-t-2xl flex flex-col items-center justify-center py-7 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <span className="text-2xl font-extrabold text-amber-400 font-mono">1º</span>
              <span className="text-xs font-mono font-bold text-white mt-1">{first.score} pts</span>
            </div>
          </div>
        )}

        {/* 3º Lugar */}
        {third && (
          <div className="flex flex-col items-center flex-1">
            <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[80px] mb-1">
              {third.nickname}
            </span>
            <div className="w-full bg-[#291711] border border-amber-800/30 rounded-t-2xl flex flex-col items-center justify-center py-2.5 shadow-lg">
              <span className="text-base font-extrabold text-amber-600 font-mono">3º</span>
              <span className="text-[10px] font-mono text-zinc-400 mt-1">{third.score} pts</span>
            </div>
          </div>
        )}
      </div>

      {/* Lista Completa de Classificação */}
      <div className="bg-[#181818] p-3 rounded-2xl border border-white/5 max-h-36 overflow-y-auto no-scrollbar">
        <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block mb-1 px-1">
          Classificação Geral
        </span>
        {sortedPlayers.map((player, idx) => (
          <div
            key={player.id}
            className="flex items-center justify-between py-1.5 px-2 border-b border-white/5 last:border-0 text-xs"
          >
            <span className="text-zinc-400">
              <strong className="text-white font-mono">{idx + 1}º</strong> {player.nickname}
            </span>
            <span className="font-mono font-bold text-white">{player.score} pts</span>
          </div>
        ))}
      </div>

      {/* Ação de Revanche Contínua (ADR 0004) */}
      {isHost ? (
        <button
          onClick={() => onRematch(room.pin)}
          className="w-full py-4 rounded-xl font-extrabold text-sm bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black transition-all shadow-[0_4px_30px_rgba(30,215,96,0.3)] flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>Jogar Revanche (Mesma Sala)</span>
        </button>
      ) : (
        <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-xs text-zinc-400">
            Aguardando o anfitrião iniciar a revanche...
          </p>
        </div>
      )}
    </div>
  );
}
