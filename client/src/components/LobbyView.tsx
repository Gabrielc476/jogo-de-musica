'use client';

import { useState } from 'react';
import { Player, Room } from '../types/game';

interface LobbyViewProps {
  room: Room | null;
  currentPlayer?: Player;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (pin: string, nickname: string) => void;
  onClaimSpeaker: (pin: string) => void;
  onStartGame: (pin: string, totalRounds: number) => void;
  onCopyPin: (pin: string) => void;
}

export function LobbyView({
  room,
  currentPlayer,
  onCreateRoom,
  onJoinRoom,
  onClaimSpeaker,
  onStartGame,
  onCopyPin
}: LobbyViewProps) {
  const [nickname, setNickname] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState(5);

  // Se o jogador ainda não está em uma sala: Tela Inicial de Entrada
  if (!room) {
    return (
      <div className="flex flex-col justify-between flex-1 py-4 animate-in fade-in">
        {/* Cabeçalho da Marca */}
        <div className="text-center mt-6">
          <div className="w-16 h-16 rounded-full bg-[#18181c] border-2 border-pink-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] mx-auto flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full bg-[#831843] flex items-center justify-center text-[10px] font-bold text-pink-200">
              VL
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
            Vinyl Lounge
          </h1>
          <p className="text-xs text-zinc-400">
            Adivinhe a música com os amigos na caixinha de som
          </p>
        </div>

        {/* Formulário de Acesso */}
        <div className="bg-[#181818] p-5 rounded-3xl border border-white/5 shadow-2xl my-auto flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Seu Apelido
            </label>
            <input
              type="text"
              placeholder="Como quer ser chamado?"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-[#121212] border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-base outline-none transition-all font-medium"
              autoComplete="off"
              maxLength={16}
            />
          </div>

          {isJoining ? (
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Código da Sala (PIN)
              </label>
              <input
                type="text"
                placeholder="Ex: 8492"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-[#121212] border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-center font-mono tracking-widest text-lg font-bold outline-none transition-all"
                autoComplete="off"
              />
            </div>
          ) : null}

          {isJoining ? (
            <div className="flex flex-col gap-2 mt-2">
              <button
                disabled={!nickname.trim() || pinInput.length !== 4}
                onClick={() => onJoinRoom(pinInput, nickname)}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black transition-all shadow-lg active:scale-[0.99]"
              >
                Entrar na Sala
              </button>
              <button
                onClick={() => setIsJoining(false)}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white font-medium"
              >
                ← Voltar para Criar Sala
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              <button
                disabled={!nickname.trim()}
                onClick={() => onCreateRoom(nickname)}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-white hover:bg-zinc-200 disabled:opacity-40 text-black transition-all shadow-lg active:scale-[0.99]"
              >
                Criar Nova Sala
              </button>
              <button
                onClick={() => setIsJoining(true)}
                className="w-full py-3 rounded-xl font-semibold text-xs bg-[#242424] hover:bg-[#2c2c2c] text-zinc-200 transition-all border border-white/5 active:scale-[0.99]"
              >
                Já tenho um código (Entrar)
              </button>
            </div>
          )}
        </div>

        {/* Rodapé sutil */}
        <p className="text-[11px] text-zinc-500 text-center font-mono">
          DESENVOLVIDO PARA MOBILE & BLUETOOTH
        </p>
      </div>
    );
  }

  // Se já está na sala: Lobby de Espera
  const isHost = currentPlayer?.isHost ?? false;
  const isSpeaker = currentPlayer?.isAudioSpeaker ?? false;

  return (
    <div className="flex flex-col justify-between flex-1 py-1 animate-in fade-in">
      {/* Topo do Lobby com PIN em Destaque */}
      <div className="bg-[#181818] p-4 rounded-2xl border border-white/5 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider block">
            Código da Sala
          </span>
          <div className="text-2xl font-mono font-bold text-emerald-400 tracking-wider flex items-center gap-2">
            #{room.pin}
          </div>
        </div>
        <button
          onClick={() => onCopyPin(room.pin)}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 border border-white/10 active:scale-95 transition-all"
        >
          Copiar PIN
        </button>
      </div>

      {/* Botão de Caixa de Som (Bluetooth) */}
      <div className="my-3">
        <button
          onClick={() => onClaimSpeaker(room.pin)}
          className={`w-full p-3.5 rounded-2xl border transition-all flex items-center justify-between text-left ${
            isSpeaker
              ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-[0_0_20px_rgba(30,215,96,0.15)]'
              : 'bg-[#181818] border-white/5 hover:border-white/10 text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{isSpeaker ? '🔊' : '📱'}</span>
            <div>
              <h4 className="text-xs font-bold text-white">
                {isSpeaker ? 'Este celular é a Caixa de Som' : 'Conectar como Caixa de Som'}
              </h4>
              <p className="text-[11px] text-zinc-400">
                {isSpeaker
                  ? 'Conectado ao Bluetooth do ambiente'
                  : 'Toque se este aparelho estiver no som da sala'}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              isSpeaker
                ? 'bg-emerald-500 text-black'
                : 'bg-white/5 text-zinc-400'
            }`}
          >
            {isSpeaker ? 'ATIVO' : 'ASSUMIR'}
          </span>
        </button>
      </div>

      {/* Lista de Jogadores Conectados */}
      <div className="flex flex-col flex-1 bg-[#181818] p-3.5 rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex justify-between items-center mb-2.5 px-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Na Sala ({room.players.length})
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {room.speakerId ? '✓ Caixa Definida' : '⚠ Sem Caixa de Som'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pr-0.5">
          {room.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#121212] border border-white/5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-pink-900/60 border border-pink-400/30 flex items-center justify-center font-bold text-xs text-pink-200">
                  {player.nickname.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-white">
                  {player.nickname} {player.id === currentPlayer?.id && '(Você)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {player.isHost && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Anfitrião
                  </span>
                )}
                {player.isAudioSpeaker && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Caixa
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controles do Anfitrião ou Mensagem de Espera */}
      <div className="mt-3">
        {isHost ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-300">Total de Rodadas:</span>
              <div className="flex gap-1 bg-[#181818] p-1 rounded-xl border border-white/5">
                {[3, 5, 7, 10].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedRounds(count)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      selectedRounds === count
                        ? 'bg-white text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onStartGame(room.pin, selectedRounds)}
              className="w-full py-4 rounded-xl font-extrabold text-sm bg-emerald-500 hover:bg-emerald-400 text-black active:scale-[0.99] transition-all shadow-[0_4px_25px_rgba(30,215,96,0.3)]"
            >
              Iniciar Partida
            </button>
          </div>
        ) : (
          <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
            <p className="text-xs text-zinc-400 font-medium">
              Aguardando o anfitrião iniciar o jogo...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
