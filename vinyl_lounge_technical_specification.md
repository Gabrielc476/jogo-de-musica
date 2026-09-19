# Vinyl Lounge — Adivinhe a Música (Technical Specification & Architecture)

> **Document Version:** 1.1.0  
> **Target Audience:** Autonomous Code Agents (Cursor, Claude Code, Copilot, etc.) & Fullstack Developers.  
> **Status:** Architecture Approved & Ready for Implementation.

---

## 1. Project Overview & Product Vision

**Vinyl Lounge** is a mobile-first, real-time multiplayer music party game inspired by Kahoot and Heardle, set within a cozy, retro-modern vinyl lounge aesthetic (dark mode, warm ambient glows, Spotify-like clean UI).

### Core Differentiator: Single Speaker / Party Mode
Instead of requiring every mobile device to play audio independently (which triggers aggressive mobile browser autoplay blocks and causes network desynchronization):
- **One device acts as the "Caixa de Som" (Audio Host / Speaker)** connected via Bluetooth to a room speaker.
- **The player holding the "Caixa de Som" can still play and guess normally**, with audio running through a dedicated YouTube IFrame player that does not reveal video titles or thumbnails to the player.
- **Each round rotates the role of "Mestre" (DJ)**. The Master searches YouTube for a track and sets a specific snippet window (e.g., 10s, 15s, or 20s).
- **Synchronized Lyrics Visualizer for the Master:** While scrubbing through the timeline slider, the Master sees real-time synchronized lyrics for that specific second window (powered by LRCLIB API), allowing them to pinpoint refrains or iconic verses instantly without needing headphones.
- All other players submit guesses for **Track Name** (mandatory for primary points) and **Artist/Band** (bonus points).
- **Inverse Scarcity Scoring:** Harder tracks reward more points—the fewer players who guess correctly, the higher the score allocated.

---

## 2. System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│  Next.js (App Router) + React + Tailwind CSS                │
│  - Mobile-first responsive layout (min-h-[100dvh])          │
│  - Socket.io Client                                         │
│  - YouTube IFrame API (hosted only on the Audio Host client)│
│  - Realtime Lyrics Scrubber (LRC timestamp matching)        │
└──────────────┬───────────────────────────────▲──────────────┘
               │ WebSocket Bidirectional       │
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                      Server Layer                           │
│  Node.js + Fastify / Express + Socket.io Server + TypeScript│
│                                                             │
│  Modules:                                                   │
│  ├── RoomStateManager (In-memory store / Redis)             │
│  ├── GameLoopStateMachine (Lobby -> Master -> Play -> Score)│
│  ├── AnswerMatcher (Levenshtein + Text Normalizer)          │
│  ├── DynamicScoringEngine                                   │
│  ├── YouTubeSearchProxy (Data API v3 with quota caching)    │
│  └── LyricsService (LRCLIB Integration + LRU Cache)         │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack Details
- **Frontend:** React 19 / Next.js 15, Tailwind CSS, TypeScript.
- **Backend:** Node.js (TypeScript), Socket.io `^4.8.x`, Fastify or Express.
- **State Store:** In-memory `Map<string, Room>` for development; Redis for production horizontal scaling.
- **External APIs:**
  - YouTube Data API v3 (`search.list` cached aggressively, direct link parsing fallback).
  - LRCLIB API (`https://lrclib.net/api/get` — free, open, public database for synced `.lrc` lyrics).

---

## 3. Data Models & TypeScript Interfaces

