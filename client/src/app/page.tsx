'use client';

import { useGameSocket } from '../hooks/useGameSocket';
import { LobbyView } from '../components/LobbyView';
import { MasterChoosingView } from '../components/MasterChoosingView';
import { GuessingView } from '../components/GuessingView';
import { RevealView } from '../components/RevealView';
import { GameOverView } from '../components/GameOverView';
import { AudioSpeakerPlayer } from '../components/AudioSpeakerPlayer';

export default function Home() {
  const {
    connected,
    connectingSeconds,
    isMissingServerUrl,
    room,
    currentPlayer,
    lastResults,
    speakerCue,
    roundTiming,
    toast,
    showToast,
    createRoom,
    joinRoom,
    leaveRoom,
    claimSpeaker,
    startGame,
    searchYouTube,
    fetchLyrics,
    selectTrack,
    startSpeakerPlayback,
    submitGuess,
    nextRound,
    rematch,
    reconnectServer
  } = useGameSocket();

  const handleCopyPin = (pin: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(pin);
      showToast(`PIN #${pin} copiado!`);
    }
  };

  const isSpeaker = currentPlayer?.isAudioSpeaker ?? false;

  return (
    <main className="min-h-full flex items-center justify-center p-0 sm:p-4 selection:bg-emerald-500 selection:text-black">
      {/* Container Mobile Central (Spotify Dark Lounge) */}
      <div className="w-full max-w-sm min-h-[100dvh] sm:min-h-0 sm:h-[840px] bg-[#121212] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl flex flex-col justify-between p-5 relative overflow-y-auto no-scrollbar">
        {/* Luz ambiente suave */}
        <div className="absolute inset-0 glow-warm pointer-events-none"></div>
        <div className="absolute inset-0 glow-cool pointer-events-none"></div>

        {/* Aviso de Configuração Pendente em Produção */}
        {isMissingServerUrl && (
          <div className="relative z-20 mb-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs shadow-lg">
            <div className="font-bold mb-1 flex items-center gap-1.5">
              <span>⚠️</span> Backend não configurado na Vercel
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Adicione a variável de ambiente <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200 font-mono">NEXT_PUBLIC_SERVER_URL</code> nas configurações do projeto na Vercel com a URL HTTPS do seu backend (ex: Render ou Railway).
            </p>
          </div>
        )}

        {/* Topo do Aplicativo quando em sala */}
        {room && (
          <header className="relative z-10 flex items-center justify-between pb-3 border-b border-white/5 text-xs text-zinc-400">
            <span className="font-mono tracking-wide text-emerald-400 font-semibold flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></span>
              SALA #{room.pin}
            </span>

            <div className="flex items-center gap-1.5">
              {!connected && (
                <span className="text-[10px] bg-amber-500/15 text-amber-400 font-mono px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                  Reconectando...
                </span>
              )}
              {room.status !== 'LOBBY' && room.status !== 'GAME_OVER' && (
                <span className="bg-white/5 px-2.5 py-1 rounded-full text-zinc-300 font-medium text-[11px]">
                  Rodada <strong className="text-white">{room.round}</strong>/{room.totalRounds}
                </span>
              )}
              {isSpeaker && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Caixa
                </span>
              )}
              {/* Botão Sair da Sala */}
              <button
                onClick={() => leaveRoom(room.pin)}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[11px] font-semibold border border-red-500/20 transition-all flex items-center gap-1 active:scale-95"
                title="Sair da sala"
              >
                <span>🚪</span>
                <span>Sair</span>
              </button>
            </div>
          </header>
        )}

        {/* Áudio Host Player (YouTube IFrame em container oculto + gatilho físico) */}
        {room && (
          <AudioSpeakerPlayer
            pin={room.pin}
            isSpeaker={isSpeaker}
            speakerCue={speakerCue}
            onPlaybackStarted={startSpeakerPlayback}
            status={room.status}
          />
        )}

        {/* Efeito de Loading: Servidor em Hibernação (Render Free Tier) */}
        {!room && !connected && !isMissingServerUrl && connectingSeconds >= 1 ? (
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-3 py-6 animate-in fade-in duration-300">
            {/* Vinil Girando com Aura */}
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-[#161616] border-2 border-white/10 shadow-[0_0_35px_rgba(30,215,96,0.2)] flex items-center justify-center animate-spin-slow">
                <div className="w-9 h-9 rounded-full bg-[#831843] border border-pink-400/30 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#121212] border border-white/20" />
                </div>
              </div>
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Despertando Servidor
            </div>

            <h2 className="text-lg font-extrabold text-white mb-2 tracking-tight">
              Acordando o Vinyl Lounge...
            </h2>

            <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed mb-5">
              Servidores gratuitos no Render entram em repouso após 15 min de inatividade e levam cerca de{' '}
              <strong className="text-zinc-200">30 a 50 segundos</strong> para acordar. Já estamos iniciando!
            </p>

            {/* Barra de Progresso Estimada */}
            <div className="w-full max-w-[240px] bg-[#181818] p-3 rounded-2xl border border-white/5 shadow-inner mb-4">
              <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                <span className="text-zinc-500">Conectando</span>
                <span className="text-emerald-400 font-bold">{connectingSeconds}s</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(98, Math.max(10, (connectingSeconds / 45) * 100))}%` }}
                />
              </div>
            </div>

            <button
              onClick={reconnectServer}
              className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 decoration-zinc-600 hover:decoration-white transition-all py-1"
            >
              Forçar tentativa agora ↻
            </button>
          </div>
        ) : (
          /* Renderização Condicional de Telas por Estado da Sala */
          <div className="relative z-10 flex-1 flex flex-col my-auto py-2">
            {(!room || room.status === 'LOBBY') && (
              <LobbyView
                room={room}
                currentPlayer={currentPlayer}
                onCreateRoom={createRoom}
                onJoinRoom={joinRoom}
                onClaimSpeaker={claimSpeaker}
                onStartGame={startGame}
                onCopyPin={handleCopyPin}
                onLeaveRoom={leaveRoom}
              />
            )}

            {room?.status === 'MASTER_CHOOSING' && (
              <MasterChoosingView
                room={room}
                currentPlayer={currentPlayer}
                onSearchYouTube={searchYouTube}
                onFetchLyrics={fetchLyrics}
                onSelectTrack={selectTrack}
                onShowToast={showToast}
              />
            )}

            {room?.status === 'WAITING_SPEAKER_TRIGGER' && (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-6 animate-in fade-in">
                <div className="w-20 h-20 rounded-full bg-[#18181c] border-2 border-emerald-500/20 flex items-center justify-center mb-5 text-3xl animate-pulse">
                  🔊
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Engatilhando na Caixa de Som...</h3>
                <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                  {isSpeaker
                    ? 'Toque no botão de confirmação para soltar o som no Bluetooth da sala.'
                    : 'Aguardando o jogador da Caixa de Som autorizar a reprodução do áudio.'}
                </p>
              </div>
            )}

            {room?.status === 'ROUND_PLAYING' && (
              <GuessingView
                room={room}
                currentPlayer={currentPlayer}
                roundTiming={roundTiming}
                onSubmitGuess={submitGuess}
                onShowToast={showToast}
              />
            )}

            {room?.status === 'ROUND_REVEAL' && (
              <RevealView
                room={room}
                currentPlayer={currentPlayer}
                results={lastResults}
                onNextRound={nextRound}
              />
            )}

            {room?.status === 'GAME_OVER' && (
              <GameOverView
                room={room}
                currentPlayer={currentPlayer}
                onRematch={rematch}
              />
            )}
          </div>
        )}

        {/* Rodapé Minimalista */}
        <footer className="relative z-10 pt-2 text-center text-[10px] text-zinc-500 font-mono">
          LOUNGE DE DISCOS • {connected ? 'CONECTADO' : `ACORDANDO SERVIDOR (${connectingSeconds}s)...`}
        </footer>

        {/* Toast Notifier */}
        {toast && (
          <div className="fixed inset-x-4 top-4 z-50 max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-[#242424] border border-white/10 text-white text-xs font-semibold text-center shadow-2xl animate-in slide-in-from-top-4 duration-200">
            {toast}
          </div>
        )}
      </div>
    </main>
  );
}
