export type RoomStatus =
  | 'LOBBY'
  | 'MASTER_CHOOSING'
  | 'WAITING_SPEAKER_TRIGGER'
  | 'ROUND_PLAYING'
  | 'ROUND_REVEAL'
  | 'GAME_OVER';

export interface Player {
  id: string;              // Current Socket.io socket.id
  persistentId: string;    // Persistent client ID (survives socket reconnection)
  nickname: string;
  avatarSeed: string;      // Identifier for avatar color/initials
  score: number;
  isHost: boolean;         // Room creator
  isMaster: boolean;       // Current round selector (DJ)
  isAudioSpeaker: boolean; // Device connected to the Bluetooth speaker
  hasGuessed: boolean;     // Has submitted guess in current round
  isOnline: boolean;       // Live connection flag
}

export interface LyricLine {
  second: number;          // Timestamp in seconds
  text: string;            // Lyric text for that timestamp
}

export interface TrackSnippet {
  videoId: string;
  title: string;           // Normalized / calibrated title for verification
  artist: string;          // Normalized / calibrated artist for verification
  rawTitle: string;        // Original display title from YouTube
  startSec: number;        // Snippet start time in seconds
  durationSec: number;     // Snippet duration (10, 15, or 20)
  color?: string;          // Accent hex for card UI
  tag?: string;            // Initials badge
  syncedLyrics?: LyricLine[]; // Parsed timestamped lyrics for timeline preview
}

export interface PlayerGuess {
  playerId: string;
  persistentId?: string;
  trackGuess: string;
  artistGuess: string;
  isTrackCorrect: boolean;
  isArtistCorrect: boolean;
  pointsEarned: number;
  submittedAt: number;     // Epoch timestamp
}

export interface RoundResultsPayload {
  track: TrackSnippet;
  guesses: PlayerGuess[];
  scores: Player[];
  masterPoints: number;
}

export interface Room {
  pin: string;                     // 4-character room code
  status: RoomStatus;
  hostId: string;
  speakerId: string | null;        // Socket ID or persistent ID of speaker
  masterIndex: number;             // Index in players array pointing to current Master
  players: Player[];
  currentTrack?: TrackSnippet;
  currentGuesses: Record<string, PlayerGuess>;
  round: number;
  totalRounds: number;
  roundEndsAt?: number;
  bufferEndsAt?: number;
  lastResults?: RoundResultsPayload; // Preserves results for late/reconnecting clients
}

// Client to Server Events
export interface ClientToServerEvents {
  'room:create': (data: { nickname: string; persistentId: string }) => void;
  'room:join': (data: { pin: string; nickname: string; persistentId: string }) => void;
  'room:reconnect': (data: { pin: string; persistentId: string }) => void;
  'room:claim_speaker': (data: { pin: string }) => void;
  'game:start': (data: { pin: string; totalRounds?: number }) => void;
  'youtube:search': (data: { query: string }, callback?: (results: any[]) => void) => void;
  'lyrics:fetch': (data: { trackName: string; artistName: string }, callback?: (lyrics: LyricLine[]) => void) => void;
  'track:select': (data: { pin: string; snippet: TrackSnippet }) => void;
  'speaker:started': (data: { pin: string }) => void;
  'guess:submit': (data: { pin: string; track: string; artist: string }) => void;
  'round:next': (data: { pin: string }) => void;
  'game:rematch': (data: { pin: string }) => void;
  'room:leave': (data: { pin: string; persistentId?: string }) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  'room:sync': (data: { room: Room }) => void;
  'lyrics:data': (data: { syncedLyrics: LyricLine[] }) => void;
  'speaker:cue': (data: { videoId: string; startSec: number; durationSec: number }) => void;
  'round:started': (data: { endsAt: number; bufferEndsAt: number; durationSec: number }) => void;
  'guess:received': (data: { playerId: string }) => void;
  'round:results': (data: RoundResultsPayload) => void;
  'error:toast': (data: { message: string }) => void;
}