```typescript
// types/game.ts

export type RoomStatus = 
  | 'LOBBY' 
  | 'MASTER_CHOOSING' 
  | 'WAITING_SPEAKER_TRIGGER' 
  | 'ROUND_PLAYING' 
  | 'ROUND_REVEAL' 
  | 'GAME_OVER';

export interface Player {
  id: string;              // Socket.io socket.id
  nickname: string;
  avatarSeed: string;      // Identifier for avatar color/initials
  score: number;
  isHost: boolean;         // Room creator (can start game, adjust round count)
  isMaster: boolean;       // Current round selector
  isAudioSpeaker: boolean; // Device connected to the Bluetooth speaker
  hasGuessed: boolean;     // Has submitted guess in current round
}

export interface LyricLine {
  second: number;          // Timestamp in seconds (float or int)
  text: string;            // Lyric text for that timestamp
}

export interface TrackSnippet {
  videoId: string;
  title: string;           // Normalized title for verification
  artist: string;          // Normalized artist for verification
  rawTitle: string;        // Original display title from YouTube
  startSec: number;        // Snippet start time in seconds
  durationSec: number;     // Snippet duration (10, 15, or 20)
  color?: string;          // Accent hex for card UI
  tag?: string;            // Initials badge (e.g. 'TM' for Tim Maia)
  syncedLyrics?: LyricLine[]; // Parsed timestamped lyrics for timeline preview
}

export interface PlayerGuess {
  playerId: string;
  trackGuess: string;
  artistGuess: string;
  isTrackCorrect: boolean;
  isArtistCorrect: boolean;
  pointsEarned: number;
  submittedAt: number;     // Milliseconds from round start (for tie-breaking)
}

export interface Room {
  pin: string;                     // 4-character alphanumeric room code
  status: RoomStatus;
  hostId: string;
  speakerId: string | null;        // Socket ID of player designated as the speaker
  masterIndex: number;             // Index in players array pointing to current Master
  players: Player[];
  currentTrack?: TrackSnippet;
  currentGuesses: Map<string, PlayerGuess>;
  round: number;
  totalRounds: number;
  roundEndsAt?: number;            // Absolute epoch timestamp (Date.now() + ms)
}
```

---

## 4. Game Loop State Machine

```
               ┌───────────────┐
               │     LOBBY     │ <── Host selects settings, one picks "Caixa de Som"
               └───────┬───────┘
                       │ [game:start]
                       ▼
            ┌─────────────────────┐
            │   MASTER_CHOOSING   │ <── Master searches track, views synced lyrics & cuts snippet
            └──────────┬──────────┘
                       │ [track:select]
                       ▼
        ┌─────────────────────────────┐
        │   WAITING_SPEAKER_TRIGGER   │ <── Speaker device shows "Soltar o Som" button
        └──────────────┬──────────────┘
                       │ [speaker:started] (User gesture unlocks mobile audio)
                       ▼
            ┌─────────────────────┐
            │    ROUND_PLAYING    │ <── 15s timer runs, players guess track + artist
            └──────────┬──────────┘
                       │ Timer expires OR all players have guessed
                       ▼
            ┌─────────────────────┐
            │    ROUND_REVEAL     │ <── Cover, points, & scoreboard displayed
            └──────────┬──────────┘
                       │ [round:next]
                       ▼
        (If round >= totalRounds) ────► [ GAME_OVER ]
        (Else: rotate masterIndex) ───► [ MASTER_CHOOSING ]
```

---

## 5. WebSocket (Socket.io) Protocol Specification

### Client to Server Events (`C2S`)

| Event Name | Payload | Handled By Server |
| :--- | :--- | :--- |
| `room:create` | `{ nickname: string }` | Generates unique 4-digit PIN, sets sender as Host. |
| `room:join` | `{ pin: string, nickname: string }` | Validates room, appends player, broadcasts updated state. |
| `room:claim_speaker` | `{ pin: string }` | Assigns caller's `id` to `room.speakerId`. Clears previous. |
| `game:start` | `{ pin: string, totalRounds: number }` | Only valid if called by `hostId`. Sets state to `MASTER_CHOOSING`. |
| `youtube:search` | `{ query: string }` | Only valid from current Master. Calls YouTube Data API or cache. |
| `lyrics:fetch` | `{ trackName: string, artistName: string }` | Fetches timestamped lyrics from LRCLIB cache/API for the Master's trimmer. |
| `track:select` | `{ pin: string, snippet: TrackSnippet }` | Sets `currentTrack`, sets status to `WAITING_SPEAKER_TRIGGER`. |
| `speaker:started` | `{ pin: string }` | Only valid from `speakerId`. Starts countdown; status `ROUND_PLAYING`. |
| `guess:submit` | `{ pin: string, track: string, artist: string }` | Evaluates guess; marks `player.hasGuessed = true`. |
| `round:next` | `{ pin: string }` | Only valid from Host or Master. Increments round, updates Master. |

### Server to Client Events (`S2C`)

