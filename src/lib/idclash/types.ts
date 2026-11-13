/**
 * ID Clash — client-side view of the authoritative room state.
 * Mirrors the sanitized snapshot the realtime server pushes per player.
 */

export type GameStatus = 'waiting' | 'prep' | 'playing' | 'ended';
export type TurnPhase = 'ask' | 'answer';
export type AnswerType = 'yes' | 'no' | 'dontknow';
export type PowerupType =
  | 'double_turn'
  | 'time_freeze'
  | 'letter_reveal'
  | 'veto_shield'
  | 'steal'
  | 'category_reveal';
export type LogType = 'system' | 'question' | 'answer' | 'guess' | 'powerup' | 'win';
export type EndReason = 'guess' | 'time' | 'forfeit';

export interface GameConfig {
  turnSeconds: number;
  dontKnowLimit: number;
  guessLimit: number;
  similarityThreshold: number;
  letterRevealAfterPercent: number;
}

export interface PowerupCard {
  id: string;
  type: PowerupType;
  used: boolean;
}

export interface Intel {
  letter?: string;
  category?: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  type: LogType;
  text: string;
  by: string | null;
}

export interface PlayerBrief {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  locked: boolean;
}

export interface OpponentBrief {
  id: string;
  name: string;
  connected: boolean;
  locked: boolean;
  dontKnowUsed: number;
  guessesUsed: number;
  handCount: number;
}

export interface PendingQuestion {
  id: string;
  from: string;
  to: string;
  text: string;
  askedAt: number;
}

export interface RevealedIdentity {
  pid: string;
  name: string;
  character: string | null;
  category: string | null;
}

export interface MeState {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  locked: boolean;
  dontKnowUsed: number;
  guessesUsed: number;
  hand: PowerupCard[];
  intel: Intel;
  doubleTurnArmed: boolean;
}

export interface RoomState {
  serverTime: number;
  code: string;
  status: GameStatus;
  hostId: string;
  durationMin: number;
  config: GameConfig;
  players: PlayerBrief[];
  opponent: OpponentBrief | null;
  me: MeState;
  currentTurn: string | null;
  turnPhase: TurnPhase | null;
  turnEndsAt: number | null;
  pending: PendingQuestion | null;
  startedAt: number | null;
  endsAt: number | null;
  letterRevealUnlocksAt: number | null;
  log: LogEntry[];
  winner: string | null;
  endReason: EndReason | null;
  revealed: RevealedIdentity[] | null;
}
