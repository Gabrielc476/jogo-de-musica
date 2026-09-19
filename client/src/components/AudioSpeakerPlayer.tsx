'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface AudioSpeakerPlayerProps {
  pin: string;
  isSpeaker: boolean;
  speakerCue: { videoId: string; startSec: number; durationSec: number } | null;
  onPlaybackStarted: (pin: string) => void;
  status: string;
}

export function AudioSpeakerPlayer({
  pin,
  isSpeaker,
  speakerCue,
  onPlaybackStarted,
  status
}: AudioSpeakerPlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Carrega a biblioteca oficial da YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT && window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (playerRef.current) return;
      try {
        playerRef.current = new window.YT.Player('youtube-speaker-iframe', {
          height: '200',
          width: '200',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: () => {
              setIsReady(true);
            }
          }
        });
      } catch (err) {
        console.warn('Erro ao inicializar YouTube IFrame Player:', err);
      }
    }

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  // Disparo manual pelo botão físico do usuário (Gatilho Físico Obrigatório)
  const handlePhysicalPlay = () => {
    if (!speakerCue || !playerRef.current) return;

    try {
      const { videoId, startSec, durationSec } = speakerCue;
      const player = playerRef.current;

      player.setVolume(100);
      player.loadVideoById({
        videoId,
        startSeconds: startSec
      });
      player.playVideo();
      setIsPlaying(true);

      // Notifica o servidor imediatamente para deflagrar a contagem sincronizada
      onPlaybackStarted(pin);

      // Inicia monitoramento para executar o Fade Out Suave de 1.5s antes do corte
      const checkInterval = 100;
      const snippetEndSec = startSec + durationSec;
      const fadeStartSec = snippetEndSec - 1.5;

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      fadeIntervalRef.current = setInterval(() => {
        try {
          if (!player.getCurrentTime) return;
          const current = player.getCurrentTime();

          // Fase do Fade Out Suave
          if (current >= fadeStartSec && current < snippetEndSec) {
            const timeLeft = snippetEndSec - current;
            const volumePercent = Math.max(0, Math.min(100, Math.round((timeLeft / 1.5) * 100)));
            player.setVolume(volumePercent);
          }

          // Fim do áudio do trecho
          if (current >= snippetEndSec) {
            player.pauseVideo();
            player.setVolume(100);
            setIsPlaying(false);
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          }
        } catch {
          // Iframe pode estar em buffering
        }
      }, checkInterval);
    } catch (err) {
      console.error('Falha ao acionar reprodução do áudio:', err);
    }
  };

  // Se a rodada foi revelada ou reiniciada, garante que o som seja pausado
  useEffect(() => {
    if (status === 'ROUND_REVEAL' || status === 'MASTER_CHOOSING' || status === 'GAME_OVER') {
      if (playerRef.current?.pauseVideo) {
        playerRef.current.pauseVideo();
      }
      setIsPlaying(false);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    }
  }, [status]);

  return (
    <>
      {/* IFrame em container oculto fora do campo de visão para não dar spoiler visual */}
      <div className="fixed -bottom-96 -left-96 w-48 h-48 opacity-0 pointer-events-none z-0 overflow-hidden">
        <div id="youtube-speaker-iframe"></div>
      </div>

      {/* Botão de Disparo Físico de Áudio exclusivo para o aparelho da Caixa de Som */}
      {isSpeaker && status === 'WAITING_SPEAKER_TRIGGER' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-6 text-emerald-400 text-3xl animate-pulse shadow-[0_0_40px_rgba(30,215,96,0.3)]">
            🔊
          </div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">O Mestre escolheu a faixa!</h2>
          <p className="text-sm text-zinc-400 max-w-xs mb-8">
            Você está comandando a <strong className="text-emerald-400 font-semibold">Caixa de Som</strong>. Toque abaixo para liberar o áudio no Bluetooth da sala.
          </p>
          <button
            onClick={handlePhysicalPlay}
            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-base tracking-wide transition-all shadow-[0_4px_30px_rgba(30,215,96,0.4)] flex items-center justify-center gap-3"
          >
            <span>▶</span>
            <span>Soltar o Som na Caixa</span>
          </button>
        </div>
      )}
    </>
  );
}