| Event Name | Recipient | Payload | Description |
| :--- | :--- | :--- | :--- |
| `room:sync` | All in Room | `{ room: Room }` | Full state synchronization upon mutations. |
| `lyrics:data` | Master Only | `{ syncedLyrics: LyricLine[] }` | Returns timestamped lyric array to sync with timeline slider. |
| `speaker:cue` | Speaker Only (`speakerId`) | `{ videoId: string, startSec: number, durationSec: number }` | Instructs the speaker device to prepare playback. |
| `round:started` | All in Room | `{ endsAt: number, durationSec: number }` | Triggers synchronized timer countdown across all UI instances. |
| `guess:received` | All in Room | `{ playerId: string }` | Indicates that a player has submitted their guess. |
| `round:results` | All in Room | `{ track: TrackSnippet, guesses: PlayerGuess[], scores: Player[] }` | Reveals correct answers and newly calculated scores. |
| `error:toast` | Single Socket | `{ message: string }` | Feedback for invalid PIN, duplicated nickname, etc. |

---

## 6. Synchronized Lyrics Integration (LRCLIB)

To eliminate guessing games when scrubbing the timeline, the Master UI displays the exact lyrics sung at any selected second.

### LRC Format Parser
LRCLIB returns synced lyrics in standard LRC format:
`[00:24.50] Não sei por que você se foi`  
`[00:28.12] Quantas saudades eu senti`

```typescript
// lib/lyrics.ts

export function parseLrc(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line.trim());
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const totalSeconds = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) {
        result.push({ second: totalSeconds, text });
      }
    }
  }

  return result.sort((a, b) => a.second - b.second);
}

export function getLyricAtSecond(lyrics: LyricLine[], second: number): string {
  if (!lyrics.length) return "Letra não disponível para esta faixa";
  let activeText = lyrics[0].text;
  for (let i = 0; i < lyrics.length; i++) {
    if (second >= lyrics[i].second) {
      activeText = lyrics[i].text;
    } else {
      break;
    }
  }
  return activeText;
}
```

---

## 7. Mobile Audio & YouTube API Constraints (CRITICAL)

### The Mobile Autoplay Constraint
Mobile browsers (WebKit on iOS Safari, Blink on Android Chrome) **strictly prohibit programmatic `.playVideo()` calls initiated by asynchronous WebSocket events**.

### The Adopted Solution
1. When the Master selects the track, the server enters `WAITING_SPEAKER_TRIGGER`.
2. The player assigned as `isAudioSpeaker` receives `speaker:cue`.
3. An explicit physical button renders on the Speaker's screen: **`[ Soltar o Som na Caixa ]`**.
4. The user taps the button. This physical user gesture triggers:
   ```javascript
   player.loadVideoById({ videoId, startSeconds: startSec });
   player.playVideo();
   ```
5. The client immediately emits `speaker:started` to the server.
6. The server receives `speaker:started` and broadcasts `round:started` with a shared `endsAt` timestamp to everyone.
7. The Speaker's screen transitions to the standard guessing interface so that this player can also guess and earn points.
8. The IFrame is kept alive in a container with minimal size (`200px x 200px`), obscured behind the opaque dark game UI to prevent title spoilers while complying with YouTube IFrame policies.

---

## 8. Dynamic Scoring Engine

The scoring system uses an **Inverse Scarcity Formula** to reward obscure knowledge and prevent runaways.

### Mathematical Formula
Let $N_{\text{guessers}}$ be the total number of non-master active players, and $C_{\text{track}}$ be the number of players who guessed the track correctly ($C_{\text{track}} \ge 0$).

$$\text{Base Points per Correct Player} = \begin{cases} 
0, & \text{if } C_{\text{track}} = 0 \\
\left\lfloor \dfrac{1000}{C_{\text{track}}} \right\rfloor, & \text{if } C_{\text{track}} \ge 1 
\end{cases}$$

$$\text{Artist Bonus Points} = 150 \quad (\text{awarded only if the track is also correct})$$

$$\text{Master Points} = \begin{cases}
500, & \text{if } 1 \le C_{\text{track}} < N_{\text{guessers}} \quad (\text{Balanced challenge}) \\
0, & \text{if } C_{\text{track}} = 0 \quad (\text{Too impossible}) \\
200, & \text{if } C_{\text{track}} = N_{\text{guessers}} \quad (\text{Too obvious})
\end{cases}$$

