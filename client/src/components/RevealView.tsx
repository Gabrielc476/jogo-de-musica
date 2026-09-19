'use client';

import { Player, Room } from '../types/game';
import { RoundResultsData } from '../hooks/useGameSocket';

interface RevealViewProps {
  room: Room;
  currentPlayer?: Player;
  results: RoundResultsData | null;
  onNextRound: (pin: string) => void;
}

export function RevealView({
  room,
  currentPlayer,
  results,
  onNextRound
}: RevealViewProps) {
  const isHostOrMaster = currentPlayer?.isHost || currentPlayer?.isMaster;
  const track = results?.track || room.currentTrack;

  // Ordena jogadores por pontuação decrescente
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col justify-between flex-1 py-1 gap-2.5 animate-in fade-in">
      {/* Faixa Revelada */}
      <div className="bg-[#181818] p-3.5 rounded-2xl border border-white/10 shadow-xl flex items-center gap-3.5">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-md border border-white/10"
          style={{ backgroundColor: track?.color || '#7f1d1d' }}
        >
          {track?.tag || 'VL'}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-wider block">
            Música Revelada
          </span>
          <h2 className="text-sm font-bold text-white truncate">{track?.title}</h2>
          <p className="text-xs text-zinc-400 truncate">{track?.artist}</p>
        </div>
      </div>

      {/* Destaque do Dilema do Mestre */}
      <div className="bg-[#141417] p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
        <span className="text-zinc-400">
          Mestre: <strong className="text-white">{room.players[room.masterIndex]?.nickname}</strong>
        </span>
        <span className="font-mono font-bold text-emerald-400">
          +{results?.masterPoints ?? 0} pts
        </span>
      </div>

      {/* Tabela de Palpites e Pontuação da Rodada */}
      <div className="bg-[#181818] p-3 rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden">
        <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider mb-2 px-1">
          Placar da Rodada & Palpites
        </span>

        <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pr-0.5">
          {sortedPlayers.map((player, index) => {
            const guess = results?.guesses?.find((g) => g.playerId === player.id);
            const isMasterOfRound = player.id === room.players[room.masterIndex]?.id;

            return (
              <div
                key={player.id}
                className="p-2 rounded-xl bg-[#121212] border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-500 w-4 text-center font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {player.nickname}
                      {isMasterOfRound && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300">
                          DJ
                        </span>
                      )}
                    </div>
                    {!isMasterOfRound && guess && (
                      <div className="text-[10px] text-zinc-400">
                        {guess.isTrackCorrect ? (
                          <span className="text-emerald-400">✓ Acertou música</span>
                        ) : (
                          <span className="text-zinc-500">
                            Chutou: &ldquo;{guess.trackGuess || 'Em branco'}&rdquo;
                          </span>
                        )}
                        {guess.isArtistCorrect && (
                          <span className="text-emerald-400 ml-1.5">(+bônus banda)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-sm font-bold text-white block">
                    {player.score} pts
                  </span>
                  {guess && guess.pointsEarned > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      +{guess.pointsEarned}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botão de Próxima Rodada */}
      {isHostOrMaster ? (
        <button
          onClick={() => onNextRound(room.pin)}
          className="w-full py-4 rounded-xl font-extrabold text-sm bg-white hover:bg-zinc-200 active:scale-[0.99] text-black transition-all shadow-lg"
        >
          {room.round >= room.totalRounds ? 'Ver Pódio Final 🏆' : 'Próxima Rodada →'}
        </button>
      ) : (
        <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-xs text-zinc-400">
            Aguardando o Mestre ou Anfitrião avançar a rodada...
          </p>
        </div>
      )}
    </div>
  );
}