---

## 9. String Normalization & Fuzzy Match Engine

To ensure fair validation on mobile keyboards (avoiding penalties for typos, missing accents, or YouTube title noise):

```typescript
// lib/matcher.ts

export function cleanMusicString(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics / accents
    .replace(/\(.*?\)|\[.*?\]/g, '') // Remove (Official Video), [Remastered], etc.
    .replace(/\b(feat|ft|featuring|ao vivo|remastered|lyric video)\b.*/gi, '')
    .replace(/[^a-z0-9\s]/g, '')     // Strip punctuation
    .replace(/\s+/g, ' ')            // Normalize multiple whitespace
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isMatch(userGuess: string, targetAnswer: string, tolerance: number = 0.82): boolean {
  const cleanGuess = cleanMusicString(userGuess);
  const cleanTarget = cleanMusicString(targetAnswer);

  if (!cleanGuess || !cleanTarget) return false;
  if (cleanGuess === cleanTarget) return true;
  if (cleanTarget.includes(cleanGuess) && cleanGuess.length >= 4) return true;

  const maxLen = Math.max(cleanGuess.length, cleanTarget.length);
  const dist = levenshteinDistance(cleanGuess, cleanTarget);
  const similarity = 1 - (dist / maxLen);

  return similarity >= tolerance;
}
```

---

## 10. Design System & UI Specifications

The UI matches a **curated Spotify-style dark lounge**:

| Token | CSS Value | Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#0a0a0d` | Outer frame and viewport base |
| **Card / Container** | `#121212` | Mobile container root |
| **Elevated Surfaces** | `#181818` | Track cards, input field grouping wrapper |
| **Hover / Active Pill** | `#242424` | Search bar, unselected filter chips |
| **Primary Accent** | `#1ed760` (Spotify Green) | Confirmations, active playback pulse, round badges |
| **Text Primary** | `#ffffff` (Outfit font, font-weight: 700/800) | Track titles, headers, numeric timer |
| **Text Subdued** | `#a7a7a7` (Outfit font, font-weight: 400/500) | Artist names, label descriptors |
| **Monospace** | `JetBrains Mono` | Time codes (`00:14`, `04:18`), room PINs |

---

## 11. Step-by-Step Implementation Roadmap for Coding Agents

### Phase 1: Core Backend & Room State (`server/`)
1. Setup a Node.js TypeScript project with Fastify or Express + Socket.io.
2. Implement `RoomManager` supporting `createRoom`, `joinRoom`, `leaveRoom`, `setSpeaker`, and `rotateMaster`.
3. Implement `MatcherService` containing `cleanMusicString` and `isMatch`.
4. Implement `ScoringService` with the inverse distribution formula.

### Phase 2: YouTube Search & Lyrics Module
1. Build `YouTubeService` integrating Google Cloud API Key with endpoint `GET https://www.googleapis.com/youtube/v3/search`.
2. Build `LyricsService` integrating LRCLIB API with in-memory caching to fetch `.syncedLyrics` and return parsed timestamp objects.

### Phase 3: Client Shell & Sockets (`client/`)
1. Create a Next.js / Tailwind mobile-first shell referencing the UI layout in `index.html`.
2. Configure custom font loaders for `Outfit` and `JetBrains Mono`.
3. Create `useGameSocket(pin, nickname)` React hook handling connection lifecycle and typed events.

### Phase 4: Screens & Components
1. **Lobby Screen:** Input PIN, nickname, "Conectar como Caixa de Som" toggle, players list.
2. **Master Screen (Catalog, Synced Lyrics & Snippet Trimmer):** 
   - Search input and track results.
   - Trimmer timeline slider with real-time synchronized lyric display snippet.
   - Snippet duration buttons (`10s`, `15s`, `20s`).
3. **Player / Guessing Screen:**
   - Vinyl spinning graphic with dynamic equalizer audio bars.
   - Unified guess card with fields: `Qual é a música?` and `Artista ou Banda`.
4. **Speaker Component (Audio Output):**
   - Hidden/blurred `react-youtube` instance.
   - Gesture button: `"▶ Soltar Som na Caixinha"`.
5. **Reveal & Scoreboard Screen:**
   - Displays correct track cover, title, points earned, and updated leaderboard.